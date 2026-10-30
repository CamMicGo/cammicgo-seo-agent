/**
 * Dependency-free YouTube caption fetcher (Node 18+ / any fetch runtime).
 * Same strategy as the CamMicGo Android app:
 *   1. InnerTube player endpoint with the ANDROID client: its caption URLs work without the
 *      web "pot" anti-bot token that now blanks most web caption URLs;
 *   2. ytInitialPlayerResponse embedded in the watch page (fallback).
 * A consent cookie avoids the EU consent.youtube.com redirect.
 * Works from residential connections (local MCP, phone). Cloud IPs get LOGIN_REQUIRED.
 */

const ANDROID_CLIENT_VERSION = '20.10.38';
const ANDROID_UA = `com.google.android.youtube/${ANDROID_CLIENT_VERSION} (Linux; U; Android 14) gzip`;
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const BASE_HEADERS = { 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'SOCS=CAI; CONSENT=YES+cb' };

export function parseVideoId(input) {
  const s = String(input ?? '').trim();
  const m = s.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : null;
}

async function http(url, { body, ua = WEB_UA, timeoutMs = 20000 } = {}) {
  const headers = { ...BASE_HEADERS, 'User-Agent': ua };
  if (body) Object.assign(headers, { 'Content-Type': 'application/json', Origin: 'https://www.youtube.com', 'X-YouTube-Client-Name': '3', 'X-YouTube-Client-Version': ANDROID_CLIENT_VERSION });
  const r = await fetch(url, { method: body ? 'POST' : 'GET', headers, body, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  if (r.status === 429) throw new Error('HTTP 429: YouTube is rate-limiting this connection');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

export function embeddedJson(html, marker) {
  const m = new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*').exec(html);
  if (!m) return null;
  const start = m.index + m[0].length;
  const brace = html.indexOf('{', start);
  if (brace < 0 || brace - start > 5) return null;
  let depth = 0, quote = false, escape = false;
  for (let i = brace; i < html.length; i++) {
    const ch = html[i];
    if (quote) { if (escape) escape = false; else if (ch === '\\') escape = true; else if (ch === '"') quote = false; }
    else if (ch === '"') quote = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return html.slice(brace, i + 1);
  }
  return null;
}

const tracksOf = player => player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
function statusOf(player) {
  const ps = player?.playabilityStatus;
  if (!ps) return 'no caption tracks';
  return ps.status === 'OK' ? 'playable but no captions' : `${ps.status}${ps.reason ? ' — ' + ps.reason : ''}`;
}
const trackName = t => t?.name?.simpleText || t?.name?.runs?.[0]?.text || null;

const codeOf = t => String(t.languageCode || '').toLowerCase();
const matchesLang = (t, lang) => codeOf(t) === lang || codeOf(t).split('-')[0] === lang.split('-')[0];

/**
 * "original": the auto-generated track of the spoken audio (kind=asr), else the first track.
 * A language code: that language (manual, then auto). If absent, the best source to translate
 * from: a translatable human-made track, then the original-audio track, then the first one.
 */
export function pickTrack(tracks, lang) {
  const auto = t => t.kind === 'asr';
  if (lang === 'original') return tracks.find(auto) ?? tracks[0];
  const base = lang.split('-')[0];
  return tracks.find(t => codeOf(t) === lang && !auto(t))
    ?? tracks.find(t => codeOf(t) === lang)
    ?? tracks.find(t => codeOf(t).split('-')[0] === base && !auto(t))
    ?? tracks.find(t => codeOf(t).split('-')[0] === base)
    ?? tracks.find(t => !auto(t) && t.isTranslatable)
    ?? tracks.find(auto)
    ?? tracks[0];
}

export function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(x?)([0-9a-f]+);/gi, (_, hex, n) => String.fromCodePoint(parseInt(n, hex ? 16 : 10)));
}

/** Parses json3, legacy <text start dur> (seconds) or srv3 <p t d> (milliseconds). */
export function parseCaptions(body) {
  const clean = t => t.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const r3 = n => Math.round(n * 1000) / 1000;
  const trimmed = body.trim();
  if (trimmed.startsWith('{')) {
    return (JSON.parse(trimmed).events ?? [])
      .filter(e => typeof e.tStartMs === 'number' && e.segs?.length)
      .map(e => ({ start: r3(e.tStartMs / 1000), duration: r3((e.dDurationMs ?? 0) / 1000), text: clean(e.segs.map(s => s.utf8 ?? '').join('')) }))
      .filter(s => s.text);
  }
  const out = [];
  for (const m of trimmed.matchAll(/<(text|p)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const ms = m[1] === 'p';
    const attr = name => (m[2].match(new RegExp('\\b' + name + '="([0-9.]+)"')) || [])[1];
    const start = attr(ms ? 't' : 'start'); if (start === undefined) continue;
    const dur = attr(ms ? 'd' : 'dur') ?? '0';
    const k = ms ? 1000 : 1;
    const text = clean(decodeEntities(m[3].replace(/<[^>]+>/g, '')));
    if (text) out.push({ start: r3(Number(start) / k), duration: r3(Number(dur) / k), text });
  }
  return out;
}

async function download(videoId, tracks, lang, method) {
  const track = pickTrack(tracks, lang);
  const tlang = lang !== 'original' && !matchesLang(track, lang) && track.isTranslatable ? lang : null;
  const url = new URL(String(track.baseUrl).replace(/\\u0026/g, '&'), 'https://www.youtube.com');
  if (url.protocol !== 'https:' || !url.hostname.endsWith('youtube.com') || !url.pathname.startsWith('/api/timedtext')) throw new Error('Unexpected caption URL');
  url.searchParams.set('fmt', 'json3');
  url.searchParams.delete('tlang');
  if (tlang) url.searchParams.set('tlang', tlang);
  const body = await http(url.toString(), { ua: ANDROID_UA });
  if (!body.trim()) throw new Error(`Empty caption track (${method})`);
  const segments = parseCaptions(body);
  if (!segments.length) throw new Error(`Caption track without text (${method})`);
  return {
    videoId, method,
    language: tlang ?? track.languageCode,
    languageName: tlang ? `${tlang} (translated by YouTube from ${track.languageCode})` : (trackName(track) ?? track.languageCode),
    ...(tlang ? { translatedFrom: track.languageCode } : {}),
    isAutoGenerated: track.kind === 'asr', availableLanguages: [...new Set(tracks.map(t => t.languageCode))], segments,
  };
}

/** Fetches timestamped captions. Throws an Error listing each attempted method on failure. */
export async function fetchYouTubeCaptions(videoInput, language = 'original') {
  const videoId = parseVideoId(videoInput);
  if (!videoId) throw new Error('Invalid YouTube URL or video ID');
  const lang = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(language || '') ? language.toLowerCase() : 'original';
  const diagnostics = [];
  let html = null, apiKey = null;
  try {
    html = await http(`https://www.youtube.com/watch?v=${videoId}&hl=en`);
    apiKey = (html.match(/"INNERTUBE_API_KEY"\s*:\s*"([A-Za-z0-9_-]+)"/) || [])[1] ?? null;
  } catch (e) { diagnostics.push('watch-page: ' + e.message); }

  try {
    const body = JSON.stringify({ context: { client: { clientName: 'ANDROID', clientVersion: ANDROID_CLIENT_VERSION, androidSdkVersion: 34, hl: 'en' } }, videoId });
    const player = JSON.parse(await http('https://www.youtube.com/youtubei/v1/player' + (apiKey ? '?key=' + apiKey : ''), { body, ua: ANDROID_UA }));
    const tracks = tracksOf(player);
    if (tracks.length) return await download(videoId, tracks, lang, 'innertube-android');
    diagnostics.push('innertube-android: ' + statusOf(player));
  } catch (e) { diagnostics.push('innertube-android: ' + e.message); }

  if (html) {
    try {
      const json = embeddedJson(html, 'ytInitialPlayerResponse');
      if (json) {
        const player = JSON.parse(json);
        const tracks = tracksOf(player);
        if (tracks.length) return await download(videoId, tracks, lang, 'watch-page');
        diagnostics.push('watch-page: ' + statusOf(player));
      } else diagnostics.push(html.includes('consent.youtube.com') ? 'watch-page: consent page' : 'watch-page: no player response');
    } catch (e) { diagnostics.push('watch-page: ' + e.message); }
  }
  const error = new Error('No accessible caption tracks');
  error.diagnostics = diagnostics;
  error.videoId = videoId;
  throw error;
}
