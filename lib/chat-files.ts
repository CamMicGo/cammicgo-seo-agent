/**
 * Files an assistant passes to a CamMicGo tool.
 *
 * ChatGPT (Apps SDK): a tool lists its file fields in `_meta["openai/fileParams"]`. When the model puts a file
 * of the conversation (an attachment or an image it generated) in such a field, ChatGPT replaces it with
 * {download_url, file_id, mime_type?, file_name?} before calling the server; the server downloads the bytes from
 * OpenAI's file hosts. A field that is NOT declared receives the model's raw text, e.g. "/mnt/data/banner.png",
 * a path inside ChatGPT's sandbox that no server can read. Some ChatGPT mobile versions have been reported to
 * send only a reference such as "chat_upload://image_0", without download_url: nothing can be fetched then.
 *
 * Pure helpers (validation, file type detection, names) plus one bounded download function.
 */
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';

export const FILE_PARAM_META='openai/fileParams';

/** Hosts seen serving ChatGPT file downloads (no single host is guaranteed); CHAT_FILE_HOSTS adds more. */
const HOST_SUFFIXES=['.oaiusercontent.com','.openai.com','.chatgpt.com'];
const EXACT_HOSTS=['chatgpt.com','oaiusercontent.com'];
const AZURE_BLOB=/^oaisdmntpr[a-z0-9]{1,40}\.blob\.core\.windows\.net$/;
function extraHosts(){return (process.env.CHAT_FILE_HOSTS??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);}
export function chatFileHostAllowed(host:string){
 const h=host.toLowerCase().replace(/\.$/,'');
 if(EXACT_HOSTS.includes(h)||HOST_SUFFIXES.some(s=>h.endsWith(s))||AZURE_BLOB.test(h))return true;
 return extraHosts().some(x=>x.startsWith('.')?h.endsWith(x):h===x);
}
/** https only, default port, no credentials, an allowed host. */
export function chatFileUrl(raw:string):URL|null{
 let u:URL;try{u=new URL(raw);}catch{return null;}
 if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))return null;
 return chatFileHostAllowed(u.hostname)?u:null;
}

export type ChatFile={download_url:string;file_id:string;mime_type?:string|null;file_name?:string|null;name?:string|null;size?:number|null};
export type ChatFileProblem={error:string;messageForUser:string;received?:string};

/** What the tool received in a file field, before any network access. */
export function readChatFile(value:unknown):{ok:true;file:ChatFile}|{ok:false;problem:ChatFileProblem}{
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  const v=value as Record<string,unknown>;
  if(typeof v.download_url==='string'&&v.download_url){
   return {ok:true,file:{download_url:v.download_url,file_id:typeof v.file_id==='string'?v.file_id:'',
    mime_type:typeof v.mime_type==='string'?v.mime_type:null,file_name:typeof v.file_name==='string'?v.file_name:null,
    name:typeof v.name==='string'?v.name:null,size:typeof v.size==='number'?v.size:null}};
  }
  return {ok:false,problem:{error:'file_without_content',received:'object without download_url',
   messageForUser:'ChatGPT passed a file reference without its content (no download_url). This happens in some ChatGPT mobile versions: send the request from chatgpt.com in a browser or from the ChatGPT desktop app, with the file attached to the conversation.'}};
 }
 if(typeof value==='string'){
  const s=value.trim();
  if(/^chat_upload/i.test(s)||/^file[-_][A-Za-z0-9]{6,}$/.test(s))return {ok:false,problem:{error:'file_without_content',received:s.slice(0,80),
   messageForUser:'ChatGPT passed only a reference to the file ('+s.slice(0,40)+'), not the file itself. This happens in some ChatGPT mobile versions: send the request from chatgpt.com in a browser or from the ChatGPT desktop app, with the file attached to the conversation.'}};
  if(/^(\/|[A-Za-z]:\\|sandbox:|file:)/.test(s)||!/^https:\/\//i.test(s))return {ok:false,problem:{error:'local_path_not_transferable',received:s.slice(0,120),
   messageForUser:'"'+s.slice(0,80)+'" is a path inside the assistant\'s own workspace: CamMicGo cannot read it. In ChatGPT, refresh the CamMicGo connector (Settings > Apps and connectors) so the tool receives the file itself, then try again. Other assistants: use a small file as base64, or a Google Drive file.'}};
  return {ok:true,file:{download_url:s,file_id:''}};
 }
 return {ok:false,problem:{error:'missing_file',messageForUser:'No file was given.'}};
}

/** File type from the first bytes (the declared type is never trusted alone). */
export type Sniffed={mime:string;ext:string};
export function sniffType(b:Uint8Array):Sniffed|null{
 const ascii=(from:number,to:number)=>String.fromCharCode(...b.subarray(from,to));
 if(b.length>=8&&b[0]===0x89&&ascii(1,4)==='PNG'&&b[4]===0x0d&&b[5]===0x0a&&b[6]===0x1a&&b[7]===0x0a)return {mime:'image/png',ext:'png'};
 if(b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return {mime:'image/jpeg',ext:'jpg'};
 if(b.length>=6&&(ascii(0,6)==='GIF87a'||ascii(0,6)==='GIF89a'))return {mime:'image/gif',ext:'gif'};
 if(b.length>=12&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP')return {mime:'image/webp',ext:'webp'};
 if(b.length>=5&&ascii(0,5)==='%PDF-')return {mime:'application/pdf',ext:'pdf'};
 if(b.length>=8&&b[0]===0xd0&&b[1]===0xcf&&b[2]===0x11&&b[3]===0xe0&&b[4]===0xa1&&b[5]===0xb1&&b[6]===0x1a&&b[7]===0xe1)return {mime:'application/msword',ext:'doc'};
 if(b.length>=4&&b[0]===0x50&&b[1]===0x4b&&b[2]===0x03&&b[3]===0x04){
  // Office Open XML: a zip whose entries name the document kind (scan the first entries only).
  const head=Buffer.from(b.subarray(0,Math.min(b.length,8192))).toString('latin1');
  if(head.includes('word/'))return {mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',ext:'docx'};
  if(head.includes('ppt/'))return {mime:'application/vnd.openxmlformats-officedocument.presentationml.presentation',ext:'pptx'};
  if(head.includes('xl/'))return {mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ext:'xlsx'};
  return {mime:'application/zip',ext:'zip'};
 }
 if(b.length>=12&&ascii(4,8)==='ftyp'){
  const brand=ascii(8,12);
  if(/^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(brand))return {mime:'image/heic',ext:'heic'};
  if(brand==='avif')return {mime:'image/avif',ext:'avif'};
  if(brand==='qt  ')return {mime:'video/quicktime',ext:'mov'};
  return {mime:'video/mp4',ext:'mp4'};
 }
 if(b.length>=4&&b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3)return {mime:'video/webm',ext:'webm'};
 return null;
}
/** Plain UTF-8 text (no NUL bytes, decodes cleanly): accepted only where the caller allows text. */
export function looksLikeText(b:Uint8Array){
 if(!b.length||b.includes(0))return false;
 try{new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(0,Math.min(b.length,65536)));return true;}catch{return false;}
}

const EXT:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','application/pdf':'pdf','text/plain':'txt',
 'application/msword':'doc','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx'};
export const extensionFor=(mime:string)=>EXT[mime]??'';

/** A file name safe to show and store: no path, no control characters, at most 120 characters, the right extension. */
export function cleanFileName(raw:string|null|undefined,ext:string,fallback='file'){
 let n=String(raw??'').split(/[\\/]/).pop()??'';
 n=n.replace(/[\u0000-\u001f\u007f<>:"|?*]/g,' ').replace(/\s+/g,' ').trim().replace(/^\.+/,'');
 const stem=(n.replace(/\.[A-Za-z0-9]{1,5}$/,'')||fallback).slice(0,110).trim()||fallback;
 return ext?stem+'.'+ext:stem;
}

const isPrivate=(ip:string)=>{
 if(isIP(ip)===4){const [a,b]=ip.split('.').map(Number);return a===10||a===127||a===0||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||a>=224;}
 const v=ip.toLowerCase();
 if(v.startsWith('::ffff:'))return isPrivate(v.slice(7));
 return v==='::1'||v==='::'||v.startsWith('fc')||v.startsWith('fd')||v.startsWith('fe8')||v.startsWith('fe9')||v.startsWith('fea')||v.startsWith('feb')||v.startsWith('ff');
};

/**
 * Downloads a ChatGPT file: allowed hosts only (checked again after every redirect, at most 3), public
 * addresses only, size capped while streaming. The download URL is a temporary capability: never log it.
 */
export async function downloadChatFile(file:ChatFile,max:number):Promise<{ok:true;bytes:Buffer;contentType:string|null;host:string}|{ok:false;problem:ChatFileProblem}>{
 const first=chatFileUrl(file.download_url);
 if(!first){
  let host='';try{host=new URL(file.download_url).hostname;}catch{/* not a URL */}
  return {ok:false,problem:{error:'untrusted_file_host',received:host||'not a URL',
   messageForUser:'The file address does not come from ChatGPT\'s file storage'+(host?' ('+host+')':'')+'. Attach the file to the ChatGPT conversation and pass it in the file field.'}};
 }
 let url:URL=first;
 for(let hop=0;hop<4;hop++){
  const addrs=await lookup(url.hostname,{all:true}).catch(()=>[]);
  if(!addrs.length||addrs.some(a=>isPrivate(a.address)))return {ok:false,problem:{error:'untrusted_file_host',received:url.hostname,messageForUser:'The file host could not be verified.'}};
  let r:Response;
  try{r=await fetch(url,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(30000),headers:{'User-Agent':'CamMicGo-SEO-MCP/1.0 (+https://seo.cammicgo.com)'}});}
  catch{return {ok:false,problem:{error:'file_download_failed',messageForUser:'ChatGPT\'s file storage did not answer. Try again.'}};}
  if(r.status>=300&&r.status<400){
   const next=r.headers.get('location');const target:URL|null=next?chatFileUrl(new URL(next,url).toString()):null;
   if(!target){let host='';try{host=new URL(next??'',url).hostname;}catch{/* ignore */}return {ok:false,problem:{error:'untrusted_file_host',received:host,messageForUser:'The file download was redirected outside ChatGPT\'s file storage'+(host?' ('+host+')':'')+'.'}};}
   url=target;continue;
  }
  if(!r.ok)return {ok:false,problem:{error:'file_download_failed',received:'HTTP '+r.status,
   messageForUser:r.status===403||r.status===404||r.status===410?'The file link from ChatGPT expired or is no longer valid: pass the file again.':'ChatGPT\'s file storage answered HTTP '+r.status+'.'}};
  const declared=Number(r.headers.get('content-length')||0);
  const tooLarge={ok:false as const,problem:{error:'file_too_large',messageForUser:'This file is larger than '+Math.round(max/1048576*10)/10+' MB.'}};
  if(declared>max)return tooLarge;
  const reader=r.body?.getReader();const chunks:Uint8Array[]=[];let total=0;
  if(reader)for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel().catch(()=>{});return tooLarge;}chunks.push(value);}
  if(!total)return {ok:false,problem:{error:'empty_file',messageForUser:'The file is empty.'}};
  const type=(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  return {ok:true,bytes:Buffer.concat(chunks),contentType:/^[\w.+-]+\/[\w.+-]+$/.test(type)?type:null,host:url.hostname};
 }
 return {ok:false,problem:{error:'untrusted_file_host',messageForUser:'Too many redirects while downloading the file.'}};
}
