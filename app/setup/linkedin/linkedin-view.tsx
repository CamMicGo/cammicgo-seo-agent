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
  <span className="kicker">{t.kicker}</span><h1>{t.h1}</h1><p className="lead">{t.lead}</p>
  <h2>{t.s1t}</h2><p>{t.s1p}</p>
  <p><a href="https://www.linkedin.com/company/setup/new/" target="_blank" rel="noreferrer">{t.s1link}</a></p>
  <h2>{t.s2t}</h2><p>{t.s2p}</p>
  <p><a href="https://www.linkedin.com/developers/apps/new" target="_blank" rel="noreferrer">{t.s2link}</a></p>
  <h2>{t.s3t}</h2><p>{t.s3p}</p>
  <h2>{t.s4t}</h2><p>{t.s4p}</p>
  <p className="setup-redirect"><code dir="ltr">{REDIRECT}</code> <button type="button" className="acc-btn ghost" onClick={()=>void copy()}>{copied?t.copied:t.copy}</button></p>
  <h2>{t.s5t}</h2><p>{t.s5p}</p>
  <p><Link href="/account#linkedin">{t.s5link}</Link></p>
  <h2>{t.notesT}</h2>
  <ul><li>{t.note1}</li><li>{t.note2}</li><li>{t.note3}</li></ul>
 </main>;
}
