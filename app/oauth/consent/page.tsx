'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@supabase/supabase-js';

const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Do not instantiate Supabase at module scope: Next.js prerenders client pages during builds.
function getSupabase(){
 if(!publicKey)throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing');
 return createClient('https://vfngxjsryklqldarkxhy.supabase.co',publicKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}
type Details={client?:{name?:string;client_name?:string};scopes?:string[];redirect_uri?:string};
export default function OAuthConsent(){
 const [id,setId]=useState('');
 const [details,setDetails]=useState<Details|null>(null);
 const [email,setEmail]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [loggedIn,setLoggedIn]=useState(false);
 const [googleConnected,setGoogleConnected]=useState(false);
 const [googleMode,setGoogleMode]=useState<'shared'|'byo'>('shared');
 const [clientId,setClientId]=useState('');
 const [clientSecret,setClientSecret]=useState('');
 const [selectedScopes,setSelectedScopes]=useState<string[]>(['https://www.googleapis.com/auth/webmasters.readonly','https://www.googleapis.com/auth/analytics.readonly']);
 const apiOptions=[{label:'Gmail',scope:'https://www.googleapis.com/auth/gmail.readonly'},{label:'Google Drive',scope:'https://www.googleapis.com/auth/drive.readonly'},{label:'Google Docs',scope:'https://www.googleapis.com/auth/documents.readonly'},{label:'Google Sheets',scope:'https://www.googleapis.com/auth/spreadsheets.readonly'},{label:'Google Tasks',scope:'https://www.googleapis.com/auth/tasks.readonly'},{label:'Google Slides',scope:'https://www.googleapis.com/auth/presentations.readonly'},{label:'Google Contacts',scope:'https://www.googleapis.com/auth/contacts.readonly'},{label:'Google Classroom',scope:'https://www.googleapis.com/auth/classroom.courses.readonly'},{label:'Google Chat',scope:'https://www.googleapis.com/auth/chat.spaces.readonly'},{label:'Apps Script',scope:'https://www.googleapis.com/auth/script.projects.readonly'},{label:'Search Console',scope:'https://www.googleapis.com/auth/webmasters.readonly'},{label:'Google Analytics 4',scope:'https://www.googleapis.com/auth/analytics.readonly'},{label:'YouTube',scope:'https://www.googleapis.com/auth/youtube.readonly'},{label:'Google Calendar',scope:'https://www.googleapis.com/auth/calendar.readonly'}];
 useEffect(()=>{
  const authorizationId=new URLSearchParams(window.location.search).get('authorization_id')||'';
  setId(authorizationId);
  if(!authorizationId){setError('Missing authorization request. Start again from ChatGPT.');return;}
  void (async()=>{
   if(!publicKey){setError('Supabase connection is not configured.');return;}
   const {data:{user}}=await getSupabase().auth.getUser();
   setLoggedIn(!!user);
   if(user){try{const {data:{session}}=await getSupabase().auth.getSession();if(session){const status=await fetch('/api/mcp/google/status',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});if(status.ok){const body=await status.json() as {connected?:boolean};setGoogleConnected(body.connected===true);}}}catch{/* Google linking remains optional. */}}
   const {data,error:err}=await getSupabase().auth.oauth.getAuthorizationDetails(authorizationId);
   if(err){setError(err.message);return;}
   setDetails(data as Details);
  })();
 },[]);
 async function sendLink(){
  setBusy(true);setError('');
  const {error:err}=await getSupabase().auth.signInWithOtp({email,options:{emailRedirectTo:window.location.href}});
  setBusy(false);
  setError(err?err.message:'Check your email for a secure sign-in link, then return to this page.');
 }
 async function connectGoogle(){try{if(!selectedScopes.length)throw Error('Select at least one Google API');const {data}=await getSupabase().auth.getSession();if(!data.session)throw Error('Sign in first');const response=await fetch('/api/mcp/google/start',{method:'POST',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({authorizationId:id,mode:googleMode,clientId:googleMode==='byo'?clientId:undefined,clientSecret:googleMode==='byo'?clientSecret:undefined,scopes:selectedScopes})});const result=await response.json();if(!response.ok||!result.url)throw Error(result.error||'Google OAuth failed');window.location.assign(result.url)}catch(e){setError(e instanceof Error?e.message:'Google connection failed')}}
 async function decide(approve:boolean){
  if(!id||busy)return;
  setBusy(true);setError('');
  const result=approve?await getSupabase().auth.oauth.approveAuthorization(id):await getSupabase().auth.oauth.denyAuthorization(id);
  if(result.error){setError(result.error.message);setBusy(false);return;}
  const url=result.data?.redirect_url;
  if(!url){setError('Authorization did not return a redirect URL.');setBusy(false);return;}
  window.location.assign(url);
 }
 return <main className="auth-page"><div className="auth-panel">
  <span className="kicker">CAMMICGO · SECURE AGENT ACCESS</span>
  <h1>Authorize <span>your AI agent</span></h1>
  <p className="lead">Approve access to your CamMicGo account. Connecting Google Search Console and Analytics is a separate, optional step.</p>
  {error&&<p role="alert" style={{color:'#e87979'}}>{error}</p>}
  {details&&<section className="connect-card"><h2>{details.client?.name||details.client?.client_name||'AI application'}</h2>
   <p>Requested permissions: {(details.scopes||[]).join(', ')||'Basic account access'}</p>
   {details.redirect_uri&&<p>Return to: <code>{details.redirect_uri}</code></p>}
  </section>}
  {!loggedIn&&<section className="connect-card"><h2>Sign in to CamMicGo</h2>
   <p>Enter your email to receive a secure sign-in link. You will return to this authorization request.</p>
   <label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></label>
   <button className="primary connect-button" type="button" disabled={busy||!email.includes('@')} onClick={()=>void sendLink()}>Send sign-in link</button>
  </section>}
  {loggedIn&&details&&<section className="connect-card" aria-label="Authorization steps" style={{display:'grid',gap:24}}>
   <div style={{display:'grid',gap:12}}>
    <h2 style={{margin:0,fontSize:'1.2rem'}}>Step 1 · Connect your Google account <span style={{fontSize:'.85rem',fontWeight:400,color:'#64748b'}}>(optional)</span></h2>
    <p style={{margin:0,color:'#64748b'}}>Choose the Google APIs you want to authorize, then connect your Google account. This permission is separate from agent authorization.</p>
    <fieldset style={{border:'1px solid #e2e8f0',borderRadius:12,padding:16,display:'grid',gap:10}}><legend style={{fontWeight:700,padding:'0 6px'}}>Google Cloud quota source</legend>
     <label style={{display:'flex',gap:10,alignItems:'center'}}><input type="radio" name="googleMode" checked={googleMode==='shared'} onChange={()=>setGoogleMode('shared')}/> Use CamMicGo's Google Cloud project (shared quota)</label>
     <label style={{display:'flex',gap:10,alignItems:'center'}}><input type="radio" name="googleMode" checked={googleMode==='byo'} onChange={()=>setGoogleMode('byo')}/> Use my own Google Cloud project (my API quota)</label>
     {googleMode==='byo'&&<div style={{display:'grid',gap:10,marginTop:8}}>
      <p style={{margin:0,color:'#64748b'}}>Create an OAuth Web Application in Google Cloud and authorize the callback URL below. Your credentials are sent directly to the CamMicGo server over HTTPS and stored encrypted, never shared with your AI agent. Google API calls then count against your own project quota, and the CamMicGo daily cap rises from 150 to 2,000 requests.</p>
      <code style={{overflowWrap:'anywhere',fontSize:'.85rem'}}>https://seo.cammicgo.com/api/auth/google/callback</code>
      <label style={{display:'grid',gap:5}}>Google OAuth Client ID<input type="text" autoComplete="off" value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="…apps.googleusercontent.com"/></label>
      <label style={{display:'grid',gap:5}}>Google OAuth Client Secret<input type="password" autoComplete="off" value={clientSecret} onChange={e=>setClientSecret(e.target.value)} placeholder="Client secret"/></label>
     </div>}
    </fieldset>
    <fieldset style={{border:'1px solid #e2e8f0',borderRadius:12,padding:16,display:'grid',gap:10}}><legend style={{fontWeight:700,padding:'0 6px'}}>Google APIs to authorize</legend>
     {apiOptions.map(option=><label key={option.scope} style={{display:'flex',gap:10,alignItems:'center'}}><input type="checkbox" checked={selectedScopes.includes(option.scope)} onChange={e=>setSelectedScopes(current=>e.target.checked?[...current,option.scope]:current.filter(scope=>scope!==option.scope))}/>{option.label}</label>)}
    </fieldset>
    {googleConnected&&<p role="status" style={{margin:0,color:'#166534',fontWeight:600}}>✓ Google account connected</p>}
    <button type="button" disabled={busy||!selectedScopes.length||(googleMode==='byo'&&(!clientId||!clientSecret))} onClick={()=>void connectGoogle()} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:12,width:'fit-content',minHeight:48,padding:'10px 20px',borderRadius:12,border:'1px solid #d1d5db',background:'#fff',color:'#202124',fontSize:'1rem',fontWeight:600,cursor:busy?'wait':'pointer',boxShadow:'0 2px 8px rgba(15,23,42,.06)'}}>
     <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.87 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
     {googleConnected?'Reconnect Google':'Continue with Google'}
    </button>
   </div>
   <div style={{borderTop:'1px solid #e2e8f0',paddingTop:20,display:'grid',gap:12}}>
    <h2 style={{margin:0,fontSize:'1.2rem'}}>Step 2 · Authorize {details.client?.name||details.client?.client_name||'your AI agent'}</h2>
    <p style={{margin:0,color:'#64748b'}}>Grant this agent access to your CamMicGo account. You can authorize the agent without connecting Google, but Google reports will remain unavailable.</p>
    <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:12}}>
     <button className="primary connect-button" type="button" disabled={busy} onClick={()=>void decide(true)} style={{minHeight:48,borderRadius:12,padding:'12px 22px',fontWeight:700}}>✓ Authorize agent</button>
     <button type="button" disabled={busy} onClick={()=>void decide(false)} style={{minHeight:48,borderRadius:12,padding:'12px 20px',border:'1px solid #cbd5e1',background:'#f8fafc',color:'#334155',fontWeight:600,cursor:busy?'wait':'pointer'}}>Deny access</button>
    </div>
   </div>
  </section>}
  <p className="privacy">You can revoke access in your account. Never share your Google OAuth client secret with an agent.</p>
 </div></main>;
}
