import {NextRequest,NextResponse} from 'next/server';
import {verifySupabaseMcpUser} from '@/lib/supabase-mcp-auth';
import {readGoogle,readDriveWrite} from '@/lib/mcp-google-store';
import {isDriveWriteScope} from '@/lib/google-scopes';
import {clientSummary,deleteClient,isAdmin,REMOTE_REDIRECT_URI,saveClient,usageToday,validateClient,verifyClientWithGoogle} from '@/lib/account';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};

async function user(req:NextRequest){return verifySupabaseMcpUser(req.headers.get('authorization'));}
function sameOrigin(req:NextRequest){const o=req.headers.get('origin');return !o||o===req.nextUrl.origin;}

/** Account overview for the signed-in user: Google Cloud client (never the secret), Google link, today's MCP usage. */
export async function GET(req:NextRequest){
 const u=await user(req);if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 try{
  const admin=await isAdmin(u.id);
  const [client,session,usage,write]=await Promise.all([clientSummary(u.id),readGoogle(u.id).catch(()=>null),usageToday(u.id,admin),readDriveWrite(u.id).catch(()=>null)]);
  const googleMode=session?.credentials.mode??null;
  // Drive writing: the separate write grant (Google refuses drive.file with YouTube), or an older main grant that already had it.
  const usable=<T extends {credentials:{mode:string}}>(x:T|null)=>x&&(admin||x.credentials.mode==='byo')?x:null;
  const driveWriteScopes=[...new Set([...(usable(session)?.scopes??[]),...(usable(write)?.scopes??[])].filter(isDriveWriteScope))];
  return NextResponse.json({admin,client,redirectUri:REMOTE_REDIRECT_URI,google:{connected:!!session&&(admin||googleMode==='byo'),mode:googleMode,scopes:session?.scopes??null,driveWrite:driveWriteScopes.length?driveWriteScopes:null},usage},{headers:noStore});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'unavailable'},{status:503,headers:noStore})}
}

/** Saves the user's own Google Cloud OAuth client after checking the ID/secret pair with Google. */
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'origin'},{status:403,headers:noStore});
 const u=await user(req);if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 const body=await req.json().catch(()=>({}));
 const c=validateClient(body);
 if('error' in c)return NextResponse.json({error:c.error},{status:400,headers:noStore});
 const check=await verifyClientWithGoogle(c.clientId,c.clientSecret);
 if(check==='invalid_client')return NextResponse.json({error:'google_rejected_client'},{status:400,headers:noStore});
 try{await saveClient(u.id,c,check==='ok');return NextResponse.json({ok:true,verified:check==='ok',client:await clientSummary(u.id)},{headers:noStore});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'unavailable'},{status:503,headers:noStore})}
}

/** Removes the stored client and the Google connection made with it. */
export async function DELETE(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'origin'},{status:403,headers:noStore});
 const u=await user(req);if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 try{await deleteClient(u.id);return NextResponse.json({ok:true},{headers:noStore});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'unavailable'},{status:503,headers:noStore})}
}
