import {NextRequest,NextResponse} from 'next/server';
import {sb} from '@/lib/device-relay';
import {THUMB_TTL_MS} from '@/lib/linkedin-relay';
export const runtime='nodejs';

/** Public, unguessable link to a LinkedIn photo/logo thumbnail, valid 24 hours (chat apps display https images only). */
export async function GET(_req:NextRequest,{params}:{params:Promise<{file:string}>}){
 const {file}=await params;
 const m=file.match(/^([0-9a-f-]{36})\.jpg$/i);
 if(!m)return new NextResponse('Not found',{status:404});
 const since=new Date(Date.now()-THUMB_TTL_MS).toISOString();
 const rows=await sb<Array<{jpeg_b64:string}>>('/rest/v1/cmg_linkedin_thumbs?id=eq.'+m[1]+'&created_at=gt.'+encodeURIComponent(since)+'&select=jpeg_b64').catch(()=>[]);
 if(!rows.length)return new NextResponse('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 return new NextResponse(Buffer.from(rows[0].jpeg_b64,'base64'),{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, max-age=3600','X-Robots-Tag':'noindex','Content-Disposition':'inline'}});
}
