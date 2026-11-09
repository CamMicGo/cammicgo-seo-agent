'use client';
import {useCallback,useEffect,useState} from 'react';
import {useT} from '../lang-provider';
import {bingCopy} from '@/lib/copy/bing';

type Saved={hint:string;verifiedAt:string|null}|null;

/** Personal Bing Webmaster Tools API key (stored encrypted on the server). */
export default function BingKey({token}:{token:string}){
 const t=useT(bingCopy);
 const [saved,setSaved]=useState<Saved>(null);
 const [draft,setDraft]=useState('');
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState<{kind:'ok'|'err';text:string}|null>(null);
 const auth={Authorization:'Bearer '+token};
 const load=useCallback(async()=>{const r=await fetch('/api/account/bing',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(r.ok)setSaved(((await r.json()) as {key:Saved}).key);},[token]);
 useEffect(()=>{void load();},[load]);
 async function save(){
  setBusy(true);setMsg(null);
  const r=await fetch('/api/account/bing',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({key:draft})});
  const b=await r.json().catch(()=>({})) as {error?:string;verified?:boolean;key?:Saved};setBusy(false);
  if(!r.ok){setMsg({kind:'err',text:b.error==='key_rejected'?t.rejected:b.error==='invalid_key_format'?t.invalidFormat:t.error});return;}
  setSaved(b.key??null);setDraft('');setMsg({kind:'ok',text:b.verified?t.saved:t.savedUnverified});
 }
 async function remove(){
  setBusy(true);setMsg(null);
  const r=await fetch('/api/account/bing',{method:'DELETE',headers:auth});setBusy(false);
  if(r.ok){setSaved(null);setMsg({kind:'ok',text:t.removed});}else setMsg({kind:'err',text:t.error});
 }
 return <section className="acc-card acc-sci" aria-labelledby="acc-bing-title">
  <h2 id="acc-bing-title" style={{display:"flex",alignItems:"center",gap:10}}><img src="/service-icons/bing-webmaster.jpg" width={32} height={32} alt="" style={{objectFit:"contain",borderRadius:5}}/>{t.title}</h2>
  <p>{t.lead}</p>
  {msg&&<p role="status" className={'acc-msg '+msg.kind}>{msg.text}</p>}
  <div className="acc-sci-list"><div className="acc-sci-row">
   <div className="acc-sci-head"><strong>Bing</strong><span className={saved?'acc-ok':'acc-sci-muted'}>{saved?'✓ '+saved.hint+(saved.verifiedAt?' · '+t.verified:''):t.noKey}</span></div>
   <p className="acc-note">{t.how}</p>
   <div className="acc-row">
    <input type="password" dir="ltr" autoComplete="off" spellCheck={false} aria-label={t.placeholder} placeholder={t.placeholder} value={draft} onChange={e=>setDraft(e.target.value)}/>
    <button className="acc-btn" disabled={busy||!draft.trim()} onClick={()=>void save()}>{t.save}</button>
    {saved&&<button className="acc-btn danger" disabled={busy} onClick={()=>void remove()}>{t.remove}</button>}
   </div>
   <a className="acc-sci-link" href="https://www.bing.com/webmasters/" target="_blank" rel="noreferrer">{t.getKey}</a>
  </div></div>
  <p className="acc-note">🔒 {t.secretNote}</p>
 </section>;
}
