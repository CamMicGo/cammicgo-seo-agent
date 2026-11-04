# Multilingual caption regression: Nick Saraev AI VTuber

- Video: https://www.youtube.com/watch?v=U3BAkWPA2gw
- Title: The Biggest Faceless Content Opportunity: AI Vtuber Avatars
- Duration: approximately 9m17s (check against live metadata)
- Reporter observation: English narration alternates with Japanese AI character voice; some English translation may be burned into the video rather than provided as YouTube captions.
- Source: user screenshot (2026-11-04) and public video metadata.

## Retest on Android device

1. Run availableTracks(videoId) and log all real language codes, manual/ASR status, and original track.
2. Fetch original, English and Japanese tracks separately where available; record language, translatedFrom, captionCoveragePercent and captionGaps for each.
3. Compare long gaps (>=12 s) against playback, especially around the Japanese dialogue. Gaps alone do not establish missing speech: music and silence are possible.
4. Check whether the English translation is selectable as a YouTube caption or is burned into video frames. Do not label OCR/audio fallback as supported until implemented.
5. Verify no transcript is marked complete solely because one track returned nonempty segments.

## Known limitation

The current extractor retrieves YouTube caption tracks. It does NOT perform speech-to-text on audio or OCR on video frames. These require separate fallback implementations and user permission/technical feasibility checks.
