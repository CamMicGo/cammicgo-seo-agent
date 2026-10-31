'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useLang,useT} from '../lang-provider';
import {benchCopy} from '@/lib/copy/benchmark';
import {supabaseBrowser,supabaseConfigured} from '@/lib/supabase-browser';

type L={fr:string;en:string};
type Task={id:string;title:L;prompt:L;skill:L};
type Metrics={identifiers?:number;verified?:number;invalid?:string[];onTarget?:number;offTarget?:number;recall?:number|null;referenceSize?:number|null;correct?:boolean|null;accuracy?:number|null;notes?:string[];error?:string};
type Run={id:string;task_id:string;mode:'web'|'cammicgo';assistant:string;duration_ms:number;metrics:Metrics;mcp_calls:{calls:number;serverMs:number}|null;created_at:string};
const ASSISTANTS=['ChatGPT','Claude','Gemini','Copilot','Perplexity','Mistral','Other'];
const fmt=(ms:number)=>{const s=Math.round(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const median=(a:number[])=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y);const m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2;};

export default function BenchmarkView(){
 const t=useT(benchCopy);const {lang}=useLang();const pick=(x:L)=>lang==='fr'?x.fr:x.en;
 const [token,setToken]=useState<string|null>(null);const [ready,setReady]=useState(false);
 const [tasks,setTasks]=useState<Task[]>([]);const [modes,setModes]=useState<{web:L;cammicgo:L}|null>(null);
 const [taskId,setTaskId]=useState('author-bibliography');const [mode,setMode]=useState<'web'|'cammicgo'>('web');const [assistant,setAssistant]=useState('ChatGPT');
 const [startedAt,setStartedAt]=useState<number|null>(null);const [elapsed,setElapsed]=useState(0);const [running,setRunning]=useState(false);
 const [answer,setAnswer]=useState('');const [busy,setBusy]=useState(false);const [msg,setMsg]=useState<string|null>(null);const [copied,setCopied]=useState(false);
 const [runs,setRuns]=useState<Run[]>([]);const tick=useRef<ReturnType<typeof setInterval>|null>(null);

 useEffect(()=>{void fetch('/api/benchmark/tasks').then(r=>r.json()).then((d:{tasks:Task[];modes:{web:L;cammicgo:L}})=>{setTasks(d.tasks);setModes(d.modes);});},[]);
 const loadRuns=useCallback(async(tk:string)=>{const r=await fetch('/api/benchmark/runs',{headers:{Authorization:'Bearer '+tk},cache:'no-store'});if(r.ok)setRuns(((await r.json()) as {runs:Run[]}).runs);},[]);
 useEffect(()=>{
  if(!supabaseConfigured){setReady(true);return;}
  const sb=supabaseBrowser();
  const apply=(s:{access_token:string}|null)=>{setToken(s?.access_token??null);if(s)void loadRuns(s.access_token);setReady(true);};
  void sb.auth.getSession().then(({data})=>apply(data.session));
  const {data:sub}=sb.auth.onAuthStateChange((_e,s)=>apply(s));return()=>sub.subscription.unsubscribe();
 },[loadRuns]);
 useEffect(()=>()=>{if(tick.current)clearInterval(tick.current);},[]);

 const task=tasks.find(x=>x.id===taskId);
 const prompt=task&&modes?pick(task.prompt)+'\n\n'+pick(modes[mode]):'';
 const start=()=>{const now=Date.now();setStartedAt(now-elapsed);setRunning(true);if(tick.current)clearInterval(tick.current);tick.current=setInterval(()=>setElapsed(Date.now()-(now-elapsed)),250);};
 const stop=()=>{if(tick.current)clearInterval(tick.current);setRunning(false);if(startedAt)setElapsed(Date.now()-startedAt);};
 const reset=()=>{if(tick.current)clearInterval(tick.current);setRunning(false);setElapsed(0);setStartedAt(null);};
 async function copyPrompt(){try{await navigator.clipboard.writeText(prompt);setCopied(true);setTimeout(()=>setCopied(false),1500);}catch{/* clipboard blocked */}}
 async function submit(){
  if(!token)return;setBusy(true);setMsg(null);
  const r=await fetch('/api/benchmark/runs',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({taskId,mode,assistant,durationMs:elapsed,startedAt:startedAt?new Date(startedAt).toISOString():null,answer})});
  setBusy(false);if(!r.ok){setMsg(t.error);return;}
  setAnswer('');reset();void loadRuns(token);
 }
 async function remove(id:string){if(!token)return;await fetch('/api/benchmark/runs?id='+id,{method:'DELETE',headers:{Authorization:'Bearer '+token}});void loadRuns(token);}

 const byTask=useMemo(()=>runs.filter(r=>r.task_id===taskId),[runs,taskId]);
 const med=(m:'web'|'cammicgo')=>median(byTask.filter(r=>r.mode===m).map(r=>r.duration_ms));
 const mw=med('web'),mc=med('cammicgo');
 const ratio=mw&&mc?(mw>=mc?{k:'faster',x:mw/mc}:{k:'slower',x:mc/mw}):null;
 const quality=(m:Metrics)=>m.error?'—':m.accuracy!=null?m.accuracy+' %':m.correct!=null?(m.correct?'✓':'✗'):m.recall!=null?m.recall+' %'+(m.referenceSize?' / '+m.referenceSize:''):'—';

 return <main className="bm">
  <span className="kicker">{t.kicker}</span><h1>{t.title}</h1><p className="lead">{t.lead}</p>
  <ol className="bm-steps"><li>{t.step1}</li><li>{t.step2}</li><li>{t.step3}</li><li>{t.step4}</li></ol>
  {ready&&!token&&<section className="acc-card"><p>{t.signIn}</p><Link className="acc-btn" href="/account">{t.account}</Link></section>}

  <section className="acc-card"><h2>{t.tasks}</h2>
   <div className="bm-tasks">{tasks.map(x=><button key={x.id} type="button" className={'bm-task'+(x.id===taskId?' on':'')} aria-pressed={x.id===taskId} onClick={()=>setTaskId(x.id)}>
    <strong>{pick(x.title)}</strong><span>{pick(x.skill)}</span></button>)}</div>
  </section>

  <section className="acc-card"><h2>{t.run}</h2>
   <div className="bm-row">
    <div className="bm-seg" role="radiogroup" aria-label={t.mode}>
     <button type="button" role="radio" aria-checked={mode==='web'} className={mode==='web'?'on':''} onClick={()=>setMode('web')}>🌐 {t.modeWeb}</button>
     <button type="button" role="radio" aria-checked={mode==='cammicgo'} className={mode==='cammicgo'?'on':''} onClick={()=>setMode('cammicgo')}>🔬 {t.modeCmg}</button>
    </div>
    <label className="bm-assistant">{t.assistant}<select value={assistant} onChange={e=>setAssistant(e.target.value)}>{ASSISTANTS.map(a=><option key={a}>{a}</option>)}</select></label>
   </div>
   <div className="bm-prompt"><div className="bm-prompt-head"><strong>{t.prompt}</strong><button type="button" className="acc-btn ghost" onClick={()=>void copyPrompt()}>{copied?'✓ '+t.copied:'📋 '+t.copy}</button></div><pre>{prompt}</pre></div>
   <div className="bm-timer" aria-live="polite"><span className={'bm-clock'+(running?' on':'')}>{fmt(elapsed)}</span>
    {!running?<button type="button" className="acc-btn" onClick={start}>▶ {t.start}</button>:<button type="button" className="acc-btn danger" onClick={stop}>■ {t.stop}</button>}
    <button type="button" className="acc-btn ghost" onClick={reset} disabled={running||!elapsed}>{t.reset}</button></div>
   <label className="bm-answer">{t.answer}<textarea rows={8} value={answer} onChange={e=>setAnswer(e.target.value)} placeholder={t.answerPh}/></label>
   {msg&&<p role="alert" className="acc-msg err">{msg}</p>}
   <button type="button" className="acc-btn" disabled={!token||busy||running||elapsed<1000||answer.trim().length<20} onClick={()=>void submit()}>{busy?t.scoring:t.submit}</button>
  </section>

  <section className="acc-card"><h2>{t.results}{task?' · '+pick(task.title):''}</h2>
   {ratio&&<p className="bm-verdict">{(ratio.k==='faster'?t.faster:t.slower).replace('{x}',ratio.x.toFixed(1))}</p>}
   {(mw||mc)&&<div className="bm-medians"><div><span>🌐 {t.median}</span><b>{mw?fmt(mw):'—'}</b></div><div><span>🔬 {t.median}</span><b>{mc?fmt(mc):'—'}</b></div></div>}
   {byTask.length?<div className="bm-table-wrap"><table className="bm-table"><thead><tr><th>{t.date}</th><th>{t.mode}</th><th>{t.assistant}</th><th>{t.time}</th><th>{t.verified}</th><th>{t.invalid}</th><th>{t.onTarget}</th><th>{t.quality}</th><th>{t.calls}</th><th/></tr></thead>
    <tbody>{byTask.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString(undefined,{dateStyle:'short',timeStyle:'short'})}</td><td>{r.mode==='web'?'🌐':'🔬'}</td><td>{r.assistant}</td><td><b>{fmt(r.duration_ms)}</b></td>
     <td>{r.metrics.verified??'—'}</td><td className={(r.metrics.invalid?.length??0)>0?'bm-bad':''}>{r.metrics.invalid?.length??'—'}</td><td>{r.metrics.onTarget??'—'}</td><td>{quality(r.metrics)}</td>
     <td>{r.mcp_calls?r.mcp_calls.calls+' · '+(r.mcp_calls.serverMs/1000).toFixed(1)+' s':'—'}</td><td><button type="button" className="acc-link" onClick={()=>void remove(r.id)} aria-label={t.remove}>✕</button></td></tr>)}</tbody></table></div>
    :<p className="acc-note">{t.noRuns}</p>}
   <p className="acc-note">{t.method}</p>
  </section>
 </main>;
}
