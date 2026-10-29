# CamMicGo SEO Agent — local MCP installation

This guide covers Windows PowerShell, Linux Bash and macOS Terminal. The local MCP is a **stdio process**, not a website or a Vercel deployment. [Interactive installation guide](https://seo.cammicgo.com/setup/local) · [Google Cloud API catalog](https://seo.cammicgo.com/setup/google-cloud).

## 1. Check prerequisites

| Windows PowerShell | Linux / macOS Bash |
|---|---|
| `git --version` | `git --version` |
| `node --version` | `node --version` |
| `npm --version` | `npm --version` |
| `yt-dlp --version` | `yt-dlp --version` |

Node must be **22 or newer**. A missing command or an old Node version requires installation.

### Windows (PowerShell)

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id yt-dlp.yt-dlp -e
```

Restart PowerShell, then rerun the four version checks. If `winget` is missing, use [Git](https://git-scm.com/downloads/win), [Node.js](https://nodejs.org/en/download) and [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases) directly. Check `node --version` after installation; the LTS channel can change.

### Linux (Bash)

For Ubuntu/Debian, Git and pipx can be installed using apt. For Node 22+, use the official Node.js download or a Node version manager rather than assuming your distribution's `nodejs` package is recent enough.

```bash
sudo apt update
sudo apt install -y git python3 pipx
pipx ensurepath
pipx install yt-dlp
```

Open a new shell and verify `yt-dlp --version`. Install Node.js 22+ from [nodejs.org](https://nodejs.org/en/download) or an appropriately configured version manager; verify `node --version` and `npm --version`. Other Linux distributions use their own package manager. [Official yt-dlp instructions](https://github.com/yt-dlp/yt-dlp#installation).

### macOS (Terminal)

Install [Homebrew](https://brew.sh/) first if `brew --version` fails; use its official installer instructions. Then:

```bash
brew install git node@22 yt-dlp
```

Homebrew's `node@22` may be keg-only: follow the printed PATH instructions and verify `node --version`. Apple Command Line Tools may be requested during installation.

## 2. Clone the project and install dependencies

Same commands on all three systems:

```bash
git clone https://github.com/CamMicGo/cammicgo-seo-agent.git
cd cammicgo-seo-agent
npm install
```

This is a GitHub source installation. **No verified `npx cammicgo-seo-agent` package or native installer has been published.**

## 3. Configure your own Google Cloud project

1. [Create a project](https://console.cloud.google.com/projectcreate). You can use one Google account to own the project and another Google account to sign in later.
2. Open [API Library](https://console.cloud.google.com/apis/library) and enable only the services you need:
   - [Search Console API](https://console.cloud.google.com/apis/library/webmasters.googleapis.com) — sites and search performance.
   - [Analytics Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com) — GA4 reporting.
   - [Analytics Admin API](https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com) — list GA4 properties.
   - [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) — channels, uploads, video metadata; your own project's quota.
   - [Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com) — calendar events.
   - [Google Ads API](https://console.cloud.google.com/apis/library/googleads.googleapis.com) — **not implemented** in the local MCP; requires separate developer token/approval.
3. Complete [Branding](https://console.cloud.google.com/auth/branding) and [Audience](https://console.cloud.google.com/auth/audience). For an External app in Testing, add each Google account you will sign in with as a test user. A personal account can be a test user even if the project owner is a work account. The personal account must independently have access to the GSC sites, GA4 properties or calendars queried.
4. Open [Clients](https://console.cloud.google.com/auth/clients), create an **OAuth client ID → Desktop app**, and download the JSON file. Its `installed.client_id` and `installed.client_secret` are imported by the setup wizard. Do not publish or paste the JSON into chat.
5. Desktop OAuth uses a loopback callback on `127.0.0.1:38271`; it is **not** the hosted Web OAuth callback. You do not need to create a separate web OAuth client for local MCP.

**OAuth security:** Google's Testing-mode refresh tokens can expire after a short period for non-basic scopes; if login stops working, run `npm run local:login` again. Local token files are encrypted on disk with a locally stored key, not the OS keychain.

## 4. Guided installation and Google sign-in

```bash
npm run install:local
```

The wizard imports your Desktop OAuth JSON, opens your browser for consent, verifies Google access, and offers to configure **Claude Desktop**, **Cursor**, or **Gemini CLI**. Run `npm run local:doctor` to check installation.

If your `.env.local` already exists, the installer preserves it; it may contain settings from the local web dashboard rather than Desktop OAuth credentials. Follow the wizard messages carefully and back up the file before deliberately replacing it.

## 5. Connect an AI desktop client

The guided wizard can write the user-level MCP config for supported clients. Alternatively:

```bash
npm run agent:setup -- claude
npm run agent:setup -- cursor
npm run agent:setup -- gemini
```

Each command configures **one** client, preserving other settings and making a backup. Restart the desktop client afterward. A compatible custom MCP stdio agent can launch the absolute path to Node.js with arguments `/absolute/path/to/cammicgo-seo-agent/scripts/local-mcp.mjs` and `stdio`. No Google secrets belong in the AI client's config.

**ChatGPT:** compatibility depends on the ChatGPT client and its available local MCP support; this repository does not automatically register the local server in ChatGPT. **Claude web/mobile:** a remote cloud connector does not automatically reach a local stdio MCP. **Gemini:** the installer targets Gemini CLI, not the Gemini mobile app.

## 6. Test YouTube captions

```bash
yt-dlp --version
node scripts/local-youtube-transcript.mjs Lxkb4gd041I
```

This invokes a local extractor and prints time-coded JSON if captions are available. It may fail when YouTube restricts the video or subtitle tracks. Google OAuth does not bypass YouTube anti-bot restrictions. The local MCP exposes `youtube_get_transcript` to connected AI clients. It accepts a YouTube URL or 11-character video ID and a language such as `en` or `fr`. It uses local `yt-dlp`, does not use YouTube Data API quota, and may fail for unavailable captions.

## 7. Verify and update

```bash
npm run local:doctor
npm run test:mcp:local
git pull
npm install
```

For a manual MCP stdio launch, run `npm run mcp:local`. It stays attached to stdin/stdout and is normally launched by your AI client rather than kept open in a terminal.

Do not share `.env.local`, OAuth client JSON, local token files or refresh tokens. For supported tools and limitations see [the repository README](../README.md).

### Android and remote YouTube transcript experiments

The website does **not** offer a downloadable Android APK or a published browser extension yet. Chrome on Android does not support ordinary desktop Chrome extensions. An Android companion would need an explicit, user-authorized pairing with the remote MCP account, secure short-lived credentials, a device-side caption extractor, and an audited relay. Do not expose the local MCP stdio process to the public internet or share Google OAuth refresh tokens. Local Windows/Linux/macOS MCP with `yt-dlp` is the supported test path.
