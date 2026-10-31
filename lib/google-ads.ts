/**
 * Google Ads API helpers for the remote MCP (Explorer access is enough: reporting and campaign
 * creation; Keyword Planner needs Basic). Developer tokens were sunset on 9 Sept 2026: access is
 * granted to the Google Cloud project that owns the OAuth client, so no developer-token header is sent.
 * Campaigns are ALWAYS created PAUSED with a campaign total budget over a fixed period: the user
 * reviews and enables them in Google Ads.
 */
export const ADS_VERSION=process.env.GOOGLE_ADS_API_VERSION||'v25';
export const ADS_BASE='https://googleads.googleapis.com/'+ADS_VERSION;
export const ADS_SCOPE='https://www.googleapis.com/auth/adwords';

export const GEO:Record<string,number>={FR:2250,BE:2056,CH:2756,LU:2442,CA:2124,US:2840,GB:2826,DE:2276,ES:2724,IT:2380,NL:2528,PT:2620,MA:2504,DZ:2012,TN:2788,JP:2392,KR:2410,AU:2036,IE:2372,AT:2040};
export const LANG:Record<string,number>={en:1000,de:1001,fr:1002,es:1003,it:1004,ja:1005,nl:1010,ko:1012,pt:1014,'zh-CN':1017,ar:1019,ru:1031};

export const cleanCid=(v:string)=>v.replace(/[^0-9]/g,'');
export const isCid=(v:string)=>/^[0-9]{10}$/.test(cleanCid(v));

export function adsHeaders(loginCustomerId?:string):Record<string,string>{
 const h:Record<string,string>={'Content-Type':'application/json'};
 if(loginCustomerId&&isCid(loginCustomerId))h['login-customer-id']=cleanCid(loginCustomerId);
 return h;
}

/** GAQL presets for ads_report; custom queries must be a single SELECT. */
export function presetQuery(level:'campaign'|'ad_group'|'keyword'|'search_term',during:string){
 const d=" WHERE segments.date DURING "+during;
 const m='metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, metrics.conversions, metrics.conversions_value';
 switch(level){
  case 'ad_group':return 'SELECT campaign.name, ad_group.id, ad_group.name, ad_group.status, '+m+' FROM ad_group'+d+' ORDER BY metrics.cost_micros DESC LIMIT 200';
  case 'keyword':return 'SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, '+m+' FROM keyword_view'+d+' ORDER BY metrics.cost_micros DESC LIMIT 200';
  case 'search_term':return 'SELECT campaign.name, search_term_view.search_term, search_term_view.status, '+m+' FROM search_term_view'+d+' ORDER BY metrics.impressions DESC LIMIT 200';
  default:return 'SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.start_date_time, campaign.end_date_time, campaign_budget.amount_micros, campaign_budget.total_amount_micros, '+m+' FROM campaign'+d+' ORDER BY metrics.cost_micros DESC LIMIT 200';
 }
}
export const DURING=['TODAY','YESTERDAY','LAST_7_DAYS','LAST_14_DAYS','LAST_30_DAYS','THIS_MONTH','LAST_MONTH','THIS_WEEK_MON_TODAY','LAST_WEEK_MON_SUN'] as const;

export function safeCustomQuery(q:string){
 const t=q.trim();
 if(!/^select\s/i.test(t)||t.length>4000||/;/.test(t))return null;
 return t;
}

/** Flattens searchStream batches into plain rows; converts *_micros to currency units. */
export function rowsOf(body:unknown){
 const batches=Array.isArray(body)?body:[body];
 const rows:unknown[]=[];
 for(const b of batches as Array<{results?:unknown[]}>)for(const r of b?.results??[])rows.push(r);
 const fix=(v:unknown):unknown=>{
  if(Array.isArray(v))return v.map(fix);
  if(v&&typeof v==='object'){const o:Record<string,unknown>={};for(const [k,x] of Object.entries(v as Record<string,unknown>)){if(/Micros$/.test(k)&&(typeof x==='string'||typeof x==='number'))o[k.replace(/Micros$/,'')]=Math.round(Number(x)/10_000)/100;else o[k]=fix(x);}return o;}
  return v;
 };
 return rows.map(fix);
}

export type CampaignInput={customerId:string;loginCustomerId?:string;name:string;finalUrl:string;totalBudget:number;startDate:string;endDate:string;
 keywords:Array<{text:string;matchType:'EXACT'|'PHRASE'|'BROAD'}>;headlines:string[];descriptions:string[];path1?:string;path2?:string;
 countries:string[];languages:string[];maxCpc?:number};

/** Validates the request and returns the period length, or an error message. */
export function checkCampaign(c:CampaignInput,today=new Date()){
 const day=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)?Date.parse(s+'T00:00:00Z'):NaN;
 const start=day(c.startDate),end=day(c.endDate),now=Date.parse(today.toISOString().slice(0,10)+'T00:00:00Z');
 if(!isCid(c.customerId))return {error:'customerId must be the 10-digit Google Ads account ID (e.g. 123-456-7890).'};
 if(!Number.isFinite(start)||!Number.isFinite(end))return {error:'startDate and endDate must be YYYY-MM-DD.'};
 if(start<now)return {error:'startDate cannot be in the past.'};
 if(end<start)return {error:'endDate must be on or after startDate.'};
 const days=Math.round((end-start)/86_400_000)+1;
 if(days>366)return {error:'The period cannot exceed one year.'};
 if(!(c.totalBudget>0)||c.totalBudget>100000)return {error:'totalBudget must be a positive amount in the account currency.'};
 let u:URL;try{u=new URL(c.finalUrl)}catch{return {error:'finalUrl is not a valid URL.'}}
 if(u.protocol!=='https:'&&u.protocol!=='http:')return {error:'finalUrl must be http(s).'};
 if(c.headlines.length<3||c.headlines.length>15||c.headlines.some(h=>!h.trim()||h.length>30))return {error:'Provide 3 to 15 headlines of at most 30 characters.'};
 if(c.descriptions.length<2||c.descriptions.length>4||c.descriptions.some(h=>!h.trim()||h.length>90))return {error:'Provide 2 to 4 descriptions of at most 90 characters.'};
 if(!c.keywords.length||c.keywords.length>50||c.keywords.some(k=>!k.text.trim()||k.text.length>80))return {error:'Provide 1 to 50 keywords (80 characters max).'};
 if(c.path1&&c.path1.length>15||c.path2&&c.path2.length>15)return {error:'path1/path2: 15 characters max.'};
 const badGeo=c.countries.filter(x=>!GEO[x]);if(!c.countries.length||badGeo.length)return {error:'Unsupported countries: '+badGeo.join(', ')+'. Supported: '+Object.keys(GEO).join(', ')};
 const badLang=c.languages.filter(x=>!LANG[x]);if(!c.languages.length||badLang.length)return {error:'Unsupported languages: '+badLang.join(', ')+'. Supported: '+Object.keys(LANG).join(', ')};
 return {days};
}

/** One atomic GoogleAdsService.Mutate: total budget, PAUSED Search campaign, targeting, ad group, keywords, responsive search ad. */
export function campaignOperations(c:CampaignInput){
 const cid=cleanCid(c.customerId),r=(t:string,n:number)=>'customers/'+cid+'/'+t+'/-'+n;
 const budget=r('campaignBudgets',1),campaign=r('campaigns',2),adGroup=r('adGroups',3);
 const micros=(v:number)=>String(Math.round(v*100)*10_000);
 const ops:unknown[]=[
  {campaignBudgetOperation:{create:{resourceName:budget,name:c.name+' · budget '+Date.now(),period:'CUSTOM_PERIOD',totalAmountMicros:micros(c.totalBudget),deliveryMethod:'STANDARD',explicitlyShared:false}}},
  {campaignOperation:{create:{resourceName:campaign,name:c.name,status:'PAUSED',advertisingChannelType:'SEARCH',campaignBudget:budget,
   targetSpend:c.maxCpc?{cpcBidCeilingMicros:micros(c.maxCpc)}:{},
   networkSettings:{targetGoogleSearch:true,targetSearchNetwork:false,targetContentNetwork:false,targetPartnerSearchNetwork:false},
   startDateTime:c.startDate+' 00:00:00',endDateTime:c.endDate+' 23:59:59',
   containsEuPoliticalAdvertising:'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'}}},
  ...c.countries.map(x=>({campaignCriterionOperation:{create:{campaign,location:{geoTargetConstant:'geoTargetConstants/'+GEO[x]}}}})),
  ...c.languages.map(x=>({campaignCriterionOperation:{create:{campaign,language:{languageConstant:'languageConstants/'+LANG[x]}}}})),
  {adGroupOperation:{create:{resourceName:adGroup,name:c.name+' · groupe 1',campaign,status:'ENABLED',type:'SEARCH_STANDARD'}}},
  ...c.keywords.map(k=>({adGroupCriterionOperation:{create:{adGroup,status:'ENABLED',keyword:{text:k.text.trim(),matchType:k.matchType}}}})),
  {adGroupAdOperation:{create:{adGroup,status:'ENABLED',ad:{finalUrls:[c.finalUrl],responsiveSearchAd:{headlines:c.headlines.map(text=>({text})),descriptions:c.descriptions.map(text=>({text})),...(c.path1?{path1:c.path1}:{}),...(c.path2?{path2:c.path2}:{})}}}}},
 ];
 return ops;
}

/** Short readable list of Google Ads API errors. */
export function adsErrors(body:unknown){
 const out:string[]=[];
 const walk=(v:unknown)=>{if(!v||typeof v!=='object')return;const o=v as Record<string,unknown>;if(Array.isArray(o.errors))for(const e of o.errors as Array<{message?:string;errorCode?:unknown;location?:unknown}>)out.push((e.message||'')+' '+JSON.stringify(e.errorCode||{}));for(const x of Object.values(o))if(typeof x==='object')walk(x);};
 walk(body);
 return out.length?out.slice(0,12):null;
}
