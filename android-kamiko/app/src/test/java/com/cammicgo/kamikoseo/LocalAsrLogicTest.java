package com.cammicgo.kamikoseo;

import static org.junit.Assert.*;

import java.util.ArrayList;
import java.util.List;
import org.junit.Test;

public class LocalAsrLogicTest {
  @Test public void segmentsNeverExceedTheLimitAndCoverEverySample() throws Exception {
    List<float[]> segs = new ArrayList<>(); List<Double> starts = new ArrayList<>();
    Segmenter s = new Segmenter(15, (samples, start) -> { segs.add(samples); starts.add(start); });
    float[] block = new float[3200]; long total = 0;
    java.util.Random r = new java.util.Random(1);
    for (int b = 0; b < 600; b++) {               // 120 s of noise with a silence every 7 s
      for (int i = 0; i < block.length; i++) { long t = total + i; block[i] = (t / 16000) % 7 == 0 ? 0f : (float) r.nextGaussian() * 0.1f; }
      s.feed(block, block.length); total += block.length;
    }
    s.finish();
    long sum = 0; double expectStart = 0;
    for (int i = 0; i < segs.size(); i++) {
      assertTrue("segment too long", segs.get(i).length <= 15 * 16000);
      assertEquals(expectStart, starts.get(i), 1e-6);
      expectStart += segs.get(i).length / 16000.0; sum += segs.get(i).length;
    }
    assertEquals(total, sum);
    assertTrue(segs.size() >= 8);
  }

  @Test public void cutsFallInTheSilence() throws Exception {
    List<float[]> segs = new ArrayList<>();
    Segmenter s = new Segmenter(20, (samples, start) -> segs.add(samples));
    float[] a = new float[25 * 16000];
    for (int i = 0; i < a.length; i++) a[i] = (i >= 14 * 16000 && i < 14 * 16000 + 8000) ? 0f : 0.3f;
    s.feed(a, a.length); s.finish();
    double cut = segs.get(0).length / 16000.0;
    assertTrue("cut at " + cut, cut >= 14.0 && cut <= 14.5);
  }

  @Test public void resamplesToSixteenKilohertz() {
    Resampler r = new Resampler(44100);
    int out = 0; float[] block = new float[4410];
    for (int i = 0; i < 100; i++) out += r.process(block, block.length).length; // 10 s
    assertEquals(160000, out, 3);
    Resampler same = new Resampler(16000);
    assertEquals(1600, same.process(new float[1600], 1600).length);
  }

  @Test public void keepsALowToneAfterResampling() {
    Resampler r = new Resampler(48000);
    float[] in = new float[48000];
    for (int i = 0; i < in.length; i++) in[i] = (float) Math.sin(2 * Math.PI * 440 * i / 48000.0);
    float[] y = r.process(in, in.length);
    double e = 0; for (int i = 1600; i < y.length; i++) e += y[i] * y[i];
    assertEquals(0.5, e / (y.length - 1600), 0.05);   // power of a unit sine
  }

  @Test public void guessesTheLanguage() {
    assertEquals("fr", LangGuess.guess("Bienvenue dans ce test, nous allons parler pendant cinq minutes et vous pouvez écouter"));
    assertEquals("en", LangGuess.guess("Welcome to this test, and we are going to speak for five minutes with you"));
    assertEquals("de", LangGuess.guess("Das ist ein Test und wir sprechen nicht mit den Leuten"));
    assertEquals("ja", LangGuess.guess("こんにちは、マイクのテストです"));
    assertEquals("zh", LangGuess.guess("你好，我正在测试麦克风"));
    assertEquals("ko", LangGuess.guess("안녕하세요 마이크 테스트입니다"));
    assertEquals("ru", LangGuess.guess("Привет, это тест микрофона"));
    assertEquals("ar", LangGuess.guess("مرحبا هذا اختبار الميكروفون"));
    assertEquals("", LangGuess.guess("  "));
  }
}
