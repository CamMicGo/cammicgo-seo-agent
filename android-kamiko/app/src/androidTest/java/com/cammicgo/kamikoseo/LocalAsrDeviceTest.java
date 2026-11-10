package com.cammicgo.kamikoseo;

import static org.junit.Assert.assertTrue;
import static org.junit.Assume.assumeTrue;

import android.content.Context;
import android.os.Bundle;
import android.os.Debug;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.BeforeClass;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Real Android run of the local transcription: sherpa-onnx native code, Whisper small, Silero VAD,
 * MediaCodec decoding of AAC (.m4a, the format of the temporary YouTube audio) and the cleanup.
 * CI copies the model and ~5-minute recordings into files/bench/ (benchmarks/asr/emulator.sh).
 * Skipped when those files are absent.
 */
@RunWith(AndroidJUnit4.class)
public class LocalAsrDeviceTest {
  private static Context c;
  private static File bench;

  @BeforeClass public static void install() throws Exception {
    c = InstrumentationRegistry.getInstrumentation().getTargetContext();
    bench = new File(c.getFilesDir(), "bench");
    File model = new File(bench, "asr-model");
    if (!LocalAsr.installed(c) && model.isDirectory()) {
      long t = System.currentTimeMillis();
      LocalAsr.installFrom(c, model);
      report("install", String.format(Locale.ROOT, "verified+installed in %.1fs", (System.currentTimeMillis() - t) / 1000.0));
    }
  }

  private static void report(String key, String value) {
    Bundle b = new Bundle(); b.putString("ASR_" + key, value);
    InstrumentationRegistry.getInstrumentation().sendStatus(0, b);
    android.util.Log.i("ASR_TEST", key + " " + value);
  }

  private static double wer(String ref, String hyp) {
    String[] r = norm(ref), h = norm(hyp);
    int[] d = new int[h.length + 1];
    for (int j = 0; j <= h.length; j++) d[j] = j;
    for (int i = 1; i <= r.length; i++) {
      int prev = d[0]; d[0] = i;
      for (int j = 1; j <= h.length; j++) { int cur = Math.min(Math.min(d[j] + 1, d[j - 1] + 1), prev + (r[i - 1].equals(h[j - 1]) ? 0 : 1)); prev = d[j]; d[j] = cur; }
    }
    return d[h.length] / (double) Math.max(1, r.length);
  }
  private static String[] norm(String s) { return s.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}']+", " ").trim().split("\\s+"); }

  private void run(String lang, double maxWer) throws Exception {
    File audio = new File(bench, "asr-audio/" + lang + ".m4a");
    assumeTrue("bench files missing", LocalAsr.installed(c) && audio.isFile());
    AtomicLong peakPss = new AtomicLong();
    long t = System.currentTimeMillis();
    TranscriptFetcher.Result r = LocalAsr.transcribe(c, audio, new AtomicBoolean(), (done, total, text) -> {
      Debug.MemoryInfo mi = new Debug.MemoryInfo(); Debug.getMemoryInfo(mi);
      peakPss.set(Math.max(peakPss.get(), mi.getTotalPss()));
    });
    double secs = (System.currentTimeMillis() - t) / 1000.0;
    StringBuilder text = new StringBuilder();
    for (TranscriptFetcher.Segment s : r.segments) text.append(s.text).append(' ');
    String ref = new String(Files.readAllBytes(new File(bench, "asr-audio/ref-" + lang + ".txt").toPath()), StandardCharsets.UTF_8);
    double w = wer(ref, text.toString());
    report(lang, String.format(Locale.ROOT, "audio=%ds segments=%d time=%.0fs rtf=%.2f wer=%.1f%% lang=%s detected=%s peakPss=%dMB threads=%d",
        r.durationSeconds, r.segments.size(), secs, secs / Math.max(1, r.durationSeconds), w * 100, r.language, r.languagesDetected,
        peakPss.get() / 1024, LocalAsr.threads()));
    report(lang + "_json", TranscriptFetcher.toJson(r, false).substring(0, 300));
    assertTrue("segments", r.segments.size() > 5);
    assertTrue("timestamps increase", r.segments.get(r.segments.size() - 1).start > r.segments.get(0).start);
    assertTrue("language " + r.language, lang.equals(r.language));
    assertTrue("WER " + w, w <= maxWer);
  }

  @Test public void french() throws Exception { run("fr", 0.15); }
  @Test public void english() throws Exception { run("en", 0.10); }
}
