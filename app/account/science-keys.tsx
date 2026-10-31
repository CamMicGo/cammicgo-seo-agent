'use client';
import {useCallback,useEffect,useState} from 'react';
import {useT} from '../lang-provider';
import {scienceCopy} from '@/lib/copy/science';

type Provider='semanticscholar'|'openalex'|'pubmed';
type Saved={provider:Provider;hint:string;verifiedAt:string|null};
const KEYED:Array<{id:Provider;name:string;url:string;no:'lim_oa_no'|'lim_s2_no'|'lim_pm_no';yes:'lim_oa_key'|'lim_s2_key'|'lim_pm_key'}>=[
 {id:'openalex',name:'OpenAlex',url:'https://openalex.org/settings/api',no:'lim_oa_no',yes:'lim_oa_key'},
 {id:'semanticscholar',name:'Semantic Scholar (Ai2)',url:'https://www.semanticscholar.org/product/api#api-key-form',no:'lim_s2_no',yes:'lim_s2_key'},
 {id:'pubmed',name:'PubMed (NCBI)',url:'https://account.ncbi.nlm.nih.gov/settings/',no:'lim_pm_no',yes:'lim_pm_key'},
];

/** Optional personal keys for scientific sources (stored encrypted on the server). */
export default function ScienceKeys({token}:{token:string}){
 const t=useT(scienceCopy);
 const [saved,setSaved]=useState<Saved[]>([]);
 const [draft,setDraft]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState<string|null>(null);
 const [msg,setMsg]=useState<{kind:'ok'|'err';text:string}|null>(null);
 const auth={Authorization:'Bearer '+token};
 const load=useCallback(async()=>{const r=await fetch('/api/account/science',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(r.ok)setSaved(((await r.json()) as {keys:Saved[]}).keys);},[token]);
 useEffect(()=>{void load();},[load]);
 async function save(p:Provider){
  setBusy(p);setMsg(null);
  const r=await fetch('/api/account/science',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({provider:p,key:draft[p]??''})});
  const b=await r.json().catch(()=>({})) as {error?:string;verified?:boolean;keys?:Saved[]};setBusy(null);
  if(!r.ok){setMsg({kind:'err',text:b.error==='key_rejected'?t.rejected:b.error==='invalid_key_format'?t.invalidFormat:t.error});return;}
  setSaved(b.keys??[]);setDraft(d=>({...d,[p]:''}));setMsg({kind:'ok',text:b.verified?t.saved:t.savedUnverified});
 }
 async function remove(p:Provider){
  setBusy(p);setMsg(null);
  const r=await fetch('/api/account/science?provider='+p,{method:'DELETE',headers:auth});const b=await r.json().catch(()=>({})) as {keys?:Saved[]};setBusy(null);
  if(r.ok){setSaved(b.keys??[]);setMsg({kind:'ok',text:t.removed});}else setMsg({kind:'err',text:t.error});
 }
 return <section className="acc-card acc-sci" aria-labelledby="acc-sci-title">
  <h2 id="acc-sci-title">🔬 {t.title}</h2>
  <p>{t.lead} <a href="/setup/science">{t.guide} →</a></p>
  <p className="acc-sci-rec">⭐ {t.recommend}</p>
  {msg&&<p role="status" className={'acc-msg '+msg.kind}>{msg.text}</p>}
  <div className="acc-sci-list">
   {KEYED.map(k=>{const s=saved.find(x=>x.provider===k.id);return <div className="acc-sci-row" key={k.id}>
    <div className="acc-sci-head"><strong>{k.name}</strong><span className={s?'acc-ok':'acc-sci-muted'}>{s?'✓ '+s.hint+(s.verifiedAt?' · '+t.verified:''):t.noKey}</span></div>
    <p className="acc-note">{t.withoutKey}: {t[k.no]} · {t.withKey}: {t[k.yes]}</p>
    <div className="acc-row">
     <input type="password" dir="ltr" autoComplete="off" spellCheck={false} aria-label={k.name} placeholder={t.placeholder} value={draft[k.id]??''} onChange={e=>setDraft(d=>({...d,[k.id]:e.target.value}))}/>
     <button className="acc-btn" disabled={busy===k.id||!(draft[k.id]??'').trim()} onClick={()=>void save(k.id)}>{t.save}</button>
     {s&&<button className="acc-btn danger" disabled={busy===k.id} onClick={()=>void remove(k.id)}>{t.remove}</button>}
    </div>
    <a className="acc-sci-link" href={k.url} target="_blank" rel="noreferrer">{t.getKey}</a>
   </div>;})}
   <div className="acc-sci-row acc-sci-free"><div className="acc-sci-head"><strong>arXiv · HAL</strong><span className="acc-ok">✓ {t.notNeeded}</span></div></div>
  </div>
  <p className="acc-note">🔒 {t.secretNote}</p>
 </section>;
}
