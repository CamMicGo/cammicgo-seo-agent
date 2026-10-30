# CAMMICGO SEO MCP — MCP Plugin

## Fiche de présentation (français)

**Nom affiché :** CAMMICGO SEO MCP

**Catégorie :** Plugin / connecteur d'intelligence artificielle utilisant le Model Context Protocol (MCP)

**Description courte :** Connectez vos assistants IA à vos données Google Search Console et Google Analytics 4 via le serveur MCP CAMMICGO, pour analyser le référencement, les mots-clés, le trafic et les performances de vos sites.

**Description détaillée :** CAMMICGO SEO MCP est un plugin et serveur MCP open source conçu pour permettre aux assistants IA compatibles, notamment ChatGPT, Claude et Gemini, d'exploiter les données des services Google autorisés par l'utilisateur. Il donne accès à des analyses de recherches organiques (requêtes, clics, impressions, CTR et position moyenne), à des opportunités de mots-clés à partir de Google Search Console, ainsi qu'à des rapports Google Analytics 4 sur les pages, les sessions et la répartition géographique du trafic. Les utilisateurs peuvent également installer une version locale avec leur propre projet Google Cloud et leurs identifiants OAuth, sous réserve de la compatibilité du client MCP. La préparation de campagnes Google Ads est uniquement une **simulation sans dépense**. Keyword Planner, la création de campagnes, YouTube et Google Calendar restent des intégrations à terminer ou à valider. Chaque accès aux données privées requiert l'autorisation du propriétaire du compte.

**Outils dans le code du MCP distant privé :** `service_info`, `list_selected_properties`, `search_performance`, `seo_keyword_opportunities`, `ga4_top_pages`, `ga4_countries`, `prepare_ads_campaign` (préparation sans dépense). La disponibilité dépend du mode d'authentification, des droits Google et des limites du serveur. **L'activation publique complète de tous ces outils n'est pas encore réalisée.**

**Serveur :** https://seo.cammicgo.com/api/mcp

**Site :** https://seo.cammicgo.com

**Code source :** https://github.com/CamMicGo/cammicgo-seo-mcp

**Engagements :** connexion Google par OAuth, droits minimaux en lecture seule pour les analyses, contrôle par utilisateur et par propriété, aucune création ni dépense publicitaire sans connexion Google Ads spécifique et approbation explicite.

## Plugin listing (English)

**Display name:** CAMMICGO SEO MCP

**Short description:** Connect AI assistants to Google Search Console and Google Analytics 4 through the CAMMICGO MCP server to explore SEO keywords, organic search performance, website traffic and audience insights.

**Full description:** CAMMICGO SEO MCP is an open-source Model Context Protocol (MCP) connector designed for compatible AI assistants such as ChatGPT, Claude and Gemini. It enables permission-scoped analysis of Google Search Console queries, clicks, impressions, click-through rate, average position and organic keyword opportunities, alongside Google Analytics 4 pages, sessions and traffic by country. A bring-your-own-Google-Cloud setup supports local development with the user's own OAuth credentials. Google Ads campaign preparation is preview-only and cannot spend money; Keyword Planner, live Ads operations, YouTube and Calendar integrations are not yet generally available. Private remote MCP access requires completed authorization and quota enforcement and must not be represented as already publicly available.

**Availability:** Technical preview. Not yet a published, approved ChatGPT plugin or app-store listing. A working local MCP binary and its supported tools must be tested independently of the hosted web dashboard.

**Privacy note:** No Google refresh token should be shared with an AI model, pasted into chat, or embedded into agent configuration. Permissions should be granted through OAuth and scoped to the user's authorized resources.
