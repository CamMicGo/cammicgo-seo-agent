import {NextRequest,NextResponse} from 'next/server';
import {verifySupabaseMcpUser} from '@/lib/supabase-mcp-auth';
import {sb} from '@/lib/device-relay';
import {scoreAnswer,taskById} from '@/lib/benchmark';
export const runtime='nodejs';
export const maxDuration=60;
const noStore={'Cache-Control':'no-store'};
const sameOrigin=(req:NextRequest)=>{const o=req.headers.get('origin');return !o||o===req.nextUrl.origin;};
type Row={id:string;task_id:string;mode:'web'|'cammicgo';assistant:string;duration_ms:number;started_at:string|null;metrics:Record<string,unknown>;mcp_calls:Record<string,unknown>|null;created_at:string};

/** The signed-in user's benchmark runs (answers are not returned, only metrics). */
export async function GET(req:NextRequest){
 const u=await verifySupabaseMcpUser(req.headers.get('authorization'));if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 const rows=await sb<Row[]>('/rest/v1/cmg_benchmark_runs?user_id=eq.'+u.id+'&select=id,task_id,mode,assistant,duration_ms,started_at,metrics,mcp_calls,created_at&order=created_at.desc&limit=300');
 return NextResponse.json({runs:rows},{headers:noStore});
}

/** Scores and stores one run: task, mode (web | cammicgo), assistant, measured duration and the pasted answer. */
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'origin'},{status:403,headers:noStore});
 const u=await verifySupabaseMcpUser(req.headers.get('authorization'));if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 const b=await req.json().catch(()=>({})) as {taskId?:string;mode?:string;assistant?:string;durationMs?:number;startedAt?:string;answer?:string};
 const task=taskById(String(b.taskId??''));
 if(!task||(b.mode!=='web'&&b.mode!=='cammicgo'))return NextResponse.json({error:'invalid_task_or_mode'},{status:400,headers:noStore});
 const answer=String(b.answer??'').slice(0,100_000);const duration=Math.round(Number(b.durationMs));
 if(answer.trim().length<20||!Number.isFinite(duration)||duration<1000||duration>6*3600_000)return NextResponse.json({error:'invalid_answer_or_duration'},{status:400,headers:noStore});
 const assistant=String(b.assistant??'other').replace(/[^\w .+-]/g,'').slice(0,40)||'other';
 const started=b.startedAt&&!Number.isNaN(Date.parse(b.startedAt))?new Date(b.startedAt):null;
 let keys={};try{const {userKeys}=await import('@/lib/science-keys');keys=await userKeys(u.id);}catch{/* optional */}
 const metrics=await scoreAnswer(task.id,answer,keys).catch(e=>({error:e instanceof Error?e.message:'scoring failed'}));
 let mcp:Record<string,unknown>|null=null;
 if(started){
  const until=new Date(started.getTime()+duration+15_000).toISOString();
  const calls=await sb<Array<{tool:string;ms:number;ok:boolean}>>('/rest/v1/cmg_mcp_calls?user_id=eq.'+u.id+'&at=gte.'+encodeURIComponent(new Date(started.getTime()-5_000).toISOString())+'&at=lte.'+encodeURIComponent(until)+'&select=tool,ms,ok&limit=500').catch(()=>[]);
  const tools:Record<string,number>={};for(const c of calls)tools[c.tool]=(tools[c.tool]??0)+1;
  mcp={calls:calls.length,serverMs:calls.reduce((a,c)=>a+c.ms,0),failed:calls.filter(c=>!c.ok).length,tools};
 }
 const rows=await sb<Row[]>('/rest/v1/cmg_benchmark_runs',{method:'POST',prefer:'return=representation',body:JSON.stringify({user_id:u.id,task_id:task.id,mode:b.mode,assistant,duration_ms:duration,started_at:started?.toISOString()??null,answer,metrics,mcp_calls:mcp})});
 return NextResponse.json({run:rows?.[0]??null},{headers:noStore});
}

export async function DELETE(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'origin'},{status:403,headers:noStore});
 const u=await verifySupabaseMcpUser(req.headers.get('authorization'));if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 const id=req.nextUrl.searchParams.get('id')??'';if(!/^[0-9a-f-]{36}$/.test(id))return NextResponse.json({error:'invalid_id'},{status:400,headers:noStore});
 await sb('/rest/v1/cmg_benchmark_runs?id=eq.'+id+'&user_id=eq.'+u.id,{method:'DELETE'});
 return NextResponse.json({ok:true},{headers:noStore});
}
