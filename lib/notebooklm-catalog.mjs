/** Build a NotebookLM-friendly catalog and bounded Markdown transcript sources.
 * Each CSV row is one video; transcripts are NEVER stored in spreadsheet cells.
 * Split only at timestamped segment boundaries and retain part references.
 */
const clean=s=>String(s??'').replace(/[\r\n]+/g,' ').trim();
const slug=s=>clean(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'channel';
const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
const words=s=>s.trim().split(/\s+/).filter(Boolean).length;
const time=n=>{n=Math.max(0,Math.floor(Number(n)||0));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(x=>String(x).padStart(2,'0')).join(':')};
export const CATALOG_COLUMNS=['channel_name','channel_id','video_id','title','url','published_at','duration_seconds','language','transcript_files','transcript_parts','transcript_status'];
export function buildNotebookCatalog(videos,{maxSourceChars=400000,maxSourceWords=80000}={}){
 if(!Number.isSafeInteger(maxSourceChars)||maxSourceChars<500||!Number.isSafeInteger(maxSourceWords)||maxSourceWords<100)throw Error('Invalid source limits');
 const unique=new Map(videos.map(v=>[v.videoId,v]));const sources=[],rows=[];
 for(const v of [...unique.values()].sort((a,b)=>String(a.publishedAt).localeCompare(String(b.publishedAt))||String(a.videoId).localeCompare(String(b.videoId)))){
  if(!/^[A-Za-z0-9_-]{11}$/.test(v.videoId)||!Array.isArray(v.segments)||!v.segments.length)throw Error('Invalid video or missing segments');
  const base=slug(v.channelName)+'-'+v.videoId;const parts=[];let lines=[],start=null;
  const flush=()=>{
   if(!lines.length)return;
   const index=parts.length+1;
   const filename=base+'-part-'+String(index).padStart(3,'0')+'.md';
   const header=['# '+clean(v.title),'','- Channel: '+clean(v.channelName),'- Channel ID: '+clean(v.channelId),'- Video: https://www.youtube.com/watch?v='+v.videoId,'- Part: '+index,'- Starting timecode: '+start,'','## Timestamped transcript',''].join('\n');
   const markdown=header+lines.join('\n')+'\n';
   sources.push({filename,markdown,videoId:v.videoId,part:index,firstTimecode:start,lastTimecode:lines[lines.length-1].match(/^\[([^\]]+)\]/)?.[1]});
   parts.push(filename);lines=[];start=null;
  };
  for(const segment of [...v.segments].sort((a,b)=>Number(a.startSeconds??a.start)-Number(b.startSeconds??b.start))){
   const stamp=time(segment.startSeconds??segment.start);const line='['+stamp+'] '+clean(segment.text);
   const headerBudget=600;
   if(line.length+headerBudget>maxSourceChars||words(line)+70>maxSourceWords)throw Error('Oversize single timestamped segment for '+v.videoId+' at '+stamp);
   if(lines.length&&(lines.join('\n').length+line.length+headerBudget>maxSourceChars||words(lines.join(' '))+words(line)+70>maxSourceWords))flush();
   if(!lines.length)start=stamp;
   lines.push(line);
  }
  flush();
  rows.push({channel_name:clean(v.channelName),channel_id:clean(v.channelId),video_id:v.videoId,title:clean(v.title),url:'https://www.youtube.com/watch?v='+v.videoId,published_at:clean(v.publishedAt),duration_seconds:v.durationSeconds??'',language:clean(v.language),transcript_files:parts.join(' | '),transcript_parts:parts.length,transcript_status:'ready'});
 }
 const csv='\uFEFF'+[CATALOG_COLUMNS,...rows.map(r=>CATALOG_COLUMNS.map(k=>r[k]??''))].map(a=>a.map(csvCell).join(',')).join('\r\n')+'\r\n';
 return {catalogCsv:csv,rows,sources};
}
