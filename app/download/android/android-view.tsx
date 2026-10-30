'use client';
import DownloadButton from './download-button';
import {RelayLimits} from '../../relay-explainer';
import {useT} from '../../lang-provider';
import {androidCopy,hubCopy} from '@/lib/copy/apps';

export default function AndroidView(){
 const t=useT(androidCopy),h=useT(hubCopy);
 return <main className="site" style={{minHeight:'100vh'}}>
  <section className="hero" style={{paddingTop:60,paddingBottom:55}}>
   <span className="eyebrow"><img src="/os-logos/android.svg" alt="" width="16" height="16"/> {t.eyebrow}</span>
   <div className="hero-logo"><img src="/branding/cammicgo-seo-mcp-apk-icon.png" alt={h.logoAlt} width="112" height="112" style={{borderRadius:24}}/></div>
   <h1>{t.h1a} <span>{t.h1b}</span></h1>
   <p className="lead">{t.lead}</p>
   <DownloadButton/>
   <p className="notice">{t.notice}</p>
  </section>
  <section className="bottom">
   <div>
    <span className="kicker">{t.kicker}</span>
    <h2>{t.title}</h2>
    <p>{t.p1} <a href="/download">{t.guide}</a></p>
    <p>{t.p2}</p>
   </div>
  </section>
  <section className="feature-section" style={{paddingTop:0}}><RelayLimits/></section>
 </main>;
}
