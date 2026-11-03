import {NextRequest,NextResponse} from 'next/server';
import {deviceFromAuthorization,sb} from '@/lib/device-relay';
export const runtime='nodejs';
export const maxDuration=60;
const noStore={'Cache-Control':'no-store'};
/** Device uploads one completed NotebookLM artifact to private, per-user storage.
 *  No Google cookies, bearer tokens or signed media URLs are persisted. */
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Invalid job ID'},{status:400,headers:noStore});
  const device=await deviceFromAuthorization(req.headers.get('authorization'));
  if(!device)return NextResponse.json({error:'Device not paired'},{status:401,headers:noStore});
  const jobs=await sb<Array<{id:string;operation:string;status:string;device_id:string;user_id:string}>>(
   '/rest/v1/cmg_notebook_jobs?id=eq.'+id+'&user_id=eq.'+device.user_id+
   '&device_id=eq.'+device.id+'&status=eq.claimed&operation=eq.artifact_download_binary&select=id,operation,status,device_id,user_id');
  if(jobs.length!==1)return NextResponse.json({error:'No matching claimed download job'},{status:403,headers:noStore});
  const mime=req.headers.get('content-type')||'';
  const extensions:Record<string,string>={'audio/mp4':'m4a','video/mp4':'mp4','application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','text/markdown':'md','text/plain':'txt','application/json':'json','application/vnd.openxmlformats-officedocument.presentationml.presentation':'pptx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx'};
  if(!extensions[mime])return NextResponse.json({error:'Unsupported artifact MIME type'},{status:415,headers:noStore});
  const length=Number(req.headers.get('content-length')||0);
  if(!Number.isSafeInteger(length)||length<=0||length>15_000_000)
   return NextResponse.json({error:'Artifact must be 1-15 MB'},{status:413,headers:noStore});
  const bytes=await req.arrayBuffer();
  if(bytes.byteLength!==length)return NextResponse.json({error:'Incomplete artifact'},{status:400,headers:noStore});
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!key)throw new Error('Storage credentials unavailable');
  const path=device.user_id+'/'+id+'/artifact.'+extensions[mime];
  const base=process.env.SUPABASE_URL||'https://vfngxjsryklqldarkxhy.supabase.co';
  const upload=await fetch(base+'/storage/v1/object/cmg-notebook-artifacts/'+path,{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':mime,'x-upsert':'false'},
   body:bytes,signal:AbortSignal.timeout(45000)});
  if(!upload.ok)return NextResponse.json({error:'Private artifact upload failed: '+upload.status},{status:502,headers:noStore});
  return NextResponse.json({ok:true,storagePath:path,bytes:bytes.byteLength,mime},{headers:noStore});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Artifact upload failed'},{status:503,headers:noStore});}
}
