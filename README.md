# CamMicGo SEO Agent

**Open Source · Free · Remote MCP** — built by [CamMicGo](https://www.cammicgo.com).

## Current state
Public technical preview. `/api/health` returns status; `/api/mcp` exposes the harmless `service_info` MCP tool. **No Google account access is enabled yet.** Google OAuth, per-user tokens, and authenticated SEO tools must be completed before public use with private data.

## Development
Node 22+ required. Run `npm install`, `npm run dev`, and `npm run typecheck`.

## Deployment
Create a separate Vercel project. Add Actions secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Set Actions variable `VERCEL_DEPLOY_ENABLED=true` only once credentials have been configured. GitHub Actions uses Vercel CLI build and prebuilt deployment.

## Google integration
Dedicated GCP project `cammicgo-seo-agent`; Search Console and GA4 read-only OAuth. Before enabling private MCP tools: verified OAuth client, state/PKCE, strict identity binding, encrypted token storage, scopes validation, per-user isolation and rate limiting.

## Licenses
MIT for original CamMicGo code; third-party dependencies retain their licenses. Gum source is not included yet. Any future incorporation of Gum code must preserve its license notices.
