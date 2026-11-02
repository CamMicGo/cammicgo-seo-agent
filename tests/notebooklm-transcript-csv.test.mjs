import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {toCsv,parseCsv,rowFromVideo,upsertTranscriptCsv} from '../lib/notebooklm-transcript-csv.mjs';
const v=(id,title,channel)=>({videoId:id,title,channelName:channel,publishedAt:'2026-11-02T12:00:00Z',language:'ja',durationSeconds:123,segments:[{start:0,text:'Hello, "world"'},{start:62,text:'Second\nline'}]});
test('CSV escapes commas, quotes and multiline transcripts',()=>{const row=rowFromVideo(v('abcdefghijk','A','Main'));const [parsed]=parseCsv(toCsv([row]));assert.equal(parsed.transcript,row.transcript);assert.equal(parsed.video_title,'A');assert.match(parsed.transcript,/\[00:01:02\]/)});
test('CSV upserts videos across channels without duplicates',async()=>{const root=await mkdtemp(join(tmpdir(),'cmg-csv-'));try{const path=join(root,'all.csv');const a=await upsertTranscriptCsv({path,videos:[v('abcdefghijk','One','Main')]});assert.equal(a.added,1);const b=await upsertTranscriptCsv({path,videos:[v('abcdefghijk','One','Main'),v('lmnopqrstuv','Two','Secondary')]});assert.equal(b.added,1);assert.equal(b.unchanged,1);const rows=parseCsv(await readFile(path,'utf8'));assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.channel_name),['Main','Secondary']);}finally{await rm(root,{recursive:true,force:true})}});
