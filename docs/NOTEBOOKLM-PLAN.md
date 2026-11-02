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
