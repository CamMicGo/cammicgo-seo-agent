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
    // First use the maintained Java NewPipe extractor (no Python on the device).
    IOException newPipeError = null;
    try {
      java.util.List<String> streams = NewPipeAudioResolver.resolve(videoId);
      for (String stream : streams) {
        String extension = stream.contains("mime=audio%2Fmp4") ? ".m4a" : ".webm";
        File temp = File.createTempFile("yt-newpipe-", extension, context.getCacheDir());
        try {
          URL parsed = new URL(stream);
          if (!isGoogleVideoHost(parsed.getHost())) continue;
          long bytes = fetchAudio(stream, temp, "WEB");
          String saved = saveToDownloads(context, temp, "YouTube-audio-" + videoId + extension);
          JSONObject result = new JSONObject();
          result.put("savedTo", saved);
          result.put("videoId", videoId);
          result.put("source", "newpipe_java");
          result.put("audioBytes", bytes);
          result.put("audioOnly", true);
          return result;
        } catch (org.json.JSONException error) {
          throw new IOException("Résultat NewPipe illisible", error);
        } catch (IOException error) {
          newPipeError = error;
        } finally {
          if (temp.exists() && !temp.delete())
            android.util.Log.w("YouTubeAudioOnly", "Temporary NewPipe audio cleanup failed");
        }
      }
    } catch (IOException error) {
      newPipeError = error;
    }
    IOException lastError = null;
    int attempted = 0;
    // Try independently obtained player URLs. A URL returned by one YouTube client
    // may be rejected even when another client's URL is playable.
    String[] clients = {"ANDROID", "IOS", "WEB"};
    for (String client : clients) {
      JSONObject player;
      try {
        player = playerFor(videoId, client);
      } catch (IOException error) {
        lastError = error;
        continue;
      }
      JSONObject status = player.optJSONObject("playabilityStatus");
      if (status == null || !"OK".equals(status.optString("status"))) {
        lastError = new IOException(client + ": " + TranscriptFetcher.statusOf(player));
        continue;
      }
      JSONObject streaming = player.optJSONObject("streamingData");
      JSONArray formats = streaming == null ? null : streaming.optJSONArray("adaptiveFormats");
      if (formats == null) continue;
      java.util.ArrayList<JSONObject> choices = new java.util.ArrayList<>();
      for (int i = 0; i < formats.length(); i++) {
        JSONObject format = formats.optJSONObject(i);
        if (format == null || !format.optString("mimeType").startsWith("audio/")) continue;
        String direct = format.optString("url");
        if (direct.isEmpty()) continue;
        try {
          URL parsed = new URL(direct);
          if ("https".equalsIgnoreCase(parsed.getProtocol()) && isGoogleVideoHost(parsed.getHost()))
            choices.add(format);
        } catch (Exception ignored) { }
      }
      java.util.Collections.sort(choices, (a, b) ->
          Integer.compare(a.optInt("bitrate", Integer.MAX_VALUE), b.optInt("bitrate", Integer.MAX_VALUE)));
      for (JSONObject format : choices) {
        attempted++;
        String mime = format.optString("mimeType");
        String extension = mime.startsWith("audio/mp4") ? ".m4a" : ".webm";
        File temp = File.createTempFile("yt-audio-", extension, context.getCacheDir());
        try {
          long bytes = fetchAudio(format.optString("url"), temp, client);
          String saved = saveToDownloads(context, temp, "YouTube-audio-" + videoId + extension);
          JSONObject result = new JSONObject();
          result.put("savedTo", saved);
          result.put("videoId", videoId);
          result.put("source", client);
          result.put("audioBytes", bytes);
          result.put("audioOnly", true);
          return result;
        } catch (org.json.JSONException error) {
          throw new IOException("Résultat audio illisible", error);
        } catch (IOException error) {
          lastError = error;
          // If the same client refuses a stream, try the next format/client.
        } finally {
          if (temp.exists() && !temp.delete())
            android.util.Log.w("YouTubeAudioOnly", "Temporary audio cleanup failed");
        }
      }
    }
    throw new IOException("Aucun flux audio accessible (" + attempted +
        " essais). NewPipe: " + (newPipeError == null ? "flux refusés" : newPipeError.getMessage()) +
        " / InnerTube: " + (lastError == null ? "aucun lien direct" : lastError.getMessage()));
  }

  private static JSONObject playerFor(String videoId, String clientName) throws IOException {
    if ("ANDROID".equals(clientName)) return TranscriptFetcher.innertubePlayer(videoId, null);
    try {
      JSONObject client = new JSONObject();
      client.put("clientName", clientName);
      client.put("clientVersion", "IOS".equals(clientName) ? "20.10.4" : "2.20261101.00.00");
      if ("IOS".equals(clientName)) client.put("deviceModel", "iPhone16,2");
      client.put("hl", "en");
      JSONObject context = new JSONObject().put("client", client);
      JSONObject body = new JSONObject().put("context", context).put("videoId", videoId);
      HttpURLConnection conn = (HttpURLConnection) new URL("https://www.youtube.com/youtubei/v1/player").openConnection();
      try {
        conn.setConnectTimeout(12000);
        conn.setReadTimeout(20000);
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("User-Agent", userAgent(clientName));
        conn.setRequestProperty("Origin", "https://www.youtube.com");
        byte[] payload = body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        try (java.io.OutputStream out = conn.getOutputStream()) { out.write(payload); }
        if (conn.getResponseCode() != 200)
          throw new IOException(clientName + " player HTTP " + conn.getResponseCode());
        try (InputStream in = conn.getInputStream()) {
          java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
          byte[] bytes = new byte[8192]; int n;
          while ((n = in.read(bytes)) != -1) {
            if (buffer.size() + n > 4_000_000) throw new IOException("Player response too large");
            buffer.write(bytes, 0, n);
          }
          return new JSONObject(buffer.toString("UTF-8"));
        }
      } finally { conn.disconnect(); }
    } catch (org.json.JSONException error) {
      throw new IOException("Player JSON error", error);
    }
  }

  private static String userAgent(String client) {
    if ("IOS".equals(client)) return "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 17_5 like Mac OS X)";
    if ("WEB".equals(client)) return TranscriptFetcher.WEB_UA;
    return TranscriptFetcher.ANDROID_UA;
  }

  private static long fetchAudio(String stream, File temp, String client) throws IOException {
    URL nextUrl = new URL(stream);
    HttpURLConnection conn = null;
    try {
      for (int redirects = 0; redirects <= 5; redirects++) {
        if (!"https".equalsIgnoreCase(nextUrl.getProtocol()) || !isGoogleVideoHost(nextUrl.getHost()))
          throw new IOException("Redirection audio vers un hôte non autorisé");
        conn = (HttpURLConnection) nextUrl.openConnection();
        conn.setConnectTimeout(12000);
        conn.setReadTimeout(30000);
        conn.setInstanceFollowRedirects(false);
        conn.setRequestProperty("User-Agent", userAgent(client));
        conn.setRequestProperty("Accept", "*/*");
        conn.setRequestProperty("Origin", "https://www.youtube.com");
        int status = conn.getResponseCode();
        if (status == 200 || status == 206) break;
        if (status != 301 && status != 302 && status != 303 && status != 307 && status != 308)
          throw new IOException(client + " audio HTTP " + status);
        if (redirects == 5) throw new IOException("Trop de redirections audio");
        String location = conn.getHeaderField("Location");
        if (location == null || location.isEmpty()) throw new IOException("Redirection sans destination");
        nextUrl = new URL(nextUrl, location);
        conn.disconnect();
        conn = null;
      }
      if (conn == null) throw new IOException("Connexion audio indisponible");
      if (conn.getContentLengthLong() > MAX_BYTES) throw new IOException("Audio > 100 MiB");
      long total = 0;
      try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(temp)) {
        byte[] buffer = new byte[32768]; int n;
        while ((n = in.read(buffer)) != -1) {
          total += n;
          if (total > MAX_BYTES) throw new IOException("Audio > 100 MiB");
          out.write(buffer, 0, n);
        }
      }
      if (total == 0) throw new IOException("Flux audio vide");
      return total;
    } finally { if (conn != null) conn.disconnect(); }
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
