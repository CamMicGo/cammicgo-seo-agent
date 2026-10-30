'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {useT} from '../../lang-provider';
import {localCopy,type LocalCopy} from '@/lib/copy/local';
import {commonCopy} from '@/lib/copy/common';

export type Os='windows'|'macos'|'linux';
type Line={cmd?:string;out?:string};
const REPO='https://github.com/CamMicGo/cammicgo-seo-mcp';

const terminalName:Record<Os,string>={windows:'PowerShell',macos:'Terminal',linux:'Terminal'};
const prompt:Record<Os,(dir?:boolean)=>string>={
 windows:d=>d?'PS C:\\Users\\you\\cammicgo-seo-mcp>':'PS C:\\Users\\you>',
 macos:d=>d?'you@Mac cammicgo-seo-mcp %':'you@Mac ~ %',
 linux:d=>d?'you@ubuntu:~/cammicgo-seo-mcp$':'you@ubuntu:~$',
};
const jsonPath:Record<Os,string>={windows:'C:\\Users\\you\\Downloads\\client_secret.json',macos:'/Users/you/Downloads/client_secret.json',linux:'/home/you/Downloads/client_secret.json'};

const installTools:Record<Os,Line[]>={
 windows:[{cmd:'winget install --id Git.Git -e'},{out:'Successfully installed'},{cmd:'winget install --id OpenJS.NodeJS.LTS -e'},{out:'Successfully installed'}],
 macos:[{cmd:'brew install git node'},{out:'==> Pouring node--24…  🍺  node was successfully installed!'}],
 linux:[{cmd:'sudo apt update && sudo apt install -y git curl'},{cmd:'curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -'},{cmd:'sudo apt install -y nodejs'}],
};

/** Neutral pictograms (no third-party logos). */
export function OsIcon({os}:{os:Os}){
 return <img className="lg-os-logo" src={'/os-logos/'+os+'.svg'} alt="" width="34" height="34" aria-hidden="true"/>;
}
const StepIcon=({i}:{i:number})=>{
 const paths=['M12 3v12m0 0-4-4m4 4 4-4M5 21h14','M4 7h6l2 2h8v10H4z','M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z','M5 12l4 4L19 6','M8 12h8M12 8v8M4 4h16v16H4z','M9 12l2 2 4-4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18'];
 return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[i]}/></svg>;
};

function Terminal({os,lines,dir}:{os:Os;lines:Line[];dir?:boolean}){
 const t=useT(commonCopy);
 const [copied,setCopied]=useState(false);
 const commands=lines.filter(l=>l.cmd).map(l=>l.cmd).join('\n');
 const copy=async()=>{try{await navigator.clipboard.writeText(commands);setCopied(true);setTimeout(()=>setCopied(false),1600)}catch{}};
 return <figure className={'term term-'+os}>
  <figcaption className="term-bar">
   {os==='macos'?<span className="term-dots" aria-hidden="true"><i/><i/><i/></span>:<span className="term-title">{os==='windows'?'Windows PowerShell':'you@ubuntu: ~'}</span>}
   {os==='macos'&&<span className="term-title">Terminal — zsh</span>}
   <button type="button" className="term-copy" onClick={copy}>{copied?t.ui.copied:t.ui.copy}</button>
  </figcaption>
  <pre className="term-body">{lines.map((l,i)=>l.cmd
   ?<div key={i}><span className="term-prompt">{prompt[os](dir)} </span><span className="term-cmd">{l.cmd}</span></div>
   :<div key={i} className="term-out">{l.out}</div>)}</pre>
 </figure>;
}

/** Landing: what you need and three system buttons. */
export function LocalChooser(){
 const t=useT(localCopy);
 return <div className="site">
  <section className="hero lg-hero">
   <span className="eyebrow">{t.kicker}</span>
   <h1>{t.title}</h1>
   <p className="lead">{t.lead}</p>
  </section>
  <section className="lg-choose" aria-labelledby="choose">
   <h2 id="choose">{t.choose}</h2>
   <div className="lg-os-grid">
    {(['windows','macos','linux'] as Os[]).map(os=><a key={os} className="lg-os" href={'/setup/local/'+os}>
     <span className="lg-os-icon"><OsIcon os={os}/></span>
     <span className="lg-os-text"><strong>{os==='windows'?'Windows':os==='macos'?'macOS':'Linux'}</strong><small>{t.os[os]}</small></span>
     <span className="lg-os-go" aria-hidden="true">→</span>
    </a>)}
   </div>
   <div className="lg-needs">
    <strong>{t.needs}</strong>
    <ul>{t.needsList.map(n=><li key={n}>{n}</li>)}</ul>
   </div>
   <p className="notice"><a href={REPO} target="_blank" rel="noreferrer"><img src="/github-mark.svg" alt="" width="16" height="16" style={{verticalAlign:'-3px',marginRight:6}}/>{t.repo} ↗</a> · {t.remote} <a href="/mcp/connect">{t.remoteLink} ↗</a></p>
  </section>
 </div>;
}

function stepContent(os:Os,i:number,t:LocalCopy):ReactNode{
 const term=terminalName[os];
 switch(i){
  case 0:return <>
   <p className="lg-open"><b>{term}</b> · {t.open[os]}</p>
   {os==='macos'&&<p className="lg-note"><a href="https://brew.sh" target="_blank" rel="noreferrer">{t.brew} ↗</a></p>}
   <Terminal os={os} lines={installTools[os]}/>
   <Terminal os={os} lines={[{cmd:'git --version'},{out:'git version 2.47.0'},{cmd:'node --version'},{out:'v22.12.0'}]}/>
   {os==='windows'&&<p className="lg-note">{t.reopen.replace('{terminal}',term)}</p>}
  </>;
  case 1:return <>
   <Terminal os={os} lines={[{cmd:'git clone '+REPO+'.git'},{out:"Cloning into 'cammicgo-seo-mcp'... done."},{cmd:'cd cammicgo-seo-mcp'},{cmd:'npm install'},{out:'added 412 packages in 1m'}]}/>
   <p className="lg-note"><a href={REPO} target="_blank" rel="noreferrer"><img src="/github-mark.svg" alt="" width="16" height="16" style={{verticalAlign:'-3px',marginRight:6}}/>{t.repo} ↗</a></p>
  </>;
  case 2:return <div className="lg-links">
   <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">① {t.links.project} ↗</a>
   <a href="/setup/google-cloud">② {t.links.checklist} ↗</a>
   <a href="https://console.cloud.google.com/auth/audience" target="_blank" rel="noreferrer">③ {t.links.audience} ↗</a>
   <a href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noreferrer">④ {t.links.clients} ↗</a>
  </div>;
  case 3:return <>
   <Terminal os={os} dir lines={[{cmd:'npm run install:local'},{out:'CamMicGo SEO MCP — Installation locale guidée'},{out:'Ces étapes Google Cloud sont-elles terminées ? (o/N) : o'},{out:'Chemin du fichier OAuth Bureau Google (.json) : '+jsonPath[os]},{out:'Opening Google sign-in in your browser...'},{out:'Google account connected locally.'},{out:'Quel agent souhaitez-vous configurer ? (claude/gemini/cursor/aucun) : claude'}]}/>
   <p className="lg-note">{t.example}</p>
  </>;
  case 4:return <>
   <p className="lg-note">{t.choiceNote}</p>
   <Terminal os={os} dir lines={[{cmd:'npm run agent:setup -- claude'},{cmd:'npm run agent:setup -- cursor'},{cmd:'npm run agent:setup -- gemini'}]}/>
  </>;
  default:return <>
   <Terminal os={os} dir lines={[{cmd:'npm run local:doctor'},{out:'Google OAuth credentials: configured'},{out:'Encrypted Google token: valid'},{cmd:'npm run test:mcp:local'},{out:'PASS: stdio MCP handshake, tool discovery (14), service_info invocation.'}]}/>
   <div className="lg-prompts"><strong>{t.prompts}</strong><ul>{t.promptList.map(p=><li key={p}>« {p} »</li>)}</ul></div>
  </>;
 }
}

/** One system's guide: progress, one step at a time, previous / next, back to the menu. */
export function LocalGuide({os}:{os:Os}){
 const t=useT(localCopy);
 const c=useT(commonCopy);
 const [step,setStep]=useState(0);
 const total=t.steps.length;
 useEffect(()=>{const m=location.hash.match(/step-(\d)/);if(m)setStep(Math.min(total-1,Math.max(0,Number(m[1])-1)));},[total]);
 const go=(n:number)=>{const s=Math.min(total-1,Math.max(0,n));setStep(s);history.replaceState(null,'','#step-'+(s+1));document.getElementById('lg-top')?.scrollIntoView({behavior:'smooth',block:'start'});};
 const [title,text]=t.steps[step];
 const name=os==='windows'?'Windows':os==='macos'?'macOS':'Linux';
 return <div className="site">
  <main className="lg-guide" id="lg-top">
   <a className="lg-back" href="/setup/local">← {c.ui.menu}</a>
   <div className="lg-guide-head"><span className="lg-os-icon"><OsIcon os={os}/></span><div><span className="kicker">{t.kicker}</span><h1>{name}</h1><p>{t.os[os]}</p></div></div>
   <div className="lg-progress" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step+1}><span style={{width:((step+1)/total*100)+'%'}}/></div>
   <ol className="lg-dots">{t.steps.map(([s],i)=><li key={s}><button type="button" aria-current={i===step?'step':undefined} className={i<step?'done':''} onClick={()=>go(i)} aria-label={c.ui.step+' '+(i+1)+': '+s}>{i<step?'✓':i+1}</button></li>)}</ol>
   <section className="lg-step" aria-live="polite">
    <div className="lg-step-head"><span className="lg-step-icon"><StepIcon i={step}/></span><div><small>{c.ui.step} {step+1} {c.ui.of} {total}</small><h2>{title}</h2></div></div>
    <p>{text.replace('{terminal}',terminalName[os])}</p>
    {stepContent(os,step,t)}
    {step===total-1&&<div className="lg-done"><strong>✓ {t.doneTitle}</strong><p>{t.doneText}</p></div>}
   </section>
   <div className="lg-nav">
    <button type="button" className="lg-btn lg-btn-ghost" onClick={()=>go(step-1)} disabled={step===0}>← {c.ui.back}</button>
    {step<total-1?<button type="button" className="lg-btn" onClick={()=>go(step+1)}>{c.ui.next} →</button>:<a className="lg-btn" href="/setup/local">{c.ui.done}</a>}
   </div>
  </main>
 </div>;
}
