/** Local-only, dependency-free Markdown export for NotebookLM.
 * No Google cookies, no remote NotebookLM calls, and no extra desktop installation.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {fetchYouTubeCaptions} from './youtube-captions.mjs';
const ID=/^[A-Za-z0-9_-]{11}$/;
export function videoIdFrom(input){
 if(ID.test(input))return input;
 try{const u=new URL(input);if(['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname)){
   const id=u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})/)?.[1];return id&&ID.test(id)?id:null;
 }if(u.hostname==='youtu.be'){const id=u.pathname.slice(1);return ID.test(id)?id:null;}}catch{}
 return null;
}
const clean=s=>String(s??'').replace(/[\r\n]+/g,' ').trim();
const clock=seconds=>{const n=Math.max(0,Math.floor(Number(seconds)||0));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(x=>String(x).padStart(2,'0')).join(':')};
export function formatTranscript(video){
 const id=videoIdFrom(video.videoId);if(!id)throw Error('Invalid video ID');
 const segments=video.segments??[];
 if(Number(video.durationSeconds)>18000)throw Error('Video exceeds 5-hour limit: '+id);
 if(segments.some(s=>Number(s.start??s.startSeconds??0)>18000))throw Error('Transcript exceeds 5-hour limit: '+id);
 if(!segments.length)throw Error('Missing transcript for '+id);
 const title=clean(video.title||id);
 return ['## '+title,'- YouTube: https://www.youtube.com/watch?v='+id,'- Video ID: '+id,
   '- Channel: '+clean(video.channelName||'Unknown (metadata unavailable)'),
   '- Author: '+clean(video.author||video.channelName||'Unknown (metadata unavailable)'),
   '- Language: '+clean(video.language||'original'),
   ...(video.publishedAt?['- Published: '+clean(video.publishedAt)]:[]),
   '### Timestamped transcript',
   ...segments.map(s=>`[${clock(s.start??s.startSeconds??0)}] ${clean(s.text)}`)].join('\n');
}
export function makeMarkdown(videos,{title='YouTube transcripts',maxWords=300000}={}){
 if(!Number.isSafeInteger(maxWords)||maxWords<100)throw Error('Invalid maxWords');
 const seen=new Set(),chunks=[];let part=[],count=0,ids=[];
 const flush=()=>{if(!part.length)return;const md='# '+clean(title)+'\n\nTotal videos: '+ids.length+'\n\n'+part.join('\n\n---\n\n')+'\n';chunks.push({markdown:md,videoIds:ids,sha256:createHash('sha256').update(md).digest('hex'),wordCount:count});part=[];ids=[];count=0};
 for(const v of videos){
  const id=videoIdFrom(v.videoId);if(!id)throw Error('Invalid video ID');
  if(seen.has(id))continue;seen.add(id);
  const section=formatTranscript(v),words=section.trim().split(/\s+/).length;
  if(words>maxWords)throw Error('Video too large for one source: '+id);
  if(count+words>maxWords)flush();
  part.push(section);ids.push(id);count+=words;
 }
 flush();return chunks;
}
export async function exportNotebookMarkdown({videos,title='YouTube transcripts',maxWords=300000}){
 const batches=makeMarkdown(videos,{title,maxWords});
 const root=join(homedir(),'.cammicgo-seo-agent','notebooklm-exports');
 await mkdir(root,{recursive:true,mode:0o700});
 const files=[];
 for(const b of batches){
  const path=join(root,'transcripts-'+b.sha256.slice(0,16)+'.md');
  await writeFile(path,b.markdown,{mode:0o600,flag:'w'});
  files.push({path,videoIds:b.videoIds,sha256:b.sha256,wordCount:b.wordCount});
 }
 return {files,folder:root,notebookCreated:false,importInstructions:'Open Gemini Notebook in a browser, create a notebook, add each Markdown file as a source. The personal-account automation is not connected.'};
}
export async function exportYouTubeVideos({urls,title='YouTube transcripts',language='original',maxWords=300000}){
 const ids=[...new Set(urls.map(videoIdFrom))];if(ids.some(id=>!id))throw Error('Invalid YouTube URL or ID');
 const videos=[],errors=[];
 for(const id of ids){
  try{const result=await fetchYouTubeCaptions(id,language);if(!result?.segments?.length)throw Error('No transcript segments');
   videos.push({...result,videoId:id});
  }catch(e){errors.push({videoId:id,error:String(e?.message??e).slice(0,240)})}
 }
 const out=videos.length?await exportNotebookMarkdown({videos,title,maxWords}):{files:[],folder:null,notebookCreated:false};
 return {...out,requested:ids.length,completed:videos.length,errors};
}
