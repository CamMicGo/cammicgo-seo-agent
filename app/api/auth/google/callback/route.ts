import {NextRequest,NextResponse} from 'next/server';
import {decrypt,encrypt,STATE_COOKIE,SESSION_COOKIE,cookieOptions,type GoogleSession} from '@/lib/google-session';
import {googleOAuthCallback} from '@/lib/oauth-callback';
import {googleAuthRequest,type LinkedPending} from '@/lib/google-oauth-url';
export const runtime='nodejs';

/**
 * Google OAuth callback. A grant is either the main one (all read APIs) or the separate Drive write grant
 * (drive.file / drive), which Google refuses to combine with YouTube scopes. When the user asked for both,
 * the main grant is followed immediately by a second Google screen for Drive writing.
 */
export async function GET(req:NextRequest){
 const pending=decrypt<LinkedPending>(req.cookies.get(STATE_COOKIE)?.value);
 const state=req.nextUrl.searchParams.get('state');const code=req.nextUrl.searchParams.get('code');const error=req.nextUrl.searchParams.get('error');
 const back=(p:LinkedPending|null,status:'connected'|'denied'|'partial')=>{
  if(!p?.mcpUserId)return status==='denied'?'/connect?error=denied':'/dashboard';
  if(p.returnTo==='/account'&&!p.authorizationId)return '/account?google='+status;
  return '/oauth/consent'+(p.authorizationId?'?authorization_id='+encodeURIComponent(p.authorizationId):'?reauth=google');
 };
 if(error){const r=NextResponse.redirect(new URL(back(pending,pending?.kind==='drive_write'&&pending.chained?'partial':'denied'),req.url));r.cookies.set(STATE_COOKIE,'',{...cookieOptions,maxAge:0});return r;}
 if(!pending||!state||state!==pending.state||Date.now()-pending.issuedAt>600000||!code)return NextResponse.json({error:'Invalid or expired OAuth state. Restart Google connection.'},{status:400});
 const token=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({code,client_id:pending.credentials.clientId,client_secret:pending.credentials.clientSecret,redirect_uri:googleOAuthCallback(),grant_type:'authorization_code',code_verifier:pending.verifier}),cache:'no-store'});
 if(!token.ok)return NextResponse.json({error:'Google rejected the OAuth code; verify redirect URI and GCP settings.'},{status:502});
 const data=await token.json();
 if(!data.access_token)return NextResponse.json({error:'Missing Google access token'},{status:502});
 const session:GoogleSession={credentials:pending.credentials,accessToken:data.access_token,refreshToken:data.refresh_token,scopes:typeof data.scope==='string'?data.scope.split(' '):undefined,expiresAt:Date.now()+Number(data.expires_in||3600)*1000};
 const store=await import('@/lib/mcp-google-store');
 if(pending.mcpUserId){
  if(pending.kind==='drive_write')await store.saveDriveWrite(pending.mcpUserId,session);
  else await store.saveGoogle(pending.mcpUserId,session);
 }
 // Second step: Drive writing, in its own grant.
 if(pending.mcpUserId&&pending.kind!=='drive_write'&&pending.followUp?.length){
  const next=googleAuthRequest(pending.credentials,pending.followUp,{mcpUserId:pending.mcpUserId,authorizationId:pending.authorizationId,returnTo:pending.returnTo,kind:'drive_write',chained:true});
  const res=NextResponse.redirect(next.url);
  res.cookies.set(STATE_COOKIE,encrypt(next.pending),{...cookieOptions,maxAge:600});
  res.cookies.set(SESSION_COOKIE,encrypt(session),cookieOptions);
  return res;
 }
 const result=NextResponse.redirect(new URL(back(pending,'connected'),req.url));
 result.cookies.set(STATE_COOKIE,'',{...cookieOptions,maxAge:0});
 if(pending.kind!=='drive_write')result.cookies.set(SESSION_COOKIE,encrypt(session),cookieOptions);
 return result;
}
