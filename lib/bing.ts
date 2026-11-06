/** Bing Webmaster Tools: encrypted per-user key storage. Pure helpers live in bing-core.ts. */
import {sb} from '@/lib/device-relay';
import {decrypt,encrypt} from '@/lib/google-session';
import {bingCall} from '@/lib/bing-core';
export * from '@/lib/bing-core';

type Row={key_enc:string;verified_at:string|null;updated_at:string};
export type BingKeySummary={hint:string;verifiedAt:string|null;updatedAt:string}|null;

export async function verifyBingKey(key:string):Promise<'ok'|'invalid'|'unknown'>{
 const r=await bingCall(key,'GetUserSites');return r.ok?'ok':r.error==='bing_key_rejected'||r.status===400||r.status===401||r.status===403?'invalid':'unknown';
}

export async function saveBingKey(userId:string,key:string,verified:boolean){
 const now=new Date().toISOString();
 await sb('/rest/v1/cmg_bing_keys?on_conflict=user_id',{method:'POST',prefer:'resolution=merge-duplicates',body:JSON.stringify({user_id:userId,key_enc:encrypt({key}),verified_at:verified?now:null,updated_at:now})});
}
async function row(userId:string){return (await sb<Row[]>('/rest/v1/cmg_bing_keys?user_id=eq.'+userId+'&select=key_enc,verified_at,updated_at'))[0]??null;}
export async function bingKeySummary(userId:string):Promise<BingKeySummary>{const r=await row(userId);if(!r)return null;const k=decrypt<{key:string}>(r.key_enc)?.key??'';return {hint:k?'••••'+k.slice(-4):'',verifiedAt:r.verified_at,updatedAt:r.updated_at};}
/** Decrypted key for server-side calls of this user only. */
export async function userBingKey(userId:string):Promise<string|null>{const r=await row(userId);return r?decrypt<{key:string}>(r.key_enc)?.key??null:null;}
export async function deleteBingKey(userId:string){await sb('/rest/v1/cmg_bing_keys?user_id=eq.'+userId,{method:'DELETE'});}

