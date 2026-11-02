import test from 'node:test';
import assert from 'node:assert/strict';
import {videoIdFrom,makeMarkdown,formatTranscript} from '../lib/notebooklm-local.mjs';
const sample=id=>({videoId:id,title:'A sample video',language:'en',segments:[{start:0,text:'Hello world'},{start:65,text:'A later section'}]});
test('YouTube IDs are parsed only from trusted domains',()=>{
 assert.equal(videoIdFrom('https://www.youtube.com/watch?v=abcdefghijk'),'abcdefghijk');
 assert.equal(videoIdFrom('https://youtu.be/abcdefghijk'),'abcdefghijk');
 assert.equal(videoIdFrom('https://evil.example/?v=abcdefghijk'),null);
});
test('timecodes and original YouTube URLs are retained',()=>{
 const text=formatTranscript(sample('abcdefghijk'));
 assert.match(text,/\[00:01:05\] A later section/);
 assert.match(text,/https:\/\/www.youtube.com\/watch\?v=abcdefghijk/);
});
test('duplicate videos use only one source section',()=>{
 const result=makeMarkdown([sample('abcdefghijk'),sample('abcdefghijk')]);
 assert.equal(result.length,1);
 assert.deepEqual(result[0].videoIds,['abcdefghijk']);
});
test('oversize transcripts are rejected, not silently truncated',()=>{
 const v=sample('abcdefghijk');v.segments=[{start:0,text:'word '.repeat(200)}];
 assert.throws(()=>makeMarkdown([v],{maxWords:100}),/too large/);
});
