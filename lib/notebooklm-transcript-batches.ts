/** Pure, deterministic Markdown batching for timestamped YouTube transcripts.
 * No Google credentials, NotebookLM private endpoints, or network calls.
 * Safe to share between local MCP, desktop relay and Android-compatible consumers.
 */
export type TranscriptSegment = {startSeconds:number; text:string};
export type TranscriptVideo = {
  videoId:string; channelId:string; channelName:string; title:string;
  publishedAt:string; language:string; segments:TranscriptSegment[];
};
export type TranscriptBatch = {id:string; markdown:string; videoIds:string[]; wordCount:number};
export type BatchOptions = {maxWords?:number; period?:'month'|'year'};
const DEFAULT_MAX_WORDS=300_000;
const words=(s:string)=>s.trim()?s.trim().split(/\s+/u).length:0;
const safe=(s:string)=>s.replace(/[\r\n]+/gu,' ').trim();
const timestamp=(seconds:number)=>{
  if(!Number.isFinite(seconds)||seconds<0)throw new Error('Invalid timestamp');
  const n=Math.floor(seconds), h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;
  return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':');
};
export function renderVideo(video:TranscriptVideo):string {
  if(!/^[A-Za-z0-9_-]{6,32}$/.test(video.videoId))throw new Error('Invalid YouTube video ID');
  if(!video.channelId.trim())throw new Error('Missing channel ID');
  if(!Number.isFinite(Date.parse(video.publishedAt)))throw new Error('Invalid publication date');
  const ordered=[...video.segments].sort((a,b)=>a.startSeconds-b.startSeconds);
  return [
    `## ${safe(video.title)}`,
    `- Video ID: ${video.videoId}`,
    `- URL: https://www.youtube.com/watch?v=${video.videoId}`,
    `- Published: ${new Date(video.publishedAt).toISOString()}`,
    `- Language: ${safe(video.language)}`,
    '### Timestamped transcript',
    ...ordered.map(s=>`[${timestamp(s.startSeconds)}] ${safe(s.text)}`),
  ].join('\n');
}
/** Groups by stable channel ID and UTC period, then caps each document by word count.
 * A video is never silently truncated. Oversize videos throw for explicit handling.
 * Stable ordering and IDs support content hashing and incremental reconciliation.
 */
export function buildTranscriptBatches(videos:TranscriptVideo[],options:BatchOptions={}):TranscriptBatch[]{
  const maxWords=options.maxWords??DEFAULT_MAX_WORDS;
  if(!Number.isSafeInteger(maxWords)||maxWords<100)throw new Error('maxWords must be an integer >= 100');
  const period=options.period??'year';
  const unique=new Map<string,TranscriptVideo>();
  for(const video of videos){
    if(!unique.has(video.videoId))unique.set(video.videoId,video);
  }
  const groups=new Map<string,TranscriptVideo[]>();
  for(const video of unique.values()){
    const date=new Date(video.publishedAt);
    if(!Number.isFinite(date.getTime()))throw new Error('Invalid publication date');
    const bucket=date.toISOString().slice(0,period==='month'?7:4);
    const key=`${video.channelId}:${bucket}`;
    groups.set(key,[...(groups.get(key)??[]),video]);
  }
  const result:TranscriptBatch[]=[];
  for(const [group,items] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
    items.sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)||a.videoId.localeCompare(b.videoId));
    let index=1,ids:string[]=[],sections:string[]=[],count=0;
    const flush=()=>{
      if(!ids.length)return;
      const id=`${group}:part-${String(index++).padStart(3,'0')}`;
      result.push({id,markdown:`# YouTube transcripts — ${group}\n\n${sections.join('\n\n---\n\n')}\n`,videoIds:ids,wordCount:count});
      ids=[];sections=[];count=0;
    };
    for(const video of items){
      const section=renderVideo(video),length=words(section);
      if(length>maxWords)throw new Error(`Video ${video.videoId} exceeds maxWords; split explicitly`);
      if(count+length>maxWords)flush();
      ids.push(video.videoId);sections.push(section);count+=length;
    }
    flush();
  }
  return result;
}
