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

Open http://localhost:3000. Note that the OAuth callback in the **current code is hardcoded to** `https://seo.cammicgo.com/api/auth/google/callback`, so OAuth **cannot be completed against localhost as-is**. Local authenticated operation requires implementing environment-based callback URLs and adding `http://localhost:3000/api/auth/google/callback` to your own GCP OAuth client first. Never redirect local OAuth codes to a deployed third-party app.

### Google Cloud setup

1. Create or select a GCP project. Enable **Search Console API**, **Google Analytics Data API**, and **Google Analytics Admin API**.
2. Configure Google Auth Platform → Audience. External / Testing requires adding your own Google account as a test user.
3. Create an **OAuth 2.0 Web application**. For the hosted app, register `https://seo.cammicgo.com/api/auth/google/callback`.
4. Provide `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in **Vercel Production environment variables**, not in public GitHub files.
5. Generate a **32-byte random encryption key** and store its Base64 encoding in `SESSION_ENCRYPTION_KEY`; do not reuse keys across installations.
6. Redeploy, visit `/connect`, authorize read-only scopes, select the sites/properties your account can access.

OAuth scopes: `https://www.googleapis.com/auth/webmasters.readonly` and `https://www.googleapis.com/auth/analytics.readonly`. The **Bring Your Own GCP project** mode accepts an OAuth Web client ID and secret supplied through a TLS form, encrypted within an HTTP-only session cookie. It does **not** dynamically enable disabled Google APIs.

**Security note:** Current session credentials, including BYO client secrets and refresh tokens, are encrypted client-side in an HTTP-only cookie, not kept in a database; browser cookie size and session revocation limitations mean this needs further security review before a large public release. A database-backed per-account session is recommended. Do not put credentials in prompts, logs or GitHub issues.

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
