# Transcription fallback — Android and MCP

The APK's second tab now offers three modes:
- **Auto:** YouTube captions first; Qwen for an explicitly authorized direct media file URL.
- **YouTube:** caption tracks only.
- **Qwen:** local speech recognition of a direct authorized HTTPS media file URL.

The existing Copy / Share / SRT / VTT / TXT / JSON / Markdown export controls are reused for successful transcripts.

The MCP `youtube_get_transcript` tool accepts optional `mode` (`auto`, `youtube`, `qwen`), `authorizedAudioUrl` (direct HTTPS audio/video media URL), and `audioAuthorized=true`. The paired Android relay receives these fields via the job queue after applying `supabase/migrations/20261110000100_transcript_audio_fallback.sql`.

A direct media URL is streamed into the app's private cache (100 MiB limit), processed with the installed Qwen3-ASR model, and deleted in `finally` after success, failure or cancellation. The timestamped result is sent through the existing MCP result channel and tagged `source=local_asr`.

## Limitations and rollout requirements

1. **YouTube watch pages are not media files.** The app does not download audio from an arbitrary YouTube watch URL or bypass access restrictions. A direct authorized media file URL must be supplied for Qwen. YouTube videos without captions and without such a file URL remain unsupported.
2. Apply the Supabase migration before deploying the server changes. Without the new columns, transcript jobs cannot be created.
3. Run the Next.js TypeScript checks, Android Gradle build, emulator/device tests and a full paired-device MCP request before merging. No successful build or APK is asserted by this PR.
4. Automatic transcription of a direct media URL in tab 2 uses the existing worker; long-running transcription should eventually be moved to the foreground TranscribeService for Android lifecycle robustness.
5. The relay and the APK must be updated together. Existing APKs ignore the new fields and continue retrieving captions.
