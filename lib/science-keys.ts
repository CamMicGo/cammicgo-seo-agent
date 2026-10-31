/**
 * Optional per-user API keys for scientific sources. Stored encrypted (AES-256-GCM, server key),
 * never returned to the browser in clear (only a hint) and never shown to the AI assistant.
 */
import {sb} from '@/lib/device-relay';
import {decrypt,encrypt} from '@/lib/google-session';
import {CONTACT_EMAIL,KEY_PROVIDERS,type KeyProvider,type Keys} from '@/lib/science';

type Row={provider:KeyProvider;key_enc:string;verified_at:string|null;updated_at:string};
export type KeySummary={provider:KeyProvider;hint:string;verifiedAt:string|null;updatedAt:string};

export const isProvider=(v:unknown):v is KeyProvider=>typeof v==='string'&&(KEY_PROVIDERS as string[]).includes(v);
export function validateKey(v:unknown){const k=typeof v==='string'?v.trim():'';return /^[A-Za-z0-9_.\-]{8,128}$/.test(k)?k:null;}

/** Asks the provider whether the key works: 'invalid' only when the provider clearly refuses it. */
export async function verifyKey(provider:KeyProvider,key:string):Promise<'ok'|'invalid'|'unknown'>{
 try{
  const signal=AbortSignal.timeout(8000);
  if(provider==='semanticscholar'){
   const r=await fetch('https://api.semanticscholar.org/graph/v1/paper/search?query=science&limit=1&fields=title',{headers:{'x-api-key':key},cache:'no-store',signal});
   return r.ok?'ok':r.status===401||r.status===403?'invalid':'unknown';
  }
  if(provider==='openalex'){
   const r=await fetch('https://api.openalex.org/works?per-page=1&select=id&mailto='+CONTACT_EMAIL+'&api_key='+encodeURIComponent(key),{cache:'no-store',signal});
   return r.ok?'ok':r.status===401||r.status===403?'invalid':'unknown';
  }
  const r=await fetch('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=science&retmax=1&retmode=json&tool=cammicgo&email='+CONTACT_EMAIL+'&api_key='+encodeURIComponent(key),{cache:'no-store',signal});
  const text=await r.text();
  if(/api key invalid|invalid api key/i.test(text))return 'invalid';
  return r.ok?'ok':'unknown';
 }catch{return 'unknown'}
}

export async function saveKey(userId:string,provider:KeyProvider,key:string,verified:boolean){
 const now=new Date().toISOString();
 await sb('/rest/v1/cmg_science_keys?on_conflict=user_id,provider',{method:'POST',prefer:'resolution=merge-duplicates',
  body:JSON.stringify({user_id:userId,provider,key_enc:encrypt({key}),verified_at:verified?now:null,updated_at:now})});
}

async function rows(userId:string){return sb<Row[]>('/rest/v1/cmg_science_keys?user_id=eq.'+userId+'&select=provider,key_enc,verified_at,updated_at');}

export async function keySummaries(userId:string):Promise<KeySummary[]>{
 return (await rows(userId)).map(r=>{const k=decrypt<{key:string}>(r.key_enc)?.key??'';return {provider:r.provider,hint:k?'••••'+k.slice(-4):'',verifiedAt:r.verified_at,updatedAt:r.updated_at};});
}

/** Decrypted keys for server-side calls of this user only. */
export async function userKeys(userId:string):Promise<Keys>{
 const out:Keys={};
 for(const r of await rows(userId)){const k=decrypt<{key:string}>(r.key_enc)?.key;if(k&&isProvider(r.provider))out[r.provider]=k;}
 return out;
}

export async function deleteKey(userId:string,provider:KeyProvider){
 await sb('/rest/v1/cmg_science_keys?user_id=eq.'+userId+'&provider=eq.'+provider,{method:'DELETE'});
}
