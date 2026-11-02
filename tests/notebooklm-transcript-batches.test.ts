import assert from 'node:assert/strict';
import test from 'node:test';
import {buildTranscriptBatches,renderVideo,type TranscriptVideo} from '../lib/notebooklm-transcript-batches.ts';
const video=(id:string,date='2026-10-28T12:00:00Z'):TranscriptVideo=>({
 videoId:id,channelId:'UC-main',channelName:'Example main channel',title:'World models',
 publishedAt:date,language:'en',segments:[{startSeconds:130,text:'Second part'},{startSeconds:0,text:'Introduction'}]
});
test('Markdown keeps URL, date, language and sorted timestamps',()=>{
 const output=renderVideo(video('abcDEF12345'));
 assert.match(output,/https:\/\/www.youtube.com\/watch\?v=abcDEF12345/);
 assert.match(output,/2026-10-28T12:00:00.000Z/);
 assert.ok(output.indexOf('[00:00:00]')<output.indexOf('[00:02:10]'));
});
test('deduplicates video IDs and splits by UTC period',()=>{
 const batches=buildTranscriptBatches([video('abcDEF12345'),video('abcDEF12345'),video('xyzDEF12345','2025-10-28T12:00:00Z')]);
 assert.equal(batches.length,2);
 assert.equal(batches.reduce((sum,b)=>sum+b.videoIds.length,0),2);
});
test('stable output regardless of input order',()=>{
 const a=video('abcDEF12345'),b=video('xyzDEF12345','2026-10-29T12:00:00Z');
 assert.deepEqual(buildTranscriptBatches([a,b]),buildTranscriptBatches([b,a]));
});
test('rejects oversized video instead of truncating',()=>{
 const v=video('abcDEF12345');
 v.segments=[{startSeconds:0,text:Array(150).fill('word').join(' ')}];
 assert.throws(()=>buildTranscriptBatches([v],{maxWords:100}),/exceeds maxWords/);
});
