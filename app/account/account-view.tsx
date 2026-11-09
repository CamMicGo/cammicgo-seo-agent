'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useT,useLang} from '../lang-provider';
import {accountCopy} from '@/lib/copy/account';
import {supabaseBrowser,supabaseConfigured} from '@/lib/supabase-browser';
import DriveStorage from './drive-storage';
import ScienceKeys from './science-keys';
import BingKey from './bing-key';
import LinkedInConnect from './linkedin-connect';

type Client={projectId:string|null;clientId:string;secretHint:string;verifiedAt:string|null;updatedAt:string};
type Account={admin:boolean;client:Client|null;redirectUri:string;google:{connected:boolean;mode:'shared'|'byo'|null;scopes:string[]|null;driveWrite:string[]|null};usage:{used:number;limit:number;perMinute:number;resetsAt:string}};
const MCP_URL='https://seo.cammicgo.com/api/mcp';
const APIS:Array<[string,string]>=[['Search Console','webmasters.readonly'],['Google Analytics 4','analytics.readonly'],['YouTube','youtube.readonly'],['YouTube Analytics','yt-analytics.readonly'],['YouTube ✎ (upload)','youtube.upload'],['Google Calendar','calendar.readonly'],['Google Calendar ✎ (events)','calendar.events'],['Gmail','gmail.readonly'],['Google Drive','drive.readonly'],['Google Drive ✎ (drive.file)','drive.file'],['Google Drive ⚠ full access (drive)','drive'],['Google Docs','documents.readonly'],['Google Sheets','spreadsheets.readonly'],['Google Slides','presentations.readonly'],['Google Tasks','tasks.readonly'],['Google Contacts','contacts.readonly'],['Google Classroom','classroom.courses.readonly'],['Google Chat','chat.spaces.readonly'],['Apps Script','script.projects.readonly'],['Google Ads','adwords']];
const LOGOS:Record<string,string>={
 'Search Console':'/google-search-console.svg','Google Analytics 4':'/api/assets/google-analytics',
 'YouTube':'/google-logos/youtube.svg','YouTube Analytics':'/google-logos/youtube.svg',
 'Google Calendar':'/google-logos/calendar.png','Gmail':'/google-logos/gmail.png','Google Drive':'/google-logos/drive.png',
 'Google Docs':'/google-logos/docs.png','Google Sheets':'/google-logos/sheets.png','Google Slides':'/google-logos/slides.png',
 'Google Tasks':'/google-logos/tasks.png','Google Contacts':'/google-logos/contacts.png',
 'Google Classroom':'/google-logos/classroom.png','Google Chat':'/google-logos/chat.png',
 'Apps Script':'/google-logos/apps-script.png','Google Ads':'/google-logos/google-ads.png'
};
const serviceName=(name:string)=>name.split(' ✎')[0].split(' ⚠')[0];
const permissionName=(id:string,lang:string)=>{
 const key=id==='youtube.upload'?'upload':id==='drive'?'full':id==='adwords'?'manage':id==='drive.file'||id==='calendar.events'?'write':'read';
 const dict:Record<string,Record<string,string>>={
 fr:{read:'Lecture',write:'Création et modification',full:'Accès complet (sensible)',manage:'Rapports et gestion',upload:'Mise en ligne (sensible)',granted:'Accordé',missing:'Non accordé'},
 en:{read:'Read',write:'Create and update',full:'Full access (sensitive)',manage:'Reports and management',upload:'Upload (sensitive)',granted:'Granted',missing:'Not granted'},
 de:{read:'Lesen',write:'Erstellen und ändern',full:'Vollzugriff (sensibel)',manage:'Berichte und Verwaltung',upload:'Hochladen (sensibel)',granted:'Erteilt',missing:'Nicht erteilt'},
 es:{read:'Lectura',write:'Crear y modificar',full:'Acceso completo (sensible)',manage:'Informes y gestión',upload:'Subir (sensible)',granted:'Concedido',missing:'Sin conceder'},
 pt:{read:'Leitura',write:'Criar e editar',full:'Acesso total (sensível)',manage:'Relatórios e gestão',upload:'Carregar (sensível)',granted:'Concedido',missing:'Não concedido'},
 it:{read:'Lettura',write:'Creazione e modifica',full:'Accesso completo (sensibile)',manage:'Report e gestione',upload:'Caricamento (sensibile)',granted:'Concesso',missing:'Non concesso'},
 ru:{read:'Чтение',write:'Создание и изменение',full:'Полный доступ',manage:'Отчёты и управление',upload:'Загрузка',granted:'Разрешено',missing:'Не разрешено'},
 zh:{read:'读取',write:'创建和修改',full:'完整访问（敏感）',manage:'报告和管理',upload:'上传（敏感）',granted:'已授权',missing:'未授权'},
 ja:{read:'読み取り',write:'作成・変更',full:'フルアクセス（機密）',manage:'レポート・管理',upload:'アップロード（機密）',granted:'許可済み',missing:'未許可'},
 ko:{read:'읽기',write:'생성 및 수정',full:'전체 액세스 (민감)',manage:'보고서 및 관리',upload:'업로드 (민감)',granted:'허용됨',missing:'허용되지 않음'},
 ar:{read:'قراءة',write:'إنشاء وتعديل',full:'وصول كامل (حساس)',manage:'تقارير وإدارة',upload:'رفع (حساس)',granted:'ممنوح',missing:'غير ممنوح'}
 };
 return (dict[lang]||dict.en)[key];
};
type Action='read'|'create'|'edit'|'rename'|'move'|'delete'|'upload'|'manage';
const ACTIONS:Record<string,Record<string,Action[]>>={
 'Google Calendar':{'calendar.readonly':['read'],'calendar.events':['read','create','edit','delete']},
 'Google Drive':{'drive.readonly':['read'],'drive.file':['read','create','edit','rename','move','delete'],'drive':['read','create','edit','rename','move','delete']},
 'Google Docs':{'documents.readonly':['read']},
 'Google Sheets':{'spreadsheets.readonly':['read']},
 'Google Slides':{'presentations.readonly':['read']},
 'YouTube':{'youtube.readonly':['read'],'youtube.upload':['upload']},
 'Google Ads':{'adwords':['read','manage']}
};
const ACTION_LABELS:Record<string,Record<Action,string>>={
 fr:{read:'Lire',create:'Créer',edit:'Modifier',rename:'Renommer',move:'Déplacer',delete:'Supprimer',upload:'Mettre en ligne',manage:'Gérer'},
 en:{read:'Read',create:'Create',edit:'Edit',rename:'Rename',move:'Move',delete:'Delete',upload:'Upload',manage:'Manage'},
 de:{read:'Lesen',create:'Erstellen',edit:'Bearbeiten',rename:'Umbenennen',move:'Verschieben',delete:'Löschen',upload:'Hochladen',manage:'Verwalten'},
 es:{read:'Leer',create:'Crear',edit:'Modificar',rename:'Renombrar',move:'Mover',delete:'Eliminar',upload:'Subir',manage:'Gestionar'},
 pt:{read:'Ler',create:'Criar',edit:'Editar',rename:'Renomear',move:'Mover',delete:'Eliminar',upload:'Carregar',manage:'Gerir'},
 it:{read:'Leggere',create:'Creare',edit:'Modificare',rename:'Rinominare',move:'Spostare',delete:'Eliminare',upload:'Caricare',manage:'Gestire'},
 ru:{read:'Читать',create:'Создать',edit:'Изменить',rename:'Переименовать',move:'Переместить',delete:'Удалить',upload:'Загрузить',manage:'Управлять'},
 zh:{read:'读取',create:'创建',edit:'修改',rename:'重命名',move:'移动',delete:'删除',upload:'上传',manage:'管理'},
 ja:{read:'読み取り',create:'作成',edit:'編集',rename:'名前変更',move:'移動',delete:'削除',upload:'アップロード',manage:'管理'},
 ko:{read:'읽기',create:'만들기',edit:'수정',rename:'이름 변경',move:'이동',delete:'삭제',upload:'업로드',manage:'관리'},
 ar:{read:'قراءة',create:'إنشاء',edit:'تعديل',rename:'إعادة تسمية',move:'نقل',delete:'حذف',upload:'رفع',manage:'إدارة'}
};
const actionLabels=(lang:string)=>ACTION_LABELS[lang]||ACTION_LABELS.en;
const actionsFor=(service:string,ids:string[])=>{
 const actions=new Set<Action>();
 for(const id of ids)for(const a of ACTIONS[service]?.[id]??(id.endsWith('.readonly')?['read' as Action]:[]))actions.add(a);
 // Document filenames, moving and trashing are Drive operations, not Docs/Sheets/Slides scopes.
 if(['Google Docs','Google Sheets','Google Slides'].includes(service)){
  if(ids.includes('documents')||ids.includes('spreadsheets')||ids.includes('presentations')){actions.add('create');actions.add('edit');}
  if(actions.has('read')&&(ids.includes('drive.file')||ids.includes('drive')))for(const a of ['rename','move','delete'] as Action[])actions.add(a);
 }
 return (['read','create','edit','rename','move','delete','upload','manage'] as Action[]).filter(a=>actions.has(a));
};
const scopeUrl=(s:string)=>'https://www.googleapis.com/auth/'+s;
/** "Select all" never ticks full Drive access (it allows trashing any file): that one stays an explicit choice. */
const RECOMMENDED_SCOPES=['webmasters.readonly','analytics.readonly'].map(scopeUrl);
// Keep the quick selection limited to the core SEO reports. Other services require explicit opt-in.
const SELECT_ALL=RECOMMENDED_SCOPES;
const fill=(s:string,v:Record<string,string|number>)=>s.replace(/\{(\w+)\}/g,(_,k)=>String(v[k]??''));

export default function AccountView(){
 const t=useT(accountCopy);
 const {lang}=useLang();
 const [email,setEmail]=useState('');
 const [userEmail,setUserEmail]=useState<string|null>(null);
 const [token,setToken]=useState<string|null>(null);
 const [ready,setReady]=useState(false);
 const [acc,setAcc]=useState<Account|null>(null);
 const [msg,setMsg]=useState<{kind:'ok'|'err';text:string}|null>(null);
 const [busy,setBusy]=useState(false);
 const [editing,setEditing]=useState(false);
 const [form,setForm]=useState({projectId:'',clientId:'',clientSecret:''});
 const [scopes,setScopes]=useState<string[]>(RECOMMENDED_SCOPES);
 const [useShared,setUseShared]=useState(false);

 const load=useCallback(async(tk:string)=>{
  const r=await fetch('/api/account',{headers:{Authorization:'Bearer '+tk},cache:'no-store'});
  if(r.ok){const a=await r.json() as Account;setAcc(a);const granted=[...(a.google.scopes??[]),...(a.google.driveWrite??[])];if(granted.length){const s=[...new Set(granted)].filter(x=>APIS.some(([,id])=>scopeUrl(id)===x));if(s.length)setScopes(s);}}
 },[]);

 useEffect(()=>{
  if(!supabaseConfigured){setReady(true);return;}
  const sb=supabaseBrowser();
  const apply=(s:{access_token:string;user:{email?:string}}|null)=>{setToken(s?.access_token??null);setUserEmail(s?.user.email??null);if(s)void load(s.access_token);setReady(true);};
  void sb.auth.getSession().then(({data})=>apply(data.session));
  const {data:sub}=sb.auth.onAuthStateChange((_e,s)=>apply(s));
  const q=new URLSearchParams(location.search).get('google');
  if(q==='connected'||q==='partial')setMsg({kind:'ok',text:t.googleDone});else if(q==='denied')setMsg({kind:'err',text:t.googleDenied});
  return()=>sub.subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[load]);

 async function sendLink(){
  setBusy(true);setMsg(null);
  const {error}=await supabaseBrowser().auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+'/account'}});
  setBusy(false);setMsg(error?{kind:'err',text:error.message}:{kind:'ok',text:t.sent});
 }
 async function saveClient(){
  if(!token)return;setBusy(true);setMsg(null);
  const r=await fetch('/api/account',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(form)});
  const body=await r.json().catch(()=>({})) as {error?:keyof typeof t.err;verified?:boolean};
  setBusy(false);
  if(!r.ok){setMsg({kind:'err',text:t.err[body.error as keyof typeof t.err]??t.err.generic});return;}
  setForm({projectId:'',clientId:'',clientSecret:''});setEditing(false);
  setMsg({kind:'ok',text:body.verified?t.saved:t.savedUnverified});void load(token);
 }
 async function removeClient(){
  if(!token||!confirm(t.removeConfirm))return;
  setBusy(true);const r=await fetch('/api/account',{method:'DELETE',headers:{Authorization:'Bearer '+token}});setBusy(false);
  setMsg(r.ok?{kind:'ok',text:t.removed}:{kind:'err',text:t.err.generic});void load(token);
 }
 async function connectGoogle(only?:string[]){
  if(!token)return;setBusy(true);setMsg(null);
  const r=await fetch('/api/mcp/google/start',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({mode:useShared?'shared':'byo',scopes:only??scopes,returnTo:'/account'})});
  const body=await r.json().catch(()=>({})) as {url?:string;error?:string};
  if(r.ok&&body.url){location.assign(body.url);return;}
  setBusy(false);setMsg({kind:'err',text:body.error==='byo_missing'?t.needClient:body.error||t.err.generic});
 }

 const pct=acc?Math.min(100,Math.round(acc.usage.used*100/Math.max(1,acc.usage.limit))):0;
 const canConnect=!!acc&&(!!acc.client||(acc.admin&&useShared));
 const rows=[t.remote,t.local,t.dashboard];

 return <main className="acc">
  <span className="kicker">{t.kicker}</span>
  <h1>{t.title}</h1>
  <p className="lead">{t.lead}</p>
  {msg&&<p role="status" className={'acc-msg '+msg.kind}>{msg.text}</p>}

  {ready&&!token&&<section className="acc-card"><h2>{t.signTitle}</h2><p>{t.signText}</p>
   <div className="acc-row"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@gmail.com" autoComplete="email" aria-label={t.email}/>
   <button className="acc-btn" disabled={busy||!email.includes('@')} onClick={()=>void sendLink()}>{t.send}</button></div></section>}

  {token&&<>
   <div className="acc-who"><span>{t.signedAs} <b>{userEmail}</b>{acc?.admin&&<em className="acc-badge">{t.admin}</em>}</span><button className="acc-link" onClick={()=>void supabaseBrowser().auth.signOut()}>{t.signOut}</button></div>

   <section className="acc-card"><h2>{t.usageTitle}</h2>
    <div className="acc-usage"><b>{acc?fill(t.usageOf,{used:acc.usage.used,limit:acc.usage.limit}):'…'}</b></div>
    <div className="acc-bar"><div style={{width:pct+'%',background:pct>=90?'#dc2626':undefined}}/></div>
    <p className="acc-note">{fill(t.usageNote,{perMinute:acc?.usage.perMinute??10})}</p>
   </section>

   <section className="acc-card"><h2>{t.gcpTitle}</h2><p>{t.gcpLead} <a href="/setup/google-cloud">{t.guide}</a></p>
    {acc?.client&&!editing?<div className="acc-client">
     <dl>{acc.client.projectId&&<><dt>{t.projectId}</dt><dd><code>{acc.client.projectId}</code></dd></>}
      <dt>{t.clientId}</dt><dd><code>{acc.client.clientId}</code></dd>
      <dt>{t.clientSecret}</dt><dd><code>{acc.client.secretHint}</code> <span className={acc.client.verifiedAt?'acc-ok':'acc-warn'}>{acc.client.verifiedAt?'✓ '+t.verified:t.notVerified}</span></dd></dl>
     <div className="acc-row"><button className="acc-btn ghost" onClick={()=>setEditing(true)}>{t.edit}</button><button className="acc-btn danger" disabled={busy} onClick={()=>void removeClient()}>{t.remove}</button></div>
    </div>:<div className="acc-form">
     <label>{t.projectId}<input value={form.projectId} onChange={e=>setForm({...form,projectId:e.target.value})} placeholder={t.projectHint} dir="ltr" autoComplete="off"/></label>
     <label>{t.clientId}<input value={form.clientId} onChange={e=>setForm({...form,clientId:e.target.value})} placeholder="123456789-abc….apps.googleusercontent.com" dir="ltr" autoComplete="off" spellCheck={false}/></label>
     <label>{t.clientSecret}<input type="password" value={form.clientSecret} onChange={e=>setForm({...form,clientSecret:e.target.value})} placeholder={t.secretPh} dir="ltr" autoComplete="off"/></label>
     <p className="acc-note">🔒 {t.secretNote}</p>
     <div className="acc-row"><button className="acc-btn" disabled={busy||!form.clientId||!form.clientSecret} onClick={()=>void saveClient()}>{busy?t.saving:t.save}</button>{editing&&<button className="acc-btn ghost" onClick={()=>setEditing(false)}>{t.cancel}</button>}</div>
    </div>}
   </section>

   <section className="acc-card"><h2>{t.googleTitle}</h2>
    <p className={acc?.google.connected?'acc-ok':''}>{acc?.google.connected?(acc.google.mode==='shared'?t.googleShared:t.googleByo):t.googleNone}</p>
    <fieldset className="acc-apis"><legend>{t.apis}</legend>
     <p className="acc-note">Recommended: Search Console and Analytics (read-only). Select additional Google services only when you need them. Sensitive Google permissions may require OAuth verification by the owner of the selected Google Cloud project.</p>
     <label className="acc-all"><input type="checkbox" checked={SELECT_ALL.every(x=>scopes.includes(x))} onChange={e=>setScopes(e.target.checked?[...SELECT_ALL,...scopes.filter(x=>!SELECT_ALL.includes(x))]:[])}/>{t.selectAll}</label>
     {Array.from(new Set(APIS.map(([name])=>serviceName(name)))).map(name=>{
      const options=APIS.filter(([n])=>serviceName(n)===name);
      const granted=new Set([...(acc?.google.scopes??[]),...(acc?.google.driveWrite??[])]);
      const anyGranted=options.some(([,id])=>granted.has(scopeUrl(id)));
      return <div key={name} style={{padding:'12px 8px',borderBottom:'1px solid #e2e8f0',display:'grid',gap:8}}>
       <div style={{display:'flex',alignItems:'center',gap:10}}>
        <img src={LOGOS[name]} width={28} height={28} alt="" style={{objectFit:'contain',flexShrink:0}}/>
        <strong style={{flex:1}}>{name}</strong>
        <span aria-label={anyGranted?'Granted permissions':'No granted permissions'} style={{fontSize:12,color:anyGranted?'#166534':'#64748b'}}>{anyGranted?'✓':'×'}</span>
       </div>
       <div style={{display:'flex',flexWrap:'wrap',gap:6,paddingLeft:38}} aria-label={name+' actions'}>
        {(['read','create','edit','rename','move','delete','upload','manage'] as Action[]).filter(action=>name==='YouTube'?['read','upload'].includes(action):name==='Google Ads'?['read','manage'].includes(action):name==='Google Calendar'?['read','create','edit','delete'].includes(action):['Google Drive','Google Docs','Google Sheets','Google Slides'].includes(name)?['read','create','edit','rename','move','delete'].includes(action):['read'].includes(action)).map(action=>{
         const ids=[...granted].map(scope=>scope.split('/auth/')[1]).filter((id):id is string=>Boolean(id));
         const enabled=actionsFor(name,ids).includes(action);
         return <span key={action} aria-label={actionLabels(lang)[action]+(enabled?' ✓':' ×')} style={{fontSize:12,padding:'4px 8px',borderRadius:8,background:enabled?'#245edc':'#e5e7eb',color:enabled?'#fff':'#6b7280',fontWeight:650,opacity:enabled?1:.85}}>{actionLabels(lang)[action]}</span>;
        })}
       </div>
       <div style={{display:'flex',flexWrap:'wrap',gap:'8px 14px',paddingLeft:38}}>
        {options.map(([,id])=><label key={id} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:13}}>
         <input type="checkbox" checked={scopes.includes(scopeUrl(id))} onChange={e=>setScopes(current=>e.target.checked?Array.from(new Set([...current,scopeUrl(id)])):current.filter(x=>x!==scopeUrl(id)))}/>
         <span>{permissionName(id,lang)}</span>
         <span aria-label={granted.has(scopeUrl(id))?'Granted':'Not granted'} title={granted.has(scopeUrl(id))?'Granted':'Not granted'} style={{color:granted.has(scopeUrl(id))?'#15803d':'#b91c1c',fontWeight:800,fontSize:15}}>{granted.has(scopeUrl(id))?'✓':'×'}</span>
        </label>)}
       </div>
      </div>;
     })}
    </fieldset>
    {acc?.admin&&<label className="acc-shared"><input type="checkbox" checked={useShared} onChange={e=>setUseShared(e.target.checked)}/>{t.useShared}</label>}
    {!acc?.client&&!(acc?.admin&&useShared)&&<p className="acc-warn">{t.needClient}</p>}
    <button className="acc-btn google" disabled={busy||!canConnect||!scopes.length} onClick={()=>void connectGoogle()}>
     <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.87 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
     {acc?.google.connected?t.reconnect:t.connect}</button>
    <div className="acc-drive-write">
     <p className={acc?.google.driveWrite?.length?'acc-ok':'acc-note'}>{acc?.google.driveWrite?.length?'✓ '+t.driveWriteOn+' ('+acc.google.driveWrite.map(x=>x.split('/auth/')[1]).join(', ')+')':t.driveWriteOff}</p>
     {acc?.google.connected&&!acc.google.driveWrite?.length&&<button className="acc-btn ghost" disabled={busy||!canConnect} onClick={()=>void connectGoogle([scopeUrl('drive.file')])}>✎ {t.driveWriteBtn}</button>}
     <p className="acc-note">{t.driveWriteNote}</p>
    </div>
    <p className="acc-note">{t.testUsers}</p>
   </section>

   <DriveStorage token={token} googleConnected={!!acc?.google.connected}/>

   <LinkedInConnect token={token}/>
   <BingKey token={token}/>
   <ScienceKeys token={token}/>
  </>}

  <section className="acc-card"><h2>{t.urlsTitle}</h2><p>{t.urlsLead}</p>
   <div className="acc-table" role="table">
    <div className="acc-tr head" role="row"><span role="columnheader">{t.colUse}</span><span role="columnheader">{t.colType}</span><span role="columnheader">{t.colRedirect}</span><span role="columnheader">{t.colWhere}</span></div>
    {rows.map((r,i)=><div className="acc-tr" role="row" key={i}><span role="cell"><b>{r.use}</b></span><span role="cell">{r.type}</span><span role="cell"><code dir="ltr">{r.redirect}</code></span><span role="cell">{r.where}</span></div>)}
   </div>
   <p><b>{t.mcpUrl}</b> <code dir="ltr">{MCP_URL}</code></p>
   <p className="acc-note">{t.localNote} <Link href="/setup/local">/setup/local ↗</Link></p>
  </section>
 </main>;
}
