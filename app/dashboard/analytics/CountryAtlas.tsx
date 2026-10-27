'use client';
import {useEffect,useState} from 'react';
type Row={dimensionValues?:Array<{value:string}>;metricValues?:Array<{value:string}>};
type Photo={available:boolean;imageUrl?:string;sourceUrl?:string;credit?:string;license?:string;caption?:string};
type Props={code:string;name:string;period:string;users:number;sessions:number;views:number;pages:Row[];daily:Row[];loading:boolean;onClose:()=>void;onNavigate:(code:string)=>void;countries:{code:string;name:string}[]};
const n=(value?:string)=>Number(value||0);
export default function CountryAtlas({code,name,period,users,sessions,views,pages,daily,loading,onClose,onNavigate,countries}:Props){
 const [photo,setPhoto]=useState<Photo|null>(null);
 useEffect(()=>{let active=true;setPhoto(null);fetch('/api/country-photo?country='+encodeURIComponent(code)).then(r=>r.json()).then(p=>{if(active)setPhoto(p)}).catch(()=>{if(active)setPhoto({available:false})});return()=>{active=false}},[code]);
 useEffect(()=>{const prev=document.body.style.overflow;document.body.style.overflow='hidden';const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',onKey);return()=>{document.body.style.overflow=prev;window.removeEventListener('keydown',onKey)}},[onClose]);
 const index=countries.findIndex(c=>c.code===code);
 const next=(shift:number)=>{const dest=countries[(index+shift+countries.length)%countries.length];if(dest)onNavigate(dest.code)};
 const heights=daily.map(r=>n(r.metricValues?.[1]?.value));const max=Math.max(1,...heights);
 return <div className="atlas-dialog" role="dialog" aria-modal="true" aria-label={'Visitor analytics for '+name}>
  <div className="atlas-photo" style={photo?.available&&photo.imageUrl?{backgroundImage:'linear-gradient(180deg,rgba(8,14,34,.35),rgba(8,14,34,.70) 45%,#070e20),url('+JSON.stringify(photo.imageUrl)+')'}:{}}/>
  <div className="atlas-inner">
   <div className="atlas-top"><a href="/" className="atlas-brand">◉ CamMicGo <strong>SEO Agent</strong></a><div className="atlas-controls"><button onClick={()=>next(-1)} aria-label="Previous country">←</button><button onClick={()=>next(1)} aria-label="Next country">→</button><button onClick={onClose} aria-label="Close country detail">Close ✕</button></div></div>
   <header className="atlas-country"><span className="atlas-kicker">LIVE GOOGLE ANALYTICS 4 · {period==='all'?'AVAILABLE HISTORY':period==='24h'?'CURRENT & PREVIOUS DAY':'LAST 28 DAYS'}</span><h2>{name}</h2><p>{code} · Audience landscape</p></header>
   <div className="atlas-space"/>
   {loading?<div className="atlas-panel">Loading real traffic data…</div>:<div className="atlas-panels">
     <section className="atlas-panel atlas-kpis"><h3>Google Analytics 4</h3><div><span>Sessions<strong>{sessions.toLocaleString()}</strong></span><span>Active users · summed daily<strong>{users.toLocaleString()}</strong></span><span>Page views<strong>{views.toLocaleString()}</strong></span></div><div className="atlas-spark">{heights.slice(-30).map((h,i)=><i key={i} style={{height:(Math.max(3,h/max*100))+'%'}} title={h+' sessions'}/>)}</div></section>
     <section className="atlas-panel atlas-pages"><h3>Top pages visited from {name}</h3>{pages.length?<ol>{pages.slice(0,6).map((r,i)=><li key={i}><span>{r.dimensionValues?.[0]?.value||'/'}</span><strong>{n(r.metricValues?.[0]?.value).toLocaleString()} views</strong></li>)}</ol>:<p>No page-level data for this period.</p>}</section>
   </div>}
   <footer className="atlas-foot"><span>{photo?.available&&photo.sourceUrl?<a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">Photograph: {photo.credit||'Wikimedia Commons'} · {photo.license||'open license'}</a>: 'Illustration unavailable — country-specific photograph requested from Wikimedia Commons'}</span><span>Statistics: Google Analytics Data API · not demonstration data</span></footer>
  </div>
 </div>
}
