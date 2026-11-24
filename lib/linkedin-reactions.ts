export const REACTION_TYPES=['like','celebrate','support','love','insightful','funny'] as const;
/** Report wording in the 11 languages of the CamMicGo app (LinkedIn's own names for the reactions). */
export const REPORT_LANGS=['en','fr','es','de','pt','it','ru','zh','ja','ko','ar'] as const;
export type ReportLang=typeof REPORT_LANGS[number];
type Words={dashboard:string;interactions:string;participants:string;replyRate:string;notCalculable:string;extraction:string;partialData:string;showAll:string;clickToFilter:string;profilesShown:string;targetNote:string;messages:string;argSummary:string;args:string;questions:string;criticisms:string;offTopic:string;recommendations:string;recoNote:string;glossary:string;overall:string;company:string;domain:string;illustrations:string;selectFilter:string;secPost:string;summary:string;secAudience:string;domains:string;audienceGroups:string;companies:string;profilesOf:string;themes:string;themesNote:string;reactionsChart:string;people:string;commentTone:string;commentsN:string;analysis:string;postSummary:string;commentsSummary:string;tone:string;positive:string;neutral:string;negative:string;opinions:string;audience:string;takeaways:string;aiNote:string;title:string;postId:string;readBy:string;pdf:string;html:string;del:string;confirm:string;comments:string;reactions:string;complete:string;incomplete:string;author:string;replyTo:string;reactionsN:string;openPost:string;member:string;unknown:string;footer:string;exportFooter:string;deleted:string;deleteFailed:string;post:string;notLoaded:string;
 like:string;celebrate:string;support:string;love:string;insightful:string;funny:string};
export const REPORT_WORDS:Record<ReportLang,Words>={
 en:{dashboard:'Engagement',interactions:'Total interactions',participants:'Unique participants',replyRate:'Author reply rate',notCalculable:'not calculable',extraction:'Extraction',partialData:'partial',showAll:'Show all',clickToFilter:'Click a bar, a segment or a line to see the people concerned.',profilesShown:'{n} profile(s) shown',targetNote:'Audience that interacted with the post (reactions and comments), not everyone who saw it.',messages:'messages',argSummary:'Arguments and opinions',args:'Arguments',questions:'Questions',criticisms:'Criticisms',offTopic:'about another subject',recommendations:'Editorial recommendations',recoNote:'Suggestions based on this audience; not predictions.',glossary:'Glossary',overall:'Overall synthesis',company:'Company',domain:'Domain',illustrations:'Illustrations',selectFilter:'Select a category above to see the profiles.',secPost:'Post analysed',summary:'Summary',secAudience:'Audience',domains:'Professional domains',audienceGroups:'Target audience',companies:'Companies represented',profilesOf:'{n} of {t} profiles',themes:'Main comment themes',themesNote:'A comment can cover several themes.',reactionsChart:'Reaction breakdown',people:'people',commentTone:'Comment tone',commentsN:'comment(s)',analysis:'Analysis',postSummary:'Post summary',commentsSummary:'What the comments say',tone:'Overall tone',positive:'Positive',neutral:'Neutral',negative:'Negative',opinions:'Main opinions',audience:'Who reacted',takeaways:'Key takeaways',aiNote:'Written by the AI assistant ({agent}) from the data read on LinkedIn; to be checked.',title:'LinkedIn post report',postId:'Post ID',readBy:'Read-only, by the CamMicGo app',pdf:'Export PDF',html:'Export HTML',del:'Delete now',confirm:'Confirm deletion',comments:'Comments',reactions:'Reactions',complete:'complete',incomplete:'incomplete',author:'Author',replyTo:'replying to',reactionsN:'reaction(s)',openPost:'Open the post on LinkedIn',member:'LinkedIn member',unknown:'Not identified',footer:'No history is kept: this private, non-indexed link is deleted automatically 24 hours after it was created, or at once with “Delete now”. To keep it, export it (PDF: choose “Save as PDF”, links stay clickable).',exportFooter:'CamMicGo report export.',deleted:'Report deleted: it no longer exists on the server, photos included.',deleteFailed:'Deletion failed, please try again.',post:'Post',notLoaded:'Not loaded by LinkedIn',
  like:'Like',celebrate:'Celebrate',support:'Support',love:'Love',insightful:'Insightful',funny:'Funny'},
 fr:{dashboard:'Engagement',interactions:'Interactions totales',participants:'Participants uniques',replyRate:'Taux de réponse de l’auteur',notCalculable:'non calculable',extraction:'Extraction',partialData:'partielle',showAll:'Tout afficher',clickToFilter:'Cliquez sur une barre, un segment ou une ligne pour voir les personnes concernées.',profilesShown:'{n} profil(s) affiché(s)',targetNote:'Audience ayant interagi avec la publication (réactions et commentaires), et non l’ensemble des personnes l’ayant consultée.',messages:'messages',argSummary:'Arguments et opinions',args:'Arguments',questions:'Interrogations',criticisms:'Critiques',offTopic:'sur un autre sujet',recommendations:'Recommandations éditoriales',recoNote:'Pistes fondées sur cette audience ; ce ne sont pas des prédictions.',glossary:'Glossaire',overall:'Synthèse globale',company:'Entreprise',domain:'Domaine',illustrations:'Illustrations',selectFilter:'Sélectionnez une catégorie ci-dessus pour voir les profils.',secPost:'Post analysé',summary:'Synthèse',secAudience:'Audience',domains:'Domaines professionnels',audienceGroups:'Public cible',companies:'Entreprises représentées',profilesOf:'{n} profils sur {t}',themes:'Principales thématiques des commentaires',themesNote:'Un commentaire peut aborder plusieurs thématiques.',reactionsChart:'Répartition des réactions',people:'personnes',commentTone:'Tonalité des commentaires',commentsN:'commentaire(s)',analysis:'Analyse',postSummary:'Résumé du post',commentsSummary:'Ce que disent les commentaires',tone:'Tonalité générale',positive:'Positif',neutral:'Neutre',negative:'Négatif',opinions:'Principaux avis',audience:'Qui a réagi',takeaways:'À retenir',aiNote:'Rédigé par l’assistant IA ({agent}) à partir des données lues sur LinkedIn ; à vérifier.',title:'Rapport de post LinkedIn',postId:'Identifiant du post',readBy:'Lu en lecture seule par l’application CamMicGo',pdf:'Exporter en PDF',html:'Exporter en HTML',del:'Supprimer maintenant',confirm:'Confirmer la suppression',comments:'Commentaires',reactions:'Réactions',complete:'complet',incomplete:'incomplet',author:'Auteur',replyTo:'en réponse à',reactionsN:'réaction(s)',openPost:'Ouvrir la publication sur LinkedIn',member:'Membre LinkedIn',unknown:'Non identifié',footer:'Aucun historique n’est conservé : ce lien privé et non indexé est supprimé automatiquement 24 h après sa création, ou tout de suite avec « Supprimer maintenant ». Pour le garder, exportez-le (PDF : choisissez « Enregistrer au format PDF », les liens restent cliquables).',exportFooter:'Export du rapport CamMicGo.',deleted:'Rapport supprimé : il n’existe plus sur le serveur, photos comprises.',deleteFailed:'La suppression a échoué, réessayez.',post:'Publication',notLoaded:'Non chargé par LinkedIn',
  like:'J’aime',celebrate:'Bravo',support:'Soutien',love:'J’adore',insightful:'Instructif',funny:'Drôle'},
 es:{dashboard:'Interacción',interactions:'Interacciones totales',participants:'Participantes únicos',replyRate:'Tasa de respuesta del autor',notCalculable:'no calculable',extraction:'Extracción',partialData:'parcial',showAll:'Mostrar todo',clickToFilter:'Haz clic en una barra, un segmento o una línea para ver a las personas.',profilesShown:'{n} perfil(es) mostrado(s)',targetNote:'Audiencia que interactuó con la publicación (reacciones y comentarios), no todas las personas que la vieron.',messages:'mensajes',argSummary:'Argumentos y opiniones',args:'Argumentos',questions:'Preguntas',criticisms:'Críticas',offTopic:'sobre otro tema',recommendations:'Recomendaciones editoriales',recoNote:'Ideas basadas en esta audiencia; no son predicciones.',glossary:'Glosario',overall:'Síntesis global',company:'Empresa',domain:'Ámbito',illustrations:'Ilustraciones',selectFilter:'Selecciona una categoría arriba para ver los perfiles.',secPost:'Publicación analizada',summary:'Síntesis',secAudience:'Audiencia',domains:'Ámbitos profesionales',audienceGroups:'Público objetivo',companies:'Empresas representadas',profilesOf:'{n} de {t} perfiles',themes:'Temas principales de los comentarios',themesNote:'Un comentario puede tratar varios temas.',reactionsChart:'Reparto de reacciones',people:'personas',commentTone:'Tono de los comentarios',commentsN:'comentario(s)',analysis:'Análisis',postSummary:'Resumen de la publicación',commentsSummary:'Lo que dicen los comentarios',tone:'Tono general',positive:'Positivo',neutral:'Neutral',negative:'Negativo',opinions:'Opiniones principales',audience:'Quién reaccionó',takeaways:'Conclusiones',aiNote:'Redactado por el asistente de IA ({agent}) a partir de los datos leídos en LinkedIn; a verificar.',title:'Informe de publicación de LinkedIn',postId:'ID de la publicación',readBy:'Solo lectura, por la app CamMicGo',pdf:'Exportar PDF',html:'Exportar HTML',del:'Eliminar ahora',confirm:'Confirmar eliminación',comments:'Comentarios',reactions:'Reacciones',complete:'completo',incomplete:'incompleto',author:'Autor',replyTo:'en respuesta a',reactionsN:'reacción(es)',openPost:'Abrir la publicación en LinkedIn',member:'Miembro de LinkedIn',unknown:'No identificado',footer:'No se guarda historial: este enlace privado y no indexado se elimina automáticamente 24 h después de crearse, o al instante con «Eliminar ahora». Para conservarlo, expórtalo (PDF: elige «Guardar como PDF», los enlaces siguen activos).',exportFooter:'Exportación del informe CamMicGo.',deleted:'Informe eliminado: ya no existe en el servidor, fotos incluidas.',deleteFailed:'No se pudo eliminar, inténtalo de nuevo.',post:'Publicación',notLoaded:'No cargado por LinkedIn',
  like:'Recomendar',celebrate:'Celebrar',support:'Apoyar',love:'Encantar',insightful:'Interesante',funny:'Divertido'},
 de:{dashboard:'Interaktion',interactions:'Interaktionen gesamt',participants:'Eindeutige Teilnehmende',replyRate:'Antwortquote des Autors',notCalculable:'nicht berechenbar',extraction:'Erfassung',partialData:'unvollständig',showAll:'Alle anzeigen',clickToFilter:'Auf einen Balken, ein Segment oder eine Zeile klicken, um die Personen zu sehen.',profilesShown:'{n} Profil(e) angezeigt',targetNote:'Publikum, das mit dem Beitrag interagiert hat (Reaktionen und Kommentare), nicht alle, die ihn gesehen haben.',messages:'Nachrichten',argSummary:'Argumente und Meinungen',args:'Argumente',questions:'Fragen',criticisms:'Kritik',offTopic:'zu einem anderen Thema',recommendations:'Redaktionelle Empfehlungen',recoNote:'Vorschläge auf Basis dieses Publikums; keine Vorhersagen.',glossary:'Glossar',overall:'Gesamtfazit',company:'Unternehmen',domain:'Bereich',illustrations:'Abbildungen',selectFilter:'Oben eine Kategorie wählen, um die Profile zu sehen.',secPost:'Analysierter Beitrag',summary:'Überblick',secAudience:'Publikum',domains:'Berufsfelder',audienceGroups:'Zielgruppe',companies:'Vertretene Unternehmen',profilesOf:'{n} von {t} Profilen',themes:'Hauptthemen der Kommentare',themesNote:'Ein Kommentar kann mehrere Themen behandeln.',reactionsChart:'Verteilung der Reaktionen',people:'Personen',commentTone:'Tonalität der Kommentare',commentsN:'Kommentar(e)',analysis:'Analyse',postSummary:'Zusammenfassung des Beitrags',commentsSummary:'Was die Kommentare sagen',tone:'Gesamtstimmung',positive:'Positiv',neutral:'Neutral',negative:'Negativ',opinions:'Wichtigste Meinungen',audience:'Wer reagiert hat',takeaways:'Kernaussagen',aiNote:'Vom KI-Assistenten ({agent}) aus den auf LinkedIn gelesenen Daten verfasst; bitte prüfen.',title:'LinkedIn-Beitragsbericht',postId:'Beitrags-ID',readBy:'Nur lesend, durch die CamMicGo-App',pdf:'Als PDF exportieren',html:'Als HTML exportieren',del:'Jetzt löschen',confirm:'Löschen bestätigen',comments:'Kommentare',reactions:'Reaktionen',complete:'vollständig',incomplete:'unvollständig',author:'Autor',replyTo:'Antwort an',reactionsN:'Reaktion(en)',openPost:'Beitrag auf LinkedIn öffnen',member:'LinkedIn-Mitglied',unknown:'Nicht erkannt',footer:'Es wird kein Verlauf gespeichert: Dieser private, nicht indexierte Link wird 24 Stunden nach Erstellung automatisch gelöscht, oder sofort mit „Jetzt löschen“. Zum Behalten exportieren (PDF: „Als PDF speichern“ wählen, Links bleiben anklickbar).',exportFooter:'Export des CamMicGo-Berichts.',deleted:'Bericht gelöscht: Er existiert samt Fotos nicht mehr auf dem Server.',deleteFailed:'Löschen fehlgeschlagen, bitte erneut versuchen.',post:'Beitrag',notLoaded:'Von LinkedIn nicht geladen',
  like:'Gefällt mir',celebrate:'Applaus',support:'Unterstützung',love:'Wunderbar',insightful:'Interessant',funny:'Lustig'},
 pt:{dashboard:'Engajamento',interactions:'Interações totais',participants:'Participantes únicos',replyRate:'Taxa de resposta do autor',notCalculable:'não calculável',extraction:'Extração',partialData:'parcial',showAll:'Mostrar tudo',clickToFilter:'Clique numa barra, num segmento ou numa linha para ver as pessoas.',profilesShown:'{n} perfil(is) exibido(s)',targetNote:'Público que interagiu com a publicação (reações e comentários), não todos que a viram.',messages:'mensagens',argSummary:'Argumentos e opiniões',args:'Argumentos',questions:'Perguntas',criticisms:'Críticas',offTopic:'sobre outro assunto',recommendations:'Recomendações editoriais',recoNote:'Sugestões baseadas neste público; não são previsões.',glossary:'Glossário',overall:'Síntese geral',company:'Empresa',domain:'Área',illustrations:'Ilustrações',selectFilter:'Selecione uma categoria acima para ver os perfis.',secPost:'Publicação analisada',summary:'Síntese',secAudience:'Público',domains:'Áreas profissionais',audienceGroups:'Público-alvo',companies:'Empresas representadas',profilesOf:'{n} de {t} perfis',themes:'Principais temas dos comentários',themesNote:'Um comentário pode abordar vários temas.',reactionsChart:'Distribuição das reações',people:'pessoas',commentTone:'Tom dos comentários',commentsN:'comentário(s)',analysis:'Análise',postSummary:'Resumo da publicação',commentsSummary:'O que dizem os comentários',tone:'Tom geral',positive:'Positivo',neutral:'Neutro',negative:'Negativo',opinions:'Principais opiniões',audience:'Quem reagiu',takeaways:'Pontos principais',aiNote:'Escrito pelo assistente de IA ({agent}) a partir dos dados lidos no LinkedIn; a verificar.',title:'Relatório de publicação do LinkedIn',postId:'ID da publicação',readBy:'Somente leitura, pelo app CamMicGo',pdf:'Exportar PDF',html:'Exportar HTML',del:'Excluir agora',confirm:'Confirmar exclusão',comments:'Comentários',reactions:'Reações',complete:'completo',incomplete:'incompleto',author:'Autor',replyTo:'em resposta a',reactionsN:'reação(ões)',openPost:'Abrir a publicação no LinkedIn',member:'Membro do LinkedIn',unknown:'Não identificado',footer:'Nenhum histórico é mantido: este link privado e não indexado é excluído automaticamente 24 h após a criação, ou na hora com “Excluir agora”. Para guardá-lo, exporte (PDF: escolha “Salvar como PDF”, os links continuam clicáveis).',exportFooter:'Exportação do relatório CamMicGo.',deleted:'Relatório excluído: não existe mais no servidor, fotos incluídas.',deleteFailed:'Falha ao excluir, tente novamente.',post:'Publicação',notLoaded:'Não carregado pelo LinkedIn',
  like:'Gostei',celebrate:'Parabéns',support:'Apoio',love:'Amei',insightful:'Genial',funny:'Engraçado'},
 it:{dashboard:'Coinvolgimento',interactions:'Interazioni totali',participants:'Partecipanti unici',replyRate:'Tasso di risposta dell’autore',notCalculable:'non calcolabile',extraction:'Estrazione',partialData:'parziale',showAll:'Mostra tutto',clickToFilter:'Clicca su una barra, un segmento o una riga per vedere le persone.',profilesShown:'{n} profilo/i mostrato/i',targetNote:'Pubblico che ha interagito con il post (reazioni e commenti), non tutti quelli che l’hanno visto.',messages:'messaggi',argSummary:'Argomenti e opinioni',args:'Argomenti',questions:'Domande',criticisms:'Critiche',offTopic:'su un altro argomento',recommendations:'Raccomandazioni editoriali',recoNote:'Spunti basati su questo pubblico; non sono previsioni.',glossary:'Glossario',overall:'Sintesi complessiva',company:'Azienda',domain:'Ambito',illustrations:'Illustrazioni',selectFilter:'Seleziona una categoria qui sopra per vedere i profili.',secPost:'Post analizzato',summary:'Sintesi',secAudience:'Pubblico',domains:'Ambiti professionali',audienceGroups:'Pubblico di riferimento',companies:'Aziende rappresentate',profilesOf:'{n} profili su {t}',themes:'Temi principali dei commenti',themesNote:'Un commento può toccare più temi.',reactionsChart:'Ripartizione delle reazioni',people:'persone',commentTone:'Tono dei commenti',commentsN:'commento/i',analysis:'Analisi',postSummary:'Riassunto del post',commentsSummary:'Cosa dicono i commenti',tone:'Tono generale',positive:'Positivo',neutral:'Neutro',negative:'Negativo',opinions:'Opinioni principali',audience:'Chi ha reagito',takeaways:'Punti chiave',aiNote:'Scritto dall’assistente IA ({agent}) dai dati letti su LinkedIn; da verificare.',title:'Report del post LinkedIn',postId:'ID del post',readBy:'Sola lettura, dall’app CamMicGo',pdf:'Esporta PDF',html:'Esporta HTML',del:'Elimina ora',confirm:'Conferma eliminazione',comments:'Commenti',reactions:'Reazioni',complete:'completo',incomplete:'incompleto',author:'Autore',replyTo:'in risposta a',reactionsN:'reazione/i',openPost:'Apri il post su LinkedIn',member:'Membro LinkedIn',unknown:'Non identificato',footer:'Nessuno storico conservato: questo link privato e non indicizzato viene eliminato automaticamente 24 ore dopo la creazione, o subito con “Elimina ora”. Per conservarlo, esportalo (PDF: scegli “Salva come PDF”, i link restano cliccabili).',exportFooter:'Esportazione del report CamMicGo.',deleted:'Report eliminato: non esiste più sul server, foto comprese.',deleteFailed:'Eliminazione non riuscita, riprova.',post:'Post',notLoaded:'Non caricato da LinkedIn',
  like:'Consiglia',celebrate:'Festeggia',support:'Sostieni',love:'Love',insightful:'Perspicace',funny:'Divertente'},
 ru:{dashboard:'Вовлечённость',interactions:'Всего взаимодействий',participants:'Уникальные участники',replyRate:'Доля ответов автора',notCalculable:'не вычисляется',extraction:'Сбор данных',partialData:'неполный',showAll:'Показать всё',clickToFilter:'Нажмите на столбец, сегмент или строку, чтобы увидеть людей.',profilesShown:'Показано профилей: {n}',targetNote:'Аудитория, которая взаимодействовала с публикацией (реакции и комментарии), а не все, кто её видел.',messages:'сообщ.',argSummary:'Аргументы и мнения',args:'Аргументы',questions:'Вопросы',criticisms:'Критика',offTopic:'на другую тему',recommendations:'Редакционные рекомендации',recoNote:'Идеи на основе этой аудитории; это не прогнозы.',glossary:'Глоссарий',overall:'Общий вывод',company:'Компания',domain:'Сфера',illustrations:'Иллюстрации',selectFilter:'Выберите категорию выше, чтобы увидеть профили.',secPost:'Анализируемая публикация',summary:'Итоги',secAudience:'Аудитория',domains:'Профессиональные сферы',audienceGroups:'Целевая аудитория',companies:'Представленные компании',profilesOf:'{n} из {t} профилей',themes:'Основные темы комментариев',themesNote:'Комментарий может затрагивать несколько тем.',reactionsChart:'Распределение реакций',people:'чел.',commentTone:'Тональность комментариев',commentsN:'комм.',analysis:'Анализ',postSummary:'Краткое содержание публикации',commentsSummary:'О чём говорят комментарии',tone:'Общий тон',positive:'Позитивный',neutral:'Нейтральный',negative:'Негативный',opinions:'Основные мнения',audience:'Кто отреагировал',takeaways:'Главное',aiNote:'Составлено ИИ-ассистентом ({agent}) по данным, прочитанным в LinkedIn; требует проверки.',title:'Отчёт о публикации LinkedIn',postId:'ID публикации',readBy:'Только чтение, приложение CamMicGo',pdf:'Экспорт в PDF',html:'Экспорт в HTML',del:'Удалить сейчас',confirm:'Подтвердить удаление',comments:'Комментарии',reactions:'Реакции',complete:'полностью',incomplete:'не полностью',author:'Автор',replyTo:'в ответ',reactionsN:'реакц.',openPost:'Открыть публикацию в LinkedIn',member:'Участник LinkedIn',unknown:'Не определено',footer:'История не хранится: эта личная неиндексируемая ссылка удаляется автоматически через 24 часа после создания или сразу кнопкой «Удалить сейчас». Чтобы сохранить отчёт, экспортируйте его (PDF: «Сохранить как PDF», ссылки остаются кликабельными).',exportFooter:'Экспорт отчёта CamMicGo.',deleted:'Отчёт удалён: его больше нет на сервере, включая фото.',deleteFailed:'Не удалось удалить, попробуйте ещё раз.',post:'Публикация',notLoaded:'Не загружено LinkedIn',
  like:'Нравится',celebrate:'Поздравляю',support:'Поддерживаю',love:'Восхищаюсь',insightful:'Интересно',funny:'Смешно'},
 zh:{dashboard:'互动',interactions:'互动总数',participants:'独立参与者',replyRate:'作者回复率',notCalculable:'无法计算',extraction:'采集',partialData:'不完整',showAll:'全部显示',clickToFilter:'点击柱、扇区或行即可查看相关人员。',profilesShown:'显示 {n} 个资料',targetNote:'与该动态互动过的受众（互动和评论），并非所有看过的人。',messages:'条消息',argSummary:'论点与观点',args:'论点',questions:'疑问',criticisms:'批评',offTopic:'关于其他话题',recommendations:'内容建议',recoNote:'基于此受众的建议，并非预测。',glossary:'术语表',overall:'总体结论',company:'公司',domain:'领域',illustrations:'配图',selectFilter:'在上方选择一个类别以查看资料。',secPost:'所分析的动态',summary:'概要',secAudience:'受众',domains:'职业领域',audienceGroups:'目标受众',companies:'涉及的公司',profilesOf:'{t} 个资料中的 {n} 个',themes:'评论主要话题',themesNote:'一条评论可能涉及多个话题。',reactionsChart:'互动分布',people:'人',commentTone:'评论情绪',commentsN:'条评论',analysis:'分析',postSummary:'动态摘要',commentsSummary:'评论观点',tone:'整体情绪',positive:'正面',neutral:'中性',negative:'负面',opinions:'主要观点',audience:'谁做出了互动',takeaways:'要点',aiNote:'由 AI 助手（{agent}）根据在 LinkedIn 上读取的数据撰写，请核实。',title:'LinkedIn 动态报告',postId:'动态 ID',readBy:'由 CamMicGo 应用只读获取',pdf:'导出 PDF',html:'导出 HTML',del:'立即删除',confirm:'确认删除',comments:'评论',reactions:'互动',complete:'完整',incomplete:'不完整',author:'作者',replyTo:'回复',reactionsN:'个互动',openPost:'在 LinkedIn 上打开动态',member:'LinkedIn 会员',unknown:'未识别',footer:'不保留任何历史：此私密、不被索引的链接会在创建 24 小时后自动删除，或点击“立即删除”立刻删除。如需保留，请导出（PDF：选择“另存为 PDF”，链接仍可点击）。',exportFooter:'CamMicGo 报告导出。',deleted:'报告已删除：服务器上已不存在，包括照片。',deleteFailed:'删除失败，请重试。',post:'动态',notLoaded:'LinkedIn 未加载',
  like:'赞',celebrate:'庆祝',support:'支持',love:'喜爱',insightful:'有见地',funny:'有趣'},
 ja:{dashboard:'エンゲージメント',interactions:'インタラクション合計',participants:'ユニーク参加者',replyRate:'投稿者の返信率',notCalculable:'算出不可',extraction:'取得状況',partialData:'一部のみ',showAll:'すべて表示',clickToFilter:'棒・セグメント・行をクリックすると該当する人が表示されます。',profilesShown:'{n} 件のプロフィールを表示',targetNote:'投稿に反応した人（リアクションとコメント）であり、閲覧したすべての人ではありません。',messages:'件',argSummary:'主張と意見',args:'主張',questions:'疑問',criticisms:'批判',offTopic:'別の話題について',recommendations:'編集上の提案',recoNote:'このオーディエンスに基づく提案であり、予測ではありません。',glossary:'用語集',overall:'総括',company:'会社',domain:'分野',illustrations:'画像',selectFilter:'上でカテゴリーを選ぶとプロフィールが表示されます。',secPost:'分析した投稿',summary:'概要',secAudience:'オーディエンス',domains:'職種の分野',audienceGroups:'ターゲット層',companies:'所属企業',profilesOf:'{t} 人中 {n} 人',themes:'コメントの主なテーマ',themesNote:'1 件のコメントが複数のテーマに触れる場合があります。',reactionsChart:'リアクションの内訳',people:'人',commentTone:'コメントのトーン',commentsN:'件のコメント',analysis:'分析',postSummary:'投稿の要約',commentsSummary:'コメントの傾向',tone:'全体のトーン',positive:'肯定的',neutral:'中立',negative:'否定的',opinions:'主な意見',audience:'リアクションした人',takeaways:'まとめ',aiNote:'AI アシスタント（{agent}）が LinkedIn で読み取ったデータから作成。要確認。',title:'LinkedIn 投稿レポート',postId:'投稿 ID',readBy:'CamMicGo アプリによる読み取り専用',pdf:'PDF で書き出す',html:'HTML で書き出す',del:'今すぐ削除',confirm:'削除を確認',comments:'コメント',reactions:'リアクション',complete:'すべて取得',incomplete:'一部のみ',author:'投稿者',replyTo:'への返信',reactionsN:'件のリアクション',openPost:'LinkedIn で投稿を開く',member:'LinkedIn メンバー',unknown:'不明',footer:'履歴は保存されません。この非公開・非インデックスのリンクは作成から 24 時間後に自動削除され、「今すぐ削除」ですぐに削除できます。残す場合は書き出してください（PDF：「PDF として保存」を選択、リンクはクリック可能なままです）。',exportFooter:'CamMicGo レポートの書き出し。',deleted:'レポートを削除しました。写真も含めサーバーに残っていません。',deleteFailed:'削除できませんでした。もう一度お試しください。',post:'投稿',notLoaded:'LinkedIn が読み込まなかった件数',
  like:'いいね',celebrate:'称賛',support:'応援',love:'大好き',insightful:'なるほど',funny:'面白い'},
 ko:{dashboard:'참여',interactions:'전체 상호작용',participants:'고유 참여자',replyRate:'작성자 답글률',notCalculable:'계산 불가',extraction:'수집',partialData:'일부',showAll:'전체 보기',clickToFilter:'막대, 구간 또는 줄을 누르면 해당 인물이 표시됩니다.',profilesShown:'프로필 {n}개 표시',targetNote:'게시물과 상호작용한 오디언스(반응과 댓글)이며, 게시물을 본 모든 사람은 아닙니다.',messages:'개 메시지',argSummary:'주장과 의견',args:'주장',questions:'질문',criticisms:'비판',offTopic:'다른 주제에 대한',recommendations:'콘텐츠 제안',recoNote:'이 오디언스를 바탕으로 한 제안이며 예측이 아닙니다.',glossary:'용어집',overall:'종합 결론',company:'회사',domain:'분야',illustrations:'이미지',selectFilter:'위에서 범주를 선택하면 프로필이 표시됩니다.',secPost:'분석한 게시물',summary:'요약',secAudience:'오디언스',domains:'직무 분야',audienceGroups:'타깃 오디언스',companies:'소속 기업',profilesOf:'{t}명 중 {n}명',themes:'댓글 주요 주제',themesNote:'댓글 하나가 여러 주제를 다룰 수 있습니다.',reactionsChart:'반응 분포',people:'명',commentTone:'댓글 분위기',commentsN:'개 댓글',analysis:'분석',postSummary:'게시물 요약',commentsSummary:'댓글 내용',tone:'전체 분위기',positive:'긍정',neutral:'중립',negative:'부정',opinions:'주요 의견',audience:'반응한 사람',takeaways:'핵심 요약',aiNote:'AI 어시스턴트({agent})가 LinkedIn에서 읽은 데이터로 작성했습니다. 확인이 필요합니다.',title:'LinkedIn 게시물 보고서',postId:'게시물 ID',readBy:'CamMicGo 앱으로 읽기 전용 수집',pdf:'PDF로 내보내기',html:'HTML로 내보내기',del:'지금 삭제',confirm:'삭제 확인',comments:'댓글',reactions:'반응',complete:'전체',incomplete:'일부',author:'작성자',replyTo:'에게 답글',reactionsN:'개 반응',openPost:'LinkedIn에서 게시물 열기',member:'LinkedIn 회원',unknown:'확인 불가',footer:'기록은 보관되지 않습니다. 이 비공개·비색인 링크는 생성 24시간 후 자동 삭제되며 “지금 삭제”로 즉시 삭제할 수 있습니다. 보관하려면 내보내세요(PDF: “PDF로 저장” 선택, 링크는 계속 클릭 가능).',exportFooter:'CamMicGo 보고서 내보내기.',deleted:'보고서가 삭제되었습니다. 사진을 포함해 서버에 남아 있지 않습니다.',deleteFailed:'삭제하지 못했습니다. 다시 시도하세요.',post:'게시물',notLoaded:'LinkedIn에서 불러오지 않음',
  like:'추천',celebrate:'축하',support:'응원',love:'마음에 쏙듦',insightful:'통찰력',funny:'웃음'},
 ar:{dashboard:'التفاعل',interactions:'إجمالي التفاعلات',participants:'المشاركون الفريدون',replyRate:'نسبة ردود الكاتب',notCalculable:'غير قابل للحساب',extraction:'الاستخراج',partialData:'جزئي',showAll:'عرض الكل',clickToFilter:'انقر على عمود أو جزء أو سطر لرؤية الأشخاص المعنيين.',profilesShown:'عرض {n} ملف',targetNote:'الجمهور الذي تفاعل مع المنشور (تفاعلات وتعليقات)، وليس كل من شاهده.',messages:'رسائل',argSummary:'الحجج والآراء',args:'الحجج',questions:'التساؤلات',criticisms:'الانتقادات',offTopic:'حول موضوع آخر',recommendations:'توصيات تحريرية',recoNote:'اقتراحات مبنية على هذا الجمهور؛ وليست تنبؤات.',glossary:'مسرد المصطلحات',overall:'الخلاصة العامة',company:'الشركة',domain:'المجال',illustrations:'الصور',selectFilter:'اختر فئة أعلاه لرؤية الملفات.',secPost:'المنشور الذي تم تحليله',summary:'الخلاصة',secAudience:'الجمهور',domains:'المجالات المهنية',audienceGroups:'الجمهور المستهدف',companies:'الشركات الممثَّلة',profilesOf:'{n} من {t} ملفات',themes:'أبرز موضوعات التعليقات',themesNote:'قد يتناول التعليق الواحد عدة موضوعات.',reactionsChart:'توزيع التفاعلات',people:'أشخاص',commentTone:'نبرة التعليقات',commentsN:'تعليق',analysis:'التحليل',postSummary:'ملخص المنشور',commentsSummary:'ما تقوله التعليقات',tone:'النبرة العامة',positive:'إيجابي',neutral:'محايد',negative:'سلبي',opinions:'أبرز الآراء',audience:'من تفاعل',takeaways:'أهم النقاط',aiNote:'كتبه مساعد الذكاء الاصطناعي ({agent}) من البيانات المقروءة على LinkedIn؛ يُرجى التحقق.',title:'تقرير منشور LinkedIn',postId:'معرّف المنشور',readBy:'قراءة فقط بواسطة تطبيق CamMicGo',pdf:'تصدير PDF',html:'تصدير HTML',del:'احذف الآن',confirm:'تأكيد الحذف',comments:'التعليقات',reactions:'التفاعلات',complete:'كامل',incomplete:'غير كامل',author:'الكاتب',replyTo:'ردًا على',reactionsN:'تفاعل',openPost:'فتح المنشور على LinkedIn',member:'عضو LinkedIn',unknown:'غير محدد',footer:'لا يُحفظ أي سجل: يُحذف هذا الرابط الخاص غير المفهرس تلقائيًا بعد 24 ساعة من إنشائه، أو فورًا عبر «احذف الآن». للاحتفاظ به صدّره (PDF: اختر «حفظ بتنسيق PDF»، وتبقى الروابط قابلة للنقر).',exportFooter:'تصدير تقرير CamMicGo.',deleted:'تم حذف التقرير: لم يعد موجودًا على الخادم، بما في ذلك الصور.',deleteFailed:'تعذّر الحذف، حاول مرة أخرى.',post:'المنشور',notLoaded:'لم يحمّله LinkedIn',
  like:'أعجبني',celebrate:'احتفاء',support:'دعم',love:'أحببته',insightful:'مفيد',funny:'مضحك'},
};
export function reportLang(v:unknown):ReportLang{const l=String(v||'').toLowerCase().slice(0,2);return (REPORT_LANGS as readonly string[]).includes(l)?l as ReportLang:'fr';}

// Wording of the report being built (set at the start of each synchronous builder, from the app language).
let W=REPORT_WORDS.fr;
const setReportLang=(v:unknown)=>{W=REPORT_WORDS[reportLang(v)];};
const LBL=(t:string)=>(W as unknown as Record<string,string>)[t]||'';
/** LinkedIn's six reaction pictures, served by CamMicGo: reactionIconUrl on each person, reactionIcons per type. */
/**
 * When the reaction list holds more people than LinkedIn's own counter, the extra rows are profile links the
 * reader picked up outside the reaction list (the comments behind it): same link as a comment author, no
 * headline. Those rows are removed (never more than the surplus) and the counts are recomputed.
 */
export function reconcileReactions(data:unknown){
 if(!data||typeof data!=='object'||Array.isArray(data))return data;
 const root=data as Obj;
 const rx=root.reactions&&typeof root.reactions==='object'?root.reactions as Obj:null;
 const cx=root.comments&&typeof root.comments==='object'&&!Array.isArray(root.comments)?root.comments as Obj:null;
 if(!rx||!Array.isArray(rx.people)||typeof rx.expectedTotal!=='number')return data;
 const people=rx.people as Obj[];
 let surplus=people.length-rx.expectedTotal;
 if(surplus<=0)return data;
 const commenters=new Set((cx&&Array.isArray(cx.comments)?cx.comments as Obj[]:[]).map(c=>personKey(str(c.authorProfileUrl))).filter(k=>!k.startsWith('name:')));
 const kept=people.filter(p=>{if(surplus>0&&!str(p.headline)&&commenters.has(personKey(str(p.profileUrl)))){surplus--;return false;}return true;});
 if(kept.length===people.length)return data;
 rx.people=kept;rx.droppedOutsideList=people.length-kept.length;
 const by:Record<string,number>={};for(const p of kept){const k=str(p.reaction)||'unknown';by[k]=(by[k]||0)+1;}
 rx.byType=by;if(typeof rx.retrieved==='number')rx.retrieved=kept.length;
 return data;
}
export function decorateReactions(data:unknown,base=process.env.APP_BASE_URL||'https://seo.cammicgo.com'){
 reconcileReactions(data);
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
 // Stable ids the assistant quotes back in linkedin_report_analysis (comment ids; people use their profile link).
 if(comments&&Array.isArray(comments.comments))(comments.comments as Obj[]).forEach((c,i)=>{if(c&&typeof c==='object'&&!str(c.commentId))c.commentId='c'+i;});
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
/** Stable id of a person in a report: the profile link without query or trailing slash (else the name). */
export const personKey=(url:string,name='')=>{const u=String(url||'').split(/[?#]/)[0].replace(/\/+$/,'').toLowerCase();return u||('name:'+String(name||'').trim().toLowerCase());};
export function reportPayload(data:unknown,base=process.env.APP_BASE_URL||'https://seo.cammicgo.com'):Obj|null{
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 const root=data as Obj;
 const reactions=root.reactions&&typeof root.reactions==='object'?root.reactions as Obj:(Array.isArray(root.people)&&root.byType?root:null);
 const comments=root.comments&&typeof root.comments==='object'&&!Array.isArray(root.comments)?root.comments as Obj:(Array.isArray(root.comments)?root:null);
 if(!reactions&&!comments)return null;
 const pic=(u:unknown)=>str(u).startsWith(base+'/')?str(u):'';
 const postPic=(u:unknown)=>/^https:\/\/media\.licdn\.com\/dms\/image\//.test(str(u))?str(u).slice(0,800):'';
 const post=(root.post&&typeof root.post==='object'?root.post:comments&&comments.post) as Obj|undefined;
 return {
  v:2,
  createdAt:new Date().toISOString(),
  lang:reportLang(root.uiLang),
  post:post?{author:str(post.author),authorProfileUrl:str(post.authorProfileUrl),photo:pic(post.authorPhotoUrl),headline:str(post.authorHeadline),time:str(post.time),text:str(post.text).slice(0,3000),url:str(root.postUrl)||str(post.postUrl),reactionCount:post.reactionCount??null,commentCount:post.commentCount??null,images:(Array.isArray(post.images)?post.images:[]).map(postPic).filter(Boolean).slice(0,4)}:null,
  comments:comments?{displayed:comments.displayedCount??null,complete:comments.complete??null,items:(Array.isArray(comments.comments)?comments.comments as Obj[]:[]).slice(0,300).map((c,i)=>({id:str(c.commentId)||'c'+i,parentId:str(c.parentId),author:str(c.author),url:str(c.authorProfileUrl),photo:pic(c.authorPhotoUrl),headline:str(c.authorHeadline),time:str(c.time),text:str(c.text).slice(0,3000),isReply:c.isReply===true,isPostAuthor:c.isPostAuthor===true,parentAuthor:str(c.parentAuthor),reactions:typeof c.reactionCount==='number'?c.reactionCount:null}))}:null,
  reactions:reactions?{expected:reactions.expectedTotal??null,complete:reactions.complete??null,missing:Array.isArray(reactions.missing)?reactions.missing:[],people:(Array.isArray(reactions.people)?reactions.people as Obj[]:[]).slice(0,600).map(p=>({name:str(p.name),url:str(p.profileUrl),photo:pic(p.photoUrl),headline:str(p.headline),reaction:str(p.reaction)}))}:null,
 };
}

const h=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const safeUrl=(u:string)=>/^https:\/\/([a-z0-9-]+\.)*(linkedin\.com|cammicgo\.com)\//i.test(u)?u:'';
/** The post's numeric id (activity / ugcPost / share) from its URL. */
export function postIdOf(url:string){const m=url.match(/urn:li:(activity|ugcPost|share):(\d{8,22})/i)||url.match(/-(activity|ugcpost|share)-(\d{8,22})/i);return m?{kind:m[1],id:m[2],urn:'urn:li:'+m[1].replace(/^ugcpost$/i,'ugcPost')+':'+m[2]}:null;}
export type ReportOptions={logo?:string;brandLogo?:string;nonce?:string;downloadUrl?:string;images?:Record<string,string>;reactionImg?:(t:string)=>string;interactive?:boolean};

// ------------------------------------------------------------------ analysis written by the assistant
export type Count={label:string;count:number};
export type Group={label:string;count:number;ids:string[];insight?:string};
export type ReportAnalysis={
 title:string;postSummary:string;commentsSummary:string;
 sentiment:{positive:number;neutral:number;negative:number}|null;
 opinions:string[];audience:Array<{domain:string;count:number}>;takeaways:string[];agent:string;
 audienceGroups?:Count[];companies?:Count[];themes?:Count[];
 // Structured (v2): groups that point at people (profile links) and comments (comment ids).
 domainGroups?:Group[];companyGroups?:Group[];themeGroups?:Group[];
 commentSentiments?:Array<{id:string;sentiment:'positive'|'neutral'|'negative';offTopic:boolean}>;
 targetGroups?:Group[];targetNote?:string;
 args?:{arguments:string[];questions:string[];criticisms:string[];opinions:string[]};
 metrics?:Array<{label:string;value:string;note:string}>;
 takeawayCards?:Array<{title:string;text:string;icon:string}>;
 recommendations?:Array<{title:string;text:string}>;
 glossary?:Array<{term:string;definition:string}>;
 overall?:string;
};
const ICONS=['audience','engagement','comments','idea','warning','trend','target','network','time','quality'] as const;
export function cleanAnalysis(a:Record<string,unknown>,agent:string):ReportAnalysis{
 const t=(v:unknown,n:number)=>String(v??'').replace(/\s+\n/g,'\n').trim().slice(0,n);
 const list=(v:unknown,n:number,len:number)=>(Array.isArray(v)?v:[]).map(x=>t(x,len)).filter(Boolean).slice(0,n);
 const objs=(v:unknown,n:number)=>(Array.isArray(v)?v:[]).filter(x=>x&&typeof x==='object').slice(0,n) as Record<string,unknown>[];
 const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)&&n>=0?Math.min(Math.floor(n),100000):0;};
 const ids=(v:unknown,kind:'person'|'comment')=>[...new Set((Array.isArray(v)?v:[]).map(x=>kind==='person'?personKey(String(x||'')):t(x,200)).filter(x=>x&&x!=='name:'))].slice(0,600);
 const counts=(v:unknown,n:number):Count[]=>objs(v,n).map(o=>({label:t(o.label??o.name??o.theme??o.group??o.domain,80),count:num(o.count)})).filter(x=>x.label&&x.count>0);
 const groups=(v:unknown,n:number,kind:'person'|'comment',key:string):Group[]=>objs(v,n).map(o=>{const g=ids(o[key],kind);return {label:t(o.label??o.name??o.domain??o.theme,80),count:g.length||num(o.count),ids:g,...(o.insight?{insight:t(o.insight,400)}:{})};}).filter(x=>x.label&&x.count>0);
 const sRaw=a.sentiment&&typeof a.sentiment==='object'?a.sentiment as Record<string,unknown>:null;
 const commentSentiments=objs(a.commentSentiments,300).map(o=>({id:t(o.commentId??o.id,200),sentiment:(['positive','neutral','negative'].includes(String(o.sentiment))?String(o.sentiment):'neutral') as 'positive'|'neutral'|'negative',offTopic:o.offTopic===true})).filter(x=>x.id);
 let sentiment=sRaw?{positive:num(sRaw.positive),neutral:num(sRaw.neutral),negative:num(sRaw.negative)}:null;
 if(commentSentiments.length)sentiment={positive:commentSentiments.filter(x=>x.sentiment==='positive').length,neutral:commentSentiments.filter(x=>x.sentiment==='neutral').length,negative:commentSentiments.filter(x=>x.sentiment==='negative').length};
 const argsRaw=a.arguments&&typeof a.arguments==='object'&&!Array.isArray(a.arguments)?a.arguments as Record<string,unknown>:null;
 const out:ReportAnalysis={
  title:t(a.title,160),postSummary:t(a.postSummary,1500),commentsSummary:t(a.commentsSummary,2000),
  sentiment:sentiment&&(sentiment.positive+sentiment.neutral+sentiment.negative)>0?sentiment:null,
  opinions:list(a.opinions,10,400),takeaways:list(a.takeaways,10,400),
  audience:objs(a.audience,12).map(o=>({domain:t(o.domain??o.label,80),count:num(o.count)})).filter(x=>x.domain&&x.count>0),
  audienceGroups:counts(a.audienceGroups,8),companies:counts(a.companies,10),themes:counts(a.themes,10),
  domainGroups:groups(a.domainGroups,12,'person','profiles'),companyGroups:groups(a.companyGroups,10,'person','profiles'),themeGroups:groups(a.themeGroups,10,'comment','comments'),
  commentSentiments,targetGroups:groups(a.targetGroups,6,'person','profiles'),targetNote:t(a.targetNote,800),
  args:argsRaw?{arguments:list(argsRaw.arguments,8,400),questions:list(argsRaw.questions,8,400),criticisms:list(argsRaw.criticisms,8,400),opinions:list(argsRaw.opinions,8,400)}:undefined,
  metrics:objs(a.metrics,8).map(o=>({label:t(o.label,80),value:t(o.value,40),note:t(o.note,200)})).filter(x=>x.label&&x.value),
  takeawayCards:objs(a.takeawayCards,8).map(o=>({title:t(o.title,120),text:t(o.text,600),icon:(ICONS as readonly string[]).includes(String(o.icon))?String(o.icon):'idea'})).filter(x=>x.title||x.text),
  recommendations:objs(a.recommendations,8).map(o=>({title:t(o.title,120),text:t(o.text,600)})).filter(x=>x.title||x.text),
  glossary:objs(a.glossary,25).map(o=>({term:t(o.term,60),definition:t(o.definition,400)})).filter(x=>x.term&&x.definition),
  overall:t(a.overall,2500),
  agent:t(agent,40)||'AI',
 };
 // A person belongs to one domain only: the first group that lists them keeps them.
 const taken=new Set<string>();
 out.domainGroups=out.domainGroups!.map(g=>{const own=g.ids.filter(id=>!taken.has(id));own.forEach(id=>taken.add(id));return {...g,ids:own,count:g.ids.length?own.length:g.count};}).filter(g=>g.count>0);
 return out;
}

// ------------------------------------------------------------------ charts (SVG, server-made)
const PALETTE=['#0a66c2','#14a38b','#e0a43b','#8e6bd4','#e07a5f','#6f8bb0','#2f9fd8','#c56fa8','#7aa83c','#d1863b','#5b6b86','#a3acb9'];
const pct=(n:number,t:number)=>t?Math.round(n*1000/t)/10:0;
const fmtPct=(n:number)=>String(n).replace('.',W===REPORT_WORDS.en||W===REPORT_WORDS.zh||W===REPORT_WORDS.ja||W===REPORT_WORDS.ko?'.':',')+' %';
type Seg={label:string;count:number;color:string;key?:string};
/** Filters work with plain links to an anchor in the panel (CSS :target), so they need no script: they also
 * work in the HTML export, in viewers that block scripts, and keep working if a script fails. */
const cssStr=(x:string)=>'"'+String(x).replace(/[\\"<>\n]/g,c=>'\\'+c.charCodeAt(0).toString(16)+' ')+'"';
const fid=(f:string,v:string)=>'f-'+f+'-'+String(v).replace(/[^a-z0-9_-]/gi,'_');
const flink=(f:string,v:string,cls:string,inner:string,label='')=>`<a class="${cls}" href="#${fid(f,v)}" data-f="${h(f)}" data-v="${h(v)}"${label?` aria-label="${h(label)}"`:''}>${inner}</a>`;
/** Donut with the total in the centre; segments and legend lines filter the linked panel when keys are given. */
function donut(segs:Seg[],center:string,sub:string,filter:string,legendExtra?:(s:Seg)=>string,showZero=false){
 const total=segs.reduce((a,b)=>a+b.count,0);
 const R=52,C=2*Math.PI*R;let off=0;
 const arcs=segs.filter(s=>s.count>0).map(s=>{const len=s.count/(total||1)*C;const a=`<circle r="${R}" cx="70" cy="70" fill="none" stroke="${s.color}" stroke-width="22" stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 70 70)"${s.key?' class="seg"':''}/>`;off+=len;return s.key?flink(filter,s.key,'sega',a,s.label):a;}).join('');
 const svg=`<svg class="donut" viewBox="0 0 140 140" role="img" aria-label="${h(center+' '+sub)}"><circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--line)" stroke-width="22"/>${arcs}<text x="70" y="68" text-anchor="middle" class="dc">${h(center)}</text><text x="70" y="86" text-anchor="middle" class="ds">${h(sub)}</text></svg>`;
 const rows=segs.filter(s=>showZero||s.count>0).map(s=>{const inner=`<i style="background:${s.color}"></i><span>${h(s.label)}</span>${legendExtra?legendExtra(s):''}<b>${s.count} · ${fmtPct(pct(s.count,total))}</b>`;return s.key&&s.count>0?`<li>${flink(filter,s.key,'lgb',inner)}</li>`:`<li><span class="lgb">${inner}</span></li>`;}).join('');
 return `<div class="dwrap">${svg}<ul class="lg">${rows}</ul></div>`;
}
/** Horizontal bars (count and share), clickable when keys are given. */
function hbars(items:Array<{label:string;count:number;key?:string}>,total:number,filter:string,note=''){
 if(!items.length)return '';
 const max=Math.max(...items.map(x=>x.count));
 return items.map((x,i)=>{const inner=`<div class="hbt"><span>${h(x.label)}</span><b>${x.count}${total?' · '+fmtPct(pct(x.count,total)):''}</b></div><div class="track"><span class="fill" style="width:${Math.round(x.count*100/(max||1))}%;background:${PALETTE[i%PALETTE.length]}"></span></div>${note?`<div class="sub">${h(note.replace('{n}',String(x.count)).replace('{t}',String(total)))}</div>`:''}`;return x.key?flink(filter,x.key,'hb',inner):`<div class="hb">${inner}</div>`;}).join('');
}
/** Vertical bars of the six reactions, LinkedIn picture, name, count and share under each bar; bars filter the panel. */
function reactionChart(counts:Array<{type:string;count:number}>,total:number,rimg:(t:string)=>string){
 if(!counts.length)return '';
 const max=Math.max(...counts.map(c=>c.count)),n=counts.length,W0=Math.max(300,n*64+40),top=22,base=140,H=212,slot=(W0-40)/n,bw=Math.min(46,slot*.6);
 const step=max<=5?1:max<=10?2:max<=20?4:Math.ceil(max/5);
 const ticks:number[]=[];for(let v=0;v<=max;v+=step)ticks.push(v);
 const y=(v:number)=>base-(v/Math.max(max,1))*(base-top);
 return `<svg class="rc" viewBox="0 0 ${W0} ${H}" role="img" aria-label="${h(W.reactionsChart)}">${ticks.map(v=>`<line x1="30" x2="${W0-6}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="gl"/><text x="24" y="${(y(v)+4).toFixed(1)}" text-anchor="end" class="tk">${v}</text>`).join('')}${counts.map((c,i)=>{const cx=34+slot*i+slot/2;return `<a class="bar" href="#${fid('reaction',c.type)}" data-f="reaction" data-v="${h(c.type)}" aria-label="${h((LBL(c.type)||W.unknown)+' '+c.count)}"><rect x="${(cx-slot/2+2).toFixed(1)}" y="${top-14}" width="${(slot-4).toFixed(1)}" height="${H-top+14}" fill="transparent"/><rect x="${(cx-bw/2).toFixed(1)}" y="${y(c.count).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1,base-y(c.count)).toFixed(1)}" rx="5" class="bfill"/><text x="${cx.toFixed(1)}" y="${(y(c.count)-6).toFixed(1)}" text-anchor="middle" class="bv">${c.count}</text>${ORDER.includes(c.type)?`<image href="${h(rimg(c.type))}" x="${(cx-11).toFixed(1)}" y="${base+7}" width="22" height="22"/>`:''}<text x="${cx.toFixed(1)}" y="${base+44}" text-anchor="middle" class="bl">${h(LBL(c.type)||W.unknown)}</text><text x="${cx.toFixed(1)}" y="${base+58}" text-anchor="middle" class="bp">${fmtPct(pct(c.count,total))}</text></a>`;}).join('')}</svg>`;
}
const ICON_SVG:Record<string,string>={
 audience:'<path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"/><circle cx="9" cy="7" r="3.5"/><path d="M22 19v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
 engagement:'<path d="M7 10v11M15 5.9 14 10h5.8a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 18.4 21H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9z"/>',
 comments:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
 idea:'<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V18h6v-1.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/>',
 warning:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
 trend:'<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 network:'<circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M12 8v3M10 13l-3.5 3.5M14 13l3.5 3.5"/>',
 time:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 quality:'<path d="m12 2 3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z"/>',
};
const icon=(k:string)=>`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_SVG[k]||ICON_SVG.idea}</svg>`;

/** Engagement figures computed from the extracted data (never from the assistant). */
export function engagementOf(r:Obj){
 const items=r.comments&&Array.isArray((r.comments as Obj).items)?(r.comments as Obj).items as Obj[]:[];
 const people=r.reactions&&Array.isArray((r.reactions as Obj).people)?(r.reactions as Obj).people as Obj[]:[];
 const direct=items.filter(c=>!c.isReply&&!c.isPostAuthor);
 const answered=new Set(items.filter(c=>c.isReply&&c.isPostAuthor).map(c=>str(c.parentId)).filter(Boolean));
 const answeredByName=new Set(items.filter(c=>c.isReply&&c.isPostAuthor).map(c=>str(c.parentAuthor)).filter(Boolean));
 const replied=direct.filter(c=>answered.has(str(c.id))||(!str(c.id).startsWith('urn')&&answeredByName.has(str(c.author)))).length;
 const participants=new Set([...people.map(p=>personKey(str(p.url),str(p.name))),...items.map(c=>personKey(str(c.url),str(c.author)))]).size;
 const rc=r.reactions as Obj|null, cc=r.comments as Obj|null;
 return {reactions:people.length,expectedReactions:rc&&typeof rc.expected==='number'?rc.expected:null,comments:items.length,interactions:people.length+items.length,participants,
  replyRate:direct.length?Math.round(replied*1000/direct.length)/10:null,repliedDirect:replied,direct:direct.length,
  complete:(rc?rc.complete!==false:true)&&(cc?cc.complete!==false:true)};
}

/**
 * Report page (escaped content, links only to LinkedIn and CamMicGo). Charts are drawn here from structured
 * data; the assistant never sends HTML or scripts. With a nonce, one inline script handles the filters, the
 * PDF print and "delete now". With images (url → data URL) the page is self-contained (HTML export).
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
 const an=r.analysis&&typeof r.analysis==='object'?r.analysis as ReportAnalysis:null;
 const items=comments&&Array.isArray(comments.items)?comments.items as Obj[]:[];
 items.forEach((c,i)=>{if(!str(c.id))c.id='c'+i;});
 const people=reactions&&Array.isArray(reactions.people)?reactions.people as Obj[]:[];
 const eng=engagementOf(r);
 const groups=new Map<string,Obj[]>();
 for(const p of people){const t=str(p.reaction)||'unknown';if(!groups.has(t))groups.set(t,[]);groups.get(t)!.push(p);}
 const types=[...groups.keys()].sort((a,b)=>(ORDER.indexOf(a)+1||99)-(ORDER.indexOf(b)+1||99));
 const status=(c:Obj|null)=>c&&c.complete===true?` <span class="ok">${h(W.complete)}</span>`:c&&c.complete===false?` <span class="ko">${h(W.incomplete)}</span>`:'';
 // People → domain / company (from the assistant's structured groups), comments → sentiment / themes.
 const domainOf=new Map<string,number>(),companyOf=new Map<string,number>();
 (an?.domainGroups||[]).forEach((g,i)=>g.ids.forEach(id=>domainOf.set(id,i)));
 (an?.companyGroups||[]).forEach((g,i)=>g.ids.forEach(id=>{if(!companyOf.has(id))companyOf.set(id,i);}));
 const sentOf=new Map((an?.commentSentiments||[]).map(s=>[s.id,s]));
 const themesOf=new Map<string,number[]>();
 (an?.themeGroups||[]).forEach((g,i)=>g.ids.forEach(id=>themesOf.set(id,[...(themesOf.get(id)||[]),i])));
 const sec=(id:string,title:string,inner:string)=>inner?`<section class="sec" id="${id}"><h2>${title}</h2>${inner}</section>`:'';
 const card=(p:Obj)=>{const k=personKey(str(p.url),str(p.name));const d=domainOf.get(k),c=companyOf.get(k);const t=str(p.reaction);
  return `<article class="pc" data-reaction="${h(t)}" data-domain="${d??''}" data-company="${c??''}">${avatar(str(p.name),str(p.photo),str(p.url))}<div class="grow">${nameLink(str(p.name),str(p.url))}<div class="sub">${h(p.headline)}</div><div class="tags">${c!=null?`<span class="tag">${h(W.company)} : ${h(an!.companyGroups![c].label)}</span>`:''}${d!=null?`<span class="tag" style="--tc:${PALETTE[d%PALETTE.length]}">${h(W.domain)} : ${h(an!.domainGroups![d].label)}</span>`:''}</div></div>${ORDER.includes(t)?`<img class="ri" src="${rimg(t)}" alt="${h(LBL(t))}" title="${h(LBL(t))}">`:''}</article>`;};
 // Filter CSS made from the data: "#f-reaction-like:target ~ .cards .pc:not([data-reaction=like])" hides the others.
 const rules:string[]=[];
 const filterBlock=(_cls:string,item:string,f:string,values:string[],attr:(v:string)=>string)=>{
  for(const v of values){const a=fid(f,v);const on=`body:has(#${a}:target) a[data-f="${f}"][data-v="${v}"]`;rules.push(`#${a}:target~.cards ${item}:not(${attr(v)}){display:none}`,`${on}{background:var(--soft)}`,`${on} .bfill{fill:#004182}`,`${on} .seg{stroke-width:28}`);}
  return values.map(v=>`<span class="anchor" id="${fid(f,v)}"></span>`).join('');
 };
 const panel=(id:string,f:string,values:string[],placeholder:boolean)=>`<div class="panel${placeholder?' wait':''}" id="${id}">${filterBlock('panel','.pc',f,values,v=>`[data-${f}="${v}"]`)}<span class="anchor" id="${fid(f,'all')}"></span><a class="reset" href="#${fid(f,'all')}">${h(W.showAll)}</a>${placeholder?`<p class="sub hint">${h(W.selectFilter)}</p>`:''}<div class="cards">${people.map(card).join('')}</div><div class="pcount"></div></div>`;
 const parts:string[]=[];

 // 1. Post analysed
 if(post){
  const imgs=(Array.isArray(post.images)?(post.images as string[]):[]).filter(u=>/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(String(u)));
  parts.push(sec('post',h(W.secPost),`${an&&an.title?`<p class="lead">${h(an.title)}</p>`:''}<div class="card"><div class="row">${avatar(str(post.author),str(post.photo),str(post.authorProfileUrl))}<div>${nameLink(str(post.author),str(post.authorProfileUrl))}<div class="sub">${h([post.headline,post.time].filter(Boolean).join(' · '))}</div></div></div><p class="txt">${h(post.text)}</p>${imgs.length?`<div class="gal" aria-label="${h(W.illustrations)}">${imgs.map(u=>`<img src="${h(img(u))}" alt="" loading="lazy">`).join('')}</div>`:''}${pid?`<div class="sub">${h(W.postId)} : ${h(pid.urn)}</div>`:''}${safeUrl(str(post.url))?`<a class="btn" href="${h(post.url)}" target="_blank" rel="noopener">${h(W.openPost)}</a>`:''}</div>${an&&an.postSummary?`<div class="card"><h3>${h(W.postSummary)}</h3><p class="txt">${h(an.postSummary)}</p></div>`:''}`));
 }
 // 2. Engagement dashboard (computed) + reaction chart with its people panel
 {
  const kpi=(v:string,l:string,cls='')=>`<div class="kpi${cls}"><b>${h(v)}</b><span>${h(l)}</span></div>`;
  const kp=[kpi(eng.reactions+(eng.expectedReactions!=null&&eng.expectedReactions!==eng.reactions?' / '+eng.expectedReactions:''),W.reactions),kpi(String(eng.comments),W.comments),kpi(String(eng.interactions),W.interactions),kpi(String(eng.participants),W.participants),
   kpi(eng.replyRate==null?'—':fmtPct(eng.replyRate),W.replyRate+(eng.replyRate==null?' ('+W.notCalculable+')':' ('+eng.repliedDirect+'/'+eng.direct+')')),kpi(eng.complete?W.complete:W.partialData,W.extraction,eng.complete?' good':' bad')];
  const metrics=(an?.metrics||[]).map(m=>kpi(m.value,m.label+(m.note?' — '+m.note:''))).join('');
  const chart=people.length?`<div class="split"><div class="card"><h3>${h(W.reactionsChart)}</h3>${reactionChart(types.map(t=>({type:t,count:groups.get(t)!.length})),people.length,rimg)}<p class="sub">${h(W.clickToFilter)}</p></div>${panel('pp-reaction','reaction',types,false)}</div>`:'';
  parts.push(sec('engagement',h(W.dashboard),`<div class="kpis">${kp.join('')}${metrics}</div>${chart}`));
 }
 // 3. Audience: domains (one per person), target audience, companies
 if(an){
  const total=people.length;
  const dg=an.domainGroups||[];
  const domainSegs:Seg[]=dg.length?dg.map((g,i)=>({label:g.label,count:g.count,color:PALETTE[i%PALETTE.length],key:g.ids.length?String(i):undefined})):an.audience.map((x,i)=>({label:x.domain,count:x.count,color:PALETTE[i%PALETTE.length]}));
  const domainHtml=domainSegs.length?`<div class="split"><div class="card"><h3>${h(W.domains)}</h3>${donut(domainSegs,String(domainSegs.reduce((a,b)=>a+b.count,0)||total),W.people,'domain')}${dg.some(g=>g.ids.length)?`<p class="sub">${h(W.clickToFilter)}</p>`:''}</div>${dg.some(g=>g.ids.length)?panel('pp-domain','domain',dg.map((_,i)=>String(i)),true):''}</div>`:'';
  const tg=an.targetGroups&&an.targetGroups.length?an.targetGroups:(an.audienceGroups||[]).map(x=>({...x,ids:[]}) as Group);
  const tTotal=tg.reduce((a,b)=>a+b.count,0)||total;
  const targetHtml=tg.length||an.targetNote?`<div class="card"><h3>${h(W.audienceGroups)}</h3><p class="note">${h(W.targetNote)}</p>${hbars(tg.map(g=>({label:g.label,count:g.count})),tTotal,'')}${tg.filter(g=>g.insight).map(g=>`<p class="txt"><b>${h(g.label)}</b> — ${h(g.insight)}</p>`).join('')}${an.targetNote?`<p class="txt">${h(an.targetNote)}</p>`:''}</div>`:'';
  const cg=an.companyGroups&&an.companyGroups.length?an.companyGroups:(an.companies||[]).map(x=>({...x,ids:[]}) as Group);
  const companyHtml=cg.length?`<div class="split"><div class="card"><h3>${h(W.companies)}</h3>${hbars(cg.map((g,i)=>({label:g.label,count:g.count,key:g.ids.length?String(i):undefined})),total,'company',W.profilesOf)}</div>${cg.some(g=>g.ids.length)?panel('pp-company','company',cg.map((_,i)=>String(i)),true):''}</div>`:'';
  parts.push(sec('audience',h(W.secAudience),domainHtml+targetHtml+companyHtml));
 }
 // 4. Comments: tone (3 categories, red only when negatives exist), themes, arguments, every comment
 if(comments){
  let ana='';
  if(an&&(an.commentsSummary||an.sentiment||(an.themeGroups||[]).length||(an.themes||[]).length||an.opinions.length||an.args)){
   if(an.commentsSummary)ana+=`<p class="txt">${h(an.commentsSummary)}</p>`;
   if(an.sentiment){
    const keyed=(an.commentSentiments||[]).length>0;
    const segs:Seg[]=[{label:W.positive,count:an.sentiment.positive,color:'#16a34a',key:keyed?'positive':undefined},{label:W.neutral,count:an.sentiment.neutral,color:'#94a3b8',key:keyed?'neutral':undefined},{label:W.negative,count:an.sentiment.negative,color:'#dc2626',key:keyed?'negative':undefined}];
    const tot=segs.reduce((a,b)=>a+b.count,0);
    ana+=`<h4>${h(W.commentTone)}</h4>${donut(segs,String(tot),W.messages,'sentiment',undefined,true)}`;
   }
   const tgs=an.themeGroups&&an.themeGroups.length?an.themeGroups:(an.themes||[]).map(x=>({...x,ids:[]}) as Group);
   if(tgs.length)ana+=`<h4>${h(W.themes)}</h4>${hbars([...tgs].map((g,i)=>({label:g.label,count:g.count,key:g.ids.length?String(i):undefined,i})).sort((a,b)=>b.count-a.count).map(x=>({label:x.label,count:x.count,key:x.key})),0,'theme')}<p class="sub">${h(W.themesNote)}</p>`;
   const ar=an.args;
   const argBox=(title:string,list:string[],ic:string)=>list.length?`<div class="box"><h5>${icon(ic)}${h(title)}</h5><ul>${list.map(x=>`<li>${h(x)}</li>`).join('')}</ul></div>`:'';
   const argHtml=(ar?argBox(W.args,ar.arguments,'idea')+argBox(W.questions,ar.questions,'comments')+argBox(W.criticisms,ar.criticisms,'warning')+argBox(W.opinions,ar.opinions.length?ar.opinions:an.opinions,'quality'):argBox(W.opinions,an.opinions,'quality'));
   if(argHtml)ana+=`<h4>${h(W.argSummary)}</h4><div class="boxes">${argHtml}</div>`;
  }
  const cm=items.map(c=>{const s=sentOf.get(str(c.id));const th=themesOf.get(str(c.id))||[];
   return `<div class="cm${c.isReply?' reply':''}" data-sentiment="${s?s.sentiment:''}" data-theme="${th.join(' ')}"><div class="row">${avatar(str(c.author),str(c.photo),str(c.url))}<div class="grow">${nameLink(str(c.author),str(c.url))}${c.isPostAuthor?` <span class="badge">${h(W.author)}</span>`:''}${s?` <span class="snt ${s.sentiment}">${h(W[s.sentiment])}${s.offTopic?' · '+h(W.offTopic):''}</span>`:''}<div class="sub">${h([c.headline,c.time,c.isReply&&c.parentAuthor?W.replyTo+' '+c.parentAuthor:'',typeof c.reactions==='number'?c.reactions+' '+W.reactionsN:''].filter(Boolean).join(' · '))}</div></div></div><p class="txt">${h(c.text)}</p></div>`;}).join('');
  parts.push(sec('comments',`${h(W.comments)} — ${items.length}${comments.displayed!=null?` / ${h(comments.displayed)}`:''}${status(comments)}`,`${ana?`<div class="card">${ana}</div>`:''}${items.length?`<div class="card cpanel" id="cp">${filterBlock('cpanel','.cm','sentiment',(an?.commentSentiments||[]).length?['positive','neutral','negative']:[],v=>`[data-sentiment="${v}"]`)}${filterBlock('cpanel','.cm','theme',(an?.themeGroups||[]).map((g,i)=>g.ids.length?String(i):'').filter(Boolean),v=>`[data-theme~="${v}"]`)}<span class="anchor" id="f-comments-all"></span><a class="reset" href="#f-comments-all">${h(W.showAll)}</a><div class="cards">${cm}</div><div class="pcount"></div></div>`:''}`));
 }
 // 5. Key takeaways, recommendations, glossary, overall synthesis
 if(an){
  const tk=(an.takeawayCards||[]).length?`<div class="tks">${an.takeawayCards!.map(c=>`<div class="tk">${icon(c.icon)}<div><h5>${h(c.title)}</h5><p>${h(c.text)}</p></div></div>`).join('')}</div>`:(an.takeaways.length?`<div class="tks">${an.takeaways.map(x=>`<div class="tk">${icon('idea')}<div><p>${h(x)}</p></div></div>`).join('')}</div>`:'');
  parts.push(sec('takeaways',h(W.takeaways),tk));
  parts.push(sec('recommendations',h(W.recommendations),(an.recommendations||[]).length?`<p class="note">${h(W.recoNote)}</p><div class="tks">${an.recommendations!.map(c=>`<div class="tk">${icon('trend')}<div><h5>${h(c.title)}</h5><p>${h(c.text)}</p></div></div>`).join('')}</div>`:''));
  parts.push(sec('glossary',h(W.glossary),(an.glossary||[]).length?`<div class="card gl">${an.glossary!.map(g=>`<details><summary>${h(g.term)}</summary><p>${h(g.definition)}</p></details>`).join('')}</div>`:''));
  parts.push(sec('overall',h(W.overall),an.overall?`<div class="card"><p class="txt">${h(an.overall)}</p></div>`:''));
  parts.splice(1,0,`<div class="ai">${h(W.aiNote.replace('{agent}',an.agent))}</div>`);
 }
 const interactive=!!opt.nonce||!!opt.interactive;
 const script=`(function(){
// Filters are plain CSS (:target); the script only opens the glossary for printing and runs the buttons.
window.addEventListener('beforeprint',function(){document.querySelectorAll('details').forEach(function(d){d.open=true;});});
${opt.nonce?`var pdf=document.getElementById('pdf');if(pdf)pdf.addEventListener('click',function(){window.print();});
var del=document.getElementById('del');if(del)del.addEventListener('click',function(){var b=this;if(b.dataset.armed!=='1'){b.dataset.armed='1';b.querySelector('span').textContent=${JSON.stringify(W.confirm)};return;}b.disabled=true;fetch(location.pathname,{method:'DELETE'}).then(function(r){document.querySelector('main').innerHTML='<section class="card"><p>'+(r.ok?${JSON.stringify(W.deleted)}:${JSON.stringify(W.deleteFailed)})+'</p></section>';var t=document.querySelector('.tools');if(t)t.remove();});});`:''}})();`;
 const pdfIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M12 12v6M9 15l3 3 3-3"/></svg>';
 const htmlIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/></svg>';
 const delIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6"/></svg>';
 const tools=opt.nonce||opt.downloadUrl?`<div class="tools">${opt.nonce?`<button type="button" id="pdf">${pdfIcon}<span>${h(W.pdf)}</span></button>`:''}${opt.downloadUrl?`<a href="${h(opt.downloadUrl)}" download>${htmlIcon}<span>${h(W.html)}</span></a>`:''}${opt.nonce?`<button type="button" id="del" class="danger">${delIcon}<span>${h(W.del)}</span></button>`:''}</div>`:'';
 return `<!doctype html><html lang="${lang}"${lang==='ar'?' dir="rtl"':''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${h(W.title)} — CamMicGo</title><style>
:root{--bg:#f3f6fb;--card:#fff;--ink:#14213d;--muted:#5b6b86;--line:#e3e9f3;--blue:#0a66c2;--soft:#e8f0fb}
@media (prefers-color-scheme:dark){:root{--bg:#0f1522;--card:#182033;--ink:#e8eefb;--muted:#9aa8c3;--line:#26324a;--blue:#70b5f9;--soft:#1d2b45}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:1080px;margin:0 auto;padding:16px}h2{font-size:19px;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid var(--blue)}h3{font-size:15px;margin:0 0 8px;display:flex;align-items:center;gap:8px}h4{margin:14px 0 6px;font-size:14px}h5{margin:0 0 4px;font-size:14px;display:flex;align-items:center;gap:6px}
section.sec{margin:26px 0}.lead{font-size:18px;font-weight:700;margin:4px 0 8px}.note{color:var(--muted);font-size:13px;margin:0 0 8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin:10px 0;min-width:0}
.row{display:flex;align-items:center;gap:12px}.grow{flex:1;min-width:0}
.av{width:44px;height:44px;border-radius:50%;object-fit:cover;flex:none;display:inline-flex;align-items:center;justify-content:center;background:#c9d6ea;color:#14213d;font-weight:700}
.nm{font-weight:700;color:var(--ink);text-decoration:none}a.nm:hover{color:var(--blue);text-decoration:underline}.sub{color:var(--muted);font-size:13px;overflow-wrap:anywhere}
.txt{white-space:pre-wrap;margin:8px 0 0;overflow-wrap:anywhere}.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin:10px 0}.gal img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;border:1px solid var(--line)}
.cm{padding:10px 0;border-top:1px solid var(--line)}.cm:first-of-type{border-top:0}.cm.reply{margin-inline-start:40px}
.ri{width:24px;height:24px;flex:none}.badge{background:var(--soft);color:var(--blue);border-radius:6px;padding:1px 6px;font-size:12px;font-weight:700}
.snt{border-radius:6px;padding:1px 6px;font-size:12px;font-weight:700;color:#fff}.snt.positive{background:#16a34a}.snt.neutral{background:#7c8aa0}.snt.negative{background:#dc2626}
.hdr{background:#0a66c2;color:#fff;padding:20px 16px 18px}.hdr .in{max-width:1080px;margin:0 auto}.hdr .top{display:flex;align-items:center;gap:16px}.hdr .grow{min-width:0;flex:1}
.hdr h1{margin:0;font-size:22px;line-height:1.2;color:#fff}.hdr .pid{font-size:12px;opacity:.9;overflow-wrap:anywhere}
.logo,.brand{width:56px;height:56px;border-radius:12px;background:#fff;flex:none;object-fit:contain}
.tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.25)}.tools a,.tools button{display:inline-flex;align-items:center;gap:6px;font:600 13px system-ui,sans-serif;background:#fff;color:#0a66c2;border:0;border-radius:999px;padding:8px 14px;text-decoration:none;cursor:pointer}.tools svg{width:16px;height:16px}.tools .danger{color:#b42318}
.ok{color:#15803d;font-size:13px}.ko{color:#b91c1c;font-size:13px}.btn{display:inline-block;margin-top:10px;background:var(--blue);color:#fff;border-radius:10px;padding:8px 12px;text-decoration:none;font-weight:600}
.ai{border:1px dashed var(--blue);background:var(--card);border-radius:10px;padding:8px 12px;font-size:13px;color:var(--muted);margin-top:12px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}.kpi b{display:block;font-size:22px;font-variant-numeric:tabular-nums}.kpi span{color:var(--muted);font-size:13px}.kpi.good b{color:#15803d}.kpi.bad b{color:#b45309}
.split{display:grid;gap:12px;align-items:start}@media (min-width:900px){.split{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
.panel,.cpanel{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:4px 8px;counter-reset:n;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px;margin:10px 0;min-width:0}.split .panel{max-height:620px;overflow:auto}
.anchor{position:absolute;top:0;left:0;width:1px;height:1px;scroll-margin-top:12px}.pcount{grid-row:1;grid-column:1;font-size:13px;color:var(--muted)}.hint,.cards{grid-column:1/-1;min-width:0}
.reset{grid-row:1;grid-column:2;font:600 12px system-ui,sans-serif;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:999px;padding:4px 10px;text-decoration:none;visibility:hidden}.anchor:not([id$="-all"]):target~.reset{visibility:visible}
.pc,.cm{counter-increment:n}.panel .pcount::before{content:${cssStr(W.profilesShown.split('{n}')[0])} counter(n) ${cssStr(W.profilesShown.split('{n}')[1]??'')}}.cpanel .pcount::before{content:counter(n) ${cssStr(' '+W.messages)}}
.wait .cards,.wait .pcount{display:none}.wait .anchor:target~.cards,.wait .anchor:target~.pcount{display:block}.wait .anchor:target~.hint{display:none}
${rules.join('\n')}
.pc{display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid var(--line)}.cards .pc:first-child{border-top:0}
.tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}.tag{font-size:11px;border-radius:6px;padding:1px 6px;background:var(--soft);color:var(--ink);border-inline-start:3px solid var(--tc,var(--blue))}
.dwrap{display:flex;align-items:center;gap:18px;flex-wrap:wrap}.donut{width:160px;height:160px;flex:none}.dc{font-size:24px;font-weight:800;fill:var(--ink)}.ds{font-size:10px;fill:var(--muted)}.seg{cursor:pointer}.sega:hover .seg,.sega:focus .seg{stroke-width:28}
.lg{list-style:none;margin:0;padding:0;flex:1;min-width:210px}.lgb{display:flex;align-items:center;gap:8px;width:100%;padding:5px 6px;border:0;background:none;color:var(--ink);font:inherit;font-size:14px;text-align:start;border-radius:8px}a.lgb{cursor:pointer;text-decoration:none}a.lgb:hover,a.lgb:focus-visible{background:var(--soft)}.lgb i{width:11px;height:11px;border-radius:50%;flex:none}.lgb span{flex:1;min-width:0}.lgb b{font-variant-numeric:tabular-nums;white-space:nowrap}
.hb{display:block;width:100%;margin:8px 0;padding:6px;border:0;background:none;color:var(--ink);font:inherit;text-align:start;border-radius:8px}a.hb{cursor:pointer;text-decoration:none}a.hb:hover,a.hb:focus-visible{background:var(--soft)}.hbt{display:flex;justify-content:space-between;gap:10px;font-size:14px;margin-bottom:4px}.hbt b{font-variant-numeric:tabular-nums;white-space:nowrap}.track{display:block;height:10px;border-radius:999px;background:var(--line);overflow:hidden}.fill{display:block;height:100%}
.rc{width:100%;max-width:560px;height:auto;display:block;margin:4px auto 8px}.rc .gl{stroke:var(--line);stroke-width:1}.rc .tk{font-size:9px;fill:var(--muted)}.rc .bv{font-size:11px;font-weight:700;fill:var(--ink)}.rc .bl{font-size:10px;fill:var(--ink)}.rc .bp{font-size:9px;fill:var(--muted)}.rc .bfill{fill:#0a66c2}.rc .bar{cursor:pointer;outline:none}.rc .bar:hover .bfill,.rc .bar.on .bfill,.rc .bar:focus .bfill{fill:#004182}
.boxes,.tks{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.box{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:10px 12px}.box ul{margin:4px 0 0;padding-inline-start:18px}.box li{margin:4px 0}
.tk{display:flex;gap:10px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}.tk p{margin:0;font-size:14px}.ic{width:22px;height:22px;flex:none;color:var(--blue)}h5 .ic{width:16px;height:16px}
.gl details{border-top:1px solid var(--line);padding:8px 0}.gl details:first-child{border-top:0}.gl summary{font-weight:700;cursor:pointer}.gl p{margin:6px 0 0;color:var(--muted)}
footer{color:var(--muted);font-size:12px;margin:24px 0}
@media print{.tools,.reset,.hint,.phd{display:none!important}h2,h3,h4{break-after:avoid}body{background:#fff}main{max-width:none}.card,.kpi,.tk,.box,.pc,.cm{break-inside:avoid}.cards .pc{display:flex!important}.cards .cm{display:block!important}.wait .cards{display:block!important}.pcount{display:none!important}#pp-domain,#pp-company{display:none}.split .panel{max-height:none;overflow:visible}.gl details>*{display:block}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><header class="hdr"><div class="in"><div class="top">${opt.logo?`<img class="logo" src="${h(opt.logo)}" alt="LinkedIn">`:''}<div class="grow"><h1>${h(W.title)}</h1>${pid?`<div class="pid">${h(W.postId)} : ${h(pid.urn)}</div>`:''}<div class="pid">${h(W.readBy)} · ${h(new Date(str(r.createdAt)||Date.now()).toLocaleString(lang==='zh'?'zh-CN':lang,{timeZone:'Europe/Paris',dateStyle:'medium',timeStyle:'short'}))}</div></div>${opt.brandLogo?`<img class="brand" src="${h(opt.brandLogo)}" alt="CamMicGo SEO MCP">`:''}</div>${tools}</div></header><main>${parts.join('')}<footer>${h(opt.images?W.exportFooter:W.footer)}</footer></main>${interactive?(opt.nonce?`<script nonce="${h(opt.nonce)}">${script}</script>`:`<script>${script}</script>`):''}</body></html>`;
}
