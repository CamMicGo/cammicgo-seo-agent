/**
 * Search Console helpers (pure, unit-tested): Search Analytics request bodies with search types and
 * filters, readable rows, URL inspection summaries and the comparison of two periods ("what changed").
 */
export const GSC_V3='https://www.googleapis.com/webmasters/v3/sites/';
export const GSC_INSPECT='https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
export const SEARCH_TYPES=['web','image','video','news','discover','googleNews'] as const;
export type SearchType=typeof SEARCH_TYPES[number];
export const GSC_DIMENSIONS=['query','page','country','device','date','searchAppearance'] as const;
export type GscDimension=typeof GSC_DIMENSIONS[number];
export const OPERATORS=['contains','notContains','equals','notEquals','includingRegex','excludingRegex'] as const;
export type GscFilter={dimension:'query'|'page'|'country'|'device'|'searchAppearance';operator:typeof OPERATORS[number];expression:string};

const DAY=86_400_000;
const iso=(t:number)=>new Date(t).toISOString().slice(0,10);
const parse=(d:string)=>Date.parse(d+'T00:00:00Z');
/** Default period ends 3 days ago (final data) or yesterday with fresh data. */
export function gscPeriod(o:{days?:number;startDate?:string;endDate?:string;fresh?:boolean},now=Date.now()):{startDate:string;endDate:string;days:number}|{error:string}{
 const ok=(d?:string)=>!d||(/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(parse(d))&&iso(parse(d))===d);
 if(!ok(o.startDate)||!ok(o.endDate))return {error:'Dates must be valid YYYY-MM-DD'};
 const end=o.endDate??iso(now-(o.fresh?1:3)*DAY);
 const days=Math.min(Math.max(Math.round(o.days??28),1),480);
 const start=o.startDate??iso(parse(end)-(days-1)*DAY);
 if(parse(start)>parse(end))return {error:'startDate is after endDate'};
 return {startDate:start,endDate:end,days:Math.round((parse(end)-parse(start))/DAY)+1};
}
export function previousOf(p:{startDate:string;days:number}){const end=parse(p.startDate)-DAY;return {startDate:iso(end-(p.days-1)*DAY),endDate:iso(end),days:p.days};}

export type QueryInput={startDate:string;endDate:string;dimensions:readonly string[];type?:SearchType;filters?:GscFilter[];rowLimit?:number;startRow?:number;fresh?:boolean};
export function queryBody(q:QueryInput){
 const body:Record<string,unknown>={startDate:q.startDate,endDate:q.endDate,dimensions:q.dimensions,type:q.type??'web',rowLimit:Math.min(Math.max(q.rowLimit??100,1),25000),startRow:q.startRow??0};
 if(q.filters?.length)body.dimensionFilterGroups=[{groupType:'and',filters:q.filters.map(f=>({dimension:f.dimension,operator:f.operator,expression:f.dimension==='country'?f.expression.toLowerCase():f.expression}))}];
 if(q.fresh)body.dataState='all';
 return body;
}
export const siteUrl=(site:string)=>GSC_V3+encodeURIComponent(site);

export type GscApiRow={keys?:string[];clicks?:number;impressions?:number;ctr?:number;position?:number};
export type GscRow={[dimension:string]:string|number;clicks:number;impressions:number;ctr:number;position:number};
const round=(n:number,d=1)=>Math.round(n*10**d)/10**d;
/** Named dimensions, CTR in percent, position with one decimal. */
export function rowsOf(rows:GscApiRow[]|undefined,dimensions:readonly string[]):GscRow[]{
 return (rows??[]).map(r=>{
  const o:GscRow={clicks:r.clicks??0,impressions:r.impressions??0,ctr:round((r.ctr??0)*100,2),position:round(r.position??0)};
  dimensions.forEach((d,i)=>{o[d]=r.keys?.[i]??'';});
  return o;
 });
}
export function totals(rows:GscRow[]){
 const clicks=rows.reduce((s,r)=>s+r.clicks,0),impressions=rows.reduce((s,r)=>s+r.impressions,0);
 const position=impressions?round(rows.reduce((s,r)=>s+r.position*r.impressions,0)/impressions):0;
 return {clicks,impressions,ctr:impressions?round(clicks/impressions*100,2):0,position};
}

export type Change={key:string;clicks:number;previousClicks:number;clicksDelta:number;impressions:number;previousImpressions:number;ctr:number;previousCtr:number;position:number;previousPosition:number};
/** "What changed" between two periods: movers, new and lost items, CTR drops and position moves (rows of one dimension). */
export function comparePeriods(current:GscRow[],previous:GscRow[],dimension:string,o:{top?:number;minImpressions?:number}={}){
 const top=o.top??10,minImp=o.minImpressions??20;
 const prev=new Map(previous.map(r=>[String(r[dimension]),r]));const cur=new Map(current.map(r=>[String(r[dimension]),r]));
 const all=new Set([...cur.keys(),...prev.keys()]);
 const changes:Change[]=[...all].map(k=>{const c=cur.get(k),p=prev.get(k);return {key:k,clicks:c?.clicks??0,previousClicks:p?.clicks??0,clicksDelta:(c?.clicks??0)-(p?.clicks??0),
  impressions:c?.impressions??0,previousImpressions:p?.impressions??0,ctr:c?.ctr??0,previousCtr:p?.ctr??0,position:c?.position??0,previousPosition:p?.position??0};});
 const by=<T>(a:T[],f:(x:T)=>number)=>[...a].sort((x,y)=>f(y)-f(x)).slice(0,top);
 return {
  totals:{current:totals(current),previous:totals(previous)},
  gainers:by(changes.filter(c=>c.clicksDelta>0),c=>c.clicksDelta),
  losers:by(changes.filter(c=>c.clicksDelta<0),c=>-c.clicksDelta),
  newItems:by(changes.filter(c=>c.impressions>=minImp&&!prev.has(c.key)),c=>c.impressions),
  lostItems:by(changes.filter(c=>c.previousImpressions>=minImp&&!cur.has(c.key)),c=>c.previousImpressions),
  ctrDrops:by(changes.filter(c=>c.impressions>=minImp&&c.previousImpressions>=minImp&&c.previousCtr>0&&c.ctr<c.previousCtr*0.7),c=>c.impressions*(c.previousCtr-c.ctr)),
  positionGains:by(changes.filter(c=>cur.has(c.key)&&prev.has(c.key)&&c.impressions>=minImp&&c.previousPosition-c.position>=3),c=>c.previousPosition-c.position),
  positionLosses:by(changes.filter(c=>cur.has(c.key)&&prev.has(c.key)&&c.impressions>=minImp&&c.position-c.previousPosition>=3),c=>c.position-c.previousPosition),
 };
}

type InspectionResult={indexStatusResult?:{verdict?:string;coverageState?:string;robotsTxtState?:string;indexingState?:string;lastCrawlTime?:string;pageFetchState?:string;googleCanonical?:string;userCanonical?:string;crawledAs?:string;sitemap?:string[];referringUrls?:string[]};
 richResultsResult?:{verdict?:string;detectedItems?:Array<{richResultType?:string;items?:Array<{name?:string;issues?:Array<{issueMessage?:string;severity?:string}>}>}>};
 mobileUsabilityResult?:{verdict?:string};inspectionResultLink?:string};
/** Compact URL Inspection result: indexing, crawl, canonical, sitemaps and rich results. */
export function inspectionSummary(url:string,r:{inspectionResult?:InspectionResult}){
 const i=r.inspectionResult??{},s=i.indexStatusResult??{};
 const canonicalDiffers=!!(s.googleCanonical&&s.userCanonical&&s.googleCanonical!==s.userCanonical);
 return {url,indexed:s.verdict==='PASS',verdict:s.verdict??null,coverage:s.coverageState??null,indexing:s.indexingState??null,robotsTxt:s.robotsTxtState??null,fetch:s.pageFetchState??null,
  lastCrawl:s.lastCrawlTime??null,crawledAs:s.crawledAs??null,googleCanonical:s.googleCanonical??null,userCanonical:s.userCanonical??null,canonicalDiffers,
  sitemaps:s.sitemap??[],referringUrls:(s.referringUrls??[]).slice(0,5),
  richResults:i.richResultsResult?{verdict:i.richResultsResult.verdict??null,types:(i.richResultsResult.detectedItems??[]).map(d=>({type:d.richResultType,issues:(d.items??[]).flatMap(x=>(x.issues??[]).map(z=>z.severity+': '+z.issueMessage)).slice(0,5)}))}:null,
  report:i.inspectionResultLink??null};
}
