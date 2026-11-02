/** Unified multi-channel CSV transcript corpus. One row per YouTube video.
 * RFC 4180 quoting, stable video-ID upserts and atomic file replacement.
 * Does not claim that NotebookLM automatically refreshes CSV sources.
 */
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {videoIdFrom} from './notebooklm-local.mjs';

export const COLUMNS=['source','channel_name','channel_id','author','video_title','video_id','published_at','original_language','duration_seconds','video_url','transcript','transcript_sha256'];
const clean=v=>String(v??'').trim();
const clock=s=>{const n=Math.max(0,Math.floor(Number(s)||0));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(x=>String(x).padStart(2,'0')).join(':')};
const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
const hash=s=>createHash('sha256').update(s).digest('hex');
export function toCsv(rows){return '\uFEFF'+[COLUMNS,...rows.map(r=>COLUMNS.map(c=>r[c]??''))].map(cells=>cells.map(quote).join(',')).join('\r\n')+'\r\n'}
export function parseCsv(input){
 const s=String(input).replace(/^\uFEFF/,'');const records=[];let row=[],cell='',quoted=false;
 for(let i=0;i<s.length;i++){const ch=s[i];
  if(quoted){if(ch==='"'&&s[i+1]==='"'){cell+='"';i++}else if(ch==='"')quoted=false;else cell+=ch;}
  else if(ch==='"'){if(cell)throw Error('Invalid CSV quote');quoted=true}
  else if(ch===','){row.push(cell);cell=''}
  else if(ch==='\n'){row.push(cell.replace(/\r$/,''));records.push(row);row=[];cell=''}
  else cell+=ch;
 }
 if(quoted)throw Error('Unclosed CSV quote');
 if(cell||row.length){row.push(cell);records.push(row)}
 const header=records.shift()||[];
 if(COLUMNS.some((c,i)=>header[i]!==c))throw Error('CSV schema mismatch');
 return records.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(COLUMNS.map((c,i)=>[c,r[i]??''])));
}
export function rowFromVideo(video,{source='YouTube transcripts',channelName,channelId,author}={}){
 const id=videoIdFrom(video.videoId||video.videoUrl||video.url);
 if(!id)throw Error('Invalid YouTube video ID');
 const duration=Number(video.durationSeconds??0);
 if(duration>18000||video.segments?.some(s=>Number(s.start??s.startSeconds??0)>18000))throw Error('Video exceeds five-hour limit');
 if(!Array.isArray(video.segments)||!video.segments.length)throw Error('Missing transcript');
 const transcript=video.segments.map(s=>'['+clock(s.start??s.startSeconds??0)+'] '+clean(s.text)).join('\n');
 return {source:clean(source),channel_name:clean(video.channelName||channelName),channel_id:clean(video.channelId||channelId),author:clean(video.author||author||video.channelName||channelName),video_title:clean(video.title),video_id:id,published_at:clean(video.publishedAt),original_language:clean(video.originalLanguage||video.language),duration_seconds:duration||'',video_url:'https://www.youtube.com/watch?v='+id,transcript,transcript_sha256:hash(transcript)};
}
export async function upsertTranscriptCsv({path,videos,source='YouTube transcripts',channelName,channelId,author}){
 if(!path||!Array.isArray(videos))throw Error('Path and videos required');
 let previous=[];try{previous=parseCsv(await readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const byId=new Map(previous.map(r=>[r.video_id,r]));
 let added=0,updated=0,unchanged=0;const rejected=[];
 for(const v of videos){try{const row=rowFromVideo(v,{source,channelName,channelId,author});const old=byId.get(row.video_id);
  if(old&&COLUMNS.every(c=>String(old[c]??'')===String(row[c]??''))){unchanged++;continue}
  byId.set(row.video_id,row);old?updated++:added++;
 }catch(e){rejected.push({videoId:v.videoId,error:String(e.message||e)})}}
 const rows=[...byId.values()].sort((a,b)=>a.published_at.localeCompare(b.published_at)||a.video_id.localeCompare(b.video_id));
 const csv=toCsv(rows);await mkdir(dirname(path),{recursive:true});
 await writeFile(path+'.tmp',csv,'utf8');await rename(path+'.tmp',path);
 return {path,added,updated,unchanged,rejected,totalVideos:rows.length,sha256:hash(csv),driveSynced:false,notebookSynced:false};
}
