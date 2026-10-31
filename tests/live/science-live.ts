// Live smoke test against the real APIs (run in CI, where outbound internet is available).
import * as s from '../../lib/science.ts';

import {appendFileSync, writeFileSync} from 'node:fs';
const file = process.env.LIVE_OUT ?? 'science-live.txt';
writeFileSync(file, '');
const log = (line: string) => { appendFileSync(file, line + '\n'); console.log(line); };
process.on('uncaughtException', e => { log('CRASH ' + (e instanceof Error ? e.stack : String(e))); process.exit(1); });
process.on('unhandledRejection', e => { log('CRASH ' + (e instanceof Error ? e.stack : String(e))); process.exit(1); });
const q = (over: Partial<s.SearchQuery> = {}): s.SearchQuery => ({query: 'search engine optimization', sort: 'relevance', limit: 3, offset: 0, ...over});

for (const sort of ['relevance', 'date'] as const) {
  for (const source of s.SOURCES) {
    const r = await s.searchSource(source, q({sort, from: sort === 'date' ? '2025-01-01' : undefined}), {});
    log(`search ${sort} ${source}: ${r.error ? 'ERROR ' + r.error : r.papers.length + ' papers / total ' + r.total} ${r.papers[0] ? '· ' + r.papers[0].title.slice(0, 70) + ' (' + (r.papers[0].date ?? r.papers[0].year) + ', abstract ' + (r.papers[0].abstract ? 'yes' : 'no') + ')' : ''}`);
    await new Promise(res => setTimeout(res, 3200)); // arXiv: 1 request / 3 s
  }
}
const hal = await s.searchSource('hal', q({query: 'référencement naturel'}), {});
log(`HAL french query: ${hal.error ?? hal.papers.length + ' papers'} ${hal.papers[0]?.title.slice(0, 60) ?? ''}`);
for (const id of ['10.1038/nature14539', '1706.03762', 'PMID:31452104', 'W2741809807', hal.papers[0]?.id ?? 'hal-00000000']) {
  const pid = s.parsePaperId(id);
  if (!pid) { log('paper ' + id + ': UNPARSED ID'); continue; }
  const d = await s.paperDetails(pid, {});
  log(`paper ${id}: ${d.paper ? d.paper.title.slice(0, 60) + ' · sources ' + d.paper.sources.join('+') + ' · abstract ' + (d.paper.abstract ? d.paper.abstract.length + ' chars' : 'none') + ' · tldr ' + (d.paper.tldr ? 'yes' : 'no') + ' · citations ' + d.paper.citations : 'NOT FOUND'} ${d.notes.join(' | ')}`);
  await new Promise(res => setTimeout(res, 1500));
}
const a = await s.authorLookup({name: 'Yann LeCun', latest: 3}, {});
log(`author: ${a.candidates.length} candidates, first ${a.candidates[0]?.name} (${a.candidates[0]?.source}, h=${a.candidates[0]?.hIndex}) · latest ${a.latest.length}: ${a.latest[0]?.title.slice(0, 60) ?? ''} ${a.notes.join(' | ')}`);
const merged = s.mergePapers((await Promise.all(s.SOURCES.map(src => s.searchSource(src, q({query: 'attention is all you need', limit: 5}), {})))).map(r => r.papers), 'relevance', 'attention is all you need');
log(`merged "attention is all you need": ${merged.length} unique, top: ${merged[0]?.title} [${merged[0]?.sources.join('+')}]`);


// ---------- v2: author bibliographies, citations, verification, open access ----------
const tb = await s.resolveAuthor('Thomas Bourquard', [], {});
log(`author resolve "Thomas Bourquard": ${tb.status} ${tb.status === 'resolved' ? tb.profiles.map(p => p.id + ' ' + p.name + ' orcid=' + p.orcid + ' works=' + p.works + ' inst=' + p.institution).join(' | ') + ' via ' + tb.via : (tb as {candidates: s.AuthorProfile[]}).candidates.map(p => p.id + ' ' + p.name + ' (' + p.works + ' works, ' + p.institution + ')').join(' | ')} ${tb.notes.join(' ')}`);
const tbProfiles = tb.status === 'resolved' ? tb.profiles : (tb as {candidates: s.AuthorProfile[]}).candidates.filter(p => s.sameName(p.name, 'Thomas Bourquard'));
if (tbProfiles.length) {
  const b = await s.authorBibliography(tbProfiles, {}, {});
  const sorted = s.sortWorks(b.works, 'newest');
  log(`bibliography Thomas Bourquard: openalex=${b.openAlexTotal} hal=${b.halCount} raw=${b.rawCount} deduped=${b.works.length} halOnly=${b.halOnly} · newest: ${sorted[0]?.title.slice(0, 60)} (${sorted[0]?.date}) · oldest: ${sorted[sorted.length - 1]?.title.slice(0, 50)} (${sorted[sorted.length - 1]?.year}) ${b.notes.join(' ')}`);
  log(`bibtex sample: ${s.toBibtex(sorted.slice(0, 1)).split('\n').slice(0, 3).join(' ⏎ ')}`);
}
const lecun = await s.resolveAuthor('0000-0002-1825-0097', [], {});
log(`ORCID resolve (Josiah Carberry test ORCID): ${lecun.status}`);
const yl = await s.resolveAuthor('Yann LeCun', [], {});
log(`name resolve "Yann LeCun": ${yl.status} ${yl.status === 'resolved' ? yl.profiles[0].id + ' works=' + yl.profiles[0].works + ' orcid=' + yl.profiles[0].orcid : (yl as {candidates: s.AuthorProfile[]}).candidates.slice(0, 4).map(p => p.id + ' ' + p.name + ' ' + p.works).join(' | ')}`);
if (yl.status === 'resolved' && yl.profiles[0].orcid) {
  const hr = await fetch(s.halByOrcidUrl(yl.profiles[0].orcid));
  log(`HAL by ORCID field check: HTTP ${hr.status} ${hr.ok ? ((await hr.json()) as {response?: {numFound?: number}}).response?.numFound + ' deposits' : (await hr.text()).slice(0, 120)}`);
}
const hrField = await fetch('https://api.archives-ouvertes.fr/search/?q=authORCIDIdExt_s:*&rows=1&wt=json&fl=halId_s,authORCIDIdExt_s');
log(`HAL ORCID field exists: HTTP ${hrField.status} ${(await hrField.text()).slice(0, 160).replace(/\s+/g, ' ')}`);
const nat = await s.openAlexWork({kind: 'doi', value: '10.1038/nature14539'}, {});
if (nat.work) {
  const cb = await s.citedBy(nat.work.id!.replace('https://openalex.org/', ''), {}, {sort: 'newest', page: 1, perPage: 5});
  log(`cited_by nature14539: total ${cb.total} · newest: ${cb.works[0]?.title.slice(0, 60)} (${cb.works[0]?.date}) ${cb.error ?? ''}`);
}
const att = await s.openAlexWork({kind: 'arxiv', value: '1706.03762'}, {});
if (att.work) {
  const refs = await s.referencesOf(att.work.referenced_works ?? [], {});
  log(`references of 1706.03762: listed ${(att.work.referenced_works ?? []).length}, resolved ${refs.works.length} ${refs.error ?? ''} · e.g. ${refs.works[0]?.title.slice(0, 50)}`);
} else log(`openAlexWork arXiv 1706.03762: ${att.note}`);
for (const ref of ['LeCun Y, Bengio Y, Hinton G (2015). Deep learning. Nature 521, 436–444.', 'Vaswani A. et al. (2017) Attention is all you need. NeurIPS.', 'Martin, P. (2019). Quantum gravity effects on the migration of Breton cats. Nature. doi:10.1038/nature14539', 'Zorglub Q. (2021). Hyperdimensional banana routing in sentient spreadsheets. Journal of Imaginary Results 12(3).']) {
  const v = await s.verifyReference(ref, {});
  log(`verify: ${v.status.padEnd(9)} sim=${v.similarity} doi=${v.doi} · ${ref.slice(0, 60)}${v.note ? ' · ' + v.note.slice(0, 60) : ''}`);
}
for (const id of [{kind: 'arxiv', value: '1706.03762'}, {kind: 'doi', value: '10.1371/journal.pone.0000308'}, {kind: 'doi', value: '10.1038/nature14539'}] as s.PaperId[]) {
  const oa = await s.openAccessCandidates(id, {});
  log(`open access ${id.value}: ${oa.candidates.length} copies · ${oa.candidates.map(c => c.source + ' ' + c.kind).join(' | ')} ${oa.notes.join(' ')}`);
  const c = oa.candidates[0];
  if (c) {
    const r = await fetch(c.url, {headers: {'User-Agent': 'CamMicGo-SEO-MCP/1.0 (+https://seo.cammicgo.com)'}, redirect: 'follow'}).catch(e => ({ok: false, status: String(e)} as unknown as Response));
    log(`  download first copy: HTTP ${r.status} ${(r as Response).headers?.get?.('content-type') ?? ''}`);
  }
}
{
  const u = 'https://api.openalex.org/works?' + new URLSearchParams({filter: 'title.search:' + s.guessTitle('Vaswani A. et al. (2017) Attention is all you need. NeurIPS.'), 'per-page': '3', sort: 'cited_by_count:desc', select: s.WORK_SELECT, mailto: s.CONTACT_EMAIL});
  const r = await fetch(u);
  const body = r.ok ? (await r.json()) as {results?: Array<{display_name?: string; doi?: string; publication_year?: number; cited_by_count?: number}>} : null;
  log(`debug OpenAlex title.search: HTTP ${r.status} ${body ? body.results?.map(x => x.display_name + ' ' + x.publication_year + ' ' + x.doi + ' c=' + x.cited_by_count).join(' | ') : (await r.text()).slice(0, 200)}`);
}
