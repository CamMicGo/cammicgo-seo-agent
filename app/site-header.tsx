'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {useLang,useT} from './lang-provider';
import {commonCopy} from '@/lib/copy/common';
import {languages,type Dict,type Lang} from '@/lib/i18n';
import {ACCESSIBILITY_ICON_PNG} from '@/lib/accessibility-icon';

const LOGO='https://avatars.githubusercontent.com/u/322584442?v=4';
const ACCOUNT:Dict<string>={en:'My account',fr:'Mon compte',es:'Mi cuenta',de:'Mein Konto',pt:'Minha conta',it:'Il mio account',ru:'Мой аккаунт',zh:'我的账户',ja:'マイアカウント',ko:'내 계정',ar:'حسابي'};
const A11Y:Dict<string>={en:'Accessibility and voice reader',fr:'Accessibilité et lecteur vocal',es:'Accesibilidad y lector de voz',de:'Barrierefreiheit und Vorlesefunktion',pt:'Acessibilidade e leitor de voz',it:'Accessibilità e lettore vocale',ru:'Доступность и озвучивание',zh:'无障碍与语音朗读',ja:'アクセシビリティと音声読み上げ',ko:'접근성 및 음성 읽기',ar:'إمكانية الوصول والقارئ الصوتي'};

type Key='home'|'remote'|'local'|'android'|'apis';
const activeFor=(path:string):Key|undefined=>path==='/'?'home':path.startsWith('/mcp')||path.startsWith('/connect')||path.startsWith('/setup/google-cloud')?'remote':path.startsWith('/setup/local')?'local':path.startsWith('/download')?'android':undefined;

/** Shared sticky header (all pages): brand, navigation, language, accessibility reader, GitHub. */
export default function SiteHeader(){
 const {lang,setLang}=useLang();
 const t=useT(commonCopy);
 const path=usePathname()||'/';
 const active=activeFor(path);
 const [open,setOpen]=useState(false);
 const [a11yOpen,setA11yOpen]=useState(false);
 useEffect(()=>{setOpen(false)},[path]);
 useEffect(()=>{const on=(e:Event)=>setA11yOpen(Boolean((e as CustomEvent<boolean>).detail));window.addEventListener('cammicgo-accessibility-state',on);return()=>window.removeEventListener('cammicgo-accessibility-state',on)},[]);
 useEffect(()=>{if(!open)return;const k=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[open]);
 const links:[Key,string,string][]=[['home','/',t.nav.home],['remote','/mcp/connect',t.nav.remote],['local','/setup/local',t.nav.local],['android','/download',t.nav.android],['apis','/#google-apis',t.nav.apis]];
 const openA11y=()=>{setOpen(false);window.dispatchEvent(new Event('cammicgo-open-accessibility'))};
 const langSelect=(id:string)=><label className="sh-lang" htmlFor={id}><span className="sr-only">{t.nav.language}</span>
  <select id={id} value={lang} onChange={e=>setLang(e.target.value as Lang)} aria-label={t.nav.language}>
   {languages.map(l=><option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
  </select></label>;
 return <header className="sh-wrap" data-open={open||undefined}>
  <div className="sh">
   <a className="sh-brand" href="/"><img src={LOGO} alt="" width="38" height="38"/><span>CamMicGo <b>SEO MCP</b></span></a>
   <nav className="sh-nav" aria-label="Main">{links.map(([k,href,label])=><a key={k} href={href} aria-current={k===active?'page':undefined}>{label}</a>)}</nav>
   <div className="sh-tools">
    <span className="sh-desk">{langSelect('sh-lang-desktop')}</span>
    <a className="sh-icon" href="/account" aria-label={ACCOUNT[lang]} title={ACCOUNT[lang]} aria-current={path.startsWith('/account')?'page':undefined}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg></a>
    <button type="button" className="sh-icon" onClick={openA11y} aria-label={A11Y[lang]} title={A11Y[lang]} aria-haspopup="dialog" aria-controls="a11y-dialog" aria-expanded={a11yOpen}><img src={ACCESSIBILITY_ICON_PNG} alt="" width="24" height="24"/></button>
    <a className="sh-icon sh-desk" href="https://github.com/CamMicGo/cammicgo-seo-mcp" target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub"><img src="/github-mark.svg" alt="" width="20" height="20"/></a>
    <button type="button" className="sh-icon sh-burger" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls="sh-menu" aria-label={open?t.nav.closeMenu:t.nav.openMenu}>
     <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{open?<path d="M6 6l12 12M18 6 6 18"/>:<path d="M4 7h16M4 12h16M4 17h16"/>}</svg>
    </button>
   </div>
  </div>
  <div className="sh-menu" id="sh-menu" hidden={!open}>
   <nav aria-label="Mobile">{links.map(([k,href,label])=><a key={k} href={href} aria-current={k===active?'page':undefined}>{label}<span aria-hidden="true">›</span></a>)}</nav>
   <div className="sh-menu-tools">{langSelect('sh-lang-mobile')}<a className="sh-icon" href="https://github.com/CamMicGo/cammicgo-seo-mcp" target="_blank" rel="noreferrer" aria-label="GitHub"><img src="/github-mark.svg" alt="" width="20" height="20"/></a></div>
  </div>
 </header>;
}
