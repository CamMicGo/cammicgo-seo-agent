# NotebookLM Studio integration — implementation contract

## Existing code / constraints
- CamMicGo remote MCP: Next.js/Vercel + Supabase, paired Android app.
- Android NotebookClient currently implements only list/create through NotebookLM's undocumented batchexecute RPC. No source, research, quota, Studio generation or artifact retrieval endpoint is exposed yet.
- Jacob reference: https://github.com/jacob-bd/gemini-notebook-mcp-cli
  - src/notebooklm_tools/mcp/tools/research.py: research_start/status/import
  - src/notebooklm_tools/mcp/tools/sources.py: source_add, source_get_content
  - src/notebooklm_tools/mcp/tools/studio.py: studio_create
  - src/notebooklm_tools/mcp/tools/usage.py: usage_get
  - src/notebooklm_tools/mcp/tools/downloads.py: download_artifact
  - src/notebooklm_tools/mcp/tools/profiles.py: profile
- Jacob uses unofficial Google internal APIs. Do not send session cookies to Vercel/Supabase; keep Google browser session on paired local device. Validate against a user-authorized test notebook before enabling writes.

## End-to-end MCP contract
1. notebook_source_add(notebookId, source:{kind:'youtube_url'|'web_url'|'text'|'drive'|'file', ...}, wait): return source ID, processing state and provider error. Support a single YouTube URL as fallback while Android captions are throttled.
2. notebook_research_start/status/import: distinguish fast/deep web research and Drive discovery, return source references, publication metadata, DOI when available. No claim of independent scholarly agents; NotebookLM performs its own discovery.
3. notebook_usage_get(profile?): return provider-reported tier, rolling/weekly usage windows, percentages, UTC reset, and an explicit 'unknown' when provider data is unavailable. Never invent remaining quotas.
4. notebook_studio_create(notebookId, type, options): audio, video, slide_deck, mind_map, quiz, flashcards, infographic, report, data_table. Return async job/artifact ID, status, provider error and optional retry-after.
5. notebook_studio_status/notebook_artifact_get: poll completed artifact; return typed structured result to chat, plus a secure temporary download URL or a Drive export. For quiz include questions, options, correct answers and explanations; mind map JSON; slides PPTX/PDF; audio/video downloadable media; table CSV/XLSX. Preserve source provenance.
6. notebook_profiles: isolated local Google sessions and per-profile quotas. Do not silently switch a shared default account.
7. Both local stdio MCP and hosted streamable HTTP MCP expose the same tool schema; hosted requests dispatch to a user-authorized paired local worker with per-job authorization, bounded payloads, expiry, idempotency and status polling.

## Transcript archive must remain independent
- Preserve original-language timestamped segments (start, duration, text) as JSON/CSV, and a per-video catalog row with channel, author, publication UTC, title, video URL, language and transcript.
- Export batches as Markdown/Docs for NotebookLM, preserving stable source links and timestamps. Keep both direct YouTube URL import and transcript import; direct URL does not replace timestamped archival.
- When YouTube returns 429, pause extraction and do not retry aggressively. NotebookLM URL ingestion may work independently but is subject to its own limits.

## Android localization
- Never cache a final localized message across language changes; persist machine-readable status keys and arguments, render with I18n.t at display time.
- Translate all safety/cadence settings, error messages, NotebookLM statuses, quota warnings, and toast messages in all 11 app languages.
- This branch includes an initial fix for the active YouTube cooldown text; other status strings and hardcoded French cadence labels still require migration.

## Verification gates
- Unit tests: codec/typed payloads, language switching while paused, profile isolation, errors, quota unknown, artifacts.
- Device integration: source URL import, quiz generation and retrieval with answers, mind map JSON export, audio file retrieval, and quotas on a real authorized personal NotebookLM account.
- Build APK, run lint/typecheck, inspect CI and only then deploy/release. No production claims until these checks pass.
