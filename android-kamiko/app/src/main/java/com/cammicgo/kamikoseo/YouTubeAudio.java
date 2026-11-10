package com.cammicgo.kamikoseo;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;
import java.net.URL;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Android-native YouTube audio selection via the same InnerTube JSON client used
 * for captions. No Python, external executable or server-side audio proxy.
 * Only plain HTTPS URLs returned in streamingData are accepted; signed cipher,
 * DRM and player-token protected streams are deliberately not bypassed.
 */
final class YouTubeAudio {
  private YouTubeAudio() {}

  static TranscriptFetcher.Result transcribe(Context context, String videoId,
      int maxMinutes, AtomicBoolean cancelled) throws Exception {
    if (!videoId.matches("[A-Za-z0-9_-]{11}")) throw new IOException("Identifiant YouTube invalide");
    JSONObject player = TranscriptFetcher.innertubePlayer(videoId, null);
    JSONObject status = player.optJSONObject("playabilityStatus");
    if (status == null || !"OK".equals(status.optString("status")))
      throw new IOException("Vidéo non lisible : " + TranscriptFetcher.statusOf(player));
    JSONObject streaming = player.optJSONObject("streamingData");
    JSONArray formats = streaming == null ? null : streaming.optJSONArray("adaptiveFormats");
    String audioUrl = null;
    int bestBitrate = -1;
    if (formats != null) for (int i = 0; i < formats.length(); i++) {
      JSONObject f = formats.optJSONObject(i);
      if (f == null || !f.optString("mimeType").startsWith("audio/")) continue;
      String candidate = f.optString("url", "");
      if (candidate.isEmpty()) continue;
      URL parsed = new URL(candidate);
      String host = parsed.getHost().toLowerCase(java.util.Locale.ROOT);
      if (!"https".equalsIgnoreCase(parsed.getProtocol()) ||
          !(host.equals("googlevideo.com") || host.endsWith(".googlevideo.com"))) continue;
      int bitrate = f.optInt("bitrate", 0);
      if (audioUrl == null || bitrate < bestBitrate) {
        audioUrl = candidate;
        bestBitrate = bitrate;
      }
    }
    if (audioUrl == null)
      throw new IOException("YouTube ne fournit aucun flux audio direct accessible (protection ou URL chiffrée).");
    TranscriptFetcher.Result result = AuthorizedAudioFallback.transcribeYouTube(
        context, audioUrl, videoId, maxMinutes, cancelled);
    JSONObject details = player.optJSONObject("videoDetails");
    if (details != null) result.title = details.optString("title", result.title);
    result.method = "innertube-android-audio-qwen";
    return result;
  }
}
