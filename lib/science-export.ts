/**
 * Server-side helpers for bibliography exports: signed, stable URLs (no login needed, so NotebookLM,
 * Zotero or drive_upload_file can fetch them) and a short in-memory cache per server instance.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
import {authorBibliography,resolveAuthor,sortWorks,type AuthorProfile,type BibWork,type ExportFormat,type Keys,type WorkSort} from '@/lib/science';

export const EXPORT_BASE='https://seo.cammicgo.com/api/science/bibliography';
export type ExportParams={a:string;f:ExportFormat;s:WorkSort;from?:string;to?:string;q?:string;h?:'0'|'1';u?:string};
const ORDER:Array<keyof ExportParams>=['a','f','s','from','to','q','h','u'];
const canon=(p:ExportParams)=>ORDER.map(k=>k+'='+(p[k]??'')).join('&');
const key=()=>{const k=process.env.SESSION_ENCRYPTION_KEY;if(!k)throw Error('SESSION_ENCRYPTION_KEY not configured');return k;};
export function signExport(p:ExportParams){return createHmac('sha256',key()).update('biblio|'+canon(p)).digest('base64url').slice(0,24);}
export function exportUrl(p:ExportParams){
 const q=new URLSearchParams();for(const k of ORDER){const v=p[k];if(v)q.set(k,v);}q.set('sig',signExport(p));return EXPORT_BASE+'?'+q;
}
export function checkExport(p:ExportParams,sig:string|null){
 if(!sig)return false;const a=Buffer.from(signExport(p)),b=Buffer.from(sig);return a.length===b.length&&timingSafeEqual(a,b);
}

type Cached={at:number;profiles:AuthorProfile[];works:BibWork[];meta:{rawCount:number;openAlexTotal:number|null;halCount:number;halOnly:number;notes:string[]}};
const cache=new Map<string,Cached>();
/** Full de-duplicated bibliography for these OpenAlex author IDs, cached 10 minutes per server instance. */
export async function cachedBibliography(ids:string[],keys:Keys,o:{from?:string;to?:string;query?:string;includeHal?:boolean}){
 const k=JSON.stringify([ids.map(x=>x.toUpperCase()).sort(),o.from??'',o.to??'',o.query??'',o.includeHal!==false]);
 const hit=cache.get(k);if(hit&&Date.now()-hit.at<600_000)return hit;
 const res=await resolveAuthor(ids[0],ids.slice(1),keys);
 if(res.status!=='resolved')throw Error('author_not_found');
 const b=await authorBibliography(res.profiles,keys,o);
 const entry:Cached={at:Date.now(),profiles:res.profiles,works:b.works,meta:{rawCount:b.rawCount,openAlexTotal:b.openAlexTotal,halCount:b.halCount,halOnly:b.halOnly,notes:[...res.notes,...b.notes]}};
 if(cache.size>200)cache.clear();cache.set(k,entry);return entry;
}
export const sorted=(works:BibWork[],s:WorkSort)=>sortWorks(works,s);
