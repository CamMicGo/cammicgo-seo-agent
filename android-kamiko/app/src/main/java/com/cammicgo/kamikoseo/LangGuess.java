package com.cammicgo.kamikoseo;

import java.util.Locale;

/**
 * Estimates the language of a transcript (Qwen3-ASR detects the language internally but sherpa-onnx
 * does not return it). Scripts decide for Chinese, Japanese, Korean, Arabic and Russian; frequent
 * short words decide between the Latin-script languages. Shown as an estimate in the app.
 */
final class LangGuess {
  private static final String[][] WORDS = {
      {"en", "the and is to of that it you in this we for are with be"},
      {"fr", "le la les et est un une des que pour dans vous nous pas ce qui"},
      {"es", "el la los las y es un una que para en por con no se del"},
      {"de", "der die das und ist ein eine nicht mit zu den wir sie ich auf"},
      {"pt", "o a os as e é um uma que para em não com do da você"},
      {"it", "il la le e è un una che per non con di del sono questo"},
  };

  static String guess(String text) {
    if (text == null || text.trim().isEmpty()) return "";
    int han = 0, kana = 0, hangul = 0, arabic = 0, cyr = 0, latin = 0;
    for (int i = 0; i < text.length(); ) {
      int cp = text.codePointAt(i); i += Character.charCount(cp);
      Character.UnicodeScript s;
      try { s = Character.UnicodeScript.of(cp); } catch (IllegalArgumentException e) { continue; }
      switch (s) {
        case HAN: han++; break;
        case HIRAGANA: case KATAKANA: kana++; break;
        case HANGUL: hangul++; break;
        case ARABIC: arabic++; break;
        case CYRILLIC: cyr++; break;
        case LATIN: latin++; break;
        default: break;
      }
    }
    int max = Math.max(Math.max(han + kana, hangul), Math.max(Math.max(arabic, cyr), latin));
    if (max == 0) return "";
    if (max == hangul) return "ko";
    if (max == han + kana) return kana > 0 && kana * 10 >= han ? "ja" : "zh";
    if (max == arabic) return "ar";
    if (max == cyr) return "ru";
    String[] tokens = text.toLowerCase(Locale.ROOT).split("[^\\p{L}']+");
    String best = "en"; int bestScore = -1;
    for (String[] lang : WORDS) {
      java.util.Set<String> set = new java.util.HashSet<>(java.util.Arrays.asList(lang[1].split(" ")));
      int score = 0;
      for (String t : tokens) if (set.contains(t)) score++;
      if (score > bestScore) { bestScore = score; best = lang[0]; }
    }
    return best;
  }
}
