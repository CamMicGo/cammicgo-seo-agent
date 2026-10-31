'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {useT} from '../../lang-provider';
import {consentCopy} from '@/lib/copy/consent';
import {accountCopy} from '@/lib/copy/account';
import {consentSteps} from '@/lib/google-scopes';

const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Do not instantiate Supabase at module scope: Next.js prerenders client pages during builds.
function getSupabase(){
 if(!publicKey)throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing');
 return createClient('https://vfngxjsryklqldarkxhy.supabase.co',publicKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}
type Details={client?:{name?:string;client_name?:string};scopes?:string[];redirect_uri?:string};
const SCOPES_KEY='cmg_google_scopes';
const KNOWN_SCOPE=/^https:\/\/www\.googleapis\.com\/auth\/[a-z.]+$/;
/** Selection remembered from a previous visit in this browser, or null. */
function savedScopes():string[]|null{try{const v=JSON.parse(localStorage.getItem(SCOPES_KEY)||'null');return Array.isArray(v)&&v.every(x=>typeof x==='string'&&KNOWN_SCOPE.test(x))?v:null}catch{return null}}
export default function OAuthConsent(){
 const t=useT(consentCopy);
 const a=useT(accountCopy);
 const [admin,setAdmin]=useState(false);
 const [savedClient,setSavedClient]=useState<{projectId:string|null;clientId:string;secretHint:string}|null>(null);
 const [projectId,setProjectId]=useState('');
 const [id,setId]=useState('');
 const [details,setDetails]=useState<Details|null>(null);
 const [autoBack,setAutoBack]=useState('');
 const [email,setEmail]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [loggedIn,setLoggedIn]=useState(false);
 const [googleConnected,setGoogleConnected]=useState(false);
 const [googleMode,setGoogleMode]=useState<'shared'|'byo'>('byo');
 const [clientId,setClientId]=useState('');
 const [clientSecret,setClientSecret]=useState('');
 const [selectedScopes,setSelectedScopes]=useState<string[]>(['https://www.googleapis.com/auth/webmasters.readonly','https://www.googleapis.com/auth/analytics.readonly','https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/calendar.readonly']);
 const apiOptions=[{label:'Gmail',scope:'https://www.googleapis.com/auth/gmail.readonly'},{label:'Google Drive',scope:'https://www.googleapis.com/auth/drive.readonly'},{label:'Google Drive ✎ (drive.file)',scope:'https://www.googleapis.com/auth/drive.file'},{label:'Google Drive ⚠ full access (drive)',scope:'https://www.googleapis.com/auth/drive'},{label:'Google Docs',scope:'https://www.googleapis.com/auth/documents.readonly'},{label:'Google Sheets',scope:'https://www.googleapis.com/auth/spreadsheets.readonly'},{label:'Google Tasks',scope:'https://www.googleapis.com/auth/tasks.readonly'},{label:'Google Slides',scope:'https://www.googleapis.com/auth/presentations.readonly'},{label:'Google Contacts',scope:'https://www.googleapis.com/auth/contacts.readonly'},{label:'Google Classroom',scope:'https://www.googleapis.com/auth/classroom.courses.readonly'},{label:'Google Chat',scope:'https://www.googleapis.com/auth/chat.spaces.readonly'},{label:'Apps Script',scope:'https://www.googleapis.com/auth/script.projects.readonly'},{label:'Google Ads (rapports + campagnes en pause)',scope:'https://www.googleapis.com/auth/adwords'},{label:'Search Console',scope:'https://www.googleapis.com/auth/webmasters.readonly'},{label:'Google Analytics 4',scope:'https://www.googleapis.com/auth/analytics.readonly'},{label:'YouTube',scope:'https://www.googleapis.com/auth/youtube.readonly'},{label:'Google Calendar',scope:'https://www.googleapis.com/auth/calendar.readonly'}];
 // "Select all" never ticks full Drive access (it allows trashing any file): that one stays an explicit choice.
 const safeAll=apiOptions.map(o=>o.scope).filter(x=>x!=='https://www.googleapis.com/auth/drive');
 useEffect(()=>{
  const remembered=savedScopes();if(remembered)setSelectedScopes(remembered);
  const authorizationId=new URLSearchParams(window.location.search).get('authorization_id')||'';
  setId(authorizationId);
  const reauth=new URLSearchParams(window.location.search).get('reauth')==='google';
  if(!authorizationId&&!reauth){setError(t.missing);return;}
  void (async()=>{
   if(!publicKey){setError(t.noSupabase);return;}
   const {data:{user}}=await getSupabase().auth.getUser();
   setLoggedIn(!!user);
   if(user){try{const {data:{session}}=await getSupabase().auth.getSession();if(session){const acc=await fetch('/api/account',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});if(acc.ok){const info=await acc.json() as {admin?:boolean;client?:{projectId:string|null;clientId:string;secretHint:string}|null};setAdmin(info.admin===true);setSavedClient(info.client??null);if(info.admin)setGoogleMode('shared');}const status=await fetch('/api/mcp/google/status',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});if(status.ok){const body=await status.json() as {connected?:boolean;scopes?:string[]|null};setGoogleConnected(body.connected===true);if(!savedScopes()&&Array.isArray(body.scopes)){const granted=body.scopes.filter(x=>apiOptions.some(o=>o.scope===x));if(granted.length)setSelectedScopes(granted);}}}}catch{/* Google linking remains optional. */}}
   if(!authorizationId)return;
   const {data,error:err}=await getSupabase().auth.oauth.getAuthorizationDetails(authorizationId);
   if(err){setError(/cannot be processed|no longer pending|expired|not found/i.test(err.message)?t.stale:err.message);return;}
   // Already approved before for this assistant: Supabase answers with the redirect URL directly.
   const auto=data as Details&{redirect_url?:string;redirect_to?:string};
   const back=auto?.redirect_url||auto?.redirect_to;
   // Keep the page so the user can still change Google APIs, then continue with one click.
   if(back&&!auto.client){setAutoBack(back);setDetails({} as Details);return;}
   setDetails(data as Details);
  })();
 },[]);
 async function sendLink(){
  setBusy(true);setError('');
  const {error:err}=await getSupabase().auth.signInWithOtp({email,options:{emailRedirectTo:window.location.href}});
  setBusy(false);
  setError(err?err.message:t.checkEmail);
 }
 useEffect(()=>{try{localStorage.setItem(SCOPES_KEY,JSON.stringify(selectedScopes))}catch{}},[selectedScopes]);
 async function connectGoogle(){try{if(!selectedScopes.length)throw Error(t.selectOne);const {data}=await getSupabase().auth.getSession();if(!data.session)throw Error(t.signFirst);const auth={Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'};
  if(googleMode==='byo'&&!savedClient){const saved=await fetch('/api/account',{method:'POST',headers:auth,body:JSON.stringify({projectId,clientId,clientSecret})});const body=await saved.json().catch(()=>({})) as {error?:string;client?:{projectId:string|null;clientId:string;secretHint:string}};if(!saved.ok)throw Error(a.err[body.error as keyof typeof a.err]??a.err.generic);setSavedClient(body.client??null);setClientSecret('');}
  const response=await fetch('/api/mcp/google/start',{method:'POST',headers:auth,body:JSON.stringify({authorizationId:id,mode:googleMode,scopes:selectedScopes})});const result=await response.json();if(!response.ok||!result.url)throw Error(result.error==='byo_missing'?a.needClient:result.error||t.googleFailed);window.location.assign(result.url)}catch(e){setError(e instanceof Error?e.message:t.googleFailed)}}
 async function decide(approve:boolean){
  if(!id||busy)return;
  setBusy(true);setError('');
  const result=approve?await getSupabase().auth.oauth.approveAuthorization(id):await getSupabase().auth.oauth.denyAuthorization(id);
  if(result.error){setError(/cannot be processed|no longer pending|expired|not found/i.test(result.error.message)?t.stale:result.error.message);setBusy(false);return;}
  const url=result.data?.redirect_url;
  if(!url){setError(t.noRedirect);setBusy(false);return;}
  window.location.assign(url);
 }
 return <main className="auth-page"><div className="auth-panel">
  <span className="kicker">{t.kicker}</span>
  <h1>{t.h1a} <span>{t.h1b}</span></h1>
  <p className="lead">{t.lead}</p>
  {error&&<p role="alert" style={{color:'#e87979'}}>{error}</p>}
  {details&&!autoBack&&<section className="connect-card"><h2>{details.client?.name||details.client?.client_name||t.aiApp}</h2>
   <p>{t.requested} {(details.scopes||[]).join(', ')||t.basic}</p>
   {details.redirect_uri&&<p>{t.returnTo} <code>{details.redirect_uri}</code></p>}
  </section>}
  {!loggedIn&&<section className="connect-card"><h2>{t.signTitle}</h2>
   <p>{t.signText}</p>
   <label>{t.email}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></label>
   <button className="primary connect-button" type="button" disabled={busy||!email.includes('@')} onClick={()=>void sendLink()}>{t.send}</button>
  </section>}
  {loggedIn&&(details||!id)&&<section className="connect-card" aria-label={t.stepsLabel} style={{display:'grid',gap:24}}>
   <div style={{display:'grid',gap:12}}>
    <h2 style={{margin:0,fontSize:'1.2rem'}}>{t.step1} <span style={{fontSize:'.85rem',fontWeight:400,color:'#64748b'}}>{t.optional}</span></h2>
    <p style={{margin:0,color:'#64748b'}}>{t.step1Text}</p>
    <fieldset style={{border:'1px solid #e2e8f0',borderRadius:12,padding:16,display:'grid',gap:10}}><legend style={{fontWeight:700,padding:'0 6px'}}>{admin?t.quota:a.gcpTitle}</legend>
     {admin&&<>
      <label style={{display:'flex',gap:10,alignItems:'center'}}><input type="radio" name="googleMode" checked={googleMode==='shared'} onChange={()=>setGoogleMode('shared')}/> {t.shared}</label>
      <label style={{display:'flex',gap:10,alignItems:'center'}}><input type="radio" name="googleMode" checked={googleMode==='byo'} onChange={()=>setGoogleMode('byo')}/> {t.byo}</label>
     </>}
     {googleMode==='byo'&&(savedClient?<div style={{display:'grid',gap:6}}>
      <p style={{margin:0,color:'#166534',fontWeight:600}}>✓ {savedClient.projectId?savedClient.projectId+' · ':''}<code dir="ltr" style={{overflowWrap:'anywhere'}}>{savedClient.clientId}</code> · <code dir="ltr">{savedClient.secretHint}</code></p>
      <a href="/account" style={{color:'#245edc',fontWeight:700}}>{a.edit} ↗</a>
     </div>:<div style={{display:'grid',gap:10}}>
      <p style={{margin:0,color:'#64748b'}}>{t.byoText} <a href="/setup/google-cloud" target="_blank" rel="noreferrer" style={{color:'#245edc',fontWeight:700}}>{a.guide}</a></p>
      <code dir="ltr" style={{overflowWrap:'anywhere',fontSize:'.85rem'}}>https://seo.cammicgo.com/api/auth/google/callback</code>
      <label style={{display:'grid',gap:5}}>{a.projectId}<input dir="ltr" type="text" autoComplete="off" value={projectId} onChange={e=>setProjectId(e.target.value)} placeholder={a.projectHint}/></label>
      <label style={{display:'grid',gap:5}}>{t.clientId}<input dir="ltr" type="text" autoComplete="off" value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="…apps.googleusercontent.com"/></label>
      <label style={{display:'grid',gap:5}}>{t.clientSecret}<input dir="ltr" type="password" autoComplete="off" value={clientSecret} onChange={e=>setClientSecret(e.target.value)} placeholder={t.secretPh}/></label>
      <p style={{margin:0,color:'#64748b',fontSize:13}}>🔒 {a.secretNote}</p>
     </div>)}
     <p style={{margin:0,color:'#64748b',fontSize:13}}>{a.testUsers}</p>
    </fieldset>
    <fieldset style={{border:'1px solid #e2e8f0',borderRadius:12,padding:16,display:'grid',gap:10}}><legend style={{fontWeight:700,padding:'0 6px'}}>{t.apis}</legend>
     <label style={{display:'flex',gap:10,alignItems:'center',fontWeight:700,paddingBottom:8,borderBottom:'1px solid #e2e8f0'}}><input type="checkbox" checked={safeAll.every(x=>selectedScopes.includes(x))} ref={el=>{if(el)el.indeterminate=selectedScopes.length>0&&!safeAll.every(x=>selectedScopes.includes(x))}} onChange={e=>setSelectedScopes(e.target.checked?[...safeAll,...selectedScopes.filter(x=>!safeAll.includes(x))]:[])}/>{t.selectAll}</label>
     {apiOptions.map(option=><label key={option.scope} style={{display:'flex',gap:10,alignItems:'center'}}><input type="checkbox" checked={selectedScopes.includes(option.scope)} onChange={e=>setSelectedScopes(current=>e.target.checked?[...current,option.scope]:current.filter(scope=>scope!==option.scope))}/>{option.label}</label>)}
     {consentSteps(selectedScopes)>1&&<p role="note" style={{margin:0,color:'#64748b',fontSize:13}}>ℹ️ {t.twoScreens}</p>}
    </fieldset>
    {googleConnected&&<p role="status" style={{margin:0,color:'#166534',fontWeight:600}}>{t.connected}</p>}
    <button type="button" disabled={busy||!selectedScopes.length||(googleMode==='byo'&&!savedClient&&(!clientId||!clientSecret))} onClick={()=>void connectGoogle()} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:12,width:'fit-content',minHeight:48,padding:'10px 20px',borderRadius:12,border:'1px solid #d1d5db',background:'#fff',color:'#202124',fontSize:'1rem',fontWeight:600,cursor:busy?'wait':'pointer',boxShadow:'0 2px 8px rgba(15,23,42,.06)'}}>
     <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.87 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
     {googleConnected?t.reconnect:t.cont}
    </button>
   </div>
   {id&&autoBack?<div style={{borderTop:'1px solid #e2e8f0',paddingTop:20,display:'grid',gap:12}}>
    <p style={{margin:0,color:'#166534',fontWeight:600}}>✓ {t.already}</p>
    <a className="primary connect-button" href={autoBack} style={{minHeight:48,borderRadius:12,padding:'12px 22px',fontWeight:700,width:'fit-content',display:'inline-flex',alignItems:'center'}}>{t.backTo.replace('{app}',t.yourAgent)}</a>
   </div>:id?<div style={{borderTop:'1px solid #e2e8f0',paddingTop:20,display:'grid',gap:12}}>
    <h2 style={{margin:0,fontSize:'1.2rem'}}>{t.step2.replace('{app}',details?.client?.name||details?.client?.client_name||t.yourAgent)}</h2>
    <p style={{margin:0,color:'#64748b'}}>{t.step2Text}</p>
    <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:12}}>
     <button className="primary connect-button" type="button" disabled={busy} onClick={()=>void decide(true)} style={{minHeight:48,borderRadius:12,padding:'12px 22px',fontWeight:700}}>{t.authorize}</button>
     <button type="button" disabled={busy} onClick={()=>void decide(false)} style={{minHeight:48,borderRadius:12,padding:'12px 20px',border:'1px solid #cbd5e1',background:'#f8fafc',color:'#334155',fontWeight:600,cursor:busy?'wait':'pointer'}}>{t.deny}</button>
    </div>
   </div>:<p role="status" style={{margin:0,color:'#334155'}}>{t.reauthOnly}</p>}
  </section>}
  <p className="privacy">{t.foot}</p>
 </div></main>;
}
