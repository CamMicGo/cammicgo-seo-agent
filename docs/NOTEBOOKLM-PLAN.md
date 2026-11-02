# NotebookLM personal — implementation status and security plan

This feature is **experimental and not connected to NotebookLM yet**.

## Implemented in this branch
- `lib/notebooklm-transcript-batches.ts`: deterministic Markdown batches grouped by stable channel ID and UTC year/month, including video metadata, URLs and timestamps.
- `tests/notebooklm-transcript-batches.test.ts`: tests for ordering, deduplication, period grouping and oversize handling.
- No Google session or NotebookLM account required for these operations.

## Required before an end-to-end release
1. Audit existing Android APK and desktop relay repositories; do not assume this repository contains their source.
2. Verify NotebookLM personal account terms and whether any secure, authorized source update mechanism exists. **Do not** collect browser cookies through the Kamigo website or store them in Supabase/Vercel.
3. Prototype user-initiated notebook creation/import locally, only if a compliant authentication method can be demonstrated.
4. Extend existing Android and desktop components rather than shipping another mandatory app; test Android background limitations.
5. For remote MCP, route authenticated jobs to an explicitly paired local device, enforce user/device authorization, expiration, replay protection and bounded queues.
6. Build channel subscription state and scheduled discovery. New videos should be deduplicated by YouTube video ID; transcript updates should be detected by a content hash and stored as versions.
7. Keep source limits configurable; grouping by words does **not** guarantee NotebookLM ingestion. Verify actual limits, citation quality and update behavior.
8. Document manual Markdown/Drive export as fallback if NotebookLM personal automation is unavailable.
9. Add integration tests for NotebookLM only after a user account is connected and has explicitly authorized a test notebook.

**No claim is made that this branch already creates notebooks, monitors channels or updates NotebookLM.**

## Current local MCP prototype (not yet deployed)
The local MCP now exposes `notebook_export_youtube_markdown`, accepting `videos` (1–25 YouTube IDs/URLs), optional `title`, `language` and `maxWords`. It calls the existing local caption extractor and writes `.md` files under `~/.cammicgo-seo-agent/notebooklm-exports/`. Output includes file paths, video IDs, SHA-256 digests and per-video errors. There is no NotebookLM login, account creation, or import automation yet.

Example request to a local MCP client: "Use notebook_export_youtube_markdown with videos [https://www.youtube.com/watch?v=abcdefghijk], title My channel." The ID above is a placeholder; use a real public video with captions.

Tests added: `node --test tests/notebooklm-local.test.mjs`. Existing TypeScript batch tests can be run using `node --experimental-strip-types --test tests/notebooklm-transcript-batches.test.ts`. These tests have not been executed by this assistant.

## Android pilot: no second app required for the manual path
The official Gemini Notebook Android app is optional for reading and chatting. For a first import of `.md`, the **browser desktop interface** is preferable because the Android app's supported source types are narrower. An Android user can use the browser's desktop-site option where available, or copy text as a source. Do not claim that Kamigo Android already supports NotebookLM: its APK repository/build must be located and audited first.

## Important sync caveat
Importing a Markdown file as a NotebookLM source does not guarantee that editing the file later refreshes the source automatically. Until a tested, permitted update mechanism exists, return `notebookCreated:false` and never claim automatic sync.
