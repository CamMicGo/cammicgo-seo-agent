<div align="center">

<img src="https://avatars.githubusercontent.com/u/322584442?v=4" width="128" alt="CamMicGo webcam logo" />

# CamMicGo SEO Agent
### Free · Open Source · SEO insights for AI assistants

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Technical preview](https://img.shields.io/badge/status-technical%20preview-yellow.svg)](https://seo.cammicgo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![MCP](https://img.shields.io/badge/Model%20Context%20Protocol-remote%20preview-6666cc.svg)](https://modelcontextprotocol.io/)

**[Google Cloud setup](https://seo.cammicgo.com/setup/google-cloud)** · **[Website](https://seo.cammicgo.com)** · **[Connect Google](https://seo.cammicgo.com/connect)** · **[Source](https://github.com/CamMicGo/cammicgo-seo-agent)** · **[CamMicGo](https://www.cammicgo.com)**

<img src="https://seo.cammicgo.com/google-search-console.svg" width="62" alt="Google Search Console" /> &nbsp;&nbsp;
<img src="https://seo.cammicgo.com/api/assets/google-analytics" width="62" alt="Google Analytics" />

</div>

---

## What is this?

CamMicGo SEO Agent is a **free, open-source alternative to GSC Wizard**, focused on Google Search Console, Google Analytics 4 and SEO insights for AI assistants. It is an independently developed project with a secure browser-based Google OAuth flow and a hosted Next.js endpoint. Our goal is to offer transparent, extensible SEO analytics with both remote MCP and local agent support.

> **Current implementation:** A public MCP `service_info` tool; browser-based read-only Google OAuth (shared project or bring your own GCP OAuth client); listing your authorized Search Console and GA4 properties; a Search Console query report; a GA4 traffic and page report. **Private Google MCP tools are implemented behind a disabled feature flag for limited testing, not available to public clients by default.** A local read-only stdio MCP CLI is now included in source; a downloadable installer and the public remote MCP OAuth flow are still not shipped. Do not mistake the web dashboard for an authenticated remote MCP integration.

### Current capabilities

| Capability | Web dashboard | Public MCP | Planned |
|---|---|---|---|
| Google OAuth, read-only | ✅ | ❌ | Secure per-agent MCP authorization |
| List Search Console sites | ✅ | ❌ | ✅ |
| Search queries, clicks, impressions, CTR, average position | ✅ | ❌ | Compare dates, country, device, page |
| List GA4 properties | ✅ | ❌ | ✅ |
| GA4 top pages, interactive daily chart and country comparison | ✅ | ❌ | Segments, events, attribution, full geographic choropleth |
| GA4 Data API quota returned by Google | API response | ❌ | Visible gauges and history |
| SEO opportunities and content briefs | ❌ | ❌ | ✅ |
| Local stdio MCP (source CLI) | ✅ | Not applicable | Packaged installers |\n| YouTube and Calendar | ❌ | ❌ | ✅ Local MCP read-only tools; hosted OAuth still pending |\n| Google Ads account reports and Keyword Planner | ❌ | ❌ | Google Ads OAuth + appropriate Google Ads API level required |

The GA4 dashboard now includes a date-selectable 28-day traffic chart and an interactive country overview with a schematic map and sortable-style ranked country list. The map uses approximate country centroids rather than visitor locations. Charts and country data are available only after browser OAuth; these private data tools are not yet callable from public MCP.\n\n### Google Ads campaign planner (preview)

The connected web dashboard now links to **[/dashboard/ads](https://seo.cammicgo.com/dashboard/ads)**. This prepares an example CamMicGo Search campaign with a **maximum €150 entered budget, maximum seven days, selectable countries and keywords**. **No Google Ads account or campaign is accessed; nothing is created or charged.** The authenticated private MCP beta includes a non-spending `prepare_ads_campaign` tool, but the beta is disabled by default. Google Ads OAuth, project access approval, account/manager selection, `validate_only` API validation, server-side controls, revocation, customer currency/timezone validation, durable quotas and human confirmation must be delivered and tested before enabling campaign mutations.

**Budget caution:** Google Ads average daily budgets may overdeliver on individual days and don't by themselves guarantee an exact seven-day total. A real spend ceiling requires careful campaign scheduling, monitoring and separate user authorization. A €150 preview is not a guaranteed charge cap.

### Current UI

Connect: https://seo.cammicgo.com/connect  
Dashboard: https://seo.cammicgo.com/dashboard  
Service status: https://seo.cammicgo.com/api/health  
Remote MCP preview: https://seo.cammicgo.com/api/mcp  \nMCP readiness status: https://seo.cammicgo.com/api/mcp/status

## Setup for your AI assistant

**[ChatGPT, Claude, Gemini CLI and local MCP installation plans](./docs/CONNECTING-AGENTS.md)** — explains separate AI→CamMicGo and CamMicGo→Google OAuth flows, exact compatibility of the current preview, the remote URL and the proposed local distribution.

**[Quotas, fair use, 10,000-agent capacity and public Google OAuth launch checklist](./docs/QUOTAS-AND-LAUNCH.md)** — including real GA4 token accounting, distinct Search Console limits and Google's external testing restrictions.

> A web login does not by itself authenticate a third-party AI agent. Private remote MCP tools are **not yet available to public agents**, but the local read-only stdio CLI is now available in source. The documentation does not imply otherwise.

## Start locally (developer preview)

Requires **Node.js 22+**, Git and a Google Cloud project. The following commands run a local Next.js web dashboard. For an actual local stdio MCP server, see **Local MCP server (read-only preview)** below. These are separate processes and login flows.

```bash
git clone https://github.com/CamMicGo/cammicgo-seo-agent.git
cd cammicgo-seo-agent
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The OAuth callback now follows the server-controlled `APP_BASE_URL`; set it to `http://localhost:3000` and register `http://localhost:3000/api/auth/google/callback` in the **same GCP project whose client ID and secret you use**. Never redirect local OAuth codes to a hosted third-party installation.

### Installation locale simplifiée — assistant interactif

Inspiré de l'approche de [gum](https://github.com/ehmo/gum) (installation guidée puis connexion OAuth), CamMicGo propose maintenant un assistant de configuration pour le **tableau de bord local** :

```bash
git clone https://github.com/CamMicGo/cammicgo-seo-agent.git
cd cammicgo-seo-agent
npm install
npm run setup:local
npm run dev
```

L'assistant affiche l'adresse de redirection à enregistrer dans Google Cloud, demande le **Client ID** et le **Client Secret**, génère automatiquement une clé locale de chiffrement, et crée `.env.local`. L'utilisateur n'a **pas** besoin de copier un access token ou un refresh token : Google fournit ces jetons lors du consentement dans le navigateur. **Ne partagez pas votre écran pendant la saisie du secret** (l'entrée terminal est visible) et ne versionnez jamais `.env.local` ni `.env.local.backup`.

**Limite actuelle :** la procédure facilite l'authentification Google du tableau de bord Next.js en local, mais **ne constitue pas encore un serveur MCP stdio local opérationnel**. Contrairement à gum, CamMicGo ne fournit pas encore de binaire `mcp --stdio`, de stockage des jetons dans le trousseau du système, ni de configuration automatique des clients Claude/Codex/Gemini. Ces capacités restent à implémenter et tester.

### Local Google Cloud OAuth (BYO project and project-level quota)

**These OAuth callback instructions apply to the local Next.js browser dashboard.** The local stdio MCP login requires an **additional** redirect URI, `http://127.0.0.1:38271/oauth/callback`, as described below. Do not enable hosted `ENABLE_MCP_BETA` as a shortcut to authenticating ChatGPT or Claude.

1. Visit [Google Cloud Console](https://console.cloud.google.com/projectcreate), create a project belonging to **you**, and note its project ID. You do not need access to CamMicGo's Google Cloud project.
2. In **APIs & Services → Library**, enable **Google Search Console API**, **Google Analytics Data API**, and **Google Analytics Admin API**. For Ads, Calendar and YouTube add their APIs only when the corresponding integrations ship; enabling them alone does not add MCP tools.
3. Open **Google Auth Platform → Branding** and fill in the app name, user support email and developer contact details. Under **Audience**, choose External/Testing for personal tests, add your Google account under test users; use Internal only for eligible Workspace organizations. Publishing and Google verification may be needed for wider use. Testing consent/refresh tokens can expire according to Google's policies.
4. Open **Google Auth Platform → Clients → Create client → Web application**. Add **Authorized redirect URI** exactly `http://localhost:3000/api/auth/google/callback`. You may register `http://localhost:3000` as an authorized JavaScript origin if needed, but the server-side authorization-code flow primarily uses the callback URI. Google permits HTTP for localhost, not for ordinary public domains. Different port? Update both GCP and `APP_BASE_URL` to match exactly.
5. Copy `.env.example` to `.env.local` and enter your **own** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_BASE_URL=http://localhost:3000`, and a fresh 32-byte Base64 `SESSION_ENCRYPTION_KEY` (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). **Never commit, publish, screenshot or paste the secret.**
6. Run `npm install && npm run dev`, open `http://localhost:3000/connect` and authorize Google. Pick only the Search Console sites and GA4 properties the signed-in Google account can read. The server requests `webmasters.readonly` and `analytics.readonly` OAuth scopes; no Ads write permission is granted.
7. Verify requests and usage in your **own** Google Cloud project under **APIs & Services → Enabled APIs & services → Quotas & System Limits / Metrics**. If a request is denied, check project API enablement, test-user approval, scopes, property permissions, and `redirect_uri_mismatch` first.

**What “use your own quota” actually means:** Google API calls authorized using the user's own OAuth client and project are generally accounted against that project's relevant developer/project quota, **subject to Google's per-user, per-site and per-property restrictions**. A personal Google Cloud project does **not** guarantee extra GA4 property quota, unlimited requests, or a bypass of Google's restrictions. Running locally avoids hosted CamMicGo app usage accounting, but does not eliminate Google quotas or potential Google Cloud billing. Google Ads Keyword Planner requires separate Google Ads API approval/access, not just enabling the API.

**Local data safety:** Client secret and Google tokens are only for your local server/session. Do not bind the local development server to a public interface or forward the port publicly. Current cookies can contain encrypted Google session tokens and BYO secrets; local use is a *developer preview*, not a hardened, distributable desktop MCP product.

### Google Cloud setup

1. Create or select a GCP project. Enable **Search Console API**, **Google Analytics Data API**, and **Google Analytics Admin API**.
2. Configure Google Auth Platform → Audience. External / Testing requires adding your own Google account as a test user.
3. Create an **OAuth 2.0 Web application**. For the hosted app, register `https://seo.cammicgo.com/api/auth/google/callback`; for a local instance register `http://localhost:3000/api/auth/google/callback` and set `APP_BASE_URL` accordingly.
4. Provide `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in **Vercel Production environment variables**, not in public GitHub files.
5. Generate a **32-byte random encryption key** and store its Base64 encoding in `SESSION_ENCRYPTION_KEY`; do not reuse keys across installations.
6. Redeploy, visit `/connect`, authorize read-only scopes, select the sites/properties your account can access.

OAuth scopes: `https://www.googleapis.com/auth/webmasters.readonly` and `https://www.googleapis.com/auth/analytics.readonly`. The **Bring Your Own GCP project** mode accepts an OAuth Web client ID and secret supplied through a TLS form, encrypted within an HTTP-only session cookie. It does **not** dynamically enable disabled Google APIs.

**Security note:** Current session credentials, including BYO client secrets and refresh tokens, are encrypted client-side in an HTTP-only cookie, not kept in a database; browser cookie size and session revocation limitations mean this needs further security review before a large public release. A database-backed per-account session is recommended. Do not put credentials in prompts, logs or GitHub issues.

## Local MCP server (read-only preview)

**Simplest installation:** after cloning the repo and running `npm install`, start `npm run install:local`. This interactive wizard guides your Google Cloud OAuth setup, opens Google sign-in, verifies local credentials, and registers the stdio server with Claude Desktop, Gemini CLI, or Cursor. It does not create the Google Cloud OAuth client automatically; you must do that once in your own Google Cloud Console. No Google access tokens need to be pasted into the terminal or agent configuration.


**Local versus hosted AI apps:** Local `stdio` can be used in Claude Desktop, Gemini CLI, and Cursor after running `npm run agent:setup -- claude` (or `gemini` / `cursor`). **ChatGPT on Android/web and hosted Claude connectors require a remotely accessible HTTPS MCP with delegated OAuth**, not a localhost stdio command. The production endpoint currently does not offer authenticated private Google MCP tools. An easy public installable ChatGPT app is therefore **not ready**; avoid giving your Google client secret, access token or refresh token directly to any AI chat.

**Google Ads API:** According to the current official Google Ads API policy, Explorer can support ordinary account reporting (`GoogleAdsService.Search` and `SearchStream`) with OAuth and account access, but the Keyword Planner services remain unavailable until Basic/Standard. Neither reporting nor planning is implemented yet in this local MCP. No campaigns are created and no Google Ads account is modified.
A **working local stdio process is now included in source** at `scripts/local-mcp.mjs`. It runs on your machine rather than on CamMicGo's Vercel deployment. It exposes `service_info`, `find_google_properties`, `list_search_sites`, `search_performance`, `seo_keyword_opportunities`, `list_ga4_properties`, `ga4_top_pages`, and `ga4_countries`. Google access is read-only; the local executable also provides `youtube_my_channels`, `youtube_my_videos`, `youtube_video_metrics`, `calendar_list`, `calendar_upcoming_events`, and `find_google_properties`. **No Google Ads API integration or campaign writes are implemented.** This is a source-based Node.js CLI, **not a packaged Windows/macOS/Linux installer**.

1. Install Node.js 22+, clone this repository and run `npm install`.
2. In your own Google Cloud project enable **Search Console API**, **Google Analytics Data API** and **Google Analytics Admin API**. Configure OAuth consent and add yourself as a test user when in Testing.
3. Create an OAuth **Web application** client with **both** authorized redirect URIs: `http://localhost:3000/api/auth/google/callback` (local dashboard) and `http://127.0.0.1:38271/oauth/callback` (local MCP login). This second URL is an intentional **loopback callback** bound to your own machine, not to CamMicGo's website.
4. Run `npm run setup:local` to create the untracked `.env.local` with your OAuth client ID/secret and a new local encryption key.
5. Run `npm run local:login`: a Google browser consent screen will open; approve the read-only scopes. No access or refresh token is pasted into a terminal. The encrypted token and its separately stored local key are created under `~/.cammicgo-seo-agent` (filesystem permissions restricted when supported). **This is not OS keychain-grade protection**; only run it on a trusted computer, with an encrypted user disk.
6. Run `npm run local:doctor` to verify that your OAuth credentials and tokens are present.
7. Configure an MCP stdio client with the absolute path to Node.js and the absolute path to the script (example below), then restart the agent. Avoid relative paths that depend on the agent's current working directory. `npm run mcp:local` runs the same stdio process for manual testing.

Example agent configuration (replace absolute paths with those on your computer):

```json
{
  "mcpServers": {
    "cammicgo-seo-local": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/cammicgo-seo-agent/scripts/local-mcp.mjs", "stdio"]
    }
  }
}
```

The local MCP resolves its own repository's `.env.local` automatically, regardless of the agent's working directory. **Never copy your Google OAuth client secret into an agent's JSON configuration.** Keep `.env.local` private and out of Git. If your client uses a different MCP configuration format, use the same executable and argument.


### One-command agent registration (local MCP)

After `npm run setup:local` and `npm run local:login`, choose your local MCP client:

```bash
npm run agent:setup -- claude
# or
npm run agent:setup -- gemini
# or
npm run agent:setup -- cursor
```

This writes a CamMicGo `stdio` server entry into the selected user's configuration without copying any Google credential or token. Existing unrelated MCP entries are preserved. If a file exists, it makes a backup and refuses to overwrite an existing CamMicGo entry or an existing backup. Restart the desktop agent, then ask it to list your Google Search Console sites. ChatGPT web is **not** a local stdio client and requires the remote OAuth setup separately. Windows/macOS/Linux desktop integrations can vary by installed agent version; verify the client supports local `stdio` commands.

**Google quota:** Local Google API calls use credentials associated with your own GCP project, subject to Google's separate property/user quotas. This bypasses the hosted CamMicGo *application* quota, not Google's limits. Local storage and Google token refresh are user-managed. The hosted remote MCP at `https://seo.cammicgo.com/api/mcp` has a **different** authentication model; it still requires a complete OAuth MCP authorization server and persistent quota enforcement before private access can be enabled safely.

## MCP

The public production MCP accepts discovery of the `service_info` tool only, after this change is deployed. Private Google account data **remain unavailable to remote MCP clients** until secure client OAuth and durable usage limits are enabled. Verify actual production readiness at `/api/mcp/status`. A feature-gated 15-minute property-scoped test path has been implemented for controlled testing but must stay disabled until its security requirements are met. You can test discovery with any Streamable HTTP compatible MCP inspector. This is **not** a usable authenticated SEO MCP yet.

```text
https://seo.cammicgo.com/api/mcp
```

**Additional remote MCP tools and capabilities planned** (not shipped publicly yet): `compare_search_periods`, `ga4_report`, `get_google_quota`, `get_service_usage`, `connect_account`. Each requires identifying the caller and authorizing the specific property; never trust a site/property argument without checking access.

For local agents, a future `stdio` adapter could launch on the user's own PC and obtain OAuth locally. Its setup will differ from the hosted service; it does not exist in this release.

**[Google Calendar, YouTube, Ads and Workspace expansion + detailed security plan](./docs/GOOGLE-MODULES-AND-SECURITY.md)** documents the independently developed modular integration strategy. Calendar, YouTube and Google Ads modules are planned and **not yet enabled**. Read-only consent is the default; sensitive providers require separate opt-in and review.\n\n## Quotas and fair usage

There are **three distinct kinds of quota**:

| Bucket | Owner / scope | Notes |
|---|---|---|
| CamMicGo's Vercel Functions | Hosting account/team | All users share hosted CPU, memory, invocation and transfer limits |
| Google Search Console API | Per-site, per-user **and** per-GCP-project | Search Analytics includes rate and load limits; no official per-user % consumed is returned for every request |
| GA4 Data API | Per-property/day/hour and per-project/property/hour | Use `returnPropertyQuota:true` and read `propertyQuota` in each report |

GA4 standard Core quotas published by Google (subject to future changes): **200,000 tokens/property/day**, **40,000 tokens/property/hour**, **14,000 tokens/project/property/hour**, and **10 concurrent requests/property**. Complex queries use more tokens than simple ones. Google returns actual `consumed` and `remaining` on requested quota objects.

Search Console Search Analytics documentation gives **1,200 queries/minute per site**, **1,200 queries/minute per user**, and **40,000/minute and 30,000,000/day per project**, alongside separate short/long query-load limits. The limits are ceilings, **not allocations of 1,200 queries/minute to every visitor**.

### Recommended initial service allowance (not yet enforced)

- Free tier: **30 uncached Google data requests/day/account**, burst of **5/minute**; cap heavy reports to **90 days** until rate limiting is implemented.
- Per property: cache identical read-only reports for **15–60 minutes**; aggregate page/query stats and avoid full historical re-fetching.
- Rate-limit by **authenticated account and OAuth project**, not IP alone; use shared durable storage/atomic counters, not serverless in-memory values.
- Surface separate indicators for **your local service allowance**, **GA4's returned property/project quotas**, and **Google API 429/exhaustion**. Do not invent exact Search Console remaining quotas.

A read-only, authenticated user can see only their own allowance and their connected properties. Admin monitoring should use aggregated **operation counts, latency, error codes and rough resource volumes**, not store raw search queries or Google credentials by default.

### 10,000 active agents daily?

30 Google API calls per agent per day = **300,000 Google API calls/day**, before OAuth exchanges, page loads, MCP handshakes, cache misses and health checks: roughly **9 million upstream calls/month**. At least one Vercel invocation per tool call is likely; this exceeds Hobby's **1 million included function invocations/month** by a wide margin. Users are not allocated independent Vercel quotas by connecting their Google accounts.

**A plausible initial target is tens of active users/day**, then load-test and measure actual invocations, cache hit rate, CPU and memory before increasing. At 10k active agents/day use dedicated production hosting, durable queue/cache, observability, provider-compliant billing and independent security review. Do not promise 10k/day or zero running cost.

## Development and deployment

```bash
npm run typecheck
npm run build
```

A GitHub Actions Vercel workflow exists, but **Git integration is currently used for the hosted deployment**. Keep the alternate workflow disabled unless intentionally configured; don't enable duplicate production deployments.

Vercel Hobby is intended for **personal non-commercial use**; a public branded service may require Pro or other compliant hosting.

## Privacy and security

- OAuth read-only; user consent required.
- All API tools must verify the property belongs to the authenticated caller.
- Authenticated MCP remains disabled until OAuth for MCP clients, session isolation, CSRF protection and rate limiting are implemented and tested.
- No automatic article publishing or destructive Google actions in the current version.
- Verify Google's OAuth publishing requirements, privacy policy and access controls before inviting external users.

## License and third-party notices

CamMicGo SEO Agent's original code is published under the [MIT license](./LICENSE). Third-party dependencies retain their respective licenses and attribution requirements.

Made by **[CamMicGo](https://www.cammicgo.com)** — free webcam, microphone, headphone and device tests.

### October 2026 interface update

- GA4 date labels are formatted with abbreviated month names (for example, `09 Oct`) instead of raw `20261009` strings.
- Google sign-in uses a multicolour G symbol and higher-contrast button styling.
- The Ads beta draft now explicitly specifies a **CAMPAIGN_TOTAL** budget in euros. For future real Google Ads API creation, use `CampaignBudget.total_amount_micros` and a campaign start/end date with a supported bidding strategy; **do not substitute an average daily budget**. The preview does not submit advertisements, charge money, or guarantee eligibility for campaign creation. Official guidance: https://developers.google.com/google-ads/api/docs/campaigns/budgets/overview
- The GA4 country overview now uses an interactive SVG country-level map based on bundled Natural Earth data (`react-svg-worldmap`) instead of schematic continent blobs, and offers a country detail card with a credited Japan image. Country coverage and visual themes can be expanded; full CamMicGo map parity, city-level drilldown and more locally hosted country imagery remain planned.

Map component: [react-svg-worldmap](https://github.com/yanivam/react-svg-worldmap) (MIT). Japan scenic image: [SRP1998, CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Mount_Fuji_April_Cherry_Blossom.jpg). All third-party license requirements remain applicable.

## Audience Atlas · immersive geography (October 2026)

The GA4 dashboard now includes **country-specific full-screen portraits** inspired by the user-provided `Atlas d'audience.html` prototype. Select a country on the clickable map or ranking to open a cinematic scene with the country's name, sessions, daily-summed active users, page views, top visited pages and a miniature daily-traffic plot, all populated from that user's authorized GA4 property and selected date range. Navigate countries with previous/next and close with Esc. Respect reduced-motion preferences.

The visuals are **not analytics demo data**. A photo endpoint (`/api/country-photo?country=JP`) returns a representative real photograph and its Commons source/license/credit. Eight common destinations currently have explicitly curated, distinct Wikimedia Commons photographs; further country photos use a Commons search fallback where Wikimedia API access permits it, otherwise a country-themed gradient is shown. Never assume every country has a verified or available photograph. Media load is browser-dependent and the photo provider can be unavailable. The site's Google tokens and private analytics data are never sent to Wikimedia. Photos must retain creator credit and comply with their respective Creative Commons licensing obligations.

**Source vs implementation:** The prototype's fake GSC queries, conversions and simulated user volumes have NOT been imported; only its interaction/layout concept influenced the component. Search Console data will be added to country portraits only when a separately authorized site-specific country query is implemented. The GA4 `24h` selection still represents today and yesterday, not true realtime rolling 24 hours.

### Atlas modal refinements

The country portrait now opens as a **dismissible bounded modal on desktop** (the surrounding dashboard stays in place) and uses a mobile full-viewport dialog. The popup header includes the CamMicGo webcam logo, and the three numeric GA4 KPIs are centered and responsive. Photos are referenced from Wikimedia Commons and have fallback handling; **global photo coverage and reliable local hosting are not yet complete**, especially if the provider denies automated photo lookup or a file name changes. Do not imply every country has a tested background photo. Google Search Console country clicks/queries and Google Ads performance are **not present inside the portrait yet**; these require separately authorized properties, appropriate API permissions and additional backend work. Google Ads campaign writing remains disabled, and the authenticated private MCP preview still requires explicit flag activation and is not an OAuth-compliant public assistant connector. 

### Audience Atlas: per-country source tabs

Country popup now offers **Google Analytics 4**, **Search Console** and **Google Ads** source tabs. GA4 continues to show authorized country-filtered sessions, users, views and visited pages. To use Search Console, select an authorized Search Console site independently of the GA4 property; a dedicated server endpoint `/api/google/country-search` verifies the Google user's site access and queries Search Analytics with an ISO alpha-3 country filter. This tab returns actual country-specific keywords, clicks, impressions, CTR and positions; it currently supports explicitly mapped common country codes, and results represent top-query rows rather than exhaustive site totals. Search Console settled performance is **not a 24-hour real-time equivalent** of GA4, and some periods can have no GSC data. The Google Ads tab explicitly states **not connected** until an Ads customer is securely authorized and geographic reporting is implemented; no ad data is fabricated and campaigns cannot be created from this view.

**Photography audit:** Not completed for all world countries. The current country photo endpoint has curated filenames for a handful of locations plus an online Commons search for the rest. A fallback background will appear where images fail, and a verified locally hosted catalog is still required for guaranteed worldwide coverage. No claim of fully verified world coverage should be made.

### Map visibility fix

The Analytics country map uses the world-map component's `responsive` size mode instead of a fixed 480px canvas, with container overflow and SVG width adjusted for mobile. This aims to prevent partial clipping on narrow displays. The country list remains available as an accessible alternative. A rendered-device visual acceptance test is still recommended.

### Unified reporting-period behavior

The GA4 country Atlas passes the same selected period into the country-filtered Search Console endpoint. The standalone Search Console performance page also offers 24-hour, 28-day and all-available period options. **The 24-hour Search Console selection explicitly returns an unavailable notice** rather than silently substituting an older day; GSC finalized reporting is not directly comparable to GA4's today/yesterday calendar-day data. The detailed GA4 daily table formats dates as day + abbreviated month, e.g. `26 Oct`. Google Ads is not yet a connected reporting source and does not participate in the period selection.

## MCP tool catalog progress (October 2026)

The gated private MCP beta now includes `service_info`, `list_selected_properties`, `search_performance`, `seo_keyword_opportunities` (Search Console heuristic, optional country code), `ga4_top_pages`, `ga4_countries` (auth-checked 1–90-day regional traffic) and `prepare_ads_campaign` (non-spending preview only). These tools all require a property-scoped short-lived token and `ENABLE_MCP_BETA=true`; **this environment flag is deliberately not enabled for public production**. There is **no production OAuth MCP client-registration and authorization flow**, persistent shared quota enforcement, Google Calendar or YouTube operation support, real Google Ads customer connection, Keyword Planner API integration or real campaign mutation. This is not a published ChatGPT/Claude plugin and should not be advertised as fully functional with external agents.

Next gates: functioning production CI; standards-based MCP protected resource metadata, OAuth authorization and token issuance; independently verified account/property permissions; server-side session and revocation; atomic daily quota counters shared with web dashboard; then client-by-client interoperability and security tests.

## Local MCP: GSC, GA4, YouTube and Calendar (read-only)

The source-based **local stdio MCP** has 13 registered tools: `service_info`, `list_search_sites`, `search_performance`, `seo_keyword_opportunities`, `list_ga4_properties`, `ga4_top_pages`, `ga4_countries`, `youtube_my_channels`, `youtube_my_videos`, `youtube_video_metrics`, `calendar_list`, and `calendar_upcoming_events`. The latest YouTube and Calendar tools require **YouTube Data API v3** and **Google Calendar API** to be enabled in the user's own GCP project, and a **new** `npm run local:login` to consent to the read-only `youtube.readonly` and `calendar.readonly` scopes. They have been coded but are **not yet verified against an authenticated YouTube/Calendar account**. A YouTube channel can be missing, and an API may refuse access until properly configured.

From the repository directory, use `npm install` and `npm run install:local` for guided GCP credentials, browser OAuth and optional Claude Desktop / Gemini CLI / Cursor configuration. Alternatively, after credentials exist, run `npm run local:login`, `npm run local:doctor`, and `npm run mcp:local` to use the stdio server. The Google access/refresh tokens stay on this computer in an encrypted file under `~/.cammicgo-seo-agent` with owner-only file permissions, **not** in an OS keychain; the encryption key is stored separately on disk and should not be mistaken for hardware-backed storage. Agent config does not contain tokens. This local MCP does not use hosted CamMicGo Vercel or Supabase data-request quotas, but all Google API quotas still apply.

Unlike gum's dynamically searched API catalog and its 29 startup MCP tools (9 meta-tools), **CamMicGo does not currently provide generic API search/describe/call, Workspace-wide operations, write/mutation tools or a comparable catalog**. Google Ads Keyword Planner is not implemented; its access requirements are distinct from GSC keyword reports. No campaign charges or calendar modifications are performed. This local version is a developer preview: do not claim 29 equivalent Gum tools or full Google coverage.

## Installation en cinq étapes — MCP local (Windows / macOS / Linux)

**Prérequis :** Node.js 22 ou plus récent et Git. Cette version s'exécute depuis le code source, sans installateur graphique ni compte CamMicGo hébergé.

1. Créez votre projet [Google Cloud](https://console.cloud.google.com/), activez **Search Console API**, **Google Analytics Data API**, **Google Analytics Admin API**, ainsi que **YouTube Data API v3** et **Google Calendar API** si vous souhaitez ces fonctions.
2. Google Auth Platform → **Audience** : ajoutez votre compte comme testeur si l'application est en mode Testing. Dans **Clients**, créez un client **Application Web** et enregistrez exactement `http://127.0.0.1:38271/oauth/callback`. Pour le dashboard web local, ajoutez aussi `http://localhost:3000/api/auth/google/callback`.
3. Dans un terminal, installez puis lancez l'assistant :

   ```bash
   git clone https://github.com/CamMicGo/cammicgo-seo-agent.git
   cd cammicgo-seo-agent
   npm install
   npm run install:local
   ```

4. L'assistant vous demandera **Client ID** et **Client Secret** de votre propre projet Google Cloud. Il ouvrira ensuite votre navigateur pour obtenir le consentement Google et enregistrera les jetons chiffrés sur votre ordinateur. Ne collez **jamais** ces secrets dans un chat ou un dépôt GitHub. La saisie du secret reste visible dans le terminal : protégez votre écran pendant la configuration.
5. Sélectionnez **claude**, **gemini** ou **cursor** ; le programme écrit la connexion MCP dans la configuration de cet agent (en réalisant une sauvegarde si le fichier existe). Redémarrez l'agent et demandez : « Liste mes sites Search Console et mes propriétés Analytics ». Pour diagnostiquer : `npm run local:doctor`.

Le MCP local ne dépend pas du quota de la plateforme CamMicGo ; il reste soumis aux quotas et droits Google de votre propre projet et compte. **Google Ads Keyword Planner, écritures Google Ads et YouTube Analytics détaillé ne sont pas inclus.** Les outils YouTube/Calendar ont été implémentés en lecture seule mais nécessitent encore un essai réel sur des comptes autorisés ; ils peuvent déclencher une vérification OAuth Google selon les scopes et le statut du projet.

## Which site will my AI agent use? How are quotas protected?

**Local MCP (currently supported):** the `find_google_properties` tool searches your *authorized* Search Console properties and GA4 property names using a site/domain/brand from your request. For example: “Use my CamMicGo site, not the other sites in my account.” If multiple matches exist, the agent must ask you for the exact property instead of guessing. Each subsequent tool requires the exact `site` or `property` identifier and checks authorization with Google on every call. GA4 and Search Console properties are **not automatically paired** simply because their names look similar.

**Local quotas:** local MCP calls use your own Google Cloud OAuth client credentials and Google project. They do not count against CamMicGo's hosted application call allowance. Google's own API, user, site, and GA4-property limits still apply. For local deployment use `npm run setup:local`, `npm run local:login`, `npm run local:doctor`; the agent must launch `node scripts/local-mcp.mjs stdio`. You need to authorize the localhost callback `http://127.0.0.1:38271/oauth/callback` in the same Google Cloud OAuth client in addition to the browser dashboard's `http://localhost:3000/api/auth/google/callback`.

**Remote quotas and owner reserve (not yet enforced):** a free hosted tier of 30 data requests per user per UTC day is planned, counted jointly across web and remote MCP. The initial reserve proposal is a **separate owner/test account allocation**, not simply extra requests in a shared anonymous pool. The owner must be identified by a verified, server-side account role, never by an editable email, query parameter or cookie setting. Configure a global budget and emergency circuit breaker and enforce atomic per-account consumption in the private database; simply returning “30 remaining” without database enforcement is prohibited. The number of sustainable active users depends on the actual GSC/GA4 quotas and API calls per request, not just 30 calls. **No reliable maximum user count can be promised without traffic and provider-quota measurements.**

**Remote BYO:** the hosted browser dashboard supports entering a personal Google Cloud OAuth Web client. This **does not yet** provide agent OAuth for the remote MCP, an independent remote quota, or persistent credentials. That workflow requires an OAuth 2.1 MCP authorization server and per-account secure storage, consent screen, refresh/revoke, quota metering and user/site authorization, none of which is finished. Never ask users to paste OAuth access/refresh tokens into prompts. Real Google Ads campaign execution remains disabled and requires explicit human authorization.

### MCP OAuth discovery status (October 2026)

The remote MCP has discovery routes at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`. **They fail closed unless `ENABLE_MCP_OAUTH=true` and `MCP_OAUTH_ISSUER` identify a separately deployed, functional HTTPS authorization server.** A challenge from the private MCP beta references the protected-resource metadata URL. The authorization-server well-known endpoint redirects to the configured issuer's RFC 8414 metadata; the application does not implement its own OAuth authorization code/token endpoints. **Do not set `ENABLE_MCP_OAUTH=true` until the external issuer is operational AND the MCP route verifies access tokens for its audience, scopes and user.** Metadata alone does not connect ChatGPT or Claude to private Google accounts. The existing temporary bearer beta is not interchangeable with OAuth 2.1. No access tokens are ever to be pasted into prompts.

### Hosted MCP OAuth (Supabase Auth)

**[Supabase Auth OAuth 2.1 setup and security status](./docs/SUPABASE-MCP-OAUTH.md)** — step-by-step dashboard instructions, protected-resource discovery, shared Supabase Community project caveats, and remaining work. The opt-in Supabase-authenticated endpoint currently exposes only identity/status tools; private Google data remains disabled until account linking and enforced quotas are complete. The Google OAuth browser dashboard is a separate authorization flow.

## Installation MCP locale avec Google OAuth Bureau (Windows, macOS, Linux)

**13 outils MCP locaux sont implémentés dans le code** (Search Console, GA4, YouTube et Calendar, plus recherche de propriétés et informations de service). Il s'agit d'un serveur `stdio` local, indépendant de Vercel et de Supabase. Google Ads Keyword Planner et les campagnes payantes n'en font pas partie. Les appels réels nécessitent des tests sur chaque plateforme et des permissions Google adaptées.

1. Dans **Google Cloud → Google Auth Platform → Clients**, créez un client **Application de bureau** (ne choisissez pas Application Web pour le serveur MCP local). Dans **Audience**, ajoutez votre compte aux utilisateurs de test si le projet est en Testing. Activez **Search Console API**, **Analytics Data API**, **Analytics Admin API**, **YouTube Data API v3** et **Calendar API** pour les outils correspondants.
2. Téléchargez le **JSON du client Bureau** sur votre ordinateur. Gardez-le privé. **Ne le joignez jamais à un ticket GitHub ni à une discussion.** Un secret visible dans une capture doit être révoqué et remplacé avant utilisation.
3. Installez Node.js 22 ou plus récent, puis exécutez :

```bash
git clone https://github.com/CamMicGo/cammicgo-seo-agent.git
cd cammicgo-seo-agent
npm install
npm run oauth:desktop -- "/chemin/vers/client_secret.json"
npm run local:login
npm run local:doctor
npm run agent:setup -- claude
```

Remplacez `claude` par `gemini` ou `cursor` selon l'agent installé. Redémarrez l'agent après configuration. L'authentification ouvre le navigateur et revient sur `http://127.0.0.1:38271/oauth/callback` (loopback du client Bureau ; **aucune URI de redirection manuelle à enregistrer pour un client Bureau**). Les tokens sont obtenus automatiquement, sans copier-coller manuel.

Pour un parcours plus guidé, `npm run install:local` orchestre ces étapes et propose de configurer l'agent. Si `.env.local` existe déjà, l'import du client Bureau s'arrête par sécurité au lieu de remplacer silencieusement les identifiants.

**Sécurité actuelle :** les jetons sont chiffrés avec une clé locale stockée dans `~/.cammicgo-seo-agent/token.key` et le fichier chiffré `google-token.enc`, protégés par les permissions du système lorsque celles-ci sont appliquées. Ce n'est **pas encore le trousseau sécurisé natif de l'OS** (Keychain/Credential Manager/Secret Service). Ne partagez ni ces fichiers, ni `.env.local`. Les quotas propres au projet GCP s'appliquent sous réserve des limites de chaque API et propriété.

**Différence Web / Desktop :** `npm run dev` lance le tableau de bord Web, dont le flux OAuth utilise un client **Web** et un autre callback. Un client OAuth **Bureau** est prévu pour `npm run local:login` et `npm run mcp:local`. Ne mélangez pas les deux pour un même parcours OAuth.


### Verified local MCP protocol smoke test

The source-based local `stdio` MCP implementation registers **13 tools**: `service_info`, `find_google_properties`, `list_search_sites`, `search_performance`, `seo_keyword_opportunities`, `list_ga4_properties`, `ga4_top_pages`, `ga4_countries`, `youtube_my_channels`, `youtube_my_videos`, `youtube_video_metrics`, `calendar_list`, and `calendar_upcoming_events`.

```bash
npm run test:mcp:local
```

This automated test runs a separate local MCP process with **throwaway, fake credentials** and checks the JSON-RPC initialization handshake, tool list and `service_info` call. It **does not** call Google or verify a real OAuth login; users must still complete `npm run install:local` and check that their Google account grants the required scopes. Calendar and YouTube are read-only and depend on each user's API permissions. No real Ads Keyword Planner or Ads campaign creation is exposed in the local tools. Running the tests does not automatically deploy Vercel or authorize the remote MCP endpoint.

## Remote AI-client connection details

**Client display name:** CamMicGo SEO Agent. **MCP server (Streamable HTTP):** `https://seo.cammicgo.com/api/mcp`. See [the client connection page](https://seo.cammicgo.com/mcp/connect) for Claude, ChatGPT and Gemini CLI setup, and [Google Cloud BYO setup](https://seo.cammicgo.com/connect) for browser Google login with your own OAuth Web client ID/secret. **Remote private Google tools are not yet available to general third-party clients:** MCP agent OAuth, secure Google-account linking and atomic shared quota enforcement still need integration testing before opening production. Do not confuse Google web login with MCP client authorization. 

**App-directory short description:** “Read-only Search Console and Google Analytics insights for AI assistants, with personal Google Cloud OAuth options. Private remote MCP integrations are in development.”
