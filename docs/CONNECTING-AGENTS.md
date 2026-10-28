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
