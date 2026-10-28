# Connect your AI agent — CamMicGo SEO Agent

> Status: **planning + technical preview**. The remote MCP at https://seo.cammicgo.com/api/mcp exposes only a public `service_info` tool until proper OAuth authentication and durable quotas are deployed. It **cannot yet retrieve your private Search Console or GA4 data**. Browser dashboard OAuth is a separate login and does not authenticate the remote MCP client. Do not present any of these instructions as a working private-data connector until OAuth for MCP and tools are deployed.

## Why two OAuth connections?

**Connection A — AI assistant → CamMicGo MCP.** Your assistant asks permission to call the service. Our authorization server must identify your CamMicGo account, give the AI client a short-lived access token for the proper audience/resource, and verify it on **every** MCP request. It must support OAuth 2.1 / PKCE patterns, discovery, client registration as required by clients, revocation, session security and refresh.

**Connection B — CamMicGo → Google.** After the user explicitly connects their Google account, the application obtains read-only Google Search Console and Analytics permissions. Those Google credentials are stored separately from the assistant's MCP token. An AI client **never receives** the Google refresh token.

Proposed flow: add MCP URL in assistant → assistant detects authentication → browser opens CamMicGo authorize screen → sign in or create account → select Google account and authorized properties → approve access for the AI client → the client receives its **own** scoped MCP token → agent invokes authorized tools.

Browser sign-in at /connect works for the preview dashboard; the flow above is NOT shipped yet.

## Hosted endpoint (preview only)

```text
https://seo.cammicgo.com/api/mcp
```

### Claude (remote)

Claude → **Customize → Connectors → Add custom connector** → name **CamMicGo SEO Agent** → URL above. Claude can discover the public `service_info` tool today. When our server supports MCP OAuth, choose **Sign in** and authorize your account. A remote connector is not the same as local desktop stdio.

### ChatGPT (remote)

On an eligible ChatGPT workspace, enable the supported MCP app/developer settings, create a custom app backed by the HTTPS MCP URL and finish OAuth authorization if offered. The UI and eligibility differ by account and plan; remote MCP support does not mean an arbitrary person can install a public plugin from a GitHub URL. An Apps SDK distribution/review flow may be needed for a broadly discoverable app. At present, only the public info tool is usable.

### Gemini CLI (remote)

Gemini CLI supports Streamable HTTP. A basic example for `~/.gemini/settings.json`:
```json
{
  "mcpServers": {
    "cammicgo-seo": {
      "httpUrl": "https://seo.cammicgo.com/api/mcp"
    }
  }
}
```
This currently discovers only `service_info`. Authenticated user data requires MCP OAuth implementation and an appropriate client configuration. Check the current Gemini CLI documentation for its supported OAuth configuration.

### Claude Desktop, Gemini CLI and Cursor — local stdio (source CLI now available)

The local server is now shipped as a Node.js source script (`scripts/local-mcp.mjs`) with read-only Search Console and GA4 tools. There is **no prebuilt executable installer** yet.

```bash
npm install
npm run setup:local
npm run local:login
npm run local:doctor
npm run agent:setup -- claude   # or gemini / cursor
```

Create your own OAuth **Web application** client in Google Cloud and register BOTH local redirect URIs: `http://localhost:3000/api/auth/google/callback` (web dashboard) and `http://127.0.0.1:38271/oauth/callback` (stdio login). The second is the actual loopback callback used by `local:login`. Restart the chosen agent afterward. The setup command writes its local server registration to the agent's configuration **without writing Google tokens or client secrets to that configuration**.

Agent JSON (when using a client that accepts this format):

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

The source CLI stores an encrypted Google token on the computer, using a key stored in the same private user directory; that is **not equivalent to native OS keychain security**. Signed packaged installers, native keychain integration and full cross-platform acceptance tests remain to be developed. This local MCP sends Google requests directly, not through CamMicGo Vercel.

## Security commitments

- User-scoped read-only Google scopes by default; never accept Google tokens pasted into prompts.
- Explicit property authorization on every tool invocation; deny cross-user access.
- Do not use the public `service_info` endpoint for private Google results.
- Logs should default to anonymized tool category, duration, cache hit, quota cost and HTTP status; **no raw search queries**, tokens, report contents, emails or secrets in telemetry.
- Provide revoke/disconnect, export/delete account settings and operational incident response.
- Apply privacy and security review before public availability.

## Official installation guides

- [Claude custom connectors](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities)
- [ChatGPT custom MCP servers](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)
- [Gemini CLI MCP servers](https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html)

## Bring your own Google Cloud project for local development

For a local Next.js browser dashboard (currently supported), follow the [README local Google Cloud OAuth setup](../README.md#local-google-cloud-oauth-byo-project-and-project-level-quota). Register `http://localhost:3000/api/auth/google/callback` in your own Google OAuth **Web application** client, set `APP_BASE_URL=http://localhost:3000`, and set Google client credentials and a separate session encryption key in `.env.local` (never commit them). Google calls use the local client's Google Cloud project for relevant project quotas, while Google's per-user/per-property restrictions continue to apply. This does **not** magically enable an authenticated local stdio MCP server; one is still not shipped. Hosted agent OAuth will be a distinct flow. Do not use the remote CamMicGo callback for a localhost project.

## Supabase OAuth Server: shared CamMicGo Community project warning

**Do not change the shared Supabase project's global Authentication → URL Configuration → Site URL to `https://seo.cammicgo.com` without auditing CamMicGo Community's existing login and redirects.** Supabase constructs the OAuth consent page from its *global Site URL* plus the configured Authorization Path. The current shared project's site URL may point to `https://www.cammicgo.com` with `/oauth/consent`, while this SEO app is served on `https://seo.cammicgo.com`; these are not interchangeable. Supabase does **not** generate a consent page. A real frontend must implement authenticated `getAuthorizationDetails`, explicit approve/deny, and redirect using Supabase Auth's OAuth server APIs. Keep dynamic OAuth application registration disabled until that UI, redirect validation, user-to-Google-account linking and shared quotas are complete and tested. Consider a dedicated Supabase Auth project for SEO if the main CamMicGo Site URL needs to remain independent. The `cmg_private` SQL data schema can remain isolated in the existing database; where the OAuth issuer lives is a separate deployment decision.

Official guidance: https://supabase.com/docs/guides/auth/oauth-server/getting-started

## Acceptance tests — October 2026: what can be tested today

**Local PC, with your own Google project:** install Node.js 22+, clone the repo, `npm install`, `npm run setup:local`, `npm run local:login`, `npm run local:doctor`, then `npm run agent:setup -- claude` (or `gemini` / `cursor`), and restart the desktop app. In the agent, ask it to list your authorized Search Console sites or GA4 properties. Google permissions are read-only. Never paste OAuth credentials into an AI chat. If setup reports missing Google Cloud redirect URIs, register both exact loopback callbacks described above.

**Claude Desktop:** local stdio connection on the computer. Look under Settings → Desktop app → Extensions (or the developer/local MCP section); the local script is **not** an `.mcpb` desktop extension. The local tool process and its private credential files remain on the same computer. [Anthropic local MCP guidance](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

**Gemini:** these commands target **Gemini CLI on a computer**, not the ordinary Gemini Android app. Install Gemini CLI separately and confirm `gemini` is available on PATH before running `npm run agent:setup -- gemini`.

**Cursor:** install Cursor on a computer and use `npm run agent:setup -- cursor`; inspect its MCP settings after restarting. Verify tool discovery before trusting analytics responses.

**ChatGPT:** the consumer Android app cannot add a local stdio MCP. Custom remote MCP integration is through eligible web workspaces, and requires our remote MCP OAuth authorization server and quota enforcement, **not yet complete**. See [OpenAI's current MCP connection requirements](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt).

**Claude mobile:** a successfully authenticated **remote** connector may work through Claude mobile, but a local `stdio` tool installed on a computer is not available in Claude mobile. The remote private Google connector is **not ready**.

**Remote MCP smoke test:** `npm run remote:doctor` checks reachability/transport only; it is not evidence that remote private Search Console/GA4 tools are authorized.

**Storage readiness:** `cmg_private` is installed in a Supabase project. The latest schema includes an optional `supabase_user_id` link and fields for encrypted Google credentials. Installing tables is not equivalent to completing consent/account linking: avoid enabling `ENABLE_SUPABASE_MCP_AUTH` for private Google tools until the linking, scoped authorization, encryption key rotation and atomic quotas have been tested.

## Test sur Android avec Claude — limites et séquence exacte

**Claude Desktop ne s'installe pas sur Android.** Utilisez l'application mobile **Claude** ou le site `claude.ai`. Les connecteurs MCP **distants** sont utilisables sur Claude mobile, mais ils se connectent depuis l'infrastructure d'Anthropic : un MCP local `stdio` sur un PC n'est pas accessible tel quel sur le téléphone.

1. Sur un PC (ou via le navigateur mobile si le compte propose cette option), ouvrez Claude → **Personnaliser → Connecteurs → Ajouter → Personnalisé → Web**.
2. Nom de test : **CamMicGo SEO Agent** ; URL : `https://seo.cammicgo.com/api/mcp`.
3. À ce stade, le serveur public n'offre que ses outils d'information ; **ne pas s'attendre à accéder aux données Google privées**. La finalisation des sessions Google côté serveur, OAuth du client MCP et quotas durables est indispensable avant un test réel.
4. Une fois le connecteur distant authentifié officiellement et les outils autorisés déployés, ouvrez Claude sur Android et sélectionnez le connecteur dans la conversation.
5. Demandez successivement : « Liste mes sites Search Console », « Liste mes propriétés GA4 », « Affiche les pages consultées et les pays des 28 derniers jours », « Liste les chaînes YouTube auxquelles j'ai accès », « Montre mes prochains événements Calendar ». Vérifiez que l'assistant identifie les propriétés sans inventer d'association entre sites et GA4.

**Autre parcours immédiatement disponible sur ordinateur :** créez un client OAuth de type *Application de bureau* dans votre projet Google Cloud, activez Search Console, GA4 Data/Admin, YouTube Data API v3 et Calendar API, puis utilisez `npm run install:local`, `npm run local:doctor` et `npm run agent:setup -- claude`. Cela installe le MCP local en lecture seule avec les quotas Google de votre projet. Reconnectez-vous avec `npm run local:login` pour consentir aux nouveaux scopes. Les outils locaux ne déclenchent aucune dépense publicitaire.

**Ne saisissez jamais votre client secret Google, refresh token ou un fichier JSON OAuth dans un message Claude/ChatGPT.** Les droits disponibles dépendent également de l'approbation des scopes Google et des propriétés réellement partagées avec votre compte.

## Remote-first rollout — October 2026

**Priority: remotely hosted MCP for ChatGPT and Claude, then self-hosted/local.** The live status page is `https://seo.cammicgo.com/dashboard/mcp` (once this revision is deployed). Our existing browser Google sign-in supports a user-supplied Google OAuth Web client, but that **does not** authorize an MCP client to query that user's data. The private MCP beta contains GSC and GA4 read tools; its experimental bearer delegation is not equivalent to OAuth 2.1 for ChatGPT or Claude and must not be exposed publicly.

For the intended flow, an AI client uses authorization-code + PKCE to obtain a **CamMicGo resource-scoped token**; the user is identified by the server, sees the requested properties and grants, then separately links Google with their own OAuth client or the shared CamMicGo project. The server must store Google refresh tokens encrypted under a per-account record, check property ownership at request time, and atomically account for daily usage shared with the browser dashboard. A BYO GCP project shifts the applicable Google **project** quota to that project for calls made with that client's authorization; Google per-site, per-user and GA4 property quotas remain in force. Never put a Google client secret in an AI conversation or embed it in MCP tool arguments.

**Client availability caveat:** ChatGPT custom MCP app setup is web-only in OpenAI's current documentation, so phone-only ChatGPT testing cannot be promised. Claude mobile remote connector behavior depends on account and current support. Calendar and YouTube read tools currently exist in the local source server; remote OAuth and opt-in permissions for those tools are not shipped. Google Ads Keyword Planner and real ad mutations remain unimplemented pending API access and explicit spend protections.

### Deployment gates before remote account testing

- OAuth resource metadata and working authorization server endpoints with registered/verified AI clients, PKCE, token audience and revocation.
- Web-to-MCP consent UX, persistent user-to-Google connection linking and BYO OAuth server storage with cryptographic isolation.
- Verified Supabase credentials on Vercel (never in GitHub), private-schema access, durable shared quota limit and audit logging without raw tokens.
- Integration tests with two separate Google users, denied cross-account access, quota exhaustion and OAuth refresh/revoke paths.
- Real end-to-end connection tests on supported clients before announcing availability.

## Supabase OAuth 2.1 configuration for remote MCP (operator checklist)

The shared CamMicGo Supabase project is `vfngxjsryklqldarkxhy`. Its PostgreSQL private schema `cmg_private` and production Vercel environment variable names have been prepared, but **the browser consent screen, verified Google account linking and shared per-user usage enforcement are not yet connected**. The flags `ENABLE_SUPABASE_MCP_AUTH` and `ENABLE_MCP_BETA` must remain disabled until these gates pass.

1. Open [Supabase Auth OAuth Server](https://supabase.com/dashboard/project/vfngxjsryklqldarkxhy/auth/oauth-server). Enable the OAuth 2.1 authorization server (currently a beta feature). Configure a **custom user consent page** on our site once the page has been implemented. Do not turn on registration for untrusted clients until redirect validation, consent and revocation controls have been verified. Supabase has an [official MCP OAuth guide](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication).
2. Enable a secure authentication method for users (e.g. Google social sign-in or email). **Supabase user sign-in is separate from Google's Search Console/Analytics OAuth permissions**, even if both are presented by Google.
3. Our protected-resource metadata already lives at `/.well-known/oauth-protected-resource`; when the feature flag is enabled it identifies Supabase Auth as the authorization server. A standards-compliant remote MCP client should obtain a **Supabase OAuth access token** with the CamMicGo MCP resource audience. Validate the issuer, audience, expiry, client identity and requested scope on every invocation.
4. Connect each Supabase Auth user to their Google account **server-side** in `cmg_private.google_connections` with encrypted credentials and a revocation path, and check each selected Google site/property before every request. The user's BYO Google Cloud Web client may be used, but the Google OAuth client secret must never be sent to an MCP model/tool call or stored in plaintext.
5. Wire quota charging into an atomic database transaction used by *both* the browser data routes and MCP data routes; report real remaining quota. The existing `/api/usage` is explicitly proposal-only and must not be represented as enforced.
6. Test with at least two independent user accounts, a denied cross-account access attempt, revoked OAuth grants, expired/rotated tokens, exceeded quotas, and the actual ChatGPT/Claude MCP connector handshakes. Enable production flags only after all these checks pass.

**Current limitations:** Supabase Auth's OAuth 2.1 server is not activated automatically by enabling the API in Google Cloud. We cannot claim that a Google browser cookie authorizes a third-party MCP client. ChatGPT's *custom MCP app creation* is documented as **web-only**, not a mobile-phone installation flow: [OpenAI guide](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt). Claude remote connector behavior should be confirmed on the intended account and mobile app. Once configured on the web, cross-device usage needs separate client validation.
