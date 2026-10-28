# Supabase OAuth Server → CamMicGo remote MCP: implementation checklist

Status (2026-10-28): Supabase OAuth Server enabled by project owner in `cammicgo-community`; **authorization UI is not implemented** and remote Google tools are intentionally restricted. The OAuth screen in Supabase is configuration, not a completed ChatGPT/Claude connection.

## Configuration already shown in Supabase

- Project: `vfngxjsryklqldarkxhy` (CamMicGo Community).
- Site URL: `https://seo.cammicgo.com`.
- Authorization Path: `/oauth/consent` → `https://seo.cammicgo.com/oauth/consent`.
- Dynamic OAuth Apps: disabled; leave disabled until consent screen and abuse controls are tested.
- OAuth Server enabled. Supabase handles OAuth 2.1 code/PKCE issuance, but CamMicGo must still authenticate users and implement consent handling.

## What the frontend MUST implement before public agent access

1. Secure sign-in using **Supabase Auth**, separate from the current Google browser session. Preserve the `authorization_id` across sign-in redirects.
2. Use `supabase.auth.oauth.getAuthorizationDetails(authorization_id)` to retrieve **verified** client identity, redirect URL and requested scopes.
3. Display requesting client, scope descriptions and a clear choice. Never trust `client_name`/scopes from arbitrary URL parameters.
4. Only call `approveAuthorization(authorization_id)` upon a real authenticated user click; support `denyAuthorization(authorization_id)`. Redirect to the URL returned by Supabase, never to an arbitrary URL parameter.
5. Authenticate and verify each bearer token at the MCP endpoint, with issuer and audience validation; define separate scopes for read-only Google data and optional writes.
6. Connect Supabase account IDs to encrypted Google credentials in `cmg_private.google_connections`, verify property access, implement revocation and atomic shared daily quota enforcement for MCP + web before enabling private Google tools.
7. Test ChatGPT, Claude and Gemini clients with PKCE, refresh, denied consent, revoked accounts, expired tokens, cross-user isolation, quota exhaustion and redirect validation.

**Do not set** `ENABLE_SUPABASE_MCP_AUTH=true` as a production shortcut to private Google tool access. The current guarded branch supports only service status and identity.

## The local mode is independent

`npm run setup:local`, `npm run local:login` and `npm run mcp:local` use the user's Google Cloud OAuth client and local machine. Local stdio MCP does not depend on this Supabase OAuth server or hosted quotas, but still obeys Google service quotas.

Official docs: https://supabase.com/docs/guides/auth/oauth-server/getting-started
