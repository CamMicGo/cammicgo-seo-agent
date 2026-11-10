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
import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;
import org.json.JSONArray;

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
  private long nextTranscriptAt;
  private Thread loop;


  public static void start(Context c) {
    Intent i = new Intent(c, RelayService.class);
    if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
  }

  public static void stop(Context c) {
    RelayClient.prefs(c).edit().putBoolean("relayDesired", false).putBoolean("connected", false).putLong("lastSync", 0L).apply();
    c.stopService(new Intent(c, RelayService.class));
  }

  @Override public IBinder onBind(Intent intent) { return null; }

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && ACTION_STOP.equals(intent.getAction())) {
      RelayClient.prefs(this).edit().putBoolean("relayDesired", false).putBoolean("connected", false).apply();
      shutdown();
      return START_NOT_STICKY;
    }
    String token = RelayClient.token(this);
    if (token == null) {
      RelayClient.prefs(this).edit().putBoolean("connected", false).putString("lastRelayError", "Association absente : associez de nouveau cet appareil.").apply();
      shutdown(); return START_NOT_STICKY;
    }

    try {
      Notification n = notification(I18n.t(this, "notif_waiting"));
      if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
      else startForeground(NOTIFICATION_ID, n);
    } catch (RuntimeException e) {
      RelayClient.prefs(this).edit().putBoolean("connected", false)
          .putString("lastRelayError", "Notification/service Android : " + e.getClass().getSimpleName() + ": " + firstLine(e.getMessage())).apply();
      stopSelf(); return START_NOT_STICKY;
    }
    RelayClient.prefs(this).edit().putBoolean("connected", true).putString("status", I18n.t(this, "waiting")).putString("lastRelayError", null).apply();

    pausedUntil = RelayClient.prefs(this).getLong("youtubePausedUntil", 0L);
    nextTranscriptAt = RelayClient.prefs(this).getLong("nextTranscriptAt", 0L);
    rateLimitStrikes = RelayClient.prefs(this).getInt("youtube429Strikes", 0);
    running = true;
    if (loop == null || !loop.isAlive()) {
      loop = new Thread(this::run, "cammicgo-relay");
      loop.start();
    }
    return START_STICKY;
  }

  /** Android 15 limits dataSync foreground services; stop cleanly when the system asks. */
  @Override public void onTimeout(int startId, int fgsType) {
    status(I18n.t(this, "android_stopped"));
    RelayClient.prefs(this).edit().putString("lastRelayError", "Android a atteint la limite de durée du service de synchronisation.").apply();
    RelayClient.prefs(this).edit().putBoolean("connected", false).apply();
    shutdown();
  }

  @Override public void onDestroy() {
    running = false;
    if (loop != null) loop.interrupt();
    RelayClient.prefs(this).edit().putBoolean("connected", false).putLong("lastSync", 0L)
        .putString("lastRelayError", RelayClient.prefs(this).getBoolean("relayDesired", false) ? "Service Android interrompu : tentative de reprise à l’ouverture de l’application." : null).apply();
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
        // Legacy manual pause remains user-controlled; new 429s use a timed cooldown.
        if (RelayClient.prefs(this).getBoolean("youtube429ManualPause", false)) {
          RelayClient.poll(this, token, false);
          RelayClient.prefs(this).edit().putLong("lastSync", System.currentTimeMillis()).apply();
          status("YouTube HTTP 429 : extraction en pause. Appuyez sur Réessayer dans Assistant IA.");
          sleep(4000);
          continue;
        }
        pausedUntil = RelayClient.prefs(this).getLong("youtubePausedUntil", 0L);
        // Read persisted retry state on every poll: the UI can clear it while this service is running.
        nextTranscriptAt = RelayClient.prefs(this).getLong("nextTranscriptAt", 0L);
        long wait = pausedUntil - System.currentTimeMillis();
        // A YouTube HTTP 429 pauses only transcript claims, never the server heartbeat.
        // Keep polling through the normal error handler so network failures cannot kill the worker.
        if (wait > 0) {
          status("YouTube a limité ce téléphone (HTTP 429) : transcriptions en pause jusqu’à "
              + java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT).format(new java.util.Date(pausedUntil))
              + ". Reprise automatique, ou « Réessayer maintenant ».");
          RelayClient.poll(this, token, false);
          RelayClient.prefs(this).edit().putLong("lastSync", System.currentTimeMillis()).apply();
          sleep(Math.min(wait, 15_000));
          continue;
        }
        // Poll for status without claiming another YouTube job during the cooldown.
        long now = System.currentTimeMillis();
        boolean mayClaim = now >= nextTranscriptAt;
        JSONObject res = RelayClient.poll(this, token, mayClaim);
        if (backoff > 5000) status(I18n.t(this, "reconnected"));
        backoff = 5000;
        RelayClient.prefs(this).edit().putLong("lastSync", System.currentTimeMillis()).apply();
        JSONObject job = res.optJSONObject("job");
        if (job != null) handle(token, job);
        else if (now < nextTranscriptAt) status("Prochaine transcription autorisée à " + java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT).format(new java.util.Date(nextTranscriptAt)));
        else if (!isPausedStatus()) status(idleStatus());
        sleep(job != null ? 1000 : res.optLong("pollAfterMs", 4000));
      } catch (RelayClient.UnpairedException e) {
        RelayClient.forget(this);
        status(I18n.t(this, "server_unpaired"));
        break;
      } catch (IOException e) {
        RelayClient.prefs(this).edit().putLong("lastSync", 0L).putString("lastRelayError", firstLine(e.getMessage())).apply();
        status(I18n.t(this, "lost", backoff / 1000));
        sleep(backoff);
        backoff = Math.min(backoff * 2, 60_000);
      } catch (RuntimeException e) {
        // A malformed response or an unexpected YouTube parser error must not
        // terminate the foreground relay and strand the rest of a large batch.
        android.util.Log.e("CamMicGoRelay", "Unexpected relay loop error", e);
        String detail = e.getClass().getSimpleName() + ": " + firstLine(e.getMessage());
        RelayClient.prefs(this).edit().putString("lastRelayError", detail).apply();
        status("Erreur temporaire du relais : " + detail);
        current(null);
        sleep(backoff);
        backoff = Math.min(backoff * 2, 60_000);
      }
    }
    if (running) { RelayClient.prefs(this).edit().putBoolean("connected", false).putString("lastRelayError", "Boucle relais terminée sans arrêt demandé.").apply(); shutdown(); }
  }

  private boolean isPausedStatus() { return pausedUntil > System.currentTimeMillis(); }

  private String idleStatus() {
    try {
      String p = RelayClient.prefs(this).getString("progress", null);
      if (p != null) {
        JSONObject o = new JSONObject(p);
        int left = o.optInt("pending") + o.optInt("working");
        if (left > 0) return I18n.t(this, "left_waiting", left);
        return I18n.t(this, "done_waiting", o.optInt("done"), o.optInt("total"));
      }
    } catch (Exception ignored) {}
    return I18n.t(this, "idle");
  }

  static boolean isNetwork(IOException e) { return TranscriptFetcher.isNetwork(e); }

  private void handle(String token, JSONObject job) throws IOException {
    String id = job.optString("id"), videoId = job.optString("videoId"), lang = job.optString("language", "original");
    String agentName = job.optString("agentName", "Assistant inconnu");
    if (job.optString("type").startsWith("notebooklm_")) {
      handleNotebook(token, job);
      return;
    }
    status(I18n.t(this, "working", videoId));
    current(videoId);
    TranscriptFetcher.Result r;
    try {
      r = TranscriptFetcher.fetch(videoId, lang);
    } catch (IOException e) {
      String msg = e.getMessage() == null ? "" : e.getMessage();
      if (msg.contains("HTTP 429")) {
        // This HTTP 429 applies to the failed extraction request, not necessarily the whole phone.
        // Release the job and honor the cooldown without retrying in a tight loop.
        RelayClient.release(token, id);
        rateLimitStrikes++;
        // Default to one hour when the upstream response has no usable Retry-After.
        long delay = 3_600_000L;
        int marker = msg.indexOf("retryAfterMs=");
        if (marker >= 0) {
          String value = msg.substring(marker + 13).split(" ")[0];
          try { delay = Math.min(86_400_000L, Math.max(1000L, Long.parseLong(value))); }
          catch (NumberFormatException ignored) { }
        }
        pausedUntil = System.currentTimeMillis() + delay;
        nextTranscriptAt = pausedUntil;
        RelayClient.prefs(this).edit().putLong("youtubePausedUntil", pausedUntil)
            .putLong("nextTranscriptAt", nextTranscriptAt).putInt("youtube429Strikes", rateLimitStrikes)
            .putBoolean("youtube429ManualPause", false).apply();
        status("YouTube HTTP 429 : reprise automatique après temporisation, connexion serveur maintenue.");
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
      history(videoId, null, "failed", 0, firstLine(msg), agentName);
      status(I18n.t(this, "fail_for", videoId, firstLine(msg)));
      current(null);
      return;
    }
    // Upload with retries so a short network drop does not lose a finished transcript.
    String payload = TranscriptFetcher.toJson(r, false);
    IOException lastError = null;
    for (int attempt = 0; attempt < 4 && running; attempt++) {
      try {
        if (attempt > 0) { status(I18n.t(this, "retry_upload", attempt)); sleep(5000L * attempt); }
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
      history(videoId, r.title, "failed", r.segments.size(), firstLine(lastError.getMessage()), agentName);
      status(I18n.t(this, "refused", videoId, firstLine(lastError.getMessage())));
      return;
    }
    SharedPreferences p = RelayClient.prefs(this);
    p.edit().putInt("jobsDone", p.getInt("jobsDone", 0) + 1).apply();
    history(videoId, r.title, "done", r.segments.size(), null, agentName);
    status(I18n.t(this, "sent", r.title != null ? r.title : videoId, r.segments.size()));
    // Random 1–2 minute delay between successful automatic transcripts; no daily cap.
    nextTranscriptAt = System.currentTimeMillis() + 60_000L + (long)(Math.random() * 60_000L);
    RelayClient.prefs(this).edit().putLong("nextTranscriptAt", nextTranscriptAt).apply();
    // Do not erase the rate-limit history immediately after one successful fetch.
  }

  /** Notebook tasks are tracked separately; never pass them to the YouTube transcript parser. */
  private void handleNotebook(String token, JSONObject job) throws IOException {
    String id=job.optString("id");
    String operation=job.optString("type").replace("notebooklm_", "");
    String title=job.optString("title", job.optString("notebookUrl", "NotebookLM"));
    String actionLabel="create".equals(operation)?"Créer un notebook": "list".equals(operation)?"Lister les notebooks": "delete".equals(operation)?"Supprimer un notebook": "delete_preview".equals(operation)?"Vérifier la suppression": "rename".equals(operation)?"Renommer un notebook": "add_url_source".equals(operation)||"add_text_source".equals(operation)||"add_drive_source".equals(operation)?"Ajouter une source": "source_list".equals(operation)?"Lister les sources": "get".equals(operation)?"Consulter un notebook": "Opération "+operation;
    String label=actionLabel+" · "+title;
    // Show the authenticated MCP client when provided by the server; never infer it.
    String agent=job.optString("agentName", job.optString("agentSource", "")).trim();
    if (!agent.isEmpty()) label=agent+" · "+label;
    notebookHistory(id,label, "working", null, agent);
    status("NotebookLM : "+label);
    try {
      NotebookClient client=new NotebookClient(this);
      JSONObject result;
      if ("create".equals(operation)) result=client.create(job.optString("title"));
      else if ("list".equals(operation)) result=client.list();
      else if ("usage".equals(operation)) result=client.usage();
      else if ("source_list".equals(operation)) result=client.sourceList(job.optString("notebookUrl"));
      else if ("source_describe".equals(operation)) result=client.sourceDescribe(job.optString("notebookUrl"),job.optString("sourceId"));
      else if ("source_get_content".equals(operation)) result=client.sourceContent(job.optString("notebookUrl"),job.optString("sourceId"));
      else if ("note".equals(operation)) result=client.noteManage(job.optString("notebookUrl"),job.optString("action"),job.optString("noteId"),job.optString("title"),job.has("content")?job.optString("content"):null,job.optBoolean("confirm",false));
      else if ("source_rename".equals(operation)) result=client.sourceRename(job.optString("notebookUrl"),job.optString("sourceId"),job.optString("title"));
      else if ("source_sync_drive".equals(operation)) result=client.sourceSyncDrive(job.optString("notebookUrl"),job.optString("sourceId"));
      else if ("source_delete".equals(operation)) result=client.sourceDelete(job.optString("notebookUrl"),job.optString("sourceId"),job.optString("expectedTitle"),job.optBoolean("confirm",false));
      else if ("query".equals(operation)) result=client.queryNotebook(job.optString("notebookUrl"),job.optString("question"));
      else if ("studio_create".equals(operation)) result=client.studioCreateAdvanced(job.optString("notebookUrl"),job.optString("kind"),job.optString("language","fr"),job.optString("focus",""),job.optString("format",""),job.optInt("optionA",1),job.optInt("optionB",2),job.optString("stylePrompt",""),job.has("sourceIds")?new JSONArray(job.optString("sourceIds","[]")):null);
      else if ("studio_revise".equals(operation)) result=client.studioRevise(job.optString("notebookUrl"),job.optString("artifactId"),new JSONArray(job.optString("instructions","[]")));
      else if ("export_artifact".equals(operation)) result=client.exportArtifact(job.optString("notebookUrl"),job.optString("artifactId"),job.optString("title","NotebookLM Export"),job.optString("exportType","docs"));
      else if ("notebook_describe".equals(operation)) result=client.describeNotebook(job.optString("notebookUrl"));
      else if ("chat_configure".equals(operation)) result=client.chatConfigure(job.optString("notebookUrl"),job.optString("goal","default"),job.optString("customPrompt",""),job.optString("responseLength","default"));
      else if ("chat_get".equals(operation)) result=client.chatGet(job.optString("notebookUrl"),job.optInt("limit",20));
      else if ("chat_delete".equals(operation)) result=client.chatDelete(job.optString("notebookUrl"),job.optBoolean("confirm",false));
      else if ("source_search".equals(operation)) result=client.sourceSearch(job.optString("notebookUrl"),job.optString("query"),job.has("sourceIds")?new JSONArray(job.optString("sourceIds","[]")):null,job.optInt("maxResults",8));
      else if ("source_list_drive".equals(operation)) result=client.sourceListDrive(job.optString("notebookUrl"));
      else if ("collection_list".equals(operation)) result=client.collectionList();
      else if ("collection_create".equals(operation)) result=client.collectionCreate(job.optString("name"),new JSONArray(job.optString("notebookUrls","[]")));
      else if ("collection_edit".equals(operation)) result=client.collectionEdit(job.optString("collectionId"),job.optString("name",""),new JSONArray(job.optString("add","[]")),new JSONArray(job.optString("remove","[]")),job.has("emoji")?job.optString("emoji"):null);
      else if ("collection_delete".equals(operation)) result=client.collectionDelete(job.optString("collectionId"),job.optBoolean("confirm",false));
      else if ("research_start".equals(operation)) result=client.researchStart(job.optString("notebookUrl"),job.optString("query"),job.optString("source","web"),job.optString("mode","fast"));
      else if ("research_status".equals(operation)) result=client.researchStatus(job.optString("notebookUrl"),job.optString("taskId"));
      else if ("research_import".equals(operation)) result=client.researchImport(job.optString("notebookUrl"),job.optString("taskId"),new JSONArray(job.optString("sources","[]")),job.optBoolean("confirm",false));
      else if ("studio_status".equals(operation)) result=client.studioStatus(job.optString("notebookUrl"));
      else if ("studio_get".equals(operation)) result=client.studioGet(job.optString("notebookUrl"),job.optString("artifactId"));
      else if ("studio_delete".equals(operation)) result=client.studioDelete(job.optString("notebookUrl"),job.optString("artifactId"),job.optBoolean("confirm",false));
      else if ("artifact_download_link".equals(operation)) result=client.artifactDownloadLink(job.optString("notebookUrl"),job.optString("artifactId"));
      else if ("artifact_download_binary".equals(operation)) result=client.artifactDownloadBinary(job.optString("notebookUrl"),job.optString("artifactId"),token,id);
      else if ("mindmap_create".equals(operation)) result=client.mindMapCreate(job.optString("notebookUrl"),job.optString("title","Mind Map"));
      else if ("notebook_share_status".equals(operation)) result=client.shareStatus(job.optString("notebookUrl"));
      else if ("notebook_share_public".equals(operation)) result=client.sharePublic(job.optString("notebookUrl"),job.optBoolean("makePublic",false),job.optBoolean("confirm",false));
      else if ("notebook_share_invite".equals(operation)) result=client.shareInvite(job.optString("notebookUrl"),job.optString("email"),job.optString("role","viewer"),job.optBoolean("confirm",false));
      else if ("get".equals(operation)) result=client.getNotebook(job.optString("notebookUrl"));
      else if ("delete_preview".equals(operation)) result=client.deletionPreview(job.optString("notebookUrl"));
      else if ("delete".equals(operation)) result=client.deleteNotebook(job.optString("notebookUrl"),job.optString("expectedTitle"),job.optBoolean("confirm",false));
      else if ("rename".equals(operation)) result=client.renameNotebook(job.optString("notebookUrl"),job.optString("title"));
      else if ("add_text_source".equals(operation)) result=client.addText(job.optString("notebookUrl"),job.optString("title"),job.optString("text"));
      else if ("add_drive_source".equals(operation)) result=client.addDrive(job.optString("notebookUrl"),job.optString("documentId"),job.optString("title"),job.optString("mimeType"));
      else if ("add_url_source".equals(operation))
        result=client.addUrl(job.optString("notebookUrl"),job.optString("sourceUrl"));
      else throw new IOException("Opération NotebookLM non prise en charge : "+operation);
      JSONObject body=new JSONObject().put("type","notebooklm").put("result",result);
      RelayClient.request("POST","/api/devices/jobs/"+id,token,body.toString());
      notebookHistory(id,label,"done",null, agent);
      status("NotebookLM : opération exécutée");
    } catch (Throwable ex) {
      // Catch WebView/Android runtime failures too, so no claimed job stays stuck locally.
      android.util.Log.e("CamMicGoNotebook","NotebookLM job failed "+id,ex);
      String error=ex.getMessage()==null?ex.getClass().getSimpleName():ex.getMessage();
      // Persist the failure locally before any network request. A failed error
      // acknowledgement must never leave the UI showing "working" indefinitely.
      notebookHistory(id,label,"failed",error, agent);
      status("NotebookLM : "+error);
      try {
        JSONObject body=new JSONObject().put("type","notebooklm").put("error",error);
        RelayClient.request("POST","/api/devices/jobs/"+id,token,body.toString());
      } catch (Throwable reportFailure) {
        android.util.Log.e("CamMicGoNotebook","Unable to report notebook job failure "+id,reportFailure);
      }
    }
  }

  private void notebookHistory(String jobId,String label,String state,String error,String agent) {
    SharedPreferences p=RelayClient.prefs(this);
    try {
      org.json.JSONArray old=new org.json.JSONArray(p.getString("notebookHistory","[]"));
      org.json.JSONArray out=new org.json.JSONArray();
      JSONObject e=new JSONObject();e.put("jobId",jobId);e.put("label",label);e.put("agentName",agent);
      e.put("status",state);e.put("at",System.currentTimeMillis());
      if(error!=null)e.put("error",error);
      out.put(e);
      for(int i=0;i<old.length()&&out.length()<30;i++){
        JSONObject prior=old.optJSONObject(i);
        if(prior==null||jobId.equals(prior.optString("jobId")))continue;
        // Older entries without job IDs may be stale; never present them as running forever.
        if(!prior.has("jobId")&&"working".equals(prior.optString("status"))){
          prior.put("status","failed");
          prior.put("error","Ancienne opération interrompue avant confirmation");
        }
        out.put(prior);
      }
      // Keep the Assistant IA sent-items archive independent of the NotebookLM operations log.
      org.json.JSONArray sentOld=new org.json.JSONArray(p.getString("assistantNotebookHistory","[]"));
      org.json.JSONArray sentOut=new org.json.JSONArray();
      sentOut.put(e);
      for(int i=0;i<sentOld.length()&&sentOut.length()<60;i++){
        JSONObject prior=sentOld.optJSONObject(i);
        if(prior!=null&&!jobId.equals(prior.optString("jobId")))sentOut.put(prior);
      }
      p.edit().putString("notebookHistory",out.toString()).putString("assistantNotebookHistory",sentOut.toString()).apply();
    } catch(Exception ignored) {}
  }

  private void current(String videoId) {
    RelayClient.prefs(this).edit().putString("current", videoId).apply();
  }

  /** Local list of what this device sent, newest first (max 60), shown in the app. */
  private void history(String videoId, String title, String state, int segments, String error, String agentName) {
    SharedPreferences p = RelayClient.prefs(this);
    try {
      org.json.JSONArray old = new org.json.JSONArray(p.getString("history", "[]"));
      org.json.JSONArray out = new org.json.JSONArray();
      JSONObject e = new JSONObject();
      e.put("videoId", videoId); e.put("title", title == null ? JSONObject.NULL : title); e.put("status", state);
      e.put("segments", segments); e.put("at", System.currentTimeMillis());
      e.put("agentName", agentName);
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
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, I18n.t(this, "channel"), NotificationManager.IMPORTANCE_LOW));
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
        .addAction(new Notification.Action.Builder(null, I18n.t(this, "stop"), stop).build())
        .build();
  }

  private void sleep(long ms) { try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); } }
  private static String firstLine(String s) { if (s == null) return ""; int i = s.indexOf('\n'); return i < 0 ? s : s.substring(0, i); }
}
