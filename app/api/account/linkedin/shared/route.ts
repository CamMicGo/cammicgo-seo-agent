import {NextRequest,NextResponse} from 'next/server';
import {verifySupabaseMcpUser} from '@/lib/supabase-mcp-auth';
import {isAdmin} from '@/lib/account';
import {shareOwnClient,unshareClient} from '@/lib/social-store';
import {linkedinStatus} from '@/lib/linkedin-account';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};

/**
 * Administrators only: share the LinkedIn app saved in their own account with every CamMicGo user (POST),
 * or stop sharing it (DELETE). Users still authorize with their own LinkedIn account and only post on their
 * own profile; existing connections keep working until they expire.
 */
async function admin(req:NextRequest){
 const o=req.headers.get('origin');if(o&&o!==req.nextUrl.origin)return {error:NextResponse.json({error:'origin'},{status:403,headers:noStore})};
 const u=await verifySupabaseMcpUser(req.headers.get('authorization'));if(!u)return {error:NextResponse.json({error:'unauthorized'},{status:401,headers:noStore})};
 if(!await isAdmin(u.id).catch(()=>false))return {error:NextResponse.json({error:'admin_only'},{status:403,headers:noStore})};
 return {user:u};
}
export async function POST(req:NextRequest){
 const a=await admin(req);if('error' in a)return a.error;
 try{
  if(!await shareOwnClient(a.user.id,'linkedin'))return NextResponse.json({error:'no_own_app'},{status:400,headers:noStore});
  return NextResponse.json({ok:true,...await linkedinStatus(a.user.id)},{headers:noStore});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'unavailable'},{status:503,headers:noStore});}
}
export async function DELETE(req:NextRequest){
 const a=await admin(req);if('error' in a)return a.error;
 try{await unshareClient('linkedin');return NextResponse.json({ok:true,...await linkedinStatus(a.user.id)},{headers:noStore});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'unavailable'},{status:503,headers:noStore});}
}
