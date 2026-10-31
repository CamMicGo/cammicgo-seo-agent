/**
 * Per-user account settings for the remote MCP:
 * - bring-your-own Google Cloud OAuth client (client secret encrypted at rest, never sent back to the browser);
 * - administrators, the only users allowed to use the shared CamMicGo Google Cloud project;
 * - MCP call allowance (protects the free hosting): 100 counted calls/day, 10/min, 30 calls/min in total.
 */
import {sb} from '@/lib/device-relay';
import {decrypt,encrypt,type Credentials} from '@/lib/google-session';

export const LIMITS={
 daily:Number(process.env.MCP_DAILY_LIMIT||100),
 adminDaily:Number(process.env.MCP_ADMIN_DAILY_LIMIT||2000),
 minuteCostly:Number(process.env.MCP_MINUTE_LIMIT||10),
 minuteTotal:Number(process.env.MCP_MINUTE_TOTAL_LIMIT||30),
 global:Number(process.env.MCP_GLOBAL_DAILY_LIMIT||5000),
};
export const REMOTE_REDIRECT_URI='https://seo.cammicgo.com/api/auth/google/callback';
export const ACCOUNT_URL='https://seo.cammicgo.com/account';

export async function isAdmin(userId:string){
 const rows=await sb<Array<{user_id:string}>>('/rest/v1/cmg_admins?user_id=eq.'+userId+'&select=user_id');
 return rows.length>0;
}

// ---------- BYO Google Cloud client ----------
type Row={project_id:string|null;client_id:string;client_secret_enc:string;verified_at:string|null;updated_at:string};
export type ClientSummary={projectId:string|null;clientId:string;secretHint:string;verifiedAt:string|null;updatedAt:string};

export function validateClient(input:{projectId?:unknown;clientId?:unknown;clientSecret?:unknown}){
 const projectId=typeof input.projectId==='string'&&input.projectId.trim()?input.projectId.trim():null;
 const clientId=typeof input.clientId==='string'?input.clientId.trim():'';
 const clientSecret=typeof input.clientSecret==='string'?input.clientSecret.trim():'';
 if(projectId&&!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId))return {error:'invalid_project_id'} as const;
 if(!/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(clientId)||clientId.length>250)return {error:'invalid_client_id'} as const;
 if(clientSecret.length<10||clientSecret.length>200||/\s/.test(clientSecret))return {error:'invalid_client_secret'} as const;
 return {projectId,clientId,clientSecret} as const;
}

/**
 * Checks the client ID / secret pair with Google without any user data: exchanging a dummy code
 * answers "invalid_client" when the pair is wrong and "invalid_grant" when it is valid.
 */
export async function verifyClientWithGoogle(clientId:string,clientSecret:string):Promise<'ok'|'invalid_client'|'unknown'>{
 try{
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({code:'cammicgo-verification',client_id:clientId,client_secret:clientSecret,redirect_uri:REMOTE_REDIRECT_URI,grant_type:'authorization_code'}),cache:'no-store',signal:AbortSignal.timeout(8000)});
  const body=await r.json().catch(()=>({})) as {error?:string};
  if(body.error==='invalid_client'||body.error==='unauthorized_client')return 'invalid_client';
  if(body.error==='invalid_grant'||body.error==='redirect_uri_mismatch')return 'ok';
  return 'unknown';
 }catch{return 'unknown'}
}

export async function saveClient(userId:string,c:{projectId:string|null;clientId:string;clientSecret:string},verified:boolean){
 const now=new Date().toISOString();
 await sb('/rest/v1/cmg_google_clients?on_conflict=user_id',{method:'POST',prefer:'resolution=merge-duplicates',body:JSON.stringify({user_id:userId,project_id:c.projectId,client_id:c.clientId,client_secret_enc:encrypt({secret:c.clientSecret}),verified_at:verified?now:null,updated_at:now})});
}

async function clientRow(userId:string){
 const rows=await sb<Row[]>('/rest/v1/cmg_google_clients?user_id=eq.'+userId+'&select=project_id,client_id,client_secret_enc,verified_at,updated_at');
 return rows[0]??null;
}

export async function clientSummary(userId:string):Promise<ClientSummary|null>{
 const row=await clientRow(userId);if(!row)return null;
 const secret=decrypt<{secret:string}>(row.client_secret_enc)?.secret||'';
 return {projectId:row.project_id,clientId:row.client_id,secretHint:secret?'••••'+secret.slice(-4):'',verifiedAt:row.verified_at,updatedAt:row.updated_at};
}

/** The user's own OAuth client, ready for the Google OAuth flow, or null. */
export async function clientCredentials(userId:string):Promise<(Credentials&{projectId:string|null})|null>{
 const row=await clientRow(userId);if(!row)return null;
 const secret=decrypt<{secret:string}>(row.client_secret_enc)?.secret;
 return secret?{mode:'byo',clientId:row.client_id,clientSecret:secret,projectId:row.project_id}:null;
}

export async function deleteClient(userId:string){
 await sb('/rest/v1/cmg_google_clients?user_id=eq.'+userId,{method:'DELETE'});
 await sb('/rest/v1/mcp_google_connections?user_id=eq.'+userId,{method:'DELETE'});
 await sb('/rest/v1/cmg_google_drive_write?user_id=eq.'+userId,{method:'DELETE'});
}

// ---------- MCP call allowance ----------
export type CallResult={ok:boolean;reason:'daily'|'minute'|'global'|null;used:number;limit:number};
/** Tools that are polled or free (status, pairing) only count towards the per-minute safety limit. */
export const FREE_TOOLS=new Set(['service_info','youtube_transcript_status','youtube_batch_status','device_pairing_code','device_revoke','science_sources']);

export async function consumeCall(userId:string,tool:string,admin:boolean):Promise<CallResult>{
 const cost=FREE_TOOLS.has(tool)?0:1;
 return sb<CallResult>('/rest/v1/rpc/cmg_consume_mcp_call',{method:'POST',body:JSON.stringify({p_user_id:userId,p_cost:cost,p_daily:admin?LIMITS.adminDaily:LIMITS.daily,p_minute_costly:admin?LIMITS.minuteCostly*6:LIMITS.minuteCostly,p_minute_total:admin?LIMITS.minuteTotal*4:LIMITS.minuteTotal,p_global:LIMITS.global})});
}

export async function usageToday(userId:string,admin:boolean){
 const today=new Date().toISOString().slice(0,10);
 const rows=await sb<Array<{calls:number}>>('/rest/v1/cmg_mcp_usage?user_id=eq.'+userId+'&usage_date=eq.'+today+'&select=calls');
 const tomorrow=new Date(today+'T00:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
 return {used:rows[0]?.calls??0,limit:admin?LIMITS.adminDaily:LIMITS.daily,perMinute:LIMITS.minuteCostly,resetsAt:tomorrow.toISOString()};
}
