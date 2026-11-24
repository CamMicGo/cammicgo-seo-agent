export const REACTION_TYPES=['like','celebrate','support','love','insightful','funny'] as const;
/** Report wording in the 11 languages of the CamMicGo app (LinkedIn's own names for the reactions). */
export const REPORT_LANGS=['en','fr','es','de','pt','it','ru','zh','ja','ko','ar'] as const;
export type ReportLang=typeof REPORT_LANGS[number];
type Words={secPost:string;summary:string;secAudience:string;domains:string;audienceGroups:string;companies:string;profilesOf:string;themes:string;themesNote:string;reactionsChart:string;people:string;commentTone:string;commentsN:string;analysis:string;postSummary:string;commentsSummary:string;tone:string;positive:string;neutral:string;negative:string;opinions:string;audience:string;takeaways:string;aiNote:string;title:string;postId:string;readBy:string;pdf:string;html:string;del:string;confirm:string;comments:string;reactions:string;complete:string;incomplete:string;author:string;replyTo:string;reactionsN:string;openPost:string;member:string;unknown:string;footer:string;exportFooter:string;deleted:string;deleteFailed:string;post:string;notLoaded:string;
 like:string;celebrate:string;support:string;love:string;insightful:string;funny:string};
export const REPORT_WORDS:Record<ReportLang,Words>={
 en:{secPost:'Post analysed',summary:'Summary',secAudience:'Audience',domains:'Professional domains',audienceGroups:'Target audience',companies:'Companies represented',profilesOf:'{n} of {t} profiles',themes:'Main comment themes',themesNote:'A comment can cover several themes.',reactionsChart:'Reaction breakdown',people:'people',commentTone:'Comment tone',commentsN:'comment(s)',analysis:'Analysis',postSummary:'Post summary',commentsSummary:'What the comments say',tone:'Overall tone',positive:'Positive',neutral:'Neutral',negative:'Negative',opinions:'Main opinions',audience:'Who reacted',takeaways:'Key takeaways',aiNote:'Written by the AI assistant ({agent}) from the data read on LinkedIn; to be checked.',title:'LinkedIn post report',postId:'Post ID',readBy:'Read-only, by the CamMicGo app',pdf:'Export PDF',html:'Export HTML',del:'Delete now',confirm:'Confirm deletion',comments:'Comments',reactions:'Reactions',complete:'complete',incomplete:'incomplete',author:'Author',replyTo:'replying to',reactionsN:'reaction(s)',openPost:'Open the post on LinkedIn',member:'LinkedIn member',unknown:'Not identified',footer:'No history is kept: this private, non-indexed link is deleted automatically 24 hours after it was created, or at once with “Delete now”. To keep it, export it (PDF: choose “Save as PDF”, links stay clickable).',exportFooter:'CamMicGo report export.',deleted:'Report deleted: it no longer exists on the server, photos included.',deleteFailed:'Deletion failed, please try again.',post:'Post',notLoaded:'Not loaded by LinkedIn',
  like:'Like',celebrate:'Celebrate',support:'Support',love:'Love',insightful:'Insightful',funny:'Funny'},
 fr:{secPost:'Post analysé',summary:'Synthèse',secAudience:'Audience',domains:'Domaines professionnels',audienceGroups:'Public cible',companies:'Entreprises représentées',profilesOf:'{n} profils sur {t}',themes:'Principales thématiques des commentaires',themesNote:'Un commentaire peut aborder plusieurs thématiques.',reactionsChart:'Répartition des réactions',people:'personnes',commentTone:'Tonalité des commentaires',commentsN:'commentaire(s)',analysis:'Analyse',postSummary:'Résumé du post',commentsSummary:'Ce que disent les commentaires',tone:'Tonalité générale',positive:'Positif',neutral:'Neutre',negative:'Négatif',opinions:'Principaux avis',audience:'Qui a réagi',takeaways:'À retenir',aiNote:'Rédigé par l’assistant IA ({agent}) à partir des données lues sur LinkedIn ; à vérifier.',title:'Rapport de post LinkedIn',postId:'Identifiant du post',readBy:'Lu en lecture seule par l’application CamMicGo',pdf:'Exporter en PDF',html:'Exporter en HTML',del:'Supprimer maintenant',confirm:'Confirmer la suppression',comments:'Commentaires',reactions:'Réactions',complete:'complet',incomplete:'incomplet',author:'Auteur',replyTo:'en réponse à',reactionsN:'réaction(s)',openPost:'Ouvrir la publication sur LinkedIn',member:'Membre LinkedIn',unknown:'Non identifié',footer:'Aucun historique n’est conservé : ce lien privé et non indexé est supprimé automatiquement 24 h après sa création, ou tout de suite avec « Supprimer maintenant ». Pour le garder, exportez-le (PDF : choisissez « Enregistrer au format PDF », les liens restent cliquables).',exportFooter:'Export du rapport CamMicGo.',deleted:'Rapport supprimé : il n’existe plus sur le serveur, photos comprises.',deleteFailed:'La suppression a échoué, réessayez.',post:'Publication',notLoaded:'Non chargé par LinkedIn',
  like:'J’aime',celebrate:'Bravo',support:'Soutien',love:'J’adore',insightful:'Instructif',funny:'Drôle'},
 es:{secPost:'Publicación analizada',summary:'Síntesis',secAudience:'Audiencia',domains:'Ámbitos profesionales',audienceGroups:'Público objetivo',companies:'Empresas representadas',profilesOf:'{n} de {t} perfiles',themes:'Temas principales de los comentarios',themesNote:'Un comentario puede tratar varios temas.',reactionsChart:'Reparto de reacciones',people:'personas',commentTone:'Tono de los comentarios',commentsN:'comentario(s)',analysis:'Análisis',postSummary:'Resumen de la publicación',commentsSummary:'Lo que dicen los comentarios',tone:'Tono general',positive:'Positivo',neutral:'Neutral',negative:'Negativo',opinions:'Opiniones principales',audience:'Quién reaccionó',takeaways:'Conclusiones',aiNote:'Redactado por el asistente de IA ({agent}) a partir de los datos leídos en LinkedIn; a verificar.',title:'Informe de publicación de LinkedIn',postId:'ID de la publicación',readBy:'Solo lectura, por la app CamMicGo',pdf:'Exportar PDF',html:'Exportar HTML',del:'Eliminar ahora',confirm:'Confirmar eliminación',comments:'Comentarios',reactions:'Reacciones',complete:'completo',incomplete:'incompleto',author:'Autor',replyTo:'en respuesta a',reactionsN:'reacción(es)',openPost:'Abrir la publicación en LinkedIn',member:'Miembro de LinkedIn',unknown:'No identificado',footer:'No se guarda historial: este enlace privado y no indexado se elimina automáticamente 24 h después de crearse, o al instante con «Eliminar ahora». Para conservarlo, expórtalo (PDF: elige «Guardar como PDF», los enlaces siguen activos).',exportFooter:'Exportación del informe CamMicGo.',deleted:'Informe eliminado: ya no existe en el servidor, fotos incluidas.',deleteFailed:'No se pudo eliminar, inténtalo de nuevo.',post:'Publicación',notLoaded:'No cargado por LinkedIn',
  like:'Recomendar',celebrate:'Celebrar',support:'Apoyar',love:'Encantar',insightful:'Interesante',funny:'Divertido'},
 de:{secPost:'Analysierter Beitrag',summary:'Überblick',secAudience:'Publikum',domains:'Berufsfelder',audienceGroups:'Zielgruppe',companies:'Vertretene Unternehmen',profilesOf:'{n} von {t} Profilen',themes:'Hauptthemen der Kommentare',themesNote:'Ein Kommentar kann mehrere Themen behandeln.',reactionsChart:'Verteilung der Reaktionen',people:'Personen',commentTone:'Tonalität der Kommentare',commentsN:'Kommentar(e)',analysis:'Analyse',postSummary:'Zusammenfassung des Beitrags',commentsSummary:'Was die Kommentare sagen',tone:'Gesamtstimmung',positive:'Positiv',neutral:'Neutral',negative:'Negativ',opinions:'Wichtigste Meinungen',audience:'Wer reagiert hat',takeaways:'Kernaussagen',aiNote:'Vom KI-Assistenten ({agent}) aus den auf LinkedIn gelesenen Daten verfasst; bitte prüfen.',title:'LinkedIn-Beitragsbericht',postId:'Beitrags-ID',readBy:'Nur lesend, durch die CamMicGo-App',pdf:'Als PDF exportieren',html:'Als HTML exportieren',del:'Jetzt löschen',confirm:'Löschen bestätigen',comments:'Kommentare',reactions:'Reaktionen',complete:'vollständig',incomplete:'unvollständig',author:'Autor',replyTo:'Antwort an',reactionsN:'Reaktion(en)',openPost:'Beitrag auf LinkedIn öffnen',member:'LinkedIn-Mitglied',unknown:'Nicht erkannt',footer:'Es wird kein Verlauf gespeichert: Dieser private, nicht indexierte Link wird 24 Stunden nach Erstellung automatisch gelöscht, oder sofort mit „Jetzt löschen“. Zum Behalten exportieren (PDF: „Als PDF speichern“ wählen, Links bleiben anklickbar).',exportFooter:'Export des CamMicGo-Berichts.',deleted:'Bericht gelöscht: Er existiert samt Fotos nicht mehr auf dem Server.',deleteFailed:'Löschen fehlgeschlagen, bitte erneut versuchen.',post:'Beitrag',notLoaded:'Von LinkedIn nicht geladen',
  like:'Gefällt mir',celebrate:'Applaus',support:'Unterstützung',love:'Wunderbar',insightful:'Interessant',funny:'Lustig'},
 pt:{secPost:'Publicação analisada',summary:'Síntese',secAudience:'Público',domains:'Áreas profissionais',audienceGroups:'Público-alvo',companies:'Empresas representadas',profilesOf:'{n} de {t} perfis',themes:'Principais temas dos comentários',themesNote:'Um comentário pode abordar vários temas.',reactionsChart:'Distribuição das reações',people:'pessoas',commentTone:'Tom dos comentários',commentsN:'comentário(s)',analysis:'Análise',postSummary:'Resumo da publicação',commentsSummary:'O que dizem os comentários',tone:'Tom geral',positive:'Positivo',neutral:'Neutro',negative:'Negativo',opinions:'Principais opiniões',audience:'Quem reagiu',takeaways:'Pontos principais',aiNote:'Escrito pelo assistente de IA ({agent}) a partir dos dados lidos no LinkedIn; a verificar.',title:'Relatório de publicação do LinkedIn',postId:'ID da publicação',readBy:'Somente leitura, pelo app CamMicGo',pdf:'Exportar PDF',html:'Exportar HTML',del:'Excluir agora',confirm:'Confirmar exclusão',comments:'Comentários',reactions:'Reações',complete:'completo',incomplete:'incompleto',author:'Autor',replyTo:'em resposta a',reactionsN:'reação(ões)',openPost:'Abrir a publicação no LinkedIn',member:'Membro do LinkedIn',unknown:'Não identificado',footer:'Nenhum histórico é mantido: este link privado e não indexado é excluído automaticamente 24 h após a criação, ou na hora com “Excluir agora”. Para guardá-lo, exporte (PDF: escolha “Salvar como PDF”, os links continuam clicáveis).',exportFooter:'Exportação do relatório CamMicGo.',deleted:'Relatório excluído: não existe mais no servidor, fotos incluídas.',deleteFailed:'Falha ao excluir, tente novamente.',post:'Publicação',notLoaded:'Não carregado pelo LinkedIn',
  like:'Gostei',celebrate:'Parabéns',support:'Apoio',love:'Amei',insightful:'Genial',funny:'Engraçado'},
 it:{secPost:'Post analizzato',summary:'Sintesi',secAudience:'Pubblico',domains:'Ambiti professionali',audienceGroups:'Pubblico di riferimento',companies:'Aziende rappresentate',profilesOf:'{n} profili su {t}',themes:'Temi principali dei commenti',themesNote:'Un commento può toccare più temi.',reactionsChart:'Ripartizione delle reazioni',people:'persone',commentTone:'Tono dei commenti',commentsN:'commento/i',analysis:'Analisi',postSummary:'Riassunto del post',commentsSummary:'Cosa dicono i commenti',tone:'Tono generale',positive:'Positivo',neutral:'Neutro',negative:'Negativo',opinions:'Opinioni principali',audience:'Chi ha reagito',takeaways:'Punti chiave',aiNote:'Scritto dall’assistente IA ({agent}) dai dati letti su LinkedIn; da verificare.',title:'Report del post LinkedIn',postId:'ID del post',readBy:'Sola lettura, dall’app CamMicGo',pdf:'Esporta PDF',html:'Esporta HTML',del:'Elimina ora',confirm:'Conferma eliminazione',comments:'Commenti',reactions:'Reazioni',complete:'completo',incomplete:'incompleto',author:'Autore',replyTo:'in risposta a',reactionsN:'reazione/i',openPost:'Apri il post su LinkedIn',member:'Membro LinkedIn',unknown:'Non identificato',footer:'Nessuno storico conservato: questo link privato e non indicizzato viene eliminato automaticamente 24 ore dopo la creazione, o subito con “Elimina ora”. Per conservarlo, esportalo (PDF: scegli “Salva come PDF”, i link restano cliccabili).',exportFooter:'Esportazione del report CamMicGo.',deleted:'Report eliminato: non esiste più sul server, foto comprese.',deleteFailed:'Eliminazione non riuscita, riprova.',post:'Post',notLoaded:'Non caricato da LinkedIn',
  like:'Consiglia',celebrate:'Festeggia',support:'Sostieni',love:'Love',insightful:'Perspicace',funny:'Divertente'},
 ru:{secPost:'Анализируемая публикация',summary:'Итоги',secAudience:'Аудитория',domains:'Профессиональные сферы',audienceGroups:'Целевая аудитория',companies:'Представленные компании',profilesOf:'{n} из {t} профилей',themes:'Основные темы комментариев',themesNote:'Комментарий может затрагивать несколько тем.',reactionsChart:'Распределение реакций',people:'чел.',commentTone:'Тональность комментариев',commentsN:'комм.',analysis:'Анализ',postSummary:'Краткое содержание публикации',commentsSummary:'О чём говорят комментарии',tone:'Общий тон',positive:'Позитивный',neutral:'Нейтральный',negative:'Негативный',opinions:'Основные мнения',audience:'Кто отреагировал',takeaways:'Главное',aiNote:'Составлено ИИ-ассистентом ({agent}) по данным, прочитанным в LinkedIn; требует проверки.',title:'Отчёт о публикации LinkedIn',postId:'ID публикации',readBy:'Только чтение, приложение CamMicGo',pdf:'Экспорт в PDF',html:'Экспорт в HTML',del:'Удалить сейчас',confirm:'Подтвердить удаление',comments:'Комментарии',reactions:'Реакции',complete:'полностью',incomplete:'не полностью',author:'Автор',replyTo:'в ответ',reactionsN:'реакц.',openPost:'Открыть публикацию в LinkedIn',member:'Участник LinkedIn',unknown:'Не определено',footer:'История не хранится: эта личная неиндексируемая ссылка удаляется автоматически через 24 часа после создания или сразу кнопкой «Удалить сейчас». Чтобы сохранить отчёт, экспортируйте его (PDF: «Сохранить как PDF», ссылки остаются кликабельными).',exportFooter:'Экспорт отчёта CamMicGo.',deleted:'Отчёт удалён: его больше нет на сервере, включая фото.',deleteFailed:'Не удалось удалить, попробуйте ещё раз.',post:'Публикация',notLoaded:'Не загружено LinkedIn',
  like:'Нравится',celebrate:'Поздравляю',support:'Поддерживаю',love:'Восхищаюсь',insightful:'Интересно',funny:'Смешно'},
 zh:{secPost:'所分析的动态',summary:'概要',secAudience:'受众',domains:'职业领域',audienceGroups:'目标受众',companies:'涉及的公司',profilesOf:'{t} 个资料中的 {n} 个',themes:'评论主要话题',themesNote:'一条评论可能涉及多个话题。',reactionsChart:'互动分布',people:'人',commentTone:'评论情绪',commentsN:'条评论',analysis:'分析',postSummary:'动态摘要',commentsSummary:'评论观点',tone:'整体情绪',positive:'正面',neutral:'中性',negative:'负面',opinions:'主要观点',audience:'谁做出了互动',takeaways:'要点',aiNote:'由 AI 助手（{agent}）根据在 LinkedIn 上读取的数据撰写，请核实。',title:'LinkedIn 动态报告',postId:'动态 ID',readBy:'由 CamMicGo 应用只读获取',pdf:'导出 PDF',html:'导出 HTML',del:'立即删除',confirm:'确认删除',comments:'评论',reactions:'互动',complete:'完整',incomplete:'不完整',author:'作者',replyTo:'回复',reactionsN:'个互动',openPost:'在 LinkedIn 上打开动态',member:'LinkedIn 会员',unknown:'未识别',footer:'不保留任何历史：此私密、不被索引的链接会在创建 24 小时后自动删除，或点击“立即删除”立刻删除。如需保留，请导出（PDF：选择“另存为 PDF”，链接仍可点击）。',exportFooter:'CamMicGo 报告导出。',deleted:'报告已删除：服务器上已不存在，包括照片。',deleteFailed:'删除失败，请重试。',post:'动态',notLoaded:'LinkedIn 未加载',
  like:'赞',celebrate:'庆祝',support:'支持',love:'喜爱',insightful:'有见地',funny:'有趣'},
 ja:{secPost:'分析した投稿',summary:'概要',secAudience:'オーディエンス',domains:'職種の分野',audienceGroups:'ターゲット層',companies:'所属企業',profilesOf:'{t} 人中 {n} 人',themes:'コメントの主なテーマ',themesNote:'1 件のコメントが複数のテーマに触れる場合があります。',reactionsChart:'リアクションの内訳',people:'人',commentTone:'コメントのトーン',commentsN:'件のコメント',analysis:'分析',postSummary:'投稿の要約',commentsSummary:'コメントの傾向',tone:'全体のトーン',positive:'肯定的',neutral:'中立',negative:'否定的',opinions:'主な意見',audience:'リアクションした人',takeaways:'まとめ',aiNote:'AI アシスタント（{agent}）が LinkedIn で読み取ったデータから作成。要確認。',title:'LinkedIn 投稿レポート',postId:'投稿 ID',readBy:'CamMicGo アプリによる読み取り専用',pdf:'PDF で書き出す',html:'HTML で書き出す',del:'今すぐ削除',confirm:'削除を確認',comments:'コメント',reactions:'リアクション',complete:'すべて取得',incomplete:'一部のみ',author:'投稿者',replyTo:'への返信',reactionsN:'件のリアクション',openPost:'LinkedIn で投稿を開く',member:'LinkedIn メンバー',unknown:'不明',footer:'履歴は保存されません。この非公開・非インデックスのリンクは作成から 24 時間後に自動削除され、「今すぐ削除」ですぐに削除できます。残す場合は書き出してください（PDF：「PDF として保存」を選択、リンクはクリック可能なままです）。',exportFooter:'CamMicGo レポートの書き出し。',deleted:'レポートを削除しました。写真も含めサーバーに残っていません。',deleteFailed:'削除できませんでした。もう一度お試しください。',post:'投稿',notLoaded:'LinkedIn が読み込まなかった件数',
  like:'いいね',celebrate:'称賛',support:'応援',love:'大好き',insightful:'なるほど',funny:'面白い'},
 ko:{secPost:'분석한 게시물',summary:'요약',secAudience:'오디언스',domains:'직무 분야',audienceGroups:'타깃 오디언스',companies:'소속 기업',profilesOf:'{t}명 중 {n}명',themes:'댓글 주요 주제',themesNote:'댓글 하나가 여러 주제를 다룰 수 있습니다.',reactionsChart:'반응 분포',people:'명',commentTone:'댓글 분위기',commentsN:'개 댓글',analysis:'분석',postSummary:'게시물 요약',commentsSummary:'댓글 내용',tone:'전체 분위기',positive:'긍정',neutral:'중립',negative:'부정',opinions:'주요 의견',audience:'반응한 사람',takeaways:'핵심 요약',aiNote:'AI 어시스턴트({agent})가 LinkedIn에서 읽은 데이터로 작성했습니다. 확인이 필요합니다.',title:'LinkedIn 게시물 보고서',postId:'게시물 ID',readBy:'CamMicGo 앱으로 읽기 전용 수집',pdf:'PDF로 내보내기',html:'HTML로 내보내기',del:'지금 삭제',confirm:'삭제 확인',comments:'댓글',reactions:'반응',complete:'전체',incomplete:'일부',author:'작성자',replyTo:'에게 답글',reactionsN:'개 반응',openPost:'LinkedIn에서 게시물 열기',member:'LinkedIn 회원',unknown:'확인 불가',footer:'기록은 보관되지 않습니다. 이 비공개·비색인 링크는 생성 24시간 후 자동 삭제되며 “지금 삭제”로 즉시 삭제할 수 있습니다. 보관하려면 내보내세요(PDF: “PDF로 저장” 선택, 링크는 계속 클릭 가능).',exportFooter:'CamMicGo 보고서 내보내기.',deleted:'보고서가 삭제되었습니다. 사진을 포함해 서버에 남아 있지 않습니다.',deleteFailed:'삭제하지 못했습니다. 다시 시도하세요.',post:'게시물',notLoaded:'LinkedIn에서 불러오지 않음',
  like:'추천',celebrate:'축하',support:'응원',love:'마음에 쏙듦',insightful:'통찰력',funny:'웃음'},
 ar:{secPost:'المنشور الذي تم تحليله',summary:'الخلاصة',secAudience:'الجمهور',domains:'المجالات المهنية',audienceGroups:'الجمهور المستهدف',companies:'الشركات الممثَّلة',profilesOf:'{n} من {t} ملفات',themes:'أبرز موضوعات التعليقات',themesNote:'قد يتناول التعليق الواحد عدة موضوعات.',reactionsChart:'توزيع التفاعلات',people:'أشخاص',commentTone:'نبرة التعليقات',commentsN:'تعليق',analysis:'التحليل',postSummary:'ملخص المنشور',commentsSummary:'ما تقوله التعليقات',tone:'النبرة العامة',positive:'إيجابي',neutral:'محايد',negative:'سلبي',opinions:'أبرز الآراء',audience:'من تفاعل',takeaways:'أهم النقاط',aiNote:'كتبه مساعد الذكاء الاصطناعي ({agent}) من البيانات المقروءة على LinkedIn؛ يُرجى التحقق.',title:'تقرير منشور LinkedIn',postId:'معرّف المنشور',readBy:'قراءة فقط بواسطة تطبيق CamMicGo',pdf:'تصدير PDF',html:'تصدير HTML',del:'احذف الآن',confirm:'تأكيد الحذف',comments:'التعليقات',reactions:'التفاعلات',complete:'كامل',incomplete:'غير كامل',author:'الكاتب',replyTo:'ردًا على',reactionsN:'تفاعل',openPost:'فتح المنشور على LinkedIn',member:'عضو LinkedIn',unknown:'غير محدد',footer:'لا يُحفظ أي سجل: يُحذف هذا الرابط الخاص غير المفهرس تلقائيًا بعد 24 ساعة من إنشائه، أو فورًا عبر «احذف الآن». للاحتفاظ به صدّره (PDF: اختر «حفظ بتنسيق PDF»، وتبقى الروابط قابلة للنقر).',exportFooter:'تصدير تقرير CamMicGo.',deleted:'تم حذف التقرير: لم يعد موجودًا على الخادم، بما في ذلك الصور.',deleteFailed:'تعذّر الحذف، حاول مرة أخرى.',post:'المنشور',notLoaded:'لم يحمّله LinkedIn',
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
export type ReportOptions={logo?:string;brandLogo?:string;nonce?:string;downloadUrl?:string;images?:Record<string,string>;reactionImg?:(t:string)=>string};
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
 const an=r.analysis&&typeof r.analysis==='object'?r.analysis as ReportAnalysis:null;
 const items=comments&&Array.isArray(comments.items)?comments.items as Obj[]:[];
 const people=reactions&&Array.isArray(reactions.people)?reactions.people as Obj[]:[];
 const groups=new Map<string,Obj[]>();
 for(const p of people){const t=str(p.reaction)||'unknown';if(!groups.has(t))groups.set(t,[]);groups.get(t)!.push(p);}
 const types=[...groups.keys()].sort((a,b)=>(ORDER.indexOf(a)+1||99)-(ORDER.indexOf(b)+1||99));
 const status=(c:Obj|null)=>c&&c.complete===true?` <span class="ok">${h(W.complete)}</span>`:c&&c.complete===false?` <span class="ko">${h(W.incomplete)}</span>`:'';
 const distinct=new Set([...people.map(p=>str(p.url)||str(p.name)),...items.map(c=>str(c.url)||str(c.author))].filter(Boolean)).size;
 // 1. The post analysed
 if(post){
  parts.push(`<h2 class="sec">${h(W.secPost)}</h2>${an&&an.title?`<p class="lead">${h(an.title)}</p>`:''}`);
  parts.push(`<section class="card"><div class="row">${avatar(str(post.author),str(post.photo),str(post.authorProfileUrl))}<div>${nameLink(str(post.author),str(post.authorProfileUrl))}<div class="sub">${h([post.headline,post.time].filter(Boolean).join(' · '))}</div></div></div><p class="txt">${h(post.text)}</p>${pid?`<div class="sub">${h(W.postId)} : ${h(pid.urn)}</div>`:''}${safeUrl(str(post.url))?`<a class="btn" href="${h(post.url)}" target="_blank" rel="noopener">${h(W.openPost)}</a>`:''}</section>`);
  const tiles=[[people.length+(reactions&&reactions.expected!=null&&reactions.expected!==people.length?' / '+reactions.expected:''),W.reactions],[items.length,W.comments],[distinct,W.people]] as Array<[unknown,string]>;
  parts.push(`<div class="kpis">${tiles.map(([v,l])=>`<div class="kpi"><b>${h(v)}</b><span>${h(l)}</span></div>`).join('')}</div>`);
 }
 // 2. Summary written by the assistant
 if(an){
  parts.push(`<h2 class="sec">${h(W.summary)}</h2><div class="ai">${h(W.aiNote.replace('{agent}',an.agent))}</div>`);
  if(an.postSummary)parts.push(`<section class="card"><h3>${h(W.postSummary)}</h3><p class="txt">${h(an.postSummary)}</p></section>`);
  if(an.takeaways.length)parts.push(`<section class="card"><h3>${h(W.takeaways)}</h3><ul>${an.takeaways.map(o=>`<li>${h(o)}</li>`).join('')}</ul></section>`);
 }
 // 3. Audience: who reacted
 if(an&&(an.audience.length||(an.audienceGroups||[]).length||(an.companies||[]).length)){
  const aud=an.audience.map(x=>({label:x.domain,count:x.count}));
  const total=aud.reduce((a,b)=>a+b.count,0)||people.length;
  parts.push(`<h2 class="sec">${h(W.secAudience)}</h2>`);
  if(aud.length)parts.push(`<section class="card"><h3>${h(W.domains)}</h3>${donut(aud,String(total),W.people)}</section>`);
  if((an.audienceGroups||[]).length)parts.push(`<section class="card"><h3>${h(W.audienceGroups)}</h3>${hbars(an.audienceGroups!,total,'pct')}</section>`);
  if((an.companies||[]).length)parts.push(`<section class="card"><h3>${h(W.companies)}</h3>${hbars(an.companies!,total,'pct',W.profilesOf)}</section>`);
 }
 // 4. Comments: tone, themes, opinions, then every comment
 if(comments){
  parts.push(`<h2 class="sec">${h(W.comments)} — ${items.length}${comments.displayed!=null?` / ${h(comments.displayed)}`:''}${status(comments)}</h2>`);
  if(an&&(an.commentsSummary||an.sentiment||an.opinions.length||(an.themes||[]).length)){
   let body=an.commentsSummary?`<p class="txt">${h(an.commentsSummary)}</p>`:'';
   if(an.sentiment){
    const st=[{label:W.positive,count:an.sentiment.positive},{label:W.neutral,count:an.sentiment.neutral},{label:W.negative,count:an.sentiment.negative}];
    const tot=st.reduce((a,b)=>a+b.count,0);
    const cols=['#16a34a','#94a3b8','#dc2626'];
    const legend=`<ul class="lg">${st.map((x,i)=>`<li><i style="background:${cols[i]}"></i><span>${h(x.label)}</span><em>${x.count} ${h(W.commentsN)}</em><b>${fmtPct(pct(x.count,tot))}</b></li>`).join('')}</ul>`;
    body+=`<h4>${h(W.commentTone)}</h4>${donut(st.map((x,i)=>({...x,c:cols[i]})).filter(x=>x.count>0),fmtPct(pct(an.sentiment.positive,tot)),W.positive,st.map((x,i)=>({x,c:cols[i]})).filter(o=>o.x.count>0).map(o=>o.c),legend)}`;
   }
   if((an.themes||[]).length)body+=`<h4>${h(W.themes)}</h4>${hbars(an.themes!,0,'count')}<div class="sub">${h(W.themesNote)}</div>`;
   if(an.opinions.length)body+=`<h4>${h(W.opinions)}</h4><ul>${an.opinions.map(o=>`<li>${h(o)}</li>`).join('')}</ul>`;
   parts.push(`<section class="card"><h3>${h(W.commentsSummary)}</h3>${body}</section>`);
  }
  if(items.length)parts.push(`<section class="card">`+items.map(c=>`<div class="cm${c.isReply?' reply':''}"><div class="row">${avatar(str(c.author),str(c.photo),str(c.url))}<div>${nameLink(str(c.author),str(c.url))}${c.isPostAuthor?` <span class="badge">${h(W.author)}</span>`:''}<div class="sub">${h([c.headline,c.time,c.isReply&&c.parentAuthor?W.replyTo+' '+c.parentAuthor:'',typeof c.reactions==='number'?c.reactions+' '+W.reactionsN:''].filter(Boolean).join(' · '))}</div></div></div><p class="txt">${h(c.text)}</p></div>`).join('')+'</section>');
 }
 // 5. Reactions: chart, then the people of each reaction
 if(reactions){
  parts.push(`<h2 class="sec">${h(W.reactions)} — ${people.length}${reactions.expected!=null?` / ${h(reactions.expected)}`:''}${status(reactions)}</h2>`);
  if(people.length)parts.push(`<section class="card"><h3>${h(W.reactionsChart)}</h3>${reactionChart(types.map(t=>({type:t,count:groups.get(t)!.length})),rimg)}<div class="sum">${types.map(t=>`<span class="pill">${ORDER.includes(t)?`<img class="ri" src="${rimg(t)}" alt="">`:''}${h(LBL(t)||W.unknown)} <b>${groups.get(t)!.length}</b> <small>${fmtPct(pct(groups.get(t)!.length,people.length))}</small></span>`).join('')}</div></section>`);
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
.hdr{background:#0a66c2;color:#fff;padding:20px 16px 18px}.hdr .in{max-width:760px;margin:0 auto}.hdr .top{display:flex;align-items:center;gap:16px}.hdr .grow{min-width:0;flex:1}.hdr .brand{width:56px;height:56px;border-radius:12px;background:#fff;flex:none;object-fit:contain}
.hdr h1{margin:0;font-size:22px;line-height:1.2;color:#fff}.hdr .pid{font-size:12px;opacity:.9;overflow-wrap:anywhere}
.logo{width:56px;height:56px;border-radius:12px;background:#fff;flex:none;box-shadow:0 0 0 2px rgba(255,255,255,.85)}
.tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.25)}.tools a,.tools button{display:inline-flex;align-items:center;gap:6px;font:600 13px system-ui,sans-serif;background:#fff;color:#0a66c2;border:0;border-radius:999px;padding:8px 14px;text-decoration:none;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.15)}.tools svg{width:16px;height:16px;flex:none}.tools .danger{background:#fff;color:#b42318}.tools button:disabled{opacity:.6}
@media print{.tools{display:none}body{background:#fff}.card{break-inside:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.ok{color:#15803d;font-size:13px}.ko{color:#b91c1c;font-size:13px}.btn{display:inline-block;margin-top:10px;background:var(--blue);color:#fff;border-radius:10px;padding:8px 12px;text-decoration:none;font-weight:600}
footer{color:var(--muted);font-size:12px;margin:24px 0}
h2.sec{font-size:18px;margin:28px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--blue)}.lead{font-size:17px;font-weight:700;margin:4px 0 8px}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0}.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;text-align:center}.kpi b{display:block;font-size:22px;font-variant-numeric:tabular-nums}.kpi span{color:var(--muted);font-size:13px}
.dwrap{display:flex;align-items:center;gap:18px;flex-wrap:wrap}.donut{width:150px;height:150px;flex:none}.dc{font-size:22px;font-weight:800;fill:var(--ink)}.ds{font-size:10px;fill:var(--muted)}
.lg{list-style:none;margin:0;padding:0;flex:1;min-width:200px}.lg li{display:flex;align-items:center;gap:8px;margin:6px 0;font-size:14px}.lg i{width:11px;height:11px;border-radius:50%;flex:none}.lg span{flex:1;min-width:0}.lg em{font-style:normal;color:var(--muted);font-size:13px}.lg b{font-variant-numeric:tabular-nums}
.hb{margin:10px 0}.hbt{display:flex;justify-content:space-between;gap:10px;font-size:14px;margin-bottom:4px}.hbt b{font-variant-numeric:tabular-nums}
.rc{width:100%;max-width:520px;height:auto;display:block;margin:4px auto 8px}.rc .gl{stroke:var(--line);stroke-width:1}.rc .tk{font-size:9px;fill:var(--muted)}.rc .bv{font-size:11px;font-weight:700;fill:var(--ink)}.rc .bl{font-size:10px;fill:var(--ink)}
.ai{margin:-4px 0 8px}h4{margin:12px 0 4px;font-size:14px}ul{margin:4px 0 0;padding-inline-start:20px}li{margin:4px 0}
.tone{margin-top:10px}.bar{display:flex;height:12px;border-radius:999px;overflow:hidden;background:var(--line);margin:6px 0}.seg.positive,.dot.positive{background:#16a34a}.seg.neutral,.dot.neutral{background:#94a3b8}.seg.negative,.dot.negative{background:#dc2626}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--muted)}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-inline-end:5px;vertical-align:middle}
.aud{display:grid;grid-template-columns:minmax(90px,38%) 1fr 32px;align-items:center;gap:10px;margin:6px 0;font-size:14px}.aud .lbl{overflow-wrap:anywhere}.track{height:10px;border-radius:999px;background:var(--line);overflow:hidden}.fill{display:block;height:100%;background:var(--blue)}.aud b{text-align:end}
</style></head><body><header class="hdr"><div class="in"><div class="top">${opt.logo?`<img class="logo" src="${h(opt.logo)}" alt="LinkedIn">`:'<span></span>'}<div class="grow"><h1>${h(W.title)}</h1>${pid?`<div class="pid">${h(W.postId)} : ${h(pid.urn)}</div>`:''}<div class="pid">${h(W.readBy)} · ${h(new Date(str(r.createdAt)||Date.now()).toLocaleString(lang==='zh'?'zh-CN':lang,{timeZone:'Europe/Paris',dateStyle:'medium',timeStyle:'short'}))}</div></div>${opt.brandLogo?`<img class="brand" src="${h(opt.brandLogo)}" alt="CamMicGo SEO MCP">`:''}</div>${opt.nonce||opt.downloadUrl?`<div class="tools">${opt.nonce?'<button type="button" id="pdf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M12 12v6M9 15l3 3 3-3"/></svg><span>'+h(W.pdf)+'</span></button>':''}${opt.downloadUrl?`<a href="${h(opt.downloadUrl)}" download><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/></svg><span>${h(W.html)}</span></a>`:''}${opt.nonce?'<button type="button" id="del" class="danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6"/></svg><span>'+h(W.del)+'</span></button>':''}</div>`:''}</div></header><main>${parts.join('')}<footer>${h(opt.images?W.exportFooter:W.footer)}</footer></main>${opt.nonce?`<script nonce="${h(opt.nonce)}">document.getElementById('pdf').addEventListener('click',function(){window.print()});
document.getElementById('del').addEventListener('click',function(){var b=this;if(b.dataset.armed!=='1'){b.dataset.armed='1';b.querySelector('span').textContent=${JSON.stringify(W.confirm)};return;}b.disabled=true;fetch(location.pathname,{method:'DELETE'}).then(function(r){document.querySelector('main').innerHTML='<section class="card"><p>'+(r.ok?${JSON.stringify(W.deleted)}:${JSON.stringify(W.deleteFailed)})+'</p></section>';document.querySelector('.tools').remove();});});</script>`:''}</body></html>`;
}

/** The assistant's analysis of a report, bounded and cleaned before it is stored with the report. */
export type Count={label:string;count:number};
export type ReportAnalysis={title:string;postSummary:string;commentsSummary:string;sentiment:{positive:number;neutral:number;negative:number}|null;opinions:string[];audience:Array<{domain:string;count:number}>;audienceGroups?:Count[];companies?:Count[];themes?:Count[];takeaways:string[];agent:string};
export function cleanAnalysis(a:Record<string,unknown>,agent:string):ReportAnalysis{
 const t=(v:unknown,n:number)=>String(v??'').replace(/\s+\n/g,'\n').trim().slice(0,n);
 const list=(v:unknown,n:number,len:number)=>(Array.isArray(v)?v:[]).map(x=>t(x,len)).filter(Boolean).slice(0,n);
 const sRaw=a.sentiment&&typeof a.sentiment==='object'?a.sentiment as Record<string,unknown>:null;
 const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)&&n>=0?Math.min(n,100000):0;};
 const counts=(v:unknown,n:number):Count[]=>(Array.isArray(v)?v:[]).map(x=>{const o=(x&&typeof x==='object'?x:{}) as Record<string,unknown>;return {label:t(o.label??o.name??o.theme??o.group,80),count:num(o.count)};}).filter(x=>x.label&&x.count>0).slice(0,n);
 const sentiment=sRaw?{positive:num(sRaw.positive),neutral:num(sRaw.neutral),negative:num(sRaw.negative)}:null;
 return {
  title:t(a.title,160),postSummary:t(a.postSummary,1500),commentsSummary:t(a.commentsSummary,2000),
  sentiment:sentiment&&(sentiment.positive+sentiment.neutral+sentiment.negative)>0?sentiment:null,
  opinions:list(a.opinions,10,400),takeaways:list(a.takeaways,10,400),
  audience:(Array.isArray(a.audience)?a.audience:[]).map(x=>{const o=(x&&typeof x==='object'?x:{}) as Record<string,unknown>;return {domain:t(o.domain,80),count:num(o.count)};}).filter(x=>x.domain&&x.count>0).slice(0,12),
  audienceGroups:counts(a.audienceGroups,8),companies:counts(a.companies,10),themes:counts(a.themes,10),
  agent:t(agent,40)||'AI',
 };
}
const PALETTE=['#0a66c2','#14a38b','#e0a43b','#8e6bd4','#e07a5f','#6f8bb0','#a3acb9','#2f9fd8','#c56fa8','#7aa83c','#d1863b','#5b6b86'];
const pct=(n:number,t:number)=>t?Math.round(n*1000/t)/10:0;
const fmtPct=(n:number)=>String(n).replace('.',W===REPORT_WORDS.en||W===REPORT_WORDS.zh||W===REPORT_WORDS.ja||W===REPORT_WORDS.ko?'.':',')+' %';
/** SVG donut (vector, prints sharply) with a centre label, and a legend with percentages. */
function donut(items:Count[],center:string,sub:string,colors=PALETTE,legendHtml?:string){
 const total=items.reduce((a,b)=>a+b.count,0);
 if(!total)return '';
 const R=52,C=2*Math.PI*R;let off=0;
 const arcs=items.map((it,i)=>{const len=it.count/total*C;const a=`<circle r="${R}" cx="70" cy="70" fill="none" stroke="${colors[i%colors.length]}" stroke-width="22" stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 70 70)"/>`;off+=len;return a;}).join('');
 const svg=`<svg class="donut" viewBox="0 0 140 140" role="img" aria-label="${h(center+' '+sub)}"><circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--line)" stroke-width="22"/>${arcs}<text x="70" y="68" text-anchor="middle" class="dc">${h(center)}</text><text x="70" y="86" text-anchor="middle" class="ds">${h(sub)}</text></svg>`;
 const legend=legendHtml??`<ul class="lg">${items.map((it,i)=>`<li><i style="background:${colors[i%colors.length]}"></i><span>${h(it.label)}</span><b>${fmtPct(pct(it.count,total))}</b></li>`).join('')}</ul>`;
 return `<div class="dwrap">${svg}${legend}</div>`;
}
/** Horizontal bars with the share of a total (or the raw count). */
function hbars(items:Count[],total:number,mode:'pct'|'count',note=''){
 if(!items.length)return '';
 const max=Math.max(...items.map(x=>x.count));
 return items.map((x,i)=>`<div class="hb"><div class="hbt"><span>${h(x.label)}</span><b>${mode==='pct'?fmtPct(pct(x.count,total)):x.count}</b></div><div class="track"><span class="fill" style="width:${Math.round(x.count*100/(mode==='pct'?total:max))}%;background:${PALETTE[i%PALETTE.length]}"></span></div>${mode==='pct'&&note?`<div class="sub">${h(note.replace('{n}',String(x.count)).replace('{t}',String(total)))}</div>`:''}</div>`).join('');
}
/** Reaction bar chart: LinkedIn's names in the report language, with the reaction picture under each bar. */
function reactionChart(counts:Array<{type:string;count:number}>,rimg:(t:string)=>string){
 if(!counts.length)return '';
 const max=Math.max(...counts.map(c=>c.count)),n=counts.length,W0=320,H=210,top=24,base=150,slot=(W0-40)/n,bw=Math.min(48,slot*.6);
 const step=max<=5?1:max<=10?2:max<=20?4:Math.ceil(max/5);
 const ticks:number[]=[];for(let v=0;v<=max;v+=step)ticks.push(v);
 const y=(v:number)=>base-(v/Math.max(max,1))*(base-top);
 return `<svg class="rc" viewBox="0 0 ${W0} ${H}" role="img" aria-label="${h(W.reactionsChart)}">${ticks.map(v=>`<line x1="30" x2="${W0-6}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="gl"/><text x="24" y="${(y(v)+4).toFixed(1)}" text-anchor="end" class="tk">${v}</text>`).join('')}${counts.map((c,i)=>{const cx=34+slot*i+slot/2;return `<rect x="${(cx-bw/2).toFixed(1)}" y="${y(c.count).toFixed(1)}" width="${bw.toFixed(1)}" height="${(base-y(c.count)).toFixed(1)}" rx="5" fill="#0a66c2"/><text x="${cx.toFixed(1)}" y="${(y(c.count)-6).toFixed(1)}" text-anchor="middle" class="bv">${c.count}</text>${ORDER.includes(c.type)?`<image href="${h(rimg(c.type))}" x="${(cx-11).toFixed(1)}" y="${base+8}" width="22" height="22"/>`:''}<text x="${cx.toFixed(1)}" y="${base+46}" text-anchor="middle" class="bl">${h(LBL(c.type)||W.unknown)}</text>`;}).join('')}</svg>`;
}
