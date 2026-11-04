import {NextRequest,NextResponse} from 'next/server';
import {deviceFromAuthorization,sb} from '@/lib/device-relay';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:NextRequest){
 try{
  const device=await deviceFromAuthorization(req.headers.get('authorization'));
  if(!device)return NextResponse.json({error:'Unauthorized'},{status:401});
  const id=req.headers.get('x-linkedin-job')||'';
  const index=Number(req.headers.get('x-image-index')||'0');
  if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isInteger(index)||index<0||index>=12)return NextResponse.json({error:'Invalid job/image'},{status:400});
  const jobs=await sb<Array<{id:string}>>('/rest/v1/cmg_linkedin_jobs?id=eq.'+id+'&user_id=eq.'+device.user_id+'&device_id=eq.'+device.id+'&status=eq.claimed&operation=eq.thread&select=id');
  if(!jobs.length)return NextResponse.json({error:'No claimed thread job'},{status:403});
  const mime=(req.headers.get('content-type')||'').split(';')[0].toLowerCase();
  const ext:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
  if(!ext[mime])return NextResponse.json({error:'Unsupported image type'},{status:415});
  const size=Number(req.headers.get('content-length')||'0');
  if(!Number.isSafeInteger(size)||size<1||size>5_000_000)return NextResponse.json({error:'Image exceeds 5MB'},{status:413});
  const bytes=await req.arrayBuffer();
  if(bytes.byteLength!==size)return NextResponse.json({error:'Incomplete image'},{status:400});
  const b=new Uint8Array(bytes);
  const valid=mime==='image/png'?b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71:mime==='image/jpeg'?b[0]===255&&b[1]===216:mime==='image/gif'?b[0]===71&&b[1]===73&&b[2]===70:mime==='image/webp'?b[0]===82&&b[1]===73&&b[2]===70&&b[3]===70:false;
  if(!valid)return NextResponse.json({error:'Invalid image bytes'},{status:415});
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!key)throw Error('Storage unavailable');
  const base=process.env.SUPABASE_URL||'https://vfngxjsryklqldarkxhy.supabase.co';
  const storagePath=device.user_id+'/'+id+'/linkedin-'+index+'.'+ext[mime];
  const upload=await fetch(base+'/storage/v1/object/cmg-notebook-artifacts/'+storagePath,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':mime,'x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(45000)});
  if(!upload.ok)return NextResponse.json({error:'Private upload HTTP '+upload.status},{status:502});
  return NextResponse.json({storagePath,mime,bytes:size});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Upload failed'},{status:503});}
}
