// Live check of the benchmark scorer against the real APIs (run in CI with tsx, which resolves the '@/' alias).
import {appendFileSync} from 'node:fs';
import {scoreAnswer} from '@/lib/benchmark';
import * as sci from '@/lib/science';
const file = process.env.LIVE_OUT ?? 'science-live.txt';
const log = (l: string) => { appendFileSync(file, l + '\n'); console.log(l); };
const show = (name: string, m: Awaited<ReturnType<typeof scoreAnswer>>) => log(`BENCH ${name}: ids=${m.identifiers} verified=${m.verified} invalid=${m.invalid.length} onTarget=${m.onTarget} offTarget=${m.offTarget} recall=${m.recall} ref=${m.referenceSize} correct=${m.correct} accuracy=${m.accuracy} ${JSON.stringify(m.details).slice(0, 160)}`);

try {
  // A "good" answer built from the real bibliography, and a "bad" one with invented DOIs.
  const res = await sci.resolveAuthor('0000-0002-9670-711X', [], {});
  const bib = res.status === 'resolved' ? await sci.authorBibliography(res.profiles, {}, {}) : null;
  const good = (bib?.works ?? []).slice(0, 20).map((w, i) => `${i + 1}. ${w.title} (${w.year}) ${w.doi ? 'https://doi.org/' + w.doi : ''}`).join('\n');
  show('author good(20)', await scoreAnswer('author-bibliography', good, {}));
  show('author bad', await scoreAnswer('author-bibliography', '1. Fake paper one https://doi.org/10.9999/fake.123\n2. Deep learning https://doi.org/10.1038/nature14539', {}));
  show('verify perfect', await scoreAnswer('verify-references', '1. RÉELLE 10.1038/nature14539\n2. DOI ERRONÉ\n3. RÉELLE\n4. INVENTÉE\n5. RÉELLE\n6. INVENTÉE', {}));
  show('fulltext', await scoreAnswer('fulltext-fact', 'The big transformer model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task.', {}));
  const cites = await sci.openAlexWork({kind: 'arxiv', value: '1706.03762'}, {});
  const citing = cites.work ? await sci.citedBy(cites.work.id!.replace('https://openalex.org/', ''), {}, {sort: 'newest', page: 1, perPage: 10, from: '2026-01-01'}) : null;
  show('citing good', await scoreAnswer('citing-papers', (citing?.works ?? []).map((w, i) => `${i + 1}. ${w.title} https://doi.org/${w.doi}`).join('\n'), {}));
  show('most-cited sample', await scoreAnswer('most-cited', '1. Retrieval-Augmented Generation for Large Language Models: A Survey https://doi.org/10.48550/arxiv.2312.10997\n2. https://arxiv.org/abs/2005.11401', {}));
} catch (e) { log('BENCH CRASH ' + (e instanceof Error ? e.stack : String(e))); process.exitCode = 1; }
