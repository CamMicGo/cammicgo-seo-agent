'use client';
import {useT} from '../../lang-provider';
import {gcpCopy} from '@/lib/copy/setup';
import Rich from '../../rich';

const REDIRECT='https://seo.cammicgo.com/api/auth/google/callback';
const APIS=[
 {k:'sc',name:'Search Console',id:'webmasters.googleapis.com',live:true,logo:'/google-search-console.svg'},
 {k:'ga4',name:'Google Analytics Data',id:'analyticsdata.googleapis.com',live:true,logo:'/api/assets/google-analytics'},
 {k:'admin',name:'Google Analytics Admin',id:'analyticsadmin.googleapis.com',live:true,logo:'/api/assets/google-analytics'},
 {k:'yt',name:'YouTube Data API v3',id:'youtube.googleapis.com',live:true,logo:'/google-logos/youtube.svg'},
 {k:'cal',name:'Google Calendar',id:'calendar-json.googleapis.com',live:true,logo:'/google-logos/calendar.png'},
 {k:'gmail',name:'Gmail API',id:'gmail.googleapis.com',live:false,logo:'/google-logos/gmail.png'},
 {k:'drive',name:'Google Drive API',id:'drive.googleapis.com',live:false,logo:'/google-logos/drive.png'},
 {k:'sheets',name:'Google Sheets API',id:'sheets.googleapis.com',live:false,logo:'/google-logos/sheets.png'},
 {k:'docs',name:'Google Docs API',id:'docs.googleapis.com',live:false,logo:'/google-logos/docs.png'},
 {k:'ads',name:'Google Ads',id:'googleads.googleapis.com',live:false,logo:'/google-logos/google-ads.png'},
] as const;

export default function GcpView(){
 const t=useT(gcpCopy);
 return <main className="setup-guide">
  <span className="kicker">{t.kicker}</span><h1>{t.h1}</h1><p className="lead">{t.lead}</p>
  <h2>{t.s1t}</h2><p>{t.s1p}</p>
  <p><a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">{t.s1link}</a></p>
  <h2>{t.s2t}</h2><p><Rich text={t.s2p}/></p>
  <div className="setup-api-grid">{APIS.map(a=><article className="setup-api" key={a.id}>
   <div className="setup-api-head"><img src={a.logo} alt="" width="38" height="38"/><strong>{a.name}</strong><span className={a.live?'setup-tag':'setup-tag setup-tag-muted'}>{a.live?t.live:t.planned}</span></div>
   <p>{t.api[a.k]}</p>
   <a target="_blank" rel="noreferrer" href={'https://console.cloud.google.com/apis/library/'+a.id}>{t.open}</a>
  </article>)}</div>
  <h2>{t.s3t}</h2><ol>{t.s3.map((s,i)=><li key={i}><Rich text={s}/></li>)}</ol>
  <p><a href="https://console.cloud.google.com/auth/branding" target="_blank" rel="noreferrer">Google Auth Platform ↗</a></p>
  <h2>{t.s4t}</h2><p><Rich text={t.s4p}/></p>
  <pre dir="ltr"><code>{REDIRECT}</code></pre>
  <p><Rich text={t.s4after}/></p>
  <p><a href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noreferrer">Google Auth Platform › Clients ↗</a></p>
  <h2>{t.s5t}</h2><ul>{t.s5.map((s,i)=><li key={i}><Rich text={s}/></li>)}</ul>
  <p><a href="/account">{t.connect}</a></p>
  <h2>{t.s6t}</h2><p><Rich text={t.s6p}/></p>
  <p><a href="https://console.cloud.google.com/apis/dashboard" target="_blank" rel="noreferrer">{t.dash}</a></p>
  <div className="setup-alert"><strong>{t.localT}</strong> <Rich text={t.localP}/> <a href="/setup/local">{t.localLink}</a></div>
  <footer className="setup-footer"><a href="/account">{t.connect}</a><a href="https://github.com/CamMicGo/cammicgo-seo-mcp">{t.source}</a></footer>
 </main>;
}
