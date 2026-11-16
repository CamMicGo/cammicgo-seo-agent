// Unit tests for lib/youtube-channels.ts — run with: npm test
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pickChannel} from '../lib/youtube-channels.ts';

const A={id:'UCaaaaaaaaaaaaaaaaaaaaaa',title:'CamMicGo'},B={id:'UCbbbbbbbbbbbbbbbbbbbbbb',title:'Tarik'};

test('one channel: used without asking', ()=>{assert.deepEqual(pickChannel([A]),{pick:A});});
test('several channels and none named: the assistant must ask', ()=>{assert.deepEqual(pickChannel([A,B]),{status:'ask'});});
test('no channel connected', ()=>{assert.deepEqual(pickChannel([]),{status:'none'});});
test('pick by ID, by exact name (case-insensitive) or @handle-like name', ()=>{
 assert.deepEqual(pickChannel([A,B],B.id),{pick:B});
 assert.deepEqual(pickChannel([A,B],'cammicgo'),{pick:A});
 assert.deepEqual(pickChannel([A,B],'@Tarik'),{pick:B});
});
test('partial name only when it designates a single channel', ()=>{
 assert.deepEqual(pickChannel([A,B],'micg'),{pick:A});
 assert.deepEqual(pickChannel([{id:'UC1',title:'Game A'},{id:'UC2',title:'Game B'}],'game'),{status:'unknown'});
});
test('unknown channel', ()=>{assert.deepEqual(pickChannel([A,B],'Other'),{status:'unknown'});});
