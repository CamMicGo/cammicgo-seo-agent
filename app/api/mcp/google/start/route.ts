import {NextRequest,NextResponse} from 'next/server';
import {createHash,randomBytes} from 'node:crypto';
import {encrypt,STATE_COOKIE,cookieOptions,type Credentials,type Pending} from '@/lib/google-session';
import {verifySupabaseMcpUser} from '@/lib/supabase-mcp-auth';
import {googleOAuthCallback} from '@/lib/oauth-callback';
export async function POST(req:NextRequest){
 const user=await verifySupabaseMcpUser(req.headers.get('authorization'));
 if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Origin mismatch'},{status:403});
 const payload=await req.json().catch(()=>({})) as {authorizationId?:string;mode?:string;clientId?:string;clientSecret?:string;scopes?:string[]};
 const byo=payload.mode==='byo';
 if(payload.mode&&payload.mode!=='byo'&&payload.mode!=='shared')return NextResponse.json({error:'Invalid OAuth mode'},{status:400});
 const clientId=byo?payload.clientId?.trim():process.env.GOOGLE_CLIENT_ID;
 const clientSecret=byo?payload.clientSecret:process.env.GOOGLE_CLIENT_SECRET;
 if(!clientId||!clientSecret)return NextResponse.json({error:'Google OAuth credentials missing'},{status:400});
 if(byo&&(!clientId.endsWith('.apps.googleusercontent.com')||clientId.length>250||clientSecret.length>700))return NextResponse.json({error:'Invalid Google OAuth client credentials'},{status:400});
 const allowedScopes=["https://www.googleapis.com/auth/webmasters.readonly","https://www.googleapis.com/auth/analytics.readonly","https://www.googleapis.com/auth/youtube.readonly","https://www.googleapis.com/auth/calendar.readonly","https://www.googleapis.com/auth/gmail.readonly","https://www.googleapis.com/auth/drive.readonly","https://www.googleapis.com/auth/documents.readonly","https://www.googleapis.com/auth/spreadsheets.readonly","https://www.googleapis.com/auth/presentations.readonly","https://www.googleapis.com/auth/tasks.readonly","https://www.googleapis.com/auth/contacts.readonly","https://www.googleapis.com/auth/classroom.courses.readonly","https://www.googleapis.com/auth/chat.spaces.readonly","https://www.googleapis.com/auth/script.projects.readonly"];
 const scopes=payload.scopes?.length?payload.scopes:['https://www.googleapis.com/auth/webmasters.readonly','https://www.googleapis.com/auth/analytics.readonly','https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/calendar.readonly'];
 if(!Array.isArray(scopes)||scopes.length>allowedScopes.length||scopes.some(scope=>!allowedScopes.includes(scope)))return NextResponse.json({error:'Unsupported Google API scope'},{status:400});
 const state=randomBytes(24).toString('hex'),verifier=randomBytes(32).toString('base64url');
 const credentials:Credentials={clientId,clientSecret,mode:byo?'byo':'shared'};
 const pending:Pending&{mcpUserId:string;authorizationId?:string}={state,verifier,credentials,issuedAt:Date.now(),mcpUserId:user.id,authorizationId:payload.authorizationId};
 const challenge=createHash('sha256').update(verifier).digest('base64url');
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:clientId,redirect_uri:googleOAuthCallback(),response_type:'code',scope:scopes.join(' '),access_type:'offline',include_granted_scopes:'true',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();
 const result=NextResponse.json({url:url.toString()});
 result.cookies.set(STATE_COOKIE,encrypt(pending),{...cookieOptions,maxAge:600});
 return result;
}