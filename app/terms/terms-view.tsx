'use client';
import {Fragment} from 'react';
import {useT} from '../lang-provider';
import {termsCopy} from '@/lib/copy/terms';

const GH='github.com/CamMicGo/cammicgo-seo-agent';
/** The GitHub address in the contact paragraph becomes a link to the issues page. */
const withLinks=(p:string)=>p.split(GH).map((part,i)=><Fragment key={i}>{i>0&&<a href={'https://'+GH+'/issues'}>{GH}</a>}{part}</Fragment>);

export default function TermsView(){
 const t=useT(termsCopy);
 return <main className="legal-page"><h1>{t.title}</h1><p className="legal-updated">{t.updated}</p><p>{t.intro}</p>
  {t.s.map(([h,p],i)=><section key={h}><h2>{i+1}. {h}</h2><p>{withLinks(p)}</p></section>)}
  <p className="legal-links"><a href="/privacy">{t.back}</a></p></main>;
}
