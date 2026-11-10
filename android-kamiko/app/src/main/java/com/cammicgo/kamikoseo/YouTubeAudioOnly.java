package com.cammicgo.kamikoseo;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/** Audio-only experimental relay. Does not include ASR, Python, or bundled codecs. */
final class YouTubeAudioOnly {
  private static final long MAX_BYTES = 100L * 1024L * 1024L;
  private YouTubeAudioOnly() {}

  static JSONObject probeAndDownload(Context context, String videoId) throws IOException {
    if (videoId == null || !videoId.matches("[A-Za-z0-9_-]{11}"))
      throw new IOException("Invalid video ID");
    JSONObject player = TranscriptFetcher.innertubePlayer(videoId, null);
    if (!"OK".equals(player.optJSONObject("playabilityStatus") == null ? "" :
        player.optJSONObject("playabilityStatus").optString("status")))
      throw new IOException("YouTube: " + TranscriptFetcher.statusOf(player));
    JSONObject streaming = player.optJSONObject("streamingData");
    JSONArray formats = streaming == null ? null : streaming.optJSONArray("adaptiveFormats");
    String stream = null;
    int lowest = Integer.MAX_VALUE;
    if (formats != null) for (int i = 0; i < formats.length(); i++) {
      JSONObject format = formats.optJSONObject(i);
      if (format == null || !format.optString("mimeType").startsWith("audio/")) continue;
      String candidate = format.optString("url");
      if (candidate.isEmpty()) continue; // No signature deciphering / DRM bypass
      URL u = new URL(candidate);
      String host = u.getHost().toLowerCase(Locale.ROOT);
      if (!"https".equals(u.getProtocol()) ||
          !(host.equals("googlevideo.com") || host.endsWith(".googlevideo.com"))) continue;
      int bitrate = format.optInt("bitrate", Integer.MAX_VALUE);
      if (stream == null || bitrate < lowest) { stream = candidate; lowest = bitrate; }
    }
    if (stream == null) throw new IOException("Aucun flux audio direct accessible sur ce client YouTube.");
    File temp = File.createTempFile("yt-audio-", ".media", context.getCacheDir());
    long bytes = 0;
    HttpURLConnection conn = null;
    try {
      conn = (HttpURLConnection) new URL(stream).openConnection();
      conn.setConnectTimeout(12000);
      conn.setReadTimeout(30000);
      conn.setInstanceFollowRedirects(false);
      conn.setRequestProperty("User-Agent", TranscriptFetcher.ANDROID_UA);
      if (conn.getResponseCode() != 200)
        throw new IOException("HTTP audio " + conn.getResponseCode());
      if (conn.getContentLengthLong() > MAX_BYTES)
        throw new IOException("Audio > 100 MiB");
      try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(temp)) {
        byte[] buffer = new byte[32768]; int n;
        while ((n = in.read(buffer)) != -1) {
          bytes += n;
          if (bytes > MAX_BYTES) throw new IOException("Audio > 100 MiB");
          out.write(buffer, 0, n);
        }
      }
      JSONObject result = new JSONObject();
      result.put("videoId", videoId);
      result.put("source", "youtube_audio_probe");
      result.put("audioBytes", bytes);
      result.put("cacheDeleted", true);
      result.put("audioOnly", true);
      return result;
    } catch (org.json.JSONException e) {
      throw new IOException("Audio probe JSON error", e);
    } finally {
      if (conn != null) conn.disconnect();
      if (temp.exists() && !temp.delete())
        android.util.Log.w("YouTubeAudioOnly", "Temporary audio file deletion failed");
    }
  }
}
