import {test} from 'node:test';
import assert from 'node:assert/strict';
process.env.LINKEDIN_PHOTO_SECRET='test-secret';
const {photoProxyUrl,verifyPhoto,proxyMissingPhotos,isLinkedInPhoto}=await import('../lib/linkedin-photo.ts');
const {mergeReactionPeople}=await import('../lib/linkedin-merge.ts');
const B='https://seo.cammicgo.com';
const PHOTO='https://media.licdn.com/dms/image/v2/abc/profile-displayphoto-shrink_100_100/0/1?e=1&t=x';

test('photo proxy: only signed LinkedIn CDN photos, never another host (no open proxy)', ()=>{
 const u=photoProxyUrl(B,PHOTO);
 assert.match(u,/^https:\/\/seo\.cammicgo\.com\/api\/linkedin\/photo\?u=https%3A%2F%2Fmedia\.licdn\.com.*&s=[A-Za-z0-9_-]{32}$/);
 const s=new URL(u).searchParams.get('s')!;
 assert.equal(verifyPhoto(PHOTO,s),true);
 assert.equal(verifyPhoto(PHOTO+'x',s),false,'signature bound to the exact link');
 assert.equal(verifyPhoto('https://evil.example/x.jpg',s),false);
 assert.equal(isLinkedInPhoto('https://media.licdn.com.evil.example/dms/image/x'),false);
 assert.equal(photoProxyUrl(B,'https://evil.example/p.jpg'),'');
});
test('people without a phone thumbnail get their LinkedIn photo through the proxy; thumbnails are kept', ()=>{
 const cards:Array<Record<string,unknown>>=[{name:'A',photoUrl:PHOTO},{name:'T',imageUrl:B+'/api/linkedin/thumb/1.jpg',photoUrl:PHOTO},{name:'N'},{name:'C',authorPhotoUrl:PHOTO}];
 assert.equal(proxyMissingPhotos(cards,B),2);
 assert.match(String(cards[0].imageUrl),/\/api\/linkedin\/photo\?u=/);
 assert.equal(cards[1].imageUrl,B+'/api/linkedin/thumb/1.jpg');
 assert.equal(cards[2].imageUrl,undefined);
 assert.match(String(cards[3].imageUrl),/\/api\/linkedin\/photo\?u=/);
});
test('saved batches of 50 put back every person the capped final answer left out; counts recomputed', ()=>{
 const final={status:'ok',truncated:true,reactions:{expectedTotal:120,complete:false,people:[{name:'P0',profileUrl:'https://www.linkedin.com/in/p0/',reaction:'like',photoUrl:PHOTO}]},consistency:{reactionsRead:1}};
 const saved=Array.from({length:120},(_,i)=>({name:'P'+i,profileUrl:'https://www.linkedin.com/in/p'+i+'/?mini=1',reaction:i<100?'like':'love',headline:'H'+i}));
 const r=mergeReactionPeople(final,saved) as typeof final&{reactions:Record<string,unknown>};
 assert.equal((r.reactions.people as unknown[]).length,120);
 assert.deepEqual(r.reactions.byType,{like:100,love:20});
 assert.equal(r.reactions.complete,true,'120 read of 120 shown');
 assert.equal(r.consistency.reactionsRead,120);
 assert.equal((r.reactions.people as Array<Record<string,unknown>>)[0].headline,'H0','missing fields filled, photo kept');
 assert.equal((r.reactions.people as Array<Record<string,unknown>>)[0].photoUrl,PHOTO);
 const stopped={reactions:{expectedTotal:2000,stopped:true,people:[]}};
 const s2=mergeReactionPeople(stopped,saved.slice(0,50)) as {reactions:Record<string,unknown>};
 assert.equal((s2.reactions.people as unknown[]).length,50);assert.notEqual(s2.reactions.complete,true,'a stopped read is never complete');
});
