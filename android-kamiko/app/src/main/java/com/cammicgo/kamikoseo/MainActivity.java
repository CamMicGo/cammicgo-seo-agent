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
  static final String[] TABS = {"tab_assistant", "tab_extract", "tab_help"};

  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final Handler ui = new Handler(Looper.getMainLooper());
  private final View[] pages = new View[3];
  private final TextView[] tabViews = new TextView[3];
  private int currentTab = 0;

  // header
  private View chipDot;
  private TextView chipText;
  // assistant tab
  private EditText codeInput;
  private Button pairButton, connectButton;
  private LinearLayout unpairedBox, pairedBox, historyList;
  private View statusDot;
  private TextView statusLine, relayDetail;
  private TextView progressCount, progressLabel, progressCurrent, progressNote, statDone, statWaiting, statFailed;
  private ProgressBar progressBar;
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
    @Override public void run() { refreshRelay(); ui.postDelayed(this, 1500); }
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

    buildAppBar(shell);
    buildTabs(shell);

    FrameLayout host = new FrameLayout(this);
    shell.addView(host, new LinearLayout.LayoutParams(-1, 0, 1));
    buildAssistantPage(page(host, 0));
    buildExtractPage(page(host, 1));
    buildHelpPage(page(host, 2));

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
      TextView t = text(null, t(TABS[i]), 14, MUTED, true);
      t.setGravity(Gravity.CENTER);
      t.setPadding(dp(4), dp(9), dp(4), dp(9));
      t.setOnClickListener(v -> selectTab(index));
      seg.addView(t, new LinearLayout.LayoutParams(0, -2, 1));
      tabViews[i] = t;
    }
    wrap.addView(seg, new LinearLayout.LayoutParams(-1, -2));
    shell.addView(wrap);
  }

  private void selectTab(int index) {
    currentTab = index;
    for (int i = 0; i < pages.length; i++) {
      pages[i].setVisibility(i == index ? View.VISIBLE : View.GONE);
      boolean on = i == index;
      tabViews[i].setTextColor(on ? BLUE : MUTED);
      tabViews[i].setBackground(on ? shape(Color.WHITE, 11, 0) : null);
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

    pairButton.setOnClickListener(v -> pair());
    connectButton.setOnClickListener(v -> {
      if (RelayClient.prefs(this).getBoolean("connected", false)) RelayService.stop(this); else startConnected();
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
    progressCurrent = text(p, "", 13, INK, true);
    progressCurrent.setPadding(0, dp(12), 0, 0);
    progressCurrent.setMaxLines(2);
    progressCurrent.setEllipsize(TextUtils.TruncateAt.END);
    progressNote = text(p, "", 12, MUTED, false);
    progressNote.setPadding(0, dp(6), 0, 0);

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
        .setPositiveButton(t("clear_ok"), (dlg, which) -> editHistory(null, 0))
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
        {t("fmt_plain_label"), t("fmt_plain")}, {"JSON", t("fmt_json")}};
    LinearLayout row = null;
    for (int i = 0; i < 5; i++) {
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

  // ---------- tab 3: help ----------

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
    RelayService.start(this);
  }

  private void refreshRelay() {
    if (statusLine == null) return;
    SharedPreferences p = RelayClient.prefs(this);
    boolean paired = RelayClient.isPaired(this);
    boolean connected = paired && p.getBoolean("connected", false);
    unpairedBox.setVisibility(paired ? View.GONE : View.VISIBLE);
    pairedBox.setVisibility(paired ? View.VISIBLE : View.GONE);

    int chipColor = !paired ? GREY : connected ? GREEN : AMBER;
    chipDot.setBackground(dot(chipColor));
    chipText.setText(!paired ? t("chip_unpaired") : connected ? t("chip_connected") : t("chip_stopped"));

    if (paired) {
      statusDot.setBackground(dot(connected ? GREEN : GREY));
      statusLine.setText(connected ? t("status_on") : t("status_off"));
      connectButton.setText(connected ? t("connect_off") : t("connect_on"));
      StringBuilder b = new StringBuilder(p.getString("deviceName", "Android"));
      if (connected) {
        long sync = p.getLong("lastSync", 0);
        if (sync > 0) b.append(t("server_contact", DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(sync))));
        String status = p.getString("status", null);
        if (status != null) b.append('\n').append(status);
      } else b.append('\n').append(t("activate_hint"));
      relayDetail.setText(b.toString());
    }
    refreshProgress(p, paired, connected);
    refreshHistory(p);
  }

  private void refreshProgress(SharedPreferences p, boolean paired, boolean connected) {
    JSONObject o = null;
    try { String s = p.getString("progress", null); if (s != null) o = new JSONObject(s); } catch (Exception ignored) {}
    if (o == null || o.optInt("total") == 0) {
      progressCount.setText("—");
      progressLabel.setText(paired ? t("no_request") : t("pair_to_start"));
      progressBar.setProgress(0);
      progressStats.setVisibility(View.GONE);
      progressCurrent.setText("");
      progressNote.setText(paired ? t("progress_hint") : "");
      return;
    }
    int total = o.optInt("total"), done = o.optInt("done"), failed = o.optInt("failed"), waiting = o.optInt("pending") + o.optInt("working");
    int handled = done + failed;
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
    long minute = System.currentTimeMillis() / 60_000;
    String key = raw.hashCode() + ":" + minute;
    if (key.equals(historyShown)) return;
    historyShown = key;
    historyList.removeAllViews();
    JSONArray h;
    try { h = new JSONArray(raw); } catch (Exception e) { h = new JSONArray(); }
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
      String when = DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(e.optLong("at")));
      String detail = ok ? t("segments", e.optInt("segments")) + " · " + when : when + " · " + e.optString("error", t("failed"));
      TextView d = text(texts, detail, 12, ok ? MUTED : RED, false);
      d.setMaxLines(1); d.setEllipsize(TextUtils.TruncateAt.END);
      row.addView(texts, new LinearLayout.LayoutParams(0, -2, 1));
      final String vid = e.optString("videoId");
      final long at = e.optLong("at");
      row.setOnClickListener(v -> startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com/watch?v=" + vid))));
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

  @Override protected void onResume() { super.onResume(); historyShown = null; ui.post(refresher); }
  @Override protected void onPause() { ui.removeCallbacks(refresher); super.onPause(); }

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
      default: save(TranscriptFetcher.toJson(last), "application/json", id + "." + lang + ".json");
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
