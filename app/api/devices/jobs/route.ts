import {NextRequest,NextResponse} from 'next/server';
import {claimJob,deviceFromAuthorization,touchDevice} from '@/lib/device-relay';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
/** Paired device polls this: marks it online and hands it the next transcript job, if any. */
export async function GET(req:NextRequest){
 try{
  const device=await deviceFromAuthorization(req.headers.get('authorization'));
  if(!device)return NextResponse.json({error:'Appareil non appairé ou révoqué'},{status:401,headers:noStore});
  await touchDevice(device.id);
  const job=req.nextUrl.searchParams.get('claim')==='0'?null:await claimJob(device);
  return NextResponse.json({device:{id:device.id,name:device.name},job:job?{id:job.id,videoId:job.video_id,language:job.language}:null,pollAfterMs:job?3000:4000},{headers:noStore});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Relay unavailable'},{status:503,headers:noStore})}
}
