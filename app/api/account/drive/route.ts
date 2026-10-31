import {NextRequest,NextResponse} from 'next/server';
import {verifySupabaseMcpUser} from '@/lib/supabase-mcp-auth';
import {readGoogle,readDriveWrite,consumeQuota} from '@/lib/mcp-google-store';
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
  const allowed=<T extends {credentials:{mode:string}}>(s:T|null)=>s&&(admin||s.credentials.mode==='byo')?s:null;
  const main=allowed(await readGoogle(u.id));
  // Drive writing has its own Google grant (Google refuses drive.file together with YouTube scopes).
  const write=allowed(await readDriveWrite(u.id).catch(()=>null));
  if(!main&&!write)return NextResponse.json({connected:false,reason:'google_not_connected'},{headers:noStore});
  const has=(sc:string[]|undefined,...want:string[])=>!!sc&&want.some(w=>sc.includes(w));
  const scopes=[...(main?.scopes??[]),...(write?.scopes??[])];
  const driveScopes={read:has(scopes,DRIVE_READ_SCOPE,DRIVE_FULL_SCOPE),write:has(scopes,DRIVE_FILE_SCOPE,DRIVE_FULL_SCOPE)};
  const session=main&&(!main.scopes||has(main.scopes,DRIVE_READ_SCOPE,DRIVE_FULL_SCOPE,DRIVE_FILE_SCOPE))?main:write??main!;
  if(session.scopes&&!driveScopes.read&&!driveScopes.write)return NextResponse.json({connected:true,drive:false,reason:'missing_drive_permission',driveScopes},{headers:noStore});
  if(!await consumeQuota(u.id,2000))return NextResponse.json({connected:true,drive:true,reason:'quota_exceeded'},{status:429,headers:noStore});
  const {token}=await authorizedAccessToken(session);
  const r=await googleFetch(DRIVE_API+'/about?fields=storageQuota,user(emailAddress)',token);
  const body=await r.json().catch(()=>({})) as {storageQuota?:StorageQuota;user?:{emailAddress?:string}};
  if(!r.ok){const e=driveError(r.status,body);return NextResponse.json({connected:true,drive:e.error!=='missing_google_permission',reason:e.error,messageForUser:'messageForUser' in e?e.messageForUser:null,driveScopes},{headers:noStore});}
  return NextResponse.json({connected:true,drive:true,account:body.user?.emailAddress??null,driveScopes,quota:computeQuota(body.storageQuota),checkedAt:new Date().toISOString()},{headers:noStore});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'unavailable'},{status:503,headers:noStore})}
}
