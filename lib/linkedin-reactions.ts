export const REACTION_TYPES=['like','celebrate','support','love','insightful','funny'] as const;
const REACTION_LABELS:Record<string,string>={like:'J’aime',celebrate:'Bravo',support:'Soutien',love:'J’adore',insightful:'Instructif',funny:'Drôle'};
/** LinkedIn's six reaction pictures, served by CamMicGo: reactionIconUrl on each person, reactionIcons per type. */
export function decorateReactions(data:unknown,base=process.env.APP_BASE_URL||'https://seo.cammicgo.com'){
 const icon=(t:string)=>base+'/linkedin/reactions/'+t+'.png';
 const isType=(t:unknown):t is string=>typeof t==='string'&&(REACTION_TYPES as readonly string[]).includes(t);
 const visit=(node:unknown,depth:number)=>{
  if(depth>6||!node||typeof node!=='object')return;
  if(Array.isArray(node)){for(const c of node)visit(c,depth+1);return;}
  const o=node as Record<string,unknown>;
  if(isType(o.reaction)){o.reactionIconUrl=icon(o.reaction);o.reactionLabel=REACTION_LABELS[o.reaction];}
  if(o.byType&&typeof o.byType==='object'&&Array.isArray(o.people)){const icons:Record<string,string>={};for(const t of Object.keys(o.byType as object))if(isType(t))icons[t]=icon(t);o.reactionIcons=icons;}
  for(const k of Object.keys(o))if(o[k]&&typeof o[k]==='object')visit(o[k],depth+1);
 };
 visit(data,0);
 return data;
}

type Obj=Record<string,unknown>;
const str=(v:unknown)=>typeof v==='string'?v:'';
const esc=(s:string)=>s.replace(/([\[\]\\])/g,'\\$1').replace(/\n+/g,' ').trim();

/**
 * Photos: only pictures served by CamMicGo are displayable everywhere (LinkedIn's own links need the
 * LinkedIn session). photoUrl/authorPhotoUrl point to the hosted picture when there is one; LinkedIn's
 * link stays in linkedinPhotoUrl.
 */
export function preferHostedPhotos(data:unknown,base=process.env.APP_BASE_URL||'https://seo.cammicgo.com'){
 const visit=(node:unknown,depth:number)=>{
  if(depth>6||!node||typeof node!=='object')return;
  if(Array.isArray(node)){for(const c of node)visit(c,depth+1);return;}
  const o=node as Obj;
  const hosted=str(o.imageUrl).startsWith(base+'/');
  for(const k of ['photoUrl','authorPhotoUrl'])if(typeof o[k]==='string'&&o[k]){if(!o.linkedinPhotoUrl)o.linkedinPhotoUrl=o[k];if(hosted)o[k]=o.imageUrl;else delete o[k];}
  if(!hosted&&str(o.imageUrl).includes('licdn.com'))delete o.imageUrl;
  for(const k of Object.keys(o))if(o[k]&&typeof o[k]==='object')visit(o[k],depth+1);
 };
 visit(data,0);
 return data;
}

const ORDER=['like','celebrate','support','love','insightful','funny'];
function personLine(name:string,url:string,img:string,tail:string){
 const n=esc(name||'Membre LinkedIn');
 const pic=img?(url?`[![${n}](${img})](${url}) `:`![${n}](${img}) `):'';
 return `${pic}**${url?`[${n}](${url})`:n}**${tail}`;
}
function reactionsSection(r:Obj,base:string){
 const people=Array.isArray(r.people)?r.people as Obj[]:[];
 if(!people.length)return '';
 const out:string[]=[`### Réactions — ${people.length}${typeof r.expectedTotal==='number'?` / ${r.expectedTotal}`:''}${r.complete===true?' (complet)':r.complete===false?' (incomplet)':''}`];
 const groups=new Map<string,Obj[]>();
 for(const p of people){const t=str(p.reaction)||'unknown';if(!groups.has(t))groups.set(t,[]);groups.get(t)!.push(p);}
 const types=[...groups.keys()].sort((a,b)=>(ORDER.indexOf(a)+1||99)-(ORDER.indexOf(b)+1||99));
 for(const t of types){
  const list=groups.get(t)!;const label=REACTION_LABELS[t]||'Type non identifié';
  out.push('',`#### ${ORDER.includes(t)?`![${label}](${base}/linkedin/reactions/${t}.png) `:''}${label} — ${list.length}`,'');
  for(const p of list)out.push('- '+personLine(str(p.name),str(p.profileUrl),str(p.photoUrl),str(p.headline)?` — ${esc(str(p.headline))}`:''));
 }
 if(Array.isArray(r.missing)&&r.missing.length)out.push('',`⚠️ Non chargé par LinkedIn : ${(r.missing as Obj[]).map(m=>`${m.missing} (${REACTION_LABELS[str(m.tab)]||str(m.tab)})`).join(', ')}`);
 return out.join('\n');
}
function commentsSection(c:Obj){
 const list=Array.isArray(c.comments)?c.comments as Obj[]:[];
 if(!list.length)return '';
 const out=[`### Commentaires — ${list.length}${typeof c.displayedCount==='number'?` / ${c.displayedCount}`:''}${c.complete===true?' (complet)':c.complete===false?' (incomplet)':''}`,''];
 for(const x of list){
  const reply=x.isReply===true;
  const meta=[x.isPostAuthor===true?'Auteur':'',str(x.authorHeadline),str(x.time),typeof x.reactionCount==='number'?`${x.reactionCount} réaction(s)`:'' ].filter(Boolean).map(esc).join(' · ');
  const head=(reply?'  - ↳ ':'- ')+personLine(str(x.author),str(x.authorProfileUrl),str(x.authorPhotoUrl),meta?` · ${meta}`:'')+(reply&&str(x.parentAuthor)?` — en réponse à ${esc(str(x.parentAuthor))}`:'');
  out.push(head);
  const text=str(x.text).split('\n').map(l=>l.trim()).filter(Boolean).map(l=>(reply?'    ':'  ')+'> '+l).join('\n');
  if(text)out.push(text);
 }
 return out.join('\n');
}
/** A ready-to-show Markdown report (photos linked to profiles, LinkedIn reaction pictures), when the result has comments or reactions. */
export function addReport(data:unknown,base=process.env.APP_BASE_URL||'https://seo.cammicgo.com'){
 if(!data||typeof data!=='object'||Array.isArray(data))return data;
 const root=data as Obj;
 const reactions=root.reactions&&typeof root.reactions==='object'?root.reactions as Obj:(Array.isArray(root.people)&&root.byType?root:null);
 const comments=root.comments&&typeof root.comments==='object'&&!Array.isArray(root.comments)?root.comments as Obj:(Array.isArray(root.comments)?root:null);
 const parts:string[]=[];
 const post=(root.post&&typeof root.post==='object'?root.post:comments&&comments.post) as Obj|undefined;
 if(post&&str(post.author)){
  const url=str(root.postUrl)||str(post.postUrl);
  parts.push(`### Publication\n\n${personLine(str(post.author),str(post.authorProfileUrl),str(post.authorPhotoUrl),str(post.authorHeadline)?` — ${esc(str(post.authorHeadline))}`:'')}${str(post.time)?` · ${esc(str(post.time))}`:''}${url?` · [Ouvrir la publication](${url})`:''}\n\n> ${esc(str(post.text).split('\n')[0]||'')}`);
 }
 if(comments)parts.push(commentsSection(comments));
 if(reactions)parts.push(reactionsSection(reactions,base));
 const md=parts.filter(Boolean).join('\n\n');
 if(md&&(comments||reactions))root.reportMarkdown=md;
 return data;
}

/** What a visual report keeps: post, comments and reacting people, with displayable (hosted) pictures only. */
export function reportPayload(data:unknown,base=process.env.APP_BASE_URL||'https://seo.cammicgo.com'):Obj|null{
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 const root=data as Obj;
 const reactions=root.reactions&&typeof root.reactions==='object'?root.reactions as Obj:(Array.isArray(root.people)&&root.byType?root:null);
 const comments=root.comments&&typeof root.comments==='object'&&!Array.isArray(root.comments)?root.comments as Obj:(Array.isArray(root.comments)?root:null);
 if(!reactions&&!comments)return null;
 const pic=(u:unknown)=>str(u).startsWith(base+'/')?str(u):'';
 const post=(root.post&&typeof root.post==='object'?root.post:comments&&comments.post) as Obj|undefined;
 return {
  createdAt:new Date().toISOString(),
  post:post?{author:str(post.author),authorProfileUrl:str(post.authorProfileUrl),photo:pic(post.authorPhotoUrl),headline:str(post.authorHeadline),time:str(post.time),text:str(post.text).slice(0,3000),url:str(root.postUrl)||str(post.postUrl),reactionCount:post.reactionCount??null,commentCount:post.commentCount??null}:null,
  comments:comments?{displayed:comments.displayedCount??null,complete:comments.complete??null,items:(Array.isArray(comments.comments)?comments.comments as Obj[]:[]).slice(0,300).map(c=>({author:str(c.author),url:str(c.authorProfileUrl),photo:pic(c.authorPhotoUrl),headline:str(c.authorHeadline),time:str(c.time),text:str(c.text).slice(0,3000),isReply:c.isReply===true,isPostAuthor:c.isPostAuthor===true,parentAuthor:str(c.parentAuthor),reactions:typeof c.reactionCount==='number'?c.reactionCount:null}))}:null,
  reactions:reactions?{expected:reactions.expectedTotal??null,complete:reactions.complete??null,missing:Array.isArray(reactions.missing)?reactions.missing:[],people:(Array.isArray(reactions.people)?reactions.people as Obj[]:[]).slice(0,600).map(p=>({name:str(p.name),url:str(p.profileUrl),photo:pic(p.photoUrl),headline:str(p.headline),reaction:str(p.reaction)}))}:null,
 };
}

const h=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const safeUrl=(u:string)=>/^https:\/\/([a-z0-9-]+\.)*(linkedin\.com|cammicgo\.com)\//i.test(u)?u:'';
/** The post's numeric id (activity / ugcPost / share) from its URL. */
export function postIdOf(url:string){const m=url.match(/urn:li:(activity|ugcPost|share):(\d{8,22})/i)||url.match(/-(activity|ugcpost|share)-(\d{8,22})/i);return m?{kind:m[1],id:m[2],urn:'urn:li:'+m[1].replace(/^ugcpost$/i,'ugcPost')+':'+m[2]}:null;}
export type ReportOptions={logo?:string;nonce?:string;downloadUrl?:string;images?:Record<string,string>;reactionImg?:(t:string)=>string};
/**
 * Report page (escaped content, links only to LinkedIn and CamMicGo). With a nonce, one inline script
 * opens the print dialog (Save as PDF). With images (url → data URL), the page is self-contained (HTML export).
 */
export function reportHtml(r:Obj,base=process.env.APP_BASE_URL||'https://seo.cammicgo.com',opt:ReportOptions={}){
 const img=(u:string)=>opt.images&&opt.images[u]?opt.images[u]:u;
 const rimg=(t:string)=>opt.reactionImg?opt.reactionImg(t):base+'/linkedin/reactions/'+t+'.png';
 const avatar=(name:string,photo:string,url:string)=>{const im=photo?`<img class="av" src="${h(img(photo))}" alt="${h(name)}">`:`<span class="av ph">${h((name.trim()[0]||'?').toUpperCase())}</span>`;return safeUrl(url)?`<a href="${h(url)}" target="_blank" rel="noopener">${im}</a>`:im;};
 const nameLink=(name:string,url:string)=>safeUrl(url)?`<a class="nm" href="${h(url)}" target="_blank" rel="noopener">${h(name||'Membre LinkedIn')}</a>`:`<span class="nm">${h(name||'Membre LinkedIn')}</span>`;
 const post=r.post as Obj|null, comments=r.comments as Obj|null, reactions=r.reactions as Obj|null;
 const pid=post?postIdOf(str(post.url)):null;
 const parts:string[]=[];
 if(post){
  parts.push(`<section class="card"><div class="row">${avatar(str(post.author),str(post.photo),str(post.authorProfileUrl))}<div>${nameLink(str(post.author),str(post.authorProfileUrl))}<div class="sub">${h([post.headline,post.time].filter(Boolean).join(' · '))}</div></div></div><p class="txt">${h(post.text)}</p>${pid?`<div class="sub">Identifiant : ${h(pid.urn)}</div>`:''}${safeUrl(str(post.url))?`<a class="btn" href="${h(post.url)}" target="_blank" rel="noopener">Ouvrir la publication sur LinkedIn</a>`:''}</section>`);
 }
 if(comments){
  const items=Array.isArray(comments.items)?comments.items as Obj[]:[];
  parts.push(`<h2>Commentaires — ${items.length}${comments.displayed!=null?` / ${h(comments.displayed)}`:''} ${comments.complete===true?'<span class="ok">complet</span>':comments.complete===false?'<span class="ko">incomplet</span>':''}</h2><section class="card">`+items.map(c=>`<div class="cm${c.isReply?' reply':''}"><div class="row">${avatar(str(c.author),str(c.photo),str(c.url))}<div>${nameLink(str(c.author),str(c.url))}${c.isPostAuthor?' <span class="badge">Auteur</span>':''}<div class="sub">${h([c.headline,c.time,c.isReply&&c.parentAuthor?'en réponse à '+c.parentAuthor:'',typeof c.reactions==='number'?c.reactions+' réaction(s)':''].filter(Boolean).join(' · '))}</div></div></div><p class="txt">${h(c.text)}</p></div>`).join('')+'</section>');
 }
 if(reactions){
  const people=Array.isArray(reactions.people)?reactions.people as Obj[]:[];
  const groups=new Map<string,Obj[]>();
  for(const p of people){const t=str(p.reaction)||'unknown';if(!groups.has(t))groups.set(t,[]);groups.get(t)!.push(p);}
  const types=[...groups.keys()].sort((a,b)=>(ORDER.indexOf(a)+1||99)-(ORDER.indexOf(b)+1||99));
  parts.push(`<h2>Réactions — ${people.length}${reactions.expected!=null?` / ${h(reactions.expected)}`:''} ${reactions.complete===true?'<span class="ok">complet</span>':reactions.complete===false?'<span class="ko">incomplet</span>':''}</h2><div class="sum">`+types.map(t=>`<span class="pill">${ORDER.includes(t)?`<img class="ri" src="${rimg(t)}" alt="">`:''}${h(REACTION_LABELS[t]||'Non identifié')} <b>${groups.get(t)!.length}</b></span>`).join('')+'</div>');
  for(const t of types)parts.push(`<section class="card"><h3>${ORDER.includes(t)?`<img class="ri" src="${rimg(t)}" alt="">`:''}${h(REACTION_LABELS[t]||'Non identifié')} — ${groups.get(t)!.length}</h3>`+groups.get(t)!.map(p=>`<div class="row person">${avatar(str(p.name),str(p.photo),str(p.url))}<div class="grow">${nameLink(str(p.name),str(p.url))}<div class="sub">${h(p.headline)}</div></div>${ORDER.includes(t)?`<img class="ri" src="${rimg(t)}" alt="${h(REACTION_LABELS[t])}" title="${h(REACTION_LABELS[t])}">`:''}</div>`).join('')+'</section>');
 }
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Rapport de post LinkedIn — CamMicGo</title><style>
:root{--bg:#f3f6fb;--card:#fff;--ink:#14213d;--muted:#5b6b86;--line:#e3e9f3;--blue:#0a66c2}
@media (prefers-color-scheme:dark){:root{--bg:#0f1522;--card:#182033;--ink:#e8eefb;--muted:#9aa8c3;--line:#26324a;--blue:#70b5f9}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:16px}h1{font-size:20px;margin:8px 0 4px}h2{font-size:17px;margin:22px 0 8px}h3{font-size:15px;margin:0 0 8px;display:flex;align-items:center;gap:8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin:10px 0}
.row{display:flex;align-items:center;gap:12px}.person{padding:8px 0;border-top:1px solid var(--line)}.person:first-of-type{border-top:0}.grow{flex:1;min-width:0}
.av{width:44px;height:44px;border-radius:50%;object-fit:cover;flex:none;display:inline-flex;align-items:center;justify-content:center;background:#c9d6ea;color:#14213d;font-weight:700}
.nm{font-weight:700;color:var(--ink);text-decoration:none}a.nm:hover{color:var(--blue);text-decoration:underline}.sub{color:var(--muted);font-size:13px;overflow-wrap:anywhere}
.txt{white-space:pre-wrap;margin:8px 0 0;overflow-wrap:anywhere}.cm{padding:10px 0;border-top:1px solid var(--line)}.cm:first-child{border-top:0}.cm.reply{margin-left:40px}
.ri{width:24px;height:24px;flex:none}.badge{background:#e8f0fb;color:#0a66c2;border-radius:6px;padding:1px 6px;font-size:12px;font-weight:700}
.sum{display:flex;flex-wrap:wrap;gap:8px}.pill{display:inline-flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:4px 10px}
.hdr{background:#0a66c2;color:#fff;padding:20px 16px;text-align:center}.hdr .in{max-width:760px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:10px}
.hdr h1{margin:0;font-size:21px;color:#fff}.hdr .pid{font-size:12px;opacity:.9;overflow-wrap:anywhere}.hdr .grow{width:100%}
.logo{width:48px;height:48px;border-radius:10px;background:#fff;flex:none;box-shadow:0 0 0 2px rgba(255,255,255,.85)}
.tools{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.tools a,.tools button{font:600 13px system-ui,sans-serif;background:#fff;color:#0a66c2;border:0;border-radius:8px;padding:7px 12px;text-decoration:none;cursor:pointer}
@media print{.tools{display:none}body{background:#fff}.card{break-inside:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.ok{color:#15803d;font-size:13px}.ko{color:#b91c1c;font-size:13px}.btn{display:inline-block;margin-top:10px;background:var(--blue);color:#fff;border-radius:10px;padding:8px 12px;text-decoration:none;font-weight:600}
footer{color:var(--muted);font-size:12px;margin:24px 0}
</style></head><body><header class="hdr"><div class="in">${opt.logo?`<img class="logo" src="${h(opt.logo)}" alt="LinkedIn">`:''}<div class="grow"><h1>Rapport de post LinkedIn</h1>${pid?`<div class="pid">Identifiant du post : ${h(pid.urn)}</div>`:''}<div class="pid">Lu en lecture seule par l’application CamMicGo · ${h(new Date(str(r.createdAt)||Date.now()).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}))}</div></div>${opt.nonce||opt.downloadUrl?`<div class="tools">${opt.nonce?'<button type="button" id="pdf">Exporter en PDF</button>':''}${opt.downloadUrl?`<a href="${h(opt.downloadUrl)}" download>Exporter en HTML</a>`:''}${opt.nonce?'<button type="button" id="del">Supprimer maintenant</button>':''}</div>`:''}</div></header><main>${parts.join('')}<footer>${opt.images?'Export du rapport CamMicGo.':'Aucun historique n’est conservé : ce lien privé et non indexé est supprimé automatiquement 24 h après sa création, ou tout de suite avec « Supprimer maintenant ». Pour le garder, exportez-le (PDF : choisissez « Enregistrer au format PDF », les liens restent cliquables).'} Données lues depuis la session LinkedIn de l’utilisateur, sans aucune action sur LinkedIn.</footer></main>${opt.nonce?`<script nonce="${h(opt.nonce)}">document.getElementById('pdf').addEventListener('click',function(){window.print()});
document.getElementById('del').addEventListener('click',function(){var b=this;if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Confirmer la suppression';return;}b.disabled=true;fetch(location.pathname,{method:'DELETE'}).then(function(r){document.querySelector('main').innerHTML='<section class="card"><p>'+(r.ok?'Rapport supprimé : il n’existe plus sur le serveur, photos comprises.':'La suppression a échoué, réessayez.')+'</p></section>';document.querySelector('.tools').remove();});});</script>`:''}</body></html>`;
}
