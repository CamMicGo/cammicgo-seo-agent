package com.cammicgo.kamikoseo;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.text.DateFormat;
import java.util.Date;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final Handler ui = new Handler(Looper.getMainLooper());
  private EditText urlInput, langInput, codeInput;
  private TextView output, relayStatus;
  private Button runButton, copyText, copyJson, share, pairButton, connectButton, unpairButton;
  private LinearLayout pairRow, pairedRow;
  private TranscriptFetcher.Result last;

  private final Runnable refresher = new Runnable() {
    @Override public void run() { refreshRelay(); ui.postDelayed(this, 2000); }
  };

  private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(16), dp(20), dp(16), dp(16));
    root.setBackgroundColor(Color.WHITE);

    LinearLayout header = new LinearLayout(this);
    header.setOrientation(LinearLayout.HORIZONTAL);
    header.setGravity(Gravity.CENTER_VERTICAL);
    ImageView logo = new ImageView(this);
    logo.setImageResource(R.mipmap.ic_launcher);
    header.addView(logo, new LinearLayout.LayoutParams(dp(48), dp(48)));
    TextView title = new TextView(this);
    title.setText("CamMicGo SEO MCP\nTranscriptions YouTube");
    title.setTextSize(18);
    title.setTypeface(Typeface.DEFAULT_BOLD);
    title.setTextColor(Color.rgb(20, 24, 60));
    title.setPadding(dp(12), 0, 0, 0);
    header.addView(title);
    root.addView(header);

    root.addView(buildRelayPanel());

    urlInput = new EditText(this);
    urlInput.setHint("URL YouTube : https://www.youtube.com/watch?v=…");
    urlInput.setSingleLine(true);
    urlInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
    root.addView(urlInput);

    LinearLayout langRow = new LinearLayout(this);
    langRow.setGravity(Gravity.CENTER_VERTICAL);
    TextView langLabel = new TextView(this);
    langLabel.setText("Langue préférée : ");
    langLabel.setTextColor(Color.DKGRAY);
    langRow.addView(langLabel);
    langInput = new EditText(this);
    langInput.setText("en");
    langInput.setSingleLine(true);
    langInput.setEms(4);
    langRow.addView(langInput);
    runButton = new Button(this);
    runButton.setText("Extraire");
    langRow.addView(runButton, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
    root.addView(langRow);

    LinearLayout actions = new LinearLayout(this);
    copyText = new Button(this); copyText.setText("Copier");
    copyJson = new Button(this); copyJson.setText("JSON");
    share = new Button(this); share.setText("Partager");
    LinearLayout.LayoutParams third = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
    actions.addView(copyText, third);
    actions.addView(copyJson, new LinearLayout.LayoutParams(third));
    actions.addView(share, new LinearLayout.LayoutParams(third));
    root.addView(actions);

    output = new TextView(this);
    output.setTextColor(Color.BLACK);
    output.setTextIsSelectable(true);
    output.setTypeface(Typeface.MONOSPACE);
    output.setTextSize(13);
    output.setPadding(0, dp(8), 0, dp(8));
    ScrollView scroll = new ScrollView(this);
    scroll.addView(output);
    root.addView(scroll, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

    setContentView(root);
    setActionsEnabled(false);

    runButton.setOnClickListener(v -> extract());
    copyText.setOnClickListener(v -> { if (last != null) copy(TranscriptFetcher.toText(last), "Transcription copiée"); });
    copyJson.setOnClickListener(v -> { if (last != null) copy(TranscriptFetcher.toJson(last), "JSON copié"); });
    share.setOnClickListener(v -> {
      if (last == null) return;
      Intent send = new Intent(Intent.ACTION_SEND);
      send.setType("text/plain");
      send.putExtra(Intent.EXTRA_SUBJECT, "Transcription YouTube " + last.videoId);
      send.putExtra(Intent.EXTRA_TEXT, TranscriptFetcher.toText(last));
      startActivity(Intent.createChooser(send, "Partager la transcription"));
    });

    handleShare(getIntent());
  }

  // ---------- remote MCP pairing / "Mode connecté" ----------

  private View buildRelayPanel() {
    LinearLayout panel = new LinearLayout(this);
    panel.setOrientation(LinearLayout.VERTICAL);
    panel.setPadding(dp(12), dp(10), dp(12), dp(6));
    GradientDrawable bg = new GradientDrawable();
    bg.setColor(Color.rgb(237, 244, 255));
    bg.setCornerRadius(dp(14));
    bg.setStroke(dp(1), Color.rgb(182, 204, 239));
    panel.setBackground(bg);
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    lp.setMargins(0, dp(12), 0, dp(10));
    panel.setLayoutParams(lp);

    TextView heading = new TextView(this);
    heading.setText("Connexion au serveur MCP");
    heading.setTypeface(Typeface.DEFAULT_BOLD);
    heading.setTextColor(Color.rgb(20, 24, 60));
    panel.addView(heading);

    relayStatus = new TextView(this);
    relayStatus.setTextColor(Color.rgb(35, 61, 97));
    relayStatus.setTextSize(13);
    relayStatus.setPadding(0, dp(2), 0, dp(4));
    panel.addView(relayStatus);

    pairRow = new LinearLayout(this);
    pairRow.setGravity(Gravity.CENTER_VERTICAL);
    codeInput = new EditText(this);
    codeInput.setHint("Code : ABCD-2345");
    codeInput.setSingleLine(true);
    codeInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
    pairRow.addView(codeInput, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
    pairButton = new Button(this);
    pairButton.setText("Appairer");
    pairRow.addView(pairButton);
    panel.addView(pairRow);

    pairedRow = new LinearLayout(this);
    connectButton = new Button(this);
    unpairButton = new Button(this);
    unpairButton.setText("Dissocier");
    pairedRow.addView(connectButton, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 2));
    pairedRow.addView(unpairButton, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
    panel.addView(pairedRow);

    pairButton.setOnClickListener(v -> pair());
    connectButton.setOnClickListener(v -> {
      if (RelayClient.prefs(this).getBoolean("connected", false)) RelayService.stop(this);
      else startConnected();
      ui.postDelayed(this::refreshRelay, 400);
    });
    unpairButton.setOnClickListener(v -> {
      RelayService.stop(this);
      RelayClient.forget(this);
      refreshRelay();
      Toast.makeText(this, "Appareil dissocié sur ce téléphone", Toast.LENGTH_SHORT).show();
    });
    return panel;
  }

  private void pair() {
    final String code = codeInput.getText().toString().trim();
    if (code.replaceAll("[^A-Za-z0-9]", "").length() != 8) { relayStatus.setText("Le code fait 8 caractères, par exemple ABCD-2345."); return; }
    pairButton.setEnabled(false);
    relayStatus.setText("Appairage en cours…");
    final String name = (Build.MANUFACTURER + " " + Build.MODEL).trim();
    worker.execute(() -> {
      String message;
      boolean ok = false;
      try { message = "Appairé : " + RelayClient.pair(this, code, name); ok = true; }
      catch (Exception e) { message = "Échec de l’appairage : " + e.getMessage(); }
      final String m = message; final boolean success = ok;
      runOnUiThread(() -> {
        pairButton.setEnabled(true);
        if (success) { codeInput.setText(""); startConnected(); }
        refreshRelay();
        Toast.makeText(this, m, Toast.LENGTH_LONG).show();
      });
    });
  }

  private void startConnected() {
    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
      requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);
    RelayService.start(this);
  }

  private void refreshRelay() {
    if (relayStatus == null) return;
    SharedPreferences p = RelayClient.prefs(this);
    boolean paired = RelayClient.isPaired(this);
    boolean connected = paired && p.getBoolean("connected", false);
    pairRow.setVisibility(paired ? View.GONE : View.VISIBLE);
    pairedRow.setVisibility(paired ? View.VISIBLE : View.GONE);
    connectButton.setText(connected ? "Arrêter le mode connecté" : "Activer le mode connecté");
    if (!paired) {
      String last = p.getString("status", null);
      relayStatus.setText((last != null && last.contains("dissocié") ? last + "\n" : "")
          + "Non appairé. Demandez à votre assistant IA un code d’appairage (outil device_pairing_code), puis saisissez-le ici.");
      return;
    }
    StringBuilder b = new StringBuilder();
    b.append("Appairé : ").append(p.getString("deviceName", "Android")).append('\n');
    b.append(connected ? "● Mode connecté actif" : "○ Mode connecté arrêté : votre assistant ne peut pas demander de transcription");
    int done = p.getInt("jobsDone", 0);
    if (done > 0) b.append(" · ").append(done).append(" envoyée").append(done > 1 ? "s" : "");
    long sync = p.getLong("lastSync", 0);
    if (connected && sync > 0) b.append("\nDernier contact : ").append(DateFormat.getTimeInstance(DateFormat.MEDIUM).format(new Date(sync)));
    String status = p.getString("status", null);
    if (connected && status != null) b.append('\n').append(status);
    relayStatus.setText(b.toString());
  }

  @Override protected void onResume() { super.onResume(); ui.post(refresher); }
  @Override protected void onPause() { ui.removeCallbacks(refresher); super.onPause(); }

  // ---------- manual extraction ----------

  @Override protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    handleShare(intent);
  }

  @Override protected void onDestroy() {
    worker.shutdownNow();
    super.onDestroy();
  }

  private void handleShare(Intent intent) {
    if (intent != null && Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
      String text = intent.getStringExtra(Intent.EXTRA_TEXT);
      if (text != null) {
        urlInput.setText(text);
        if (TranscriptFetcher.videoId(text) != null) extract();
      }
    }
  }

  private void extract() {
    final String id = TranscriptFetcher.videoId(urlInput.getText().toString());
    if (id == null) { output.setText("URL YouTube invalide."); return; }
    final String lang = langInput.getText().toString();
    runButton.setEnabled(false);
    setActionsEnabled(false);
    last = null;
    output.setText("Extraction en cours…");
    worker.execute(() -> {
      String text;
      TranscriptFetcher.Result result = null;
      try {
        result = TranscriptFetcher.fetch(id, lang);
        text = TranscriptFetcher.toText(result);
      } catch (Exception e) {
        text = "Échec de l’extraction\n\n" + e.getMessage()
            + "\n\nVérifiez la connexion, que la vidéo est publique et qu’elle a des sous-titres (bouton CC).";
      }
      final String shown = text;
      final TranscriptFetcher.Result done = result;
      runOnUiThread(() -> {
        if (isFinishing()) return;
        last = done;
        output.setText(shown);
        runButton.setEnabled(true);
        setActionsEnabled(done != null);
      });
    });
  }

  private void setActionsEnabled(boolean on) {
    copyText.setEnabled(on); copyJson.setEnabled(on); share.setEnabled(on);
  }

  private void copy(String text, String toast) {
    ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
    cm.setPrimaryClip(ClipData.newPlainText("YouTube transcript", text));
    Toast.makeText(this, toast, Toast.LENGTH_SHORT).show();
  }
}
