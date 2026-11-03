import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNotebookCatalog} from '../lib/notebooklm-catalog.mjs';
const video={videoId:'s47CYnbimaI',channelId:'UCCM_PkxUkhTVxH3IE1SYzlg',channelName:'Nick Saraev Daily',title:'Sample',publishedAt:'2026-11-03T00:00:00Z',durationSeconds:14000,language:'en',segments:Array.from({length:100},(_,i)=>({startSeconds:i*10,text:'A complete caption segment number '+i+' with several words and a natural ending.'}))};
test('catalog references all bounded markdown parts and retains timestamps',()=>{
 const out=buildNotebookCatalog([video],{maxSourceChars:900,maxSourceWords:10000});
 assert.equal(out.rows.length,1);assert.ok(out.sources.length>1);
 assert.equal(out.rows[0].transcript_parts,out.sources.length);
 for(const source of out.sources){assert.ok(source.markdown.length<=900);assert.ok(out.rows[0].transcript_files.includes(source.filename));assert.match(source.markdown,/https:\/\/www.youtube.com\/watch\?v=s47CYnbimaI/);}
 assert.equal(out.sources.flatMap(s=>s.markdown.split('\n').filter(l=>/^\[\d\d:\d\d:\d\d\]/.test(l))).length,100);
});
test('duplicate video ids are catalogued once',()=>assert.equal(buildNotebookCatalog([video,video]).rows.length,1));
