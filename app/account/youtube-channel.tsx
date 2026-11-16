'use client';
import {useCallback,useEffect,useState} from 'react';
import {useT} from '../lang-provider';
import {youtubeChannelCopy} from '@/lib/copy/youtube-channel';

type Channel={id:string;title:string|null};

/**
 * YouTube channels for the YouTube tools: the channel of the main Google connection, plus channels added here through
 * separate YouTube-only Google authorizations (brand accounts appear in Google's account chooser).
 */
export default function YouTubeChannel({token}:{token:string}){
 const t=useT(youtubeChannelCopy);
 const [list,setList]=useState<Channel[]|null>(null);
 const [busy,setBusy]=useState(false);const [msg,setMsg]=useState<{kind:'ok'|'err';text:string}|null>(null);
 const load=useCallback(async()=>{const r=await fetch('/api/account/youtube',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(r.ok)setList((await r.json() as {channels:Channel[]}).channels);},[token]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  const q=new URLSearchParams(location.search).get('youtube');
  if(q==='connected')setMsg({kind:'ok',text:t.done});else if(q==='denied')setMsg({kind:'err',text:t.denied});else if(q==='nochannel')setMsg({kind:'err',text:t.nochannel});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 async function add(){
  setBusy(true);setMsg(null);
  const r=await fetch('/api/account/youtube',{method:'POST',headers:{Authorization:'Bearer '+token}});
  const b=await r.json().catch(()=>({})) as {url?:string;error?:string};
  if(r.ok&&b.url){location.assign(b.url);return;}
  setBusy(false);setMsg({kind:'err',text:b.error==='byo_missing'?t.needClient:t.error});
 }
 async function remove(id:string){
  setBusy(true);setMsg(null);
  const r=await fetch('/api/account/youtube?channel='+encodeURIComponent(id),{method:'DELETE',headers:{Authorization:'Bearer '+token}});
  setBusy(false);if(!r.ok)setMsg({kind:'err',text:t.error});void load();
 }
 return <section className="acc-card" id="youtube"><h2>{t.title}</h2><p>{t.lead}</p>
  {msg&&<p role="status" className={'acc-msg '+msg.kind}>{msg.text}</p>}
  <p>✓ {t.main}</p>
  {!!list?.length&&<><p><b>{t.using}</b></p>
   <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
    {list.map(c=><li key={c.id} className="acc-row" style={{justifyContent:'space-between',alignItems:'center'}}>
     <span><b>{c.title??c.id}</b> <code dir="ltr">{c.id}</code></span>
     <button className="acc-btn ghost" disabled={busy} onClick={()=>void remove(c.id)}>{t.back}</button>
    </li>)}
   </ul></>}
  <div className="acc-row"><button className="acc-btn" disabled={busy||!list} onClick={()=>void add()}>{t.choose}</button></div>
  <p className="acc-note">{t.note} {t.ask}</p>
 </section>;
}
