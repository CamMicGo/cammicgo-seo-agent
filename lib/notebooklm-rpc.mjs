/**
 * NotebookLM client for the computer (Node 20+), same operations as the Android app (NotebookClient.java).
 *
 * Talks to NotebookLM's private web RPC ("batchexecute") with the Google session of the user's own,
 * dedicated Chrome profile (see lib/local-session.mjs). Cookies stay on this computer: they are only
 * sent to notebook.google.com (NotebookLM). Google can change this private interface without notice.
 *
 * RPC IDs and payload shapes partly ported from jacob-bd/notebooklm-mcp-cli (MIT, Jacob Ben David).
 */
import {randomUUID} from 'node:crypto';

export const HOME = 'https://notebook.google.com/';
const nulls = n => Array(n).fill(null);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL_RE = /^https:\/\/(?:notebooklm|notebook)\.google\.com\/notebook\/([A-Za-z0-9_-]+)/;
const ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
const arr = v => Array.isArray(v) ? v : null;
const str = (v, d = '') => typeof v === 'string' ? v : d;
const num = (v, d = -1) => typeof v === 'number' ? v : d;

export class NotebookLMError extends Error {
  constructor(message, code = 'notebooklm_error') { super(message); this.code = code; }
}
const fail = (m, code) => { throw new NotebookLMError(m, code); };

// ---------- wire format ----------
export function envelope(rpcId, params) {
  if (!/^[A-Za-z0-9]{5,8}$/.test(rpcId)) fail('Invalid NotebookLM RPC identifier');
  return JSON.stringify([[[rpcId, JSON.stringify(params), null, 'generic']]]);
}
export function formBody(rpcId, params, csrf) {
  let body = 'f.req=' + encodeURIComponent(envelope(rpcId, params));
  if (csrf) body += '&at=' + encodeURIComponent(csrf);
  return body + '&';
}
/** Google batchexecute: anti-XSSI prefix then JSON lines (some are length prefixes or diagnostics). */
export function responseFrames(text) {
  if (!text) fail('Empty NotebookLM response');
  const raw = text.startsWith(")]}'") ? text.slice(4) : text;
  const frames = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('[')) continue;
    try { frames.push(JSON.parse(t)); } catch { /* not an RPC frame */ }
  }
  if (!frames.length) fail('No NotebookLM RPC frames');
  return frames;
}
export function extractRpc(text, id) {
  for (const chunk of responseFrames(text)) {
    if (!Array.isArray(chunk)) continue;
    for (const item of chunk) {
      if (!Array.isArray(item) || item[0] !== 'wrb.fr' || item[1] !== id) continue;
      const error = arr(item[5]);
      if (error && error.length) fail('NotebookLM RPC ' + id + ' error ' + error[0], 'rpc_error_' + error[0]);
      const payload = str(item[2]);
      if (!payload) fail('NotebookLM RPC returned no data');
      return JSON.parse(payload);
    }
  }
  fail('NotebookLM RPC ' + id + ' response not found');
}
const pageField = (page, key) => {
  const m = new RegExp('"' + key + '"\\s*:\\s*"([^"]+)"').exec(page);
  return m ? m[1] : '';
};
const consumerHeader = () => [2, null, [1], [1, ...nulls(9), [1, 3]]];
const sourceMetadata = () => [1, ...nulls(9), [1]];

export function parseNotebookId(notebookUrl) {
  const m = URL_RE.exec(String(notebookUrl || '').trim());
  if (m) return m[1];
  // A bare notebook ID (UUID) is accepted too, convenient in the terminal.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(notebookUrl || ''))) return notebookUrl;
  fail('Invalid NotebookLM notebook URL or ID');
}

// ---------- client ----------
export class NotebookLMClient {
  /** @param {{cookieHeader:()=>Promise<string>, fetchImpl?:typeof fetch, language?:string}} opts */
  constructor({cookieHeader, fetchImpl = fetch, language = 'fr'}) {
    this.cookieHeader = cookieHeader; this.fetch = fetchImpl; this.hl = language;
    this.page = null; this.pageAt = 0;
  }

  async request(url, {method = 'GET', body = null, timeoutMs = 25000} = {}) {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.hostname !== 'notebook.google.com') fail('NotebookLM: refused origin');
    const headers = {
      Cookie: await this.cookieHeader(), Accept: '*/*', Origin: 'https://notebook.google.com', Referer: HOME,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    };
    if (body != null) headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
    const res = await this.fetch(url, {method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs)});
    if ([401, 403, 302, 303].includes(res.status))
      fail('NotebookLM: Google session expired or refused (HTTP ' + res.status + '). Run "cammicgo login" again.', 'auth_expired');
    if (res.status < 200 || res.status >= 300) fail('NotebookLM: HTTP ' + res.status);
    const text = await res.text();
    if (text.length > 8_000_000) fail('NotebookLM response too large');
    return text;
  }

  /** CSRF token (SNlM0e), session id and build label from the home page; cached 10 minutes. */
  async tokens(force = false) {
    if (force || !this.page || Date.now() - this.pageAt > 600_000) {
      const page = await this.request(HOME);
      const t = {csrf: pageField(page, 'SNlM0e'), sid: pageField(page, 'FdrFJe'), bl: pageField(page, 'cfb2h')};
      if (!t.csrf) fail('NotebookLM page loaded without RPC token: the Google session is probably signed out. Run "cammicgo login".', 'auth_expired');
      this.page = t; this.pageAt = Date.now();
    }
    return this.page;
  }

  async rpc(id, params, sourcePath = '/', retried = false) {
    const t = await this.tokens();
    let url = HOME + '_/LabsTailwindUi/data/batchexecute?rpcids=' + id + '&source-path=' + encodeURIComponent(sourcePath) + '&hl=' + this.hl + '&rt=c';
    if (t.bl) url += '&bl=' + encodeURIComponent(t.bl);
    if (t.sid) url += '&f.sid=' + encodeURIComponent(t.sid);
    try {
      return extractRpc(await this.request(url, {method: 'POST', body: formBody(id, params, t.csrf)}), id);
    } catch (e) {
      // A stale CSRF token answers 400; refresh it once (reads only: never replay a write that may have landed).
      if (!retried && /HTTP 400/.test(e.message)) { await this.tokens(true); return this.rpc(id, params, sourcePath, true); }
      throw e;
    }
  }

  // ---------- notebooks ----------
  async rawNotebooks() {
    const r = arr(await this.rpc('wXbhsf', [null, 1, null, [2]], '/')) || fail('Unexpected NotebookLM list response');
    return arr(r[0]) || r;
  }
  async list() {
    const notebooks = [];
    for (const nb of await this.rawNotebooks()) {
      if (!Array.isArray(nb) || typeof nb[2] !== 'string') continue;
      const meta = arr(nb[5]);
      if (meta && meta.length && meta[0] !== 1) continue; // 1 = owned, 2 = shared with me
      notebooks.push({id: nb[2], title: str(nb[0], 'Untitled'), url: HOME + 'notebook/' + nb[2], sourceCount: arr(nb[1])?.length ?? null});
    }
    return {notebooks, count: notebooks.length};
  }
  async ownedId(notebookUrl) {
    const id = parseNotebookId(notebookUrl);
    if (!(await this.list()).notebooks.some(n => n.id === id)) fail('Notebook not found in the signed-in account\'s own notebooks', 'not_found');
    return id;
  }
  async create(title) {
    title = String(title || '').trim();
    if (!title || title.length > 160) fail('Invalid title');
    const existing = (await this.list()).notebooks.find(n => n.title === title);
    if (existing) return {notebookCreated: false, alreadyExists: true, ...existing};
    const r = arr(await this.rpc('CCqFvf', [title, null, null, [2], [1, ...nulls(9), [1]]], '/')) || fail('NotebookLM create response invalid');
    const id = str(r[2]) || fail('NotebookLM did not return a notebook ID');
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt) await sleep(1200 * attempt);
      if ((await this.list()).notebooks.some(n => n.id === id)) return {notebookCreated: true, verifiedInList: true, title, id, url: HOME + 'notebook/' + id};
    }
    fail('NotebookLM returned an ID but the notebook is not visible in the list yet: ' + id);
  }
  async get(notebookUrl) {
    const id = await this.ownedId(notebookUrl);
    const title = (await this.list()).notebooks.find(n => n.id === id)?.title ?? null;
    const raw = arr(await this.rpc('rLM1Ne', [id, null, [2], null, 0], '/notebook/' + id)) || fail('Notebook details unavailable');
    const details = arr(raw[0]) || raw;
    const sources = arr(details[1]) || fail('Source list unavailable: do not treat the notebook as empty');
    const out = sources.map(src => {
      if (!Array.isArray(src)) fail('Malformed NotebookLM source; cannot verify completeness');
      const meta = arr(src[2]), state = arr(src[3]);
      const status = state ? num(state[1]) : -1;
      const e = {id: arr(src[0])?.[0] ?? null, title: str(src[1], 'Untitled'), statusCode: status, sourceType: meta ? num(meta[4]) : -1,
        status: status === 1 ? 'processing' : status === 2 ? 'ready' : status === 3 ? 'error_or_audio_completed' : status === 5 ? 'preparing' : 'unknown'};
      const drive = meta && arr(meta[0]);
      if (drive && typeof drive[0] === 'string') e.driveDocumentId = drive[0];
      return e;
    });
    return {id, url: HOME + 'notebook/' + id, title, sourceCount: out.length, sources: out, verified: true};
  }
  async sourceList(notebookUrl) { const nb = await this.get(notebookUrl); return {notebookId: nb.id, sourceCount: nb.sourceCount, sources: nb.sources}; }
  async rename(notebookUrl, title) {
    title = String(title || '').trim();
    if (!title || title.length > 160) fail('Invalid title');
    const id = await this.ownedId(notebookUrl);
    await this.rpc('s0tc2d', [id, [[null, null, null, [null, title]]]], '/notebook/' + id);
    if ((await this.list()).notebooks.some(n => n.id === id && n.title === title)) return {renamed: true, id, title, verified: true};
    fail('Rename was not confirmed by the NotebookLM notebook list');
  }
  async deletionPreview(notebookUrl) {
    const nb = await this.get(notebookUrl);
    return {id: nb.id, title: nb.title, sourceCount: nb.sourceCount, requiresConfirmation: true,
      warning: 'NotebookLM deletes the notebook with its sources, notes and generated artifacts. Original Drive files are kept.'};
  }
  async deleteNotebook(notebookUrl, expectedTitle) {
    const id = await this.ownedId(notebookUrl);
    const actual = (await this.list()).notebooks.find(n => n.id === id)?.title;
    if (!actual || !expectedTitle || expectedTitle.trim() !== actual.trim()) fail('Notebook title changed; deletion refused');
    await this.rpc('WWINqb', [[id], [2]], '/');
    if ((await this.list()).notebooks.some(n => n.id === id)) fail('Notebook deletion not verified');
    return {deleted: true, id, title: actual, verified: true};
  }
  async usage() {
    const raw = arr(await this.rpc('EylDcb', [[2, null, [1], [1, ...nulls(9), [1, 3]]]], '/')) || fail('NotebookLM usage response invalid');
    const windows = (arr(raw[1]) || fail('NotebookLM usage windows unavailable')).filter(w => Array.isArray(w) && w.length >= 8 && (w[4] === 1 || w[4] === 2)).map(w => {
      const e = {window: w[4] === 1 ? 'rolling' : 'weekly'};
      if (typeof w[6] === 'number') e.percentUsed = w[6];
      if (typeof w[7] === 'number') e.percentRemaining = w[7];
      if (typeof arr(w[5])?.[0] === 'number') e.resetsAtEpochSeconds = w[5][0];
      return e;
    });
    if (!windows.length) fail('No usable NotebookLM usage windows');
    let tier = null, tierError;
    try {
      const findTier = (n, d = 0) => d > 12 || n == null ? null : typeof n === 'string' ? (n.startsWith('NOTEBOOKLM_TIER_') ? n : null) : Array.isArray(n) ? n.reduce((a, x) => a || findTier(x, d + 1), null) : null;
      tier = findTier(await this.rpc('ozz5Z', [[[[null, '1', 627], [...nulls(9), [null, null, 2]], 1]]], '/'));
    } catch (e) { tierError = e.message; }
    return {windows, tier, ...(tierError ? {tierError} : {}), source: 'notebooklm-live-rpc', fetchedAt: Date.now()};
  }

  // ---------- sources ----------
  async addUrl(notebookUrl, sourceUrl) {
    const id = await this.ownedId(notebookUrl);
    const s = new URL(sourceUrl);
    if (s.protocol !== 'https:') fail('Source must be HTTPS');
    const host = s.hostname.toLowerCase();
    if (host === 'docs.google.com' || host === 'drive.google.com') fail('Google Drive files must be added with source_add_drive (native Drive import).');
    const youtube = host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
    const data = nulls(11); data[youtube ? 7 : 2] = [sourceUrl]; data[10] = 1;
    const r = arr(await this.rpc('izAoDd', [[data], id, [2], sourceMetadata()], '/notebook/' + id));
    if (!r || !arr(r[0])?.length) fail('Source not confirmed by NotebookLM');
    return {sourceAdded: true, notebookUrl: HOME + 'notebook/' + id, sourceUrl};
  }
  async addStructured(notebookUrl, source, title) {
    const id = await this.ownedId(notebookUrl);
    const before = (await this.get(notebookUrl)).sourceCount;
    try { await this.rpc('izAoDd', [[source], id, [2], sourceMetadata()], '/notebook/' + id); }
    catch (e) { if (!/error (3|9)$/.test(e.message)) throw e; } // 3/9 can mean "accepted, pending"
    const after = (await this.get(notebookUrl)).sourceCount;
    if (after <= before) fail('Source not verified in NotebookLM; it may still be processing. Check source_list before retrying.');
    return {sourceAdded: true, sourceCount: after, title, verified: true};
  }
  async addText(notebookUrl, title, text) {
    if (!String(title || '').trim() || !String(text || '').trim()) fail('Source title and text are required');
    if (text.length > 400000) fail('Text exceeds the 400,000 character limit; split it into parts');
    return this.addStructured(notebookUrl, [null, [title.trim(), text], null, 2, ...nulls(6), 1], title);
  }
  async addDrive(notebookUrl, documentId, title, mimeType) {
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(documentId || '')) fail('Invalid Drive document ID');
    if (!String(title || '').trim()) fail('Missing source title');
    if (!['application/vnd.google-apps.spreadsheet', 'application/vnd.google-apps.document', 'application/vnd.google-apps.presentation', 'application/pdf'].includes(mimeType)) fail('Unsupported Drive MIME type');
    return this.addStructured(notebookUrl, [[documentId, mimeType, 1, title], null, null, null, ...nulls(6), 1], title);
  }
  async requireSource(notebookUrl, sourceId) {
    if (!ID_RE.test(sourceId || '')) fail('Invalid source ID');
    return (await this.sourceList(notebookUrl)).sources.find(s => s.id === sourceId) || fail('Source not found in this notebook', 'not_found');
  }
  async sourceRename(notebookUrl, sourceId, title) {
    const id = await this.ownedId(notebookUrl);
    await this.requireSource(notebookUrl, sourceId);
    title = String(title || '').trim();
    if (!title || title.length > 200) fail('Invalid source title');
    await this.rpc('b7Wfje', [null, [sourceId], [[[title]]]], '/notebook/' + id);
    if ((await this.requireSource(notebookUrl, sourceId)).title !== title) fail('Source rename not yet verified');
    return {sourceId, title, verified: true};
  }
  async sourceSyncDrive(notebookUrl, sourceId) {
    await this.requireSource(notebookUrl, sourceId);
    if (!arr(await this.rpc('FLmJqe', [null, [sourceId], [2]], '/'))) fail('Drive source sync not accepted');
    return {sourceId, syncRequested: true, status: 'pending_verification', checkWith: 'source_list'};
  }
  async sourceDelete(notebookUrl, sourceId, expectedTitle) {
    const src = await this.requireSource(notebookUrl, sourceId);
    if (!expectedTitle || expectedTitle !== src.title) fail('Source title changed; confirm the deletion again');
    await this.rpc('tGMBJ', [[[sourceId]], [2]], '/');
    if ((await this.sourceList(notebookUrl)).sources.some(s => s.id === sourceId)) fail('Source deletion not verified');
    return {sourceId, deleted: true, verified: true};
  }
  async sourceDescribe(notebookUrl, sourceId) {
    await this.requireSource(notebookUrl, sourceId);
    const raw = arr(await this.rpc('tr032e', [[[[sourceId]]]], '/')) || fail('Source guide unavailable');
    const inner = arr(arr(raw[0])?.[0]);
    return {sourceId, summary: str(arr(inner?.[1])?.[0]), keywords: arr(arr(inner?.[2])?.[0]) || []};
  }
  async sourceContent(notebookUrl, sourceId, maxChars = 85000) {
    await this.requireSource(notebookUrl, sourceId);
    const raw = arr(await this.rpc('hizoJc', [[sourceId], [2], [2]], '/')) || fail('Source content unavailable');
    const texts = arr(arr(raw[3])?.[0]) || fail('Source content blocks missing; not treating the source as empty');
    let out = '';
    const walk = a => { for (const p of a) { if (typeof p === 'string' && p) { if (out.length + p.length > maxChars) fail('Source text exceeds ' + maxChars + ' characters; use the CLI export (cammicgo source content --out file)', 'too_large'); out += p + '\n'; } else if (Array.isArray(p)) walk(p); } };
    for (const b of texts) if (Array.isArray(b)) walk(b);
    return {sourceId, title: str(arr(raw[0])?.[1]), content: out, charCount: out.length, truncated: false};
  }
  async sourceSearch(notebookUrl, query, sourceIds, max = 8) {
    const nb = await this.get(notebookUrl);
    const titles = new Map(nb.sources.map(s => [String(s.id).toLowerCase(), s.title]));
    const params = [nb.id, query, null, [1]];
    if (sourceIds?.length) {
      for (const s of sourceIds) if (!titles.has(s.toLowerCase())) fail('Unknown source ID for this notebook');
      params.push([[sourceIds]]);
    }
    const groups = arr(arr(await this.rpc('ASU5Oe', params, '/notebook/' + nb.id))?.[0]) || fail('NotebookLM returned an unrecognized search result');
    const by = new Map();
    for (const g of groups) {
      if (!Array.isArray(g) || g.length !== 2 || typeof g[0] !== 'string') continue;
      const sid = g[0].toLowerCase(); if (!titles.has(sid) || !Array.isArray(g[1])) continue;
      const list = by.get(sid) || []; by.set(sid, list);
      for (const it of g[1]) { const t = arr(arr(arr(it)?.[0])?.[0])?.[0]?.[0]; /* it[0][0][0][0] */ if (typeof t === 'string' && t.trim()) list.push(t); }
    }
    const hits = []; let total = 0; for (const l of by.values()) total += l.length;
    for (let depth = 0; hits.length < max; depth++) {
      let any = false;
      for (const [sid, l] of by) { if (hits.length >= max) break; if (l.length <= depth) continue; any = true; const t = l[depth]; hits.push({sourceId: sid, sourceTitle: titles.get(sid), excerpt: t.slice(0, 900), truncated: t.length > 900}); }
      if (!any) break;
    }
    return {notebookId: nb.id, query, returned: hits.length, available: total, results: hits};
  }
  async sourceListDrive(notebookUrl) {
    const nb = await this.get(notebookUrl); let stale = 0; const sources = [];
    for (const o of nb.sources) {
      const e = {id: o.id, title: o.title, sourceType: o.sourceType, status: o.status, drive: !!o.driveDocumentId};
      if (o.driveDocumentId) {
        e.driveDocumentId = o.driveDocumentId; let fresh = null;
        try { const inner = arr(arr(await this.rpc('yR9Yof', [null, [o.id], [2]], '/'))?.[0]); if (inner && typeof inner[1] === 'boolean') fresh = inner[1]; } catch { /* unknown */ }
        e.fresh = fresh; if (fresh === false) stale++;
      }
      sources.push(e);
    }
    return {notebookId: nb.id, sources, staleDriveSources: stale};
  }

  // ---------- Studio ----------
  async studioSources(notebookUrl, nested, only) {
    const ids = only?.length ? only : (await this.get(notebookUrl)).sources.filter(s => s.status === 'ready' && s.id).map(s => s.id);
    if (!ids.length) fail('No READY NotebookLM sources; check source errors before generating');
    return ids.map(id => nested ? [[id]] : [id]);
  }
  /** kind: audio|video|quiz|flashcards|report|slide_deck|infographic|interactive_report|data_table */
  async studioCreate(notebookUrl, {kind, language = 'fr', focus = '', format = '', optionA = 1, optionB = 2, stylePrompt = '', sourceIds = null}) {
    const id = await this.ownedId(notebookUrl);
    const nested = await this.studioSources(notebookUrl, true, sourceIds), simple = await this.studioSources(notebookUrl, false, sourceIds);
    const lang = language || 'fr', prompt = focus || '';
    let content = [null, null];
    if (kind === 'audio') {
      const fmt = {brief: 2, critique: 3, debate: 4}[format] || 1;
      content.push(1, nested, null, null, [null, [prompt, optionA >= 1 && optionA <= 3 ? optionA : 2, null, simple, lang, null, fmt]]);
    } else if (kind === 'video') {
      const fmt = {brief: 2, cinematic: 3, short: 4}[format] || 1;
      const opts = [simple, fmt === 4 ? null : lang, prompt, null, fmt];
      if (fmt === 4) opts.push(null, null, 1);
      else if (fmt !== 3) { opts.push(optionA >= 1 ? optionA : 1); if (stylePrompt) opts.push(stylePrompt); }
      content.push(3, nested, ...nulls(4), [null, null, opts]);
    } else if (kind === 'quiz' || kind === 'flashcards') {
      const quiz = kind === 'quiz';
      content.push(4, nested, ...nulls(5), [null, [quiz ? 2 : 1, null, prompt || null, ...nulls(quiz ? 4 : 3), [optionA >= 1 ? optionA : 2, optionB >= 1 ? optionB : 2]]]);
    } else if (kind === 'report') {
      const title = {'Study Guide': 'Study Guide', 'Blog Post': 'Blog Post', 'Create Your Own': 'Custom Report'}[format] || 'Briefing Doc';
      content.push(2, nested, null, null, null, [null, [title, title, null, simple, lang, prompt || 'Create a detailed ' + title + ' based on the provided sources.', null, true]]);
    } else if (kind === 'slide_deck') {
      content.push(8, nested, ...nulls(12), [[prompt || null, lang, optionA >= 1 ? optionA : 1, optionB >= 1 ? optionB : 3]]);
    } else if (kind === 'infographic') {
      content.push(7, nested, ...nulls(10), [[prompt || null, lang, null, optionA >= 1 ? optionA : 1, optionB >= 1 ? optionB : 2, 1]]);
    } else if (kind === 'interactive_report') {
      content.push(11, nested, ...nulls(30), [null, [prompt, lang]]);
    } else if (kind === 'data_table') {
      content.push(9, nested, ...nulls(14), [null, [prompt, lang]]);
    } else fail('Unsupported Studio artifact type: ' + kind);
    const config = [2];
    if (kind === 'interactive_report') config.push(null, null, [1, ...nulls(9), [optionA >= 1 ? optionA : 1]], [[1, 4, 8, 10, 14, 2, 3, 6]]);
    const art = arr(arr(await this.rpc('R7cb6c', [config, id, content], '/notebook/' + id))?.[0]);
    if (!art || !str(art[0])) fail('Studio did not return an artifact ID');
    return {artifactId: art[0], kind, notebookId: id, status: 'submitted', verifiedComplete: false};
  }
  async studioStatus(notebookUrl) {
    const id = await this.ownedId(notebookUrl);
    const raw = arr(await this.rpc('gArtLc', [[2], id, 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"'], '/notebook/' + id)) || fail('Studio status unavailable');
    const items = arr(raw[0]) || raw;
    const TYPES = {1: 'audio', 2: 'report', 3: 'video', 4: 'quiz_or_flashcards', 6: 'mind_map', 7: 'infographic', 8: 'slide_deck', 9: 'data_table', 11: 'interactive_report'};
    const artifacts = items.filter(a => Array.isArray(a) && a.length >= 5).map(a => {
      const type = num(a[2]), status = num(a[4]);
      let mediaUrl = null;
      if (type === 1) {
        const options = arr(a[6]);
        for (const c of arr(options?.[5]) || []) { const u = str(arr(c)?.[0]); if (u.startsWith('https://') && c[2] === 'audio/mp4' && (!mediaUrl || u.endsWith('-dv'))) mediaUrl = u; }
        if (!mediaUrl && str(options?.[3]).startsWith('https://')) mediaUrl = options[3];
      } else if (type === 3) { const o = arr(a[8]); if (str(o?.[3]).startsWith('https://')) mediaUrl = o[3]; }
      let label = {1: 'in_progress', 2: 'queued', 3: 'completed', 4: 'failed', 5: 'suggested'}[status] || 'unknown';
      if (type === 1 && status === 2 && mediaUrl) label = 'completed';
      return {id: str(a[0]), title: str(a[1]), type: TYPES[type] || 'type_' + type, typeCode: type, statusCode: status, status: label, ...(mediaUrl ? {mediaUrl} : {})};
    });
    return {notebookId: id, artifacts, count: artifacts.length};
  }
  async studioGet(notebookUrl, artifactId) {
    const id = await this.ownedId(notebookUrl);
    if (!ID_RE.test(artifactId || '')) fail('Invalid artifact ID');
    const config = [2, null, null, [1, ...nulls(9), [1]], [[1, 4, 8, 10, 14, 2, 3, 6, 7]]];
    const a = arr(arr(await this.rpc('v9rmvd', [artifactId, config], '/notebook/' + id))?.[0]);
    if (!a || a[0] !== artifactId) fail('Artifact ID mismatch');
    return {artifactId, notebookId: id, typeCode: num(a[2]), rawArtifact: a, format: 'notebooklm-native-artifact'};
  }
  async studioDelete(notebookUrl, artifactId) {
    const id = await this.ownedId(notebookUrl);
    if (!(await this.studioStatus(notebookUrl)).artifacts.some(a => a.id === artifactId)) fail('Artifact not found in this notebook\'s Studio', 'not_found');
    await this.rpc('V5N4be', [[2], artifactId], '/');
    if ((await this.studioStatus(notebookUrl)).artifacts.some(a => a.id === artifactId)) fail('Studio artifact deletion not verified');
    return {artifactId, deleted: true, verified: true, notebookId: id};
  }
  async studioRevise(notebookUrl, artifactId, instructions) {
    const id = await this.ownedId(notebookUrl);
    const art = arr(arr(await this.rpc('KmcKPe', [[2], artifactId, [instructions]], '/notebook/' + id))?.[0]);
    if (!art || !str(art[0])) fail('Slide revision not accepted');
    return {artifactId: art[0], title: str(art[1]), originalArtifactId: artifactId, notebookId: id, status: 'submitted', verifiedComplete: false};
  }
  async exportArtifact(notebookUrl, artifactId, title = 'NotebookLM Export', type = 'docs') {
    const id = await this.ownedId(notebookUrl);
    const code = type === 'sheets' ? 2 : 1;
    const raw = arr(await this.rpc('Krh3pd', [null, artifactId, null, title, code], '/notebook/' + id));
    const first = raw?.[0]; const inner = Array.isArray(first) ? first[0] : first;
    const url = Array.isArray(inner) ? inner[0] : inner;
    if (typeof url !== 'string' || !url.startsWith('https://')) fail('Export not confirmed by NotebookLM');
    return {exported: true, url, type: code === 2 ? 'sheets' : 'docs', title};
  }
  async mindMapCreate(notebookUrl, title = 'Mind Map') {
    const id = await this.ownedId(notebookUrl);
    const nested = await this.studioSources(notebookUrl, true), simple = await this.studioSources(notebookUrl, false);
    const gen = arr(arr(await this.rpc('yyryJe', [nested, ...nulls(4), ['interactive_mindmap', [['[CONTEXT]', '']], ''], null, [2, null, [1]]], '/notebook/' + id))?.[0]);
    if (!gen || typeof gen[0] !== 'string') fail('No mind map JSON returned');
    if (gen[0].length > 1_000_000) fail('Mind map exceeds safety limit');
    const item = arr(arr(await this.rpc('CYK0Xb', [id, gen[0], [2, null, null, 5, simple], null, String(title || '').trim() || 'Mind Map'], '/notebook/' + id))?.[0]);
    if (!item || !str(item[0])) fail('Mind map ID missing after save');
    return {mindMapId: item[0], title: str(item[4], title), notebookId: id, saved: true};
  }
  async artifactLink(notebookUrl, artifactId) {
    const a = (await this.studioStatus(notebookUrl)).artifacts.find(x => x.id === artifactId) || fail('Artifact not found in this notebook\'s Studio', 'not_found');
    if (a.status !== 'completed') fail('Artifact is not completed yet');
    if (!a.mediaUrl) fail('This artifact has no downloadable media (audio and video only)');
    return {artifactId, downloadUrl: a.mediaUrl, typeCode: a.typeCode, title: a.title};
  }
  /** Downloads a completed audio/video to bytes (Google hosts only, ≤ 500 MB). */
  async artifactDownload(notebookUrl, artifactId) {
    const link = await this.artifactLink(notebookUrl, artifactId);
    let current = new URL(link.downloadUrl);
    for (let i = 0; i < 5; i++) {
      const host = current.hostname.toLowerCase();
      const trusted = ['notebook.google.com', 'notebooklm.google.com', 'googleusercontent.com', 'googlevideo.com'].some(h => host === h || host.endsWith('.' + h)) || host.endsWith('.ggpht.com');
      if (current.protocol !== 'https:' || !trusted) fail('Refusing untrusted media host ' + host);
      const headers = {Accept: '*/*', Cookie: await this.cookieHeader()};
      const res = await this.fetch(current, {headers, redirect: 'manual', signal: AbortSignal.timeout(300000)});
      if ([301, 302, 303, 307, 308].includes(res.status)) { const loc = res.headers.get('location') || fail('Media redirect without location'); current = new URL(loc, current); continue; }
      if (res.status !== 200) fail('Media download HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 500_000_000) fail('Media larger than 500 MB');
      return {...link, mime: link.typeCode === 1 ? 'audio/mp4' : 'video/mp4', bytes: buf};
    }
    fail('Too many media redirects');
  }

  // ---------- chat ----------
  async query(notebookUrl, question, {conversationId = null, sourceIds = null} = {}) {
    const id = await this.ownedId(notebookUrl);
    question = String(question || '');
    if (!question.trim() || question.length > 10000) fail('Question required (max 10,000 characters)');
    const srcs = await this.studioSources(notebookUrl, true, sourceIds);
    const t = await this.tokens();
    let convId = conversationId || randomUUID();
    const params = [srcs, question, null, [2, null, [1]], convId];
    let url = HOME + '_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed?hl=' + this.hl + '&rt=c&_reqid=' + (100000 + Math.floor(Math.random() * 800000));
    if (t.bl) url += '&bl=' + encodeURIComponent(t.bl);
    if (t.sid) url += '&f.sid=' + encodeURIComponent(t.sid);
    const body = 'f.req=' + encodeURIComponent(JSON.stringify([null, JSON.stringify(params)])) + '&at=' + encodeURIComponent(t.csrf) + '&';
    const stream = await this.request(url, {method: 'POST', body, timeoutMs: 180000});
    let answer = '', thinking = '';
    for (const line of stream.replace(")]}'", '').split(/\r?\n/)) {
      if (!line.trim().startsWith('[')) continue;
      let frames; try { frames = JSON.parse(line); } catch { continue; }
      for (const f of frames) {
        if (!Array.isArray(f) || f[0] !== 'wrb.fr') continue;
        if (f[2] == null && arr(f[5])?.length) fail('NotebookLM refused the question (code ' + f[5][0] + ')');
        let parsed; try { parsed = JSON.parse(str(f[2])); } catch { continue; }
        const first = arr(parsed?.[0]); if (!first) continue;
        const text = str(first[0]), type = arr(first[4]);
        const actual = !!type && type[type.length - 1] === 1;
        if (actual && text.length > answer.length) answer = text; else if (!actual && text.length > thinking.length) thinking = text;
        if (str(arr(first[2])?.[0])) convId = first[2][0];
      }
    }
    if (!answer) fail('NotebookLM returned no final answer');
    return {answer, conversationId: convId, notebookId: id, sourceCount: srcs.length};
  }
  async describe(notebookUrl) {
    const id = await this.ownedId(notebookUrl);
    const r = arr(await this.rpc('VfAZjd', [id, [2]], '/notebook/' + id));
    const topics = (arr(arr(r?.[1])?.[0]) || []).filter(t => Array.isArray(t) && t.length >= 2).map(t => ({question: str(t[0]), prompt: str(t[1])}));
    return {notebookId: id, summary: str(arr(r?.[0])?.[0]), suggestedTopics: topics};
  }
  async chatConfigure(notebookUrl, goal = 'default', customPrompt = '', length = 'default') {
    const id = await this.ownedId(notebookUrl);
    const g = {custom: 2, learning_guide: 3}[goal] || 1, l = {longer: 4, shorter: 5}[length] || 1;
    const goalSetting = [g];
    if (g === 2) { if (!customPrompt) fail('customPrompt required for goal=custom'); goalSetting.push(customPrompt); }
    if ((await this.rpc('s0tc2d', [id, [[...nulls(7), [goalSetting, [l]]]]], '/notebook/' + id)) == null) fail('Chat settings not confirmed');
    return {notebookId: id, goal, responseLength: length, configured: true};
  }
  async conversationId(id) {
    const l1 = arr(arr(await this.rpc('hPTbtc', [[], null, id, 20], '/notebook/' + id))?.[0]);
    const l2 = l1?.[0];
    return typeof l2 === 'string' ? l2 : typeof arr(l2)?.[0] === 'string' ? l2[0] : null;
  }
  async chatGet(notebookUrl, limit = 20) {
    const id = await this.ownedId(notebookUrl);
    const conv = await this.conversationId(id);
    const turns = [];
    if (conv) {
      const list = arr(arr(await this.rpc('khqZz', [consumerHeader(), null, null, conv, Math.max(1, Math.min(100, limit))], '/notebook/' + id))?.[0]) || [];
      const pairs = []; let answer = null;
      for (const e of list) {
        if (!Array.isArray(e) || e.length < 3) continue;
        if (e[2] === 2) answer = str(arr(arr(e[4])?.[0])?.[0]);
        else if (e[2] === 1 && answer != null) { pairs.push([str(e[3]), answer]); answer = null; }
      }
      pairs.reverse().forEach(([q, a], i) => turns.push({turn: i + 1, question: q, answer: a}));
    }
    return {notebookId: id, conversationId: conv, turnCount: turns.length, turns};
  }
  async chatDelete(notebookUrl) {
    const id = await this.ownedId(notebookUrl);
    const conv = await this.conversationId(id);
    if (!conv) return {notebookId: id, deleted: false, reason: 'no chat history'};
    if ((await this.rpc('J7Gthc', [consumerHeader(), conv, null, 1], '/notebook/' + id)) == null) fail('Deletion not confirmed by NotebookLM');
    return {notebookId: id, conversationId: conv, deleted: true};
  }

  // ---------- notes ----------
  async notes(id) {
    const items = arr(arr(await this.rpc('cFji9', [id], '/notebook/' + id))?.[0]) || [];
    return items.filter(i => Array.isArray(i) && i[2] !== 2 && arr(i[1])?.length >= 5).map(i => ({id: str(i[0]), title: str(i[1][4]), content: str(i[1][1])}))
      .filter(n => !(n.content.trim().startsWith('{') && n.content.includes('"nodes"'))); // mind maps
  }
  async note(notebookUrl, {action, noteId = '', title = '', content}) {
    const id = await this.ownedId(notebookUrl);
    if (action === 'list') return {notebookId: id, notes: await this.notes(id)};
    if (action === 'create') {
      title = title || 'New Note';
      const newId = str(arr(arr(await this.rpc('CYK0Xb', [id, '', [1], null, title], '/notebook/' + id))?.[0])?.[0]) || fail('New note ID missing');
      if (content) await this.rpc('cYAfTb', [id, newId, [[[content, title, [], 0]]]], '/notebook/' + id);
      return {id: newId, title, created: true};
    }
    const existing = (await this.notes(id)).find(n => n.id === noteId) || fail('Note not found', 'not_found');
    if (action === 'update') {
      await this.rpc('cYAfTb', [id, noteId, [[[content ?? existing.content, title || existing.title, [], 0]]]], '/notebook/' + id);
      return {id: noteId, updated: true};
    }
    if (action === 'delete') { await this.rpc('AH0mwd', [id, null, [noteId]], '/notebook/' + id); return {id: noteId, title: existing.title, deleted: true}; }
    fail('Unsupported note action');
  }

  // ---------- sharing ----------
  async shareStatus(notebookUrl) {
    const id = await this.ownedId(notebookUrl);
    const raw = arr(await this.rpc('JFMDGd', [id, [2]], '/')) || fail('Sharing status unavailable');
    return {notebookId: id, shareData: raw};
  }
  async sharePublic(notebookUrl, makePublic) {
    const id = await this.ownedId(notebookUrl);
    if ((await this.rpc('QDyure', [[[id, null, [makePublic ? 1 : 0], [0, '']]], 1, null, [2]], '/')) == null) fail('NotebookLM did not confirm the sharing change');
    return {notebookId: id, requestedPublic: makePublic, shareUrl: makePublic ? HOME + 'notebook/' + id : null, operationAccepted: true};
  }
  async shareInvite(notebookUrl, email, role) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) fail('Invalid collaborator email');
    if (role !== 'viewer' && role !== 'editor') fail('Invalid role');
    const id = await this.ownedId(notebookUrl);
    if ((await this.rpc('QDyure', [[[id, [[email, null, role === 'editor' ? 2 : 3]], null, [0, '']]], 1, null, [2]], '/')) == null) fail('NotebookLM did not confirm the invitation');
    return {notebookId: id, email, role, operationAccepted: true};
  }

  // ---------- research ----------
  async researchStart(notebookUrl, query, source = 'web', mode = 'fast') {
    const id = await this.ownedId(notebookUrl);
    if (!String(query || '').trim() || query.length > 3000) fail('Research query required, max 3000 characters');
    if (mode === 'deep' && source === 'drive') fail('Deep research is web only');
    const code = source === 'web' ? 1 : 2;
    const [rpcId, params] = mode === 'fast' ? ['Ljjv0c', [[query, code], null, 1, id]] : ['QA9ei', [null, [1], [query, code], 5, id]];
    const r = arr(await this.rpc(rpcId, params, '/notebook/' + id));
    if (!str(r?.[0])) fail('Research task ID missing');
    return {taskId: r[0], reportId: str(r[1]), notebookId: id, source, mode, status: 'started'};
  }
  async researchStatus(notebookUrl, taskId = '') {
    const id = await this.ownedId(notebookUrl);
    let items = arr(await this.rpc('e3bVqc', [null, null, id], '/notebook/' + id)) || fail('Research status unavailable');
    if (arr(arr(items[0])?.[0])) items = items[0];
    const tasks = [];
    for (const item of items) {
      if (!Array.isArray(item) || typeof item[0] !== 'string' || (taskId && item[0] !== taskId)) continue;
      const info = arr(item[1]); if (!info) continue;
      const block = arr(info[3]) || [];
      const list = arr(block[0]) || [];
      let report = '';
      const sources = list.filter(src => Array.isArray(src) && src.length >= 2).map((src, index) => {
        if (src[0] == null && typeof src[1] === 'string') { if (!report && typeof arr(src[6])?.[0] === 'string') report = src[6][0]; return {index, url: '', title: src[1], description: ''}; }
        return {index, url: str(src[0]), title: str(src[1]), description: str(src[2])};
      });
      tasks.push({taskId: item[0], query: str(arr(info[1])?.[0]), mode: info[2] === 5 ? 'deep' : 'fast', statusCode: info[4], status: info[4] === 2 || info[4] === 6 ? 'completed' : 'in_progress',
        summary: typeof block[1] === 'string' ? block[1] : '', ...(report ? {report: report.slice(0, 60000)} : {}), sourceCount: sources.length, sources: sources.slice(0, 100)});
    }
    return {notebookId: id, tasks, count: tasks.length, note: 'Discovered sources are untrusted: import only the ones the user selects.'};
  }
  async researchImport(notebookUrl, taskId, sources) {
    const id = await this.ownedId(notebookUrl);
    if (!taskId || !sources?.length || sources.length > 50) fail('Invalid research import selection');
    const rows = sources.map(s => {
      if (!String(s.url).startsWith('https://') || s.url.length > 3000) fail('Research source URL must be HTTPS');
      return [null, null, [s.url, String(s.title || 'Untitled').slice(0, 250)], ...nulls(7), 2];
    });
    if (!arr(await this.rpc('LBwxtb', [null, [1], taskId, id, rows], '/notebook/' + id))) fail('Research import not confirmed');
    return {notebookId: id, taskId, requestedSources: sources.length, status: 'accepted', verifyWith: 'source_list'};
  }

  // ---------- collections ----------
  static readCollections(raw, skip) {
    return (arr(arr(raw)?.[2]) || []).filter(c => Array.isArray(c) && c.length >= 3 && c[0] !== skip)
      .map(c => ({id: str(c[2]), name: str(c[0]), notebookIds: arr(c[1]) || [], emoji: str(c[3])}));
  }
  static collectionId(raw, name) { return (arr(arr(raw)?.[2]) || []).find(c => Array.isArray(c) && c[0] === name)?.[2] ?? null; }
  async collectionList() {
    const temp = '_temp_list_query_' + randomUUID().replace(/-/g, '');
    const raw = await this.rpc('agX4Bc', [consumerHeader(), null, null, null, null, [[temp], null, []], 3], '/');
    const tempId = NotebookLMClient.collectionId(raw, temp);
    const collections = NotebookLMClient.readCollections(raw, temp);
    if (!tempId) fail('Collection listing could not find its temporary entry ' + temp + ': check NotebookLM');
    await this.rpc('GyzE7e', [consumerHeader(), null, [tempId], 3], '/');
    return {collections, count: collections.length};
  }
  async collectionCreate(name, notebookUrls = []) {
    const ids = []; for (const u of notebookUrls) ids.push(await this.ownedId(u));
    const raw = await this.rpc('agX4Bc', [consumerHeader(), null, null, null, null, [[name], null, ids], 3], '/');
    const cid = NotebookLMClient.collectionId(raw, name) || fail('Collection creation not confirmed');
    return {id: cid, name, notebookIds: ids, created: true};
  }
  async collectionEdit(collectionId, {name, add = [], remove = [], emoji}) {
    const done = [], edit = p => this.rpc('le8sX', [consumerHeader(), null, collectionId, p, 3], '/');
    if (name) { await edit([[[name]]]); done.push('renamed'); }
    if (add.length) { const ids = []; for (const u of add) ids.push(await this.ownedId(u)); await edit([[null, null, null, [ids]], []]); done.push('added ' + ids.length); }
    if (remove.length) { const ids = []; for (const u of remove) ids.push(await this.ownedId(u)); await edit([[null, null, null, null, [ids]], []]); done.push('removed ' + ids.length); }
    if (emoji !== undefined) { await edit([[[null, emoji]]]); done.push('emoji'); }
    return {id: collectionId, changes: done};
  }
  async collectionDelete(collectionId) {
    await this.rpc('GyzE7e', [consumerHeader(), null, [collectionId], 3], '/');
    return {id: collectionId, deleted: true, notebooksKept: true};
  }
}

export const VIDEO_STYLES = ['auto_select', 'custom', 'classic', 'whiteboard', 'kawaii', 'anime', 'watercolor', 'retro_print', 'heritage', 'paper_craft'];
