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
    // First use the maintained Java NewPipe extractor (no Python on the device).
    IOException newPipeError = null;
    try {
      java.util.List<NewPipeAudioResolver.Candidate> streams = NewPipeAudioResolver.resolve(videoId);
      for (NewPipeAudioResolver.Candidate stream : streams) {
        File temp = File.createTempFile("yt-newpipe-", stream.extension, context.getCacheDir());
        try {
          if (!isGoogleVideoHost(new URL(stream.url).getHost())) continue;
          long bytes = fetchRanged(stream.url, temp, stream.userAgent);
          String saved = keepTemporary(context, temp, "YouTube-audio-" + videoId + stream.extension);
          JSONObject result = new JSONObject();
          result.put("savedTo", saved);
          result.put("videoId", videoId);
          result.put("source", "newpipe_java");
          result.put("mime", stream.mime);
          result.put("bitrate", stream.bitrate);
          result.put("audioBytes", bytes);
          result.put("audioOnly", true);
          return result;
        } catch (org.json.JSONException error) {
          throw new IOException("Résultat NewPipe illisible", error);
        } catch (IOException error) {
          newPipeError = new IOException("NewPipe stream: " + error.getMessage(), error);
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
          String saved = keepTemporary(context, temp, "YouTube-audio-" + videoId + extension);
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
  /**
   * Downloads a googlevideo stream in 1 MiB ranges with the User-Agent of the client that produced
   * the URL. Whole-file requests are often cut or refused (403) by YouTube; ranges are what the
   * official players use.
   */
  static long fetchRanged(String stream, File temp, String userAgent) throws IOException {
    final long chunk = 1L << 20;
    long done = 0, total = -1;
    try (FileOutputStream out = new FileOutputStream(temp)) {
      while (total < 0 || done < total) {
        HttpURLConnection conn = (HttpURLConnection) new URL(stream).openConnection();
        try {
          conn.setConnectTimeout(15000);
          conn.setReadTimeout(30000);
          conn.setInstanceFollowRedirects(true);
          conn.setRequestProperty("User-Agent", userAgent);
          conn.setRequestProperty("Accept", "*/*");
          conn.setRequestProperty("Range", "bytes=" + done + "-" + (done + chunk - 1));
          int status = conn.getResponseCode();
          if (status == 416 && total < 0 && done > 0) break;
          if (status != 206 && status != 200) throw new IOException("audio HTTP " + status + (done > 0 ? " at " + done + " bytes" : ""));
          if (status == 206) {
            String range = conn.getHeaderField("Content-Range"); // bytes a-b/total
            if (range != null && range.contains("/")) {
              String t = range.substring(range.lastIndexOf('/') + 1).trim();
              if (!"*".equals(t)) total = Long.parseLong(t);
            }
          }
          if (total > MAX_BYTES) throw new IOException("Audio > 100 MiB");
          long got = 0;
          try (InputStream in = conn.getInputStream()) {
            byte[] buffer = new byte[32768]; int n;
            while ((n = in.read(buffer)) != -1) {
              out.write(buffer, 0, n); got += n; done += n;
              if (done > MAX_BYTES) throw new IOException("Audio > 100 MiB");
            }
          }
          if (status == 200) { total = done; break; } // the server sent the whole file at once
          if (got == 0) break;
        } finally { conn.disconnect(); }
      }
    }
    if (done == 0) throw new IOException("Flux audio vide");
    if (total > 0 && done < total) throw new IOException("audio incomplete: " + done + "/" + total + " bytes");
    return done;
  }

  private static boolean isGoogleVideoHost(String host) {
    if (host == null) return false;
    String normalized = host.toLowerCase(Locale.ROOT);
    return normalized.equals("googlevideo.com") || normalized.endsWith(".googlevideo.com");
  }

  /** Temporary audio folder inside the app cache: not visible in Downloads, removed by Android when space is low. */
  static File tempAudioDir(Context context) {
    return new File(context.getCacheDir(), "audio-temp");
  }

  /** Moves the downloaded file into the temporary folder; files older than 24 h and all but the 5 newest are removed. */
  private static String keepTemporary(Context context, File file, String name) throws IOException {
    File dir = tempAudioDir(context);
    if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Dossier audio temporaire indisponible");
    purgeTemporary(dir, name);
    File destination = new File(dir, name);
    if (destination.exists() && !destination.delete()) throw new IOException("Ancien audio impossible à remplacer");
    if (!file.renameTo(destination)) {
      try (InputStream in = new java.io.FileInputStream(file); FileOutputStream out = new FileOutputStream(destination)) {
        byte[] buffer = new byte[32768]; int n;
        while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
      }
    }
    return destination.getAbsolutePath();
  }

  private static void purgeTemporary(File dir, String keepName) {
    File[] files = dir.listFiles();
    if (files == null) return;
    java.util.Arrays.sort(files, (x, y) -> Long.compare(y.lastModified(), x.lastModified()));
    long cutoff = System.currentTimeMillis() - 24L * 3600L * 1000L;
    int kept = 0;
    for (File f : files) {
      if (f.getName().equals(keepName)) continue;
      if (f.lastModified() < cutoff || ++kept >= 5) f.delete();
    }
  }

  /** Removes every temporary audio file (to call once the transcription is done). */
  static void clearTemporary(Context context) {
    File[] files = tempAudioDir(context).listFiles();
    if (files != null) for (File f : files) f.delete();
  }


}
