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
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execFileAsync=promisify(execFile);
import {McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {z} from 'zod';
import {fetchYouTubeCaptions} from '../lib/youtube-captions.mjs';
import * as sci from '../lib/science.mjs';

const dir=join(homedir(),'.cammicgo-seo-agent');
const secretsPath=join(dir,'google-token.enc');
const keyPath=join(dir,'token.key');
const scopes=['https://www.googleapis.com/auth/webmasters.readonly','https://www.googleapis.com/auth/analytics.readonly','https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/calendar.readonly'];
function prepare(){mkdirSync(dir,{recursive:true,mode:0o700});try{chmodSync(dir,0o700)}catch{}}
function env(){const path=resolve(dirname(fileURLToPath(import.meta.url)),'..','.env.local');if(existsSync(path)){for(const line of readFileSync(path,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]]){let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"')){try{v=JSON.parse(v)}catch{}}process.env[m[1]]=v}}}}
function credentials(){env();const clientId=process.env.GOOGLE_CLIENT_ID,clientSecret=process.env.GOOGLE_CLIENT_SECRET;if(!clientId?.endsWith('.apps.googleusercontent.com')||!clientSecret)throw Error('Configure your Google OAuth Desktop client via npm run install:local (or setup:local).');return {clientId,clientSecret}}
function getKey(){prepare();if(!existsSync(keyPath))writeFileSync(keyPath,randomBytes(32),{mode:0o600,flag:'wx'});return readFileSync(keyPath)}
function seal(data){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',getKey(),iv);const b=Buffer.concat([c.update(JSON.stringify(data)),c.final()]);prepare();writeFileSync(secretsPath,Buffer.concat([iv,c.getAuthTag(),b]),{mode:0o600});try{chmodSync(secretsPath,0o600)}catch{}}
function unseal(){if(!existsSync(secretsPath))throw Error('Not signed in. Run npm run local:login.');const b=readFileSync(secretsPath),d=createDecipheriv('aes-256-gcm',getKey(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString())}
async function token(){const t=unseal();if(Date.now()<t.expiresAt-60000)return t.accessToken;if(!t.refreshToken)throw Error('Google session expired. Run npm run local:login.');const {clientId,clientSecret}=credentials();const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:t.refreshToken,grant_type:'refresh_token'})});if(!r.ok)throw Error('Google refresh failed. Run npm run local:login.');const data=await r.json();seal({...t,accessToken:data.access_token,expiresAt:Date.now()+Number(data.expires_in||3600)*1000});return data.access_token}
async function google(url,opts){const r=await fetch(url,{...opts,headers:{...(opts?.headers||{}),Authorization:'Bearer '+await token()}});if(!r.ok)throw Error('Google API returned '+r.status+': '+(await r.text()).slice(0,280));return r.json()}
function openBrowser(url){const cmd=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];const child=spawn(cmd,args,{detached:true,stdio:'ignore'});child.on('error',()=>console.error('Open manually:',url));child.unref()}
async function login(){
 const {clientId,clientSecret}=credentials();const port=38271,callback='http://127.0.0.1:'+port+'/oauth/callback';
 console.log('Google OAuth: using local loopback callback '+callback+'. Desktop clients do not need a manually registered redirect URI.');
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
 // Google is optional: the science tools work without it, Google tools explain how to sign in when called.
 try{credentials();unseal();}catch(e){console.error('CamMicGo: Google tools unavailable until setup/login ('+e.message+'). Scientific tools work without Google.');}
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
 m.registerTool('youtube_get_transcript',{description:'Extract timestamped YouTube captions from this computer\'s own connection (no extra dependency; yt-dlp only as fallback). By default returns the video\'s original spoken language; translate it yourself for the user. Accepts a YouTube URL or video ID.',inputSchema:z.object({video:z.string().min(11).max(250),language:z.string().regex(/^(original|[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?)$/).default('original').describe('original (default) = the video\'s spoken language. Pass a code only if the user explicitly wants another language; YouTube translates it if no such track exists. Otherwise translate the original yourself.')})},async({video,language})=>{
  let target=language,originalLanguage;
  if(language==='original'){try{const id=(video.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/)||[])[1]||video;const v=await google('https://www.googleapis.com/youtube/v3/videos?part=snippet&id='+encodeURIComponent(id));const sn=v.items?.[0]?.snippet;originalLanguage=(sn?.defaultAudioLanguage||sn?.defaultLanguage||'').toLowerCase().split('-')[0]||undefined;if(originalLanguage)target=originalLanguage}catch{}}
  try{return asText({...await fetchYouTubeCaptions(video,target),source:'local-builtin',originalLanguage:originalLanguage??null})}
  catch(builtin){
   const script=resolve(dirname(fileURLToPath(import.meta.url)),'local-youtube-transcript.mjs');
   try{const {stdout}=await execFileAsync(process.execPath,[script,video,target==='original'?'en':target],{timeout:90000,maxBuffer:8*1024*1024,windowsHide:true});return asText(JSON.parse(stdout.trim()))}
   catch(error){return asText({error:'Local YouTube transcript extraction failed',builtin:{error:builtin.message,diagnostics:builtin.diagnostics??[]},fallback:String(error?.stderr||error?.message||error).slice(0,900),hint:'Check that the video is public and has captions (CC). If YouTube rate-limits this connection (HTTP 429), wait a few minutes.'})}
  }
 });
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
 // ---------- Scientific literature (no Google login needed). Keys stay on this computer (.env.local). ----------
 const sciKeys=()=>{env();const k={};if(process.env.SEMANTIC_SCHOLAR_API_KEY)k.semanticscholar=process.env.SEMANTIC_SCHOLAR_API_KEY.trim();if(process.env.OPENALEX_API_KEY)k.openalex=process.env.OPENALEX_API_KEY.trim();if(process.env.NCBI_API_KEY)k.pubmed=process.env.NCBI_API_KEY.trim();return k;};
 sci.setKeysHelp('.env.local of your CamMicGo folder (SEMANTIC_SCHOLAR_API_KEY, OPENALEX_API_KEY, NCBI_API_KEY), guide https://seo.cammicgo.com/setup/science');
 const srcEnum=z.array(z.enum(['openalex','semanticscholar','arxiv','pubmed','hal'])).min(1).max(5).optional();
 const sciSearch=async(query,o)=>{const keys=sciKeys();const sources=o.sources??sci.SOURCES;const q={query,sort:o.sort,from:o.from,to:o.to,openAccessOnly:o.openAccessOnly,limit:o.limit,offset:(o.page-1)*o.limit};
  const results=await Promise.all(sources.map(s=>sci.searchSource(s,q,keys)));const merged=sci.mergePapers(results.map(r=>r.papers),o.sort,query).slice(0,60);
  const missing=results.filter(r=>!r.usedKey&&sci.SOURCE_INFO[r.source].keyProvider).map(r=>sci.SOURCE_INFO[r.source].name);
  return {query,sort:o.sort,page:o.page,count:merged.length,papers:merged.map(p=>sci.compact(p,400)),sources:results.map(r=>({source:r.source,found:r.papers.length,total:r.total,usedYourKey:r.usedKey,error:r.error,note:r.note})),
   keyTip:missing.length?'No personal key for '+missing.join(', ')+': add free keys to .env.local (SEMANTIC_SCHOLAR_API_KEY, OPENALEX_API_KEY, NCBI_API_KEY) for your own quota. Guide: https://seo.cammicgo.com/setup/science':undefined};};
 m.registerTool('science_search',{description:'Search scientific papers across OpenAlex, Semantic Scholar, arXiv, PubMed and HAL (French open archive), duplicates merged; sort by relevance, date or citations. Uses your own keys from .env.local when present.',
  inputSchema:z.object({query:z.string().min(2).max(300),sources:srcEnum,sort:z.enum(['relevance','date','citations']).default('relevance'),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),openAccessOnly:z.boolean().default(false),limit:z.number().int().min(1).max(20).default(5),page:z.number().int().min(1).max(20).default(1)})},async a=>asText(await sciSearch(a.query,a)));
 m.registerTool('science_latest',{description:'Newest papers on a topic published in the last N days (default 30), from the five scientific sources, newest first.',
  inputSchema:z.object({topic:z.string().min(2).max(300),days:z.number().int().min(1).max(365).default(30),sources:srcEnum,openAccessOnly:z.boolean().default(false),limit:z.number().int().min(1).max(20).default(8)})},async a=>asText(await sciSearch(a.topic,{sources:a.sources,sort:'date',from:new Date(Date.now()-a.days*86400000).toISOString().slice(0,10),openAccessOnly:a.openAccessOnly,limit:a.limit,page:1})));
 m.registerTool('science_paper',{description:'Full details of a paper from its DOI, arXiv ID, PMID, OpenAlex ID, Semantic Scholar ID or HAL ID: abstract, TL;DR, citations, free PDF.',inputSchema:z.object({id:z.string().min(3).max(300)})},async a=>{
  const pid=sci.parsePaperId(a.id);if(!pid)return asText({error:'unknown_identifier'});const d=await sci.paperDetails(pid,sciKeys());
  return asText(d.paper?{paper:{...sci.compact(d.paper,20000),authors:d.paper.authors.slice(0,100)},notes:d.notes.length?d.notes:undefined}:{error:'not_found',notes:d.notes});});
 m.registerTool('science_author',{description:'Find a researcher (OpenAlex, Semantic Scholar fallback) and list the latest papers of the best match or of authorId.',inputSchema:z.object({name:z.string().min(2).max(120).optional(),authorId:z.string().regex(/^(A\d{4,12}|\d{1,12})$/i).optional(),latest:z.number().int().min(1).max(25).default(10)})},async a=>{
  if(!a.name&&!a.authorId)return asText({error:'Give a name or an authorId.'});const r=await sci.authorLookup(a,sciKeys());return asText({candidates:r.candidates,selectedAuthorId:r.selected,latestPapers:r.latest.map(p=>sci.compact(p,0)),notes:r.notes.length?r.notes:undefined});});
 m.registerTool('science_sources',{description:'Scientific sources, whether a personal key is set in .env.local for each, and the quota that applies.',inputSchema:z.object({})},async()=>{const keys=sciKeys();
  return asText({sources:sci.SOURCES.map(s=>{const i=sci.SOURCE_INFO[s];const has=!!(i.keyProvider&&keys[i.keyProvider]);return {source:i.name,keyNeeded:!!i.keyProvider,yourKey:i.keyProvider?has:null,limit:has?i.withKey:(i.keyProvider==='pubmed'?'3 requests/second for this computer':i.keyProvider==='openalex'?'about 100 searches/day for this computer (no key)':i.withoutKey),getAKey:i.keyUrl};}),
   envVariables:{SEMANTIC_SCHOLAR_API_KEY:!!keys.semanticscholar,OPENALEX_API_KEY:!!keys.openalex,NCBI_API_KEY:!!keys.pubmed},file:'.env.local (never committed, stays on this computer)',guide:'https://seo.cammicgo.com/setup/science'});});
 // ---------- Science v2 (local): exact author bibliographies with files written to ./exports, citations, full text, verification ----------
 const localExportDir=resolve(dirname(fileURLToPath(import.meta.url)),'..','exports');
 const profileOut=p=>({openAlexId:p.id,name:p.name,orcid:p.orcid,institution:p.institution,works:p.works,citations:p.citations,hIndex:p.hIndex,topics:p.topics,url:p.url});
 m.registerTool('science_author_works',{description:'ALL publications of one researcher by identity (OpenAlex ID A…, ORCID, Semantic Scholar ID, or a name that matches exactly one profile), OpenAlex + HAL (by ORCID), versions de-duplicated, sorted. exportFormat writes the complete list to a file in the exports folder of CamMicGo (bibtex, ris, csv, markdown, csljson).',
  inputSchema:z.object({author:z.string().min(2).max(200),extraAuthorIds:z.array(z.string().regex(/^A\d{4,12}$/i)).max(4).optional(),sort:z.enum(['newest','oldest','citations','title']).default('newest'),from:z.string().regex(/^\d{4}(-\d{2}-\d{2})?$/).optional(),to:z.string().regex(/^\d{4}(-\d{2}-\d{2})?$/).optional(),topic:z.string().max(200).optional(),includeHal:z.boolean().default(true),page:z.number().int().min(1).max(100).default(1),pageSize:z.number().int().min(5).max(200).default(50),exportFormat:z.enum(['bibtex','ris','csv','markdown','csljson']).optional()})},async a=>{
  const keys=sciKeys();const res=await sci.resolveAuthor(a.author,a.extraAuthorIds??[],keys);
  if(res.status!=='resolved')return asText({status:res.status,candidates:res.candidates.map(profileOut),notes:res.notes,instructions:'Ask the user which researcher they mean, then call again with the OpenAlex ID or ORCID.'});
  const b=await sci.authorBibliography(res.profiles,keys,{from:a.from,to:a.to,query:a.topic,includeHal:a.includeHal});
  const all=sci.sortWorks(b.works,a.sort);let file;
  if(a.exportFormat){mkdirSync(localExportDir,{recursive:true});const fmt=sci.EXPORT_FORMATS[a.exportFormat];
   file=join(localExportDir,res.profiles[0].name.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]+/g,'-').toLowerCase()+'-publications.'+fmt.ext);
   writeFileSync(file,sci.renderExport(a.exportFormat,all,'Publications — '+res.profiles[0].name));}
  return asText({author:profileOut(res.profiles[0]),mergedProfiles:res.profiles.length>1?res.profiles.slice(1).map(profileOut):undefined,counts:{openAlexRecords:b.openAlexTotal,halRecords:b.halCount,afterDeduplication:all.length,duplicatesMerged:b.rawCount-all.length,onlyInHal:b.halOnly},
   summary:sci.worksSummary(all),page:a.page,pages:Math.max(1,Math.ceil(all.length/a.pageSize)),works:all.slice((a.page-1)*a.pageSize,a.page*a.pageSize).map(sci.compactWork),exportFile:file,notes:b.notes.length?b.notes:undefined});
 });
 m.registerTool('science_citations',{description:'Papers citing a paper (cited_by, newest or most cited first) or its reference list (references), from the OpenAlex citation index.',
  inputSchema:z.object({id:z.string().min(3).max(300),direction:z.enum(['cited_by','references']).default('cited_by'),sort:z.enum(['newest','citations']).default('newest'),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),page:z.number().int().min(1).max(50).default(1),pageSize:z.number().int().min(5).max(100).default(25)})},async a=>{
  const pid=sci.parsePaperId(a.id);if(!pid)return asText({error:'unknown_identifier'});const keys=sciKeys();const {work,note}=await sci.openAlexWork(pid,keys);if(!work)return asText({error:'not_found',note});
  const target=sci.parseBibWork(work);
  if(a.direction==='cited_by'){const r=await sci.citedBy(target.id,keys,{sort:a.sort,page:a.page,perPage:a.pageSize,from:a.from});return asText({paper:sci.compactWork(target),totalCitingPapers:r.total,works:r.works.map(sci.compactWork),error:r.error});}
  const refs=await sci.referencesOf(work.referenced_works??[],keys);const all=sci.sortWorks(refs.works,a.sort);
  return asText({paper:sci.compactWork(target),totalReferences:(work.referenced_works??[]).length,works:all.slice((a.page-1)*a.pageSize,a.page*a.pageSize).map(sci.compactWork),error:refs.error});
 });
 m.registerTool('science_verify_references',{description:'Checks up to 25 references (free text or DOIs) against OpenAlex and Crossref: verified, probable, mismatch (identifier of another paper), not found or retracted, with the correct DOI.',
  inputSchema:z.object({references:z.array(z.string().min(5).max(1000)).min(1).max(25)})},async a=>{
  const keys=sciKeys();const out=[];for(let i=0;i<a.references.length;i+=5)out.push(...await Promise.all(a.references.slice(i,i+5).map(r=>sci.verifyReference(r,keys).catch(()=>({input:r,status:'not_found',note:'check failed'})))));
  const count=x=>out.filter(v=>v.status===x).length;return asText({summary:{verified:count('verified'),probable:count('probable'),mismatch:count('mismatch'),notFound:count('not_found'),retracted:count('retracted')},results:out});
 });
 const localText=new Map();
 m.registerTool('science_fulltext',{description:'Legal open-access full text of a paper (Europe PMC, arXiv, HAL, OpenAlex/Unpaywall PDFs), downloaded by this computer and returned in windows (continue with offset=nextOffset).',
  inputSchema:z.object({id:z.string().min(3).max(300),offset:z.number().int().min(0).default(0),maxChars:z.number().int().min(2000).max(30000).default(20000)})},async a=>{
  const pid=sci.parsePaperId(a.id);if(!pid)return asText({error:'unknown_identifier'});const k=pid.kind+':'+pid.value.toLowerCase();let hit=localText.get(k);
  if(!hit){const loc=await sci.openAccessCandidates(pid,sciKeys());if(!loc.candidates.length)return asText({error:'no_open_access_copy',title:loc.title,doi:loc.doi});
   for(const c of loc.candidates){try{const url=c.url.replace(/^http:/,'https:');if(!url.startsWith('https://'))continue;const r=await fetch(url,{headers:{'User-Agent':'CamMicGo-SEO-MCP/1.0 (+https://seo.cammicgo.com)'},signal:AbortSignal.timeout(30000)});if(!r.ok)continue;
    const buf=Buffer.from(await r.arrayBuffer());if(buf.length>25*1024*1024)continue;let text;
    if(c.kind==='jats')text=sci.jatsToText(buf.toString('utf8'));else if((r.headers.get('content-type')||'').includes('html'))text=buf.toString('utf8').replace(/<(script|style)[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ').replace(/[ \t]+/g,' ');
    else{const {extractText,getDocumentProxy}=await import('unpdf');const pdf=await getDocumentProxy(new Uint8Array(buf));const o=await extractText(pdf,{mergePages:false});text=o.text.map((p,i)=>'[page '+(i+1)+']\n'+p.trim()).join('\n\n');}
    if(text.replace(/\[page \d+\]/g,'').trim().length<500)continue;hit={text,source:c.source,url,title:loc.title};localText.set(k,hit);break;}catch{}}
   if(!hit)return asText({error:'open_access_copy_unreadable',links:loc.candidates.map(c=>c.url)});}
  const start=Math.min(a.offset,hit.text.length),end=Math.min(hit.text.length,start+a.maxChars);
  return asText({title:hit.title,source:hit.source,url:hit.url,text:hit.text.slice(start,end),offset:start,totalChars:hit.text.length,nextOffset:end<hit.text.length?end:null});
 });
 m.registerTool('service_info',{description:'Show local MCP capabilities and security limits',inputSchema:z.object({})},async()=>asText({name:'CamMicGo SEO MCP Local',mode:'stdio',remoteDependency:false,googleCloudProject:process.env.GOOGLE_CLOUD_PROJECT||null,credentials:'your own Google OAuth Desktop client, stored only on this computer (.env.local); nothing is sent to CamMicGo',googleReadOnly:true,tools:['science_search','science_latest','science_paper','science_author','science_author_works','science_citations','science_fulltext','science_verify_references','science_sources','find_google_properties','list_search_sites','search_performance','seo_keyword_opportunities','list_ga4_properties','ga4_top_pages','ga4_countries','youtube_my_channels','youtube_my_videos','youtube_video_metrics','youtube_get_transcript','calendar_list','calendar_upcoming_events'],adsCampaignWrites:false,calendar:true,youtube:true}));
 await m.connect(new StdioServerTransport());
}
async function doctor(){env();console.log('Science keys (.env.local): Semantic Scholar '+(process.env.SEMANTIC_SCHOLAR_API_KEY?'set':'not set (shared public pool)')+', OpenAlex '+(process.env.OPENALEX_API_KEY?'set':'not set (small daily quota)')+', NCBI/PubMed '+(process.env.NCBI_API_KEY?'set (10 req/s)':'not set (3 req/s)')+'; arXiv and HAL need no key.');const c=credentials();console.log('Google OAuth credentials: configured (client '+c.clientId.slice(0,12)+'…'+(process.env.GOOGLE_CLOUD_PROJECT?', project '+process.env.GOOGLE_CLOUD_PROJECT:'')+', stored only on this computer)');if(existsSync(secretsPath)){await token();console.log('Encrypted Google token: valid');}else console.log('Encrypted Google token: missing; run npm run local:login');console.log('This local MCP supports read-only GSC, GA4, YouTube and Calendar, plus local YouTube captions (built-in fetcher, yt-dlp optional fallback); no ads spending. If you previously signed in, run npm run local:login to grant new scopes.')}
try{const cmd=process.argv[2];if(cmd==='login')await login();else if(cmd==='stdio')await stdio();else if(cmd==='doctor')await doctor();else{console.error('Usage: node scripts/local-mcp.mjs login|stdio|doctor');process.exitCode=2}}catch(e){console.error('CamMicGo:',e.message);process.exitCode=1}
