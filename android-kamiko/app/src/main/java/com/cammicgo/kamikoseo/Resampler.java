package com.cammicgo.kamikoseo;

/**
 * Streaming conversion of mono audio to 16 kHz (the rate Qwen3-ASR expects): a one-pole low-pass
 * at 7 kHz against aliasing, then linear interpolation. State is kept between calls, so the file
 * can be fed in small blocks.
 */
final class Resampler {
  private final double step, alpha;
  private double pos;
  private float prev, lp;
  private boolean started;

  Resampler(int inRate) {
    step = inRate / (double) Segmenter.RATE;
    alpha = inRate > Segmenter.RATE ? 1 - Math.exp(-2 * Math.PI * 7000.0 / inRate) : 1;
  }

  /** Returns the 16 kHz samples for these input samples (possibly empty). */
  float[] process(float[] in, int n) {
    if (n <= 0) return new float[0];
    float[] x = new float[n];
    for (int i = 0; i < n; i++) { lp += alpha * (in[i] - lp); x[i] = lp; }
    if (step == 1.0) return x;
    int cap = (int) Math.ceil((n + 1) / step) + 2, out = 0;
    float[] y = new float[cap];
    if (!started) { started = true; prev = x[0]; pos = 0; }
    // pos is measured from the sample before this block (index -1 = prev).
    while (pos < n - 1 + 1e-9 && out < cap) {
      int i = (int) Math.floor(pos);
      double f = pos - i;
      float a = i < 0 ? prev : x[i], b = i + 1 < n ? x[i + 1] : x[n - 1];
      if (i + 1 >= n) break;
      y[out++] = (float) (a + (b - a) * f);
      pos += step;
    }
    pos -= n;
    prev = x[n - 1];
    float[] r = new float[out];
    System.arraycopy(y, 0, r, 0, out);
    return r;
  }
}
