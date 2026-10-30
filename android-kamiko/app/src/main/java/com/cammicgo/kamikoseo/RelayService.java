package com.cammicgo.kamikoseo;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import org.json.JSONObject;

import java.io.IOException;

/**
 * "Mode connecté": a foreground service that polls the CamMicGo relay, fetches the requested
 * YouTube transcripts from this phone (residential IP, not blocked like cloud servers) and
 * posts them back to the remote MCP.
 */
public class RelayService extends Service {
  static final String ACTION_STOP = "com.cammicgo.kamikoseo.STOP_RELAY";
  static final String CHANNEL = "relay";
  static final int NOTIFICATION_ID = 42;

  private volatile boolean running;
  private volatile long pausedUntil;
  private int rateLimitStrikes;
  private Thread loop;

  public static void start(Context c) {
    Intent i = new Intent(c, RelayService.class);
    if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
  }

  public static void stop(Context c) {
    c.startService(new Intent(c, RelayService.class).setAction(ACTION_STOP));
  }

  @Override public IBinder onBind(Intent intent) { return null; }

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && ACTION_STOP.equals(intent.getAction())) {
      RelayClient.prefs(this).edit().putBoolean("connected", false).apply();
      shutdown();
      return START_NOT_STICKY;
    }
    String token = RelayClient.token(this);
    if (token == null) { shutdown(); return START_NOT_STICKY; }

    Notification n = notification("Mode connecté : en attente de demandes");
    if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
    else startForeground(NOTIFICATION_ID, n);
    RelayClient.prefs(this).edit().putBoolean("connected", true).putString("status", "En attente de demandes").apply();

    if (loop == null || !loop.isAlive()) {
      running = true;
      loop = new Thread(this::run, "cammicgo-relay");
      loop.start();
    }
    return START_STICKY;
  }

  /** Android 15 limits dataSync foreground services; stop cleanly when the system asks. */
  @Override public void onTimeout(int startId, int fgsType) {
    status("Mode connecté arrêté par Android (durée maximale atteinte). Réactivez-le dans l’app.");
    RelayClient.prefs(this).edit().putBoolean("connected", false).apply();
    shutdown();
  }

  @Override public void onDestroy() {
    running = false;
    if (loop != null) loop.interrupt();
    super.onDestroy();
  }

  private void shutdown() {
    running = false;
    if (loop != null) loop.interrupt();
    if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
    stopSelf();
  }

  private void run() {
    long backoff = 5000;
    while (running) {
      String token = RelayClient.token(this);
      if (token == null) break;
      try {
        long wait = pausedUntil - System.currentTimeMillis();
        if (wait > 0) { RelayClient.poll(this, token, false); sleep(Math.min(wait, 30_000)); continue; }
        JSONObject res = RelayClient.poll(this, token, true);
        if (backoff > 5000) status("Connexion rétablie : reprise de la file d’attente.");
        backoff = 5000;
        RelayClient.prefs(this).edit().putLong("lastSync", System.currentTimeMillis()).apply();
        JSONObject job = res.optJSONObject("job");
        if (job != null) handle(token, job);
        else if (!isPausedStatus()) status(idleStatus());
        sleep(job != null ? 300 : res.optLong("pollAfterMs", 4000));
      } catch (RelayClient.UnpairedException e) {
        RelayClient.forget(this);
        status("Appareil dissocié par le serveur. Appairez-le à nouveau.");
        break;
      } catch (IOException e) {
        status("Connexion perdue, nouvel essai dans " + backoff / 1000 + " s. La file reprendra là où elle s’est arrêtée.");
        sleep(backoff);
        backoff = Math.min(backoff * 2, 60_000);
      }
    }
    if (running) { RelayClient.prefs(this).edit().putBoolean("connected", false).apply(); shutdown(); }
  }

  private boolean isPausedStatus() { return pausedUntil > System.currentTimeMillis(); }

  private String idleStatus() {
    try {
      String p = RelayClient.prefs(this).getString("progress", null);
      if (p != null) {
        JSONObject o = new JSONObject(p);
        int left = o.optInt("pending") + o.optInt("working");
        if (left > 0) return left + " transcription" + (left > 1 ? "s" : "") + " en attente…";
        return "Terminé : " + o.optInt("done") + " / " + o.optInt("total") + " envoyées. En attente de nouvelles demandes.";
      }
    } catch (Exception ignored) {}
    return "En attente des demandes de votre assistant";
  }

  static boolean isNetwork(IOException e) { return TranscriptFetcher.isNetwork(e); }

  private void handle(String token, JSONObject job) throws IOException {
    String id = job.optString("id"), videoId = job.optString("videoId"), lang = job.optString("language", "original");
    status("Transcription en cours : " + videoId);
    current(videoId);
    TranscriptFetcher.Result r;
    try {
      r = TranscriptFetcher.fetch(videoId, lang);
    } catch (IOException e) {
      String msg = e.getMessage() == null ? "" : e.getMessage();
      if (msg.contains("HTTP 429")) {
        // YouTube rate-limits this phone: give the job back and pause instead of failing the whole queue.
        RelayClient.release(token, id);
        rateLimitStrikes++;
        long pause = Math.min(30, 5L << Math.min(rateLimitStrikes - 1, 3)) * 60_000L;
        pausedUntil = System.currentTimeMillis() + pause;
        status("YouTube limite temporairement ce téléphone. Reprise automatique à "
            + java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT).format(new java.util.Date(pausedUntil)) + ".");
        current(null);
        return;
      }
      if (isNetwork(e)) {
        // Connection dropped while reading YouTube: put the job back, it will be retried.
        try { RelayClient.release(token, id); } catch (IOException ignored) { /* reclaimed automatically after 90 s */ }
        current(null);
        throw e;
      }
      RelayClient.sendError(token, id, msg);
      history(videoId, null, "failed", 0, firstLine(msg));
      status("Échec pour " + videoId + " : " + firstLine(msg));
      current(null);
      return;
    }
    // Upload with retries so a short network drop does not lose a finished transcript.
    String payload = TranscriptFetcher.toJson(r, false);
    IOException lastError = null;
    for (int attempt = 0; attempt < 4 && running; attempt++) {
      try {
        if (attempt > 0) { status("Envoi interrompu, nouvel essai (" + attempt + "/3)…"); sleep(5000L * attempt); }
        RelayClient.sendResult(token, id, payload);
        lastError = null;
        break;
      } catch (RelayClient.UnpairedException e) {
        throw e;
      } catch (IOException e) {
        lastError = e;
        if (!isNetwork(e)) break;
      }
    }
    current(null);
    if (lastError != null) {
      if (isNetwork(lastError)) throw lastError;
      history(videoId, r.title, "failed", r.segments.size(), firstLine(lastError.getMessage()));
      status("Envoi refusé pour " + videoId + " : " + firstLine(lastError.getMessage()));
      return;
    }
    SharedPreferences p = RelayClient.prefs(this);
    p.edit().putInt("jobsDone", p.getInt("jobsDone", 0) + 1).apply();
    history(videoId, r.title, "done", r.segments.size(), null);
    status("Envoyée : " + (r.title != null ? r.title : videoId) + " (" + r.segments.size() + " segments)");
    rateLimitStrikes = 0;
  }

  private void current(String videoId) {
    RelayClient.prefs(this).edit().putString("current", videoId).apply();
  }

  /** Local list of what this device sent, newest first (max 60), shown in the app. */
  private void history(String videoId, String title, String state, int segments, String error) {
    SharedPreferences p = RelayClient.prefs(this);
    try {
      org.json.JSONArray old = new org.json.JSONArray(p.getString("history", "[]"));
      org.json.JSONArray out = new org.json.JSONArray();
      JSONObject e = new JSONObject();
      e.put("videoId", videoId); e.put("title", title == null ? JSONObject.NULL : title); e.put("status", state);
      e.put("segments", segments); e.put("at", System.currentTimeMillis());
      if (error != null) e.put("error", error);
      out.put(e);
      for (int i = 0; i < old.length() && out.length() < 60; i++) out.put(old.get(i));
      p.edit().putString("history", out.toString()).apply();
    } catch (Exception ignored) {}
  }

  private void status(String text) {
    if (text.equals(RelayClient.prefs(this).getString("status", null))) return;
    RelayClient.prefs(this).edit().putString("status", text).apply();
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (running && nm != null) nm.notify(NOTIFICATION_ID, notification(text));
  }

  private Notification notification(String text) {
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    Notification.Builder b;
    if (Build.VERSION.SDK_INT >= 26) {
      if (nm != null && nm.getNotificationChannel(CHANNEL) == null)
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Mode connecté", NotificationManager.IMPORTANCE_LOW));
      b = new Notification.Builder(this, CHANNEL);
    } else {
      b = new Notification.Builder(this);
    }
    PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class),
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, RelayService.class).setAction(ACTION_STOP),
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    try {
      String pr = RelayClient.prefs(this).getString("progress", null);
      if (pr != null) {
        JSONObject o = new JSONObject(pr);
        int total = o.optInt("total"), handled = o.optInt("done") + o.optInt("failed");
        if (total > 1 && o.optInt("pending") + o.optInt("working") > 0) {
          b.setProgress(total, handled, false);
          b.setSubText(handled + " / " + total);
        }
      }
    } catch (Exception ignored) {}
    return b.setSmallIcon(android.R.drawable.stat_notify_sync)
        .setContentTitle("CamMicGo SEO MCP")
        .setContentText(text)
        .setStyle(new Notification.BigTextStyle().bigText(text))
        .setOngoing(true)
        .setContentIntent(open)
        .addAction(new Notification.Action.Builder(null, "Arrêter", stop).build())
        .build();
  }

  private void sleep(long ms) { try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); } }
  private static String firstLine(String s) { if (s == null) return ""; int i = s.indexOf('\n'); return i < 0 ? s : s.substring(0, i); }
}
