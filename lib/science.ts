/**
 * Scientific literature sources for the remote MCP: OpenAlex, Semantic Scholar, arXiv, PubMed and HAL
 * (French open archive). No dependency and no '@/' import so the parsers are unit-tested with node:test.
 * Keys are optional and belong to the user (saved encrypted on /account); without a key each source
 * applies its own shared, limited quota.
 */
export type Source='openalex'|'semanticscholar'|'arxiv'|'pubmed'|'hal';
export const SOURCES:Source[]=['openalex','semanticscholar','arxiv','pubmed','hal'];
export type KeyProvider='semanticscholar'|'openalex'|'pubmed';
export const KEY_PROVIDERS:KeyProvider[]=['semanticscholar','openalex','pubmed'];
export type Keys=Partial<Record<KeyProvider,string>>;
export type Sort='relevance'|'date'|'citations';
export type Paper={source:Source;sources:Source[];id:string;title:string;authors:string[];year:number|null;date:string|null;venue:string|null;type:string|null;
 doi:string|null;arxivId:string|null;pmid:string|null;url:string|null;pdfUrl:string|null;openAccess:boolean|null;citations:number|null;abstract:string|null;tldr?:string|null};
export type SearchQuery={query:string;from?:string;to?:string;sort:Sort;openAccessOnly?:boolean;limit:number;offset:number};
export type SourceResult={source:Source;papers:Paper[];total:number|null;usedKey:boolean;error?:string;note?:string};
export type Fetcher=(url:string,init?:RequestInit)=>Promise<Response>;

export const CONTACT_EMAIL='contact@cammicgo.com';
const UA='CamMicGo-SEO-MCP/1.0 (https://seo.cammicgo.com; mailto:'+CONTACT_EMAIL+')';
export const SOURCE_INFO:Record<Source,{name:string;keyProvider:KeyProvider|null;withoutKey:string;withKey:string|null;keyUrl:string|null}>={
 openalex:{name:'OpenAlex',keyProvider:'openalex',withoutKey:'about 100 searches/day shared by all CamMicGo users without a key',withKey:'about 1,000 searches/day with your free key',keyUrl:'https://openalex.org/settings/api'},
 semanticscholar:{name:'Semantic Scholar (Ai2)',keyProvider:'semanticscholar',withoutKey:'shared public pool, often throttled (HTTP 429) at busy times',withKey:'1 request/second reserved for your key',keyUrl:'https://www.semanticscholar.org/product/api#api-key-form'},
 arxiv:{name:'arXiv',keyProvider:null,withoutKey:'no key needed (1 request every 3 seconds)',withKey:null,keyUrl:null},
 pubmed:{name:'PubMed (NCBI)',keyProvider:'pubmed',withoutKey:'3 requests/second without a key',withKey:'10 requests/second with your free NCBI key',keyUrl:'https://account.ncbi.nlm.nih.gov/settings/'},
 hal:{name:'HAL (archive ouverte française, CCSD/CNRS)',keyProvider:null,withoutKey:'no key needed',withKey:null,keyUrl:null},
};

// ---------- small helpers ----------
const str=(v:unknown)=>typeof v==='string'&&v.trim()?v.trim():null;
const first=(v:unknown)=>Array.isArray(v)?str(v[0]):str(v);
export function cleanDoi(v:unknown){const s=str(v);if(!s)return null;const m=/10\.\d{4,9}\/\S+/.exec(s);return m?m[0].replace(/[.,;)\]]+$/,'').toLowerCase():null;}
export function decodeXml(s:string){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&amp;/g,'&');}
const squash=(s:string|null)=>s?s.replace(/\s+/g,' ').trim():null;
export function shorten(s:string|null,max:number){if(!s)return null;return s.length>max?s.slice(0,max).replace(/\s+\S*$/,'')+'…':s;}
const isoDay=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)?d:null;
/** Plain words of a query (operators and punctuation removed). */
export const queryWords=(q:string)=>q.replace(/[()"':+|\-!{}[\]^~*?\\/&]/g,' ').split(/\s+/).filter(w=>w&&!/^(and|or|not)$/i.test(w)).slice(0,12);
/** Newest-first lists ignore relevance, so short topics (≤ 4 words) are matched as an exact phrase to stay on topic. */
export const asPhrase=(q:string)=>{const w=queryWords(q);return w.length>=2&&w.length<=4;};
/** Newest-first lists stop at today (some publishers announce future dates). */
const untilToday=(q:SearchQuery)=>q.to&&isoDay(q.to)?q.to:q.sort==='date'?new Date().toISOString().slice(0,10):undefined;
const yearOf=(d:string|null)=>d&&/^\d{4}/.test(d)?Number(d.slice(0,4)):null;

/** Rebuilds an OpenAlex abstract from its inverted index. */
export function invertedToText(idx:unknown){
 if(!idx||typeof idx!=='object')return null;
 const words:string[]=[];
 for(const [w,pos] of Object.entries(idx as Record<string,number[]>))if(Array.isArray(pos))for(const p of pos)if(Number.isInteger(p)&&p>=0&&p<20000)words[p]=w;
 const t=words.filter(x=>x!==undefined).join(' ');
 return t||null;
}

// ---------- identifiers ----------
export type PaperId={kind:'doi'|'arxiv'|'pmid'|'openalex'|'s2'|'hal';value:string};
export function parsePaperId(input:string):PaperId|null{
 const s=input.trim();
 const doi=/(?:doi\.org\/|^doi:\s*)?(10\.\d{4,9}\/\S+)$/i.exec(s);if(doi)return {kind:'doi',value:doi[1].replace(/[.,;]+$/,'')};
 const ax=/(?:arxiv\.org\/(?:abs|pdf)\/|^arxiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?)(?:\.pdf)?$/i.exec(s);if(ax&&(/arxiv/i.test(s)||/^\d{4}\.\d{4,5}(v\d+)?$/.test(s)))return {kind:'arxiv',value:ax[1]};
 const pm=/(?:pubmed\.ncbi\.nlm\.nih\.gov\/|^pmid:\s*)(\d{1,9})\/?$/i.exec(s)||(/^\d{1,9}$/.test(s)?[s,s]:null);if(pm)return {kind:'pmid',value:pm[1]};
 const oa=/(?:openalex\.org\/(?:works\/)?)?(W\d{4,12})$/i.exec(s);if(oa)return {kind:'openalex',value:oa[1].toUpperCase()};
 const s2=/(?:semanticscholar\.org\/paper\/(?:[^/]+\/)?)?([0-9a-f]{40})$/i.exec(s);if(s2)return {kind:'s2',value:s2[1].toLowerCase()};
 const hal=/(?:hal\.science\/|archives-ouvertes\.fr\/)?([a-z][a-z0-9_]{1,24}-\d{6,9}(?:v\d+)?)\/?$/i.exec(s);if(hal)return {kind:'hal',value:hal[1].toLowerCase()};
 return null;
}

// ---------- OpenAlex ----------
export function openAlexUrl(q:SearchQuery,key?:string){
 const filters:string[]=[];
 if(q.from&&isoDay(q.from))filters.push('from_publication_date:'+q.from);
 const to=untilToday(q);if(to)filters.push('to_publication_date:'+to);
 if(q.openAccessOnly)filters.push('is_oa:true');
 const per=Math.min(50,Math.max(1,q.limit));
 const p=new URLSearchParams({'per-page':String(per),page:String(Math.floor(q.offset/per)+1),
  select:'id,doi,display_name,publication_date,publication_year,cited_by_count,authorships,primary_location,open_access,best_oa_location,abstract_inverted_index,type,ids',mailto:CONTACT_EMAIL});
 // Sorted lists ignore relevance: match the words in title and abstract only, so recent full-text noise is excluded.
 if(q.sort==='relevance')p.set('search',q.query);else filters.unshift('title_and_abstract.search:'+(asPhrase(q.query)?'"'+queryWords(q.query).join(' ')+'"':queryWords(q.query).join(' AND ')));
 if(filters.length)p.set('filter',filters.join(','));
 if(q.sort==='date')p.set('sort','publication_date:desc');else if(q.sort==='citations')p.set('sort','cited_by_count:desc');
 if(key)p.set('api_key',key);
 return 'https://api.openalex.org/works?'+p;
}
type OAWork={id?:string;doi?:string;display_name?:string;title?:string;publication_date?:string;publication_year?:number;cited_by_count?:number;type?:string;
 authorships?:Array<{author?:{display_name?:string}}>;primary_location?:{source?:{display_name?:string}|null;landing_page_url?:string|null;pdf_url?:string|null}|null;
 open_access?:{is_oa?:boolean;oa_url?:string|null};best_oa_location?:{pdf_url?:string|null;landing_page_url?:string|null}|null;abstract_inverted_index?:unknown;ids?:{pmid?:string;doi?:string}};
export function parseOpenAlexWork(w:OAWork):Paper|null{
 const title=squash(str(w.display_name)??str(w.title));if(!title||!w.id)return null;
 const doi=cleanDoi(w.doi);const date=str(w.publication_date);
 const pmid=str(w.ids?.pmid)?.replace(/\D/g,'')||null;
 return {source:'openalex',sources:['openalex'],id:w.id.replace('https://openalex.org/',''),title,authors:(w.authorships??[]).map(a=>str(a.author?.display_name)).filter((x):x is string=>!!x),
  year:w.publication_year??yearOf(date),date,venue:str(w.primary_location?.source?.display_name),type:str(w.type),doi,arxivId:null,pmid,
  url:doi?'https://doi.org/'+doi:str(w.primary_location?.landing_page_url)??w.id,pdfUrl:str(w.best_oa_location?.pdf_url)??str(w.primary_location?.pdf_url)??null,
  openAccess:w.open_access?.is_oa??null,citations:typeof w.cited_by_count==='number'?w.cited_by_count:null,abstract:squash(invertedToText(w.abstract_inverted_index))};
}
export function parseOpenAlex(body:{meta?:{count?:number};results?:OAWork[]}){return {total:body.meta?.count??null,papers:(body.results??[]).map(parseOpenAlexWork).filter((x):x is Paper=>!!x)};}

// ---------- Semantic Scholar ----------
export const S2_FIELDS='paperId,title,year,publicationDate,authors,venue,externalIds,openAccessPdf,isOpenAccess,url,citationCount,publicationTypes';
export function semanticScholarUrl(q:SearchQuery){
 const p=new URLSearchParams({query:q.query,fields:S2_FIELDS+(q.sort==='relevance'?',abstract':'')});
 if(q.from||q.to)p.set('publicationDateOrYear',(q.from&&isoDay(q.from)?q.from:'')+':'+(q.to&&isoDay(q.to)?q.to:''));
 if(q.openAccessOnly)p.set('openAccessPdf','');
 if(q.sort==='relevance'){p.set('limit',String(Math.min(100,Math.max(1,q.limit))));p.set('offset',String(q.offset));return 'https://api.semanticscholar.org/graph/v1/paper/search?'+p;}
 // Bulk search is the only endpoint that sorts (by date or citations); it returns up to 1000 rows, trimmed afterwards.
 p.set('sort',q.sort==='date'?'publicationDate:desc':'citationCount:desc');
 p.set('query',asPhrase(q.query)?'"'+queryWords(q.query).join(' ')+'"':queryWords(q.query).join(' + ')||q.query); // bulk syntax: "…" = phrase, + = AND
 const to=untilToday(q);p.set('publicationDateOrYear',(q.from&&isoDay(q.from)?q.from:'')+':'+(to??''));
 return 'https://api.semanticscholar.org/graph/v1/paper/search/bulk?'+p;
}
type S2Paper={paperId?:string;title?:string;year?:number;publicationDate?:string|null;authors?:Array<{name?:string}>;venue?:string;externalIds?:Record<string,string|number>|null;
 openAccessPdf?:{url?:string|null}|null;isOpenAccess?:boolean;url?:string;citationCount?:number;publicationTypes?:string[]|null;abstract?:string|null;tldr?:{text?:string}|null};
export function parseS2Paper(p:S2Paper):Paper|null{
 const title=squash(str(p.title));if(!title||!p.paperId)return null;
 const ext=p.externalIds??{};const doi=cleanDoi(ext.DOI);
 return {source:'semanticscholar',sources:['semanticscholar'],id:p.paperId,title,authors:(p.authors??[]).map(a=>str(a.name)).filter((x):x is string=>!!x),
  year:p.year??yearOf(p.publicationDate??null),date:str(p.publicationDate),venue:str(p.venue),type:p.publicationTypes?.[0]??null,doi,
  arxivId:ext.ArXiv!=null?String(ext.ArXiv):null,pmid:ext.PubMed!=null?String(ext.PubMed):null,url:str(p.url)??'https://www.semanticscholar.org/paper/'+p.paperId,
  pdfUrl:str(p.openAccessPdf?.url),openAccess:p.isOpenAccess??(p.openAccessPdf?.url?true:null),citations:typeof p.citationCount==='number'?p.citationCount:null,
  abstract:squash(str(p.abstract)),tldr:str(p.tldr?.text)};
}
export function parseSemanticScholar(body:{total?:number;data?:S2Paper[]},q:SearchQuery){
 let data=body.data??[];
 if(q.sort!=='relevance')data=data.slice(q.offset,q.offset+q.limit);
 return {total:body.total??null,papers:data.map(parseS2Paper).filter((x):x is Paper=>!!x)};
}

// ---------- arXiv ----------
export function arxivUrl(q:SearchQuery){
 const words=queryWords(q.query);
 let sq=q.sort!=='relevance'&&asPhrase(q.query)?'(ti:"'+words.join(' ')+'" OR abs:"'+words.join(' ')+'")':words.map(w=>'all:'+w).join(' AND ')||'all:*';
 if(q.from||q.to){const f=(q.from&&isoDay(q.from)?q.from.replace(/-/g,''):'19910101')+'0000',t=(q.to&&isoDay(q.to)?q.to.replace(/-/g,''):'29991231')+'2359';sq='('+sq+') AND submittedDate:['+f+' TO '+t+']';}
 const p=new URLSearchParams({search_query:sq,start:String(q.offset),max_results:String(Math.min(50,Math.max(1,q.limit))),
  sortBy:q.sort==='relevance'?'relevance':'submittedDate',sortOrder:'descending'});
 return 'https://export.arxiv.org/api/query?'+p;
}
const tag=(xml:string,name:string)=>{const m=new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+name+'>').exec(xml);return m?squash(decodeXml(m[1])):null;};
export function parseArxiv(xml:string){
 const total=Number(tag(xml,'opensearch:totalResults'));
 const papers:Paper[]=[];
 for(const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)){
  const e=m[1];const idUrl=tag(e,'id');const title=tag(e,'title');if(!idUrl||!title)continue;
  const id=idUrl.replace(/^https?:\/\/arxiv\.org\/abs\//,'');const base=id.replace(/v\d+$/,'');
  const date=tag(e,'published')?.slice(0,10)??null;
  const authors=[...e.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map(a=>squash(decodeXml(a[1]))!).filter(Boolean);
  const pdf=/<link[^>]*title="pdf"[^>]*href="([^"]+)"/.exec(e)?.[1]??/<link[^>]*href="([^"]+)"[^>]*title="pdf"/.exec(e)?.[1]??null;
  papers.push({source:'arxiv',sources:['arxiv'],id:base,title,authors,year:yearOf(date),date,venue:tag(e,'arxiv:journal_ref')??'arXiv',type:'preprint',
   doi:cleanDoi(tag(e,'arxiv:doi')),arxivId:base,pmid:null,url:'https://arxiv.org/abs/'+base,pdfUrl:pdf?pdf.replace(/^http:/,'https:'):'https://arxiv.org/pdf/'+base,
   openAccess:true,citations:null,abstract:tag(e,'summary')});
 }
 return {total:Number.isFinite(total)?total:null,papers};
}

// ---------- PubMed (NCBI E-utilities) ----------
const ncbi=(path:string,p:URLSearchParams,key?:string)=>{p.set('tool','cammicgo');p.set('email',CONTACT_EMAIL);if(key)p.set('api_key',key);return 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'+path+'?'+p;};
export function pubmedSearchUrl(q:SearchQuery,key?:string){
 const words=queryWords(q.query);
 const base=q.sort==='relevance'||!words.length?q.query:asPhrase(q.query)?'"'+words.join(' ')+'"[tiab]':words.map(w=>w+'[tiab]').join(' AND ');
 const term=base+(q.openAccessOnly?' AND free full text[sb]':'');
 const p=new URLSearchParams({db:'pubmed',term,retmode:'json',retmax:String(Math.min(50,Math.max(1,q.limit))),retstart:String(q.offset),sort:q.sort==='relevance'?'relevance':'pub_date'});
 if(q.from||q.to){p.set('datetype','pdat');p.set('mindate',(q.from&&isoDay(q.from)?q.from:'1800-01-01').replace(/-/g,'/'));p.set('maxdate',(q.to&&isoDay(q.to)?q.to:'3000-12-31').replace(/-/g,'/'));}
 return ncbi('esearch.fcgi',p,key);
}
export const pubmedSummaryUrl=(ids:string[],key?:string)=>ncbi('esummary.fcgi',new URLSearchParams({db:'pubmed',id:ids.join(','),retmode:'json'}),key);
export const pubmedAbstractUrl=(pmid:string,key?:string)=>ncbi('efetch.fcgi',new URLSearchParams({db:'pubmed',id:pmid,rettype:'abstract',retmode:'xml'}),key);
type PMSummary={uid?:string;title?:string;authors?:Array<{name?:string}>;fulljournalname?:string;source?:string;pubdate?:string;sortpubdate?:string;articleids?:Array<{idtype?:string;value?:string}>;pubtype?:string[]};
export function parsePubmedSummary(body:{result?:Record<string,unknown>&{uids?:string[]}}){
 const r=body.result??{};const papers:Paper[]=[];
 for(const uid of (r.uids as string[]|undefined)??[]){
  const s=r[uid] as PMSummary|undefined;const title=squash(str(s?.title));if(!s||!title)continue;
  const ids=s.articleids??[];const doi=cleanDoi(ids.find(i=>i.idtype==='doi')?.value);const pmc=ids.find(i=>i.idtype==='pmc')?.value??null;
  const date=s.sortpubdate?s.sortpubdate.slice(0,10).replace(/\//g,'-'):null;
  papers.push({source:'pubmed',sources:['pubmed'],id:uid,title:title.replace(/\.$/,''),authors:(s.authors??[]).map(a=>str(a.name)).filter((x):x is string=>!!x),
   year:yearOf(date),date,venue:str(s.fulljournalname)??str(s.source),type:s.pubtype?.[0]??null,doi,arxivId:null,pmid:uid,url:'https://pubmed.ncbi.nlm.nih.gov/'+uid+'/',
   pdfUrl:pmc?'https://pmc.ncbi.nlm.nih.gov/articles/'+pmc+'/':null,openAccess:pmc?true:null,citations:null,abstract:null});
 }
 return papers;
}
/** Abstract text from an efetch XML record (labelled sections kept). */
export function parsePubmedAbstract(xml:string){
 const parts=[...xml.matchAll(/<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/g)].map(m=>{const label=/Label="([^"]+)"/.exec(m[1])?.[1];const t=squash(decodeXml(m[2].replace(/<[^>]+>/g,'')));return t?(label?label+': ':'')+t:null;}).filter(Boolean);
 return parts.length?parts.join('\n'):null;
}

// ---------- HAL ----------
export const HAL_FIELDS='halId_s,title_s,authFullName_s,producedDate_s,publicationDate_s,uri_s,doiId_s,docType_s,journalTitle_s,conferenceTitle_s,fileMain_s,abstract_s,openAccess_bool,language_s';
export function halUrl(q:SearchQuery){
 const w=queryWords(q.query);
 const text=q.sort!=='relevance'&&asPhrase(q.query)?'title_t:"'+w.join(' ')+'" OR abstract_t:"'+w.join(' ')+'"':w.join(' AND ')||'*';
 const p=new URLSearchParams({q:text,wt:'json',rows:String(Math.min(50,Math.max(1,q.limit))),start:String(q.offset),fl:HAL_FIELDS});
 if(q.sort==='date')p.set('sort','producedDate_tdate desc');
 if(q.from||q.to)p.append('fq','producedDate_tdate:['+(q.from&&isoDay(q.from)?q.from+'T00:00:00Z':'*')+' TO '+(q.to&&isoDay(q.to)?q.to+'T23:59:59Z':'*')+']');
 if(q.openAccessOnly)p.append('fq','openAccess_bool:true');
 return 'https://api.archives-ouvertes.fr/search/?'+p;
}
type HalDoc={halId_s?:string;title_s?:string[]|string;authFullName_s?:string[];producedDate_s?:string;publicationDate_s?:string;uri_s?:string;doiId_s?:string;docType_s?:string;
 journalTitle_s?:string;conferenceTitle_s?:string;fileMain_s?:string;abstract_s?:string[]|string;openAccess_bool?:boolean;language_s?:string[]};
const HAL_TYPES:Record<string,string>={ART:'article',COMM:'conference paper',THESE:'thesis',HDR:'habilitation',OUV:'book',COUV:'book chapter',REPORT:'report',UNDEFINED:'preprint',MEM:'master thesis',POSTER:'poster',OTHER:'other'};
export function parseHal(body:{response?:{numFound?:number;docs?:HalDoc[]}}){
 const papers:Paper[]=[];
 for(const d of body.response?.docs??[]){
  const title=squash(first(d.title_s));if(!title||!d.halId_s)continue;
  const raw=str(d.producedDate_s)??str(d.publicationDate_s);const date=raw?raw.slice(0,10):null;
  papers.push({source:'hal',sources:['hal'],id:d.halId_s,title,authors:(d.authFullName_s??[]).slice(0,50),year:yearOf(date),date:date&&date.length===10?date:null,
   venue:str(d.journalTitle_s)??str(d.conferenceTitle_s)??'HAL',type:d.docType_s?HAL_TYPES[d.docType_s]??d.docType_s.toLowerCase():null,doi:cleanDoi(d.doiId_s),arxivId:null,pmid:null,
   url:str(d.uri_s)??'https://hal.science/'+d.halId_s,pdfUrl:str(d.fileMain_s),openAccess:d.openAccess_bool??(d.fileMain_s?true:null),citations:null,abstract:squash(first(d.abstract_s))});
 }
 return {total:body.response?.numFound??null,papers};
}

// ---------- merging ----------
const titleKey=(t:string)=>t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'').slice(0,120);
/** Merges duplicates found in several sources (same DOI, arXiv ID, PMID or title) and keeps the richest fields. */
export function mergePapers(lists:Paper[][],sort:Sort,query?:string){
 const out:Array<Paper&{rank:number;score:number}>=[];const byKey=new Map<string,Paper&{rank:number;score:number}>();
 lists.forEach(list=>list.forEach((p,i)=>{
  const keys=[p.doi&&'doi:'+p.doi,p.arxivId&&'ax:'+p.arxivId.replace(/v\d+$/,''),p.pmid&&'pm:'+p.pmid,'t:'+titleKey(p.title)].filter(Boolean) as string[];
  const hit=keys.map(k=>byKey.get(k)).find(Boolean);
  if(!hit){const n={...p,sources:[...p.sources],rank:i,score:1/(i+2)};out.push(n);keys.forEach(k=>byKey.set(k,n));return;}
  hit.score+=1/(i+2);
  for(const s of p.sources)if(!hit.sources.includes(s))hit.sources.push(s);
  hit.rank=Math.min(hit.rank,i);
  hit.doi??=p.doi;hit.arxivId??=p.arxivId;hit.pmid??=p.pmid;hit.date??=p.date;hit.year??=p.year;hit.venue??=p.venue;hit.pdfUrl??=p.pdfUrl;hit.type??=p.type;
  hit.openAccess=hit.openAccess||p.openAccess||null;
  if(p.citations!=null)hit.citations=Math.max(hit.citations??0,p.citations);
  if(!hit.abstract||(p.abstract&&p.abstract.length>hit.abstract.length))hit.abstract=p.abstract??hit.abstract;
  hit.tldr??=p.tldr;if(hit.authors.length<p.authors.length)hit.authors=p.authors;
  keys.forEach(k=>{if(!byKey.has(k))byKey.set(k,hit);});
 }));
 const d=(p:Paper)=>p.date??(p.year?p.year+'-01-01':'');
 const qk=query?titleKey(query):null;if(qk)for(const p of out)if(titleKey(p.title)===qk)p.score+=10;
 out.sort((a,b)=>sort==='date'?d(b).localeCompare(d(a))||a.rank-b.rank:sort==='citations'?(b.citations??-1)-(a.citations??-1)||a.rank-b.rank:b.score-a.score||a.rank-b.rank);
 return out.map(({rank:_r,score:_s,...p})=>p);
}

/** Compact form for lists: short abstract, at most 8 authors. */
export function compact(p:Paper,abstractChars=500){
 return {title:p.title,authors:p.authors.length>8?[...p.authors.slice(0,8),'+'+(p.authors.length-8)+' more']:p.authors,date:p.date??(p.year?String(p.year):null),venue:p.venue,type:p.type,
  citations:p.citations,openAccess:p.openAccess,doi:p.doi,arxivId:p.arxivId,pmid:p.pmid,url:p.url,pdfUrl:p.pdfUrl,sources:p.sources,
  id:p.doi?'doi:'+p.doi:p.arxivId?'arxiv:'+p.arxivId:p.pmid?'pmid:'+p.pmid:p.source==='hal'?p.id:p.source==='openalex'?p.id:p.id,
  tldr:p.tldr??undefined,abstract:shorten(p.abstract,abstractChars)};
}

/** Readable error for a source answer. */
export function sourceError(source:Source,status:number,usedKey:boolean){
 if(status===429)return usedKey?'rate limited even with your key: wait a little':'rate limited: shared quota without a key is exhausted ('+SOURCE_INFO[source].withoutKey+'). Add a free key on https://seo.cammicgo.com/account';
 if((status===401||status===403)&&usedKey)return 'your '+SOURCE_INFO[source].name+' key was refused: check it on https://seo.cammicgo.com/account';
 return 'HTTP '+status;
}

// ---------- network ----------
const timeout=(ms:number)=>AbortSignal.timeout(ms);
async function getText(f:Fetcher,url:string,headers:Record<string,string>={}):Promise<Response>{
 const r=await getOnce(f,url,headers);
 // Semantic Scholar's shared pool often answers 429: one short retry before giving up.
 if(r.status===429&&url.includes('semanticscholar.org')&&!headers['x-api-key']){await new Promise(res=>setTimeout(res,1500));return getOnce(f,url,headers);}
 return r;
}
async function getOnce(f:Fetcher,url:string,headers:Record<string,string>){const r=await f(url,{headers:{'User-Agent':UA,Accept:'application/json, application/atom+xml, text/xml',...headers},cache:'no-store',signal:timeout(12000)});return r;}

/** Searches one source; never throws (errors are reported per source). */
export async function searchSource(source:Source,q:SearchQuery,keys:Keys,f:Fetcher=fetch):Promise<SourceResult>{
 const prov=SOURCE_INFO[source].keyProvider;const key=prov?keys[prov]:undefined;const usedKey=!!key;
 try{
  if(source==='openalex'){const r=await getText(f,openAlexUrl(q,key));if(!r.ok)return {source,papers:[],total:null,usedKey,error:sourceError(source,r.status,usedKey)};return {source,usedKey,...parseOpenAlex(await r.json())};}
  if(source==='semanticscholar'){const r=await getText(f,semanticScholarUrl(q),key?{'x-api-key':key}:{});if(!r.ok)return {source,papers:[],total:null,usedKey,error:sourceError(source,r.status,usedKey)};return {source,usedKey,...parseSemanticScholar(await r.json(),q),note:q.sort==='relevance'?undefined:'sorted with the bulk endpoint (no abstracts in lists)'};}
  if(source==='arxiv'){const r=await getText(f,arxivUrl(q));if(!r.ok)return {source,papers:[],total:null,usedKey,error:sourceError(source,r.status,false)};return {source,usedKey:false,...parseArxiv(await r.text()),note:q.sort==='citations'?'arXiv has no citation counts: sorted by date':undefined};}
  if(source==='pubmed'){
   const r=await getText(f,pubmedSearchUrl(q,key));if(!r.ok)return {source,papers:[],total:null,usedKey,error:sourceError(source,r.status,usedKey)};
   const s=await r.json() as {esearchresult?:{count?:string;idlist?:string[];ERROR?:string};error?:string};
   if(s.error)return {source,papers:[],total:null,usedKey,error:/api.?key/i.test(s.error)?sourceError(source,403,usedKey):s.error};
   const ids=s.esearchresult?.idlist??[];if(!ids.length)return {source,papers:[],total:Number(s.esearchresult?.count??0),usedKey};
   const sum=await getText(f,pubmedSummaryUrl(ids,key));if(!sum.ok)return {source,papers:[],total:null,usedKey,error:sourceError(source,sum.status,usedKey)};
   return {source,usedKey,total:Number(s.esearchresult?.count??0),papers:parsePubmedSummary(await sum.json()),note:q.sort==='citations'?'PubMed has no citation counts: sorted by date':undefined};
  }
  const r=await getText(f,halUrl(q));if(!r.ok)return {source,papers:[],total:null,usedKey:false,error:sourceError(source,r.status,false)};
  return {source,usedKey:false,...parseHal(await r.json()),note:q.sort==='citations'?'HAL has no citation counts: sorted by relevance':undefined};
 }catch(e){return {source,papers:[],total:null,usedKey,error:e instanceof Error&&e.name==='TimeoutError'?'timeout':e instanceof Error?e.message.slice(0,120):'error'};}
}

/** Paper details by DOI, arXiv ID, PMID, OpenAlex ID, Semantic Scholar ID or HAL ID, enriched from several sources. */
export async function paperDetails(id:PaperId,keys:Keys,f:Fetcher=fetch){
 const found:Paper[]=[];const notes:string[]=[];
 const s2Id=id.kind==='doi'?'DOI:'+id.value:id.kind==='arxiv'?'ARXIV:'+id.value.replace(/v\d+$/,''):id.kind==='pmid'?'PMID:'+id.value:id.kind==='s2'?id.value:null;
 let s2PaperId:string|null=null;
 if(s2Id){
  try{const r=await getText(f,'https://api.semanticscholar.org/graph/v1/paper/'+encodeURIComponent(s2Id)+'?fields='+S2_FIELDS+',abstract,tldr,referenceCount,influentialCitationCount,fieldsOfStudy',keys.semanticscholar?{'x-api-key':keys.semanticscholar}:{});
   if(r.ok){const p=parseS2Paper(await r.json());if(p){found.push(p);s2PaperId=p.id;}}else notes.push('Semantic Scholar: '+sourceError('semanticscholar',r.status,!!keys.semanticscholar));}catch{notes.push('Semantic Scholar: unavailable');}
 }
 const doi=id.kind==='doi'?id.value:found[0]?.doi??null;
 const oaPath=id.kind==='openalex'?id.value:doi?'doi:'+doi:id.kind==='pmid'?'pmid:'+id.value:null;
 if(oaPath){
  try{const p=new URLSearchParams({mailto:CONTACT_EMAIL});if(keys.openalex)p.set('api_key',keys.openalex);
   const r=await getText(f,'https://api.openalex.org/works/'+encodeURIComponent(oaPath).replace('%3A',':')+'?'+p);
   if(r.ok){const w=parseOpenAlexWork(await r.json());if(w)found.push(w);}else if(r.status!==404)notes.push('OpenAlex: '+sourceError('openalex',r.status,!!keys.openalex));}catch{notes.push('OpenAlex: unavailable');}
 }
 if(id.kind==='hal'){
  try{const r=await getText(f,'https://api.archives-ouvertes.fr/search/?'+new URLSearchParams({q:'halId_s:'+id.value.replace(/v\d+$/,''),wt:'json',fl:HAL_FIELDS,rows:'1'}));if(r.ok)found.push(...parseHal(await r.json()).papers);}catch{notes.push('HAL: unavailable');}
 }
 const arxivId=id.kind==='arxiv'?id.value:found.find(p=>p.arxivId)?.arxivId??null;
 if(arxivId&&!found.some(p=>p.abstract)){
  try{const r=await getText(f,'https://export.arxiv.org/api/query?id_list='+encodeURIComponent(arxivId.replace(/v\d+$/,'')));if(r.ok)found.push(...parseArxiv(await r.text()).papers);}catch{notes.push('arXiv: unavailable');}
 }
 const pmid=id.kind==='pmid'?id.value:found.find(p=>p.pmid)?.pmid??null;
 if(pmid&&!found.some(p=>p.abstract)){
  try{const r=await getText(f,pubmedAbstractUrl(pmid,keys.pubmed));if(r.ok){const a=parsePubmedAbstract(await r.text());if(a&&found[0])found[0].abstract=a;}}catch{notes.push('PubMed: unavailable');}
 }
 if(id.kind==='pmid'&&!found.length){
  try{const r=await getText(f,pubmedSummaryUrl([id.value],keys.pubmed));if(r.ok)found.push(...parsePubmedSummary(await r.json()));
   const a=await getText(f,pubmedAbstractUrl(id.value,keys.pubmed));if(a.ok&&found[0])found[0].abstract=parsePubmedAbstract(await a.text());}catch{notes.push('PubMed: unavailable');}
 }
 const merged=mergePapers(found.map(p=>[p]),'relevance');
 return {paper:merged[0]??null,s2PaperId,notes};
}

// ---------- authors ----------
export type AuthorHit={id:string;source:'openalex'|'semanticscholar';name:string;orcid:string|null;institution:string|null;works:number|null;citations:number|null;hIndex:number|null;topics:string[];url:string};
type OAAuthor={id?:string;display_name?:string;orcid?:string|null;works_count?:number;cited_by_count?:number;summary_stats?:{h_index?:number};last_known_institutions?:Array<{display_name?:string}>;topics?:Array<{display_name?:string}>};
export function parseOpenAlexAuthors(body:{results?:OAAuthor[]}):AuthorHit[]{
 return (body.results??[]).filter(a=>a.id&&a.display_name).map(a=>({id:a.id!.replace('https://openalex.org/',''),source:'openalex' as const,name:a.display_name!,orcid:str(a.orcid)?.replace('https://orcid.org/','')??null,
  institution:str(a.last_known_institutions?.[0]?.display_name),works:a.works_count??null,citations:a.cited_by_count??null,hIndex:a.summary_stats?.h_index??null,
  topics:(a.topics??[]).slice(0,5).map(t=>str(t.display_name)).filter((x):x is string=>!!x),url:a.id!}));
}
type S2Author={authorId?:string;name?:string;affiliations?:string[];paperCount?:number;citationCount?:number;hIndex?:number;url?:string};
export function parseS2Authors(body:{data?:S2Author[]}):AuthorHit[]{
 return (body.data??[]).filter(a=>a.authorId&&a.name).map(a=>({id:a.authorId!,source:'semanticscholar' as const,name:a.name!,orcid:null,institution:a.affiliations?.[0]??null,
  works:a.paperCount??null,citations:a.citationCount??null,hIndex:a.hIndex??null,topics:[],url:a.url??'https://www.semanticscholar.org/author/'+a.authorId}));
}

/** Finds researchers (OpenAlex first, Semantic Scholar as fallback) and the latest papers of the first match or of authorId. */
export async function authorLookup(input:{name?:string;authorId?:string;latest:number},keys:Keys,f:Fetcher=fetch){
 const notes:string[]=[];let candidates:AuthorHit[]=[];
 const oaKey=keys.openalex?'&api_key='+encodeURIComponent(keys.openalex):'';
 if(input.name){
  try{const r=await getText(f,'https://api.openalex.org/authors?'+new URLSearchParams({search:input.name,'per-page':'6',select:'id,display_name,orcid,works_count,cited_by_count,summary_stats,last_known_institutions,topics',mailto:CONTACT_EMAIL})+oaKey);
   if(r.ok)candidates=parseOpenAlexAuthors(await r.json());else notes.push('OpenAlex: '+sourceError('openalex',r.status,!!keys.openalex));}catch{notes.push('OpenAlex: unavailable');}
  if(!candidates.length){
   try{const r=await getText(f,'https://api.semanticscholar.org/graph/v1/author/search?'+new URLSearchParams({query:input.name,limit:'6',fields:'name,affiliations,paperCount,citationCount,hIndex,url'}),keys.semanticscholar?{'x-api-key':keys.semanticscholar}:{});
    if(r.ok)candidates=parseS2Authors(await r.json());else notes.push('Semantic Scholar: '+sourceError('semanticscholar',r.status,!!keys.semanticscholar));}catch{notes.push('Semantic Scholar: unavailable');}
  }
 }
 const target=input.authorId??candidates[0]?.id;let latest:Paper[]=[];
 if(target&&/^A\d+$/i.test(target)){
  try{const r=await getText(f,'https://api.openalex.org/works?'+new URLSearchParams({filter:'author.id:'+target.toUpperCase(),sort:'publication_date:desc','per-page':String(input.latest),
   select:'id,doi,display_name,publication_date,publication_year,cited_by_count,authorships,primary_location,open_access,best_oa_location,type,ids',mailto:CONTACT_EMAIL})+oaKey);
   if(r.ok)latest=parseOpenAlex(await r.json()).papers;}catch{notes.push('OpenAlex works: unavailable');}
 }else if(target&&/^\d+$/.test(target)){
  try{const r=await getText(f,'https://api.semanticscholar.org/graph/v1/author/'+target+'/papers?'+new URLSearchParams({fields:S2_FIELDS,limit:'100'}),keys.semanticscholar?{'x-api-key':keys.semanticscholar}:{});
   if(r.ok){const b=await r.json() as {data?:S2Paper[]};latest=(b.data??[]).map(parseS2Paper).filter((x):x is Paper=>!!x).sort((a,b)=>(b.date??String(b.year??'')).localeCompare(a.date??String(a.year??''))).slice(0,input.latest);}}catch{notes.push('Semantic Scholar papers: unavailable');}
 }
 return {candidates,selected:target??null,latest,notes};
}
