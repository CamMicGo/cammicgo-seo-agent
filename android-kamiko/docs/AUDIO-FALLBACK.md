# Android audio fallback (experimental)

The Android relay currently obtains YouTube captions first. If caption retrieval fails (except HTTP 429 or transient network failures), it can now use the existing Qwen3-ASR model **only when** the relay job includes both:

- `audioAuthorized: true` — an explicit authorization that the media may be downloaded and processed.
- `authorizedAudioUrl: "https://…"` — a direct public HTTPS media resource, **not** a YouTube watch/player URL.

The APK streams at most 100 MiB to its private `cache/asr-relay/` directory, transcribes it in segments using LocalAsr, returns the timestamped `local_asr` result through the existing MCP job result endpoint, and deletes the media in a `finally` block. The model must already be installed. HTTP 429 and network errors retain their existing cooldown/retry logic.

## Not yet implemented

- YouTube does not provide an unrestricted public audio-download endpoint through its official Data API. This PR **does not** extract audio from YouTube watch URLs or bypass playback restrictions. A source of an authorized media URL and the corresponding server-side job fields are still required before automatic fallback from a normal YouTube link works.
- User-visible export to Downloads of relay-produced transcripts (the existing local file transcription UI already supports sharing).
- Device tests and APK compilation; these must be run before merging.

Do not claim this PR enables arbitrary YouTube audio downloads. It adds the bounded on-device media-processing step for an authorized direct media URL.
