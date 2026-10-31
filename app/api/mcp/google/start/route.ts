import {NextRequest,NextResponse} from 'next/server';
import {encrypt,STATE_COOKIE,cookieOptions,type Credentials} from '@/lib/google-session';
import {googleAuthRequest,splitScopes} from '@/lib/google-oauth-url';
import {verifySupabaseMcpUser} from '@/lib/supabase-mcp-auth';
import {clientCredentials,isAdmin} from '@/lib/account';
const ALLOWED_SCOPES=["https://www.googleapis.com/auth/webmasters.readonly","https://www.googleapis.com/auth/analytics.readonly","https://www.googleapis.com/auth/youtube.readonly","https://www.googleapis.com/auth/calendar.readonly","https://www.googleapis.com/auth/gmail.readonly","https://www.googleapis.com/auth/drive.readonly","https://www.googleapis.com/auth/drive.file","https://www.googleapis.com/auth/drive","https://www.googleapis.com/auth/documents.readonly","https://www.googleapis.com/auth/spreadsheets.readonly","https://www.googleapis.com/auth/presentations.readonly","https://www.googleapis.com/auth/tasks.readonly","https://www.googleapis.com/auth/contacts.readonly","https://www.googleapis.com/auth/classroom.courses.readonly","https://www.googleapis.com/auth/chat.spaces.readonly","https://www.googleapis.com/auth/script.projects.readonly","https://www.googleapis.com/auth/adwords"];
const DEFAULT_SCOPES=ALLOWED_SCOPES.slice(0,4);
/**
 * Starts Google OAuth for the signed-in CamMicGo user. External users always use their own Google Cloud
 * client, saved beforehand on /account (the secret never travels through this request); only
 * administrators may use the shared CamMicGo project.
 */
export async function POST(req:NextRequest){
 const user=await verifySupabaseMcpUser(req.headers.get('authorization'));
 if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Origin mismatch'},{status:403});
 const payload=await req.json().catch(()=>({})) as {authorizationId?:string;mode?:string;scopes?:string[];returnTo?:string};
 if(payload.mode&&payload.mode!=='byo'&&payload.mode!=='shared')return NextResponse.json({error:'Invalid OAuth mode'},{status:400});
 let credentials:Credentials|null;
 if(payload.mode==='shared'){
  if(!await isAdmin(user.id))return NextResponse.json({error:'byo_required'},{status:403});
  const id=process.env.GOOGLE_CLIENT_ID,secret=process.env.GOOGLE_CLIENT_SECRET;
  credentials=id&&secret?{mode:'shared',clientId:id,clientSecret:secret}:null;
 }else{
  const own=await clientCredentials(user.id);
  credentials=own?{mode:'byo',clientId:own.clientId,clientSecret:own.clientSecret}:null;
  if(!credentials)return NextResponse.json({error:'byo_missing'},{status:400});
 }
 if(!credentials)return NextResponse.json({error:'Google OAuth credentials missing'},{status:400});
 const scopes=payload.scopes?.length?payload.scopes:DEFAULT_SCOPES;
 if(!Array.isArray(scopes)||scopes.length>ALLOWED_SCOPES.length||scopes.some(scope=>!ALLOWED_SCOPES.includes(scope)))return NextResponse.json({error:'Unsupported Google API scope'},{status:400});
 const returnTo=payload.returnTo==='/account'?'/account':undefined;
 // Drive writing (drive.file / drive) is granted separately: Google refuses it together with YouTube scopes.
 const {main,write}=splitScopes(scopes);
 const first=main.length?{scopes:main,kind:'main' as const,followUp:write.length?write:undefined}:{scopes:write,kind:'drive_write' as const,followUp:undefined};
 const {url,pending}=googleAuthRequest(credentials,first.scopes,{mcpUserId:user.id,authorizationId:payload.authorizationId,returnTo,kind:first.kind,followUp:first.followUp});
 const result=NextResponse.json({url,steps:first.followUp?2:1});
 result.cookies.set(STATE_COOKIE,encrypt(pending),{...cookieOptions,maxAge:600});
 return result;
}
