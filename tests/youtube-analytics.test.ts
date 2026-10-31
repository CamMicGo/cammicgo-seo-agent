// Unit tests for lib/youtube-analytics.ts — run with: npm test
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as y from '../lib/youtube-analytics.ts';

const NOW=Date.parse('2026-10-31T15:00:00Z');

test('period ends yesterday by default and the previous period has the same length', ()=>{
 const p=y.resolvePeriod({days:28},NOW);
 assert.deepEqual(p,{startDate:'2026-10-03',endDate:'2026-10-30',days:28});
 if('error' in p)throw Error('unexpected');
 assert.deepEqual(y.previousPeriod(p),{startDate:'2026-09-05',endDate:'2026-10-02',days:28});
});
test('explicit dates win; invalid or reversed dates are refused; very old dates are clamped', ()=>{
 assert.deepEqual(y.resolvePeriod({startDate:'2026-01-01',endDate:'2026-01-31',days:7},NOW),{startDate:'2026-01-01',endDate:'2026-01-31',days:31});
 assert.ok('error' in y.resolvePeriod({startDate:'2026-02-30'},NOW));
 assert.ok('error' in y.resolvePeriod({startDate:'2026-03-02',endDate:'2026-03-01'},NOW));
 const old=y.resolvePeriod({startDate:'2001-01-01',endDate:'2005-03-01'},NOW);
 assert.ok(!('error' in old)&&old.startDate==='2005-02-14');
});
test('report URL carries ids, metrics, dimensions, filters joined with ";" and sort', ()=>{
 const u=new URL(y.reportUrl({ids:y.channelIds(),startDate:'2026-10-01',endDate:'2026-10-30',metrics:['views','estimatedMinutesWatched'],dimensions:['insightTrafficSourceDetail'],filters:['insightTrafficSourceType==YT_SEARCH','video==dQw4w9WgXcQ'],sort:'-views',maxResults:25}));
 assert.equal(u.origin+u.pathname,'https://youtubeanalytics.googleapis.com/v2/reports');
 assert.equal(u.searchParams.get('ids'),'channel==MINE');
 assert.equal(u.searchParams.get('metrics'),'views,estimatedMinutesWatched');
 assert.equal(u.searchParams.get('filters'),'insightTrafficSourceType==YT_SEARCH;video==dQw4w9WgXcQ');
 assert.equal(u.searchParams.get('sort'),'-views');
 assert.equal(u.searchParams.get('maxResults'),'25');
 assert.equal(y.channelIds('UC_x5XG1OV2P6uZZ5FSM9Ttw'),'channel==UC_x5XG1OV2P6uZZ5FSM9Ttw');
 assert.ok(y.CHANNEL_ID.test('UC_x5XG1OV2P6uZZ5FSM9Ttw')&&!y.CHANNEL_ID.test('UCshort'));
});
test('totals in readable units and change against the previous period', ()=>{
 const rep={columnHeaders:y.BASIC_METRICS.map(name=>({name})),rows:[[1200,1530,185,41.26,30,4,80,12,6]]};
 const cur=y.friendlyTotals(y.rowsOf(rep)[0]);
 assert.deepEqual(cur,{views:1200,watchTimeHours:25.5,averageViewDuration:'3:05',averageViewPercentage:41.3,subscribersGained:30,subscribersLost:4,subscribersNet:26,likes:80,comments:12,shares:6});
 const prev=y.friendlyTotals(y.rowsOf({columnHeaders:rep.columnHeaders,rows:[[1000,1530,185,40,10,0,80,0,6]]})[0]);
 const c=y.compareTotals(cur,prev);
 assert.equal(c?.views,20);assert.equal(c?.subscribersNet,160);assert.equal(c?.comments,null);assert.equal(c?.shares,0);
 assert.equal(y.friendlyTotals(undefined),null);
});
test('durations', ()=>{
 assert.equal(y.duration(65),'1:05');assert.equal(y.duration(3725),'1:02:05');
 assert.equal(y.isoSeconds('PT1H2M3S'),3723);assert.equal(y.isoSeconds('PT45S'),45);assert.equal(y.isoSeconds('P1DT1S'),86401);assert.equal(y.isoSeconds(undefined),0);
});
test('daily series switch to weeks for long periods', ()=>{
 const rows=Array.from({length:100},(_,i)=>({day:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),views:10,estimatedMinutesWatched:60,subscribersGained:2,subscribersLost:1}));
 const s=y.dailySeries(rows);
 assert.equal(s.step,'week');assert.equal(s.points.length,15);
 assert.deepEqual(s.points[0],{from:'2026-01-01',to:'2026-01-07',views:70,watchTimeHours:7,subscribersNet:7});
 assert.equal(y.dailySeries(rows.slice(0,30)).step,'day');
});
test('breakdown rows get labels, hours and share of views', ()=>{
 const rows=y.breakdownRows([{insightTrafficSourceType:'YT_SEARCH',views:300,estimatedMinutesWatched:600},{insightTrafficSourceType:'RELATED_VIDEO',views:100,estimatedMinutesWatched:90}]);
 assert.deepEqual(rows[0],{insightTrafficSourceType:'YT_SEARCH',label:'YouTube search',views:300,watchTimeHours:10,shareOfViews:75});
 assert.equal(rows[1].label,'Suggested videos');
 const fmt=y.breakdownRows([{creatorContentType:'SHORTS',views:5,estimatedMinutesWatched:3,averageViewDuration:20}]);
 assert.equal(fmt[0].label,'Shorts');assert.equal(fmt[0].averageViewDuration,'0:20');
 const demo=y.breakdownRows([{ageGroup:'age25-34',gender:'male',viewerPercentage:41.234}]);
 assert.deepEqual(demo[0],{ageGroup:'age25-34',gender:'male',viewerPercentage:41.2});
 assert.ok(y.BREAKDOWN_NAMES.includes('youtubeSearchTerms'));
 for(const b of Object.values(y.BREAKDOWNS) as y.Breakdown[])if(b.filter)assert.ok((b.max??0)<=25,'detail reports are limited to 25 rows');
});
test('retention summary: key moments, steepest drops and comparison with similar videos', ()=>{
 const rows=Array.from({length:100},(_,i)=>{const x=(i+1)/100;const w=x<=0.3?1.1-x:x<=0.35?0.8-(x-0.3)*6:0.5-(x-0.35)*0.2;return {elapsedVideoTimeRatio:x,audienceWatchRatio:w,relativeRetentionPerformance:0.65};});
 const s=y.summarizeRetention(rows,600);
 assert.ok(s);
 assert.equal(s.keyMoments[0].at,'1%');
 assert.deepEqual(s.keyMoments.find(m=>m.at==='50%'),{at:'50%',time:'5:00',stillWatching:'47%'});
 assert.ok(s.steepestDrops.length>=1);
 assert.equal(s.steepestDrops[0].from.at,'30%');assert.equal(s.steepestDrops[0].lost,'30 points');
 assert.equal(s.relativeRetention,0.65);assert.equal(s.comparedWithSimilarVideos,'above typical');
 assert.equal(y.summarizeRetention([]),null);
});
test('comments are compacted, clipped and keep a few replies on request', ()=>{
 const long='word '.repeat(300);
 const t={id:'c1',snippet:{totalReplyCount:2,topLevelComment:{snippet:{authorDisplayName:'@ana',textDisplay:'  Great\n video  ',likeCount:5,publishedAt:'2026-10-01T10:00:00Z',updatedAt:'2026-10-02T10:00:00Z'}}},replies:{comments:[{snippet:{authorDisplayName:'@bob',textDisplay:long,likeCount:1}}]}};
 assert.deepEqual(y.compactThread(t),{id:'c1',author:'@ana',text:'Great video',likes:5,replies:2,publishedAt:'2026-10-01',edited:true});
 const w=y.compactThread(t,600,true);
 assert.equal(w.replyPreview?.length,1);assert.ok((w.replyPreview?.[0].text.length??0)<=300);assert.ok(w.replyPreview?.[0].text.endsWith('…'));
});
