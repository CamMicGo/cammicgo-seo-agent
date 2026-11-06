/**
 * NotebookLM tools of the LOCAL CamMicGo MCP (computer), with the same names and arguments as the
 * remote server (https://seo.cammicgo.com/api/mcp) — but executed here, directly, without the phone.
 *
 * Destructive or sharing actions always take two steps: confirm=false returns a preview and a
 * confirmationToken (bound to the exact action, valid 15 min, usable after 10 s); the assistant acts
 * only after the user's explicit yes in a NEW message (confirm=true + the token).
 */
import {createHmac, timingSafeEqual} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {NotebookLMClient, VIDEO_STYLES, HOME} from './notebooklm-rpc.mjs';
import * as session from './local-session.mjs';

// ---------- client with automatic session refresh ----------
let shared;
export function notebook() {
  if (shared) return shared;
  const client = new NotebookLMClient({cookieHeader: async () => session.cookieHeader('notebooklm', HOME), language: process.env.CAMMICGO_LANG || 'fr'});
  // Retry once after a headless refresh when Google's short-lived cookies have aged out.
  shared = new Proxy(client, {get(target, prop) {
    const v = target[prop];
    if (typeof v !== 'function' || prop === 'constructor' || prop === 'request' || prop === 'rpc' || prop === 'tokens') return v;
    return async (...args) => {
      try { return await v.apply(target, args); }
      catch (e) {
        if (e.code !== 'auth_expired' || Date.now() - (target.refreshedAt || 0) < 600_000) throw e;
        target.refreshedAt = Date.now(); target.page = null;
        await session.refresh('notebooklm');
        return v.apply(target, args);
      }
    };
  }});
  return shared;
}

// ---------- confirmation tokens ----------
const keyFile = join(session.DIR, 'token.key');
const tokenKey = () => { mkdirSync(session.DIR, {recursive: true, mode: 0o700}); if (!existsSync(keyFile)) writeFileSync(keyFile, (globalThis.crypto.getRandomValues(Buffer.alloc(32))), {mode: 0o600, flag: 'wx'}); return readFileSync(keyFile); };
export function confirmToken(action, ids, now = Date.now()) {
  const t = String(now);
  return t + '.' + createHmac('sha256', tokenKey()).update(action + '|' + ids.join('\n') + '|' + t).digest('base64url').slice(0, 32);
}
export function checkToken(action, ids, token, now = Date.now()) {
  const [t, sig] = String(token || '').split('.');
  const at = Number(t);
  if (!at || !sig) return {ok: false, reason: 'missing'};
  if (now - at < 10_000) return {ok: false, reason: 'too_soon: show the preview to the user and wait for their explicit yes'};
  if (now - at > 15 * 60_000) return {ok: false, reason: 'expired'};
  const want = Buffer.from(confirmToken(action, ids, at).split('.')[1]), got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? {ok: true} : {ok: false, reason: 'does not match this exact action'};
}

// ---------- downloads ----------
export const EXPORT_DIR = process.env.CAMMICGO_EXPORT_DIR || join(homedir(), 'CamMicGo', 'NotebookLM');
const safeName = s => String(s || 'untitled').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'untitled';
export async function downloadArtifact(notebookUrl, artifactId, {dir, skipExisting = false} = {}) {
  const nb = notebook();
  const title = (await nb.list()).notebooks.find(n => notebookUrl.includes(n.id))?.title || 'notebook';
  const folder = dir || join(EXPORT_DIR, safeName(title));
  const art = (await nb.studioStatus(notebookUrl)).artifacts.find(a => a.id === artifactId);
  const file = join(folder, safeName(art?.title || artifactId) + ' [' + artifactId.slice(0, 8) + ']' + (art?.typeCode === 1 ? '.m4a' : '.mp4'));
  if (skipExisting && existsSync(file)) return {artifactId, path: file, skipped: true};
  const media = await nb.artifactDownload(notebookUrl, artifactId);
  mkdirSync(folder, {recursive: true});
  writeFileSync(file, media.bytes);
  return {artifactId, title: media.title, path: file, bytes: media.bytes.length, mime: media.mime};
}

// ---------- MCP registration ----------
const text = v => ({content: [{type: 'text', text: JSON.stringify(v, null, 2)}]});
const run = fn => async a => { try { return text({status: 'done', ...(await fn(a))}); } catch (e) { return text({status: 'error', error: e.code || 'error', message: e.message}); } };
const ro = {readOnlyHint: true, openWorldHint: true}, rw = {readOnlyHint: false, destructiveHint: false, openWorldHint: true}, dz = {readOnlyHint: false, destructiveHint: true, openWorldHint: true};

/** Two-step tool body: preview (with token) then action. */
const twoStep = (action, idsOf, preview, act) => run(async a => {
  const ids = idsOf(a);
  if (!a.confirm) return {status: 'preview', ...(await preview(a)), confirmationToken: confirmToken(action, ids), next: 'Show this to the user. Act only after their explicit yes in a NEW message: call again with confirm=true and this confirmationToken.'};
  const c = checkToken(action, ids, a.confirmationToken);
  if (!c.ok) return {status: 'confirmation_required', reason: c.reason};
  return act(a);
});

export function registerNotebookTools(server, z) {
  const nb = () => notebook();
  const url = z.string().min(8).describe('Notebook URL (https://notebook.google.com/notebook/…) or notebook ID');
  const id = z.string().min(8).max(128);
  const confirm = {confirm: z.boolean().default(false), confirmationToken: z.string().max(80).optional()};
  const reg = (name, title, description, shape, annotations, handler) => server.registerTool(name, {title, description, inputSchema: z.object(shape), annotations}, handler);

  // notebooks
  reg('notebook_list', 'List NotebookLM notebooks', 'List the notebooks owned by the signed-in Google account (local session).', {}, ro, run(() => nb().list()));
  reg('notebook_get', 'Inspect a NotebookLM notebook and its sources', 'Notebook title and its real sources with processing status. Never assume a notebook is empty from its title.', {notebookUrl: url}, ro, run(a => nb().get(a.notebookUrl)));
  reg('notebook_create', 'Create a NotebookLM notebook', 'Create a notebook (returns the existing one if the title already exists).', {title: z.string().trim().min(1).max(160)}, rw, run(a => nb().create(a.title)));
  reg('notebook_rename', 'Rename a NotebookLM notebook', 'Rename and verify in the notebook list.', {notebookUrl: url, title: z.string().trim().min(1).max(160)}, rw, run(a => nb().rename(a.notebookUrl, a.title)));
  reg('notebook_describe', 'NotebookLM summary and suggested topics', 'AI summary of the notebook and its suggested questions.', {notebookUrl: url}, ro, run(a => nb().describe(a.notebookUrl)));
  reg('notebook_delete_preview', 'Preview a NotebookLM deletion', 'Exact title and number of sources, before asking the user. Does not delete.', {notebookUrl: url}, ro, run(a => nb().deletionPreview(a.notebookUrl)));
  reg('notebook_delete', 'Delete a NotebookLM notebook (confirmation required)', 'DESTRUCTIVE: deletes the notebook with its sources, notes and artifacts (original Drive files are kept). Two steps: confirm=false returns the preview and a confirmationToken; delete only after an explicit yes in a NEW message.',
    {notebookUrl: url, ...confirm}, dz, twoStep('notebook_delete', a => [a.notebookUrl], a => nb().deletionPreview(a.notebookUrl),
      async a => nb().deleteNotebook(a.notebookUrl, (await nb().deletionPreview(a.notebookUrl)).title)));
  reg('usage_get', 'NotebookLM usage and quotas', 'Rolling and weekly usage windows, reset times and plan tier of the signed-in account.', {}, ro, run(() => nb().usage()));

  // sources
  reg('source_list', 'List NotebookLM sources and their status', 'Sources with status (processing, ready, error, preparing) to diagnose failed sources.', {notebookUrl: url}, ro, run(a => nb().sourceList(a.notebookUrl)));
  reg('source_add', 'Add a website or YouTube source', 'Add a public web page or YouTube video URL to a notebook. Google Drive files: use source_add_drive.', {notebookUrl: url, sourceUrl: z.string().url()}, rw, run(a => nb().addUrl(a.notebookUrl, a.sourceUrl)));
  reg('source_add_text', 'Add pasted text or Markdown', 'Add a text source (up to 400,000 characters; split longer texts).', {notebookUrl: url, title: z.string().min(1).max(200), text: z.string().min(1).max(400000)}, rw, run(a => nb().addText(a.notebookUrl, a.title, a.text)));
  reg('source_add_drive', 'Add a Google Drive file natively', 'Import a Google Doc, Sheet, Slides or PDF by its Drive file ID (the signed-in account must have access).',
    {notebookUrl: url, documentId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/), title: z.string().min(1).max(200), mimeType: z.enum(['application/vnd.google-apps.spreadsheet', 'application/vnd.google-apps.document', 'application/vnd.google-apps.presentation', 'application/pdf'])},
    rw, run(a => nb().addDrive(a.notebookUrl, a.documentId, a.title, a.mimeType)));
  reg('source_describe', 'Source summary and keywords', 'NotebookLM\'s AI source guide and keyword chips.', {notebookUrl: url, sourceId: id}, ro, run(a => nb().sourceDescribe(a.notebookUrl, a.sourceId)));
  reg('source_get_content', 'Read a source\'s indexed text', 'Raw indexed text of a source (up to 85,000 characters; refuses silent truncation).', {notebookUrl: url, sourceId: id}, ro, run(a => nb().sourceContent(a.notebookUrl, a.sourceId)));
  reg('source_search', 'Search passages in sources', 'Passages of the notebook\'s sources matching a query (excerpts, no AI rewriting).', {notebookUrl: url, query: z.string().min(2).max(500), sourceIds: z.array(id).max(300).optional(), maxResults: z.number().int().min(1).max(25).default(8)}, ro, run(a => nb().sourceSearch(a.notebookUrl, a.query, a.sourceIds, a.maxResults)));
  reg('source_list_drive', 'Sources and Drive freshness', 'Sources with type and, for Drive sources, whether they are up to date.', {notebookUrl: url}, ro, run(a => nb().sourceListDrive(a.notebookUrl)));
  reg('source_sync_drive', 'Refresh a Drive source', 'Ask NotebookLM to re-sync a Google Drive source; check source_list afterwards.', {notebookUrl: url, sourceId: id}, rw, run(a => nb().sourceSyncDrive(a.notebookUrl, a.sourceId)));
  reg('source_rename', 'Rename a source', 'Rename a source and verify it.', {notebookUrl: url, sourceId: id, title: z.string().min(1).max(200)}, rw, run(a => nb().sourceRename(a.notebookUrl, a.sourceId, a.title)));
  reg('source_delete', 'Delete a source (confirmation required)', 'Permanently removes the NotebookLM copy of a source. Two steps with confirmationToken.', {notebookUrl: url, sourceId: id, ...confirm}, dz,
    twoStep('source_delete', a => [a.notebookUrl, a.sourceId], a => nb().requireSource(a.notebookUrl, a.sourceId).then(s => ({source: s})),
      async a => nb().sourceDelete(a.notebookUrl, a.sourceId, (await nb().requireSource(a.notebookUrl, a.sourceId)).title)));

  // Studio
  reg('studio_create', 'Generate audio, video, quiz, report, slides, infographic or table',
    'Start NotebookLM Studio generation from READY sources (consumes the account\'s quota). Video: videoFormat explainer|brief|cinematic|short, visualStyle (' + VIDEO_STYLES.join(', ') + ') or stylePrompt. sourceIds limits the sources. Poll studio_status.',
    {notebookUrl: url, kind: z.enum(['audio', 'video', 'quiz', 'flashcards', 'report', 'slide_deck', 'infographic', 'data_table', 'interactive_report']), language: z.string().min(2).max(12).default('fr'), focus: z.string().max(5000).default(''),
      format: z.string().max(60).default('').describe('audio: deep_dive|brief|critique|debate; report: Briefing Doc|Study Guide|Blog Post|Create Your Own'),
      videoFormat: z.enum(['explainer', 'brief', 'cinematic', 'short']).optional(), visualStyle: z.enum(VIDEO_STYLES).optional(), stylePrompt: z.string().max(2000).optional(),
      sourceIds: z.array(id).max(300).optional(), optionA: z.number().int().min(1).max(10).default(1), optionB: z.number().int().min(1).max(10).default(2)},
    rw, run(a => {
      const style = a.stylePrompt ? 'custom' : a.visualStyle;
      return nb().studioCreate(a.notebookUrl, {kind: a.kind, language: a.language, focus: a.focus, format: a.kind === 'video' && a.videoFormat ? a.videoFormat : a.format,
        optionA: a.kind === 'video' && style ? VIDEO_STYLES.indexOf(style) + 1 : a.optionA, optionB: a.optionB, stylePrompt: a.kind === 'video' ? a.stylePrompt || '' : '', sourceIds: a.sourceIds});
    }));
  reg('studio_status', 'Studio artifacts and their status', 'Artifacts of the notebook (id, type, status, media link when ready).', {notebookUrl: url}, ro, run(a => nb().studioStatus(a.notebookUrl)));
  reg('studio_get', 'Studio artifact content', 'Native content of a completed artifact (quiz, flashcards, report…).', {notebookUrl: url, artifactId: id}, ro, run(a => nb().studioGet(a.notebookUrl, a.artifactId)));
  reg('studio_revise', 'Revise slides of a deck', 'Creates a NEW slide deck with per-slide instructions (the original stays).', {notebookUrl: url, artifactId: id, slides: z.array(z.object({slide: z.number().int().min(1).max(200), instruction: z.string().min(3).max(2000)})).min(1).max(50)}, rw,
    run(a => nb().studioRevise(a.notebookUrl, a.artifactId, a.slides.map(x => [x.slide - 1, x.instruction]))));
  reg('studio_delete', 'Delete a Studio artifact (confirmation required)', 'Permanently deletes a Studio artifact. Two steps with confirmationToken.', {notebookUrl: url, artifactId: id, ...confirm}, dz,
    twoStep('studio_delete', a => [a.notebookUrl, a.artifactId], async a => ({artifact: (await nb().studioStatus(a.notebookUrl)).artifacts.find(x => x.id === a.artifactId) || null}), a => nb().studioDelete(a.notebookUrl, a.artifactId)));
  reg('export_artifact', 'Export a report or table to Google Docs / Sheets', 'Exports a completed report (Docs) or data table (Sheets) to the user\'s Drive.', {notebookUrl: url, artifactId: id, title: z.string().min(1).max(200).default('NotebookLM Export'), exportType: z.enum(['docs', 'sheets']).default('docs')}, rw,
    run(a => nb().exportArtifact(a.notebookUrl, a.artifactId, a.title, a.exportType)));
  reg('mindmap_create', 'Generate a mind map', 'Generate a NotebookLM mind map from ready sources and save it in the notebook.', {notebookUrl: url, title: z.string().min(1).max(160).default('Mind Map')}, rw, run(a => nb().mindMapCreate(a.notebookUrl, a.title)));
  reg('download_artifact_link', 'Audio/video media link', 'Signed media URL of a completed audio or video (may expire).', {notebookUrl: url, artifactId: id}, ro, run(a => nb().artifactLink(a.notebookUrl, a.artifactId)));
  reg('download_artifact', 'Download an audio or video to this computer', 'Saves a completed audio (.m4a) or video (.mp4) into ' + EXPORT_DIR + '/<notebook>/ and returns the file path.', {notebookUrl: url, artifactId: id}, rw, run(a => downloadArtifact(a.notebookUrl, a.artifactId)));
  reg('download_all_artifacts', 'Download every completed audio/video', 'Downloads all completed audio and video artifacts of one notebook (or of every notebook) into one folder per notebook. skipExisting for incremental runs; one failure does not stop the rest.',
    {notebookUrl: url.optional(), allNotebooks: z.boolean().default(false), skipExisting: z.boolean().default(true)}, rw, run(async a => {
      if (!a.notebookUrl && !a.allNotebooks) throw new Error('Give notebookUrl, or allNotebooks=true');
      const targets = a.allNotebooks ? (await nb().list()).notebooks.map(n => n.url) : [a.notebookUrl];
      const files = [], errors = [];
      for (const t of targets) {
        let arts = [];
        try { arts = (await nb().studioStatus(t)).artifacts.filter(x => x.status === 'completed' && x.mediaUrl); } catch (e) { errors.push({notebookUrl: t, error: e.message}); continue; }
        for (const x of arts) { try { files.push(await downloadArtifact(t, x.id, {skipExisting: a.skipExisting})); } catch (e) { errors.push({notebookUrl: t, artifactId: x.id, error: e.message}); } }
      }
      return {folder: EXPORT_DIR, downloaded: files.filter(f => !f.skipped).length, skipped: files.filter(f => f.skipped).length, files, errors};
    }));

  // chat
  reg('notebook_query', 'Ask NotebookLM a question', 'Answer grounded in the notebook\'s ready sources. Pass conversationId to continue the same conversation.', {notebookUrl: url, question: z.string().min(1).max(10000), conversationId: z.string().max(80).optional(), sourceIds: z.array(id).max(300).optional()}, ro,
    run(a => nb().query(a.notebookUrl, a.question, {conversationId: a.conversationId, sourceIds: a.sourceIds})));
  reg('cross_notebook_query', 'Ask several notebooks the same question', 'Asks up to 5 notebooks and returns each answer (cite the notebook of each point).', {notebookUrls: z.array(url).min(2).max(5), question: z.string().min(3).max(4000)}, ro, run(async a => {
    const answers = await Promise.all(a.notebookUrls.map(u => nb().query(u, a.question).then(r => ({notebookUrl: u, answer: r.answer}), e => ({notebookUrl: u, error: e.message}))));
    return {question: a.question, answers};
  }));
  reg('chat_configure', 'Configure NotebookLM chat', 'Goal default|learning_guide|custom (with customPrompt) and response length default|longer|shorter.', {notebookUrl: url, goal: z.enum(['default', 'learning_guide', 'custom']).default('default'), customPrompt: z.string().max(10000).default(''), responseLength: z.enum(['default', 'longer', 'shorter']).default('default')}, rw,
    run(a => nb().chatConfigure(a.notebookUrl, a.goal, a.customPrompt, a.responseLength)));
  reg('chat_get', 'Read the chat history', 'Questions and answers stored by NotebookLM, oldest first.', {notebookUrl: url, limit: z.number().int().min(1).max(100).default(20)}, ro, run(a => nb().chatGet(a.notebookUrl, a.limit)));
  reg('chat_list', 'Chat sessions', 'NotebookLM keeps one conversation per notebook: its ID and number of exchanges.', {notebookUrl: url}, ro, run(async a => {
    const r = await nb().chatGet(a.notebookUrl, 100); return {notebookId: r.notebookId, sessions: r.conversationId ? [{conversationId: r.conversationId, exchanges: r.turnCount}] : []};
  }));
  reg('chat_export', 'Export the chat as Markdown or JSON', 'Returns the chat history as Markdown or JSON.', {notebookUrl: url, format: z.enum(['markdown', 'json']).default('markdown'), limit: z.number().int().min(1).max(100).default(100)}, ro, run(async a => {
    const r = await nb().chatGet(a.notebookUrl, a.limit);
    return a.format === 'json' ? {turns: r.turns} : {markdown: '# NotebookLM chat\n\n' + r.turns.map(t => '## ' + t.turn + '. ' + t.question + '\n\n' + t.answer).join('\n\n')};
  }));
  reg('chat_save_to_note', 'Save the chat to a note', 'Saves the chat (or one exchange) as a new note in the notebook.', {notebookUrl: url, turn: z.number().int().min(1).optional(), title: z.string().min(1).max(200).default('Chat NotebookLM')}, rw, run(async a => {
    const turns = (await nb().chatGet(a.notebookUrl, 100)).turns.filter(t => !a.turn || t.turn === a.turn);
    if (!turns.length) throw new Error(a.turn ? 'This exchange does not exist.' : 'This notebook has no chat history.');
    return nb().note(a.notebookUrl, {action: 'create', title: a.title, content: turns.map(t => 'Q: ' + t.question + '\n\n' + t.answer).join('\n\n---\n\n').slice(0, 75000)});
  }));
  reg('chat_delete', 'Delete the chat history (confirmation required)', 'PERMANENTLY deletes the notebook\'s chat history. Two steps with confirmationToken.', {notebookUrl: url, ...confirm}, dz,
    twoStep('chat_delete', a => [a.notebookUrl], async a => ({exchanges: (await nb().chatGet(a.notebookUrl, 100)).turnCount}), a => nb().chatDelete(a.notebookUrl)));

  // notes
  reg('note', 'Manage notes', 'List, create, update or delete notes. Delete takes two steps with confirmationToken.', {notebookUrl: url, action: z.enum(['list', 'create', 'update', 'delete']), noteId: z.string().default(''), title: z.string().max(200).default(''), content: z.string().max(75000).optional(), ...confirm}, rw, async a => {
    if (a.action !== 'delete') return run(x => nb().note(x.notebookUrl, x))(a);
    return twoStep('note_delete', x => [x.notebookUrl, x.noteId], async x => ({note: (await nb().note(x.notebookUrl, {action: 'list'})).notes.find(n => n.id === x.noteId) || null}), x => nb().note(x.notebookUrl, x))(a);
  });

  // sharing
  reg('notebook_share_status', 'Sharing settings', 'Raw sharing data of the notebook (no change).', {notebookUrl: url}, ro, run(a => nb().shareStatus(a.notebookUrl)));
  reg('notebook_share_public', 'Turn the public link on or off (confirmation required)', 'Changes visibility. Two steps with confirmationToken.', {notebookUrl: url, makePublic: z.boolean(), ...confirm}, dz,
    twoStep('share_public', a => [a.notebookUrl, String(a.makePublic)], async a => ({notebookUrl: a.notebookUrl, makePublic: a.makePublic}), a => nb().sharePublic(a.notebookUrl, a.makePublic)));
  reg('notebook_share_invite', 'Invite a collaborator (confirmation required)', 'Invite one viewer or editor. Two steps with confirmationToken.', {notebookUrl: url, email: z.string().email(), role: z.enum(['viewer', 'editor']).default('viewer'), ...confirm}, dz,
    twoStep('share_invite', a => [a.notebookUrl, a.email.toLowerCase(), a.role], async a => ({notebookUrl: a.notebookUrl, email: a.email, role: a.role}), a => nb().shareInvite(a.notebookUrl, a.email, a.role)));
  reg('notebook_share_batch', 'Invite several collaborators (confirmation required)', 'Invite up to 20 people. Two steps: the exact list is bound to the token.', {notebookUrl: url, invites: z.array(z.object({email: z.string().email(), role: z.enum(['viewer', 'editor']).default('viewer')})).min(1).max(20), ...confirm}, dz,
    twoStep('share_batch', a => [a.notebookUrl, ...a.invites.map(i => i.email.toLowerCase() + '/' + i.role).sort()], async a => ({notebookUrl: a.notebookUrl, invites: a.invites}), async a => {
      const results = []; for (const i of a.invites) results.push(await nb().shareInvite(a.notebookUrl, i.email, i.role).catch(e => ({email: i.email, error: e.message}))); return {results};
    }));

  // research
  reg('research_start', 'Start web or Drive research', 'Fast or deep NotebookLM research (deep = web only). Poll research_status.', {notebookUrl: url, query: z.string().min(1).max(3000), source: z.enum(['web', 'drive']).default('web'), mode: z.enum(['fast', 'deep']).default('fast')}, rw, run(a => nb().researchStart(a.notebookUrl, a.query, a.source, a.mode)));
  reg('research_status', 'Research progress and results', 'Status, summary and discovered sources (untrusted: import only those the user selects).', {notebookUrl: url, taskId: z.string().default('')}, ro, run(a => nb().researchStatus(a.notebookUrl, a.taskId)));
  reg('research_import', 'Import selected research sources', 'Imports only the HTTPS sources the user approved.', {notebookUrl: url, taskId: z.string().min(1), sources: z.array(z.object({url: z.string().url(), title: z.string().max(250).default('Untitled')})).min(1).max(50)}, rw, run(a => nb().researchImport(a.notebookUrl, a.taskId, a.sources)));

  // collections
  reg('collection_list', 'List collections', 'NotebookLM collections (groups of notebooks). Reading uses a temporary hidden collection that is deleted right away.', {}, ro, run(() => nb().collectionList()));
  reg('collection_create', 'Create a collection', 'Create a collection grouping notebooks.', {name: z.string().min(1).max(100), notebookUrls: z.array(url).max(100).default([])}, rw, run(a => nb().collectionCreate(a.name, a.notebookUrls)));
  reg('collection_edit', 'Edit a collection', 'Rename, add or remove notebooks (never deleted), or set the emoji.', {collectionId: z.string().min(5).max(100), name: z.string().max(100).optional(), addNotebookUrls: z.array(url).max(100).optional(), removeNotebookUrls: z.array(url).max(100).optional(), emoji: z.string().max(16).optional()}, rw,
    run(a => nb().collectionEdit(a.collectionId, {name: a.name, add: a.addNotebookUrls || [], remove: a.removeNotebookUrls || [], emoji: a.emoji})));
  reg('collection_delete', 'Delete a collection (confirmation required)', 'Deletes the collection only; its notebooks are kept. Two steps with confirmationToken.', {collectionId: z.string().min(5).max(100), ...confirm}, dz,
    twoStep('collection_delete', a => [a.collectionId], async a => ({collectionId: a.collectionId, notebooksKept: true}), a => nb().collectionDelete(a.collectionId)));

  // YouTube → NotebookLM
  reg('youtube_transcript_to_notebook', 'Add a YouTube transcript to a notebook', 'Fetches the video\'s captions from this computer and adds them as a text source (useful when NotebookLM cannot read the video itself, or to keep timestamps).',
    {notebookUrl: url, video: z.string().min(11).max(250), language: z.string().regex(/^(original|[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?)$/).default('original')}, rw, run(async a => {
      const {fetchYouTubeCaptions} = await import('./youtube-captions.mjs');
      const r = await fetchYouTubeCaptions(a.video, a.language);
      const mmss = s => { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
      const body = '# ' + (r.title || r.videoId) + '\n\nhttps://www.youtube.com/watch?v=' + r.videoId + (r.channelName ? '\nChannel: ' + r.channelName : '') + '\nLanguage: ' + r.languageName + '\n\n' + r.segments.map(x => '[' + mmss(Number(x.start)) + '] ' + x.text).join('\n');
      return {...(await nb().addText(a.notebookUrl, String(r.title || r.videoId).slice(0, 190), body.slice(0, 400000))), videoId: r.videoId, language: r.language, lines: r.segments.length};
    }));

  // session
  reg('notebooklm_session', 'NotebookLM session on this computer', 'Whether this computer is signed in to NotebookLM. To sign in, the user runs "cammicgo login" in a terminal (never ask for passwords or cookies).', {}, ro, run(async () => session.status('notebooklm')));
}
