import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decorateReactions} from '../lib/linkedin-reactions.ts';

test('reaction people get the hosted LinkedIn reaction picture and French label, nested results included', ()=>{
  const data={status:'ok',comments:{comments:[]},reactions:{byType:{like:1,funny:1},people:[{name:'A',reaction:'like'},{name:'B',reaction:'funny'},{name:'C',reaction:null}]}};
  decorateReactions(data,'https://seo.cammicgo.com');
  const p=data.reactions.people as Array<Record<string,unknown>>;
  assert.equal(p[0].reactionIconUrl,'https://seo.cammicgo.com/linkedin/reactions/like.png');
  assert.equal(p[1].reactionLabel,'Drôle');
  assert.equal(p[2].reactionIconUrl,undefined);
  assert.deepEqual((data.reactions as Record<string,unknown>).reactionIcons,{like:'https://seo.cammicgo.com/linkedin/reactions/like.png',funny:'https://seo.cammicgo.com/linkedin/reactions/funny.png'});
});

import {addReport,preferHostedPhotos} from '../lib/linkedin-reactions.ts';
test('report: hosted photos linked to profiles, LinkedIn reaction pictures, threaded comments', ()=>{
  const B='https://seo.cammicgo.com';
  const data:Record<string,unknown>={status:'ok',postUrl:'https://www.linkedin.com/feed/update/urn:li:activity:1/',
    post:{author:'Alice',authorProfileUrl:'https://www.linkedin.com/in/alice/',text:'Titre\nSuite',time:'1 j'},
    comments:{displayedCount:2,complete:true,comments:[{author:'Bob',authorProfileUrl:'https://www.linkedin.com/in/bob/',authorPhotoUrl:'https://media.licdn.com/x.jpg',imageUrl:B+'/api/linkedin/thumb/1.jpg',text:'Bravo',time:'2 h'},{author:'Alice',authorProfileUrl:'https://www.linkedin.com/in/alice/',isPostAuthor:true,isReply:true,parentAuthor:'Bob',text:'Merci'}]},
    reactions:{expectedTotal:2,complete:true,byType:{like:1,love:1},people:[{name:'Bob',profileUrl:'https://www.linkedin.com/in/bob/',photoUrl:'https://media.licdn.com/x.jpg',imageUrl:B+'/api/linkedin/thumb/1.jpg',reaction:'like',headline:'Dev'},{name:'Eve [x]',profileUrl:'https://www.linkedin.com/in/eve/',photoUrl:'https://media.licdn.com/e.jpg',imageUrl:'https://media.licdn.com/e.jpg',reaction:'love'}]}};
  preferHostedPhotos(data,B);addReport(data,B);
  const md=String(data.reportMarkdown);
  assert.match(md,/\[!\[Bob\]\(https:\/\/seo\.cammicgo\.com\/api\/linkedin\/thumb\/1\.jpg\)\]\(https:\/\/www\.linkedin\.com\/in\/bob\/\)/);
  assert.match(md,/!\[J’aime\]\(https:\/\/seo\.cammicgo\.com\/linkedin\/reactions\/like\.png\) J’aime — 1/);
  assert.match(md,/!\[J’adore\]\(https:\/\/seo\.cammicgo\.com\/linkedin\/reactions\/love\.png\) J’adore — 1/);
  assert.match(md,/\*\*\[Eve \\\[x\\\]\]\(https:\/\/www\.linkedin\.com\/in\/eve\/\)\*\*/,'no LinkedIn-only picture, name escaped');
  assert.ok(!md.includes('media.licdn.com'),'LinkedIn session-only links never shown as images');
  assert.match(md,/↳ \*\*\[Alice\]\(https:\/\/www\.linkedin\.com\/in\/alice\/\)\*\* · Auteur — en réponse à Bob/);
  assert.match(md,/Réactions — 2 \/ 2 \(complet\)/);
});

import {reportHtml,reportPayload} from '../lib/linkedin-reactions.ts';
test('report page: escaped content, only hosted pictures, links limited to LinkedIn', ()=>{
  const B='https://seo.cammicgo.com';
  const payload=reportPayload({postUrl:'https://www.linkedin.com/feed/update/urn:li:activity:1/',post:{author:'Alice <b>',authorProfileUrl:'https://www.linkedin.com/in/alice/',text:'<script>alert(1)</script>'},
    comments:{comments:[{author:'Bob',authorProfileUrl:'javascript:alert(1)',authorPhotoUrl:'https://media.licdn.com/x.jpg',text:'hi',isReply:false}]},
    reactions:{byType:{like:1},expectedTotal:1,complete:true,people:[{name:'Eve',profileUrl:'https://www.linkedin.com/in/eve/',photoUrl:B+'/api/linkedin/thumb/1.jpg',reaction:'like',headline:'Dev'}]}},B)!;
  const html=reportHtml(payload,B);
  assert.ok(!html.includes('<script>'),'no script injected');
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('javascript:'),'unsafe profile link dropped');
  assert.ok(!html.includes('media.licdn.com'),'session-only pictures not used');
  assert.ok(html.includes(B+'/api/linkedin/thumb/1.jpg'));
  assert.ok(html.includes(B+'/linkedin/reactions/like.png'));
  assert.ok(html.includes('href="https://www.linkedin.com/in/eve/"'));
});

test('report page: blue header with title and post id, PDF button with nonce, self-contained HTML export', ()=>{
  const B='https://seo.cammicgo.com';
  const payload=reportPayload({postUrl:'https://www.linkedin.com/feed/update/urn:li:activity:7530372844606803968/',post:{author:'Alice',text:'x'},
    reactions:{byType:{like:1},people:[{name:'Eve',profileUrl:'https://www.linkedin.com/in/eve/',photoUrl:B+'/api/linkedin/thumb/11111111-1111-1111-1111-111111111111.jpg',reaction:'like'}]}},B)!;
  const page=reportHtml(payload,B,{logo:'data:image/png;base64,LOGO',brandLogo:'data:image/png;base64,CMG',nonce:'abc',downloadUrl:'/api/linkedin/report/x?download=html'});
  assert.match(page,/<h1>Rapport de post LinkedIn<\/h1>/);
  assert.match(page,/Identifiant du post : urn:li:activity:7530372844606803968/);
  assert.match(page,/<script nonce="abc">/);
  assert.match(page,/Exporter en HTML/);
  assert.match(page,/Supprimer maintenant/);
  assert.match(page,/alt="CamMicGo SEO MCP"/);
  assert.ok(!/LINKEDIN|text-transform:uppercase/.test(page),'brand names keep their own casing');
  assert.match(page,/<img class="logo" src="data:image\/png;base64,LOGO" alt="LinkedIn">/);
  assert.match(page,/Aucun historique/);
  const file=reportHtml(payload,B,{images:{[B+'/api/linkedin/thumb/11111111-1111-1111-1111-111111111111.jpg']:'data:image/jpeg;base64,AAA'},reactionImg:()=>'data:image/png;base64,BBB'});
  assert.ok(!file.includes('<script'),'export has no script');
  assert.ok(!file.includes(B+'/api/linkedin/thumb/'),'photos embedded');
  assert.ok(file.includes('data:image/png;base64,BBB'));
});

test('report language follows the app language (English, Arabic right-to-left), French by default', ()=>{
  const B='https://seo.cammicgo.com';
  const base={postUrl:'https://www.linkedin.com/feed/update/urn:li:activity:7530372844606803968/',post:{author:'Alice',text:'x'},reactions:{byType:{like:1,celebrate:1},people:[{name:'Eve',reaction:'like'},{name:'Bob',reaction:'celebrate'}]}};
  const en=JSON.parse(JSON.stringify({...base,uiLang:'en'}));decorateReactions(en,B);addReport(en,B);
  assert.equal(en.reactions.people[1].reactionLabel,'Celebrate');
  assert.match(en.reportMarkdown,/### Reactions — 2/);
  const pageEn=reportHtml(reportPayload(en,B)!,B,{nonce:'n'});
  assert.match(pageEn,/<html lang="en">/);
  assert.match(pageEn,/<h1>LinkedIn post report<\/h1>/);
  assert.match(pageEn,/Export PDF/);
  assert.ok(!pageEn.includes('Exporter'));
  const ar=JSON.parse(JSON.stringify({...base,uiLang:'ar'}));
  assert.match(reportHtml(reportPayload(ar,B)!,B),/<html lang="ar" dir="rtl">/);
  const fr=JSON.parse(JSON.stringify(base));decorateReactions(fr,B);
  assert.equal(fr.reactions.people[1].reactionLabel,'Bravo');
});

import {cleanAnalysis,engagementOf,personKey} from '../lib/linkedin-reactions.ts';
import {JSDOM} from 'jsdom';

// Test fixture shaped like the reference post (GTA VI, 16 reactions, 3 comments incl. 1 author reply).
// It lives in the tests only: the generator never contains these values.
const B='https://seo.cammicgo.com';
const LI='https://www.linkedin.com/in/';
const kinds=[...Array(12).fill('like'),'love','love','insightful','funny'];
const heads=['Géomaticien SIG chez Atos','Cartographe','Ingénieure SIG','Technicien géomatique','Chargée SIG chez Atos',
 'Data scientist','Développeur IA chez Atos','Ingénieur data','Commercial grands comptes','Responsable marketing','Business developer',
 'Chef de projet','Responsable innovation','Doctorante en géographie','Ingénieur travaux',''];
function fixture(lang='fr'){
 return {uiLang:lang,postUrl:'https://www.linkedin.com/feed/update/urn:li:activity:1111111111111111111/',
  post:{author:'Autrice',authorProfileUrl:LI+'autrice/',text:'Analyse des graphismes',images:['https://media.licdn.com/dms/image/v2/abc/x.jpg','https://evil.example/x.jpg']},
  comments:{displayedCount:3,complete:true,comments:[
   {commentId:'urn:li:comment:(1,10)',author:'P1',authorProfileUrl:LI+'p0/',authorHeadline:heads[0],text:'Superbe analyse',isReply:false},
   {commentId:'urn:li:comment:(1,11)',parentId:'urn:li:comment:(1,10)',parentAuthor:'P1',author:'Autrice',authorProfileUrl:LI+'autrice/',text:'Merci !',isReply:true,isPostAuthor:true},
   {commentId:'urn:li:comment:(1,12)',author:'P6',authorProfileUrl:LI+'p5/',authorHeadline:heads[5],text:'Et la physique de l’eau ?',isReply:false}]},
  reactions:{expectedTotal:16,complete:true,byType:{like:12,love:2,insightful:1,funny:1},
   people:kinds.map((k,i)=>({name:'P'+(i+1),profileUrl:LI+'p'+i+'/?miniProfile=1',photoUrl:B+'/api/linkedin/thumb/'+i+'.jpg',headline:heads[i],reaction:k}))}};
}
const ids=(...n:number[])=>n.map(i=>LI+'p'+i+'/');
const analysis={title:'Graphismes de <GTA VI>',postSummary:'Résumé',commentsSummary:'Avis',
 domainGroups:[{label:'Géomatique, cartographie et SIG',profiles:ids(0,1,2,3,4)},{label:'Informatique, Data et IA',profiles:ids(5,6,7)},{label:'Commerce et marketing',profiles:ids(8,9,10)},
  {label:'Gestion de projet et innovation',profiles:ids(11,12)},{label:'Recherche scientifique',profiles:ids(13)},{label:'Ingénierie et travaux',profiles:ids(14)},{label:'Non déterminé',profiles:ids(15,0)}],
 companyGroups:[{label:'Atos',profiles:ids(0,4,6)}],
 commentSentiments:[{commentId:'urn:li:comment:(1,10)',sentiment:'positive'},{commentId:'urn:li:comment:(1,11)',sentiment:'positive'},{commentId:'urn:li:comment:(1,12)',sentiment:'neutral'}],
 themeGroups:[{label:'Réalisme',comments:['urn:li:comment:(1,10)','urn:li:comment:(1,12)']},{label:'Physique',comments:['urn:li:comment:(1,12)']}],
 targetGroups:[{label:'Tech',profiles:ids(0,1,2,3,4,5,6,7),insight:'Cœur de cible'}],
 arguments:{arguments:['Qualité visuelle'],questions:['Physique de l’eau ?'],criticisms:[],opinions:['Enthousiasme']},
 takeawayCards:[{title:'Audience géomatique',text:'31 %',icon:'audience'},{title:'X',text:'Y',icon:'<svg onload=alert(1)>'}],
 recommendations:[{title:'Série',text:'Comparer les moteurs'}],glossary:[{term:'SIG',definition:'Système d’information géographique'}],overall:'Synthèse finale',
 html:'<script>alert(1)</script>'};
function built(lang='fr',an:Record<string,unknown>|null=analysis){
 const p=reportPayload(fixture(lang),B)!;
 if(an)p.analysis=cleanAnalysis(an,'Claude');
 return p;
}

test('analysis v2: stable ids, one domain per person, legacy fields still accepted, no HTML kept', ()=>{
 const a=cleanAnalysis(analysis,'Claude');
 assert.equal(personKey(LI+'p0/?miniProfile=1'),personKey(LI+'P0'),'profile links normalised');
 assert.deepEqual(a.domainGroups!.map(g=>g.count),[5,3,3,2,1,1,1],'a person listed twice keeps their first domain');
 assert.deepEqual(a.sentiment,{positive:2,neutral:1,negative:0},'tone counted from per-comment sentiments');
 assert.equal(a.takeawayCards![1].icon,'idea','unknown icons replaced');
 assert.ok(!JSON.stringify(a).includes('<script>'),'unknown fields (html) dropped');
 const legacy=cleanAnalysis({title:'T',sentiment:{positive:1,neutral:0,negative:0},audience:[{domain:'GIS',count:2}],themes:[{label:'x',count:1}],takeaways:['a']},'ChatGPT');
 assert.equal(legacy.audience[0].count,2);assert.deepEqual(legacy.domainGroups,[]);assert.deepEqual(legacy.takeaways,['a']);
});

test('engagement figures are computed from the data: interactions, unique people, author reply rate, completeness', ()=>{
 const e=engagementOf(built());
 assert.equal(e.reactions,16);assert.equal(e.comments,3);assert.equal(e.interactions,19);
 assert.equal(e.participants,17,'16 reacting people + the author (commenters already counted)');
 assert.equal(e.replyRate,50);assert.equal(e.repliedDirect,1);assert.equal(e.direct,2);assert.equal(e.complete,true);
 const noComments=reportPayload({...fixture(),comments:{comments:[]}},B)!;
 assert.equal(engagementOf(noComments).replyRate,null,'no direct comment: not calculable');
 assert.match(reportHtml(noComments,B),/non calculable/);
});

test('dashboard: reaction bars with real pictures, labels, counts and shares; bars are links to filters (no script needed)', ()=>{
 const html=reportHtml(built(),B,{reactionImg:t=>'data:image/png;base64,'+t.toUpperCase()});
 assert.match(html,/<section class="sec" id="engagement"><h2>Engagement<\/h2>/);
 for(const [t,label,n,pc] of [['like','J’aime',12,'75 %'],['love','J’adore',2,'12,5 %'],['insightful','Instructif',1,'6,3 %'],['funny','Drôle',1,'6,3 %']] as const){
  const re=new RegExp(`<a class="bar" href="#f-reaction-${t}" data-f="reaction" data-v="${t}"[\\s\\S]*?class="bv">${n}</text><image href="data:image/png;base64,${t.toUpperCase()}"[\\s\\S]*?class="bl">${label}</text><text[^>]*class="bp">${pc}</text>`);
  assert.match(html,re,t);
 }
 assert.match(html,/<b>19<\/b><span>Interactions totales<\/span>/);
 assert.match(html,/<b>17<\/b><span>Participants uniques<\/span>/);
 assert.match(html,/<b>50 %<\/b><span>Taux de réponse de l’auteur \(1\/2\)<\/span>/);
 assert.equal((html.match(/<article class="pc" data-reaction="like"/g)||[]).length,12*3,'12 like cards in each people panel');
});

test('audience: domain donut (total in the centre, %), Atos bars, target note, cards carry company and domain', ()=>{
 const html=reportHtml(built(),B);
 assert.match(html,/<text x="70" y="68" text-anchor="middle" class="dc">16<\/text>/);
 assert.match(html,/data-f="domain" data-v="0"><i style="background:#0a66c2"><\/i><span>Géomatique, cartographie et SIG<\/span><b>5 · 31,3 %<\/b>/);
 assert.match(html,/<span>Non déterminé<\/span><b>1 · 6,3 %<\/b>/);
 assert.match(html,/data-f="company" data-v="0"><div class="hbt"><span>Atos<\/span><b>3 · 18,8 %<\/b>/);
 assert.match(html,/et non l’ensemble des personnes l’ayant consultée/);
 assert.match(html,/<article class="pc" data-reaction="like" data-domain="0" data-company="0">[\s\S]*?Entreprise : Atos[\s\S]*?Domaine : Géomatique/);
 assert.match(html,/<article class="pc" data-reaction="funny" data-domain="6" data-company="">/,'no employer invented');
});

test('comment tone: 3 legend lines even at 0, no red segment without negatives, centre = messages analysed', ()=>{
 const html=reportHtml(built(),B);
 const tone=html.slice(html.indexOf('Tonalité des commentaires'));
 assert.match(tone,/class="dc">3<\/text><text[^>]*class="ds">messages<\/text>/);
 assert.match(tone,/<span>Positif<\/span><b>2 · 66,7 %<\/b>/);
 assert.match(tone,/<span>Neutre<\/span><b>1 · 33,3 %<\/b>/);
 assert.match(tone,/<span>Négatif<\/span><b>0 · 0 %<\/b>/,'negative shown at 0');
 assert.ok(!/stroke="#dc2626"/.test(html),'no red arc');
 assert.match(html,/data-sentiment="positive" data-theme="0"/);
 assert.match(html,/data-sentiment="neutral" data-theme="0 1"/,'a comment can belong to several themes');
 assert.match(html,/#f-theme-1:target~\.cards \.cm:not\(\[data-theme~="1"\]\)\{display:none\}/);
 assert.match(html,/<span class="badge">Auteur<\/span>/);
 assert.match(html,/class="cm reply"/);
});

test('themes sorted by occurrences, arguments, takeaway cards with icons, recommendations, glossary, overall synthesis', ()=>{
 const html=reportHtml(built(),B);
 assert.ok(html.indexOf('<span>Réalisme</span>')<html.indexOf('<span>Physique</span>'));
 assert.match(html,/<h5><svg class="ic"[^>]*>[\s\S]*?<\/svg>Interrogations<\/h5><ul><li>Physique de l’eau \?<\/li>/);
 assert.ok(!html.includes('>Critiques</h5>'),'empty boxes hidden');
 assert.match(html,/<div class="tk"><svg class="ic"[\s\S]*?<h5>Audience géomatique<\/h5>/);
 assert.match(html,/ce ne sont pas des prédictions/);
 assert.match(html,/<details><summary>SIG<\/summary><p>Système d’information géographique<\/p><\/details>/);
 assert.match(html,/<h2>Synthèse globale<\/h2><div class="card"><p class="txt">Synthèse finale/);
 assert.ok(!html.includes('onload=alert'),'no markup from the assistant');
 const order=['id="post"','id="engagement"','id="audience"','id="comments"','id="takeaways"','id="recommendations"','id="glossary"','id="overall"'].map(x=>html.indexOf(x));
 assert.deepEqual([...order].sort((a,b)=>a-b),order,'section order');
});

// Real browser (Chromium via Playwright) when available: the filters are CSS, so they are checked as rendered.
async function browser(){try{const {createRequire}=await import('node:module');const m=createRequire(import.meta.url)('playwright');return await m.chromium.launch();}catch{return null;}}
const visibleCount=(sel:string)=>`[...document.querySelectorAll('${sel}')].filter(e=>getComputedStyle(e).display!=='none'&&e.closest('.cards')&&getComputedStyle(e.closest('.cards')).display!=='none').length`;
test('filters work in a real browser with scripts OFF: bars, donut legend, companies, tone, themes, "show all", print', async t=>{
 const b=await browser();if(!b){t.skip('playwright not installed');return;}
 const {writeFileSync,mkdtempSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const file=join(mkdtempSync(join(tmpdir(),'rep-')),'r.html');writeFileSync(file,reportHtml(built(),B,{nonce:'n1'}));
 try{for(const size of [{width:1200,height:900},{width:390,height:800}]){
  const p=await (await b.newContext({javaScriptEnabled:false,viewport:size})).newPage();p.setDefaultTimeout(5000);
  await p.goto('file://'+file);
  const n=(sel:string)=>p.evaluate(visibleCount(sel));
  assert.equal(await n('#pp-reaction .pc'),16);assert.equal(await n('#pp-domain .pc'),0,'domain panel waits for a choice');
  await p.click('a.bar[data-v="love"]');
  assert.equal(await n('#pp-reaction .pc'),2,'love bar → 2 cards');
  assert.equal(await p.evaluate(`getComputedStyle(document.querySelector('a.bar[data-v="love"] .bfill')).fill`),'rgb(0, 65, 130)','selected bar highlighted');
  await p.click('a.bar[data-v="like"]');assert.equal(await n('#pp-reaction .pc'),12);
  await p.click('#pp-reaction .reset');assert.equal(await n('#pp-reaction .pc'),16,'show all');
  await p.click('a.lgb[data-f="domain"][data-v="0"]');assert.equal(await n('#pp-domain .pc'),5);
  await p.click('a.hb[data-f="company"][data-v="0"]');assert.equal(await n('#pp-company .pc'),3);
  await p.click('a.lgb[data-f="sentiment"][data-v="neutral"]');assert.equal(await n('#cp .cm'),1);
  await p.click('a.hb[data-f="theme"][data-v="0"]');assert.equal(await n('#cp .cm'),2);
  if(size.width<900)assert.ok(Math.abs(await p.evaluate(`document.querySelector('#cp').getBoundingClientRect().top`) as number)<40,'mobile: the list scrolls into view');
  await p.click('a.bar[data-v="funny"]');
  await p.emulateMedia({media:'print'});
  assert.equal(await n('#pp-reaction .pc'),16,'print shows every card whatever the filter');
  assert.equal(await n('#cp .cm'),3);
  await p.emulateMedia({media:'screen'});
  await p.context().close();
 }}finally{await b.close();}
});

test('PDF print rules and self-contained HTML export', ()=>{
 const html=reportHtml(built(),B,{nonce:'n1'});
 const print=html.slice(html.indexOf('@media print'));
 assert.match(print,/\.cards \.pc\{display:flex!important\}/);
 assert.match(print,/\.wait \.cards\{display:block!important\}/);
 assert.match(print,/print-color-adjust:exact/);
 assert.match(html,/\.panel \.pcount::before\{content:"" counter\(n\) " profil\(s\) affiché\(s\)"\}/,'visible count made by CSS counters');
 assert.match(print,/\.tools,\.reset,\.hint,\.phd\{display:none!important\}/);
 assert.match(html,/addEventListener\('beforeprint',function\(\)\{document\.querySelectorAll\('details'\)/,'glossary opened for the PDF');
 const file=reportHtml(built(),B,{images:{[B+'/api/linkedin/thumb/0.jpg']:'data:image/jpeg;base64,AAA'},reactionImg:()=>'data:image/png;base64,BBB',interactive:true});
 assert.match(file,/<a class="bar" href="#f-reaction-funny"/,'export keeps the filters (CSS)');
 assert.ok(!file.includes('id="del"')&&!file.includes("method:'DELETE'"),'no delete in the export');
 assert.ok(file.includes('data:image/jpeg;base64,AAA'));
});

test('incomplete or empty reports: no analysis, no comments, no reactions, partial extraction', ()=>{
 const p=reportPayload({...fixture(),reactions:{...fixture().reactions,complete:false}},B)!;
 const html=reportHtml(p,B);
 assert.match(html,/<b>partielle<\/b><span>Extraction<\/span>/);
 assert.ok(!html.includes('id="audience"'),'no audience section without analysis');
 assert.ok(!html.includes('id="glossary"'));
 const onlyComments=reportPayload({postUrl:fixture().postUrl,comments:{comments:[]}},B)!;
 const h2=reportHtml(onlyComments,B,{nonce:'x'});
 assert.ok(!h2.includes('<svg class="rc"'),'no empty reaction chart');
 assert.doesNotThrow(()=>new JSDOM(h2,{runScripts:'dangerously'}));
 const sparse=built('fr',{title:'T',commentSentiments:[],domainGroups:[{label:'Vide',profiles:[]}],glossary:[{term:'x',definition:''}]});
 const h3=reportHtml(sparse,B);
 assert.ok(!h3.includes('Vide'),'empty categories dropped');
 assert.ok(!h3.includes('Tonalité des commentaires'),'no tone chart without data');
});

test('post illustrations: only embedded images are shown, nothing loaded from LinkedIn or elsewhere', ()=>{
 const p=reportPayload(fixture(),B)!;
 assert.deepEqual((p.post as {images:string[]}).images,['https://media.licdn.com/dms/image/v2/abc/x.jpg'],'only LinkedIn image CDN kept, then embedded by the server');
 assert.ok(!reportHtml(p,B).includes('class="gal"'),'not embedded yet: not shown');
 (p.post as {images:string[]}).images=['data:image/jpeg;base64,QUJD','data:text/html;base64,PHNjcmlwdD4='];
 const html=reportHtml(p,B);
 assert.match(html,/<div class="gal"[^>]*><img src="data:image\/jpeg;base64,QUJD"/);
 assert.ok(!html.includes('data:text/html'));
});

test('every language has every label; no French left in other languages', ()=>{
 for(const lang of ['en','fr','es','de','pt','it','ru','zh','ja','ko','ar']){
  const html=reportHtml(built(lang),B,{nonce:'n'});
  assert.ok(!/undefined|\{agent\}/.test(html.replace(/<script[\s\S]*<\/script>/,'')),lang);
  if(lang!=='fr')for(const fr of ['Taux de réponse','Synthèse globale','Glossaire','Tout afficher','Négatif'])assert.ok(!html.includes(fr),lang+': '+fr);
 }
 assert.match(reportHtml(built('en'),B),/<h2>Overall synthesis<\/h2>|<h2>Overall summary<\/h2>/);
});

import {reconcileReactions} from '../lib/linkedin-reactions.ts';
test('reaction surplus: a comment author picked up outside the list (no headline) is removed, never more than the surplus', ()=>{
 const f=fixture();
 f.reactions.people.unshift({name:'P6',profileUrl:LI+'p5/',photoUrl:'',headline:'',reaction:'like'});
 reconcileReactions(f);
 assert.equal(f.reactions.people.length,16);
 assert.equal((f.reactions.byType as Record<string,number>).like,12);
 const g=fixture();reconcileReactions(g);assert.equal(g.reactions.people.length,16,'nothing removed without surplus');
});

import {companiesFromHeadlines} from '../lib/linkedin-reactions.ts';
test('companies from headlines when the assistant sent none: explicit names only, 2+ people, clickable', ()=>{
 const g=companiesFromHeadlines([{headline:'Ingénieur d’études chez Atos',url:LI+'a'},{headline:'Business Developer chez ATOS | IT',url:LI+'b'},{headline:'Senior Project Manager at Atos',url:LI+'c'},{headline:'Passionate at heart',url:LI+'d'},{headline:'Chef de projet',url:LI+'e'}]);
 assert.equal(g.length,1);assert.equal(g[0].count,3);assert.equal(g[0].label,'Atos');
 const p=built('fr',{title:'T',audience:[{domain:'SIG',count:16}]});
 const html=reportHtml(p,B);
 assert.match(html,/data-f="company" data-v="0"><div class="hbt"><span>Atos<\/span><b>3 · 18,8 %<\/b>/);
 assert.equal((html.match(/<article class="pc"[^>]*data-company="0"/g)||[]).length,3*2,'the 3 Atos cards (reaction and company panels) can be filtered');
});
test('a person met twice (vanity link in comments, member link in reactions) counts once', ()=>{
 const f=fixture();f.comments.comments[2].authorProfileUrl=LI+'vanity-p6/';
 assert.equal(engagementOf(reportPayload(f,B)!).participants,17);
});

import {assistantView} from '../lib/linkedin-reactions.ts';
test('large posts: the assistant gets a compact answer (ids, names, headlines, texts), the report keeps everything', ()=>{
 const small=fixture() as Record<string,unknown>;small.reportUrl=B+'/api/linkedin/report/x';
 assert.equal(assistantView(small),small,'small results unchanged');
 const big=fixture() as Record<string,unknown>;big.reportUrl=B+'/api/linkedin/report/x';big.reportMarkdown='x'.repeat(200000);
 const r=big.reactions as {people:Record<string,unknown>[]};
 r.people=Array.from({length:900},(_,i)=>({name:'N'+i,profileUrl:LI+'n'+i+'/',headline:'H'+i,reaction:'like',photoUrl:B+'/api/linkedin/thumb/'+i+'.jpg',linkedinPhotoUrl:'https://media.licdn.com/'+'y'.repeat(200)}));
 type V={compact:boolean;reportUrl:string;note:string;reactions:{people:Record<string,unknown>[]};comments:{comments:Array<{commentId:string}>}};
 const v=assistantView(big) as V;
 assert.equal(v.compact,true);assert.equal(v.reportUrl,big.reportUrl);
 assert.equal(v.reactions.people.length,300);assert.deepEqual(Object.keys(v.reactions.people[0]).sort(),['headline','name','profileUrl','reaction']);
 assert.match(v.note,/300 of the 900/);
 assert.equal(v.comments.comments[0].commentId,'urn:li:comment:(1,10)');
 assert.ok(!('reportMarkdown' in v));
 assert.ok(JSON.stringify(v).length<70000,'compact size');
});
