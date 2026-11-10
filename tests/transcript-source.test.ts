import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatTranscript} from '../lib/device-relay.ts';

const segments=[{start:0,duration:2,text:'Bonjour'},{start:2,duration:3,text:'et bienvenue'}];

test('captions from older devices are marked youtube_captions',()=>{
 const r=formatTranscript({videoId:'abc',language:'fr',segments},'text') as Record<string,unknown>;
 assert.equal(r.source,'youtube_captions');
 assert.match(String(r.transcript),/\[00:00\] Bonjour/);
});

test('a local speech-recognition result keeps its own provenance',()=>{
 const r=formatTranscript({source:'local_asr',model:'qwen3-asr-0.6b-int8',status:'complete',processingTime:12.3,language:'fr',segments},'segments') as Record<string,unknown>;
 assert.equal(r.source,'local_asr');
 assert.equal(r.model,'qwen3-asr-0.6b-int8');
 assert.equal((r.segments as unknown[]).length,2);
});
