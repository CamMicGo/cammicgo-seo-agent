/**
 * Encrypted storage of bring-your-own social app credentials (LinkedIn) and member connections.
 * Secrets never leave the server: the browser only sees a short hint.
 */
import {createHash} from 'node:crypto';
import {sb} from '@/lib/device-relay';
import {decrypt,encrypt} from '@/lib/google-session';
import type {LinkedInSession} from '@/lib/linkedin';

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
 await deleteSocialConnection(userId,provider);
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
