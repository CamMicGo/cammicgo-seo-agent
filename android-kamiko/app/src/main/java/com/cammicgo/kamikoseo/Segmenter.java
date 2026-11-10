package com.cammicgo.kamikoseo;

import java.util.Arrays;

/**
 * Cuts a stream of 16 kHz mono samples into segments of at most {@code maxSec} seconds, at the
 * quietest 200 ms window between 60 % and 100 % of that length, so words are rarely cut. Only one
 * segment (plus a little slack) is ever held in memory, whatever the length of the file.
 */
final class Segmenter {
  interface Sink { void segment(float[] samples, double startSec) throws Exception; }

  static final int RATE = 16000;
  private final int max, min, win;
  private final float[] buf;
  private int len;
  private long consumed;
  private final Sink sink;

  Segmenter(double maxSec, Sink sink) {
    this.max = (int) (maxSec * RATE);
    this.min = (int) (maxSec * 0.6 * RATE);
    this.win = (int) (0.2 * RATE);
    this.buf = new float[max + RATE];
    this.sink = sink;
  }

  void feed(float[] samples, int n) throws Exception {
    int off = 0;
    while (off < n) {
      int take = Math.min(n - off, buf.length - len);
      System.arraycopy(samples, off, buf, len, take);
      len += take; off += take;
      while (len > max) emit(quietestCut());
    }
  }

  /** Sends what is left (ignores a tail shorter than 0.25 s). */
  void finish() throws Exception {
    if (len >= RATE / 4) emit(len); else { consumed += len; len = 0; }
  }

  /** Seconds of audio already sent or dropped. */
  double position() { return consumed / (double) RATE; }

  int quietestCut() {
    int step = win / 2, best = max;
    double bestEnergy = Double.MAX_VALUE;
    for (int start = min; start + win <= max; start += step) {
      double e = 0;
      for (int k = start; k < start + win; k++) e += buf[k] * buf[k];
      if (e < bestEnergy) { bestEnergy = e; best = start + win / 2; }
    }
    return best;
  }

  private void emit(int n) throws Exception {
    float[] seg = Arrays.copyOf(buf, n);
    double start = consumed / (double) RATE;
    System.arraycopy(buf, n, buf, 0, len - n);
    len -= n; consumed += n;
    sink.segment(seg, start);
  }
}
