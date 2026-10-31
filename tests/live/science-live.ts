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
  const pid = s.parsePaperId(id)!;
  const d = await s.paperDetails(pid, {});
  log(`paper ${id}: ${d.paper ? d.paper.title.slice(0, 60) + ' · sources ' + d.paper.sources.join('+') + ' · abstract ' + (d.paper.abstract ? d.paper.abstract.length + ' chars' : 'none') + ' · tldr ' + (d.paper.tldr ? 'yes' : 'no') + ' · citations ' + d.paper.citations : 'NOT FOUND'} ${d.notes.join(' | ')}`);
  await new Promise(res => setTimeout(res, 1500));
}
const a = await s.authorLookup({name: 'Yann LeCun', latest: 3}, {});
log(`author: ${a.candidates.length} candidates, first ${a.candidates[0]?.name} (${a.candidates[0]?.source}, h=${a.candidates[0]?.hIndex}) · latest ${a.latest.length}: ${a.latest[0]?.title.slice(0, 60) ?? ''} ${a.notes.join(' | ')}`);
const merged = s.mergePapers((await Promise.all(s.SOURCES.map(src => s.searchSource(src, q({query: 'attention is all you need', limit: 5}), {})))).map(r => r.papers), 'relevance', 'attention is all you need');
log(`merged "attention is all you need": ${merged.length} unique, top: ${merged[0]?.title} [${merged[0]?.sources.join('+')}]`);

