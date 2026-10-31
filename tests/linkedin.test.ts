// Unit tests for lib/linkedin.ts — run with: npm test
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
test('post bodies: text, image and link preview', ()=>{
 const author=li.personUrn('abc123');assert.equal(author,'urn:li:person:abc123');
 const text=li.ugcPostBody({author,text:'Hello',visibility:'PUBLIC'}) as any;
 assert.equal(text.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory,'NONE');
 assert.equal(text.visibility['com.linkedin.ugc.MemberNetworkVisibility'],'PUBLIC');
 const img=li.ugcPostBody({author,text:'Pic',visibility:'CONNECTIONS',media:{kind:'IMAGE',asset:'urn:li:digitalmediaAsset:X'}}) as any;
 assert.deepEqual(img.specificContent['com.linkedin.ugc.ShareContent'].media,[{status:'READY',media:'urn:li:digitalmediaAsset:X'}]);
 const link=li.ugcPostBody({author,text:'Read',visibility:'PUBLIC',link:{url:'https://www.cammicgo.com',title:'CamMicGo'}}) as any;
 assert.equal(link.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory,'ARTICLE');
 assert.equal(link.specificContent['com.linkedin.ugc.ShareContent'].media[0].originalUrl,'https://www.cammicgo.com');
 assert.deepEqual(li.registerUploadBody(author,'VIDEO').registerUploadRequest.recipes,['urn:li:digitalmediaRecipe:feedshare-video']);
 assert.equal(li.postUrl('urn:li:share:123'),'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A123/');
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
