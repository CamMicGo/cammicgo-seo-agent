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

import {cleanAnalysis} from '../lib/linkedin-reactions.ts';
test('AI analysis: cleaned, escaped, rendered above comments and labelled as written by the assistant', ()=>{
  const B='https://seo.cammicgo.com';
  const payload=reportPayload({uiLang:'fr',postUrl:'https://www.linkedin.com/feed/update/urn:li:activity:1234567890123/',post:{author:'Alice',text:'x'},comments:{comments:[{author:'Bob',text:'Bravo'}]},reactions:{byType:{like:1},people:[{name:'Eve',reaction:'like',headline:'Dev'}]}},B)!;
  payload.analysis=cleanAnalysis({title:'Graphismes de <GTA VI>',postSummary:'Résumé',commentsSummary:'Avis',sentiment:{positive:2,neutral:1,negative:0},opinions:['Très clair','x'.repeat(900)],audience:[{domain:'Géomatique',count:6},{domain:'',count:3}],takeaways:['Publier des visuels']},'ChatGPT');
  const html=reportHtml(payload,B);
  assert.match(html,/<h2>Publication — Graphismes de &lt;GTA VI&gt;<\/h2>/);
  assert.match(html,/Rédigé par l’assistant IA \(ChatGPT\)/);
  assert.match(html,/Positif 66\.7 %/);
  assert.match(html,/Géomatique/);
  assert.ok(html.indexOf('Principaux avis')<html.indexOf('<h2>Commentaires'),'analysis before the raw comments');
  assert.equal((payload.analysis as {opinions:string[]}).opinions[1].length,400,'long items are cut');
  assert.equal((payload.analysis as {audience:unknown[]}).audience.length,1,'empty domains dropped');
});
