import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

process.env.CAMMICGO_HOME = mkdtempSync(join(tmpdir(), 'cmg-'));
const {NotebookLMClient, envelope, extractRpc, parseNotebookId} = await import('../lib/notebooklm-rpc.mjs');
const {confirmToken, checkToken} = await import('../lib/local-notebooklm-tools.mjs');

const NB = '11111111-2222-3333-4444-555555555555';
const frame = (id, payload) => ")]}'\n\n120\n" + JSON.stringify([['wrb.fr', id, JSON.stringify(payload), null, null, null, 'generic']]) + '\n25\n[["e",4,null,null,1]]\n';
const HOME_PAGE = '<script>window.WIZ_global_data={"SNlM0e":"csrf123","FdrFJe":"-42","cfb2h":"boq_build"};</script>';

/** Fake NotebookLM: answers by RPC id and records the requests. */
function fake(handlers) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(url); calls.push({url: u, opts});
    assert.equal(u.hostname, 'notebook.google.com');
    assert.match(opts.headers.Cookie, /SID=abc/);
    if (u.pathname === '/') return new Response(HOME_PAGE, {status: 200});
    if (u.pathname.endsWith('/GenerateFreeFormStreamed')) return new Response(handlers.stream(), {status: 200});
    const id = u.searchParams.get('rpcids');
    const body = new URLSearchParams(opts.body);
    assert.equal(body.get('at'), 'csrf123');
    const [[[rid, params]]] = JSON.parse(body.get('f.req'));
    assert.equal(rid, id);
    return new Response(frame(id, handlers[id](JSON.parse(params), u)), {status: 200});
  };
  return {client: new NotebookLMClient({cookieHeader: async () => 'SID=abc', fetchImpl}), calls};
}
const listResp = [[['My notes', [[1], [2]], NB, null, null, [1]], ['Shared', [], '99999999-2222-3333-4444-555555555555', null, null, [2]]]];

test('envelope and frames follow batchexecute', () => {
  assert.equal(envelope('wXbhsf', [null, 1]), JSON.stringify([[['wXbhsf', '[null,1]', null, 'generic']]]));
  assert.deepEqual(extractRpc(frame('abcde', [1, 2]), 'abcde'), [1, 2]);
  assert.throws(() => extractRpc(")]}'\n" + JSON.stringify([['wrb.fr', 'abcde', null, null, null, [3]]]), 'abcde'), /error 3/);
  assert.throws(() => envelope('bad id!', []), /Invalid/);
});

test('notebook IDs from URL or bare UUID; other hosts refused', () => {
  assert.equal(parseNotebookId('https://notebook.google.com/notebook/' + NB), NB);
  assert.equal(parseNotebookId('https://notebooklm.google.com/notebook/' + NB + '?x=1'), NB);
  assert.equal(parseNotebookId(NB), NB);
  assert.throws(() => parseNotebookId('https://evil.example/notebook/' + NB), /Invalid/);
});

test('list keeps only owned notebooks and sends csrf/session/build', async () => {
  const {client, calls} = fake({wXbhsf: p => { assert.deepEqual(p, [null, 1, null, [2]]); return listResp; }});
  const r = await client.list();
  assert.deepEqual(r.notebooks.map(n => n.title), ['My notes']);
  assert.equal(r.notebooks[0].sourceCount, 2);
  const rpc = calls.find(c => c.url.searchParams.get('rpcids'));
  assert.equal(rpc.url.searchParams.get('f.sid'), '-42');
  assert.equal(rpc.url.searchParams.get('bl'), 'boq_build');
});

test('get maps source status and Drive IDs; refuses a notebook not owned', async () => {
  const {client} = fake({
    wXbhsf: () => listResp,
    rLM1Ne: p => { assert.equal(p[0], NB); return [['My notes', [[['s1'], 'Doc A', [['driveId123'], null, null, null, 1], [null, 2]], [['s2'], 'Page B', [null, null, null, null, 5], [null, 1]]]]]; },
  });
  const r = await client.get(NB);
  assert.equal(r.sourceCount, 2);
  assert.deepEqual(r.sources.map(s => s.status), ['ready', 'processing']);
  assert.equal(r.sources[0].driveDocumentId, 'driveId123');
  await assert.rejects(client.get('99999999-2222-3333-4444-555555555555'), /not found/);
});

test('studio_create only uses READY sources and builds the video payload', async () => {
  let seen;
  const {client} = fake({
    wXbhsf: () => listResp,
    rLM1Ne: () => [['My notes', [[['s1'], 'A', [], [null, 2]], [['s2'], 'B', [], [null, 3]]]]],
    R7cb6c: p => { seen = p; return [['art-1', 'Video']]; },
  });
  const r = await client.studioCreate(NB, {kind: 'video', format: 'explainer', optionA: 4, stylePrompt: 'a fox'});
  assert.equal(r.artifactId, 'art-1');
  const content = seen[2];
  assert.equal(content[2], 3);
  assert.deepEqual(content[3], [[['s1']]]);
  assert.deepEqual(content[8][2], [[['s1']], 'fr', '', null, 1, 4, 'a fox']);
});

test('query returns the final answer, not the thinking', async () => {
  const chunk = (text, final) => JSON.stringify([['wrb.fr', null, JSON.stringify([[text, null, ['conv-9'], null, [final ? 1 : 2]]])]]);
  const {client} = fake({
    wXbhsf: () => listResp,
    rLM1Ne: () => [['My notes', [[['s1'], 'A', [], [null, 2]]]]],
    stream: () => ")]}'\n" + chunk('thinking about it…', false) + '\n' + chunk('The answer is 42.', true) + '\n',
  });
  const r = await client.query(NB, 'Question?');
  assert.equal(r.answer, 'The answer is 42.');
  assert.equal(r.conversationId, 'conv-9');
});

test('expired session is reported as auth_expired', async () => {
  const client = new NotebookLMClient({cookieHeader: async () => 'SID=abc', fetchImpl: async () => new Response('', {status: 302})});
  await assert.rejects(client.list(), e => e.code === 'auth_expired');
});

test('confirmation tokens: bound to the action, not usable immediately, expire', () => {
  const t0 = Date.now() - 20_000;
  const tok = confirmToken('notebook_delete', [NB], t0);
  assert.equal(checkToken('notebook_delete', [NB], tok).ok, true);
  assert.equal(checkToken('notebook_delete', ['other'], tok).ok, false);
  assert.equal(checkToken('studio_delete', [NB], tok).ok, false);
  assert.match(checkToken('notebook_delete', [NB], confirmToken('notebook_delete', [NB])).reason, /too_soon/);
  assert.equal(checkToken('notebook_delete', [NB], confirmToken('notebook_delete', [NB], Date.now() - 16 * 60_000)).reason, 'expired');
});
