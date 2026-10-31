// Unit tests for author bibliographies, exports, citations helpers and reference verification (lib/science.ts).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as s from '../lib/science.ts';

const work = (over: Partial<s.BibWork>): s.BibWork => ({id: 'W1', doi: null, title: 'A study of things', year: 2024, date: '2024-05-01', type: 'article', venue: 'Journal of Tests', publisher: null,
  volume: null, issue: null, firstPage: null, lastPage: null, authors: [{name: 'Thomas Bourquard', orcid: null}], citations: 3, openAccess: null, pdfUrl: null, landingUrl: null,
  language: 'en', retracted: false, sources: ['openalex'], versions: [], ...over});

test('author references: ORCID (with checksum), OpenAlex, Semantic Scholar, name', () => {
  assert.equal(s.validOrcid('0000-0002-1825-0097'), true);
  assert.equal(s.validOrcid('0000-0002-1825-0098'), false);
  assert.equal(s.validOrcid('0000-0002-1694-233X'), true);
  assert.deepEqual(s.parseAuthorRef('https://orcid.org/0000-0002-1825-0097'), {kind: 'orcid', value: '0000-0002-1825-0097'});
  assert.deepEqual(s.parseAuthorRef('a5023888391'), {kind: 'openalex', value: 'A5023888391'});
  assert.deepEqual(s.parseAuthorRef('https://openalex.org/authors/A5023888391'), {kind: 'openalex', value: 'A5023888391'});
  assert.deepEqual(s.parseAuthorRef('https://www.semanticscholar.org/author/Yann-LeCun/1688882'), {kind: 's2', value: '1688882'});
  assert.deepEqual(s.parseAuthorRef('  Thomas   Bourquard '), {kind: 'name', value: 'Thomas Bourquard'});
});

test('name matching tolerates accents, case and initials but not other people', () => {
  assert.ok(s.sameName('Thomas Bourquard', 'thomas bourquard'));
  assert.ok(s.sameName('T. Bourquard', 'Thomas Bourquard'));
  assert.ok(s.sameName('Hélène Dupré', 'Helene Dupre'));
  assert.ok(!s.sameName('Thomas Bourquard', 'Thomas Bourgeois'));
  assert.ok(!s.sameName('Marc Bourquard', 'Thomas Bourquard'));
});

test('author works URL: all IDs, years, topic, cursor, 200 per page', () => {
  const u = new URL(s.authorWorksUrl(['a1234567', 'A7654321'], {openalex: 'K'}, '*', {from: '2020', to: '2024-06-30', query: 'robot vision'}));
  assert.equal(u.searchParams.get('filter'), 'author.id:A1234567|A7654321,from_publication_date:2020-01-01,to_publication_date:2024-06-30,title_and_abstract.search:robot AND vision');
  assert.equal(u.searchParams.get('per-page'), '200');
  assert.equal(u.searchParams.get('cursor'), '*');
  assert.equal(u.searchParams.get('sort'), 'publication_date:desc');
  assert.equal(u.searchParams.get('api_key'), 'K');
});

test('OpenAlex work parsing keeps bibliographic details', () => {
  const w = s.parseBibWork({id: 'https://openalex.org/W42', doi: 'https://doi.org/10.1109/ABC.2021.1', display_name: 'Deep stuff', publication_date: '2021-03-04', publication_year: 2021, type: 'article',
    cited_by_count: 7, primary_location: {source: {display_name: 'IEEE T-PAMI', host_organization_name: 'IEEE'}, landing_page_url: 'https://x'}, open_access: {is_oa: false},
    authorships: [{author: {display_name: 'Ada Lovelace', orcid: 'https://orcid.org/0000-0002-1825-0097'}}], biblio: {volume: '43', issue: '2', first_page: '10', last_page: '20'}, is_retracted: true} as never)!;
  assert.equal(w.id, 'W42');
  assert.equal(w.doi, '10.1109/abc.2021.1');
  assert.equal(w.authors[0].orcid, '0000-0002-1825-0097');
  assert.equal(w.publisher, 'IEEE');
  assert.equal(w.retracted, true);
});

test('de-duplication merges preprint + published version and same DOI, keeps the published one', () => {
  const pre = work({id: 'W1', doi: '10.48550/arxiv.2101.00001', title: 'Neural Fields for Robots', type: 'preprint', venue: 'arXiv', year: 2021, citations: 5, pdfUrl: 'https://arxiv.org/pdf/2101.00001'});
  const pub = work({id: 'W2', doi: '10.1109/tro.2022.1', title: 'Neural fields for robots', type: 'article', venue: 'IEEE Transactions on Robotics', year: 2022, citations: 40});
  const hal = work({id: 'hal-01234567', halId: 'hal-01234567', doi: '10.1109/tro.2022.1', title: 'Neural fields for robots', type: 'article', sources: ['hal'], citations: null});
  const other = work({id: 'W3', title: 'Something else entirely', year: 2020});
  const out = s.dedupeWorks([pre, pub, hal, other]);
  assert.equal(out.length, 2);
  const m = out.find(w => w.doi === '10.1109/tro.2022.1')!;
  assert.equal(m.id, 'W2');
  assert.equal(m.citations, 40);
  assert.equal(m.pdfUrl, 'https://arxiv.org/pdf/2101.00001');
  assert.deepEqual(m.sources.sort(), ['hal', 'openalex']);
  assert.ok(m.versions.includes('doi:10.48550/arxiv.2101.00001'));
  assert.ok(m.versions.includes('hal-01234567'));
});

test('sorting: newest, oldest, citations', () => {
  const ws = [work({id: 'a', date: '2020-01-01', year: 2020, citations: 50}), work({id: 'b', date: '2024-06-01', year: 2024, citations: 1}), work({id: 'c', date: null, year: 2022, citations: 9})];
  assert.deepEqual(s.sortWorks(ws, 'newest').map(w => w.id), ['b', 'c', 'a']);
  assert.deepEqual(s.sortWorks(ws, 'oldest').map(w => w.id), ['a', 'c', 'b']);
  assert.deepEqual(s.sortWorks(ws, 'citations').map(w => w.id), ['a', 'c', 'b']);
});

test('names split with particles', () => {
  assert.deepEqual(s.splitName('Jean de La Fontaine'), {family: 'de La Fontaine', given: 'Jean'});
  assert.deepEqual(s.splitName('Thomas Bourquard'), {family: 'Bourquard', given: 'Thomas'});
  assert.deepEqual(s.splitName('Plato'), {family: 'Plato', given: ''});
  assert.deepEqual(s.splitName('Ludwig van Beethoven'), {family: 'van Beethoven', given: 'Ludwig'});
});

test('exports: BibTeX, RIS, CSV, Markdown, CSL-JSON', () => {
  const ws = [work({id: 'W9', doi: '10.1000/xyz', title: 'Robots & {friends}: 100% fun', year: 2023, date: '2023-02-01', volume: '12', issue: '3', firstPage: '45', lastPage: '67',
    authors: [{name: 'Thomas Bourquard', orcid: null}, {name: 'Jean de La Fontaine', orcid: null}]}),
    work({id: 'W8', title: 'Robots again', year: 2023, type: 'preprint', venue: 'arXiv'})];
  const bib = s.toBibtex(ws);
  assert.match(bib, /@article\{bourquard2023robots,/);
  assert.match(bib, /author = \{Bourquard, Thomas and de La Fontaine, Jean\}/);
  assert.match(bib, /title = \{\{Robots \\& \\\{friends\\\}: 100\\% fun\}\}/);
  assert.match(bib, /pages = \{45--67\}/);
  assert.match(bib, /@misc\{bourquard2023robotsb,/);
  const ris = s.toRis(ws);
  assert.match(ris, /TY {2}- JOUR\r\nTI {2}- Robots/);
  assert.match(ris, /AU {2}- de La Fontaine, Jean/);
  assert.match(ris, /DO {2}- 10\.1000\/xyz/);
  assert.match(ris, /TY {2}- UNPB/);
  const csv = s.toCsv(ws);
  assert.ok(csv.startsWith('﻿title,authors,year'));
  assert.match(csv, /"Robots & \{friends\}: 100% fun"|Robots & \{friends\}: 100% fun/);
  const md = s.toMarkdown(ws, 'Publications — Thomas Bourquard');
  assert.match(md, /^# Publications — Thomas Bourquard\n\n1\. Thomas Bourquard, Jean de La Fontaine \(2023\)\. \*\*Robots/);
  const csl = JSON.parse(s.toCslJson(ws));
  assert.equal(csl[0].type, 'article-journal');
  assert.deepEqual(csl[0].issued, {'date-parts': [[2023, 2, 1]]});
  assert.deepEqual(csl[0].author[1], {family: 'de La Fontaine', given: 'Jean'});
});

test('HAL deposits linked to an ORCID become bibliography entries', () => {
  const u = new URL(s.halByOrcidUrl('0000-0002-1825-0097'));
  assert.equal(u.searchParams.get('q'), 'authORCIDIdExt_s:"0000-0002-1825-0097"');
  const ws = s.halDocsToBib({response: {docs: [{halId_s: 'tel-01234567', title_s: ['Une thèse'], producedDate_s: '2019-12-10', docType_s: 'THESE', authFullName_s: ['Thomas Bourquard'], fileMain_s: 'https://theses.hal.science/x.pdf', page_s: '1-180'}]}});
  assert.equal(ws[0].type, 'thesis');
  assert.equal(ws[0].firstPage, '1');
  assert.equal(ws[0].lastPage, '180');
  assert.equal(ws[0].openAccess, true);
});

test('reference verification: title similarity, mismatch detection with a fake API', async () => {
  assert.equal(s.titleSimilarity('LeCun Y, Bengio Y, Hinton G. Deep learning. Nature 2015', 'Deep learning'), 1);
  assert.ok(s.titleSimilarity('Smith 2020 A study of cats', 'Quantum chromodynamics on the lattice') < 0.2);
  const fake: s.Fetcher = async (url) => {
    if (url.includes('api.openalex.org/works/doi:10.1038')) return new Response(JSON.stringify({id: 'https://openalex.org/W1', doi: 'https://doi.org/10.1038/nature14539', display_name: 'Deep learning', publication_year: 2015, type: 'article', authorships: []}));
    if (url.includes('api.crossref.org/works?')) return new Response(JSON.stringify({message: {items: [{DOI: '10.1000/real', title: ['Attention is all you need'], issued: {'date-parts': [[2017]]}}]}}));
    return new Response('{}', {status: 404});
  };
  const ok = await s.verifyReference('LeCun, Bengio, Hinton (2015). Deep learning. Nature. https://doi.org/10.1038/nature14539', {}, fake);
  assert.equal(ok.status, 'verified');
  const wrong = await s.verifyReference('Dupont (2015). Quantum gravity for cats. Nature. doi:10.1038/nature14539', {}, fake);
  assert.equal(wrong.status, 'mismatch');
  const found = await s.verifyReference('Vaswani et al. 2017 Attention is all you need', {}, fake);
  assert.equal(found.status, 'verified');
  assert.equal(found.doi, '10.1000/real');
  const missing = await s.verifyReference('Doe (2019) A paper that does not exist about bananas', {}, fake);
  assert.equal(missing.status, 'not_found');
});

test('JATS full text to plain text without references', () => {
  const t = s.jatsToText('<article><front><article-title>T</article-title><abstract><p>Abstract &amp; more.</p></abstract></front><body><sec><title>Intro</title><p>Hello <italic>world</italic>.</p></sec></body><back><ref-list><ref>Ref 1</ref></ref-list></back></article>');
  assert.match(t, /Abstract & more\./);
  assert.match(t, /## Intro/);
  assert.match(t, /Hello world\./);
  assert.ok(!t.includes('Ref 1'));
});

test('title guessing inside free-text references', () => {
  assert.equal(s.guessTitle('Vaswani A. et al. (2017) Attention is all you need. NeurIPS.'), 'Attention is all you need');
  assert.equal(s.guessTitle('Smith J, Doe A. "A study of SEO in 2020". Journal of Web 3(2):1-10'), 'A study of SEO in 2020');
  assert.equal(s.guessTitle('Bourquard T, Poupon A. Protein docking with Voronoi tessellations. Proteins 2015;83(4):123-130.'), 'Protein docking with Voronoi tessellations');
  assert.deepEqual(s.splitName('Anne Poupon B'), {family: 'Poupon', given: 'Anne B'});
});

test('name resolution: one dominant profile is chosen, real homonyms stay ambiguous', async () => {
  const profile = (id: string, name: string, works: number, orcid: string | null = null) => ({id: 'https://openalex.org/' + id, display_name: name, works_count: works, orcid});
  const answer = (results: unknown[]): s.Fetcher => async () => new Response(JSON.stringify({results}));
  const dom = await s.resolveAuthor('Yann LeCun', [], {}, answer([profile('A1', 'Yann LeCun', 548), profile('A2', 'Yann LeCun', 4)]));
  assert.equal(dom.status, 'resolved');
  assert.equal(dom.status === 'resolved' && dom.profiles[0].id, 'A1');
  assert.match(dom.notes.join(' '), /extraAuthorIds/);
  const homonyms = await s.resolveAuthor('Jean Martin', [], {}, answer([profile('A3', 'Jean Martin', 120), profile('A4', 'Jean Martin', 85)]));
  assert.equal(homonyms.status, 'ambiguous');
  const shared = await s.resolveAuthor('Ada Lovelace', [], {}, answer([profile('A5', 'Ada Lovelace', 30, 'https://orcid.org/0000-0002-1825-0097'), profile('A6', 'Ada Lovelace', 25, 'https://orcid.org/0000-0002-1825-0097')]));
  assert.equal(shared.status, 'resolved');
  assert.equal(shared.status === 'resolved' && shared.profiles.length, 2);
});
