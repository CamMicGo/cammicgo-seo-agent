#!/usr/bin/env node
// Local-only transcript proof of concept. No cookies or Google credentials are transmitted.
// Built-in fetcher first (no dependency); yt-dlp on PATH is only a fallback.
// Execute: node scripts/local-youtube-transcript.mjs VIDEO_URL [language]
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchYouTubeCaptions } from '../lib/youtube-captions.mjs';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/local-youtube-transcript.mjs <YouTube URL or video ID>');
  process.exit(2);
}
function videoId(value) {
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const u = new URL(value);
    if (!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(u.hostname)) return null;
    const id = u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : u.searchParams.get('v');
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
const id = videoId(input);
if (!id) { console.error('Invalid YouTube video ID or URL'); process.exit(2); }
const language = process.argv[3] || process.env.CAMMICGO_TRANSCRIPT_LANG || 'en';
let builtinError = null;
try {
  const result = await fetchYouTubeCaptions(id, language);
  process.stdout.write(JSON.stringify({ ...result, source: 'local-builtin' }) + '\n');
  process.exit(0);
} catch (e) {
  builtinError = { error: e.message, diagnostics: e.diagnostics ?? [] };
}
const dir = await mkdtemp(join(tmpdir(), 'cammicgo-transcript-'));
const url = 'https://www.youtube.com/watch?v=' + id;
try {
  const args = ['--skip-download','--no-playlist','--write-auto-subs','--write-subs','--sub-langs',language+'.*','--sub-format','vtt','-o',join(dir,'%(id)s.%(ext)s'),url];
  const result = await new Promise((resolve,reject) => {
    const child = spawn('yt-dlp',args,{stdio:['ignore','ignore','pipe'],windowsHide:true});
    let stderr = '';
    child.stderr.on('data',d=>{ stderr += d.toString().slice(0,2048); });
    child.on('error',reject);
    child.on('close',code=>resolve({code,stderr}));
  });
  const files = (await readdir(dir)).filter(f=>f.endsWith('.vtt'));
  if (!files.length) {
    console.error(JSON.stringify({videoId:id,error:'No subtitles available locally',builtin:builtinError,ytDlpExitCode:result.code,details:result.stderr.slice(-600)}));
    process.exitCode = 1;
  } else {
    const preferred = files.find(f=>/\.en(?:[.-]|\.vtt)/.test(f)) ?? files[0];
    const vtt = await readFile(join(dir,preferred),'utf8');
    const segments = [];
    let last = '';
    for (const block of vtt.split(/\r?\n\s*\r?\n/)) {
      const lines = block.split(/\r?\n/);
      const idx = lines.findIndex(l=>l.includes(' --> '));
      if (idx<0) continue;
      const match = lines[idx].match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);
      if (!match) continue;
      const start = (+match[1]*3600)+(+match[2]*60)+(+match[3])+(+match[4]/1000);
      const end = (+match[5]*3600)+(+match[6]*60)+(+match[7])+(+match[8]/1000);
      const text = lines.slice(idx+1).join(' ').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
      if (!text || text===last) continue;
      last=text;
      segments.push({start,duration:Math.max(0,end-start),text});
    }
    process.stdout.write(JSON.stringify({videoId:id,source:'local-yt-dlp',language:preferred.split('.').slice(-2,-1)[0],segments})+'\n');
  }
} catch (e) {
  console.error(JSON.stringify({videoId:id,error:'No subtitles available locally',builtin:builtinError,ytDlp:'not installed or failed to start (optional fallback)',details:String(e)}));
  process.exitCode=1;
} finally {
  await rm(dir,{recursive:true,force:true});
}
