# Default workflow — YouTube videos to NotebookLM (CamMicGo MCP)

Status: **default operating procedure** for multi-video NotebookLM imports. This is an orchestration policy for MCP clients, not a claim that a new server-side automatic batch tool exists.

## Trigger
When a user asks to import two or more YouTube videos into NotebookLM, prefer **one grouped transcript Markdown source and one grouped metadata / timestamp index source** over one NotebookLM source per video. Do not import individual YouTube URLs by default.

## Workflow
1. Discover videos using `youtube_search_videos`, then validate titles, publication dates, IDs and views with `youtube_video_details`. Never claim global top-viewed ranking without checking the candidate set.
2. Call `youtube_get_transcript` with `format: "segments"` and original language for each selected video. For pending jobs use `youtube_transcript_status`; respect device pauses and HTTP 429; never retry in a tight loop. Report missing captions rather than inventing them.
3. Build `transcriptions.md`: one section per video with stable video ID, title, channel, date, language, original YouTube URL and timestamped segments. Each segment gets a stable marker `[VIDEO_ID@START_MS]` and a clickable `https://www.youtube.com/watch?v=VIDEO_ID&t=SECONDSs` URL. Keep original language and spoken wording; do not silently translate or normalize away content.
4. Build `index.md` (preferred NotebookLM second source) with one row per video and a compact segment locator table. Optionally also create `index.json` in Drive for machine lookup; **do not import JSON as a third NotebookLM source** unless explicitly requested. Include video metadata, segment IDs, start/end milliseconds, source links, language, transcript method and extraction status.
5. Use `drive_upload_file` (convertToGoogleDoc where suitable) or `source_add_text` to import the two sources. Split into more sources only when documented source size/ingestion limits require it; report the resulting count. Never upload incomplete content as though it were complete.
6. Verify with `source_list` that both sources are READY. Ask sample questions with `notebook_query` and validate cited passage locations against the local index and, when available, `source_search`. Distinguish NotebookLM's generated answer from raw transcript excerpts.
7. If an existing notebook already has per-video sources, **do not delete them** until both grouped sources are verified and the user has explicitly approved destructive removal of the originals.
8. Return a notebook link, source counts, extraction errors, and timecoded YouTube links for verified passages. Do not invent timestamps or claim citations verified when `citationsVerified` is false.

## Failure / fallback
If a paired device is paused, offline, or YouTube returns HTTP 429, stop extraction and preserve the existing NotebookLM sources. Resume only after the device has recovered or the user confirms a retry. Do not replace an existing working notebook with partial exports.

## Acceptance checks
- Stable video ID and original-language transcript for every successful extraction.
- Each imported segment has a traceable source video and timestamp.
- Two READY NotebookLM sources for the grouped import when size permits.
- No silent source deletion, duplicate IDs, invented passages, or unverified timestamp links.
