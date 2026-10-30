'use client';
import GoogleServices from './google-services';
import {useT} from './lang-provider';
import {homeCopy} from '@/lib/copy/home';

const REPO='https://github.com/CamMicGo/cammicgo-seo-mcp';
export default function HomeView(){
 const t=useT(homeCopy);
 return <div className="site"><main>
  <section className="hero">
   <span className="eyebrow"><span className="dot"/> {t.eyebrow}</span>
   <div className="hero-logo"><img src="https://avatars.githubusercontent.com/u/322584442?v=4" alt="CamMicGo" width="96" height="96"/></div>
   <h1>{t.h1a}<br/><span>{t.h1b}</span></h1>
   <p className="lead">{t.lead}</p>
   <div className="pills">{t.pills.map(p=><span key={p}>{p}</span>)}</div>
   <div className="actions"><a className="primary" href="/mcp/connect">{t.ctaRemote}</a><a className="secondary" href="/setup/local">{t.ctaLocal}</a><a className="secondary" href="/download">{t.ctaApps}</a></div>
   <p className="notice">{t.notice} <a href="/setup/google-cloud">{t.noticeLink} ↗</a></p>
  </section>
  <section className="bottom" id="apps"><div>
   <span className="kicker">{t.appsKicker}</span><h2>{t.appsTitle}</h2><p>{t.appsText}</p>
   <a className="android-cta" href="/download"><span className="home-os"><img src="/os-logos/android.svg" alt="" width="26" height="26"/><img src="/os-logos/windows.svg" alt="" width="22" height="22"/><img src="/os-logos/macos.svg" alt="" width="22" height="22"/><img src="/os-logos/linux.svg" alt="" width="24" height="24"/></span><span className="android-cta-text"><small>{t.appsSmall}</small><strong>{t.appsCta}</strong><em>{t.appsMeta}</em></span><span className="android-cta-arrow" aria-hidden="true">→</span></a>
  </div></section>
  <GoogleServices/>
  <section id="how" className="bottom"><div>
   <span className="kicker">{t.agentsKicker}</span><h2>{t.agentsTitle}</h2><p>{t.agentsText}</p>
   <code>https://seo.cammicgo.com/api/mcp</code>
  </div><div className="status"><span className="status-dot"/> {t.status} <a href="/api/health">{t.health}</a></div></section>
 </main>
 <footer><span>{t.builtBy} <a href="https://www.cammicgo.com">CamMicGo</a> · {t.tests}</span><span><a href={REPO}>{t.source}</a> · {t.license}</span></footer></div>;
}
