'use client';
import {useState} from 'react';
import {useT} from '../lang-provider';
import {connectCopy} from '@/lib/copy/setup';

export default function Connect(){
 const [advanced,setAdvanced]=useState(false);
 const t=useT(connectCopy);
 return <main className="auth-page"><div className="auth-panel">
  <span className="kicker">{t.kicker}</span><h1>{t.h1a}<br/><span>{t.h1b}</span></h1><p className="lead">{t.lead}</p>
  <div className="connect-card"><h2>{t.stdTitle}</h2><p>{t.stdText}</p><a className="primary connect-button" href="/api/auth/google/start?mode=shared"><span className="google-g" aria-hidden="true">G</span><span>{t.cont}</span></a></div>
  <p className="privacy"><a href="/setup/google-cloud">{t.guide}</a></p>
  <div className="connect-card"><button type="button" className="advanced-toggle" aria-expanded={advanced} onClick={()=>setAdvanced(!advanced)}>{t.advanced} <span>{advanced?'−':'+'}</span></button>
   {advanced&&<form action="/api/auth/google/start" method="POST" className="advanced-form"><input type="hidden" name="mode" value="byo"/><p>{t.advText}</p>
    <label>{t.idLabel}<input name="client_id" autoComplete="off" required placeholder="...apps.googleusercontent.com" dir="ltr"/></label>
    <label>{t.secretLabel}<input type="password" name="client_secret" autoComplete="off" required placeholder={t.secretPh} dir="ltr"/></label>
    <label>{t.redirect}<code dir="ltr">https://seo.cammicgo.com/api/auth/google/callback</code></label>
    <button type="submit" className="primary connect-button">{t.submit}</button></form>}
  </div>
  <p className="privacy">{t.foot} <a href="/privacy">{t.privacy}</a></p><a href="/" className="back-link">{t.back}</a>
 </div></main>;
}
