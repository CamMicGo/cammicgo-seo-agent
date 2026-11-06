# `cammicgo` — command line and local MCP

`cammicgo` runs CamMicGo **on your computer**: NotebookLM (the full toolset of the Android app), YouTube transcripts, scientific search and, after `npm run install:local`, your read-only Google data. Use it from a terminal, or from any AI tool that speaks MCP: VS Code (Copilot agent mode), Claude Desktop, Claude Code, Cursor, Windsurf, Gemini CLI.

Everything runs locally with **your own sessions**: no CamMicGo account, no Vercel, no Supabase. NotebookLM cookies are only sent to `notebook.google.com`.

## Install (Windows PowerShell, macOS or Linux)

Requirements: **Node.js 22+**, Git, and Google Chrome (or Chromium / Microsoft Edge).

```bash
git clone https://github.com/CamMicGo/cammicgo-seo-agent.git
cd cammicgo-seo-agent
npm install
npm link            # makes the "cammicgo" command available everywhere
cammicgo doctor
```

## Sign in once

```bash
cammicgo login
```

A Chrome window opens with a **dedicated profile** (`~/.cammicgo-seo-agent/chrome-profile`, separate from your usual Chrome). Sign in to your Google account on NotebookLM; the window closes by itself. The session is stored encrypted (AES-256-GCM) in `~/.cammicgo-seo-agent`. When Google's short-lived cookies age out, `cammicgo` refreshes them in the background from that profile; run `cammicgo login` again only if you signed out.

## Connect your AI tools

```bash
cammicgo setup vscode        # VS Code: Copilot Chat → Agent mode → tools → "cammicgo"
cammicgo setup claude        # Claude Desktop (quit and reopen it)
cammicgo setup claude-code   # Claude Code (uses "claude mcp add")
cammicgo setup cursor        # also: windsurf, gemini, vscode-insiders
cammicgo setup all
```

Each tool then launches `cammicgo mcp` by itself. Existing config files are backed up (`.bak`) before the `cammicgo` entry is added.

## Terminal commands

A notebook can be given by its URL, its ID or (part of) its title.

| Task | Command |
|---|---|
| List / inspect | `cammicgo notebook list` · `cammicgo notebook get "Marketing"` |
| Create / rename / delete | `cammicgo notebook create "Veille SEO"` · `rename <nb> "<title>"` · `delete <nb>` (asks you to type the title) |
| Ask | `cammicgo ask "Veille SEO" "Quelles tendances ressortent ?"` (`--conversation <id>` to continue) |
| Sources | `cammicgo source list <nb>` · `source add <nb> <url>` · `source add-text <nb> "Titre" notes.md` · `source content <nb> <id> --out texte.txt` · `source search <nb> "requête"` · `source delete <nb> <id>` |
| Studio | `cammicgo studio create <nb> audio --focus "…"` · `video --style whiteboard` · `slide_deck` · `quiz` · `report --format "Study Guide"` · `infographic` · `data_table` · `mindmap` |
| Follow / download | `cammicgo studio status <nb>` · `cammicgo download <nb>` · `cammicgo download --all-notebooks` → `~/CamMicGo/NotebookLM/<notebook>/` |
| Chat, notes, research | `cammicgo chat export <nb> --out chat.md` · `note list <nb>` · `note add <nb> "Titre" note.md` · `research start <nb> "requête" [--deep]` · `research status <nb>` |
| YouTube | `cammicgo yt transcript <url> [--lang fr] [--out t.txt]` · `cammicgo yt to-notebook <url> <nb>` |
| Quota | `cammicgo usage` |

Add `--json` to any command for raw JSON (scripts, CI).

## MCP tools (same names as the remote server)

`notebook_list`, `notebook_get`, `notebook_create`, `notebook_rename`, `notebook_describe`, `notebook_delete_preview`, `notebook_delete`, `usage_get`, `source_list`, `source_add`, `source_add_text`, `source_add_drive`, `source_describe`, `source_get_content`, `source_search`, `source_list_drive`, `source_sync_drive`, `source_rename`, `source_delete`, `studio_create`, `studio_status`, `studio_get`, `studio_revise`, `studio_delete`, `export_artifact`, `mindmap_create`, `download_artifact_link`, `download_artifact`, `download_all_artifacts`, `notebook_query`, `cross_notebook_query`, `chat_configure`, `chat_get`, `chat_list`, `chat_export`, `chat_save_to_note`, `chat_delete`, `note`, `notebook_share_status`, `notebook_share_public`, `notebook_share_invite`, `notebook_share_batch`, `research_start`, `research_status`, `research_import`, `collection_list`, `collection_create`, `collection_edit`, `collection_delete`, `youtube_transcript_to_notebook`, `notebooklm_session` — plus the existing local tools (YouTube transcripts, science, Search Console, GA4, YouTube Analytics, Calendar).

Unlike the remote server, the answers come back directly (no job to poll) and `download_artifact` saves the file on your computer.

**Safety.** Deleting (notebook, source, Studio artifact, note, chat, collection) and sharing (public link, invitations) always take two steps: the first call returns a preview and a `confirmationToken`; the assistant acts only after your explicit yes in a new message. The token is bound to the exact action, unusable for 10 seconds and valid 15 minutes.

## Environment variables

| Variable | Use |
|---|---|
| `CAMMICGO_CHROME` | Path of the browser if it is not found automatically |
| `CAMMICGO_HOME` | Where sessions and keys are stored (default `~/.cammicgo-seo-agent`) |
| `CAMMICGO_EXPORT_DIR` | Download folder (default `~/CamMicGo/NotebookLM`) |
| `CAMMICGO_LANG` | NotebookLM interface language for requests (default `fr`) |

NotebookLM has no public API: CamMicGo uses its private web interface (protocol partly ported from [jacob-bd/notebooklm-mcp-cli](https://github.com/jacob-bd/notebooklm-mcp-cli), MIT). Google can change it without notice.
