export const REACTION_TYPES=['like','celebrate','support','love','insightful','funny'] as const;
/** Report wording in the 11 languages of the CamMicGo app (LinkedIn's own names for the reactions). */
export const REPORT_LANGS=['en','fr','es','de','pt','it','ru','zh','ja','ko','ar'] as const;
export type ReportLang=typeof REPORT_LANGS[number];
type Words={title:string;postId:string;readBy:string;pdf:string;html:string;del:string;confirm:string;comments:string;reactions:string;complete:string;incomplete:string;author:string;replyTo:string;reactionsN:string;openPost:string;member:string;unknown:string;footer:string;exportFooter:string;deleted:string;deleteFailed:string;post:string;notLoaded:string;
 like:string;celebrate:string;support:string;love:string;insightful:string;funny:string};
export const REPORT_WORDS:Record<ReportLang,Words>={
 en:{title:'LinkedIn post report',postId:'Post ID',readBy:'Read-only, by the CamMicGo app',pdf:'Export PDF',html:'Export HTML',del:'Delete now',confirm:'Confirm deletion',comments:'Comments',reactions:'Reactions',complete:'complete',incomplete:'incomplete',author:'Author',replyTo:'replying to',reactionsN:'reaction(s)',openPost:'Open the post on LinkedIn',member:'LinkedIn member',unknown:'Not identified',footer:'No history is kept: this private, non-indexed link is deleted automatically 24 hours after it was created, or at once with “Delete now”. To keep it, export it (PDF: choose “Save as PDF”, links stay clickable).',exportFooter:'CamMicGo report export.',deleted:'Report deleted: it no longer exists on the server, photos included.',deleteFailed:'Deletion failed, please try again.',post:'Post',notLoaded:'Not loaded by LinkedIn',
  like:'Like',celebrate:'Celebrate',support:'Support',love:'Love',insightful:'Insightful',funny:'Funny'},
 fr:{title:'Rapport de post LinkedIn',postId:'Identifiant du post',readBy:'Lu en lecture seule par l’application CamMicGo',pdf:'Exporter en PDF',html:'Exporter en HTML',del:'Supprimer maintenant',confirm:'Confirmer la suppression',comments:'Commentaires',reactions:'Réactions',complete:'complet',incomplete:'incomplet',author:'Auteur',replyTo:'en réponse à',reactionsN:'réaction(s)',openPost:'Ouvrir la publication sur LinkedIn',member:'Membre LinkedIn',unknown:'Non identifié',footer:'Aucun historique n’est conservé : ce lien privé et non indexé est supprimé automatiquement 24 h après sa création, ou tout de suite avec « Supprimer maintenant ». Pour le garder, exportez-le (PDF : choisissez « Enregistrer au format PDF », les liens restent cliquables).',exportFooter:'Export du rapport CamMicGo.',deleted:'Rapport supprimé : il n’existe plus sur le serveur, photos comprises.',deleteFailed:'La suppression a échoué, réessayez.',post:'Publication',notLoaded:'Non chargé par LinkedIn',
  like:'J’aime',celebrate:'Bravo',support:'Soutien',love:'J’adore',insightful:'Instructif',funny:'Drôle'},
 es:{title:'Informe de publicación de LinkedIn',postId:'ID de la publicación',readBy:'Solo lectura, por la app CamMicGo',pdf:'Exportar PDF',html:'Exportar HTML',del:'Eliminar ahora',confirm:'Confirmar eliminación',comments:'Comentarios',reactions:'Reacciones',complete:'completo',incomplete:'incompleto',author:'Autor',replyTo:'en respuesta a',reactionsN:'reacción(es)',openPost:'Abrir la publicación en LinkedIn',member:'Miembro de LinkedIn',unknown:'No identificado',footer:'No se guarda historial: este enlace privado y no indexado se elimina automáticamente 24 h después de crearse, o al instante con «Eliminar ahora». Para conservarlo, expórtalo (PDF: elige «Guardar como PDF», los enlaces siguen activos).',exportFooter:'Exportación del informe CamMicGo.',deleted:'Informe eliminado: ya no existe en el servidor, fotos incluidas.',deleteFailed:'No se pudo eliminar, inténtalo de nuevo.',post:'Publicación',notLoaded:'No cargado por LinkedIn',
  like:'Recomendar',celebrate:'Celebrar',support:'Apoyar',love:'Encantar',insightful:'Interesante',funny:'Divertido'},
 de:{title:'LinkedIn-Beitragsbericht',postId:'Beitrags-ID',readBy:'Nur lesend, durch die CamMicGo-App',pdf:'Als PDF exportieren',html:'Als HTML exportieren',del:'Jetzt löschen',confirm:'Löschen bestätigen',comments:'Kommentare',reactions:'Reaktionen',complete:'vollständig',incomplete:'unvollständig',author:'Autor',replyTo:'Antwort an',reactionsN:'Reaktion(en)',openPost:'Beitrag auf LinkedIn öffnen',member:'LinkedIn-Mitglied',unknown:'Nicht erkannt',footer:'Es wird kein Verlauf gespeichert: Dieser private, nicht indexierte Link wird 24 Stunden nach Erstellung automatisch gelöscht, oder sofort mit „Jetzt löschen“. Zum Behalten exportieren (PDF: „Als PDF speichern“ wählen, Links bleiben anklickbar).',exportFooter:'Export des CamMicGo-Berichts.',deleted:'Bericht gelöscht: Er existiert samt Fotos nicht mehr auf dem Server.',deleteFailed:'Löschen fehlgeschlagen, bitte erneut versuchen.',post:'Beitrag',notLoaded:'Von LinkedIn nicht geladen',
  like:'Gefällt mir',celebrate:'Applaus',support:'Unterstützung',love:'Wunderbar',insightful:'Interessant',funny:'Lustig'},
 pt:{title:'Relatório de publicação do LinkedIn',postId:'ID da publicação',readBy:'Somente leitura, pelo app CamMicGo',pdf:'Exportar PDF',html:'Exportar HTML',del:'Excluir agora',confirm:'Confirmar exclusão',comments:'Comentários',reactions:'Reações',complete:'completo',incomplete:'incompleto',author:'Autor',replyTo:'em resposta a',reactionsN:'reação(ões)',openPost:'Abrir a publicação no LinkedIn',member:'Membro do LinkedIn',unknown:'Não identificado',footer:'Nenhum histórico é mantido: este link privado e não indexado é excluído automaticamente 24 h após a criação, ou na hora com “Excluir agora”. Para guardá-lo, exporte (PDF: escolha “Salvar como PDF”, os links continuam clicáveis).',exportFooter:'Exportação do relatório CamMicGo.',deleted:'Relatório excluído: não existe mais no servidor, fotos incluídas.',deleteFailed:'Falha ao excluir, tente novamente.',post:'Publicação',notLoaded:'Não carregado pelo LinkedIn',
  like:'Gostei',celebrate:'Parabéns',support:'Apoio',love:'Amei',insightful:'Genial',funny:'Engraçado'},
 it:{title:'Report del post LinkedIn',postId:'ID del post',readBy:'Sola lettura, dall’app CamMicGo',pdf:'Esporta PDF',html:'Esporta HTML',del:'Elimina ora',confirm:'Conferma eliminazione',comments:'Commenti',reactions:'Reazioni',complete:'completo',incomplete:'incompleto',author:'Autore',replyTo:'in risposta a',reactionsN:'reazione/i',openPost:'Apri il post su LinkedIn',member:'Membro LinkedIn',unknown:'Non identificato',footer:'Nessuno storico conservato: questo link privato e non indicizzato viene eliminato automaticamente 24 ore dopo la creazione, o subito con “Elimina ora”. Per conservarlo, esportalo (PDF: scegli “Salva come PDF”, i link restano cliccabili).',exportFooter:'Esportazione del report CamMicGo.',deleted:'Report eliminato: non esiste più sul server, foto comprese.',deleteFailed:'Eliminazione non riuscita, riprova.',post:'Post',notLoaded:'Non caricato da LinkedIn',
  like:'Consiglia',celebrate:'Festeggia',support:'Sostieni',love:'Love',insightful:'Perspicace',funny:'Divertente'},
 ru:{title:'Отчёт о публикации LinkedIn',postId:'ID публикации',readBy:'Только чтение, приложение CamMicGo',pdf:'Экспорт в PDF',html:'Экспорт в HTML',del:'Удалить сейчас',confirm:'Подтвердить удаление',comments:'Комментарии',reactions:'Реакции',complete:'полностью',incomplete:'не полностью',author:'Автор',replyTo:'в ответ',reactionsN:'реакц.',openPost:'Открыть публикацию в LinkedIn',member:'Участник LinkedIn',unknown:'Не определено',footer:'История не хранится: эта личная неиндексируемая ссылка удаляется автоматически через 24 часа после создания или сразу кнопкой «Удалить сейчас». Чтобы сохранить отчёт, экспортируйте его (PDF: «Сохранить как PDF», ссылки остаются кликабельными).',exportFooter:'Экспорт отчёта CamMicGo.',deleted:'Отчёт удалён: его больше нет на сервере, включая фото.',deleteFailed:'Не удалось удалить, попробуйте ещё раз.',post:'Публикация',notLoaded:'Не загружено LinkedIn',
  like:'Нравится',celebrate:'Поздравляю',support:'Поддерживаю',love:'Восхищаюсь',insightful:'Интересно',funny:'Смешно'},
 zh:{title:'LinkedIn 动态报告',postId:'动态 ID',readBy:'由 CamMicGo 应用只读获取',pdf:'导出 PDF',html:'导出 HTML',del:'立即删除',confirm:'确认删除',comments:'评论',reactions:'互动',complete:'完整',incomplete:'不完整',author:'作者',replyTo:'回复',reactionsN:'个互动',openPost:'在 LinkedIn 上打开动态',member:'LinkedIn 会员',unknown:'未识别',footer:'不保留任何历史：此私密、不被索引的链接会在创建 24 小时后自动删除，或点击“立即删除”立刻删除。如需保留，请导出（PDF：选择“另存为 PDF”，链接仍可点击）。',exportFooter:'CamMicGo 报告导出。',deleted:'报告已删除：服务器上已不存在，包括照片。',deleteFailed:'删除失败，请重试。',post:'动态',notLoaded:'LinkedIn 未加载',
  like:'赞',celebrate:'庆祝',support:'支持',love:'喜爱',insightful:'有见地',funny:'有趣'},
 ja:{title:'LinkedIn 投稿レポート',postId:'投稿 ID',readBy:'CamMicGo アプリによる読み取り専用',pdf:'PDF で書き出す',html:'HTML で書き出す',del:'今すぐ削除',confirm:'削除を確認',comments:'コメント',reactions:'リアクション',complete:'すべて取得',incomplete:'一部のみ',author:'投稿者',replyTo:'への返信',reactionsN:'件のリアクション',openPost:'LinkedIn で投稿を開く',member:'LinkedIn メンバー',unknown:'不明',footer:'履歴は保存されません。この非公開・非インデックスのリンクは作成から 24 時間後に自動削除され、「今すぐ削除」ですぐに削除できます。残す場合は書き出してください（PDF：「PDF として保存」を選択、リンクはクリック可能なままです）。',exportFooter:'CamMicGo レポートの書き出し。',deleted:'レポートを削除しました。写真も含めサーバーに残っていません。',deleteFailed:'削除できませんでした。もう一度お試しください。',post:'投稿',notLoaded:'LinkedIn が読み込まなかった件数',
  like:'いいね',celebrate:'称賛',support:'応援',love:'大好き',insightful:'なるほど',funny:'面白い'},
 ko:{title:'LinkedIn 게시물 보고서',postId:'게시물 ID',readBy:'CamMicGo 앱으로 읽기 전용 수집',pdf:'PDF로 내보내기',html:'HTML로 내보내기',del:'지금 삭제',confirm:'삭제 확인',comments:'댓글',reactions:'반응',complete:'전체',incomplete:'일부',author:'작성자',replyTo:'에게 답글',reactionsN:'개 반응',openPost:'LinkedIn에서 게시물 열기',member:'LinkedIn 회원',unknown:'확인 불가',footer:'기록은 보관되지 않습니다. 이 비공개·비색인 링크는 생성 24시간 후 자동 삭제되며 “지금 삭제”로 즉시 삭제할 수 있습니다. 보관하려면 내보내세요(PDF: “PDF로 저장” 선택, 링크는 계속 클릭 가능).',exportFooter:'CamMicGo 보고서 내보내기.',deleted:'보고서가 삭제되었습니다. 사진을 포함해 서버에 남아 있지 않습니다.',deleteFailed:'삭제하지 못했습니다. 다시 시도하세요.',post:'게시물',notLoaded:'LinkedIn에서 불러오지 않음',
  like:'추천',celebrate:'축하',support:'응원',love:'마음에 쏙듦',insightful:'통찰력',funny:'웃음'},
 ar:{title:'تقرير منشور LinkedIn',postId:'معرّف المنشور',readBy:'قراءة فقط بواسطة تطبيق CamMicGo',pdf:'تصدير PDF',html:'تصدير HTML',del:'احذف الآن',confirm:'تأكيد الحذف',comments:'التعليقات',reactions:'التفاعلات',complete:'كامل',incomplete:'غير كامل',author:'الكاتب',replyTo:'ردًا على',reactionsN:'تفاعل',openPost:'فتح المنشور على LinkedIn',member:'عضو LinkedIn',unknown:'غير محدد',footer:'لا يُحفظ أي سجل: يُحذف هذا الرابط الخاص غير المفهرس تلقائيًا بعد 24 ساعة من إنشائه، أو فورًا عبر «احذف الآن». للاحتفاظ به صدّره (PDF: اختر «حفظ بتنسيق PDF»، وتبقى الروابط قابلة للنقر).',exportFooter:'تصدير تقرير CamMicGo.',deleted:'تم حذف التقرير: لم يعد موجودًا على الخادم، بما في ذلك الصور.',deleteFailed:'تعذّر الحذف، حاول مرة أخرى.',post:'المنشور',notLoaded:'لم يحمّله LinkedIn',
  like:'أعجبني',celebrate:'احتفاء',support:'دعم',love:'أحببته',insightful:'مفيد',funny:'مضحك'},
};
export function reportLang(v:unknown):ReportLang{const l=String(v||'').toLowerCase().slice(0,2);return (REPORT_LANGS as readonly string[]).includes(l)?l as ReportLang:'fr';}

// Wording of the report being built (set at the start of each synchronous builder, from the app language).
let W=REPORT_WORDS.fr;
const setReportLang=(v:unknown)=>{W=REPORT_WORDS[reportLang(v)];};
const LBL=(t:string)=>(W as unknown as Record<string,string>)[t]||'';
/** LinkedIn's six reaction pictures, served by CamMicGo: reactionIconUrl on each person, reactionIcons per type. */
export function decorateReactions(data:unknown,base=process.env.APP_BASE_URL||'https://seo.cammicgo.com'){
 setReportLang(data&&typeof data==='object'?(data as Record<string,unknown>).uiLang:null);
 const icon=(t:string)=>base+'/linkedin/reactions/'+t+'.png';
 const isType=(t:unknown):t is string=>typeof t==='string'&&(REACTION_TYPES as readonly string[]).includes(t);
 const visit=(node:unknown,depth:number)=>{
  if(depth>6||!node||typeof node!=='object')return;
  if(Array.isArray(node)){for(const c of node)visit(c,depth+1);return;}
  const o=node as Record<string,unknown>;
  if(isType(o.reaction)){o.reactionIconUrl=icon(o.reaction);o.reactionLabel=LBL(o.reaction);}
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
 const n=esc(name||W.member);
 const pic=img?(url?`[![${n}](${img})](${url}) `:`![${n}](${img}) `):'';
 return `${pic}**${url?`[${n}](${url})`:n}**${tail}`;
}
function reactionsSection(r:Obj,base:string){
 const people=Array.isArray(r.people)?r.people as Obj[]:[];
 if(!people.length)return '';
 const out:string[]=[`### ${W.reactions} — ${people.length}${typeof r.expectedTotal==='number'?` / ${r.expectedTotal}`:''}${r.complete===true?` (${W.complete})`:r.complete===false?` (${W.incomplete})`:''}`];
 const groups=new Map<string,Obj[]>();
 for(const p of people){const t=str(p.reaction)||'unknown';if(!groups.has(t))groups.set(t,[]);groups.get(t)!.push(p);}
 const types=[...groups.keys()].sort((a,b)=>(ORDER.indexOf(a)+1||99)-(ORDER.indexOf(b)+1||99));
 for(const t of types){
  const list=groups.get(t)!;const label=LBL(t)||W.unknown;
  out.push('',`#### ${ORDER.includes(t)?`![${label}](${base}/linkedin/reactions/${t}.png) `:''}${label} — ${list.length}`,'');
  for(const p of list)out.push('- '+personLine(str(p.name),str(p.profileUrl),str(p.photoUrl),str(p.headline)?` — ${esc(str(p.headline))}`:''));
 }
 if(Array.isArray(r.missing)&&r.missing.length)out.push('',`⚠️ ${W.notLoaded} : ${(r.missing as Obj[]).map(m=>`${m.missing} (${LBL(str(m.tab))||str(m.tab)})`).join(', ')}`);
 return out.join('\n');
}
function commentsSection(c:Obj){
 const list=Array.isArray(c.comments)?c.comments as Obj[]:[];
 if(!list.length)return '';
 const out=[`### ${W.comments} — ${list.length}${typeof c.displayedCount==='number'?` / ${c.displayedCount}`:''}${c.complete===true?` (${W.complete})`:c.complete===false?` (${W.incomplete})`:''}`,''];
 for(const x of list){
  const reply=x.isReply===true;
  const meta=[x.isPostAuthor===true?W.author:'',str(x.authorHeadline),str(x.time),typeof x.reactionCount==='number'?`${x.reactionCount} ${W.reactionsN}`:'' ].filter(Boolean).map(esc).join(' · ');
  const head=(reply?'  - ↳ ':'- ')+personLine(str(x.author),str(x.authorProfileUrl),str(x.authorPhotoUrl),meta?` · ${meta}`:'')+(reply&&str(x.parentAuthor)?` — ${W.replyTo} ${esc(str(x.parentAuthor))}`:'');
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
 setReportLang(root.uiLang);
 const reactions=root.reactions&&typeof root.reactions==='object'?root.reactions as Obj:(Array.isArray(root.people)&&root.byType?root:null);
 const comments=root.comments&&typeof root.comments==='object'&&!Array.isArray(root.comments)?root.comments as Obj:(Array.isArray(root.comments)?root:null);
 const parts:string[]=[];
 const post=(root.post&&typeof root.post==='object'?root.post:comments&&comments.post) as Obj|undefined;
 if(post&&str(post.author)){
  const url=str(root.postUrl)||str(post.postUrl);
  parts.push(`### ${W.post}\n\n${personLine(str(post.author),str(post.authorProfileUrl),str(post.authorPhotoUrl),str(post.authorHeadline)?` — ${esc(str(post.authorHeadline))}`:'')}${str(post.time)?` · ${esc(str(post.time))}`:''}${url?` · [${W.openPost}](${url})`:''}\n\n> ${esc(str(post.text).split('\n')[0]||'')}`);
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
  lang:reportLang(root.uiLang),
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
 setReportLang(r.lang);
 const lang=reportLang(r.lang);
 const img=(u:string)=>opt.images&&opt.images[u]?opt.images[u]:u;
 const rimg=(t:string)=>opt.reactionImg?opt.reactionImg(t):base+'/linkedin/reactions/'+t+'.png';
 const avatar=(name:string,photo:string,url:string)=>{const im=photo?`<img class="av" src="${h(img(photo))}" alt="${h(name)}">`:`<span class="av ph">${h((name.trim()[0]||'?').toUpperCase())}</span>`;return safeUrl(url)?`<a href="${h(url)}" target="_blank" rel="noopener">${im}</a>`:im;};
 const nameLink=(name:string,url:string)=>safeUrl(url)?`<a class="nm" href="${h(url)}" target="_blank" rel="noopener">${h(name||W.member)}</a>`:`<span class="nm">${h(name||W.member)}</span>`;
 const post=r.post as Obj|null, comments=r.comments as Obj|null, reactions=r.reactions as Obj|null;
 const pid=post?postIdOf(str(post.url)):null;
 const parts:string[]=[];
 if(post){
  parts.push(`<section class="card"><div class="row">${avatar(str(post.author),str(post.photo),str(post.authorProfileUrl))}<div>${nameLink(str(post.author),str(post.authorProfileUrl))}<div class="sub">${h([post.headline,post.time].filter(Boolean).join(' · '))}</div></div></div><p class="txt">${h(post.text)}</p>${pid?`<div class="sub">${h(W.postId)} : ${h(pid.urn)}</div>`:''}${safeUrl(str(post.url))?`<a class="btn" href="${h(post.url)}" target="_blank" rel="noopener">${h(W.openPost)}</a>`:''}</section>`);
 }
 if(comments){
  const items=Array.isArray(comments.items)?comments.items as Obj[]:[];
  parts.push(`<h2>${h(W.comments)} — ${items.length}${comments.displayed!=null?` / ${h(comments.displayed)}`:''} ${comments.complete===true?`<span class="ok">${h(W.complete)}</span>`:comments.complete===false?`<span class="ko">${h(W.incomplete)}</span>`:''}</h2><section class="card">`+items.map(c=>`<div class="cm${c.isReply?' reply':''}"><div class="row">${avatar(str(c.author),str(c.photo),str(c.url))}<div>${nameLink(str(c.author),str(c.url))}${c.isPostAuthor?` <span class="badge">${h(W.author)}</span>`:''}<div class="sub">${h([c.headline,c.time,c.isReply&&c.parentAuthor?W.replyTo+' '+c.parentAuthor:'',typeof c.reactions==='number'?c.reactions+' '+W.reactionsN:''].filter(Boolean).join(' · '))}</div></div></div><p class="txt">${h(c.text)}</p></div>`).join('')+'</section>');
 }
 if(reactions){
  const people=Array.isArray(reactions.people)?reactions.people as Obj[]:[];
  const groups=new Map<string,Obj[]>();
  for(const p of people){const t=str(p.reaction)||'unknown';if(!groups.has(t))groups.set(t,[]);groups.get(t)!.push(p);}
  const types=[...groups.keys()].sort((a,b)=>(ORDER.indexOf(a)+1||99)-(ORDER.indexOf(b)+1||99));
  parts.push(`<h2>${h(W.reactions)} — ${people.length}${reactions.expected!=null?` / ${h(reactions.expected)}`:''} ${reactions.complete===true?`<span class="ok">${h(W.complete)}</span>`:reactions.complete===false?`<span class="ko">${h(W.incomplete)}</span>`:''}</h2><div class="sum">`+types.map(t=>`<span class="pill">${ORDER.includes(t)?`<img class="ri" src="${rimg(t)}" alt="">`:''}${h(LBL(t)||W.unknown)} <b>${groups.get(t)!.length}</b></span>`).join('')+'</div>');
  for(const t of types)parts.push(`<section class="card"><h3>${ORDER.includes(t)?`<img class="ri" src="${rimg(t)}" alt="">`:''}${h(LBL(t)||W.unknown)} — ${groups.get(t)!.length}</h3>`+groups.get(t)!.map(p=>`<div class="row person">${avatar(str(p.name),str(p.photo),str(p.url))}<div class="grow">${nameLink(str(p.name),str(p.url))}<div class="sub">${h(p.headline)}</div></div>${ORDER.includes(t)?`<img class="ri" src="${rimg(t)}" alt="${h(LBL(t))}" title="${h(LBL(t))}">`:''}</div>`).join('')+'</section>');
 }
 return `<!doctype html><html lang="${lang}"${lang==='ar'?' dir="rtl"':''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${h(W.title)} — CamMicGo</title><style>
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
.hdr{background:#0a66c2;color:#fff;padding:20px 16px 18px}.hdr .in{max-width:760px;margin:0 auto}.hdr .top{display:flex;align-items:center;gap:16px}.hdr .grow{min-width:0;flex:1}.hdr .kicker{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.8;margin-bottom:2px}
.hdr h1{margin:0;font-size:22px;line-height:1.2;color:#fff}.hdr .pid{font-size:12px;opacity:.9;overflow-wrap:anywhere}
.logo{width:48px;height:48px;border-radius:10px;background:#fff;flex:none;box-shadow:0 0 0 2px rgba(255,255,255,.85)}
.tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.25)}.tools a,.tools button{display:inline-flex;align-items:center;gap:6px;font:600 13px system-ui,sans-serif;background:#fff;color:#0a66c2;border:0;border-radius:999px;padding:8px 14px;text-decoration:none;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.15)}.tools svg{width:16px;height:16px;flex:none}.tools .danger{background:#fff;color:#b42318}.tools button:disabled{opacity:.6}
@media print{.tools{display:none}body{background:#fff}.card{break-inside:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.ok{color:#15803d;font-size:13px}.ko{color:#b91c1c;font-size:13px}.btn{display:inline-block;margin-top:10px;background:var(--blue);color:#fff;border-radius:10px;padding:8px 12px;text-decoration:none;font-weight:600}
footer{color:var(--muted);font-size:12px;margin:24px 0}
</style></head><body><header class="hdr"><div class="in"><div class="top">${opt.logo?`<img class="logo" src="${h(opt.logo)}" alt="LinkedIn">`:'<span></span>'}<div class="grow"><div class="kicker">LinkedIn · CamMicGo</div><h1>${h(W.title)}</h1>${pid?`<div class="pid">${h(W.postId)} : ${h(pid.urn)}</div>`:''}<div class="pid">${h(W.readBy)} · ${h(new Date(str(r.createdAt)||Date.now()).toLocaleString(lang==='zh'?'zh-CN':lang,{timeZone:'Europe/Paris',dateStyle:'medium',timeStyle:'short'}))}</div></div></div>${opt.nonce||opt.downloadUrl?`<div class="tools">${opt.nonce?'<button type="button" id="pdf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M12 12v6M9 15l3 3 3-3"/></svg><span>'+h(W.pdf)+'</span></button>':''}${opt.downloadUrl?`<a href="${h(opt.downloadUrl)}" download><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/></svg><span>${h(W.html)}</span></a>`:''}${opt.nonce?'<button type="button" id="del" class="danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6"/></svg><span>'+h(W.del)+'</span></button>':''}</div>`:''}</div></header><main>${parts.join('')}<footer>${h(opt.images?W.exportFooter:W.footer)}</footer></main>${opt.nonce?`<script nonce="${h(opt.nonce)}">document.getElementById('pdf').addEventListener('click',function(){window.print()});
document.getElementById('del').addEventListener('click',function(){var b=this;if(b.dataset.armed!=='1'){b.dataset.armed='1';b.querySelector('span').textContent=${JSON.stringify(W.confirm)};return;}b.disabled=true;fetch(location.pathname,{method:'DELETE'}).then(function(r){document.querySelector('main').innerHTML='<section class="card"><p>'+(r.ok?${JSON.stringify(W.deleted)}:${JSON.stringify(W.deleteFailed)})+'</p></section>';document.querySelector('.tools').remove();});});</script>`:''}</body></html>`;
}
