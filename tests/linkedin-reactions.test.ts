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
