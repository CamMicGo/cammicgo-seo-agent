'use client';
import {RelayFlow,RelayLimits,RelaySteps} from '../../relay-explainer';
import {useT} from '../../lang-provider';
import {remoteCopy} from '@/lib/copy/remote';
import Rich,{LinkIn} from '../../rich';

const MCP_URL='https://seo.cammicgo.com/api/mcp';
const REDIRECT='https://seo.cammicgo.com/api/auth/google/callback';
const TOOLS=[{k:'sc',icon:'/google-search-console.svg',name:'Search Console'},{k:'ga4',icon:'/api/assets/google-analytics',name:'Google Analytics 4'},{k:'yt',icon:'/google-logos/youtube.svg',name:'YouTube'},{k:'cal',icon:'/google-logos/calendar.png',name:'Google Calendar'}] as const;

export default function ConnectView(){
 const t=useT(remoteCopy);
 return <div className="site">
  <section className="hero" style={{paddingTop:56,paddingBottom:40}}>
   <span className="eyebrow">{t.eyebrow}</span>
   <h1>{t.h1a} <span>{t.h1b}</span></h1>
   <p className="lead">{t.lead}</p>
  </section>
  <section className="feature-section" style={{paddingTop:0}}>
   <span className="kicker">{t.k1}</span><h2>{t.t1}</h2>
   <div className="connect-grid">
    <article className="connect-card"><h3>{t.urlTitle}</h3><p><code className="connect-url">{MCP_URL}</code></p><p><Rich text={t.urlText}/></p></article>
    <article className="connect-card"><h3>Gemini CLI</h3><p><Rich text={t.gemini}/></p><pre className="connect-pre" dir="ltr">{'{\n  "mcpServers": {\n    "cammicgo-seo": { "httpUrl": "'+MCP_URL+'" }\n  }\n}'}</pre></article>
   </div>
  </section>
  <section className="feature-section" style={{paddingTop:0}}>
   <span className="kicker">{t.k2}</span><h2>{t.t2}</h2><p className="lead">{t.lead2}</p>
   <div className="connect-grid">
    <article className="connect-card"><h3>{t.shared.t}</h3><p><Rich text={t.shared.p}/></p></article>
    <article className="connect-card connect-card-accent"><h3>{t.own.t}</h3><p><Rich text={t.own.p}/></p></article>
   </div>
   <ol className="relay-steps" style={{marginTop:22}}>
    {t.steps.map((s,i)=><li key={i}><span className="relay-step-num">{i+1}</span><h3>{s.t}</h3><p><Rich text={s.p}/>{i===0&&<> <a href="/setup/google-cloud">{t.checklist}</a></>}{i===2&&<> <code className="connect-url">{REDIRECT}</code></>}</p></li>)}
   </ol>
  </section>
  <section className="feature-section" style={{paddingTop:0}}>
   <span className="kicker">{t.k3}</span><h2>{t.t3}</h2>
   <div className="connect-tools">{TOOLS.map(x=><article className="connect-card" key={x.k}><div className="google-service-head"><img src={x.icon} alt="" width="36" height="36"/><h3>{x.name}</h3></div><p>{t.tools[x.k]}</p></article>)}</div>
   <p className="notice">{t.readOnly}</p>
  </section>
  <section className="feature-section" style={{paddingTop:0}}>
   <span className="kicker">{t.ytK}</span><h2>{t.ytT}</h2><p className="lead">{t.ytLead}</p>
   <RelayFlow/><RelaySteps/><RelayLimits/>
   <p className="notice"><a href="/download">{t.apps}</a> · <LinkIn text={t.noDevice} phrase={t.local} href="/setup/local"/></p>
  </section>
 </div>;
}
