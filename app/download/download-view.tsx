'use client';
import DownloadButton from './android/download-button';
import {RelayFlow,RelayLimits,RelaySteps} from '../relay-explainer';
import {useT} from '../lang-provider';
import {hubCopy} from '@/lib/copy/apps';
import Rich from '../rich';

export default function DownloadView(){
 const t=useT(hubCopy);
 const platforms=[
  {name:'Android',icon:'android',desc:t.android,state:t.available,href:'/download/android'},
  {name:'Windows',icon:'windows',desc:t.win,state:t.download,href:'/download/desktop#windows',local:'/setup/local/windows'},
  {name:'macOS',icon:'macos',desc:t.mac,state:t.download,href:'/download/desktop#macos',local:'/setup/local/macos'},
  {name:'Linux',icon:'linux',desc:t.linux,state:t.download,href:'/download/desktop#linux',local:'/setup/local/linux'},
  {name:'iOS / iPadOS',icon:'ios',desc:t.ios,state:t.unavailable,href:''},
 ];
 return <div className="site">
  <section className="hero" style={{paddingTop:60,paddingBottom:50}}>
   <span className="eyebrow">{t.eyebrow}</span>
   <div className="hero-logo"><img src="/branding/cammicgo-seo-mcp-apk-icon.png" alt={t.logoAlt} width="112" height="112" style={{borderRadius:24}}/></div>
   <h1>{t.h1a} <span>{t.h1b}</span></h1>
   <p className="lead">{t.lead}</p>
   <DownloadButton/>
   <p className="notice">{t.notice} <a href="/download/android">{t.details} ↗</a></p>
  </section>
  <section className="feature-section" aria-labelledby="platforms-title">
   <span className="kicker">{t.platformsKicker}</span>
   <h2 id="platforms-title">{t.platformsTitle}</h2>
   <div className="agent-platforms">
    {platforms.map(p=><article className="agent-platform" key={p.name}>
     <span className="agent-platform-icon" aria-hidden="true"><img src={`/os-logos/${p.icon}.svg`} alt="" width="44" height="44" className="os-logo"/></span>
     <h3>{p.name}</h3><p>{p.desc}</p>
     {p.href?<a className="agent-unavailable agent-available" href={p.href}>{p.state}</a>:<span className="agent-unavailable">{p.state}</span>}
     {p.local?<a className="agent-local-link" href={p.local}>{t.orLocal}</a>:null}
    </article>)}
   </div>
   <p className="notice">{t.platformsNote}</p>
  </section>
  <section className="feature-section" aria-labelledby="sync-title">
   <span className="kicker">{t.syncKicker}</span>
   <h2 id="sync-title">{t.syncTitle}</h2>
   <p className="lead">{t.syncLead}</p>
   <RelayFlow/>
   <h2 style={{marginTop:56}}>{t.stepsTitle}</h2>
   <RelaySteps/>
   <RelayLimits/>
   <p className="notice"><Rich text={t.revoke}/></p>
  </section>
  <section className="feature-section" aria-labelledby="manual-title">
   <span className="kicker">{t.manualKicker}</span>
   <h2 id="manual-title">{t.manualTitle}</h2>
   <p className="lead"><Rich text={t.manualLead}/></p>
  </section>
 </div>;
}
