/**
 * Encrypted storage of bring-your-own social app credentials (LinkedIn) and member connections.
 * Secrets never leave the server: the browser only sees a short hint.
 */
import {createHash} from 'node:crypto';
import {sb} from '@/lib/device-relay';
import {decrypt,encrypt} from '@/lib/google-session';
import {appMode,type LinkedInAppMode,type LinkedInSession} from '@/lib/linkedin';

export type Provider='linkedin';
type ClientRow={client_id:string;client_secret_enc:string;verified_at:string|null;updated_at:string};
type ConnRow={encrypted_session:string;account_name:string|null;expires_at:string|null;updated_at:string};

export async function saveSocialClient(userId:string,provider:Provider,c:{clientId:string;clientSecret:string},verified:boolean){
 const now=new Date().toISOString();
 await sb('/rest/v1/cmg_social_clients?on_conflict=user_id,provider',{method:'POST',prefer:'resolution=merge-duplicates',
  body:JSON.stringify({user_id:userId,provider,client_id:c.clientId,client_secret_enc:encrypt({secret:c.clientSecret}),verified_at:verified?now:null,updated_at:now})});
}
async function clientRow(userId:string,provider:Provider){
 const rows=await sb<ClientRow[]>('/rest/v1/cmg_social_clients?user_id=eq.'+userId+'&provider=eq.'+provider+'&select=client_id,client_secret_enc,verified_at,updated_at');
 return rows[0]??null;
}
export async function socialClientSummary(userId:string,provider:Provider){
 const row=await clientRow(userId,provider);if(!row)return null;
 const secret=decrypt<{secret:string}>(row.client_secret_enc)?.secret||'';
 return {clientId:row.client_id,secretHint:secret?'••••'+secret.slice(-4):'',verifiedAt:row.verified_at,updatedAt:row.updated_at};
}
export async function socialClient(userId:string,provider:Provider){
 const row=await clientRow(userId,provider);if(!row)return null;
 const secret=decrypt<{secret:string}>(row.client_secret_enc)?.secret;
 return secret?{clientId:row.client_id,clientSecret:secret}:null;
}
export async function deleteSocialClient(userId:string,provider:Provider){
 await sb('/rest/v1/cmg_social_clients?user_id=eq.'+userId+'&provider=eq.'+provider,{method:'DELETE'});
 // A connection made with this app stops with it; one made with the shared CamMicGo app stays.
 const conn=await readLinkedInConnection(userId).catch(()=>null);
 if(!conn||conn.app!=='shared')await deleteSocialConnection(userId,provider);
}

// ---- The LinkedIn app shared by all users ----
type SharedRow={client_id:string;client_secret_enc:string;updated_by:string|null;updated_at:string};
const envShared=()=>{const id=process.env.LINKEDIN_CLIENT_ID?.trim(),secret=process.env.LINKEDIN_CLIENT_SECRET?.trim();return id&&secret?{clientId:id,clientSecret:secret}:null;};
async function sharedRow(provider:Provider){
 const rows=await sb<SharedRow[]>('/rest/v1/cmg_shared_social_apps?provider=eq.'+provider+'&select=client_id,client_secret_enc,updated_by,updated_at');
 return rows[0]??null;
}
/** The shared app: LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET when set (self-hosting), otherwise the app an administrator shared. */
export async function sharedClient(provider:Provider):Promise<{clientId:string;clientSecret:string}|null>{
 const env=envShared();if(env)return env;
 const row=await sharedRow(provider);if(!row)return null;
 const secret=decrypt<{secret:string}>(row.client_secret_enc)?.secret;
 return secret?{clientId:row.client_id,clientSecret:secret}:null;
}
/** What the account page may show about the shared app (never the secret). */
export async function sharedClientInfo(provider:Provider){
 const env=envShared();if(env)return {clientId:env.clientId,source:'env' as const,updatedBy:null as string|null};
 const row=await sharedRow(provider);
 return row?{clientId:row.client_id,source:'admin' as const,updatedBy:row.updated_by}:null;
}
/** An administrator makes the app saved in their own account the shared app (the encrypted secret is copied as is). */
export async function shareOwnClient(userId:string,provider:Provider){
 const row=await clientRow(userId,provider);if(!row)return false;
 await sb('/rest/v1/cmg_shared_social_apps?on_conflict=provider',{method:'POST',prefer:'resolution=merge-duplicates',
  body:JSON.stringify({provider,client_id:row.client_id,client_secret_enc:row.client_secret_enc,updated_by:userId,updated_at:new Date().toISOString()})});
 return true;
}
export async function unshareClient(provider:Provider){await sb('/rest/v1/cmg_shared_social_apps?provider=eq.'+provider,{method:'DELETE'});}
/** The app a user connects with: their own app first (bring your own), otherwise the shared CamMicGo app. */
export async function connectClient(userId:string,provider:Provider):Promise<{clientId:string;clientSecret:string;mode:LinkedInAppMode}|null>{
 const own=await socialClient(userId,provider);
 const shared=own?null:await sharedClient(provider).catch(()=>null);
 const mode=appMode(!!own,!!shared);
 return mode==='own'&&own?{...own,mode}:mode==='shared'&&shared?{...shared,mode}:null;
}

export async function saveLinkedInConnection(userId:string,s:LinkedInSession){
 await sb('/rest/v1/cmg_social_connections?on_conflict=user_id,provider',{method:'POST',prefer:'resolution=merge-duplicates',
  body:JSON.stringify({user_id:userId,provider:'linkedin',encrypted_session:encrypt(s),account_name:s.name,expires_at:new Date(s.expiresAt).toISOString(),updated_at:new Date().toISOString()})});
}
export async function readLinkedInConnection(userId:string){
 const rows=await sb<ConnRow[]>('/rest/v1/cmg_social_connections?user_id=eq.'+userId+'&provider=eq.linkedin&select=encrypted_session,account_name,expires_at,updated_at');
 return decrypt<LinkedInSession>(rows[0]?.encrypted_session);
}
export async function deleteSocialConnection(userId:string,provider:Provider){
 await sb('/rest/v1/cmg_social_connections?user_id=eq.'+userId+'&provider=eq.'+provider,{method:'DELETE'});
}

/**
 * One publication per confirmation. The first confirmed call claims the confirmation token (atomic insert);
 * a repeated call with the same token (retry after a timeout, a looping assistant) finds the claim instead.
 */
export type Network='linkedin'|'youtube';
export async function claimPublication(userId:string,network:Network,token:string):Promise<{claimed:true;id:string}|{claimed:false;status:string;result:Record<string,unknown>|null}>{
 const id=createHash('sha256').update(token).digest('hex');
 const rows=await sb<Array<{token_hash:string}>>('/rest/v1/cmg_publish_log?on_conflict=token_hash',{method:'POST',prefer:'return=representation,resolution=ignore-duplicates',
  body:JSON.stringify({token_hash:id,user_id:userId,network,status:'started'})});
 if(rows?.length)return {claimed:true,id};
 const prev=await sb<Array<{status:string;result:Record<string,unknown>|null;user_id:string}>>('/rest/v1/cmg_publish_log?token_hash=eq.'+id+'&select=status,result,user_id');
 const row=prev[0]&&prev[0].user_id===userId?prev[0]:null;
 return {claimed:false,status:row?.status??'started',result:row?.result??null};
}
/** Success: keeps the claim with the link. Definite failure before anything was published: frees the token for a retry. */
export async function finishPublication(id:string,result:Record<string,unknown>|null){
 if(!result){await sb('/rest/v1/cmg_publish_log?token_hash=eq.'+id+'&status=eq.started',{method:'DELETE'});return;}
 await sb('/rest/v1/cmg_publish_log?token_hash=eq.'+id,{method:'PATCH',body:JSON.stringify({status:'published',result,updated_at:new Date().toISOString()})});
}
