import {NextRequest,NextResponse} from 'next/server';
import {createHash,randomBytes} from 'node:crypto';
import {encrypt,STATE_COOKIE,cookieOptions,type Credentials,type Pending} from '@/lib/google-session';
import {verifySupabaseMcpUser} from '@/lib/supabase-mcp-auth';
import {googleOAuthCallback} from '@/lib/oauth-callback';
export async function POST(req:NextRequest){
 const user=await verifySupabaseMcpUser(req.headers.get('authorization'));
 if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Origin mismatch'},{status:403});
 const clientId=process.env.GOOGLE_CLIENT_ID,clientSecret=process.env.GOOGLE_CLIENT_SECRET;
 if(!clientId||!clientSecret)return NextResponse.json({error:'Google not configured'},{status:503});
 const state=randomBytes(24).toString('hex'),verifier=randomBytes(32).toString('base64url');
 const credentials:Credentials={clientId,clientSecret,mode:'shared'};
 const pending:Pending&{mcpUserId:string}={state,verifier,credentials,issuedAt:Date.now(),mcpUserId:user.id};
 const challenge=createHash('sha256').update(verifier).digest('base64url');
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:clientId,redirect_uri:googleOAuthCallback(),response_type:'code',scope:'https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/calendar.readonly',access_type:'offline',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();
 const result=NextResponse.json({url:url.toString()});
 result.cookies.set(STATE_COOKIE,encrypt(pending),{...cookieOptions,maxAge:600});
 return result;
}