package com.cammicgo.kamikoseo;

import android.content.Context;
import android.content.ContentValues;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.net.Uri;
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
    String selectedMime = "audio/webm";
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
      if (stream == null || bitrate < lowest) { stream = candidate; lowest = bitrate; selectedMime = format.optString("mimeType"); }
    }
    if (stream == null) throw new IOException("Aucun flux audio direct accessible sur ce client YouTube.");
    String extension = selectedMime.startsWith("audio/mp4") ? ".m4a" : ".webm";
    File temp = File.createTempFile("yt-audio-", extension, context.getCacheDir());
    long bytes = 0;
    HttpURLConnection conn = null;
    try {
      URL nextUrl = new URL(stream);
      int responseCode = -1;
      for (int redirects = 0; redirects <= 5; redirects++) {
        if (!"https".equalsIgnoreCase(nextUrl.getProtocol()) ||
            !isGoogleVideoHost(nextUrl.getHost()))
          throw new IOException("Redirection audio vers un hôte non autorisé");
        conn = (HttpURLConnection) nextUrl.openConnection();
        conn.setConnectTimeout(12000);
        conn.setReadTimeout(30000);
        conn.setInstanceFollowRedirects(false);
        conn.setRequestProperty("User-Agent", TranscriptFetcher.ANDROID_UA);
        responseCode = conn.getResponseCode();
        if (responseCode == 200) break;
        if (responseCode != 301 && responseCode != 302 && responseCode != 303 &&
            responseCode != 307 && responseCode != 308)
          throw new IOException("HTTP audio " + responseCode);
        if (redirects == 5) throw new IOException("Trop de redirections audio");
        String location = conn.getHeaderField("Location");
        if (location == null || location.isEmpty())
          throw new IOException("Redirection audio sans destination");
        nextUrl = new URL(nextUrl, location);
        conn.disconnect();
        conn = null;
      }
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
      String saved = saveToDownloads(context, temp, "YouTube-audio-" + videoId + extension);
      JSONObject result = new JSONObject();
      result.put("savedTo", saved);
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
  private static boolean isGoogleVideoHost(String host) {
    if (host == null) return false;
    String normalized = host.toLowerCase(Locale.ROOT);
    return normalized.equals("googlevideo.com") || normalized.endsWith(".googlevideo.com");
  }

  private static String saveToDownloads(Context context, File file, String name) throws IOException {
    if (Build.VERSION.SDK_INT < 29) {
      File directory = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
      if (directory == null) throw new IOException("Dossier de téléchargement indisponible");
      File destination = new File(directory, name);
      try (InputStream in = new java.io.FileInputStream(file);
           FileOutputStream out = new FileOutputStream(destination)) {
        byte[] buffer = new byte[32768]; int n;
        while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
      }
      return destination.getAbsolutePath();
    }
    ContentValues values = new ContentValues();
    values.put(MediaStore.Downloads.DISPLAY_NAME, name);
    values.put(MediaStore.Downloads.MIME_TYPE, name.endsWith(".m4a") ? "audio/mp4" : "audio/webm");
    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Kamiko");
    values.put(MediaStore.Downloads.IS_PENDING, 1);
    Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
    if (uri == null) throw new IOException("Impossible de créer le fichier audio dans Téléchargements");
    boolean success = false;
    try {
      try (InputStream in = new java.io.FileInputStream(file);
           java.io.OutputStream out = context.getContentResolver().openOutputStream(uri)) {
        if (out == null) throw new IOException("Impossible d'ouvrir le fichier de destination");
        byte[] buffer = new byte[32768]; int n;
        while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
      }
      values.clear();
      values.put(MediaStore.Downloads.IS_PENDING, 0);
      context.getContentResolver().update(uri, values, null, null);
      success = true;
      return "Téléchargements/Kamiko/" + name;
    } finally {
      if (!success) context.getContentResolver().delete(uri, null, null);
    }
  }

}
