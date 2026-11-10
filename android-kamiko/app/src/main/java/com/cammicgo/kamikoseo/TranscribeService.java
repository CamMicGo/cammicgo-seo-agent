package com.cammicgo.kamikoseo;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Foreground service for the two long local-ASR jobs: downloading the model and transcribing a file.
 * One job at a time; progress is shown in a notification and read by the app screen from {@link #state}.
 */
public class TranscribeService extends Service {
  static final String ACTION_DOWNLOAD = "com.cammicgo.kamikoseo.ASR_DOWNLOAD";
  static final String ACTION_TRANSCRIBE = "com.cammicgo.kamikoseo.ASR_TRANSCRIBE";
  static final String ACTION_CANCEL = "com.cammicgo.kamikoseo.ASR_CANCEL";
  static final String CHANNEL = "asr";
  static final int NOTIFICATION_ID = 43;

  /** Shared with the screen (polled every 1.5 s). */
  static final class State {
    volatile String job;            // null, "download" or "transcribe"
    volatile double fraction = -1;  // 0..1, -1 unknown
    volatile String detail = "";
    volatile String errorKey; volatile Object[] errorArgs = new Object[0]; volatile String errorText;
    volatile TranscriptFetcher.Result result; volatile long resultSerial;
    volatile boolean cancelled;
  }
  static final State state = new State();
  private static final AtomicBoolean cancel = new AtomicBoolean();

  static boolean busy() { return state.job != null; }

  static void download(Context c) {
    if (busy()) return;
    Intent i = new Intent(c, TranscribeService.class).setAction(ACTION_DOWNLOAD);
    if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
  }

  static void transcribe(Context c, Uri uri, String name, int language, int maxMinutes) {
    if (busy()) return;
    Intent i = new Intent(c, TranscribeService.class).setAction(ACTION_TRANSCRIBE).setData(uri)
        .putExtra("name", name).putExtra("language", language).putExtra("maxMinutes", maxMinutes)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
  }

  static void cancel(Context c) { cancel.set(true); }

  @Override public IBinder onBind(Intent intent) { return null; }

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    String action = intent == null ? null : intent.getAction();
    if (ACTION_CANCEL.equals(action)) { cancel.set(true); return START_NOT_STICKY; }
    boolean dl = ACTION_DOWNLOAD.equals(action);
    if (!dl && !ACTION_TRANSCRIBE.equals(action)) { stopSelf(); return START_NOT_STICKY; }
    if (busy()) return START_NOT_STICKY;
    try {
      Notification n = notification(I18n.t(this, dl ? "asr_notif_download" : "asr_notif_transcribe"), -1);
      if (Build.VERSION.SDK_INT >= 35 && !dl) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING);
      else if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
      else startForeground(NOTIFICATION_ID, n);
    } catch (RuntimeException e) {
      fail(null, e.getClass().getSimpleName() + ": " + e.getMessage()); stopSelf(); return START_NOT_STICKY;
    }
    cancel.set(false);
    state.job = dl ? "download" : "transcribe"; state.fraction = -1; state.detail = "";
    state.errorKey = null; state.errorText = null; state.cancelled = false;
    final Intent job = intent;
    new Thread(() -> run(dl, job), "cammicgo-asr").start();
    return START_NOT_STICKY;
  }

  private void run(boolean dl, Intent job) {
    PowerManager.WakeLock wl = ((PowerManager) getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "cammicgo:asr");
    wl.acquire(4 * 60 * 60 * 1000L);
    try {
      if (dl) {
        LocalAsr.download(this, (done, total) -> {
          state.fraction = total > 0 ? done / (double) total : -1;
          state.detail = LocalAsr.size(done) + " / " + LocalAsr.size(total);
          update(I18n.t(this, "asr_notif_download"), state.fraction);
        }, cancel);
      } else {
        Uri uri = job.getData();
        TranscriptFetcher.Result r = LocalAsr.transcribe(this, uri, job.getStringExtra("name"), job.getIntExtra("language", -1),
            job.getIntExtra("maxMinutes", 90), cancel, (done, total, text) -> {
              state.fraction = total > 0 ? Math.min(1, done / total) : -1;
              state.detail = TranscriptFetcher.clock(done) + (total > 0 ? " / " + TranscriptFetcher.clock(total) : "");
              update(I18n.t(this, "asr_notif_transcribe"), state.fraction);
            });
        if (r.segments.isEmpty()) fail("asr_empty", null);
        else { state.result = r; state.resultSerial++; }
      }
    } catch (AudioDecoder.CancelledException e) {
      state.cancelled = true;
      if (dl) LocalAsr.deleteTree(new java.io.File(getFilesDir(), "asr/download.tmp"));
    } catch (LocalAsr.UserError e) {
      state.errorKey = e.key; state.errorArgs = e.args;
    } catch (AudioDecoder.NoAudioException e) {
      fail("asr_no_audio", null);
    } catch (OutOfMemoryError e) {
      LocalAsr.release(); fail("asr_oom", null);
    } catch (Throwable e) {
      fail(null, e.getClass().getSimpleName() + (e.getMessage() == null ? "" : ": " + e.getMessage()));
    } finally {
      if (wl.isHeld()) wl.release();
      // Free ~1.5 GB as soon as the job ends; the next transcription reloads in a few seconds.
      if (!dl) LocalAsr.release();
      state.job = null;
      stopForeground(true);
      stopSelf();
    }
  }

  private static void fail(String key, String text) {
    state.errorKey = key; state.errorArgs = new Object[0]; state.errorText = text;
  }

  private void update(String title, double fraction) {
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    nm.notify(NOTIFICATION_ID, notification(title, fraction));
  }

  private Notification notification(String title, double fraction) {
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null)
      nm.createNotificationChannel(new NotificationChannel(CHANNEL, I18n.t(this, "asr_title"), NotificationManager.IMPORTANCE_LOW));
    PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, TranscribeService.class).setAction(ACTION_CANCEL), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
    b.setSmallIcon(android.R.drawable.stat_sys_download).setContentTitle(title).setContentText(state.detail)
        .setOngoing(true).setOnlyAlertOnce(true).setContentIntent(open)
        .addAction(new Notification.Action.Builder(null, I18n.t(this, "asr_cancel"), stop).build());
    if (fraction >= 0) b.setProgress(1000, (int) (fraction * 1000), false); else b.setProgress(0, 0, true);
    return b.build();
  }
}
