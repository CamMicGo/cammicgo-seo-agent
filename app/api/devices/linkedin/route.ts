import {NextRequest,NextResponse} from 'next/server';
import {deviceFromAuthorization,sb,touchDevice} from '@/lib/device-relay';
import {claimLinkedIn,finishLinkedIn} from '@/lib/linkedin-relay';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{
  const device=await deviceFromAuthorization(req.headers.get('authorization'));
  if(!device)return NextResponse.json({error:'Unauthorized'},{status:401});
  await touchDevice(device.id);
  // Only the LinkedIn control polls this route: it proves the app is open with the control allowed.
  await sb('/rest/v1/cmg_devices?id=eq.'+device.id,{method:'PATCH',body:JSON.stringify({linkedin_seen_at:new Date().toISOString()})}).catch(()=>{});
  const job=await claimLinkedIn(device.user_id,device.id);
  return NextResponse.json({job:job?{id:job.id,operation:job.operation,...job.payload}:null},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unavailable'},{status:503});}
}
export async function POST(req:NextRequest){
 try{
  const device=await deviceFromAuthorization(req.headers.get('authorization'));
  if(!device)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await req.text();
  if(body.length>250000)return NextResponse.json({error:'Result too large'},{status:413});
  const data=JSON.parse(body);
  if(typeof data.id!=='string'||(data.error!==undefined&&typeof data.error!=='string'))return NextResponse.json({error:'Invalid payload'},{status:400});
  const ok=await finishLinkedIn(device.id,data.id,data.result,data.error);
  return NextResponse.json({ok},{status:ok?200:409});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unavailable'},{status:503});}
}
