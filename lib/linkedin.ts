/**
 * LinkedIn publishing on the member's own profile ("Share on LinkedIn" + "Sign In with LinkedIn using
 * OpenID Connect", the self-serve products every developer app can add). Each user brings their own
 * LinkedIn app (client ID and secret). Pure helpers, unit-tested: no network, no secrets.
 */
export const LI_AUTHORIZE='https://www.linkedin.com/oauth/v2/authorization';
export const LI_TOKEN='https://www.linkedin.com/oauth/v2/accessToken';
export const LI_API='https://api.linkedin.com/v2'; // OpenID Connect userinfo
export const LI_REDIRECT='https://seo.cammicgo.com/api/auth/linkedin/callback';
export const LI_SCOPES=['openid','profile','email','w_member_social'];
export const LI_TEXT_MAX=3000;
export const LI_IMAGE_MAX=10*1024*1024;
export const LI_VIDEO_MAX=100*1024*1024;

export function validateLinkedInClient(input:{clientId?:unknown;clientSecret?:unknown}){
 const clientId=typeof input.clientId==='string'?input.clientId.trim():'';
 const clientSecret=typeof input.clientSecret==='string'?input.clientSecret.trim():'';
 if(!/^[A-Za-z0-9]{8,40}$/.test(clientId))return {error:'invalid_client_id'} as const;
 if(clientSecret.length<10||clientSecret.length>300||/\s/.test(clientSecret))return {error:'invalid_client_secret'} as const;
 return {clientId,clientSecret} as const;
}

export function authorizeUrl(clientId:string,state:string){
 return LI_AUTHORIZE+'?'+new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:LI_REDIRECT,state,scope:LI_SCOPES.join(' ')});
}
export function tokenBody(code:string,clientId:string,clientSecret:string){
 return new URLSearchParams({grant_type:'authorization_code',code,client_id:clientId,client_secret:clientSecret,redirect_uri:LI_REDIRECT});
}

export type LinkedInSession={accessToken:string;expiresAt:number;scopes:string[];memberId:string;name:string;email?:string|null;app?:LinkedInAppMode};
/** own: the user's own LinkedIn app (bring your own); shared: the CamMicGo app shared by all users. */
export type LinkedInAppMode='own'|'shared';
/** The user's own app wins; otherwise the shared CamMicGo app; otherwise nothing to connect with. */
export const appMode=(hasOwn:boolean,hasShared:boolean):LinkedInAppMode|null=>hasOwn?'own':hasShared?'shared':null;
export const personUrn=(memberId:string)=>'urn:li:person:'+memberId;
export const postUrl=(urn:string)=>'https://www.linkedin.com/feed/update/'+encodeURIComponent(urn)+'/';

export type MediaKind='IMAGE'|'VIDEO';

/**
 * Versioned REST API (Posts, Images, Videos), the replacement of the legacy ugcPosts and assets endpoints.
 * Every call carries LinkedIn-Version (YYYYMM); each version stays active for at least a year.
 */
export const LI_REST='https://api.linkedin.com/rest';
/** The version that last worked on this server instance (an inactive one answers HTTP 426). */
export const liVersionCache:{value:string|null}={value:null};
/** Candidate versions, newest first: last month, then older months still inside the one-year window. */
export function versionCandidates(now=Date.now(),count=11){
 const d=new Date(now);const out:string[]=[];
 for(let i=1;i<=count;i++){const t=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-i,1));out.push(t.getUTCFullYear()+String(t.getUTCMonth()+1).padStart(2,'0'));}
 return out;
}

/**
 * Post text in LinkedIn's "little text" format: reserved characters are escaped (an unescaped one can cut
 * the post short) and #hashtags become hashtag templates, so they stay clickable.
 */
const RESERVED=/[\\|{}@[\]()<>#*_~]/g;
const escapeText=(t:string)=>t.replace(RESERVED,c=>'\\'+c);
export function littleText(text:string){
 let out='',last=0;
 for(const m of text.matchAll(/(?<![\p{L}\p{N}_&#])#([\p{L}\p{N}]+)/gu)){
  out+=escapeText(text.slice(last,m.index))+'{hashtag|\\#|'+m[1]+'}';
  last=(m.index??0)+m[0].length;
 }
 return out+escapeText(text.slice(last));
}

/** Upload address from LinkedIn: accepted only on https LinkedIn hosts, the only place the member token may go. */
export function uploadTarget(raw:string|undefined){
 if(!raw)return null;
 try{const u=new URL(raw);if(u.protocol!=='https:')return null;return u.hostname==='linkedin.com'||u.hostname.endsWith('.linkedin.com')?{url:u.toString()}:null;}catch{return null;}
}

export type PostInput={author:string;text:string;visibility:'PUBLIC'|'CONNECTIONS';media?:{kind:MediaKind;id:string;title?:string};link?:{url:string;title?:string;description?:string}};
/** Posts API body: text, optionally one uploaded image or video (urn:li:image / urn:li:video) or an article link. */
export function postBody(p:PostInput){
 const body:Record<string,unknown>={author:p.author,commentary:littleText(p.text),visibility:p.visibility,
  distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]},lifecycleState:'PUBLISHED',isReshareDisabledByAuthor:false};
 if(p.media)body.content={media:{id:p.media.id,...(p.media.title?{title:p.media.title}:{})}};
 else if(p.link){const u=new URL(p.link.url);body.content={article:{source:p.link.url,title:p.link.title||(u.hostname+u.pathname).replace(/\/$/,''),...(p.link.description?{description:p.link.description}:{})}};}
 return body;
}
export const imageInitBody=(owner:string)=>({initializeUploadRequest:{owner}});
export const videoInitBody=(owner:string,bytes:number)=>({initializeUploadRequest:{owner,fileSizeBytes:bytes,uploadCaptions:false,uploadThumbnail:false}});
export const finalizeVideoBody=(video:string,uploadToken:string,etags:string[])=>({finalizeUploadRequest:{video,uploadToken,uploadedPartIds:etags}});
/** The byte ranges LinkedIn asks for (one PUT each), accepted only if they are on LinkedIn hosts and cover the file exactly. */
export function videoParts(instructions:Array<{uploadUrl?:string;firstByte?:number;lastByte?:number}>|undefined,size:number){
 const parts=(instructions??[]).map(i=>({target:uploadTarget(i.uploadUrl),first:Number(i.firstByte),last:Number(i.lastByte)}));
 if(!parts.length||parts.some(x=>!x.target||!Number.isInteger(x.first)||!Number.isInteger(x.last)||x.last<x.first))return null;
 parts.sort((x,y)=>x.first-y.first);
 let next=0;for(const x of parts){if(x.first!==next)return null;next=x.last+1;}
 return next===size?parts.map(x=>({url:x.target!.url,first:x.first,last:x.last})):null;
}

/** Plain-language reason for a LinkedIn refusal (HTTP status and body). */
/** Which LinkedIn daily limit a 429 answer refers to: the member's own (150 requests) or the whole app's (100,000). */
export function throttleKind(body:string):'member'|'app'|null{return /APPLICATION\s+DAY/i.test(body)?'app':/MEMBER\s+DAY/i.test(body)?'member':null;}
export function problemMessage(status:number,body:string,accountUrl:string,app:LinkedInAppMode='own'){
 if(status===401)return 'LinkedIn refused the connection (expired or revoked): reconnect LinkedIn at '+accountUrl+'.';
 if(status===403)return 'LinkedIn refused the publication: check that your LinkedIn app has the "Share on LinkedIn" product, then reconnect LinkedIn.';
 if(/DUPLICATE_POST|duplicate/i.test(body))return 'LinkedIn refuses a post identical to one published just before.';
 if(status===429){
  const kind=throttleKind(body);
  if(kind==='member')return 'You reached your own LinkedIn limit for today (150 requests per member). It resets at midnight UTC: try again after that.';
  if(app==='shared')return 'The CamMicGo app shared by all users reached LinkedIn\'s daily limit. It resets at midnight UTC. To stop depending on the shared app, connect your own LinkedIn app (guide: https://seo.cammicgo.com/setup/linkedin), then reconnect LinkedIn at '+accountUrl+'.';
  return 'Your LinkedIn app reached its daily limit. It resets at midnight UTC: try again after that.';
 }
 if(status===426)return 'LinkedIn refused the API version used by CamMicGo: try again later.';
 return 'LinkedIn answered HTTP '+status+'.';
}

/** Checks a post before anything is sent: text length, one media or one link, file type and size. */
export function checkPost(o:{text:string;media?:{kind:MediaKind;mime?:string|null;bytes?:number};link?:{url:string}}){
 const text=o.text.trim();
 if(!text)return {error:'empty_text'};
 if(text.length>LI_TEXT_MAX)return {error:'text_too_long',messageForUser:'LinkedIn accepts at most '+LI_TEXT_MAX+' characters per post.'};
 if(o.media&&o.link)return {error:'media_or_link',messageForUser:'A post can carry one image or video, or one link preview, not both.'};
 if(o.link){try{const u=new URL(o.link.url);if(u.protocol!=='https:'&&u.protocol!=='http:')throw 0;}catch{return {error:'invalid_link'};}}
 if(o.media?.mime){
  const ok=o.media.kind==='IMAGE'?/^image\/(jpeg|png|gif)$/.test(o.media.mime):/^video\/(mp4|quicktime|x-ms-asf|x-flv|mpeg|webm|x-matroska)$/.test(o.media.mime);
  if(!ok)return {error:'unsupported_media',messageForUser:o.media.kind==='IMAGE'?'Images must be JPEG, PNG or GIF.':'Videos must be MP4 (or another common video format).'};
 }
 const max=o.media?.kind==='VIDEO'?LI_VIDEO_MAX:LI_IMAGE_MAX;
 if(o.media?.bytes&&o.media.bytes>max)return {error:'file_too_large',messageForUser:'At most '+Math.round(max/1048576)+' MB for '+(o.media.kind==='VIDEO'?'a video':'an image')+'.'};
 return {ok:true as const,text};
}

/** Days left before the 60-day LinkedIn token expires (reconnect then). */
export const daysLeft=(expiresAt:number,now=Date.now())=>Math.max(0,Math.floor((expiresAt-now)/86_400_000));

/** Plain state for assistants and the app: queued, running (picked up by the phone), stalled, done, error, expired. */
export function jobState(j:{status:string;error:string|null;claimed_at:string|null},now=Date.now()){
 if(j.status==='pending')return 'queued';
 if(j.status==='claimed')return j.claimed_at&&now-Date.parse(j.claimed_at)>4*60_000?'stalled':'running';
 if(j.status==='error'&&/^expired/.test(j.error??''))return 'expired';
 return j.status;
}
