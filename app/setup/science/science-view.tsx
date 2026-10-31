'use client';
import {useT} from '../../lang-provider';
import {scienceCopy} from '@/lib/copy/science';
import Rich from '../../rich';

/** Guide: the five scientific sources, their quotas with and without a key, and how to get each free key. */
export default function ScienceGuide(){
 const t=useT(scienceCopy);
 const keyed=[
  {name:'OpenAlex',cover:t.cov_oa,no:t.lim_oa_no,yes:t.lim_oa_key,steps:t.st_oa,home:'https://openalex.org/'},
  {name:'Semantic Scholar (Ai2)',cover:t.cov_s2,no:t.lim_s2_no,yes:t.lim_s2_key,steps:t.st_s2,home:'https://www.semanticscholar.org/'},
  {name:'PubMed (NCBI)',cover:t.cov_pm,no:t.lim_pm_no,yes:t.lim_pm_key,steps:t.st_pm,home:'https://pubmed.ncbi.nlm.nih.gov/'},
 ];
 return <main className="setup-guide">
  <span className="kicker">{t.kicker}</span><h1>{t.h1}</h1><p className="lead">{t.glead}</p>
  {keyed.map(k=><section key={k.name}>
   <h2><a href={k.home} target="_blank" rel="noreferrer">{k.name}</a></h2><p>{k.cover}</p>
   <ul><li><strong>{t.withoutKey}:</strong> {k.no}</li><li><strong>{t.withKey}:</strong> {k.yes}</li></ul>
   <h3>{t.steps}</h3><ol>{k.steps.map((s,i)=><li key={i}><Rich text={s}/></li>)}</ol>
  </section>)}
  <h2>{t.noKeyT}</h2>
  <ul><li><strong><a href="https://arxiv.org/" target="_blank" rel="noreferrer">arXiv</a></strong> — {t.cov_ax}</li><li><strong><a href="https://hal.science/" target="_blank" rel="noreferrer">HAL</a></strong> — {t.cov_hal}</li></ul>
  <div className="setup-alert">{t.scholarNote}</div>
  <h2>{t.promptsT}</h2><ul>{t.prompts.map((p,i)=><li key={i}>« {p} »</li>)}</ul>
  <footer className="setup-footer"><a href="/account">{t.saveKeys}</a><a href="https://github.com/CamMicGo/cammicgo-seo-mcp">GitHub</a></footer>
 </main>;
}
