import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aggregateStats,bingDate,bingSiteUrl,validateBingKey} from '../lib/bing-core.ts';

test('bingDate parses WCF and ISO dates',()=>{
 assert.equal(bingDate('/Date(1730764800000-0800)/'),'2024-11-05');
 assert.equal(bingDate('2026-11-01T00:00:00'),'2026-11-01');
 assert.equal(bingDate(undefined),null);
});
test('bingSiteUrl normalises to scheme + host + slash',()=>{
 assert.equal(bingSiteUrl('www.cammicgo.com'),'https://www.cammicgo.com/');
 assert.equal(bingSiteUrl('https://www.cammicgo.com/fr/cpu-test'),'https://www.cammicgo.com/');
});
test('validateBingKey accepts only key-shaped strings',()=>{
 assert.equal(validateBingKey(' 0123456789abcdef0123456789abcdef '),'0123456789abcdef0123456789abcdef');
 assert.equal(validateBingKey('short'),null);
 assert.equal(validateBingKey('has space inside 1234567890'),null);
});
test('aggregateStats sums weekly rows per query and weights position by impressions',()=>{
 const now=Date.now(),d=(daysAgo:number)=>`/Date(${now-daysAgo*86400000})/`;
 const rows=[{Query:'webcam test',Date:d(3),Clicks:5,Impressions:100,AvgImpressionPosition:4},{Query:'webcam test',Date:d(10),Clicks:3,Impressions:300,AvgImpressionPosition:8},{Query:'mic test',Date:d(5),Clicks:9,Impressions:50,AvgImpressionPosition:2},{Query:'old',Date:d(400),Clicks:99,Impressions:999}];
 const r=aggregateStats(rows,90,10,'clicks');
 assert.equal(r.total,2);
 assert.equal(r.rows[0].key,'mic test');
 assert.deepEqual(r.rows.find(x=>x.key==='webcam test'),{key:'webcam test',clicks:8,impressions:400,ctr:2,position:7});
});
