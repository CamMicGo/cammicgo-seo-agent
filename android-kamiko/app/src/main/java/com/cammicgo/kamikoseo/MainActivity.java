package com.cammicgo.kamikoseo;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ClipDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.Editable;
import android.text.InputFilter;
import android.text.InputType;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.text.style.TypefaceSpan;
import android.view.Gravity;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.CookieManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.DateFormat;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Three sections: "Assistant IA" (pairing, connected mode, live progress of the assistant's requests,
 * sent history), "Extraire" (manual transcript of one video) and "Aide".
 */
public class MainActivity extends Activity {
  // CamMicGo site palette
  static final int INK = Color.rgb(23, 35, 74), MUTED = Color.rgb(92, 108, 137), BLUE = Color.rgb(39, 100, 223),
      VIOLET = Color.rgb(89, 68, 216), CYAN = Color.rgb(17, 199, 230), BG = Color.rgb(244, 247, 253),
      LINE = Color.rgb(223, 232, 247), FIELD = Color.rgb(244, 248, 255), GREEN = Color.rgb(22, 163, 74),
      AMBER = Color.rgb(217, 119, 6), RED = Color.rgb(200, 50, 50), GREY = Color.rgb(170, 180, 200);
  static final int EXPORT_REQUEST = 41;
  static final String[] TABS = {"tab_assistant", "tab_extract", "NotebookLM", "LinkedIn", "tab_help"};

  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final Handler ui = new Handler(Looper.getMainLooper());
  private final View[] pages = new View[5];
  private WebView notebookWeb;
  private LinearLayout notebookActions;
  private boolean notebookExpanded = false;
  private Button notebookExpand;
  private LinearLayout appShell;
  private View appHeader, appTabs;
  private WebView linkedinWeb;
  private boolean linkedinExpanded = false;
  private Button linkedinExpand;
  private LinearLayout linkedinActions;
  private boolean linkedinMcpEnabled = false;
  private boolean linkedinPollBusy = false;
  private final Runnable linkedinPoll = new Runnable() {
    @Override public void run() {
      if (!linkedinMcpEnabled || linkedinWeb == null) return;
      if (!linkedinPollBusy && RelayClient.token(MainActivity.this) != null) {
        linkedinPollBusy = true;
        worker.execute(() -> {
          try {
            JSONObject response = new JSONObject(RelayClient.request("GET", "/api/devices/linkedin", RelayClient.token(MainActivity.this), null));
            JSONObject job = response.optJSONObject("job");
            if (job != null) ui.post(() -> executeLinkedInJob(job));
            else ui.post(() -> linkedinPollBusy = false);
          } catch (Exception e) { ui.post(() -> linkedinPollBusy = false); }
        });
      }
      ui.postDelayed(this, 4500);
    }
  };

  private final TextView[] tabViews = new TextView[5];
  private int currentTab = 0;

  // header
  private View chipDot;
  private TextView chipText;
  // assistant tab
  private EditText codeInput;
  private Button pairButton, connectButton, retryYoutubeButton;
  private LinearLayout unpairedBox, pairedBox, historyList, notebookRequests;
  private View statusDot;
  private TextView statusLine, relayDetail;
  private TextView progressCount, progressLabel, progressCurrent, progressNote, progressFreshness, statDone, statWaiting, statFailed;
  private ProgressBar progressBar, progressSpinner;
  private LinearLayout progressStats;
  private String historyShown;
  private Button clearHistory;
  // extract tab
  private EditText urlInput;
  private Spinner langSpinner;
  private TextView langStatus, output, resultMeta;
  private Button runButton;
  private LinearLayout resultCard;
  private String tracksFor;
  private final Runnable loadLanguages = this::loadLanguages;
  private TranscriptFetcher.Result last;
  private String pendingExport;

  private final Runnable refresher = new Runnable() {
    @Override public void run() { recoverRelayIfNeeded(); refreshRelay(); ui.postDelayed(this, 1500); }
  };

  private String t(String key, Object... args) { return I18n.t(this, key, args); }

  private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

  // ---------- small design system ----------

  private GradientDrawable shape(int fill, int radiusDp, int stroke) {
    GradientDrawable g = new GradientDrawable();
    g.setColor(fill); g.setCornerRadius(dp(radiusDp));
    if (stroke != 0) g.setStroke(dp(1), stroke);
    return g;
  }

  private GradientDrawable dot(int color) {
    GradientDrawable d = new GradientDrawable();
    d.setShape(GradientDrawable.OVAL); d.setColor(color);
    return d;
  }

  private LinearLayout card(LinearLayout parent) {
    LinearLayout c = new LinearLayout(this);
    c.setOrientation(LinearLayout.VERTICAL);
    c.setPadding(dp(18), dp(16), dp(18), dp(18));
    c.setBackground(shape(Color.WHITE, 18, LINE));
    c.setElevation(dp(1));
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
    lp.setMargins(0, 0, 0, dp(14));
    parent.addView(c, lp);
    return c;
  }

  /** Small upper-case section label above cards. */
  private void section(LinearLayout parent, String s) {
    TextView t = text(parent, s.toUpperCase(), 11, BLUE, true);
    t.setLetterSpacing(0.12f);
    t.setPadding(dp(4), dp(6), 0, dp(8));
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

  private Button flat(String s, int color) {
    Button b = new Button(this);
    b.setText(s); b.setAllCaps(false); b.setTextColor(color); b.setTextSize(14);
    b.setBackgroundColor(Color.TRANSPARENT); b.setStateListAnimator(null);
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
    GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{CYAN, BLUE, VIOLET});
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

  private LinearLayout page(FrameLayout host, int index) {
    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(16), dp(14), dp(16), dp(28));
    scroll.addView(root);
    host.addView(scroll, new FrameLayout.LayoutParams(-1, -1));
    pages[index] = scroll;
    return root;
  }

  // ---------- screen ----------

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().setStatusBarColor(Color.WHITE);
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);

    LinearLayout shell = new LinearLayout(this);
    shell.setOrientation(LinearLayout.VERTICAL);
    shell.setBackgroundColor(BG);
    shell.setLayoutDirection(I18n.rtl(this) ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR);

    appShell = shell;
    int beforeHeader = shell.getChildCount();
    buildAppBar(shell);
    appHeader = shell.getChildCount() > beforeHeader ? shell.getChildAt(beforeHeader) : null;
    int beforeTabs = shell.getChildCount();
    buildTabs(shell);
    appTabs = shell.getChildCount() > beforeTabs ? shell.getChildAt(beforeTabs) : null;

    FrameLayout host = new FrameLayout(this);
    shell.addView(host, new LinearLayout.LayoutParams(-1, 0, 1));
    buildAssistantPage(page(host, 0));
    buildExtractPage(page(host, 1));
    buildNotebookTab(host);
    buildLinkedInTab(host);
    buildHelpPage(page(host, 4));

    setContentView(shell);
    selectTab(state != null ? state.getInt("tab", 0) : 0);
    handleShare(getIntent());
  }

  @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); out.putInt("tab", currentTab); }

  private void buildAppBar(LinearLayout shell) {
    LinearLayout bar = new LinearLayout(this);
    bar.setGravity(Gravity.CENTER_VERTICAL);
    bar.setBackgroundColor(Color.WHITE);
    bar.setPadding(dp(16), dp(12), dp(16), dp(12));
    bar.setElevation(dp(2));
    ImageView logo = new ImageView(this);
    logo.setImageResource(R.mipmap.ic_launcher);
    bar.addView(logo, new LinearLayout.LayoutParams(dp(40), dp(40)));
    LinearLayout titles = new LinearLayout(this);
    titles.setOrientation(LinearLayout.VERTICAL);
    titles.setPadding(dp(10), 0, dp(8), 0);
    text(titles, "CamMicGo SEO MCP", 17, INK, true);
    text(titles, t("app_sub"), 12, MUTED, false);
    bar.addView(titles, new LinearLayout.LayoutParams(0, -2, 1));

    TextView lang = text(null, "🌐 " + I18n.code(this).toUpperCase(), 12, BLUE, true);
    lang.setPadding(dp(10), dp(6), dp(10), dp(6));
    lang.setBackground(shape(FIELD, 20, LINE));
    lang.setContentDescription(t("language_title"));
    lang.setOnClickListener(v -> pickLanguage());
    LinearLayout.LayoutParams langLp = new LinearLayout.LayoutParams(-2, -2);
    langLp.setMarginEnd(dp(6));
    bar.addView(lang, langLp);

    LinearLayout chip = new LinearLayout(this);
    chip.setGravity(Gravity.CENTER_VERTICAL);
    chip.setPadding(dp(10), dp(6), dp(12), dp(6));
    chip.setBackground(shape(FIELD, 20, LINE));
    chipDot = new View(this);
    chip.addView(chipDot, new LinearLayout.LayoutParams(dp(8), dp(8)));
    chipText = text(null, "", 12, INK, true);
    chipText.setPadding(dp(6), 0, 0, 0);
    chip.addView(chipText);
    chip.setOnClickListener(v -> selectTab(0));
    bar.addView(chip);
    shell.addView(bar, new LinearLayout.LayoutParams(-1, -2));
  }

  /** Lets the user choose one of the 11 languages; the screen is rebuilt in that language. */
  private void pickLanguage() {
    new AlertDialog.Builder(this)
        .setTitle(t("language_title"))
        .setSingleChoiceItems(I18n.NAMES, I18n.index(this), (dlg, which) -> {
          dlg.dismiss();
          if (which == I18n.index(this)) return;
          I18n.set(this, I18n.CODES[which]);
          recreate();
        })
        .setNegativeButton(t("cancel"), null)
        .show();
  }

  private void buildTabs(LinearLayout shell) {
    LinearLayout wrap = new LinearLayout(this);
    wrap.setPadding(dp(16), dp(12), dp(16), dp(2));
    LinearLayout seg = new LinearLayout(this);
    seg.setPadding(dp(4), dp(4), dp(4), dp(4));
    seg.setBackground(shape(Color.rgb(230, 237, 250), 14, 0));
    for (int i = 0; i < TABS.length; i++) {
      final int index = i;
      TextView t = text(null, (i == 2 || i == 3) ? TABS[i] : t(TABS[i]), 12, MUTED, true);
      t.setGravity(Gravity.CENTER);
      t.setSingleLine(true);
      t.setPadding(dp(12), dp(10), dp(12), dp(10));
      t.setOnClickListener(v -> selectTab(index));
      seg.addView(t, new LinearLayout.LayoutParams(-2, -2));
      tabViews[i] = t;
    }
    android.widget.HorizontalScrollView scroller = new android.widget.HorizontalScrollView(this);
    scroller.setHorizontalScrollBarEnabled(false);
    scroller.setFillViewport(false);
    scroller.addView(seg, new android.widget.HorizontalScrollView.LayoutParams(-2, -2));
    wrap.addView(scroller, new LinearLayout.LayoutParams(-1, -2));
    shell.addView(wrap);
  }

  private void selectTab(int index) {
    currentTab = index;
    for (int i = 0; i < pages.length; i++) {
      pages[i].setVisibility(i == index ? View.VISIBLE : View.GONE);
      boolean on = i == index;
      tabViews[i].setTextColor(on ? Color.WHITE : MUTED);
      tabViews[i].setBackground(on ? shape(BLUE, 11, 0) : null);
      tabViews[i].setElevation(on ? dp(1) : 0);
    }
  }

  // ---------- tab 1: assistant ----------

  private void buildAssistantPage(LinearLayout root) {
    section(root, t("sec_connection"));
    LinearLayout c = card(root);
    unpairedBox = new LinearLayout(this);
    unpairedBox.setOrientation(LinearLayout.VERTICAL);
    text(unpairedBox, t("pair_title"), 17, INK, true);
    TextView sub = text(unpairedBox, t("pair_sub"), 13, MUTED, false);
    sub.setPadding(0, dp(4), 0, dp(8));
    step(unpairedBox, "1", t("step1"));
    Button copyAsk = secondary(t("copy_ask"));
    copyAsk.setOnClickListener(v -> copy(t("ask_text"), t("ask_copied")));
    LinearLayout.LayoutParams askLp = gapTop(2);
    askLp.leftMargin = dp(38);
    unpairedBox.addView(copyAsk, askLp);
    step(unpairedBox, "2", t("step2"));
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
    step(unpairedBox, "3", t("step3"));
    pairButton = primary(t("pair_btn"));
    unpairedBox.addView(pairButton, gapTop(6));
    c.addView(unpairedBox);

    pairedBox = new LinearLayout(this);
    pairedBox.setOrientation(LinearLayout.VERTICAL);
    LinearLayout statusRow = new LinearLayout(this);
    statusRow.setGravity(Gravity.CENTER_VERTICAL);
    statusDot = new View(this);
    statusRow.addView(statusDot, new LinearLayout.LayoutParams(dp(12), dp(12)));
    statusLine = text(null, "", 16, INK, true);
    statusLine.setPadding(dp(10), 0, 0, 0);
    statusRow.addView(statusLine, new LinearLayout.LayoutParams(0, -2, 1));
    pairedBox.addView(statusRow);
    relayDetail = text(pairedBox, "", 13, MUTED, false);
    relayDetail.setPadding(dp(22), dp(6), 0, dp(6));
    LinearLayout buttons = new LinearLayout(this);
    buttons.setGravity(Gravity.CENTER_VERTICAL);
    connectButton = primary(t("connect_on"));
    buttons.addView(connectButton, new LinearLayout.LayoutParams(0, -2, 1));
    Button unpair = flat(t("unpair"), RED);
    buttons.addView(unpair);
    pairedBox.addView(buttons, gapTop(6));
    c.addView(pairedBox);
    retryYoutubeButton = secondary("↻  Réessayer l'extraction YouTube (HTTP 429)");
    retryYoutubeButton.setVisibility(View.GONE);
    pairedBox.addView(retryYoutubeButton, gapTop(8));
    retryYoutubeButton.setOnClickListener(v -> new AlertDialog.Builder(this)
        .setTitle("Relancer les transcriptions ?")
        .setMessage("YouTube a renvoyé HTTP 429. Réessayer maintenant peut échouer à nouveau. Les demandes restent en attente tant que vous ne relancez pas.")
        .setPositiveButton("Réessayer", (dialog, which) -> {
          RelayClient.prefs(this).edit().putBoolean("youtube429ManualPause", false)
              .putLong("youtubePausedUntil", 0L).putLong("nextTranscriptAt", 0L)
              .putInt("youtube429Strikes", 0)
              .putString("status", "Nouvelle tentative YouTube demandée par l'utilisateur…").apply();
          refreshRelay();
          Toast.makeText(this, "Reprise demandée : vérifiez le statut de l'extraction.", Toast.LENGTH_LONG).show();
        }).setNegativeButton(t("cancel"), null).show());

    pairButton.setOnClickListener(v -> pair());
    connectButton.setOnClickListener(v -> {
      if (RelayClient.prefs(this).getBoolean("connected", false)
          && System.currentTimeMillis()-RelayClient.prefs(this).getLong("lastSync",0)<30000L) RelayService.stop(this);
      else startConnected();
      ui.postDelayed(this::refreshRelay, 400);
    });
    unpair.setOnClickListener(v -> {
      RelayService.stop(this);
      RelayClient.forget(this);
      refreshRelay();
      Toast.makeText(this, t("unpaired_toast"), Toast.LENGTH_SHORT).show();
    });

    section(root, t("sec_requests"));
    LinearLayout p = card(root);
    LinearLayout head = new LinearLayout(this);
    head.setGravity(Gravity.BOTTOM);
    progressCount = text(null, "—", 30, INK, true);
    head.addView(progressCount);
    progressLabel = text(null, "", 13, MUTED, false);
    progressLabel.setPadding(dp(8), 0, 0, dp(6));
    head.addView(progressLabel, new LinearLayout.LayoutParams(0, -2, 1));
    p.addView(head);
    progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
    GradientDrawable track = shape(Color.rgb(229, 236, 249), 6, 0);
    GradientDrawable fill = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[]{CYAN, BLUE, VIOLET});
    fill.setCornerRadius(dp(6));
    LayerDrawable layers = new LayerDrawable(new Drawable[]{track, new ClipDrawable(fill, Gravity.START, ClipDrawable.HORIZONTAL)});
    layers.setId(0, android.R.id.background);
    layers.setId(1, android.R.id.progress);
    progressBar.setProgressDrawable(layers);
    progressBar.setMax(100);
    p.addView(progressBar, new LinearLayout.LayoutParams(-1, dp(12)));
    progressStats = new LinearLayout(this);
    statDone = stat(progressStats, GREEN, t("stat_sent"));
    statWaiting = stat(progressStats, BLUE, t("stat_waiting"));
    statFailed = stat(progressStats, RED, t("stat_failed"));
    p.addView(progressStats, gapTop(12));
    LinearLayout activityRow = new LinearLayout(this);
    activityRow.setOrientation(LinearLayout.HORIZONTAL);
    activityRow.setGravity(Gravity.CENTER_VERTICAL);
    activityRow.setPadding(0, dp(12), 0, 0);
    progressSpinner = new ProgressBar(this, null, android.R.attr.progressBarStyleSmall);
    LinearLayout.LayoutParams spinnerParams = new LinearLayout.LayoutParams(dp(22), dp(22));
    spinnerParams.setMargins(0, 0, dp(10), 0);
    activityRow.addView(progressSpinner, spinnerParams);
    progressSpinner.setVisibility(View.GONE);
    TextView activityLabel = text(null, t("processing"), 12, BLUE, true);
    activityRow.addView(activityLabel);
    p.addView(activityRow);
    progressSpinner.setTag(activityRow);
    activityRow.setVisibility(View.GONE);
    progressCurrent = text(p, "", 13, INK, true);
    progressCurrent.setPadding(0, dp(12), 0, 0);
    progressCurrent.setMaxLines(2);
    progressCurrent.setEllipsize(TextUtils.TruncateAt.END);
    progressNote = text(p, "", 12, MUTED, false);
    progressNote.setPadding(0, dp(6), 0, 0);
    progressFreshness = text(p, "", 12, MUTED, false);
    progressFreshness.setPadding(0, dp(8), 0, 0);
    Button refreshButton = secondary(t("refresh_now"));
    p.addView(refreshButton, gapTop(8));
    refreshButton.setOnClickListener(v -> {
      if (!RelayClient.isPaired(this)) return;
      refreshButton.setEnabled(false);
      worker.execute(() -> {
        boolean ok = false;
        try {
          RelayClient.poll(this, RelayClient.token(this), false);
          RelayClient.prefs(this).edit().remove("syncError").apply();
          ok = true;
        } catch (Exception ex) {
          RelayClient.prefs(this).edit().putString("syncError", ex.getMessage() == null ? "" : ex.getMessage()).apply();
        }
        final boolean succeeded = ok;
        ui.post(() -> {
          refreshButton.setEnabled(true);
          refreshRelay();
          Toast.makeText(this, t(succeeded ? "refresh_success" : "refresh_failed"), Toast.LENGTH_LONG).show();
        });
      });
    });

    section(root, t("notebook_section"));
    notebookRequests=card(root);
    section(root, t("sec_sent"));
    TextView hint = text(root, t("long_press"), 12, MUTED, false);
    hint.setPadding(dp(4), 0, 0, dp(8));
    LinearLayout h = card(root);
    h.setPadding(dp(6), dp(6), dp(6), dp(6));
    historyList = new LinearLayout(this);
    historyList.setOrientation(LinearLayout.VERTICAL);
    h.addView(historyList);
    clearHistory = flat(t("clear_list"), RED);
    clearHistory.setOnClickListener(v -> new AlertDialog.Builder(this)
        .setTitle(t("clear_title"))
        .setMessage(t("clear_msg"))
        .setPositiveButton(t("clear_ok"), (dlg, which) -> {
          SharedPreferences prefs = RelayClient.prefs(this);
          prefs.edit().putString("history", "[]").putString("assistantNotebookHistory", "[]").apply();
          historyShown = null;
          refreshHistory(prefs);
        })
        .setNegativeButton(t("cancel"), null)
        .show());
    h.addView(clearHistory, new LinearLayout.LayoutParams(-1, -2));
  }

  /** Removes one entry (videoId + time) or, with videoId null, the whole list. */
  private void editHistory(String videoId, long at) {
    SharedPreferences p = RelayClient.prefs(this);
    JSONArray out = new JSONArray();
    if (videoId != null) {
      try {
        JSONArray old = new JSONArray(p.getString("history", "[]"));
        for (int i = 0; i < old.length(); i++) {
          JSONObject e = old.optJSONObject(i);
          if (e != null && !(videoId.equals(e.optString("videoId")) && e.optLong("at") == at)) out.put(e);
        }
      } catch (Exception ignored) {}
    }
    p.edit().putString("history", out.toString()).apply();
    historyShown = null;
    refreshHistory(p);
  }

  private TextView stat(LinearLayout row, int color, String label) {
    LinearLayout box = new LinearLayout(this);
    box.setOrientation(LinearLayout.VERTICAL);
    box.setPadding(dp(10), dp(8), dp(10), dp(8));
    box.setBackground(shape(FIELD, 12, LINE));
    TextView n = text(box, "0", 18, color, true);
    text(box, label, 11, MUTED, false);
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
    if (row.getChildCount() > 0) lp.leftMargin = dp(8);
    row.addView(box, lp);
    return n;
  }

  // ---------- tab 2: extract ----------

  private void buildExtractPage(LinearLayout root) {
    section(root, t("sec_transcribe"));
    LinearLayout c = card(root);
    text(c, t("extract_title"), 17, INK, true);
    TextView sub = text(c, t("extract_sub"), 13, MUTED, false);
    sub.setPadding(0, dp(4), 0, dp(10));
    urlInput = field(t("url_hint"));
    urlInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
    c.addView(urlInput);
    TextView langTitle = text(c, t("language"), 13, INK, true);
    langTitle.setPadding(dp(2), dp(12), 0, dp(6));
    langSpinner = new Spinner(this);
    langSpinner.setBackground(shape(FIELD, 14, LINE));
    langSpinner.setPadding(dp(6), dp(4), dp(6), dp(4));
    setTracks(null);
    c.addView(langSpinner, new LinearLayout.LayoutParams(-1, dp(48)));
    langStatus = text(c, t("lang_hint"), 12, MUTED, false);
    langStatus.setPadding(dp(2), dp(6), 0, 0);
    runButton = primary(t("transcribe"));
    c.addView(runButton, gapTop(12));
    urlInput.addTextChangedListener(new TextWatcher() {
      public void beforeTextChanged(CharSequence s, int a, int b, int c2) {}
      public void onTextChanged(CharSequence s, int a, int b, int c2) {}
      public void afterTextChanged(Editable e) { ui.removeCallbacks(loadLanguages); ui.postDelayed(loadLanguages, 600); }
    });
    runButton.setOnClickListener(v -> extract());

    resultCard = card(root);
    resultCard.setVisibility(View.GONE);
    text(resultCard, t("transcript"), 17, INK, true);
    resultMeta = text(resultCard, "", 13, MUTED, false);
    resultMeta.setPadding(0, dp(4), 0, dp(10));
    LinearLayout actions = new LinearLayout(this);
    Button copy = secondary(t("copy_btn")), share = secondary(t("share_btn"));
    actions.addView(copy, new LinearLayout.LayoutParams(0, -2, 1));
    LinearLayout.LayoutParams right = new LinearLayout.LayoutParams(0, -2, 1);
    right.leftMargin = dp(8);
    actions.addView(share, right);
    resultCard.addView(actions);

    TextView exportTitle = text(resultCard, t("export"), 14, INK, true);
    exportTitle.setPadding(0, dp(14), 0, dp(6));
    String[][] formats = {
        {"SRT", t("fmt_srt")}, {"VTT", t("fmt_vtt")}, {"TXT", t("fmt_txt")},
        {t("fmt_plain_label"), t("fmt_plain")}, {"JSON", t("fmt_json")}, {"Markdown", "NotebookLM · .md"}};
    LinearLayout row = null;
    for (int i = 0; i < formats.length; i++) {
      if (i % 3 == 0) { row = new LinearLayout(this); resultCard.addView(row, gapTop(i == 0 ? 0 : 8)); }
      final int kind = i;
      LinearLayout tile = new LinearLayout(this);
      tile.setOrientation(LinearLayout.VERTICAL);
      tile.setGravity(Gravity.CENTER);
      tile.setPadding(dp(6), dp(10), dp(6), dp(10));
      tile.setBackground(shape(FIELD, 14, Color.rgb(169, 202, 250)));
      TextView fmt = text(tile, formats[i][0], 15, BLUE, true);
      fmt.setGravity(Gravity.CENTER);
      TextView desc = text(tile, formats[i][1], 11, MUTED, false);
      desc.setGravity(Gravity.CENTER);
      LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
      if (i % 3 != 0) lp.leftMargin = dp(8);
      row.addView(tile, lp);
      tile.setOnClickListener(v -> export(kind));
    }
    if (row != null) for (int k = row.getChildCount(); k < 3; k++) {
      View filler = new View(this);
      LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, 1, 1);
      lp.leftMargin = dp(8);
      row.addView(filler, lp);
    }

    output = text(resultCard, "", 14, INK, false);
    output.setTextIsSelectable(true);
    output.setLineSpacing(dp(3), 1f);
    output.setPadding(dp(2), dp(16), dp(2), 0);

    copy.setOnClickListener(v -> { if (last != null) copy(TranscriptFetcher.toText(last), t("transcript_copied")); });
    share.setOnClickListener(v -> {
      if (last == null) return;
      Intent send = new Intent(Intent.ACTION_SEND);
      send.setType("text/plain");
      send.putExtra(Intent.EXTRA_SUBJECT, t("share_subject", last.videoId));
      send.putExtra(Intent.EXTRA_TEXT, TranscriptFetcher.toText(last));
      startActivity(Intent.createChooser(send, t("share_title")));
    });
  }

  private void setLinkedInButtonIcon(Button button, int drawableId) {
    Drawable icon = getDrawable(drawableId);
    if (icon == null) return;
    icon = icon.mutate();
    icon.setTint(BLUE);
    icon.setBounds(0, 0, dp(19), dp(19));
    button.setCompoundDrawables(icon, null, null, null);
    button.setCompoundDrawablePadding(dp(5));
    button.setGravity(Gravity.CENTER);
  }

  // ---------- LinkedIn: personal account, on-device session ----------
  private void setLinkedInExpanded(boolean expanded) {
    linkedinExpanded = expanded;
    if (appHeader != null) appHeader.setVisibility(expanded ? View.GONE : View.VISIBLE);
    if (appTabs != null) appTabs.setVisibility(expanded ? View.GONE : View.VISIBLE);
    if (linkedinActions != null) linkedinActions.setVisibility(expanded ? View.GONE : View.VISIBLE);
    if (linkedinExpand != null) {
      linkedinExpand.setText(expanded ? "⤡" : "⤢");
      linkedinExpand.setContentDescription(expanded ? "Réduire LinkedIn" : "Agrandir LinkedIn");
    }
    getWindow().getDecorView().setSystemUiVisibility(expanded
      ? View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
      : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
  }

  private void buildLinkedInTab(FrameLayout host) {
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setBackgroundColor(BG);
    host.addView(root, new FrameLayout.LayoutParams(-1, -1));
    pages[3] = root;

    LinearLayout actions = new LinearLayout(this);
    actions.setPadding(dp(8), dp(6), dp(8), dp(6));
    Button messages = secondary(t("linkedin_messages"));
    Button network = secondary(t("linkedin_network"));
    Button search = secondary(t("linkedin_search"));
    // Android platform icons are stable across locales; no font-dependent emoji glyphs.
    setLinkedInButtonIcon(messages, android.R.drawable.ic_dialog_email);
    setLinkedInButtonIcon(network, android.R.drawable.ic_menu_share);
    setLinkedInButtonIcon(search, android.R.drawable.ic_menu_search);
    actions.addView(messages, new LinearLayout.LayoutParams(0, -2, 1));
    actions.addView(network, new LinearLayout.LayoutParams(0, -2, 1));
    actions.addView(search, new LinearLayout.LayoutParams(0, -2, 1));
    root.addView(actions);

    linkedinActions = actions;
    Button expandLinkedIn = secondary("⤢");
    expandLinkedIn.setContentDescription(I18n.code(this).equals("fr") ? "Agrandir LinkedIn" : "Expand LinkedIn");
    linkedinExpand = expandLinkedIn;
    root.addView(expandLinkedIn, new LinearLayout.LayoutParams(-1, -2));
    expandLinkedIn.setOnClickListener(v -> setLinkedInExpanded(!linkedinExpanded));
    linkedinMcpEnabled = false;
    linkedinWeb = new WebView(this);
    linkedinWeb.getSettings().setJavaScriptEnabled(true);
    linkedinWeb.getSettings().setDomStorageEnabled(true);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(linkedinWeb, true);
    Button mcpControl = secondary("Activer navigation LinkedIn via MCP");
    root.addView(mcpControl, new LinearLayout.LayoutParams(-1, -2));
    mcpControl.setOnClickListener(v -> {
      if (linkedinMcpEnabled) {
        linkedinMcpEnabled = false;
        ui.removeCallbacks(linkedinPoll);
        mcpControl.setText("Activer navigation LinkedIn via MCP");
        Toast.makeText(this, "Contrôle LinkedIn MCP désactivé", Toast.LENGTH_SHORT).show();
      } else {
        new AlertDialog.Builder(this).setTitle("Autoriser la navigation LinkedIn ?")
          .setMessage("Les assistants MCP associés pourront parcourir votre messagerie LinkedIn et lire les conversations affichées tant que cet écran reste ouvert. Les demandes d'envoi de messages nécessitent une confirmation explicite dans l'assistant. Les cookies ne sont jamais transmis.")
          .setNegativeButton("Annuler", (d, w) -> {})
          .setPositiveButton("Autoriser", (d, w) -> {
            linkedinMcpEnabled = true;
            mcpControl.setText("Désactiver navigation LinkedIn MCP");
            ui.post(linkedinPoll);
          }).show();
      }
    });
    Button exportJson = secondary(I18n.code(this).equals("fr") ? "Exporter ce fil en JSON" : "Export conversation JSON");
    root.addView(exportJson, new LinearLayout.LayoutParams(-1, -2));
    exportJson.setOnClickListener(v -> exportLinkedInThreadJson());
    linkedinWeb.setWebChromeClient(new WebChromeClient());
    linkedinWeb.setWebViewClient(new WebViewClient());
    root.addView(linkedinWeb, new LinearLayout.LayoutParams(-1, 0, 1));
    messages.setOnClickListener(v -> linkedinWeb.loadUrl("https://www.linkedin.com/messaging/"));
    network.setOnClickListener(v -> linkedinWeb.loadUrl("https://www.linkedin.com/mynetwork/"));
    search.setOnClickListener(v -> linkedinWeb.loadUrl("https://www.linkedin.com/search/results/people/"));
    linkedinWeb.loadUrl("https://www.linkedin.com/messaging/");
  }

  /** Run only on the foreground Activity's WebView, after explicit opt-in. */
  private void executeLinkedInJob(JSONObject job) {
    String id = job.optString("id");
    String op = job.optString("operation");
    if (!linkedinMcpEnabled || linkedinWeb == null || id.isEmpty()) {
      linkedinPollBusy = false;
      return;
    }
    if ("inbox".equals(op) || "back".equals(op)) {
      linkedinWeb.loadUrl("https://www.linkedin.com/messaging/");
      ui.postDelayed(() -> {
        if ("back".equals(op)) finishLinkedInJob(id, new JSONObject(), null);
        else extractLinkedInInbox(id);
      }, 2600);
    } else if ("open".equals(op)) {
      String participant = job.optString("participant").trim();
      if (participant.isEmpty()) { finishLinkedInJob(id, null, "Participant requis"); return; }
      if (!isLinkedInMessagingPage()) {
        linkedinWeb.loadUrl("https://www.linkedin.com/messaging/");
        ui.postDelayed(() -> openLinkedInParticipant(id, participant), 2700);
      } else openLinkedInParticipant(id, participant);
    } else if ("feed".equals(op)) {
      linkedinWeb.loadUrl("https://www.linkedin.com/feed/");
      ui.postDelayed(() -> {
        String js = "(function(){const posts=[...document.querySelectorAll('div[data-urn],article')].filter(e=>e.querySelector('a[href*=\\\"/in/\\\"],a[href*=\\\"/company/\\\"]')).slice(0,20).map(e=>({text:(e.innerText||'').trim().slice(0,2500),links:[...e.querySelectorAll('a[href]')].map(a=>a.href).filter(u=>u.startsWith('https://www.linkedin.com/')).slice(0,8)})).filter(p=>p.text);return JSON.stringify({url:location.pathname,posts});})()";
        linkedinWeb.evaluateJavascript(js, raw -> finishLinkedInJs(id, raw));
      }, 3200);
    } else if ("search".equals(op)) {
      String keywords = job.optString("keywords", "").trim();
      int requested = job.optBoolean("all", false) ? Integer.MAX_VALUE : job.optInt("limit", 50);
      int startPage = job.optInt("startPage", 1);
      if (keywords.length() < 2 || keywords.length() > 150 || requested < 1 || startPage < 1) {
        finishLinkedInJob(id, null, "Invalid search parameters"); return;
      }
      try {
        String url = "https://www.linkedin.com/search/results/people/?keywords=" + java.net.URLEncoder.encode(keywords, "UTF-8");
        java.util.LinkedHashMap<String, JSONObject> found = new java.util.LinkedHashMap<>();
        collectLinkedInSearchPage(id, url, startPage, requested, found);
      } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
    } else if ("send".equals(op)) {
      String participant = job.optString("participant", "").trim();
      String message = job.optString("text", "");
      if (participant.length() < 2 || message.isEmpty() || message.length() > 3000) { finishLinkedInJob(id, null, "Invalid recipient or text"); return; }
      if (!isLinkedInMessagingPage() || linkedinWeb.getUrl() == null || !linkedinWeb.getUrl().contains("/thread/")) { finishLinkedInJob(id, null, "Open the intended LinkedIn conversation first"); return; }
      // Validate the visible recipient and message composer before writing or clicking Send.
      String js = "(function(name,msg){const heading=[...document.querySelectorAll('h1,h2,h3,[class*=conversation-header]')].map(e=>(e.innerText||'').trim()).filter(Boolean);if(!heading.some(s=>s.toLocaleLowerCase().includes(name.toLocaleLowerCase())))return JSON.stringify({error:'Recipient not verified',headings:heading.slice(0,5)});const editor=document.querySelector('[contenteditable=\\\"true\\\"][role=\\\"textbox\\\"],div[contenteditable=\\\"true\\\"][data-placeholder],div[contenteditable=\\\"true\\\"]');if(!editor)return JSON.stringify({error:'Message composer not found'});editor.focus();editor.textContent=msg;editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:msg}));const buttons=[...document.querySelectorAll('button')].filter(b=>!b.disabled&&(/^(send|envoyer)$/i.test((b.getAttribute('aria-label')||'').trim())||/^(send|envoyer)$/i.test((b.innerText||'').trim())));if(buttons.length!==1)return JSON.stringify({error:'Send button ambiguous or missing',matches:buttons.length});buttons[0].click();return JSON.stringify({clicked:true,recipient:name});})(" + JSONObject.quote(participant) + "," + JSONObject.quote(message) + ")";
      linkedinWeb.evaluateJavascript(js, raw -> {
        try {
          JSONObject result = new JSONObject(new JSONArray("[" + raw + "]").getString(0));
          if (!result.optBoolean("clicked")) finishLinkedInJob(id, result, result.optString("error", "Send failed"));
          else finishLinkedInJob(id, result, null);
        } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
      });
    } else if ("thread".equals(op)) {
      if (!isLinkedInMessagingPage() || !linkedinWeb.getUrl().contains("/thread/")) {
        finishLinkedInJob(id, null, "Ouvrez une conversation LinkedIn"); return;
      }
      String js = "(function(){const n=[...document.querySelectorAll('li[class*=message]')];const a=n.map(e=>({text:(e.innerText||'').trim().slice(0,4000),media:[...e.querySelectorAll('img')].map(i=>i.currentSrc||i.src).filter(u=>u&&u.includes('messaging-image')).slice(0,8)})).filter(x=>x.text||x.media.length);return JSON.stringify({url:location.pathname,messages:a.slice(-60)});})()";
      linkedinWeb.evaluateJavascript(js, raw -> finishLinkedInThread(id, raw));
    } else finishLinkedInJob(id, null, "Operation inconnue");
  }

  /** Page through user-requested LinkedIn people results, without inventing matches. */
  private void collectLinkedInSearchPage(String id, String baseUrl, int page, int requested,
                                         java.util.LinkedHashMap<String, JSONObject> found) {
    if (!linkedinMcpEnabled) { finishLinkedInJob(id, null, "LinkedIn navigation disabled"); return; }
    if (found.size() >= requested || found.size() >= 100 || page > 10000) { finishLinkedInSearch(id, requested, found, page - 1, found.size() >= requested ? "requested_count_reached" : "continue_with_next_page"); return; }
    String url = baseUrl + "&page=" + page;
    linkedinWeb.loadUrl(url);
    ui.postDelayed(() -> {
      if (!linkedinMcpEnabled) { finishLinkedInJob(id, null, "LinkedIn navigation disabled"); return; }
      String js = "(function(){const anchors=[...document.querySelectorAll('a[href*=\\\"/in/\\\"]')].filter(a=>a.closest('li,article,[class*=result]'));const profiles=anchors.map(a=>({name:(a.innerText||a.closest('li,article')?.innerText||'').trim().slice(0,350),profileUrl:a.href.split('?')[0]})).filter(p=>p.name&&p.profileUrl);return JSON.stringify({profiles:profiles.slice(0,100),url:location.pathname});})()";
      linkedinWeb.evaluateJavascript(js, raw -> {
        try {
          JSONObject data = new JSONObject(new JSONArray("[" + raw + "]").getString(0));
          JSONArray items = data.optJSONArray("profiles");
          int before = found.size();
          if (items != null) for (int n = 0; n < items.length() && found.size() < requested; n++) {
            JSONObject profile = items.optJSONObject(n);
            if (profile == null) continue;
            String profileUrl = profile.optString("profileUrl");
            if (profileUrl.startsWith("https://www.linkedin.com/in/") && !found.containsKey(profileUrl)) found.put(profileUrl, profile);
          }
          if (found.size() >= requested || found.size() >= 100) finishLinkedInSearch(id, requested, found, page, found.size() >= requested ? "requested_count_reached" : "continue_with_next_page");
          else if (items == null || items.length() == 0 || found.size() == before) finishLinkedInSearch(id, requested, found, page, "no_more_visible_results");
          else collectLinkedInSearchPage(id, baseUrl, page + 1, requested, found);
        } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
      });
    }, 2800);
  }

  private void finishLinkedInSearch(String id, int requested, java.util.LinkedHashMap<String, JSONObject> found, int pages, String reason) {
    try {
      JSONObject result = new JSONObject();
      JSONArray profiles = new JSONArray();
      for (JSONObject profile : found.values()) profiles.put(profile);
      result.put("requested", requested);
      result.put("retrieved", profiles.length());
      result.put("lastPage", pages);
      result.put("nextPage", "continue_with_next_page".equals(reason) ? pages + 1 : JSONObject.NULL);
      result.put("batchSize", profiles.length());
      result.put("complete", profiles.length() >= requested || "no_more_visible_results".equals(reason));
      result.put("reason", reason);
      result.put("profiles", profiles);
      finishLinkedInJob(id, result, null);
    } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
  }

  private void extractLinkedInInbox(String id) {
    if (!linkedinMcpEnabled) { finishLinkedInJob(id, null, "Contrôle désactivé"); return; }
    String js = "(function(){const s=['li[class*=conversation]','[class*=conversation-list] li','[class*=messaging] [role=listitem]','a[href*=\\\"/messaging/thread/\\\"]'];let nodes=[];for(const x of s){let found=[...document.querySelectorAll(x)].filter(n=>(n.innerText||'').trim());if(found.length>nodes.length)nodes=found;}return JSON.stringify({url:location.pathname,conversations:nodes.filter(n=>!n.closest('nav,footer')).slice(0,30).map(n=>({name:(n.querySelector('h3,h4,[class*=participant],[class*=name]')?.innerText||n.innerText.split('\\n')[0]||'').trim().slice(0,150),preview:(n.innerText||'').trim().slice(0,350),avatarUrl:(n.querySelector('img')?.currentSrc||n.querySelector('img')?.src||'')}))});})()";
    linkedinWeb.evaluateJavascript(js, raw -> finishLinkedInJs(id, raw));
  }

  private void openLinkedInParticipant(String id, String participant) {
    if (!linkedinMcpEnabled) { finishLinkedInJob(id, null, "Contrôle désactivé"); return; }
    String js = "(function(name){const sels='li[class*=conversation],[class*=conversation-list] li,[class*=messaging] [role=listitem]';const nodes=[...document.querySelectorAll(sels)];const found=nodes.filter(n=>(n.innerText||'').toLocaleLowerCase().includes(name.toLocaleLowerCase()));if(found.length!==1)return JSON.stringify({matched:found.length,error:found.length?'Nom ambigu':'Conversation non visible'});const target=found[0];(target.querySelector('a[href]')||target).click();return JSON.stringify({clicked:true,participant:name});})(" + JSONObject.quote(participant) + ")";
    linkedinWeb.evaluateJavascript(js, raw -> {
      try {
        JSONObject outcome = new JSONObject(new JSONArray("[" + raw + "]").getString(0));
        if (outcome.optBoolean("clicked")) ui.postDelayed(() -> {
          JSONObject result = new JSONObject();
          try { result.put("participant", participant); result.put("url", linkedinWeb.getUrl()); } catch(Exception ignored) {}
          finishLinkedInJob(id, result, null);
        }, 1800);
        else finishLinkedInJob(id, outcome, outcome.optString("error", "Navigation impossible"));
      } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
    });
  }

  /** Fetch only attachment URLs from the signed-in phone; never transmit LinkedIn cookies. */
  private void finishLinkedInThread(String id, String raw) {
    try {
      JSONObject thread = new JSONObject(new JSONArray("[" + raw + "]").getString(0));
      JSONArray messages = thread.optJSONArray("messages");
      java.util.LinkedHashSet<String> urls = new java.util.LinkedHashSet<>();
      if (messages != null) for (int i=0;i<messages.length();i++) {
        JSONArray media=messages.optJSONObject(i).optJSONArray("media");
        if(media!=null)for(int j=0;j<media.length();j++){
          String url=media.optString(j);
          if(url.contains("messaging-image"))urls.add(url);
        }
      }
      final String cookie=CookieManager.getInstance().getCookie("https://www.linkedin.com/");
      final String agent=linkedinWeb.getSettings().getUserAgentString();
      worker.execute(() -> {
        JSONArray attachments=new JSONArray();
        int index=0;
        for(String url:urls){
          if(index>=8)break;
          int current=index++;
          JSONObject item=new JSONObject();
          java.net.HttpURLConnection conn=null;
          try {
            android.net.Uri uri=android.net.Uri.parse(url);
            String host=uri.getHost();
            if(!"https".equalsIgnoreCase(uri.getScheme())||host==null||!(host.equals("linkedin.com")||host.endsWith(".linkedin.com")||host.equals("licdn.com")||host.endsWith(".licdn.com")))throw new java.io.IOException("Invalid LinkedIn media host");
            conn=(java.net.HttpURLConnection)new java.net.URL(url).openConnection();
            conn.setConnectTimeout(12000);conn.setReadTimeout(20000);
            conn.setRequestProperty("User-Agent",agent);
            conn.setRequestProperty("Referer","https://www.linkedin.com/");
            if(cookie!=null)conn.setRequestProperty("Cookie",cookie);
            if(conn.getResponseCode()!=200)throw new java.io.IOException("LinkedIn HTTP "+conn.getResponseCode());
            String mime=(conn.getContentType()==null?"":conn.getContentType().split(";")[0].toLowerCase(java.util.Locale.ROOT));
            if(!mime.equals("image/png")&&!mime.equals("image/jpeg")&&!mime.equals("image/webp")&&!mime.equals("image/gif"))throw new java.io.IOException("Not an image");
            java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
            try(java.io.InputStream input=conn.getInputStream()){
              byte[] buffer=new byte[8192];int n;
              while((n=input.read(buffer))!=-1){bytes.write(buffer,0,n);if(bytes.size()>5_000_000)throw new java.io.IOException("Image exceeds 5 MB");}
            }
            java.net.HttpURLConnection upload=(java.net.HttpURLConnection)new java.net.URL(RelayClient.BASE+"/api/devices/linkedin/media").openConnection();
            try{
              upload.setRequestMethod("POST");upload.setConnectTimeout(15000);upload.setReadTimeout(45000);upload.setDoOutput(true);
              upload.setRequestProperty("Authorization","Bearer "+RelayClient.token(this));
              upload.setRequestProperty("Content-Type",mime);
              upload.setRequestProperty("X-LinkedIn-Job",id);
              upload.setRequestProperty("X-Image-Index",String.valueOf(current));
              upload.setFixedLengthStreamingMode(bytes.size());
              try(java.io.OutputStream out=upload.getOutputStream()){bytes.writeTo(out);}
              if(upload.getResponseCode()!=200)throw new java.io.IOException("Upload HTTP "+upload.getResponseCode());
              java.io.ByteArrayOutputStream response=new java.io.ByteArrayOutputStream();
              try(java.io.InputStream input=upload.getInputStream()){byte[] buffer=new byte[4096];int n;while((n=input.read(buffer))!=-1){response.write(buffer,0,n);if(response.size()>12000)throw new java.io.IOException("Response too large");}}
              JSONObject saved=new JSONObject(response.toString("UTF-8"));
              item.put("storagePath",saved.optString("storagePath"));item.put("mime",mime);item.put("bytes",bytes.size());
            }finally{upload.disconnect();}
          }catch(Exception e){try{item.put("error",e.getMessage());}catch(Exception ignored){}}
          finally{if(conn!=null)conn.disconnect();}
          attachments.put(item);
        }
        try{thread.put("attachments",attachments);}catch(Exception ignored){}
        finishLinkedInJob(id,thread,null);
      });
    }catch(Exception e){finishLinkedInJob(id,null,e.getMessage());}
  }

  private void finishLinkedInJs(String id, String raw) {
    try {
      String decoded = new JSONArray("[" + raw + "]").getString(0);
      finishLinkedInJob(id, new JSONObject(decoded), null);
    } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
  }

  private void finishLinkedInJob(String id, JSONObject result, String error) {
    linkedinPollBusy = false;
    worker.execute(() -> {
      try {
        JSONObject body = new JSONObject();
        body.put("id", id);
        if (error != null) body.put("error", error);
        else body.put("result", result);
        RelayClient.request("POST", "/api/devices/linkedin", RelayClient.token(this), body.toString());
      } catch (Exception e) { android.util.Log.w("CamMicGoLinkedIn", "Relay result failed", e); }
    });
  }

  /** User-initiated local JSON export of the currently loaded conversation. */
  private void exportLinkedInThreadJson() {
    if (!isLinkedInMessagingPage() || linkedinWeb.getUrl() == null || !linkedinWeb.getUrl().contains("/thread/")) {
      Toast.makeText(this, "Ouvrez d'abord une conversation LinkedIn.", Toast.LENGTH_LONG).show();
      return;
    }
    String js = "(function(){const nodes=[...document.querySelectorAll('li[class*=message],[class*=msg-s-event-listitem],[class*=message-event]')];const messages=nodes.map(n=>({text:(n.innerText||'').trim().slice(0,8000),timestamp:n.querySelector('time')?.getAttribute('datetime')||null,images:[...n.querySelectorAll('img')].map(i=>({url:i.currentSrc||i.src,alt:i.alt||''})).filter(i=>i.url&&/messaging-image|licdn/i.test(i.url)).slice(0,20),files:[...n.querySelectorAll('a[download]')].map(a=>({name:(a.innerText||'').trim(),url:a.href})).slice(0,20)})).filter(m=>m.text||m.images.length||m.files.length);const header=document.querySelector('[class*=conversation-header],h2,h3');const avatars=[...document.querySelectorAll('[class*=conversation-header] img')].map(i=>({url:i.currentSrc||i.src,alt:i.alt||''}));return JSON.stringify({format:'cammicgo-linkedin-thread-v1',url:location.href,participant:(header?.innerText||'').trim().slice(0,250),avatars,messages,loadedMessages:messages.length,partial:true,exportedAt:new Date().toISOString()});})()";
    linkedinWeb.evaluateJavascript(js, raw -> {
      try {
        JSONObject data = new JSONObject(new JSONArray("[" + raw + "]").getString(0));
        if (data.optJSONArray("messages") == null || data.optJSONArray("messages").length() == 0) {
          Toast.makeText(this, "Aucun message chargé à exporter.", Toast.LENGTH_LONG).show();
          return;
        }
        new AlertDialog.Builder(this).setTitle("Exporter la conversation")
          .setMessage("Sauvegarder les messages actuellement chargés en JSON ? Les liens vers les images peuvent nécessiter une session LinkedIn et le fichier ne contient pas les octets des images.")
          .setNegativeButton("Annuler", (d, w) -> {})
          .setPositiveButton("Exporter", (d, w) -> save(data.toString(2), "application/json", "linkedin-conversation-" + System.currentTimeMillis() + ".json")).show();
      } catch (Exception e) { Toast.makeText(this, "Export JSON impossible : " + e.getMessage(), Toast.LENGTH_LONG).show(); }
    });
  }

  private void exportLinkedInImages() {
    if (!isLinkedInMessagingPage() || linkedinWeb.getUrl() == null || !linkedinWeb.getUrl().contains("/thread/")) {
      Toast.makeText(this, "Ouvrez d'abord un fil LinkedIn.", Toast.LENGTH_LONG).show();
      return;
    }
    String js = "(function(){const all=[...document.querySelectorAll('li[class*=message] img')];const urls=[...new Set(all.map(i=>i.currentSrc||i.src).filter(u=>u&&/messaging-image/i.test(u)))].slice(0,12);return JSON.stringify(urls);})()";
    linkedinWeb.evaluateJavascript(js, raw -> {
      try {
        String decoded = new JSONArray("[" + raw + "]").getString(0);
        JSONArray urls = new JSONArray(decoded);
        if (urls.length() == 0) {
          Toast.makeText(this, "Aucune image jointe détectée dans le fil chargé.", Toast.LENGTH_LONG).show();
          return;
        }
        new AlertDialog.Builder(this).setTitle("Images LinkedIn")
          .setMessage("Exporter " + urls.length() + " image(s) de cette conversation vers une application choisie ?")
          .setNegativeButton("Annuler", (d, w) -> {})
          .setPositiveButton("Exporter", (d, w) -> downloadAndShareLinkedInImages(urls)).show();
      } catch (Exception e) {
        Toast.makeText(this, "Extraction des images impossible : " + e.getMessage(), Toast.LENGTH_LONG).show();
      }
    });
  }

  private void downloadAndShareLinkedInImages(JSONArray urls) {
    final String cookie = CookieManager.getInstance().getCookie("https://www.linkedin.com/");
    final String agent = linkedinWeb.getSettings().getUserAgentString();
    worker.execute(() -> {
      java.util.ArrayList<Uri> files = new java.util.ArrayList<>();
      try {
        java.io.File dir = new java.io.File(getCacheDir(), "linkedin-shared");
        if (!dir.exists() && !dir.mkdirs()) throw new java.io.IOException("Cache unavailable");
        for (int i = 0; i < urls.length(); i++) {
          String address = urls.optString(i);
          Uri parsed = Uri.parse(address);
          String host = parsed.getHost();
          if (!"https".equalsIgnoreCase(parsed.getScheme()) || host == null ||
              !(host.equals("linkedin.com") || host.endsWith(".linkedin.com") || host.equals("licdn.com") || host.endsWith(".licdn.com"))) continue;
          java.net.HttpURLConnection connection = null;
          try {
            connection = (java.net.HttpURLConnection) new java.net.URL(address).openConnection();
            connection.setConnectTimeout(12000); connection.setReadTimeout(18000);
            connection.setRequestProperty("User-Agent", agent);
            connection.setRequestProperty("Referer", "https://www.linkedin.com/");
            if (cookie != null) connection.setRequestProperty("Cookie", cookie);
            if (connection.getResponseCode() != 200) continue;
            String type = connection.getContentType();
            if (type == null || !type.toLowerCase(java.util.Locale.ROOT).startsWith("image/")) continue;
            String ext = type.toLowerCase(java.util.Locale.ROOT).contains("png") ? ".png" :
                type.toLowerCase(java.util.Locale.ROOT).contains("webp") ? ".webp" : ".jpg";
            java.io.File file = new java.io.File(dir, "linkedin-image-" + System.currentTimeMillis() + "-" + i + ext);
            try (java.io.InputStream in = connection.getInputStream(); java.io.FileOutputStream out = new java.io.FileOutputStream(file)) {
              byte[] buffer = new byte[8192]; int n, total = 0;
              while ((n = in.read(buffer)) != -1) {
                total += n;
                if (total > 12 * 1024 * 1024) throw new java.io.IOException("Image too large");
                out.write(buffer, 0, n);
              }
            }
            files.add(androidx.core.content.FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", file));
          } catch (Exception ignored) {
            // Some private LinkedIn images are only accessible to the WebView renderer.
          } finally { if (connection != null) connection.disconnect(); }
        }
        ui.post(() -> {
          if (files.isEmpty()) {
            new AlertDialog.Builder(this).setTitle("Images LinkedIn")
              .setMessage("Aucune image téléchargée. Les URL privées peuvent nécessiter un accès propre au navigateur LinkedIn.")
              .setPositiveButton("OK", (d, w) -> {}).show();
            return;
          }
          Intent share = new Intent(Intent.ACTION_SEND_MULTIPLE);
          share.setType("image/*");
          share.putParcelableArrayListExtra(Intent.EXTRA_STREAM, files);
          share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          ClipData clip = ClipData.newUri(getContentResolver(), "LinkedIn image", files.get(0));
          for (int j = 1; j < files.size(); j++) clip.addItem(new ClipData.Item(files.get(j)));
          share.setClipData(clip);
          startActivity(Intent.createChooser(share, "Partager les images LinkedIn"));
          Toast.makeText(this, files.size() + " image(s) prête(s)", Toast.LENGTH_LONG).show();
        });
      } catch (Exception e) {
        ui.post(() -> Toast.makeText(this, "Export impossible : " + e.getMessage(), Toast.LENGTH_LONG).show());
      }
    });
  }

  private boolean isLinkedInMessagingPage() {
    if (linkedinWeb == null || linkedinWeb.getUrl() == null) return false;
    try {
      Uri uri = Uri.parse(linkedinWeb.getUrl());
      String host = uri.getHost();
      if (host == null || !(host.equals("linkedin.com") || host.endsWith(".linkedin.com"))) return false;
      String path = uri.getPath();
      // Mobile LinkedIn can use /messaging, /messaging/thread/... or /comm/messaging/...
      return path != null && (path.contains("messaging") || path.contains("message"));
    } catch (Exception ignored) { return false; }
  }

  private void showLinkedInInspection(String raw, boolean thread) {
    try {
      // evaluateJavascript returns a JSON-encoded string containing our JSON payload.
      String decoded = new JSONArray("[" + raw + "]").getString(0);
      JSONObject payload = new JSONObject(decoded);
      JSONArray entries = payload.optJSONArray(thread ? "messages" : "rows");
      int count = entries == null ? 0 : entries.length();
      String title = thread ? "LinkedIn · fil sélectionné" : "LinkedIn · conversations";
      String body = count == 0
          ? "Aucun élément reconnu sur cette page. Vérifiez la connexion, puis ouvrez la messagerie. Les sélecteurs devront peut-être être adaptés."
          : payload.toString(2);
      AlertDialog.Builder dialog = new AlertDialog.Builder(this).setTitle(title + " (" + count + ")").setMessage(body)
          .setNegativeButton("Fermer", (d, w) -> {});
      if (count > 0) dialog.setPositiveButton("Partager", (d, w) -> {
        Intent share = new Intent(Intent.ACTION_SEND);
        share.setType("text/plain");
        share.putExtra(Intent.EXTRA_TEXT, title + "\\n" + body);
        startActivity(Intent.createChooser(share, "Partager avec un assistant IA"));
      });
      dialog.show();
    } catch (Exception e) {
      new AlertDialog.Builder(this).setTitle("Test LinkedIn").setMessage("Lecture impossible : " + e.getMessage())
          .setPositiveButton("OK", (d, w) -> {}).show();
    }
  }

  // ---------- tab 3: NotebookLM ----------

  private void buildNotebookTab(FrameLayout host) {
    // NotebookLM lives inside the existing CamMicGo shell, beneath the permanent header and tabs.
    // Do not launch a second Activity or show a redundant back-to-app button.
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setBackgroundColor(BG);
    host.addView(root, new FrameLayout.LayoutParams(-1,-1));
    pages[2]=root;
    LinearLayout actions=new LinearLayout(this);
    actions.setPadding(dp(8),dp(6),dp(8),dp(6));
    Button notebooks=secondary("Notebooks");
    Button sources=secondary("Sources");
    Button reload=secondary("⟳");
    reload.setContentDescription(I18n.code(this).equals("fr") ? "Actualiser" : "Refresh");
    notebooks.setSingleLine(true);
    actions.addView(notebooks,new LinearLayout.LayoutParams(-2,-2));
    sources.setSingleLine(true);
    actions.addView(sources,new LinearLayout.LayoutParams(-2,-2));
    actions.addView(reload,new LinearLayout.LayoutParams(dp(60),-2));
    notebookActions = actions;
    Button expand = secondary("⤢");
    expand.setContentDescription(I18n.code(this).equals("fr") ? "Agrandir" : "Expand");
    notebookExpand = expand;
    Button chrome = secondary("◎ " + (I18n.code(this).equals("fr") ? "Navigateur" : "Browser"));
    chrome.setSingleLine(true);
    actions.addView(expand,new LinearLayout.LayoutParams(dp(54),-2));
    actions.addView(chrome,new LinearLayout.LayoutParams(-2,-2));
    android.widget.HorizontalScrollView actionScroll = new android.widget.HorizontalScrollView(this);
    actionScroll.setHorizontalScrollBarEnabled(false);
    actionScroll.addView(actions, new android.widget.HorizontalScrollView.LayoutParams(-2, -2));
    root.addView(actionScroll);
    expand.setOnClickListener(v -> setNotebookExpanded(!notebookExpanded));
    chrome.setOnClickListener(v -> {
      String url = notebookWeb == null ? null : notebookWeb.getUrl();
      if (url == null || !(url.startsWith("https://notebooklm.google.com/") || url.startsWith("https://notebook.google.com/"))) url = "https://notebooklm.google.com/";
      Intent intent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url));
      intent.addCategory(Intent.CATEGORY_BROWSABLE);
      startActivity(intent);
    });
    notebookWeb=new WebView(this);
    notebookWeb.getSettings().setJavaScriptEnabled(true);
    notebookWeb.getSettings().setDomStorageEnabled(true);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(notebookWeb,true);
    notebookWeb.setWebChromeClient(new WebChromeClient());
    notebookWeb.setWebViewClient(new WebViewClient());
    root.addView(notebookWeb,new LinearLayout.LayoutParams(-1,0,1));
    notebooks.setOnClickListener(v->notebookWeb.loadUrl("https://notebooklm.google.com/"));
    sources.setOnClickListener(v->notebookWeb.evaluateJavascript("(function(){const b=[...document.querySelectorAll('button,[role=button]')].find(x=>/add sources?|ajouter (des |une )?sources?/i.test(x.innerText||x.getAttribute('aria-label')||''));if(b){b.click();return 'ok'}return 'missing'})()",result->{if(!"\\\"ok\\\"".equals(result))Toast.makeText(this,"Ouvrez un notebook pour ajouter une source.",Toast.LENGTH_LONG).show();}));
    reload.setOnClickListener(v->notebookWeb.reload());
    notebookWeb.loadUrl("https://notebooklm.google.com/");
  }

  private void setNotebookExpanded(boolean expanded) {
    notebookExpanded = expanded;
    if (appHeader != null) appHeader.setVisibility(expanded ? View.GONE : View.VISIBLE);
    if (appTabs != null) appTabs.setVisibility(expanded ? View.GONE : View.VISIBLE);
    if (notebookActions != null) {
      for (int i = 0; i < notebookActions.getChildCount(); i++) {
        View child = notebookActions.getChildAt(i);
        child.setVisibility(expanded && child != notebookExpand ? View.GONE : View.VISIBLE);
      }
    }
    if (notebookExpand != null) notebookExpand.setText(expanded ? "⤡" : "⤢");
    getWindow().getDecorView().setSystemUiVisibility(expanded
      ? View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
      : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
  }

  private void buildHelpPage(LinearLayout root) {
    section(root, t("sec_prompts"));
    LinearLayout c = card(root);
    TextView sub = text(c, t("prompts_sub"), 13, MUTED, false);
    sub.setPadding(0, 0, 0, dp(4));
    String[][] prompts = {
        {t("p1t"), t("p1")}, {t("p2t"), t("p2")}, {t("p3t"), t("p3")}, {t("p4t"), t("p4")},
    };
    for (String[] p : prompts) {
      LinearLayout row = new LinearLayout(this);
      row.setGravity(Gravity.CENTER_VERTICAL);
      row.setPadding(dp(12), dp(10), dp(4), dp(10));
      row.setBackground(shape(FIELD, 12, LINE));
      LinearLayout texts = new LinearLayout(this);
      texts.setOrientation(LinearLayout.VERTICAL);
      text(texts, p[0], 13, BLUE, true);
      text(texts, "“" + p[1].trim() + "”", 13, INK, false);
      row.addView(texts, new LinearLayout.LayoutParams(0, -2, 1));
      Button cp = flat(t("copy"), BLUE);
      row.addView(cp);
      cp.setOnClickListener(v -> copy(p[1], t("prompt_copied")));
      c.addView(row, gapTop(8));
    }

    section(root, t("language_title"));
    LinearLayout lc = card(root);
    Button langBtn = secondary("🌐  " + I18n.NAMES[I18n.index(this)]);
    langBtn.setOnClickListener(v -> pickLanguage());
    lc.addView(langBtn);

    section(root, t("sec_tips"));
    LinearLayout tips = card(root);
    tip(tips, "🔋", t("tip_batt_t"), t("tip_batt"));
    Button battery = secondary(t("battery_btn"));
    battery.setOnClickListener(v -> {
      try { startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); }
      catch (Exception e) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
    });
    tips.addView(battery, gapTop(4));
    tip(tips, "📱", t("tip_awake_t"), t("tip_awake"));
    tip(tips, "🔄", t("tip_resume_t"), t("tip_resume"));
    tip(tips, "⏱️", t("tip_a15_t"), t("tip_a15"));

    TextView versionBanner = text(root, "CamMicGo SEO MCP — VERSION INSTALLÉE : " + version(), 17, BLUE, true);
    versionBanner.setPadding(dp(12), dp(14), dp(12), dp(14));
    versionBanner.setContentDescription("Version installée de CamMicGo SEO MCP : " + version());
    TextView v = text(root, "CamMicGo SEO MCP · " + t("version") + " " + version() + " · seo.cammicgo.com", 12, MUTED, false);
    v.setGravity(Gravity.CENTER);
    v.setPadding(0, dp(6), 0, 0);
  }

  private void tip(LinearLayout parent, String icon, String title, String body) {
    LinearLayout row = new LinearLayout(this);
    row.setPadding(0, dp(8), 0, dp(8));
    TextView i = text(null, icon, 20, INK, false);
    row.addView(i, new LinearLayout.LayoutParams(dp(34), -2));
    LinearLayout texts = new LinearLayout(this);
    texts.setOrientation(LinearLayout.VERTICAL);
    text(texts, title, 14, INK, true);
    text(texts, body, 13, MUTED, false);
    row.addView(texts, new LinearLayout.LayoutParams(0, -2, 1));
    parent.addView(row);
  }

  private String version() {
    try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "?"; }
  }

  // ---------- pairing / connected mode ----------

  private void pair() {
    final String code = codeInput.getText().toString().trim();
    if (code.replaceAll("[^A-Za-z0-9]", "").length() != 8) { Toast.makeText(this, t("code_invalid"), Toast.LENGTH_LONG).show(); return; }
    pairButton.setEnabled(false);
    pairButton.setText(t("pairing"));
    final String name = (Build.MANUFACTURER + " " + Build.MODEL).trim();
    worker.execute(() -> {
      String message; boolean ok = false;
      try { message = t("paired", RelayClient.pair(this, code, name)); ok = true; }
      catch (Exception e) { message = t("pair_failed", e.getMessage()); }
      final String m = message; final boolean success = ok;
      runOnUiThread(() -> {
        pairButton.setEnabled(true);
        pairButton.setText(t("pair_btn"));
        if (success) { codeInput.setText(""); startConnected(); }
        refreshRelay();
        Toast.makeText(this, m, Toast.LENGTH_LONG).show();
      });
    });
  }

  private void startConnected() {
    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
      requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);
    try {
      RelayClient.prefs(this).edit().putString("status", "Démarrage du relais…").putString("lastRelayError", null).apply();
      RelayClient.prefs(this).edit().putBoolean("relayDesired", true).putLong("startRequestedAt", System.currentTimeMillis()).apply();
      RelayService.start(this);
      Toast.makeText(this, "Démarrage du mode connecté demandé", Toast.LENGTH_SHORT).show();
    } catch (RuntimeException e) {
      String detail = e.getClass().getSimpleName() + ": " + String.valueOf(e.getMessage());
      RelayClient.prefs(this).edit().putBoolean("relayDesired", false).putBoolean("connected", false).putString("lastRelayError", detail).putString("status", detail).apply();
      Toast.makeText(this, "Démarrage impossible : " + detail, Toast.LENGTH_LONG).show();
    }
  }

  private void recoverRelayIfNeeded() {
    SharedPreferences p = RelayClient.prefs(this);
    if (!RelayClient.isPaired(this) || !p.getBoolean("relayDesired", false)) return;
    long now = System.currentTimeMillis();
    long lastSync = p.getLong("lastSync", 0L);
    if (p.getBoolean("connected", false) && lastSync > 0 && now - lastSync < 30000L) return;
    long lastAttempt = p.getLong("startRequestedAt", 0L);
    if (lastAttempt > 0 && now - lastAttempt < 30000L) return;
    // Throttle restart attempts: never launch a service repeatedly every UI refresh.
    p.edit().putLong("startRequestedAt", now).apply();
    try { RelayService.start(this); }
    catch (RuntimeException e) { p.edit().putString("lastRelayError", e.toString()).apply(); }
  }

  private void refreshRelay() {
    if (statusLine == null) return;
    SharedPreferences p = RelayClient.prefs(this);
    boolean paired = RelayClient.isPaired(this);
    long now = System.currentTimeMillis();
    long syncAge = now - p.getLong("lastSync", 0L);
    long startAge = now - p.getLong("startRequestedAt", 0L);
    boolean serviceRunning = paired && p.getBoolean("connected", false);
    boolean connected = serviceRunning && syncAge >= 0 && syncAge < 30000L;
    boolean starting = paired && !connected && startAge >= 0 && startAge < 30000L;
    unpairedBox.setVisibility(paired ? View.GONE : View.VISIBLE);
    pairedBox.setVisibility(paired ? View.VISIBLE : View.GONE);

    int chipColor = !paired ? GREY : connected ? GREEN : starting ? AMBER : AMBER;
    chipDot.setBackground(dot(chipColor));
    chipText.setText(!paired ? t("chip_unpaired") : connected ? t("chip_connected") : starting ? "Démarrage…" : t("chip_stopped"));

    if (retryYoutubeButton != null) retryYoutubeButton.setVisibility(paired && p.getBoolean("youtube429ManualPause", false) ? View.VISIBLE : View.GONE);
    if (paired) {
      statusDot.setBackground(dot(connected ? GREEN : GREY));
      statusLine.setText(connected ? t("status_on") : starting ? "Connexion au serveur en cours…" : t("status_off"));
      connectButton.setText(connected ? t("connect_off") : starting ? "Connexion en cours…" : t("connect_on"));
      StringBuilder b = new StringBuilder(p.getString("deviceName", "Android"));
      if (connected) {
        long sync = p.getLong("lastSync", 0);
        if (sync > 0) b.append(t("server_contact", DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(sync))));
        String status = p.getString("status", null);
        if (status != null) b.append('\n').append(status);
      } else {
        b.append('\n').append(starting ? "Le relais démarre, vérification du premier contact serveur…" : t("activate_hint"));
        String lastError = p.getString("lastRelayError", null);
        if (lastError != null && !lastError.isEmpty()) b.append('\n').append("Erreur : ").append(lastError);
        String lastStatus = p.getString("status", null);
        if (lastStatus != null && !lastStatus.isEmpty()) b.append('\n').append(lastStatus);
      }
      relayDetail.setText(b.toString());
    }
    refreshProgress(p, paired, connected);
    long age = System.currentTimeMillis() - p.getLong("progressAt", 0);
    boolean fresh = p.getLong("progressAt", 0) > 0 && age >= 0 && age < 30000L;
    if (progressFreshness != null) {
      String error = p.getString("syncError", null);
      progressFreshness.setText(!paired ? "" : !fresh ? t("sync_stale") : t("sync_updated", DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(p.getLong("progressAt", 0)))));
      progressFreshness.setTextColor(fresh ? MUTED : AMBER);
      if (error != null) progressFreshness.append(" · " + t("sync_error"));
    }
    refreshNotebookRequests(p);
    refreshHistory(p);
  }

  private String notebookHistoryShown;
  private void refreshNotebookRequests(SharedPreferences p) {
    if(notebookRequests==null)return;
    String raw=p.getString("notebookHistory","[]");
    if(raw.equals(notebookHistoryShown))return;
    notebookHistoryShown=raw;
    notebookRequests.removeAllViews();
    try {
      JSONArray entries=new JSONArray(raw);
      if(entries.length()==0){text(notebookRequests,t("notebook_empty"),12,MUTED,false);return;}
      for(int i=0;i<Math.min(entries.length(),12);i++){
        JSONObject e=entries.optJSONObject(i);if(e==null)continue;
        String state=e.optString("status");
        // A worker killed by Android may never update its local history entry.
        if("working".equals(state) && System.currentTimeMillis()-e.optLong("at",0)>10*60*1000L) {
          state="failed";
          e.put("error","Délai dépassé : aucune confirmation reçue. Vérifiez les notebooks avant toute nouvelle création.");
        }
        String label="done".equals(state)?t("notebook_done"):"working".equals(state)?t("notebook_working"):t("notebook_failed");
        text(notebookRequests,label+" · "+e.optString("label"),13,"failed".equals(state)?RED:INK,true);
        if(e.has("error"))text(notebookRequests,e.optString("error"),11,MUTED,false);
      }
    }catch(Exception ex){text(notebookRequests,t("notebook_unavailable"),12,RED,false);}
    if(notebookRequests.getChildCount()>0){
      Button clear=flat(t("notebook_clear"),RED);
      clear.setOnClickListener(v->new AlertDialog.Builder(this)
          .setTitle(t("notebook_clear")).setMessage(t("notebook_clear_confirm"))
          .setPositiveButton(t("clear_ok"),(dialog,which)->{
            RelayClient.prefs(this).edit().putString("notebookHistory","[]").apply();
            notebookHistoryShown=null;
            refreshNotebookRequests(RelayClient.prefs(this));
          }).setNegativeButton(t("cancel"),null).show());
      try { if(new JSONArray(raw).length()>0)notebookRequests.addView(clear); }catch(Exception ignored){}
    }
  }

  private void refreshProgress(SharedPreferences p, boolean paired, boolean connected) {
    JSONObject o = null;
    try { String s = p.getString("progress", null); if (s != null) o = new JSONObject(s); } catch (Exception ignored) {}
    if (o == null || o.optInt("total") == 0) {
      progressCount.setText("—");
      progressLabel.setText(paired ? t("no_request") : t("pair_to_start"));
      progressBar.setProgress(0);
      progressStats.setVisibility(View.GONE);
      ((View) progressSpinner.getTag()).setVisibility(View.GONE);
      progressCurrent.setText("");
      progressNote.setText(paired ? t("progress_hint") : "");
      return;
    }
    int total = o.optInt("total"), done = o.optInt("done"), failed = o.optInt("failed"), waiting = o.optInt("pending") + o.optInt("working");
    boolean stale = System.currentTimeMillis() - p.getLong("progressAt", 0) >= 30000L;
    if (stale) {
      progressCount.setText("— / " + total);
      progressLabel.setText(t("sync_stale"));
      progressBar.setProgress(0);
      progressStats.setVisibility(View.GONE);
      ((View) progressSpinner.getTag()).setVisibility(View.GONE);
      progressCurrent.setText("");
      progressNote.setText(t("sync_stale_detail"));
      return;
    }
    int handled = done + failed;
    ((View) progressSpinner.getTag()).setVisibility(connected && o.optInt("working") > 0 ? View.VISIBLE : View.GONE);
    progressStats.setVisibility(View.VISIBLE);
    progressCount.setText(handled + " / " + total);
    progressLabel.setText(waiting > 0 ? t("processed") : t("finished"));
    progressBar.setProgress(total == 0 ? 0 : Math.round(handled * 100f / total));
    statDone.setText(String.valueOf(done));
    statWaiting.setText(String.valueOf(waiting));
    statFailed.setText(String.valueOf(failed));

    String current = p.getString("current", null);
    String currentTitle = null;
    JSONArray recent = o.optJSONArray("recent");
    if (recent != null) for (int i = 0; i < recent.length(); i++) {
      JSONObject r = recent.optJSONObject(i);
      if (r != null && "working".equals(r.optString("status"))) {
        if (current == null) current = r.optString("videoId");
        if (r.optString("videoId").equals(current) && !r.isNull("title")) currentTitle = r.optString("title");
      }
    }
    if (waiting > 0 && current != null) progressCurrent.setText(t("current", currentTitle != null ? currentTitle : current));
    else progressCurrent.setText(waiting == 0 ? t("all_done") : "");

    String note;
    if (waiting > 0 && !connected) note = t("stopped_resume");
    else if (waiting > 0) {
      String eta = eta(o.optString("startedAt", null), handled, waiting);
      note = (eta != null ? eta + " · " : "") + t("auto_resume");
    } else note = failed > 0 ? t("some_failed") : "";
    progressNote.setText(note);
  }

  /** Remaining time estimate from the pace since the series started. */
  private String eta(String startedAt, int handled, int waiting) {
    if (startedAt == null || handled < 2) return null;
    try {
      long elapsed = System.currentTimeMillis() - Instant.parse(startedAt).toEpochMilli();
      long left = elapsed / handled * waiting / 1000;
      if (left < 60) return t("eta_less");
      return t("eta_min", (left + 59) / 60);
    } catch (Exception e) { return null; }
  }

  private void refreshHistory(SharedPreferences p) {
    String raw = p.getString("history", "[]");
    String notebookRaw = p.getString("assistantNotebookHistory", "[]");
    long minute = System.currentTimeMillis() / 60_000;
    String key = raw.hashCode() + ":" + notebookRaw.hashCode() + ":" + minute;
    if (key.equals(historyShown)) return;
    historyShown = key;
    historyList.removeAllViews();
    JSONArray h;
    try { h = new JSONArray(raw); } catch (Exception e) { h = new JSONArray(); }
    // Unified assistant activity: NotebookLM jobs (sources, Studio audio/video/quiz,
    // notebook creation, etc.) share the first tab with YouTube requests.
    try {
      JSONArray notebookJobs = new JSONArray(notebookRaw);
      for (int i = 0; i < notebookJobs.length(); i++) {
        JSONObject n = notebookJobs.optJSONObject(i);
        if (n == null) continue;
        JSONObject entry = new JSONObject();
        entry.put("type", "notebooklm");
        entry.put("title", n.optString("label", "NotebookLM"));
        entry.put("agentName", n.optString("agentName", ""));
        entry.put("status", "done".equals(n.optString("status")) ? "done" : n.optString("status"));
        entry.put("at", n.optLong("at"));
        entry.put("error", n.optString("error", ""));
        h.put(entry);
      }
      java.util.ArrayList<JSONObject> ordered = new java.util.ArrayList<>();
      for (int i = 0; i < h.length(); i++) if (h.optJSONObject(i) != null) ordered.add(h.optJSONObject(i));
      ordered.sort((a,b) -> Long.compare(b.optLong("at"), a.optLong("at")));
      h = new JSONArray();
      for (JSONObject item : ordered) h.put(item);
    } catch (Exception ignored) {}
    clearHistory.setVisibility(h.length() == 0 ? View.GONE : View.VISIBLE);
    if (h.length() == 0) {
      TextView empty = text(historyList, t("history_empty"), 13, MUTED, false);
      empty.setPadding(dp(12), dp(10), dp(12), dp(10));
      return;
    }
    int max = Math.min(h.length(), 20);
    for (int i = 0; i < max; i++) {
      JSONObject e = h.optJSONObject(i);
      if (e == null) continue;
      boolean ok = "done".equals(e.optString("status"));
      boolean notebookEntry = "notebooklm".equals(e.optString("type"));
      LinearLayout row = new LinearLayout(this);
      row.setGravity(Gravity.CENTER_VERTICAL);
      row.setPadding(dp(10), dp(9), dp(10), dp(9));
      TextView icon = text(null, ok ? "✓" : "✕", 14, Color.WHITE, true);
      icon.setGravity(Gravity.CENTER);
      icon.setBackground(dot(ok ? GREEN : RED));
      row.addView(icon, new LinearLayout.LayoutParams(dp(24), dp(24)));
      LinearLayout texts = new LinearLayout(this);
      texts.setOrientation(LinearLayout.VERTICAL);
      texts.setPadding(dp(10), 0, 0, 0);
      String title = e.isNull("title") ? null : e.optString("title", null);
      TextView tv = text(texts, title != null && !title.isEmpty() ? title : t("video", e.optString("videoId")), 14, INK, true);
      tv.setMaxLines(1); tv.setEllipsize(TextUtils.TruncateAt.END);
      // Preserve the caller identity supplied by the relay; never guess a provider.
      String agent = e.optString("agentName", "").trim();
      if (notebookEntry && agent.isEmpty()) {
        String label = e.optString("title", "");
        if (label.startsWith("ChatGPT · ")) agent = "ChatGPT";
        else if (label.startsWith("Claude · ")) agent = "Claude";
        else if (label.startsWith("Gemini · ")) agent = "Gemini";
        else if (label.startsWith("Antigravity · ")) agent = "Antigravity";
        else if (label.startsWith("Cursor · ")) agent = "Cursor";
        else if (label.startsWith("Codex · ")) agent = "Codex";
      }
      String source = e.optString("agentSource", e.optString("source", "")).trim();
      String identity = (agent + " " + source).toLowerCase(java.util.Locale.ROOT);
      String provider = "Assistant inconnu";
      if (identity.contains("antigravity")) provider = "Antigravity";
      else if (identity.contains("cursor")) provider = "Cursor";
      else if (identity.contains("codex")) provider = "Codex";
      else if (identity.contains("chatgpt") || identity.contains("openai")) provider = "ChatGPT";
      else if (identity.contains("claude") || identity.contains("anthropic")) provider = "Claude";
      else if (identity.contains("gemini cli")) provider = "Gemini CLI";
      else if (identity.contains("gemini")) provider = "Gemini";
      else if (!agent.isEmpty()) provider = agent;
      TextView origin = text(texts, provider + (source.isEmpty() || provider.equals(source) ? "" : " · " + source), 11, MUTED, false);
      origin.setCompoundDrawablesWithIntrinsicBounds(
          "Assistant inconnu".equals(provider) ? android.R.drawable.ic_menu_myplaces : android.R.drawable.ic_menu_info_details,
          0, 0, 0);
      origin.setCompoundDrawablePadding(dp(5));
      String when = DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(e.optLong("at")));
      String detail = notebookEntry ? ("NotebookLM · " + e.optString("status") + " · " + when) : ok ? t("segments", e.optInt("segments")) + " · " + when : when + " · " + e.optString("error", t("failed"));
      TextView d = text(texts, detail, 12, ok ? MUTED : RED, false);
      d.setMaxLines(1); d.setEllipsize(TextUtils.TruncateAt.END);
      row.addView(texts, new LinearLayout.LayoutParams(0, -2, 1));
      final String vid = e.optString("videoId");
      final long at = e.optLong("at");
      row.setOnClickListener(v -> { if (notebookEntry) selectTab(2); else startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com/watch?v=" + vid))); });
      row.setOnLongClickListener(v -> {
        new AlertDialog.Builder(this).setMessage(t("remove_q"))
            .setPositiveButton(t("remove"), (dlg, which) -> editHistory(vid, at))
            .setNegativeButton(t("cancel"), null).show();
        return true;
      });
      historyList.addView(row);
      if (i < max - 1) {
        View sep = new View(this);
        sep.setBackgroundColor(LINE);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(1));
        lp.leftMargin = dp(44);
        historyList.addView(sep, lp);
      }
    }
  }

  @Override protected void onResume() {
    super.onResume();
    historyShown = null;
    // A persisted connected=true flag does not mean Android kept the service alive.
    SharedPreferences p=RelayClient.prefs(this);
    recoverRelayIfNeeded();
    ui.post(refresher);
  }
  @Override protected void onPause() { ui.removeCallbacks(refresher); ui.removeCallbacks(linkedinPoll); linkedinMcpEnabled = false; super.onPause(); }

  // ---------- manual extraction ----------

  @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); handleShare(intent); }
  @Override protected void onDestroy() { worker.shutdownNow(); super.onDestroy(); }

  private void handleShare(Intent intent) {
    if (intent != null && Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
      String t = intent.getStringExtra(Intent.EXTRA_TEXT);
      if (t != null) { selectTab(1); urlInput.setText(t); if (TranscriptFetcher.videoId(t) != null) extract(); }
    }
  }

  private void export(int kind) {
    if (last == null) return;
    String id = last.videoId, lang = last.language;
    switch (kind) {
      case 0: save(TranscriptFetcher.toSrt(last), "application/x-subrip", id + "." + lang + ".srt"); break;
      case 1: save(TranscriptFetcher.toVtt(last), "text/vtt", id + "." + lang + ".vtt"); break;
      case 2: save(TranscriptFetcher.toText(last), "text/plain", id + "." + lang + ".txt"); break;
      case 3: save(TranscriptFetcher.toPlain(last), "text/plain", id + "." + lang + ".texte.txt"); break;
      case 4: save(TranscriptFetcher.toJson(last), "application/json", id + "." + lang + ".json"); break;
      case 5: try { save(TranscriptFetcher.toMarkdown(last), "text/markdown", id + "." + lang + ".md"); }
        catch (java.io.IOException e) { Toast.makeText(this, e.getMessage(), Toast.LENGTH_LONG).show(); } break;
      default: break;
    }
  }

  private void extract() {
    final String id = TranscriptFetcher.videoId(urlInput.getText().toString());
    if (id == null) { Toast.makeText(this, t("bad_link"), Toast.LENGTH_SHORT).show(); return; }
    Object sel = langSpinner.getSelectedItem();
    final String lang = sel instanceof TranscriptFetcher.Track ? ((TranscriptFetcher.Track) sel).code : "original";
    runButton.setEnabled(false);
    runButton.setText(t("extracting"));
    last = null;
    worker.execute(() -> {
      TranscriptFetcher.Result result = null; String error = null;
      try { result = TranscriptFetcher.fetch(id, lang); } catch (Exception e) { error = e.getMessage(); }
      final TranscriptFetcher.Result done = result; final String err = error;
      runOnUiThread(() -> {
        if (isFinishing()) return;
        runButton.setEnabled(true);
        runButton.setText(t("transcribe"));
        resultCard.setVisibility(View.VISIBLE);
        last = done;
        if (done == null) {
          resultMeta.setText(t("extract_failed"));
          output.setText(err + "\n\n" + t("check_public"));
          return;
        }
        resultMeta.setText((done.title != null ? done.title + "\n" : "") + done.languageName + (done.autoGenerated ? " · " + t("auto_generated") : "") + " · " + t("segments", done.segments.size()));
        output.setText(styled(done));
      });
    });
  }

  private void setTracks(List<TranscriptFetcher.Track> tracks) {
    java.util.List<Object> items = new java.util.ArrayList<>();
    if (tracks == null || tracks.isEmpty()) items.add(new TranscriptFetcher.Track("original", t("original_lang"), true, false));
    else items.addAll(tracks);
    ArrayAdapter<Object> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, items);
    adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
    langSpinner.setAdapter(adapter);
    langSpinner.setSelection(0);
  }

  /** Reads the caption tracks of the pasted video and fills the language list. */
  private void loadLanguages() {
    final String id = TranscriptFetcher.videoId(urlInput.getText().toString());
    if (id == null) { tracksFor = null; setTracks(null); return; }
    if (id.equals(tracksFor)) return;
    tracksFor = id;
    langStatus.setText(t("searching_langs"));
    worker.execute(() -> {
      List<TranscriptFetcher.Track> tracks = null; String err = null;
      try { tracks = TranscriptFetcher.availableTracks(id); } catch (Exception e) { err = e.getMessage(); }
      final List<TranscriptFetcher.Track> t = tracks; final String error = err;
      runOnUiThread(() -> {
        if (isFinishing() || !id.equals(tracksFor)) return;
        setTracks(t);
        if (t == null) langStatus.setText(t("langs_unavailable", error));
        else langStatus.setText(t("langs_available", t.size() - 1));
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
    catch (Exception e) { copy(content, t("no_file_mgr")); }
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
        msg = t("file_saved");
      } catch (Exception e) { msg = t("save_failed", e.getMessage()); }
      final String m = msg;
      runOnUiThread(() -> Toast.makeText(this, m, Toast.LENGTH_SHORT).show());
    });
  }
}
