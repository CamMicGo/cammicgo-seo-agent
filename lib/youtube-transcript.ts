/** Read public YouTube caption tracks without Google Data API or third-party packages.
 * Experimental: YouTube's player response is undocumented and can change or block cloud IPs.
 */
type Track = {baseUrl:string;languageCode:string;kind?:string;name?:{simpleText?:string;runs?:Array<{text:string}>}};
type Segment = {start:number;duration:number;text:string};
const ID=/^[A-Za-z0-9_-]{11}$/;
function extractId(input:string):string|null{
 if(ID.test(input))return input;
 try{const u=new URL(input);const host=u.hostname.toLowerCase();
  let id:string|null=null;
  if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host))id=u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1]??null;
  else if(host==='youtu.be')id=u.pathname.slice(1);
  return id&&ID.test(id)?id:null;
 }catch{return null}
}
function embeddedJson(html:string,marker:string):unknown{
 const pos=html.indexOf(marker);if(pos<0)return null;
 const start=html.indexOf('{',pos+marker.length);if(start<0)return null;
 let depth=0,quoted=false,escaped=false;
 for(let i=start;i<html.length;i++){const c=html[i];
  if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}
  if(c==='"'){quoted=true;continue}if(c==='{')depth++;else if(c==='}'&&--depth===0){try{return JSON.parse(html.slice(start,i+1))}catch{return null}}
 }return null;
}
type Player={captions?:{playerCaptionsTracklistRenderer?:{captionTracks?:Track[]}};playabilityStatus?:{status?:string;reason?:string}};
function tracksOf(player:Player|null){return player?.captions?.playerCaptionsTracklistRenderer?.captionTracks??[]}
function playerConfig(html:string):{apiKey?:string;visitorData?:string;clientVersion?:string}{
 const config=(embeddedJson(html,'ytcfg.set(')??{}) as {INNERTUBE_API_KEY?:string;VISITOR_DATA?:string;INNERTUBE_CLIENT_VERSION?:string};
 return {apiKey:config.INNERTUBE_API_KEY,visitorData:config.VISITOR_DATA,clientVersion:config.INNERTUBE_CLIENT_VERSION};
}
/** One bounded public player request; no cookies, OAuth tokens, proxies or browser impersonation. */
async function fallbackPlayer(videoId:string,html:string,signal:AbortSignal):Promise<Player|null>{
 const cfg=playerConfig(html);
 if(!cfg.apiKey||!cfg.clientVersion||!/^[a-zA-Z0-9_-]+$/.test(cfg.apiKey))return null;
 const endpoint=new URL('https://www.youtube.com/youtubei/v1/player');endpoint.searchParams.set('key',cfg.apiKey);
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','Origin':'https://www.youtube.com','Referer':'https://www.youtube.com/'},body:JSON.stringify({videoId,context:{client:{clientName:'WEB',clientVersion:cfg.clientVersion,hl:'en',gl:'US',visitorData:cfg.visitorData}}}),signal,cache:'no-store'});
 if(!response.ok)return null;
 return await response.json() as Player;
}
function nameOf(t:Track){return t.name?.simpleText??t.name?.runs?.map(x=>x.text).join('')??t.languageCode}
export async function getYouTubeTranscript(input:string,language='en'){
 const videoId=extractId(input);if(!videoId)return {error:'Invalid YouTube video ID or URL'};
 if(!/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8}){0,2}$/.test(language))return {error:'Invalid language code'};
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),9000);
 try{
  const page=await fetch('https://www.youtube.com/watch?v='+videoId+'&hl=en',{headers:{'User-Agent':'Mozilla/5.0 (compatible; CamMicGoTranscript/0.1)','Accept-Language':'en-US,en;q=0.9'},signal:controller.signal,cache:'no-store'});
  if(!page.ok)return {videoId,error:'YouTube watch page unavailable',status:page.status};
  const html=await page.text();
  const player=(embeddedJson(html,'var ytInitialPlayerResponse = ')??embeddedJson(html,'ytInitialPlayerResponse = ')) as Player|null;
  let tracks=tracksOf(player);
  let method='watch-page';
  let fallbackStatus:string|null=null;
  if(!tracks.length){
   try{const alternative=await fallbackPlayer(videoId,html,controller.signal);tracks=tracksOf(alternative);fallbackStatus=alternative?.playabilityStatus?.status??null;if(tracks.length)method='player-api';}catch{/* Keep the primary diagnostic. */}
  }
  if(!tracks.length)return {videoId,error:'No accessible caption tracks from YouTube',playabilityStatus:player?.playabilityStatus?.status??null,fallbackPlayabilityStatus:fallbackStatus,attemptedMethods:['watch-page','player-api'],hint:'YouTube may restrict cloud requests; Google OAuth does not grant access to public player captions.'};
  const requested=language.toLowerCase();const track=tracks.find(t=>t.languageCode.toLowerCase()===requested&&!t.kind)??tracks.find(t=>t.languageCode.toLowerCase()===requested)??tracks.find(t=>t.languageCode.toLowerCase().split('-')[0]===requested.split('-')[0])??tracks[0];
  const url=new URL(track.baseUrl);
  if(url.protocol!=='https:'||!['www.youtube.com','youtube.com'].includes(url.hostname)||!url.pathname.startsWith('/api/timedtext'))return {videoId,error:'Unexpected caption endpoint'};
  url.searchParams.set('fmt','json3');
  const captions=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:controller.signal,cache:'no-store'});
  if(!captions.ok)return {videoId,error:'Caption request failed',status:captions.status,availableLanguages:tracks.map(t=>t.languageCode)};
  const data=await captions.json() as {events?:Array<{tStartMs?:number;dDurationMs?:number;segs?:Array<{utf8?:string}>}>};
  const segments:Segment[]=(data.events??[]).filter(e=>typeof e.tStartMs==='number'&&e.segs?.length).map(e=>({start:Number((e.tStartMs!/1000).toFixed(3)),duration:Number(((e.dDurationMs??0)/1000).toFixed(3)),text:(e.segs??[]).map(s=>s.utf8??'').join('').trim()})).filter(s=>s.text.length>0);
  if(!segments.length)return {videoId,error:'Caption track returned no text',language:track.languageCode};
  return {videoId,method,language:track.languageCode,languageName:nameOf(track),isAutoGenerated:track.kind==='asr',availableLanguages:tracks.map(t=>t.languageCode),segments:segments.slice(0,2000),truncated:segments.length>2000};
 }catch(e){return {videoId,error:e instanceof Error?e.message:'Transcript retrieval failed'}}
 finally{clearTimeout(timeout)}
}
