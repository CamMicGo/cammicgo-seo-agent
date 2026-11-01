'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useT} from '../../lang-provider';
import {linkedinGuideCopy} from '@/lib/copy/linkedin-guide';

const REDIRECT='https://seo.cammicgo.com/api/auth/linkedin/callback';

export default function LinkedInGuide(){
 const t=useT(linkedinGuideCopy);
 const [copied,setCopied]=useState(false);
 const copy=async()=>{try{await navigator.clipboard.writeText(REDIRECT);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{/* clipboard unavailable */}};
 return <main className="setup-guide">
  <span className="kicker">{t.kicker}</span><img className="li-guide-logo" src="/service-icons/linkedin.png" alt="LinkedIn" width="48" height="48"/><h1>{t.h1}</h1><p className="lead">{t.lead}</p>
  <h2>{t.waySimpleT}</h2><p>{t.waySimpleP}</p>
  <p><Link className="acc-btn" href="/account#linkedin">{t.waySimpleLink}</Link></p>
  <h2>{t.wayOwnT}</h2><p>{t.wayOwnP}</p>
  <h3>{t.s1t}</h3><p>{t.s1p}</p>
  <p><a href="https://www.linkedin.com/company/setup/new/" target="_blank" rel="noreferrer">{t.s1link}</a></p>
  <h3>{t.s2t}</h3><p>{t.s2p}</p>
  <p><a href="https://www.linkedin.com/developers/apps/new" target="_blank" rel="noreferrer">{t.s2link}</a></p>
  <h3>{t.s3t}</h3><p>{t.s3p}</p>
  <h3>{t.s4t}</h3><p>{t.s4p}</p>
  <p className="setup-redirect"><code dir="ltr">{REDIRECT}</code> <button type="button" className="acc-btn ghost" onClick={()=>void copy()}>{copied?t.copied:t.copy}</button></p>
  <figure className="guide-shot"><a href="/guides/linkedin/linkedin-app-auth.webp" target="_blank" rel="noreferrer"><img src="/guides/linkedin/linkedin-app-auth.webp" alt={t.shotAuth} width="720" height="1271" loading="lazy"/></a><figcaption>{t.shotAuth}</figcaption></figure>
  <h3>{t.s5t}</h3><p>{t.s5p}</p>
  <figure className="guide-shot"><a href="/guides/linkedin/cammicgo-account-linkedin.webp" target="_blank" rel="noreferrer"><img src="/guides/linkedin/cammicgo-account-linkedin.webp" alt={t.shotAccount} width="720" height="1127" loading="lazy"/></a><figcaption>{t.shotAccount}</figcaption></figure>
  <figure className="guide-shot wide"><a href="/guides/linkedin/cammicgo-account-linkedin-connected.webp" target="_blank" rel="noreferrer"><img src="/guides/linkedin/cammicgo-account-linkedin-connected.webp" alt={t.shotConnected} width="720" height="521" loading="lazy"/></a><figcaption>{t.shotConnected}</figcaption></figure>
  <p><Link href="/account#linkedin">{t.s5link}</Link></p>
  <h2>{t.sepT}</h2><p>{t.sepP}</p>
  <h2>{t.localT}</h2><p>{t.localP}</p>
  <h2>{t.notesT}</h2>
  <ul><li>{t.note1}</li><li>{t.note2}</li><li>{t.note3}</li></ul>
 </main>;
}
