<div align="center">

<img src="https://avatars.githubusercontent.com/u/322584442?v=4" width="128" alt="CamMicGo webcam logo" />

# CamMicGo SEO Agent
### Free · Open Source · SEO insights for AI assistants

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Technical preview](https://img.shields.io/badge/status-technical%20preview-yellow.svg)](https://seo.cammicgo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![MCP](https://img.shields.io/badge/Model%20Context%20Protocol-remote%20preview-6666cc.svg)](https://modelcontextprotocol.io/)

**[Website](https://seo.cammicgo.com)** · **[Connect Google](https://seo.cammicgo.com/connect)** · **[Source](https://github.com/CamMicGo/cammicgo-seo-agent)** · **[CamMicGo](https://www.cammicgo.com)**

<img src="https://seo.cammicgo.com/google-search-console.svg" width="62" alt="Google Search Console" /> &nbsp;&nbsp;
<img src="https://seo.cammicgo.com/api/assets/google-analytics" width="62" alt="Google Analytics" />

</div>

---

## What is this?

CamMicGo SEO Agent is a **free, open-source alternative to GSC Wizard**, focused on Google Search Console, Google Analytics 4 and SEO insights for AI assistants. It is an independently developed project with a secure browser-based Google OAuth flow and a hosted Next.js endpoint. Our goal is to offer transparent, extensible SEO analytics with both remote MCP and local agent support.

> **Current implementation:** A public MCP `service_info` tool; browser-based read-only Google OAuth (shared project or bring your own GCP OAuth client); listing your authorized Search Console and GA4 properties; a Search Console query report; a GA4 traffic and page report. **Private Google MCP tools are implemented behind a disabled feature flag for limited testing, not available to public clients by default.** No public remote MCP auth flow or installable authenticated local MCP server is shipped. Do not mistake the web dashboard for an authenticated MCP integration.

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
| Local stdio MCP | ❌ | ❌ | ✅ |\n| Calendar, YouTube and Google Ads | ❌ | ❌ | Modular read-only opt-in integrations |

The GA4 dashboard now includes a date-selectable 28-day traffic chart and an interactive country overview with a schematic map and sortable-style ranked country list. The map uses approximate country centroids rather than visitor locations. Charts and country data are available only after browser OAuth; these private data tools are not yet callable from public MCP.\n\n### Google Ads campaign planner (preview)

The connected web dashboard now links to **[/dashboard/ads](https://seo.cammicgo.com/dashboard/ads)**. This prepares an example CamMicGo Search campaign with a **maximum €150 entered budget, maximum seven days, selectable countries and keywords**. **No Google Ads account or campaign is accessed; nothing is created or charged.** The authenticated private MCP beta includes a non-spending `prepare_ads_campaign` tool, but the beta is disabled by default. Google Ads OAuth, project access approval, account/manager selection, `validate_only` API validation, server-side controls, revocation, customer currency/timezone validation, durable quotas and human confirmation must be delivered and tested before enabling campaign mutations.

**Budget caution:** Google Ads average daily budgets may overdeliver on individual days and don't by themselves guarantee an exact seven-day total. A real spend ceiling requires careful campaign scheduling, monitoring and separate user authorization. A €150 preview is not a guaranteed charge cap.

### Current UI

Connect: https://seo.cammicgo.com/connect  
Dashboard: https://seo.cammicgo.com/dashboard  
Service status: https://seo.cammicgo.com/api/health  
Remote MCP preview: https://seo.cammicgo.com/api/mcp

## Setup for your AI assistant

**[ChatGPT, Claude, Gemini CLI and local MCP installation plans](./docs/CONNECTING-AGENTS.md)** — explains separate AI→CamMicGo and CamMicGo→Google OAuth flows, exact compatibility of the current preview, the remote URL and the proposed local distribution.

**[Quotas, fair use, 10,000-agent capacity and public Google OAuth launch checklist](./docs/QUOTAS-AND-LAUNCH.md)** — including real GA4 token accounting, distinct Search Console limits and Google's external testing restrictions.

> A web login does not by itself authenticate a third-party AI agent. Private MCP tools and the local stdio executable are **not yet shipped**. The documentation does not imply otherwise.

## Start locally (developer preview)

Requires **Node.js 22+**, Git and a Google Cloud project. This runs a **local Next.js web server**, **not** a local MCP stdio adapter. Local development does not by itself connect the server to ChatGPT/Gemini.

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

**This works for the local Next.js browser dashboard, not yet for a standalone local `stdio` MCP client.** A local `npm run dev` process is an HTTP Next.js app. The private MCP endpoint is not yet installable/authorized by ChatGPT, Claude or Gemini; do not enable `ENABLE_MCP_BETA` as a shortcut.

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

A **working local stdio process is now included in source** at `scripts/local-mcp.mjs`. It runs on your machine rather than on CamMicGo's Vercel deployment. It exposes `list_search_sites`, `search_performance`, `list_ga4_properties`, and `ga4_top_pages`. Google access is read-only; there are **no Ads writes**, Calendar or YouTube tools in this executable yet. This is a source-based Node.js CLI, **not a packaged Windows/macOS/Linux installer**.

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

The public production MCP remains unavailable for private account data until secure client OAuth and durable usage limits are enabled. A feature-gated 15-minute property-scoped test path has been implemented for controlled testing but must stay disabled until its security requirements are met. You can test discovery with any Streamable HTTP compatible MCP inspector. This is **not** a usable authenticated SEO MCP yet.

```text
https://seo.cammicgo.com/api/mcp
```

**Planned MCP tool names** (not shipped yet): `list_search_sites`, `search_performance`, `compare_search_periods`, `list_ga4_properties`, `ga4_report`, `seo_opportunities`, `get_google_quota`, `get_service_usage`, `connect_account`. Each requires identifying the caller and authorizing the specific property; never trust a site/property argument without checking access.

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
