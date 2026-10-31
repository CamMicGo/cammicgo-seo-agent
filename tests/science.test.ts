// Unit tests for lib/science.ts — run with: npm test
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as s from '../lib/science.ts';

const q = (over: Partial<s.SearchQuery> = {}): s.SearchQuery => ({query: 'large language models', sort: 'relevance', limit: 10, offset: 0, ...over});

test('identifiers: DOI, arXiv, PMID, OpenAlex, Semantic Scholar, HAL', () => {
  assert.deepEqual(s.parsePaperId('10.1038/nature14539'), {kind: 'doi', value: '10.1038/nature14539'});
  assert.deepEqual(s.parsePaperId('https://doi.org/10.1145/3292500.3330701'), {kind: 'doi', value: '10.1145/3292500.3330701'});
  assert.deepEqual(s.parsePaperId('2401.01234v2'), {kind: 'arxiv', value: '2401.01234v2'});
  assert.deepEqual(s.parsePaperId('https://arxiv.org/abs/1706.03762'), {kind: 'arxiv', value: '1706.03762'});
  assert.deepEqual(s.parsePaperId('arxiv:cs/0112017'), {kind: 'arxiv', value: 'cs/0112017'});
  assert.deepEqual(s.parsePaperId('PMID: 31452104'), {kind: 'pmid', value: '31452104'});
  assert.deepEqual(s.parsePaperId('https://pubmed.ncbi.nlm.nih.gov/31452104/'), {kind: 'pmid', value: '31452104'});
  assert.deepEqual(s.parsePaperId('https://openalex.org/W2741809807'), {kind: 'openalex', value: 'W2741809807'});
  assert.deepEqual(s.parsePaperId('649def34f8be52c8b66281af98ae884c09aef38b'), {kind: 's2', value: '649def34f8be52c8b66281af98ae884c09aef38b'});
  assert.deepEqual(s.parsePaperId('https://hal.science/hal-01234567v2'), {kind: 'hal', value: 'hal-01234567v2'});
  assert.deepEqual(s.parsePaperId('tel-04012345'), {kind: 'hal', value: 'tel-04012345'});
  assert.deepEqual(s.parsePaperId('sic-00001234'), {kind: 'hal', value: 'sic-00001234'});
  assert.deepEqual(s.parsePaperId('emse-01234567'), {kind: 'hal', value: 'emse-01234567'});
  assert.deepEqual(s.parsePaperId('mem_00502609'), {kind: 'hal', value: 'mem_00502609'});
  assert.equal(s.parsePaperId('hello world'), null);
});

test('OpenAlex: URL (filters, sort, key) and parsing with inverted abstract', () => {
  const u = new URL(s.openAlexUrl(q({sort: 'date', from: '2026-01-01', openAccessOnly: true, limit: 20, offset: 20}), 'KEY'));
  assert.equal(u.searchParams.get('sort'), 'publication_date:desc');
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(u.searchParams.get('filter'), 'title_and_abstract.search:"large language models",from_publication_date:2026-01-01,to_publication_date:' + today + ',is_oa:true');
  assert.equal(u.searchParams.get('search'), null);
  assert.equal(new URL(s.openAlexUrl(q())).searchParams.get('search'), 'large language models');
  assert.equal(u.searchParams.get('page'), '2');
  assert.equal(u.searchParams.get('api_key'), 'KEY');
  assert.equal(new URL(s.openAlexUrl(q())).searchParams.get('api_key'), null);
  const r = s.parseOpenAlex({meta: {count: 42}, results: [{id: 'https://openalex.org/W1', doi: 'https://doi.org/10.1234/ABC', display_name: 'Attention Is All You Need', publication_date: '2017-06-12', publication_year: 2017,
    cited_by_count: 100000, type: 'article', authorships: [{author: {display_name: 'Ashish Vaswani'}}], primary_location: {source: {display_name: 'NeurIPS'}},
    open_access: {is_oa: true}, best_oa_location: {pdf_url: 'https://x/pdf'}, abstract_inverted_index: {The: [0], dominant: [1], models: [2]}, ids: {pmid: 'https://pubmed.ncbi.nlm.nih.gov/123'}}]});
  assert.equal(r.total, 42);
  const p = r.papers[0];
  assert.equal(p.id, 'W1');
  assert.equal(p.doi, '10.1234/abc');
  assert.equal(p.abstract, 'The dominant models');
  assert.equal(p.pmid, '123');
  assert.equal(p.pdfUrl, 'https://x/pdf');
  assert.equal(p.citations, 100000);
});

test('Semantic Scholar: relevance vs bulk (sorted) URLs and parsing', () => {
  const rel = new URL(s.semanticScholarUrl(q({from: '2025-01-01'})));
  assert.equal(rel.pathname, '/graph/v1/paper/search');
  assert.ok(rel.searchParams.get('fields')!.includes('abstract'));
  assert.equal(rel.searchParams.get('publicationDateOrYear'), '2025-01-01:');
  const bulk = new URL(s.semanticScholarUrl(q({sort: 'citations', openAccessOnly: true})));
  assert.equal(bulk.pathname, '/graph/v1/paper/search/bulk');
  assert.equal(bulk.searchParams.get('sort'), 'citationCount:desc');
  assert.equal(bulk.searchParams.get('openAccessPdf'), '');
  assert.equal(bulk.searchParams.get('query'), '"large language models"');
  assert.equal(new URL(s.semanticScholarUrl(q({sort: 'date', query: 'retrieval augmented generation for search engines'}))).searchParams.get('query'), 'retrieval + augmented + generation + for + search + engines');
  const data = Array.from({length: 30}, (_, i) => ({paperId: 'p' + i, title: 'Paper ' + i, year: 2020, externalIds: {DOI: '10.5555/X' + i, ArXiv: '2001.0000' + i}, citationCount: i}));
  const parsed = s.parseSemanticScholar({total: 30, data}, q({sort: 'date', limit: 5, offset: 10}));
  assert.equal(parsed.papers.length, 5);
  assert.equal(parsed.papers[0].id, 'p10');
  assert.equal(parsed.papers[0].doi, '10.5555/x10');
  assert.equal(parsed.papers[0].arxivId, '2001.000010');
});

test('arXiv: query building and Atom parsing', () => {
  const u = new URL(s.arxivUrl(q({query: 'graph "neural" networks', sort: 'date', from: '2026-10-01'})));
  assert.equal(u.searchParams.get('search_query'), '((ti:"graph neural networks" OR abs:"graph neural networks")) AND submittedDate:[202610010000 TO 299912312359]');
  assert.equal(u.searchParams.get('sortBy'), 'submittedDate');
  const xml = `<feed><opensearch:totalResults>1234</opensearch:totalResults><entry><id>http://arxiv.org/abs/2410.12345v2</id><published>2024-10-16T17:59:59Z</published>
<title>Large Language
  Models &amp; Agents</title><summary>  We study agents. </summary><author><name>Ada Lovelace</name></author><author><name>Alan Turing</name></author>
<arxiv:doi>10.48550/arXiv.2410.12345</arxiv:doi><link title="pdf" href="http://arxiv.org/pdf/2410.12345v2" rel="related"/></entry></feed>`;
  const r = s.parseArxiv(xml);
  assert.equal(r.total, 1234);
  const p = r.papers[0];
  assert.equal(p.title, 'Large Language Models & Agents');
  assert.equal(p.arxivId, '2410.12345');
  assert.equal(p.date, '2024-10-16');
  assert.deepEqual(p.authors, ['Ada Lovelace', 'Alan Turing']);
  assert.equal(p.pdfUrl, 'https://arxiv.org/pdf/2410.12345v2');
  assert.equal(p.abstract, 'We study agents.');
});

test('PubMed: search URL with key, summary and abstract parsing', () => {
  const u = new URL(s.pubmedSearchUrl(q({sort: 'date', from: '2026-01-01', openAccessOnly: true}), 'NCBI'));
  assert.equal(u.searchParams.get('sort'), 'pub_date');
  assert.equal(u.searchParams.get('mindate'), '2026/01/01');
  assert.equal(u.searchParams.get('api_key'), 'NCBI');
  assert.ok(u.searchParams.get('term')!.endsWith('AND free full text[sb]'));
  const papers = s.parsePubmedSummary({result: {uids: ['111'], '111': {uid: '111', title: 'A trial.', authors: [{name: 'Dupont J'}], fulljournalname: 'The Lancet', sortpubdate: '2026/03/02 00:00',
    articleids: [{idtype: 'doi', value: '10.1016/S0140'}, {idtype: 'pmc', value: 'PMC999'}], pubtype: ['Journal Article']}}});
  assert.equal(papers[0].title, 'A trial');
  assert.equal(papers[0].date, '2026-03-02');
  assert.equal(papers[0].doi, '10.1016/s0140');
  assert.equal(papers[0].pdfUrl, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC999/');
  const abs = s.parsePubmedAbstract('<Abstract><AbstractText Label="BACKGROUND">Cats &amp; dogs.</AbstractText><AbstractText Label="RESULTS">It <i>works</i>.</AbstractText></Abstract>');
  assert.equal(abs, 'BACKGROUND: Cats & dogs.\nRESULTS: It works.');
});

test('HAL: Solr-safe query, filters and parsing', () => {
  const u = new URL(s.halUrl(q({query: 'référencement (SEO): "web"', sort: 'date', from: '2025-01-01', openAccessOnly: true})));
  assert.equal(u.searchParams.get('q'), 'title_t:"référencement SEO web" OR abstract_t:"référencement SEO web"');
  assert.equal(new URL(s.halUrl(q({query: 'référencement (SEO): "web"'}))).searchParams.get('q'), 'référencement AND SEO AND web');
  assert.equal(u.searchParams.get('sort'), 'producedDate_tdate desc');
  assert.deepEqual(u.searchParams.getAll('fq'), ['producedDate_tdate:[2025-01-01T00:00:00Z TO *]', 'openAccess_bool:true']);
  const r = s.parseHal({response: {numFound: 7, docs: [{halId_s: 'hal-04500000', title_s: ['Le référencement naturel'], authFullName_s: ['Marie Curie'], producedDate_s: '2025-05',
    uri_s: 'https://hal.science/hal-04500000', docType_s: 'THESE', fileMain_s: 'https://hal.science/hal-04500000/document', abstract_s: ['Résumé.']}]}});
  assert.equal(r.total, 7);
  assert.equal(r.papers[0].type, 'thesis');
  assert.equal(r.papers[0].date, null);
  assert.equal(r.papers[0].year, 2025);
  assert.equal(r.papers[0].openAccess, true);
});

test('merge: duplicates across sources are combined, sorting by date and citations', () => {
  const base = {authors: [], venue: null, type: null, url: null, pdfUrl: null, openAccess: null, abstract: null, pmid: null, arxivId: null} as const;
  const a: s.Paper = {...base, source: 'openalex', sources: ['openalex'], id: 'W1', title: 'Deep Learning', year: 2015, date: '2015-05-27', doi: '10.1038/nature14539', citations: 50000, authors: ['LeCun']};
  const b: s.Paper = {...base, source: 'semanticscholar', sources: ['semanticscholar'], id: 'x', title: 'Deep learning', year: 2015, date: null, doi: '10.1038/nature14539', citations: 60000, abstract: 'Deep learning allows…'};
  const c: s.Paper = {...base, source: 'arxiv', sources: ['arxiv'], id: '2601.00001', title: 'New thing', year: 2026, date: '2026-01-02', doi: null, citations: null};
  const byDate = s.mergePapers([[a], [b, c]], 'date');
  assert.equal(byDate.length, 2);
  assert.equal(byDate[0].title, 'New thing');
  assert.deepEqual(byDate[1].sources, ['openalex', 'semanticscholar']);
  assert.equal(byDate[1].citations, 60000);
  assert.equal(byDate[1].abstract, 'Deep learning allows…');
  assert.equal(s.mergePapers([[c], [a]], 'citations')[0].title, 'Deep Learning');
  const other: s.Paper = {...c, id: 'o', title: 'Attention in drug discovery', sources: ['openalex'], source: 'openalex'};
  const exact: s.Paper = {...c, id: 'v', title: 'Attention Is All You Need', sources: ['arxiv'], arxivId: '1706.03762'};
  assert.equal(s.mergePapers([[other], [{...other, source: 'pubmed', sources: ['pubmed']}, exact]], 'relevance', 'attention is all you need')[0].title, 'Attention Is All You Need');
});

test('compact output is bounded and errors explain the missing key', () => {
  const p: s.Paper = {source: 'hal', sources: ['hal'], id: 'hal-1', title: 'T', authors: Array.from({length: 12}, (_, i) => 'A' + i), year: 2024, date: null, venue: null, type: null,
    doi: null, arxivId: null, pmid: null, url: null, pdfUrl: null, openAccess: null, citations: null, abstract: 'word '.repeat(400)};
  const c = s.compact(p, 100);
  assert.equal(c.authors.length, 9);
  assert.ok(c.abstract!.length <= 101);
  assert.equal(c.id, 'hal-1');
  assert.match(s.sourceError('openalex', 429, false), /Add a free personal key/);
  assert.match(s.sourceError('semanticscholar', 403, true), /key was refused/);
});

test('fetch layer: errors are reported per source without throwing', async () => {
  const fake: s.Fetcher = async (url) => url.includes('openalex') ? new Response('{}', {status: 429}) : new Response(JSON.stringify({response: {numFound: 0, docs: []}}), {status: 200});
  const r1 = await s.searchSource('openalex', q(), {}, fake);
  assert.match(r1.error!, /shared quota/);
  const r2 = await s.searchSource('hal', q(), {}, fake);
  assert.equal(r2.error, undefined);
  let seen = '';
  const spy: s.Fetcher = async (url, init) => { seen = String((init?.headers as Record<string, string>)['x-api-key'] ?? ''); return new Response(JSON.stringify({total: 0, data: []})); };
  await s.searchSource('semanticscholar', q(), {semanticscholar: 'S2KEY'}, spy);
  assert.equal(seen, 'S2KEY');
});
