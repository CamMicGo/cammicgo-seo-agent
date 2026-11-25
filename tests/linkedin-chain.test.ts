import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ageMinutes,pickPost,companySlug} from '../lib/linkedin-chain.ts';
test('post age from LinkedIn relative times in several languages', ()=>{
 assert.equal(ageMinutes('2 h'),120);assert.equal(ageMinutes('3 j'),4320);assert.equal(ageMinutes('1 sem'),10080);
 assert.equal(ageMinutes('5d'),7200);assert.equal(ageMinutes('1w'),10080);assert.equal(ageMinutes('2 mo'),86400);
 assert.equal(ageMinutes('45 min'),45);assert.equal(ageMinutes('1 an'),525600);assert.equal(ageMinutes('12 Std.'),720);
 assert.equal(ageMinutes(''),Infinity);
});
test('latest post wins over a pinned older one; keywords pick the matching post', ()=>{
 const posts=[{postUrl:'u1',time:'3 sem',text:'Pinned: Le Chat launch'},{postUrl:'u2',time:'5 h',text:'Mistral Medium 3 is out'},{postUrl:'u3',time:'2 j',text:'Hiring in Paris'},{text:'no link',time:'1 h'}];
 assert.equal(pickPost(posts)!.postUrl,'u2');
 assert.equal(pickPost(posts,'hiring paris')!.postUrl,'u3');
 assert.equal(pickPost(posts,'le chat')!.postUrl,'u1');
 assert.equal(pickPost([]),null);assert.equal(pickPost(null),null);
});
test('company slug from a link, a slug or a name', ()=>{
 assert.equal(companySlug('https://www.linkedin.com/company/mistralai/posts/?feedView=all'),'mistralai');
 assert.equal(companySlug('mistralai'),'mistralai');
 assert.equal(companySlug('Mistral AI'),'mistralai');
 assert.equal(companySlug(''),'');
});
