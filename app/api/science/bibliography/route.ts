import {NextRequest,NextResponse} from 'next/server';
import {EXPORT_FORMATS,renderExport,type ExportFormat,type WorkSort} from '@/lib/science';
import {cachedBibliography,checkExport,sorted,type ExportParams} from '@/lib/science-export';
export const runtime='nodejs';
export const maxDuration=60;

/** Stable, signed bibliography export (BibTeX, RIS, CSV, Markdown, CSL-JSON): always regenerated from OpenAlex (+ HAL). */
export async function GET(req:NextRequest){
 const g=(k:string)=>req.nextUrl.searchParams.get(k)??undefined;
 const p:ExportParams={a:g('a')??'',f:(g('f')??'') as ExportFormat,s:(g('s')??'newest') as WorkSort,from:g('from'),to:g('to'),q:g('q'),h:g('h') as '0'|'1'|undefined,u:g('u')};
 if(!/^A\d{4,12}(,A\d{4,12}){0,4}$/i.test(p.a)||!(p.f in EXPORT_FORMATS)||!['newest','oldest','citations','title'].includes(p.s))return NextResponse.json({error:'invalid_parameters'},{status:400});
 if(!checkExport(p,req.nextUrl.searchParams.get('sig')))return NextResponse.json({error:'invalid_signature'},{status:403});
 let keys={};
 if(p.u&&/^[0-9a-f-]{36}$/.test(p.u)){try{const {userKeys}=await import('@/lib/science-keys');keys=await userKeys(p.u);}catch{/* keys are optional */}}
 try{
  const b=await cachedBibliography(p.a.split(','),keys,{from:p.from,to:p.to,query:p.q,includeHal:p.h!=='0'});
  const name=b.profiles[0]?.name??'author';
  const body=renderExport(p.f,sorted(b.works,p.s),'Publications — '+name+(p.q?' ('+p.q+')':''));
  const file=name.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase()+'-publications.'+EXPORT_FORMATS[p.f].ext;
  return new NextResponse(body,{headers:{'Content-Type':EXPORT_FORMATS[p.f].mime,'Content-Disposition':'inline; filename="'+file+'"','Cache-Control':'public, max-age=600, s-maxage=3600','X-Works-Count':String(b.works.length)}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'unavailable'},{status:e instanceof Error&&e.message==='author_not_found'?404:503});}
}
