# Supabase Auth + OAuth 2.1 for CamMicGo MCP (installation progress)

## Architecture
- Supabase Auth manages CamMicGo identity and can act as OAuth 2.1 authorization server for MCP clients with PKCE.
- Google Search Console/GA4 authorization is **a second, distinct flow**; Supabase login is not a Google API grant. Never send a Google refresh token to an MCP client.
- Private database schema `cmg_private` already installed in the existing `cammicgo-community` Supabase project; `accounts.supabase_user_id` now references `auth.users`. Do not expose this schema in Data API.
- Code now supports **opt-in** `ENABLE_SUPABASE_MCP_AUTH=true`: bearer tokens validated against Supabase Auth, with **only** `service_info` and `account_status` permitted. No user Google data/tools yet. Keep the flag off in production until full consent UI, encrypted Google account linkage, server-side property authorization and atomic shared quotas are ready.

## Supabase dashboard steps (project vfngxjsryklqldarkxhy)

1. [Settings → API Keys](https://supabase.com/dashboard/project/vfngxjsryklqldarkxhy/settings/api-keys): use **Publishable key** (`sb_publishable_…`) for server-side Supabase Auth token verification. Store on Vercel as **`SUPABASE_PUBLISHABLE_KEY`** (Production). This is a non-privileged key, not the secret key.
2. **Never** put `sb_secret_…` or the legacy `service_role` in browser-side `NEXT_PUBLIC_` variables; do not paste them in ChatGPT, issues or screenshots. No Supabase secret key is needed for the identity-only MCP path.
3. [Authentication → OAuth Server](https://supabase.com/dashboard/project/vfngxjsryklqldarkxhy/auth/oauth-server): enable OAuth 2.1 server, with **Authorization Path** `/oauth/consent`. Before launching clients, a tested consent page **must** be implemented at the Site URL + this path. Do **not** enable unrestricted dynamic registration/public launch until this exists and permissions are approved.
4. [Authentication → URL Configuration](https://supabase.com/dashboard/project/vfngxjsryklqldarkxhy/auth/url-configuration): check the Site URL. **Caution:** this project is shared with CamMicGo Community. Changing the global Site URL can break Discord/community login. Prefer a dedicated Supabase Auth project for a public launch if different sites need different consent origins, or coordinate both apps carefully.
5. [Authentication → Providers → Google](https://supabase.com/dashboard/project/vfngxjsryklqldarkxhy/auth/providers): optional Google sign-in to Supabase itself. Add its **Supabase** callback `https://vfngxjsryklqldarkxhy.supabase.co/auth/v1/callback` in the Google Cloud OAuth Web client. **This is different** from CamMicGo's existing `https://seo.cammicgo.com/api/auth/google/callback` used for GSC/GA4 scopes; do not replace one with the other.
6. For first tests, **pre-register** an OAuth MCP client in OAuth Server and require explicit approval. Enable dynamic client registration only after security review and an operational consent page.
7. [Authentication → JWT Signing Keys](https://supabase.com/dashboard/project/vfngxjsryklqldarkxhy/auth/jwt-keys): prefer asymmetric JWT signing (RS256/ES256) for OAuth/OIDC. Changing signing keys needs a staged migration because the Supabase project is shared.
8. Set Vercel **`MCP_OAUTH_ISSUER=https://vfngxjsryklqldarkxhy.supabase.co/auth/v1`**. Keep `ENABLE_SUPABASE_MCP_AUTH=false` until consent + account-bound Google link + quotas are tested. With flag enabled, the route only reports identity/status; **it still cannot read private Google metrics**.
9. Validate discovery: `https://vfngxjsryklqldarkxhy.supabase.co/.well-known/oauth-authorization-server/auth/v1`. CamMicGo protected-resource metadata at `https://seo.cammicgo.com/.well-known/oauth-protected-resource` is only published when the MCP feature flag is on.

## Remaining development before GA4/GSC tools can be exposed to agents
- Implement Supabase Auth login/session in the CamMicGo site and `/oauth/consent` UI (approve/deny with exact client, redirect URI and scopes), preserving shared project's existing login.
- Authorize each Google connection to `auth.users.id`, encrypt Google refresh tokens server-side and persist in `cmg_private.google_connections`. No raw Google credentials in MCP bearer/JWT.
- Bind each chosen Search Console site and GA4 property to that account and verify access before every tool call. Never trust identifiers from an agent request alone.
- Implement atomic per-account daily counters shared with dashboard and MCP, with 429 after quota. Apply token revocation and client scopes. Wire an endpoint for disconnect.
- Test multi-user isolation, OAuth discovery/registration, refresh, expiration and revocation with real ChatGPT/Claude clients before enabling public beta.

Official instructions: https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication and https://supabase.com/docs/guides/auth/oauth-server/getting-started .
