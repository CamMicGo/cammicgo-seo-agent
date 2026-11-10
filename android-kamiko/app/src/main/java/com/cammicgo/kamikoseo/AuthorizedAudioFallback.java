package com.cammicgo.kamikoseo;

import android.content.Context;
import android.net.Uri;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URL;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Opt-in fallback for an explicitly authorized, direct HTTPS audio resource.
 * This is NOT a YouTube audio extractor. YouTube watch URLs and internal
 * player endpoints are intentionally not supported.
 */
final class AuthorizedAudioFallback {
  private static final long MAX_BYTES = 100L * 1024 * 1024;
  private AuthorizedAudioFallback() {}

  static TranscriptFetcher.Result transcribe(Context context, String url, String videoId,
      int maxMinutes, AtomicBoolean cancelled) throws Exception {
    if (!LocalAsr.installed(context)) throw new IOException("Modèle Qwen3-ASR non installé sur le téléphone.");
    return transcribeInternal(context, url, videoId, maxMinutes, cancelled, false);
  }

  static TranscriptFetcher.Result transcribeYouTube(Context context, String url, String videoId,
      int maxMinutes, AtomicBoolean cancelled) throws Exception {
    return transcribeInternal(context, url, videoId, maxMinutes, cancelled, true);
  }

  private static TranscriptFetcher.Result transcribeInternal(Context context, String url, String videoId,
      int maxMinutes, AtomicBoolean cancelled, boolean youtubeStream) throws Exception {
    if (!LocalAsr.installed(context)) throw new IOException("Modèle Qwen3-ASR non installé sur le téléphone.");
    File dir = new File(context.getCacheDir(), "asr-relay");
    if (!dir.exists() && !dir.mkdirs()) throw new IOException("Impossible de créer le cache ASR.");
    File temp = File.createTempFile("audio-", ".media", dir);
    try {
      download(url, temp, cancelled, youtubeStream);
      if (cancelled.get()) throw new IOException("Transcription annulée.");
      TranscriptFetcher.Result result = LocalAsr.transcribe(context, Uri.fromFile(temp),
          "YouTube " + videoId, -1, Math.max(1, Math.min(maxMinutes, 180)), cancelled,
          (done, total, text) -> {});
      result.videoId = videoId;
      return result;
    } finally {
      // No downloaded audio survives successful transcription, cancellation or failure.
      if (!temp.delete()) temp.deleteOnExit();
      LocalAsr.release();
    }
  }

  private static void download(String source, File destination, AtomicBoolean cancelled, boolean youtubeStream) throws IOException {
    URL url = new URL(source);
    if (!"https".equalsIgnoreCase(url.getProtocol())) throw new IOException("Audio HTTPS requis.");
    String host = url.getHost().toLowerCase(java.util.Locale.ROOT);
    if (youtubeStream && !(host.equals("googlevideo.com") || host.endsWith(".googlevideo.com")))
      throw new IOException("Flux YouTube non reconnu.");
    if (!youtubeStream && (host.equals("youtube.com") || host.endsWith(".youtube.com") ||
        host.equals("youtu.be") || host.endsWith(".googlevideo.com") ||
        host.equals("localhost") || host.endsWith(".localhost")))
      throw new IOException("Une URL YouTube n'est pas une URL de fichier audio autorisé.");
    InetAddress[] addresses = InetAddress.getAllByName(host);
    for (InetAddress address : addresses) {
      if (address.isAnyLocalAddress() || address.isLoopbackAddress() ||
          address.isLinkLocalAddress() || address.isSiteLocalAddress() ||
          address.isMulticastAddress())
        throw new IOException("Adresse réseau privée interdite.");
    }
    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
    conn.setInstanceFollowRedirects(false);
    conn.setConnectTimeout(15000);
    conn.setReadTimeout(30000);
    try {
      int status = conn.getResponseCode();
      if (status != 200) throw new IOException("Téléchargement audio HTTP " + status);
      String type = conn.getContentType();
      if (type == null || !(type.toLowerCase(java.util.Locale.ROOT).startsWith("audio/") ||
          type.toLowerCase(java.util.Locale.ROOT).startsWith("video/") ||
          type.toLowerCase(java.util.Locale.ROOT).startsWith("application/octet-stream")))
        throw new IOException("Le lien ne fournit pas de média audio.");
      long declared = conn.getContentLengthLong();
      if (declared > MAX_BYTES) throw new IOException("Audio trop volumineux (limite 100 Mo).");
      long count = 0;
      try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(destination)) {
        byte[] buffer = new byte[32768];
        int n;
        while ((n = in.read(buffer)) != -1) {
          if (cancelled.get() || Thread.currentThread().isInterrupted()) throw new IOException("Téléchargement interrompu.");
          count += n;
          if (count > MAX_BYTES) throw new IOException("Audio trop volumineux (limite 100 Mo).");
          out.write(buffer, 0, n);
        }
      }
      if (count == 0) throw new IOException("Fichier audio vide.");
    } finally {
      conn.disconnect();
    }
  }
}
