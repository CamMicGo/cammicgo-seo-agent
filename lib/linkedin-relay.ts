import {sb} from '@/lib/device-relay';
export type LinkedInOperation='inbox'|'open'|'thread'|'back'|'feed'|'search'|'send'|'company_search'|'network_suggestions'|'invite'|'attach';
export async function enqueueLinkedIn(userId:string,operation:LinkedInOperation,payload:Record<string,string>={}){
 const rows=await sb<Array<{id:string}>>('/rest/v1/cmg_linkedin_jobs',{method:'POST',body:JSON.stringify({user_id:userId,operation,payload}),prefer:'return=representation'});
 return rows[0];
}
export async function getLinkedIn(userId:string,id:string){
 if(!/^[0-9a-f-]{36}$/i.test(id))return null;
 const rows=await sb<Array<{id:string;status:string;result:unknown;error:string|null}>>('/rest/v1/cmg_linkedin_jobs?id=eq.'+id+'&user_id=eq.'+userId+'&select=id,status,result,error');
 return rows[0]??null;
}
export async function claimLinkedIn(userId:string,deviceId:string){
 const rows=await sb<Array<{id:string;operation:LinkedInOperation;payload:Record<string,string>}>>('/rest/v1/rpc/cmg_claim_linkedin_job',{method:'POST',body:JSON.stringify({p_user_id:userId,p_device_id:deviceId})});
 return rows[0]??null;
}
export async function finishLinkedIn(deviceId:string,id:string,result:unknown,error?:string){
 if(!/^[0-9a-f-]{36}$/i.test(id))return false;
 const rows=await sb<Array<{id:string}>>('/rest/v1/cmg_linkedin_jobs?id=eq.'+id+'&device_id=eq.'+deviceId+'&status=eq.claimed',{method:'PATCH',body:JSON.stringify(error?{status:'error',error:error.slice(0,1500),completed_at:new Date().toISOString()}:{status:'done',result,completed_at:new Date().toISOString()}),prefer:'return=representation'});
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

[executed on device: instance-20260604-1918 (a7765734-3129-4de5-be49-77d0c678b0cf)]
