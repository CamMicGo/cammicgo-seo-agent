/* eslint-disable @typescript-eslint/no-explicit-any -- jsdom windows and the injected reader are untyped */
/**
 * FIXTURE tests of the LinkedIn reader shipped in the Android app
 * (android-kamiko/app/src/main/assets/linkedin/cmg-li.js). They run the exact shipped script on saved,
 * fictional LinkedIn-like pages in jsdom. They are NOT live tests: they prove the logic on known layouts,
 * not that LinkedIn currently serves these layouts. Live checks are in tests/live/linkedin-live.md.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const plain=(v:unknown)=>JSON.parse(JSON.stringify(v));
const LIB=readFileSync(new URL('../android-kamiko/app/src/main/assets/linkedin/cmg-li.js',import.meta.url),'utf8');
const fixture=(name:string)=>readFileSync(new URL('./fixtures/linkedin/'+name,import.meta.url),'utf8');
const BLOCK=/^(DIV|P|LI|UL|OL|H[1-6]|SECTION|ARTICLE|HEADER|FOOTER|MAIN|NAV|ASIDE|TABLE|TR|FORM|BLOCKQUOTE)$/;

type Li={[k:string]:any};
function page(name:string,url:string,opts:{html?:string;before?:(w:any)=>void}={}){
  const dom=new JSDOM(opts.html??fixture(name),{url,runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w:any){
    w.__cmgLiNoLayout=true;w.__cmgLiDelayScale=0.02;
    // jsdom has no layout, so no innerText: approximate it (block elements start new lines, hidden ones are skipped).
    const it=(n:any):string=>{if(n.nodeType===3)return n.data;if(n.nodeType!==1)return '';if(n.hidden||/display:\s*none/.test(n.getAttribute('style')||''))return '';if(/^(SCRIPT|STYLE|TEMPLATE)$/.test(n.tagName))return '';if(n.tagName==='BR')return '\n';const s=[...n.childNodes].map(it).join('');return BLOCK.test(n.tagName)?'\n'+s+'\n':s;};
    Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return it(this).replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n+/g,'\n').trim();}});
    opts.before?.(w);
  }});
  const w=dom.window as any;
  w.eval(LIB);
  return {w,li:w.__cmgLi as Li};
}
const noForbiddenClicks=(w:any)=>{
  assert.equal(w.__overflowClicked,undefined,'an overflow (three dots) menu was clicked');
  assert.equal(w.__likeClicked,undefined,'a reaction button was clicked');
};

// ------------------------------------------------------------------ click safety (unit)
test('unit: overflow menus are recognised in several languages and layouts', ()=>{
  const {w,li}=page('search-no-results.html','https://www.linkedin.com/search/results/content/?keywords=x');
  const make=(html:string)=>{const d=w.document.createElement('div');d.innerHTML=html;w.document.body.appendChild(d);return d.firstElementChild;};
  for(const html of [
    '<button>More options for comment</button>',
    '<button aria-label="See more options for comment by Tom Ricard">x</button>',
    '<button aria-label="Plus d’options pour le commentaire de Sara">⋯</button>',
    '<button aria-label="Ouvrir le menu de commandes pour la publication">x</button>',
    '<button aria-haspopup="true">Voir</button>',
    '<button><svg data-test-icon="overflow-web-ios-small"></svg></button>',
    '<button>…</button>',
    '<button class="comment-options-trigger">x</button>',
  ])assert.equal(li._test.isOverflow(make(html)),true,html);
  for(const html of ['<button>Load more comments</button>','<button>Voir 2 réponses</button>','<button>Afficher plus de commentaires</button>','<button aria-label="14 réactions">14</button>','<button aria-label="Commenter">Commenter</button>'])
    assert.equal(li._test.isOverflow(make(html)),false,html);
  assert.equal(li._test.refusal(make('<button aria-label="Réagir avec J’aime" aria-pressed="false">J’aime</button>'),'open_reactions'),'reaction_toggle');
  assert.equal(li._test.refusal(make('<button>Supprimer</button>'),'expand_comments'),'unsafe_action');
});

test('unit: reaction types from labels, SVG traits and LinkedIn internal names (6 types, FR/EN)', ()=>{
  const {li}=page('search-no-results.html','https://www.linkedin.com/feed/');
  const c=li._test.classifyReaction;
  for(const [s,t] of [['Like','like'],['J’aime','like'],['Celebrate','celebrate'],['Bravo','celebrate'],['praise-consumption-small','celebrate'],['Support','support'],['Soutien','support'],['appreciation-consumption-small','support'],['Love','love'],['J’adore','love'],['empathy-consumption-small','love'],['Insightful','insightful'],['Instructif','insightful'],['interest-consumption-small','insightful'],['Funny','funny'],['Drôle','funny'],['entertainment-consumption-small','funny']])
    assert.equal(c(s),t,s);
  assert.equal(li._test.reactionTotal({getAttribute:(n:string)=>n==='aria-label'?'Tom Ricard et 13 autres personnes':'',innerText:''}),14);
  assert.equal(li._test.parseCount('1 234 réactions'),1234);
  assert.equal(li._test.parseCount('1,2 k'),1200);
  assert.equal(li._test.urnFromString('https://www.linkedin.com/posts/carla-dupont_design-activity-7311111111111111111-AbCd'),'urn:li:activity:7311111111111111111');
});

// ------------------------------------------------------------------ search
test('fixture: post search on the new layout finds posts without data-urn, filters by author, ranks keywords', async ()=>{
  const {w,li}=page('search-sdui-fr.html','https://www.linkedin.com/search/results/content/?keywords=graphismes');
  const r=await li.searchPosts({keywords:'graphismes ray tracing PBR 4K',author:'Alice Martin',limit:10,scrolls:0});
  assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));
  assert.equal(r.unfiltered,3,'three posts on the page');
  assert.equal(r.posts.length,2,'two posts by the author');
  const top=r.posts[0];
  assert.equal(top.author,'Alice Martin');
  assert.equal(top.authorProfileUrl,'https://www.linkedin.com/in/alice-martin-123/');
  assert.match(top.authorPhotoUrl,/profile-displayphoto/);
  assert.equal(top.authorHeadline,'Développeuse moteur 3D chez Studio Nord');
  assert.match(top.text,/ray tracing, rendu PBR/);
  assert.equal(top.imageCount,4);
  assert.equal(top.reactionCount,14);
  assert.equal(top.commentCount,3);
  assert.ok(top.match.score>r.posts[1].match.score);
  assert.equal(top.postUrl,'https://www.linkedin.com/feed/update/urn:li:activity:7300000000000000001/','URN of the text block (tracking scope) attached to the whole post');
  assert.equal(top.time,'3 j');
  assert.ok(!/Développeuse/.test(top.text),'headline not mixed into the text');
  assert.equal(r.posts[1].postUrl,'','no URN anywhere: no URL invented');
  noForbiddenClicks(w);
});

test('fixture: post URN read from any attribute (componentkey)', async ()=>{
  const {li}=page('search-sdui-fr.html','https://www.linkedin.com/search/results/content/?keywords=graphismes');
  const r=await li.searchPosts({keywords:'conférence',author:'Bruno',scrolls:0});
  assert.equal(r.posts.length,1);
  assert.equal(r.posts[0].postUrl,'https://www.linkedin.com/feed/update/urn:li:activity:7300000000000000002/');
});

test('fixture: "no results" and "extraction failure" are told apart', async ()=>{
  const a=page('search-no-results.html','https://www.linkedin.com/search/results/content/?keywords=zzz');
  const none=await a.li.searchPosts({keywords:'zzz',scrolls:0,firstWait:50});
  assert.equal(none.status,'no_results');
  const b=page('unrecognized-layout.html','https://www.linkedin.com/search/results/content/?keywords=zzz');
  const broken=await b.li.searchPosts({keywords:'zzz',scrolls:0,firstWait:50});
  assert.equal(broken.status,'extraction_failed');
  assert.ok(broken.diagnostics.dom,'structure diagnostics returned for a layout change');
  assert.ok(broken.diagnostics.page.bodyLength>1000);
});

test('fixture: no matching author is reported with the authors that were seen', async ()=>{
  const {li}=page('search-sdui-fr.html','https://www.linkedin.com/search/results/content/?keywords=graphismes');
  const r=await li.searchPosts({keywords:'graphismes',author:'Personne Inconnue',scrolls:0});
  assert.equal(r.status,'no_matching_post');
  assert.ok(r.authorsOnPage.some((a:string)=>a.startsWith('Alice Martin')));
});

// ------------------------------------------------------------------ feed
test('fixture: mobile feed extraction (plain buttons, slug permalinks, reshare, suggestion card ignored)', async ()=>{
  const {li}=page('feed-mobile-en.html','https://www.linkedin.com/feed/');
  const r=await li.collectPosts({limit:20,scrolls:0});
  assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));
  assert.deepEqual(plain(r.posts.map((p:Li)=>p.author)),['Carla Dupont','Acme Tools','Eva Lind','Farid K.']);
  assert.equal(r.posts[0].postUrl,'https://www.linkedin.com/feed/update/urn:li:activity:7311111111111111111/');
  assert.equal(r.posts[0].reactionCount,12);
  assert.equal(r.posts[0].commentCount,4);
  assert.equal(r.posts[2].postUrl,'https://www.linkedin.com/feed/update/urn:li:activity:7322222222222222299/');
  assert.match(r.posts[3].text,/remote work/);
});

// ------------------------------------------------------------------ comments
test('fixture: comments on a desktop post — expansion, nested replies, Author badge, photos, no menu click', async ()=>{
  const {w,li}=page('post-comments-desktop-en.html','https://www.linkedin.com/feed/update/urn:li:activity:7322222222222222222/');
  const r=await li.readComments({postUrl:'https://www.linkedin.com/feed/update/urn:li:activity:7322222222222222222/'});
  assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));
  assert.equal(r.opened,'already_open');
  const by=(n:string)=>r.comments.find((c:Li)=>c.author===n);
  assert.deepEqual(plain(r.comments.map((c:Li)=>c.author)),['Tom Ricard','Sara Benali','Alice Martin','Jules Moreau','Nina Perez','Marc Olivier','Léa Fontaine']);
  assert.equal(r.displayedCount,7);
  assert.equal(r.complete,true);
  assert.equal(by('Tom Ricard').text,'Great breakdown, the PBR part is spot on.');
  assert.equal(by('Tom Ricard').authorProfileUrl,'https://www.linkedin.com/in/tom-ricard/');
  assert.match(by('Tom Ricard').authorPhotoUrl,/tom\/profile-displayphoto/);
  assert.equal(by('Tom Ricard').authorHeadline,'Lead developer');
  assert.equal(by('Tom Ricard').time,'2h');
  assert.equal(by('Tom Ricard').reactionCount,2);
  assert.equal(by('Tom Ricard').commentId,'urn:li:comment:(activity:7322222222222222222,7400000000000000001)');
  assert.match(by('Sara Benali').text,/2 MB constant buffers/);
  const reply=by('Alice Martin');
  assert.equal(reply.isReply,true);
  assert.equal(reply.parentAuthor,'Sara Benali');
  assert.equal(reply.parentId,by('Sara Benali').commentId);
  assert.equal(reply.isPostAuthor,true,'Author badge kept as a flag');
  assert.equal(reply.author,'Alice Martin','badge never replaces the name');
  assert.equal(by('Nina Perez').parentAuthor,'Jules Moreau','collapsed reply opened and threaded');
  assert.equal(by('Sara Benali').isPostAuthor,false,'a mention of the author in the text is not the badge');
  assert.ok(r.expandClicks>=2);
  noForbiddenClicks(w);
  assert.ok(!li._test.clickLog.some((c:Li)=>/options|menu/i.test(c.label)&&!c.refused),'no menu click attempted');
});

test('fixture: comment sheet open over search results is read in place (no navigation, no menu click)', async ()=>{
  const {w,li}=page('search-comment-sheet-fr.html','https://www.linkedin.com/search/results/content/?keywords=graphismes');
  assert.equal(li.targetOpen({}).open,true,'caller must not navigate away');
  const r=await li.readComments({});
  assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));
  assert.equal(r.scope,'open_panel');
  assert.deepEqual(plain(r.comments.map((c:Li)=>[c.author,c.isReply,c.parentAuthor])),[['Tarik Mezza',false,null],['Sara Benali',false,null],['Alice Martin',true,'Sara Benali']]);
  const alice=r.comments[2];
  assert.equal(alice.isPostAuthor,true);
  assert.equal(alice.authorHeadline,'Développeuse moteur 3D');
  assert.equal(alice.reactionCount,1);
  assert.equal(r.comments[0].reactionCount,3);
  assert.equal(r.comments[0].text,'Impressionnant, surtout les reflets en temps réel.');
  noForbiddenClicks(w);
});

test('fixture: comments are opened with the comment control of the right post, never a menu', async ()=>{
  // Same page with the sheet closed: the reader must click "Commenter" (or the counter) of the matching post.
  const html=fixture('search-comment-sheet-fr.html').replace('<div role="dialog" aria-modal="true" class="sheet">','<div id="sheet" role="dialog" aria-modal="true" class="sheet" hidden>')
    .replace('</body>','<script>document.querySelectorAll("#results .r")[0].querySelectorAll("button")[1].onclick=function(){document.getElementById("sheet").hidden=false};document.querySelectorAll("#results .r")[1].querySelectorAll("button")[1].onclick=function(){window.__wrongPost=true};</script></body>');
  const {w,li}=page('','https://www.linkedin.com/search/results/content/?keywords=graphismes',{html});
  const r=await li.readComments({keywords:'graphismes ray tracing',author:'Alice Martin'});
  assert.equal(r.status,'ok',JSON.stringify(r));
  assert.equal(r.opened,'clicked_comment');
  assert.equal(w.__wrongPost,undefined);
  assert.equal(r.comments.length,3);
  noForbiddenClicks(w);
});

// ------------------------------------------------------------------ reactions
test('fixture: reactions — count control (not Like), 6 categories, lazy loading, dedup, complete', async ()=>{
  const {w,li}=page('post-reactions-fr.html','https://www.linkedin.com/feed/update/urn:li:activity:7333333333333333333/');
  const r=await li.readReactions({});
  assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));
  assert.equal(r.expectedTotal,14);
  assert.equal(r.retrieved,14,'14 unique people despite reading every tab');
  assert.deepEqual(plain(r.byType),{like:8,celebrate:2,support:1,love:1,insightful:1,funny:1});
  assert.equal(r.complete,true);
  assert.equal(r.missing.length,0);
  const p=r.people.find((x:Li)=>x.name==='Personne 9');
  assert.equal(p.profileUrl,'https://www.linkedin.com/in/person-9/');
  assert.match(p.photoUrl,/person-9\/profile-displayphoto/);
  assert.equal(p.headline,'Métier numéro 9');
  assert.equal(p.reaction,'celebrate');
  assert.equal(p.reactionFromIcon,'celebrate','SVG trait classification agrees with the tab');
  assert.equal(r.people.find((x:Li)=>x.name==='Personne 1').reactionIconUrl,'https://static.licdn.com/aero-v1/sc/h/8ekq8gho1ruaf8i7f86vd1ftt','LinkedIn reaction picture kept');
  assert.equal(r.reactionIcons.like,'https://static.licdn.com/aero-v1/sc/h/8ekq8gho1ruaf8i7f86vd1ftt');
  assert.equal(r.categories.length,7);
  noForbiddenClicks(w);
});

test('fixture: reactions never claim completeness when LinkedIn lists fewer people than it counts', async ()=>{
  const {li}=page('post-reactions-fr.html','https://www.linkedin.com/feed/update/urn:li:activity:7333333333333333333/',{before:w=>{w.__hiddenReactors=1;}});
  const r=await li.readReactions({});
  assert.equal(r.expectedTotal,15);
  assert.equal(r.retrieved,14);
  assert.equal(r.complete,false);
  assert.deepEqual(plain(r.missing.map((m:Li)=>[m.tab,m.missing])),[['all',1],['like',1]]);
});

test('fixture: ambiguous reaction counters on a list page are refused with diagnostics', async ()=>{
  const {w,li}=page('search-sdui-fr.html','https://www.linkedin.com/search/results/content/?keywords=graphismes');
  const r=await li.readReactions({});
  assert.equal(r.status,'ambiguous_post');
  assert.ok(r.candidates.length>=2);
  noForbiddenClicks(w);
});

// ------------------------------------------------------------------ independence of the steps
test('fixture: a reaction failure keeps the comments already read', async ()=>{
  const {w,li}=page('search-comment-sheet-fr.html','https://www.linkedin.com/search/results/content/?keywords=graphismes');
  const r=await li.readPostFull({});
  assert.equal(r.comments.status,'ok');
  assert.equal(r.comments.comments.length,3);
  assert.notEqual(r.reactions.status,'ok');
  assert.equal(r.status,'partial');
  noForbiddenClicks(w);
});

test('fixture: full extraction on a post page returns comments, reactions and the consistency check', async ()=>{
  const html=fixture('post-reactions-fr.html').replace('<button>3 commentaires</button>','<button>1 commentaire</button>')
    .replace('</main>','<div class="cm"><div><a href="https://www.linkedin.com/in/tom-ricard/"><img src="https://media.licdn.com/dms/image/v2/tom/profile-displayphoto/0.jpg" alt="Tom Ricard"></a><a href="https://www.linkedin.com/in/tom-ricard/">Tom Ricard</a><div>Lead</div><div>2 h</div></div><p>Bravo pour l’analyse.</p><div><button>J’aime</button><button>Répondre</button></div></div></main>');
  const {w,li}=page('','https://www.linkedin.com/feed/update/urn:li:activity:7333333333333333333/',{html});
  const r=await li.readPostFull({postUrl:'https://www.linkedin.com/feed/update/urn:li:activity:7333333333333333333/'});
  assert.equal(r.status,'ok',JSON.stringify({c:r.comments.status,r:r.reactions.status,d:r.reactions.diagnostics,e:r.reactions.error}).slice(0,2500));
  assert.equal(r.comments.comments.length,1);
  assert.equal(r.reactions.retrieved,14);
  assert.deepEqual(plain(r.consistency),{commentsDisplayed:1,commentsRead:1,commentsComplete:true,reactionsDisplayed:14,reactionsRead:14,reactionsComplete:true});
  assert.equal(r.post.reactionCount,14,'the post shows the reaction list total, never a comment counter');
  const all=r.reactions.perCategory.find((x:Li)=>x.tab==='all');
  assert.equal(all.end,'reached');assert.equal(typeof all.seconds,'number');assert.equal(all.total,14);
  noForbiddenClicks(w);
});

test('fixture: stop on request keeps what was read, marks it partial and stopped (never complete)', async ()=>{
  const {w,li}=page('post-reactions-fr.html','https://www.linkedin.com/feed/update/urn:li:activity:7333333333333333333/');
  let calls=0;
  const r=await li.readReactions({},(p:Li)=>{calls++;if(p.reactionsRead>=1)w.__cmgLiStop=true;});
  assert.ok(calls>0);
  assert.equal(r.stopped,true);assert.equal(r.complete,false);assert.equal(r.partial,true);
  assert.ok(r.retrieved>=1&&r.retrieved<=14);
  assert.equal(r.expectedTotal,14,'the counter LinkedIn shows is kept for "read / shown"');
  const html=fixture('post-reactions-fr.html').replace('<button>3 commentaires</button>','<button>1 commentaire</button>')
    .replace('</main>','<div class="cm"><div><a href="https://www.linkedin.com/in/tom-ricard/"><img src="https://media.licdn.com/dms/image/v2/tom/profile-displayphoto/0.jpg" alt="Tom Ricard"></a><a href="https://www.linkedin.com/in/tom-ricard/">Tom Ricard</a><div>Lead</div><div>2 h</div></div><p>Bravo pour l’analyse.</p><div><button>J’aime</button><button>Répondre</button></div></div></main>');
  const p2=page('','https://www.linkedin.com/feed/update/urn:li:activity:7333333333333333333/',{html});
  // Stopped once the comments are read: the comments are kept, the reactions are skipped, status partial.
  const full=await p2.li.readPostFull({postUrl:'https://www.linkedin.com/feed/update/urn:li:activity:7333333333333333333/'},(p:Li)=>{if(p.stage==='reactions')p2.w.__cmgLiStop=true;});
  assert.equal(full.status,'partial');assert.equal(full.stoppedByUser,true);assert.equal(full.reactions.stopped,true);
  assert.equal(full.comments.comments.length,1);
  const p3=page('post-reactions-fr.html','https://www.linkedin.com/feed/update/urn:li:activity:7333333333333333333/');
  p3.w.__cmgLiStop=true;
  const none=await p3.li.readPostFull({});
  assert.equal(none.status,'failed','stopped before anything was read: nothing to keep');
  noForbiddenClicks(w);
});
test('fixture: comments switched to "Most recent" through the sort dropdown (never a menu); reaction tabs not re-read when the pictures already give every type', async ()=>{
  const html=fixture('post-reactions-fr.html').replace('<button>3 commentaires</button>','<button>1 commentaire</button>')
    .replace('</main>','<div class="cm"><div><a href="https://www.linkedin.com/in/tom-ricard/"><img src="https://media.licdn.com/dms/image/v2/tom/profile-displayphoto/0.jpg" alt="Tom Ricard"></a><a href="https://www.linkedin.com/in/tom-ricard/">Tom Ricard</a><div>Lead</div><div>2 h</div></div><p>Bravo pour l’analyse.</p><div><button>J’aime</button><button>Répondre</button></div></div></main>');
  const sortUi='<button id="srt" aria-haspopup="true">Les plus pertinents</button><ul id="mnu" style="display:none"><li role="option">Les plus pertinents</li><li role="option" id="rec">Les plus récents</li></ul>';
  const {w,li}=page('','https://www.linkedin.com/feed/update/urn:li:activity:7333333333333333333/',{html:html.replace('</main>',sortUi+'</main>')});
  w.document.getElementById('srt').addEventListener('click',()=>{w.document.getElementById('mnu').setAttribute('style','');});
  w.document.getElementById('rec').addEventListener('click',()=>{w.__sortedRecent=true;w.document.getElementById('srt').textContent='Les plus récents';});
  const r=await li.readPostFull({postUrl:'https://www.linkedin.com/feed/update/urn:li:activity:7333333333333333333/'});
  assert.equal(w.__sortedRecent,true,'"Les plus récents" was chosen: '+JSON.stringify({sort:r.comments.post&&r.comments.post.commentSort,clicks:r.comments.diagnostics}).slice(0,1500));
  assert.equal(r.comments.comments.length,1);
  assert.equal(r.reactions.retrieved,14);
  noForbiddenClicks(w);
});
test('fixture: people read are kept in the page memory and a new run on the same post continues from them', async ()=>{
  const {w,li}=page('post-reactions-fr.html','https://www.linkedin.com/feed/update/urn:li:activity:7333333333333333333/');
  const first=await li.readReactions({},(p:Li)=>{if(p.reactionsRead>=3)w.__cmgLiStop=true;});
  assert.equal(first.complete,false);
  const saved=JSON.parse(w.localStorage.getItem('cmgLiPeople:7333333333333333333')||'null');
  assert.ok(saved&&Object.keys(saved.p).length>=3,'kept in the page memory');
  w.__cmgLiStop=false;
  const second=await li.readReactions({});
  assert.ok(second.restoredFromMemory>=3,'continued from memory');
  assert.equal(second.retrieved,14);assert.equal(second.complete,true);
  assert.equal(w.localStorage.getItem('cmgLiPeople:7333333333333333333'),null,'memory cleared once complete');
  noForbiddenClicks(w);
});
test('unit: a big full extraction sheds reacting people (already saved in batches) before any comment photo or text', ()=>{
  const {li}=page('search-no-results.html','https://www.linkedin.com/feed/');
  const photo='https://media.licdn.com/dms/image/v2/'+'x'.repeat(200);
  const res={status:'ok',comments:{comments:Array.from({length:50},(_,i)=>({author:'C'+i,authorPhotoUrl:photo,text:'t'.repeat(800)}))},reactions:{people:Array.from({length:2000},(_,i)=>({name:'P'+i,profileUrl:'https://www.linkedin.com/in/p'+i+'/',photoUrl:photo,headline:'h'.repeat(80)}))}};
  const out=li.fit(res);
  assert.ok(JSON.stringify(out).length<=230000);
  assert.equal(out.reactions.peopleInBatches,true);
  assert.ok(out.reactions.people.length<2000);
  assert.equal(out.comments.comments.length,50);
  assert.ok(out.comments.comments.every((c:Li)=>c.authorPhotoUrl===photo&&c.text.length===800),'comments untouched');
});
test('fixture: comment list nested far away from the post card on a post page is still read', async ()=>{
  const deep=(html:string,n:number)=>'<div>'.repeat(n)+html+'</div>'.repeat(n);
  const post='<div class="card">'+deep('<a href="https://www.linkedin.com/in/alice-martin-123/">Alice Martin</a><div>Dev</div><div>1 j</div>',3)+deep('<p>Les graphismes temps réel, parlons-en deux minutes avec ray tracing.</p>',2)+deep('<button aria-label="14 réactions">14</button><button aria-label="2 commentaires sur le post de Alice Martin">2 commentaires</button>',2)+deep('<button>J’aime</button><button>Commenter</button><button>Republier</button><button>Envoyer</button>',2)+'</div>';
  const cm=(slug:string,name:string,text:string)=>'<article><div><a href="https://www.linkedin.com/in/'+slug+'/"><img src="https://media.licdn.com/dms/image/v2/'+slug+'/profile-displayphoto/0.jpg" alt="'+name+'"></a><a href="https://www.linkedin.com/in/'+slug+'/">'+name+'</a><div>3e et +</div><div>Métier</div><div>2 h</div></div><p>'+text+'</p><div><button>J’aime</button><button>Répondre</button><button aria-label="Plus d’options" onclick="window.__overflowClicked=true">⋯</button></div></article>';
  const html='<html><body><main>'+deep(deep(post,6)+deep('<section>'+cm('tom-ricard','Tom Ricard','Très clair.')+cm('sara-benali','Sara Benali','Merci !')+'</section>',9),3)+'</main></body></html>';
  const {w,li}=page('','https://www.linkedin.com/feed/update/urn:li:activity:7530000000000000001/',{html});
  const r=await li.readComments({postUrl:'https://www.linkedin.com/feed/update/urn:li:activity:7530000000000000001/'});
  assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));
  assert.deepEqual(plain(r.comments.map((c:Li)=>[c.author,c.authorHeadline,c.text])),[['Tom Ricard','Métier','Très clair.'],['Sara Benali','Métier','Merci !']]);
  assert.equal(r.complete,true);
  noForbiddenClicks(w);
});

test('fixture: on a post page, comments are found even when something else between looks like a post', async ()=>{
  const deep=(html:string,n:number)=>'<div>'.repeat(n)+html+'</div>'.repeat(n);
  const card=(slug:string,name:string,text:string,n:string)=>'<div class="card"><div><a href="https://www.linkedin.com/in/'+slug+'/">'+name+'</a><div>Titre</div></div><p>'+text+'</p><div><button aria-label="'+n+' commentaires sur le post de '+name+'">'+n+' commentaires</button></div><div><button>J’aime</button><button>Commenter</button><button>Republier</button><button>Envoyer</button></div></div>';
  const cm='<article><div><a href="https://www.linkedin.com/in/tom-ricard/">Tom Ricard</a><div>2 h</div></div><p>Très clair, merci.</p><div><button>J’aime</button><button>Répondre</button></div></article>';
  // A "more posts" strip between the post and its comments.
  const html='<html><body><main>'+deep(deep(card('alice-martin-123','Alice Martin','La publication principale avec assez de texte pour compter.','1'),4)+deep(card('bruno-lefevre','Bruno Lefèvre','Une autre publication suggérée au milieu de la page.','0'),2)+deep(cm,5),2)+'</main></body></html>';
  const {li}=page('','https://www.linkedin.com/feed/update/urn:li:activity:7530000000000000009/',{html});
  const r=await li.readComments({postUrl:'https://www.linkedin.com/feed/update/urn:li:activity:7530000000000000009/'});
  assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));
  assert.deepEqual(plain(r.comments.map((c:Li)=>c.author)),['Tom Ricard']);
});

// ------------------------------------------------------------------ people search (Java string, unchanged code path)
test('fixture: profile search script shipped in MainActivity reads people cards', ()=>{
  const java=readFileSync(new URL('../android-kamiko/app/src/main/java/com/cammicgo/kamikoseo/MainActivity.java',import.meta.url),'utf8');
  const start=java.indexOf('private void extractLinkedInPeople');
  const decl=java.indexOf('String js = ',start);
  const end=java.indexOf(';\n',decl);
  const pieces=[...java.slice(decl+'String js = '.length,end).matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m=>JSON.parse('"'+m[1].replace(/\\'/g,"'")+'"'));
  const js=pieces.join('');
  const html='<html><body><header><a href="https://www.linkedin.com/in/me-user/">Me</a></header><main><ul><li><a href="https://www.linkedin.com/in/alice-martin-123/?mini=1"><img src="https://media.licdn.com/a.jpg" alt="Alice Martin"><div>Alice Martin</div></a><div>Développeuse 3D</div></li><li><a href="https://fr.linkedin.com/in/bruno-lefevre"><div>Bruno Lefèvre</div></a><div>DA</div></li></ul></main></body></html>';
  const {w}=page('',' https://www.linkedin.com/search/results/people/?keywords=x'.trim(),{html});
  const out=JSON.parse(w.eval(js));
  assert.deepEqual(plain(out.profiles).map((p:Li)=>[p.name,p.profileUrl]),[['Alice Martin','https://www.linkedin.com/in/alice-martin-123/'],['Bruno Lefèvre','https://www.linkedin.com/in/bruno-lefevre/']]);
});

test('fixture: a big comment list with a "see more" in every comment is read in full (texts unfolded together, one load-more per round)', async ()=>{
  const paged=`function loadMore(b){window.__page=(window.__page||0)+1;var h='';for(var i=0;i<5;i++){var n=window.__page*5+i;h+=comment('74100000000000'+String(n).padStart(5,'0'),'person-'+n,'Person '+n,'Role '+n,'Long text '+n+' <button>…see more</button>');}
document.getElementById('more-slot').insertAdjacentHTML('beforebegin',h);if(window.__page>=12)b.remove();}`;
  const html=fixture('post-comments-desktop-en.html').replace('7 comments on','65 comments on').replace('>7 comments<','>65 comments<').replace(/function loadMore\(b\)\{[^\n]*\n/,paged+'\n');
  const {w,li}=page('','https://www.linkedin.com/feed/update/urn:li:activity:7322222222222222222/',{html});
  const r=await li.readComments({postUrl:'https://www.linkedin.com/feed/update/urn:li:activity:7322222222222222222/'});
  assert.equal(r.displayedCount,65);
  assert.equal(r.comments.length,65,JSON.stringify({n:r.comments.length,clicks:r.expandClicks}));
  assert.equal(r.complete,true);
  noForbiddenClicks(w);
});

test('unit: progress hands people over once, in small pieces, and the final answer waits for the queue', ()=>{
  const {li}=page('search-no-results.html','https://www.linkedin.com/feed/');
  const R:Li={k:{done:false}};
  const people=Array.from({length:700},(_,i)=>({name:'P'+i,profileUrl:'https://www.linkedin.com/in/p'+i+'/',reaction:i%2?'like':null,reactionIconUrl:'data:image/svg+xml;base64,AAAA'}));
  li.runProgress(R.k,{reactionsRead:700},{status:'partial',comments:{comments:[{text:'x'}]},reactions:{people}});
  li.runProgress(R.k,{reactionsRead:700},{status:'partial',reactions:{people}});
  assert.equal(R.k.snapshot.reactions.people.length,0,'the snapshot never carries the people');
  assert.equal(R.k.snapshot.reactions.retrieved,700);
  const a=JSON.parse(li.runPoll(R,'k',300));
  assert.equal(a.fresh.length,300);assert.equal(a.queued,400);assert.equal(a.fresh[0].reactionIconUrl,undefined,'no picture per person');
  people[0].reaction='love';
  li.runProgress(R.k,{},{reactions:{people}});
  R.k.done=true;R.k.result={ok:1};
  const b=JSON.parse(li.runPoll(R,'k',300));assert.equal(b.done,false,'queue first');assert.equal(b.fresh.length,300);
  const c=JSON.parse(li.runPoll(R,'k',300));assert.equal(c.done,true);assert.equal(c.fresh.length,101,'the updated person is sent again');
  assert.equal(c.fresh.at(-1).reaction,'love');
  assert.equal(R.k,undefined);
});

test('unit: a pause in the reader also ends when the app checks the page (frozen page timers)', async ()=>{
  const {w,li}=page('search-no-results.html','https://www.linkedin.com/feed/');
  // Freeze the page's timers, as Android does for a page it thinks is hidden.
  const real=w.setTimeout;w.setTimeout=()=>0;
  const R:Li={k:{done:false}};
  let ended=false;
  const pending=li.readComments({firstWait:2000}).then(()=>{ended=true;});
  for(let i=0;i<400&&!ended;i++){await new Promise(r=>setTimeout(r,5));li.runPoll(R,'k',10);}
  w.setTimeout=real;
  await pending;
  assert.equal(ended,true,'the reader finished with frozen timers, driven by the checks alone');
});

test('unit: fast read (opt-in) reads people from both shapes of LinkedIn reaction answers', ()=>{
  const {li}=page('search-no-results.html','https://www.linkedin.com/feed/');
  const img={attributes:[{detailData:{nonEntityProfilePicture:{vectorImage:{rootUrl:'https://media.licdn.com/dms/image/v2/abc/',artifacts:[{width:100,fileIdentifyingUrlPathSegment:'100.jpg'},{width:200,fileIdentifyingUrlPathSegment:'200.jpg'}]}}}}]};
  const newer={data:{},included:[
    {$type:'com.linkedin.voyager.dash.social.Reaction',reactionType:'PRAISE',reactorLockup:{title:{text:'Ana Silva'},subtitle:{text:'CTO at Example'},navigationUrl:'https://www.linkedin.com/in/ACoAAA1/?miniProfileUrn=x',image:img}},
    {$type:'com.linkedin.voyager.dash.social.Reaction',reactionType:'LIKE',reactorLockup:{title:{text:'Bo Chen'},subtitle:{text:'Student'},navigationUrl:'https://www.linkedin.com/in/ACoAAA2'}},
  ]};
  const a=li._test.apiPeople(newer);
  assert.equal(a.length,2);
  assert.equal(a[0].name,'Ana Silva');assert.equal(a[0].reaction,'celebrate');assert.equal(a[0].headline,'CTO at Example');
  assert.equal(a[0].photoUrl,'https://media.licdn.com/dms/image/v2/abc/200.jpg');
  assert.match(a[0].profileUrl,/\/in\/ACoAAA1\/$/);
  const older={included:[
    {entityUrn:'urn:li:fs_miniProfile:1',firstName:'Cy',lastName:'Dee',occupation:'Designer',publicIdentifier:'cy-dee'},
    {reactionType:'EMPATHY','*actor':'urn:li:fs_miniProfile:1'},
  ]};
  const b=li._test.apiPeople(older);
  assert.equal(b.length,1);assert.equal(b[0].name,'Cy Dee');assert.equal(b[0].reaction,'love');assert.equal(b[0].profileUrl,'https://www.linkedin.com/in/cy-dee/');
});

test('unit: fast read pages like the site (same piece size, pauses), stops at the first error, keeps a daily cap', async ()=>{
  const {w,li}=page('search-no-results.html','https://www.linkedin.com/feed/');
  const calls:string[]=[];
  const person=(i:number)=>({reactionType:'LIKE',reactorLockup:{title:{text:'P'+i},navigationUrl:'https://www.linkedin.com/in/p'+i+'/'}});
  w.__cmgLiTap={fetch:async(url:string)=>{calls.push(url);const s=+url.match(/start:(\d+)/)![1];if(s>=40)return {ok:false,status:429,headers:{get:()=>'application/json'}};return {ok:true,headers:{get:()=>'application/json'},json:async()=>({included:Array.from({length:10},(_,i)=>person(s+i))})};},
    reactions:{url:'https://www.linkedin.com/voyager/api/graphql?variables=(count:10,start:10,threadUrn:urn%3Ali%3Aactivity%3A1)&queryId=voyagerSocialDashReactions.abc',headers:{'csrf-token':'ajax:1'}}};
  const people:Li={};
  const r=await li._test.apiReadReactions(people,100,null);
  assert.equal(r.used,true);assert.equal(r.reason,'http_429');assert.equal(r.pieceSize,10);
  assert.equal(Object.keys(people).length,40);
  assert.deepEqual(calls.map(u=>+u.match(/start:(\d+)/)![1]),[0,10,20,30,40]);
  w.localStorage.setItem('cmgLiApiDay',JSON.stringify({d:new Date().toISOString().slice(0,10),posts:99,people:0}));
  const capped=await li._test.apiReadReactions({},100,null);
  assert.equal(capped.used,false);assert.equal(capped.reason,'daily_cap');
});

test('unit: fast read gives up on a request that never answers (one retry), so page reading can take over', async ()=>{
  const {w,li}=page('search-no-results.html','https://www.linkedin.com/feed/');
  let n=0;
  w.__cmgLiTap={fetch:(url:string)=>{n++;const s=+url.match(/start:(\d+)/)![1];if(s>=10)return new Promise(()=>{});return Promise.resolve({ok:true,headers:{get:()=>'application/json'},json:async()=>({included:[{reactionType:'LIKE',reactorLockup:{title:{text:'A'},navigationUrl:'https://www.linkedin.com/in/a/'}}]})});},
    reactions:{url:'https://www.linkedin.com/voyager/api/graphql?variables=(count:10,start:0)&queryId=x',headers:{}}};
  const r=await li._test.apiReadReactions({},100,null);
  assert.equal(r.reason,'timeout');assert.equal(r.added,1);assert.equal(n,3,'first page, then the hanging one tried twice');
});

test('fixture: mobile note "select Most recent" under the list is used to switch the sort, then the hidden comments are read', async ()=>{
  const extra=`<article id="hid" hidden class="comments-comment-entity" data-id="urn:li:comment:(activity:7322222222222222222,7499999999999999999)"><a href="https://www.linkedin.com/in/zoe-hidden/"><img src="https://media.licdn.com/dms/image/v2/zoe/profile-displayphoto/0.jpg" alt="View Zoe Hidden’s profile"></a><div class="comments-comment-meta"><a href="https://www.linkedin.com/in/zoe-hidden/"><span>Zoe Hidden</span></a><div>Analyst</div><time>1h</time></div><div class="comments-comment-item__main-content" dir="ltr">Only in most recent.</div><div><button aria-label="React Like to Zoe’s comment">Like</button><button aria-label="Reply to Zoe’s comment">Reply</button></div></article>`;
  const note=`<p>Some comments may not appear in <b>Most relevant</b>. To see them, select <a href="#" onclick="document.getElementById('hid').hidden=false;this.closest('p').remove();return false;">Most recent</a>.</p>`;
  const html=fixture('post-comments-desktop-en.html').replace('7 comments on','8 comments on').replace('>7 comments<','>8 comments<').replace('<div id="more-slot"></div>','<div id="more-slot"></div>'+extra).replace('</main>',note+'</main>');
  const {w,li}=page('','https://www.linkedin.com/feed/update/urn:li:activity:7322222222222222222/',{html});
  const r=await li.readComments({postUrl:'https://www.linkedin.com/feed/update/urn:li:activity:7322222222222222222/'});
  assert.equal(r.post.commentSort,'recent_from_notice');
  assert.ok(r.comments.some((c:Li)=>c.author==='Zoe Hidden'),JSON.stringify(r.comments.map((c:Li)=>c.author)));
  assert.equal(r.comments.length,8);
  noForbiddenClicks(w);
});
