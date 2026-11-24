import {NextRequest,NextResponse} from 'next/server';
import {purgeExpiredLinkedIn} from '@/lib/linkedin-relay';
export const runtime='nodejs';
export const maxDuration=60;

/** Daily cleanup (Vercel Cron and GitHub Actions). It only deletes data that has already expired. */
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(secret&&req.headers.get('authorization')!=='Bearer '+secret)return new NextResponse('Unauthorized',{status:401});
 const out=await purgeExpiredLinkedIn();
 return NextResponse.json({ok:true,...out},{headers:{'Cache-Control':'no-store'}});
}
