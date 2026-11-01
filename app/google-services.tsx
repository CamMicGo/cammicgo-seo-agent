'use client';
import {useT} from './lang-provider';
import {servicesCopy,type ServiceDesc,type ServiceStatus} from '@/lib/copy/home';

/**
 * Services the assistant can use, in the order a visitor cares about. Google APIs link to their Google Cloud
 * library page; LinkedIn and the scientific sources link to their CamMicGo setup guide instead.
 */
type S={name:string;icon:string;status:ServiceStatus;desc:ServiceDesc;id?:string;guide?:string;translatedName?:'scienceName'};
const services:S[]=[
 {name:'Search Console',icon:'/google-search-console.svg',desc:'sc',status:'both',id:'webmasters.googleapis.com'},
 {name:'Google Analytics 4',icon:'/api/assets/google-analytics',desc:'ga4',status:'both',id:'analyticsdata.googleapis.com'},
 {name:'YouTube Data API',icon:'/google-logos/youtube.svg',desc:'yt',status:'yt',id:'youtube.googleapis.com'},
 {name:'YouTube Analytics',icon:'/google-logos/youtube.svg',desc:'yta',status:'remote',id:'youtubeanalytics.googleapis.com'},
 {name:'LinkedIn',icon:'/service-icons/linkedin.png',desc:'linkedin',status:'byo',guide:'/setup/linkedin'},
 {name:'Google Ads',icon:'/google-logos/google-ads.png',desc:'ads',status:'remote',id:'googleads.googleapis.com'},
 {name:'Google Drive',icon:'/google-logos/drive.png',desc:'drive',status:'remote',id:'drive.googleapis.com'},
 {name:'Gmail',icon:'/google-logos/gmail.png',desc:'gmail',status:'remote',id:'gmail.googleapis.com'},
 {name:'Google Calendar',icon:'/google-logos/calendar.png',desc:'cal',status:'both',id:'calendar-json.googleapis.com'},
 {name:'Scientific publications',translatedName:'scienceName',icon:'/service-icons/research.svg',desc:'science',status:'both',guide:'/setup/science'},
 {name:'Analytics Admin',icon:'/api/assets/google-analytics',desc:'admin',status:'both',id:'analyticsadmin.googleapis.com'},
 {name:'Google Docs',icon:'/google-logos/docs.png',desc:'viaDrive',status:'viaDrive',id:'docs.googleapis.com'},
 {name:'Google Sheets',icon:'/google-logos/sheets.png',desc:'viaDrive',status:'viaDrive',id:'sheets.googleapis.com'},
 {name:'Google Slides',icon:'/google-logos/slides.png',desc:'viaDrive',status:'viaDrive',id:'slides.googleapis.com'},
 {name:'Google Tasks',icon:'/google-logos/tasks.png',desc:'auth',status:'auth',id:'tasks.googleapis.com'},
 {name:'Google Contacts',icon:'/google-logos/contacts.png',desc:'auth',status:'auth',id:'people.googleapis.com'},
 {name:'Google Classroom',icon:'/google-logos/classroom.png',desc:'auth',status:'auth',id:'classroom.googleapis.com'},
 {name:'Google Chat',icon:'/google-logos/chat.png',desc:'auth',status:'auth',id:'chat.googleapis.com'},
 {name:'Apps Script',icon:'/google-logos/apps-script.png',desc:'auth',status:'auth',id:'script.googleapis.com'},
 {name:'Admin SDK API',icon:'/google-logos/admin-sdk.png',desc:'adminSdk',status:'adminNa',id:'admin.googleapis.com'},
 {name:'Web Search Indexing API',icon:'/google-logos/indexing.png',desc:'indexing',status:'optional',id:'indexing.googleapis.com'},
];
export default function GoogleServices(){
 const t=useT(servicesCopy);
 return <section id="google-apis" className="feature-section google-api-section">
  <span className="kicker">{t.kicker}</span><h2>{t.title}</h2><p className="lead">{t.lead}</p>
  <div className="google-service-grid">{services.map(s=><article className="google-service-card" key={s.name}>
   <div className="google-service-head"><img src={s.icon} alt="" width="42" height="42"/><div><h3>{s.translatedName?t[s.translatedName]:s.name}</h3><small>{t.status[s.status]}</small></div></div>
   <p>{t.desc[s.desc]}</p>
   {s.guide?<a href={s.guide}>{t.guide}</a>:<a href={'https://console.cloud.google.com/apis/library/'+s.id} target="_blank" rel="noreferrer">{t.gcp}</a>}
  </article>)}</div>
  <p className="notice">{t.notice} <a href="/setup/google-cloud">{t.guide}</a></p>
 </section>;
}
