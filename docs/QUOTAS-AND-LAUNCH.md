# Quotas, capacity, and public launch — CamMicGo SEO Agent

## Distinguish the quota owners

1. **Service budget:** CamMicGo's hosting/storage/computation. Every remote agent call consumes some shared infrastructure.
2. **Service user allowance:** a fair-use cap we control, e.g. per authenticated account, property and window.
3. **Google quota:** provider limits. **GA4** has property/day, property/hour, project+property/hour, concurrency, and error budgets. **Search Console** limits are per user/site/project plus short- and long-term **query load**; API responses do not provide a reliable percentage-remaining for each user.
4. **BYO Google Cloud OAuth project:** changes some project-scoped Google quota accounting, but does **not** avoid property-wide limits or our remote hosting costs. BYO credentials must not grant access to unrelated users' data.

## Official GA4 Core limits (standard properties; always verify current documentation)

- 200,000 tokens per property per day
- 40,000 tokens per property per hour
- 14,000 tokens per project per property per hour
- 10 concurrent requests per property

Use `returnPropertyQuota:true` and display Google's `consumed` / `remaining` fields. Tokens are variable with query complexity; **1 report is not always 1 token**. The web GA4 API currently requests property quota; a dashboard gauge may show that response, not a guaranteed allocation to the signed-in person.

## Proposed free tier — NOT ENFORCED YET

- 30 **uncached** Google report requests/account/day
- Burst maximum 5 report requests/account/minute
- Up to 3 concurrent reports/account, with tighter per-GA4-property controls
- Cache repeated historical reads for 15–60 minutes, keying by user **and authorized property, query and date range**; avoid caching personal data in public CDNs
- Limit expensive GSC page+query aggregation and report date ranges until measured
- GA4 429 => back off; don't retry unlimited times
- Expose `service_allowance` (local service limit), `ga4_provider_quota` (official returned), `gsc_usage_estimate` (our own counted calls, **not** official remaining)
- Track aggregate operations/errors/cache hits/performance without retaining users' raw keywords by default
- Enforce with atomic counters in a shared durable system (Redis/Postgres), **not** in-memory serverless functions; hard caps by Google project/property and a global circuit breaker

## 10,000 daily active agents model (scenario, not capacity guarantee)

| Daily active agents | Google report calls/agent/day | Upstream report calls/day | 30-day calls |
|---:|---:|---:|---:|
| 100 | 10 | 1,000 | 30,000 |
| 1,000 | 10 | 10,000 | 300,000 |
| 10,000 | 10 | 100,000 | 3,000,000 |
| 10,000 | 30 | 300,000 | 9,000,000 |

On top of these: MCP handshake/discovery, sign-in, refresh, web pages, rate-limit checks and diagnostics. At **10,000 daily active agents**, the service likely requires a paid, capacity-tested production architecture; it is **not realistic to promise this on Vercel Hobby**. A local stdio offering shifts inference and connector calls to the user's computer, greatly reducing hosted load.

Vercel Hobby includes roughly 1 million function invocations per account period, but also CPU and memory limits; it is intended for personal non-commercial use. Hosted quota and costs must be load-tested under representative traffic and cache hit rates.

## Public Google OAuth rollout

Current **External / Testing** Google OAuth project can authorize only listed test users (up to 100). For scopes beyond openid/profile/basic, test-user grants commonly expire in **7 days**; test mode is not a sustainable public release.

Before publishing:
1. Complete app branding, support contact, verified domain ownership, public home page, privacy policy and accurate data-use/retention disclosures.
2. Confirm minimum **read-only** scopes and classify their sensitivity in Google Auth Platform; enable Search Console, Analytics Data, Analytics Admin APIs.
3. Implement production-grade sessions/tokens, identity management, user isolation, MCP OAuth discovery/authorization, rate limiting, abuse detection and safe logs.
4. Switch publishing to **In production** and submit Google OAuth app verification **if scope classification requires it**. Provide a working test account, recorded demonstration and any required domain proof. Verification may take time; Google controls acceptance.
5. Test with an independent authorized Google account, revoke access, verify quota exhaustion, and perform security review before broad invitations.
6. Confirm hosting plan terms and budget; Hobby may not suit a public, branded service.
7. Publish accurate client-specific setup instructions, installer releases and incident/support contacts.

**Do not** remove Google's verification/consent requirements by changing accounts or making a GitHub repository public.

Official references:
- https://developers.google.com/analytics/devguides/reporting/data/v1/quotas
- https://developers.google.com/webmaster-tools/limits
- https://support.google.com/cloud/answer/15549945?hl=en
- https://support.google.com/cloud/answer/13463073?hl=en
- https://vercel.com/docs/plans/hobby
