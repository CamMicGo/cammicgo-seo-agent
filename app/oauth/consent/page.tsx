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
 useEffect(()=>{
  const authorizationId=new URLSearchParams(window.location.search).get('authorization_id')||'';
  setId(authorizationId);
  if(!authorizationId){setError('Missing authorization request. Start again from ChatGPT.');return;}
  void (async()=>{
   if(!publicKey){setError('Supabase connection is not configured.');return;}
   const {data:{user}}=await getSupabase().auth.getUser();
   setLoggedIn(!!user);
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
 async function connectGoogle(){try{const {data}=await getSupabase().auth.getSession();if(!data.session)throw Error('Sign in first');const response=await fetch('/api/mcp/google/start',{method:'POST',headers:{Authorization:'Bearer '+data.session.access_token}});const result=await response.json();if(!response.ok||!result.url)throw Error(result.error||'Google OAuth failed');window.location.assign(result.url)}catch(e){setError(e instanceof Error?e.message:'Google connection failed')}}
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
  {loggedIn&&details&&<div className="connect-card"><button type="button" disabled={busy} onClick={()=>void connectGoogle()}>Connect Google</button><button className="primary connect-button" disabled={busy} onClick={()=>void decide(true)}>Authorize access</button>
   <button type="button" disabled={busy} onClick={()=>void decide(false)}>Deny access</button></div>}
  <p className="privacy">You can revoke access in your account. Never share your Google OAuth client secret with an agent.</p>
 </div></main>;
}
