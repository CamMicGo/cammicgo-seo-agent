import {NextRequest,NextResponse} from 'next/server';
import {verifySupabaseMcpUser} from '@/lib/supabase-mcp-auth';
import {readDriveWrite,readGoogle} from '@/lib/mcp-google-store';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const user=await verifySupabaseMcpUser(req.headers.get('authorization'));
 if(!user)return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{const [session,write]=await Promise.all([readGoogle(user.id),readDriveWrite(user.id).catch(()=>null)]);
  // Drive writing is a separate grant (lib/google-scopes.ts): its scopes count as authorized too.
  const scopes=session?.scopes?[...new Set([...session.scopes,...(write?.scopes??[])])]:null;
  return NextResponse.json({connected:!!session,scopes},{headers:{'Cache-Control':'no-store'}})}
 catch{return NextResponse.json({error:'Connection status unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
