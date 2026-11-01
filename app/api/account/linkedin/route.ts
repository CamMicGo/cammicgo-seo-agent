import {NextRequest,NextResponse} from 'next/server';
import {verifySupabaseMcpUser} from '@/lib/supabase-mcp-auth';
import {deleteSocialClient,deleteSocialConnection,saveSocialClient} from '@/lib/social-store';
import {LI_REDIRECT,LI_TOKEN,validateLinkedInClient} from '@/lib/linkedin';
import {linkedinStatus as status} from '@/lib/linkedin-account';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
async function user(req:NextRequest){return verifySupabaseMcpUser(req.headers.get('authorization'));}
function sameOrigin(req:NextRequest){const o=req.headers.get('origin');return !o||o===req.nextUrl.origin;}

/**
 * Checks the client ID / secret pair with LinkedIn without any user data: a dummy code is refused with
 * "invalid_client" when the pair is wrong, and with another error when the pair is right.
 */
async function verifyWithLinkedIn(clientId:string,clientSecret:string):Promise<'ok'|'invalid_client'|'unknown'>{
 try{
  const r=await fetch(LI_TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code:'cammicgo-verification',client_id:clientId,client_secret:clientSecret,redirect_uri:LI_REDIRECT}),cache:'no-store',signal:AbortSignal.timeout(8000)});
  const b=await r.json().catch(()=>({})) as {error?:string};
  if(b.error==='invalid_client'||b.error==='unauthorized_client')return 'invalid_client';
  return b.error?'ok':'unknown';
 }catch{return 'unknown';}
}

/** LinkedIn status for the signed-in user (never the secret or the token). */
export async function GET(req:NextRequest){
 const u=await user(req);if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 try{return NextResponse.json(await status(u.id),{headers:noStore});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'unavailable'},{status:503,headers:noStore});}
}

/** Saves the user's own LinkedIn app (client ID and secret) after checking the pair with LinkedIn. */
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'origin'},{status:403,headers:noStore});
 const u=await user(req);if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 const c=validateLinkedInClient(await req.json().catch(()=>({})));
 if('error' in c)return NextResponse.json({error:c.error},{status:400,headers:noStore});
 const check=await verifyWithLinkedIn(c.clientId,c.clientSecret);
 if(check==='invalid_client')return NextResponse.json({error:'linkedin_rejected_client'},{status:400,headers:noStore});
 try{await saveSocialClient(u.id,'linkedin',c,check==='ok');return NextResponse.json({ok:true,verified:check==='ok',...await status(u.id)},{headers:noStore});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'unavailable'},{status:503,headers:noStore});}
}

/** ?what=connection disconnects the profile; ?what=all also removes the stored app credentials. */
export async function DELETE(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'origin'},{status:403,headers:noStore});
 const u=await user(req);if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 try{
  if(req.nextUrl.searchParams.get('what')==='all')await deleteSocialClient(u.id,'linkedin');else await deleteSocialConnection(u.id,'linkedin');
  return NextResponse.json({ok:true,...await status(u.id)},{headers:noStore});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'unavailable'},{status:503,headers:noStore});}
}
