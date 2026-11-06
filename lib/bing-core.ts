/**
 * Bing Webmaster Tools API (https://ssl.bing.com/webmaster/api.svc/json) with the
 * user's own API key. The key is stored encrypted, never returned in clear to the
 * browser and never shown to the AI assistant. Every call uses only the key of the
 * signed-in user, so one user can never read another user's sites.
 */
export const BING_API='https://ssl.bing.com/webmaster/api.svc/json';
export type BRow={[k:string]:unknown};
export type BingResult<T>={ok:true;data:T}|{ok:false;error:string;status?:number;message?:string};

export function validateBingKey(v:unknown){const k=typeof v==='string'?v.trim():'';return /^[A-Za-z0-9]{16,64}$/.test(k)?k:null;}

export async function bingCall<T=unknown>(key:string,method:string,params:Record<string,string|number|undefined>={},body?:unknown):Promise<BingResult<T>>{
 const q=new URLSearchParams();for(const [k,v] of Object.entries(params))if(v!==undefined&&v!=='')q.set(k,String(v));q.set('apikey',key);
 try{
  const r=await fetch(`${BING_API}/${method}?${q}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)});
  const text=await r.text();let json:unknown=null;try{json=text?JSON.parse(text):null}catch{}
  if(!r.ok){const j=json as {Message?:string;ErrorCode?:number}|null;const message=(j?.Message||text).slice(0,300).replaceAll(key,'••••');
   return {ok:false,status:r.status,error:/api\s?key|unauthori[sz]ed|InvalidApiKey/i.test(message)||r.status===401?'bing_key_rejected':'bing_api_error',message};}
  const d=(json as {d?:unknown}|null)?.d;return {ok:true,data:(d===undefined?json:d) as T};
 }catch(e){return {ok:false,error:'bing_unreachable',message:e instanceof Error?e.message:String(e)}}
}

/** Bing returns WCF dates such as "/Date(1730764800000-0800)/". */
export function bingDate(v:unknown):string|null{
 if(typeof v!=='string')return null;const m=v.match(/Date\((-?\d+)/);if(m)return new Date(Number(m[1])).toISOString().slice(0,10);
 if(/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
 const t=Date.parse(v);return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):null;
}

/** Normalises a site URL the way Bing stores it (scheme + host + trailing slash). */
export function bingSiteUrl(v:string){try{const u=new URL(/^https?:\/\//i.test(v)?v:'https://'+v);return `${u.protocol}//${u.host}/`}catch{return null}}

type Stat={Query?:string;Date?:string;Clicks?:number;Impressions?:number;AvgClickPosition?:number;AvgImpressionPosition?:number};
/** Bing query/page stats come as weekly rows: aggregate them per key over the requested window. */
export function aggregateStats(input:BRow[],sinceDays:number,limit:number,sortBy:'clicks'|'impressions'){
 const rows=input as Stat[];const since=Date.now()-sinceDays*86400000;const by=new Map<string,{key:string;clicks:number;impressions:number;posSum:number;posW:number}>();
 for(const r of rows){const d=bingDate(r.Date);if(d&&Date.parse(d)<since)continue;const k=r.Query??'';if(!k)continue;
  const e=by.get(k)??{key:k,clicks:0,impressions:0,posSum:0,posW:0};const imp=Number(r.Impressions??0);e.clicks+=Number(r.Clicks??0);e.impressions+=imp;
  const pos=Number(r.AvgImpressionPosition??0);if(pos>0&&imp>0){e.posSum+=pos*imp;e.posW+=imp}by.set(k,e);}
 const list=[...by.values()].map(e=>({key:e.key,clicks:e.clicks,impressions:e.impressions,ctr:e.impressions?Number((e.clicks/e.impressions*100).toFixed(2)):0,position:e.posW?Number((e.posSum/e.posW).toFixed(1)):null}));
 list.sort((a,b)=>sortBy==='clicks'?b.clicks-a.clicks||b.impressions-a.impressions:b.impressions-a.impressions);
 return {total:list.length,rows:list.slice(0,limit)};
}
