import {createMcpHandler} from 'mcp-handler';
import {z} from 'zod';
import {NextRequest,NextResponse} from 'next/server';
import {makeCampaignDraft} from '@/lib/ads-campaign';
import {gumCatalog} from '@/lib/gum-operation-catalog';
import {getYouTubeTranscript} from '@/lib/youtube-transcript';
import {verifyMcpAccess} from '@/lib/mcp-access';
import {authorizedAccessToken,googleFetch} from '@/lib/google-session';
export const runtime='nodejs';
export const maxDuration=60;
const REAUTH_URL='https://seo.cammicgo.com/oauth/consent?reauth=google';
const SERVER_INSTRUCTIONS=[
 'CamMicGo SEO MCP: read-only Google Search Console, GA4, YouTube Data API and Calendar for the signed-in user, plus YouTube transcripts.',
 'YouTube transcripts: YouTube blocks cloud servers, so transcripts are fetched by the user\'s own device running the CamMicGo app (Android phone, or the desktop app on Windows/macOS/Linux) paired to this account.',
 'Pairing: when the user asks to pair/link/connect the app ("code d\'appairage", "appairer", "pairing code"), call device_pairing_code and show the code exactly, with messageForUser translated into the user\'s language. youtube_get_transcript also returns a pairingCode by itself when no device is reachable.',
 'Always remind the user to keep the app open in "Mode connecté" and the device awake while you fetch transcripts.',
 'youtube_get_transcript returns the original spoken language by default (compact [mm:ss] text): translate it yourself. To find a person\'s main channel use youtube_find_channels; several channels can share a name, ask the user if unsure.',
 'Google tools use the user\'s own Google Cloud project (OAuth client ID and secret saved at https://seo.cammicgo.com/account, then "Connect Google"). If a tool answers google_not_connected, relay its messageForUser. Each user has a daily CamMicGo allowance (about 100 tool calls; status checks are free): prefer one youtube_channel_batch over many single transcript calls.',
 'Whole channels: youtube_channel_batch builds ONE document (details + full transcripts of every video) with a stable URL, ideal as a single NotebookLM source; follow it with youtube_batch_status. Never paste whole documents into the chat.',
].join(' ');

const asText=(value:unknown)=>({content:[{type:'text' as const,text:JSON.stringify(value)}]});
function unauthorized(){return NextResponse.json({error:'invalid_token',error_description:'OAuth authorization required. Sign in through Supabase OAuth to access this MCP server.'},{status:401,headers:{'Cache-Control':'no-store','WWW-Authenticate':'Bearer realm="CamMicGo SEO MCP", resource_metadata="https://seo.cammicgo.com/.well-known/oauth-protected-resource/api/mcp"'}})}
async function handler(req:NextRequest){
 if(process.env.ENABLE_SUPABASE_MCP_AUTH==='true'){
  const {verifySupabaseMcpUser}=await import('@/lib/supabase-mcp-auth');
  const user=await verifySupabaseMcpUser(req.headers.get('authorization'));
  if(!user)return unauthorized();
  const store=await import('@/lib/mcp-google-store');
  const consumeQuota=store.consumeQuota;
  const account=await import('@/lib/account');
  const admin=await account.isAdmin(user.id).catch(()=>false);
  // External users must use their own Google Cloud project: a shared-project connection only counts for administrators.
  const readGoogle=async(id:string)=>{const s=await store.readGoogle(id);return s&&(admin||s.credentials.mode==='byo')?s:null;};
  const CONNECT_GOOGLE={error:'google_not_connected',setupUrl:account.ACCOUNT_URL,
   messageForUser:'Connect your Google account with your own Google Cloud project first: open '+account.ACCOUNT_URL+' , sign in with your email, paste your OAuth client ID and secret, then click "Connect Google". The guide is at https://seo.cammicgo.com/setup/google-cloud .',
   instructions:'Relay messageForUser to the user in their language with the link.'};
  // Per-user MCP allowance, checked before the tool runs (protects the free hosting).
  const rpc=await req.clone().json().catch(()=>null) as {id?:unknown;method?:string;params?:{name?:string}}|null;
  if(rpc&&!Array.isArray(rpc)&&rpc.method==='tools/call'&&typeof rpc.params?.name==='string'){
   const used=await account.consumeCall(user.id,rpc.params.name,admin).catch(()=>({ok:true,reason:null,used:0,limit:0}));
   if(!used.ok){
    const message=used.reason==='minute'?'Too many requests in one minute ('+account.LIMITS.minuteCostly+' max). Wait one minute, then continue.'
     :used.reason==='global'?'CamMicGo is very busy today: the shared daily capacity is reached. Try again tomorrow.'
     :'Daily allowance reached: '+used.used+' / '+used.limit+' CamMicGo calls today. It resets at midnight UTC. Usage: '+account.ACCOUNT_URL;
    return NextResponse.json({jsonrpc:'2.0',id:rpc.id??null,result:{isError:true,content:[{type:'text',text:JSON.stringify({error:'quota_exceeded',reason:used.reason,used:used.used,limit:used.limit,messageForUser:message})}]}},{headers:{'Cache-Control':'no-store'}});
   }
  }
  const relay=await import('@/lib/device-relay');
  const quotaLimit=(_session:{credentials:{mode:string}})=>2000; // Google API safety cap; the user-facing allowance is counted per MCP call
  const protectedMcp=createMcpHandler(server=>{
   server.registerTool('service_info',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Authenticated MCP status',description:'Check connected Google account.',inputSchema:z.object({})},async()=>{const session=await readGoogle(user.id);let devices:Array<{name:string;online:boolean}>|string=[];try{devices=(await relay.listDevices(user.id)).map(d=>({name:d.name,online:relay.isOnline(d)}))}catch(e){devices=e instanceof Error?e.message:'unavailable'}const usage=await account.usageToday(user.id,admin).catch(()=>null);return asText({authenticated:true,administrator:admin,camMicGoUsageToday:usage?{used:usage.used,limit:usage.limit,perMinute:usage.perMinute,resetsAt:usage.resetsAt,details:account.ACCOUNT_URL}:null,googleConnected:!!session,...(session?{}:{connectGoogle:CONNECT_GOOGLE.messageForUser}),googleQuota:session?(session.credentials.mode==='byo'?'own Google Cloud project':'shared CamMicGo project'):null,googleScopes:session?.scopes?session.scopes.filter(x=>x.includes('googleapis.com/auth/')).map(x=>x.split('/auth/')[1]):'unknown (connected before scope tracking)',reauthorizeGoogle:REAUTH_URL,transcriptDevices:devices,build:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7)??null})});
   server.registerTool('list_google_properties',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Google Search Console and GA4 properties',description:'List properties accessible to the linked Google account.',inputSchema:z.object({})},async()=>{
    try{
     const session=await readGoogle(user.id);if(!session)return asText(CONNECT_GOOGLE);
     if(!await consumeQuota(user.id,quotaLimit(session)))return asText({error:'Daily quota exceeded'});
     const {token}=await authorizedAccessToken(session);
     const [gsc,ga4]=await Promise.all([googleFetch('https://www.googleapis.com/webmasters/v3/sites',token),googleFetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=100',token)]);
     return asText({gsc:gsc.ok?await gsc.json():{error:gsc.status},ga4:ga4.ok?await ga4.json():{error:ga4.status}});
    }catch(e){return asText({error:e instanceof Error?e.message:'Google error'})}
   });
     server.registerTool('search_apis',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Search GUM-compatible Google API catalog',description:'Discover operations from the GUM 228-operation catalog. Discovery does not imply execution support.',inputSchema:z.object({query:z.string().max(120).default(''),service:z.string().max(60).optional(),limit:z.number().int().min(1).max(30).default(15)})},async args=>{
    const q=args.query.toLowerCase();const matches=gumCatalog.filter(op=>(!args.service||op.service===args.service)&&(!q||(op.id+' '+op.title+' '+op.summary+' '+op.service).toLowerCase().includes(q)));
    return asText({total:matches.length,operations:matches.slice(0,args.limit).map(op=>({id:op.id,title:op.title,service:op.service,risk:op.risk,executable:op.risk==='read'&&(['calendar','youtube','searchconsole'].includes(op.service)||(op.service==='gmail'&&op.method==='GET'))&&('path' in op && typeof op.path==='string')&&['GET','POST'].includes(op.method||'')}))});
   });
   server.registerTool('describe_operation',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Describe a Google API operation',description:'Inspect GUM-compatible operation metadata, parameters and current remote execution support.',inputSchema:z.object({operationId:z.string().max(140)})},async args=>{
    const op=gumCatalog.find(op=>op.id===args.operationId);return asText(op?{...op,executable:op.risk==='read'&&(['calendar','youtube','searchconsole'].includes(op.service)||(op.service==='gmail'&&op.method==='GET'))&&('path' in op && typeof op.path==='string')&&['GET','POST'].includes(op.method||''),note:'Remote read execution requires an authorized Google account and matching scopes; write and destructive operations are not enabled.'}:{error:'Unknown operation'});
   });
   server.registerTool('read_operation',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Execute a supported read-only Google API operation',description:'Execute cataloged read-only Calendar, YouTube, Search Console or Gmail (GET only, e.g. gmail.users.messages.list with q, gmail.users.messages.get with userId=me) operations. No arbitrary URLs, mutations or write methods.',inputSchema:z.object({operationId:z.string().max(140),args:z.record(z.string(),z.unknown()).default({})})},async input=>{
    const op=gumCatalog.find(op=>op.id===input.operationId);
    if(!op||op.risk!=='read'||!(['calendar','youtube','searchconsole'].includes(op.service)||(op.service==='gmail'&&op.method==='GET'))||!('path' in op)||typeof op.path!=='string'||!['GET','POST'].includes(op.method||''))return asText({error:'Operation not supported for remote execution',operationId:input.operationId});
    const base:Record<string,string>={calendar:'https://www.googleapis.com',youtube:'https://www.googleapis.com',searchconsole:'https://searchconsole.googleapis.com',gmail:'https://gmail.googleapis.com'};
    let path:string=op.path;
    for(const field of ('fields' in op ? op.fields : [])){if(field.location==='path'){
      const value=input.args[field.name];if(typeof value!=='string'||!value||value.length>500)return asText({error:'Missing or invalid path parameter',parameter:field.name});
      path=path.replace('{'+field.name+'}',encodeURIComponent(value));
    }}
    if(path.includes('{'))return asText({error:'Unresolved path parameter'});
    const url=new URL(path,base[op.service]);if(url.origin!==base[op.service]&&!(op.service==='searchconsole'&&url.origin==='https://www.googleapis.com'))return asText({error:'API host not allowed'});
    const allowed: Set<string>=new Set((('fields' in op ? op.fields : [])).filter(f=>f.location==='query').map(f=>f.name));
    for(const [key,value] of Object.entries(input.args)){if(!allowed.has(key))continue;if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')url.searchParams.set(key,String(value));else if(Array.isArray(value)&&value.every(v=>typeof v==='string'))url.searchParams.set(key,value.join(','));}
    if(op.service==='calendar'&&op.id==='calendar.events.list'){if(!url.searchParams.has('maxResults'))url.searchParams.set('maxResults','25');if(!url.searchParams.has('timeMin')&&!url.searchParams.has('timeMax'))url.searchParams.set('timeMin',new Date(Date.now()-7*24*60*60*1000).toISOString());}
    const session=await readGoogle(user.id);if(!session)return asText(CONNECT_GOOGLE);
    if(!await consumeQuota(user.id,quotaLimit(session)))return asText({error:'Daily quota exceeded'});
    try{const {token}=await authorizedAccessToken(session);
      const body=input.args.body;const init:RequestInit=op.method==='POST'?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body??{})}:{method:'GET'};
      const response=await googleFetch(url.toString(),token,init);const result=await response.json().catch(()=>({}));return asText(response.ok?{operationId:op.id,result}:{operationId:op.id,error:'Google API request failed',status:response.status,details:result});
    }catch(e){return asText({error:e instanceof Error?e.message:'Google API error'})}
   });
   // Google tools are registered for every authenticated user; access is checked per call.
   const googleRequest=async(url:string,init?:RequestInit)=>{
    const session=await readGoogle(user.id);if(!session)return CONNECT_GOOGLE;
    if(!await consumeQuota(user.id,quotaLimit(session)))return {error:'Daily quota exceeded'};
    const {token}=await authorizedAccessToken(session);
    const response=await googleFetch(url,token,init);
    const body=await response.json().catch(()=>({}));
    if(response.status===403&&JSON.stringify(body).includes('SCOPE_INSUFFICIENT')){
     const api=url.includes('youtube')?'YouTube':url.includes('calendar')?'Google Calendar':url.includes('analytics')?'Google Analytics':url.includes('webmasters')||url.includes('searchconsole')?'Search Console':'this Google API';
     return {error:'missing_google_permission',api,reauthorizeUrl:REAUTH_URL,
      messageForUser:'Your Google authorization does not include '+api+'. Open '+REAUTH_URL+' , sign in, keep '+api+' checked and click "Reconnect Google". Then ask me again (no need to reconnect the assistant).',
      instructions:'Relay messageForUser to the user in their language with the link.'};
    }
    return response.ok?body:{error:'Google API request failed',status:response.status,details:body};
   };
   server.registerTool('youtube_channel',{annotations:{readOnlyHint:true,openWorldHint:true},title:'YouTube channel information',description:'Read the authenticated Google account YouTube channel metadata and statistics.',inputSchema:z.object({})},async()=>asText(await googleRequest('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true')));
   server.registerTool('youtube_search_videos',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Search YouTube videos',description:'Search publicly available YouTube videos or videos from a channel by channel ID. Returns titles, channel, publication time and video IDs; transcripts are not guaranteed by the official API.',inputSchema:z.object({query:z.string().min(1).max(150).optional(),channelId:z.string().min(1).max(100).optional(),maxResults:z.number().int().min(1).max(25).default(10),publishedAfter:z.string().datetime().optional()})},async args=>{
    if(!args.query&&!args.channelId)return asText({error:'Provide query or channelId'});
    const params=new URLSearchParams({part:'snippet',type:'video',maxResults:String(args.maxResults),order:'date'});
    if(args.query)params.set('q',args.query);if(args.channelId)params.set('channelId',args.channelId);if(args.publishedAfter)params.set('publishedAfter',args.publishedAfter);
    return asText(await googleRequest('https://www.googleapis.com/youtube/v3/search?'+params));
   });
   server.registerTool('youtube_video_details',{annotations:{readOnlyHint:true,openWorldHint:true},title:'YouTube video details',description:'Get metadata, descriptions and statistics for YouTube videos by ID. Does not provide arbitrary video transcripts.',inputSchema:z.object({videoIds:z.array(z.string().min(1).max(30)).min(1).max(25)})},async args=>asText(await googleRequest('https://www.googleapis.com/youtube/v3/videos?'+new URLSearchParams({part:'snippet,statistics,contentDetails',id:args.videoIds.join(',')}))));
   server.registerTool('youtube_get_transcript',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Read timestamped YouTube captions',description:'Retrieve timestamped YouTube captions. By default returns the video\'s ORIGINAL spoken language (detected with the YouTube Data API); translate it yourself into the user\'s language. Pass language only when the user explicitly wants another language: YouTube then translates if no such track exists. YouTube blocks cloud servers, so the transcript is fetched by the user\'s paired CamMicGo Android app (open, with "Mode connecté" on) and relayed here; recent transcripts are served from cache. If no device is paired, the result contains a pairingCode and a messageForUser to relay. If the result says pending, call youtube_transcript_status with the jobId. Uses 1 YouTube Data API unit to detect the original language.',inputSchema:z.object({videoId:z.string().min(1).max(250).describe('YouTube URL or 11-character video ID'),language:z.string().max(12).default('original').describe('original (default) or a language code such as fr'),format:z.enum(['text','segments']).default('text').describe('text (default): compact "[mm:ss] line" transcript, fewer tokens; segments: JSON array with start/duration')})},async args=>{
    const fmt=(r:unknown)=>relay.formatTranscript(r,args.format);
    const videoId=relay.parseVideoId(args.videoId);if(!videoId)return asText({error:'Invalid YouTube URL or video ID'});
    let language=relay.normalizeLanguage(args.language);let originalLanguage:string|null=null;
    if(language==='original'){try{const v=await googleRequest('https://www.googleapis.com/youtube/v3/videos?part=snippet&id='+videoId) as {items?:Array<{snippet?:{defaultAudioLanguage?:string;defaultLanguage?:string}}>};const sn=v.items?.[0]?.snippet;originalLanguage=(sn?.defaultAudioLanguage||sn?.defaultLanguage||'').toLowerCase().split('-')[0]||null;if(originalLanguage&&/^[a-z]{2,3}$/.test(originalLanguage))language=originalLanguage}catch{}}
    const meta={originalLanguage,requestedLanguage:args.language||'original'};
    try{
     const cached=await relay.cachedTranscript(videoId,language);if(cached)return asText({...(fmt(cached) as object),...meta,cached:true});
     const devices=await relay.listDevices(user.id);const online=devices.filter(relay.isOnline);
     if(online.length){
      const job=await relay.createJob(user.id,videoId,language);
      const deadline=Date.now()+40_000;
      while(Date.now()<deadline){
       await new Promise(r=>setTimeout(r,1500));
       const current=await relay.getJob(user.id,job.id);
       if(current?.status==='done')return asText({...(fmt(current.result) as object),...meta});
       if(current?.status==='error')return asText({videoId,error:'The paired device could not fetch captions',deviceError:current.error});
      }
      return asText({videoId,status:'pending',jobId:job.id,hint:'The paired device has not answered yet. Call youtube_transcript_status with this jobId in a few seconds.'});
     }
     const direct=await getYouTubeTranscript(videoId,language==='original'?'en':language) as {segments?:unknown};
     if(direct.segments)return asText(fmt(direct));
     const {code,expiresAt}=await relay.createPairingCode(user.id);
     if(devices.length)return asText({videoId,status:'device_offline',devicesPaired:devices.map(d=>({name:d.name,lastSeen:d.last_seen_at})),pairingCode:code,expiresAt,
      messageForUser:'To fetch this transcript I use your CamMicGo app ('+devices.map(d=>d.name).join(', ')+'), but it is not reachable right now. Open the app, turn on "Mode connecté" and keep the device awake (screen on or charging) while I fetch the transcript. If you reinstalled the app or use another device, pair it with this code: '+code+' (valid 10 minutes). Then tell me to retry.',
      instructions:'Relay messageForUser to the user in their language, showing the code exactly, then call youtube_get_transcript again once they confirm.'});
     return asText({videoId,status:'pairing_required',pairingCode:code,expiresAt,
      messageForUser:'YouTube blocks cloud servers, so I fetch transcripts through your own device. Here is your CamMicGo pairing code: '+code+' (valid 10 minutes). Install the CamMicGo app (Android phone: https://seo.cammicgo.com/download/android · computer: https://seo.cammicgo.com/download/desktop), enter the code in the app and confirm ("Appairer" / "Associer"). Keep the app open in "Mode connecté" and the device awake while I fetch transcripts, otherwise the request cannot be completed. Tell me when it is done.',
      instructions:'Relay messageForUser to the user in their language, showing the code exactly. After they confirm, call youtube_get_transcript again.'});
    }catch(e){return asText({videoId,error:e instanceof Error?e.message:'Transcript relay unavailable'})}
   });
   server.registerTool('youtube_find_channels',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Find YouTube channels by name',description:'Find channels matching a person or brand name, with subscribers and video counts, sorted by subscribers. Several channels often share a name (main channel, clips, shorts, vlog): show the list and ask the user which one if it is not obvious. Costs about 100 YouTube Data API units.',inputSchema:z.object({query:z.string().min(2).max(100),maxResults:z.number().int().min(1).max(10).default(6)})},async args=>{
    const found=await googleRequest('https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults='+args.maxResults+'&q='+encodeURIComponent(args.query)) as {items?:Array<{id?:{channelId?:string}}>;error?:unknown};
    if(found.error)return asText(found);
    const ids=(found.items??[]).map(i=>i.id?.channelId).filter(Boolean);if(!ids.length)return asText({query:args.query,channels:[]});
    const details=await googleRequest('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id='+ids.join(',')) as {items?:Array<{id:string;snippet?:{title?:string;customUrl?:string;description?:string};statistics?:{subscriberCount?:string;videoCount?:string;hiddenSubscriberCount?:boolean}}>;error?:unknown};
    if(details.error)return asText(details);
    const channels=(details.items??[]).map(c=>({channelId:c.id,title:c.snippet?.title,handle:c.snippet?.customUrl,subscribers:c.statistics?.hiddenSubscriberCount?null:Number(c.statistics?.subscriberCount??0),videos:Number(c.statistics?.videoCount??0),description:(c.snippet?.description??'').slice(0,160)})).sort((a,b)=>(b.subscribers??0)-(a.subscribers??0));
    return asText({query:args.query,channels,hint:'The channel with the most subscribers is usually the main one. Ask the user if several look relevant.'});
   });
   server.registerTool('youtube_channel_batch',{annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true},title:'Batch transcripts of a YouTube channel (one document)',description:'Collect up to 500 latest videos of a channel (details + full timestamped transcripts, original language by default) into Markdown and CSV files (one row per video: channel, author, title, date, URL, transcript) with stable URLs, split into parts of 100 videos, e.g. to add as a single NotebookLM source instead of hundreds. Transcripts are fetched one by one by the user\'s paired device: it must stay in "Mode connecté" and awake (about 3-6 seconds per video). Re-run it later with the same channel to add new videos; the URL stays the same. Then use youtube_batch_status.',inputSchema:z.object({channel:z.string().min(3).max(200).describe('Channel ID (UC…), @handle or channel URL'),maxVideos:z.number().int().min(1).max(500).default(25),publishedAfter:z.string().datetime().optional(),language:z.string().max(12).default('original')})},async args=>{
    try{
     const {resolveChannel,listUploads,runBatch,exportUrl,exportFiles}=await import('@/lib/channel-export');
     const get=(u:string)=>googleRequest(u);
     const ch=await resolveChannel(args.channel,get);if('error' in ch)return asText(ch);
     const videos=await listUploads(ch.uploads,args.maxVideos,args.publishedAfter,get);
     const {exp,ready,queued}=await runBatch(user.id,ch,videos,relay.normalizeLanguage(args.language));
     const devices=await relay.listDevices(user.id);const online=devices.filter(relay.isOnline);
     let pairing:{code:string;expiresAt:string}|null=null;if(queued&&!online.length)pairing=await relay.createPairingCode(user.id);
     const url=exportUrl(exp.id);
     return asText({exportId:exp.id,channel:ch.title,videos:videos.length,ready,queued,files:exportFiles(exp),documentUrl:url,downloadUrl:url+'&download=1',deviceOnline:online.length>0,pairingCode:pairing?.code,
      estimatedMinutes:Math.ceil(queued*5/60),
      messageForUser:(queued?(online.length?'Your device ('+online.map(d=>d.name).join(', ')+') is now fetching '+queued+' transcripts (about '+Math.max(1,Math.ceil(queued*5/60/online.length))+' min). Keep the CamMicGo app in "Mode connecté" and the device awake until it finishes. ':'Your CamMicGo app is not reachable: open it in "Mode connecté"'+(pairing?' or pair it with code '+pairing.code+' (valid 10 minutes)':'')+', keep it awake, and the '+queued+' transcripts will be fetched (requests stay valid 2 hours). '):'All transcripts are ready. ')
       +'Files for NotebookLM (Markdown and CSV, one row per video with the full transcript; '+(videos.length>100?'split into parts of 100 videos':'one file')+') are listed in files. Re-run the batch later to add new videos: the links stay the same.',
      instructions:'Relay messageForUser in the user\'s language. Call youtube_batch_status with exportId to follow progress; do not paste the whole document into the chat.'});
    }catch(e){return asText({error:e instanceof Error?e.message:'Batch unavailable'})}
   });
   server.registerTool('youtube_batch_status',{annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},title:'Progress of a channel transcript batch',description:'Progress of youtube_channel_batch (ready / queued / failed per video) and the document URL. Set retryFailed to requeue failed or missing transcripts.',inputSchema:z.object({exportId:z.string().max(40),retryFailed:z.boolean().default(false)})},async args=>{
    try{
     const {readExport,exportStatus,retryMissing,exportUrl,exportFiles}=await import('@/lib/channel-export');
     const exp=await readExport(args.exportId,user.id);if(!exp)return asText({error:'Unknown exportId'});
     const requeued=args.retryFailed?await retryMissing(exp):0;
     const {counts,failures}=await exportStatus(exp);
     const devices=await relay.listDevices(user.id);
     return asText({exportId:exp.id,channel:exp.channel_title,videos:exp.videos.length,...counts,requeued,failures,deviceOnline:devices.some(relay.isOnline),files:exportFiles(exp),documentUrl:exportUrl(exp.id),updatedAt:exp.updated_at});
    }catch(e){return asText({error:e instanceof Error?e.message:'Status unavailable'})}
   });
   server.registerTool('youtube_transcript_status',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Check a relayed YouTube transcript',description:'Read the result of a transcript job returned as pending by youtube_get_transcript.',inputSchema:z.object({jobId:z.string().max(40)})},async({jobId})=>{
    try{const job=await relay.getJob(user.id,jobId);if(!job)return asText({error:'Unknown job'});
     if(job.status==='done')return asText(relay.formatTranscript(job.result,'text'));
     if(job.status==='error')return asText({videoId:job.video_id,error:'The paired device could not fetch captions',deviceError:job.error});
     if(Date.parse(job.expires_at)<Date.now())return asText({videoId:job.video_id,error:'Job expired: no paired device answered within 10 minutes. Check that the app is open with "Mode connecté" on.'});
     return asText({videoId:job.video_id,status:job.status,hint:'Still waiting for the paired device; retry in a few seconds.'});
    }catch(e){return asText({error:e instanceof Error?e.message:'Transcript relay unavailable'})}
   });
   server.registerTool('device_pairing_code',{annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},title:'Get a pairing code for the CamMicGo app (code d’appairage)',description:'Pairing / appairage / link / connect the CamMicGo Android or desktop app. Create a one-time 10-minute code that the user types in the CamMicGo app (Android, or the desktop app for Windows/macOS/Linux) to link it to this account, so YouTube transcripts can be fetched from their phone or computer. Also lists already paired devices. Show the code to the user exactly as returned, with messageForUser translated into their language.',inputSchema:z.object({})},async()=>{
    try{const {code,expiresAt}=await relay.createPairingCode(user.id);const devices=await relay.listDevices(user.id);
     return asText({code,expiresAt,messageForUser:'Your CamMicGo pairing code is '+code+' (valid 10 minutes). Enter it in the CamMicGo app: on Android, "Connexion à votre assistant IA" › "Appairer"; on a computer, the CamMicGo Relay control page › "Associer". To fetch transcripts, keep the app in "Mode connecté" and the device awake while I work.',steps:['Install the app: Android https://seo.cammicgo.com/download/android · Windows/macOS/Linux https://seo.cammicgo.com/download/desktop','Open it, enter this code and confirm ("Appairer" on Android, "Associer" on a computer)','Turn on "Mode connecté" and keep the app running while transcripts are requested'],pairedDevices:devices.map(d=>({id:d.id,name:d.name,online:relay.isOnline(d),lastSeen:d.last_seen_at}))});
    }catch(e){return asText({error:e instanceof Error?e.message:'Pairing unavailable'})}
   });
   server.registerTool('device_revoke',{annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:false},title:'Unpair a CamMicGo device',description:'Revoke a paired device by id (from device_pairing_code or service_info). The device stops receiving transcript jobs immediately.',inputSchema:z.object({deviceId:z.string().max(40)})},async({deviceId})=>{
    try{return asText(await relay.revokeDevice(user.id,deviceId)?{revoked:deviceId}:{error:'Unknown device'})}catch(e){return asText({error:e instanceof Error?e.message:'Unavailable'})}
   });
   server.registerTool('calendar_list',{annotations:{readOnlyHint:true,openWorldHint:true},title:'List Google Calendars',description:'List calendars accessible to the linked Google account (read-only).',inputSchema:z.object({})},async()=>asText(await googleRequest('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=100')));
   server.registerTool('calendar_events',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Find Google Calendar events',description:'List or search events, including past appointments, in a specific calendar. Requires calendar.readonly.',inputSchema:z.object({calendarId:z.string().min(1).max(300).default('primary'),query:z.string().max(200).optional(),timeMin:z.string().datetime().optional(),timeMax:z.string().datetime().optional(),maxResults:z.number().int().min(1).max(100).default(25)})},async args=>{
    const params=new URLSearchParams({maxResults:String(args.maxResults),singleEvents:'true',orderBy:'startTime'});
    if(args.query)params.set('q',args.query);if(args.timeMin)params.set('timeMin',args.timeMin);if(args.timeMax)params.set('timeMax',args.timeMax);
    return asText(await googleRequest('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(args.calendarId)+'/events?'+params));
   });
   server.registerTool('gmail_search',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Search Gmail (read-only)',description:'Search the signed-in user\'s Gmail with Gmail search syntax (e.g. from:ads-noreply@google.com subject:"API" newer_than:30d). Returns sender, subject, date and snippet. Requires gmail.readonly. Never sends, deletes or modifies mail.',inputSchema:z.object({query:z.string().max(300),maxResults:z.number().int().min(1).max(15).default(8)})},async args=>{
    const list=await googleRequest('https://gmail.googleapis.com/gmail/v1/users/me/messages?'+new URLSearchParams({q:args.query,maxResults:String(args.maxResults)})) as {messages?:Array<{id:string}>;error?:string};
    if(list.error)return asText(list);
    const out=[];
    for(const m of list.messages??[]){
     const msg=await googleRequest('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+m.id+'?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date') as {id?:string;snippet?:string;payload?:{headers?:Array<{name:string;value:string}>};error?:string};
     if(msg.error){out.push({id:m.id,error:msg.error});continue;}
     const h=(n:string)=>msg.payload?.headers?.find(x=>x.name.toLowerCase()===n.toLowerCase())?.value??null;
     out.push({id:m.id,from:h('From'),subject:h('Subject'),date:h('Date'),snippet:msg.snippet});
    }
    return asText({count:out.length,messages:out,next:'Call gmail_read with an id to read the full text.'});
   });
   server.registerTool('gmail_read',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Read one Gmail message (read-only)',description:'Read the text of one Gmail message found with gmail_search (plain text, HTML converted to text, links kept). Requires gmail.readonly.',inputSchema:z.object({messageId:z.string().regex(/^[A-Za-z0-9]{6,40}$/)})},async args=>{
    type Part={mimeType?:string;body?:{data?:string};parts?:Part[];filename?:string};
    const msg=await googleRequest('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+args.messageId+'?format=full') as {id?:string;payload?:Part&{headers?:Array<{name:string;value:string}>};error?:string};
    if(msg.error)return asText(msg);
    const decode=(d?:string)=>d?Buffer.from(d.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'):'';
    let plain='',html='';const files:string[]=[];
    const walk=(p?:Part)=>{if(!p)return;if(p.filename)files.push(p.filename);if(p.mimeType==='text/plain'&&!plain)plain=decode(p.body?.data);else if(p.mimeType==='text/html'&&!html)html=decode(p.body?.data);for(const c of p.parts??[])walk(c);};
    walk(msg.payload);
    const fromHtml=(x:string)=>x.replace(/<(script|style)[\s\S]*?<\/\1>/gi,'').replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,'$2 ($1)').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n\n').trim();
    const text=(plain||fromHtml(html)).slice(0,30000);
    const h=(n:string)=>msg.payload?.headers?.find(x=>x.name.toLowerCase()===n.toLowerCase())?.value??null;
    return asText({id:msg.id,from:h('From'),to:h('To'),subject:h('Subject'),date:h('Date'),attachments:files,text});
   });
   server.registerTool('search_console_report',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Google Search Console report',description:'Read clicks, impressions, CTR and positions by country, date or query for a verified site.',inputSchema:z.object({siteUrl:z.string().min(1).max(300),startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),endDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),dimensions:z.array(z.enum(['country','date','query','page','device'])).min(1).max(3).default(['country']),rowLimit:z.number().int().min(1).max(1000).default(100)})},async args=>{
    const sites=await googleRequest('https://www.googleapis.com/webmasters/v3/sites') as {siteEntry?:Array<{siteUrl:string}>;error?:string};
    if(sites.error)return asText(sites);if(!(sites.siteEntry||[]).some(site=>site.siteUrl===args.siteUrl))return asText({error:'Site not authorized'});
    return asText(await googleRequest('https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(args.siteUrl)+'/searchAnalytics/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({startDate:args.startDate,endDate:args.endDate,dimensions:args.dimensions,rowLimit:args.rowLimit})}));
   });
   server.registerTool('ga4_report',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Google Analytics 4 report',description:'Read sessions and active users by country, countryId or date for an authorized GA4 property.',inputSchema:z.object({property:z.string().startsWith('properties/'),days:z.number().int().min(1).max(90).default(28),dimensions:z.array(z.enum(['country','countryId','date','pagePath'])).min(1).max(2).default(['country']),metrics:z.array(z.enum(['sessions','activeUsers','screenPageViews'])).min(1).max(3).default(['sessions','activeUsers'])})},async args=>{
    const accounts=await googleRequest('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=100') as {accountSummaries?:Array<{propertySummaries?:Array<{property:string}>}>;error?:string};
    if(accounts.error)return asText(accounts);if(!(accounts.accountSummaries||[]).some(account=>(account.propertySummaries||[]).some(p=>p.property===args.property)))return asText({error:'Property not authorized'});
    return asText(await googleRequest('https://analyticsdata.googleapis.com/v1beta/'+args.property+':runReport',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dateRanges:[{startDate:(args.days-1)+'daysAgo',endDate:'yesterday'}],dimensions:args.dimensions.map(name=>({name})),metrics:args.metrics.map(name=>({name})),limit:100,returnPropertyQuota:true})}));
   });
  },{instructions:SERVER_INSTRUCTIONS,serverInfo:{name:'CamMicGo SEO MCP',version:'1.2.0'}});
  return protectedMcp(req);
 }

 if(process.env.ENABLE_MCP_BETA!=='true'){
  // Anonymous discovery only; do not expose Google account tools without MCP OAuth.
  const publicMcp=createMcpHandler(server=>server.registerTool('service_info',{annotations:{readOnlyHint:true,openWorldHint:true},title:'CamMicGo SEO MCP server status',description:'Public status of remote MCP and secure connection requirements.',inputSchema:z.object({})},async()=>asText({name:'CamMicGo SEO MCP',remote:true,authenticatedTools:false,reason:'Google OAuth for remote MCP agents and shared durable quotas are not enabled.',localMcpSetup:'https://github.com/CamMicGo/cammicgo-seo-mcp#local-mcp-server-read-only-preview'})));
  return publicMcp(req);
 }
 const ctx=verifyMcpAccess(req.headers.get('authorization'));if(!ctx)return unauthorized();
 const mcp=createMcpHandler(server=>{
  server.registerTool('service_info',{annotations:{readOnlyHint:true,openWorldHint:true},title:'CamMicGo SEO MCP',description:'Service capabilities and token lifetime.',inputSchema:z.object({})},async()=>asText({name:'CamMicGo SEO MCP',beta:true,expiresAt:new Date(ctx.expires).toISOString(),selectedSite:ctx.site||null,selectedGA4Property:ctx.property||null}));
  server.registerTool('prepare_ads_campaign',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Prepare CamMicGo Google Ads campaign (no spending)',description:'Prepare a preview-only, paused Search campaign concept for CamMicGo, capped at 150 euros and 7 days. Does not call Google Ads or create advertisements.',inputSchema:z.object({totalBudgetEur:z.number().positive().max(150).default(150),durationDays:z.number().int().min(1).max(7).default(7),countries:z.array(z.enum(['US','FR','GB','DE','CA','JP','KR','AU','ES','IT','NL','BE'])).min(1).max(6).default(['US','FR','GB'])})},async args=>{try{return asText({draft:makeCampaignDraft(args),submittedToGoogle:false,requiresAdsOAuth:true,requiresHumanApproval:true})}catch(e){return asText({error:e instanceof Error?e.message:'Invalid request'})}});
  server.registerTool('list_selected_properties',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Selected properties',description:'Show the specific Google site and Analytics property authorized by the user for this 15-minute session.',inputSchema:z.object({})},async()=>asText({site:ctx.site||null,property:ctx.property||null}));
  server.registerTool('seo_keyword_opportunities',{annotations:{readOnlyHint:true,openWorldHint:true},title:'SEO keyword opportunities',description:'Analyze the selected Search Console property and return ranked underperforming organic queries (high impressions, lower CTR, positions 4 to 20). These are real reporting rows, not Google Ads Keyword Planner estimates.',inputSchema:z.object({minImpressions:z.number().int().min(1).max(1000000).default(30),country:z.string().length(3).regex(/^[A-Z]{3}$/).optional()})},async args=>{
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
  server.registerTool('search_performance',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Search Console query performance',description:'Get clicks, impressions, CTR and average ranking position for the selected Search Console site over the last 28 completed days.',inputSchema:z.object({})},async()=>{
   if(!ctx.site)return asText({error:'No Search Console site selected'});
   try{const {token}=await authorizedAccessToken(ctx.google);const sites=await googleFetch('https://www.googleapis.com/webmasters/v3/sites',token);if(!sites.ok)return asText({error:'Unable to verify site access'});const list=await sites.json();if(!(list.siteEntry||[]).some((s:{siteUrl:string})=>s.siteUrl===ctx.site))return asText({error:'Site permission revoked'});
   const response=await googleFetch('https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(ctx.site)+'/searchAnalytics/query',token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({startDate:new Date(Date.now()-30*86400000).toISOString().slice(0,10),endDate:new Date(Date.now()-3*86400000).toISOString().slice(0,10),dimensions:['query'],rowLimit:40})});if(!response.ok)return asText({error:'Google Search Console request failed',status:response.status});const body=await response.json();return asText({site:ctx.site,rows:body.rows||[],disclaimer:'Average position is not a live ranking.'})}catch{return asText({error:'Google Search Console unavailable'})}
  });
  server.registerTool('ga4_countries',{annotations:{readOnlyHint:true,openWorldHint:true},title:'GA4 traffic by country',description:'Read top countries for the selected authorized GA4 property and provider quota; no write access.',inputSchema:z.object({days:z.number().int().min(1).max(90).default(28)})},async args=>{
   if(!ctx.property)return asText({error:'No GA4 property selected'});
   try{const {token}=await authorizedAccessToken(ctx.google);const r=await googleFetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=100',token);if(!r.ok)return asText({error:'Unable to verify Analytics property'});const accounts=await r.json();
    if(!(accounts.accountSummaries||[]).some((a:{propertySummaries?:Array<{property:string}>})=>(a.propertySummaries||[]).some(p=>p.property===ctx.property)))return asText({error:'GA4 access revoked'});
    const output=await googleFetch('https://analyticsdata.googleapis.com/v1beta/'+ctx.property+':runReport',token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dateRanges:[{startDate:(args.days-1)+'daysAgo',endDate:'yesterday'}],dimensions:[{name:'country'},{name:'countryId'}],metrics:[{name:'sessions'},{name:'activeUsers'}],limit:100,returnPropertyQuota:true,orderBys:[{metric:{metricName:'sessions'},desc:true}]})});
    if(!output.ok)return asText({error:'GA4 request failed',status:output.status});
    const body=await output.json();return asText({property:ctx.property,days:args.days,rows:body.rows||[],quota:body.propertyQuota||null});
   }catch{return asText({error:'GA4 report unavailable'})}
  });
  server.registerTool('ga4_top_pages',{annotations:{readOnlyHint:true,openWorldHint:true},title:'Google Analytics top pages',description:'Retrieve the 20 most viewed pages over the last 28 completed days for the selected GA4 property.',inputSchema:z.object({})},async()=>{
   if(!ctx.property)return asText({error:'No GA4 property selected'});
   try{const {token}=await authorizedAccessToken(ctx.google);const res=await googleFetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=100',token);if(!res.ok)return asText({error:'Unable to verify GA4 access'});const list=await res.json();if(!(list.accountSummaries||[]).some((a:{propertySummaries?:Array<{property:string}>})=>(a.propertySummaries||[]).some(p=>p.property===ctx.property)))return asText({error:'GA4 permission revoked'});const r=await googleFetch('https://analyticsdata.googleapis.com/v1beta/'+ctx.property+':runReport',token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dateRanges:[{startDate:'28daysAgo',endDate:'yesterday'}],dimensions:[{name:'pagePath'}],metrics:[{name:'screenPageViews'},{name:'activeUsers'}],limit:20,returnPropertyQuota:true,orderBys:[{metric:{metricName:'screenPageViews'},desc:true}]})});if(!r.ok)return asText({error:'GA4 request failed',status:r.status});const body=await r.json();return asText({property:ctx.property,rows:body.rows||[],googlePropertyQuota:body.propertyQuota||null})}catch{return asText({error:'GA4 request unavailable'})}
  });
 });
 return mcp(req);
}
export const GET=handler;
export const POST=handler;

// Some remote connector validators probe HEAD before negotiating MCP over POST.
// This confirms route existence only; it does not imply OAuth or private Google tools are enabled.
export function HEAD(){return new NextResponse(null,{status:200,headers:{'Cache-Control':'no-store','Allow':'HEAD, POST, GET'}})}
