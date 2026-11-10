package com.cammicgo.kamikoseo;

import org.schabi.newpipe.extractor.MediaFormat;
import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.downloader.Downloader;
import org.schabi.newpipe.extractor.downloader.Request;
import org.schabi.newpipe.extractor.downloader.Response;
import org.schabi.newpipe.extractor.localization.ContentCountry;
import org.schabi.newpipe.extractor.localization.Localization;
import org.schabi.newpipe.extractor.services.youtube.YoutubeParsingHelper;
import org.schabi.newpipe.extractor.stream.AudioStream;
import org.schabi.newpipe.extractor.stream.DeliveryMethod;
import org.schabi.newpipe.extractor.stream.StreamInfo;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Finds the audio-only streams of a video with NewPipeExtractor (pure Java, no Python).
 * Each stream comes with the User-Agent of the YouTube client that produced its URL: the
 * googlevideo servers refuse (HTTP 403) a URL fetched with another client's User-Agent.
 */
final class NewPipeAudioResolver {
  /** A downloadable audio stream and the User-Agent to fetch it with. */
  static final class Candidate {
    final String url, userAgent, extension, mime;
    final int bitrate;
    Candidate(String url, String userAgent, String extension, String mime, int bitrate) {
      this.url = url; this.userAgent = userAgent; this.extension = extension; this.mime = mime; this.bitrate = bitrate;
    }
  }

  /** Same browser identity as the NewPipe app's downloader; NewPipe overrides it per request when needed. */
  static final String BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0";
  private static final Localization LOCALIZATION = new Localization("en", "US");
  private static boolean initialized;
  private static final Deque<String> trace = new ArrayDeque<>();

  private NewPipeAudioResolver() {}

  static synchronized List<Candidate> resolve(String videoId) throws IOException {
    if (!initialized) {
      NewPipe.init(new HttpDownloader(), LOCALIZATION, new ContentCountry("US"));
      initialized = true;
    }
    synchronized (trace) { trace.clear(); }
    StreamInfo info;
    try {
      info = StreamInfo.getInfo(NewPipe.getService(0), "https://www.youtube.com/watch?v=" + videoId);
    } catch (Exception error) {
      throw new IOException("NewPipe: " + error.getClass().getSimpleName() + ": " + error.getMessage() + traceText(), error);
    }
    List<Candidate> out = new ArrayList<>();
    for (AudioStream s : info.getAudioStreams()) {
      // Only direct files: DASH/HLS manifests would need a segment downloader.
      if (s.getDeliveryMethod() != DeliveryMethod.PROGRESSIVE_HTTP || !s.isUrl()) continue;
      String url = s.getContent();
      if (url == null || !url.startsWith("https://")) continue;
      MediaFormat f = s.getFormat();
      String ext = f == MediaFormat.M4A ? ".m4a" : f == MediaFormat.WEBMA || f == MediaFormat.WEBMA_OPUS ? ".webm" : null;
      if (ext == null) continue;
      out.add(new Candidate(url, userAgentFor(url), ext, ".m4a".equals(ext) ? "audio/mp4" : "audio/webm", s.getAverageBitrate()));
    }
    // Smallest first: transcription does not need high quality and the file comes faster.
    out.sort((a, b) -> Integer.compare(a.bitrate <= 0 ? Integer.MAX_VALUE : a.bitrate, b.bitrate <= 0 ? Integer.MAX_VALUE : b.bitrate));
    if (out.isEmpty()) throw new IOException("NewPipe: no direct audio stream (" + info.getAudioStreams().size() + " streams, all DASH/HLS or unknown format)");
    return out;
  }

  /** The User-Agent matching the client named in the URL (c=VISIONOS, c=WEB, ...). */
  static String userAgentFor(String url) {
    if (YoutubeParsingHelper.isVisionOsStreamingUrl(url)) return YoutubeParsingHelper.getVisionOsUserAgent(LOCALIZATION);
    return BROWSER_UA;
  }

  private static void remember(String line) {
    synchronized (trace) { trace.addLast(line); while (trace.size() > 6) trace.removeFirst(); }
  }

  /** Last HTTP exchanges, so an error tells what YouTube actually answered. */
  static String traceText() {
    synchronized (trace) { return trace.isEmpty() ? "" : " [HTTP: " + String.join(" | ", trace) + "]"; }
  }

  private static final class HttpDownloader extends Downloader {
    @Override public Response execute(Request request) throws IOException {
      URL url = new URL(request.url());
      HttpURLConnection conn = null;
      try {
        // Follow redirects ourselves, so a cross-site hop (e.g. to consent.youtube.com) is visible.
        for (int hop = 0; ; hop++) {
          conn = (HttpURLConnection) url.openConnection();
          conn.setConnectTimeout(15000);
          conn.setReadTimeout(30000);
          conn.setInstanceFollowRedirects(false);
          conn.setRequestMethod(request.httpMethod());
          conn.setRequestProperty("User-Agent", BROWSER_UA);
          conn.setRequestProperty("Accept-Language", "en-US,en;q=0.8");
          // NewPipe's own headers replace the defaults (never two User-Agent or Cookie lines).
          for (Map.Entry<String, List<String>> e : request.headers().entrySet()) {
            if (e.getKey() == null || e.getValue() == null || e.getValue().isEmpty()) continue;
            if ("accept-encoding".equalsIgnoreCase(e.getKey())) continue; // let Android decompress
            conn.setRequestProperty(e.getKey(), e.getValue().get(0));
            for (int i = 1; i < e.getValue().size(); i++) conn.addRequestProperty(e.getKey(), e.getValue().get(i));
          }
          byte[] data = request.dataToSend();
          if (data != null && data.length > 0) {
            conn.setDoOutput(true);
            try (java.io.OutputStream os = conn.getOutputStream()) { os.write(data); }
          }
          int code = conn.getResponseCode();
          if (code >= 300 && code < 400 && hop < 5 && conn.getHeaderField("Location") != null) {
            URL next = new URL(url, conn.getHeaderField("Location"));
            remember(code + " " + url.getHost() + url.getPath() + " -> " + next.getHost() + next.getPath());
            conn.disconnect();
            url = next;
            continue;
          }
          String body = "";
          if (!"HEAD".equals(request.httpMethod())) {
            InputStream in = code < 400 ? conn.getInputStream() : conn.getErrorStream();
            if (in != null) {
              try (InputStream is = in) {
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                byte[] b = new byte[16384]; int n;
                while ((n = is.read(b)) != -1) {
                  if (buf.size() + n > 12_000_000) throw new IOException("NewPipe HTTP response too large");
                  buf.write(b, 0, n);
                }
                body = buf.toString("UTF-8");
              }
            }
          }
          remember(code + " " + url.getHost() + url.getPath() + " " + body.length() + "B"
              + (code >= 400 || body.length() < 2000 ? " «" + body.substring(0, Math.min(120, body.length())).replaceAll("\\s+", " ") + "»" : ""));
          if (code == 429) throw new org.schabi.newpipe.extractor.exceptions.ReCaptchaException("reCAPTCHA / rate limit", url.toString());
          return new Response(code, conn.getResponseMessage(), conn.getHeaderFields(), body, url.toString());
        }
      } catch (org.schabi.newpipe.extractor.exceptions.ReCaptchaException e) {
        throw new IOException("YouTube asks for a captcha (too many requests from this connection)", e);
      } finally { if (conn != null) conn.disconnect(); }
    }
  }

  static String lower(String s) { return s == null ? "" : s.toLowerCase(Locale.ROOT); }
}
