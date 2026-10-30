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
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.InputFilter;
import android.text.InputType;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.TextWatcher;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.text.style.TypefaceSpan;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.DateFormat;
import java.util.Date;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
  // CamMicGo site palette
  static final int INK = Color.rgb(23, 35, 74), MUTED = Color.rgb(92, 108, 137), BLUE = Color.rgb(39, 100, 223),
      VIOLET = Color.rgb(89, 68, 216), BG = Color.rgb(247, 249, 255), LINE = Color.rgb(223, 232, 247),
      FIELD = Color.rgb(244, 248, 255), GREEN = Color.rgb(22, 163, 74), RED = Color.rgb(200, 50, 50);
  static final int EXPORT_REQUEST = 41;

  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final Handler ui = new Handler(Looper.getMainLooper());
  private EditText urlInput, langInput, codeInput;
  private TextView output, relayDetail, statusLine, resultMeta;
  private Button runButton, pairButton, connectButton;
  private LinearLayout unpairedBox, pairedBox, resultCard;
  private View statusDot;
  private TranscriptFetcher.Result last;
  private String pendingExport;

  private final Runnable refresher = new Runnable() {
    @Override public void run() { refreshRelay(); ui.postDelayed(this, 2000); }
  };

  private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

  // ---------- small design system ----------

  private GradientDrawable shape(int fill, int radiusDp, int stroke) {
    GradientDrawable g = new GradientDrawable();
    g.setColor(fill); g.setCornerRadius(dp(radiusDp));
    if (stroke != 0) g.setStroke(dp(1), stroke);
    return g;
  }

  private LinearLayout card(LinearLayout parent) {
    LinearLayout c = new LinearLayout(this);
    c.setOrientation(LinearLayout.VERTICAL);
    c.setPadding(dp(18), dp(16), dp(18), dp(18));
    c.setBackground(shape(Color.WHITE, 20, LINE));
    c.setElevation(dp(1));
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
    lp.setMargins(0, 0, 0, dp(14));
    parent.addView(c, lp);
    return c;
  }

  private TextView text(LinearLayout parent, String s, int sizeSp, int color, boolean bold) {
    TextView t = new TextView(this);
    t.setText(s); t.setTextSize(sizeSp); t.setTextColor(color);
    if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
    t.setLineSpacing(0, 1.15f);
    if (parent != null) parent.addView(t);
    return t;
  }

  private Button primary(String s) {
    Button b = new Button(this);
    b.setText(s); b.setAllCaps(false); b.setTextColor(Color.WHITE); b.setTextSize(15);
    b.setTypeface(Typeface.DEFAULT_BOLD);
    GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[]{BLUE, VIOLET});
    g.setCornerRadius(dp(14));
    b.setBackground(g);
    b.setPadding(dp(18), dp(12), dp(18), dp(12));
    b.setStateListAnimator(null);
    return b;
  }

  private Button secondary(String s) {
    Button b = new Button(this);
    b.setText(s); b.setAllCaps(false); b.setTextColor(BLUE); b.setTextSize(14);
    b.setTypeface(Typeface.DEFAULT_BOLD);
    b.setBackground(shape(Color.WHITE, 14, Color.rgb(169, 202, 250)));
    b.setPadding(dp(12), dp(10), dp(12), dp(10));
    b.setStateListAnimator(null);
    return b;
  }

  private EditText field(String hint) {
    EditText e = new EditText(this);
    e.setHint(hint); e.setSingleLine(true); e.setTextSize(15);
    e.setTextColor(INK); e.setHintTextColor(Color.rgb(150, 162, 186));
    e.setBackground(shape(FIELD, 14, LINE));
    e.setPadding(dp(14), dp(12), dp(14), dp(12));
    return e;
  }

  private void step(LinearLayout parent, String num, String s) {
    LinearLayout row = new LinearLayout(this);
    row.setGravity(Gravity.CENTER_VERTICAL);
    row.setPadding(0, dp(6), 0, dp(6));
    TextView badge = text(null, num, 13, Color.WHITE, true);
    badge.setGravity(Gravity.CENTER);
    GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{Color.rgb(17, 199, 230), BLUE, VIOLET});
    g.setCornerRadius(dp(9));
    badge.setBackground(g);
    row.addView(badge, new LinearLayout.LayoutParams(dp(26), dp(26)));
    TextView t = text(null, s, 14, INK, false);
    t.setPadding(dp(12), 0, 0, 0);
    row.addView(t, new LinearLayout.LayoutParams(0, -2, 1));
    parent.addView(row);
  }

  private LinearLayout.LayoutParams gapTop(int top) {
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
    lp.topMargin = dp(top);
    return lp;
  }

  // ---------- screen ----------

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().setStatusBarColor(BG);
    if (Build.VERSION.SDK_INT >= 23) getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);

    ScrollView scroll = new ScrollView(this);
    scroll.setBackgroundColor(BG);
    scroll.setFillViewport(true);
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(16), dp(18), dp(16), dp(24));
    scroll.addView(root);

    // Header
    LinearLayout header = new LinearLayout(this);
    header.setGravity(Gravity.CENTER_VERTICAL);
    header.setPadding(0, 0, 0, dp(16));
    ImageView logo = new ImageView(this);
    logo.setImageResource(R.mipmap.ic_launcher);
    header.addView(logo, new LinearLayout.LayoutParams(dp(52), dp(52)));
    LinearLayout titles = new LinearLayout(this);
    titles.setOrientation(LinearLayout.VERTICAL);
    titles.setPadding(dp(12), 0, 0, 0);
    text(titles, "CamMicGo SEO MCP", 19, INK, true);
    text(titles, "Transcriptions YouTube pour votre assistant IA", 13, MUTED, false);
    header.addView(titles, new LinearLayout.LayoutParams(0, -2, 1));
    root.addView(header);

    buildPairingCard(root);
    buildTranscribeCard(root);
    buildResultCard(root);

    setContentView(scroll);
    handleShare(getIntent());
  }

  private void buildPairingCard(LinearLayout root) {
    LinearLayout c = card(root);
    text(c, "Connexion à votre assistant IA", 17, INK, true);
    TextView sub = text(c, "Reliez ce téléphone au serveur MCP CamMicGo : votre assistant pourra alors lui demander des transcriptions.", 13, MUTED, false);
    sub.setPadding(0, dp(4), 0, dp(8));

    unpairedBox = new LinearLayout(this);
    unpairedBox.setOrientation(LinearLayout.VERTICAL);
    step(unpairedBox, "1", "Demandez à votre assistant (Claude, ChatGPT…) : « Donne-moi un code d’appairage CamMicGo ».");
    step(unpairedBox, "2", "Saisissez ici le code reçu. Il est valable 10 minutes.");
    codeInput = field("ABCD-2345");
    codeInput.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
    codeInput.setTextSize(22);
    codeInput.setLetterSpacing(0.12f);
    codeInput.setGravity(Gravity.CENTER);
    codeInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
    codeInput.setFilters(new InputFilter[]{new InputFilter.LengthFilter(9)});
    codeInput.addTextChangedListener(new TextWatcher() {
      boolean editing;
      public void beforeTextChanged(CharSequence s, int a, int b, int c2) {}
      public void onTextChanged(CharSequence s, int a, int b, int c2) {}
      public void afterTextChanged(Editable e) {
        if (editing) return;
        String clean = e.toString().toUpperCase().replaceAll("[^A-Z0-9]", "");
        if (clean.length() > 8) clean = clean.substring(0, 8);
        String formatted = clean.length() > 4 ? clean.substring(0, 4) + "-" + clean.substring(4) : clean;
        if (!formatted.equals(e.toString())) { editing = true; e.replace(0, e.length(), formatted); editing = false; }
      }
    });
    unpairedBox.addView(codeInput, gapTop(8));
    step(unpairedBox, "3", "Appuyez sur « Appairer » puis autorisez les notifications.");
    pairButton = primary("Appairer ce téléphone");
    unpairedBox.addView(pairButton, gapTop(6));
    c.addView(unpairedBox);

    pairedBox = new LinearLayout(this);
    pairedBox.setOrientation(LinearLayout.VERTICAL);
    LinearLayout statusRow = new LinearLayout(this);
    statusRow.setGravity(Gravity.CENTER_VERTICAL);
    statusRow.setPadding(dp(12), dp(10), dp(12), dp(10));
    statusRow.setBackground(shape(FIELD, 14, LINE));
    statusDot = new View(this);
    statusRow.addView(statusDot, new LinearLayout.LayoutParams(dp(10), dp(10)));
    statusLine = text(null, "", 14, INK, true);
    statusLine.setPadding(dp(10), 0, 0, 0);
    statusRow.addView(statusLine, new LinearLayout.LayoutParams(0, -2, 1));
    pairedBox.addView(statusRow);
    relayDetail = text(pairedBox, "", 13, MUTED, false);
    relayDetail.setPadding(dp(2), dp(8), 0, dp(4));
    connectButton = primary("Activer le mode connecté");
    pairedBox.addView(connectButton, gapTop(6));
    Button unpair = new Button(this);
    unpair.setText("Dissocier ce téléphone"); unpair.setAllCaps(false); unpair.setTextColor(RED);
    unpair.setBackgroundColor(Color.TRANSPARENT); unpair.setStateListAnimator(null);
    pairedBox.addView(unpair, gapTop(2));
    c.addView(pairedBox);

    pairButton.setOnClickListener(v -> pair());
    connectButton.setOnClickListener(v -> {
      if (RelayClient.prefs(this).getBoolean("connected", false)) RelayService.stop(this); else startConnected();
      ui.postDelayed(this::refreshRelay, 400);
    });
    unpair.setOnClickListener(v -> {
      RelayService.stop(this);
      RelayClient.forget(this);
      refreshRelay();
      Toast.makeText(this, "Téléphone dissocié", Toast.LENGTH_SHORT).show();
    });
  }

  private void buildTranscribeCard(LinearLayout root) {
    LinearLayout c = card(root);
    text(c, "Transcrire une vidéo vous-même", 17, INK, true);
    TextView sub = text(c, "Partagez une vidéo depuis l’app YouTube vers CamMicGo, ou collez son lien.", 13, MUTED, false);
    sub.setPadding(0, dp(4), 0, dp(10));
    urlInput = field("🔗  Lien YouTube (vidéo, Short ou youtu.be)");
    urlInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
    c.addView(urlInput);
    LinearLayout row = new LinearLayout(this);
    row.setGravity(Gravity.CENTER_VERTICAL);
    langInput = field("Langue : originale");
    langInput.setFilters(new InputFilter[]{new InputFilter.LengthFilter(8)});
    langInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
    row.addView(langInput, new LinearLayout.LayoutParams(0, -2, 1));
    runButton = primary("Transcrire");
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
    lp.leftMargin = dp(10);
    row.addView(runButton, lp);
    c.addView(row, gapTop(10));
    TextView hint = text(c, "Laissez la langue vide pour la langue d’origine, ou tapez un code (fr, es, zh…) : YouTube traduit si besoin.", 12, MUTED, false);
    hint.setPadding(0, dp(8), 0, 0);
    runButton.setOnClickListener(v -> extract());
  }

  private void buildResultCard(LinearLayout root) {
    resultCard = card(root);
    resultCard.setVisibility(View.GONE);
    text(resultCard, "Transcription", 17, INK, true);
    resultMeta = text(resultCard, "", 13, MUTED, false);
    resultMeta.setPadding(0, dp(4), 0, dp(10));
    LinearLayout actions = new LinearLayout(this);
    Button copy = secondary("Copier"), share = secondary("Partager"), export = primary("Exporter ▾");
    actions.addView(copy, new LinearLayout.LayoutParams(0, -2, 1));
    LinearLayout.LayoutParams mid = new LinearLayout.LayoutParams(0, -2, 1);
    mid.setMargins(dp(8), 0, dp(8), 0);
    actions.addView(share, mid);
    actions.addView(export, new LinearLayout.LayoutParams(0, -2, 1));
    resultCard.addView(actions);
    output = text(resultCard, "", 14, INK, false);
    output.setTextIsSelectable(true);
    output.setLineSpacing(dp(3), 1f);
    output.setPadding(dp(2), dp(14), dp(2), 0);

    copy.setOnClickListener(v -> { if (last != null) copy(TranscriptFetcher.toText(last), "Transcription copiée"); });
    share.setOnClickListener(v -> {
      if (last == null) return;
      Intent send = new Intent(Intent.ACTION_SEND);
      send.setType("text/plain");
      send.putExtra(Intent.EXTRA_SUBJECT, "Transcription YouTube " + last.videoId);
      send.putExtra(Intent.EXTRA_TEXT, TranscriptFetcher.toText(last));
      startActivity(Intent.createChooser(send, "Partager la transcription"));
    });
    export.setOnClickListener(v -> {
      if (last == null) return;
      PopupMenu menu = new PopupMenu(this, export);
      menu.getMenu().add(0, 1, 0, "Sous-titres SRT (.srt)");
      menu.getMenu().add(0, 2, 1, "Sous-titres WebVTT (.vtt)");
      menu.getMenu().add(0, 3, 2, "Texte avec horodatages (.txt)");
      menu.getMenu().add(0, 4, 3, "Texte seul (.txt)");
      menu.getMenu().add(0, 5, 4, "JSON format MCP (.json)");
      menu.setOnMenuItemClickListener(item -> {
        String id = last.videoId, lang = last.language;
        switch (item.getItemId()) {
          case 1: save(TranscriptFetcher.toSrt(last), "application/x-subrip", id + "." + lang + ".srt"); break;
          case 2: save(TranscriptFetcher.toVtt(last), "text/vtt", id + "." + lang + ".vtt"); break;
          case 3: save(TranscriptFetcher.toText(last), "text/plain", id + "." + lang + ".txt"); break;
          case 4: save(TranscriptFetcher.toPlain(last), "text/plain", id + "." + lang + ".texte.txt"); break;
          default: save(TranscriptFetcher.toJson(last), "application/json", id + "." + lang + ".json");
        }
        return true;
      });
      menu.show();
    });
  }

  // ---------- pairing / connected mode ----------

  private void pair() {
    final String code = codeInput.getText().toString().trim();
    if (code.replaceAll("[^A-Za-z0-9]", "").length() != 8) { Toast.makeText(this, "Le code fait 8 caractères, par exemple ABCD-2345.", Toast.LENGTH_LONG).show(); return; }
    pairButton.setEnabled(false);
    pairButton.setText("Appairage en cours…");
    final String name = (Build.MANUFACTURER + " " + Build.MODEL).trim();
    worker.execute(() -> {
      String message; boolean ok = false;
      try { message = "Appairé : " + RelayClient.pair(this, code, name); ok = true; }
      catch (Exception e) { message = "Échec de l’appairage : " + e.getMessage(); }
      final String m = message; final boolean success = ok;
      runOnUiThread(() -> {
        pairButton.setEnabled(true);
        pairButton.setText("Appairer ce téléphone");
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
    if (statusLine == null) return;
    SharedPreferences p = RelayClient.prefs(this);
    boolean paired = RelayClient.isPaired(this);
    boolean connected = paired && p.getBoolean("connected", false);
    unpairedBox.setVisibility(paired ? View.GONE : View.VISIBLE);
    pairedBox.setVisibility(paired ? View.VISIBLE : View.GONE);
    if (!paired) return;

    GradientDrawable dot = new GradientDrawable();
    dot.setShape(GradientDrawable.OVAL);
    dot.setColor(connected ? GREEN : Color.rgb(170, 180, 200));
    statusDot.setBackground(dot);
    statusLine.setText((connected ? "Mode connecté actif" : "Mode connecté arrêté") + " · " + p.getString("deviceName", "Android"));
    connectButton.setText(connected ? "Arrêter le mode connecté" : "Activer le mode connecté");

    StringBuilder b = new StringBuilder();
    if (!connected) b.append("Activez le mode connecté pour que votre assistant puisse demander des transcriptions.");
    else {
      int done = p.getInt("jobsDone", 0);
      b.append(done == 0 ? "En attente des demandes de votre assistant." : done + " transcription" + (done > 1 ? "s envoyées" : " envoyée") + " à votre assistant.");
      long sync = p.getLong("lastSync", 0);
      if (sync > 0) b.append("\nDernier contact avec le serveur : ").append(DateFormat.getTimeInstance(DateFormat.MEDIUM).format(new Date(sync)));
      String status = p.getString("status", null);
      if (status != null) b.append('\n').append(status);
    }
    relayDetail.setText(b.toString());
  }

  @Override protected void onResume() { super.onResume(); ui.post(refresher); }
  @Override protected void onPause() { ui.removeCallbacks(refresher); super.onPause(); }

  // ---------- manual extraction ----------

  @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); handleShare(intent); }
  @Override protected void onDestroy() { worker.shutdownNow(); super.onDestroy(); }

  private void handleShare(Intent intent) {
    if (intent != null && Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
      String t = intent.getStringExtra(Intent.EXTRA_TEXT);
      if (t != null) { urlInput.setText(t); if (TranscriptFetcher.videoId(t) != null) extract(); }
    }
  }

  private void extract() {
    final String id = TranscriptFetcher.videoId(urlInput.getText().toString());
    if (id == null) { Toast.makeText(this, "Lien YouTube invalide", Toast.LENGTH_SHORT).show(); return; }
    final String lang = langInput.getText().toString();
    runButton.setEnabled(false);
    runButton.setText("En cours…");
    last = null;
    worker.execute(() -> {
      TranscriptFetcher.Result result = null; String error = null;
      try { result = TranscriptFetcher.fetch(id, lang); } catch (Exception e) { error = e.getMessage(); }
      final TranscriptFetcher.Result done = result; final String err = error;
      runOnUiThread(() -> {
        if (isFinishing()) return;
        runButton.setEnabled(true);
        runButton.setText("Transcrire");
        resultCard.setVisibility(View.VISIBLE);
        last = done;
        if (done == null) {
          resultMeta.setText("Échec de l’extraction");
          output.setText(err + "\n\nVérifiez que la vidéo est publique et possède des sous-titres (bouton CC).");
          return;
        }
        resultMeta.setText(done.languageName + (done.autoGenerated ? " · générée automatiquement" : "") + " · " + done.segments.size() + " segments · vidéo " + done.videoId);
        output.setText(styled(done));
      });
    });
  }

  /** Timecodes in blue monospace bold, text in ink. */
  private CharSequence styled(TranscriptFetcher.Result r) {
    SpannableStringBuilder b = new SpannableStringBuilder();
    for (TranscriptFetcher.Segment s : r.segments) {
      int start = b.length();
      b.append(TranscriptFetcher.clock(s.start)).append("  ");
      b.setSpan(new ForegroundColorSpan(BLUE), start, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
      b.setSpan(new TypefaceSpan("monospace"), start, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
      b.setSpan(new StyleSpan(Typeface.BOLD), start, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
      b.append(s.text).append('\n');
    }
    return b;
  }

  private void copy(String s, String toast) {
    ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
    cm.setPrimaryClip(ClipData.newPlainText("YouTube transcript", s));
    Toast.makeText(this, toast, Toast.LENGTH_SHORT).show();
  }

  /** Lets the user pick where to save the file (Storage Access Framework, no permission needed). */
  private void save(String content, String mime, String fileName) {
    pendingExport = content;
    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE);
    i.setType(mime);
    i.putExtra(Intent.EXTRA_TITLE, fileName);
    try { startActivityForResult(i, EXPORT_REQUEST); }
    catch (Exception e) { copy(content, "Aucun gestionnaire de fichiers : contenu copié"); }
  }

  @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode != EXPORT_REQUEST || resultCode != RESULT_OK || data == null || data.getData() == null || pendingExport == null) return;
    Uri uri = data.getData();
    final String content = pendingExport;
    pendingExport = null;
    worker.execute(() -> {
      String msg;
      try (OutputStream os = getContentResolver().openOutputStream(uri)) {
        if (os == null) throw new Exception("fichier inaccessible");
        os.write(content.getBytes(StandardCharsets.UTF_8));
        msg = "Fichier enregistré";
      } catch (Exception e) { msg = "Échec de l’enregistrement : " + e.getMessage(); }
      final String m = msg;
      runOnUiThread(() -> Toast.makeText(this, m, Toast.LENGTH_SHORT).show());
    });
  }
}
