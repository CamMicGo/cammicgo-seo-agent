import {randomUUID} from 'node:crypto';
import {sb} from '@/lib/device-relay';
import {addReport,cleanAnalysis,decorateReactions,preferHostedPhotos,reportPayload} from '@/lib/linkedin-reactions';
export type LinkedInOperation='inbox'|'open'|'thread'|'back'|'feed'|'search'|'send'|'company_search'|'network_suggestions'|'invite'|'attach'|'job_search'|'job_details'|'recommended_jobs'|'company_profile'|'company_posts'|'person_profile'|'post_comments'|'comment_post'|'reply_comment';
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
const REPORT_BUCKET='cmg-notebook-artifacts';
/**
 * Stores the visual report for 24 hours in the private bucket (service role only) and adds its private
 * link: chat apps like ChatGPT do not show external images inline. Older reports of the user are deleted.
 */
async function saveReport(userId:string,root:Record<string,unknown>,base:string){
 const report=reportPayload(root,base);
 if(!report||!/^[0-9a-f-]{36}$/i.test(userId))return;
 try{
  const old=await sb<Array<{name:string;created_at?:string}>>('/storage/v1/object/list/'+REPORT_BUCKET,{method:'POST',body:JSON.stringify({prefix:userId+'/reports',limit:200})}).catch(()=>[]);
  const stale=(old||[]).filter(o=>o.created_at&&Date.now()-Date.parse(o.created_at)>THUMB_TTL_MS).map(o=>userId+'/reports/'+o.name);
  if(stale.length)await sb('/storage/v1/object/'+REPORT_BUCKET,{method:'DELETE',body:JSON.stringify({prefixes:stale})}).catch(()=>{});
  const id=randomUUID();
  await sb('/storage/v1/object/'+REPORT_BUCKET+'/'+userId+'/reports/'+id+'.json',{method:'POST',body:JSON.stringify(report)});
  root.reportUrl=base+'/api/linkedin/report/'+userId+'.'+id;
 }catch{/* the Markdown report stays available */}
}
/** Deletes a report and the hosted photos it references (they belong to this user only). */
export async function deleteReport(userId:string,id:string){
 const r=await loadReport(userId,id);
 if(!r)return false;
 const ids=[...new Set([...JSON.stringify(r).matchAll(/\/api\/linkedin\/thumb\/([0-9a-f-]{36})\.jpg/gi)].map(x=>x[1]))];
 for(let i=0;i<ids.length;i+=80)await sb('/rest/v1/cmg_linkedin_thumbs?user_id=eq.'+userId+'&id=in.('+ids.slice(i,i+80).join(',')+')',{method:'DELETE'}).catch(()=>{});
 await sb('/storage/v1/object/'+REPORT_BUCKET,{method:'DELETE',body:JSON.stringify({prefixes:[userId+'/reports/'+id+'.json']})});
 return true;
}
/**
 * Daily purge, whatever users do: LinkedIn results older than 15 minutes, thumbnails and reports older than
 * 24 hours, for every user. Nothing LinkedIn-related is kept longer.
 */
export async function purgeExpiredLinkedIn(){
 const out={results:0,thumbs:0,reports:0};
 await sb('/rest/v1/cmg_linkedin_jobs?result=not.is.null&completed_at=lt.'+encodeURIComponent(new Date(Date.now()-RESULT_TTL_MS).toISOString()),{method:'PATCH',body:JSON.stringify({result:null})}).then(()=>{out.results=1;}).catch(()=>{});
 await sb('/rest/v1/cmg_linkedin_thumbs?created_at=lt.'+encodeURIComponent(new Date(Date.now()-THUMB_TTL_MS).toISOString()),{method:'DELETE'}).then(()=>{out.thumbs=1;}).catch(()=>{});
 const users=await sb<Array<{name:string;id:string|null}>>('/storage/v1/object/list/'+REPORT_BUCKET,{method:'POST',body:JSON.stringify({prefix:'',limit:1000})}).catch(()=>[]);
 for(const u of users||[]){
  if(!/^[0-9a-f-]{36}$/i.test(u.name))continue;
  const files=await sb<Array<{name:string;created_at?:string}>>('/storage/v1/object/list/'+REPORT_BUCKET,{method:'POST',body:JSON.stringify({prefix:u.name+'/reports',limit:1000})}).catch(()=>[]);
  const stale=(files||[]).filter(f=>/\.json$/.test(f.name)&&(!f.created_at||Date.now()-Date.parse(f.created_at)>THUMB_TTL_MS)).map(f=>u.name+'/reports/'+f.name);
  for(let i=0;i<stale.length;i+=100){await sb('/storage/v1/object/'+REPORT_BUCKET,{method:'DELETE',body:JSON.stringify({prefixes:stale.slice(i,i+100)})}).catch(()=>{});out.reports+=Math.min(100,stale.length-i);}
 }
 return out;
}
/** Adds (or replaces) the assistant's analysis in one of this user's reports; the 24-hour limit is unchanged. */
export async function saveReportAnalysis(userId:string,reportUrl:string,analysis:Record<string,unknown>,agent:string){
 const m=String(reportUrl||'').match(/\/api\/linkedin\/report\/([0-9a-f-]{36})\.([0-9a-f-]{36})/i);
 if(!m||m[1].toLowerCase()!==userId.toLowerCase())return {error:'unknown_report' as const};
 const r=await loadReport(m[1],m[2]);
 if(!r)return {error:'expired_report' as const};
 r.analysis=cleanAnalysis(analysis,agent);
 await sb('/storage/v1/object/'+REPORT_BUCKET+'/'+m[1]+'/reports/'+m[2]+'.json',{method:'PUT',body:JSON.stringify(r)});
 return {ok:true as const,reportUrl:reportUrl.split('?')[0]};
}
/**
 * Photos as MCP image blocks (64 px JPEG, a few KB each), for chat apps that show images a tool returns but
 * not external links (ChatGPT). Report order: post author, comment authors, then reacting people. At most 30.
 */
export async function inlineImages(data:unknown,max=30):Promise<Array<{type:'image';data:string;mimeType:'image/jpeg'}>>{
 if(!data||typeof data!=='object')return [];
 const root=data as Record<string,unknown>;
 if(!root.reactions&&!root.comments&&!root.people)return [];
 const ids=[...new Set([...JSON.stringify({p:root.post,c:root.comments,r:root.reactions??root.people}).matchAll(/\/api\/linkedin\/thumb\/([0-9a-f-]{36})\.jpg/gi)].map(x=>x[1]))].slice(0,max);
 if(!ids.length)return [];
 const rows=await sb<Array<{id:string;jpeg_b64:string}>>('/rest/v1/cmg_linkedin_thumbs?id=in.('+ids.join(',')+')&select=id,jpeg_b64').catch(()=>[]);
 const byId=new Map(rows.map(r=>[r.id,r.jpeg_b64]));
 return ids.map(id=>byId.get(id)).filter((b):b is string=>!!b).map(b=>({type:'image' as const,data:b,mimeType:'image/jpeg' as const}));
}
/** A stored report, or null when missing or older than 24 hours. */
export async function loadReport(userId:string,id:string):Promise<Record<string,unknown>|null>{
 if(!/^[0-9a-f-]{36}$/i.test(userId)||!/^[0-9a-f-]{36}$/i.test(id))return null;
 const r=await sb<Record<string,unknown>>('/storage/v1/object/'+REPORT_BUCKET+'/'+userId+'/reports/'+id+'.json').catch(()=>null);
 if(!r||typeof r.createdAt!=='string'||Date.now()-Date.parse(r.createdAt)>THUMB_TTL_MS)return null;
 return r;
}
export async function hostThumbnails(userId:string,data:unknown,base=process.env.APP_BASE_URL||'https://seo.cammicgo.com'){
 await sb('/rest/v1/cmg_linkedin_thumbs?created_at=lt.'+encodeURIComponent(new Date(Date.now()-THUMB_TTL_MS).toISOString()),{method:'DELETE'}).catch(()=>{});
 if(!data||typeof data!=='object')return data;
 const root=data as Record<string,unknown>;
 decorateReactions(root,base);
 const cards:Array<Record<string,unknown>>=[];
 // Cards anywhere in the result (search lists, comments, reaction people, full extraction), a few levels deep.
 const walk=(node:unknown,depth:number)=>{if(depth>5||!node||typeof node!=='object')return;if(Array.isArray(node)){for(const c of node)walk(c,depth+1);return;}const o=node as Record<string,unknown>;cards.push(o);for(const key of ['profiles','people','companies','jobs','posts','comments','reactions','post','candidates'])walk(o[key],depth+1);};
 walk(root,0);
 const withThumb=cards.filter(c=>typeof c.imageDataUrl==='string'&&(c.imageDataUrl as string).startsWith(THUMB_PREFIX)&&(c.imageDataUrl as string).length<=16000+THUMB_PREFIX.length).slice(0,150);
 if(!withThumb.length){for(const c of cards)delete c.imageDataUrl;preferHostedPhotos(root,base);addReport(root,base);await saveReport(userId,root,base);return data;}
 try{
  const rows=await sb<Array<{id:string}>>('/rest/v1/cmg_linkedin_thumbs',{method:'POST',body:JSON.stringify(withThumb.map(c=>({user_id:userId,jpeg_b64:(c.imageDataUrl as string).slice(THUMB_PREFIX.length)}))),prefer:'return=representation'});
  withThumb.forEach((c,i)=>{if(!rows[i])return;if(typeof c.imageUrl==='string')c.linkedinImageUrl=c.imageUrl;c.imageUrl=base+'/api/linkedin/thumb/'+rows[i].id+'.jpg';delete c.imageDataUrl;});
 }catch{/* keep the data: URLs if storage is unavailable */}
 for(const c of cards)delete c.imageDataUrl;
 preferHostedPhotos(root,base);
 addReport(root,base);
 await saveReport(userId,root,base);
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


