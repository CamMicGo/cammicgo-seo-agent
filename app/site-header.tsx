'use client';
import {useLang,useT} from './lang-provider';
import {commonCopy} from '@/lib/copy/common';
import {languages,type Lang} from '@/lib/i18n';

const LOGO='https://avatars.githubusercontent.com/u/322584442?v=4';

/** Shared header: brand, centered navigation, language selector and GitHub link. */
export default function SiteHeader({active}:{active?:'home'|'remote'|'local'|'android'|'apis'}){
 const {lang,setLang}=useLang();
 const t=useT(commonCopy);
 const links:[typeof active,string,string][]=[['home','/',t.nav.home],['remote','/mcp/connect',t.nav.remote],['local','/setup/local',t.nav.local],['android','/download',t.nav.android],['apis','/#google-apis',t.nav.apis]];
 return <header className="sh">
  <a className="sh-brand" href="/"><img src={LOGO} alt="" width="40" height="40"/><span>CamMicGo <b>SEO MCP</b></span></a>
  <nav className="sh-nav" aria-label="Main">{links.map(([k,href,label])=><a key={href} href={href} aria-current={k===active?'page':undefined}>{label}</a>)}</nav>
  <div className="sh-tools">
   <label className="sh-lang"><span className="sr-only">{t.nav.language}</span>
    <select value={lang} onChange={e=>setLang(e.target.value as Lang)} aria-label={t.nav.language}>
     {languages.map(l=><option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
    </select>
   </label>
   <a className="sh-gh" href="https://github.com/CamMicGo/cammicgo-seo-mcp" target="_blank" rel="noreferrer" aria-label="GitHub"><img src="/github-mark.svg" alt="" width="20" height="20"/></a>
  </div>
 </header>;
}
