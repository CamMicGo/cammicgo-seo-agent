import {sb} from '@/lib/device-relay';
export type LinkedInOperation='inbox'|'open'|'thread'|'back'|'feed'|'search'|'send'|'company_search'|'network_suggestions'|'invite'|'attach'|'job_search'|'job_details'|'recommended_jobs'|'company_profile'|'company_posts'|'person_profile';
export async function enqueueLinkedIn(userId:string,operation:LinkedInOperation,payload:Record<string,string>={}){
 const rows=await sb<Array<{id:string}>>('/rest/v1/cmg_linkedin_jobs',{method:'POST',body:JSON.stringify({user_id:userId,operation,payload}),prefer:'return=representation'});
 return rows[0];
}
/** Results hold other people's names, headlines and image links: they are kept only until delivered to the
 * assistant, and never more than 15 minutes (conversation threads included). */
export const RESULT_TTL_MS=15*60_000;
export async function purgeLinkedInResult(userId:string,id:string){
 if(!/^[0-9a-f-]{36}$/i.test(id))return;
 await sb('/rest/v1/cmg_linkedin_jobs?id=eq.'+id+'&user_id=eq.'+userId+'&status=in.(done,error)',{method:'PATCH',body:JSON.stringify({result:null})}).catch(()=>{});
}
export async function sweepLinkedInResults(userId:string){
 await sb('/rest/v1/cmg_linkedin_jobs?user_id=eq.'+userId+'&result=not.is.null&completed_at=lt.'+encodeURIComponent(new Date(Date.now()-RESULT_TTL_MS).toISOString()),{method:'PATCH',body:JSON.stringify({result:null})}).catch(()=>{});
}
export const THUMB_TTL_MS=24*60*60_000;
const THUMB_PREFIX='data:image/jpeg;base64,';
/**
 * Chat apps (ChatGPT, Claude) display https images only. Each thumbnail the phone made (imageDataUrl) is
 * stored for 24 hours under an unguessable id and replaced by a link to /api/linkedin/thumb/<id>.jpg;
 * LinkedIn's own link stays as linkedinImageUrl. Older thumbnails are deleted at every call.
 */
export async function hostThumbnails(userId:string,data:unknown,base=process.env.APP_BASE_URL||'https://seo.cammicgo.com'){
 await sb('/rest/v1/cmg_linkedin_thumbs?created_at=lt.'+encodeURIComponent(new Date(Date.now()-THUMB_TTL_MS).toISOString()),{method:'DELETE'}).catch(()=>{});
 if(!data||typeof data!=='object')return data;
 const root=data as Record<string,unknown>;
 const cards:Array<Record<string,unknown>>=[];
 for(const key of ['profiles','people','companies','jobs','posts'])if(Array.isArray(root[key]))for(const c of root[key] as unknown[])if(c&&typeof c==='object')cards.push(c as Record<string,unknown>);
 cards.push(root);
 const withThumb=cards.filter(c=>typeof c.imageDataUrl==='string'&&(c.imageDataUrl as string).startsWith(THUMB_PREFIX)&&(c.imageDataUrl as string).length<=16000+THUMB_PREFIX.length).slice(0,40);
 if(!withThumb.length)return data;
 try{
  const rows=await sb<Array<{id:string}>>('/rest/v1/cmg_linkedin_thumbs',{method:'POST',body:JSON.stringify(withThumb.map(c=>({user_id:userId,jpeg_b64:(c.imageDataUrl as string).slice(THUMB_PREFIX.length)}))),prefer:'return=representation'});
  withThumb.forEach((c,i)=>{if(!rows[i])return;if(typeof c.imageUrl==='string')c.linkedinImageUrl=c.imageUrl;c.imageUrl=base+'/api/linkedin/thumb/'+rows[i].id+'.jpg';delete c.imageDataUrl;});
 }catch{/* keep the data: URLs if storage is unavailable */}
 for(const c of cards)delete c.imageDataUrl;
 return data;
}
/** Jobs the phone never picked up before their deadline become explicit errors (never run later). */
export async function expireLinkedIn(userId:string){
 await sweepLinkedInResults(userId);
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


