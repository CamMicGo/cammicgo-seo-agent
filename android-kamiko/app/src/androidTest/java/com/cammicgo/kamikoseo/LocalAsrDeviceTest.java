package com.cammicgo.kamikoseo;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.junit.Assume.assumeTrue;

import android.app.ActivityManager;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.Debug;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.BeforeClass;
import org.junit.FixMethodOrder;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.MethodSorters;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Real on-device run of the local transcription (sherpa-onnx native code, MediaCodec decoding,
 * segmentation), with the model and the 5-minute recordings copied by CI into files/bench/.
 * Skipped when those files are absent.
 */
@RunWith(AndroidJUnit4.class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
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
    File wav = new File(bench, "asr-audio/" + lang + ".wav");
    assumeTrue("bench files missing", LocalAsr.installed(c) && wav.isFile());
    AtomicLong peakPss = new AtomicLong();
    long t = System.currentTimeMillis();
    TranscriptFetcher.Result r = LocalAsr.transcribe(c, Uri.fromFile(wav), wav.getName(), -1, 90, new AtomicBoolean(), (done, total, text) -> {
      Debug.MemoryInfo mi = new Debug.MemoryInfo(); Debug.getMemoryInfo(mi);
      peakPss.set(Math.max(peakPss.get(), mi.getTotalPss()));
    });
    double secs = (System.currentTimeMillis() - t) / 1000.0;
    StringBuilder text = new StringBuilder();
    for (TranscriptFetcher.Segment s : r.segments) text.append(s.text).append(' ');
    String ref = new String(Files.readAllBytes(new File(bench, "asr-audio/ref-" + lang + ".txt").toPath()), StandardCharsets.UTF_8);
    double w = wer(ref, text.toString());
    ActivityManager.MemoryInfo am = new ActivityManager.MemoryInfo();
    ((ActivityManager) c.getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(am);
    report(lang, String.format(Locale.ROOT, "audio=%ds segments=%d time=%.0fs rtf=%.3f wer=%.1f%% language=%s peakPss=%dMB deviceRam=%dMB",
        r.durationSeconds, r.segments.size(), secs, secs / r.durationSeconds, w * 100, r.language, peakPss.get() / 1024, am.totalMem / 1_000_000));
    report(lang + "_text", text.substring(0, Math.min(300, text.length())));
    assertEquals("local_asr", r.source);
    assertEquals(lang, r.language);
    assertTrue("WER " + w, w < maxWer);
    assertTrue(TranscriptFetcher.toJson(r).contains("\"source\": \"local_asr\""));
    assertTrue(TranscriptFetcher.toMarkdown(r).contains("pas des sous-titres YouTube"));
  }

  @Test public void a_french() throws Exception { run("fr", 0.12); }
  @Test public void b_english() throws Exception { run("en", 0.12); }

  @Test public void c_cancelStopsQuickly() throws Exception {
    File wav = new File(bench, "asr-audio/en.wav");
    assumeTrue(LocalAsr.installed(c) && wav.isFile());
    AtomicBoolean cancel = new AtomicBoolean();
    long t = System.currentTimeMillis();
    try {
      LocalAsr.transcribe(c, Uri.fromFile(wav), "en.wav", -1, 90, cancel, (done, total, text) -> cancel.set(true));
      fail("not cancelled");
    } catch (AudioDecoder.CancelledException expected) {
      report("cancel", String.format(Locale.ROOT, "stopped after %.1fs", (System.currentTimeMillis() - t) / 1000.0));
    }
  }

  @Test public void d_forcedLanguageAndRelease() throws Exception {
    File wav = new File(bench, "asr-audio/fr.wav");
    assumeTrue(LocalAsr.installed(c) && wav.isFile());
    TranscriptFetcher.Result r = LocalAsr.transcribe(c, Uri.fromFile(wav), "fr.wav", 1 /* French */, 1 /* minute */, new AtomicBoolean(), (d, t, x) -> {});
    assertTrue(r.languageForced);
    assertEquals("fr", r.language);
    assertTrue("max length respected", r.durationSeconds <= 61);
    LocalAsr.release();
    report("forced", "fr, " + r.durationSeconds + "s, truncated=" + r.truncated);
  }
}
