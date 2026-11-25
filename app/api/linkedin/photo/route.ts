import {NextRequest,NextResponse} from 'next/server';
import {verifyPhoto} from '@/lib/linkedin-photo';
export const runtime='nodejs';
/** A LinkedIn profile photo for a report page (signed links only; fetched on demand, never stored). */
export async function GET(req:NextRequest){
 const u=req.nextUrl.searchParams.get('u')||'',s=req.nextUrl.searchParams.get('s')||'';
 if(!verifyPhoto(u,s))return new NextResponse('Not found',{status:404});
 try{
  const r=await fetch(u,{signal:AbortSignal.timeout(6000),redirect:'error'});
  const type=(r.headers.get('content-type')||'').split(';')[0].trim();
  if(!r.ok||!/^image\/(jpeg|png|webp|gif)$/.test(type))return new NextResponse('Not found',{status:404});
  const buf=Buffer.from(await r.arrayBuffer());
  if(buf.length>300_000)return new NextResponse('Not found',{status:404});
  return new NextResponse(buf,{headers:{'Content-Type':type,'Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Content-Disposition':'inline'}});
 }catch{return new NextResponse('Unavailable',{status:502});}
}
