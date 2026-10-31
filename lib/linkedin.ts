/**
 * LinkedIn publishing on the member's own profile ("Share on LinkedIn" + "Sign In with LinkedIn using
 * OpenID Connect", the self-serve products every developer app can add). Each user brings their own
 * LinkedIn app (client ID and secret). Pure helpers, unit-tested: no network, no secrets.
 */
export const LI_AUTHORIZE='https://www.linkedin.com/oauth/v2/authorization';
export const LI_TOKEN='https://www.linkedin.com/oauth/v2/accessToken';
export const LI_API='https://api.linkedin.com/v2';
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

export type LinkedInSession={accessToken:string;expiresAt:number;scopes:string[];memberId:string;name:string;email?:string|null};
export const personUrn=(memberId:string)=>'urn:li:person:'+memberId;
export const postUrl=(urn:string)=>'https://www.linkedin.com/feed/update/'+encodeURIComponent(urn)+'/';

export type MediaKind='IMAGE'|'VIDEO';
export function registerUploadBody(author:string,kind:MediaKind){
 return {registerUploadRequest:{recipes:['urn:li:digitalmediaRecipe:feedshare-'+(kind==='IMAGE'?'image':'video')],owner:author,
  serviceRelationships:[{relationshipType:'OWNER',identifier:'urn:li:userGeneratedContent'}]}};
}

/** Upload address from registerUpload: accepted only on https LinkedIn hosts, the only place the member token may go. */
export function uploadTarget(raw:string|undefined){
 if(!raw)return null;
 try{const u=new URL(raw);if(u.protocol!=='https:')return null;return u.hostname==='linkedin.com'||u.hostname.endsWith('.linkedin.com')?{url:u.toString()}:null;}catch{return null;}
}

export type PostInput={author:string;text:string;visibility:'PUBLIC'|'CONNECTIONS';media?:{kind:MediaKind;asset:string;title?:string};link?:{url:string;title?:string;description?:string}};
/** ugcPosts body for a text post, optionally with one image or video, or a link preview. */
export function ugcPostBody(p:PostInput){
 const share:Record<string,unknown>={shareCommentary:{text:p.text},shareMediaCategory:p.media?p.media.kind:p.link?'ARTICLE':'NONE'};
 if(p.media)share.media=[{status:'READY',media:p.media.asset,...(p.media.title?{title:{text:p.media.title}}:{})}];
 else if(p.link)share.media=[{status:'READY',originalUrl:p.link.url,...(p.link.title?{title:{text:p.link.title}}:{}),...(p.link.description?{description:{text:p.link.description}}:{})}];
 return {author:p.author,lifecycleState:'PUBLISHED',specificContent:{'com.linkedin.ugc.ShareContent':share},visibility:{'com.linkedin.ugc.MemberNetworkVisibility':p.visibility}};
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
