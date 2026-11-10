import {NextRequest,NextResponse} from 'next/server';
import {claimJob,claimNotebookJob,deviceFromAuthorization,deviceProgress,pruneRelayPayloads,touchDevice,touchRelay,sb} from '@/lib/device-relay';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
/** Paired device polls this: marks it online and hands it the next transcript job, if any.
 * localAsr:true tells the app this server labels phone transcripts and accepts progress pings. */
export async function GET(req:NextRequest){
 try{
  const device=await deviceFromAuthorization(req.headers.get('authorization'));
  if(!device)return NextResponse.json({error:'Appareil non appairé ou révoqué'},{status:401,headers:noStore});
  await touchDevice(device.id);
  // Transient relay payloads are purged; local APK history is unaffected.
  await pruneRelayPayloads().catch(()=>{});
  const claiming=req.nextUrl.searchParams.get('claim')!=='0';
  await touchRelay(device.id,claiming,Number(req.nextUrl.searchParams.get('pausedUntil'))||null).catch(()=>{});
  const notebook=claiming?await claimNotebookJob(device).catch(()=>null):null;
  const job=claiming&&!notebook?await claimJob(device):null;
  const transcriptAgent=job?await sb<Array<{agent_name:string|null}>>('/rest/v1/cmg_transcript_jobs?id=eq.'+job.id+'&user_id=eq.'+device.user_id+'&select=agent_name').then(rows=>rows[0]?.agent_name||'Assistant inconnu').catch(()=> 'Assistant inconnu'):null;
  const progress=await deviceProgress(device.user_id).catch(()=>null);
  // A LinkedIn command waiting for the app (peek only, never claimed here): the background relay notifies the user.
  const liNext=await import('@/lib/linkedin-relay').then(m=>m.peekLinkedIn(device.user_id)).catch(()=>null);
  return NextResponse.json({device:{id:device.id,name:device.name},linkedin:liNext?{next:{id:liNext.id,operation:liNext.operation,participant:liNext.participant,file:liNext.file,agentName:liNext.agent,createdAt:liNext.created_at,expiresAt:liNext.expires_at}}:{next:null},job:notebook?{id:notebook.id,type:'notebooklm_'+notebook.operation,...notebook.payload}:job?{id:job.id,type:'transcript',videoId:job.video_id,language:job.language,agentName:transcriptAgent,localAsr:true}:null,progress,pollAfterMs:job?1500:4000},{headers:noStore});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Relay unavailable'},{status:503,headers:noStore})}
}
