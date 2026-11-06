import {sb} from '@/lib/device-relay';
export type LinkedInOperation='inbox'|'open'|'thread'|'back'|'feed'|'search'|'send'|'company_search'|'network_suggestions'|'invite'|'attach';
export async function enqueueLinkedIn(userId:string,operation:LinkedInOperation,payload:Record<string,string>={}){
 const rows=await sb<Array<{id:string}>>('/rest/v1/cmg_linkedin_jobs',{method:'POST',body:JSON.stringify({user_id:userId,operation,payload}),prefer:'return=representation'});
 return rows[0];
}
/** Jobs the phone never picked up before their deadline become explicit errors (never run later). */
export async function expireLinkedIn(userId:string){
 await sb('/rest/v1/cmg_linkedin_jobs?user_id=eq.'+userId+'&status=eq.pending&expires_at=lt.'+encodeURIComponent(new Date().toISOString()),{method:'PATCH',
  body:JSON.stringify({status:'error',error:'expired: the phone never picked up this command (CamMicGo app not open with LinkedIn control enabled). Nothing was done.',payload:{},completed_at:new Date().toISOString()})}).catch(()=>{});
}
export type LinkedInJobRow={id:string;operation:string;status:string;result:unknown;error:string|null;created_at:string;claimed_at:string|null;completed_at:string|null;expires_at:string};
export async function getLinkedIn(userId:string,id:string):Promise<LinkedInJobRow|null>{
 if(!/^[0-9a-f-]{36}$/i.test(id))return null;
 await expireLinkedIn(userId);
 const rows=await sb<LinkedInJobRow[]>('/rest/v1/cmg_linkedin_jobs?id=eq.'+id+'&user_id=eq.'+userId+'&select=id,operation,status,result,error,created_at,claimed_at,completed_at,expires_at');
 return rows[0]??null;
}
export {jobState} from '@/lib/linkedin';
/** Is the phone's LinkedIn control polling right now (app open, control allowed)? */
export async function linkedInControlActive(userId:string){
 const rows=await sb<Array<{id:string}>>('/rest/v1/cmg_devices?user_id=eq.'+userId+'&revoked_at=is.null&linkedin_seen_at=gt.'+encodeURIComponent(new Date(Date.now()-30_000).toISOString())+'&select=id&limit=1').catch(()=>[]);
 return rows.length>0;
}
/** Next waiting job, without claiming it: lets the background relay notify the user. */
export async function peekLinkedIn(userId:string){
 const rows=await sb<Array<{id:string;operation:string;created_at:string;expires_at:string;participant:string|null;file:string|null;agent:string|null}>>('/rest/v1/cmg_linkedin_jobs?user_id=eq.'+userId+'&status=eq.pending&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&order=created_at.asc&limit=1&select=id,operation,created_at,expires_at,participant:payload->>participant,file:payload->>attachmentName,agent:payload->>agentName');
 return rows[0]??null;
}
export async function claimLinkedIn(userId:string,deviceId:string){
 const rows=await sb<Array<{id:string;operation:LinkedInOperation;payload:Record<string,string>}>>('/rest/v1/rpc/cmg_claim_linkedin_job',{method:'POST',body:JSON.stringify({p_user_id:userId,p_device_id:deviceId})});
 return rows[0]??null;
}
/** Ends a job; its payload (which may hold a temporary file link) is cleared at the same time. */
export async function finishLinkedIn(deviceId:string,id:string,result:unknown,error?:string){
 if(!/^[0-9a-f-]{36}$/i.test(id))return false;
 const rows=await sb<Array<{id:string}>>('/rest/v1/cmg_linkedin_jobs?id=eq.'+id+'&device_id=eq.'+deviceId+'&status=eq.claimed',{method:'PATCH',body:JSON.stringify(error?{status:'error',error:error.slice(0,1500),result:result??null,payload:{},completed_at:new Date().toISOString()}:{status:'done',result,payload:{},completed_at:new Date().toISOString()}),prefer:'return=representation'});
 return rows.length>0;
}

/** Five-minute, owner-scoped image link; only storage paths returned by claimed jobs are accepted. */
export async function signedLinkedInImage(userId:string,jobId:string,storagePath:string){
 if(!/^[0-9a-f-]{36}$/i.test(jobId)||!storagePath.startsWith(userId+'/'+jobId+'/linkedin-')||!/^[-a-z0-9/]+\/linkedin-(?:[0-9]|1[01])\.(?:jpg|png|webp|gif)$/i.test(storagePath))throw Error('Invalid media path');
 const base=process.env.SUPABASE_URL||'https://vfngxjsryklqldarkxhy.supabase.co';
 const data=await sb<{signedURL?:string;signedUrl?:string}>('/storage/v1/object/sign/cmg-notebook-artifacts/'+storagePath,{method:'POST',body:JSON.stringify({expiresIn:300})});
 const signed=data.signedURL||data.signedUrl;
 if(!signed||!signed.startsWith('/'))throw Error('Unable to sign image');
 return base+(signed.startsWith('/storage/v1/')?'':'/storage/v1')+signed;
}


