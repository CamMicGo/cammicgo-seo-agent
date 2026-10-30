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
    long[] pollAfter = {4000};
    long backoff = 5000;
    while (running) {
      String token = RelayClient.token(this);
      if (token == null) break;
      try {
        long wait = pausedUntil - System.currentTimeMillis();
        if (wait > 0) { RelayClient.ping(token); sleep(Math.min(wait, 60_000)); continue; }
        JSONObject job = RelayClient.poll(token, pollAfter);
        backoff = 5000;
        RelayClient.prefs(this).edit().putLong("lastSync", System.currentTimeMillis()).apply();
        if (job != null) handle(token, job);
        sleep(pollAfter[0]);
      } catch (RelayClient.UnpairedException e) {
        RelayClient.forget(this);
        status("Appareil dissocié par le serveur. Appairez-le à nouveau.");
        break;
      } catch (IOException e) {
        status("Connexion au serveur impossible, nouvel essai… (" + e.getMessage() + ")");
        sleep(backoff);
        backoff = Math.min(backoff * 2, 60_000);
      }
    }
    if (running) { RelayClient.prefs(this).edit().putBoolean("connected", false).apply(); shutdown(); }
  }

  private void handle(String token, JSONObject job) throws IOException {
    String id = job.optString("id"), videoId = job.optString("videoId"), lang = job.optString("language", "en");
    status("Transcription en cours : " + videoId);
    try {
      TranscriptFetcher.Result r = TranscriptFetcher.fetch(videoId, lang);
      RelayClient.sendResult(token, id, TranscriptFetcher.toJson(r, false));
      SharedPreferences p = RelayClient.prefs(this);
      p.edit().putInt("jobsDone", p.getInt("jobsDone", 0) + 1).apply();
      status("Transcription envoyée : " + videoId + " (" + r.segments.size() + " segments)");
    } catch (RelayClient.UnpairedException e) {
      throw e;
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
        return;
      }
      RelayClient.sendError(token, id, msg);
      status("Échec pour " + videoId + " : " + firstLine(msg));
    }
    rateLimitStrikes = 0;
  }

  private void status(String text) {
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
