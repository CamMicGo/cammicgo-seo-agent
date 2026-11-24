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
