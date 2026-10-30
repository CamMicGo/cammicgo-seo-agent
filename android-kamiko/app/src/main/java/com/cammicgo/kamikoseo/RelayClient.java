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

  /** Returns the next job ({id, videoId, language}) or null, plus the advised delay in pollAfter[0]. */
  public static JSONObject poll(String token, long[] pollAfter) throws IOException {
    try {
      JSONObject res = new JSONObject(request("GET", "/api/devices/jobs", token, null));
      pollAfter[0] = res.optLong("pollAfterMs", 4000);
      return res.optJSONObject("job");
    } catch (IOException e) {
      throw e;
    } catch (Exception e) {
      throw new IOException("Réponse du serveur invalide.");
    }
  }

  public static void sendResult(String token, String jobId, String transcriptJson) throws IOException {
    request("POST", "/api/devices/jobs/" + jobId, token, "{\"result\":" + transcriptJson + "}");
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

  static String request(String method, String path, String token, String body) throws IOException {
    HttpURLConnection c = (HttpURLConnection) new URL(BASE + path).openConnection();
    try {
      c.setConnectTimeout(12000);
      c.setReadTimeout(20000);
      c.setRequestMethod(method);
      c.setRequestProperty("Accept", "application/json");
      c.setRequestProperty("User-Agent", "CamMicGoAndroid/0.3.0");
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
}
