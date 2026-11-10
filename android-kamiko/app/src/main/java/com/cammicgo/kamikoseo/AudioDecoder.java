package com.cammicgo.kamikoseo;

import android.content.Context;
import android.media.AudioFormat;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.net.Uri;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Decodes the audio track of a local file (MP3, M4A/AAC, OGG/Opus, WAV, FLAC, or the sound of an
 * MP4 video) with Android's own codecs, block by block, to 16 kHz mono floats. Nothing is written
 * to disk and the whole file is never held in memory.
 */
final class AudioDecoder {
  interface Sink { void samples(float[] mono16k, int n) throws Exception; }
  interface Info { void duration(double seconds); }

  static final class NoAudioException extends IOException { NoAudioException(String m) { super(m); } }
  static final class CancelledException extends IOException { CancelledException() { super("cancelled"); } }

  /** Returns the number of seconds decoded (stops at maxSeconds). */
  static double decode(Context c, Uri uri, double maxSeconds, AtomicBoolean cancel, Info info, Sink sink) throws Exception {
    MediaExtractor ex = new MediaExtractor();
    MediaCodec codec = null;
    try {
      ex.setDataSource(c, uri, null);
      int track = -1; MediaFormat fmt = null;
      for (int i = 0; i < ex.getTrackCount(); i++) {
        MediaFormat f = ex.getTrackFormat(i);
        String mime = f.getString(MediaFormat.KEY_MIME);
        if (mime != null && mime.startsWith("audio/")) { track = i; fmt = f; break; }
      }
      if (track < 0) throw new NoAudioException("no audio track");
      ex.selectTrack(track);
      if (fmt.containsKey(MediaFormat.KEY_DURATION)) info.duration(fmt.getLong(MediaFormat.KEY_DURATION) / 1e6);
      codec = MediaCodec.createDecoderByType(fmt.getString(MediaFormat.KEY_MIME));
      codec.configure(fmt, null, null, 0);
      codec.start();
      int rate = fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE), channels = fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
      boolean floatPcm = false;
      Resampler rs = new Resampler(rate);
      MediaCodec.BufferInfo bi = new MediaCodec.BufferInfo();
      boolean inputDone = false, outputDone = false;
      long produced = 0; long limit = (long) (maxSeconds * LocalAsr.RATE);
      while (!outputDone) {
        if (cancel.get()) throw new CancelledException();
        if (!inputDone) {
          int in = codec.dequeueInputBuffer(10_000);
          if (in >= 0) {
            ByteBuffer buf = codec.getInputBuffer(in);
            int size = buf == null ? -1 : ex.readSampleData(buf, 0);
            if (size < 0) { codec.queueInputBuffer(in, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inputDone = true; }
            else { codec.queueInputBuffer(in, 0, size, ex.getSampleTime(), 0); ex.advance(); }
          }
        }
        int out = codec.dequeueOutputBuffer(bi, 10_000);
        if (out == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          MediaFormat of = codec.getOutputFormat();
          if (of.containsKey(MediaFormat.KEY_SAMPLE_RATE) && of.getInteger(MediaFormat.KEY_SAMPLE_RATE) != rate) { rate = of.getInteger(MediaFormat.KEY_SAMPLE_RATE); rs = new Resampler(rate); }
          if (of.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) channels = of.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
          floatPcm = of.containsKey(MediaFormat.KEY_PCM_ENCODING) && of.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_FLOAT;
        } else if (out >= 0) {
          ByteBuffer ob = codec.getOutputBuffer(out);
          if (ob != null && bi.size > 0) {
            ob.position(bi.offset); ob.limit(bi.offset + bi.size); ob.order(ByteOrder.LITTLE_ENDIAN);
            int frames = bi.size / (channels * (floatPcm ? 4 : 2));
            float[] mono = new float[frames];
            for (int f = 0; f < frames; f++) {
              float s = 0;
              for (int ch = 0; ch < channels; ch++) s += floatPcm ? ob.getFloat() : ob.getShort() / 32768f;
              mono[f] = s / channels;
            }
            float[] y = rs.process(mono, frames);
            int n = (int) Math.min(y.length, limit - produced);
            if (n > 0) { sink.samples(y, n); produced += n; }
            if (produced >= limit) outputDone = true;
          }
          codec.releaseOutputBuffer(out, false);
          if ((bi.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) outputDone = true;
        }
      }
      return produced / (double) LocalAsr.RATE;
    } finally {
      if (codec != null) { try { codec.stop(); } catch (RuntimeException ignored) {} codec.release(); }
      ex.release();
    }
  }
}
