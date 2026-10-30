/**
 * Device transcript relay: the remote MCP queues a transcript job, a paired device
 * (CamMicGo Android app) claims it, fetches the captions from its residential IP and
 * posts the result back. Tables: supabase/migrations/20261030000100_device_transcript_relay.sql
 */
import {createHash,randomBytes,randomInt} from 'node:crypto';

const url=process.env.SUPABASE_URL||'https://vfngxjsryklqldarkxhy.supabase.co';
const PAIRING_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const DEVICE_ONLINE_MS=90_000;
export const MAX_RESULT_SEGMENTS=4000;

function headers(extra?:Record<string,string>){const key=process.env.SUPABASE_SECRET_KEY;if(!key)throw Error('SUPABASE_SECRET_KEY missing');return {apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...extra};}
async function sb<T=unknown>(path:string,init?:RequestInit&{prefer?:string}):Promise<T>{
 const r=await fetch(url+path,{...init,headers:headers(init?.prefer?{Prefer:init.prefer}:undefined),cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!r.ok){const text=await r.text().catch(()=>'');throw Error('Relay storage error '+r.status+(text.includes('does not exist')?' (apply the device relay migration)':''));}
 if(r.status===204)return undefined as T;
 const text=await r.text();return (text?JSON.parse(text):undefined) as T;
}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const nowIso=()=>new Date().toISOString();

export type Device={id:string;user_id:string;name:string;created_at:string;last_seen_at:string|null};
export type Job={id:string;video_id:string;language:string;status:'pending'|'claimed'|'done'|'error';result:unknown;error:string|null;device_id:string|null;created_at:string;expires_at:string};

/** Validates a YouTube URL, shared text or bare ID; returns the 11-character ID or null. */
export function parseVideoId(input:string){const s=input.trim();const m=s.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);if(m)return m[1];return /^[A-Za-z0-9_-]{11}$/.test(s)?s:null;}
export function normalizeLanguage(input:string|undefined){const l=(input||'en').trim().toLowerCase();return /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(l)?l:'en';}

// ---------- pairing ----------
export async function createPairingCode(userId:string){
 let code='';for(let i=0;i<8;i++)code+=PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)];
 const expiresAt=new Date(Date.now()+10*60_000).toISOString();
 await sb('/rest/v1/cmg_pairing_codes',{method:'POST',body:JSON.stringify({code_hash:hash(code),user_id:userId,expires_at:expiresAt})});
 return {code:code.slice(0,4)+'-'+code.slice(4),expiresAt};
}
export function normalizePairingCode(input:string){const c=input.toUpperCase().replace(/[^A-Z0-9]/g,'');return c.length===8&&[...c].every(ch=>PAIRING_ALPHABET.includes(ch))?c:null;}

/** Consumes a pairing code once and creates a device. Returns the device token (shown once). */
export async function completePairing(rawCode:string,name:string){
 const code=normalizePairingCode(rawCode);if(!code)return null;
 const rows=await sb<Array<{user_id:string}>>('/rest/v1/cmg_pairing_codes?code_hash=eq.'+hash(code)+'&used_at=is.null&expires_at=gt.'+encodeURIComponent(nowIso()),{method:'PATCH',body:JSON.stringify({used_at:nowIso()}),prefer:'return=representation'});
 const userId=rows?.[0]?.user_id;if(!userId)return null;
 const token='cmgd_'+randomBytes(32).toString('base64url');
 const devices=await sb<Device[]>('/rest/v1/cmg_devices',{method:'POST',body:JSON.stringify({user_id:userId,name:name.slice(0,80)||'Android',token_hash:hash(token),last_seen_at:nowIso()}),prefer:'return=representation'});
 return {token,device:devices[0]};
}

export async function deviceFromAuthorization(authorization:string|null){
 if(!authorization?.startsWith('Bearer cmgd_'))return null;
 const token=authorization.slice(7).trim();if(token.length>100||!/^cmgd_[A-Za-z0-9_-]+$/.test(token))return null;
 const rows=await sb<Device[]>('/rest/v1/cmg_devices?token_hash=eq.'+hash(token)+'&revoked_at=is.null&select=id,user_id,name,created_at,last_seen_at');
 return rows[0]??null;
}
export async function touchDevice(id:string){await sb('/rest/v1/cmg_devices?id=eq.'+id,{method:'PATCH',body:JSON.stringify({last_seen_at:nowIso()})});}
export async function listDevices(userId:string){return sb<Device[]>('/rest/v1/cmg_devices?user_id=eq.'+userId+'&revoked_at=is.null&select=id,user_id,name,created_at,last_seen_at&order=created_at.desc');}
export async function revokeDevice(userId:string,deviceId:string){const rows=await sb<Device[]>('/rest/v1/cmg_devices?id=eq.'+encodeURIComponent(deviceId)+'&user_id=eq.'+userId+'&revoked_at=is.null',{method:'PATCH',body:JSON.stringify({revoked_at:nowIso()}),prefer:'return=representation'});return rows.length>0;}
export const isOnline=(d:Device)=>!!d.last_seen_at&&Date.now()-Date.parse(d.last_seen_at)<DEVICE_ONLINE_MS;

// ---------- jobs ----------
/** A transcript already fetched by any device in the last 30 days (public captions). */
export async function cachedTranscript(videoId:string,language:string){
 const since=new Date(Date.now()-30*86_400_000).toISOString();
 const rows=await sb<Array<{result:unknown}>>('/rest/v1/cmg_transcript_jobs?video_id=eq.'+videoId+'&language=eq.'+encodeURIComponent(language)+'&status=eq.done&completed_at=gt.'+encodeURIComponent(since)+'&select=result&order=completed_at.desc&limit=1');
 return rows[0]?.result??null;
}
export async function createJob(userId:string,videoId:string,language:string){
 const rows=await sb<Job[]>('/rest/v1/cmg_transcript_jobs',{method:'POST',body:JSON.stringify({user_id:userId,video_id:videoId,language}),prefer:'return=representation'});
 return rows[0];
}
export async function getJob(userId:string,jobId:string){
 if(!/^[0-9a-f-]{36}$/i.test(jobId))return null;
 const rows=await sb<Job[]>('/rest/v1/cmg_transcript_jobs?id=eq.'+jobId+'&user_id=eq.'+userId+'&select=id,video_id,language,status,result,error,device_id,created_at,expires_at');
 return rows[0]??null;
}
export async function claimJob(device:Device){
 const rows=await sb<Array<{id:string;video_id:string;language:string}>>('/rest/v1/rpc/cmg_claim_transcript_job',{method:'POST',body:JSON.stringify({p_user_id:device.user_id,p_device_id:device.id})});
 return rows?.[0]??null;
}
/** Stores a device answer for a job it claimed. */
export async function completeJob(device:Device,jobId:string,outcome:{result?:unknown;error?:string}){
 if(!/^[0-9a-f-]{36}$/i.test(jobId))return false;
 const patch=outcome.error!==undefined
  ?{status:'error',error:String(outcome.error).slice(0,2000),completed_at:nowIso()}
  :{status:'done',result:outcome.result,completed_at:nowIso()};
 const rows=await sb<Job[]>('/rest/v1/cmg_transcript_jobs?id=eq.'+jobId+'&device_id=eq.'+device.id+'&status=eq.claimed',{method:'PATCH',body:JSON.stringify(patch),prefer:'return=representation'});
 return rows.length>0;
}

/** Keeps only the fields the MCP exposes, with bounded size. Returns null if not a transcript. */
export function sanitizeDeviceResult(input:unknown,videoId:string){
 if(!input||typeof input!=='object')return null;
 const r=input as Record<string,unknown>;
 if(!Array.isArray(r.segments))return null;
 const segments=r.segments.slice(0,MAX_RESULT_SEGMENTS).flatMap(s=>{
  if(!s||typeof s!=='object')return [];
  const o=s as Record<string,unknown>;const start=Number(o.start),duration=Number(o.duration??0);const text=typeof o.text==='string'?o.text.slice(0,2000):'';
  return Number.isFinite(start)&&text?[{start:Math.round(start*1000)/1000,duration:Number.isFinite(duration)?Math.round(duration*1000)/1000:0,text}]:[];
 });
 if(!segments.length)return null;
 const str=(v:unknown,max=80)=>typeof v==='string'?v.slice(0,max):undefined;
 return {videoId,method:'android-device',language:str(r.language,12),languageName:str(r.languageName),isAutoGenerated:r.isAutoGenerated===true,
  availableLanguages:Array.isArray(r.availableLanguages)?r.availableLanguages.filter(x=>typeof x==='string').slice(0,60).map(x=>(x as string).slice(0,12)):[],
  segments,truncated:r.segments.length>MAX_RESULT_SEGMENTS};
}
