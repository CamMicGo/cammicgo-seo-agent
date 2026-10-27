export type CampaignDraft={name:string;landingUrl:string;totalBudgetEur:number;durationDays:number;countries:string[];languages:string[];keywords:string[];headlines:string[];descriptions:string[];dailyBudgetEur:number;status:'PAUSED';network:'SEARCH';mode:'PREVIEW_ONLY';budgetType:'CAMPAIGN_TOTAL';totalBudgetMicros:number};
export type DraftInput={name?:string;landingUrl?:string;totalBudgetEur?:number;durationDays?:number;countries?:string[];languages?:string[];keywords?:string[]};
const allowedCountries=new Set(['FR','US','GB','DE','CA','JP','KR','AU','ES','IT','NL','BE']);
export function makeCampaignDraft(input:DraftInput):CampaignDraft{
 const total=Number(input.totalBudgetEur??150),days=Number(input.durationDays??7);
 if(!Number.isFinite(total)||total<=0||total>150||!Number.isInteger(days)||days<1||days>7)throw new Error('Campaign preview is limited to €150 total and seven days');
 const url=new URL(input.landingUrl||'https://www.cammicgo.com/');
 if(url.protocol!=='https:'||!['cammicgo.com','www.cammicgo.com'].includes(url.hostname)||url.username||url.password)throw new Error('This beta only prepares campaigns for CamMicGo');
 const countries=Array.isArray(input.countries)?[...new Set(input.countries)]:['US','FR','GB'];
 if(!countries.length||countries.length>6||countries.some(c=>!allowedCountries.has(c)))throw new Error('Unsupported target country');
 const keywords=(input.keywords?.length?input.keywords:['webcam test','test microphone online','headphone test']).slice(0,15).map(x=>x.trim().slice(0,80)).filter(Boolean);
 return {name:(input.name||'CamMicGo Webcam & Microphone Test').slice(0,100),landingUrl:url.toString(),totalBudgetEur:total,durationDays:days,countries,languages:(input.languages?.length?input.languages:['en','fr']).slice(0,6),keywords,headlines:['Test Your Webcam Online','Free Microphone Test','Check Camera & Audio Now'],descriptions:['Test your webcam, mic and headphones online with CamMicGo.','Check your devices before your next meeting.'],dailyBudgetEur:Math.floor(total/days*100)/100,budgetType:'CAMPAIGN_TOTAL',totalBudgetMicros:Math.round(total*1000000),status:'PAUSED',network:'SEARCH',mode:'PREVIEW_ONLY'};
}
