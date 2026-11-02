/** Incremental, local-first per-channel Markdown archive.
 * Atomic manifest writes, stable filenames, video-ID deduplication and 5h limit.
 * Google Drive / NotebookLM sync is deliberately a separate authenticated step.
 */
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
import {formatTranscript,videoIdFrom} from './notebooklm-local.mjs';

const clean = value => String(value ?? '').replace(/[\r\n]+/g,' ').trim();
const slug = value => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64)||'channel';
const sha = value => createHash('sha256').update(value).digest('hex');
const words = value => value.trim().split(/\s+/).filter(Boolean).length;
const defaultRoot = () => join(homedir(),'.cammicgo-seo-agent','notebooklm-channels');
function validate(channel) {
 if(!channel || typeof channel.id!=='string' || !/^[A-Za-z0-9_-]{2,128}$/.test(channel.id)) throw Error('Invalid channel ID');
 if(!clean(channel.name)) throw Error('Channel name is required');
}
function render(channel,items){
 const sorted=[...items].sort((a,b)=>String(a.publishedAt||'').localeCompare(String(b.publishedAt||''))||a.videoId.localeCompare(b.videoId));
 const header=['# '+clean(channel.name),'','- YouTube channel: '+clean(channel.name),'- Channel ID: '+channel.id,'- Total videos: '+sorted.length,'','---',''];
 return header.concat(sorted.map((v,i)=>formatTranscript(v).replace(/^## /,'## Video '+(i+1)+' — ')).join('\n\n---\n\n')).join('\n')+'\n';
}
export async function updateChannelArchive({channel,videos=[],root=defaultRoot(),maxWords=300000}){
 validate(channel);
 if(!Number.isSafeInteger(maxWords)||maxWords<100)throw Error('Invalid maxWords');
 const dir=join(root,slug(channel.name)+'-'+sha(channel.id).slice(0,10));
 await mkdir(dir,{recursive:true,mode:0o700});
 const manifestPath=join(dir,'manifest.json');
 let manifest={channel,items:[]};
 try {manifest=JSON.parse(await readFile(manifestPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(manifest.channel?.id!==channel.id)throw Error('Channel ID mismatch in manifest');
 const byId=new Map((manifest.items||[]).map(v=>[v.videoId,v]));
 let added=0,updated=0,unchanged=0,rejected=[];
 for(const video of videos){
  try {
   const videoId=videoIdFrom(video.videoId);
   if(!videoId)throw Error('Invalid video ID');
   if(Number(video.durationSeconds)>18000 || (video.segments||[]).some(s=>Number(s.start??s.startSeconds??0)>18000))throw Error('Video exceeds five-hour limit');
   if(!Array.isArray(video.segments)||!video.segments.length)throw Error('Missing transcript');
   const next={...video,videoId,channelName:channel.name,author:video.author||channel.name};
   formatTranscript(next);
   const prev=byId.get(videoId);
   if(prev && sha(JSON.stringify(prev))===sha(JSON.stringify(next))){unchanged++;continue;}
   byId.set(videoId,next);prev?updated++:added++;
  }catch(e){rejected.push({videoId:video.videoId,error:String(e.message||e)})}
 }
 const ordered=[...byId.values()].sort((a,b)=>String(a.publishedAt||'').localeCompare(String(b.publishedAt||''))||a.videoId.localeCompare(b.videoId));
 const parts=[];let current=[];
 for(const v of ordered){
  const candidate=[...current,v];
  if(words(render(channel,candidate))>maxWords){
   if(!current.length){rejected.push({videoId:v.videoId,error:'Video exceeds source word limit'});continue;}
   parts.push(current);current=[v];
   if(words(render(channel,current))>maxWords){rejected.push({videoId:v.videoId,error:'Video exceeds source word limit'});current=[];}
  }else current=candidate;
 }
 if(current.length)parts.push(current);
 const files=[];
 for(let i=0;i<parts.length;i++){
  const name=slug(channel.name)+(parts.length>1?'-part-'+String(i+1).padStart(2,'0'):'')+'.md';
  const markdown=render(channel,parts[i]);
  const path=join(dir,name);
  await writeFile(path+'.tmp',markdown,{mode:0o600});
  await rename(path+'.tmp',path);
  files.push({path,name,sha256:sha(markdown),videoCount:parts[i].length,wordCount:words(markdown)});
 }
 const nextManifest={channel,items:ordered,files,updatedAt:new Date().toISOString()};
 await writeFile(manifestPath+'.tmp',JSON.stringify(nextManifest,null,2),{mode:0o600});
 await rename(manifestPath+'.tmp',manifestPath);
 return {channel,added,updated,unchanged,rejected,totalVideos:ordered.length,files,manifestPath,driveSynced:false,notebookCreated:false};
}
