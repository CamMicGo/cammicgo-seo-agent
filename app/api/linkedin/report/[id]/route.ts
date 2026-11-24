import {randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {sb} from '@/lib/device-relay';
import {deleteReport,loadReport,THUMB_TTL_MS} from '@/lib/linkedin-relay';
import {reportHtml} from '@/lib/linkedin-reactions';
import {CAMMICGO_LOGO_PNG,LINKEDIN_LOGO_PNG,REACTION_PNG} from '@/lib/linkedin-reaction-icons';
export const runtime='nodejs';

/**
 * Private, unguessable, 24-hour report of a LinkedIn post. ?download=html returns a self-contained file
 * (photos and reaction pictures embedded) that keeps working after the 24 hours; "Export PDF" prints the page.
 */
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const m=id.match(/^([0-9a-f-]{36})\.([0-9a-f-]{36})$/i);
 const report=m?await loadReport(m[1],m[2]):null;
 if(!report)return new NextResponse('Ce rapport a expiré (24 h) ou n’existe pas.',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 const base=process.env.APP_BASE_URL||'https://seo.cammicgo.com';
 const logo='data:image/png;base64,'+LINKEDIN_LOGO_PNG;
 const brandLogo='data:image/png;base64,'+CAMMICGO_LOGO_PNG;
 const reactionImg=(t:string)=>REACTION_PNG[t]?'data:image/png;base64,'+REACTION_PNG[t]:'';
 if(req.nextUrl.searchParams.get('download')==='html'){
  // Embed the hosted photos so the file does not depend on links that expire.
  const json=JSON.stringify(report);
  const ids=[...new Set([...json.matchAll(/\/api\/linkedin\/thumb\/([0-9a-f-]{36})\.jpg/gi)].map(x=>x[1]))].slice(0,700);
  const images:Record<string,string>={};
  const since=new Date(Date.now()-THUMB_TTL_MS).toISOString();
  for(let i=0;i<ids.length;i+=80){
   const chunk=ids.slice(i,i+80);
   const rows=await sb<Array<{id:string;jpeg_b64:string}>>('/rest/v1/cmg_linkedin_thumbs?id=in.('+chunk.join(',')+')&created_at=gt.'+encodeURIComponent(since)+'&select=id,jpeg_b64').catch(()=>[]);
   for(const r of rows)images[base+'/api/linkedin/thumb/'+r.id+'.jpg']='data:image/jpeg;base64,'+r.jpeg_b64;
  }
  const html=reportHtml(report,base,{logo,brandLogo,images,reactionImg,interactive:true});
  return new NextResponse(html,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':'attachment; filename="rapport-post-linkedin.html"','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
 }
 const nonce=randomBytes(16).toString('base64');
 const html=reportHtml(report,base,{logo,brandLogo,nonce,downloadUrl:req.nextUrl.pathname+'?download=html',reactionImg});
 return new NextResponse(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Content-Security-Policy':`default-src 'none'; img-src ${base} data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`}});
}

/** "Supprimer maintenant": removes the report and the photos it uses, right away. */
export async function DELETE(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const m=id.match(/^([0-9a-f-]{36})\.([0-9a-f-]{36})$/i);
 if(!m)return new NextResponse(null,{status:404});
 const ok=await deleteReport(m[1],m[2]);
 return new NextResponse(null,{status:ok?204:404,headers:{'Cache-Control':'no-store'}});
}
