// Scores benchmark answer files (benchmarks/runs/*.md) with the website's scorer; used by the "Benchmark scoring" workflow.
import {appendFileSync, readFileSync} from 'node:fs';
const file = process.env.LIVE_OUT ?? 'bench-scores.txt';
const log = (l: string) => { appendFileSync(file, l + '\n'); console.log(l); };
async function main() {
  const {scoreAnswer} = await import('@/lib/benchmark');
  const paths = process.argv.slice(2).filter(p => /benchmarks\/runs\/.+\.md$/.test(p));
  if (!paths.length) { log('No run file changed.'); return; }
  for (const p of paths) {
    try {
      const raw = readFileSync(p, 'utf8');
      const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
      if (!m) { log(`${p}: missing header`); continue; }
      const head = Object.fromEntries(m[1].split('\n').map(l => l.split(/:\s*/)).filter(x => x.length >= 2).map(([k, ...v]) => [k.trim(), v.join(':').replace(/\s+#.*$/, '').trim()]));
      const t0 = Date.now();
      const s = await scoreAnswer(head.task, m[2], {});
      log(`${p.split('/').pop()} · task=${head.task} · mode=${head.mode} · ${head.assistant} · ${head.seconds}s → identifiers=${s.identifiers} verified=${s.verified} invented=${s.invalid.length} onTarget=${s.onTarget} offTarget=${s.offTarget} coverage=${s.recall ?? '—'}% of ${s.referenceSize ?? '—'} correct=${s.correct ?? '—'} accuracy=${s.accuracy ?? '—'} (scored in ${Date.now() - t0} ms) ${JSON.stringify(s.details).slice(0, 400)} ${s.notes.join(' ')}`);
    } catch (e) { log(`${p}: CRASH ${e instanceof Error ? e.message : String(e)}`); }
  }
}
void main();
