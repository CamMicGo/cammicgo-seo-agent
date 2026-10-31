import {NextRequest,NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {verifySupabaseMcpUser} from '@/lib/supabase-mcp-auth';
import {encrypt,cookieOptions} from '@/lib/google-session';
import {socialClient} from '@/lib/social-store';
import {authorizeUrl} from '@/lib/linkedin';
export const runtime='nodejs';
const LI_STATE_COOKIE='cmg_li_pending';

/** Starts "Connect LinkedIn" with the user's own LinkedIn app; the callback checks this state. */
export async function POST(req:NextRequest){
 const user=await verifySupabaseMcpUser(req.headers.get('authorization'));
 if(!user)return NextResponse.json({error:'unauthorized'},{status:401});
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'origin'},{status:403});
 const client=await socialClient(user.id,'linkedin');
 if(!client)return NextResponse.json({error:'linkedin_app_missing'},{status:400});
 const state=randomBytes(24).toString('hex');
 const res=NextResponse.json({url:authorizeUrl(client.clientId,state)});
 res.cookies.set(LI_STATE_COOKIE,encrypt({state,userId:user.id,issuedAt:Date.now()}),{...cookieOptions,maxAge:600});
 return res;
}
