'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useT} from '../lang-provider';
import {linkedinCopy} from '@/lib/copy/linkedin';

type Status={redirectUri:string;admin:boolean;client:{clientId:string;secretHint:string;verifiedAt:string|null}|null;
 shared:{available:boolean;clientId?:string;source?:'env'|'admin';mine?:boolean};
 connection:{name:string;expiresAt:string;daysLeft:number;canPost:boolean;app:'own'|'shared'}|null};

/**
 * LinkedIn publishing. Two ways: the simple one connects with the CamMicGo app shared by all users; the advanced
 * one uses the user's own LinkedIn app (client ID / secret, stored encrypted). Either way, the user authorizes
 * with their own LinkedIn account and the connection only lets them post on their own profile.
 * Administrators can share the app saved in their own account with every user.
 */
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
 async function call(url:string,method:'DELETE'|'POST'){
  setBusy(true);setMsg(null);
  const r=await fetch(url,{method,headers:auth});const b=await r.json().catch(()=>({})) as Status&{error?:string};setBusy(false);
  if(r.ok)setSt(b);else setMsg({kind:'err',text:b.error==='no_own_app'?t.adminNoOwn:t.error});
 }
 const c=st?.connection,own=st?.client,shared=st?.shared;
 const canConnect=!!own||!!shared?.available;
 return <section className="acc-card" id="linkedin"><h2 className="li-title"><img src="/service-icons/linkedin.png" alt="" width="26" height="26"/>{t.title}</h2>
  <p>{t.lead} <Link href="/setup/linkedin">{t.guide}</Link></p>
  {c&&<p className="acc-ok">✓ {t.connected.replace('{name}',c.name)} · {c.app==='shared'?t.viaShared:t.viaOwn} · {t.expires.replace('{days}',String(c.daysLeft))}</p>}
  {c&&!c.canPost&&<p className="acc-warn">{t.noPost}</p>}
  {st&&!own&&<div className="acc-li-way">
   {shared?.available?<><h3>{t.simpleT}</h3><p>{t.simpleP}</p></>:<p className="acc-note">{t.noShared}</p>}
  </div>}
  <div className="acc-row">
   {canConnect&&<button className="acc-btn" disabled={busy} onClick={()=>void connect()}>{c?t.reconnect:t.connect}</button>}
   {c&&<button className="acc-btn ghost" disabled={busy} onClick={()=>void call('/api/account/linkedin?what=connection','DELETE')}>{t.disconnect}</button>}
  </div>
  {st&&<details className="acc-li-own" open={!!own||!shared?.available}>
   <summary>{t.ownT}</summary>
   <p>{t.ownP} <Link href="/setup/linkedin">{t.guide}</Link></p>
   <p className="acc-note">{t.redirect} <code>{st.redirectUri}</code></p>
   {own&&<p className="acc-ok">✓ {t.stored} <code>{own.clientId}</code> · {own.secretHint}</p>}
   <div className="acc-li-form">
    <label>{t.clientId}<input type="text" autoComplete="off" dir="ltr" value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="78abcd1234efgh"/></label>
    <label>{t.clientSecret}<input type="password" autoComplete="off" dir="ltr" value={secret} onChange={e=>setSecret(e.target.value)} placeholder={t.secretPh}/></label>
    <button className="acc-btn" disabled={busy||!clientId.trim()||secret.trim().length<10} onClick={()=>void save()}>{t.save}</button>
   </div>
   {own&&<div className="acc-row"><button className="acc-btn ghost" disabled={busy} onClick={()=>void call('/api/account/linkedin?what=all','DELETE')}>{t.remove}</button></div>}
  </details>}
  {st?.admin&&<div className="acc-li-admin">
   <h3>{t.adminT}</h3>
   <p className={shared?.available?'acc-ok':'acc-note'}>{shared?.available?'✓ '+t.adminOn.replace('{id}',shared.clientId??'')+(shared.source==='env'?' '+t.adminEnv:''):t.adminOff}</p>
   <div className="acc-row">
    {shared?.source!=='env'&&<button className="acc-btn" disabled={busy||!own} onClick={()=>void call('/api/account/linkedin/shared','POST')}>{t.adminShare}</button>}
    {shared?.available&&shared.source==='admin'&&<button className="acc-btn ghost" disabled={busy} onClick={()=>void call('/api/account/linkedin/shared','DELETE')}>{t.adminUnshare}</button>}
   </div>
   {!own&&shared?.source!=='env'&&<p className="acc-note">{t.adminNoOwn}</p>}
   <p className="acc-note">{t.adminNote}</p>
  </div>}
  <p className="acc-note">🔒 {t.safety}</p>
  {msg&&<p role="status" className={'acc-msg '+msg.kind}>{msg.text}</p>}
 </section>;
}
