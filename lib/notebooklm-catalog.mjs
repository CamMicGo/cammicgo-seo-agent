/** A Google Sheets video catalog plus shared, bounded Markdown sources for NotebookLM.
 * A Markdown source may hold many videos; every video has a visible heading and
 * its own metadata. Oversize videos continue in subsequent source files.
 */
const clean=s=>String(s??'').replace(/[\r\n]+/g,' ').trim();
const slug=s=>clean(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'channel';
const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
const words=s=>s.trim().split(/\s+/).filter(Boolean).length;
const time=n=>{n=Math.max(0,Math.floor(Number(n)||0));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(x=>String(x).padStart(2,'0')).join(':')};
export const CATALOG_COLUMNS=['channel_name','channel_id','video_id','title','url','published_at','duration_seconds','language','transcript_files','transcript_parts','transcript_status'];
export function buildNotebookCatalog(videos,{maxSourceChars=400000,maxSourceWords=80000}={}){
 if(!Number.isSafeInteger(maxSourceChars)||maxSourceChars<1000||!Number.isSafeInteger(maxSourceWords)||maxSourceWords<100)throw Error('Invalid source limits');
 const unique=new Map(videos.map(v=>[v.videoId,v]));
 const ordered=[...unique.values()].sort((a,b)=>String(a.channelId).localeCompare(String(b.channelId))||String(a.publishedAt).localeCompare(String(b.publishedAt))||String(a.videoId).localeCompare(String(b.videoId)));
 const sources=[],rows=[],groups=new Map();
 for(const v of ordered){
  if(!/^[A-Za-z0-9_-]{11}$/.test(v.videoId)||!Array.isArray(v.segments)||!v.segments.length)throw Error('Invalid video or missing segments');
  const key=String(v.channelId||v.channelName);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(v);
 }
 for(const [channelId,items] of groups){
  const prefix=slug(items[0].channelName);
  const fileHeader='# '+clean(items[0].channelName)+' — YouTube transcripts\n\n';
  let fileIndex=1,body='',sourceVideoIds=[];
  const filename=()=>prefix+'-transcriptions-part-'+String(fileIndex).padStart(3,'0')+'.md';
  const flush=()=>{
   if(!body)return;
   sources.push({filename:filename(),markdown:fileHeader+body,channelId,videoIds:[...new Set(sourceVideoIds)],part:fileIndex});
   fileIndex++;body='';sourceVideoIds=[];
  };
  const fits=addition=>fileHeader.length+body.length+addition.length<=maxSourceChars&&words(fileHeader+body)+words(addition)<=maxSourceWords;
  for(const v of items){
   const refs=[];
   const orderedSegments=[...v.segments].sort((a,b)=>Number(a.startSeconds??a.start)-Number(b.startSeconds??b.start));
   let part=1,hasSegment=false;
   const heading=()=>[
    '---','', '## '+clean(v.title)+(part>1?' — suite '+part:''),'',
    '- Channel: '+clean(v.channelName),
    '- Video ID: '+v.videoId,
    '- URL: https://www.youtube.com/watch?v='+v.videoId,
    '- Published: '+clean(v.publishedAt),
    '- Language: '+clean(v.language),
    '- Starting part: '+part,'','### Timestamped transcript',''
   ].join('\n')+'\n';
   let needsHeading=true;
   for(const seg of orderedSegments){
    const line='['+time(seg.startSeconds??seg.start)+'] '+clean(seg.text)+'\n';
    if(needsHeading){
     const intro=heading();
     if(!fits(intro+line)){
      if(body)flush();
      if(!fits(intro+line))throw Error('Oversize segment for '+v.videoId);
     }
     body+=intro;sourceVideoIds.push(v.videoId);refs.push(filename());needsHeading=false;
    }
    if(!fits(line)){
     flush();part++;needsHeading=true;
     const intro=heading();
     if(!fits(intro+line))throw Error('Oversize segment for '+v.videoId);
     body+=intro;sourceVideoIds.push(v.videoId);refs.push(filename());needsHeading=false;
    }
    body+=line;hasSegment=true;
   }
   if(!hasSegment)throw Error('Missing transcript segments for '+v.videoId);
   rows.push({channel_name:clean(v.channelName),channel_id:clean(v.channelId),video_id:v.videoId,title:clean(v.title),url:'https://www.youtube.com/watch?v='+v.videoId,published_at:clean(v.publishedAt),duration_seconds:v.durationSeconds??'',language:clean(v.language),transcript_files:refs.join(' | '),transcript_parts:refs.length,transcript_status:'ready'});
  }
  flush();
 }
 const csv='\uFEFF'+[CATALOG_COLUMNS,...rows.map(r=>CATALOG_COLUMNS.map(k=>r[k]??''))].map(a=>a.map(csvCell).join(',')).join('\r\n')+'\r\n';
 return {catalogCsv:csv,rows,sources};
}
