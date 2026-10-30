'use client';
/** Shared visuals explaining how YouTube transcripts reach the remote MCP through a paired device (11 languages). */
import {useT} from './lang-provider';
import {relayCopy} from '@/lib/copy/relay';

const FLOW_ICONS=['💬','☁️','📱','✅'];
const LIMIT_ICONS=['🌙','⏱️'];

export function RelayFlow(){
 const t=useT(relayCopy);
 return <ol className="relay-flow" aria-label={t.flowLabel}>
  {t.flow.map((s,i)=><li className="relay-node" key={i}>
   <span className="relay-node-icon" aria-hidden="true">{FLOW_ICONS[i]}</span>
   <strong>{s.title}</strong><span>{s.text}</span>
   {i<t.flow.length-1&&<span className="relay-arrow" aria-hidden="true">→</span>}
  </li>)}
 </ol>;
}

export function RelayLimits(){
 const t=useT(relayCopy);
 return <div className="relay-limits">
  <span className="kicker">{t.kicker}</span>
  <h2>{t.limitsTitle}</h2>
  <div className="relay-limit-grid">
   {t.limits.map((c,i)=><article className="relay-limit-card" key={i}>
    <div className="relay-limit-head"><span className="relay-limit-icon" aria-hidden="true">{LIMIT_ICONS[i]}</span><h3>{c.title}</h3></div>
    <p>{c.text}</p>
    <div className="relay-limit-tips"><strong>{t.whatToDo}</strong><ul>{c.tips.map(x=><li key={x}>{x}</li>)}</ul></div>
   </article>)}
  </div>
  <p className="relay-limit-note">{t.note}</p>
 </div>;
}

export function RelaySteps(){
 const t=useT(relayCopy);
 return <ol className="relay-steps">
  {t.steps.map((s,i)=><li key={i}><span className="relay-step-num" aria-hidden="true">{i+1}</span><h3>{s.title}</h3><p>{s.text}</p></li>)}
 </ol>;
}
