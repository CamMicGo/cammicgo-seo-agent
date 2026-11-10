package com.cammicgo.kamikoseo;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Talks to the CamMicGo remote MCP relay: pairing, job polling and result upload. */
public final class RelayClient {
  public static final String BASE = "https://seo.cammicgo.com";
  static final String PREFS = "cammicgo_relay";

  /** Thrown when the server no longer recognises this device (revoked or never paired). */
  public static final class UnpairedException extends IOException {
    UnpairedException(String m) { super(m); }
  }

  private RelayClient() {}

  public static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
  public static String token(Context c) { return prefs(c).getString("token", null); }
  public static boolean isPaired(Context c) { return token(c) != null; }

  public static void forget(Context c) {
    prefs(c).edit().remove("token").remove("deviceName").putBoolean("connected", false).apply();
  }

  /** Exchanges the one-time code shown by the MCP tool device_pairing_code for a device token. */
  public static String pair(Context c, String code, String deviceName) throws IOException {
    try {
      JSONObject body = new JSONObject();
      body.put("code", code);
      body.put("name", deviceName);
      JSONObject res = new JSONObject(request("POST", "/api/devices/pair", null, body.toString()));
      String token = res.getString("deviceToken");
      String name = res.optString("name", deviceName);
      prefs(c).edit().putString("token", token).putString("deviceName", name).putInt("jobsDone", 0).apply();
      return name;
    } catch (IOException e) {
      throw e;
    } catch (Exception e) {
      throw new IOException("Réponse d’appairage invalide.");
    }
  }

  /** Polls the relay: returns the full response ({job, progress, pollAfterMs}); stores progress for the UI. */
  public static JSONObject poll(Context c, String token, boolean claim) throws IOException {
    try {
      // While YouTube is paused (HTTP 429), tell the server until when, so assistants can explain it.
      long pausedUntil = prefs(c).getLong("youtubePausedUntil", 0L);
      String q = claim ? "" : "?claim=0" + (pausedUntil > System.currentTimeMillis() ? "&pausedUntil=" + pausedUntil : "");
      JSONObject res = new JSONObject(request("GET", "/api/devices/jobs" + q, token, null));
      JSONObject progress = res.optJSONObject("progress");
      prefs(c).edit().putString("progress", progress == null ? null : progress.toString())
          .putLong("progressAt", System.currentTimeMillis()).apply();
      notifyLinkedIn(c, res.optJSONObject("linkedin"));
      return res;
    } catch (IOException e) {
      throw e;
    } catch (Exception e) {
      throw new IOException("Réponse du serveur invalide.");
    }
  }

  public static void sendResult(String token, String jobId, String transcriptJson) throws IOException {
    request("POST", "/api/devices/jobs/" + jobId, token, "{\"result\":" + transcriptJson + "}");
  }


  /** Puts a claimed job back in the queue so it is retried later. */
  /** Long local work on a claimed job (speech recognition): keeps the claim and reports progress. */
  public static void progress(String token, String jobId, String phase, int percent) throws IOException {
    request("POST", "/api/devices/jobs/" + jobId, token, "{\"progress\":{\"phase\":\"" + ("audio".equals(phase) ? "audio" : "transcription")
        + "\",\"percent\":" + Math.max(-1, Math.min(100, percent)) + "}}");
  }

  public static void release(String token, String jobId) throws IOException {
    request("POST", "/api/devices/jobs/" + jobId, token, "{\"release\":true}");
  }

  public static void sendError(String token, String jobId, String message) throws IOException {
    try {
      JSONObject body = new JSONObject();
      body.put("error", message == null ? "Erreur inconnue" : message);
      request("POST", "/api/devices/jobs/" + jobId, token, body.toString());
    } catch (IOException e) {
      throw e;
    } catch (Exception e) {
      throw new IOException("Envoi de l’erreur impossible.");
    }
  }

  static JSONObject uploadArtifact(String token,String jobId,byte[] bytes,String mime) throws IOException {
    if(bytes==null||bytes.length==0||bytes.length>15_000_000)
      throw new IOException("Artifact must be 1-15 MB");
    HttpURLConnection c=(HttpURLConnection)new URL(BASE+"/api/devices/artifacts/"+jobId).openConnection();
    try{
      c.setConnectTimeout(15000);c.setReadTimeout(60000);c.setRequestMethod("POST");
      c.setRequestProperty("Authorization","Bearer "+token);
      c.setRequestProperty("Content-Type",mime);
      c.setRequestProperty("Accept","application/json");
      c.setDoOutput(true);c.setFixedLengthStreamingMode(bytes.length);
      try(OutputStream os=c.getOutputStream()){os.write(bytes);}
      int status=c.getResponseCode();
      String response=readAll(status>=400?c.getErrorStream():c.getInputStream());
      if(status>=400)throw new IOException("Artifact upload HTTP "+status+": "+serverError(response,"upload failed"));
      try{return new JSONObject(response);}catch(Exception ex){throw new IOException("Invalid artifact upload response",ex);}
    }finally{c.disconnect();}
  }
  static String request(String method, String path, String token, String body) throws IOException {
    HttpURLConnection c = (HttpURLConnection) new URL(BASE + path).openConnection();
    try {
      c.setConnectTimeout(12000);
      c.setReadTimeout(20000);
      c.setRequestMethod(method);
      c.setRequestProperty("Accept", "application/json");
      c.setRequestProperty("User-Agent", "CamMicGoAndroid/0.6.1");
      if (token != null) c.setRequestProperty("Authorization", "Bearer " + token);
      if (body != null) {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json");
        c.setFixedLengthStreamingMode(bytes.length);
        try (OutputStream os = c.getOutputStream()) { os.write(bytes); }
      }
      int status = c.getResponseCode();
      InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
      String text = in == null ? "" : readAll(in);
      if (status == 401) throw new UnpairedException(serverError(text, "Appareil non appairé ou révoqué."));
      if (status >= 400) throw new IOException(serverError(text, "Erreur serveur " + status));
      return text;
    } finally {
      c.disconnect();
    }
  }

  private static String serverError(String text, String fallback) {
    try { String e = new JSONObject(text).optString("error", ""); return e.isEmpty() ? fallback : e; }
    catch (Exception ignored) { return fallback; }
  }

  private static String readAll(InputStream in) throws IOException {
    try (InputStream s = in) {
      ByteArrayOutputStream b = new ByteArrayOutputStream();
      byte[] buf = new byte[8192]; int n;
      while ((n = s.read(buf)) != -1) { b.write(buf, 0, n); if (b.size() > 1_000_000) throw new IOException("Réponse trop volumineuse."); }
      return new String(b.toByteArray(), StandardCharsets.UTF_8);
    }
  }

  /**
   * A LinkedIn command waits on the server (seen without claiming it). LinkedIn commands only run in the open
   * app, with "LinkedIn MCP" allowed: show the waiting command in the app's list and, when the app cannot pick
   * it up by itself, post a notification that opens the LinkedIn tab.
   */
  static void notifyLinkedIn(Context c, JSONObject linkedin) {
    try {
      android.app.NotificationManager nm = (android.app.NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
      JSONObject next = linkedin == null ? null : linkedin.optJSONObject("next");
      // Waiting commands older than the server deadline (10 min) were never picked up: show them as expired.
      android.content.SharedPreferences hp = prefs(c);
      org.json.JSONArray hist = new org.json.JSONArray(hp.getString("linkedinAssistantHistory", "[]"));
      boolean changed = false;
      for (int i = 0; i < hist.length(); i++) {
        JSONObject o = hist.optJSONObject(i);
        if (o != null && "waiting".equals(o.optString("status")) && System.currentTimeMillis() - o.optLong("at") > 10 * 60_000L
            && (next == null || !next.optString("id").equals(o.optString("id")))) { o.put("status", "expired"); changed = true; }
      }
      if (changed) hp.edit().putString("linkedinAssistantHistory", hist.toString()).apply();
      if (next == null) { if (nm != null) nm.cancel(4243); return; }
      String id = next.optString("id");
      String op = next.optString("operation");
      String target = next.isNull("participant") ? "" : next.optString("participant", "");
      String file = next.isNull("file") ? "" : next.optString("file", "");
      String agent = next.isNull("agentName") ? "" : next.optString("agentName", "");
      android.content.SharedPreferences p = prefs(c);
      org.json.JSONArray list = new org.json.JSONArray(p.getString("linkedinAssistantHistory", "[]"));
      boolean known = false;
      for (int i = 0; i < list.length(); i++) { JSONObject o = list.optJSONObject(i); if (o != null && id.equals(o.optString("id"))) known = true; }
      if (!known) {
        JSONObject item = new JSONObject();
        item.put("id", id); item.put("operation", op); item.put("agentName", agent); item.put("status", "waiting");
        item.put("error", ""); item.put("at", System.currentTimeMillis());
        if (!target.isEmpty()) item.put("target", target.length() > 80 ? target.substring(0, 80) : target);
        if (!file.isEmpty()) item.put("file", file);
        list.put(item);
        p.edit().putString("linkedinAssistantHistory", list.toString()).apply();
      }
      if (nm == null || (MainActivity.foreground && MainActivity.linkedinControlOn)) return;
      if (id.equals(p.getString("linkedinNotified", ""))) return;
      p.edit().putString("linkedinNotified", id).apply();
      boolean fr = "fr".equals(I18n.code(c));
      if (android.os.Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel("linkedin") == null)
        nm.createNotificationChannel(new android.app.NotificationChannel("linkedin", "LinkedIn MCP", android.app.NotificationManager.IMPORTANCE_HIGH));
      android.content.Intent open = new android.content.Intent(c, MainActivity.class).putExtra("openLinkedIn", true)
          .addFlags(android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP | android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP);
      android.app.PendingIntent pi = android.app.PendingIntent.getActivity(c, 7, open, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
      String what = (agent.isEmpty() ? (fr ? "Votre assistant" : "Your assistant") : agent) + " · LinkedIn " + op
          + (target.isEmpty() ? "" : " · " + target) + (file.isEmpty() ? "" : " · " + file);
      String how = fr ? "Ouvrez CamMicGo (onglet LinkedIn, « LinkedIn MCP » autorisé) pour l'exécuter. Sans cela, la demande expire dans 10 minutes sans rien faire."
          : "Open CamMicGo (LinkedIn tab, \"LinkedIn MCP\" allowed) to run it. Otherwise it expires in 10 minutes without doing anything.";
      android.app.Notification.Builder b = android.os.Build.VERSION.SDK_INT >= 26 ? new android.app.Notification.Builder(c, "linkedin") : new android.app.Notification.Builder(c);
      nm.notify(4243, b.setSmallIcon(android.R.drawable.stat_notify_chat).setContentTitle(fr ? "Demande LinkedIn en attente" : "LinkedIn request waiting")
          .setContentText(what).setStyle(new android.app.Notification.BigTextStyle().bigText(what + "\n" + how))
          .setAutoCancel(true).setContentIntent(pi).build());
    } catch (Exception ignored) { /* notification is best effort */ }
  }
}
