'use client';
import {useT} from '../../lang-provider';
import {desktopCopy} from '@/lib/copy/apps';
import Rich from '../../rich';

export default function DesktopView(){
 const t=useT(desktopCopy);
 const os=[
  {id:'windows',name:'Windows',sub:t.win.sub,links:[{href:'/download/desktop/windows',label:t.win.label,meta:t.win.meta}],first:t.win.first.map(s=><>{s}</>)},
  {id:'macos',name:'macOS',sub:t.mac.sub,links:[{href:'/download/desktop/macos-arm64',label:t.mac.silicon,meta:'.zip'},{href:'/download/desktop/macos-x64',label:t.mac.intel,meta:'.zip'}],first:t.mac.first.map(s=><>{s}</>)},
  {id:'linux',name:'Linux',sub:t.linux.sub,links:[{href:'/download/desktop/linux-x64',label:'Linux x64',meta:'.tar.gz'},{href:'/download/desktop/linux-arm64',label:'Linux ARM64',meta:'.tar.gz'}],first:[<code key="a">tar -xzf CamMicGo-Relay-Linux-x64.tar.gz</code>,<code key="b">./cammicgo-relay</code>,<>{t.linux.open}</>]},
 ];
 const [pre,post]=t.note.split(t.noteLink);
 return <main className="site" style={{minHeight:'100vh'}}>
  <section className="hero" style={{paddingTop:54,paddingBottom:30}}>
   <span className="eyebrow">{t.eyebrow}</span>
   <div className="dk-logos" aria-hidden="true">{os.map(o=><img key={o.id} src={`/os-logos/${o.id}.svg`} alt="" width="46" height="46"/>)}</div>
   <h1>{t.h1a} <span>{t.h1b}</span></h1>
   <p className="lead">{t.lead}</p>
   <p className="dk-note">{post!==undefined?<>{pre}<a href="/setup/local">{t.noteLink}</a>{post}</>:<>{t.note} <a href="/setup/local">{t.noteLink} ↗</a></>}</p>
  </section>
  <section className="feature-section" style={{paddingTop:10}} aria-labelledby="dk-dl">
   <span className="kicker">{t.dlKicker}</span>
   <h2 id="dk-dl">{t.dlTitle}</h2>
   <div className="dk-grid">
    {os.map(o=><article className="dk-card" key={o.id} id={o.id}>
     <div className="dk-head"><img src={`/os-logos/${o.id}.svg`} alt="" width="40" height="40"/><div><h3>{o.name}</h3><small>{o.sub}</small></div></div>
     <div className="dk-links">{o.links.map(l=><a key={l.href} className="dk-btn" href={l.href}><span>{l.label}</span><em>{l.meta}</em></a>)}</div>
     <ol className="dk-first">{o.first.map((s,i)=><li key={i}>{s}</li>)}</ol>
    </article>)}
   </div>
  </section>
  <section className="feature-section" style={{paddingTop:0}} aria-labelledby="dk-pair">
   <span className="kicker">{t.pairKicker}</span>
   <h2 id="dk-pair">{t.pairTitle}</h2>
   <div className="dk-steps">{t.steps.map((s,i)=><div className="dk-step" key={i}><b>{i+1}</b><div><strong>{s.title}</strong><p>{s.text}</p></div></div>)}</div>
  </section>
  <section className="feature-section" style={{paddingTop:0}} aria-labelledby="dk-know">
   <span className="kicker">{t.faqKicker}</span>
   <h2 id="dk-know">{t.faqTitle}</h2>
   <div className="dk-faq">{t.faq.map((f,i)=><details key={i} open={i===0}><summary>{f.q}</summary><p><Rich text={f.a}/></p></details>)}</div>
  </section>
 </main>;
}
