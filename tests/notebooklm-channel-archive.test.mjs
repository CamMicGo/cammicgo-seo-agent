import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {updateChannelArchive} from '../lib/notebooklm-channel-archive.mjs';
const channel={id:'UC_test_channel',name:'Nick Sarev Main'};
const video=(videoId,title,at)=>({videoId,title,publishedAt:at,language:'en',durationSeconds:3600,segments:[{start:0,text:'Hello world'},{start:12,text:'Next part'}]});
test('channel Markdown remains stable, deduplicated and incrementally updated',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cmg-channel-'));
 try {
  const a=await updateChannelArchive({channel,videos:[video('abcdefghijk','First','2026-10-01')],root});
  assert.equal(a.added,1);assert.equal(a.totalVideos,1);
  const b=await updateChannelArchive({channel,videos:[video('abcdefghijk','First','2026-10-01'),video('lmnopqrstuv','Second','2026-10-02')],root});
  assert.equal(b.added,1);assert.equal(b.unchanged,1);assert.equal(b.totalVideos,2);
  assert.equal(a.files[0].path,b.files[0].path);
  const md=await readFile(b.files[0].path,'utf8');
  assert.match(md,/Total videos: 2/);assert.match(md,/Video 1/);assert.match(md,/Video 2/);
  assert.match(md,/\[00:00:12\]/);
  const c=await updateChannelArchive({channel,videos:[{...video('zyxwvutsrqp','Long','2026-10-03'),durationSeconds:18001}],root});
  assert.equal(c.rejected.length,1);assert.equal(c.totalVideos,2);
 }finally{await rm(root,{recursive:true,force:true});}
});
