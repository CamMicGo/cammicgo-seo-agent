/**
 * YouTube statistics of the user's own channels (YouTube Analytics API v2, yt-analytics.readonly) and
 * public comments (YouTube Data API). Pure helpers, unit-tested: no network, no secrets.
 */
export const YT_ANALYTICS_SCOPE='https://www.googleapis.com/auth/yt-analytics.readonly';
export const YT_REPORTS_URL='https://youtubeanalytics.googleapis.com/v2/reports';
export const YT_DATA_API='https://www.googleapis.com/youtube/v3';

const DAY=86_400_000;
const iso=(t:number)=>new Date(t).toISOString().slice(0,10);
const parse=(d:string)=>Date.parse(d+'T00:00:00Z');
export const isIsoDate=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(parse(d))&&iso(parse(d))===d;
const FIRST_DAY='2005-02-14';

export type Period={startDate:string;endDate:string;days:number};
/** Period ending yesterday by default (YouTube Analytics lags 1 to 3 days); explicit dates win over days. */
export function resolvePeriod(o:{days?:number;startDate?:string;endDate?:string},now=Date.now()):Period|{error:string}{
 const end=o.endDate??iso(now-DAY);
 if(!isIsoDate(end))return {error:'endDate must be a valid YYYY-MM-DD date'};
 if(o.startDate&&!isIsoDate(o.startDate))return {error:'startDate must be a valid YYYY-MM-DD date'};
 const days=Math.min(Math.max(Math.round(o.days??28),1),3650);
 let start=o.startDate??iso(parse(end)-(days-1)*DAY);
 if(parse(start)<parse(FIRST_DAY))start=FIRST_DAY;
 if(parse(start)>parse(end))return {error:'startDate is after endDate'};
 return {startDate:start,endDate:end,days:Math.round((parse(end)-parse(start))/DAY)+1};
}
/** The period of the same length right before. */
export function previousPeriod(p:Period):Period{const end=parse(p.startDate)-DAY;return {startDate:iso(end-(p.days-1)*DAY),endDate:iso(end),days:p.days};}

export const CHANNEL_ID=/^UC[\w-]{22}$/;
export const channelIds=(channelId?:string)=>'channel=='+(channelId??'MINE');

export type ReportQuery={ids:string;startDate:string;endDate:string;metrics:readonly string[];dimensions?:readonly string[];filters?:readonly string[];sort?:string;maxResults?:number};
export function reportUrl(q:ReportQuery){
 const p=new URLSearchParams({ids:q.ids,startDate:q.startDate,endDate:q.endDate,metrics:q.metrics.join(',')});
 if(q.dimensions?.length)p.set('dimensions',q.dimensions.join(','));
 if(q.filters?.length)p.set('filters',q.filters.join(';'));
 if(q.sort)p.set('sort',q.sort);
 if(q.maxResults)p.set('maxResults',String(q.maxResults));
 return YT_REPORTS_URL+'?'+p;
}
export type Report={columnHeaders?:Array<{name:string}>;rows?:Array<Array<string|number>>};
export type Row=Record<string,string|number>;
export function rowsOf(r:Report):Row[]{const h=(r.columnHeaders??[]).map(c=>c.name);return (r.rows??[]).map(row=>Object.fromEntries(row.map((v,i)=>[h[i]??'col'+i,v])));}

const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const round=(n:number,d=1)=>Math.round(n*10**d)/10**d;
/** Seconds as m:ss or h:mm:ss. */
export function duration(sec:number){const s=Math.max(0,Math.round(sec));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60;return (h?h+':'+String(m).padStart(2,'0'):String(m))+':'+String(r).padStart(2,'0');}
/** ISO 8601 duration (PT1H2M3S) in seconds. */
export function isoSeconds(d?:string){const m=/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d??'');return m?num(m[1])*86400+num(m[2])*3600+num(m[3])*60+num(m[4]):0;}

export const BASIC_METRICS=['views','estimatedMinutesWatched','averageViewDuration','averageViewPercentage','subscribersGained','subscribersLost','likes','comments','shares'] as const;
export type Totals={views:number;watchTimeHours:number;averageViewDuration:string;averageViewPercentage:number;subscribersGained:number;subscribersLost:number;subscribersNet:number;likes:number;comments:number;shares:number};
/** Totals in readable units: watch time in hours, durations as m:ss, net subscribers. */
export function friendlyTotals(row?:Row):Totals|null{
 if(!row)return null;const n=(k:string)=>num(row[k]);
 return {views:n('views'),watchTimeHours:round(n('estimatedMinutesWatched')/60),averageViewDuration:duration(n('averageViewDuration')),averageViewPercentage:round(n('averageViewPercentage')),
  subscribersGained:n('subscribersGained'),subscribersLost:n('subscribersLost'),subscribersNet:n('subscribersGained')-n('subscribersLost'),likes:n('likes'),comments:n('comments'),shares:n('shares')};
}
/** Change in percent; null when the previous value was 0 (new activity). */
export function change(cur:number,prev:number){if(!prev)return cur?null:0;return round((cur-prev)/Math.abs(prev)*100);}
const COMPARED=['views','watchTimeHours','averageViewPercentage','subscribersNet','likes','comments','shares'] as const;
export function compareTotals(cur:Totals|null,prev:Totals|null){
 if(!cur||!prev)return null;
 return Object.fromEntries(COMPARED.map(k=>[k,change(cur[k],prev[k])])) as Record<typeof COMPARED[number],number|null>;
}

/** Per-day series; long periods are grouped by 7 days to stay readable. */
export function dailySeries(rows:Row[],maxPoints=92){
 const pts=rows.map(r=>({day:String(r.day),views:num(r.views),watchTimeHours:round(num(r.estimatedMinutesWatched)/60),subscribersNet:num(r.subscribersGained)-num(r.subscribersLost)})).sort((a,b)=>a.day.localeCompare(b.day));
 if(pts.length<=maxPoints)return {step:'day' as const,points:pts};
 const weeks:Array<{from:string;to:string;views:number;watchTimeHours:number;subscribersNet:number}>=[];
 for(let i=0;i<pts.length;i+=7){const g=pts.slice(i,i+7);weeks.push({from:g[0].day,to:g[g.length-1].day,views:g.reduce((s,p)=>s+p.views,0),watchTimeHours:round(g.reduce((s,p)=>s+p.watchTimeHours,0)),subscribersNet:g.reduce((s,p)=>s+p.subscribersNet,0)});}
 return {step:'week' as const,points:weeks};
}

export const TRAFFIC_SOURCES:Record<string,string>={ADVERTISING:'YouTube advertising',ANNOTATION:'Annotations',CAMPAIGN_CARD:'Campaign cards',END_SCREEN:'End screens',
 EXT_URL:'External websites and apps',HASHTAGS:'Hashtag pages',IMMERSIVE_LIVE:'Immersive live',LIVE_REDIRECT:'Live redirects',NO_LINK_EMBEDDED:'Embedded players',
 NO_LINK_OTHER:'Direct or unknown',NOTIFICATION:'Notifications',PLAYLIST:'Playlists',PRODUCT_PAGE:'Product pages',PROMOTED:'Promoted',RELATED_VIDEO:'Suggested videos',
 SHORTS:'Shorts feed',SHORTS_CONTENT_LINKS:'Shorts content links',SOUND_PAGE:'Sound pages',SUBSCRIBER:'Browse features (home, subscriptions)',VIDEO_REMIXES:'Remixes',
 YT_CHANNEL:'Channel pages',YT_OTHER_PAGE:'Other YouTube features',YT_PLAYLIST_PAGE:'Playlist pages',YT_SEARCH:'YouTube search'};
export const FORMATS:Record<string,string>={VIDEO_ON_DEMAND:'Videos',SHORTS:'Shorts',LIVE_STREAM:'Live',STORY:'Stories',POST:'Posts',UNSPECIFIED:'Other'};

export type Breakdown={dimensions:readonly string[];metrics:readonly string[];sort?:string;filter?:string;max?:number;about:string};
/** Supported audience breakdowns (YouTube Analytics channel reports). */
export const BREAKDOWNS={
 trafficSource:{dimensions:['insightTrafficSourceType'],metrics:['views','estimatedMinutesWatched'],sort:'-views',about:'Where views come from'},
 youtubeSearchTerms:{dimensions:['insightTrafficSourceDetail'],metrics:['views','estimatedMinutesWatched'],sort:'-views',filter:'insightTrafficSourceType==YT_SEARCH',max:25,about:'Words typed in YouTube search before watching (top 25)'},
 externalSites:{dimensions:['insightTrafficSourceDetail'],metrics:['views','estimatedMinutesWatched'],sort:'-views',filter:'insightTrafficSourceType==EXT_URL',max:25,about:'External websites and apps that sent viewers (top 25)'},
 suggestedBy:{dimensions:['insightTrafficSourceDetail'],metrics:['views','estimatedMinutesWatched'],sort:'-views',filter:'insightTrafficSourceType==RELATED_VIDEO',max:25,about:'Videos next to which YouTube suggested yours (top 25)'},
 country:{dimensions:['country'],metrics:['views','estimatedMinutesWatched','averageViewDuration','averageViewPercentage'],sort:'-views',max:50,about:'Views by country'},
 device:{dimensions:['deviceType'],metrics:['views','estimatedMinutesWatched'],sort:'-views',max:50,about:'Views by device type'},
 operatingSystem:{dimensions:['operatingSystem'],metrics:['views','estimatedMinutesWatched'],sort:'-views',max:50,about:'Views by operating system'},
 ageGender:{dimensions:['ageGroup','gender'],metrics:['viewerPercentage'],sort:'gender,ageGroup',about:'Share of signed-in viewers by age and gender'},
 subscribedStatus:{dimensions:['subscribedStatus'],metrics:['views','estimatedMinutesWatched','averageViewDuration'],about:'Subscribers vs non-subscribers'},
 playbackLocation:{dimensions:['insightPlaybackLocationType'],metrics:['views','estimatedMinutesWatched'],sort:'-views',max:50,about:'Where the videos are played'},
 format:{dimensions:['creatorContentType'],metrics:['views','estimatedMinutesWatched','averageViewDuration'],about:'Videos, Shorts and live'},
 sharing:{dimensions:['sharingService'],metrics:['shares'],sort:'-shares',max:50,about:'Services used to share the videos'},
} as const satisfies Record<string,Breakdown>;
export type BreakdownName=keyof typeof BREAKDOWNS;
export const BREAKDOWN_NAMES=Object.keys(BREAKDOWNS) as [BreakdownName,...BreakdownName[]];

const LABELS:Partial<Record<string,Record<string,string>>>={insightTrafficSourceType:TRAFFIC_SOURCES,creatorContentType:FORMATS};
/** Readable rows: labels for codes, hours for minutes, m:ss for durations, share of views. */
export function breakdownRows(rows:Row[]){
 const totalViews=rows.reduce((s,r)=>s+num(r.views),0);
 return rows.map(r=>{
  const out:Record<string,string|number>={};
  for(const [k,v] of Object.entries(r)){
   if(k==='estimatedMinutesWatched')out.watchTimeHours=round(num(v)/60);
   else if(k==='averageViewDuration')out.averageViewDuration=duration(num(v));
   else if(k==='averageViewPercentage'||k==='viewerPercentage')out[k]=round(num(v));
   else if(LABELS[k]){out[k]=v;out.label=LABELS[k]![String(v)]??String(v);}
   else out[k]=v;
  }
  if(totalViews&&'views' in r)out.shareOfViews=round(num(r.views)/totalViews*100);
  return out;
 });
}

export type RetentionPoint={at:string;time?:string;stillWatching:string};
/** Audience retention: share of viewers still watching at key moments, steepest drops, comparison with similar videos. */
export function summarizeRetention(rows:Row[],durationSec=0){
 const pts=rows.map(r=>({x:num(r.elapsedVideoTimeRatio),w:num(r.audienceWatchRatio),rel:r.relativeRetentionPerformance==null?null:num(r.relativeRetentionPerformance)}))
  .filter(p=>p.x>0||p.w>0).sort((a,b)=>a.x-b.x);
 if(pts.length<5)return null;
 const near=(x:number)=>pts.reduce((b,p)=>Math.abs(p.x-x)<Math.abs(b.x-x)?p:b,pts[0]);
 const mark=(p:{x:number;w:number}):RetentionPoint=>({at:Math.round(p.x*100)+'%',...(durationSec?{time:duration(p.x*durationSec)}:{}),stillWatching:round(p.w*100)+'%'});
 const keyMoments=[pts[0],near(0.1),near(0.25),near(0.5),near(0.75),near(0.9),pts[pts.length-1]].filter((p,i,a)=>a.indexOf(p)===i).map(mark);
 // Steepest drops over windows of about 5% of the video (the start is excluded: a fall there is normal).
 const drops:Array<{from:RetentionPoint;to:RetentionPoint;lost:string;d:number}>=[];
 for(let i=0;i+5<pts.length;i++){const a=pts[i],b=pts[i+5];if(a.x<0.03)continue;const d=a.w-b.w;if(d>0)drops.push({from:mark(a),to:mark(b),lost:round(d*100)+' points',d});}
 drops.sort((p,q)=>q.d-p.d);
 const picked:typeof drops=[];
 for(const d of drops){if(picked.length>=3)break;if(picked.every(p=>Math.abs(parseInt(p.from.at)-parseInt(d.from.at))>=10))picked.push(d);}
 const rels=pts.map(p=>p.rel).filter((v):v is number=>v!=null);
 const relative=rels.length?round(rels.reduce((s,v)=>s+v,0)/rels.length,2):null;
 return {keyMoments,steepestDrops:picked.map(({d:_d,...rest})=>rest),relativeRetention:relative,
  comparedWithSimilarVideos:relative==null?null:relative>=0.6?'above typical':relative<=0.4?'below typical':'typical'};
}

export type CommentThread={id:string;snippet?:{totalReplyCount?:number;topLevelComment?:{snippet?:CommentSnippet}};replies?:{comments?:Array<{snippet?:CommentSnippet}>}};
type CommentSnippet={authorDisplayName?:string;textDisplay?:string;textOriginal?:string;likeCount?:number;publishedAt?:string;updatedAt?:string};
export function clip(s:string,max:number){const t=s.replace(/\s+/g,' ').trim();return t.length>max?t.slice(0,max-1)+'…':t;}
/** One comment thread in a compact form (plain text, clipped). */
export function compactThread(t:CommentThread,max=600,withReplies=false){
 const c=t.snippet?.topLevelComment?.snippet??{};
 const out:{id:string;author:string;text:string;likes:number;replies:number;publishedAt?:string;edited?:true;replyPreview?:Array<{author:string;text:string;likes:number}>}=
  {id:t.id,author:c.authorDisplayName??'',text:clip(c.textDisplay??c.textOriginal??'',max),likes:c.likeCount??0,replies:t.snippet?.totalReplyCount??0,publishedAt:c.publishedAt?.slice(0,10)};
 if(c.updatedAt&&c.publishedAt&&c.updatedAt!==c.publishedAt)out.edited=true;
 if(withReplies&&t.replies?.comments?.length)out.replyPreview=t.replies.comments.slice(0,5).map(r=>({author:r.snippet?.authorDisplayName??'',text:clip(r.snippet?.textDisplay??r.snippet?.textOriginal??'',300),likes:r.snippet?.likeCount??0}));
 return out;
}

/** Readable metrics of one video row (top videos report). */
export function videoMetrics(r:Row){
 return {views:num(r.views),watchTimeHours:round(num(r.estimatedMinutesWatched)/60),averageViewDuration:duration(num(r.averageViewDuration)),averageViewPercentage:round(num(r.averageViewPercentage)),
  subscribersGained:num(r.subscribersGained),likes:num(r.likes),comments:num(r.comments),shares:num(r.shares)};
}
