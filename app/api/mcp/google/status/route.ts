import {NextRequest,NextResponse} from 'next/server';
import {verifySupabaseMcpUser} from '@/lib/supabase-mcp-auth';
import {readGoogle} from '@/lib/mcp-google-store';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const user=await verifySupabaseMcpUser(req.headers.get('authorization'));
 if(!user)return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{return NextResponse.json({connected:!!(await readGoogle(user.id))},{headers:{'Cache-Control':'no-store'}})}
 catch{return NextResponse.json({error:'Connection status unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
