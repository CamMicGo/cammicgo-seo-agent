import {NextRequest,NextResponse} from 'next/server';
import {claimJob,claimNotebookJob,deviceFromAuthorization,deviceProgress,pruneRelayPayloads,touchDevice} from '@/lib/device-relay';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
/** Paired device polls this: marks it online and hands it the next transcript job, if any. */
export async function GET(req:NextRequest){
 try{
  const device=await deviceFromAuthorization(req.headers.get('authorization'));
  if(!device)return NextResponse.json({error:'Appareil non appairé ou révoqué'},{status:401,headers:noStore});
  await touchDevice(device.id);
  // Transient relay payloads are purged; local APK history is unaffected.
  void pruneRelayPayloads().catch(()=>{});
  const claiming=req.nextUrl.searchParams.get('claim')!=='0';
  const notebook=claiming?await claimNotebookJob(device).catch(()=>null):null;
  const job=claiming&&!notebook?await claimJob(device):null;
  const progress=await deviceProgress(device.user_id).catch(()=>null);
  return NextResponse.json({device:{id:device.id,name:device.name},job:notebook?{id:notebook.id,type:'notebooklm_'+notebook.operation,...notebook.payload}:job?{id:job.id,type:'transcript',videoId:job.video_id,language:job.language}:null,progress,pollAfterMs:job?1500:4000},{headers:noStore});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Relay unavailable'},{status:503,headers:noStore})}
}
