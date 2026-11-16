import {NextRequest,NextResponse} from 'next/server';
import {verifySupabaseMcpUser} from '@/lib/supabase-mcp-auth';
import {encrypt,STATE_COOKIE,cookieOptions,type Credentials} from '@/lib/google-session';
import {googleAuthRequest} from '@/lib/google-oauth-url';
import {YOUTUBE_CHANNEL_SCOPES} from '@/lib/google-scopes';
import {readGoogle,listYouTube,deleteYouTube} from '@/lib/mcp-google-store';
import {clientCredentials,isAdmin} from '@/lib/account';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
const user=(req:NextRequest)=>verifySupabaseMcpUser(req.headers.get('authorization'));
const sameOrigin=(req:NextRequest)=>{const o=req.headers.get('origin');return !o||o===req.nextUrl.origin;};

/**
 * YouTube channels connected for the YouTube tools, besides the channel of the main Google connection. Each one is
 * a separate YouTube-only Google authorization, so brand channels can be added; the assistant asks which one to use.
 */
export async function GET(req:NextRequest){
 const u=await user(req);if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 const list=await listYouTube(u.id).catch(()=>[]);
 return NextResponse.json({channels:list.map(c=>({id:c.channelId,title:c.channelTitle}))},{headers:noStore});
}

/** Adds a channel: YouTube-only authorization with Google's account chooser (brand accounts are listed there). */
export async function POST(req:NextRequest){
 const u=await user(req);if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 if(!sameOrigin(req))return NextResponse.json({error:'origin_mismatch'},{status:403,headers:noStore});
 const admin=await isAdmin(u.id).catch(()=>false);
 // Same Google Cloud project as the main connection; otherwise the user's own client (the shared project is for administrators).
 const main=await readGoogle(u.id).catch(()=>null);
 let credentials:Credentials|null=main&&(admin||main.credentials.mode==='byo')?main.credentials:null;
 if(!credentials){const own=await clientCredentials(u.id);credentials=own?{mode:'byo',clientId:own.clientId,clientSecret:own.clientSecret}:null;}
 if(!credentials)return NextResponse.json({error:'byo_missing'},{status:400,headers:noStore});
 const {url,pending}=googleAuthRequest(credentials,YOUTUBE_CHANNEL_SCOPES,{mcpUserId:u.id,returnTo:'/account',kind:'youtube_channel'});
 const r=NextResponse.json({url},{headers:noStore});
 r.cookies.set(STATE_COOKIE,encrypt(pending),{...cookieOptions,maxAge:600});
 return r;
}

/** Removes one connected channel (?channel=UC…). The main Google connection is not touched. */
export async function DELETE(req:NextRequest){
 const u=await user(req);if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 if(!sameOrigin(req))return NextResponse.json({error:'origin_mismatch'},{status:403,headers:noStore});
 const channel=req.nextUrl.searchParams.get('channel')||'';
 if(!/^UC[\w-]{22}$/.test(channel))return NextResponse.json({error:'invalid_channel'},{status:400,headers:noStore});
 await deleteYouTube(u.id,channel);
 return NextResponse.json({removed:channel},{headers:noStore});
}
