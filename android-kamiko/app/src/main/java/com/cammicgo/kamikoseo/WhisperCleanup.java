package com.cammicgo.kamikoseo;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Removes the two kinds of Whisper hallucination seen on songs and long videos (benchmarks/asr):
 * endless repetition of a sound or phrase, and stock phrases written over music or silence
 * ("Thank you.", "(upbeat music)", subtitle credits). Real repetitions are kept: a sound is cut
 * after 4 repeats, a phrase after 2. Pure Java so it is unit-tested on the JVM.
 */
final class WhisperCleanup {
  private WhisperCleanup() {}

  static final int MAX_SHORT_REPEATS = 4, MAX_PHRASE_REPEATS = 2;
  private static final String SEP = "[\\s,、。.!?！？~〜-]*";
  /** A short unit (a sound, a syllable, a word) repeated 5 times or more. */
  private static final Pattern SHORT = Pattern.compile("(.{1,8}?)(?:" + SEP + "\\1){" + MAX_SHORT_REPEATS + ",}", Pattern.DOTALL);
  /** A longer phrase repeated 3 times or more. */
  private static final Pattern PHRASE = Pattern.compile("(.{9,80}?)(?:" + SEP + "\\1){" + MAX_PHRASE_REPEATS + ",}", Pattern.DOTALL);
  /** A segment made only of a sound-effect annotation, notes or dots. */
  private static final Pattern ANNOTATION = Pattern.compile("[\\(\\[（【♪*].*[\\)\\]）】♪*]|[♪.…\\s]*");

  /** Whole-segment texts Whisper writes over music or silence, compared lower-case and normalized. */
  static final Set<String> STOCK = new HashSet<>(Arrays.asList(
      "you", "thank you", "thank you.", "thank you very much.", "thanks for watching!", "thanks for watching.",
      "thank you for watching.", "thank you for watching!", "i'm sorry.", "so", "so.", "bye.", "bye-bye.", "okay.",
      "please subscribe.", "subscribe to the channel.",
      "ご視聴ありがとうございました", "ご視聴ありがとうございました。", "チャンネル登録をお願いします", "おやすみなさい。",
      "sous-titres réalisés par la communauté d'amara.org", "sous-titrage st' 501", "merci d'avoir regardé cette vidéo !",
      "merci.", "sous-titrage société radio-canada",
      "subtítulos realizados por la comunidad de amara.org", "¡gracias por ver el video!", "gracias.",
      "untertitel der amara.org-community", "untertitel im auftrag des zdf, 2017", "vielen dank.",
      "sottotitoli creati dalla comunità amara.org", "grazie.",
      "legendas pela comunidade amara.org", "obrigado.",
      "продолжение следует...", "субтитры создавал dimatorzok", "спасибо за внимание.",
      "请不吝点赞 订阅 转发 打赏支持明镜与点点栏目", "字幕by索兰娅", "谢谢观看", "謝謝觀看",
      "시청해주셔서 감사합니다.", "구독과 좋아요 부탁드립니다.",
      "ترجمة نانسي قنقر", "اشتركوا في القناة"));

  /** Cleaned text, or "" when the whole segment is a hallucination. */
  static String clean(String text) {
    if (text == null) return "";
    String t = text.trim();
    t = collapse(SHORT, t, MAX_SHORT_REPEATS);
    t = collapse(PHRASE, t, MAX_PHRASE_REPEATS);
    String n = Normalizer.normalize(t, Normalizer.Form.NFKC).trim().toLowerCase(Locale.ROOT);
    if (STOCK.contains(n) || ANNOTATION.matcher(n).matches()) return "";
    return t;
  }

  /** Share of the text removed by clean(): above LOOP_RATIO the segment is decoded again, cut differently. */
  static double removedShare(String raw, String cleaned) {
    if (raw == null || raw.trim().isEmpty()) return 0;
    return 1.0 - cleaned.length() / (double) raw.trim().length();
  }
  static final double LOOP_RATIO = 0.5;

  private static String collapse(Pattern p, String t, int keep) {
    Matcher m = p.matcher(t);
    StringBuffer out = new StringBuffer();
    while (m.find()) {
      String unit = m.group(1);
      boolean spaced = m.group().matches("(?s).*\\s.*");
      StringBuilder r = new StringBuilder();
      for (int i = 0; i < keep; i++) {
        if (i > 0 && spaced) r.append(' ');
        r.append(spaced ? unit.trim() : unit);
      }
      m.appendReplacement(out, Matcher.quoteReplacement(r.toString()));
    }
    m.appendTail(out);
    return out.toString();
  }

  /** Whisper language tag ("<|ja|>" or "ja") to a plain code, "" if none. */
  static String lang(String tag) {
    if (tag == null) return "";
    String s = tag.replace("<|", "").replace("|>", "").trim().toLowerCase(Locale.ROOT);
    return s.matches("[a-z]{2,3}") ? s : "";
  }
}
