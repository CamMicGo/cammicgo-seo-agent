import {NextRequest,NextResponse} from 'next/server';
import {verifySupabaseMcpUser} from '@/lib/supabase-mcp-auth';
import {readGoogle,consumeQuota} from '@/lib/mcp-google-store';
import {isAdmin} from '@/lib/account';
import {authorizedAccessToken,googleFetch} from '@/lib/google-session';
import {computeQuota,driveError,DRIVE_API,DRIVE_READ_SCOPE,DRIVE_FULL_SCOPE,DRIVE_FILE_SCOPE,type StorageQuota} from '@/lib/google-drive';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};

/** Real Google storage figures for the signed-in user's own Google connection (no figures are ever invented). */
export async function GET(req:NextRequest){
 const u=await verifySupabaseMcpUser(req.headers.get('authorization'));
 if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 try{
  const admin=await isAdmin(u.id);
  const session=await readGoogle(u.id);
  if(!session||!(admin||session.credentials.mode==='byo'))return NextResponse.json({connected:false,reason:'google_not_connected'},{headers:noStore});
  const scopes=session.scopes??[];
  const driveScopes={read:scopes.includes(DRIVE_READ_SCOPE)||scopes.includes(DRIVE_FULL_SCOPE),write:scopes.includes(DRIVE_FILE_SCOPE)||scopes.includes(DRIVE_FULL_SCOPE)};
  if(session.scopes&&!driveScopes.read&&!driveScopes.write)return NextResponse.json({connected:true,drive:false,reason:'missing_drive_permission',driveScopes},{headers:noStore});
  if(!await consumeQuota(u.id,2000))return NextResponse.json({connected:true,drive:true,reason:'quota_exceeded'},{status:429,headers:noStore});
  const {token}=await authorizedAccessToken(session);
  const r=await googleFetch(DRIVE_API+'/about?fields=storageQuota,user(emailAddress)',token);
  const body=await r.json().catch(()=>({})) as {storageQuota?:StorageQuota;user?:{emailAddress?:string}};
  if(!r.ok){const e=driveError(r.status,body);return NextResponse.json({connected:true,drive:e.error!=='missing_google_permission',reason:e.error,messageForUser:'messageForUser' in e?e.messageForUser:null,driveScopes},{headers:noStore});}
  return NextResponse.json({connected:true,drive:true,account:body.user?.emailAddress??null,driveScopes,quota:computeQuota(body.storageQuota),checkedAt:new Date().toISOString()},{headers:noStore});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'unavailable'},{status:503,headers:noStore})}
}
