#!/usr/bin/env node
/**
 * Local read-only Google MCP, independent of CamMicGo Vercel/Supabase.
 * Commands: login | stdio | doctor.
 * Credentials are encrypted on disk using a local key. This is not OS keychain storage.
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync,chmodSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {createServer} from 'node:http';
import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {spawn} from 'node:child_process';
import {McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {z} from 'zod';

const dir=join(homedir(),'.cammicgo-seo-agent');
const secretsPath=join(dir,'google-token.enc');
const keyPath=join(dir,'token.key');
const scopes=['https://www.googleapis.com/auth/webmasters.readonly','https://www.googleapis.com/auth/analytics.readonly','https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/calendar.readonly'];
function prepare(){mkdirSync(dir,{recursive:true,mode:0o700});try{chmodSync(dir,0o700)}catch{}}
function env(){const path=resolve(dirname(fileURLToPath(import.meta.url)),'..','.env.local');if(existsSync(path)){for(const line of readFileSync(path,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]]){let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"')){try{v=JSON.parse(v)}catch{}}process.env[m[1]]=v}}}}
function credentials(){env();const clientId=process.env.GOOGLE_CLIENT_ID,clientSecret=process.env.GOOGLE_CLIENT_SECRET;if(!clientId?.endsWith('.apps.googleusercontent.com')||!clientSecret)throw Error('Use npm run setup:local first to configure your own Google OAuth web client.');return {clientId,clientSecret}}
function getKey(){prepare();if(!existsSync(keyPath))writeFileSync(keyPath,randomBytes(32),{mode:0o600,flag:'wx'});return readFileSync(keyPath)}
function seal(data){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',getKey(),iv);const b=Buffer.concat([c.update(JSON.stringify(data)),c.final()]);prepare();writeFileSync(secretsPath,Buffer.concat([iv,c.getAuthTag(),b]),{mode:0o600});try{chmodSync(secretsPath,0o600)}catch{}}
function unseal(){if(!existsSync(secretsPath))throw Error('Not signed in. Run npm run local:login.');const b=readFileSync(secretsPath),d=createDecipheriv('aes-256-gcm',getKey(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString())}
async function token(){const t=unseal();if(Date.now()<t.expiresAt-60000)return t.accessToken;if(!t.refreshToken)throw Error('Google session expired. Run npm run local:login.');const {clientId,clientSecret}=credentials();const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:t.refreshToken,grant_type:'refresh_token'})});if(!r.ok)throw Error('Google refresh failed. Run npm run local:login.');const data=await r.json();seal({...t,accessToken:data.access_token,expiresAt:Date.now()+Number(data.expires_in||3600)*1000});return data.access_token}
async function google(url,opts){const r=await fetch(url,{...opts,headers:{...(opts?.headers||{}),Authorization:'Bearer '+await token()}});if(!r.ok)throw Error('Google API returned '+r.status+': '+(await r.text()).slice(0,280));return r.json()}
function openBrowser(url){const cmd=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];const child=spawn(cmd,args,{detached:true,stdio:'ignore'});child.on('error',()=>console.error('Open manually:',url));child.unref()}
async function login(){
 const {clientId,clientSecret}=credentials();const port=38271,callback='http://127.0.0.1:'+port+'/oauth/callback';
 console.log('In Google Cloud OAuth Web client, register EXACT authorized redirect URI:',callback);
 console.log('Your account must be a test user while the consent screen is in Testing.');
 const state=randomBytes(24).toString('base64url'),verifier=randomBytes(32).toString('base64url');
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:'code',scope:scopes.join(' '),access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
 await new Promise((resolve,reject)=>{
  const server=createServer(async(req,res)=>{
   const input=new URL(req.url||'/',callback);
   if(input.pathname!=='/oauth/callback'){res.writeHead(404).end();return}
   if(input.searchParams.get('state')!==state||!input.searchParams.get('code')){res.writeHead(400).end('Invalid OAuth state or code');server.close();reject(Error('Invalid Google OAuth response'));return}
   try{const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:input.searchParams.get('code'),client_id:clientId,client_secret:clientSecret,redirect_uri:callback,code_verifier:verifier,grant_type:'authorization_code'})});if(!r.ok)throw Error('Token exchange failed: '+r.status);const t=await r.json();if(!t.access_token)throw Error('Google did not issue an access token');seal({accessToken:t.access_token,refreshToken:t.refresh_token,expiresAt:Date.now()+Number(t.expires_in||3600)*1000});res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'}).end('CamMicGo Google connection complete. Return to the terminal.');server.close();resolve()}catch(e){res.writeHead(500).end('Google OAuth failed');server.close();reject(e)}
  });
  const timeout=setTimeout(()=>{server.close();reject(Error('Google login timeout'))},120000);timeout.unref();
  server.on('close',()=>clearTimeout(timeout));server.once('error',reject);server.listen(port,'127.0.0.1',()=>{console.log('Opening Google sign-in in your browser...');openBrowser(url.toString());console.log('If it does not open, copy this URL:',url.toString())});
 });
 console.log('Google account connected locally. Encrypted token file:',secretsPath);
}
const asText=x=>({content:[{type:'text',text:JSON.stringify(x)}]});
async function stdio(){
 credentials();unseal();
 const m=new McpServer({name:'cammicgo-seo-local',version:'0.1.0'});
 m.registerTool('list_search_sites',{description:'List Google Search Console properties accessible to this local Google account',inputSchema:z.object({})},async()=>asText(await google('https://www.googleapis.com/webmasters/v3/sites')));
 m.registerTool('search_performance',{description:'Read Search Console queries for an authorized site; 28 settled days',inputSchema:z.object({site:z.string().min(1).max(500)})},async({site})=>{
  const all=await google('https://www.googleapis.com/webmasters/v3/sites');if(!(all.siteEntry||[]).some(x=>x.siteUrl===site))return asText({error:'Site is not authorized for this Google account'});
  const end=new Date(Date.now()-3*86400000),start=new Date(end.getTime()-27*86400000);
  return asText(await google('https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(site)+'/searchAnalytics/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10),dimensions:['query'],rowLimit:100})}))
 });
 m.registerTool('list_ga4_properties',{description:'List Google Analytics properties accessible to this Google account',inputSchema:z.object({})},async()=>asText(await google('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200')));
 m.registerTool('ga4_top_pages',{description:'Read most viewed pages over 28 days for an authorized GA4 property',inputSchema:z.object({property:z.string().regex(/^properties\/\d+$/)})},async({property})=>{
  const all=await google('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200');
  if(!(all.accountSummaries||[]).some(x=>(x.propertySummaries||[]).some(p=>p.property===property)))return asText({error:'Property not authorized'});
  return asText(await google('https://analyticsdata.googleapis.com/v1beta/'+property+':runReport',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dateRanges:[{startDate:'28daysAgo',endDate:'yesterday'}],dimensions:[{name:'pagePath'}],metrics:[{name:'screenPageViews'},{name:'activeUsers'}],limit:20,returnPropertyQuota:true})}))
 });
 m.registerTool('seo_keyword_opportunities',{description:'Read 28-day Search Console opportunity queries from an authorized site (not Google Ads Keyword Planner volume)',inputSchema:z.object({site:z.string().min(1).max(500),minImpressions:z.number().int().min(1).max(1000000).default(30)})},async({site,minImpressions})=>{
  const all=await google('https://www.googleapis.com/webmasters/v3/sites');if(!(all.siteEntry||[]).some(x=>x.siteUrl===site))return asText({error:'Site is not authorized'});
  const end=new Date(Date.now()-3*86400000),start=new Date(end.getTime()-27*86400000);
  const data=await google('https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(site)+'/searchAnalytics/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10),dimensions:['query'],rowLimit:300})});
  const rows=(data.rows||[]).filter(r=>r.impressions>=minImpressions&&r.position>=4&&r.position<=20).sort((a,b)=>b.impressions*(1-b.ctr)-a.impressions*(1-a.ctr)).slice(0,25);
  return asText({site,rows,note:'Organic Search Console heuristic; not paid keyword search volume or a traffic forecast'})
 });
 m.registerTool('ga4_countries',{description:'Read 28-day GA4 country sessions for an authorized property',inputSchema:z.object({property:z.string().regex(new RegExp('^properties/[0-9]+$'))})},async({property})=>{
  const all=await google('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200');
  if(!(all.accountSummaries||[]).some(x=>(x.propertySummaries||[]).some(p=>p.property===property)))return asText({error:'Property not authorized'});
  return asText(await google('https://analyticsdata.googleapis.com/v1beta/'+property+':runReport',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dateRanges:[{startDate:'28daysAgo',endDate:'yesterday'}],dimensions:[{name:'country'},{name:'countryId'}],metrics:[{name:'sessions'},{name:'activeUsers'}],limit:100,returnPropertyQuota:true})}))
 });
 m.registerTool('youtube_my_channels',{description:'List channels owned by the signed-in YouTube account (read-only)',inputSchema:z.object({})},async()=>asText(await google('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true&maxResults=50')));
 m.registerTool('youtube_my_videos',{description:'List videos from your own YouTube channel uploads playlist (read-only)',inputSchema:z.object({maxResults:z.number().int().min(1).max(50).default(20)})},async({maxResults})=>{
  const channels=await google('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true');
  const playlist=channels.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;if(!playlist)return asText({items:[],note:'No channel/uploads playlist available'});
  return asText(await google('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId='+encodeURIComponent(playlist)+'&maxResults='+maxResults));
 });
 m.registerTool('youtube_video_metrics',{description:'Public video statistics for a video ID (not private YouTube Analytics reports)',inputSchema:z.object({videoId:z.string().regex(/^[a-zA-Z0-9_-]{11}$/)})},async({videoId})=>asText(await google('https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id='+encodeURIComponent(videoId))));
 m.registerTool('calendar_list',{description:'List calendars visible to the signed-in user (read-only)',inputSchema:z.object({})},async()=>asText(await google('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=100')));
 m.registerTool('calendar_upcoming_events',{description:'List upcoming calendar events (read-only, no modification)',inputSchema:z.object({calendarId:z.string().min(1).max(250).default('primary'),maxResults:z.number().int().min(1).max(100).default(20)})},async({calendarId,maxResults})=>{
  const calendars=await google('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250');
  if(!(calendars.items||[]).some(c=>c.id===calendarId)&&calendarId!=='primary')return asText({error:'Calendar not accessible'});
  return asText(await google('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calendarId)+'/events?singleEvents=true&orderBy=startTime&timeMin='+encodeURIComponent(new Date().toISOString())+'&maxResults='+maxResults));
 });
 m.registerTool('find_google_properties',{description:'Resolve a user-mentioned website or brand to authorized Search Console sites and GA4 properties. If there are multiple matches, ask the user to choose an exact site/property; never guess. Use returned exact identifiers in subsequent tools.',inputSchema:z.object({search:z.string().min(2).max(200)})},async({search})=>{
  const [sites,analytics]=await Promise.allSettled([google('https://www.googleapis.com/webmasters/v3/sites'),google('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200')]);
  const q=search.toLocaleLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'').trim();
  const allSites=sites.status==='fulfilled'?(sites.value.siteEntry||[]):[];
  const allProperties=analytics.status==='fulfilled'?(analytics.value.accountSummaries||[]).flatMap(a=>a.propertySummaries||[]):[];
  const matchingSites=allSites.filter(s=>s.siteUrl.toLowerCase().includes(q)).map(s=>({siteUrl:s.siteUrl,permissionLevel:s.permissionLevel}));
  const matchingProperties=allProperties.filter(p=>(p.displayName||'').toLowerCase().includes(q)||p.property.toLowerCase().includes(q)).map(p=>({property:p.property,displayName:p.displayName}));
  const matches=matchingSites.length+matchingProperties.length;
  return asText({query:search,searchConsole:matchingSites,analytics:matchingProperties,ambiguous:matchingSites.length>1||matchingProperties.length>1,note:matches===0?'No matching authorized properties. Ask the user for the exact domain or Google account.':matches>2?'Several properties match. Ask user to select exact identifiers and never infer GA4/Search Console pairing.':'Use the exact siteUrl/property from these results. A GA4 property and a Search Console site are NOT automatically linked.'});
 });
 m.registerTool('service_info',{description:'Show local MCP capabilities and security limits',inputSchema:z.object({})},async()=>asText({name:'CamMicGo SEO Agent Local',mode:'stdio',remoteDependency:false,googleReadOnly:true,tools:['find_google_properties','list_search_sites','search_performance','seo_keyword_opportunities','list_ga4_properties','ga4_top_pages','ga4_countries','youtube_my_channels','youtube_my_videos','youtube_video_metrics','calendar_list','calendar_upcoming_events'],adsCampaignWrites:false,calendar:true,youtube:true}));
 await m.connect(new StdioServerTransport());
}
async function doctor(){credentials();console.log('Google OAuth credentials: configured');if(existsSync(secretsPath)){await token();console.log('Encrypted Google token: valid');}else console.log('Encrypted Google token: missing; run npm run local:login');console.log('This local MCP supports read-only GSC, GA4, YouTube and Calendar; no ads spending. If you previously signed in, run npm run local:login to grant new scopes.')}
try{const cmd=process.argv[2];if(cmd==='login')await login();else if(cmd==='stdio')await stdio();else if(cmd==='doctor')await doctor();else{console.error('Usage: node scripts/local-mcp.mjs login|stdio|doctor');process.exitCode=2}}catch(e){console.error('CamMicGo:',e.message);process.exitCode=1}
