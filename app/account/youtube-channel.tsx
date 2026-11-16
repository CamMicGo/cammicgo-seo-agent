'use client';
import {useCallback,useEffect,useState} from 'react';
import {useT} from '../lang-provider';
import {youtubeChannelCopy} from '@/lib/copy/youtube-channel';

type Status={separate:boolean;channelId:string|null;channelTitle:string|null};

/**
 * Which YouTube channel the YouTube tools use. By default, the channel of the main Google connection; the user can
 * pick another one (a brand channel) through a separate YouTube-only Google authorization.
 */
export default function YouTubeChannel({token}:{token:string}){
 const t=useT(youtubeChannelCopy);
 const [st,setSt]=useState<Status|null>(null);
 const [busy,setBusy]=useState(false);const [msg,setMsg]=useState<{kind:'ok'|'err';text:string}|null>(null);
 const load=useCallback(async()=>{const r=await fetch('/api/account/youtube',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(r.ok)setSt(await r.json() as Status);},[token]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  const q=new URLSearchParams(location.search).get('youtube');
  if(q==='connected')setMsg({kind:'ok',text:t.done});else if(q==='denied')setMsg({kind:'err',text:t.denied});else if(q==='nochannel')setMsg({kind:'err',text:t.nochannel});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 async function choose(){
  setBusy(true);setMsg(null);
  const r=await fetch('/api/account/youtube',{method:'POST',headers:{Authorization:'Bearer '+token}});
  const b=await r.json().catch(()=>({})) as {url?:string;error?:string};
  if(r.ok&&b.url){location.assign(b.url);return;}
  setBusy(false);setMsg({kind:'err',text:b.error==='byo_missing'?t.needClient:t.error});
 }
 async function back(){
  setBusy(true);setMsg(null);
  const r=await fetch('/api/account/youtube',{method:'DELETE',headers:{Authorization:'Bearer '+token}});
  setBusy(false);if(!r.ok)setMsg({kind:'err',text:t.error});void load();
 }
 return <section className="acc-card"><h2>{t.title}</h2><p>{t.lead}</p>
  {msg&&<p role="status" className={'acc-msg '+msg.kind}>{msg.text}</p>}
  <p className={st?.separate?'acc-ok':''}>{st?.separate?<>✓ {t.using} <b>{st.channelTitle??st.channelId??'?'}</b></>:t.main}</p>
  <div className="acc-row">
   <button className="acc-btn" disabled={busy||!st} onClick={()=>void choose()}>{st?.separate?t.change:t.choose}</button>
   {st?.separate&&<button className="acc-btn ghost" disabled={busy} onClick={()=>void back()}>{t.back}</button>}
  </div>
  <p className="acc-note">{t.note}</p>
 </section>;
}
