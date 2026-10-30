#!/usr/bin/env node
/**
 * CamMicGo SEO MCP — desktop relay (Windows, macOS, Linux).
 *
 * The desktop equivalent of the Android app: once paired with the remote MCP
 * (https://seo.cammicgo.com/api/mcp), this computer fetches the YouTube transcripts your
 * AI assistant asks for, from your own internet connection (YouTube blocks cloud servers),
 * and sends them back. A small local page (http://127.0.0.1:47821) lets you pair, start or
 * stop the relay and test a video.
 *
 *   npm run relay                    start and open the local page
 *   npm run relay -- --pair ABCD-2345   pair from the terminal
 *   npm run relay -- --headless      no browser (servers, autostart)
 *
 * Not needed with the LOCAL MCP server: it fetches transcripts by itself.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir, hostname, platform } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fetchYouTubeCaptions, listCaptionTracks, parseVideoId } from '../lib/youtube-captions.mjs';
import { page } from './ui.mjs';

export const VERSION = '1.0.0';
const BASE = process.env.CAMMICGO_RELAY_BASE || 'https://seo.cammicgo.com';
const PORT = Number(process.env.CAMMICGO_RELAY_PORT || 47821);
const args = process.argv.slice(2);
const flag = n => args.includes('--' + n);
const opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };

// ---------- settings (token stored with user-only permissions) ----------
const dir = join(homedir(), '.cammicgo-seo-mcp');
const file = join(dir, 'relay.json');
function load() { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return {}; } }
let cfg = load();
function save() {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(file, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  try { chmodSync(file, 0o600); } catch { /* Windows */ }
}
const osName = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[platform()] || platform();
const defaultName = () => (hostname().replace(/\.local$/, '').slice(0, 50) || 'Ordinateur') + ' (' + osName + ')';

// ---------- remote relay API ----------
class Unpaired extends Error {}
async function api(method, path, body) {
  const headers = { Accept: 'application/json', 'User-Agent': 'CamMicGoDesktop/' + VERSION };
  if (cfg.token) headers.Authorization = 'Bearer ' + cfg.token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const text = await r.text();
  let json = {}; try { json = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
  if (r.status === 401) throw new Unpaired(json.error || 'Appareil non appairé ou révoqué.');
  if (!r.ok) throw new Error(json.error || 'Erreur serveur ' + r.status);
  return json;
}

async function pair(code, name) {
  const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 8) throw new Error('Le code d’appairage contient 8 caractères (ex. ABCD-2345).');
  const saved = cfg.token; cfg.token = undefined;
  try {
    const res = await api('POST', '/api/devices/pair', { code: clean, name: (name || defaultName()).slice(0, 80) });
    cfg = { ...cfg, token: res.deviceToken, deviceName: res.name, pairedAt: new Date().toISOString(), jobsDone: 0, connected: true };
    save(); startRelay();
    return cfg.deviceName;
  } catch (e) { cfg.token = saved; throw e; }
}
function forget(message) {
  stopRelay();
  cfg = { ...cfg, token: undefined, deviceName: undefined, connected: false };
  save(); setStatus(message || 'Appareil dissocié.');
}

// ---------- relay loop (same behaviour as the Android app) ----------
const state = { running: false, status: 'Arrêté', lastSync: 0, pausedUntil: 0, strikes: 0, current: null, log: [] };
let loopId = 0;
function setStatus(text) {
  state.status = text;
  state.log.unshift({ at: Date.now(), text }); state.log.length = Math.min(state.log.length, 30);
  if (!flag('quiet')) console.log(new Date().toLocaleTimeString() + '  ' + text);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function startRelay() {
  if (!cfg.token || state.running) return;
  state.running = true; cfg.connected = true; save();
  setStatus('Mode connecté : en attente de demandes');
  loop(++loopId);
}
function stopRelay() {
  if (!state.running) return;
  state.running = false; loopId++; cfg.connected = false; save();
  setStatus('Mode connecté arrêté');
}

async function loop(id) {
  let backoff = 5000;
  while (state.running && id === loopId) {
    try {
      const wait = state.pausedUntil - Date.now();
      if (wait > 0) { await api('GET', '/api/devices/jobs?claim=0'); await sleep(Math.min(wait, 60000)); continue; }
      const res = await api('GET', '/api/devices/jobs');
      backoff = 5000; state.lastSync = Date.now();
      if (res.job && id === loopId) await handle(res.job);
      await sleep(res.pollAfterMs || 4000);
    } catch (e) {
      if (e instanceof Unpaired) { forget('Appareil dissocié par le serveur. Appairez-le à nouveau.'); return; }
      setStatus('Connexion au serveur impossible, nouvel essai… (' + e.message + ')');
      await sleep(backoff); backoff = Math.min(backoff * 2, 60000);
    }
  }
}

async function handle(job) {
  state.current = job.videoId;
  setStatus('Transcription en cours : ' + job.videoId);
  try {
    const r = await fetchYouTubeCaptions(job.videoId, job.language || 'original');
    await api('POST', '/api/devices/jobs/' + job.id, { result: { ...r, method: 'desktop-device' } });
    cfg.jobsDone = (cfg.jobsDone || 0) + 1; save(); state.strikes = 0;
    setStatus('Transcription envoyée : ' + job.videoId + ' (' + r.segments.length + ' segments)');
  } catch (e) {
    if (e instanceof Unpaired) throw e;
    const msg = (e.message || 'Erreur inconnue') + (e.diagnostics ? '\n' + e.diagnostics.join('\n') : '');
    if (/HTTP 429/.test(msg)) {
      // YouTube rate-limits this connection: give the job back and pause instead of failing the queue.
      await api('POST', '/api/devices/jobs/' + job.id, { release: true }).catch(() => {});
      state.strikes++;
      const minutes = Math.min(30, 5 * 2 ** Math.min(state.strikes - 1, 3));
      state.pausedUntil = Date.now() + minutes * 60000;
      setStatus('YouTube limite temporairement cette connexion. Reprise automatique à ' + new Date(state.pausedUntil).toLocaleTimeString() + '.');
    } else {
      await api('POST', '/api/devices/jobs/' + job.id, { error: msg.slice(0, 2000) }).catch(() => {});
      setStatus('Échec pour ' + job.videoId + ' : ' + msg.split('\n')[0]);
    }
  } finally { state.current = null; }
}

// ---------- local control page ----------
// The page is served on 127.0.0.1 only. Every API call must carry a per-launch key that is only
// embedded in the page itself, so other websites open in the browser cannot drive the relay.
const key = randomBytes(18).toString('base64url');
const snapshot = () => ({
  version: VERSION, paired: !!cfg.token, deviceName: cfg.deviceName || null, suggestedName: defaultName(), os: osName,
  running: state.running, status: state.status, lastSync: state.lastSync, pausedUntil: state.pausedUntil,
  jobsDone: cfg.jobsDone || 0, current: state.current, log: state.log.slice(0, 12),
});
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
async function readJson(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 100_000) throw new Error('Requête trop volumineuse'); chunks.push(c); }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function startServer(port, attempt = 0) {
  const server = createServer(async (req, res) => {
    const host = String(req.headers.host || '').replace(/:\d+$/, '');
    if (host !== '127.0.0.1' && host !== 'localhost') return send(res, 403, { error: 'Forbidden host' });
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, page(key, VERSION), 'text/html; charset=utf-8');
    if (!url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
    if (req.headers['x-cmg-key'] !== key) return send(res, 403, { error: 'Clé locale invalide : rechargez la page.' });
    try {
      const p = url.pathname;
      if (req.method === 'GET' && p === '/api/state') return send(res, 200, snapshot());
      if (req.method === 'POST' && p === '/api/pair') { const b = await readJson(req); await pair(b.code, b.name); return send(res, 200, snapshot()); }
      if (req.method === 'POST' && p === '/api/start') { startRelay(); return send(res, 200, snapshot()); }
      if (req.method === 'POST' && p === '/api/stop') { stopRelay(); return send(res, 200, snapshot()); }
      if (req.method === 'POST' && p === '/api/unpair') { forget('Appareil dissocié de ce compte.'); return send(res, 200, snapshot()); }
      if (req.method === 'GET' && p === '/api/tracks') {
        const v = parseVideoId(url.searchParams.get('v') || ''); if (!v) return send(res, 400, { error: 'Lien YouTube invalide' });
        return send(res, 200, await listCaptionTracks(v, url.searchParams.get('locale') || 'fr'));
      }
      if (req.method === 'GET' && p === '/api/transcript') {
        const v = parseVideoId(url.searchParams.get('v') || ''); if (!v) return send(res, 400, { error: 'Lien YouTube invalide' });
        return send(res, 200, await fetchYouTubeCaptions(v, url.searchParams.get('lang') || 'original'));
      }
      return send(res, 404, { error: 'Not found' });
    } catch (e) {
      return send(res, e instanceof Unpaired ? 401 : 400, { error: e.message + (e.diagnostics ? ' — ' + e.diagnostics.join(' · ') : '') });
    }
  });
  server.on('error', e => {
    if (e.code === 'EADDRINUSE' && attempt === 0) {
      console.log('Le port ' + port + ' est déjà utilisé : CamMicGo est peut-être déjà ouvert. Ouverture de la page existante…');
      if (!flag('headless')) openBrowser('http://127.0.0.1:' + port + '/');
      setTimeout(() => process.exit(0), 1500);
    } else { console.error(e.message); process.exit(1); }
  });
  server.listen(port, '127.0.0.1', () => {
    const link = 'http://127.0.0.1:' + port + '/';
    console.log('\nCamMicGo SEO MCP — relais ordinateur ' + VERSION);
    console.log('Page de contrôle : ' + link);
    console.log('Laissez cette fenêtre ouverte. Fermez-la (ou Ctrl+C) pour arrêter le relais.\n');
    if (!flag('headless')) openBrowser(link);
  });
}

function openBrowser(link) {
  const [cmd, a] = platform() === 'win32' ? ['cmd', ['/c', 'start', '', link]] : platform() === 'darwin' ? ['open', [link]] : ['xdg-open', [link]];
  try { spawn(cmd, a, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* print only */ }
}

// ---------- entry point ----------
async function main() {
  if (flag('version')) return console.log(VERSION);
  if (flag('help') || flag('h')) {
    return console.log('Usage: cammicgo-relay [--pair CODE] [--name NOM] [--headless] [--unpair] [--status]\nPage locale : http://127.0.0.1:' + PORT + '/');
  }
  if (flag('unpair')) { forget(); return; }
  if (flag('status')) return console.log(JSON.stringify(snapshot(), null, 2));
  if (opt('pair')) {
    try { console.log('Appairé : ' + await pair(opt('pair'), opt('name'))); }
    catch (e) { console.error('Appairage impossible : ' + e.message); process.exit(1); }
  } else if (cfg.token && cfg.connected !== false) startRelay();
  else setStatus(cfg.token ? 'Mode connecté arrêté' : 'Pas encore appairé : ouvrez la page de contrôle pour saisir un code.');
  startServer(PORT);
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { console.log('\nRelais arrêté.'); process.exit(0); });
}
main();
