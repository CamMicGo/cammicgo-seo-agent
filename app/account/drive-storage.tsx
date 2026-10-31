'use client';
import {useCallback,useEffect,useState} from 'react';
import {useT} from '../lang-provider';
import {driveCopy} from '@/lib/copy/drive';

type Quota={limit:string|null;usage:string|null;usageInDrive:string|null;usageInDriveTrash:string|null;remaining:string|null;percentUsed:number|null;unlimited:boolean};
type DriveState={connected:boolean;drive?:boolean;reason?:string;account?:string|null;quota?:Quota;checkedAt?:string};
const fill=(s:string,v:Record<string,string>)=>s.replace(/\{(\w+)\}/g,(_,k)=>v[k]??'');

/** Google storage gauge on /account: real figures from Google's about.get, refreshed on demand. */
export default function DriveStorage({token,googleConnected}:{token:string;googleConnected:boolean}){
 const t=useT(driveCopy);
 const [state,setState]=useState<DriveState|null>(null);
 const [busy,setBusy]=useState(false);
 const [failed,setFailed]=useState(false);
 const load=useCallback(async()=>{
  setBusy(true);setFailed(false);
  try{const r=await fetch('/api/account/drive',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
   if(!r.ok&&r.status!==429)throw new Error(String(r.status));setState(await r.json() as DriveState);}
  catch{setFailed(true);}finally{setBusy(false);}
 },[token]);
 useEffect(()=>{if(googleConnected)void load();},[googleConnected,load]);

 const q=state?.quota;
 const pct=q?.percentUsed??0;
 const tone=pct>=90?'danger':pct>=75?'warn':'';
 const ok=!!(state?.connected&&state.drive&&q);
 const message=!googleConnected||state?.connected===false?t.notConnected
  :state?.reason==='missing_drive_permission'||state?.reason==='missing_google_permission'?t.missingScope
  :state?.reason==='drive_api_disabled'?t.apiDisabled
  :failed||(state&&!ok&&state.reason)?t.error:null;

 return <section className="acc-card acc-drive" aria-labelledby="acc-drive-title">
  <div className="acc-drive-head">
   <h2 id="acc-drive-title"><svg width="22" height="20" viewBox="0 0 87.3 78" aria-hidden="true"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg>{t.title}</h2>
   {googleConnected&&<button className="acc-btn ghost" disabled={busy} onClick={()=>void load()}>{busy?t.refreshing:'↻ '+t.refresh}</button>}
  </div>
  <p className={'acc-drive-status '+(ok?'acc-ok':'')}><span className={'acc-dot '+(ok?'on':'')} aria-hidden="true"/>{ok?t.connected+(state?.account?' · '+state.account:''):message??'…'}</p>
  {ok&&q&&<>
   <div className="acc-usage"><b>{q.unlimited?fill(t.usedNoLimit,{used:q.usage??'?'}):fill(t.usedOf,{used:q.usage??'?',total:q.limit??'?'})}</b>{q.percentUsed!=null&&<span className="acc-pct">{q.percentUsed.toLocaleString(undefined,{maximumFractionDigits:1})} %</span>}</div>
   {q.percentUsed!=null&&<div className={'acc-bar '+tone} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={t.title}><div style={{width:Math.min(100,pct)+'%'}}/></div>}
   <dl className="acc-drive-grid">
    <div><dt>{t.remaining}</dt><dd>{q.remaining??t.na}</dd></div>
    <div><dt>{t.total}</dt><dd>{q.limit??t.na}</dd></div>
    <div><dt>{t.inDrive}</dt><dd>{q.usageInDrive??t.na}</dd></div>
    <div><dt>{t.trash}</dt><dd>{q.usageInDriveTrash??t.na}</dd></div>
   </dl>
   {state?.checkedAt&&<p className="acc-note">{fill(t.updated,{time:new Date(state.checkedAt).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})})}</p>}
  </>}
  <p className="acc-note">{t.shared}</p>
 </section>;
}
