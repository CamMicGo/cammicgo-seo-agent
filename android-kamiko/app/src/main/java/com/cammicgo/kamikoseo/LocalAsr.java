package com.cammicgo.kamikoseo;

import android.app.ActivityManager;
import android.content.Context;
import android.net.Uri;

import com.k2fsa.sherpa.onnx.FeatureConfig;
import com.k2fsa.sherpa.onnx.OfflineModelConfig;
import com.k2fsa.sherpa.onnx.OfflineQwen3AsrModelConfig;
import com.k2fsa.sherpa.onnx.OfflineRecognizer;
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OfflineStream;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * On-device speech recognition with Qwen3-ASR-0.6B (int8, sherpa-onnx). The model is downloaded only
 * when the user asks for it, checked file by file (size + SHA-256), kept in the app's private
 * storage and reused offline. Audio never leaves the phone.
 */
final class LocalAsr {
  static final String MODEL_ID = "qwen3-asr-0.6b-int8";
  static final String MODEL_LABEL = "Qwen3-ASR 0.6B (int8)";
  /** Official sherpa-onnx release of the model (Apache-2.0, like Qwen3-ASR). */
  static final String URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25.tar.bz2";
  static final long DOWNLOAD_BYTES = 878_702_423L;
  /** path, bytes, SHA-256 — measured from the release archive (benchmarks/asr). */
  static final String[][] FILES = {
      {"conv_frontend.onnx", "44148281", "d22dc4423e0940e49884e903d2ea2f7e5567c14fc1aed97e4e26d6b8f208ef9e"},
      {"encoder.int8.onnx", "182491662", "60748d3e6744a57c9c91e1b17424a6c2990567e8adceb0783940c03ed98fa9d9"},
      {"decoder.int8.onnx", "755914231", "4f6885be5959ae26af3089d38ee7972c5fafbeeb1cf8d5e76eab6d8b61ca5771"},
      {"tokenizer/vocab.json", "2776833", "ca10d7e9fb3ed18575dd1e277a2579c16d108e32f27439684afa0e10b1440910"},
      {"tokenizer/merges.txt", "1671853", "8831e4f1a044471340f7c0a83d7bd71306a5b867e95fd870f74d0c5308a904d5"},
      {"tokenizer/tokenizer_config.json", "12487", "4942d005604266809309cabc9f4e9cb89ce855d59b14681fdc0e1cc62ea26c4c"},
  };
  static final long INSTALLED_BYTES;
  static { long s = 0; for (String[] f : FILES) s += Long.parseLong(f[1]); INSTALLED_BYTES = s; }

  /** Decoding settings (benchmarks/asr): short segments keep the decoder's memory low on phones. */
  static final double SEGMENT_SECONDS = 15;
  static final int MAX_TOTAL_LEN = 512, MAX_NEW_TOKENS = 256;
  /** Memory needed: ~1.4 GB to load, peaks near 2 GB while decoding. */
  static final long MIN_DEVICE_RAM = 5_500_000_000L, MIN_FREE_RAM = 2_000_000_000L;

  /** Language names Qwen3-ASR understands, indexed like I18n.CODES ("" = automatic). */
  static final String[] QWEN_LANG = {"English", "French", "Spanish", "German", "Portuguese", "Italian", "Russian", "Chinese", "Japanese", "Korean", "Arabic"};

  static final class UserError extends IOException {
    final String key; final Object[] args;
    UserError(String key, Object... args) { super(key); this.key = key; this.args = args; }
  }

  interface Progress { void update(long done, long total); }
  interface Listener { void segment(double doneSeconds, double totalSeconds, String text); }

  private LocalAsr() {}

  static File dir(Context c) { return new File(c.getFilesDir(), "asr/" + MODEL_ID); }
  private static File marker(Context c) { return new File(dir(c), ".verified"); }

  /** Installed and verified (sizes are rechecked; hashes were checked once, at download). */
  static boolean installed(Context c) {
    if (!marker(c).isFile()) return false;
    for (String[] f : FILES) { File x = new File(dir(c), f[0]); if (!x.isFile() || x.length() != Long.parseLong(f[1])) return false; }
    return true;
  }

  static void delete(Context c) {
    release();
    deleteTree(dir(c));
    deleteTree(new File(c.getFilesDir(), "asr/download.tmp"));
  }

  static String size(long bytes) {
    if (bytes >= 1_000_000_000L) return String.format(Locale.getDefault(), "%.2f Go", bytes / 1e9).replace("Go", "GB");
    return String.format(Locale.getDefault(), "%d MB", Math.round(bytes / 1e6));
  }

  /** Downloads the archive once, extracting only the model files and verifying each one. */
  static void download(Context c, Progress progress, AtomicBoolean cancel) throws IOException {
    long need = INSTALLED_BYTES + 200_000_000L;
    if (c.getFilesDir().getUsableSpace() < need) throw new UserError("asr_no_space", size(need));
    File tmp = new File(c.getFilesDir(), "asr/download.tmp");
    deleteTree(tmp);
    if (!tmp.mkdirs()) throw new IOException("cannot create " + tmp);
    Map<String, String[]> wanted = new HashMap<>();
    for (String[] f : FILES) wanted.put(f[0], f);
    HttpURLConnection con = open(URL);
    long total = con.getContentLengthLong() > 0 ? con.getContentLengthLong() : DOWNLOAD_BYTES;
    int found = 0;
    try (InputStream raw = con.getInputStream();
         CountingStream counted = new CountingStream(raw, total, progress, cancel);
         TarArchiveInputStream tar = new TarArchiveInputStream(new BZip2CompressorInputStream(new BufferedInputStream(counted, 1 << 16)))) {
      TarArchiveEntry e;
      byte[] buf = new byte[1 << 16];
      while ((e = tar.getNextTarEntry()) != null) {
        if (cancel.get()) throw new AudioDecoder.CancelledException();
        String name = e.getName();
        int slash = name.indexOf('/');
        String rel = slash >= 0 ? name.substring(slash + 1) : name;
        String[] spec = wanted.get(rel);
        if (spec == null || e.isDirectory()) continue;
        File out = new File(tmp, rel);
        File parent = out.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) throw new IOException("cannot create " + parent);
        MessageDigest sha = sha256();
        long written = 0;
        try (OutputStream os = new FileOutputStream(out)) {
          int n;
          while ((n = tar.read(buf)) > 0) { os.write(buf, 0, n); sha.update(buf, 0, n); written += n; }
        }
        if (written != Long.parseLong(spec[1]) || !hex(sha.digest()).equals(spec[2])) throw new UserError("asr_bad_file", rel);
        found++;
      }
    } finally { con.disconnect(); }
    if (found != FILES.length) throw new UserError("asr_bad_file", "archive");
    File dest = dir(c);
    deleteTree(dest);
    File parent = dest.getParentFile();
    if (parent != null && !parent.isDirectory()) parent.mkdirs();
    if (!tmp.renameTo(dest)) throw new IOException("cannot move model into place");
    try (OutputStream os = new FileOutputStream(marker(c))) { os.write(MODEL_ID.getBytes()); }
  }

  /**
   * Installs model files that are already on the device (a folder inside the app's storage), with the
   * same checks as a download. Used by the device test; could back a future "import model" option.
   */
  static void installFrom(Context c, File src) throws IOException {
    byte[] buf = new byte[1 << 16];
    for (String[] f : FILES) {
      File x = new File(src, f[0]);
      if (!x.isFile() || x.length() != Long.parseLong(f[1])) throw new UserError("asr_bad_file", f[0]);
      MessageDigest sha = sha256();
      try (InputStream in = new java.io.FileInputStream(x)) { int n; while ((n = in.read(buf)) > 0) sha.update(buf, 0, n); }
      if (!hex(sha.digest()).equals(f[2])) throw new UserError("asr_bad_file", f[0]);
    }
    release();
    File dest = dir(c);
    deleteTree(dest);
    File parent = dest.getParentFile();
    if (parent != null && !parent.isDirectory()) parent.mkdirs();
    if (!src.renameTo(dest)) throw new IOException("cannot move model into place");
    try (OutputStream os = new FileOutputStream(marker(c))) { os.write(MODEL_ID.getBytes()); }
  }

  /** Refuses phones that cannot hold the model, instead of letting Android kill the app. */
  static void checkMemory(Context c) throws UserError {
    ActivityManager am = (ActivityManager) c.getSystemService(Context.ACTIVITY_SERVICE);
    ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
    am.getMemoryInfo(mi);
    if (mi.totalMem < MIN_DEVICE_RAM) throw new UserError("asr_small_device", size(mi.totalMem));
    if (rec == null && mi.availMem < MIN_FREE_RAM) throw new UserError("asr_low_ram", size(MIN_FREE_RAM), size(mi.availMem));
  }

  private static OfflineRecognizer rec;

  static synchronized OfflineRecognizer recognizer(Context c) throws IOException {
    if (rec != null) return rec;
    if (!installed(c)) throw new UserError("asr_need_model");
    checkMemory(c);
    File d = dir(c);
    OfflineQwen3AsrModelConfig q = new OfflineQwen3AsrModelConfig();
    q.setConvFrontend(new File(d, "conv_frontend.onnx").getPath());
    q.setEncoder(new File(d, "encoder.int8.onnx").getPath());
    q.setDecoder(new File(d, "decoder.int8.onnx").getPath());
    q.setTokenizer(new File(d, "tokenizer").getPath());
    q.setMaxTotalLen(MAX_TOTAL_LEN);
    q.setMaxNewTokens(MAX_NEW_TOKENS);
    OfflineModelConfig m = new OfflineModelConfig();
    m.setQwen3Asr(q);
    m.setNumThreads(Math.max(2, Math.min(4, Runtime.getRuntime().availableProcessors() / 2)));
    FeatureConfig feat = new FeatureConfig();
    feat.setSampleRate(Segmenter.RATE);
    feat.setFeatureDim(128);
    OfflineRecognizerConfig cfg = new OfflineRecognizerConfig();
    cfg.setFeatConfig(feat);
    cfg.setModelConfig(m);
    try { rec = new OfflineRecognizer(null, cfg); }
    catch (IllegalArgumentException e) { throw new UserError("asr_load_failed"); }
    return rec;
  }

  static synchronized void release() { if (rec != null) { rec.release(); rec = null; } }

  /**
   * Transcribes a local file segment by segment. language: index into QWEN_LANG, or -1 for automatic.
   * The result is a transcript in the app's usual shape, marked source=local_asr.
   */
  static TranscriptFetcher.Result transcribe(Context c, Uri uri, String displayName, int language, int maxMinutes,
                                             AtomicBoolean cancel, Listener listener) throws Exception {
    long t0 = System.currentTimeMillis();
    OfflineRecognizer r = recognizer(c);
    TranscriptFetcher.Result res = new TranscriptFetcher.Result();
    res.source = "local_asr"; res.model = MODEL_ID; res.method = "local-asr";
    res.title = displayName;
    final double[] total = {0};
    final String forced = language >= 0 && language < QWEN_LANG.length ? QWEN_LANG[language] : "";
    StringBuilder all = new StringBuilder();
    Segmenter seg = new Segmenter(SEGMENT_SECONDS, (samples, start) -> {
      if (cancel.get()) throw new AudioDecoder.CancelledException();
      OfflineStream s = r.createStream();
      try {
        if (!forced.isEmpty()) s.setOption("language", forced);
        s.acceptWaveform(samples, Segmenter.RATE);
        r.decode(s);
        String text = r.getResult(s).getText().trim();
        double dur = samples.length / (double) Segmenter.RATE;
        if (!text.isEmpty()) { res.segments.add(new TranscriptFetcher.Segment(start, dur, text)); all.append(text).append(' '); }
        listener.segment(start + dur, total[0], text);
      } finally { s.release(); }
    });
    double decoded = AudioDecoder.decode(c, uri, maxMinutes * 60.0, cancel, d -> total[0] = d, seg::feed);
    seg.finish();
    res.durationSeconds = Math.round(decoded);
    res.truncated = total[0] > decoded + 1 && decoded >= maxMinutes * 60.0 - 1;
    res.processingMs = System.currentTimeMillis() - t0;
    String code = language >= 0 && language < I18n.CODES.length ? I18n.CODES[language] : LangGuess.guess(all.toString());
    res.languageForced = language >= 0;
    res.language = code.isEmpty() ? "und" : code;
    res.languageName = code.isEmpty() ? "?" : TranscriptFetcher.languageName(code);
    return res;
  }

  // ---------- helpers ----------

  private static HttpURLConnection open(String url) throws IOException {
    for (int hop = 0; hop < 6; hop++) {
      HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
      con.setInstanceFollowRedirects(false);
      con.setConnectTimeout(20_000); con.setReadTimeout(60_000);
      con.setRequestProperty("User-Agent", "CamMicGo-SEO-Android");
      int code = con.getResponseCode();
      if (code >= 300 && code < 400) {
        String next = con.getHeaderField("Location");
        con.disconnect();
        if (next == null || !next.startsWith("https://")) throw new IOException("redirect " + code);
        url = next; continue;
      }
      if (code != 200) { con.disconnect(); throw new IOException("HTTP " + code); }
      return con;
    }
    throw new IOException("too many redirects");
  }

  private static MessageDigest sha256() throws IOException {
    try { return MessageDigest.getInstance("SHA-256"); } catch (Exception e) { throw new IOException(e); }
  }

  static String hex(byte[] b) {
    StringBuilder s = new StringBuilder(b.length * 2);
    for (byte x : b) s.append(String.format(Locale.ROOT, "%02x", x));
    return s.toString();
  }

  static void deleteTree(File f) {
    if (f == null || !f.exists()) return;
    File[] kids = f.listFiles();
    if (kids != null) for (File k : kids) deleteTree(k);
    //noinspection ResultOfMethodCallIgnored
    f.delete();
  }

  /** Counts compressed bytes for the progress bar and stops when the user cancels. */
  private static final class CountingStream extends FilterInputStream {
    private final long total; private final Progress progress; private final AtomicBoolean cancel;
    private long done, lastReport;
    CountingStream(InputStream in, long total, Progress progress, AtomicBoolean cancel) { super(in); this.total = total; this.progress = progress; this.cancel = cancel; }
    private void count(long n) throws IOException {
      if (cancel.get()) throw new AudioDecoder.CancelledException();
      if (n > 0) done += n;
      if (done - lastReport > 2_000_000 || done == total) { lastReport = done; progress.update(done, total); }
    }
    @Override public int read() throws IOException { int b = super.read(); count(b >= 0 ? 1 : 0); return b; }
    @Override public int read(byte[] b, int off, int len) throws IOException { int n = super.read(b, off, len); count(n); return n; }
  }
}
