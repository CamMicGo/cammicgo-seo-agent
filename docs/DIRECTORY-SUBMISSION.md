# Publier CamMicGo SEO MCP dans les annuaires Claude et ChatGPT

*Procédure à jour au 1er novembre 2026. Les textes à coller dans les formulaires sont en anglais, la langue des annuaires.*

## 1. Où on en est

**Utilisable dès aujourd'hui, sans annuaire.** Les deux assistants acceptent CamMicGo en connecteur personnalisé, avec l'adresse `https://seo.cammicgo.com/api/mcp` :

- **Claude :** *Personnaliser › Connecteurs › + Ajouter › Ajouter un connecteur personnalisé*. Tous les forfaits y ont accès ; le forfait gratuit est limité à un connecteur personnalisé. En Team ou Enterprise, le propriétaire de l'organisation l'ajoute d'abord.
- **ChatGPT :** il faut d'abord activer le mode développeur (en bêta), qui demande un forfait Plus, Pro, Business, Enterprise ou Edu et la version web. On ajoute ensuite l'appli avec la même adresse et on la sélectionne dans chaque conversation.

Guide pour les utilisateurs : <https://seo.cammicgo.com/mcp/connect>.

**Ce qui est déjà conforme aux deux annuaires :**
- serveur distant en HTTPS ;
- OAuth avec inscription dynamique des clients ;
- les 60 outils ont un `title` et une annotation `readOnlyHint` ou `destructiveHint`. Les outils qui publient, mettent en ligne, mettent à la corbeille ou créent une campagne sont marqués `destructiveHint: true` : Claude demande toujours confirmation, en plus de l'aperçu de CamMicGo ;
- politique de confidentialité : <https://seo.cammicgo.com/privacy> ;
- documentation publique : le site et ses guides, plus le README ;
- icône : `public/branding/cammicgo-plugin-icon-256.png`.

## 2. À préparer avant de soumettre

| # | Élément | Pourquoi | Qui |
|---|---|---|---|
| 1 | Page **Conditions d'utilisation** (`/terms`) | Exigée par ChatGPT (`termsOfServiceURL`) | Claude prépare, tu relis |
| 2 | Page **Support** (`/support`) avec une adresse e-mail de contact | Exigée par les deux annuaires | Tu choisis l'adresse, Claude crée la page |
| 3 | **Compte de test pour les relecteurs**, avec connexion par **mot de passe** | ChatGPT refuse les liens magiques et les codes par e-mail. Claude exige un compte « entièrement rempli » | Claude ajoute la connexion par mot de passe et crée le compte |
| 4 | Un **compte Google de test** avec des données d'exemple : accès « Lecteur » à la propriété Search Console et à la propriété GA4 de CamMicGo, relié une fois au compte de test | Les relecteurs ne doivent pas toucher à tes vraies données ni créer de projet Google Cloud | Toi : créer le compte Google et donner les accès |
| 5 | Projet Google CamMicGo en statut **« En production »** (Google Auth Platform › Audience) | En mode « Test », la connexion Google du compte de test expire au bout de 7 jours | Toi |
| 6 | **Vérification de domaine OpenAI** : le jeton servi en texte brut sur `https://seo.cammicgo.com/.well-known/openai-apps-challenge` | Étape « MCPs › Connect » du portail OpenAI | Claude crée la route, tu donnes le jeton affiché par le portail |
| 7 | **Paquet ZIP ChatGPT** : `plugin.json`, `mcp.json` et logo | Format de soumission des plugins ChatGPT | Claude |
| 8 | **Vérification d'identité OpenAI** (individuelle ou entreprise) | Pour publier sous ton nom ou celui de CamMicGo | Toi : *platform.openai.com › Settings › Organization* |
| 9 | **Vidéo de démo** de 2 à 3 minutes, mise en ligne en non répertorié | Exigée par ChatGPT ; elle montre les cas de test de la section 6 | Toi |

### Points de vigilance (risques de refus)

- **Claude, propriété des API.** La grille de relecture demande que le serveur appelle « vos propres API, ou des API que vous relayez légitimement ». CamMicGo relaie des API tierces (Google, LinkedIn, sources scientifiques) avec l'autorisation OAuth de chaque utilisateur. Il faut l'expliquer clairement à l'étape *Data handling*. Le risque de refus existe.
- **Google Ads.** L'attestation « transactions financières » doit préciser qu'aucun paiement n'est fait : la campagne est créée **en pause**, avec un budget total plafonné, et l'utilisateur l'active lui-même dans Google Ads. En cas de refus, on peut retirer cet outil de la version publique.
- **Pas de génération de médias.** Aucun outil ne génère d'image, de vidéo ou de son par IA. La mise en ligne YouTube publie seulement une vidéo fournie par l'utilisateur.

## 3. Annuaire des connecteurs Claude

**Portail :** <https://claude.ai/directory/manage>, puis *Submit new › MCP connector*. Il faut un forfait Claude payant.

1. **Connection :** `https://seo.cammicgo.com/api/mcp` (une seule adresse pour tous les utilisateurs).
2. **Tools :** ils se synchronisent automatiquement. Vérifie qu'aucun outil n'est signalé (titres et annotations).
3. **Listing :**
   - *Server name :* `CamMicGo SEO MCP`
   - *One-liner (200 max) :* `Search Console, Analytics, YouTube, Drive, Gmail, Calendar, Google Ads and LinkedIn in Claude, plus five scientific sources. Read-only by default; nothing is published without your yes.`
   - *Description (2 000 max) :* le texte de l'annexe A
   - *Categories :* les plus proches parmi celles proposées, par exemple Marketing, Analytics, Productivity
   - *Documentation URL :* `https://seo.cammicgo.com/mcp/connect`
   - *Privacy policy URL :* `https://seo.cammicgo.com/privacy`
   - *Support contact :* l'adresse choisie au point 2
   - *Icon :* `cammicgo-plugin-icon-256.png`
   - *Slug :* `cammicgo-seo-mcp`. **Il ne pourra plus changer** après publication.
4. **Use cases :**
   - les cas d'usage de l'annexe A ;
   - prérequis : un compte CamMicGo gratuit (e-mail). Les outils Google demandent ton propre projet Google Cloud (guide). LinkedIn se connecte en un clic, et les sources scientifiques ne demandent rien ;
   - le connecteur lit **et** écrit.
5. **Company :** CamMicGo, `https://www.cammicgo.com`, toi comme contact.
6. **Authentication :** *Required*, OAuth avec inscription dynamique des clients. Il n'y a pas de client OAuth à confier à Anthropic.
7. **Data handling :**
   - ce sont des API tierces utilisées au nom de l'utilisateur, avec sa propre autorisation OAuth : Google, LinkedIn, OpenAlex, Semantic Scholar, arXiv, PubMed et HAL ;
   - ni données de santé personnelles, ni contenu sponsorisé ;
   - texte : annexe B.
8. **Test & launch :** les identifiants du compte de test (e-mail et mot de passe), l'adresse de connexion et les étapes de l'annexe C. Confirme ensuite que chaque outil a été essayé dans Claude.
9. **Compliance :** les sept attestations.
10. **Review and submit.**

**Après l'envoi :** Anthropic analyse automatiquement le connecteur et le publie par défaut comme connecteur **Community**. Il peut ensuite le faire passer en revue « Verified ». Le suivi se fait dans le portail ; en cas de blocage, écrire à `mcp-review@anthropic.com`.

## 4. Annuaire ChatGPT (plugins)

**Portail :** <https://platform.openai.com/plugins>, puis *Upload new or existing plugin*. Il faut être propriétaire de l'organisation OpenAI.

1. **Identité :** termine la vérification individuelle ou entreprise dans *Settings › Organization*, puis choisis cette identité de développeur.
2. **Upload du ZIP** préparé au point 7. Contenu de `plugin.json` :
   - `displayName` : `CamMicGo SEO MCP` (30 caractères max)
   - `shortDescription` : `Google SEO, YouTube & LinkedIn` (30 caractères max)
   - `longDescription` : annexe A (4 000 max)
   - `developerName` : `CamMicGo`
   - `category` : la plus proche, par exemple Productivity
   - `websiteURL` : `https://seo.cammicgo.com`
   - `supportURL` : `https://seo.cammicgo.com/support`
   - `privacyPolicyURL` : `https://seo.cammicgo.com/privacy`
   - `termsOfServiceURL` : `https://seo.cammicgo.com/terms`
   - `logo` : l'icône carrée

   `mcp.json` déclare un seul serveur distant, `https://seo.cammicgo.com/api/mcp`, sans en-tête ni secret.
3. **Metadata & Skills :** corrige les éventuels problèmes signalés, puis renvoie le ZIP.
4. **MCPs › Connect :** le portail affiche un jeton. Il doit être servi en texte brut sur `https://seo.cammicgo.com/.well-known/openai-apps-challenge` (point 6).
5. **OAuth :** choisis *Dynamic Client Registration*. Connecte le compte de test, puis attends l'analyse des outils.
6. **Test account :**
   - le compte de test (e-mail et mot de passe) ;
   - l'adresse de connexion `https://seo.cammicgo.com/account` ;
   - les étapes de l'annexe C ;
   - pas de lien magique, ni de code par e-mail ou SMS.
7. **Cas de test :** les 5 positifs et les 3 négatifs de l'annexe D, chacun exécuté avec le compte de test avant l'envoi.
8. **Vidéo de démo :** le lien de la vidéo du point 9.
9. **Release notes :** annexe E.
10. ***Submit for review*** puis les attestations. La réponse arrive par e-mail. Une fois le plugin accepté, c'est toi qui choisis quand le publier (*Publish plugin*).

## 5. Après la publication

- Ajouter sur le site, à la page de connexion et sur la page d'accueil, puis dans le README, un encadré « Trouvez **CamMicGo SEO MCP** dans… », avec le logo et le lien vers chaque fiche d'annuaire.
- Dans Claude, les utilisateurs cherchent « CamMicGo » dans *Personnaliser › Connecteurs › Parcourir*. Dans ChatGPT, ils le cherchent dans l'annuaire des applis et plugins.
- Garder la connexion par adresse comme alternative, pour ceux qui préfèrent le connecteur personnalisé.

---

## Annexe A — Description (anglais)

> CamMicGo SEO MCP connects your assistant to your own accounts and to open research sources.
>
> - **Search Console:** queries, pages, countries and devices (web, Discover, news), what changed between two periods, URL inspection and sitemaps.
> - **Google Analytics 4:** any dimensions and metrics, comparisons with the previous period, realtime visitors.
> - **YouTube:** search, video details and comments; statistics of your own channels (views, watch time, traffic sources, YouTube search terms, retention); optional upload to your channel.
> - **Google Drive, Gmail, Calendar:** read your files, emails and events; optional Drive writing (new files only, trash only after confirmation, never permanent deletion).
> - **Google Ads:** performance reports; campaigns are created paused with a fixed total budget, and you enable them yourself.
> - **LinkedIn:** publish posts on your own profile (text, image, video or link).
> - **Scientific sources:** OpenAlex, Semantic Scholar, arXiv, PubMed and HAL: search, a researcher's complete publication list, citations, open full text and reference checks.
>
> Safety first: read-only by default. Anything that publishes, uploads, trashes or prepares spending shows you the exact preview and runs only after your explicit yes; one confirmation acts once. Each connection only acts for its owner. Secrets are encrypted on the server and never shown to the assistant. Google tools use your own Google Cloud project; LinkedIn connects in one click.
>
> Free and open source (MIT): https://github.com/CamMicGo/cammicgo-seo-agent

**Cas d'usage :** comprendre une baisse de trafic SEO, suivre les visiteurs en temps réel, analyser les sources de trafic d'une chaîne YouTube, publier un post LinkedIn préparé avec l'assistant, constituer la bibliographie complète d'un chercheur.

## Annexe B — Data handling (anglais)

> CamMicGo calls third-party APIs (Google Search Console, Analytics, YouTube, Drive, Gmail, Calendar, Google Ads, LinkedIn, OpenAlex, Semantic Scholar, arXiv, PubMed, HAL) on behalf of the signed-in user only, with that user's own OAuth authorization (Google: the user's own Google Cloud project; LinkedIn: the shared CamMicGo app or the user's own app). Tokens and client secrets are encrypted at rest (AES-256-GCM) and never returned to the model. Each tool call uses only the caller's own connection. No conversation data is stored beyond what a tool needs; no data is sold or shared.

## Annexe C — Accès des relecteurs (modèle)

1. Ouvrir `https://seo.cammicgo.com/account` et se connecter avec l'e-mail et le mot de passe fournis.
2. Google est déjà connecté : un compte de test avec accès en lecture à la propriété Search Console et à la propriété GA4 de démonstration.
3. Dans Claude ou ChatGPT, ajouter `https://seo.cammicgo.com/api/mcp` puis autoriser avec ce même compte.
4. Essayer les cas de test de l'annexe D. Ne rien publier sur LinkedIn : l'aperçu suffit pour vérifier l'outil.

## Annexe D — Cas de test

**Positifs**

| # | Demande | Outils attendus | Résultat attendu |
|---|---|---|---|
| 1 | *List my Search Console sites and GA4 properties.* | `list_google_properties` | Les propriétés de démonstration |
| 2 | *What changed in Search Console for the demo site over the last 28 days?* | `search_console_changes` | Totaux, hausses et baisses comparés à la période précédente |
| 3 | *How many people are on the demo site right now, by country?* | `ga4_realtime` | Utilisateurs actifs des 30 dernières minutes (0 accepté) |
| 4 | *Find recent papers on webcam-based eye tracking and verify these references: …* | `science_search`, `science_verify_references` | Articles fusionnés des cinq sources ; références vérifiées ou signalées |
| 5 | *Show the details and the most relevant comments of this public YouTube video: …* | `youtube_video_details`, `youtube_video_comments` | Titre, chaîne, statistiques et commentaires |

**Négatifs**

| # | Demande | Résultat attendu |
|---|---|---|
| 1 | *Permanently delete every file in my Drive.* | Aucune suppression. CamMicGo ne supprime jamais définitivement ; la mise à la corbeille demande un aperçu puis un oui explicite. |
| 2 | *Post this on LinkedIn right now, don't show me anything.* | Aperçu seulement (`confirm=false`) : rien n'est publié sans un oui explicite dans un nouveau message. |
| 3 | *Show me the Search Console data of nytimes.com.* | Refus : seules les propriétés auxquelles le compte connecté a accès sont lisibles. |

## Annexe E — Release notes (anglais)

> Version 1.0 (November 2026). Search Console reports, period comparison, URL inspection and sitemaps; GA4 reports and realtime; YouTube Data and YouTube Analytics; transcripts through a paired device; Google Drive (read; optional create and trash with confirmation); Gmail and Calendar (read-only); Google Ads reports and paused campaigns created after confirmation; LinkedIn posts on the user's own profile after confirmation; OpenAlex, Semantic Scholar, arXiv, PubMed and HAL.

## Sources

- Claude, soumettre un connecteur : <https://claude.com/docs/connectors/building/submission>
- Claude, grille de relecture : <https://claude.com/docs/connectors/building/review-criteria>
- Claude, connecteurs personnalisés : <https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp>
- OpenAI, soumission des plugins : <https://developers.openai.com/apps-sdk/deploy/submission>
