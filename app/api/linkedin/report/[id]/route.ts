import {NextRequest,NextResponse} from 'next/server';
import {loadReport} from '@/lib/linkedin-relay';
import {reportHtml} from '@/lib/linkedin-reactions';
export const runtime='nodejs';

/** Private, unguessable, 24-hour visual report of a LinkedIn post (photos, reaction pictures, comments). */
export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const m=id.match(/^([0-9a-f-]{36})\.([0-9a-f-]{36})$/i);
 const report=m?await loadReport(m[1],m[2]):null;
 if(!report)return new NextResponse('Ce rapport a expiré (24 h) ou n’existe pas.',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 return new NextResponse(reportHtml(report),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; img-src https://seo.cammicgo.com data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
}
