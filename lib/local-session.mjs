/**
 * Local browser sessions for the CamMicGo command line and local MCP (computer only).
 *
 * "cammicgo login" opens Google Chrome (or Chromium / Edge) with a DEDICATED profile
 * (~/.cammicgo-seo-agent/chrome-profile), never the user's everyday profile. The user signs in
 * once; the session cookies are then read through the Chrome DevTools Protocol and stored
 * encrypted (AES-256-GCM, key file next to it, 0600). They are only ever sent to the site they
 * belong to (notebook.google.com, and later linkedin.com). Nothing goes to CamMicGo servers.
 *
 * When Google's short-lived cookies age out, refresh() relaunches the same profile headless
 * to let Google reissue them, without asking the user to sign in again.
 */
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, rmSync} from 'node:fs';
import {homedir, platform} from 'node:os';
import {join} from 'node:path';
import {randomBytes, createCipheriv, createDecipheriv} from 'node:crypto';

export const DIR = process.env.CAMMICGO_HOME || join(homedir(), '.cammicgo-seo-agent');
export const PROFILE = join(DIR, 'chrome-profile');
const KEY = join(DIR, 'token.key');
const SITES = {
  notebooklm: {url: 'https://notebook.google.com/', file: 'notebooklm-session.enc', domains: ['google.com'], signedIn: c => c.some(x => x.name === '__Secure-1PSID' || x.name === 'SID')},
  linkedin: {url: 'https://www.linkedin.com/messaging/', file: 'linkedin-session.enc', domains: ['linkedin.com'], signedIn: c => c.some(x => x.name === 'li_at')},
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

function prepare() { mkdirSync(DIR, {recursive: true, mode: 0o700}); try { chmodSync(DIR, 0o700); } catch { /* Windows */ } }
function key() { prepare(); if (!existsSync(KEY)) writeFileSync(KEY, randomBytes(32), {mode: 0o600, flag: 'wx'}); return readFileSync(KEY); }
function seal(path, data) {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(data)), c.final()]);
  writeFileSync(path, Buffer.concat([iv, c.getAuthTag(), body]), {mode: 0o600});
  try { chmodSync(path, 0o600); } catch { /* Windows */ }
}
function open(path) {
  const b = readFileSync(path), d = createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'));
}

/** Finds Chrome, Chromium or Edge. CAMMICGO_CHROME overrides. */
export function findBrowser() {
  if (process.env.CAMMICGO_CHROME) return process.env.CAMMICGO_CHROME;
  const p = platform(), env = process.env, list = [];
  if (p === 'win32') {
    for (const base of [env['PROGRAMFILES'], env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean))
      list.push(join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'), join(base, 'Chromium', 'Application', 'chrome.exe'), join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  } else if (p === 'darwin') {
    list.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
  } else {
    for (const d of (env.PATH || '').split(':')) for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) list.push(join(d, n));
  }
  return list.find(f => existsSync(f)) || null;
}

/** Minimal Chrome DevTools Protocol connection (Node 22 has a built-in WebSocket). */
class Cdp {
  static async connect(wsUrl) {
    if (typeof WebSocket !== 'function') throw new Error('Node.js 22 or newer is required (built-in WebSocket).');
    const ws = new WebSocket(wsUrl), c = new Cdp(ws);
    await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = () => ko(new Error('Cannot reach Chrome DevTools')); });
    ws.onmessage = e => { const m = JSON.parse(e.data); const p = c.pending.get(m.id); if (!p) return; c.pending.delete(m.id); if (m.error) p.ko(new Error(m.error.message)); else p.ok(m.result); };
    return c;
  }
  constructor(ws) { this.ws = ws; this.n = 0; this.pending = new Map(); }
  send(method, params = {}) { const id = ++this.n; this.ws.send(JSON.stringify({id, method, params})); return new Promise((ok, ko) => { this.pending.set(id, {ok, ko}); setTimeout(() => { if (this.pending.delete(id)) ko(new Error(method + ' timed out')); }, 15000); }); }
  close() { try { this.ws.close(); } catch { /* closed */ } }
}

async function launch(url, {headless = false} = {}) {
  const exe = findBrowser();
  if (!exe) throw new Error('Google Chrome, Chromium or Microsoft Edge was not found. Install Chrome, or set CAMMICGO_CHROME to its path.');
  prepare(); mkdirSync(PROFILE, {recursive: true, mode: 0o700});
  const portFile = join(PROFILE, 'DevToolsActivePort');
  rmSync(portFile, {force: true});
  const args = ['--user-data-dir=' + PROFILE, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check'];
  if (headless) args.push('--headless=new', '--disable-gpu');
  if (process.getuid?.() === 0) args.push('--no-sandbox'); // Chrome refuses to start as root otherwise (Linux containers)
  const child = spawn(exe, [...args, url], {stdio: 'ignore', detached: !headless});
  child.on('error', () => {});
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await sleep(200);
  if (!existsSync(portFile)) { try { child.kill(); } catch { /* gone */ } throw new Error('Chrome started but its DevTools port did not open. Close any CamMicGo Chrome window and retry.'); }
  const [port, path] = readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
  return {child, cdp: await Cdp.connect('ws://127.0.0.1:' + port + path)};
}

const forSite = (cookies, s) => cookies.filter(c => s.domains.some(d => c.domain.replace(/^\./, '') === d || c.domain.endsWith('.' + d)))
  .map(({name, value, domain, path, expires, secure, httpOnly}) => ({name, value, domain, path, expires, secure, httpOnly}));

/** Interactive sign-in: opens the dedicated Chrome window and waits until the user is signed in. */
export async function login(site = 'notebooklm', {timeoutMs = 300000, log = () => {}} = {}) {
  const s = SITES[site] || (() => { throw new Error('Unknown site ' + site); })();
  const {cdp} = await launch(s.url);
  log('Chrome is open on ' + s.url + ' — sign in with your account (waiting up to ' + Math.round(timeoutMs / 60000) + ' min)…');
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const {cookies} = await cdp.send('Storage.getCookies');
      const mine = forSite(cookies, s);
      if (s.signedIn(mine)) {
        await sleep(2500); // let the site finish setting its cookies
        const fresh = forSite((await cdp.send('Storage.getCookies')).cookies, s);
        prepare(); seal(join(DIR, s.file), {site, savedAt: Date.now(), cookies: fresh});
        await cdp.send('Browser.close').catch(() => {});
        return {site, signedIn: true, cookieCount: fresh.length};
      }
      await sleep(2000);
    }
    throw new Error('Sign-in not detected before the timeout. Run the command again.');
  } finally { cdp.close(); }
}

/** Headless refresh of the stored session from the same dedicated profile (no user action). */
export async function refresh(site = 'notebooklm') {
  const s = SITES[site];
  const {child, cdp} = await launch(s.url, {headless: true});
  try {
    await sleep(6000);
    const mine = forSite((await cdp.send('Storage.getCookies')).cookies, s);
    if (!s.signedIn(mine)) throw new Error('The saved Chrome profile is signed out. Run "cammicgo login' + (site === 'notebooklm' ? '' : ' ' + site) + '".');
    seal(join(DIR, s.file), {site, savedAt: Date.now(), cookies: mine});
    return {site, refreshed: true};
  } finally { await cdp.send('Browser.close').catch(() => {}); cdp.close(); try { child.kill(); } catch { /* closed */ } }
}

export function status(site = 'notebooklm') {
  const s = SITES[site], f = join(DIR, s.file);
  if (!existsSync(f)) return {site, signedIn: false};
  try { const d = open(f); return {site, signedIn: s.signedIn(d.cookies), savedAt: new Date(d.savedAt).toISOString(), cookieCount: d.cookies.length}; }
  catch { return {site, signedIn: false, error: 'session file unreadable (key changed?)'}; }
}

export function logout(site = 'notebooklm') { rmSync(join(DIR, SITES[site].file), {force: true}); return {site, signedOut: true}; }

/** Cookie header for a URL, from the stored session (only cookies whose domain matches the host). */
export function cookieHeader(site, url) {
  const s = SITES[site], f = join(DIR, s.file);
  if (!existsSync(f)) { const e = new Error('Not signed in. Run "cammicgo login' + (site === 'notebooklm' ? '' : ' ' + site) + '" first.'); e.code = 'auth_missing'; throw e; }
  const host = new URL(url).hostname, now = Date.now() / 1000;
  return open(f).cookies.filter(c => { const d = c.domain.replace(/^\./, ''); return (host === d || host.endsWith('.' + d)) && (!c.expires || c.expires < 0 || c.expires > now); })
    .map(c => c.name + '=' + c.value).join('; ');
}
