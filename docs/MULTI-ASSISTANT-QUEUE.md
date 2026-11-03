# Multi-assistant queue and Android activity feed

## Why the current counter is misleading
`deviceProgress(userId)` in `lib/device-relay.ts` groups transcript jobs created less than 10 minutes apart, with a six-hour lookback. It does not identify a batch or its requesting assistant. The Android app displays the resulting `done / total` as if it were the current request. Completed channel exports are tracked separately. NotebookLM jobs are a different table and do not appear in that counter.

## Desired behavior
One paired Android device may service jobs from ChatGPT, Claude, Gemini CLI, Codex and other MCP clients. Show a small vertically scrollable activity list (maximum visible height, e.g. four rows), with each item displaying:
- assistant name and independently generated connection label
- operation type (YouTube transcription, NotebookLM notebook/source/research/quiz/audio/video etc.)
- short title, created time, status (queued/working/rate-limited/done/failed/cancelled)
- batch ID, batch progress, and a link to the output where applicable
- an expandable error message, with all UI strings localized through I18n

Show separate totals for **active queue**, **finished batches** and **history**; do not merge completed exports into the active queue. Allow filtering by assistant and operation. The app should refresh by polling the authenticated backend; never trust assistant-supplied status or display name as authorization.

## Identity and pairing: crucial distinction
Current `cmg_pairing_codes` / `cmg_devices` model binds a **physical device** to a user. A pairing code does not currently identify an assistant; re-pairing a device is not a sound way to create independent assistant identities.

Add `cmg_assistant_connections` (user_id, id, display_name, client_kind, created_at, revoked_at, token_hash or OAuth session ID). Issue a separate one-time assistant connection code/token, independent of Android device pairing. Bind every MCP request to its authenticated assistant connection ID. The server, not the client payload, stamps this identity on each job. A user may rename/revoke a connection without revoking the Android device.

For remote MCP, OAuth session / client attribution must be verified; where a client cannot be identified reliably, label it "Unknown assistant" rather than guess ChatGPT or Claude. For local stdio, a configured client connection credential is required. Never expose raw tokens in the Android activity feed.

## Job data model
Prefer one normalized `cmg_activity_jobs` view/table spanning transcript and NotebookLM tasks, with `user_id`, `assistant_connection_id`, `batch_id`, `kind`, `operation`, `title`, `status`, `created_at`, `claimed_at`, `completed_at`, `expires_at`, `result_ref` and `error`. Keep existing transcript and notebook tables as sources of truth during migration; backfill existing jobs with null connection ID ("Unknown assistant"), never assign a guessed origin. An immutable `batch_id` groups requests even if they arrive minutes apart.

Ensure the same request's idempotency key cannot create duplicate jobs; distinguish cached transcript reuse from a newly executed extraction. Cancellation must be authorized per owner and avoid deleting completed transcript archives. Use atomic claims and fair scheduling across assistants so a 700-video batch does not starve a notebook operation. Rate-limit YouTube separately from NotebookLM work.

## API / APK
- `GET /api/devices/activity?cursor=...`: scoped by paired device owner, paginated, returns active jobs first and bounded history; no secrets, transcript bodies, or sensitive provider cookies.
- `GET /api/devices/activity/summary`: accurate active counts, completed exports, and per-batch counters; server timestamps and cache-control no-store.
- `POST /api/assistant-connections`: authenticated creation/rename/revoke, subject to account authorization and CSRF protections.
- `POST /api/activity/{id}/cancel`: owner-only, idempotent, non-destructive to completed exports.
- Android: a scrollable RecyclerView in the "Assistant" tab, with assistant name, operation, status, progress and last update; no fake progress. Refresh while connected, display stale/offline state.
- Preserve all 11 languages; add a11y content descriptions and proper long-list recycling.

## Validation
1. Connect ChatGPT and Claude separately to the same account, pair one Android phone once.
2. Submit a 3-video batch from ChatGPT and a notebook-create request from Claude. Verify both labels, distinct batch IDs and no cross-attribution.
3. Ensure active queue counters exclude old completed batches; historical 4/25 is not shown as current 3/3.
4. Revoke Claude connection and verify its new submissions fail while ChatGPT and the device remain connected.
5. Test 429 cooldown, offline/reconnect, duplicate requests, job expiry and cancellation.
6. Run typecheck/lint/Android build and integration tests before merging or releasing.
