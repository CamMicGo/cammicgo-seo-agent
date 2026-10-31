// Unit tests for lib/ga4.ts and lib/gsc.ts — run with: npm test
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as ga4 from '../lib/ga4.ts';
import * as gsc from '../lib/gsc.ts';

const NOW=Date.parse('2026-10-31T15:00:00Z');

test('GA4 periods: ending yesterday, previous period of the same length', ()=>{
 assert.deepEqual(ga4.periods({days:7,compare:true},NOW),{current:{startDate:'2026-10-24',endDate:'2026-10-30'},previous:{startDate:'2026-10-17',endDate:'2026-10-23'},days:7});
 assert.ok('error' in ga4.periods({startDate:'2026-13-01'},NOW));
});
test('GA4 report body: names the ranges, filters with notExpression, default sort on the first metric', ()=>{
 const b=ga4.reportBody({dimensions:['sessionDefaultChannelGroup'],metrics:['sessions','engagementRate'],ranges:[{startDate:'2026-10-01',endDate:'2026-10-07'},{startDate:'2026-09-24',endDate:'2026-09-30'}],
  filters:[{field:'country',match:'exact',value:'France'},{field:'pagePath',match:'notContains',value:'/admin'}]}) as Record<string,any>;
 assert.deepEqual(b.dateRanges.map((r:{name:string})=>r.name),['current','previous']);
 assert.equal(b.dimensionFilter.andGroup.expressions.length,2);
 assert.deepEqual(b.dimensionFilter.andGroup.expressions[1],{notExpression:{filter:{fieldName:'pagePath',stringFilter:{matchType:'CONTAINS',value:'/admin',caseSensitive:false}}}});
 assert.deepEqual(b.orderBys,[{metric:{metricName:'sessions'},desc:true}]);
 const single=ga4.reportBody({dimensions:['country'],metrics:['sessions'],ranges:[{startDate:'2026-10-01',endDate:'2026-10-07'}],filters:[{field:'country',match:'regex',value:'^(France|Spain)$'}],orderBy:{field:'country'}}) as Record<string,any>;
 assert.equal(single.dimensionFilter.filter.stringFilter.matchType,'FULL_REGEXP');
 assert.deepEqual(single.orderBys,[{dimension:{dimensionName:'country'},desc:false}]);
 assert.ok(ga4.GA4_FIELD.test('customEvent:tool_name')&&ga4.GA4_FIELD.test('sessions')&&!ga4.GA4_FIELD.test('sessions;drop'));
});
test('GA4 rows are readable and two periods are merged with the change in %', ()=>{
 const resp={dimensionHeaders:[{name:'country'},{name:'dateRange'}],metricHeaders:[{name:'sessions',type:'TYPE_INTEGER'},{name:'engagementRate',type:'TYPE_FLOAT'}],
  rows:[{dimensionValues:[{value:'Spain'},{value:'current'}],metricValues:[{value:'120'},{value:'0.53219'}]},{dimensionValues:[{value:'Spain'},{value:'previous'}],metricValues:[{value:'80'},{value:'0.5'}]},
   {dimensionValues:[{value:'France'},{value:'current'}],metricValues:[{value:'10'},{value:'0.4'}]}]};
 const rows=ga4.rowsOf(resp);
 assert.deepEqual(rows[0],{country:'Spain',dateRange:'current',sessions:120,engagementRate:0.5322});
 const merged=ga4.comparedRows(rows,['country'],['sessions','engagementRate']);
 assert.deepEqual(merged[0],{country:'Spain',current:{sessions:120,engagementRate:0.5322},previous:{sessions:80,engagementRate:0.5},changePercent:{sessions:50,engagementRate:6.4}});
 assert.equal(merged[1].changePercent.sessions,null);
});
test('Search Console body: type, AND filters (country lower-cased), rows up to 25,000, fresh data', ()=>{
 const p=gsc.gscPeriod({days:28},NOW);assert.deepEqual(p,{startDate:'2026-10-01',endDate:'2026-10-28',days:28});
 assert.deepEqual(gsc.gscPeriod({days:7,fresh:true},NOW),{startDate:'2026-10-24',endDate:'2026-10-30',days:7});
 if('error' in p)throw Error('unexpected');
 assert.deepEqual(gsc.previousOf(p),{startDate:'2026-09-03',endDate:'2026-09-30',days:28});
 const b=gsc.queryBody({...p,dimensions:['query'],type:'discover',filters:[{dimension:'country',operator:'equals',expression:'ESP'},{dimension:'query',operator:'includingRegex',expression:'micr(o|ó)fono'}],rowLimit:99999,fresh:true}) as Record<string,any>;
 assert.equal(b.type,'discover');assert.equal(b.rowLimit,25000);assert.equal(b.dataState,'all');
 assert.deepEqual(b.dimensionFilterGroups[0].filters[0],{dimension:'country',operator:'equals',expression:'esp'});
 assert.equal(gsc.siteUrl('sc-domain:cammicgo.com'),'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Acammicgo.com');
});
test('Search Console rows and totals', ()=>{
 const rows=gsc.rowsOf([{keys:['probar micrófono','esp'],clicks:3,impressions:100,ctr:0.03,position:12.345},{keys:['test micro','fra'],clicks:1,impressions:300,ctr:0.00333,position:40}],['query','country']);
 assert.deepEqual(rows[0],{clicks:3,impressions:100,ctr:3,position:12.3,query:'probar micrófono',country:'esp'});
 assert.deepEqual(gsc.totals(rows),{clicks:4,impressions:400,ctr:1,position:33.1});
});
test('what changed: movers, new and lost items, CTR drops, position moves', ()=>{
 const R=(query:string,clicks:number,impressions:number,ctr:number,position:number)=>({query,clicks,impressions,ctr,position});
 const cur=[R('a',10,200,5,8),R('b',1,300,0.3,12),R('new',4,50,8,9),R('c',2,100,2,20)];
 const prev=[R('a',2,150,1.3,15),R('b',6,280,2.1,11),R('lost',5,60,8.3,7),R('c',2,100,2,14)];
 const r=gsc.comparePeriods(cur,prev,'query',{top:5,minImpressions:20});
 assert.equal(r.gainers[0].key,'a');assert.equal(r.gainers[0].clicksDelta,8);
 assert.equal(r.losers[0].key,'b');
 assert.deepEqual(r.newItems.map(x=>x.key),['new']);assert.deepEqual(r.lostItems.map(x=>x.key),['lost']);
 assert.deepEqual(r.ctrDrops.map(x=>x.key),['b']);
 assert.deepEqual(r.positionGains.map(x=>x.key),['a']);assert.deepEqual(r.positionLosses.map(x=>x.key),['c']);
 assert.equal(r.totals.current.clicks,17);assert.equal(r.totals.previous.clicks,15);
});
test('URL inspection summary flags canonical differences and rich result issues', ()=>{
 const s=gsc.inspectionSummary('https://www.cammicgo.com/es/microphone-test',{inspectionResult:{indexStatusResult:{verdict:'PASS',coverageState:'Submitted and indexed',googleCanonical:'https://www.cammicgo.com/es/microphone-test',userCanonical:'https://www.cammicgo.com/es/microphone-test/',lastCrawlTime:'2026-10-20T10:00:00Z',sitemap:['https://www.cammicgo.com/sitemap.xml']},
  richResultsResult:{verdict:'PASS',detectedItems:[{richResultType:'FAQ',items:[{name:'FAQ',issues:[{issueMessage:'Missing field',severity:'WARNING'}]}]}]}}});
 assert.equal(s.indexed,true);assert.equal(s.canonicalDiffers,true);
 assert.deepEqual(s.richResults,{verdict:'PASS',types:[{type:'FAQ',issues:['WARNING: Missing field']}]});
 assert.equal(gsc.inspectionSummary('x',{}).indexed,false);
});
test('invalid dates are refused without throwing', ()=>{
 assert.ok('error' in gsc.gscPeriod({startDate:'2026-02-30'},NOW));
 assert.ok('error' in gsc.gscPeriod({endDate:'2026-13-01'},NOW));
 assert.ok('error' in ga4.periods({endDate:'2026-00-10'},NOW));
});
