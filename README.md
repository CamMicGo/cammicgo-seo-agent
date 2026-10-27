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

CamMicGo SEO Agent is a **free, open-source SEO-focused Google connector** for human users and, eventually, their own AI agents. It is **not a fork of Gum** and does **not yet implement Gum's full Google API catalog**. Gum is a broad CLI + local MCP tool for many Google services; this project focuses on Search Console and GA4, with a browser-based OAuth flow and hosted Next.js endpoint.

> **Current implementation:** A public MCP `service_info` tool; browser-based read-only Google OAuth (shared project or bring your own GCP OAuth client); listing your authorized Search Console and GA4 properties; a Search Console query report; a GA4 traffic and page report. **Private Google data is NOT yet available to MCP clients.** No public remote MCP auth flow or installable authenticated local MCP server is shipped. Do not mistake the web dashboard for an authenticated MCP integration.

### Current capabilities

| Capability | Web dashboard | Public MCP | Planned |
|---|---|---|---|
| Google OAuth, read-only | ✅ | ❌ | Secure per-agent MCP authorization |
| List Search Console sites | ✅ | ❌ | ✅ |
| Search queries, clicks, impressions, CTR, average position | ✅ | ❌ | Compare dates, country, device, page |
| List GA4 properties | ✅ | ❌ | ✅ |
| GA4 top pages, traffic by day | ✅ | ❌ | Segments, events, attribution |
| GA4 Data API quota returned by Google | API response | ❌ | Visible gauges and history |
| SEO opportunities and content briefs | ❌ | ❌ | ✅ |
| Local stdio MCP | ❌ | ❌ | ✅ |

### Current UI

Connect: https://seo.cammicgo.com/connect  
Dashboard: https://seo.cammicgo.com/dashboard  
Service status: https://seo.cammicgo.com/api/health  
Remote MCP preview: https://seo.cammicgo.com/api/mcp

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

The only public tool currently exposed is `service_info`, a non-sensitive capabilities/status response. You can test discovery with any Streamable HTTP compatible MCP inspector. This is **not** a usable authenticated SEO MCP yet.

```text
https://seo.cammicgo.com/api/mcp
```

**Planned MCP tool names** (not shipped yet): `list_search_sites`, `search_performance`, `compare_search_periods`, `list_ga4_properties`, `ga4_report`, `seo_opportunities`, `get_google_quota`, `get_service_usage`, `connect_account`. Each requires identifying the caller and authorizing the specific property; never trust a site/property argument without checking access.

For local agents, a future `stdio` adapter could launch on the user's own PC and obtain OAuth locally. Its setup will differ from the hosted service; it does not exist in this release.

### Comparison with Gum

[Gum](https://github.com/ehmo/gum) is an independent MIT-licensed Google API CLI and MCP server providing **broad API discovery and dispatch** (Workspace, Search Console, Ads and more). Its local setup already provides `gum mcp --stdio`. For users who need broad Google operations **today**, consider installing upstream Gum as documented there. CamMicGo SEO Agent is an independent SEO product and does **not** claim parity with Gum. If Gum code is reused later, original copyright/attribution notices must be preserved.

## Quotas and fair usage

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

## License and attribution

This repository's original code is [MIT](./LICENSE). Third-party components retain their own licenses. [Gum](https://github.com/ehmo/gum) is MIT licensed **but its source is not currently included**.

Made by **[CamMicGo](https://www.cammicgo.com)** — free webcam, microphone, headphone and device tests.
