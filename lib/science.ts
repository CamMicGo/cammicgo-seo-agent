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
 semanticscholar:{name:'Semantic Scholar (Ai2)',keyProvider:'semanticscholar',withoutKey:'worldwide shared public pool, often saturated (HTTP 429)',withKey:'1 request/second reserved for your key',keyUrl:'https://www.semanticscholar.org/product/api#api-key-form'},
 arxiv:{name:'arXiv',keyProvider:null,withoutKey:'no key needed (1 request every 3 seconds)',withKey:null,keyUrl:null},
 pubmed:{name:'PubMed (NCBI)',keyProvider:'pubmed',withoutKey:'3 requests/second shared by all CamMicGo users of the remote server',withKey:'10 requests/second just for you with your free NCBI key',keyUrl:'https://account.ncbi.nlm.nih.gov/settings/'},
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
 const hal=/(?:hal\.science\/|archives-ouvertes\.fr\/)?([a-z][a-z0-9]{1,24}(?:[_-][a-z0-9]+)*[-_]\d{6,9}(?:v\d+)?)\/?$/i.exec(s);if(hal)return {kind:'hal',value:hal[1].toLowerCase()};
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
/** Where users add their keys: the /account page (remote) or .env.local (local MCP). */
export let KEYS_HELP='https://seo.cammicgo.com/account';
export function setKeysHelp(v:string){KEYS_HELP=v;}
export function sourceError(source:Source,status:number,usedKey:boolean){
 if(status===429)return usedKey?'rate limited even with your key: wait a little':'rate limited: shared quota without a key is exhausted ('+SOURCE_INFO[source].withoutKey+'). Add a free personal key: '+KEYS_HELP;
 if((status===401||status===403)&&usedKey)return 'your '+SOURCE_INFO[source].name+' key was refused: check it ('+KEYS_HELP+')';
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
 const oaPath=id.kind==='openalex'?id.value:doi?'doi:'+doi:id.kind==='pmid'?'pmid:'+id.value:id.kind==='arxiv'?'doi:10.48550/arxiv.'+id.value.replace(/v\d+$/,''):null;
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

// =====================================================================================
// Author bibliographies: exact author identity (OpenAlex ID, ORCID, Semantic Scholar ID or name),
// complete list of works, version de-duplication, sorting and bibliographic exports.
// =====================================================================================
export type AuthorRef={kind:'openalex'|'orcid'|'s2'|'name';value:string};
/** ORCID checksum (ISO 7064 mod 11-2). */
export function validOrcid(id:string){
 const d=id.replace(/-/g,'');if(!/^\d{15}[\dX]$/.test(d))return false;
 let t=0;for(const c of d.slice(0,15))t=(t+Number(c))*2;const r=(12-t%11)%11;
 return d[15]===(r===10?'X':String(r));
}
export function parseAuthorRef(input:string):AuthorRef{
 const s=input.trim();
 const orcid=/(?:orcid\.org\/)?(\d{4}-\d{4}-\d{4}-\d{3}[\dX])\/?$/i.exec(s);if(orcid)return {kind:'orcid',value:orcid[1].toUpperCase()};
 const oa=/(?:openalex\.org\/(?:authors\/)?)?(A\d{4,12})\/?$/i.exec(s);if(oa)return {kind:'openalex',value:oa[1].toUpperCase()};
 const s2=/semanticscholar\.org\/author\/(?:[^/]+\/)?(\d{3,12})\/?$/i.exec(s)??(/^\d{3,12}$/.test(s)?[s,s]:null);if(s2)return {kind:'s2',value:s2[1]};
 return {kind:'name',value:s.replace(/\s+/g,' ')};
}

export type AuthorProfile={id:string;name:string;alternativeNames:string[];orcid:string|null;institution:string|null;country:string|null;works:number|null;citations:number|null;
 hIndex:number|null;i10Index:number|null;topics:string[];lastYears:Array<{year:number;works:number;citations:number}>;url:string};
type OAAuthorFull={id?:string;display_name?:string;display_name_alternatives?:string[];orcid?:string|null;works_count?:number;cited_by_count?:number;
 summary_stats?:{h_index?:number;i10_index?:number};last_known_institutions?:Array<{display_name?:string;country_code?:string}>;topics?:Array<{display_name?:string}>;
 counts_by_year?:Array<{year?:number;works_count?:number;cited_by_count?:number}>};
export function parseAuthorProfile(a:OAAuthorFull):AuthorProfile|null{
 if(!a?.id||!a.display_name)return null;const id=a.id.replace('https://openalex.org/','');
 return {id,name:a.display_name,alternativeNames:(a.display_name_alternatives??[]).filter(n=>n!==a.display_name).slice(0,8),orcid:str(a.orcid)?.replace('https://orcid.org/','')??null,
  institution:str(a.last_known_institutions?.[0]?.display_name),country:str(a.last_known_institutions?.[0]?.country_code),works:a.works_count??null,citations:a.cited_by_count??null,
  hIndex:a.summary_stats?.h_index??null,i10Index:a.summary_stats?.i10_index??null,topics:(a.topics??[]).slice(0,6).map(t=>str(t.display_name)).filter((x):x is string=>!!x),
  lastYears:(a.counts_by_year??[]).filter(c=>typeof c.year==='number').slice(0,6).map(c=>({year:c.year!,works:c.works_count??0,citations:c.cited_by_count??0})),url:'https://openalex.org/'+id};
}
const AUTHOR_SELECT='id,display_name,display_name_alternatives,orcid,works_count,cited_by_count,summary_stats,last_known_institutions,topics,counts_by_year';
const normName=(n:string)=>n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z ]+/g,' ').replace(/\s+/g,' ').trim();
/** Same person name, tolerant to accents, hyphens, initials order ("T. Bourquard" vs "Thomas Bourquard"). */
export function sameName(a:string,b:string){
 const x=normName(a).split(' '),y=normName(b).split(' ');if(!x.length||!y.length)return false;
 if(x.join(' ')===y.join(' '))return true;
 const lastX=x[x.length-1],lastY=y[y.length-1];if(lastX!==lastY)return false;
 const fx=x[0],fy=y[0];return fx===fy||(fx.length===1&&fy.startsWith(fx))||(fy.length===1&&fx.startsWith(fy));
}
export type AuthorResolution={status:'resolved';profiles:AuthorProfile[];via:string;notes:string[]}|{status:'ambiguous'|'not_found';candidates:AuthorProfile[];notes:string[]};
const oaKeyParam=(keys:Keys)=>keys.openalex?'&api_key='+encodeURIComponent(keys.openalex):'';

/** Resolves an author reference to OpenAlex profile(s). A name resolves only when exactly one candidate matches it. */
export async function resolveAuthor(input:string,extraIds:string[],keys:Keys,f:Fetcher=fetch):Promise<AuthorResolution>{
 const notes:string[]=[];const ref=parseAuthorRef(input);const sel='?select='+AUTHOR_SELECT+'&mailto='+CONTACT_EMAIL+oaKeyParam(keys);
 const byPath=async(path:string)=>{try{const r=await getText(f,'https://api.openalex.org/authors/'+path+sel);if(r.ok)return parseAuthorProfile(await r.json());if(r.status!==404)notes.push('OpenAlex: '+sourceError('openalex',r.status,!!keys.openalex));}catch{notes.push('OpenAlex: unavailable');}return null;};
 const extras=async()=>(await Promise.all(extraIds.filter(x=>/^A\d{4,12}$/i.test(x)).slice(0,4).map(x=>byPath(x.toUpperCase())))).filter((p):p is AuthorProfile=>!!p);
 let main:AuthorProfile|null=null;let via:string=ref.kind;
 if(ref.kind==='openalex')main=await byPath(ref.value);
 else if(ref.kind==='orcid'){
  if(!validOrcid(ref.value))return {status:'not_found',candidates:[],notes:['Invalid ORCID checksum: '+ref.value]};
  main=await byPath('orcid:'+ref.value);if(!main)notes.push('This ORCID has no OpenAlex profile yet.');
 }else if(ref.kind==='s2'){
  const r=await getText(f,'https://api.semanticscholar.org/graph/v1/author/'+ref.value+'?fields=name,externalIds',keys.semanticscholar?{'x-api-key':keys.semanticscholar}:{}).catch(()=>null);
  if(!r)notes.push('Semantic Scholar: unavailable');
  else if(r.ok){const a=await r.json() as {name?:string;externalIds?:{ORCID?:string}};const o=a.externalIds?.ORCID;
   if(o&&validOrcid(o)){main=await byPath('orcid:'+o);via='s2→orcid';}
   if(!main&&a.name)return resolveAuthor(a.name,extraIds,keys,f);}
  else notes.push('Semantic Scholar: '+sourceError('semanticscholar',r.status,!!keys.semanticscholar));
 }else{
  const r=await getText(f,'https://api.openalex.org/authors?'+new URLSearchParams({search:ref.value,'per-page':'10',select:AUTHOR_SELECT,mailto:CONTACT_EMAIL})+oaKeyParam(keys)).catch(()=>null);
  if(!r){notes.push('OpenAlex: unavailable');return {status:'not_found',candidates:[],notes};}
  if(!r.ok){notes.push('OpenAlex: '+sourceError('openalex',r.status,!!keys.openalex));return {status:'not_found',candidates:[],notes};}
  const all=((await r.json() as {results?:OAAuthorFull[]}).results??[]).map(parseAuthorProfile).filter((p):p is AuthorProfile=>!!p);
  const exact=all.filter(p=>sameName(p.name,ref.value)||p.alternativeNames.some(n=>sameName(n,ref.value)));
  const byWorks=[...exact].sort((a,b)=>(b.works??0)-(a.works??0));
  if(exact.length===1){main=exact[0];via='name';}
  else if(byWorks.length>1&&(byWorks[0].works??0)>=20&&byWorks.slice(1).every(p=>(p.works??0)*10<=(byWorks[0].works??0))){
   // One main profile and tiny ones with the same name: usually the same person split by OpenAlex, or homonyms with few papers.
   main=byWorks[0];via='name (dominant profile)';
   notes.push('Other OpenAlex profiles with this name have very few works ('+byWorks.slice(1).map(p=>p.id+': '+(p.works??0)).join(', ')+'): if they are the same person, call again with extraAuthorIds to merge them.');
  }
  else{
   const sameOrcid=exact.length>1&&exact.every(p=>p.orcid&&p.orcid===exact[0].orcid);
   if(sameOrcid)return {status:'resolved',profiles:exact,via:'name (profiles sharing one ORCID)',notes};
   return {status:exact.length?'ambiguous':(all.length?'ambiguous':'not_found'),candidates:(exact.length?exact:all).slice(0,8),
    notes:[...notes,exact.length>1?'Several OpenAlex profiles carry this name: they may be different people, or one person split into several profiles. Ask the user which one(s), then call again with the OpenAlex ID (A…) or ORCID, and extraAuthorIds to merge split profiles.':'No exact name match: ask the user to pick a candidate or give an ORCID.']};
  }
 }
 if(!main)return {status:'not_found',candidates:[],notes:notes.length?notes:['Author not found in OpenAlex.']};
 return {status:'resolved',profiles:[main,...(await extras()).filter(p=>p.id!==main!.id)],via,notes};
}

export type BibAuthor={name:string;orcid:string|null};
export type BibWork={id:string;doi:string|null;title:string;year:number|null;date:string|null;type:string|null;venue:string|null;publisher:string|null;volume:string|null;issue:string|null;
 firstPage:string|null;lastPage:string|null;authors:BibAuthor[];citations:number|null;openAccess:boolean|null;pdfUrl:string|null;landingUrl:string|null;language:string|null;
 retracted:boolean;sources:string[];versions:string[];halId?:string|null;authorIds?:string[]};
type OABibWork=Omit<OAWork,'authorships'|'primary_location'>&{biblio?:{volume?:string|null;issue?:string|null;first_page?:string|null;last_page?:string|null};is_retracted?:boolean;language?:string|null;
 authorships?:Array<{author?:{id?:string;display_name?:string;orcid?:string|null}}>;primary_location?:{source?:{display_name?:string;host_organization_name?:string|null}|null;landing_page_url?:string|null;pdf_url?:string|null}|null};
export const WORK_SELECT='id,doi,display_name,publication_date,publication_year,type,cited_by_count,primary_location,best_oa_location,open_access,authorships,biblio,ids,is_retracted,language';
export function parseBibWork(w:OABibWork):BibWork|null{
 const title=squash(str(w.display_name)??str(w.title));if(!title||!w.id)return null;
 const date=str(w.publication_date);const b=w.biblio??{};
 return {id:w.id.replace('https://openalex.org/',''),doi:cleanDoi(w.doi),title,year:w.publication_year??yearOf(date),date,type:str(w.type),venue:str(w.primary_location?.source?.display_name),
  publisher:str(w.primary_location?.source?.host_organization_name),volume:str(b.volume),issue:str(b.issue),firstPage:str(b.first_page),lastPage:str(b.last_page),
  authors:(w.authorships??[]).map(a=>({name:str(a.author?.display_name)??'',orcid:str(a.author?.orcid)?.replace('https://orcid.org/','')??null})).filter(a=>a.name),
  citations:typeof w.cited_by_count==='number'?w.cited_by_count:null,openAccess:w.open_access?.is_oa??null,pdfUrl:str(w.best_oa_location?.pdf_url)??str(w.primary_location?.pdf_url)??null,
  landingUrl:str(w.primary_location?.landing_page_url),language:str(w.language),retracted:w.is_retracted===true,sources:['openalex'],versions:[],
  authorIds:(w.authorships??[]).map(a=>str(a.author?.id)?.replace('https://openalex.org/','')).filter((x):x is string=>!!x)};
}
export function authorWorksUrl(ids:string[],keys:Keys,cursor:string,o:{from?:string;to?:string;query?:string}={}){
 const filters=['author.id:'+ids.map(i=>i.toUpperCase()).join('|')];
 if(o.from&&/^\d{4}(-\d{2}-\d{2})?$/.test(o.from))filters.push('from_publication_date:'+(o.from.length===4?o.from+'-01-01':o.from));
 if(o.to&&/^\d{4}(-\d{2}-\d{2})?$/.test(o.to))filters.push('to_publication_date:'+(o.to.length===4?o.to+'-12-31':o.to));
 if(o.query&&queryWords(o.query).length)filters.push('title_and_abstract.search:'+queryWords(o.query).join(' AND '));
 return 'https://api.openalex.org/works?'+new URLSearchParams({filter:filters.join(','),sort:'publication_date:desc','per-page':'200',cursor,select:WORK_SELECT,mailto:CONTACT_EMAIL})+oaKeyParam(keys);
}
/** Every work of the given OpenAlex author IDs (cursor pagination, up to maxWorks). */
export async function fetchAuthorWorks(ids:string[],keys:Keys,o:{from?:string;to?:string;query?:string;maxWorks?:number}={},f:Fetcher=fetch){
 const out:BibWork[]=[];let cursor='*';let total:number|null=null;const max=o.maxWorks??2000;const notes:string[]=[];
 for(let i=0;i<Math.ceil(max/200)&&cursor;i++){
  const r=await getText(f,authorWorksUrl(ids,keys,cursor,o)).catch(()=>null);
  if(!r){notes.push('OpenAlex: unavailable');break;}
  if(!r.ok){notes.push('OpenAlex: '+sourceError('openalex',r.status,!!keys.openalex));break;}
  const b=await r.json() as {meta?:{count?:number;next_cursor?:string|null};results?:OABibWork[]};
  total??=b.meta?.count??null;for(const w of b.results??[]){const p=parseBibWork(w);if(p)out.push(p);}
  cursor=b.meta?.next_cursor??'';if(!(b.results??[]).length)break;
 }
 if(total!=null&&out.length<total)notes.push('Only the first '+out.length+' of '+total+' works were loaded.');
 return {works:out,total,notes};
}
/** HAL deposits linked to an ORCID (French open archive), mapped to the same shape. */
export function halByOrcidUrl(orcid:string){
 return 'https://api.archives-ouvertes.fr/search/?'+new URLSearchParams({q:'authORCIDIdExt_s:"'+orcid+'"',wt:'json',rows:'500',fl:HAL_FIELDS+',volume_s,issue_s,page_s,authORCIDIdExt_s',sort:'producedDate_tdate desc'});
}
export function halDocsToBib(body:{response?:{docs?:Array<Record<string,unknown>>}}):BibWork[]{
 return (body.response?.docs??[]).map(d=>{
  const title=squash(first(d.title_s));const raw=str(d.producedDate_s)??str(d.publicationDate_s);const date=raw&&raw.length>=10?raw.slice(0,10):null;
  if(!title||!str(d.halId_s))return null;
  const pages=str(d.page_s);const [fp,lp]=pages?pages.split(/[-–]/):[null,null];
  return {id:str(d.halId_s)!,halId:str(d.halId_s),doi:cleanDoi(d.doiId_s),title,year:yearOf(raw),date,type:d.docType_s?HAL_TYPES[String(d.docType_s)]??String(d.docType_s).toLowerCase():null,
   venue:str(d.journalTitle_s)??str(d.conferenceTitle_s),publisher:null,volume:str(d.volume_s),issue:first(d.issue_s),firstPage:fp??null,lastPage:lp??null,
   authors:((d.authFullName_s as string[]|undefined)??[]).map(n=>({name:n,orcid:null})),citations:null,openAccess:d.openAccess_bool===true||!!d.fileMain_s,pdfUrl:str(d.fileMain_s),
   landingUrl:str(d.uri_s),language:first(d.language_s),retracted:false,sources:['hal'],versions:[]} as BibWork;
 }).filter((x):x is BibWork=>!!x);
}

const TYPE_RANK:Record<string,number>={article:6,'book-chapter':5,book:5,'proceedings-article':5,'conference paper':5,dissertation:4,thesis:4,review:4,report:3,preprint:1,'posted-content':1,dataset:0,other:0};
const rankOf=(w:BibWork)=>(TYPE_RANK[w.type??'']??2)+(w.doi&&!w.doi.startsWith('10.48550/')&&!/zenodo|figshare|ssrn/i.test(w.doi)?2:0)+(w.venue&&!/arxiv|hal|zenodo|ssrn|research square|biorxiv|medrxiv|preprint/i.test(w.venue)?1:0);
/** Merges duplicate records of the same work (same DOI, or same title within one year: preprint + published version…). */
export function dedupeWorks(works:BibWork[]){
 const groups:BibWork[][]=[];const byDoi=new Map<string,BibWork[]>();const byTitle=new Map<string,BibWork[][]>();
 for(const w of works){
  let g=w.doi?byDoi.get(w.doi):undefined;
  const tk=titleKey(w.title);
  if(!g&&tk.length>=12)g=(byTitle.get(tk)??[]).find(gr=>gr.some(x=>x.year==null||w.year==null||Math.abs(x.year-w.year)<=1));
  if(!g){g=[];groups.push(g);if(tk.length>=12)byTitle.set(tk,[...(byTitle.get(tk)??[]),g]);}
  g.push(w);if(w.doi)byDoi.set(w.doi,g);
 }
 return groups.map(g=>{
  const best=[...g].sort((a,b)=>rankOf(b)-rankOf(a)||(b.citations??0)-(a.citations??0))[0];
  const m:BibWork={...best,authors:best.authors.length?best.authors:g.find(x=>x.authors.length)?.authors??[],sources:[...new Set(g.flatMap(x=>x.sources))],
   versions:[...new Set(g.filter(x=>x!==best).flatMap(x=>[x.doi?'doi:'+x.doi:null,x.halId?x.halId:null,x.id.startsWith('W')?x.id:null]).filter((v):v is string=>!!v))]};
  for(const x of g){m.citations=Math.max(m.citations??0,x.citations??0)||m.citations;m.pdfUrl??=x.pdfUrl;m.openAccess=m.openAccess||x.openAccess;m.doi??=x.doi;m.date??=x.date;m.venue??=x.venue;m.halId??=x.halId??null;m.retracted=m.retracted||x.retracted;}
  return m;
 });
}
export type WorkSort='newest'|'oldest'|'citations'|'title';
export function sortWorks(works:BibWork[],sort:WorkSort){
 const d=(w:BibWork)=>w.date??(w.year?w.year+'-00-00':'0000');
 return [...works].sort((a,b)=>sort==='oldest'?d(a).localeCompare(d(b)):sort==='citations'?(b.citations??-1)-(a.citations??-1)||d(b).localeCompare(d(a)):sort==='title'?a.title.localeCompare(b.title):d(b).localeCompare(d(a)));
}
/** Compact work for MCP answers. */
export function compactWork(w:BibWork){
 return {title:w.title,date:w.date??(w.year?String(w.year):null),type:w.type,venue:w.venue,authors:w.authors.length>6?[...w.authors.slice(0,6).map(a=>a.name),'+'+(w.authors.length-6)+' more']:w.authors.map(a=>a.name),
  doi:w.doi,url:w.doi?'https://doi.org/'+w.doi:w.landingUrl??(w.id.startsWith('W')?'https://openalex.org/'+w.id:null),pdfUrl:w.pdfUrl,citations:w.citations,openAccess:w.openAccess,
  retracted:w.retracted||undefined,sources:w.sources,mergedVersions:w.versions.length?w.versions:undefined,id:w.doi?'doi:'+w.doi:w.id};
}
export function worksSummary(works:BibWork[]){
 const byYear:Record<string,number>={};const byType:Record<string,number>={};
 for(const w of works){byYear[String(w.year??'unknown')]=(byYear[String(w.year??'unknown')]??0)+1;byType[w.type??'other']=(byType[w.type??'other']??0)+1;}
 return {byYear:Object.fromEntries(Object.entries(byYear).sort((a,b)=>b[0].localeCompare(a[0]))),byType,openAccess:works.filter(w=>w.openAccess).length,retracted:works.filter(w=>w.retracted).length};
}

// ---------- bibliographic exports ----------
const PARTICLES=new Set(['de','du','des','la','le','van','von','der','den','da','dos','das','di','del','della','ter','ten','bin','al','el']);
/** Splits a display name into family and given names ("Jean de La Fontaine" → "de La Fontaine", "Jean"). */
export function splitName(n:string){
 let t=n.trim().split(/\s+/);if(t.length===1)return {family:t[0],given:''};
 // "Anne Poupon B" (trailing initial): the initial belongs to the given names
 if(t.length>2&&/^[A-Z]\.?$/.test(t[t.length-1])){const ini=t[t.length-1];t=[...t.slice(0,-2),ini,t[t.length-2]];}
 let i=t.length-1;for(let k=1;k<t.length-1;k++)if(PARTICLES.has(t[k].toLowerCase())){i=k;break;}
 return {family:t.slice(i).join(' '),given:t.slice(0,i).join(' ')};
}
const texEscape=(s:string)=>s.replace(/\\/g,'\\textbackslash{}').replace(/([&%$#_{}])/g,'\\$1').replace(/~/g,'\\textasciitilde{}').replace(/\^/g,'\\textasciicircum{}');
const BIBTEX_TYPE:Record<string,string>={article:'article',review:'article','book-chapter':'incollection',book:'book','proceedings-article':'inproceedings','conference paper':'inproceedings',dissertation:'phdthesis',thesis:'phdthesis',habilitation:'phdthesis',report:'techreport',preprint:'misc','posted-content':'misc'};
export function toBibtex(works:BibWork[]){
 const used=new Map<string,number>();
 return works.map(w=>{
  const fam=splitName(w.authors[0]?.name??'anon').family.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z]/g,'')||'anon';
  const word=(w.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[A-Za-z]{4,}/)?.[0]??'work').toLowerCase();
  let key=fam.toLowerCase()+(w.year??'nd')+word;const n=used.get(key)??0;used.set(key,n+1);if(n)key+=String.fromCharCode(97+n);
  const type=BIBTEX_TYPE[w.type??'']??'misc';
  const f:Array<[string,string|null|undefined]>=[['title','{'+texEscape(w.title)+'}'],['author',w.authors.map(a=>{const s=splitName(a.name);return texEscape(s.given?s.family+', '+s.given:s.family);}).join(' and ')],
   ['year',w.year?String(w.year):null],[type==='inproceedings'||type==='incollection'?'booktitle':type==='phdthesis'?'school':'journal',w.venue?texEscape(w.venue):null],['volume',w.volume],['number',w.issue],
   ['pages',w.firstPage?(w.lastPage&&w.lastPage!==w.firstPage?w.firstPage+'--'+w.lastPage:w.firstPage):null],['publisher',w.publisher?texEscape(w.publisher):null],['doi',w.doi],
   ['url',w.doi?'https://doi.org/'+w.doi:w.landingUrl],['note',w.retracted?'RETRACTED':type==='misc'&&w.type?w.type:null]];
  return '@'+type+'{'+key+',\n'+f.filter(([,v])=>v).map(([k,v])=>'  '+k+' = {'+v+'}').join(',\n')+'\n}';
 }).join('\n\n')+'\n';
}
const RIS_TYPE:Record<string,string>={article:'JOUR',review:'JOUR','book-chapter':'CHAP',book:'BOOK','proceedings-article':'CPAPER','conference paper':'CPAPER',dissertation:'THES',thesis:'THES',habilitation:'THES',report:'RPRT',preprint:'UNPB','posted-content':'UNPB',dataset:'DATA'};
export function toRis(works:BibWork[]){
 return works.map(w=>{
  const l:string[]=['TY  - '+(RIS_TYPE[w.type??'']??'GEN'),'TI  - '+w.title];
  for(const a of w.authors){const s=splitName(a.name);l.push('AU  - '+(s.given?s.family+', '+s.given:s.family));}
  if(w.year)l.push('PY  - '+w.year);if(w.date)l.push('DA  - '+w.date.replace(/-/g,'/'));if(w.venue)l.push('T2  - '+w.venue);if(w.volume)l.push('VL  - '+w.volume);if(w.issue)l.push('IS  - '+w.issue);
  if(w.firstPage)l.push('SP  - '+w.firstPage);if(w.lastPage)l.push('EP  - '+w.lastPage);if(w.publisher)l.push('PB  - '+w.publisher);if(w.doi)l.push('DO  - '+w.doi);
  const url=w.doi?'https://doi.org/'+w.doi:w.landingUrl;if(url)l.push('UR  - '+url);if(w.pdfUrl)l.push('L1  - '+w.pdfUrl);if(w.retracted)l.push('N1  - RETRACTED');
  l.push('ER  - ');return l.join('\r\n');
 }).join('\r\n\r\n')+'\r\n';
}
const csvCell=(v:unknown)=>{const s=v==null?'':String(v);return /[",\n\r;]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
export function toCsv(works:BibWork[]){
 const head=['title','authors','year','date','type','venue','volume','issue','pages','doi','url','pdf','citations','open_access','retracted','sources','openalex_or_hal_id'];
 return '\uFEFF'+[head.join(','),...works.map(w=>[w.title,w.authors.map(a=>a.name).join('; '),w.year,w.date,w.type,w.venue,w.volume,w.issue,w.firstPage?(w.lastPage?w.firstPage+'-'+w.lastPage:w.firstPage):'',
  w.doi,w.doi?'https://doi.org/'+w.doi:w.landingUrl,w.pdfUrl,w.citations,w.openAccess,w.retracted,w.sources.join('+'),w.id].map(csvCell).join(','))].join('\r\n')+'\r\n';
}
export function toMarkdown(works:BibWork[],title:string){
 const lines=works.map((w,i)=>{
  const names=w.authors.map(a=>a.name);const au=names.length>10?names.slice(0,10).join(', ')+' et al.':names.join(', ');
  const where=[w.venue?'*'+w.venue+'*':null,w.volume?w.volume+(w.issue?'('+w.issue+')':''):null,w.firstPage?(w.lastPage?w.firstPage+'–'+w.lastPage:w.firstPage):null].filter(Boolean).join(', ');
  const link=w.doi?'https://doi.org/'+w.doi:w.landingUrl??'';
  return (i+1)+'. '+(au?au+' ':'')+'('+(w.year??'n.d.')+'). **'+w.title+'**.'+(where?' '+where+'.':'')+(w.type?' ['+w.type+']':'')+(link?' '+link:'')+(w.pdfUrl?' · PDF: '+w.pdfUrl:'')+(w.retracted?' · ⚠ RETRACTED':'')+(w.citations?' · cited '+w.citations+'×':'');
 });
 return '# '+title+'\n\n'+lines.join('\n')+'\n';
}
const CSL_TYPE:Record<string,string>={article:'article-journal',review:'article-journal','book-chapter':'chapter',book:'book','proceedings-article':'paper-conference','conference paper':'paper-conference',dissertation:'thesis',thesis:'thesis',report:'report',preprint:'article','posted-content':'article',dataset:'dataset'};
export function toCslJson(works:BibWork[]){
 return JSON.stringify(works.map(w=>({id:w.doi??w.id,type:CSL_TYPE[w.type??'']??'document',title:w.title,author:w.authors.map(a=>splitName(a.name)),
  issued:w.date?{'date-parts':[w.date.split('-').map(Number)]}:w.year?{'date-parts':[[w.year]]}:undefined,'container-title':w.venue??undefined,volume:w.volume??undefined,issue:w.issue??undefined,
  page:w.firstPage?(w.lastPage?w.firstPage+'-'+w.lastPage:w.firstPage):undefined,publisher:w.publisher??undefined,DOI:w.doi??undefined,URL:w.doi?'https://doi.org/'+w.doi:w.landingUrl??undefined})),null,1);
}
export const EXPORT_FORMATS={bibtex:{ext:'bib',mime:'application/x-bibtex; charset=utf-8'},ris:{ext:'ris',mime:'application/x-research-info-systems; charset=utf-8'},
 csv:{ext:'csv',mime:'text/csv; charset=utf-8'},markdown:{ext:'md',mime:'text/markdown; charset=utf-8'},csljson:{ext:'json',mime:'application/vnd.citationstyles.csl+json; charset=utf-8'}} as const;
export type ExportFormat=keyof typeof EXPORT_FORMATS;
export function renderExport(format:ExportFormat,works:BibWork[],title:string){
 return format==='bibtex'?toBibtex(works):format==='ris'?toRis(works):format==='csv'?toCsv(works):format==='markdown'?toMarkdown(works,title):toCslJson(works);
}

/** Complete, de-duplicated bibliography of one researcher (OpenAlex, plus HAL deposits linked to the ORCID). */
export async function authorBibliography(profiles:AuthorProfile[],keys:Keys,o:{from?:string;to?:string;query?:string;includeHal?:boolean;maxWorks?:number}={},f:Fetcher=fetch){
 const {works,total,notes}=await fetchAuthorWorks(profiles.map(p=>p.id),keys,o,f);
 let hal:BibWork[]=[];const orcid=profiles.find(p=>p.orcid)?.orcid;
 if(o.includeHal!==false&&orcid&&!o.query){
  try{const r=await getText(f,halByOrcidUrl(orcid));if(r.ok){hal=halDocsToBib(await r.json());
   const fromY=o.from?Number(o.from.slice(0,4)):null,toY=o.to?Number(o.to.slice(0,4)):null;hal=hal.filter(w=>(fromY==null||(w.year??0)>=fromY)&&(toY==null||(w.year??9999)<=toY));}
   else notes.push('HAL: HTTP '+r.status);}catch{notes.push('HAL: unavailable');}
 }
 const merged=dedupeWorks([...works,...hal]);
 return {works:merged,rawCount:works.length+hal.length,openAlexTotal:total,halCount:hal.length,halOnly:merged.filter(w=>w.sources.length===1&&w.sources[0]==='hal').length,notes};
}

// ---------- one work in OpenAlex (for citations and full text) ----------
type OAWorkFull=OABibWork&{referenced_works?:string[];locations?:Array<{pdf_url?:string|null;landing_page_url?:string|null;is_oa?:boolean;license?:string|null;source?:{display_name?:string}|null}>;
 best_oa_location?:{pdf_url?:string|null;landing_page_url?:string|null;license?:string|null}|null;ids?:{pmid?:string;pmcid?:string;doi?:string}};
export async function openAlexWork(id:PaperId,keys:Keys,f:Fetcher=fetch):Promise<{work:OAWorkFull|null;note?:string}>{
 let path:string|null=id.kind==='openalex'?id.value:id.kind==='doi'?'doi:'+id.value:id.kind==='pmid'?'pmid:'+id.value:id.kind==='arxiv'?'doi:10.48550/arxiv.'+id.value.replace(/v\d+$/,''):null;
 if(!path&&id.kind==='s2'){
  const r=await getText(f,'https://api.semanticscholar.org/graph/v1/paper/'+id.value+'?fields=externalIds',keys.semanticscholar?{'x-api-key':keys.semanticscholar}:{});
  if(r.ok){const d=cleanDoi((await r.json() as {externalIds?:{DOI?:string}}).externalIds?.DOI);if(d)path='doi:'+d;}
 }
 if(!path&&id.kind==='hal'){
  const r=await getText(f,'https://api.archives-ouvertes.fr/search/?'+new URLSearchParams({q:'halId_s:'+id.value.replace(/v\d+$/,''),wt:'json',fl:'doiId_s',rows:'1'}));
  if(r.ok){const d=cleanDoi((await r.json() as {response?:{docs?:Array<{doiId_s?:string}>}}).response?.docs?.[0]?.doiId_s);if(d)path='doi:'+d;}
  if(!path)return {work:null,note:'This HAL deposit has no DOI, so it cannot be matched in OpenAlex.'};
 }
 if(!path)return {work:null,note:'Unsupported identifier.'};
 const r=await getText(f,'https://api.openalex.org/works/'+encodeURIComponent(path).replace('%3A',':')+'?select='+WORK_SELECT+',referenced_works,locations&mailto='+CONTACT_EMAIL+oaKeyParam(keys));
 if(r.ok)return {work:await r.json() as OAWorkFull};
 return {work:null,note:r.status===404?'Not found in OpenAlex.':'OpenAlex: '+sourceError('openalex',r.status,!!keys.openalex)};
}

/** Papers citing a work (exact OpenAlex citation index), newest or most cited first, page by page. */
export async function citedBy(workId:string,keys:Keys,o:{sort:'newest'|'citations';page:number;perPage:number;from?:string},f:Fetcher=fetch){
 const filters=['cites:'+workId];if(o.from&&/^\d{4}-\d{2}-\d{2}$/.test(o.from))filters.push('from_publication_date:'+o.from);
 const r=await getText(f,'https://api.openalex.org/works?'+new URLSearchParams({filter:filters.join(','),sort:o.sort==='citations'?'cited_by_count:desc':'publication_date:desc','per-page':String(o.perPage),page:String(o.page),select:WORK_SELECT,mailto:CONTACT_EMAIL})+oaKeyParam(keys));
 if(!r.ok)return {total:null,works:[] as BibWork[],error:sourceError('openalex',r.status,!!keys.openalex)};
 const b=await r.json() as {meta?:{count?:number};results?:OABibWork[]};
 return {total:b.meta?.count??null,works:(b.results??[]).map(parseBibWork).filter((x):x is BibWork=>!!x)};
}
/** The reference list of a work, resolved to full records (batches of 50 IDs). */
export async function referencesOf(refIds:string[],keys:Keys,f:Fetcher=fetch){
 const ids=refIds.map(x=>x.replace('https://openalex.org/','')).filter(x=>/^W\d+$/.test(x)).slice(0,500);const out:BibWork[]=[];
 for(let i=0;i<ids.length;i+=50){
  const r=await getText(f,'https://api.openalex.org/works?'+new URLSearchParams({filter:'ids.openalex:'+ids.slice(i,i+50).join('|'),'per-page':'50',select:WORK_SELECT,mailto:CONTACT_EMAIL})+oaKeyParam(keys));
  if(!r.ok)return {works:out,error:sourceError('openalex',r.status,!!keys.openalex)};
  for(const w of (await r.json() as {results?:OABibWork[]}).results??[]){const p=parseBibWork(w);if(p)out.push(p);}
 }
 return {works:out};
}

// ---------- reference verification (fights invented citations) ----------
const tokens=(s:string)=>new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').split(/[^a-z0-9]+/).filter(t=>t.length>=3));
/** Share of the found title's words that appear in the reference text (0–1). */
export function titleSimilarity(reference:string,title:string){
 const t=[...tokens(title)];if(!t.length)return 0;const r=tokens(reference);return t.filter(x=>r.has(x)).length/t.length;
}
/** Best guess of the title inside a free-text reference (longest sentence that is not an author list or a venue). */
export function guessTitle(ref:string){
 const quoted=/["“«]\s*([^"”»]{8,}?)\s*["”»]/.exec(ref);if(quoted)return quoted[1].replace(/[.,;:]+$/,'');
 const parts=ref.replace(/https?:\/\/\S+|doi:\s*\S+/gi,'').split(/(?<=[.?!])\s+/).map(p=>p.replace(/\(?\b(19|20)\d{2}[a-z]?\b\)?[.,:]?/g,'').replace(/^[\s.,:;-]+|[\s.,:;-]+$/g,'')).filter(Boolean);
 const score=(p:string)=>{const w=p.split(/\s+/);const initials=(p.match(/\b[A-Z]\.?(?=[\s,]|$)/g)??[]).length;const commas=(p.match(/,/g)??[]).length;
  return w.length-initials*2-commas*1.5-(/et al/i.test(p)?5:0)-(/\d+\s*\(\d+\)|\d+\s*[-–]\s*\d+|\bvol\b|\bpp\b/i.test(p)?4:0);};
 return parts.sort((a,b)=>score(b)-score(a))[0]??'';
}
export type Verification={input:string;status:'verified'|'probable'|'mismatch'|'not_found'|'retracted';doi:string|null;title:string|null;year:number|null;authors:string[];venue:string|null;
 similarity:number|null;url:string|null;note?:string};
type CrossrefItem={DOI?:string;title?:string[];author?:Array<{given?:string;family?:string;name?:string}>;issued?:{'date-parts'?:number[][]};'container-title'?:string[];score?:number};
const crossrefWork=(it:CrossrefItem)=>({doi:cleanDoi(it.DOI),title:squash(first(it.title)),year:it.issued?.['date-parts']?.[0]?.[0]??null,
 authors:(it.author??[]).map(a=>a.name??[a.given,a.family].filter(Boolean).join(' ')).filter(Boolean).slice(0,20),venue:squash(first(it['container-title']))});
/** Checks one reference (DOI, identifier or free text) against OpenAlex and Crossref. */
export async function verifyReference(input:string,keys:Keys,f:Fetcher=fetch):Promise<Verification>{
 const text=input.trim().slice(0,1000);const base={input:text,doi:null,title:null,year:null,authors:[] as string[],venue:null,similarity:null,url:null};
 const yearIn=Number(/\b(19|20)\d{2}\b/.exec(text)?.[0]??0)||null;
 const pid=parsePaperId(text)??(cleanDoi(text)?{kind:'doi' as const,value:cleanDoi(text)!}:null);
 const low0=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const authorIn=(authors:string[])=>authors.some(a=>{const fam=splitName(a).family.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');return fam.length>=3&&low0.includes(fam);});
 const finish=(w:{doi:string|null;title:string|null;year:number|null;authors:string[];venue:string|null},retracted=false):Verification=>{
  const textOnly=text.replace(/10\.\d{4,9}\/\S+/g,'').replace(/https?:\/\/\S+/g,'');
  const sim=w.title&&tokens(textOnly).size>=3?titleSimilarity(textOnly,w.title):null;
  const yearOk=!yearIn||!w.year||Math.abs(yearIn-w.year)<=1;
  // Same title and a matching author: the work exists even if a database records another year (e.g. a re-indexed version).
  const status:Verification['status']=retracted?'retracted':sim==null?'verified':sim>=0.75&&(yearOk||(sim>=0.9&&authorIn(w.authors)))?'verified':sim>=0.5?'probable':'mismatch';
  return {...base,...w,similarity:sim==null?null:Math.round(sim*100)/100,url:w.doi?'https://doi.org/'+w.doi:null,status,
   note:status==='mismatch'?'The identifier exists but points to a different work than the cited title (typical of an invented or mixed-up reference).':status==='retracted'?'This work has been RETRACTED.':!yearOk?'Year differs from the cited one.':undefined};
 };
 if(pid&&pid.kind!=='hal'&&pid.kind!=='s2'){
  const {work}=await openAlexWork(pid,keys,f);
  if(work){const w=parseBibWork(work);if(w)return finish({doi:w.doi,title:w.title,year:w.year,authors:w.authors.map(a=>a.name),venue:w.venue},w.retracted);}
  if(pid.kind==='doi'){
   const r=await getText(f,'https://api.crossref.org/works/'+encodeURIComponent(pid.value)+'?mailto='+CONTACT_EMAIL);
   if(r.ok)return finish(crossrefWork((await r.json() as {message?:CrossrefItem}).message??{}));
   return {...base,doi:pid.value,status:'not_found',note:'This DOI does not exist in OpenAlex or Crossref.'};
  }
 }
 type Cand={doi:string|null;title:string|null;year:number|null;authors:string[];venue:string|null;citations:number;retracted:boolean};
 const cands:Cand[]=[];
 const [cr,oa]=await Promise.all([
  getText(f,'https://api.crossref.org/works?'+new URLSearchParams({'query.bibliographic':text,rows:'5',select:'DOI,title,author,issued,container-title,score,is-referenced-by-count',mailto:CONTACT_EMAIL})).catch(()=>null),
  getText(f,'https://api.openalex.org/works?'+new URLSearchParams({filter:'title.search:'+(guessTitle(text)||text).replace(/[,:|]/g,' ').slice(0,200),'per-page':'5',sort:'cited_by_count:desc',select:WORK_SELECT,mailto:CONTACT_EMAIL})+oaKeyParam(keys)).catch(()=>null),
 ]);
 if(cr?.ok)for(const it of ((await cr.json()) as {message?:{items?:Array<CrossrefItem&{'is-referenced-by-count'?:number}>}}).message?.items??[]){const w=crossrefWork(it);if(w.title)cands.push({...w,citations:it['is-referenced-by-count']??0,retracted:false});}
 if(oa?.ok)for(const it of ((await oa.json()) as {results?:OABibWork[]}).results??[]){const w=parseBibWork(it);if(w)cands.push({doi:w.doi,title:w.title,year:w.year,authors:w.authors.map(a=>a.name),venue:w.venue,citations:w.citations??0,retracted:w.retracted});}
 if(!cands.length)return {...base,status:'not_found',note:cr||oa?'No published work matches this reference.':'Crossref and OpenAlex unavailable.'};
 const low=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const scored=cands.map(c=>{const sim=titleSimilarity(text,c.title!);
  const yearOk=yearIn&&c.year?Math.abs(yearIn-c.year)<=1:false;
  const authorOk=c.authors.some(a=>{const fam=splitName(a).family.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');return fam.length>=3&&low.includes(fam);});
  return {c,sim,score:sim+(yearOk?0.3:0)+(authorOk?0.3:0)+Math.log10(c.citations+1)/20};}).sort((a,b)=>b.score-a.score);
 const best=scored[0];
 if(best.sim<0.5)return {...base,status:'not_found',similarity:Math.round(best.sim*100)/100,note:'No published work matches this reference.'};
 let retracted=best.c.retracted;
 if(!retracted&&best.c.doi){const o=await openAlexWork({kind:'doi',value:best.c.doi},keys,f).catch(()=>({work:null}));retracted=o.work?.is_retracted===true;}
 return finish(best.c,retracted);
}

// ---------- legal open-access full text ----------
export type FullTextCandidate={url:string;kind:'pdf'|'jats'|'html';source:string;license:string|null};
/** Legal open-access copies of a work, best first: Europe PMC XML, arXiv, publisher/repository PDFs, Unpaywall. */
export async function openAccessCandidates(id:PaperId,keys:Keys,f:Fetcher=fetch){
 const out:FullTextCandidate[]=[];const notes:string[]=[];const add=(c:FullTextCandidate)=>{if(c.url&&!out.some(x=>x.url===c.url))out.push(c);};
 let title:string|null=null,doi:string|null=id.kind==='doi'?id.value:null;
 if(id.kind==='arxiv')add({url:'https://arxiv.org/pdf/'+id.value,kind:'pdf',source:'arXiv',license:null});
 if(id.kind==='hal'){
  const r=await getText(f,'https://api.archives-ouvertes.fr/search/?'+new URLSearchParams({q:'halId_s:'+id.value.replace(/v\d+$/,''),wt:'json',fl:'fileMain_s,title_s,doiId_s,licence_s',rows:'1'}));
  if(r.ok){const d=(await r.json() as {response?:{docs?:Array<Record<string,unknown>>}}).response?.docs?.[0];if(d){title=first(d.title_s);doi??=cleanDoi(d.doiId_s);if(str(d.fileMain_s))add({url:str(d.fileMain_s)!,kind:'pdf',source:'HAL',license:str(d.licence_s)});}}
 }
 const {work,note}=await openAlexWork(id,keys,f).catch(()=>({work:null,note:'OpenAlex unavailable'}));if(note&&!out.length)notes.push(note);
 if(work){
  title??=squash(str(work.display_name));doi??=cleanDoi(work.doi);
  const pmcRaw=str(work.ids?.pmcid)?.replace(/.*\//,'');const pmcid=pmcRaw?(/^pmc/i.test(pmcRaw)?pmcRaw:'PMC'+pmcRaw):null;if(pmcid)add({url:'https://www.ebi.ac.uk/europepmc/webservices/rest/'+pmcid.toUpperCase()+'/fullTextXML',kind:'jats',source:'Europe PMC',license:null});
  const ax=/arxiv\.(\d{4}\.\d{4,5})/i.exec(String(work.doi??''))?.[1];if(ax)add({url:'https://arxiv.org/pdf/'+ax,kind:'pdf',source:'arXiv',license:null});
  if(work.best_oa_location?.pdf_url)add({url:work.best_oa_location.pdf_url,kind:'pdf',source:'OpenAlex (best open-access copy)',license:str(work.best_oa_location.license)});
  for(const l of work.locations??[])if(l.is_oa&&l.pdf_url)add({url:l.pdf_url,kind:'pdf',source:l.source?.display_name??'open-access copy',license:str(l.license)});
 }
 if(doi){
  try{const r=await getText(f,'https://api.unpaywall.org/v2/'+encodeURIComponent(doi)+'?email='+CONTACT_EMAIL);
   if(r.ok){const u=await r.json() as {oa_locations?:Array<{url_for_pdf?:string|null;url?:string|null;license?:string|null;host_type?:string}>};
    for(const l of u.oa_locations??[])if(l.url_for_pdf)add({url:l.url_for_pdf,kind:'pdf',source:'Unpaywall ('+(l.host_type??'oa')+')',license:str(l.license)});
    for(const l of u.oa_locations??[])if(!l.url_for_pdf&&l.url)add({url:l.url,kind:'html',source:'Unpaywall landing page ('+(l.host_type??'oa')+')',license:str(l.license)});}}catch{notes.push('Unpaywall unavailable');}
 }
 return {title,doi,candidates:out.slice(0,6),notes};
}
/** Plain text from a JATS XML article (Europe PMC): title, abstract, sections, without references. */
export function jatsToText(xml:string){
 const body=xml.replace(/<ref-list[\s\S]*?<\/ref-list>/g,'').replace(/<(table-wrap|fig)[\s\S]*?<\/\1>/g,'');
 return decodeXml(body.replace(/<title>/g,'\n\n## ').replace(/<\/(p|title|abstract|sec)>/g,'\n').replace(/<[^>]+>/g,'')).replace(/[ \t]+/g,' ').replace(/\n\s*\n\s*\n+/g,'\n\n').trim();
}
