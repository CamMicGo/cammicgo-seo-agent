// Unit tests for lib/benchmark-parse.ts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as b from '../lib/benchmark-parse.ts';

test('identifiers are extracted from markdown answers', () => {
  const ans = `1. **Deep learning** — Nature (2015) https://doi.org/10.1038/nature14539.
2. Attention (arXiv:1706.03762) and [PDF](https://arxiv.org/pdf/1706.03762v7)
3. PMID: 31452104 · https://pubmed.ncbi.nlm.nih.gov/31452104/
4. https://openalex.org/W2741809807 and https://hal.science/hal-01234567v2 · theses.fr/2023UPASG012
5. DOI 10.48550/arXiv.2005.11401, 10.1145/3292500.3330701)`;
  const ids = b.extractIds(ans);
  assert.deepEqual(ids.dois, ['10.1038/nature14539', '10.48550/arxiv.2005.11401', '10.1145/3292500.3330701']);
  assert.deepEqual(ids.arxiv, ['1706.03762']);
  assert.deepEqual(ids.pmids, ['31452104']);
  assert.deepEqual(ids.openalex, ['W2741809807']);
  assert.deepEqual(ids.hal, ['hal-01234567']);
  assert.deepEqual(ids.thesesFr, ['2023UPASG012']);
  assert.equal(b.idCount(ids), 8);
});

test('reference-like lines (numbered, bullets, tables)', () => {
  const lines = b.referenceLines('Intro text here\n1. Smith J. A study of cats in Paris. 2020\n- Doe A. Another long title about dogs\n| 3 | Bourquard T. Protein docking with Voronoi |\nshort');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], 'Smith J. A study of cats in Paris. 2020');
  assert.match(lines[2], /Bourquard T\. Protein docking with Voronoi/);
});

test('verdicts per numbered item', () => {
  const ans = `| N° | Verdict | DOI |\n|---|---|---|\n| 1 | RÉELLE | 10.1038/nature14539 |\n| 2 | DOI ERRONÉ (le DOI pointe vers un autre article) | — |\n| 3 | Réelle | 10.48550/arXiv.1706.03762 |\n| 4 | INVENTÉE, aucune trace | — |\n5. Real — 10.18653/v1/N19-1423\n6) Fake: does not exist`;
  assert.deepEqual(b.parseVerdicts(ans, 6), ['real', 'mismatch', 'real', 'fake', 'real', 'fake']);
  assert.deepEqual(b.parseVerdicts('nothing useful', 2), [null, null]);
});

test('expected values with dot or comma', () => {
  assert.ok(b.containsValue('Le Transformer (big) atteint 28,4 BLEU', ['28.4']));
  assert.ok(b.containsValue('reaches 28.4 BLEU', ['28.4']));
  assert.ok(!b.containsValue('reaches 128.4 BLEU or 28.41', ['28.4']));
});
