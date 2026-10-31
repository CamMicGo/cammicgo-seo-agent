'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useT} from '../lang-provider';
import {linkedinCopy} from '@/lib/copy/linkedin';

type Status={redirectUri:string;client:{clientId:string;secretHint:string;verifiedAt:string|null}|null;connection:{name:string;expiresAt:string;daysLeft:number;canPost:boolean}|null};

/** LinkedIn publishing: the user's own LinkedIn app (client ID / secret, stored encrypted) and the profile connection. */
export default function LinkedInConnect({token}:{token:string}){
 const t=useT(linkedinCopy);
 const [st,setSt]=useState<Status|null>(null);
 const [clientId,setClientId]=useState('');const [secret,setSecret]=useState('');
 const [busy,setBusy]=useState(false);const [msg,setMsg]=useState<{kind:'ok'|'err';text:string}|null>(null);
 const auth={Authorization:'Bearer '+token};
 const load=useCallback(async()=>{const r=await fetch('/api/account/linkedin',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(r.ok)setSt(await r.json() as Status);},[token]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  const q=new URLSearchParams(window.location.search).get('linkedin');if(!q)return;
  setMsg(q==='connected'?{kind:'ok',text:t.connectedOk}:{kind:'err',text:q==='denied'?t.denied:q==='expired'?t.expired:t.connectError});
  const u=new URL(window.location.href);u.searchParams.delete('linkedin');window.history.replaceState(null,'',u.toString());
 },[t]);
 async function save(){
  setBusy(true);setMsg(null);
  const r=await fetch('/api/account/linkedin',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({clientId,clientSecret:secret})});
  const b=await r.json().catch(()=>({})) as Status&{error?:string;verified?:boolean};setBusy(false);
  if(!r.ok){setMsg({kind:'err',text:b.error==='linkedin_rejected_client'?t.rejected:b.error?.startsWith('invalid_')?t.invalid:t.error});return;}
  setSt(b);setSecret('');setClientId('');setMsg({kind:'ok',text:b.verified?t.saved:t.savedUnverified});
 }
 async function connect(){
  setBusy(true);setMsg(null);
  const r=await fetch('/api/linkedin/start',{method:'POST',headers:auth});const b=await r.json().catch(()=>({})) as {url?:string};
  if(r.ok&&b.url){window.location.assign(b.url);return;}
  setBusy(false);setMsg({kind:'err',text:t.error});
 }
 async function remove(what:'connection'|'all'){
  setBusy(true);setMsg(null);
  const r=await fetch('/api/account/linkedin?what='+what,{method:'DELETE',headers:auth});const b=await r.json().catch(()=>({})) as Status;setBusy(false);
  if(r.ok)setSt(b);else setMsg({kind:'err',text:t.error});
 }
 const c=st?.connection;
 return <section className="acc-card" id="linkedin"><h2>{t.title}</h2>
  <p>{t.lead} <Link href="/setup/linkedin">{t.guide}</Link></p>
  {st&&<p className="acc-note">{t.redirect} <code>{st.redirectUri}</code></p>}
  {st?.client&&<p className="acc-ok">✓ {t.stored} <code>{st.client.clientId}</code> · {st.client.secretHint}</p>}
  <div className="acc-li-form">
   <label>{t.clientId}<input type="text" autoComplete="off" dir="ltr" value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="78abcd1234efgh"/></label>
   <label>{t.clientSecret}<input type="password" autoComplete="off" dir="ltr" value={secret} onChange={e=>setSecret(e.target.value)} placeholder={t.secretPh}/></label>
   <button className="acc-btn" disabled={busy||!clientId.trim()||secret.trim().length<10} onClick={()=>void save()}>{t.save}</button>
  </div>
  {c&&<p className="acc-ok">✓ {t.connected.replace('{name}',c.name)} · {t.expires.replace('{days}',String(c.daysLeft))}</p>}
  {c&&!c.canPost&&<p className="acc-warn">{t.noPost}</p>}
  <div className="acc-row">
   {st?.client&&<button className="acc-btn" disabled={busy} onClick={()=>void connect()}>{c?t.reconnect:t.connect}</button>}
   {c&&<button className="acc-btn ghost" disabled={busy} onClick={()=>void remove('connection')}>{t.disconnect}</button>}
   {st?.client&&<button className="acc-btn ghost" disabled={busy} onClick={()=>void remove('all')}>{t.remove}</button>}
  </div>
  <p className="acc-note">🔒 {t.safety}</p>
  {msg&&<p role="status" className={'acc-msg '+msg.kind}>{msg.text}</p>}
 </section>;
}
