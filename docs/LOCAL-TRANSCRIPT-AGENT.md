# CamMicGo local transcription agent — prototype

This is a **developer proof of concept**, not an installer or a background agent.

## Test on Windows, macOS, Linux
Install Node.js 22+ and [yt-dlp](https://github.com/yt-dlp/yt-dlp) (and ensure `yt-dlp` is on PATH). From the repository run:

```sh
node scripts/local-youtube-transcript.mjs Lxkb4gd041I
```

The command downloads **subtitle files only**, never video or audio. It outputs JSON with timestamped segments to stdout. It does not require a Google account and does not send Google cookies or credentials to CamMicGo. Availability depends on YouTube restrictions and whether captions exist. Do not upload private transcripts without consent.

## Planned product architecture (NOT YET IMPLEMENTED)
- Pair each installed agent to an authenticated CamMicGo account using a short-lived device code and explicit approval; store only revocable per-device credentials.
- Poll a per-user authenticated HTTPS job queue, with bounded job TTL and no arbitrary shell commands; agent accepts only validated YouTube IDs.
- The remote MCP tool routes only to an explicitly selected online device and reports offline/timeout failures without claiming success.
- Encrypt data in transit, limit transcript size, and avoid storing transcript content unless necessary; allow revocation and deletion.
- Desktop packages for Windows/macOS/Linux; separate Android app with foreground execution; iOS requires a separate feasibility review due to background limits.
- Use user-owned Google Cloud OAuth for eligible official API calls; do not silently use CamMicGo's shared quota. Official captions.download does not grant access to arbitrary public videos.

**Do not claim the website offers downloadable installers until signed builds, authentication, and end-to-end tests are complete.**
