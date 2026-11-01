// Unit tests for lib/linkedin.ts — run with: npm test
/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON bodies in assertions */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as li from '../lib/linkedin.ts';

test('own LinkedIn app credentials are checked before saving', ()=>{
 assert.deepEqual(li.validateLinkedInClient({clientId:' 78abcd1234efgh ',clientSecret:'WPL_AP1.abcdefghij.klmno=='}),{clientId:'78abcd1234efgh',clientSecret:'WPL_AP1.abcdefghij.klmno=='});
 assert.equal('error' in li.validateLinkedInClient({clientId:'bad id!',clientSecret:'x'.repeat(16)}),true);
 assert.equal('error' in li.validateLinkedInClient({clientId:'78abcd1234efgh',clientSecret:'short'}),true);
});
test('authorization URL asks exactly for sign-in and posting, with the fixed redirect', ()=>{
 const u=new URL(li.authorizeUrl('78abcd1234efgh','state123'));
 assert.equal(u.origin+u.pathname,'https://www.linkedin.com/oauth/v2/authorization');
 assert.equal(u.searchParams.get('scope'),'openid profile email w_member_social');
 assert.equal(u.searchParams.get('redirect_uri'),'https://seo.cammicgo.com/api/auth/linkedin/callback');
 assert.equal(u.searchParams.get('state'),'state123');
 assert.equal(li.tokenBody('c','id','s').get('grant_type'),'authorization_code');
});
test('Posts API bodies: text, image, video and link preview on the member profile', ()=>{
 const author=li.personUrn('abc123');assert.equal(author,'urn:li:person:abc123');
 const text=li.postBody({author,text:'Hello',visibility:'PUBLIC'}) as any;
 assert.deepEqual(text,{author,commentary:'Hello',visibility:'PUBLIC',distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]},lifecycleState:'PUBLISHED',isReshareDisabledByAuthor:false});
 const img=li.postBody({author,text:'Pic',visibility:'CONNECTIONS',media:{kind:'IMAGE',id:'urn:li:image:C4E'}}) as any;
 assert.deepEqual(img.content,{media:{id:'urn:li:image:C4E'}});assert.equal(img.visibility,'CONNECTIONS');
 const vid=li.postBody({author,text:'Clip',visibility:'PUBLIC',media:{kind:'VIDEO',id:'urn:li:video:C5',title:'Demo'}}) as any;
 assert.deepEqual(vid.content,{media:{id:'urn:li:video:C5',title:'Demo'}});
 const link=li.postBody({author,text:'Read',visibility:'PUBLIC',link:{url:'https://www.cammicgo.com/fr/',description:'Test'}}) as any;
 assert.deepEqual(link.content,{article:{source:'https://www.cammicgo.com/fr/',title:'www.cammicgo.com/fr',description:'Test'}});
 assert.deepEqual(li.imageInitBody(author),{initializeUploadRequest:{owner:author}});
 assert.deepEqual(li.videoInitBody(author,5000),{initializeUploadRequest:{owner:author,fileSizeBytes:5000,uploadCaptions:false,uploadThumbnail:false}});
 assert.deepEqual(li.finalizeVideoBody('urn:li:video:C5','',['e1','e2']),{finalizeUploadRequest:{video:'urn:li:video:C5',uploadToken:'',uploadedPartIds:['e1','e2']}});
 assert.equal(li.postUrl('urn:li:share:123'),'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A123/');
});
test('post text: reserved characters escaped, hashtags kept clickable', ()=>{
 assert.equal(li.littleText('Test (webcam) & micro [gratuit] @home *new* a_b ~ok | x\\y <3 {z}'),
  'Test \\(webcam\\) & micro \\[gratuit\\] \\@home \\*new\\* a\\_b \\~ok \\| x\\\\y \\<3 \\{z\\}');
 assert.equal(li.littleText('Nouveau #webcam et #testMicro2026 !'),'Nouveau {hashtag|\\#|webcam} et {hashtag|\\#|testMicro2026} !');
 assert.equal(li.littleText('#début'),'{hashtag|\\#|début}');
 assert.equal(li.littleText('C# et page#3 et &#123;'),'C\\# et page\\#3 et &\\#123;');
 assert.equal(li.littleText('# seul'),'\\# seul');
});
test('LinkedIn-Version candidates: last month first, inside the one-year window', ()=>{
 assert.deepEqual(li.versionCandidates(Date.parse('2026-11-01T00:30:00Z'),3),['202610','202609','202608']);
 assert.deepEqual(li.versionCandidates(Date.parse('2026-01-15T00:00:00Z'),2),['202512','202511']);
});
test('video parts must be LinkedIn hosts covering the file exactly', ()=>{
 const u=(n:number)=>'https://www.linkedin.com/dms-uploads/sp/v2/V'+n;
 assert.deepEqual(li.videoParts([{uploadUrl:u(2),firstByte:4,lastByte:9},{uploadUrl:u(1),firstByte:0,lastByte:3}],10),[{url:u(1),first:0,last:3},{url:u(2),first:4,last:9}]);
 assert.equal(li.videoParts([{uploadUrl:u(1),firstByte:0,lastByte:3}],10),null);
 assert.equal(li.videoParts([{uploadUrl:u(1),firstByte:0,lastByte:4},{uploadUrl:u(2),firstByte:4,lastByte:9}],10),null);
 assert.equal(li.videoParts([{uploadUrl:'https://uploads.example.com/x',firstByte:0,lastByte:9}],10),null);
 assert.equal(li.videoParts(undefined,10),null);
});
test('LinkedIn refusals are explained', ()=>{
 const acc='https://seo.cammicgo.com/account';
 assert.match(li.problemMessage(401,'',acc),/reconnect LinkedIn/);
 assert.match(li.problemMessage(403,'',acc),/Share on LinkedIn/);
 assert.match(li.problemMessage(422,'{"code":"DUPLICATE_POST"}',acc),/identical/);
 assert.match(li.problemMessage(429,'',acc),/daily limit/);
 assert.equal(li.problemMessage(500,'',acc),'LinkedIn answered HTTP 500.');
});
test('posts are checked: length, one media or one link, types and sizes', ()=>{
 assert.equal('ok' in li.checkPost({text:' Bonjour '}),true);
 assert.equal((li.checkPost({text:'   '}) as any).error,'empty_text');
 assert.equal((li.checkPost({text:'x'.repeat(3001)}) as any).error,'text_too_long');
 assert.equal((li.checkPost({text:'a',media:{kind:'IMAGE'},link:{url:'https://x.y'}}) as any).error,'media_or_link');
 assert.equal((li.checkPost({text:'a',media:{kind:'IMAGE',mime:'image/webp'}}) as any).error,'unsupported_media');
 assert.equal((li.checkPost({text:'a',media:{kind:'VIDEO',mime:'video/mp4',bytes:101*1024*1024}}) as any).error,'file_too_large');
 assert.equal('ok' in li.checkPost({text:'a',media:{kind:'IMAGE',mime:'image/png',bytes:1000}}),true);
 assert.equal(li.daysLeft(Date.parse('2026-12-31T00:00:00Z'),Date.parse('2026-11-01T00:00:00Z')),60);
});
test('the member token only goes to https LinkedIn upload hosts', ()=>{
 assert.deepEqual(li.uploadTarget('https://api.linkedin.com/mediaUpload/C55/feedshare-uploadedImage/0?ca=vector_feedshare'),{url:'https://api.linkedin.com/mediaUpload/C55/feedshare-uploadedImage/0?ca=vector_feedshare'});
 assert.ok(li.uploadTarget('https://www.linkedin.com/dms-uploads/abc'));
 assert.equal(li.uploadTarget('http://api.linkedin.com/mediaUpload/x'),null);
 assert.equal(li.uploadTarget('https://linkedin.com.evil.example/upload'),null);
 assert.equal(li.uploadTarget('https://evil-linkedin.com/upload'),null);
 assert.equal(li.uploadTarget(undefined),null);
 assert.equal(li.uploadTarget('not a url'),null);
});
test('a user connects with their own app first, otherwise with the shared CamMicGo app', ()=>{
 assert.equal(li.appMode(true,true),'own');
 assert.equal(li.appMode(true,false),'own');
 assert.equal(li.appMode(false,true),'shared');
 assert.equal(li.appMode(false,false),null);
});
test('daily limits: the member limit, the shared app limit and an own app limit are told apart', ()=>{
 const acc='https://seo.cammicgo.com/account';
 const appBody='{"status":429,"message":"Resource level throttle APPLICATION DAY limit for calls to this resource is reached."}';
 const memberBody='{"status":429,"message":"Resource level throttle MEMBER DAY limit for calls to this resource is reached."}';
 assert.equal(li.throttleKind(appBody),'app');assert.equal(li.throttleKind(memberBody),'member');assert.equal(li.throttleKind('{}'),null);
 assert.match(li.problemMessage(429,memberBody,acc,'shared'),/own LinkedIn limit/);
 assert.match(li.problemMessage(429,appBody,acc,'shared'),/shared by all users.*connect your own LinkedIn app/);
 assert.match(li.problemMessage(429,appBody,acc,'own'),/Your LinkedIn app reached/);
 assert.match(li.problemMessage(429,'{}',acc,'shared'),/shared by all users/);
});
