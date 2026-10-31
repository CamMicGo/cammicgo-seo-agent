/**
 * Benchmark answer parsing (pure, unit-tested): identifiers cited in an assistant's answer,
 * reference-like lines, and per-item verdicts for the reference-checking task.
 */
export type FoundIds={dois:string[];arxiv:string[];pmids:string[];openalex:string[];hal:string[];thesesFr:string[]};

const uniq=(a:string[])=>[...new Set(a)];
export function extractIds(text:string):FoundIds{
 const t=text.replace(/\\_/g,'_');
 const dois=uniq([...t.matchAll(/\b10\.\d{4,9}\/[^\s"'<>\])|,;]+/g)].map(m=>m[0].replace(/[.,;:)\]*_]+$/,'').toLowerCase()));
 const arxiv=uniq([...t.matchAll(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/gi),...t.matchAll(/arxiv[:\s]+(\d{4}\.\d{4,5})/gi)].map(m=>m[1]))
  .filter(a=>!dois.includes('10.48550/arxiv.'+a.toLowerCase()));
 const pmids=uniq([...t.matchAll(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d{1,9})/gi),...t.matchAll(/\bPMID[:\s]+(\d{1,9})\b/gi)].map(m=>m[1]));
 const openalex=uniq([...t.matchAll(/openalex\.org\/(?:works\/)?(W\d{4,12})\b/gi)].map(m=>m[1].toUpperCase()));
 const hal=uniq([...t.matchAll(/(?:hal\.science|archives-ouvertes\.fr|theses\.hal\.science|dumas\.ccsd\.cnrs\.fr)\/([a-z][a-z0-9_]*-\d{6,9})/gi)].map(m=>m[1].toLowerCase()));
 const thesesFr=uniq([...t.matchAll(/theses\.fr\/((?:19|20)\d{2}[A-Z]{4,6}\d{2,5}[A-Z0-9]*|s\d{5,8})/g)].map(m=>m[1]));
 return {dois,arxiv,pmids,openalex,hal,thesesFr};
}
export const idCount=(f:FoundIds)=>f.dois.length+f.arxiv.length+f.pmids.length+f.openalex.length+f.hal.length+f.thesesFr.length;

/** Lines that look like references (numbered, bulleted or table rows with enough words), markdown removed. */
export function referenceLines(text:string){
 return text.split(/\r?\n/).map(l=>l.trim()).filter(l=>/^(\d+[.)]|[-*•]|\|)/.test(l))
  .map(l=>l.replace(/^\|?\s*\d+\s*\|/,'').replace(/^(\d+[.)]|[-*•])\s*/,'').replace(/\*\*|__|`/g,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/\|/g,' ').trim())
  .filter(l=>l.split(/\s+/).length>=4).slice(0,250);
}

export type Verdict='real'|'fake'|'mismatch'|null;
/** Verdict given for item i (1-based) in the reference-checking task, read from the line that starts with its number. */
export function parseVerdicts(text:string,n:number):Verdict[]{
 const lines=text.split(/\r?\n/);const out:Verdict[]=[];
 for(let i=1;i<=n;i++){
  const re=new RegExp('^\\s*(?:\\|\\s*)?(?:\\*\\*)?(?:n[°o]\\s*)?'+i+'(?:\\*\\*)?\\s*(?:[.)|:\\-–]|\\s)');
  const line=lines.find(l=>re.test(l));if(!line){out.push(null);continue;}
  const l=line.toLowerCase();
  out.push(/doi\s*(erron|incorrect|faux|wrong)|mauvais\s*doi|wrong\s*doi|mismatch|ne correspond pas|does ?n[o']t match|mixed|autre article|another (paper|article)/.test(l)?'mismatch'
   :/invent|fictiv|fiction|fake|inexistant|introuvable|not found|n.existe pas|does ?n[o']t exist|fabricat|hallucin|aucune trace|no trace/.test(l)?'fake'
   :/r[ée]elle|\breal\b|existe|exists|v[ée]rifi|verified|correct|valid|authentique|genuine/.test(l)?'real':null);
 }
 return out;
}
/** Whether the answer contains the expected value (e.g. "28.4" or "28,4"). */
export const containsValue=(text:string,values:string[])=>values.some(v=>new RegExp('(^|[^0-9])'+v.replace('.','[.,]')+'([^0-9]|$)').test(text));
