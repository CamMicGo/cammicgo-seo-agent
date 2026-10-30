package com.cammicgo.kamikoseo;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private EditText urlInput, langInput;
  private TextView output;
  private Button runButton, copyText, copyJson, share;
  private TranscriptFetcher.Result last;

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

    TextView note = new TextView(this);
    note.setText("Collez ou partagez une URL YouTube. La transcription est récupérée depuis ce téléphone.");
    note.setTextColor(Color.DKGRAY);
    note.setPadding(0, dp(12), 0, dp(8));
    root.addView(note);

    urlInput = new EditText(this);
    urlInput.setHint("https://www.youtube.com/watch?v=…");
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
    root.addView(langRow);

    runButton = new Button(this);
    runButton.setText("Extraire la transcription");
    root.addView(runButton);

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
