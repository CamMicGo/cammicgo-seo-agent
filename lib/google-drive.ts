/**
 * Google Drive helpers for the remote MCP (pure functions: no network, no secrets, unit-tested in
 * tests/google-drive.test.ts). Reading uses the drive.readonly scope already offered on /account;
 * writing uses drive.file (only files and folders created by CamMicGo, or opened with it).
 */
export const DRIVE_API='https://www.googleapis.com/drive/v3';
export const DRIVE_UPLOAD_API='https://www.googleapis.com/upload/drive/v3';
export const DRIVE_READ_SCOPE='https://www.googleapis.com/auth/drive.readonly';
export const DRIVE_FILE_SCOPE='https://www.googleapis.com/auth/drive.file';
export const DRIVE_FULL_SCOPE='https://www.googleapis.com/auth/drive';
export const FOLDER_MIME='application/vnd.google-apps.folder';

const num=(name:string,fallback:number)=>{const v=Number(process.env[name]);return Number.isFinite(v)&&v>0?v:fallback;};
/** Resource limits (free Vercel/Supabase plans): override with environment variables if needed. */
export const DRIVE_LIMITS={
 maxDownloadBytes:num('DRIVE_MAX_DOWNLOAD_BYTES',10*1024*1024), // files read by drive_read_file (PDF, text…)
 maxResponseChars:num('DRIVE_MAX_RESPONSE_CHARS',30000),          // text returned per drive_read_file call
 maxUploadBytes:num('DRIVE_MAX_UPLOAD_BYTES',3*1024*1024),        // inline uploads (Vercel request bodies are capped at 4.5 MB)
 maxExportUploadBytes:num('DRIVE_MAX_EXPORT_UPLOAD_BYTES',20*1024*1024), // CamMicGo documents sent to Drive
 resumableAboveBytes:5*1024*1024,
 maxPageSize:100,
};

export const FILE_FIELDS='id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,driveId,trashed,capabilities(canEdit,canAddChildren),owners(displayName,emailAddress)';

/** Friendly type names accepted by the tools, mapped to Drive MIME types. */
export const MIME_ALIASES:Record<string,string[]>={
 folder:[FOLDER_MIME],
 document:['application/vnd.google-apps.document'],
 spreadsheet:['application/vnd.google-apps.spreadsheet'],
 presentation:['application/vnd.google-apps.presentation'],
 pdf:['application/pdf'],
 text:['text/plain'],
 csv:['text/csv'],
 json:['application/json'],
 markdown:['text/markdown','text/x-markdown'],
 image:['image/'],
 video:['video/'],
 audio:['audio/'],
};

export const ORDER_BY={name:'folder,name',name_desc:'folder,name desc',modified:'modifiedTime desc',modified_asc:'modifiedTime',created:'createdTime desc',created_asc:'createdTime'} as const;
export type DriveOrder=keyof typeof ORDER_BY;

/** Drive file and folder IDs: letters, digits, - and _ ; 'root' is the user's My Drive. */
export function isDriveId(v:string){return v==='root'||/^[A-Za-z0-9_-]{10,200}$/.test(v);}

/** Escapes a value placed between single quotes in a Drive query. */
export function escapeQuery(v:string){return v.replace(/\\/g,'\\\\').replace(/'/g,"\\'");}

function mimeClause(type:string){
 const list=MIME_ALIASES[type]??[type];
 const parts=list.map(m=>m.endsWith('/')?"mimeType contains '"+escapeQuery(m)+"'":"mimeType = '"+escapeQuery(m)+"'");
 return parts.length>1?'('+parts.join(' or ')+')':parts[0];
}

export type ListOptions={folderId?:string;kind?:'all'|'files'|'folders';includeTrashed?:boolean};
export function buildListQuery(o:ListOptions){
 const q:string[]=[];
 if(o.folderId)q.push("'"+escapeQuery(o.folderId)+"' in parents");
 if(o.kind==='folders')q.push("mimeType = '"+FOLDER_MIME+"'");
 if(o.kind==='files')q.push("mimeType != '"+FOLDER_MIME+"'");
 if(!o.includeTrashed)q.push('trashed = false');
 return q.join(' and ');
}

export type SearchOptions={name?:string;fullText?:string;type?:string;folderId?:string;modifiedAfter?:string;modifiedBefore?:string;includeTrashed?:boolean};
export function buildSearchQuery(o:SearchOptions){
 const q:string[]=[];
 if(o.name)q.push("name contains '"+escapeQuery(o.name)+"'");
 if(o.fullText)q.push("fullText contains '"+escapeQuery(o.fullText)+"'");
 if(o.type)q.push(mimeClause(o.type));
 if(o.folderId)q.push("'"+escapeQuery(o.folderId)+"' in parents");
 if(o.modifiedAfter)q.push("modifiedTime > '"+escapeQuery(o.modifiedAfter)+"'");
 if(o.modifiedBefore)q.push("modifiedTime < '"+escapeQuery(o.modifiedBefore)+"'");
 if(!o.includeTrashed)q.push('trashed = false');
 return q.join(' and ');
}

/** Query string for files.list, always paginated and limited to the fields we return. */
export function listParams(q:string,pageSize:number,orderBy:DriveOrder,pageToken?:string,sharedDrives=true,driveId?:string){
 const p=new URLSearchParams({q,pageSize:String(Math.min(Math.max(1,pageSize),DRIVE_LIMITS.maxPageSize)),fields:'nextPageToken,incompleteSearch,files('+FILE_FIELDS+')',spaces:'drive'});
 // fullText searches cannot be ordered by Drive (relevance order is used).
 if(!q.includes('fullText contains'))p.set('orderBy',ORDER_BY[orderBy]);
 if(pageToken)p.set('pageToken',pageToken);
 if(sharedDrives){p.set('supportsAllDrives','true');p.set('includeItemsFromAllDrives','true');}
 if(driveId){p.set('corpora','drive');p.set('driveId',driveId);}
 else if(sharedDrives)p.set('corpora','allDrives');
 return p;
}

export function humanBytes(n:number|null|undefined){
 if(n==null||!Number.isFinite(n))return null;
 const u=['B','KB','MB','GB','TB','PB'];let i=0,v=n;
 while(v>=1024&&i<u.length-1){v/=1024;i++;}
 return (i===0?String(v):v.toFixed(v>=100?0:v>=10?1:2))+' '+u[i];
}

export type DriveFile={id:string;name:string;mimeType:string;size?:string;createdTime?:string;modifiedTime?:string;parents?:string[];webViewLink?:string;driveId?:string;trashed?:boolean;capabilities?:{canEdit?:boolean;canAddChildren?:boolean};owners?:Array<{displayName?:string;emailAddress?:string}>};
/** Compact, model-friendly view of a Drive file. */
export function slimFile(f:DriveFile){
 const bytes=f.size!=null?Number(f.size):null;
 return {id:f.id,name:f.name,kind:f.mimeType===FOLDER_MIME?'folder':'file',mimeType:f.mimeType,
  sizeBytes:bytes,size:humanBytes(bytes),createdTime:f.createdTime??null,modifiedTime:f.modifiedTime??null,
  parents:f.parents??[],sharedDriveId:f.driveId??null,owner:f.owners?.[0]?.displayName??null,
  link:f.webViewLink??null,readable:readPlan(f.mimeType).mode!=='unsupported'};
}

export type ReadPlan={mode:'export';exportMime:string;note?:string}|{mode:'media';text:true}|{mode:'pdf'}|{mode:'unsupported';reason:string};
const TEXT_MIME=/^(text\/|application\/(json|xml|javascript|x-javascript|x-sh|x-yaml|yaml|x-ndjson|sql|ld\+json|rtf)$)/;
/** How drive_read_file turns a Drive file into text. */
export function readPlan(mimeType:string):ReadPlan{
 switch(mimeType){
  case 'application/vnd.google-apps.document':return {mode:'export',exportMime:'text/plain'};
  case 'application/vnd.google-apps.spreadsheet':return {mode:'export',exportMime:'text/csv',note:'Google Sheets export as CSV contains the first sheet only.'};
  case 'application/vnd.google-apps.presentation':return {mode:'export',exportMime:'text/plain'};
  case 'application/vnd.google-apps.script':return {mode:'export',exportMime:'application/vnd.google-apps.script+json'};
  case FOLDER_MIME:return {mode:'unsupported',reason:'This is a folder: use drive_list_files with folderId.'};
  case 'application/pdf':return {mode:'pdf'};
 }
 if(mimeType.startsWith('application/vnd.google-apps.'))return {mode:'unsupported',reason:'This Google file type ('+mimeType.split('.').pop()+') cannot be exported as text.'};
 if(TEXT_MIME.test(mimeType))return {mode:'media',text:true};
 return {mode:'unsupported',reason:'Unsupported format for text reading ('+mimeType+'). Supported: Google Docs, Sheets (first sheet as CSV), Slides, PDF, and text files (TXT, CSV, JSON, Markdown, XML, HTML…).'};
}

/** Returns one bounded window of a long text; nextOffset lets the agent continue. */
export function sliceText(text:string,offset=0,maxChars=DRIVE_LIMITS.maxResponseChars){
 const start=Math.max(0,Math.min(offset,text.length));
 const limit=Math.max(1000,Math.min(maxChars,DRIVE_LIMITS.maxResponseChars*2));
 let end=Math.min(text.length,start+limit);
 // Prefer to cut at a line break so the next window starts cleanly.
 if(end<text.length){const nl=text.lastIndexOf('\n',end);if(nl>start+limit*0.6)end=nl+1;}
 return {text:text.slice(start,end),offset:start,returnedChars:end-start,totalChars:text.length,nextOffset:end<text.length?end:null,complete:end>=text.length};
}

export type StorageQuota={limit?:string;usage?:string;usageInDrive?:string;usageInDriveTrash?:string};
/** Storage gauge values from about.get; never invents a capacity when Google returns no limit. */
export function computeQuota(q:StorageQuota|undefined){
 const n=(v?:string)=>v!=null&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
 const limit=n(q?.limit),usage=n(q?.usage),inDrive=n(q?.usageInDrive),trash=n(q?.usageInDriveTrash);
 const remaining=limit!=null&&usage!=null?Math.max(0,limit-usage):null;
 const percent=limit!=null&&limit>0&&usage!=null?Math.round(usage/limit*1000)/10:null;
 return {
  limitBytes:limit,usageBytes:usage,usageInDriveBytes:inDrive,usageInDriveTrashBytes:trash,remainingBytes:remaining,percentUsed:percent,
  limit:humanBytes(limit),usage:humanBytes(usage),usageInDrive:humanBytes(inDrive),usageInDriveTrash:humanBytes(trash),remaining:humanBytes(remaining),
  unlimited:limit==null,
  note:limit==null?'Google returned no storage limit for this account (unlimited or pooled organization storage): percentage and remaining space are not applicable.'
   :'The quota is shared between Google Drive, Gmail and Google Photos.',
 };
}

/** Readable error for Drive API failures (403, 404, 429, quotas, API disabled). */
export function driveError(status:number,body:unknown){
 const raw=JSON.stringify(body??{});
 const reason=(/"reason":"([A-Za-z]+)"/.exec(raw)?.[1])??null;
 if(status===401)return {error:'google_session_expired',status,messageForUser:'Your Google connection expired. Reconnect Google on https://seo.cammicgo.com/account.'};
 if(status===404)return {error:'not_found',status,messageForUser:'File or folder not found, or this Google account has no access to it.'};
 if(status===429||reason==='rateLimitExceeded'||reason==='userRateLimitExceeded')return {error:'rate_limited',status,reason,messageForUser:'Google Drive is rate-limiting requests. Wait a minute and try again.'};
 if(reason==='accessNotConfigured'||raw.includes('SERVICE_DISABLED')||raw.includes('has not been used in project'))return {error:'drive_api_disabled',status,reason,messageForUser:'The Google Drive API is not enabled in your Google Cloud project. Enable "Google Drive API" in the Google Cloud console (APIs & Services > Library), wait a minute, then try again.'};
 if(reason==='storageQuotaExceeded')return {error:'storage_full',status,reason,messageForUser:'Your Google storage is full: free some space in Drive, Gmail or Photos.'};
 if(reason==='exportSizeLimitExceeded')return {error:'export_too_large',status,reason,messageForUser:'This Google file is too large to be exported as text (Google limit: 10 MB).'};
 if(status===403&&(raw.includes('SCOPE_INSUFFICIENT')||reason==='insufficientPermissions'||raw.includes('insufficient authentication scopes')))return {error:'missing_google_permission',status,reason};
 if(status===403)return {error:'forbidden',status,reason,messageForUser:'Google Drive refused the operation: this account does not have the required rights on this file or folder.'};
 return {error:'drive_request_failed',status,reason};
}

/** Names Drive accepts: not empty, no control characters, at most 255 characters. */
export function cleanName(v:string){
 const s=v.replace(/[\u0000-\u001f\u007f]/g,'').trim();
 return s.length>0&&s.length<=255?s:null;
}

/** Adds " (2)", " (3)"… before the extension until the name is free. */
export function uniqueName(name:string,taken:Set<string>){
 if(!taken.has(name))return name;
 const dot=name.lastIndexOf('.');
 const base=dot>0?name.slice(0,dot):name,ext=dot>0?name.slice(dot):'';
 for(let i=2;i<1000;i++){const c=base+' ('+i+')'+ext;if(!taken.has(c))return c;}
 return base+' ('+Date.now()+')'+ext;
}

/** multipart/related body for a simple (non-resumable) upload. */
export function multipartBody(metadata:object,content:Buffer,mimeType:string,boundary:string){
 return Buffer.concat([
  Buffer.from('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: '+mimeType+'\r\n\r\n'),
  content,
  Buffer.from('\r\n--'+boundary+'--'),
 ]);
}
