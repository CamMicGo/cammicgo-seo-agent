import {createMcpHandler} from 'mcp-handler';
import {z} from 'zod';
import {NextRequest,NextResponse} from 'next/server';
import {makeCampaignDraft} from '@/lib/ads-campaign';
import {verifyMcpAccess} from '@/lib/mcp-access';
import {authorizedAccessToken,googleFetch} from '@/lib/google-session';
export const runtime='nodejs';
const asText=(value:unknown)=>({content:[{type:'text' as const,text:JSON.stringify(value)}]});
function unauthorized(){return NextResponse.json({error:'MCP access required',setup:'Connect Google at https://seo.cammicgo.com/connect and issue a scoped temporary token in your dashboard'},{status:401,headers:{'Cache-Control':'no-store','WWW-Authenticate':'Bearer realm="CamMicGo SEO Agent", resource_metadata="https://seo.cammicgo.com/.well-known/oauth-protected-resource"'}})}
async function handler(req:NextRequest){
 if(process.env.ENABLE_MCP_BETA!=='true'){
  // Anonymous discovery only; do not expose Google account tools without MCP OAuth.
  const publicMcp=createMcpHandler(server=>server.registerTool('service_info',{title:'CamMicGo SEO Agent server status',description:'Public status of remote MCP and secure connection requirements.',inputSchema:z.object({})},async()=>asText({name:'CamMicGo SEO Agent',remote:true,authenticatedTools:false,reason:'Google OAuth for remote MCP agents and shared durable quotas are not enabled.',localMcpSetup:'https://github.com/CamMicGo/cammicgo-seo-agent#local-mcp-server-read-only-preview'})));
  return publicMcp(req);
 }
 const ctx=verifyMcpAccess(req.headers.get('authorization'));if(!ctx)return unauthorized();
 const mcp=createMcpHandler(server=>{
  server.registerTool('service_info',{title:'CamMicGo SEO Agent',description:'Service capabilities and token lifetime.',inputSchema:z.object({})},async()=>asText({name:'CamMicGo SEO Agent',beta:true,expiresAt:new Date(ctx.expires).toISOString(),selectedSite:ctx.site||null,selectedGA4Property:ctx.property||null}));
  server.registerTool('prepare_ads_campaign',{title:'Prepare CamMicGo Google Ads campaign (no spending)',description:'Prepare a preview-only, paused Search campaign concept for CamMicGo, capped at 150 euros and 7 days. Does not call Google Ads or create advertisements.',inputSchema:z.object({totalBudgetEur:z.number().positive().max(150).default(150),durationDays:z.number().int().min(1).max(7).default(7),countries:z.array(z.enum(['US','FR','GB','DE','CA','JP','KR','AU','ES','IT','NL','BE'])).min(1).max(6).default(['US','FR','GB'])})},async args=>{try{return asText({draft:makeCampaignDraft(args),submittedToGoogle:false,requiresAdsOAuth:true,requiresHumanApproval:true})}catch(e){return asText({error:e instanceof Error?e.message:'Invalid request'})}});
  server.registerTool('list_selected_properties',{title:'Selected properties',description:'Show the specific Google site and Analytics property authorized by the user for this 15-minute session.',inputSchema:z.object({})},async()=>asText({site:ctx.site||null,property:ctx.property||null}));
  server.registerTool('seo_keyword_opportunities',{title:'SEO keyword opportunities',description:'Analyze the selected Search Console property and return ranked underperforming organic queries (high impressions, lower CTR, positions 4 to 20). These are real reporting rows, not Google Ads Keyword Planner estimates.',inputSchema:z.object({minImpressions:z.number().int().min(1).max(1000000).default(30),country:z.string().length(3).regex(/^[A-Z]{3}$/).optional()})},async args=>{
   if(!ctx.site)return asText({error:'Select an authorized Search Console site'});
   try{const {token}=await authorizedAccessToken(ctx.google);
    const sites=await googleFetch('https://www.googleapis.com/webmasters/v3/sites',token);
    if(!sites.ok)return asText({error:'Unable to verify site access'});const list=await sites.json();
    if(!(list.siteEntry||[]).some((x:{siteUrl:string})=>x.siteUrl===ctx.site))return asText({error:'Site permission revoked'});
    const end=new Date(Date.now()-3*86400000).toISOString().slice(0,10);
    const start=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
    const filters=args.country?[{filters:[{dimension:'country',operator:'equals',expression:args.country}]}]:undefined;
    const result=await googleFetch('https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(ctx.site)+'/searchAnalytics/query',token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({startDate:start,endDate:end,dimensions:['query'],rowLimit:300,dimensionFilterGroups:filters})});
    if(!result.ok)return asText({error:'Search Console report failed',status:result.status});
    const json=await result.json() as {rows?:Array<{keys:string[];clicks:number;impressions:number;ctr:number;position:number}>};
    const opportunities=(json.rows||[]).filter(r=>r.impressions>=args.minImpressions&&r.position>=4&&r.position<=20).sort((a,b)=>(b.impressions*(1-b.ctr))-(a.impressions*(1-a.ctr))).slice(0,25).map(r=>({keyword:r.keys[0],impressions:r.impressions,clicks:r.clicks,ctr:r.ctr,position:r.position,opportunityScore:Math.round(r.impressions*(1-r.ctr))}));
    return asText({site:ctx.site,startDate:start,endDate:end,opportunities,interpretation:'Heuristic prioritization, not a prediction of traffic or Keyword Planner volume; Search Console may omit some queries.'});
   }catch{return asText({error:'Could not retrieve keyword opportunities'})}
  });
  server.registerTool('search_performance',{title:'Search Console query performance',description:'Get clicks, impressions, CTR and average ranking position for the selected Search Console site over the last 28 completed days.',inputSchema:z.object({})},async()=>{
   if(!ctx.site)return asText({error:'No Search Console site selected'});
   try{const {token}=await authorizedAccessToken(ctx.google);const sites=await googleFetch('https://www.googleapis.com/webmasters/v3/sites',token);if(!sites.ok)return asText({error:'Unable to verify site access'});const list=await sites.json();if(!(list.siteEntry||[]).some((s:{siteUrl:string})=>s.siteUrl===ctx.site))return asText({error:'Site permission revoked'});
   const response=await googleFetch('https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(ctx.site)+'/searchAnalytics/query',token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({startDate:new Date(Date.now()-30*86400000).toISOString().slice(0,10),endDate:new Date(Date.now()-3*86400000).toISOString().slice(0,10),dimensions:['query'],rowLimit:40})});if(!response.ok)return asText({error:'Google Search Console request failed',status:response.status});const body=await response.json();return asText({site:ctx.site,rows:body.rows||[],disclaimer:'Average position is not a live ranking.'})}catch{return asText({error:'Google Search Console unavailable'})}
  });
  server.registerTool('ga4_countries',{title:'GA4 traffic by country',description:'Read top countries for the selected authorized GA4 property and provider quota; no write access.',inputSchema:z.object({days:z.number().int().min(1).max(90).default(28)})},async args=>{
   if(!ctx.property)return asText({error:'No GA4 property selected'});
   try{const {token}=await authorizedAccessToken(ctx.google);const r=await googleFetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=100',token);if(!r.ok)return asText({error:'Unable to verify Analytics property'});const accounts=await r.json();
    if(!(accounts.accountSummaries||[]).some((a:{propertySummaries?:Array<{property:string}>})=>(a.propertySummaries||[]).some(p=>p.property===ctx.property)))return asText({error:'GA4 access revoked'});
    const output=await googleFetch('https://analyticsdata.googleapis.com/v1beta/'+ctx.property+':runReport',token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dateRanges:[{startDate:(args.days-1)+'daysAgo',endDate:'yesterday'}],dimensions:[{name:'country'},{name:'countryId'}],metrics:[{name:'sessions'},{name:'activeUsers'}],limit:100,returnPropertyQuota:true,orderBys:[{metric:{metricName:'sessions'},desc:true}]})});
    if(!output.ok)return asText({error:'GA4 request failed',status:output.status});
    const body=await output.json();return asText({property:ctx.property,days:args.days,rows:body.rows||[],quota:body.propertyQuota||null});
   }catch{return asText({error:'GA4 report unavailable'})}
  });
  server.registerTool('ga4_top_pages',{title:'Google Analytics top pages',description:'Retrieve the 20 most viewed pages over the last 28 completed days for the selected GA4 property.',inputSchema:z.object({})},async()=>{
   if(!ctx.property)return asText({error:'No GA4 property selected'});
   try{const {token}=await authorizedAccessToken(ctx.google);const res=await googleFetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=100',token);if(!res.ok)return asText({error:'Unable to verify GA4 access'});const list=await res.json();if(!(list.accountSummaries||[]).some((a:{propertySummaries?:Array<{property:string}>})=>(a.propertySummaries||[]).some(p=>p.property===ctx.property)))return asText({error:'GA4 permission revoked'});const r=await googleFetch('https://analyticsdata.googleapis.com/v1beta/'+ctx.property+':runReport',token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dateRanges:[{startDate:'28daysAgo',endDate:'yesterday'}],dimensions:[{name:'pagePath'}],metrics:[{name:'screenPageViews'},{name:'activeUsers'}],limit:20,returnPropertyQuota:true,orderBys:[{metric:{metricName:'screenPageViews'},desc:true}]})});if(!r.ok)return asText({error:'GA4 request failed',status:r.status});const body=await r.json();return asText({property:ctx.property,rows:body.rows||[],googlePropertyQuota:body.propertyQuota||null})}catch{return asText({error:'GA4 request unavailable'})}
  });
 });
 return mcp(req);
}
export const GET=handler;
export const POST=handler;
