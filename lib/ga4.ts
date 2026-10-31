/**
 * Google Analytics 4 Data API helpers (pure, unit-tested): request bodies for free-form reports,
 * readable rows, and period comparisons. Field names are the GA4 API names (sessions, sessionDefaultChannelGroup…).
 */
export const GA4_DATA='https://analyticsdata.googleapis.com/v1beta/';
export const GA4_FIELD=/^[A-Za-z][A-Za-z0-9_]*(:[A-Za-z0-9_]+)?$/;

export type Match='exact'|'contains'|'beginsWith'|'endsWith'|'regex'|'notExact'|'notContains';
export type Ga4Filter={field:string;match:Match;value:string};
const MATCH:Record<Exclude<Match,'notExact'|'notContains'>,string>={exact:'EXACT',contains:'CONTAINS',beginsWith:'BEGINS_WITH',endsWith:'ENDS_WITH',regex:'FULL_REGEXP'};

/** AND of dimension filters; "not…" matches become notExpression. */
export function dimensionFilter(filters:Ga4Filter[]){
 if(!filters.length)return undefined;
 const one=(f:Ga4Filter)=>{
  const neg=f.match==='notExact'||f.match==='notContains';
  const matchType=f.match==='notExact'?'EXACT':f.match==='notContains'?'CONTAINS':MATCH[f.match];
  const expr={filter:{fieldName:f.field,stringFilter:{matchType,value:f.value,caseSensitive:false}}};
  return neg?{notExpression:expr}:expr;
 };
 return filters.length===1?one(filters[0]):{andGroup:{expressions:filters.map(one)}};
}

export type DateRange={startDate:string;endDate:string};
const DAY=86_400_000;
const iso=(t:number)=>new Date(t).toISOString().slice(0,10);
const parse=(d:string)=>Date.parse(d+'T00:00:00Z');
/** Period ending yesterday (or explicit dates) and, for comparisons, the previous period of the same length. */
export function periods(o:{days?:number;startDate?:string;endDate?:string;compare?:boolean},now=Date.now()):{current:DateRange;previous?:DateRange;days:number}|{error:string}{
 const ok=(d?:string)=>!d||(/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(parse(d))&&iso(parse(d))===d);
 if(!ok(o.startDate)||!ok(o.endDate))return {error:'Dates must be valid YYYY-MM-DD'};
 const end=o.endDate??iso(now-DAY);
 const days=Math.min(Math.max(Math.round(o.days??28),1),3650);
 const start=o.startDate??iso(parse(end)-(days-1)*DAY);
 if(parse(start)>parse(end))return {error:'startDate is after endDate'};
 const n=Math.round((parse(end)-parse(start))/DAY)+1;
 const current={startDate:start,endDate:end};
 if(!o.compare)return {current,days:n};
 const pEnd=parse(start)-DAY;
 return {current,previous:{startDate:iso(pEnd-(n-1)*DAY),endDate:iso(pEnd)},days:n};
}

export type ReportInput={dimensions:string[];metrics:string[];ranges:DateRange[];filters?:Ga4Filter[];orderBy?:{field:string;desc?:boolean};limit?:number;offset?:number};
export function reportBody(q:ReportInput){
 const order=q.orderBy??(q.metrics.length?{field:q.metrics[0],desc:true}:undefined);
 const body:Record<string,unknown>={dateRanges:q.ranges.map((r,i)=>({...r,name:i===0?'current':'previous'})),dimensions:q.dimensions.map(name=>({name})),metrics:q.metrics.map(name=>({name})),
  limit:q.limit??100,offset:q.offset??0,returnPropertyQuota:true,keepEmptyRows:false};
 const f=dimensionFilter(q.filters??[]);if(f)body.dimensionFilter=f;
 if(order)body.orderBys=[q.metrics.includes(order.field)?{metric:{metricName:order.field},desc:order.desc??true}:{dimension:{dimensionName:order.field},desc:order.desc??false}];
 return body;
}

type Header={name:string;type?:string};
export type Ga4Response={dimensionHeaders?:Header[];metricHeaders?:Header[];rows?:Array<{dimensionValues?:Array<{value?:string}>;metricValues?:Array<{value?:string}>}>;rowCount?:number;totals?:unknown;propertyQuota?:unknown};
const round=(n:number,d=2)=>Math.round(n*10**d)/10**d;
/** Readable value: integers stay integers, rates in %, durations in seconds rounded. */
function value(v:string|undefined,type?:string){
 const n=Number(v??0);if(!Number.isFinite(n))return v??null;
 if(type==='TYPE_INTEGER')return Math.round(n);
 if(type==='TYPE_SECONDS'||type==='TYPE_MILLISECONDS')return round(n,1);
 return round(n,4);
}
export type Ga4Row=Record<string,string|number|null>;
export function rowsOf(r:Ga4Response):Ga4Row[]{
 const dh=(r.dimensionHeaders??[]).map(h=>h.name),mh=r.metricHeaders??[];
 return (r.rows??[]).map(row=>{
  const o:Ga4Row={};
  (row.dimensionValues??[]).forEach((d,i)=>{o[dh[i]??'dim'+i]=d.value??null;});
  (row.metricValues??[]).forEach((m,i)=>{o[mh[i]?.name??'metric'+i]=value(m.value,mh[i]?.type);});
  return o;
 });
}
const pct=(cur:number,prev:number)=>prev?round((cur-prev)/Math.abs(prev)*100,1):cur?null:0;
/** With two date ranges GA4 adds a dateRange dimension: merge both periods per dimension combination. */
export function comparedRows(rows:Ga4Row[],dimensions:string[],metrics:string[]){
 const key=(r:Ga4Row)=>dimensions.map(d=>String(r[d]??'')).join('\u0001');
 const map=new Map<string,{dims:Ga4Row;current:Ga4Row;previous:Ga4Row}>();
 for(const r of rows){
  const k=key(r);const e=map.get(k)??{dims:Object.fromEntries(dimensions.map(d=>[d,r[d]??null])),current:{},previous:{}};
  const slot=r.dateRange==='previous'?e.previous:e.current;for(const m of metrics)slot[m]=r[m]??0;map.set(k,e);
 }
 return [...map.values()].map(e=>({...e.dims,current:e.current,previous:e.previous,
  changePercent:Object.fromEntries(metrics.map(m=>[m,pct(Number(e.current[m]??0),Number(e.previous[m]??0))]))}));
}

export const GA4_HINT='Use GA4 API names. Dimensions: sessionDefaultChannelGroup, sessionSourceMedium, sessionSource, landingPage, pagePath, pageTitle, country, city, language, deviceCategory, browser, operatingSystem, date, eventName, newVsReturning, firstUserSource. Metrics: sessions, activeUsers, newUsers, totalUsers, screenPageViews, engagedSessions, engagementRate, averageSessionDuration, bounceRate, eventCount, keyEvents, userEngagementDuration. Custom fields: customEvent:<parameter>.';
