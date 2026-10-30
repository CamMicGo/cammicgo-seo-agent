# Optional Google services and security plan

CamMicGo SEO MCP is independently developed; features are modular. The default SEO login must never ask for calendar, YouTube, Google Ads, Gmail or Drive permissions. **Calendar / YouTube / Ads / Workspace integrations are planned, not currently implemented.** Enabling a Google API alone does not implement a working MCP tool.

## Planned modules

| Module | Read-only first tools | Google setup | Notes |
|---|---|---|---|
| Search Console | list sites, performance, filtered keywords, queries, pages, country/device comparison | Search Console API + OAuth | Web dashboard operational; authenticated MCP private beta requires activation |
| Google Analytics 4 | list properties, top pages, engagement, country report, quotas | Analytics Data + Admin APIs | Web dashboard operational |
| Google Calendar | list calendars, list/search events, time slots/free-busy | Calendar API + incremental `calendar.events.readonly` or narrower scopes | Personal schedule data; do not make create/update/delete tools the default |
| YouTube Data | list channels/playlists/videos, statistics, video performance | YouTube Data API v3 + `youtube.readonly` for private channel data | Public videos can use API key, but private resources require OAuth |
| Google Ads | list customers, campaigns, ad groups, search terms, costs/conversions | Google Ads API + `adwords` scope, separate project access level verification | In 2026 developer tokens were sunset for newly onboarded GCP projects; access is managed through GCP Test/Explorer/Basic/Standard; check current guide before building |
| Other Workspace | Drive, Docs, Sheets, Slides, Gmail, Tasks, People, Meet, etc. | service-specific APIs and individually minimized OAuth scopes | Separate modules; high-sensitivity data and Google verification requirements |

Do not request all scopes at initial sign-up; let the user enable a module and consent **just to that module**. Treat the Google Ads `adwords` scope with especially restrictive read-only tool allowlists; the scope can authorize writing even if our own read-only dispatcher restricts it.

## Google API quota snapshot (27 October 2026)

- **Google Calendar**: 10,000 requests/min per project; 600/min per user per project; currently 1,000,000 daily requests/project before possible future billing per Google's May 2026 model. Google may change pricing. Do not promise permanently free unlimited use.
- **YouTube**: default combined quota of 10,000 units/day for most methods; the daily `search.list` call budget is separately limited to 100. Reset is midnight Pacific time; quotas are not equivalent to 10,000 searches.
- **Google Ads**: API currently has free access tiers; production Explorer is generally 2,880 operations per sliding 24 hours, Basic 15,000; higher access requires review. Project-level quota can be shared across connected accounts. Google Ads API access does not enable advertising free of charge.

## Security requirements for public remote MCP

1. **Separate agent identity from Google consent.** Serve OAuth authorization-server metadata, protected-resource metadata, PKCE and dynamically registered/approved clients as needed by ChatGPT/Claude/Gemini. Verify exact resource audience, issuer, signature/expiry/scopes on each request; no shared Google refresh token or bearer key in a prompt.
2. **User-selected properties.** All tools bind requests to a verified Google subject + authorized site/property; revalidate access when scopes or permissions change.
3. **Persist secrets safely.** Store per-user Google refresh tokens and per-agent grants encrypted at rest in a server-side database, never within lengthy client-readable data; use a secrets manager/KMS with rotation. Current web preview uses encrypted HTTP-only cookies and must be reviewed before public release.
4. **Read-only defaults and write controls.** Central operation policy (allowlists). Any future create/update/delete action requires feature opt-in and explicit confirmation; irreversible operations always require separate approval, and never run because of untrusted content within a report or calendar event.
5. **Rate limits.** Atomically enforce per-user, per-project and global caps, with separate provider-specific budgets. Current temporary MCP beta is behind `ENABLE_MCP_BETA` and must remain off until durable counters, revocation and audit controls are tested.
6. **Input and output hardening.** Reject SSRF, arbitrary URLs, unapproved API hosts, huge limits, data exfiltration and prompt-injection content. Limit result size and redact personal information; never allow agents to construct arbitrary Google API requests in production by default.
7. **Telemetry.** Record operation types, duration, quota/cost, generic status codes and cache hits; do not store raw users' search queries, calendar titles, email bodies or YouTube private metadata by default.
8. **Supply chain.** Pin dependencies and review PRs/releases; vulnerability scans and signed installer artifacts. Do not automatically spawn untrusted plugin subprocesses with user credentials. Include SECURITY.md for private reporting.
9. **Provider policy.** Obtain Google OAuth verification for relevant sensitive scopes, and check additional security-assessment obligations for any restricted scopes. Consent and privacy notices must match what code actually does.
10. **Host and costs.** Use the smallest possible scopes, test abuse protections, and confirm commercial hosting eligibility before public availability.

## Local implementation objectives

Ship standalone stdio adapter, OS keychain-backed credentials, OAuth PKCE Desktop application flow, exact scope selection, `doctor` diagnostics, compact JSON output and tools loaded on demand. Local agents should be able to work offline from CamMicGo hosting after Google authorization, although fetching Google reports still requires Internet.

## Official references

- Google Calendar quotas: https://developers.google.com/workspace/calendar/api/guides/quota
- YouTube API quotas: https://developers.google.com/youtube/v3/determine_quota_cost
- Google Ads API GCP access: https://developers.google.com/google-ads/api/docs/api-policy/access-levels
- MCP authorization: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
