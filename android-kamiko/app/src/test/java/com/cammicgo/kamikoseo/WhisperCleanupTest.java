package com.cammicgo.kamikoseo;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class WhisperCleanupTest {
  @Test public void keepsRealVocalisations() {
    assertEquals("Wow oh oh oh oh, flash", WhisperCleanup.clean("Wow oh oh oh oh, flash"));
  }

  @Test public void cutsEndlessSpacedRepetition() {
    StringBuilder b = new StringBuilder("Oh");
    for (int i = 0; i < 40; i++) b.append(" oh");
    String c = WhisperCleanup.clean(b.toString());
    assertTrue(c, c.length() < 20);
  }

  @Test public void cutsEndlessSyllableLoop() {
    StringBuilder b = new StringBuilder();
    for (int i = 0; i < 30; i++) b.append("さえ");
    assertEquals("さえさえさえさえ", WhisperCleanup.clean(b.toString()));
    assertTrue(WhisperCleanup.removedShare(b.toString(), "さえさえさえさえ") > WhisperCleanup.LOOP_RATIO);
  }

  @Test public void cutsRepeatedPhrase() {
    String p = "I'm in the driver's seat ";
    String c = WhisperCleanup.clean(p + p + p + p + p + p);
    assertEquals("I'm in the driver's seat I'm in the driver's seat", c);
  }

  @Test public void dropsStockPhrasesAndAnnotations() {
    assertEquals("", WhisperCleanup.clean("Thank you."));
    assertEquals("", WhisperCleanup.clean(" you "));
    assertEquals("", WhisperCleanup.clean("(upbeat music)"));
    assertEquals("", WhisperCleanup.clean("[Music]"));
    assertEquals("", WhisperCleanup.clean("(音楽)"));
    assertEquals("", WhisperCleanup.clean("♪♪"));
    assertEquals("", WhisperCleanup.clean("Sous-titres réalisés par la communauté d'Amara.org"));
  }

  @Test public void keepsOrdinarySpeech() {
    String s = "Bonjour à tous, merci d'être venus.";
    assertEquals(s, WhisperCleanup.clean(s));
    assertEquals("街を追い越して", WhisperCleanup.clean("街を追い越して"));
  }

  @Test public void languageTag() {
    assertEquals("ja", WhisperCleanup.lang("<|ja|>"));
    assertEquals("en", WhisperCleanup.lang("en"));
    assertEquals("", WhisperCleanup.lang(""));
  }
}
