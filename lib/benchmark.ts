/**
 * Benchmark: the same research tasks answered by an AI assistant with its usual web search (mode "web")
 * and with CamMicGo (mode "cammicgo"). Each answer is timed by the user and scored automatically against
 * authoritative sources (OpenAlex, Crossref, HAL): verified vs invented references, coverage, correctness.
 */
import * as sci from '@/lib/science';
import {containsValue,extractIds,idCount,parseVerdicts,referenceLines,type FoundIds,type Verdict} from '@/lib/benchmark-parse';

type L={fr:string;en:string};
export type BenchTask={id:string;title:L;prompt:L;skill:L};
const WEB:L={fr:'Utilise uniquement ta recherche web habituelle : n’utilise pas CamMicGo.',en:'Use only your usual web search: do not use CamMicGo.'};
const CMG:L={fr:'Utilise les outils CamMicGo (science_…) pour répondre.',en:'Use the CamMicGo tools (science_…) to answer.'};
export const MODE_INSTRUCTIONS={web:WEB,cammicgo:CMG};

const VERIFY_LIST={
 fr:'1. LeCun Y, Bengio Y, Hinton G (2015). Deep learning. Nature 521:436–444.\n2. Martin P (2019). Quantum gravity effects on the migration of Breton cats. Nature. doi:10.1038/nature14539\n3. Vaswani A et al. (2017). Attention is all you need. NeurIPS.\n4. Zorglub Q (2021). Hyperdimensional banana routing in sentient spreadsheets. Journal of Imaginary Results 12(3):1–9.\n5. Devlin J, Chang MW, Lee K, Toutanova K (2019). BERT: Pre-training of deep bidirectional transformers for language understanding. NAACL.\n6. Durand C (2020). Neural SEO ranking of Gallic ice-cream blogs. Proceedings of the Imaginary Web Conference.',
};
export const TASKS:BenchTask[]=[
 {id:'author-bibliography',title:{fr:'Bibliographie complète d’un chercheur',en:'Complete bibliography of a researcher'},skill:{fr:'Exhaustivité, identité de l’auteur',en:'Completeness, author identity'},
  prompt:{fr:'Donne-moi toutes les publications de Thomas Bourquard (chercheur français en bio-informatique), de la plus récente à la plus ancienne, avec le DOI de chacune.',
   en:'Give me all the publications of Thomas Bourquard (French bioinformatics researcher), from newest to oldest, with the DOI of each one.'}},
 {id:'latest-topic',title:{fr:'Veille : publications des 30 derniers jours',en:'Watch: papers from the last 30 days'},skill:{fr:'Fraîcheur, dates exactes',en:'Freshness, exact dates'},
  prompt:{fr:'Quelles sont les 10 publications scientifiques les plus récentes (30 derniers jours) sur le « generative engine optimization » (GEO) ou l’optimisation pour les moteurs de réponse IA ? Donne pour chacune le titre, la date et le DOI ou le lien.',
   en:'What are the 10 most recent scientific publications (last 30 days) on generative engine optimization (GEO) or optimization for AI answer engines? Give the title, date and DOI or link of each.'}},
 {id:'most-cited',title:{fr:'Articles les plus cités d’un domaine',en:'Most cited papers of a field'},skill:{fr:'Classement par citations, PDF gratuits',en:'Citation ranking, free PDFs'},
  prompt:{fr:'Quels sont les 5 articles les plus cités sur la retrieval-augmented generation (RAG) publiés depuis 2023 ? Donne le nombre de citations, le DOI et un lien vers un PDF gratuit s’il existe.',
   en:'What are the 5 most cited papers on retrieval-augmented generation (RAG) published since 2023? Give the citation count, the DOI and a link to a free PDF if one exists.'}},
 {id:'citing-papers',title:{fr:'Qui cite un article ?',en:'Who cites a paper?'},skill:{fr:'Graphe de citations exact',en:'Exact citation graph'},
  prompt:{fr:'Donne 10 articles publiés en 2026 qui citent « Attention Is All You Need » (Vaswani et al., 2017), avec leur DOI.',
   en:'Give 10 papers published in 2026 that cite "Attention Is All You Need" (Vaswani et al., 2017), with their DOI.'}},
 {id:'verify-references',title:{fr:'Détecter des références inventées',en:'Detect invented references'},skill:{fr:'Fiabilité, anti-hallucination',en:'Reliability, anti-hallucination'},
  prompt:{fr:'Vérifie ces 6 références. Pour chacune, réponds sur une ligne : numéro, verdict (RÉELLE, INVENTÉE ou DOI ERRONÉ) et le DOI correct si elle existe.\n'+VERIFY_LIST.fr,
   en:'Check these 6 references. For each one, answer on one line: number, verdict (REAL, INVENTED or WRONG DOI) and the correct DOI if it exists.\n'+VERIFY_LIST.fr}},
 {id:'fulltext-fact',title:{fr:'Un chiffre précis dans le texte intégral',en:'A precise figure in the full text'},skill:{fr:'Lecture du texte intégral',en:'Full-text reading'},
  prompt:{fr:'Dans l’article « Attention Is All You Need » (arXiv 1706.03762), quel score BLEU obtient le Transformer (big) sur WMT 2014 anglais→allemand ? Cite la phrase exacte de l’article.',
   en:'In the paper "Attention Is All You Need" (arXiv 1706.03762), what BLEU score does the Transformer (big) reach on WMT 2014 English→German? Quote the exact sentence of the paper.'}},
 {id:'french-theses',title:{fr:'Thèses françaises récentes',en:'Recent French theses'},skill:{fr:'Sources françaises (HAL)',en:'French sources (HAL)'},
  prompt:{fr:'Trouve 5 thèses françaises soutenues depuis 2023 sur le référencement naturel (SEO), les moteurs de recherche ou la recherche d’information, avec leur lien HAL ou theses.fr.',
   en:'Find 5 French doctoral theses defended since 2023 on search engine optimization (SEO), search engines or information retrieval, with their HAL or theses.fr link.'}},
];
export const taskById=(id:string)=>TASKS.find(t=>t.id===id)??null;
const VERIFY_TRUTH:Verdict[]=['real','mismatch','real','fake','real','fake'];

export type Metrics={identifiers:number;verified:number;invalid:string[];unverifiable:number;onTarget:number;offTarget:number;
 recall:number|null;referenceSize:number|null;correct:boolean|null;accuracy:number|null;details:Record<string,unknown>;notes:string[]};

const UA={'User-Agent':'CamMicGo-SEO-MCP/1.0 (https://seo.cammicgo.com; mailto:'+sci.CONTACT_EMAIL+')'};
const oa=(keys:sci.Keys)=>keys.openalex?'&api_key='+encodeURIComponent(keys.openalex):'';
async function oaWorks(filter:string,keys:sci.Keys,extra:Record<string,string>={}){
 const r=await fetch('https://api.openalex.org/works?'+new URLSearchParams({filter,'per-page':'50',select:sci.WORK_SELECT+',referenced_works',mailto:sci.CONTACT_EMAIL,...extra})+oa(keys),{headers:UA,cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok)return [];return ((await r.json()) as {results?:unknown[]}).results??[];
}
type Verified={key:string;work:sci.BibWork|null;source:'openalex'|'crossref'|'hal'|null;hal?:{type:string|null;year:number|null}};
/** Checks every identifier of the answer in a few batched calls. */
async function verifyIds(ids:FoundIds,keys:sci.Keys){
 const out:Verified[]=[];
 const dois=[...ids.dois,...ids.arxiv.map(a=>'10.48550/arxiv.'+a.toLowerCase())].slice(0,100);
 const found=new Map<string,sci.BibWork>();
 for(let i=0;i<dois.length;i+=50){for(const w of await oaWorks('doi:'+dois.slice(i,i+50).join('|'),keys)){const b=sci.parseBibWork(w as never);if(b?.doi)found.set(b.doi,b);}}
 const missing=dois.filter(d=>!found.has(d)).slice(0,15);
 const crossref=new Set<string>();
 await Promise.all(missing.map(async d=>{const r=await fetch('https://api.crossref.org/works/'+encodeURIComponent(d)+'?mailto='+sci.CONTACT_EMAIL,{headers:UA,signal:AbortSignal.timeout(10000)}).catch(()=>null);if(r?.ok)crossref.add(d);}));
 for(const d of dois)out.push({key:'doi:'+d,work:found.get(d)??null,source:found.has(d)?'openalex':crossref.has(d)?'crossref':null});
 if(ids.pmids.length){const raw=await oaWorks('pmid:'+ids.pmids.slice(0,50).join('|'),keys) as Array<{ids?:{pmid?:string}}>;
  for(const p of ids.pmids){const hit=raw.find(w=>w.ids?.pmid?.replace(/\D/g,'')===p);out.push({key:'pmid:'+p,work:hit?sci.parseBibWork(hit as never):null,source:hit?'openalex':null});}}
 if(ids.openalex.length){const ws=(await oaWorks('ids.openalex:'+ids.openalex.slice(0,50).join('|'),keys)).map(w=>sci.parseBibWork(w as never)).filter((x):x is sci.BibWork=>!!x);
  for(const id of ids.openalex){const w=ws.find(x=>x.id===id)??null;out.push({key:id,work:w,source:w?'openalex':null});}}
 if(ids.hal.length){
  const r=await fetch('https://api.archives-ouvertes.fr/search/?'+new URLSearchParams({q:'halId_s:('+ids.hal.slice(0,50).map(h=>h.replace(/v\d+$/,'')).join(' OR ')+')',wt:'json',rows:'50',fl:'halId_s,docType_s,producedDate_s,title_s'}),{headers:UA,signal:AbortSignal.timeout(15000)}).catch(()=>null);
  const docs=r?.ok?(((await r.json()) as {response?:{docs?:Array<{halId_s?:string;docType_s?:string;producedDate_s?:string;title_s?:string[]}>}}).response?.docs??[]):[];
  for(const h of ids.hal){const d=docs.find(x=>x.halId_s?.toLowerCase()===h.replace(/v\d+$/,''));out.push({key:h,work:null,source:d?'hal':null,hal:d?{type:d.docType_s??null,year:d.producedDate_s?Number(d.producedDate_s.slice(0,4)):null}:undefined});}
 }
 return out;
}

/** Scores one answer for one task. */
export async function scoreAnswer(taskId:string,answer:string,keys:sci.Keys):Promise<Metrics>{
 const ids=extractIds(answer);const notes:string[]=[];
 const v=await verifyIds(ids,keys);
 const ok=v.filter(x=>x.source);
 const m:Metrics={identifiers:idCount(ids),verified:ok.length,invalid:v.filter(x=>!x.source).map(x=>x.key),unverifiable:ids.thesesFr.length,onTarget:0,offTarget:0,
  recall:null,referenceSize:null,correct:null,accuracy:null,details:{},notes};
 const works=ok.map(x=>x.work).filter((w):w is sci.BibWork=>!!w);
 const today=new Date();
 if(taskId==='author-bibliography'){
  const res=await sci.resolveAuthor('0000-0002-9670-711X',[],keys);
  if(res.status!=='resolved'){notes.push('Reference author could not be resolved now.');return m;}
  const bib=await sci.authorBibliography(res.profiles,keys,{});const ref=bib.works;const ids=new Set(res.profiles.map(p=>p.id));
  const refDois=new Set(ref.flatMap(w=>[w.doi,...w.versions.filter(x=>x.startsWith('doi:')).map(x=>x.slice(4))]).filter((x):x is string=>!!x));
  const matched=new Set<string>();
  for(const w of works){const mine=(w.authorIds??[]).some(a=>ids.has(a))||(w.doi&&refDois.has(w.doi));if(mine){m.onTarget++;const r=ref.find(x=>x.doi===w.doi||x.versions.includes('doi:'+w.doi));if(r)matched.add(r.id);}else m.offTarget++;}
  for(const line of referenceLines(answer)){const r=ref.find(x=>!matched.has(x.id)&&sci.titleSimilarity(line,x.title)>=0.8);if(r)matched.add(r.id);}
  m.referenceSize=ref.length;m.recall=ref.length?Math.round(matched.size/ref.length*1000)/10:null;m.details={matchedReferenceWorks:matched.size};
 }else if(taskId==='latest-topic'){
  const start=new Date(today.getTime()-31*86_400_000).toISOString().slice(0,10);
  const topic=/generative engine|answer engine|generative search|ai search|llm|large language|chatgpt|geo\b|search engine|retrieval/i;
  for(const w of works){const recent=!!w.date&&w.date>=start;const onTopic=topic.test(w.title);if(recent&&onTopic)m.onTarget++;else m.offTarget++;}
  m.details={windowStart:start,rule:'published in the last 30 days and title about generative/AI search'};
 }else if(taskId==='most-cited'){
  const top=(await oaWorks('title_and_abstract.search:retrieval augmented generation,from_publication_date:2023-01-01',keys,{sort:'cited_by_count:desc','per-page':'20'}))
   .map(w=>sci.parseBibWork(w as never)).filter((x):x is sci.BibWork=>!!x);
  const top5=new Set(top.slice(0,5).map(w=>w.doi??w.id)),top20=new Set(top.map(w=>w.doi??w.id));
  for(const w of works){if((w.year??0)>=2023&&top20.has(w.doi??w.id))m.onTarget++;else m.offTarget++;}
  m.referenceSize=5;m.recall=Math.round(works.filter(w=>top5.has(w.doi??w.id)).length/5*1000)/10;
  m.details={inTop5:works.filter(w=>top5.has(w.doi??w.id)).length,inTop20:works.filter(w=>top20.has(w.doi??w.id)).length,referenceTop5:top.slice(0,5).map(w=>w.title),pdfLinks:(answer.match(/\.pdf\b|arxiv\.org\/pdf/gi)??[]).length};
 }else if(taskId==='citing-papers'){
  const target=await sci.openAlexWork({kind:'arxiv',value:'1706.03762'},keys);const tid=target.work?.id?.replace('https://openalex.org/','');
  const dois=works.map(w=>w.doi).filter((x):x is string=>!!x);
  const citing=new Set<string>();
  if(tid&&dois.length)for(const w of await oaWorks('cites:'+tid+',doi:'+dois.slice(0,50).join('|'),keys)){const b=sci.parseBibWork(w as never);if(b?.doi)citing.add(b.doi);}
  for(const w of works){if(w.doi&&citing.has(w.doi)&&w.year===2026)m.onTarget++;else m.offTarget++;}
  m.details={citesTarget:citing.size,publishedIn2026:works.filter(w=>w.year===2026).length};
 }else if(taskId==='verify-references'){
  const got=parseVerdicts(answer,VERIFY_TRUTH.length);const good=got.filter((g,i)=>g===VERIFY_TRUTH[i]).length;
  m.accuracy=Math.round(good/VERIFY_TRUTH.length*1000)/10;m.correct=good===VERIFY_TRUTH.length;m.details={expected:VERIFY_TRUTH,read:got};
  m.onTarget=good;m.offTarget=VERIFY_TRUTH.length-good;
 }else if(taskId==='fulltext-fact'){
  m.correct=containsValue(answer,['28.4']);m.details={expected:'28.4 BLEU',quoteFound:/28[.,]4 BLEU/i.test(answer)};
 }else if(taskId==='french-theses'){
  for(const x of v.filter(y=>y.hal)){if(x.hal&&(x.hal.type==='THESE'||x.hal.type==='HDR')&&(x.hal.year??0)>=2023)m.onTarget++;else m.offTarget++;}
  m.details={halTheses:m.onTarget,thesesFrLinksNotChecked:ids.thesesFr.length};
 }
 if(m.invalid.length)notes.push(m.invalid.length+' identifier(s) do not exist (invented or mistyped).');
 return m;
}
