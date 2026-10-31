'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useT} from '../lang-provider';
import {accountCopy} from '@/lib/copy/account';
import {supabaseBrowser,supabaseConfigured} from '@/lib/supabase-browser';
import DriveStorage from './drive-storage';
import ScienceKeys from './science-keys';

type Client={projectId:string|null;clientId:string;secretHint:string;verifiedAt:string|null;updatedAt:string};
type Account={admin:boolean;client:Client|null;redirectUri:string;google:{connected:boolean;mode:'shared'|'byo'|null;scopes:string[]|null;driveWrite:string[]|null};usage:{used:number;limit:number;perMinute:number;resetsAt:string}};
const MCP_URL='https://seo.cammicgo.com/api/mcp';
const APIS:Array<[string,string]>=[['Search Console','webmasters.readonly'],['Google Analytics 4','analytics.readonly'],['YouTube','youtube.readonly'],['YouTube Analytics','yt-analytics.readonly'],['Google Calendar','calendar.readonly'],['Gmail','gmail.readonly'],['Google Drive','drive.readonly'],['Google Drive ✎ (drive.file)','drive.file'],['Google Drive ⚠ full access (drive)','drive'],['Google Docs','documents.readonly'],['Google Sheets','spreadsheets.readonly'],['Google Slides','presentations.readonly'],['Google Tasks','tasks.readonly'],['Google Contacts','contacts.readonly'],['Google Classroom','classroom.courses.readonly'],['Google Chat','chat.spaces.readonly'],['Apps Script','script.projects.readonly'],['Google Ads','adwords']];
const scopeUrl=(s:string)=>'https://www.googleapis.com/auth/'+s;
/** "Select all" never ticks full Drive access (it allows trashing any file): that one stays an explicit choice. */
const SELECT_ALL=APIS.filter(([,id])=>id!=='drive').map(([,id])=>scopeUrl(id));
const fill=(s:string,v:Record<string,string|number>)=>s.replace(/\{(\w+)\}/g,(_,k)=>String(v[k]??''));

export default function AccountView(){
 const t=useT(accountCopy);
 const [email,setEmail]=useState('');
 const [userEmail,setUserEmail]=useState<string|null>(null);
 const [token,setToken]=useState<string|null>(null);
 const [ready,setReady]=useState(false);
 const [acc,setAcc]=useState<Account|null>(null);
 const [msg,setMsg]=useState<{kind:'ok'|'err';text:string}|null>(null);
 const [busy,setBusy]=useState(false);
 const [editing,setEditing]=useState(false);
 const [form,setForm]=useState({projectId:'',clientId:'',clientSecret:''});
 const [scopes,setScopes]=useState<string[]>(APIS.slice(0,4).map(a=>scopeUrl(a[1])));
 const [useShared,setUseShared]=useState(false);

 const load=useCallback(async(tk:string)=>{
  const r=await fetch('/api/account',{headers:{Authorization:'Bearer '+tk},cache:'no-store'});
  if(r.ok){const a=await r.json() as Account;setAcc(a);if(a.google.scopes?.length){const s=a.google.scopes.filter(x=>APIS.some(([,id])=>scopeUrl(id)===x));if(s.length)setScopes(s);}}
 },[]);

 useEffect(()=>{
  if(!supabaseConfigured){setReady(true);return;}
  const sb=supabaseBrowser();
  const apply=(s:{access_token:string;user:{email?:string}}|null)=>{setToken(s?.access_token??null);setUserEmail(s?.user.email??null);if(s)void load(s.access_token);setReady(true);};
  void sb.auth.getSession().then(({data})=>apply(data.session));
  const {data:sub}=sb.auth.onAuthStateChange((_e,s)=>apply(s));
  const q=new URLSearchParams(location.search).get('google');
  if(q==='connected'||q==='partial')setMsg({kind:'ok',text:t.googleDone});else if(q==='denied')setMsg({kind:'err',text:t.googleDenied});
  return()=>sub.subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[load]);

 async function sendLink(){
  setBusy(true);setMsg(null);
  const {error}=await supabaseBrowser().auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+'/account'}});
  setBusy(false);setMsg(error?{kind:'err',text:error.message}:{kind:'ok',text:t.sent});
 }
 async function saveClient(){
  if(!token)return;setBusy(true);setMsg(null);
  const r=await fetch('/api/account',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(form)});
  const body=await r.json().catch(()=>({})) as {error?:keyof typeof t.err;verified?:boolean};
  setBusy(false);
  if(!r.ok){setMsg({kind:'err',text:t.err[body.error as keyof typeof t.err]??t.err.generic});return;}
  setForm({projectId:'',clientId:'',clientSecret:''});setEditing(false);
  setMsg({kind:'ok',text:body.verified?t.saved:t.savedUnverified});void load(token);
 }
 async function removeClient(){
  if(!token||!confirm(t.removeConfirm))return;
  setBusy(true);const r=await fetch('/api/account',{method:'DELETE',headers:{Authorization:'Bearer '+token}});setBusy(false);
  setMsg(r.ok?{kind:'ok',text:t.removed}:{kind:'err',text:t.err.generic});void load(token);
 }
 async function connectGoogle(only?:string[]){
  if(!token)return;setBusy(true);setMsg(null);
  const r=await fetch('/api/mcp/google/start',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({mode:useShared?'shared':'byo',scopes:only??scopes,returnTo:'/account'})});
  const body=await r.json().catch(()=>({})) as {url?:string;error?:string};
  if(r.ok&&body.url){location.assign(body.url);return;}
  setBusy(false);setMsg({kind:'err',text:body.error==='byo_missing'?t.needClient:body.error||t.err.generic});
 }

 const pct=acc?Math.min(100,Math.round(acc.usage.used*100/Math.max(1,acc.usage.limit))):0;
 const canConnect=!!acc&&(!!acc.client||(acc.admin&&useShared));
 const rows=[t.remote,t.local,t.dashboard];

 return <main className="acc">
  <span className="kicker">{t.kicker}</span>
  <h1>{t.title}</h1>
  <p className="lead">{t.lead}</p>
  {msg&&<p role="status" className={'acc-msg '+msg.kind}>{msg.text}</p>}

  {ready&&!token&&<section className="acc-card"><h2>{t.signTitle}</h2><p>{t.signText}</p>
   <div className="acc-row"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@gmail.com" autoComplete="email" aria-label={t.email}/>
   <button className="acc-btn" disabled={busy||!email.includes('@')} onClick={()=>void sendLink()}>{t.send}</button></div></section>}

  {token&&<>
   <div className="acc-who"><span>{t.signedAs} <b>{userEmail}</b>{acc?.admin&&<em className="acc-badge">{t.admin}</em>}</span><button className="acc-link" onClick={()=>void supabaseBrowser().auth.signOut()}>{t.signOut}</button></div>

   <section className="acc-card"><h2>{t.usageTitle}</h2>
    <div className="acc-usage"><b>{acc?fill(t.usageOf,{used:acc.usage.used,limit:acc.usage.limit}):'…'}</b></div>
    <div className="acc-bar"><div style={{width:pct+'%',background:pct>=90?'#dc2626':undefined}}/></div>
    <p className="acc-note">{fill(t.usageNote,{perMinute:acc?.usage.perMinute??10})}</p>
   </section>

   <section className="acc-card"><h2>{t.gcpTitle}</h2><p>{t.gcpLead} <a href="/setup/google-cloud">{t.guide}</a></p>
    {acc?.client&&!editing?<div className="acc-client">
     <dl>{acc.client.projectId&&<><dt>{t.projectId}</dt><dd><code>{acc.client.projectId}</code></dd></>}
      <dt>{t.clientId}</dt><dd><code>{acc.client.clientId}</code></dd>
      <dt>{t.clientSecret}</dt><dd><code>{acc.client.secretHint}</code> <span className={acc.client.verifiedAt?'acc-ok':'acc-warn'}>{acc.client.verifiedAt?'✓ '+t.verified:t.notVerified}</span></dd></dl>
     <div className="acc-row"><button className="acc-btn ghost" onClick={()=>setEditing(true)}>{t.edit}</button><button className="acc-btn danger" disabled={busy} onClick={()=>void removeClient()}>{t.remove}</button></div>
    </div>:<div className="acc-form">
     <label>{t.projectId}<input value={form.projectId} onChange={e=>setForm({...form,projectId:e.target.value})} placeholder={t.projectHint} dir="ltr" autoComplete="off"/></label>
     <label>{t.clientId}<input value={form.clientId} onChange={e=>setForm({...form,clientId:e.target.value})} placeholder="123456789-abc….apps.googleusercontent.com" dir="ltr" autoComplete="off" spellCheck={false}/></label>
     <label>{t.clientSecret}<input type="password" value={form.clientSecret} onChange={e=>setForm({...form,clientSecret:e.target.value})} placeholder={t.secretPh} dir="ltr" autoComplete="off"/></label>
     <p className="acc-note">🔒 {t.secretNote}</p>
     <div className="acc-row"><button className="acc-btn" disabled={busy||!form.clientId||!form.clientSecret} onClick={()=>void saveClient()}>{busy?t.saving:t.save}</button>{editing&&<button className="acc-btn ghost" onClick={()=>setEditing(false)}>{t.cancel}</button>}</div>
    </div>}
   </section>

   <section className="acc-card"><h2>{t.googleTitle}</h2>
    <p className={acc?.google.connected?'acc-ok':''}>{acc?.google.connected?(acc.google.mode==='shared'?t.googleShared:t.googleByo):t.googleNone}</p>
    <fieldset className="acc-apis"><legend>{t.apis}</legend>
     <label className="acc-all"><input type="checkbox" checked={SELECT_ALL.every(x=>scopes.includes(x))} onChange={e=>setScopes(e.target.checked?[...SELECT_ALL,...scopes.filter(x=>!SELECT_ALL.includes(x))]:[])}/>{t.selectAll}</label>
     {APIS.map(([name,id])=><label key={id}><input type="checkbox" checked={scopes.includes(scopeUrl(id))} onChange={e=>setScopes(s=>e.target.checked?[...s,scopeUrl(id)]:s.filter(x=>x!==scopeUrl(id)))}/>{name}</label>)}
    </fieldset>
    {acc?.admin&&<label className="acc-shared"><input type="checkbox" checked={useShared} onChange={e=>setUseShared(e.target.checked)}/>{t.useShared}</label>}
    {!acc?.client&&!(acc?.admin&&useShared)&&<p className="acc-warn">{t.needClient}</p>}
    <button className="acc-btn google" disabled={busy||!canConnect||!scopes.length} onClick={()=>void connectGoogle()}>
     <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.87 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
     {acc?.google.connected?t.reconnect:t.connect}</button>
    <div className="acc-drive-write">
     <p className={acc?.google.driveWrite?.length?'acc-ok':'acc-note'}>{acc?.google.driveWrite?.length?'✓ '+t.driveWriteOn+' ('+acc.google.driveWrite.map(x=>x.split('/auth/')[1]).join(', ')+')':t.driveWriteOff}</p>
     {acc?.google.connected&&!acc.google.driveWrite?.length&&<button className="acc-btn ghost" disabled={busy||!canConnect} onClick={()=>void connectGoogle([scopeUrl('drive.file')])}>✎ {t.driveWriteBtn}</button>}
     <p className="acc-note">{t.driveWriteNote}</p>
    </div>
    <p className="acc-note">{t.testUsers}</p>
   </section>

   <DriveStorage token={token} googleConnected={!!acc?.google.connected}/>

   <ScienceKeys token={token}/>
  </>}

  <section className="acc-card"><h2>{t.urlsTitle}</h2><p>{t.urlsLead}</p>
   <div className="acc-table" role="table">
    <div className="acc-tr head" role="row"><span role="columnheader">{t.colUse}</span><span role="columnheader">{t.colType}</span><span role="columnheader">{t.colRedirect}</span><span role="columnheader">{t.colWhere}</span></div>
    {rows.map((r,i)=><div className="acc-tr" role="row" key={i}><span role="cell"><b>{r.use}</b></span><span role="cell">{r.type}</span><span role="cell"><code dir="ltr">{r.redirect}</code></span><span role="cell">{r.where}</span></div>)}
   </div>
   <p><b>{t.mcpUrl}</b> <code dir="ltr">{MCP_URL}</code></p>
   <p className="acc-note">{t.localNote} <Link href="/setup/local">/setup/local ↗</Link></p>
  </section>
 </main>;
}
