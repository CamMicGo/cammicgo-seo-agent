#!/usr/bin/env node
/**
 * cammicgo — CamMicGo on your computer: NotebookLM, YouTube transcripts and your Google data,
 * from the terminal or from any AI tool through the local MCP server (VS Code, Claude, Cursor…).
 * Everything runs on this computer with your own sessions; nothing goes through CamMicGo servers.
 *
 *   cammicgo login                 sign in to NotebookLM in a dedicated Chrome window (once)
 *   cammicgo setup vscode          add the MCP server to VS Code (also: claude, claude-code, cursor, gemini, all)
 *   cammicgo notebook list         …and everything else: cammicgo help
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync} from 'node:fs';
import {homedir, platform} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {spawnSync} from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const VERSION = '0.1.0';
const argv = process.argv.slice(2);

// ---------- tiny argument parser ----------
const flags = {}, pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); if (v !== undefined) flags[k] = v; else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[k] = argv[++i]; else flags[k] = true; }
  else pos.push(a);
}
const JSON_OUT = !!flags.json;
const c = process.stdout.isTTY && !JSON_OUT ? {b: s => '\x1b[1m' + s + '\x1b[0m', d: s => '\x1b[2m' + s + '\x1b[0m', g: s => '\x1b[32m' + s + '\x1b[0m', r: s => '\x1b[31m' + s + '\x1b[0m', y: s => '\x1b[33m' + s + '\x1b[0m', c: s => '\x1b[36m' + s + '\x1b[0m'} : {b: s => s, d: s => s, g: s => s, r: s => s, y: s => s, c: s => s};
const out = (v, human) => { if (JSON_OUT || !human) console.log(JSON.stringify(v, null, 2)); else human(v); };
const die = (m, code = 1) => { console.error(c.r('✗ ') + m); process.exit(code); };
const need = (v, usage) => v ?? die('Usage: cammicgo ' + usage);
async function ask(q) { const rl = createInterface({input: process.stdin, output: process.stdout}); try { return (await rl.question(q)).trim(); } finally { rl.close(); } }
const table = (rows, cols) => {
  if (!rows.length) return console.log(c.d('  (none)'));
  const w = cols.map(([k, h]) => Math.min(60, Math.max(h.length, ...rows.map(r => String(r[k] ?? '').length))));
  console.log('  ' + cols.map(([, h], i) => c.b(h.padEnd(w[i]))).join('  '));
  for (const r of rows) console.log('  ' + cols.map(([k], i) => { const s = String(r[k] ?? ''); return (s.length > w[i] ? s.slice(0, w[i] - 1) + '…' : s).padEnd(w[i]); }).join('  '));
};

const lazy = {};
const nbtools = async () => lazy.t ??= await import('../lib/local-notebooklm-tools.mjs');
const session = async () => lazy.s ??= await import('../lib/local-session.mjs');
const nb = async () => (await nbtools()).notebook();

/** Notebook argument: URL, ID, or (part of) the title. */
async function notebookRef(ref) {
  need(ref, '… <notebook URL, ID or title>');
  if (/^https:\/\//.test(ref) || /^[0-9a-f-]{36}$/i.test(ref)) return ref;
  const {notebooks} = await (await nb()).list();
  const exact = notebooks.filter(n => n.title.toLowerCase() === ref.toLowerCase());
  const part = exact.length ? exact : notebooks.filter(n => n.title.toLowerCase().includes(ref.toLowerCase()));
  if (part.length === 1) return part[0].url;
  if (!part.length) die('No notebook matches "' + ref + '". See: cammicgo notebook list');
  die('Several notebooks match "' + ref + '":\n' + part.map(n => '  ' + n.title + '  ' + c.d(n.id)).join('\n') + '\nUse the ID.');
}

// ---------- MCP client setup ----------
function clientConfigs() {
  const h = homedir(), p = platform(), appData = process.env.APPDATA || join(h, 'AppData', 'Roaming');
  const userDir = app => p === 'win32' ? join(appData, app, 'User') : p === 'darwin' ? join(h, 'Library', 'Application Support', app, 'User') : join(h, '.config', app, 'User');
  return {
    vscode: {name: 'VS Code', file: join(userDir('Code'), 'mcp.json'), key: 'servers', extra: {type: 'stdio'}},
    'vscode-insiders': {name: 'VS Code Insiders', file: join(userDir('Code - Insiders'), 'mcp.json'), key: 'servers', extra: {type: 'stdio'}},
    claude: {name: 'Claude Desktop', file: p === 'win32' ? join(appData, 'Claude', 'claude_desktop_config.json') : p === 'darwin' ? join(h, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json') : join(h, '.config', 'Claude', 'claude_desktop_config.json'), key: 'mcpServers'},
    cursor: {name: 'Cursor', file: join(h, '.cursor', 'mcp.json'), key: 'mcpServers'},
    windsurf: {name: 'Windsurf', file: join(h, '.codeium', 'windsurf', 'mcp_config.json'), key: 'mcpServers'},
    gemini: {name: 'Gemini CLI', file: join(h, '.gemini', 'settings.json'), key: 'mcpServers'},
  };
}
const serverEntry = () => ({command: process.execPath, args: [join(HERE, 'cammicgo.mjs'), 'mcp']});

function setupOne(id) {
  if (id === 'claude-code') {
    const e = serverEntry();
    const r = spawnSync('claude', ['mcp', 'add', '--scope', 'user', 'cammicgo', '--', e.command, ...e.args], {stdio: 'inherit', shell: platform() === 'win32'});
    if (r.status === 0) return console.log(c.g('✓ ') + 'Claude Code: server "cammicgo" added (user scope).');
    return console.log(c.y('! ') + 'Claude Code CLI not found. Run this yourself:\n  claude mcp add --scope user cammicgo -- "' + e.command + '" "' + e.args.join('" "') + '"');
  }
  const cfg = clientConfigs()[id] || die('Unknown client "' + id + '". Choose: vscode, claude, claude-code, cursor, windsurf, gemini, all');
  let data = {};
  if (existsSync(cfg.file)) {
    try { data = JSON.parse(readFileSync(cfg.file, 'utf8') || '{}'); }
    catch { return console.log(c.y('! ') + cfg.name + ': ' + cfg.file + ' is not plain JSON (comments?). Add this entry by hand under "' + cfg.key + '":\n' + JSON.stringify({cammicgo: {...cfg.extra, ...serverEntry()}}, null, 2)); }
    copyFileSync(cfg.file, cfg.file + '.bak');
  } else if (id !== 'vscode' && !existsSync(dirname(cfg.file))) {
    return console.log(c.d('- ' + cfg.name + ' not installed (no ' + dirname(cfg.file) + '), skipped.'));
  }
  data[cfg.key] = {...(data[cfg.key] || {}), cammicgo: {...cfg.extra, ...serverEntry()}};
  mkdirSync(dirname(cfg.file), {recursive: true});
  writeFileSync(cfg.file, JSON.stringify(data, null, 2) + '\n');
  console.log(c.g('✓ ') + cfg.name + ': ' + cfg.file + (id === 'claude' ? c.d('  (quit and reopen Claude Desktop)') : id.startsWith('vscode') ? c.d('  (Copilot Chat → Agent mode → tools: "cammicgo")') : ''));
}

// ---------- commands ----------
const HELP = `${c.b('cammicgo ' + VERSION)} — NotebookLM, YouTube and your Google data, from the terminal or any AI tool.

${c.b('Start')}
  cammicgo login                      Sign in to NotebookLM (dedicated Chrome window, once)
  cammicgo setup <client>             Add the MCP server: vscode | claude | claude-code | cursor | windsurf | gemini | all
  cammicgo doctor                     Check Node, Chrome, sessions
  cammicgo mcp                        Run the MCP server (stdio) — what AI tools launch

${c.b('Notebooks')}  (a notebook = its URL, ID or title)
  cammicgo notebook list | get <nb> | create "<title>" | rename <nb> "<title>" | describe <nb> | delete <nb>
  cammicgo ask <nb> "<question>"      Ask NotebookLM (grounded answer)
  cammicgo usage                      Remaining quota (rolling and weekly)

${c.b('Sources')}
  cammicgo source list <nb>
  cammicgo source add <nb> <url>      Web page or YouTube video
  cammicgo source add-text <nb> "<title>" <file.md|->
  cammicgo source content <nb> <sourceId> [--out file.txt]
  cammicgo source search <nb> "<query>"
  cammicgo source delete <nb> <sourceId>

${c.b('Studio')}
  cammicgo studio create <nb> <audio|video|quiz|flashcards|report|slide_deck|infographic|data_table|mindmap> [--focus "…"] [--lang fr] [--format …] [--style whiteboard]
  cammicgo studio status <nb>
  cammicgo download <nb> [artifactId] | download --all-notebooks   Audio/video into ~/CamMicGo/NotebookLM

${c.b('Chat, notes, research')}
  cammicgo chat get <nb> | chat export <nb> [--out chat.md]
  cammicgo note list <nb> | note add <nb> "<title>" <file.md|->
  cammicgo research start <nb> "<query>" [--deep] | research status <nb>

${c.b('YouTube')}
  cammicgo yt transcript <url> [--lang fr] [--out file.txt]
  cammicgo yt to-notebook <url> <nb>  Add the transcript as a text source

Add --json to any command for raw JSON. Sessions and keys stay in ~/.cammicgo-seo-agent.`;

async function main() {
  const [cmd, sub, ...rest] = pos;
  const T = await nbtools().catch(() => null);
  switch (cmd) {
    case undefined: case 'help': case '-h': return console.log(HELP);
    case 'version': case '-v': return console.log(VERSION);

    case 'mcp': { process.argv = [process.argv[0], join(ROOT, 'scripts', 'local-mcp.mjs'), 'stdio']; await import(pathToFileURL(join(ROOT, 'scripts', 'local-mcp.mjs')).href); return; }

    case 'login': {
      const site = sub || 'notebooklm';
      if (site !== 'notebooklm') die('Only NotebookLM for now (LinkedIn arrives in the next version).');
      const s = await session();
      const r = await s.login(site, {log: m => console.log(c.c('→ ') + m)});
      console.log(c.g('✓ ') + 'Signed in. Session saved encrypted in ' + s.DIR + ' (' + r.cookieCount + ' cookies).');
      try { const {count} = await (await nb()).list(); console.log(c.g('✓ ') + 'NotebookLM answers: ' + count + ' notebook(s).'); } catch (e) { console.log(c.y('! ') + 'Signed in, but NotebookLM did not answer yet: ' + e.message); }
      return;
    }
    case 'logout': { const s = await session(); s.logout(sub || 'notebooklm'); return console.log(c.g('✓ ') + 'Session deleted (the Chrome profile stays; delete ' + s.PROFILE + ' to remove it too).'); }
    case 'refresh': { const s = await session(); out(await s.refresh(sub || 'notebooklm'), () => console.log(c.g('✓ ') + 'Session refreshed.')); return; }
    case 'status': case 'doctor': {
      const s = await session();
      const major = Number(process.versions.node.split('.')[0]);
      console.log((major >= 22 ? c.g('✓') : c.r('✗')) + ' Node.js ' + process.versions.node + (major >= 22 ? '' : '  (22 or newer required)'));
      const chrome = s.findBrowser();
      console.log((chrome ? c.g('✓') : c.r('✗')) + ' Browser: ' + (chrome || 'Chrome / Chromium / Edge not found (set CAMMICGO_CHROME)'));
      const st = s.status('notebooklm');
      console.log((st.signedIn ? c.g('✓') : c.y('!')) + ' NotebookLM session: ' + (st.signedIn ? 'saved ' + st.savedAt : 'not signed in → cammicgo login'));
      if (st.signedIn && cmd === 'doctor') { try { const u = await (await nb()).list(); console.log(c.g('✓') + ' NotebookLM reachable: ' + u.count + ' notebook(s)'); } catch (e) { console.log(c.r('✗') + ' NotebookLM: ' + e.message); } }
      for (const [id, cfg] of Object.entries(clientConfigs())) { let on = false; try { on = !!JSON.parse(readFileSync(cfg.file, 'utf8'))[cfg.key]?.cammicgo; } catch { /* absent */ } console.log((on ? c.g('✓') : c.d('-')) + ' ' + cfg.name + (on ? ' configured' : c.d(' not configured → cammicgo setup ' + id))); }
      return;
    }
    case 'setup': {
      const target = need(sub, 'setup <vscode|claude|claude-code|cursor|windsurf|gemini|all>');
      if (target === 'all') { for (const id of ['vscode', 'claude', 'cursor', 'windsurf', 'gemini']) setupOne(id); setupOne('claude-code'); }
      else setupOne(target);
      const s = await session();
      if (!s.status('notebooklm').signedIn) console.log(c.c('→ ') + 'Next: cammicgo login');
      return;
    }

    case 'notebook': case 'nb': {
      const n = await nb();
      if (sub === 'list' || !sub) return out(await n.list(), r => { console.log(c.b(r.count + ' notebook(s)')); table(r.notebooks, [['title', 'Title'], ['sourceCount', 'Sources'], ['id', 'ID']]); });
      if (sub === 'get') return out(await n.get(await notebookRef(rest[0])), r => { console.log(c.b(r.title) + '  ' + c.d(r.url)); table(r.sources, [['title', 'Source'], ['status', 'Status'], ['id', 'ID']]); });
      if (sub === 'create') return out(await n.create(need(rest[0], 'notebook create "<title>"')), r => console.log((r.notebookCreated ? c.g('✓ Created ') : c.y('= Already exists ')) + r.title + '  ' + c.d(r.url)));
      if (sub === 'rename') return out(await n.rename(await notebookRef(rest[0]), need(rest[1], 'notebook rename <nb> "<title>"')), r => console.log(c.g('✓ ') + 'Renamed to ' + r.title));
      if (sub === 'describe') return out(await n.describe(await notebookRef(rest[0])), r => { console.log(r.summary); for (const t of r.suggestedTopics) console.log(c.c('• ') + t.question); });
      if (sub === 'delete') {
        const ref = await notebookRef(rest[0]); const p = await n.deletionPreview(ref);
        console.log(c.y('This deletes "' + p.title + '" with its ' + p.sourceCount + ' source(s), notes and Studio artifacts (Drive files are kept).'));
        if (!flags.yes && (await ask('Type the notebook title to confirm: ')) !== p.title) die('Not deleted.');
        return out(await n.deleteNotebook(ref, p.title), () => console.log(c.g('✓ ') + 'Deleted.'));
      }
      return die('Unknown: notebook ' + sub + '. See cammicgo help');
    }
    case 'ask': {
      const ref = await notebookRef(sub); const q = need(rest.join(' ') || null, 'ask <nb> "<question>"');
      return out(await (await nb()).query(ref, q, {conversationId: flags.conversation}), r => { console.log(r.answer); console.log(c.d('\nconversation: ' + r.conversationId + '  (continue with --conversation)')); });
    }
    case 'usage': return out(await (await nb()).usage(), r => { console.log(c.b('Plan: ') + (r.tier || 'unknown')); for (const w of r.windows) console.log('  ' + w.window.padEnd(8) + ' ' + (w.percentUsed ?? '?') + '% used' + (w.resetsAtEpochSeconds ? c.d('  resets ' + new Date(w.resetsAtEpochSeconds * 1000).toLocaleString()) : '')); });

    case 'source': case 'src': {
      const n = await nb(); const ref = await notebookRef(rest[0]);
      if (sub === 'list') return out(await n.sourceList(ref), r => table(r.sources, [['title', 'Source'], ['status', 'Status'], ['id', 'ID']]));
      if (sub === 'add') return out(await n.addUrl(ref, need(rest[1], 'source add <nb> <url>')), () => console.log(c.g('✓ ') + 'Source added.'));
      if (sub === 'add-text') { const title = need(rest[1], 'source add-text <nb> "<title>" <file|->'); const f = need(rest[2], 'source add-text <nb> "<title>" <file|->'); const body = f === '-' ? readFileSync(0, 'utf8') : readFileSync(f, 'utf8'); return out(await n.addText(ref, title, body), r => console.log(c.g('✓ ') + 'Added (' + r.sourceCount + ' sources now).')); }
      if (sub === 'content') { const r = await n.sourceContent(ref, need(rest[1], 'source content <nb> <sourceId>'), flags.out ? 50_000_000 : 85000); if (flags.out) { writeFileSync(flags.out, r.content); return console.log(c.g('✓ ') + r.charCount + ' characters → ' + flags.out); } return out(r, x => console.log(x.content)); }
      if (sub === 'describe') return out(await n.sourceDescribe(ref, need(rest[1], 'source describe <nb> <sourceId>')), r => { console.log(r.summary); console.log(c.d(r.keywords.join(' · '))); });
      if (sub === 'search') return out(await n.sourceSearch(ref, need(rest.slice(1).join(' ') || null, 'source search <nb> "<query>"'), null, Number(flags.max || 8)), r => { for (const h of r.results) console.log(c.c('▸ ' + h.sourceTitle) + '\n  ' + h.excerpt.replace(/\s+/g, ' ') + '\n'); });
      if (sub === 'delete') {
        const sid = need(rest[1], 'source delete <nb> <sourceId>'); const s = await n.requireSource(ref, sid);
        if (!flags.yes && (await ask('Delete source "' + s.title + '"? Type yes: ')).toLowerCase() !== 'yes') die('Not deleted.');
        return out(await n.sourceDelete(ref, sid, s.title), () => console.log(c.g('✓ ') + 'Deleted.'));
      }
      return die('Unknown: source ' + sub);
    }
    case 'studio': {
      const n = await nb(); const ref = await notebookRef(rest[0]);
      if (sub === 'status') return out(await n.studioStatus(ref), r => table(r.artifacts, [['title', 'Artifact'], ['type', 'Type'], ['status', 'Status'], ['id', 'ID']]));
      if (sub === 'create') {
        const kind = need(rest[1], 'studio create <nb> <kind>');
        if (kind === 'mindmap') return out(await n.mindMapCreate(ref, flags.title || 'Mind Map'), r => console.log(c.g('✓ ') + 'Mind map saved: ' + r.title));
        const {VIDEO_STYLES} = await import('../lib/notebooklm-rpc.mjs');
        const style = flags.style ? VIDEO_STYLES.indexOf(flags.style) + 1 : 0;
        if (flags.style && !style) die('--style: ' + VIDEO_STYLES.join(', '));
        const r = await n.studioCreate(ref, {kind, language: flags.lang || 'fr', focus: flags.focus || '', format: flags.format || '', optionA: style || Number(flags.a || 1), optionB: Number(flags.b || 2), stylePrompt: flags['style-prompt'] || ''});
        return out(r, x => console.log(c.g('✓ ') + kind + ' started (' + x.artifactId + '). Follow it with: cammicgo studio status "' + rest[0] + '"'));
      }
      return die('Unknown: studio ' + sub);
    }
    case 'download': {
      if (flags['all-notebooks'] || !pos[2]) {
        const n = await nb(); const targets = flags['all-notebooks'] ? (await n.list()).notebooks.map(x => x.url) : [await notebookRef(sub)];
        let done = 0;
        for (const t of targets) for (const a of (await n.studioStatus(t)).artifacts.filter(x => x.status === 'completed' && x.mediaUrl)) {
          try { const r = await T.downloadArtifact(t, a.id, {skipExisting: true}); console.log((r.skipped ? c.d('= ') : c.g('✓ ')) + r.path); done++; } catch (e) { console.log(c.r('✗ ') + a.title + ': ' + e.message); }
        }
        return console.log(c.b(done + ' file(s) in ' + T.EXPORT_DIR));
      }
      return out(await T.downloadArtifact(await notebookRef(sub), pos[2]), r => console.log(c.g('✓ ') + r.path));
    }
    case 'chat': {
      const n = await nb(); const ref = await notebookRef(rest[0]);
      const r = await n.chatGet(ref, 100);
      const md = '# NotebookLM chat\n\n' + r.turns.map(t => '## ' + t.turn + '. ' + t.question + '\n\n' + t.answer).join('\n\n');
      if (sub === 'export' && flags.out) { writeFileSync(flags.out, md); return console.log(c.g('✓ ') + r.turnCount + ' exchange(s) → ' + flags.out); }
      return out(r, () => console.log(md));
    }
    case 'note': {
      const n = await nb(); const ref = await notebookRef(rest[0]);
      if (sub === 'list') return out(await n.note(ref, {action: 'list'}), r => table(r.notes, [['title', 'Note'], ['id', 'ID']]));
      if (sub === 'add') { const f = need(rest[2], 'note add <nb> "<title>" <file|->'); return out(await n.note(ref, {action: 'create', title: rest[1], content: f === '-' ? readFileSync(0, 'utf8') : readFileSync(f, 'utf8')}), () => console.log(c.g('✓ ') + 'Note created.')); }
      return die('Unknown: note ' + sub);
    }
    case 'research': {
      const n = await nb(); const ref = await notebookRef(rest[0]);
      if (sub === 'start') return out(await n.researchStart(ref, need(rest.slice(1).join(' ') || null, 'research start <nb> "<query>"'), flags.drive ? 'drive' : 'web', flags.deep ? 'deep' : 'fast'), r => console.log(c.g('✓ ') + 'Research started (' + r.taskId + '). Follow it with: cammicgo research status "' + rest[0] + '"'));
      if (sub === 'status') return out(await n.researchStatus(ref, flags.task || ''), r => { for (const t of r.tasks) { console.log(c.b(t.query) + '  ' + t.status + ' · ' + t.sourceCount + ' source(s)'); table(t.sources.slice(0, 30), [['title', 'Title'], ['url', 'URL']]); } });
      return die('Unknown: research ' + sub);
    }
    case 'collection': return out(await (await nb()).collectionList(), r => table(r.collections.map(x => ({...x, n: x.notebookIds.length})), [['name', 'Collection'], ['n', 'Notebooks'], ['id', 'ID']]));

    case 'yt': case 'youtube': {
      const {fetchYouTubeCaptions} = await import('../lib/youtube-captions.mjs');
      const video = need(rest[0], 'yt ' + (sub || 'transcript') + ' <url>');
      const r = await fetchYouTubeCaptions(video, flags.lang || 'original');
      const mmss = s => { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
      const txt = r.segments.map(s => '[' + mmss(Number(s.start)) + '] ' + s.text).join('\n');
      if (sub === 'transcript') {
        if (flags.out) { writeFileSync(flags.out, txt); return console.log(c.g('✓ ') + r.segments.length + ' lines (' + r.language + ') → ' + flags.out); }
        return out(r, () => { console.log(c.b(r.title || r.videoId) + c.d('  ' + r.languageName)); console.log(txt); });
      }
      if (sub === 'to-notebook') {
        const ref = await notebookRef(rest[1]);
        const body = '# ' + (r.title || r.videoId) + '\n\nhttps://www.youtube.com/watch?v=' + r.videoId + (r.channelName ? '\nChannel: ' + r.channelName : '') + '\nLanguage: ' + r.languageName + '\n\n' + txt;
        return out(await (await nb()).addText(ref, (r.title || r.videoId).slice(0, 190), body), () => console.log(c.g('✓ ') + 'Transcript added to the notebook.'));
      }
      return die('Unknown: yt ' + sub);
    }
    default: die('Unknown command "' + cmd + '". See: cammicgo help');
  }
}

main().catch(e => die(e.message + (e.code === 'auth_missing' || e.code === 'auth_expired' ? '\n  → cammicgo login' : '')));
