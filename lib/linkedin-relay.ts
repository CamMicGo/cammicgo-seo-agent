import {sb} from '@/lib/device-relay';
export type LinkedInOperation='inbox'|'open'|'thread'|'back';
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
