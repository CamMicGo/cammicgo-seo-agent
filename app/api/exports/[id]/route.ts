import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {buildDocument,exportKey,readExport} from '@/lib/channel-export';
export const runtime='nodejs';
export const maxDuration=60;
/** Public, key-protected Markdown export of a channel batch: one document to import as a single NotebookLM source. */
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const key=req.nextUrl.searchParams.get('key')||'';
 let expected='';try{expected=exportKey(id)}catch{return NextResponse.json({error:'Server not configured'},{status:503})}
 const ok=key.length===expected.length&&timingSafeEqual(Buffer.from(key),Buffer.from(expected));
 if(!ok)return NextResponse.json({error:'Not found'},{status:404});
 try{
  const exp=await readExport(id);if(!exp)return NextResponse.json({error:'Not found'},{status:404});
  const doc=await buildDocument(exp);
  const name=(exp.channel_title??exp.channel_id).replace(/[^\p{L}\p{N} _-]/gu,'').trim().replace(/\s+/g,'-')||'channel';
  const headers:Record<string,string>={'Content-Type':'text/markdown; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex'};
  if(req.nextUrl.searchParams.get('download')==='1')headers['Content-Disposition']=`attachment; filename="${name}-transcripts.md"`;
  return new NextResponse(doc,{headers});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Export unavailable'},{status:503})}
}
