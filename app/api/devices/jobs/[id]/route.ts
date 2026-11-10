import {NextRequest,NextResponse} from 'next/server';
import {completeJob,completeNotebookJob,deviceFromAuthorization,progressJob,releaseJob,sanitizeDeviceResult} from '@/lib/device-relay';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
/** Device posts {result} (transcript JSON), {error}, {release} or {progress} (long local transcription) for a job it claimed. */
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const length=Number(req.headers.get('content-length')||0);
 if(length>4_400_000)return NextResponse.json({error:'Result too large'},{status:413,headers:noStore});
 try{
  const device=await deviceFromAuthorization(req.headers.get('authorization'));
  if(!device)return NextResponse.json({error:'Appareil non appairé ou révoqué'},{status:401,headers:noStore});
  const body=await req.json().catch(()=>null) as {result?:unknown;error?:unknown;videoId?:unknown}|null;
  if(!body)return NextResponse.json({error:'Invalid body'},{status:400,headers:noStore});
  if((body as {type?:unknown}).type==='notebooklm'){
   const result=body.result;
   const safe=JSON.stringify(result??null);
   if(safe.length>100000)return NextResponse.json({error:'Notebook result too large'},{status:413,headers:noStore});
   const ok=await completeNotebookJob(device,id,typeof body.error==='string'?{error:body.error}:{result});
   return ok?NextResponse.json({ok:true},{headers:noStore}):NextResponse.json({error:'Notebook job unavailable'},{status:409,headers:noStore});
  }
  let ok:boolean;
  if((body as {progress?:unknown}).progress!==undefined)ok=await progressJob(device,id,(body as {progress?:unknown}).progress);
  else if((body as {release?:unknown}).release===true)ok=await releaseJob(device,id);
  else if(typeof body.error==='string')ok=await completeJob(device,id,{error:body.error});
  else{
   const videoId=typeof body.result==='object'&&body.result&&typeof (body.result as {videoId?:unknown}).videoId==='string'?(body.result as {videoId:string}).videoId:'';
   const result=sanitizeDeviceResult(body.result,videoId);
   ok=result?await completeJob(device,id,{result}):await completeJob(device,id,{error:'Résultat de transcription vide ou invalide'});
  }
  return ok?NextResponse.json({ok:true},{headers:noStore}):NextResponse.json({error:'Job inconnu, expiré ou déjà traité'},{status:409,headers:noStore});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Relay unavailable'},{status:503,headers:noStore})}
}
