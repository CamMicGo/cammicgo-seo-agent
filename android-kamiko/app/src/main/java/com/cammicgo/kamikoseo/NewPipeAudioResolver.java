package com.cammicgo.kamikoseo;

import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.downloader.Downloader;
import org.schabi.newpipe.extractor.downloader.Request;
import org.schabi.newpipe.extractor.downloader.Response;
import org.schabi.newpipe.extractor.stream.AudioStream;
import org.schabi.newpipe.extractor.stream.StreamInfo;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Java-only YouTube extractor; no Python, executable, or separate app needed. */
final class NewPipeAudioResolver {
  private static boolean initialized;
  private NewPipeAudioResolver() {}

  static synchronized List<String> resolve(String videoId) throws IOException {
    if (!initialized) {
      NewPipe.init(new HttpDownloader());
      initialized = true;
    }
    try {
      StreamInfo info = StreamInfo.getInfo("https://www.youtube.com/watch?v=" + videoId);
      List<String> urls = new ArrayList<>();
      for (AudioStream stream : info.getAudioStreams()) {
        String candidate = stream.getContent();
        if (candidate != null && candidate.startsWith("https://")) urls.add(candidate);
      }
      if (urls.isEmpty()) throw new IOException("NewPipe: aucune piste audio directe");
      return urls;
    } catch (Exception error) {
      throw new IOException("NewPipe: " + error.getClass().getSimpleName() + ": " + error.getMessage(), error);
    }
  }

  private static final class HttpDownloader extends Downloader {
    @Override public Response execute(Request request) throws IOException {
      HttpURLConnection conn = (HttpURLConnection) new URL(request.url()).openConnection();
      try {
        conn.setConnectTimeout(12000);
        conn.setReadTimeout(20000);
        conn.setInstanceFollowRedirects(true);
        conn.setRequestMethod(request.httpMethod());
        conn.setRequestProperty("User-Agent", TranscriptFetcher.WEB_UA);
        conn.setRequestProperty("Accept-Language", "en-US,en;q=0.8");
        for (Map.Entry<String, List<String>> entry : request.headers().entrySet()) {
          if (entry.getKey() == null) continue;
          for (String value : entry.getValue()) conn.addRequestProperty(entry.getKey(), value);
        }
        byte[] data = request.dataToSend();
        if (data != null && data.length > 0) {
          conn.setDoOutput(true);
          try (java.io.OutputStream out = conn.getOutputStream()) { out.write(data); }
        }
        int code = conn.getResponseCode();
        String body = "";
        if (!"HEAD".equals(request.httpMethod())) {
          try (InputStream in = code < 400 ? conn.getInputStream() : conn.getErrorStream()) {
            if (in != null) {
              ByteArrayOutputStream out = new ByteArrayOutputStream();
              byte[] buffer = new byte[8192]; int n;
              while ((n = in.read(buffer)) != -1) {
                if (out.size() + n > 6_000_000) throw new IOException("NewPipe HTTP response too large");
                out.write(buffer, 0, n);
              }
              body = out.toString("UTF-8");
            }
          }
        }
        return new Response(code, conn.getResponseMessage(), conn.getHeaderFields(), body, conn.getURL().toString());
      } finally { conn.disconnect(); }
    }
  }
}
