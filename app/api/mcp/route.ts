import {createMcpHandler} from 'mcp-handler';
import {z} from 'zod';
import {NextRequest,NextResponse} from 'next/server';
import {verifyMcpAccess} from '@/lib/mcp-access';
import {authorizedAccessToken,googleFetch} from '@/lib/google-session';
export const runtime='nodejs';
const asText=(value:unknown)=>({content:[{type:'text' as const,text:JSON.stringify(value)}]});
function unauthorized(){return NextResponse.json({error:'MCP access required',setup:'Connect Google at https://seo.cammicgo.com/connect and issue a scoped temporary token in your dashboard'},{status:401,headers:{'Cache-Control':'no-store','WWW-Authenticate':'Bearer realm="CamMicGo SEO Agent beta"'}})}
async function handler(req:NextRequest){
 if(process.env.ENABLE_MCP_BETA!=='true')return NextResponse.json({error:'Private MCP beta is not enabled yet'},{status:503});
 const ctx=verifyMcpAccess(req.headers.get('authorization'));if(!ctx)return unauthorized();
 const mcp=createMcpHandler(server=>{
  server.registerTool('service_info',{title:'CamMicGo SEO Agent',description:'Service capabilities and token lifetime.',inputSchema:z.object({})},async()=>asText({name:'CamMicGo SEO Agent',beta:true,expiresAt:new Date(ctx.expires).toISOString(),selectedSite:ctx.site||null,selectedGA4Property:ctx.property||null}));
  server.registerTool('list_selected_properties',{title:'Selected properties',description:'Show the specific Google site and Analytics property authorized by the user for this 15-minute session.',inputSchema:z.object({})},async()=>asText({site:ctx.site||null,property:ctx.property||null}));
  server.registerTool('search_performance',{title:'Search Console query performance',description:'Get clicks, impressions, CTR and average ranking position for the selected Search Console site over the last 28 completed days.',inputSchema:z.object({})},async()=>{
   if(!ctx.site)return asText({error:'No Search Console site selected'});
   try{const {token}=await authorizedAccessToken(ctx.google);const sites=await googleFetch('https://www.googleapis.com/webmasters/v3/sites',token);if(!sites.ok)return asText({error:'Unable to verify site access'});const list=await sites.json();if(!(list.siteEntry||[]).some((s:{siteUrl:string})=>s.siteUrl===ctx.site))return asText({error:'Site permission revoked'});
   const response=await googleFetch('https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(ctx.site)+'/searchAnalytics/query',token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({startDate:new Date(Date.now()-30*86400000).toISOString().slice(0,10),endDate:new Date(Date.now()-3*86400000).toISOString().slice(0,10),dimensions:['query'],rowLimit:40})});if(!response.ok)return asText({error:'Google Search Console request failed',status:response.status});const body=await response.json();return asText({site:ctx.site,rows:body.rows||[],disclaimer:'Average position is not a live ranking.'})}catch{return asText({error:'Google Search Console unavailable'})}
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
