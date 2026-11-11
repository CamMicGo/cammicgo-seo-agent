package com.cammicgo.kamikoseo;

import android.app.ActivityManager;
import android.content.Context;
import android.net.Uri;

import com.k2fsa.sherpa.onnx.FeatureConfig;
import com.k2fsa.sherpa.onnx.OfflineModelConfig;
import com.k2fsa.sherpa.onnx.OfflineRecognizer;
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OfflineRecognizerResult;
import com.k2fsa.sherpa.onnx.OfflineStream;
import com.k2fsa.sherpa.onnx.OfflineWhisperModelConfig;
import com.k2fsa.sherpa.onnx.SileroVadModelConfig;
import com.k2fsa.sherpa.onnx.SpeechSegment;
import com.k2fsa.sherpa.onnx.Vad;
import com.k2fsa.sherpa.onnx.VadModelConfig;

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
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * On-device speech recognition with Whisper small (int8, sherpa-onnx), used when a video has no
 * YouTube captions. Voice segments are cut with Silero VAD (at most 20 s, Whisper's native window),
 * each is decoded with automatic language detection so songs mixing languages stay readable, then
 * cleaned of Whisper's repetition loops and stock phrases (WhisperCleanup). A segment that loops is
 * decoded again in two halves. Chosen in benchmarks/asr after a comparison of 8 light models on a
 * Japanese/English song: Whisper small (fast) or Whisper turbo (better on songs, slower). Models
 * are downloaded only when the user asks for it,
 * verified file by file (size + SHA-256) and kept in the app's private storage. Audio never leaves
 * the phone.
 */
final class LocalAsr {
  static final int RATE = 16000;

  /** A downloadable Whisper model: official sherpa-onnx release archive, int8 files kept, each verified. */
  static final class Model {
    final String id, label, blurb, url;
    final long downloadBytes, minDeviceRam, minFreeRam;
    final int featureDim;
    /** encoder, decoder, tokens: path in the archive, bytes, SHA-256 (measured from the release files). */
    final String[][] files;
    Model(String id, String label, String blurb, String url, long downloadBytes, int featureDim, long minDeviceRam, long minFreeRam, String[][] files) {
      this.id = id; this.label = label; this.blurb = blurb; this.url = url; this.downloadBytes = downloadBytes;
      this.featureDim = featureDim; this.minDeviceRam = minDeviceRam; this.minFreeRam = minFreeRam; this.files = files;
    }
    long installedBytes() { long s = Long.parseLong(VAD_FILE[1]); for (String[] f : files) s += Long.parseLong(f[1]); return s; }
  }

  /** Fast default: peak memory about 1.4 GB, 2.7-3.5 % WER on speech (emulator test). */
  static final Model SMALL = new Model("whisper-small-int8", "Whisper small", "rapide",
      "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.tar.bz2", 639_387_718L, 80,
      3_500_000_000L, 1_200_000_000L, new String[][] {
      {"small-encoder.int8.onnx", "112442483", "4cbe7b22fa9026b843b60a68640c747de05bafb1a11b57edc0e66c232d9f33a9"},
      {"small-decoder.int8.onnx", "262226114", "acad50b5c782696e91b55914cc5ab4f756f1532f76e22aa6fc615f39fb69a8ee"},
      {"small-tokens.txt", "816730", "b34b360dbb493e781e479794586d661700670d65564001f23024971d1f2fa126"}});
  /** Large-v3-turbo: better on songs and accents, peak memory about 2.7 GB, about twice as slow. */
  static final Model TURBO = new Model("whisper-turbo-int8", "Whisper turbo", "qualité, plus lent",
      "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-turbo.tar.bz2", 563_790_207L, 128,
      5_500_000_000L, 2_300_000_000L, new String[][] {
      {"turbo-encoder.int8.onnx", "674716297", "b02dcdf54f348741e93fe732b67d933c8dcb6735655f710640143081db38878b"},
      {"turbo-decoder.int8.onnx", "361080764", "20accd02388482eb3a46bd615631adfdc85e1eb2c7db9ea3f02a40ffe6b81547"},
      {"turbo-tokens.txt", "816730", "b34b360dbb493e781e479794586d661700670d65564001f23024971d1f2fa126"}});
  static final Model[] MODELS = {SMALL, TURBO};

  static final String VAD_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx";
  static final String[] VAD_FILE = {"silero_vad.onnx", "643854", "9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6"};

  /** Longest voice segment given to Whisper (its window is 30 s; 20 s gave fewer loops on songs). */
  static final float MAX_SEGMENT_SECONDS = 20f;
  /** Longest audio transcribed for one request, so a relay job finishes in reasonable time. */
  static final int MAX_AUDIO_MINUTES = 30;
  static final String PREF_MODEL = "localAsrModel";

  static final class UserError extends IOException { UserError(String m) { super(m); } }
  interface Progress { void update(long done, long total); }
  interface Listener { void segment(double doneSeconds, double totalSeconds, String text); }

  private LocalAsr() {}

  static Model byId(String id) { for (Model m : MODELS) if (m.id.equals(id)) return m; return null; }
  static File dir(Context c, Model m) { return new File(c.getFilesDir(), "asr/" + m.id); }
  private static File marker(Context c, Model m) { return new File(dir(c, m), ".verified"); }

  /** Installed and verified (sizes are rechecked; hashes were checked once, at download). */
  static boolean installed(Context c, Model m) {
    if (!marker(c, m).isFile()) return false;
    for (String[] f : m.files) if (!sized(new File(dir(c, m), f[0]), f[1])) return false;
    return sized(new File(dir(c, m), VAD_FILE[0]), VAD_FILE[1]);
  }
  /** At least one model is ready. */
  static boolean installed(Context c) { return active(c) != null; }
  private static boolean sized(File f, String bytes) { return f.isFile() && f.length() == Long.parseLong(bytes); }

  /** The model chosen by the user if installed, otherwise the first installed one, otherwise null. */
  static Model active(Context c) {
    Model chosen = byId(RelayClient.prefs(c).getString(PREF_MODEL, SMALL.id));
    if (chosen != null && installed(c, chosen)) return chosen;
    for (Model m : MODELS) if (installed(c, m)) return m;
    return null;
  }
  static void choose(Context c, Model m) { RelayClient.prefs(c).edit().putString(PREF_MODEL, m.id).apply(); }
  static String activeLabel(Context c) { Model m = active(c); return m == null ? "Whisper" : m.label; }

  static void delete(Context c, Model m) {
    if (rec != null && m.id.equals(recModel)) release();
    deleteTree(dir(c, m));
  }

  static String size(long bytes) {
    if (bytes >= 1_000_000_000L) return String.format(Locale.FRANCE, "%.2f Go", bytes / 1e9);
    return String.format(Locale.FRANCE, "%d Mo", Math.round(bytes / 1e6));
  }

  /** Downloads the archive once, keeping only the int8 model files, then the VAD; each file is verified. */
  static void download(Context c, Model model, Progress progress, AtomicBoolean cancel) throws IOException {
    long need = model.installedBytes() + 150_000_000L;
    if (c.getFilesDir().getUsableSpace() < need) throw new UserError("Espace insuffisant : il faut " + size(need) + " libres.");
    File tmp = new File(c.getFilesDir(), "asr/download.tmp");
    deleteTree(tmp);
    if (!tmp.mkdirs()) throw new IOException("cannot create " + tmp);
    Map<String, String[]> wanted = new HashMap<>();
    for (String[] f : model.files) wanted.put(f[0], f);
    HttpURLConnection con = open(model.url);
    long total = con.getContentLengthLong() > 0 ? con.getContentLengthLong() : model.downloadBytes;
    int found = 0;
    try (InputStream raw = con.getInputStream();
         CountingStream counted = new CountingStream(raw, total, progress, cancel);
         TarArchiveInputStream tar = new TarArchiveInputStream(new BZip2CompressorInputStream(new BufferedInputStream(counted, 1 << 16)))) {
      TarArchiveEntry e;
      byte[] buf = new byte[1 << 16];
      while ((e = tar.getNextTarEntry()) != null) {
        if (cancel.get()) throw new AudioDecoder.CancelledException();
        String name = e.getName();
        String rel = name.substring(name.lastIndexOf('/') + 1);
        String[] spec = wanted.get(rel);
        if (spec == null || e.isDirectory()) continue;
        writeVerified(tar, new File(tmp, rel), spec, buf);
        found++;
      }
    } finally { con.disconnect(); }
    if (found != model.files.length) throw new UserError("Archive du modèle incomplète, réessaie.");
    HttpURLConnection vad = open(VAD_URL);
    try (InputStream in = vad.getInputStream()) { writeVerified(in, new File(tmp, VAD_FILE[0]), VAD_FILE, new byte[1 << 16]); }
    finally { vad.disconnect(); }
    moveIntoPlace(c, model, tmp);
  }

  private static void moveIntoPlace(Context c, Model model, File src) throws IOException {
    if (rec != null && model.id.equals(recModel)) release();
    File dest = dir(c, model);
    deleteTree(dest);
    File parent = dest.getParentFile();
    if (parent != null && !parent.isDirectory()) parent.mkdirs();
    if (!src.renameTo(dest)) throw new IOException("cannot move model into place");
    try (OutputStream os = new FileOutputStream(marker(c, model))) { os.write(model.id.getBytes()); }
  }

  private static void writeVerified(InputStream in, File out, String[] spec, byte[] buf) throws IOException {
    MessageDigest sha = sha256();
    long written = 0;
    try (OutputStream os = new FileOutputStream(out)) {
      int n;
      while ((n = in.read(buf)) > 0) { os.write(buf, 0, n); sha.update(buf, 0, n); written += n; }
    }
    if (written != Long.parseLong(spec[1]) || !hex(sha.digest()).equals(spec[2]))
      throw new UserError("Fichier du modèle corrompu (" + spec[0] + "), réessaie le téléchargement.");
  }

  /**
   * Installs model files already on the device (a folder in the app's storage) with the same checks
   * as a download. Used by the emulator test (LocalAsrDeviceTest).
   */
  static void installFrom(Context c, Model model, File src) throws IOException {
    byte[] buf = new byte[1 << 16];
    String[][] all = Arrays.copyOf(model.files, model.files.length + 1);
    all[model.files.length] = VAD_FILE;
    for (String[] f : all) {
      File x = new File(src, f[0]);
      if (!sized(x, f[1])) throw new UserError("Fichier du modèle absent ou incomplet : " + f[0]);
      MessageDigest sha = sha256();
      try (InputStream in = new java.io.FileInputStream(x)) { int n; while ((n = in.read(buf)) > 0) sha.update(buf, 0, n); }
      if (!hex(sha.digest()).equals(f[2])) throw new UserError("Fichier du modèle corrompu : " + f[0]);
    }
    moveIntoPlace(c, model, src);
  }

  /** Refuses phones that cannot hold the model, instead of letting Android kill the app. */
  static void checkMemory(Context c, Model m) throws UserError {
    ActivityManager am = (ActivityManager) c.getSystemService(Context.ACTIVITY_SERVICE);
    ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
    am.getMemoryInfo(mi);
    if (mi.totalMem < m.minDeviceRam) throw new UserError("Ce téléphone a trop peu de mémoire (" + size(mi.totalMem) + ") pour " + m.label
        + (m == TURBO ? " : utilise Whisper small." : "."));
    if (mi.availMem < m.minFreeRam) throw new UserError("Mémoire libre insuffisante pour " + m.label + " (" + size(mi.availMem)
        + ", il faut " + size(m.minFreeRam) + ") : ferme d'autres applications et réessaie.");
  }

  private static OfflineRecognizer rec;
  private static String recModel;

  /** Loads the active model (and keeps it loaded until another one is chosen). */
  static synchronized OfflineRecognizer recognizer(Context c) throws IOException {
    Model model = active(c);
    if (model == null) throw new UserError("Aucun modèle Whisper installé : télécharge-en un dans l'application.");
    if (rec != null && model.id.equals(recModel)) return rec;
    release();
    checkMemory(c, model);
    File d = dir(c, model);
    OfflineWhisperModelConfig w = new OfflineWhisperModelConfig();
    w.setEncoder(new File(d, model.files[0][0]).getPath());
    w.setDecoder(new File(d, model.files[1][0]).getPath());
    w.setLanguage("");  // automatic, per segment
    w.setTask("transcribe");
    OfflineModelConfig m = new OfflineModelConfig();
    m.setWhisper(w);
    m.setTokens(new File(d, model.files[2][0]).getPath());
    m.setModelType("whisper");
    m.setNumThreads(threads());
    FeatureConfig feat = new FeatureConfig();
    feat.setSampleRate(RATE);
    feat.setFeatureDim(model.featureDim);
    OfflineRecognizerConfig cfg = new OfflineRecognizerConfig();
    cfg.setFeatConfig(feat);
    cfg.setModelConfig(m);
    try { rec = new OfflineRecognizer(null, cfg); recModel = model.id; }
    catch (IllegalArgumentException e) { throw new UserError("Le modèle n'a pas pu être chargé : supprime-le et télécharge-le à nouveau."); }
    return rec;
  }

  static int threads() { return Math.max(2, Math.min(4, Runtime.getRuntime().availableProcessors() / 2)); }

  static synchronized void release() { if (rec != null) { rec.release(); rec = null; recModel = null; } }

  private static Vad vad(Context c, Model model) {
    SileroVadModelConfig s = new SileroVadModelConfig();
    s.setModel(new File(dir(c, model), VAD_FILE[0]).getPath());
    s.setThreshold(0.3f);            // singing over music scores lower than speech
    s.setMinSilenceDuration(0.4f);
    s.setMinSpeechDuration(0.3f);
    s.setMaxSpeechDuration(MAX_SEGMENT_SECONDS);
    VadModelConfig v = new VadModelConfig();
    v.setSileroVadModelConfig(s);
    v.setSampleRate(RATE);
    v.setNumThreads(1);
    return new Vad(null, v);
  }

  /** One decoded voice segment. */
  private static final class Piece { String text = "", lang = ""; }

  private static Piece decode(OfflineRecognizer r, float[] samples) {
    OfflineStream s = r.createStream();
    try {
      s.acceptWaveform(samples, RATE);
      r.decode(s);
      OfflineRecognizerResult res = r.getResult(s);
      Piece p = new Piece();
      p.text = res.getText() == null ? "" : res.getText().trim();
      p.lang = WhisperCleanup.lang(res.getLang());
      return p;
    } finally { s.release(); }
  }

  /** Decodes, cleans and, if the segment looped, decodes it again in two overlapping halves. */
  static String transcribeSegment(OfflineRecognizer r, float[] samples, String[] langOut) {
    Piece p = decode(r, samples);
    String cleaned = WhisperCleanup.clean(p.text);
    langOut[0] = p.lang;
    if (WhisperCleanup.removedShare(p.text, cleaned) <= WhisperCleanup.LOOP_RATIO || samples.length < 4 * RATE) return cleaned;
    int half = samples.length / 2, overlap = RATE / 4;
    Piece a = decode(r, Arrays.copyOfRange(samples, 0, Math.min(samples.length, half + overlap)));
    Piece b = decode(r, Arrays.copyOfRange(samples, Math.max(0, half - overlap), samples.length));
    String ca = WhisperCleanup.clean(a.text), cb = WhisperCleanup.clean(b.text);
    boolean better = WhisperCleanup.removedShare(a.text, ca) <= WhisperCleanup.LOOP_RATIO
        && WhisperCleanup.removedShare(b.text, cb) <= WhisperCleanup.LOOP_RATIO;
    if (!better) return cleaned;
    if (!a.lang.isEmpty()) langOut[0] = a.lang;
    return (ca + " " + cb).trim();
  }

  /**
   * Transcribes a local audio file (m4a/webm from the temporary YouTube download, or any file
   * Android can decode). The result has the app's usual transcript shape, marked source=local_asr.
   */
  static TranscriptFetcher.Result transcribe(Context c, File audio, AtomicBoolean cancel, Listener listener) throws Exception {
    long t0 = System.currentTimeMillis();
    OfflineRecognizer r = recognizer(c);
    Model model = byId(recModel);
    TranscriptFetcher.Result res = new TranscriptFetcher.Result();
    res.source = "local_asr"; res.model = model.id; res.method = "local-asr-" + model.id.replace("-int8", "");
    final double[] total = {0};
    final Map<String, Integer> langs = new LinkedHashMap<>();
    Vad v = vad(c, model);
    try {
      final int window = 512;
      final float[] pending = new float[window];
      final int[] filled = {0};
      Runnable drain = () -> {
        while (!v.empty()) {
          SpeechSegment seg = v.front();
          v.pop();
          if (cancel.get()) return;
          float[] samples = seg.getSamples();
          double start = seg.getStart() / (double) RATE, dur = samples.length / (double) RATE;
          String[] lang = {""};
          String text = transcribeSegment(r, samples, lang);
          if (!text.isEmpty()) {
            res.segments.add(new TranscriptFetcher.Segment(start, dur, text));
            if (!lang[0].isEmpty()) langs.merge(lang[0], 1, Integer::sum);
          }
          listener.segment(start + dur, total[0], text);
        }
      };
      double decoded = AudioDecoder.decode(c, Uri.fromFile(audio), MAX_AUDIO_MINUTES * 60.0, cancel, d -> total[0] = d, (mono, n) -> {
        for (int i = 0; i < n; i++) {
          pending[filled[0]++] = mono[i];
          if (filled[0] == window) { v.acceptWaveform(pending.clone()); filled[0] = 0; drain.run(); }
        }
        if (cancel.get()) throw new AudioDecoder.CancelledException();
      });
      if (filled[0] > 0) v.acceptWaveform(Arrays.copyOf(pending, filled[0]));
      v.flush();
      drain.run();
      if (cancel.get()) throw new AudioDecoder.CancelledException();
      res.durationSeconds = Math.round(total[0] > 0 ? total[0] : decoded);
      res.truncated = total[0] > decoded + 1 && decoded >= MAX_AUDIO_MINUTES * 60.0 - 1;
    } finally { v.release(); }
    res.processingMs = System.currentTimeMillis() - t0;
    String main = "";
    int best = 0;
    for (Map.Entry<String, Integer> e : langs.entrySet()) {
      res.languagesDetected.add(e.getKey());
      if (e.getValue() > best) { best = e.getValue(); main = e.getKey(); }
    }
    res.language = main.isEmpty() ? "und" : main;
    res.languageName = main.isEmpty() ? "?" : TranscriptFetcher.languageName(main);
    return res;
  }

  /** Status shown while a video without captions is transcribed on the phone. */
  interface VideoProgress { void update(String phase, int percent); }

  /** True when a caption fetch failed only because the video has no caption track. */
  static boolean noCaptions(String error) {
    return error != null && error.startsWith("Aucune piste de sous-titres");
  }

  static final String PREF_FALLBACK = "localAsrFallback";
  /** Local transcription is used for videos without captions once the model is installed, unless turned off. */
  static boolean fallbackEnabled(Context c) {
    return installed(c) && RelayClient.prefs(c).getBoolean(PREF_FALLBACK, true);
  }

  /**
   * Video without captions: downloads its audio temporarily (YouTubeAudioOnly), transcribes it with
   * Whisper small, then deletes the audio. languageHint is the language YouTube declares, if any:
   * kept for the assistant, never forced on Whisper (songs and interviews mix languages).
   */
  static TranscriptFetcher.Result transcribeVideo(Context c, String videoId, String languageHint,
                                                  AtomicBoolean cancel, VideoProgress progress) throws Exception {
    progress.update("audio", -1);
    org.json.JSONObject audio = YouTubeAudioOnly.probeAndDownload(c, videoId);
    File file = new File(audio.getString("savedTo"));
    try {
      if (cancel.get()) throw new AudioDecoder.CancelledException();
      progress.update("transcription", 0);
      TranscriptFetcher.Result r = transcribe(c, file, cancel, (done, total, text) ->
          progress.update("transcription", total > 0 ? (int) Math.min(99, done * 100 / total) : -1));
      if (r.segments.isEmpty()) throw new UserError("Aucune parole reconnue dans l'audio de cette vidéo.");
      r.videoId = videoId;
      r.title = audio.optString("title", null);
      long declared = audio.optLong("durationSeconds", -1);
      if (declared > 0) r.durationSeconds = declared;
      if (languageHint != null && languageHint.matches("[a-z]{2,3}")) r.languageHint = languageHint;
      return r;
    } finally {
      //noinspection ResultOfMethodCallIgnored
      file.delete();
    }
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
