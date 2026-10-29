# YouTube quota and transcript policy

Hosted Vercel MCP: YouTube Data API tools require either a Google OAuth connection using the user's own GCP client (`mode=byo`) or the owner account UUID configured as `CAMMICGO_YOUTUBE_OWNER_USER_ID`. Without this variable, shared quota is intentionally denied for everyone. Other Google API tools are unchanged. YouTube caption extraction is disabled on Vercel and returns `LOCAL_MCP_REQUIRED`.

Local MCP: install `yt-dlp` on PATH, configure local Google OAuth, run `npm run local:login`, then `npm run mcp:local` in a compatible desktop MCP client. `youtube_get_transcript` runs `scripts/local-youtube-transcript.mjs` on that machine, without sending the request to Vercel. This does not work through an unchanged cloud Claude connector. It is an unofficial method and can fail due to YouTube restrictions. The user's own Google Cloud OAuth client is used for local YouTube Data API calls.

For recent uploads from a known channel, use `youtube_channel_latest` with the exact channel ID, not `youtube_search_videos`. Its channels.list + playlistItems.list + videos.list flow normally costs about three quota units, whereas search.list costs 100. If only a channel name is known, an initial search or explicit channel ID lookup may still be needed.
