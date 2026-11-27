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
import android.widget.CheckBox;
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
  static final int LINKEDIN_FILE_REQUEST = 42;
  static final String[] TABS = {"tab_assistant", "tab_extract", "NotebookLM", "LinkedIn", "tab_help"};

  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final Handler ui = new Handler(Looper.getMainLooper());
  private final View[] pages = new View[5];
  private WebView notebookWeb;
  private LinearLayout notebookActions;
  private boolean notebookExpanded = false;
  private android.widget.ImageButton notebookExpand;
  private LinearLayout appShell;
  private View appHeader, appTabs;
  private WebView linkedinWeb;
  private android.webkit.ValueCallback<Uri[]> linkedinFileCallback;
  // Cache only: never write LinkedIn relay attachments to Downloads or Gallery.
  private void cleanLinkedInAttachmentCache(boolean all) {
    try {
      java.io.File dir = new java.io.File(getCacheDir(), "linkedin-shared");
      java.io.File[] files = dir.listFiles();
      if (files == null) return;
      long now = System.currentTimeMillis();
      for (java.io.File file : files) {
        boolean stale = all || now - file.lastModified() > 15 * 60 * 1000L;
        if (file.isFile() && file.getName().startsWith("linkedin-") && stale) file.delete();
        // Per-job folders (0.6.19+) left behind by an interrupted job.
        if (file.isDirectory() && file.getName().startsWith("job-") && stale) {
          java.io.File[] inner = file.listFiles();
          if (inner != null) for (java.io.File f : inner) f.delete();
          file.delete();
        }
      }
    } catch (Exception e) { android.util.Log.w("CamMicGoLinkedIn", "Cache cleanup failed", e); }
  }
  private void scheduleLinkedInCacheCleanup() {
    // The WebView file chooser callback only acknowledges a URI; it does NOT prove
    // LinkedIn finished reading/uploading the bytes. Keep a bounded grace period.
    ui.postDelayed(() -> cleanLinkedInAttachmentCache(true), 15 * 60 * 1000L);
  }
  private Uri linkedinPendingAttachment;
  private String linkedinPendingAttachmentJob;
  private boolean linkedinExpanded = false;
  private android.widget.ImageButton linkedinExpand;
  private LinearLayout linkedinAttachRow;
  private LinearLayout linkedinActions;
  private boolean linkedinMcpEnabled = false;
  private boolean linkedinPollBusy = false;
  private final ExecutorService linkedinPollWorker = Executors.newSingleThreadExecutor();
  /** Read by the background relay: notify only when the app cannot pick LinkedIn commands up itself. */
  static volatile boolean foreground = false, linkedinControlOn = false;
  private String linkedinBusyJob;
  private long linkedinBusySince;
  private Button linkedinMcpControlButton;
  private String linkedinLastPollError = "";
  private final Runnable linkedinPoll = new Runnable() {
    @Override public void run() {
      linkedinControlOn = foreground && linkedinMcpEnabled && linkedinWeb != null;
      if (!linkedinControlOn) return;
      // Watchdog: a job that never reports back (page frozen, callback lost) must not block the queue forever.
      // A post extraction counts from its last progress (it may legitimately run for many minutes).
      if (linkedinPollBusy && linkedinBusyJob != null && System.currentTimeMillis() - linkedinBusySince > (linkedinBusyJob.equals(liProgressJob) ? 600_000 : 240_000)) {
        String stuck = linkedinBusyJob;
        liDeleteJobFiles(stuck);
        finishLinkedInJob(stuck, null, "Interrupted on the phone: no confirmed result. Check the LinkedIn conversation before trying again.");
      }
      if (!linkedinPollBusy && RelayClient.token(MainActivity.this) != null) {
        linkedinPollBusy = true;
        linkedinPollWorker.execute(() -> {
          try {
            JSONObject response = new JSONObject(RelayClient.request("GET", "/api/devices/linkedin", RelayClient.token(MainActivity.this), null));
            JSONObject job = response.optJSONObject("job");
            if (job != null) ui.post(() -> {
              linkedinBusyJob = job.optString("id"); linkedinBusySince = System.currentTimeMillis();
              recordLinkedInActivity(job.optString("id"), job.optString("operation"), "received", "", job.optString("agentName", ""));
              liExtras(job.optString("id"), job.optString("participant", job.optString("keywords", "")), job.optString("attachmentName", ""));
              executeLinkedInJob(job);
            });
            else ui.post(() -> linkedinPollBusy = false);
          } catch (Exception e) { ui.post(() -> { linkedinLastPollError = e.toString(); linkedinPollBusy = false; }); }
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
  private LinearLayout unpairedBox, pairedBox, historyList, notebookRequests, linkedinRequests;
  private View statusDot;
  private TextView statusLine, relayDetail;
  private TextView progressCount, progressLabel, progressCurrent, progressNote, progressFreshness, statDone, statWaiting, statFailed;
  private ProgressBar progressBar, progressSpinner;
  private LinearLayout progressStats;
  private String historyShown;
  private long lastMcpDebugFetch = 0L;
  private Button clearHistory;
  /** Mail-style selection in the activity list: keys of the checked rows, and the rows' checkboxes. */
  private final java.util.LinkedHashSet<String> historySelected = new java.util.LinkedHashSet<>();
  private final java.util.LinkedHashMap<String, CheckBox> historyBoxes = new java.util.LinkedHashMap<>();
  private CheckBox selectAllBox;
  private TextView selectionCount;
  private LinearLayout selectionBar;
  private boolean syncingSelection;
  private View requestsTitle, requestsCard;
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
    c.setBackground(shape(Color.WHITE, 16, LINE));
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
    lp.setMargins(0, 0, 0, dp(14));
    parent.addView(c, lp);
    return c;
  }

  /** Small upper-case section label above cards. */
  private TextView section(LinearLayout parent, String s) {
    TextView t = text(parent, s.toUpperCase(), 11, MUTED, true);
    t.setLetterSpacing(0.1f);
    t.setPadding(dp(4), dp(10), 0, dp(8));
    return t;
  }

  /** Vector icon at the start of a button or label (no emoji: same look on every phone). */
  private <T extends TextView> T withIcon(T v, UiIcons.Kind icon, int color) {
    v.setCompoundDrawablesRelative(UiIcons.make(icon, color, dp(18)), null, null, null);
    v.setCompoundDrawablePadding(dp(8));
    return v;
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
    android.graphics.drawable.StateListDrawable st = new android.graphics.drawable.StateListDrawable();
    st.addState(new int[]{android.R.attr.state_pressed}, shape(VIOLET, 14, 0));
    st.addState(new int[]{-android.R.attr.state_enabled}, shape(GREY, 14, 0));
    st.addState(new int[]{}, g);
    b.setBackground(st);
    b.setPadding(dp(18), dp(12), dp(18), dp(12));
    b.setStateListAnimator(null);
    return b;
  }

  private Button secondary(String s) {
    Button b = new Button(this);
    b.setText(s); b.setAllCaps(false); b.setTextColor(BLUE); b.setTextSize(14);
    b.setTypeface(Typeface.DEFAULT_BOLD);
    b.setBackground(toolBackground(TOOL_FILL, TOOL_LINE));
    b.setPadding(dp(14), dp(10), dp(14), dp(10));
    b.setStateListAnimator(null);
    return b;
  }

  private Button flat(String s, int color) {
    Button b = new Button(this);
    b.setText(s); b.setAllCaps(false); b.setTextColor(color); b.setTextSize(14);
    b.setBackgroundColor(Color.TRANSPARENT); b.setStateListAnimator(null);
    return b;
  }

  // ---------- toolbars above the LinkedIn / NotebookLM web views ----------
  // One look everywhere: 40dp tall, 12dp corners, soft blue fill, vector icon + short label.
  static final int TOOL_FILL = Color.rgb(236, 242, 254), TOOL_LINE = Color.rgb(214, 226, 248),
      OK_FILL = Color.rgb(232, 247, 238), OK_LINE = Color.rgb(170, 222, 189);

  private LinearLayout toolbarRow() {
    LinearLayout row = new LinearLayout(this);
    row.setOrientation(LinearLayout.HORIZONTAL);
    row.setGravity(Gravity.CENTER_VERTICAL);
    row.setPadding(dp(10), dp(6), dp(10), dp(6));
    return row;
  }

  private Button toolButton(String label, UiIcons.Kind icon) {
    Button b = new Button(this);
    b.setText(label); b.setAllCaps(false); b.setSingleLine(true);
    b.setTextSize(13); b.setTypeface(Typeface.DEFAULT_BOLD); b.setTextColor(INK);
    b.setMinHeight(0); b.setMinimumHeight(0); b.setMinWidth(0); b.setMinimumWidth(0);
    b.setPadding(dp(12), 0, dp(12), 0);
    b.setStateListAnimator(null);
    b.setBackground(toolBackground(TOOL_FILL, TOOL_LINE));
    b.setGravity(Gravity.CENTER);
    if (icon != null) {
      b.setCompoundDrawables(UiIcons.make(icon, BLUE, dp(18)), null, null, null);
      b.setCompoundDrawablePadding(dp(6));
    }
    return b;
  }

  /** Square icon-only button (expand, refresh…); the description is read by TalkBack and shown on long press. */
  private android.widget.ImageButton iconButton(UiIcons.Kind icon, String description) {
    android.widget.ImageButton b = new android.widget.ImageButton(this);
    b.setImageDrawable(UiIcons.make(icon, BLUE, dp(20)));
    b.setScaleType(android.widget.ImageView.ScaleType.CENTER);
    b.setBackground(toolBackground(TOOL_FILL, TOOL_LINE));
    b.setContentDescription(description);
    if (android.os.Build.VERSION.SDK_INT >= 26) b.setTooltipText(description);
    b.setPadding(0, 0, 0, 0);
    return b;
  }

  /** Rounded fill with a pressed state, so taps give visible feedback. */
  private Drawable toolBackground(int fill, int stroke) {
    android.graphics.drawable.StateListDrawable s = new android.graphics.drawable.StateListDrawable();
    s.addState(new int[]{android.R.attr.state_pressed}, shape(Color.rgb(214, 228, 253), 12, BLUE));
    s.addState(new int[]{}, shape(fill, 12, stroke));
    return s;
  }

  private LinearLayout.LayoutParams toolLp(int widthPx, float weight, boolean gap) {
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(widthPx, dp(40), weight);
    if (gap) lp.leftMargin = dp(8);
    return lp;
  }

  /** Segmented control like the app's main tabs: the active page is a filled blue pill. */
  private LinearLayout navSegment(Button... items) {
    LinearLayout seg = new LinearLayout(this);
    seg.setPadding(dp(3), dp(3), dp(3), dp(3));
    seg.setBackground(shape(Color.rgb(230, 237, 250), 14, 0));
    for (Button b : items) {
      b.setBackground(null);
      b.setPadding(dp(6), 0, dp(6), 0);
      b.setCompoundDrawablePadding(dp(4));
      b.setEllipsize(android.text.TextUtils.TruncateAt.END);
      seg.addView(b, new LinearLayout.LayoutParams(0, dp(38), 1));
    }
    return seg;
  }

  private void setNavState(Button b, boolean on) {
    b.setSelected(on);
    b.setBackground(on ? shape(BLUE, 11, 0) : null);
    b.setElevation(on ? dp(1) : 0);
    b.setTextColor(on ? Color.WHITE : MUTED);
    b.setCompoundDrawableTintList(android.content.res.ColorStateList.valueOf(on ? Color.WHITE : MUTED));
  }

  private void setToggleState(Button b, boolean on) {
    b.setBackground(on ? toolBackground(OK_FILL, OK_LINE) : toolBackground(TOOL_FILL, TOOL_LINE));
    b.setTextColor(on ? GREEN : INK);
    b.setCompoundDrawables(UiIcons.make(on ? UiIcons.Kind.SHIELD_OK : UiIcons.Kind.SHIELD, on ? GREEN : BLUE, dp(18)), null, null, null);
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
    getWindow().setNavigationBarColor(Color.WHITE);
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

    LinearLayout shell = new LinearLayout(this);
    shell.setOrientation(LinearLayout.VERTICAL);
    shell.setBackgroundColor(BG);
    shell.setLayoutDirection(I18n.rtl(this) ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR);

    appShell = shell;
    int beforeHeader = shell.getChildCount();
    buildAppBar(shell);
    appHeader = shell.getChildCount() > beforeHeader ? shell.getChildAt(beforeHeader) : null;
    FrameLayout host = new FrameLayout(this);
    shell.addView(host, new LinearLayout.LayoutParams(-1, 0, 1));
    buildAssistantPage(page(host, 0));
    buildExtractPage(page(host, 1));
    buildNotebookTab(host);
    buildLinkedInTab(host);
    buildHelpPage(page(host, 4));
    int beforeTabs = shell.getChildCount();
    buildTabs(shell);
    appTabs = shell.getChildCount() > beforeTabs ? shell.getChildAt(beforeTabs) : null;

    setContentView(shell);
    selectTab(state != null ? state.getInt("tab", 0) : 0);
    handleShare(getIntent());
  }

  @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); out.putInt("tab", currentTab); }

  private void buildAppBar(LinearLayout shell) {
    LinearLayout bar = new LinearLayout(this);
    bar.setGravity(Gravity.CENTER_VERTICAL);
    bar.setBackgroundColor(Color.WHITE);
    bar.setPadding(dp(16), dp(10), dp(12), dp(10));
    ImageView logo = new ImageView(this);
    logo.setImageResource(R.mipmap.ic_launcher);
    bar.addView(logo, new LinearLayout.LayoutParams(dp(36), dp(36)));
    LinearLayout titles = new LinearLayout(this);
    titles.setOrientation(LinearLayout.VERTICAL);
    titles.setPadding(dp(10), 0, dp(8), 0);
    TextView name = text(titles, "CamMicGo", 18, INK, true);
    name.setLetterSpacing(-0.01f);
    TextView subtitle = text(titles, t("app_sub"), 11, MUTED, false);
    subtitle.setSingleLine(true);
    subtitle.setEllipsize(TextUtils.TruncateAt.END);
    bar.addView(titles, new LinearLayout.LayoutParams(0, -2, 1));

    TextView lang = withIcon(text(null, I18n.code(this).toUpperCase(), 12, INK, true), UiIcons.Kind.BROWSER, MUTED);
    lang.setCompoundDrawablePadding(dp(4));
    lang.setGravity(Gravity.CENTER_VERTICAL);
    lang.setPadding(dp(10), dp(7), dp(10), dp(7));
    lang.setBackground(shape(Color.WHITE, 20, LINE));
    lang.setContentDescription(t("language_title"));
    lang.setOnClickListener(v -> pickLanguage());
    LinearLayout.LayoutParams langLp = new LinearLayout.LayoutParams(-2, -2);
    langLp.setMarginEnd(dp(6));
    bar.addView(lang, langLp);

    LinearLayout chip = new LinearLayout(this);
    chip.setGravity(Gravity.CENTER_VERTICAL);
    chip.setPadding(dp(10), dp(7), dp(12), dp(7));
    chip.setBackground(shape(Color.WHITE, 20, LINE));
    chipDot = new View(this);
    chip.addView(chipDot, new LinearLayout.LayoutParams(dp(8), dp(8)));
    chipText = text(null, "", 12, INK, true);
    chipText.setPadding(dp(6), 0, 0, 0);
    chip.addView(chipText);
    chip.setOnClickListener(v -> selectTab(0));
    bar.addView(chip);

    LinearLayout header = new LinearLayout(this);
    header.setOrientation(LinearLayout.VERTICAL);
    header.addView(bar, new LinearLayout.LayoutParams(-1, -2));
    View rule = new View(this);
    rule.setBackgroundColor(LINE);
    header.addView(rule, new LinearLayout.LayoutParams(-1, Math.max(1, dp(1) / 2 + 1)));
    shell.addView(header, new LinearLayout.LayoutParams(-1, -2));
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

  private static final UiIcons.Kind[] TAB_ICONS = {UiIcons.Kind.SPARK, UiIcons.Kind.DOC, UiIcons.Kind.BOOK, UiIcons.Kind.LINKEDIN, UiIcons.Kind.HELP};
  private final android.widget.ImageView[] tabIcons = new android.widget.ImageView[5];

  /** Bottom navigation (Material style): icon in a pill that fills when active, short label under it. */
  private void buildTabs(LinearLayout shell) {
    LinearLayout nav = new LinearLayout(this);
    nav.setOrientation(LinearLayout.VERTICAL);
    nav.setBackgroundColor(Color.WHITE);
    View rule = new View(this);
    rule.setBackgroundColor(LINE);
    nav.addView(rule, new LinearLayout.LayoutParams(-1, Math.max(1, dp(1) / 2 + 1)));
    LinearLayout row = new LinearLayout(this);
    row.setPadding(dp(4), dp(8), dp(4), dp(10));
    for (int i = 0; i < TABS.length; i++) {
      final int index = i;
      LinearLayout item = new LinearLayout(this);
      item.setOrientation(LinearLayout.VERTICAL);
      item.setGravity(Gravity.CENTER_HORIZONTAL);
      item.setClickable(true);
      item.setBackground(null);
      android.widget.ImageView icon = new android.widget.ImageView(this);
      icon.setImageDrawable(UiIcons.make(TAB_ICONS[i], MUTED, dp(22)));
      icon.setScaleType(android.widget.ImageView.ScaleType.CENTER);
      item.addView(icon, new LinearLayout.LayoutParams(dp(56), dp(30)));
      TextView label = text(null, (i == 2 || i == 3) ? TABS[i] : t(TABS[i]), 11, MUTED, true);
      label.setGravity(Gravity.CENTER);
      label.setSingleLine(true);
      label.setEllipsize(TextUtils.TruncateAt.END);
      label.setPadding(0, dp(4), 0, 0);
      item.addView(label, new LinearLayout.LayoutParams(-1, -2));
      item.setContentDescription(label.getText());
      item.setOnClickListener(v -> selectTab(index));
      row.addView(item, new LinearLayout.LayoutParams(0, -2, 1));
      tabViews[i] = label;
      tabIcons[i] = icon;
    }
    nav.addView(row, new LinearLayout.LayoutParams(-1, -2));
    shell.addView(nav, new LinearLayout.LayoutParams(-1, -2));
  }

  private void selectTab(int index) {
    if (notebookExpanded && index != 2) setNotebookExpanded(false);
    if (linkedinExpanded && index != 3) setLinkedInExpanded(false);
    currentTab = index;
    for (int i = 0; i < pages.length; i++) {
      boolean on = i == index;
      pages[i].setVisibility(on ? View.VISIBLE : View.GONE);
      tabViews[i].setTextColor(on ? BLUE : MUTED);
      tabIcons[i].setImageDrawable(UiIcons.make(TAB_ICONS[i], on ? BLUE : MUTED, dp(22)));
      tabIcons[i].setBackground(on ? shape(Color.rgb(226, 235, 253), 15, 0) : null);
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
    Button copyAsk = withIcon(secondary(t("copy_ask")), UiIcons.Kind.COPY, BLUE);
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
    retryYoutubeButton = secondary("↻  Réessayer maintenant (pause YouTube HTTP 429)");
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

    requestsTitle = section(root, t("sec_requests"));
    LinearLayout p = card(root);
    requestsCard = p;
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

    section(root, t("sec_sent"));
    // One unified, scrollable activity feed for YouTube, NotebookLM and LinkedIn.
    TextView hint = text(root, t("select_hint"), 12, MUTED, false);
    hint.setPadding(dp(4), 0, 0, dp(8));
    LinearLayout h = card(root);
    h.setPadding(dp(6), dp(6), dp(6), dp(6));
    // "Select all" bar, as in a mailbox.
    selectionBar = new LinearLayout(this);
    selectionBar.setGravity(Gravity.CENTER_VERTICAL);
    selectionBar.setPadding(dp(6), 0, dp(10), dp(2));
    selectAllBox = new CheckBox(this);
    selectAllBox.setText(t("select_all"));
    selectAllBox.setTextColor(INK);
    selectAllBox.setTextSize(14);
    selectAllBox.setOnCheckedChangeListener((b, checked) -> {
      if (syncingSelection) return;
      syncingSelection = true;
      historySelected.clear();
      if (checked) historySelected.addAll(historyBoxes.keySet());
      for (CheckBox cb : historyBoxes.values()) cb.setChecked(checked);
      syncingSelection = false;
      updateSelectionUi();
    });
    selectionBar.addView(selectAllBox, new LinearLayout.LayoutParams(0, dp(44), 1));
    selectionCount = text(selectionBar, "", 13, MUTED, false);
    h.addView(selectionBar, new LinearLayout.LayoutParams(-1, -2));
    historyList = new LinearLayout(this);
    historyList.setOrientation(LinearLayout.VERTICAL);
    android.widget.ScrollView activityScroll = new android.widget.ScrollView(this) {
      @Override protected void onMeasure(int w, int h) {
        super.onMeasure(w, View.MeasureSpec.makeMeasureSpec(dp(360), View.MeasureSpec.AT_MOST));
      }
    };
    activityScroll.setFillViewport(false);
    // The feed sits inside the page's own scroll view: keep its scroll bar visible and let it take the
    // finger while it is touched, otherwise the outer page swallows the gesture and the list never scrolls.
    activityScroll.setVerticalScrollBarEnabled(true);
    activityScroll.setScrollbarFadingEnabled(false);
    activityScroll.setNestedScrollingEnabled(true);
    activityScroll.setOnTouchListener((v, e) -> {
      int a = e.getActionMasked();
      v.getParent().requestDisallowInterceptTouchEvent(a != android.view.MotionEvent.ACTION_UP && a != android.view.MotionEvent.ACTION_CANCEL);
      return false;
    });
    activityScroll.addView(historyList);
    h.addView(activityScroll, new LinearLayout.LayoutParams(-1, -2));
    Button diagnostics = secondary(localizedMcpDiagnosticTitle());
    diagnostics.setOnClickListener(v -> {
      SharedPreferences prefs = RelayClient.prefs(this);
      long until = prefs.getLong("youtubePausedUntil", 0L);
      String report = "CamMicGo SEO MCP " + appVersion() + " · " + android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL + " · Android " + android.os.Build.VERSION.RELEASE
          + "\nGénéré : " + java.time.ZonedDateTime.now().withNano(0)
          + "\nMode connecté : " + (prefs.getBoolean("connected", false) ? "actif" : "arrêté")
          + " · dernier contact serveur : " + (prefs.getLong("lastSync", 0) > 0 ? DateFormat.getTimeInstance(DateFormat.MEDIUM).format(new Date(prefs.getLong("lastSync", 0))) : "jamais")
          + "\nStatut relais : " + prefs.getString("status", "—")
          + "\nPause YouTube (429) : " + (prefs.getBoolean("youtube429ManualPause", false) ? "manuelle" : until > System.currentTimeMillis() ? "jusqu'à " + DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(until)) : "non")
          + "\nContrôle LinkedIn : " + (linkedinMcpEnabled ? "activé" : "désactivé")
          + "\nDernière erreur : " + (linkedinLastPollError.isEmpty() ? "aucune" : linkedinLastPollError)
          + "\n\nDemandes de transcription : " + prettyJson(prefs.getString("progress", "null"))
          + "\n\nTâches LinkedIn : " + prettyJson(prefs.getString("linkedinAssistantHistory", "[]"))
          + "\n\nMétadonnées MCP : " + prettyJson(prefs.getString("mcpDebugHistory", "[]"));
      showDiagnostic(localizedMcpDiagnosticTitle(), report);
    });
    h.addView(diagnostics, new LinearLayout.LayoutParams(-1, -2));
    clearHistory = withIcon(flat(t("delete_selected", 0), RED), UiIcons.Kind.TRASH, RED);
    clearHistory.setOnClickListener(v -> {
      if (historySelected.isEmpty()) return;
      int n = historySelected.size();
      new AlertDialog.Builder(this)
        .setTitle(t("delete_selected_q", n))
        .setMessage(t("clear_msg"))
        .setPositiveButton(t("remove"), (dlg, which) -> deleteHistorySelection())
        .setNegativeButton(t("cancel"), null)
        .show();
    });
    h.addView(clearHistory, new LinearLayout.LayoutParams(-1, -2));
  }

  /** Checked count, "select all" state and the delete button, after any change of selection. */
  private void updateSelectionUi() {
    if (selectAllBox == null) return;
    historySelected.retainAll(historyBoxes.keySet());
    int n = historySelected.size(), total = historyBoxes.size();
    syncingSelection = true;
    selectAllBox.setChecked(total > 0 && n == total);
    syncingSelection = false;
    selectionCount.setText(n == 0 ? "" : t("selected_n", n));
    selectionBar.setVisibility(total == 0 ? View.GONE : View.VISIBLE);
    clearHistory.setText(t("delete_selected", n));
    clearHistory.setEnabled(n > 0);
    clearHistory.setAlpha(n > 0 ? 1f : 0.4f);
    clearHistory.setVisibility(total == 0 ? View.GONE : View.VISIBLE);
  }

  /** Removes the checked rows from their local lists (YouTube, NotebookLM, LinkedIn, MCP requests). */
  private void deleteHistorySelection() {
    SharedPreferences p = RelayClient.prefs(this);
    java.util.Set<String> keys = new java.util.HashSet<>(historySelected);
    boolean all = keys.size() == historyBoxes.size();
    SharedPreferences.Editor ed = p.edit();
    ed.putString("history", filterHistory(p.getString("history", "[]"), o -> keys.contains("yt:" + o.optString("videoId") + ":" + o.optLong("at"))));
    ed.putString("assistantNotebookHistory", filterHistory(p.getString("assistantNotebookHistory", "[]"), o -> keys.contains("nb:" + o.optString("jobId") + ":" + o.optLong("at"))));
    ed.putString("linkedinAssistantHistory", filterHistory(p.getString("linkedinAssistantHistory", "[]"), o -> keys.contains("li:" + o.optString("id"))));
    ed.putString("mcpDebugHistory", filterHistory(p.getString("mcpDebugHistory", "[]"), o -> keys.contains("mcp:" + o.optString("at"))));
    // The server keeps recent MCP calls: hide the removed ones so the next sync does not bring them back.
    try {
      JSONArray hidden = new JSONArray(p.getString("mcpDebugHidden", "[]"));
      for (String k : keys) if (k.startsWith("mcp:")) hidden.put(k.substring(4));
      while (hidden.length() > 200) hidden.remove(0);
      ed.putString("mcpDebugHidden", hidden.toString());
    } catch (Exception ignored) {}
    if (all) { ed.putLong("mcpDebugClearedAt", System.currentTimeMillis()); linkedinLastPollError = ""; }
    ed.apply();
    historySelected.clear();
    historyShown = null;
    refreshHistory(p);
  }

  private interface EntryTest { boolean test(JSONObject o); }
  private static String filterHistory(String raw, EntryTest remove) {
    JSONArray out = new JSONArray();
    try {
      JSONArray old = new JSONArray(raw);
      for (int i = 0; i < old.length(); i++) { JSONObject o = old.optJSONObject(i); if (o != null && !remove.test(o)) out.put(o); }
    } catch (Exception e) { return raw; }
    return out.toString();
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
    offerOldModelCleanup(root);
    section(root, t("sec_transcribe"));
    LinearLayout c = card(root);
    text(c, t("extract_title"), 17, INK, true);
    TextView sub = text(c, t("extract_sub"), 13, MUTED, false);
    sub.setPadding(0, dp(4), 0, dp(10));
    urlInput = withIcon(field(t("url_hint")), UiIcons.Kind.LINK, MUTED);
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
    Button toNotebook = withIcon(secondary("Ajouter à un notebook NotebookLM"), UiIcons.Kind.BOOK, BLUE);
    c.addView(toNotebook, gapTop(8));
    toNotebook.setOnClickListener(v -> addVideoToNotebook(urlInput.getText().toString()));

    resultCard = card(root);
    resultCard.setVisibility(View.GONE);
    text(resultCard, t("transcript"), 17, INK, true);
    resultMeta = text(resultCard, "", 13, MUTED, false);
    resultMeta.setPadding(0, dp(4), 0, dp(10));
    LinearLayout actions = new LinearLayout(this);
    Button copy = withIcon(secondary(t("copy_btn")), UiIcons.Kind.COPY, BLUE), share = withIcon(secondary(t("share_btn")), UiIcons.Kind.SHARE, BLUE);
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



  // ---------- LinkedIn: personal account, on-device session ----------
  private void setLinkedInExpanded(boolean expanded) {
    linkedinExpanded = expanded;
    if (appHeader != null) appHeader.setVisibility(expanded ? View.GONE : View.VISIBLE);
    if (appTabs != null) appTabs.setVisibility(expanded ? View.GONE : View.VISIBLE);
    if (linkedinActions != null) linkedinActions.setVisibility(expanded ? View.GONE : View.VISIBLE);
    if (linkedinExpand != null) {
      String d = linkedinToolbarText(expanded ? "collapse" : "expand");
      linkedinExpand.setImageDrawable(UiIcons.make(expanded ? UiIcons.Kind.COLLAPSE : UiIcons.Kind.EXPAND, expanded ? Color.WHITE : BLUE, dp(20)));
      linkedinExpand.setBackground(expanded ? shape(BLUE, 12, 0) : toolBackground(TOOL_FILL, TOOL_LINE));
      linkedinExpand.setContentDescription(d);
      if (android.os.Build.VERSION.SDK_INT >= 26) linkedinExpand.setTooltipText(d);
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

    LinearLayout actions = toolbarRow();
    actions.setPadding(dp(10), dp(8), dp(10), dp(2));
    Button messages = toolButton(t("linkedin_messages"), UiIcons.Kind.CHAT);
    Button network = toolButton(t("linkedin_network"), UiIcons.Kind.PEOPLE);
    Button search = toolButton(t("linkedin_search"), UiIcons.Kind.SEARCH);
    actions.addView(navSegment(messages, network, search), new LinearLayout.LayoutParams(-1, -2));
    root.addView(actions);
    linkedinNav = new Button[]{messages, network, search};
    for (Button b : linkedinNav) setNavState(b, false);

    linkedinActions = actions;
    // One compact toolbar: [expand] [MCP access ………] [JSON]
    LinearLayout toolsRow = toolbarRow();
    android.widget.ImageButton expandLinkedIn = iconButton(UiIcons.Kind.EXPAND, linkedinToolbarText("expand"));
    linkedinExpand = expandLinkedIn;
    toolsRow.addView(expandLinkedIn, toolLp(dp(40), 0, false));
    expandLinkedIn.setOnClickListener(v -> setLinkedInExpanded(!linkedinExpanded));
    linkedinWeb = new WebView(this);
    linkedinWeb.getSettings().setJavaScriptEnabled(true);
    linkedinWeb.getSettings().setDomStorageEnabled(true);
    // The extraction goes on while the user is in other apps: keep the page's renderer at full priority
    // even when it is not on screen (the reader's pauses no longer rely on the page's timers either).
    if (android.os.Build.VERSION.SDK_INT >= 26) linkedinWeb.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(linkedinWeb, true);
    Button mcpControl = toolButton(linkedinToolbarText(linkedinMcpEnabled ? "allowed" : "allow"), UiIcons.Kind.SHIELD);
    mcpControl.setContentDescription(linkedinToolbarText("permission"));
    linkedinMcpControlButton = mcpControl;
    setToggleState(mcpControl, linkedinMcpEnabled);
    toolsRow.addView(mcpControl, toolLp(0, 1, true));
    mcpControl.setOnClickListener(v -> {
      if (linkedinMcpEnabled) {
        linkedinMcpEnabled = false;
        linkedinControlOn = false;
        ui.removeCallbacks(linkedinPoll);
        mcpControl.setText(linkedinToolbarText("allow"));
        setToggleState(mcpControl, false);
        Toast.makeText(this, "Contrôle LinkedIn MCP désactivé", Toast.LENGTH_SHORT).show();
      } else {
        new AlertDialog.Builder(this).setTitle("Autoriser la navigation LinkedIn ?")
          .setMessage("Les assistants MCP associés pourront parcourir votre messagerie LinkedIn et lire les conversations affichées pendant cette session de l’application. Le contrôle est suspendu en arrière-plan et reprend à votre retour. Vous pouvez le désactiver à tout moment. Les demandes d’envoi de messages nécessitent une confirmation explicite dans l’assistant. Les cookies ne sont jamais transmis.")
          .setNegativeButton("Annuler", (d, w) -> {})
          .setPositiveButton("Autoriser", (d, w) -> {
            linkedinMcpEnabled = true;
            mcpControl.setText(linkedinToolbarText("allowed"));
            setToggleState(mcpControl, true);
            ui.removeCallbacks(linkedinPoll);
            ui.post(linkedinPoll);
          }).show();
      }
    });
    Button exportJson = toolButton("JSON", UiIcons.Kind.DOWNLOAD);
    exportJson.setContentDescription(linkedinToolbarText("export"));
    toolsRow.addView(exportJson, toolLp(-2, 0, true));
    root.addView(toolsRow, new LinearLayout.LayoutParams(-1, -2));
    exportJson.setOnClickListener(v -> exportLinkedInThreadJson());
    // Fast read (off by default): the reader asks LinkedIn's own service for the next pieces of a reaction
    // list, the way the page does, with pauses and a daily cap. The user turns it on, knowing the risk.
    boolean fastOn = RelayClient.prefs(this).getBoolean("liFastRead", false);
    Button fastRead = toolButton(I18n.t(this, fastOn ? "li_fast_on" : "li_fast_off"), UiIcons.Kind.DOWNLOAD);
    setToggleState(fastRead, fastOn);
    fastRead.setOnClickListener(v -> {
      boolean on = RelayClient.prefs(this).getBoolean("liFastRead", false);
      if (on) { RelayClient.prefs(this).edit().putBoolean("liFastRead", false).apply(); fastRead.setText(I18n.t(this, "li_fast_off")); setToggleState(fastRead, false); return; }
      new AlertDialog.Builder(this).setTitle(I18n.t(this, "li_fast_title")).setMessage(I18n.t(this, "li_fast_warning"))
        .setNegativeButton(android.R.string.cancel, null)
        .setPositiveButton(android.R.string.ok, (d, w) -> { RelayClient.prefs(this).edit().putBoolean("liFastRead", true).apply(); fastRead.setText(I18n.t(this, "li_fast_on")); setToggleState(fastRead, true); }).show();
    });
    LinearLayout fastRow = toolbarRow();
    fastRow.addView(fastRead, toolLp(0, 1, true));
    root.addView(fastRow, new LinearLayout.LayoutParams(-1, -2));
    // Shown while a post extraction runs: stops reading and builds the report from what was read.
    linkedinStopButton = toolButton(I18n.t(this, "li_stop_report"), UiIcons.Kind.DOC);
    linkedinStopButton.setVisibility(View.GONE);
    linkedinStopButton.setOnClickListener(v -> { liStopRequested = true; v.setEnabled(false); ((Button) v).setText(I18n.t(this, "li_stopping")); });
    LinearLayout stopRow = toolbarRow();
    stopRow.addView(linkedinStopButton, toolLp(0, 1, true));
    root.addView(stopRow, new LinearLayout.LayoutParams(-1, -2));
    // Live counters of a post extraction: comments and reactions read against LinkedIn's totals.
    liProgressPanel = new LinearLayout(this);
    liProgressPanel.setOrientation(LinearLayout.VERTICAL);
    liProgressPanel.setPadding(dp(12), dp(4), dp(12), dp(6));
    liProgressPanel.setVisibility(View.GONE);
    liCommentsText = new TextView(this); liCommentsText.setTextSize(13);
    liCommentsBar = new android.widget.ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal); liCommentsBar.setMax(1000);
    liReactionsText = new TextView(this); liReactionsText.setTextSize(13);
    liReactionsBar = new android.widget.ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal); liReactionsBar.setMax(1000);
    liProgressPanel.addView(liCommentsText); liProgressPanel.addView(liCommentsBar, new LinearLayout.LayoutParams(-1, dp(8)));
    liProgressPanel.addView(liReactionsText); liProgressPanel.addView(liReactionsBar, new LinearLayout.LayoutParams(-1, dp(8)));
    root.addView(liProgressPanel, new LinearLayout.LayoutParams(-1, -2));
    linkedinWeb.setWebChromeClient(new WebChromeClient() {
      @Override public boolean onShowFileChooser(WebView view, android.webkit.ValueCallback<Uri[]> callback, FileChooserParams params) {
        if (linkedinPendingAttachment != null && linkedinPendingAttachmentJob != null) {
          Uri selected = linkedinPendingAttachment;
          linkedinPendingAttachment = null;
          linkedinPendingAttachmentJob = null;
          callback.onReceiveValue(new Uri[]{selected});
          // The chooser received the file; the job goes on by checking that LinkedIn shows it (never "done" here).
          Runnable next = linkedinChooserDelivered;
          linkedinChooserDelivered = null;
          if (next != null) next.run();
          return true;
        }
        if (linkedinFileCallback != null) linkedinFileCallback.onReceiveValue(null);
        linkedinFileCallback = callback;
        try {
          Intent picker = params.createIntent();
          picker.addCategory(Intent.CATEGORY_OPENABLE);
          startActivityForResult(picker, LINKEDIN_FILE_REQUEST);
        } catch (Exception e) {
          linkedinFileCallback = null;
          callback.onReceiveValue(null);
          Toast.makeText(MainActivity.this, "Impossible d'ouvrir les fichiers", Toast.LENGTH_LONG).show();
        }
        return true;
      }
    });
    linkedinWeb.setWebViewClient(new WebViewClient() {
      @Override public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) { markLinkedInNav(url); }
      @Override public void onPageFinished(WebView view, String url) { markLinkedInNav(url); if (url != null && url.startsWith("https://www.linkedin.com/")) ui.postDelayed(() -> dismissLinkedInAppPrompt(), 600); }
    });
    // Native buttons provide accessible touch targets instead of relying on tiny web icons.
    LinearLayout attachmentRow = toolbarRow();
    attachmentRow.setPadding(dp(10), 0, dp(10), dp(8));
    Button imageButton = toolButton("Image", UiIcons.Kind.IMAGE);
    Button fileButton = toolButton("Pièce jointe", UiIcons.Kind.CLIP);
    imageButton.setContentDescription("Joindre une image au message LinkedIn");
    fileButton.setContentDescription("Joindre un document au message LinkedIn");
    attachmentRow.addView(imageButton, toolLp(0, 1, false));
    attachmentRow.addView(fileButton, toolLp(0, 1, true));
    linkedinAttachRow = attachmentRow;
    imageButton.setOnClickListener(v -> openLinkedInAttachmentPicker(true));
    fileButton.setOnClickListener(v -> openLinkedInAttachmentPicker(false));
    root.addView(attachmentRow);
    root.addView(linkedinWeb, new LinearLayout.LayoutParams(-1, 0, 1));
    messages.setOnClickListener(v -> linkedinWeb.loadUrl("https://www.linkedin.com/messaging/"));
    network.setOnClickListener(v -> linkedinWeb.loadUrl("https://www.linkedin.com/mynetwork/"));
    search.setOnClickListener(v -> linkedinWeb.loadUrl("https://www.linkedin.com/search/results/people/"));
    linkedinWeb.loadUrl("https://www.linkedin.com/messaging/");
  }

  /** Activate LinkedIn's file input; the WebChromeClient opens the Android chooser. */
  /** Close the native LinkedIn app invitation without touching other dialogs. */
  private void dismissLinkedInAppPrompt() {
    if (linkedinWeb == null || linkedinWeb.getUrl() == null || !linkedinWeb.getUrl().contains("linkedin.com/")) return;
    // Mobile LinkedIn displays a persistent "Use the LinkedIn app" bottom banner.
    // Its X is frequently a bare SVG/span or a parent div, not a <button>.
    // Only dismiss a control inside a banner containing the exact app-invitation text.
    String js = "(function(){const vis=e=>!!(e.getClientRects().length);"
      + "const prompt=/utiliser l.app(?:lication)? linkedin|use the linkedin app|open in (the )?linkedin app|usar la aplicaci[oó]n linkedin/i;"
      + "const nodes=[...document.querySelectorAll('div,section,aside,[role=dialog],footer')].filter(vis).filter(e=>{const t=(e.innerText||'').trim();return t.length>=15&&t.length<170&&prompt.test(t)}).sort((a,b)=>(a.innerText||'').length-(b.innerText||'').length);"
      + "for(const panel of nodes){const controls=[...panel.querySelectorAll('button,[role=button],a,[aria-label],[title],svg')].filter(vis);"
      + "let close=controls.find(e=>/^(close|fermer|dismiss|not now|pas maintenant|×|✕|x)$/i.test((e.getAttribute('aria-label')||e.getAttribute('title')||e.innerText||'').trim()));"
      + "if(!close){const left=controls.filter(e=>{const r=e.getBoundingClientRect(),p=panel.getBoundingClientRect();return r.width>0&&r.width<65&&r.height>0&&r.height<65&&r.left<p.left+p.width*.35&&r.top>=p.top-5&&r.bottom<=p.bottom+5});close=left.find(e=>e.querySelector('svg')||e.tagName.toLowerCase()==='svg'||/close|dismiss|cross/i.test(e.className?.baseVal||e.className||''));}"
      + "if(close){let target=close.closest('button,[role=button],a')||close; if(target===panel)continue;target.click();return 'dismissed';}}return 'not_found';})()";
    linkedinWeb.evaluateJavascript(js, ignored -> {});
  }

  private void openLinkedInAttachmentPicker(boolean image) {
    if (linkedinWeb == null || linkedinWeb.getUrl() == null || !linkedinWeb.getUrl().startsWith("https://www.linkedin.com/messaging/")) {
      Toast.makeText(this, "Ouvrez une conversation LinkedIn avant de joindre un fichier", Toast.LENGTH_LONG).show();
      return;
    }
    String js = "(function(image){"
      + "const visible=e=>!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length);"
      + "const inputs=[...document.querySelectorAll('input[type=file]')];"
      + "const suitable=inputs.filter(e=>{const a=(e.accept||'').toLowerCase();return image?(!a||a.includes('image')):(!a||!a.includes('image')||a.includes('pdf'));});"
      + "if(suitable.length){const exact=suitable.filter(e=>{const a=(e.accept||'').toLowerCase();return image?/image/.test(a):/pdf|doc|text|application/.test(a)});const target=exact.length===1?exact[0]:suitable.length===1?suitable[0]:null;if(target){target.click();return 'opened';}}"
      + "const actionButtons=[...document.querySelectorAll('button,[role=button]')].filter(visible);"
      + "const exactButtons=actionButtons.filter(e=>{const s=((e.getAttribute('aria-label')||'')+' '+(e.getAttribute('title')||'')).toLowerCase();return image?/photo|image|picture/.test(s):/document|fichier|pièce jointe|attach file/.test(s)});"
      + "if(exactButtons.length===1){exactButtons[0].click();return 'clicked';}"
      + "const labels=image?['image','photo','picture']:['attach','joindre','document','file','fichier','pièce jointe'];"
      + "const buttons=[...document.querySelectorAll('button,[role=button]')].filter(visible).filter(e=>labels.some(k=>((e.getAttribute('aria-label')||'')+' '+(e.getAttribute('title')||'')).toLowerCase().includes(k)));"
      + "if(buttons.length===1){buttons[0].click();return 'clicked';}"
      + "return 'missing';})(" + (image ? "true" : "false") + ")";
    linkedinWeb.evaluateJavascript(js, raw -> {
      if (raw == null || raw.contains("missing"))
        Toast.makeText(this, "Commande LinkedIn introuvable. Ouvrez une conversation et réessayez.", Toast.LENGTH_LONG).show();
    });
  }

  /** Run only on the foreground Activity's WebView, after explicit opt-in. */
  private void executeLinkedInJob(JSONObject job) {
    cleanLinkedInAttachmentCache(false);
    String id = job.optString("id");
    String op = job.optString("operation");
    liStopRequested = false; liStopAt = 0; liUploadedPeople = -1; liLastUpload = 0;
    liSentPeople.clear(); liBatchSeq = 0; liLastPeople = null; liPeopleIndex.clear(); liUploadsOk = 0; liUploadsFailed = 0; liQueuedInPage = 0; liUploadError = ""; liUploadBusy = false;
    liCommentsRead = 0; liCommentsTotal = -1; liReactionsRead = 0; liReactionsTotal = -1; liStage = ""; liLastSnapshot = null; liNativeJob = null; liNativeDone = null;
    liProgressJob = "post_comments".equals(op) ? id : null;
    if (linkedinStopButton != null) { linkedinStopButton.setVisibility("post_comments".equals(op) ? View.VISIBLE : View.GONE); linkedinStopButton.setEnabled(true); linkedinStopButton.setText(I18n.t(this, "li_stop_report")); }
    liDrawCounts();
    if (!foreground || !linkedinMcpEnabled || linkedinWeb == null || id.isEmpty()) {
      if (!id.isEmpty()) finishLinkedInJob(id, null, "LinkedIn control unavailable before execution");
      else linkedinPollBusy = false;
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
    } else if ("post_comments".equals(op) && job.optBoolean("readReactions", false)) {
      // Reactions of the target post (current page, or postUrl): the reader clicks the reaction COUNT only.
      String current=linkedinWeb.getUrl();
      String postUrl=job.optString("postUrl","").trim();
      if(!postUrl.isEmpty() && !isLinkedInPostUrl(postUrl)) { finishLinkedInJob(id,null,"Invalid LinkedIn post URL"); return; }
      if(postUrl.isEmpty() && (current==null || !current.startsWith("https://www.linkedin.com/"))) { finishLinkedInJob(id,null,"Open the desired LinkedIn post first"); return; }
      JSONObject opts=liOpts(job);
      Runnable read=() -> liReadReactions(id,opts,0);
      if(postUrl.isEmpty()) read.run();
      else runLi(id,"targetOpen",opts,8000,(t,e)->{ if(t!=null&&t.optBoolean("present")) read.run(); else liLoad(id,postUrl,read); });
    } else if ("post_comments".equals(op) || "comment_post".equals(op) || "reply_comment".equals(op)) {
      if ("post_comments".equals(op)) linkedinCommentSeen.clear();
      if ("post_comments".equals(op) && job.optBoolean("full", false)) { liFullExtraction(id, job); return; }
      if ("post_comments".equals(op) && job.optBoolean("currentPost", false)) {
        String current = linkedinWeb.getUrl();
        if (current == null || !current.startsWith("https://www.linkedin.com/")) { finishLinkedInJob(id,null,"Open the LinkedIn post first"); return; }
        liReadComments(id, job, false); return;
      }
      if ("post_comments".equals(op)) { liReadComments(id, job, true); return; }
      String postUrl = job.optString("postUrl", "").trim();
      if (!postUrl.matches("https://(?:www\\.|[a-z]{2,3}\\.)?linkedin\\.com/(?:feed/update/urn:li:(?:activity|share|ugcPost):[0-9]+|posts/[A-Za-z0-9_%.-]+)/?(?:\\?[^#]*)?")) { finishLinkedInJob(id, null, "Invalid LinkedIn post URL"); return; }
      String action=op;
      linkedinWeb.loadUrl(postUrl);
      ui.postDelayed(() -> runLinkedInCommentJob(id, action, job, 0), 4200);
    } else if ("feed".equals(op)) {
      int limit = Math.min(50, Math.max(1, job.optInt("limit", 20)));
      liLoad(id, "https://www.linkedin.com/feed/", () -> extractLinkedInFeed(id, limit, 0, null));
    } else if ("job_search".equals(op)) {
      try {
        String keywords = job.optString("keywords", "").trim(), location = job.optString("location", "").trim();
        int limit = Math.min(50, Math.max(1, job.optInt("limit", 25)));
        if (keywords.length() < 2 || keywords.length() > 150 || location.length() > 120) { finishLinkedInJob(id, null, "Invalid job search"); return; }
        StringBuilder url = new StringBuilder("https://www.linkedin.com/jobs/search/?keywords=").append(java.net.URLEncoder.encode(keywords, "UTF-8"));
        if (!location.isEmpty()) url.append("&location=").append(java.net.URLEncoder.encode(location, "UTF-8"));
        String distance = job.optString("distance", "");
        if (distance.matches("0|5|10|25|50|100")) url.append("&distance=").append(distance);
        String posted = job.optString("posted", "");
        if ("day".equals(posted)) url.append("&f_TPR=r86400"); else if ("week".equals(posted)) url.append("&f_TPR=r604800"); else if ("month".equals(posted)) url.append("&f_TPR=r2592000");
        String level = job.optString("experience", "");
        if (level.matches("[1-6](,[1-6])*")) url.append("&f_E=").append(java.net.URLEncoder.encode(level, "UTF-8"));
        String type = job.optString("jobType", "");
        if (type.matches("[FPCTIVO](,[FPCTIVO])*")) url.append("&f_JT=").append(java.net.URLEncoder.encode(type, "UTF-8"));
        if (job.optBoolean("easyApply", false)) url.append("&f_AL=true");
        if ("recent".equals(job.optString("sort", ""))) url.append("&sortBy=DD");
        String workplace = job.optString("workplace", "");
        if ("onsite".equals(workplace)) url.append("&f_WT=1"); else if ("remote".equals(workplace)) url.append("&f_WT=2"); else if ("hybrid".equals(workplace)) url.append("&f_WT=3");
        collectLinkedInJobs(id, url.toString(), 0, limit, new java.util.LinkedHashMap<>());
      } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
    } else if ("recommended_jobs".equals(op)) {
      int limit = Math.min(50, Math.max(1, job.optInt("limit", 25)));
      collectLinkedInJobs(id, "https://www.linkedin.com/jobs/collections/recommended/?discover=recommended", 0, limit, new java.util.LinkedHashMap<>());
    } else if ("company_profile".equals(op) || "company_posts".equals(op)) {
      String slug = job.optString("company", "").trim();
      if (!slug.matches("[A-Za-z0-9%._-]{1,150}")) { finishLinkedInJob(id, null, "Invalid company page"); return; }
      boolean posts = "company_posts".equals(op);
      linkedinWeb.loadUrl("https://www.linkedin.com/company/" + slug + (posts ? "/posts/" : "/about/"));
      if (posts) ui.postDelayed(() -> extractLinkedInFeed(id, Math.min(30, Math.max(1, job.optInt("limit", 10))), 0, null), 2500);
      else ui.postDelayed(() -> extractLinkedInCompanyProfile(id, slug, 0), 3500);
    } else if ("person_profile".equals(op)) {
      String slug = job.optString("profile", "").trim();
      if (!slug.matches("[A-Za-z0-9%._-]{1,150}")) { finishLinkedInJob(id, null, "Invalid profile"); return; }
      linkedinWeb.loadUrl("https://www.linkedin.com/in/" + slug + "/");
      ui.postDelayed(() -> extractLinkedInPersonProfile(id, slug, 0), 3800);
    } else if ("job_details".equals(op)) {
      String jobId = job.optString("jobId", "").trim();
      if (!jobId.matches("\\d{5,20}")) { finishLinkedInJob(id, null, "Invalid LinkedIn job ID"); return; }
      linkedinWeb.loadUrl("https://www.linkedin.com/jobs/view/" + jobId + "/");
      ui.postDelayed(() -> extractLinkedInJobDetails(id, jobId, 0), 3500);
    } else if ("search".equals(op) && "posts".equals(job.optString("searchType"))) {
      String keywords = job.optString("keywords", "").trim(), author = job.optString("author", "").trim();
      if ((keywords.length() < 2 && author.length() < 2) || keywords.length() > 250 || author.length() > 150) { finishLinkedInJob(id, null, "Invalid post search"); return; }
      liSearchPosts(id, job, 0, new JSONArray(), null, (r, err) -> finishLiWithThumbs(id, r, err));
    } else if ("search".equals(op) && "profile_posts".equals(job.optString("searchType"))) {
      String slug = job.optString("profile", "").trim();
      if (!slug.matches("[A-Za-z0-9%._-]{1,150}")) { finishLinkedInJob(id, null, "Invalid profile"); return; }
      JSONObject opts = liOpts(job);
      liLoad(id, "https://www.linkedin.com/in/" + slug + "/recent-activity/all/", () -> runLi(id, "searchPosts", opts, 90000, (r, err) -> {
        try { if (r != null) { r.put("source", "profile_activity"); r.put("profile", "https://www.linkedin.com/in/" + slug + "/"); } } catch (Exception ignored) {}
        finishLinkedInJob(id, r, liError(r, err));
      }));
    } else if ("search".equals(op)) {
      String keywords = job.optString("keywords", "").trim();
      int requested = job.optBoolean("all", false) ? Integer.MAX_VALUE : job.optInt("limit", 50);
      int startPage = job.optInt("startPage", 1);
      if (keywords.length() < 2 || keywords.length() > 150 || requested < 1 || startPage < 1) {
        finishLinkedInJob(id, null, "Invalid search parameters"); return;
      }
      try {
        String url = "https://www.linkedin.com/search/results/people/?keywords=" + java.net.URLEncoder.encode(keywords, "UTF-8");
        JSONArray places = new JSONArray(job.optString("locations", "[]"));
        if (places.length() == 0) { collectLinkedInSearchPage(id, url, startPage, requested, new java.util.LinkedHashMap<>()); return; }
        resolveLinkedInGeo(places, geo -> {
          String ids = geo.optString("param");
          if (!ids.isEmpty()) { liGeoInfo.put(id, geo); collectLinkedInSearchPage(id, url + "&geoUrn=" + ids, startPage, requested, new java.util.LinkedHashMap<>()); }
          else {
            // LinkedIn did not recognise the places: search them as keywords and say so.
            liGeoInfo.put(id, geo);
            try { collectLinkedInSearchPage(id, "https://www.linkedin.com/search/results/people/?keywords=" + java.net.URLEncoder.encode(keywords + " " + join(places), "UTF-8"), startPage, requested, new java.util.LinkedHashMap<>()); }
            catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
          }
        });
      } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
    } else if ("company_search".equals(op)) {
      String keywords = job.optString("keywords", "").trim();
      int limit = Math.min(50, Math.max(1, job.optInt("limit", 25)));
      if (keywords.length() < 2 || keywords.length() > 250) { finishLinkedInJob(id, null, "Invalid company search"); return; }
      try {
        String base = "https://www.linkedin.com/search/results/companies/?keywords=" + java.net.URLEncoder.encode(keywords, "UTF-8");
        JSONArray places = new JSONArray(job.optString("locations", "[]"));
        if (places.length() == 0) { collectLinkedInCompanies(id, base, 1, limit, new java.util.LinkedHashMap<>(), null, places); return; }
        resolveLinkedInGeo(places, geo -> {
          String ids = geo.optString("param");
          collectLinkedInCompanies(id, ids.isEmpty() ? base : base + "&companyHqGeo=" + ids, 1, limit, new java.util.LinkedHashMap<>(), geo, places);
        });
      } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
    } else if ("network_suggestions".equals(op)) {
      int limit = Math.min(50, Math.max(1, job.optInt("limit", 25)));
      linkedinWeb.loadUrl("https://www.linkedin.com/mynetwork/");
      ui.postDelayed(() -> {
        String js = "(function(limit){const seen=new Set();const people=[];for(const a of document.querySelectorAll('a[href*=\\\"/in/\\\"]')){const href=a.href.split('?')[0];if(!/^https:\\/\\/www\\.linkedin\\.com\\/in\\//.test(href)||seen.has(href))continue;const card=a.closest('li,article,[class*=card],[class*=person]')||a.parentElement;const name=(a.innerText||card?.querySelector('h3')?.innerText||'').trim().slice(0,150);if(!name)continue;seen.add(href);people.push({name,profileUrl:href,headline:(card?.innerText||'').trim().slice(0,400),avatarUrl:card?.querySelector('img')?.currentSrc||card?.querySelector('img')?.src||''});if(people.length>=limit)break;}return JSON.stringify({people,retrieved:people.length,url:location.pathname,partial:true});})(" + limit + ")";
        linkedinWeb.evaluateJavascript(js, raw -> { try { finishLinkedInCards(id, new JSONObject(new JSONArray("[" + raw + "]").getString(0))); } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); } });
      }, 3200);
    } else if ("invite".equals(op)) {
      String profileUrl = job.optString("profileUrl", "").trim();
      if (!profileUrl.startsWith("https://www.linkedin.com/in/") || profileUrl.contains("?") || profileUrl.contains("#") || profileUrl.length() > 350) { finishLinkedInJob(id, null, "Invalid profile URL"); return; }
      // Only act on a suggestion already visible in the network tab. Never guess a recipient.
      if (linkedinWeb.getUrl() == null || !linkedinWeb.getUrl().contains("/mynetwork")) { finishLinkedInJob(id, null, "Open network suggestions first"); return; }
      String js = "(function(url){const links=[...document.querySelectorAll('a[href*=\\\"/in/\\\"]')].filter(a=>a.href.split('?')[0].replace(/\\/$/,'')===url.replace(/\\/$/,''));const cards=[...new Set(links.map(a=>a.closest('li,article,[class*=card],[class*=person]')).filter(Boolean))];if(cards.length!==1)return JSON.stringify({error:'Profile not uniquely visible',matches:cards.length});const buttons=[...cards[0].querySelectorAll('button')].filter(b=>!b.disabled&&/^(connect|se connecter|inviter)$/i.test((b.getAttribute('aria-label')||b.innerText||'').trim()));if(buttons.length!==1)return JSON.stringify({error:'Invitation button ambiguous or missing',matches:buttons.length});buttons[0].click();return JSON.stringify({clicked:true,profileUrl:url,note:'Invitation button clicked; verify LinkedIn state'});})(" + JSONObject.quote(profileUrl) + ")";
      linkedinWeb.evaluateJavascript(js, raw -> {
        try { JSONObject result = new JSONObject(new JSONArray("[" + raw + "]").getString(0)); finishLinkedInJob(id, result, result.optBoolean("clicked") ? null : result.optString("error", "Invite failed")); }
        catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
      });
    } else if ("attach".equals(op) || "send".equals(op)) {
      runLinkedInFileJob(id, op, job);
    } else if ("thread".equals(op)) {
      if (!isLinkedInMessagingPage() || !linkedinWeb.getUrl().contains("/thread/")) {
        finishLinkedInJob(id, null, "Ouvrez une conversation LinkedIn"); return;
      }
      String js = "(function(){const n=[...document.querySelectorAll('li[class*=message],[class*=msg-s-event-listitem],[class*=message-event]')];const a=n.map((e,index)=>({index,text:(e.innerText||'').trim().slice(0,4000),timestamp:e.querySelector('time')?.getAttribute('datetime')||null,author:(e.querySelector('[class*=actor-name],[class*=sender-name]')?.innerText||'').trim(),media:[...e.querySelectorAll('img')].map(i=>i.currentSrc||i.src).filter(u=>u&&/messaging-image/.test(u)).slice(0,8)})).filter(x=>x.text||x.media.length);const avatars=[...document.querySelectorAll('[class*=conversation-header] img')].slice(0,6).map(i=>({url:i.currentSrc||i.src||'',alt:i.alt||'',role:'profile'})).filter(i=>i.url);return JSON.stringify({format:'cammicgo-linkedin-thread-mcp-v2',url:location.pathname,participant:(document.querySelector('[class*=conversation-header]')?.innerText||'').trim().slice(0,250),avatars,messages:a.slice(-60),partial:true});})()";
      linkedinWeb.evaluateJavascript(js, raw -> finishLinkedInThread(id, raw));
    } else finishLinkedInJob(id, null, "Operation inconnue");
  }

  /** Signed-out pages (login wall, checkpoint) are reported instead of an empty list. */
  /** Comments are read from the authenticated LinkedIn WebView; no scraping credentials leave the phone. */
  private void runLinkedInCommentJob(String id, String action, JSONObject job, int attempt) {
    if (!linkedinMcpEnabled) { finishLinkedInJob(id, null, "LinkedIn MCP disabled"); return; }
    if (linkedinWeb == null || linkedinWeb.getUrl() == null || !linkedinWeb.getUrl().startsWith("https://")) { finishLinkedInJob(id, null, "LinkedIn page unavailable"); return; }
    extractRenderedLinkedInComments(id, action, job, attempt);
  }

  private final java.util.LinkedHashMap<String,JSONObject> linkedinCommentSeen = new java.util.LinkedHashMap<>();
  private void extractRenderedLinkedInComments(String id, String action, JSONObject job, int attempt) {
    String commentId=job.optString("commentId",""), text=job.optString("text","");
    if(text.trim().isEmpty() || text.length()>1250 || ("reply_comment".equals(action)&&commentId.isEmpty())) { finishLinkedInJob(id,null,"Invalid comment target or text"); return; }
    String prepare="(function(action,id,text){const visible=e=>!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length);if(!location.hostname.endsWith('linkedin.com'))return JSON.stringify({error:'wrong_domain'});let root=document;if(action==='reply_comment'){const matches=[...document.querySelectorAll('[data-id],[data-urn],[id]')].filter(n=>(n.getAttribute('data-id')||n.getAttribute('data-urn')||n.id)===id);if(matches.length!==1)return JSON.stringify({error:'comment_target_not_unique',matches:matches.length});root=matches[0];const reply=[...root.querySelectorAll('button')].find(b=>visible(b)&&/^(reply|répondre|antworten|responder)$/i.test((b.innerText||b.getAttribute('aria-label')||'').trim()));if(!reply)return JSON.stringify({error:'reply_button_missing'});reply.click();}else{const triggers=[...document.querySelectorAll('button')].filter(b=>visible(b)&&/^(comment|commenter|commentaire|kommentieren)$/i.test((b.innerText||b.getAttribute('aria-label')||'').trim()));if(triggers.length===1)triggers[0].click();}return JSON.stringify({ready:true});})"+"("+JSONObject.quote(action)+","+JSONObject.quote(commentId)+","+JSONObject.quote(text)+")";
    linkedinWeb.evaluateJavascript(prepare,raw->{
      try{
        JSONObject result=new JSONObject(new JSONArray("["+raw+"]").getString(0));
        if(!result.optBoolean("ready")){finishLinkedInJob(id,result,result.optString("error","Reply UI unavailable"));return;}
        ui.postDelayed(()->{
          String fill="(function(action,id,text){const visible=e=>!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length);let root=document;if(action==='reply_comment'){const nodes=[...document.querySelectorAll('[data-id],[data-urn],[id]')].filter(n=>(n.getAttribute('data-id')||n.getAttribute('data-urn')||n.id)===id);if(nodes.length!==1)return JSON.stringify({error:'reply_target_lost'});root=nodes[0].parentElement||nodes[0];}const editors=[...root.querySelectorAll('[contenteditable=\"true\"][role=\"textbox\"],[contenteditable=\"true\"][data-placeholder],div[contenteditable=\"true\"],textarea')].filter(visible);if(editors.length!==1)return JSON.stringify({error:'editor_not_unique',editors:editors.length});const e=editors[0];e.focus();if(e.tagName==='TEXTAREA'){const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(e,text);e.dispatchEvent(new Event('input',{bubbles:true}));}else{e.textContent=text;e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}const area=e.closest('form,[class*=\"comment-box\"],[class*=\"comments-comment\"],[class*=\"editor\"]')||root;const buttons=[...area.querySelectorAll('button')].filter(b=>visible(b)&&!b.disabled&&/^(post|publier|envoyer|send|commenter|répondre)$/i.test((b.innerText||b.getAttribute('aria-label')||'').trim()));if(buttons.length!==1)return JSON.stringify({error:'submit_not_unique',buttons:buttons.length,filled:true});buttons[0].click();return JSON.stringify({clicked:true,kind:action,note:'LinkedIn submit button clicked; server-side acceptance is not independently verified'});})"+"("+JSONObject.quote(action)+","+JSONObject.quote(commentId)+","+JSONObject.quote(text)+")";
          linkedinWeb.evaluateJavascript(fill,raw2->{
            try{JSONObject done=new JSONObject(new JSONArray("["+raw2+"]").getString(0));finishLinkedInJob(id,done,done.optBoolean("clicked")?null:done.optString("error","Comment not sent"));}
            catch(Exception e){finishLinkedInJob(id,null,e.getMessage());}
          });
        },800);
      }catch(Exception e){finishLinkedInJob(id,null,e.getMessage());}
    });
  }

  private static final String LI_SIGNED_OUT_JS = "(!!document.querySelector('input[name=session_key],form[action*=\\\"login\\\"]')||/\\/(login|authwall|checkpoint|uas)/.test(location.pathname))";

  /** Reads feed or company posts with the shared reader (several detection strategies, scrolling, diagnostics). */
  private void extractLinkedInFeed(String id, int limit, int attempt, JSONObject best) {
    if (!linkedinMcpEnabled) { finishLinkedInJob(id, null, "LinkedIn navigation disabled"); return; }
    dismissLinkedInAppPrompt();
    JSONObject opts = new JSONObject();
    try { opts.put("limit", limit); opts.put("scrolls", 6); } catch (Exception ignored) {}
    runLi(id, "collectPosts", opts, 75000, (r, err) -> {
      if (r == null) { finishLinkedInJob(id, null, err == null ? "Feed page could not be read" : err); return; }
      try {
        r.put("url", linkedinWeb.getUrl() == null ? "" : android.net.Uri.parse(linkedinWeb.getUrl()).getPath());
        String st = r.optString("status");
        if ("signed_out".equals(st)) r.put("note", "LinkedIn is not signed in inside the CamMicGo app: open the LinkedIn tab and sign in.");
        else if ("extraction_failed".equals(st)) r.put("note", "The page shows content but no post could be recognised: LinkedIn probably changed its layout. diagnostics.dom describes the page structure. This is NOT an empty feed.");
        else if ("not_loaded".equals(st)) r.put("note", "The feed did not finish loading. This is NOT an empty feed.");
      } catch (Exception ignored) {}
      finishLinkedInJob(id, r, "signed_out".equals(r.optString("status")) ? "LinkedIn not signed in" : (r.optJSONArray("posts") == null || r.optJSONArray("posts").length() == 0) && "extraction_failed".equals(r.optString("status")) ? "LinkedIn feed extraction failed (layout not recognised); see diagnostics" : null);
    });
  }

  // ------------------------------------------------------------------ LinkedIn reader (assets/linkedin/cmg-li.js)
  private interface LiDone { void done(JSONObject result, String error); }
  private String liLibrary;
  private String lastLiProgress = "";
  private String lastLiHeartbeat = "";
  // "Stop and build the report": asked on the phone (button) or by the assistant (linkedin_job_stop).
  private volatile boolean liStopRequested = false;
  private long liStopAt = 0;
  private String liProgressJob = null;
  private int liUploadedPeople = -1;
  private long liLastUpload = 0;
  private boolean liUploadBusy = false;
  private Button linkedinStopButton;
  // Batches of people already saved on the server (by profile link), the next batch number and the last list read.
  private final java.util.HashSet<String> liSentPeople = new java.util.HashSet<>();
  private int liBatchSeq = 0;
  private JSONArray liLastPeople = null;
  private final java.util.HashMap<String, Integer> liPeopleIndex = new java.util.HashMap<>();
  private final java.util.HashSet<String> liFinishedJobs = new java.util.HashSet<>();
  private JSONObject liLastSnapshot = null;
  private volatile String liNativeJob = null;
  private volatile JSONObject liNativeDone = null;

  /**
   * Fast read run by the app itself (the reader hands over the request the LinkedIn page sent for a piece of
   * the reaction list): the app asks for every piece with the page's own headers and the session cookies,
   * same piece size, 2-4 s apart, stops at the first error. Unlike the page, it keeps going while the user is
   * in other apps. People are saved on the server as they come (batches of 50).
   */
  private void liStartNative(String id, JSONObject fr, int expected) {
    liNativeJob = id; liNativeDone = null;
    final String template = fr.optString("url", "");
    final JSONObject headers = fr.optJSONObject("headers") == null ? new JSONObject() : fr.optJSONObject("headers");
    final String agent = linkedinWeb == null ? "" : linkedinWeb.getSettings().getUserAgentString();
    if (expected > 0) liReactionsTotal = expected;
    new Thread(() -> {
      String reason = "end"; int pages = 0, added = 0, empty = 0, count = 0;
      long t0 = System.currentTimeMillis();
      java.util.regex.Matcher cm = java.util.regex.Pattern.compile("[?&(,]count[=:](\\d+)").matcher(template);
      if (cm.find()) count = Integer.parseInt(cm.group(1));
      if (count <= 0 || count > 100 || !template.startsWith("https://www.linkedin.com/") || !template.matches(".*[?&(,]start[=:]\\d+.*")) reason = "no_paging";
      else {
        for (int start = 0; pages < 400; start += count) {
          if (!id.equals(liProgressJob)) { reason = "job_ended"; break; }
          if (liStopRequested) { reason = "stopped"; break; }
          if (expected > 0 && start >= expected + count) break;
          String url = template.replaceFirst("([?&(,]start[=:])\\d+", "$1" + start);
          String body = null; int code = 0;
          for (int attempt = 0; attempt < 2 && body == null; attempt++) {
            try {
              java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
              c.setConnectTimeout(15000); c.setReadTimeout(20000); c.setInstanceFollowRedirects(false);
              java.util.Iterator<String> it = headers.keys();
              while (it.hasNext()) { String k = it.next(); if (!k.equalsIgnoreCase("cookie") && !k.equalsIgnoreCase("host") && !k.equalsIgnoreCase("content-length")) c.setRequestProperty(k, headers.optString(k)); }
              if (c.getRequestProperty("accept") == null && c.getRequestProperty("Accept") == null) c.setRequestProperty("Accept", "application/vnd.linkedin.normalized+json+2.1");
              String cookie = CookieManager.getInstance().getCookie("https://www.linkedin.com/");
              if (cookie != null) c.setRequestProperty("Cookie", cookie);
              if (!agent.isEmpty()) c.setRequestProperty("User-Agent", agent);
              code = c.getResponseCode();
              if (code != 200) { c.disconnect(); break; }
              String ct = c.getContentType() == null ? "" : c.getContentType();
              if (!ct.contains("json")) { code = -2; c.disconnect(); break; }
              try (java.io.InputStream in = c.getInputStream()) {
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream(); byte[] buf = new byte[16384]; int n;
                while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); if (out.size() > 3_000_000) break; }
                body = out.toString("UTF-8");
              }
            } catch (Exception e) { code = -1; if (attempt == 0) try { Thread.sleep(3000); } catch (InterruptedException ie) { break; } }
          }
          if (body == null) { reason = code == -1 ? "network" : code == -2 ? "not_json" : "http_" + code; break; }
          JSONArray got;
          try { got = liApiPeople(new JSONObject(body)); } catch (Exception e) { reason = "bad_answer"; break; }
          int before = liLastPeople == null ? 0 : liLastPeople.length();
          liAddPeople(got);
          int now = liLastPeople == null ? 0 : liLastPeople.length();
          added += now - before; pages++;
          final int seen = now, page = pages;
          ui.post(() -> {
            liReactionsRead = Math.max(liReactionsRead, seen); liStage = "reaction_native";
            liDrawCounts();
            try { liUploadProgress(id, liLastSnapshot, new JSONObject().put("stage", "reaction_native").put("reactionsRead", seen).put("expectedTotal", expected > 0 ? expected : JSONObject.NULL).put("page", page).put("beat", page)); } catch (Exception ignored) {}
          });
          if (got.length() == 0) { if (++empty >= 2) { reason = "no_more"; break; } } else empty = 0;
          try { Thread.sleep(2000 + (long) (Math.random() * 2000)); } catch (InterruptedException ie) { reason = "interrupted"; break; }
        }
      }
      JSONObject done = new JSONObject();
      try { done.put("reason", reason).put("pages", pages).put("added", added).put("total", liLastPeople == null ? 0 : liLastPeople.length()).put("pieceSize", count).put("seconds", (System.currentTimeMillis() - t0) / 1000); } catch (Exception ignored) {}
      liNativeDone = done;
      ui.post(() -> {
        if (linkedinWeb != null) linkedinWeb.evaluateJavascript("window.__cmgLiNativeDone=" + done + ";", null);
        // If the page stays frozen (user in another app), the app ends the job itself with what it has.
        ui.postDelayed(() -> liFinishNativeIfStuck(id), 60000);
      });
    }, "cammicgo-li-fast").start();
  }

  private void liFinishNativeIfStuck(String id) {
    if (!id.equals(liProgressJob) || liFinishedJobs.contains(id)) return;
    JSONObject partial;
    try {
      partial = liLastSnapshot == null ? new JSONObject() : compactSnapshot(liLastSnapshot);
      partial.remove("inProgress");
      partial.put("status", "partial");
      JSONObject rx = partial.optJSONObject("reactions"); if (rx == null) { rx = new JSONObject(); partial.put("reactions", rx); }
      rx.put("fastRead", liNativeDone); if (liReactionsTotal > 0) rx.put("expectedTotal", liReactionsTotal);
      rx.put("people", new JSONArray()); rx.put("complete", false); rx.put("partial", true);
      partial.put("finishedByApp", "the LinkedIn page stayed frozen in the background; the people read were saved in batches");
    } catch (Exception e) { partial = new JSONObject(); }
    final JSONObject res = partial;
    liUploadWorker.execute(() -> { liFlushBatches(id); ui.post(() -> finishLinkedInJob(id, res, null)); });
  }

  /** People of one answer of LinkedIn's reaction service (both its older and newer shapes). */
  static JSONArray liApiPeople(JSONObject json) {
    java.util.List<JSONObject> all = new java.util.ArrayList<>();
    java.util.Map<String, JSONObject> byUrn = new java.util.HashMap<>();
    liWalk(json, all, byUrn, 0);
    JSONArray out = new JSONArray();
    for (JSONObject o : all) {
      String rt = o.optString("reactionType", "");
      if (rt.isEmpty()) continue;
      String type = liReactionType(rt);
      String name = null, headline = null, url = null, photo = null;
      JSONObject lk = o.optJSONObject("reactorLockup");
      if (lk != null) {
        name = liText(lk.opt("title")); headline = liText(lk.opt("subtitle")); url = lk.optString("navigationUrl", null); photo = liPhoto(lk.opt("image"));
      } else {
        Object a = o.opt("actor"); if (a == null) a = o.opt("*actor"); if (a == null) a = o.opt("actorUrn"); if (a == null) a = o.opt("*reactor");
        JSONObject ao = a instanceof JSONObject ? (JSONObject) a : a instanceof String ? byUrn.get((String) a) : null;
        if (ao != null) {
          JSONObject mini = ao.optJSONObject("miniProfile"); if (mini == null && ao.has("*miniProfile")) mini = byUrn.get(ao.optString("*miniProfile")); if (mini == null) mini = ao;
          String fn = mini.optString("firstName", ""), ln = mini.optString("lastName", "");
          name = (fn + " " + ln).trim(); if (name.isEmpty()) name = liText(mini.opt("name"));
          headline = mini.optString("occupation", null); if (headline == null) headline = liText(mini.opt("headline"));
          String pid = mini.optString("publicIdentifier", "");
          url = !pid.isEmpty() ? "https://www.linkedin.com/in/" + pid + "/" : mini.optString("url", null);
          photo = liPhoto(mini.opt("picture") != null ? mini.opt("picture") : mini.opt("profilePicture"));
        }
      }
      if (name == null || name.isEmpty() || url == null || !url.startsWith("https://www.linkedin.com/")) continue;
      url = url.split("[?#]")[0]; if (!url.endsWith("/")) url = url + "/";
      try {
        JSONObject p = new JSONObject().put("name", name.length() > 120 ? name.substring(0, 120) : name).put("profileUrl", url);
        if (headline != null && !headline.isEmpty()) p.put("headline", headline.length() > 200 ? headline.substring(0, 200) : headline);
        if (type != null) p.put("reaction", type);
        if (photo != null) p.put("photoUrl", photo);
        out.put(p);
      } catch (Exception ignored) {}
    }
    return out;
  }
  private static void liWalk(Object n, java.util.List<JSONObject> all, java.util.Map<String, JSONObject> byUrn, int d) {
    if (d > 12 || n == null) return;
    if (n instanceof JSONArray) { JSONArray a = (JSONArray) n; for (int i = 0; i < a.length(); i++) liWalk(a.opt(i), all, byUrn, d + 1); return; }
    if (!(n instanceof JSONObject)) return;
    JSONObject o = (JSONObject) n; all.add(o);
    String urn = o.optString("entityUrn", ""); if (!urn.isEmpty()) byUrn.put(urn, o);
    java.util.Iterator<String> it = o.keys();
    while (it.hasNext()) { Object v = o.opt(it.next()); if (v instanceof JSONObject || v instanceof JSONArray) liWalk(v, all, byUrn, d + 1); }
  }
  private static String liText(Object x) { if (x instanceof String) return (String) x; if (x instanceof JSONObject) { String t = ((JSONObject) x).optString("text", null); return t; } return null; }
  private static String liReactionType(String t) {
    switch (t.toUpperCase(java.util.Locale.ROOT)) {
      case "LIKE": return "like"; case "PRAISE": return "celebrate"; case "APPRECIATION": return "support";
      case "EMPATHY": return "love"; case "INTEREST": return "insightful"; case "ENTERTAINMENT": return "funny";
      default: return null;
    }
  }
  private static String liPhoto(Object n) { return liPhoto(n, 0); }
  private static String liPhoto(Object n, int d) {
    if (n == null || d > 8) return null;
    if (n instanceof JSONArray) { JSONArray a = (JSONArray) n; for (int i = 0; i < a.length(); i++) { String r = liPhoto(a.opt(i), d + 1); if (r != null) return r; } return null; }
    if (!(n instanceof JSONObject)) return null;
    JSONObject o = (JSONObject) n;
    JSONArray arts = o.optJSONArray("artifacts");
    if (o.has("rootUrl") && arts != null && arts.length() > 0) {
      JSONObject best = null; int bd = Integer.MAX_VALUE;
      for (int i = 0; i < arts.length(); i++) { JSONObject a = arts.optJSONObject(i); if (a == null) continue; int dd = Math.abs(a.optInt("width", 0) - 200); if (dd < bd) { bd = dd; best = a; } }
      String u = best == null ? null : o.optString("rootUrl") + best.optString("fileIdentifyingUrlPathSegment", "");
      return u != null && u.startsWith("https://media.licdn.com/") ? u : null;
    }
    java.util.Iterator<String> it = o.keys();
    while (it.hasNext()) { String r = liPhoto(o.opt(it.next()), d + 1); if (r != null) return r; }
    return null;
  }
  private LinearLayout liProgressPanel;
  private TextView liCommentsText, liReactionsText;
  private android.widget.ProgressBar liCommentsBar, liReactionsBar;
  private int liCommentsRead = 0, liCommentsTotal = -1, liReactionsRead = 0, liReactionsTotal = -1;
  private String liStage = "";
  // Uploads of a running extraction have their own thread: nothing else in the app can hold them up.
  private final ExecutorService liUploadWorker = Executors.newSingleThreadExecutor();
  private int liUploadsOk = 0, liUploadsFailed = 0, liQueuedInPage = 0;
  private String liUploadError = "";
  private long liUploadBusySince = 0;

  /**
   * People handed over by the reader since the last check, added to everything read for this job.
   * A person seen again with a field learned later (reaction, headline, photo) is updated and sent again.
   */
  private synchronized void liAddPeople(JSONArray fresh) {
    if (fresh == null || fresh.length() == 0) return;
    if (liLastPeople == null) liLastPeople = new JSONArray();
    for (int i = 0; i < fresh.length(); i++) {
      JSONObject p = fresh.optJSONObject(i);
      String k = liPersonKey(p);
      if (p == null || k.equals("name:")) continue;
      Integer at = liPeopleIndex.get(k);
      if (at == null) { liPeopleIndex.put(k, liLastPeople.length()); liLastPeople.put(p); continue; }
      JSONObject old = liLastPeople.optJSONObject(at);
      boolean learned = false;
      try {
        for (String f : new String[]{"name", "headline", "reaction", "photoUrl"}) if ((!old.has(f) || old.isNull(f)) && p.has(f) && !p.isNull(f)) { old.put(f, p.opt(f)); learned = true; }
      } catch (Exception ignored) {}
      if (learned) liSentPeople.remove(k);
    }
  }

  /** The read-only reader shipped as an asset (also run by the Node fixture tests). */
  private String liLib() {
    if (liLibrary == null) {
      try (java.io.InputStream in = getAssets().open("linkedin/cmg-li.js")) {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192]; int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        liLibrary = out.toString("UTF-8");
      } catch (Exception e) { liLibrary = ""; }
    }
    return liLibrary;
  }

  /** Runs window.__cmgLi.fn(opts) in the page and polls for its result (the page never calls back into the app). */
  private void runLi(String id, String fn, JSONObject opts, long timeoutMs, LiDone cb) {
    if (linkedinWeb == null) { cb.done(null, "LinkedIn page unavailable"); return; }
    String lib = liLib();
    if (lib.isEmpty()) { cb.done(null, "LinkedIn reader missing from the app"); return; }
    if (!fn.matches("[A-Za-z]{2,40}")) { cb.done(null, "Invalid reader call"); return; }
    lastLiHeartbeat = "";
    String key = "k" + System.nanoTime();
    String q = JSONObject.quote(key);
    String js = lib + "\n;window.__cmgLiStop=" + (liStopRequested ? "true" : "false") + ";(function(){var R=window.__cmgLiRuns=window.__cmgLiRuns||{};var k=" + q + ";R[k]={done:false};"
      + "Promise.resolve().then(function(){return window.__cmgLi." + fn + "(" + opts.toString() + ",function(p,snapshot){var v=R[k];if(v&&!v.done){if(window.__cmgLi.runProgress)window.__cmgLi.runProgress(v,p,snapshot);else{v.partial=p;if(snapshot)v.snapshot=snapshot;}}});})"
      + ".then(function(x){var v=R[k]||(R[k]={});v.result=(x&&typeof x==='object'&&window.__cmgLi.fit)?window.__cmgLi.fit(x):x;v.done=true;},function(e){var v=R[k]||(R[k]={});v.error=String(e&&e.message||e);v.done=true;});return 'started';})()";
    linkedinWeb.evaluateJavascript(js, started -> pollLi(id, key, System.currentTimeMillis() + timeoutMs, System.currentTimeMillis() + (timeoutMs >= 120000 ? 3600000 : timeoutMs), cb));
  }

  private void pollLi(String id, String key, long deadline, long hardDeadline, LiDone cb) {
    ui.postDelayed(() -> {
      if (linkedinWeb == null) { cb.done(null, "LinkedIn page unavailable"); return; }
      String q = JSONObject.quote(key);
      linkedinWeb.evaluateJavascript("(function(){var R=window.__cmgLiRuns,L=window.__cmgLi;if(L&&L.runPoll)return L.runPoll(R," + q + ",300);var v=R&&R[" + q + "];if(!v)return JSON.stringify({lost:true});if(v.done)delete R[" + q + "];return JSON.stringify(v);})()", raw -> {
        try {
          JSONObject v = new JSONObject(new JSONArray("[" + raw + "]").getString(0));
          if (v.optBoolean("lost")) { cb.done(null, "The LinkedIn page changed while it was being read"); return; }
          if (id.equals(liProgressJob)) { liAddPeople(v.optJSONArray("fresh")); liQueuedInPage = v.optInt("queued", 0); if (v.optJSONObject("snapshot") != null) liLastSnapshot = v.optJSONObject("snapshot"); }
          JSONObject pp = v.optJSONObject("partial");
          JSONObject fr = pp == null ? null : pp.optJSONObject("fastReq");
          if (fr != null) {
            pp.remove("fastReq");  // the session headers never leave the phone
            if (id.equals(liProgressJob) && !id.equals(liNativeJob)) liStartNative(id, fr, pp.isNull("expectedTotal") ? -1 : pp.optInt("expectedTotal", -1));
          }
          if (v.optBoolean("done")) {
            Object res = v.opt("result");
            if (res instanceof JSONObject) cb.done((JSONObject) res, null);
            else cb.done(null, v.optString("error", "LinkedIn reader returned nothing"));
            return;
          }
          JSONObject prog = v.optJSONObject("partial");
          if (prog != null && !prog.toString().equals(lastLiProgress)) {
            lastLiProgress = prog.toString(); liStep(id, lastLiProgress.length() > 70 ? lastLiProgress.substring(0, 70) : lastLiProgress);
            linkedinBusySince = System.currentTimeMillis();  // progress keeps the watchdog away from long extractions
            liShowProgress(prog);
          }
          liUploadProgress(id, v.optJSONObject("snapshot"), prog);
          if (liStopRequested && liStopAt == 0) { liStopAt = System.currentTimeMillis(); linkedinWeb.evaluateJavascript("window.__cmgLiStop=true", null); }
          if (liStopRequested && liStopAt > 0 && System.currentTimeMillis() - liStopAt > 25000) {
            // The reader did not wind down in time: keep what it had read.
            JSONObject partial = v.optJSONObject("snapshot");
            partial = partial == null ? new JSONObject() : compactSnapshot(partial);
            partial.remove("inProgress");
            partial.put("status", "partial"); partial.put("stoppedByUser", true);
            if (prog != null) partial.put("progress", prog);
            linkedinWeb.evaluateJavascript("delete window.__cmgLiRuns[" + q + "]", null);
            cb.done(partial, null);
            return;
          }
          long nextDeadline = deadline;
          if (prog != null && !prog.toString().equals(lastLiHeartbeat)) { lastLiHeartbeat = prog.toString(); nextDeadline = Math.min(hardDeadline, System.currentTimeMillis() + 600000); }
          // While the app itself reads the reaction list, the page only waits: that is not a stalled read.
          if (id.equals(liNativeJob) && liNativeDone == null) nextDeadline = Math.min(hardDeadline, System.currentTimeMillis() + 600000);
          if (System.currentTimeMillis() > Math.min(nextDeadline, hardDeadline)) {
            JSONObject partial = v.optJSONObject("snapshot");
            boolean hasSnapshot = partial != null;
            if (!hasSnapshot) partial = new JSONObject();
            else if (id.equals(liProgressJob)) { partial = compactSnapshot(partial); partial.remove("inProgress"); }
            partial.put("status", hasSnapshot ? "partial" : "timeout");
            partial.put("timedOut", true);
            if (prog != null) partial.put("progress", prog);
            linkedinWeb.evaluateJavascript("delete window.__cmgLiRuns[" + q + "]", null);
            cb.done(partial, hasSnapshot ? null : "LinkedIn read timed out");
            return;
          }
          pollLi(id, key, nextDeadline, hardDeadline, cb);
        } catch (Exception e) { cb.done(null, "LinkedIn reader: " + e.getMessage()); }
      });
    }, 800);
  }

  /** Loads a LinkedIn URL and continues once the new document is there (condition-based, at most ~15 s). */
  private void liLoad(String id, String url, Runnable then) {
    if (linkedinWeb == null) { finishLinkedInJob(id, null, "LinkedIn page unavailable"); return; }
    linkedinWeb.loadUrl(url);
    final long started = System.currentTimeMillis();
    Runnable[] check = new Runnable[1];
    check[0] = () -> {
      if (linkedinWeb == null) { finishLinkedInJob(id, null, "LinkedIn page unavailable"); return; }
      long waited = System.currentTimeMillis() - started;
      if (waited >= 1500 && (linkedinWeb.getProgress() >= 90 || waited > 15000)) { dismissLinkedInAppPrompt(); then.run(); }
      else ui.postDelayed(check[0], 500);
    };
    ui.postDelayed(check[0], 600);
  }

  private static boolean isLinkedInPostUrl(String u) {
    return u != null && u.matches("https://(?:www\\.|[a-z]{2,3}\\.)?linkedin\\.com/(?:feed/update/urn:li:(?:activity|share|ugcPost):[0-9]+|posts/[A-Za-z0-9_%.-]+)/?(?:\\?[^#]*)?");
  }

  /** Options passed to the reader: only plain values from the job (never page content). */
  private JSONObject liOpts(JSONObject job) {
    JSONObject o = new JSONObject();
    try {
      for (String k : new String[]{"keywords", "author", "authorProfileUrl", "postUrl"}) {
        String v = job.optString(k, "").trim();
        if (!v.isEmpty()) o.put(k, v.length() > 300 ? v.substring(0, 300) : v);
      }
      o.put("limit", Math.min(2000, Math.max(1, job.optInt("limit", 100))));
      if (RelayClient.prefs(this).getBoolean("liFastRead", false)) { o.put("fastRead", true); o.put("nativeFast", true); }
    } catch (Exception ignored) {}
    return o;
  }

  /** Statuses that are real failures are returned as errors, with the result (diagnostics) attached. */
  private static String liError(JSONObject r, String err) {
    if (r == null) return err == null ? "LinkedIn reader returned nothing" : err;
    String st = r.optString("status");
    switch (st) {
      case "signed_out": return "LinkedIn not signed in";
      case "extraction_failed": return "LinkedIn page shows content but nothing could be extracted (layout not recognised); see diagnostics";
      case "not_loaded": return "LinkedIn page did not load";
      case "post_not_found": return "Target post not found on the page";
      case "ambiguous_post": return "Several posts match: give the post URL or more precise keywords/author";
      case "comment_control_missing": return "Comment control not found on the target post";
      case "reaction_counter_missing": return "Reaction count control missing on the target post";
      case "reaction_counter_ambiguous": return "Reaction count control ambiguous on the target post";
      case "reaction_counter_refused": return "Reaction count control refused by the safety rules";
      case "reaction_dialog_not_found": return "Reaction list did not open";
      case "no_people_read": return "Reaction list opened but no person could be read";
      case "timeout": return err == null ? "LinkedIn read timed out" : err;
      default: return err;
    }
  }

  private void liReadReactions(String id, JSONObject opts, int hops) {
    runLi(id, "readReactions", opts, 600000, (r, err) -> {
      if (r != null && "navigate".equals(r.optString("status")) && hops < 1) {
        try { if (r.has("expectedTotal")) opts.put("expectedTotal", r.opt("expectedTotal")); } catch (Exception ignored) {}
        liLoad(id, r.optString("url"), () -> liReadReactions(id, opts, hops + 1));
        return;
      }
      finishLiWithThumbs(id, r, liError(r, err));
    });
  }

  /** Comments of the target post. Never navigates away when that post's comments are already open. */
  private void liReadComments(String id, JSONObject job, boolean navigate) {
    JSONObject opts = liOpts(job);
    String postUrl = opts.optString("postUrl", "");
    if (navigate && !isLinkedInPostUrl(postUrl)) { finishLinkedInJob(id, null, "Invalid LinkedIn post URL"); return; }
    Runnable read = () -> liCommentsStep(id, "readComments", opts, 0, (r, err) -> finishLiWithThumbs(id, r, liError(r, err)));
    if (!navigate) { read.run(); return; }
    runLi(id, "targetOpen", opts, 8000, (t, e) -> { if (t != null && t.optBoolean("open")) read.run(); else liLoad(id, postUrl, read); });
  }

  private void liCommentsStep(String id, String fn, JSONObject opts, int hops, LiDone cb) {
    runLi(id, fn, opts, "readPostFull".equals(fn) ? 600000 : 120000, (r, err) -> {
      if (r != null && "navigate".equals(r.optString("status")) && hops < 1) { liLoad(id, r.optString("url"), () -> liCommentsStep(id, fn, opts, hops + 1, cb)); return; }
      cb.done(r, err);
    });
  }

  /**
   * Post search: 1) keywords in LinkedIn's Posts filter, 2) keywords + author, 3) LinkedIn's own search bar,
   * 4) the author's profile activity. Each attempt is reported; partial results are never proof of absence.
   */
  private void liSearchPosts(String id, JSONObject job, int stage, JSONArray attempts, JSONObject firstFailure, LiDone cb) {
    String keywords = job.optString("keywords", "").trim(), author = job.optString("author", "").trim();
    String profile = job.optString("authorProfileUrl", "").trim();
    JSONObject opts = liOpts(job);
    try { opts.put("limit", Math.min(50, Math.max(1, job.optInt("limit", 20)))); } catch (Exception ignored) {}
    String q1 = keywords.isEmpty() ? author : keywords;
    LiDone next = (r, err) -> {
      try {
        JSONObject a = new JSONObject();
        a.put("stage", new String[]{"posts_filter", "posts_filter_with_author", "search_bar", "profile_activity"}[stage]);
        a.put("status", r == null ? "error" : r.optString("status")); a.put("retrieved", r == null ? 0 : r.optInt("retrieved"));
        if (r != null) a.put("url", r.optString("searchUrl")); if (err != null) a.put("error", err);
        attempts.put(a);
        if (r != null && "signed_out".equals(r.optString("status"))) { r.put("attempts", attempts); cb.done(r, "LinkedIn not signed in"); return; }
        if (r != null && r.optInt("retrieved") > 0) { r.put("attempts", attempts); cb.done(r, null); return; }
        JSONObject keep = firstFailure != null ? firstFailure : r;
        String slug = profileSlug(profile);
        if (slug.isEmpty() && r != null) slug = profileSlug(firstMatchingAuthor(r.optJSONArray("authorsOnPage"), author));
        int nextStage = stage + 1;
        if (nextStage == 1 && (author.isEmpty() || keywords.isEmpty())) nextStage = 2;
        if (nextStage == 3 && author.isEmpty() && slug.isEmpty()) nextStage = 4;
        if (nextStage >= 4) {
          JSONObject out = keep != null ? keep : new JSONObject();
          out.put("attempts", attempts); out.put("partial", true);
          if (!out.has("status")) out.put("status", "no_results");
          cb.done(out, liError(out, err));
          return;
        }
        if (nextStage == 3 && slug.isEmpty()) {
          // Find the author's profile through LinkedIn's people search, then read their activity.
          liLoad(id, "https://www.linkedin.com/search/results/people/?keywords=" + java.net.URLEncoder.encode(author, "UTF-8"), () -> {
            JSONObject f = new JSONObject();
            try { f.put("name", author); } catch (Exception ignored) {}
            runLi(id, "findProfile", f, 20000, (pr, pe) -> {
              JSONArray ps = pr == null ? null : pr.optJSONArray("profiles");
              String found = ps != null && ps.length() > 0 && pr.optBoolean("unique") ? ps.optJSONObject(0).optString("profileUrl") : "";
              try { job.put("authorProfileUrl", found); } catch (Exception ignored) {}
              if (found.isEmpty()) {
                try { JSONObject out = keep != null ? keep : new JSONObject(); attempts.put(new JSONObject().put("stage", "profile_lookup").put("status", ps == null || ps.length() == 0 ? "not_found" : "ambiguous")); out.put("attempts", attempts); if (!out.has("status")) out.put("status", "no_results"); cb.done(out, liError(out, null)); } catch (Exception e) { cb.done(null, e.getMessage()); }
              } else liSearchPosts(id, job, 3, attempts, keep, cb);
            });
          });
          return;
        }
        liSearchPosts(id, job, nextStage, attempts, keep, cb);
      } catch (Exception e) { cb.done(r, e.getMessage()); }
    };
    try {
      if (stage == 0) liLoad(id, "https://www.linkedin.com/search/results/content/?keywords=" + java.net.URLEncoder.encode(q1, "UTF-8"), () -> runLi(id, "searchPosts", opts, 60000, next));
      else if (stage == 1) liLoad(id, "https://www.linkedin.com/search/results/content/?keywords=" + java.net.URLEncoder.encode(keywords + " " + author, "UTF-8"), () -> runLi(id, "searchPosts", opts, 60000, next));
      else if (stage == 2) {
        // LinkedIn's own search bar, then its "Posts" filter.
        JSONObject t = new JSONObject();
        runLi(id, "pageState", t, 5000, (ps, pe) -> linkedinWeb.evaluateJavascript(liLib() + "\n;window.__cmgLi.typeSearch(" + JSONObject.quote(q1) + ")", typed -> ui.postDelayed(() ->
          linkedinWeb.evaluateJavascript(liLib() + "\n;window.__cmgLi.ensurePostsFilter()", f -> ui.postDelayed(() -> runLi(id, "searchPosts", opts, 60000, next), 3500)), 4000)));
      } else {
        String slug = profileSlug(job.optString("authorProfileUrl", ""));
        liLoad(id, "https://www.linkedin.com/in/" + slug + "/recent-activity/all/", () -> runLi(id, "searchPosts", opts, 70000, next));
      }
    } catch (Exception e) { cb.done(null, e.getMessage()); }
  }

  private static String profileSlug(String url) {
    if (url == null) return "";
    java.util.regex.Matcher m = java.util.regex.Pattern.compile("linkedin\\.com/in/([A-Za-z0-9%._-]{1,150})").matcher(url);
    return m.find() ? m.group(1) : (url.matches("[A-Za-z0-9%._-]{1,150}") ? url : "");
  }

  /** "Name <https://www.linkedin.com/in/slug/>" entries reported by the reader; the one whose name holds every word. */
  private static String firstMatchingAuthor(JSONArray seen, String author) {
    if (seen == null || author == null || author.trim().isEmpty()) return "";
    String[] words = java.text.Normalizer.normalize(author.toLowerCase(java.util.Locale.ROOT), java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "").split("\\s+");
    for (int i = 0; i < seen.length(); i++) {
      String s = seen.optString(i);
      String name = java.text.Normalizer.normalize(s.toLowerCase(java.util.Locale.ROOT), java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "");
      boolean all = true;
      for (String w : words) if (!w.isEmpty() && !name.contains(w)) { all = false; break; }
      if (all && s.contains("/in/")) return s;
    }
    return "";
  }

  /**
   * Full extraction: search (when no URL) → choose the post → canonical URL → open → comments (open, wait,
   * expand, read) → reactions (count, categories, read) → consistency. Comments survive a reaction failure.
   */
  private void liFullExtraction(String id, JSONObject job) {
    String postUrl = job.optString("postUrl", "").trim();
    JSONObject opts = liOpts(job);
    // A new extraction starts from zero: people kept in the page memory by an earlier run are not counted
    // again (progress is saved on the server in batches during the run).
    try { opts.put("freshExtraction", true); } catch (Exception ignored) {}
    LiDone done = (r, err) -> {
      if (r != null && r.has("reactionsNavigate")) {
        // The reaction list is a separate page on this layout: read it there, keep the comments.
        liLoad(id, r.optString("reactionsNavigate"), () -> runLi(id, "readReactions", opts, 600000, (rr, re) -> {
          try {
            r.put("reactions", rr == null ? new JSONObject().put("status", "error").put("error", re) : rr);
            r.remove("reactionsNavigate");
            boolean cOk = "ok".equals(r.optJSONObject("comments") == null ? "" : r.optJSONObject("comments").optString("status"));
            boolean rOk = rr != null && "ok".equals(rr.optString("status"));
            r.put("status", cOk && rOk ? "ok" : (cOk || rOk ? "partial" : "failed"));
          } catch (Exception ignored) {}
          finishLiWithThumbs(id, r, null);
        }));
        return;
      }
      finishLiWithThumbs(id, r, r == null ? (err == null ? "Full extraction failed" : err) : ("failed".equals(r.optString("status")) ? "Neither comments nor reactions could be read; see details" : "timeout".equals(r.optString("status")) ? "LinkedIn read timed out" : null));
    };
    if (!postUrl.isEmpty()) {
      if (!isLinkedInPostUrl(postUrl)) { finishLinkedInJob(id, null, "Invalid LinkedIn post URL"); return; }
      runLi(id, "targetOpen", opts, 8000, (t, e) -> {
        Runnable read = () -> liCommentsStep(id, "readPostFull", opts, 0, done);
        if (t != null && t.optBoolean("open")) read.run(); else liLoad(id, postUrl, read);
      });
      return;
    }
    if (job.optString("keywords", "").trim().length() < 2 && job.optString("author", "").trim().length() < 2) { finishLinkedInJob(id, null, "Give a post URL, keywords or an author"); return; }
    liSearchPosts(id, job, 0, new JSONArray(), null, (sr, se) -> {
      JSONArray posts = sr == null ? null : sr.optJSONArray("posts");
      if (posts == null || posts.length() == 0) { finishLinkedInJob(id, sr, se == null ? "No matching post found" : se); return; }
      JSONObject best = posts.optJSONObject(0);
      try {
        if (posts.length() > 1 && best.optJSONObject("match") != null && posts.optJSONObject(1).optJSONObject("match") != null
          && best.optJSONObject("match").optDouble("score") == posts.optJSONObject(1).optJSONObject("match").optDouble("score")) {
          JSONObject out = new JSONObject().put("status", "ambiguous_post").put("candidates", posts).put("search", sr.optJSONArray("attempts"));
          finishLinkedInJob(id, out, "Several posts match equally: choose one postUrl or refine keywords/author"); return;
        }
        opts.put("keywords", job.optString("keywords", "")); opts.put("author", job.optString("author", ""));
        String url = best.optString("postUrl", "");
        if (!url.isEmpty()) { opts.put("postUrl", url); liLoad(id, url, () -> liCommentsStep(id, "readPostFull", opts, 0, (r, err) -> { try { if (r != null) r.put("search", sr.optJSONArray("attempts")); } catch (Exception ignored) {} done.done(r, err); })); }
        else {
          // No permalink on this layout: mark the matching result and read it in place (comments open over the results).
          runLi(id, "markTarget", opts, 10000, (m, me) -> {
            if (m == null || !m.optBoolean("marked")) { finishLinkedInJob(id, m, "The chosen post could not be located again on the results page"); return; }
            liCommentsStep(id, "readPostFull", opts, 0, (r, err) -> { try { if (r != null) r.put("search", sr.optJSONArray("attempts")); } catch (Exception ignored) {} done.done(r, err); });
          });
        }
      } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
    });
  }

  /** Job offers from LinkedIn job search, 25 per page; looks again while the list renders. */
  private void collectLinkedInJobs(String id, String baseUrl, int start, int limit, java.util.LinkedHashMap<String, JSONObject> found) {
    if (!linkedinMcpEnabled) { finishLinkedInJob(id, null, "LinkedIn navigation disabled"); return; }
    linkedinWeb.loadUrl(baseUrl + (start > 0 ? "&start=" + start : ""));
    ui.postDelayed(() -> extractLinkedInJobs(id, baseUrl, start, limit, found, 0, -1), 3500);
  }

  private void extractLinkedInJobs(String id, String baseUrl, int start, int limit, java.util.LinkedHashMap<String, JSONObject> found, int attempt, int lastCount) {
    String js = "(function(){const out=[],seen=new Set();"
      + "const ids=new Map();for(const e of document.querySelectorAll('[data-job-id],[data-occludable-job-id]')){const v=e.getAttribute('data-job-id')||e.getAttribute('data-occludable-job-id');if(/^\\d{5,20}$/.test(v||''))ids.set(e,v);}"
      + "for(const a of document.querySelectorAll('a[href*=\"/jobs/view/\"]')){const m=a.href.match(/\\/jobs\\/view\\/(?:[^/?]*-)?(\\d{5,20})/);if(m)ids.set(a.closest('li,[data-job-id],[class*=job-card],[class*=base-card],article')||a,m[1]);}"
      + "for(const [card,jid] of ids){if(seen.has(jid))continue;seen.add(jid);"
      + "const lines=(card.innerText||'').split('\\n').map(x=>x.trim()).filter(Boolean);if(!lines.length)continue;"
      + "const q=s=>{const e=card.querySelector(s);return e?(e.innerText||'').trim().split('\\n')[0]:'';};"
      + "const title=q('[class*=job-card-list__title],[class*=job-card-container__link],[class*=base-search-card__title],h3,strong')||lines[0];"
      + "const company=q('[class*=subtitle],[class*=company-name],[class*=base-search-card__subtitle],h4');"
      + "const place=q('[class*=metadata-item],[class*=job-search-card__location],[class*=location]');"
      + "const t=card.querySelector('time');const logo=[...card.querySelectorAll('img')].map(i=>i.getAttribute('data-delayed-url')||i.getAttribute('data-ghost-url')||i.getAttribute('data-src')||i.currentSrc||i.src||'').find(u=>/^https:\\/\\/[^/]*licdn\\.com\\//.test(u)&&!/ghost|spacer|data:/.test(u))||'';"
      + "out.push({jobId:jid,title:title.slice(0,200),company:company.slice(0,150),location:place.slice(0,150),posted:t?(t.getAttribute('datetime')||t.innerText.trim()):'',companyLogoUrl:logo,jobUrl:'https://www.linkedin.com/jobs/view/'+jid+'/',cardText:lines.join(' · ').slice(0,500)});}"
      + "const list=document.querySelector('[class*=jobs-search-results-list],[class*=scaffold-layout__list]');if(list)list.scrollTop=list.scrollHeight;window.scrollBy(0,window.innerHeight);"
      + "return JSON.stringify({jobs:out,signedOut:" + LI_SIGNED_OUT_JS + ",title:document.title.slice(0,80)});})()";
    linkedinWeb.evaluateJavascript(js, raw -> {
      try {
        JSONObject r = new JSONObject(new JSONArray("[" + raw + "]").getString(0));
        JSONArray jobs = r.optJSONArray("jobs");
        for (int i = 0; jobs != null && i < jobs.length() && found.size() < limit; i++) {
          JSONObject j = jobs.getJSONObject(i);
          found.putIfAbsent(j.optString("jobId"), j);
        }
        int pageCount = jobs == null ? 0 : jobs.length();
        if (r.optBoolean("signedOut")) { finishLinkedInJobsList(id, found, limit, start, "LinkedIn is not signed in inside the CamMicGo app: open the LinkedIn tab and sign in."); return; }
        if (found.size() >= limit) { finishLinkedInJobsList(id, found, limit, start, null); return; }
        if (attempt < 4 && pageCount > lastCount) { ui.postDelayed(() -> extractLinkedInJobs(id, baseUrl, start, limit, found, attempt + 1, pageCount), 1800); return; }
        if (attempt < 2 && pageCount == 0) { ui.postDelayed(() -> extractLinkedInJobs(id, baseUrl, start, limit, found, attempt + 1, pageCount), 2500); return; }
        if (pageCount > 0 && start < 50) { collectLinkedInJobs(id, baseUrl, start + 25, limit, found); return; }
        finishLinkedInJobsList(id, found, limit, start, found.isEmpty() ? "No job card found: no result for this search, or LinkedIn changed its layout." : null);
      } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
    });
  }

  private void finishLinkedInJobsList(String id, java.util.LinkedHashMap<String, JSONObject> found, int limit, int start, String note) {
    try {
      JSONArray list = new JSONArray();
      for (JSONObject j : found.values()) list.put(j);
      JSONObject out = new JSONObject().put("jobs", list).put("retrieved", list.length()).put("requested", limit).put("source", "linkedin_jobs_search");
      if (note != null) out.put("note", note);
      finishLinkedInCards(id, out);
    } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
  }

  /** Text of each titled section of a profile page (About, Experience, Education…), keyed by heading. */
  private static final String LI_SECTIONS_JS = "const sections={};for(const h of document.querySelectorAll('main h2,section h2')){const k=(h.innerText||'').trim().split('\\n')[0];if(!k||sections[k])continue;const sec=h.closest('section')||h.parentElement;const t=(sec?sec.innerText:'').trim();if(t)sections[k.slice(0,60)]=t.replace(k,'').trim().slice(0,4000);}";
  private static final String LI_IMG_JS = "const pick=sel=>{for(const i of document.querySelectorAll(sel)){const u=i.getAttribute('data-delayed-url')||i.currentSrc||i.src||'';if(/^https:\\/\\/[^/]*licdn\\.com\\//.test(u)&&!/ghost|spacer/.test(u))return u;}return '';};";

  private void extractLinkedInCompanyProfile(String id, String slug, int attempt) {
    String js = "(function(){" + LI_SECTIONS_JS + LI_IMG_JS
      + "const q=s=>{const e=document.querySelector(s);return e?(e.innerText||'').trim().split('\\n')[0]:'';};"
      + "const facts={};for(const dt of document.querySelectorAll('dl dt')){const dd=dt.nextElementSibling;if(dd&&dd.tagName==='DD')facts[(dt.innerText||'').trim().slice(0,60)]=(dd.innerText||'').trim().replace(/\\s+/g,' ').slice(0,400);}"
      + "const site=[...document.querySelectorAll('dl a[href^=\"http\"]')].map(a=>a.href).find(u=>!/linkedin\\.com/.test(u))||'';"
      + "return JSON.stringify({company:" + JSONObject.quote(slug) + ",name:q('h1'),tagline:q('[class*=org-top-card-summary__tagline],[class*=top-card-layout__headline]'),summary:q('[class*=org-top-card-summary-info-list],[class*=top-card-layout__first-subline]'),website:site,facts,sections,logoUrl:pick('img[class*=org-top-card-primary-content__logo],img[class*=logo],img[alt*=logo i]'),companyUrl:'https://www.linkedin.com/company/'+" + JSONObject.quote(slug) + "+'/',signedOut:" + LI_SIGNED_OUT_JS + "});})()";
    linkedinWeb.evaluateJavascript(js, raw -> {
      try {
        JSONObject r = new JSONObject(new JSONArray("[" + raw + "]").getString(0));
        if (r.optString("name").isEmpty() && !r.optBoolean("signedOut") && attempt < 3) { ui.postDelayed(() -> extractLinkedInCompanyProfile(id, slug, attempt + 1), 2000); return; }
        if (r.optBoolean("signedOut")) r.put("note", "LinkedIn is not signed in inside the CamMicGo app: open the LinkedIn tab and sign in.");
        finishLinkedInCards(id, r);
      } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
    });
  }

  private void extractLinkedInPersonProfile(String id, String slug, int attempt) {
    String js = "(function(){" + LI_SECTIONS_JS + LI_IMG_JS
      + "const q=s=>{const e=document.querySelector(s);return e?(e.innerText||'').trim().split('\\n')[0]:'';};"
      + "window.scrollBy(0,document.body.scrollHeight);"
      + "return JSON.stringify({profile:" + JSONObject.quote(slug) + ",name:q('h1'),headline:q('[class*=text-body-medium],[class*=top-card-layout__headline]'),location:q('[class*=text-body-small][class*=inline],[class*=top-card__subline-item],[class*=top-card-layout__first-subline]'),sections,photoUrl:pick('img[class*=pv-top-card-profile-picture__image],img[class*=profile-photo],img[class*=top-card__profile-image],main img[alt]'),profileUrl:'https://www.linkedin.com/in/'+" + JSONObject.quote(slug) + "+'/',signedOut:" + LI_SIGNED_OUT_JS + "});})()";
    linkedinWeb.evaluateJavascript(js, raw -> {
      try {
        JSONObject r = new JSONObject(new JSONArray("[" + raw + "]").getString(0));
        boolean thin = r.optJSONObject("sections") == null || r.optJSONObject("sections").length() < 2;
        if ((r.optString("name").isEmpty() || thin) && !r.optBoolean("signedOut") && attempt < 3) { ui.postDelayed(() -> extractLinkedInPersonProfile(id, slug, attempt + 1), 2200); return; }
        if (r.optBoolean("signedOut")) r.put("note", "LinkedIn is not signed in inside the CamMicGo app: open the LinkedIn tab and sign in.");
        finishLinkedInCards(id, r);
      } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
    });
  }

  /** One job offer: title, company, place and the full description text. */
  private void extractLinkedInJobDetails(String id, String jobId, int attempt) {
    String js = "(function(){const q=s=>{const e=document.querySelector(s);return e?(e.innerText||'').trim():'';};"
      + "const desc=q('[class*=jobs-description__content],[class*=jobs-box__html-content],[class*=description__text],#job-details,[class*=show-more-less-html]');"
      + "const title=q('[class*=job-details-jobs-unified-top-card__job-title],[class*=top-card-layout__title],h1');"
      + "const company=q('[class*=job-details-jobs-unified-top-card__company-name],[class*=topcard__org-name-link],[class*=top-card-layout__second-subline] a');"
      + "const meta=q('[class*=job-details-jobs-unified-top-card__primary-description],[class*=tertiary-description],[class*=topcard__flavor--bullet],[class*=top-card-layout__second-subline]');"
      + "const insights=[...document.querySelectorAll('[class*=job-insight],[class*=job-criteria__item],[class*=description__job-criteria-item]')].map(e=>(e.innerText||'').trim().replace(/\\s+/g,' ')).filter(Boolean).slice(0,12);"
      + "return JSON.stringify({jobId:" + JSONObject.quote(jobId) + ",title:title.split('\\n')[0].slice(0,200),company:company.split('\\n')[0].slice(0,150),meta:meta.replace(/\\s+/g,' ').slice(0,400),insights,description:desc.slice(0,12000),jobUrl:location.href.split('?')[0],signedOut:" + LI_SIGNED_OUT_JS + "});})()";
    linkedinWeb.evaluateJavascript(js, raw -> {
      try {
        JSONObject r = new JSONObject(new JSONArray("[" + raw + "]").getString(0));
        if (r.optString("description").isEmpty() && !r.optBoolean("signedOut") && attempt < 4) {
          linkedinWeb.evaluateJavascript("(function(){const b=[...document.querySelectorAll('button')].find(x=>/voir plus|see more|show more|afficher plus/i.test((x.innerText||'')+' '+(x.getAttribute('aria-label')||'')));if(b)b.click();})()", v -> { });
          ui.postDelayed(() -> extractLinkedInJobDetails(id, jobId, attempt + 1), 2000);
          return;
        }
        if (r.optBoolean("signedOut")) r.put("note", "LinkedIn is not signed in inside the CamMicGo app: open the LinkedIn tab and sign in.");
        else if (r.optString("description").isEmpty()) r.put("note", "Description not found on the job page; LinkedIn may have changed its layout.");
        finishLinkedInJob(id, r, null);
      } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
    });
  }

  /** Geographic filter used by a people search, added to its result. */
  private final java.util.Map<String, JSONObject> liGeoInfo = new java.util.HashMap<>();

  private static String join(JSONArray a) {
    StringBuilder b = new StringBuilder();
    for (int i = 0; i < a.length(); i++) { if (b.length() > 0) b.append(' '); b.append(a.optString(i)); }
    return b.toString();
  }

  interface GeoCallback { void done(JSONObject geo); }

  /**
   * Turns place names ("Tours", "Centre-Val de Loire") into LinkedIn geo IDs with LinkedIn's own place
   * suggestions, called from the signed-in page. Result: {param: URL-encoded ["id",…] or "", places:[{name,geoId,label}], unresolved:[…]}.
   */
  private void resolveLinkedInGeo(JSONArray places, GeoCallback callback) {
    String js = "(function(names){window.__cmgGeo=null;const st={};window.__cmgGeoStatus=st;"
      + "const m=document.cookie.match(/JSESSIONID=\"?([^\";]+)/);const csrf=m?m[1]:'';"
      + "Promise.all(names.map(n=>fetch('/voyager/api/typeahead/hitsV2?keywords='+encodeURIComponent(n)+'&origin=OTHER&q=type&type=GEO',{credentials:'include',headers:{'csrf-token':csrf,'x-restli-protocol-version':'2.0.0','accept':'application/json'}})"
      + ".then(r=>{st[n]=r.status;return r.ok?r.json():null;}).then(j=>{const els=(j&&(j.elements||(j.data&&j.data.elements)))||[];"
      + "for(const e of els){const t=JSON.stringify(e);const id=(t.match(/urn:li:(?:fs_)?geo:(\\d+)/)||[])[1];const label=(e.text&&e.text.text)||e.displayName||'';if(id)return {name:n,geoId:id,label};}return {name:n,geoId:null};})"
      + ".catch(()=>({name:n,geoId:null}))))"
      + ".then(r=>{window.__cmgGeo=r;});return 'started';})(" + places.toString() + ")";
    linkedinWeb.evaluateJavascript(js, v -> pollLinkedInGeo(places, callback, 0));
  }

  private void pollLinkedInGeo(JSONArray places, GeoCallback callback, int attempt) {
    ui.postDelayed(() -> linkedinWeb.evaluateJavascript("JSON.stringify(window.__cmgGeo)", raw -> {
      JSONArray found = null;
      try { String v = new JSONArray("[" + raw + "]").optString(0, "null"); if (!"null".equals(v)) found = new JSONArray(v); } catch (Exception ignored) { }
      if (found == null && attempt < 12) { pollLinkedInGeo(places, callback, attempt + 1); return; }
      JSONObject geo = new JSONObject();
      try {
        JSONArray ok = new JSONArray(), unresolved = new JSONArray(), ids = new JSONArray();
        for (int i = 0; found != null && i < found.length(); i++) {
          JSONObject p = found.getJSONObject(i);
          if (p.optString("geoId").matches("\\d+")) { ok.put(p); ids.put(p.optString("geoId")); } else unresolved.put(p.optString("name"));
        }
        if (found == null) for (int i = 0; i < places.length(); i++) unresolved.put(places.optString(i));
        geo.put("places", ok).put("unresolved", unresolved);
        if (unresolved.length() > 0) {
          linkedinWeb.evaluateJavascript("JSON.stringify(window.__cmgGeoStatus||{})", st -> {
            try { liGeoDiag = new JSONObject().put("typeaheadHttp", new JSONObject(new JSONArray("[" + st + "]").getString(0))); } catch (Exception e) { liGeoDiag = new JSONObject(); }
            geoFromJobsPage(unresolved, 0, ok, ids, new JSONArray(), callback);
          });
          return;
        }
        geo.put("applied", ids.length() > 0).put("method", "typeahead")
            .put("param", ids.length() > 0 ? java.net.URLEncoder.encode(ids.toString(), "UTF-8") : "");
      } catch (Exception ignored) { }
      callback.done(geo);
    }), 700);
  }

  /**
   * Fallback when LinkedIn's suggestion request fails: LinkedIn's job search turns a typed place into its
   * geo ID (geoId= in the page address and links), the same IDs as people and company searches.
   */
  /** What the place lookup saw, returned when a place could not be matched (to adapt to LinkedIn changes). */
  private JSONObject liGeoDiag = new JSONObject();

  private void geoFromJobsPage(JSONArray names, int index, JSONArray ok, JSONArray ids, JSONArray stillUnresolved, GeoCallback callback) {
    if (index >= names.length() || index >= 6) {
      JSONObject geo = new JSONObject();
      try {
        if (stillUnresolved.length() > 0) geo.put("diagnostics", liGeoDiag);
        geo.put("places", ok).put("unresolved", stillUnresolved).put("applied", ids.length() > 0).put("method", "jobs-page")
            .put("param", ids.length() > 0 ? java.net.URLEncoder.encode(ids.toString(), "UTF-8") : "");
      } catch (Exception ignored) { }
      callback.done(geo);
      return;
    }
    String name = names.optString(index);
    try { linkedinWeb.loadUrl("https://www.linkedin.com/jobs/search/?keywords=&location=" + java.net.URLEncoder.encode(name, "UTF-8")); }
    catch (Exception e) { stillUnresolved.put(name); geoFromJobsPage(names, index + 1, ok, ids, stillUnresolved, callback); return; }
    pollJobsPageGeo(names, index, ok, ids, stillUnresolved, callback, 0);
  }

  private void pollJobsPageGeo(JSONArray names, int index, JSONArray ok, JSONArray ids, JSONArray stillUnresolved, GeoCallback callback, int attempt) {
    ui.postDelayed(() -> linkedinWeb.evaluateJavascript("(function(){const f=u=>{const m=(u||'').match(/[?&]geoId=(\\d+)/);return m?m[1]:'';};let id=f(location.href);"
        + "if(!id){for(const a of document.querySelectorAll('a[href*=\"geoId=\"]')){id=f(a.href);if(id)break;}}"
        + "const html=document.documentElement.innerHTML;let from='url';"
        + "if(!id){const m=html.match(/geoId(?:%3D|=|\\\\?\"\\s*:\\s*\\\\?\")(\\d{6,12})/);if(m){id=m[1];from='page-data';}}"
        + "const urns=[...new Set((html.match(/urn:li:(?:fs_)?geo:\\d{6,12}/g)||[]))].slice(0,5);"
        + "const inp=document.querySelector('input[id*=jobs-search-box-location],input[aria-label*=ocation],input[aria-label*=ieu]');"
        + "return JSON.stringify({id,from,label:inp?inp.value:'',url:location.pathname+location.search.slice(0,160),urns});})()", raw -> {
      String id = "", label = "";
      try {
        JSONObject r = new JSONObject(new JSONArray("[" + raw + "]").getString(0)); id = r.optString("id"); label = r.optString("label");
        if (id.isEmpty() && attempt >= 6) liGeoDiag.put("jobsPage_" + names.optString(index), r);
      } catch (Exception ignored) { }
      if (id.isEmpty() && attempt < 6) { pollJobsPageGeo(names, index, ok, ids, stillUnresolved, callback, attempt + 1); return; }
      try {
        if (!id.isEmpty()) { ok.put(new JSONObject().put("name", names.optString(index)).put("geoId", id).put("label", label)); ids.put(id); }
        else stillUnresolved.put(names.optString(index));
      } catch (Exception ignored) { }
      geoFromJobsPage(names, index + 1, ok, ids, stillUnresolved, callback);
    }), 1200);
  }

  /** Company results, 10 per page, until the requested count; each with its headquarters place when shown. */
  private void collectLinkedInCompanies(String id, String baseUrl, int page, int limit, java.util.LinkedHashMap<String, JSONObject> found, JSONObject geo, JSONArray places) {
    if (!linkedinMcpEnabled) { finishLinkedInJob(id, null, "LinkedIn navigation disabled"); return; }
    linkedinWeb.loadUrl(baseUrl + (page > 1 ? "&page=" + page : ""));
    ui.postDelayed(() -> extractLinkedInCompanies(id, baseUrl, page, limit, found, geo, places, 0), 3200);
  }

  private void extractLinkedInCompanies(String id, String baseUrl, int page, int limit, java.util.LinkedHashMap<String, JSONObject> found, JSONObject geo, JSONArray places, int attempt) {
    String js = "(function(){const seen=new Set();const out=[];for(const a of document.querySelectorAll('a[href*=\"/company/\"]')){const href=a.href.split('?')[0].replace(/\\/$/,'')+'/';if(!/^https:\\/\\/www\\.linkedin\\.com\\/company\\/[^/]+\\/$/.test(href)||seen.has(href)||a.closest('header,nav,footer'))continue;const card=a.closest('li,article,[class*=result],[data-view-name]')||a;const lines=(card.innerText||'').split('\\n').map(x=>x.trim()).filter(Boolean);const name=((a.innerText||'').trim().split('\\n')[0]||lines[0]||'').slice(0,160);if(!name||/^(voir|view|see)\\b/i.test(name))continue;seen.add(href);const meta=lines.find(l=>/[•·]/.test(l))||lines[1]||'';const parts=meta.split(/\\s*[•·]\\s*/);out.push({name,companyUrl:href,industry:(parts.length>1?parts[0]:'').slice(0,120),location:(parts.length>1?parts.slice(1).join(', '):'').slice(0,160),followers:(lines.find(l=>/abonn|follower/i.test(l))||'').slice(0,60),description:lines.slice(1).join(' · ').slice(0,500),logoUrl:card.querySelector('img')?.currentSrc||card.querySelector('img')?.src||''});}"
      + "return JSON.stringify({companies:out,signedOut:" + LI_SIGNED_OUT_JS + ",noResults:!!document.querySelector('[class*=no-results],[class*=search-no-results]')});})()";
    linkedinWeb.evaluateJavascript(js, raw -> {
      try {
        JSONObject r = new JSONObject(new JSONArray("[" + raw + "]").getString(0));
        JSONArray list = r.optJSONArray("companies");
        int before = found.size();
        for (int i = 0; list != null && i < list.length() && found.size() < limit; i++) found.putIfAbsent(list.getJSONObject(i).optString("companyUrl"), list.getJSONObject(i));
        int onPage = list == null ? 0 : list.length();
        if (r.optBoolean("signedOut")) { finishLinkedInCompanies(id, found, limit, geo, places, page, "LinkedIn is not signed in inside the CamMicGo app: open the LinkedIn tab and sign in."); return; }
        if (onPage == 0 && attempt < 2 && !r.optBoolean("noResults")) { ui.postDelayed(() -> extractLinkedInCompanies(id, baseUrl, page, limit, found, geo, places, attempt + 1), 2200); return; }
        if (found.size() < limit && onPage > 0 && found.size() > before && page < 5) { collectLinkedInCompanies(id, baseUrl, page + 1, limit, found, geo, places); return; }
        finishLinkedInCompanies(id, found, limit, geo, places, page, found.size() < limit ? "LinkedIn returned no more results for this search." : null);
      } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
    });
  }

  private void finishLinkedInCompanies(String id, java.util.LinkedHashMap<String, JSONObject> found, int limit, JSONObject geo, JSONArray places, int pages, String note) {
    try {
      JSONArray list = new JSONArray();
      boolean applied = geo != null && geo.optBoolean("applied");
      for (JSONObject c : found.values()) {
        if (places.length() > 0 && !applied) {
          // No LinkedIn place filter: say for each company whether its shown place matches the request.
          String loc = c.optString("location").toLowerCase(java.util.Locale.ROOT);
          boolean match = false;
          for (int i = 0; i < places.length(); i++) if (!loc.isEmpty() && loc.contains(places.optString(i).toLowerCase(java.util.Locale.ROOT))) match = true;
          c.put("inRequestedArea", loc.isEmpty() ? JSONObject.NULL : match);
        }
        list.put(c);
      }
      JSONObject out = new JSONObject().put("companies", list).put("retrieved", list.length()).put("requested", limit).put("pagesRead", pages);
      if (places.length() > 0) out.put("geoFilter", geo == null ? new JSONObject().put("applied", false) : geo.put("param", JSONObject.NULL)
          .put("how", applied ? "LinkedIn headquarters location filter" : "places not recognised by LinkedIn: keyword search only, see inRequestedArea"));
      if (note != null) out.put("note", note);
      finishLinkedInCards(id, out);
    } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
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
      extractLinkedInPeople(id, baseUrl, page, requested, found, 0);
    }, 2800);
  }

  /** Reads the visible people results; LinkedIn renders them late, so it looks again for up to ~8 s. */
  private void extractLinkedInPeople(String id, String baseUrl, int page, int requested, java.util.LinkedHashMap<String, JSONObject> found, int attempt) {
    String js = "(function(){const seen=new Set();const out=[];"
      + "for(const a of document.querySelectorAll('a[href*=\"/in/\"]')){"
      + "const href=a.href.split('?')[0].split('#')[0].replace(/\\/$/,'')+'/';"
      + "if(!/^https:\\/\\/([a-z]{2,3}\\.)?linkedin\\.com\\/in\\/[^/]+\\/$/.test(href)||seen.has(href)||a.closest('header,nav,footer,[class*=global-nav]'))continue;"
      + "const card=a.closest('li,article,[class*=result],[class*=entity],[data-view-name]')||(a.parentElement&&a.parentElement.parentElement)||a;"
      + "const img=card.querySelector('img');const name=((a.innerText||'').trim().split('\\n')[0]||(img&&img.alt)||'').trim();"
      + "if(!name||/^(voir|view|see)\\b/i.test(name))continue;seen.add(href);"
      + "out.push({name:name.slice(0,150),headline:(card.innerText||'').trim().slice(0,350),profileUrl:href.replace(/^https:\\/\\/[a-z]{2,3}\\./,'https://www.'),avatarUrl:img?(img.currentSrc||img.src||''):''});}"
      + "return JSON.stringify({profiles:out.slice(0,100),url:location.pathname+location.search.slice(0,80),title:document.title,inLinks:document.querySelectorAll('a[href*=\"/in/\"]').length});})()";
    linkedinWeb.evaluateJavascript(js, raw -> {
      try {
        JSONObject data = new JSONObject(new JSONArray("[" + raw + "]").getString(0));
        JSONArray items = data.optJSONArray("profiles");
        if ((items == null || items.length() == 0) && attempt < 4) {
          ui.postDelayed(() -> extractLinkedInPeople(id, baseUrl, page, requested, found, attempt + 1), 2000); return;
        }
        int before = found.size();
        if (items != null) for (int n = 0; n < items.length() && found.size() < requested; n++) {
          JSONObject profile = items.optJSONObject(n);
          if (profile == null) continue;
          String profileUrl = profile.optString("profileUrl");
          if (profileUrl.startsWith("https://www.linkedin.com/in/") && !found.containsKey(profileUrl)) found.put(profileUrl, profile);
        }
        if (found.isEmpty()) {
          // Nothing readable: say what the page was, instead of an empty success.
          JSONObject diag = new JSONObject();
          diag.put("profiles", new JSONArray()); diag.put("retrieved", 0); diag.put("requested", requested);
          diag.put("reason", "no_profiles_visible"); diag.put("page", data.optString("url")); diag.put("title", data.optString("title")); diag.put("profileLinksOnPage", data.optInt("inLinks"));
          finishLinkedInJob(id, diag, null); return;
        }
        if (found.size() >= requested || found.size() >= 100) finishLinkedInSearch(id, requested, found, page, found.size() >= requested ? "requested_count_reached" : "continue_with_next_page");
        else if (items == null || items.length() == 0 || found.size() == before) finishLinkedInSearch(id, requested, found, page, "no_more_visible_results");
        else collectLinkedInSearchPage(id, baseUrl, page + 1, requested, found);
      } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
    });
  }

  /** Highlights the toolbar button of the page shown (also when the assistant navigates). */
  private Button[] linkedinNav;
  private void markLinkedInNav(String url) {
    if (linkedinNav == null || url == null) return;
    int active = url.contains("/messaging") ? 0 : url.contains("/mynetwork") ? 1 : url.contains("/search/") ? 2 : -1;
    for (int i = 0; i < linkedinNav.length; i++) {
      Button b = linkedinNav[i];
      boolean on = i == active;
      setNavState(b, on);
      b.setContentDescription(b.getText() + (on ? " ✓" : ""));
    }
  }

  private void finishLinkedInSearch(String id, int requested, java.util.LinkedHashMap<String, JSONObject> found, int pages, String reason) {
    try {
      JSONObject result = new JSONObject();
      JSONArray profiles = new JSONArray();
      for (JSONObject profile : found.values()) profiles.put(profile);
      result.put("requested", requested);
      result.put("retrieved", profiles.length());
      JSONObject geo = liGeoInfo.remove(id);
      if (geo != null) result.put("geoFilter", geo.put("param", JSONObject.NULL).put("how", geo.optBoolean("applied") ? "LinkedIn location filter" : "places not recognised by LinkedIn: added to the keywords"));
      result.put("lastPage", pages);
      result.put("nextPage", "continue_with_next_page".equals(reason) ? pages + 1 : JSONObject.NULL);
      result.put("batchSize", profiles.length());
      result.put("complete", profiles.length() >= requested || "no_more_visible_results".equals(reason));
      result.put("reason", reason);
      result.put("profiles", profiles);
      finishLinkedInCards(id, result);
    } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
  }

  // ---------------- LinkedIn attachments (0.6.19) ----------------
  // The file comes straight from the assistant's file storage (ChatGPT) into this app's private cache
  // (cache/linkedin-shared/<job>/), never through CamMicGo storage. It is put into LinkedIn's own file input
  // with a DataTransfer (no file chooser, so no user gesture is needed); if LinkedIn exposes no input, a real
  // tap on its attach button opens the chooser, which receives the cached file. Success is only reported when
  // LinkedIn shows the file in the composer and has finished uploading it; the text is sent only after that.
  interface LiJson { void done(JSONObject r); }
  private Runnable linkedinChooserDelivered;
  private static final java.util.regex.Pattern LI_FILE_HOST = java.util.regex.Pattern.compile(
    "^(chatgpt\\.com|oaiusercontent\\.com|[a-z0-9.-]+\\.(oaiusercontent|openai|chatgpt)\\.com|oaisdmntpr[a-z0-9]{1,40}\\.blob\\.core\\.windows\\.net)$");
  private static final String[] LI_ATTACH_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"};
  /** Shared page helpers: composer, the area around it, and what LinkedIn shows for an attachment there. */
  private static final String LI_JS =
    "const norm=s=>(s||'').replace(/\\s+/g,' ').trim().toLocaleLowerCase();"
    + "const visible=e=>{const r=e.getBoundingClientRect();const st=getComputedStyle(e);return r.width>0&&r.height>0&&st.visibility!=='hidden'&&st.display!=='none'};"
    // Same composer detection as the text-only send that works on LinkedIn mobile (inputs included).
    + "const findEditor=()=>{const scope=document.querySelector('main')||document;"
    + "const ok=e=>visible(e)&&!e.disabled&&!e.readOnly&&!e.closest('header,nav,[role=\"search\"],[class*=\"search\"]')&&!e.closest('[aria-hidden=\"true\"]');"
    + "const c=[...scope.querySelectorAll('textarea,[contenteditable=\"true\"],[contenteditable=\"\"],[role=\"textbox\"],input[type=\"text\"],input:not([type])')].filter(ok);"
    + "const s=c.map(e=>{const h=[e.getAttribute('aria-label'),e.getAttribute('data-placeholder'),e.getAttribute('placeholder'),e.getAttribute('role'),e.getAttribute('data-testid'),e.className].filter(x=>typeof x==='string').join(' ').toLowerCase();let v=0;"
    + "if(/message|messag|r\\u00e9diger|write|compose|envoyer|reply|r\\u00e9pondre/.test(h))v+=6;if(e.matches('textarea'))v+=3;if(e.isContentEditable)v+=2;"
    + "if(e.closest('form,[class*=\"compose\"],[class*=\"footer\"],[class*=\"reply\"]'))v+=3;if(e.closest('[class*=\"conversation\"],[class*=\"thread\"],[class*=\"messaging\"]'))v+=2;return {e,v}}).sort((a,b)=>b.v-a.v);"
    + "return s.length&&s[0].v>=2&&!(s.length>1&&s[0].v===s[1].v)?s[0].e:null};"
    + "const regionOf=ed=>{if(!ed)return document.querySelector('main')||document.body;let n=ed;for(let i=0;i<8&&n.parentElement;i++){n=n.parentElement;if(n.matches('form,[class*=msg-form],[class*=compose],[class*=reply],[class*=footer]'))return n;}return (ed.parentElement&&ed.parentElement.parentElement&&ed.parentElement.parentElement.parentElement)||document.body};"
    + "const evidence=name=>{const ed=findEditor();const reg=regionOf(ed);const n=norm(name);"
    + "const imgs=[...reg.querySelectorAll('img')].filter(i=>{const s=i.currentSrc||i.src||'';return /^(blob:|data:image)/.test(s)||/media\\.licdn|dms\\/image|messaging|attachment/i.test(s)}).length;"
    + "const named=n.length>4?[...reg.querySelectorAll('*')].filter(e=>e.children.length===0&&norm(e.textContent).includes(n)).length:0;"
    + "const remove=[...reg.querySelectorAll('button,[role=button]')].filter(b=>{const l=norm(b.getAttribute('aria-label')||b.title||b.innerText);return /remove|supprimer|retirer|delete|effacer|annuler/.test(l)&&/attach|pi\\u00e8ce|piece|image|photo|fichier|file|m\\u00e9dia|media/.test(l)}).length;"
    + "const progress=[...reg.querySelectorAll('[role=progressbar],progress,[class*=progress],[class*=uploading]')].filter(visible).length;"
    + "const text=ed?(ed.matches('textarea,input')?ed.value:ed.innerText).trim().length:-1;"
    + "return {editor:!!ed,imgs,named,remove,progress,text}};"
    + "const headerHas=name=>[...document.querySelectorAll('h1,h2,h3,[class*=conversation-header],[class*=thread-header]')].map(e=>(e.innerText||'').trim()).filter(Boolean).some(s=>norm(s).includes(norm(name)));"
    + "const items=()=>[...document.querySelectorAll('li[class*=message],[class*=msg-s-event-listitem],[class*=message-event]')];";

  private static JSONObject liParse(String raw) {
    try { return new JSONObject(new JSONArray("[" + raw + "]").getString(0)); }
    catch (Exception e) { JSONObject o = new JSONObject(); try { o.put("error", "Unreadable page answer"); } catch (Exception ignored) {} return o; }
  }
  private void liEval(String body, LiJson done) {
    linkedinWeb.evaluateJavascript("(function(){" + LI_JS + body + "})()", raw -> done.done(liParse(raw)));
  }
  private static String q(String s) { return JSONObject.quote(s == null ? "" : s); }
  private java.io.File liJobDir(String id) { return new java.io.File(new java.io.File(getCacheDir(), "linkedin-shared"), "job-" + id.replaceAll("[^0-9a-fA-F-]", "")); }
  private void liDeleteJobFiles(String id) {
    java.io.File dir = liJobDir(id);
    java.io.File[] files = dir.listFiles();
    if (files != null) for (java.io.File f : files) f.delete();
    dir.delete();
    if (linkedinWeb != null) linkedinWeb.evaluateJavascript("try{delete window.__cmgUp}catch(e){}", null);
  }
  private void liFail(String id, String error, JSONObject details) {
    liDeleteJobFiles(id);
    linkedinPendingAttachment = null; linkedinPendingAttachmentJob = null; linkedinChooserDelivered = null;
    finishLinkedInJob(id, details, error);
  }

  /** attach (composer only) and send (optionally with one file): one job, one outcome. */
  private void runLinkedInFileJob(String id, String requestedOp, JSONObject job) {
    String participant = job.optString("participant", "").trim();
    String text = job.optString("text", "");
    String url = job.optString("attachmentUrl", "");
    boolean withFile = !url.isEmpty();
    // An approved message with a file arrives as an attach job that sends once the file is verified.
    final String op = "attach".equals(requestedOp) && job.optBoolean("sendAfterAttach", false) ? "send" : requestedOp;
    if (participant.length() < 2 || participant.length() > 150) { finishLinkedInJob(id, null, "Recipient required"); return; }
    if ("send".equals(op) && (text.isEmpty() || text.length() > 3000)) { finishLinkedInJob(id, null, "Invalid text"); return; }
    if ("attach".equals(op) && !withFile) { finishLinkedInJob(id, null, "No file given"); return; }
    liStep(id, "opening");
    liEnsureThread(id, participant, () -> {
      if (!withFile) { liStep(id, "sending"); liSend(id, participant, text, null, null); return; }
      Runnable attachThenFinish = () -> liDownload(id, job, file -> liAttach(id, file, job.optString("attachmentName"), job.optString("attachmentMime"), attached -> {
        if (!attached.optBoolean("attached")) {
          // Leave the composer as it was: the text typed for this message is removed again.
          if ("send".equals(op)) liClearText(text, () -> liFail(id, "File not attached: nothing was sent", attached));
          else liFail(id, "File not attached: nothing was sent", attached);
          return;
        }
        if ("attach".equals(op)) {
          liDeleteJobFiles(id);
          try { attached.put("sent", false); attached.put("note", "In the composer only: nothing was sent."); } catch (Exception ignored) {}
          finishLinkedInJob(id, attached, null);
        } else liClickSend(id, participant, text, file, attached);
      }));
      // LinkedIn mobile covers the composer with a full-screen preview once a file is attached:
      // the text is written and checked first, while the composer is still visible.
      if ("send".equals(op)) { liStep(id, "writing"); liTypeText(id, participant, text, attachThenFinish); }
      else attachThenFinish.run();
    });
  }

  /** Verifies the open conversation is the recipient's; otherwise opens it from the inbox and checks again. */
  private void liEnsureThread(String id, String participant, Runnable ready) {
    liEval("return JSON.stringify({ok:location.pathname.includes('/thread/')&&headerHas(" + q(participant) + ")});", r -> {
      if (r.optBoolean("ok")) { ready.run(); return; }
      linkedinWeb.loadUrl("https://www.linkedin.com/messaging/");
      ui.postDelayed(() -> {
        String js = "const sels='li[class*=conversation],[class*=conversation-list] li,[class*=messaging] [role=listitem]';"
          + "const found=[...document.querySelectorAll(sels)].filter(n=>norm(n.innerText).includes(norm(" + q(participant) + ")));"
          + "if(found.length!==1)return JSON.stringify({error:found.length?'Several conversations match this name':'Conversation not visible in the inbox',matches:found.length});"
          + "(found[0].querySelector('a[href]')||found[0]).click();return JSON.stringify({clicked:true});";
        liEval(js, clicked -> {
          if (!clicked.optBoolean("clicked")) { liFail(id, clicked.optString("error", "Conversation not found"), clicked); return; }
          ui.postDelayed(() -> liEval("return JSON.stringify({ok:location.pathname.includes('/thread/')&&headerHas(" + q(participant) + ")});", check -> {
            if (check.optBoolean("ok")) ready.run();
            else liFail(id, "Recipient not verified in the open conversation: nothing was sent", check);
          }), 3000);
        });
      }, 2800);
    });
  }

  /** Downloads the file into the private cache; checks host, type, exact size and SHA-256 fingerprint. */
  private void liDownload(String id, JSONObject job, java.util.function.Consumer<java.io.File> next) {
    String url = job.optString("attachmentUrl", "");
    String mime = job.optString("attachmentMime", "");
    String name = job.optString("attachmentName", "file").replaceAll("[\\\\/\\u0000-\\u001f:*?\"<>|]", " ").trim();
    long expected = job.optLong("attachmentBytes", -1);
    String sha = job.optString("attachmentSha256", "").toLowerCase();
    liStep(id, "downloading");
    if (!java.util.Arrays.asList(LI_ATTACH_TYPES).contains(mime) || expected < 1 || expected > 5_000_000 || !sha.matches("[0-9a-f]{64}") || name.isEmpty()) {
      liFail(id, "Invalid attachment description", null); return;
    }
    worker.execute(() -> {
      try {
        java.net.URL target = new java.net.URL(url);
        java.net.HttpURLConnection c = null;
        for (int hop = 0; ; hop++) {
          if (!"https".equals(target.getProtocol()) || !LI_FILE_HOST.matcher(target.getHost().toLowerCase()).matches() || hop > 3)
            throw new Exception("File host not allowed: " + target.getHost());
          c = (java.net.HttpURLConnection) target.openConnection();
          c.setInstanceFollowRedirects(false);
          c.setConnectTimeout(10000); c.setReadTimeout(30000);
          int code = c.getResponseCode();
          if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) { target = new java.net.URL(target, c.getHeaderField("Location")); c.disconnect(); continue; }
          if (code != 200) throw new Exception("Download HTTP " + code + (code == 403 || code == 404 ? " (the assistant's file link expired: send the file again)" : ""));
          break;
        }
        java.io.File dir = liJobDir(id);
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("Cache unavailable");
        java.io.File file = new java.io.File(dir, name.length() > 120 ? name.substring(name.length() - 120) : name);
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
        long total = 0;
        try (java.io.InputStream in = c.getInputStream(); java.io.FileOutputStream out = new java.io.FileOutputStream(file)) {
          byte[] buf = new byte[16384]; int n;
          while ((n = in.read(buf)) != -1) { total += n; if (total > expected) throw new Exception("File larger than announced"); md.update(buf, 0, n); out.write(buf, 0, n); }
        } finally { c.disconnect(); }
        StringBuilder hex = new StringBuilder(); for (byte b : md.digest()) hex.append(String.format("%02x", b));
        if (total != expected || !hex.toString().equals(sha)) throw new Exception("The downloaded file differs from the approved file");
        ui.post(() -> next.accept(file));
      } catch (Exception e) { ui.post(() -> liFail(id, "Attachment download failed: " + e.getMessage(), null)); }
    });
  }

  /** Puts the file into LinkedIn's composer and waits until LinkedIn shows it, uploaded. */
  private void liAttach(String id, java.io.File file, String name, String mime, LiJson done) {
    liStep(id, "attaching");
    liEval("return JSON.stringify(evidence(" + q(name) + "));", base -> {
      String b64;
      try { b64 = android.util.Base64.encodeToString(java.nio.file.Files.readAllBytes(file.toPath()), android.util.Base64.NO_WRAP); }
      catch (Exception e) { liFail(id, "Cache read failed", null); return; }
      java.util.List<String> parts = new java.util.ArrayList<>();
      for (int i = 0; i < b64.length(); i += 400_000) parts.add(b64.substring(i, Math.min(b64.length(), i + 400_000)));
      linkedinWeb.evaluateJavascript("window.__cmgUp=[];1", v -> liPush(parts, 0, () -> liInject(id, file, name, mime, base, false, done)));
    });
  }
  private void liPush(java.util.List<String> parts, int i, Runnable after) {
    if (i >= parts.size()) { after.run(); return; }
    linkedinWeb.evaluateJavascript("window.__cmgUp.push('" + parts.get(i) + "');1", v -> liPush(parts, i + 1, after));
  }
  private void liInject(String id, java.io.File file, String name, String mime, JSONObject base, boolean revealed, LiJson done) {
    boolean image = mime.startsWith("image/");
    String js = "const image=" + image + ";const inputs=[...document.querySelectorAll('input[type=file]')];"
      + "const score=e=>{const a=(e.accept||'').toLowerCase();let s=0;if(e.disabled)return -9;if(image){if(/image/.test(a))s+=5;else if(!a||a.includes('*'))s+=2;}else{if(/pdf|doc|text|application|\\*/.test(a))s+=5;else if(!a)s+=2;else if(/^image\\//.test(a)&&!a.includes(','))s-=5;}const ed=findEditor();if(ed&&regionOf(ed).contains(e))s+=3;return s};"
      + "const ranked=inputs.map(e=>({e,s:score(e)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);"
      + "const diag=inputs.map(e=>({accept:e.accept||'',multiple:e.multiple,visible:visible(e)}));"
      + "if(!ranked.length)return JSON.stringify({injected:false,reason:'no_file_input',inputs:diag});"
      + "const b=atob((window.__cmgUp||[]).join(''));const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);"
      + "if(!u.length)return JSON.stringify({injected:false,reason:'no_bytes'});"
      + "const f=new File([u]," + q(name) + ",{type:" + q(mime) + ",lastModified:Date.now()});const dt=new DataTransfer();dt.items.add(f);"
      + "const t=ranked[0].e;t.files=dt.files;t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new Event('change',{bubbles:true}));"
      + "return JSON.stringify({injected:t.files.length===1,accept:t.accept||'',inputs:diag});";
    liEval(js, r -> {
      if (r.optBoolean("injected")) { liStep(id, "verifying"); liWaitEvidence(id, name, base, 25, "datatransfer", r, file, mime, done); return; }
      if (!revealed && "no_file_input".equals(r.optString("reason"))) {
        // Some layouts create the input only once the attach menu is open: open it, then try again.
        liEval("const re=" + (image ? "/photo|image|picture|galerie|gallery/" : "/attach|joindre|document|fichier|file|pi\\u00e8ce/") + ";"
          + "const m=[...document.querySelectorAll('button,[role=button]')].filter(visible).filter(b=>re.test(norm(b.getAttribute('aria-label')||b.title||b.innerText)));"
          + "if(m.length)m[0].click();return JSON.stringify({clicked:m.length});",
          c -> ui.postDelayed(() -> liInject(id, file, name, mime, base, true, done), 900));
        return;
      }
      liChooserFallback(id, file, name, mime, base, r, done);
    });
  }
  /** Fallback: a real tap on LinkedIn's attach button opens the chooser, which receives the cached file. */
  private void liChooserFallback(String id, java.io.File file, String name, String mime, JSONObject base, JSONObject diag, LiJson done) {
    boolean image = mime.startsWith("image/");
    liEval("const re=" + (image ? "/photo|image|picture|galerie|gallery/" : "/attach|joindre|document|fichier|file|pi\\u00e8ce/") + ";"
      + "const all=[...document.querySelectorAll('button,[role=button],label')].filter(visible);"
      + "const m=all.filter(b=>re.test(norm(b.getAttribute('aria-label')||b.title||b.innerText)));"
      + "if(!m.length)return JSON.stringify({found:0,labels:all.map(b=>norm(b.getAttribute('aria-label')||b.title||b.innerText).slice(0,40)).filter(Boolean).slice(0,40)});"
      + "m[0].scrollIntoView({block:'center'});const r=m[0].getBoundingClientRect();"
      + "return JSON.stringify({found:m.length,x:r.left+r.width/2,y:r.top+r.height/2,dpr:devicePixelRatio});", btn -> {
      if (btn.optInt("found") < 1) {
        JSONObject out = new JSONObject();
        try { out.put("attached", false); out.put("reason", "LinkedIn shows neither a file input nor an attach button"); out.put("injection", diag); out.put("buttons", btn.optJSONArray("labels")); } catch (Exception ignored) {}
        done.done(out); return;
      }
      Uri uri;
      try { uri = androidx.core.content.FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", file); }
      catch (Exception e) { liFail(id, "Cache file not shareable", null); return; }
      linkedinPendingAttachment = uri; linkedinPendingAttachmentJob = id;
      final boolean[] delivered = {false};
      linkedinChooserDelivered = () -> { delivered[0] = true; liWaitEvidence(id, name, base, 25, "chooser", diag, file, mime, done); };
      float dpr = (float) btn.optDouble("dpr", getResources().getDisplayMetrics().density);
      float x = (float) btn.optDouble("x") * dpr, y = (float) btn.optDouble("y") * dpr;
      long t0 = android.os.SystemClock.uptimeMillis();
      android.view.MotionEvent down = android.view.MotionEvent.obtain(t0, t0, android.view.MotionEvent.ACTION_DOWN, x, y, 0);
      android.view.MotionEvent up = android.view.MotionEvent.obtain(t0, t0 + 60, android.view.MotionEvent.ACTION_UP, x, y, 0);
      linkedinWeb.dispatchTouchEvent(down);
      ui.postDelayed(() -> { linkedinWeb.dispatchTouchEvent(up); down.recycle(); up.recycle(); }, 60);
      ui.postDelayed(() -> {
        if (delivered[0]) return;
        linkedinPendingAttachment = null; linkedinPendingAttachmentJob = null; linkedinChooserDelivered = null;
        JSONObject out = new JSONObject();
        try { out.put("attached", false); out.put("reason", "LinkedIn did not open its file chooser"); out.put("injection", diag); } catch (Exception ignored) {}
        done.done(out);
      }, 8000);
    });
  }
  /** Attached = LinkedIn shows something new for the file in the composer and no upload is running. */
  private void liWaitEvidence(String id, String name, JSONObject base, int triesLeft, String method, JSONObject diag, java.io.File file, String mime, LiJson done) {
    ui.postDelayed(() -> liEval("return JSON.stringify(evidence(" + q(name) + "));", now -> {
      boolean seen = now.optInt("imgs") > base.optInt("imgs") || now.optInt("named") > base.optInt("named");
      boolean uploading = now.optInt("progress") > base.optInt("progress");
      if (seen && !uploading) {
        JSONObject out = new JSONObject();
        try { out.put("attached", true); out.put("verified", true); out.put("method", method); out.put("name", name); out.put("mime", mime); out.put("bytes", file.length()); out.put("evidence", now); } catch (Exception ignored) {}
        done.done(out); return;
      }
      if (!seen && "datatransfer".equals(method) && triesLeft == 17) { liChooserFallback(id, file, name, mime, base, diag, done); return; }
      if (triesLeft <= 0) {
        JSONObject out = new JSONObject();
        try { out.put("attached", false); out.put("reason", seen ? "LinkedIn was still uploading the file" : "LinkedIn does not show the file in the composer"); out.put("method", method); out.put("before", base); out.put("after", now); out.put("injection", diag); } catch (Exception ignored) {}
        done.done(out); return;
      }
      liWaitEvidence(id, name, base, triesLeft - 1, method, diag, file, mime, done);
    }), 1000);
  }


  /** Writes the approved text in the visible composer and checks it, without sending. */
  private void liTypeText(String id, String participant, String text, Runnable next) { liTypeText(id, participant, text, next, 0); }
  private void liTypeText(String id, String participant, String text, Runnable next, int attempt) {
    String js = "const name=" + q(participant) + ",msg=" + q(text) + ";"
      + "if(!headerHas(name))return JSON.stringify({error:'Recipient not verified'});"
      + "const ev=evidence('');"
      // An unsent attachment left in the composer (an earlier attempt) is removed once, never sent with this message.
      + "if(ev.remove>0){const reg=regionOf(findEditor());const rm=[...reg.querySelectorAll('button,[role=button]')].filter(b=>{const l=norm(b.getAttribute('aria-label')||b.title||b.innerText);return /remove|supprimer|retirer|delete|effacer|annuler/.test(l)&&/attach|pi\\u00e8ce|piece|image|photo|fichier|file|m\\u00e9dia|media/.test(l)});"
      + "const labels=rm.map(b=>norm(b.getAttribute('aria-label')||b.title||b.innerText).slice(0,60));"
      + "if(" + attempt + ">0&&(ev.imgs>0||ev.named>0))return JSON.stringify({error:'The composer still holds an attachment that was not approved: nothing was sent',evidence:ev,buttons:labels});"
      + "if(" + attempt + "===0)"
      + "{rm.forEach(b=>b.click());return JSON.stringify({leftoverRemoved:rm.length,buttons:labels});}}"
      + "const editor=findEditor();if(!editor)return JSON.stringify({error:'Message composer not found',fields:[...document.querySelectorAll('textarea,[contenteditable],[role=\\\"textbox\\\"],input')].filter(visible).slice(0,8).map(e=>({tag:e.tagName.toLowerCase(),type:e.type||'',label:(e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').slice(0,60)}))});"
      + "editor.focus();"
      + "if(editor.matches('textarea,input')){const p=editor.matches('textarea')?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(editor,msg);}else editor.textContent=msg;"
      + "editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:msg}));editor.dispatchEvent(new Event('change',{bubbles:true}));"
      + "const actual=editor.matches('textarea,input')?editor.value:editor.innerText;"
      + "if(actual.trim()!==msg.trim())return JSON.stringify({error:'Composer text verification failed'});"
      + "return JSON.stringify({typed:true});";
    liEval(js, r -> {
      if (r.optBoolean("typed")) next.run();
      else if (r.has("leftoverRemoved")) ui.postDelayed(() -> liTypeText(id, participant, text, next, attempt + 1), 1500);
      else liFail(id, r.optString("error", "Text not written") + (r.optString("error").contains("nothing") ? "" : ": nothing was sent"), r);
    });
  }
  /** Removes the text this job wrote (used when the file could not be attached). */
  private void liClearText(String text, Runnable next) {
    liEval("const msg=norm(" + q(text) + ");"
      + "for(const e of document.querySelectorAll('textarea,[contenteditable=\"true\"],[contenteditable=\"\"],[role=\"textbox\"],input[type=\"text\"],input:not([type])')){"
      + "const v=e.matches('textarea,input')?e.value:e.innerText;if(norm(v)!==msg)continue;"
      + "if(e.matches('textarea,input')){const p=e.matches('textarea')?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,'');}else e.textContent='';"
      + "e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward'}));}return JSON.stringify({cleared:true});", r -> next.run());
  }
  /** Sends once the file is shown: the text must still be in the composer (even if the preview hides it). */
  private void liClickSend(String id, String participant, String text, java.io.File file, JSONObject attached) {
    liStep(id, "sending");
    String name = attached.optString("name");
    String js = "const msg=" + q(text) + ",fname=" + q(name) + ";"
      + "const ev=evidence(fname);"
      + "if(!(ev.imgs>0||ev.named>0))return JSON.stringify({error:'The file is no longer shown: nothing was sent',evidence:ev});"
      + "if(ev.progress>0)return JSON.stringify({error:'LinkedIn is still uploading: nothing was sent'});"
      + "const t=norm(msg).slice(0,60);"
      + "const kept=[...document.querySelectorAll('textarea,[contenteditable=\"true\"],[contenteditable=\"\"],[role=\"textbox\"],input[type=\"text\"],input:not([type])')].some(e=>norm(e.matches('textarea,input')?e.value:e.innerText).includes(t));"
      + "if(!kept)return JSON.stringify({error:'The text disappeared when the file was attached: nothing was sent'});"
      + "const all=[...document.querySelectorAll('button,[role=\"button\"],input[type=\"submit\"]')].filter(visible);"
      + "const buttons=all.filter(b=>/^(send|envoyer)( (le |un |a |the )?message)?$/i.test((b.getAttribute('aria-label')||b.getAttribute('title')||b.innerText||b.value||'').trim()));"
      + "if(buttons.length!==1)return JSON.stringify({error:'Send button ambiguous or missing: nothing was sent',matches:buttons.length,buttons:all.map(b=>(b.getAttribute('aria-label')||b.title||b.innerText||'').trim().slice(0,40)).filter(Boolean).slice(0,30)});"
      + "if(buttons[0].disabled||buttons[0].getAttribute('aria-disabled')==='true')return JSON.stringify({error:'Send button disabled: nothing was sent'});"
      + "const before=items().length;buttons[0].click();return JSON.stringify({clicked:true,before});";
    liEval(js, r -> {
      if (!r.optBoolean("clicked")) { liClearText(text, () -> liFail(id, r.optString("error", "Send failed: nothing was sent"), r)); return; }
      liVerifySent(id, participant, text, name, true, r.optInt("before"), attached, 20);
    });
  }

  /** Writes and sends the text; with a file, only if it is still in the composer. Then checks the thread. */
  private void liSend(String id, String participant, String text, java.io.File file, JSONObject attached) {
    boolean withFile = file != null;
    String name = withFile ? attached.optString("name") : "";
    String js = "const name=" + q(participant) + ",msg=" + q(text) + ",withFile=" + withFile + ",fname=" + q(name) + ";"
      + "if(!headerHas(name))return JSON.stringify({error:'Recipient not verified'});"
      + "const ev=evidence(fname);"
      + "if(withFile&&!(ev.imgs>0||ev.named>0||ev.remove>0))return JSON.stringify({error:'The file is no longer in the composer: nothing was sent',evidence:ev});"
      + "if(!withFile&&(ev.imgs>0||ev.named>0))return JSON.stringify({error:'The composer already holds an attachment that was not approved: nothing was sent',evidence:ev});"
      + "if(ev.progress>0)return JSON.stringify({error:'LinkedIn is still uploading: nothing was sent'});"
      + "const editor=findEditor();if(!editor)return JSON.stringify({error:'Message composer not found',fields:[...document.querySelectorAll('textarea,[contenteditable],[role=\\\"textbox\\\"],input')].filter(visible).slice(0,8).map(e=>({tag:e.tagName.toLowerCase(),type:e.type||'',label:(e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').slice(0,60)}))});"
      + "const scope=document.querySelector('main')||document;"
      + "const buttons=[...scope.querySelectorAll('button,[role=\"button\"],input[type=\"submit\"]')].filter(visible).filter(b=>/^(send|envoyer)( (le |un |a |the )?message)?$/i.test((b.getAttribute('aria-label')||b.getAttribute('title')||b.innerText||b.value||'').trim()));"
      + "if(buttons.length!==1)return JSON.stringify({error:'Send button ambiguous or missing',matches:buttons.length});"
      + "const before=items().length;editor.focus();"
      + "if(editor.matches('textarea,input')){const p=editor.matches('textarea')?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(editor,msg);}else editor.textContent=msg;"
      + "editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:msg}));editor.dispatchEvent(new Event('change',{bubbles:true}));"
      + "const actual=editor.matches('textarea,input')?editor.value:editor.innerText;"
      + "if(actual.trim()!==msg.trim())return JSON.stringify({error:'Composer text verification failed'});"
      + "if(buttons[0].disabled||buttons[0].getAttribute('aria-disabled')==='true')return JSON.stringify({error:'Send button disabled'});"
      + "buttons[0].click();return JSON.stringify({clicked:true,before,characters:msg.length});";
    liEval(js, r -> {
      if (!r.optBoolean("clicked")) { liFail(id, r.optString("error", "Send failed") + (r.optString("error").contains("nothing") ? "" : ": nothing was sent"), r); return; }
      liVerifySent(id, participant, text, name, withFile, r.optInt("before"), attached, 20);
    });
  }
  /** Sent = the text (and the file) appear in the conversation; otherwise the outcome is reported as unconfirmed. */
  private void liVerifySent(String id, String participant, String text, String name, boolean withFile, int before, JSONObject attached, int triesLeft) {
    ui.postDelayed(() -> liEval("const t=norm(" + q(text) + ").slice(0,60),n=norm(" + q(name) + ");const last=items().slice(-4);"
      // The light mobile page (mwlite) does not always list the new message where the thread items are read:
      // the text also counts when it is on the page outside the composer, and the composer no longer holds it.
      + "const ed=findEditor();const inEditor=!!ed&&norm(ed.matches('textarea,input')?ed.value:ed.innerText).includes(t);"
      + "const main=document.querySelector('main')||document.body;const pageHas=norm(main.innerText).includes(t);"
      + "const textSeen=!inEditor&&(last.some(e=>norm(e.innerText).includes(t))||pageHas);"
      + "const fileSeen=last.some(e=>[...e.querySelectorAll('img')].some(i=>/messaging|dms\\/image|media\\.licdn|attachment|blob:/i.test(i.currentSrc||i.src||''))||(n.length>4&&norm(e.innerText).includes(n)));"
      + "const ev=evidence(n);return JSON.stringify({textSeen,fileSeen,count:items().length,composerEmpty:ev.text===0&&ev.remove===0});", r -> {
      boolean ok = r.optBoolean("textSeen") && (!withFile || r.optBoolean("fileSeen"));
      // Still not seen: reload the conversation once (the light page may not refresh by itself), then look again.
      if (!ok && triesLeft == 8) linkedinWeb.reload();
      if (!ok && triesLeft > 0) { liVerifySent(id, participant, text, name, withFile, before, attached, triesLeft - 1); return; }
      JSONObject out = new JSONObject();
      try {
        out.put("sent", ok); out.put("sendClicked", true); out.put("recipient", participant); out.put("characters", text.length());
        out.put("textSeenInThread", r.optBoolean("textSeen")); out.put("composerEmptied", r.optBoolean("composerEmpty"));
        if (withFile) { attached.put("seenInThread", r.optBoolean("fileSeen")); out.put("attachment", attached); }
        if (!ok) out.put("note", "Send was clicked but the message could not be confirmed on the page: it may well have been sent. Check the conversation (LinkedIn app) and do NOT send it again before checking.");
      } catch (Exception ignored) {}
      // LinkedIn has read the file (it is shown sent) or the job is over: the cached copy goes now.
      liDeleteJobFiles(id);
      finishLinkedInJob(id, out, null);
    }), 1000);
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
      JSONArray avatars = thread.optJSONArray("avatars");
      if (avatars != null) for (int i=0;i<avatars.length();i++) {
        JSONObject avatar = avatars.optJSONObject(i);
        if (avatar != null && !avatar.optString("url").isEmpty()) urls.add(avatar.optString("url"));
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
          try { item.put("url", url); } catch (Exception ignored) {}
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
              item.put("url",url);item.put("storagePath",saved.optString("storagePath"));item.put("mime",mime);item.put("bytes",bytes.size());
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

  /** Embed compact profile thumbnails in the relay result, avoiding expiring LinkedIn image URLs. */
  /**
   * People and company results: only LinkedIn's own image links are returned (imageUrl), never image
   * bytes, so no picture is copied into CamMicGo's database.
   */
  /**
   * Cards (people, companies, job offers, profile pages): LinkedIn images only load with the signed-in
   * session, so the phone adds a small JPEG thumbnail (64 px, a few KB) as imageDataUrl, plus LinkedIn's
   * own link as imageUrl. The server deletes results as soon as the assistant has read them.
   */
  private void finishLinkedInCards(String id, JSONObject data) {
    // WebView methods only work on the UI thread: read the user agent and cookies before going to the worker.
    final String agent = linkedinWeb == null ? "" : linkedinWeb.getSettings().getUserAgentString();
    final String cookie = CookieManager.getInstance().getCookie("https://www.linkedin.com/");
    worker.execute(() -> {
      try {
        int budget = 30;
        java.util.List<JSONObject> cards = new java.util.ArrayList<>();
        for (String key : new String[]{"profiles", "people", "companies", "jobs", "posts"}) {
          JSONArray items = data.optJSONArray(key);
          for (int i = 0; items != null && i < items.length(); i++) if (items.optJSONObject(i) != null) cards.add(items.optJSONObject(i));
        }
        if (data.has("logoUrl") || data.has("photoUrl")) cards.add(data);
        java.util.Map<String, String> cache = new java.util.HashMap<>();
        for (JSONObject card : cards) {
          String url = card.optString("avatarUrl", card.optString("logoUrl", card.optString("companyLogoUrl", card.optString("photoUrl", ""))));
          if (!url.startsWith("https://") || !(url.contains(".licdn.com/") || url.contains(".linkedin.com/"))) continue;
          card.put("imageUrl", url);
          if (budget <= 0) continue;
          String b64 = cache.containsKey(url) ? cache.get(url) : linkedInThumbnail(url, cookie, agent);
          cache.put(url, b64);
          if (b64 != null) { card.put("imageDataUrl", "data:image/jpeg;base64," + b64); budget--; }
        }
      } catch (Exception e) { android.util.Log.w("CamMicGoLinkedIn", "Card thumbnails", e); }
      ui.post(() -> finishLinkedInJob(id, data, null));
    });
  }

  /**
   * Reader results (posts, comments, reactions, full extraction): every person gets imageUrl (LinkedIn's
   * link) and a 64 px thumbnail the server serves for 24 h, fetched in parallel within a size budget.
   */
  private void finishLiWithThumbs(String id, JSONObject data, String error) {
    if (data == null || error != null) { finishLinkedInJob(id, data, error); return; }
    // The server writes reports in the language chosen in this app.
    try { data.put("uiLang", I18n.code(this)); } catch (Exception ignored) {}
    final String agent = linkedinWeb == null ? "" : linkedinWeb.getSettings().getUserAgentString();
    final String cookie = CookieManager.getInstance().getCookie("https://www.linkedin.com/");
    worker.execute(() -> {
      try {
        java.util.List<JSONObject> cards = new java.util.ArrayList<>();
        collectLiCards(data, cards, 0);
        java.util.LinkedHashMap<String, java.util.List<JSONObject>> byUrl = new java.util.LinkedHashMap<>();
        for (JSONObject card : cards) {
          String url = card.optString("photoUrl", card.optString("authorPhotoUrl", ""));
          if (!url.startsWith("https://") || !(url.contains(".licdn.com/") || url.contains(".linkedin.com/"))) continue;
          card.put("imageUrl", url);
          byUrl.computeIfAbsent(url, k -> new java.util.ArrayList<>()).add(card);
        }
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(6);
        java.util.Map<String, java.util.concurrent.Future<String>> jobs = new java.util.LinkedHashMap<>();
        int n = 0;
        for (String url : byUrl.keySet()) { if (n++ >= 120) break; jobs.put(url, pool.submit(() -> linkedInThumbnail(url, cookie, agent))); }
        int bytes = 0;
        for (java.util.Map.Entry<String, java.util.concurrent.Future<String>> en : jobs.entrySet()) {
          String b64 = null;
          try { b64 = en.getValue().get(10, java.util.concurrent.TimeUnit.SECONDS); } catch (Exception ignored) {}
          if (b64 == null || bytes + b64.length() > 150_000) continue;
          bytes += b64.length();
          for (JSONObject card : byUrl.get(en.getKey())) card.put("imageDataUrl", "data:image/jpeg;base64," + b64);
        }
        pool.shutdownNow();
      } catch (Exception e) { android.util.Log.w("CamMicGoLinkedIn", "Reader thumbnails", e); }
      // Every person read is saved in batches first; the final answer may then shed people to fit the relay
      // limit (the server merges the batches back), keeping the ones that have a thumbnail.
      if (id.equals(liProgressJob)) try {
        JSONObject frx = data.optJSONObject("reactions");
        JSONArray fp = frx == null ? null : frx.optJSONArray("people");
        if (fp != null) { JSONArray slim = new JSONArray(); for (int i = 0; i < fp.length(); i++) { JSONObject p = fp.optJSONObject(i); if (p == null) continue; JSONObject q = new JSONObject(); for (String f : new String[]{"name", "profileUrl", "headline", "reaction", "photoUrl"}) if (p.has(f) && !p.isNull(f)) q.put(f, p.opt(f)); slim.put(q); } liAddPeople(slim); }
      } catch (Exception ignored) {}
      liFlushBatches(id);
      liFitFinal(data, id.equals(liProgressJob));
      ui.post(() -> finishLinkedInJob(id, data, null));
    });
  }

  private static void liFitFinal(JSONObject data, boolean batched) {
    try {
      if (data.toString().length() <= 240000) return;
      JSONObject rx = data.optJSONObject("reactions");
      JSONArray people = rx == null ? null : rx.optJSONArray("people");
      if (people != null && batched) {
        JSONArray keep = new JSONArray();
        for (int i = 0; i < people.length(); i++) { JSONObject p = people.optJSONObject(i); if (p != null && p.has("imageDataUrl")) keep.put(p); }
        rx.put("people", keep); rx.put("savedInBatches", true);
      }
      // Reaction people's thumbnails go first (the server shows their photos from the batches); comment
      // authors keep theirs.
      JSONArray left = rx == null ? null : rx.optJSONArray("people");
      for (int i = 0; left != null && i < left.length() && data.toString().length() > 240000; i++) { JSONObject p = left.optJSONObject(i); if (p != null) p.remove("imageDataUrl"); }
      for (JSONObject c : liAllCards(data)) { if (data.toString().length() <= 240000) break; c.remove("imageDataUrl"); }
      if (data.toString().length() > 240000 && people != null && batched) rx.put("people", new JSONArray());
    } catch (Exception ignored) {}
  }

  private static java.util.List<JSONObject> liAllCards(JSONObject data) { java.util.List<JSONObject> out = new java.util.ArrayList<>(); collectLiCards(data, out, 0); return out; }

  /** People-like objects anywhere in a reader result (posts, comments, reaction people), a few levels deep. */
  private static void collectLiCards(Object node, java.util.List<JSONObject> out, int depth) {
    if (depth > 4 || node == null) return;
    if (node instanceof JSONArray) { JSONArray a = (JSONArray) node; for (int i = 0; i < a.length(); i++) collectLiCards(a.opt(i), out, depth + 1); return; }
    if (!(node instanceof JSONObject)) return;
    JSONObject o = (JSONObject) node;
    if (o.has("photoUrl") || o.has("authorPhotoUrl")) out.add(o);
    for (String k : new String[]{"posts", "people", "comments", "reactions", "post", "candidates"}) collectLiCards(o.opt(k), out, depth + 1);
  }

  /** 64 px JPEG of a LinkedIn image (licdn.com only), base64, or null. */
  private static String linkedInThumbnail(String url, String cookie, String agent) {
    java.net.HttpURLConnection conn = null;
    try {
      android.net.Uri uri = android.net.Uri.parse(url);
      String host = uri.getHost();
      if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || !(host.endsWith(".licdn.com") || host.endsWith(".linkedin.com"))) return null;
      conn = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
      conn.setConnectTimeout(5000); conn.setReadTimeout(8000);
      conn.setRequestProperty("User-Agent", agent);
      if (cookie != null) conn.setRequestProperty("Cookie", cookie);
      if (conn.getResponseCode() != 200) return null;
      java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
      try (java.io.InputStream in = conn.getInputStream()) {
        byte[] buffer = new byte[8192]; int n;
        while ((n = in.read(buffer)) != -1) { bytes.write(buffer, 0, n); if (bytes.size() > 600_000) return null; }
      }
      android.graphics.Bitmap original = android.graphics.BitmapFactory.decodeByteArray(bytes.toByteArray(), 0, bytes.size());
      if (original == null) return null;
      android.graphics.Bitmap square = android.graphics.Bitmap.createBitmap(64, 64, android.graphics.Bitmap.Config.ARGB_8888);
      android.graphics.Canvas canvas = new android.graphics.Canvas(square);
      canvas.drawColor(Color.WHITE);  // transparent logos stay readable
      float scale = Math.min(64f / original.getWidth(), 64f / original.getHeight());
      int w = Math.round(original.getWidth() * scale), h = Math.round(original.getHeight() * scale);
      canvas.drawBitmap(original, null, new android.graphics.Rect((64 - w) / 2, (64 - h) / 2, (64 - w) / 2 + w, (64 - h) / 2 + h), new android.graphics.Paint(android.graphics.Paint.FILTER_BITMAP_FLAG));
      original.recycle();
      java.io.ByteArrayOutputStream jpeg = new java.io.ByteArrayOutputStream();
      square.compress(android.graphics.Bitmap.CompressFormat.JPEG, 70, jpeg);
      square.recycle();
      return jpeg.size() <= 10_000 ? android.util.Base64.encodeToString(jpeg.toByteArray(), android.util.Base64.NO_WRAP) : null;
    } catch (Exception e) {
      return null;
    } finally { if (conn != null) conn.disconnect(); }
  }

  /** Counter on the stop button: reactions read / LinkedIn's total (or comments read). */
  /** Keeps the latest known counters (each reader message carries only part of them) and draws the panel. */
  private void liTrackCounts(JSONObject prog) {
    if (prog == null) return;
    if (prog.has("commentsVisible")) liCommentsRead = Math.max(liCommentsRead, prog.optInt("commentsVisible"));
    if (prog.has("commentsRead")) liCommentsRead = prog.optInt("commentsRead");
    if (prog.has("commentsExpected") && !prog.isNull("commentsExpected")) liCommentsTotal = prog.optInt("commentsExpected");
    if (prog.has("reactionsRead")) liReactionsRead = Math.max(liReactionsRead, prog.optInt("reactionsRead"));
    if (prog.has("expectedTotal") && !prog.isNull("expectedTotal")) liReactionsTotal = prog.optInt("expectedTotal");
    if (prog.has("stage")) liStage = prog.optString("stage");
    liDrawCounts();
  }
  private void liDrawCounts() {
    if (liProgressPanel == null) return;
    if (liProgressJob == null) { liProgressPanel.setVisibility(View.GONE); liProgressNotify(null, 0, 0); return; }
    liProgressPanel.setVisibility(View.VISIBLE);
    int received = liLastPeople == null ? 0 : liLastPeople.length(), saved;
    synchronized (this) { saved = liSentPeople.size(); }
    int rx = Math.max(liReactionsRead, received);
    liCommentsText.setText(I18n.t(this, "li_progress_comments", liCommentsRead, liCommentsTotal < 0 ? "?" : String.valueOf(liCommentsTotal)));
    liCommentsBar.setProgress(liCommentsTotal > 0 ? Math.min(1000, liCommentsRead * 1000 / liCommentsTotal) : 0);
    liReactionsText.setText(I18n.t(this, "li_progress_reactions", rx, liReactionsTotal < 0 ? "?" : String.valueOf(liReactionsTotal), saved));
    liReactionsBar.setProgress(liReactionsTotal > 0 ? Math.min(1000, rx * 1000 / liReactionsTotal) : 0);
    liReactionsBar.setSecondaryProgress(liReactionsTotal > 0 ? Math.min(1000, saved * 1000 / liReactionsTotal) : 0);
    liProgressNotify(liCommentsText.getText() + " · " + liReactionsText.getText(), rx, liReactionsTotal);
  }
  private long liNotifiedAt = 0;
  /** The same counters in an ongoing notification, so they can be followed from any other app. */
  private void liProgressNotify(String text, int done, int total) {
    try {
      android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
      if (nm == null) return;
      if (text == null) { nm.cancel(43); liNotifiedAt = 0; return; }
      long now = System.currentTimeMillis();
      if (now - liNotifiedAt < 2000) return;
      liNotifiedAt = now;
      android.app.Notification.Builder b;
      if (android.os.Build.VERSION.SDK_INT >= 26) {
        if (nm.getNotificationChannel(RelayService.CHANNEL) == null) nm.createNotificationChannel(new android.app.NotificationChannel(RelayService.CHANNEL, I18n.t(this, "channel"), android.app.NotificationManager.IMPORTANCE_LOW));
        b = new android.app.Notification.Builder(this, RelayService.CHANNEL);
      } else b = new android.app.Notification.Builder(this);
      Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
      b.setSmallIcon(android.R.drawable.stat_sys_download).setContentTitle("LinkedIn").setContentText(text)
        .setStyle(new android.app.Notification.BigTextStyle().bigText(text)).setOngoing(true).setOnlyAlertOnce(true)
        .setContentIntent(android.app.PendingIntent.getActivity(this, 43, open, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE))
        .setProgress(total > 0 ? 1000 : 0, total > 0 ? Math.min(1000, done * 1000 / total) : 0, total <= 0);
      nm.notify(43, b.build());
    } catch (Exception ignored) {}
  }
  /** The same counters, sent to the server with every progress message (read by linkedin_job_status). */
  private JSONObject liCountsJson() throws Exception {
    int received = liLastPeople == null ? 0 : liLastPeople.length(), saved;
    synchronized (this) { saved = liSentPeople.size(); }
    JSONObject o = new JSONObject();
    o.put("stage", liStage).put("commentsRead", liCommentsRead).put("commentsTotal", liCommentsTotal < 0 ? JSONObject.NULL : liCommentsTotal)
      .put("reactionsRead", Math.max(liReactionsRead, received)).put("reactionsSaved", saved).put("reactionsTotal", liReactionsTotal < 0 ? JSONObject.NULL : liReactionsTotal);
    return o;
  }
  private void liShowProgress(JSONObject prog) {
    liTrackCounts(prog);
    if (linkedinStopButton == null || linkedinStopButton.getVisibility() != View.VISIBLE || liStopRequested) return;
    String count = prog.has("reactionsRead") ? I18n.t(this, "li_reactions_count", prog.optInt("reactionsRead"), prog.isNull("expectedTotal") || !prog.has("expectedTotal") ? "?" : String.valueOf(prog.optInt("expectedTotal")))
      : prog.has("commentsRead") ? I18n.t(this, "li_comments_count", prog.optInt("commentsRead")) : "";
    linkedinStopButton.setText(I18n.t(this, "li_stop_report") + (count.isEmpty() ? "" : " · " + count));
  }

  /**
   * Progressive save of a post extraction: every 50 new people go to the server as a batch (kept with the
   * report, merged back at the end, so a capped final answer loses nobody). At least every 15 s a small
   * progress message (comments, counters) is sent; its answer says whether the assistant asked to stop.
   */
  private void liUploadProgress(String id, JSONObject snapshot, JSONObject prog) {
    long now = System.currentTimeMillis();
    // A request that never came back (network lost) must not freeze every later upload.
    if (liUploadBusy && now - liUploadBusySince > 90000) liUploadBusy = false;
    if (id == null || !id.equals(liProgressJob) || liUploadBusy) return;
    JSONArray batch = liUnsentPeople(liLastPeople, 100);
    boolean sendBatch = batch.length() >= 50;
    // Every 5 s at least, so an assistant checking the job sees the counters move.
    if (!sendBatch && now - liLastUpload < 5000) return;
    liUploadBusy = true; liLastUpload = now; liUploadBusySince = now;
    JSONObject body = new JSONObject();
    final int seq = liBatchSeq;
    try {
      body.put("id", id); body.put("progress", true);
      JSONObject counts = prog == null ? new JSONObject() : new JSONObject(prog.toString());
      // What the phone itself knows, shown by linkedin_job_status while the read goes on.
      JSONObject phone = new JSONObject();
      int received = liLastPeople == null ? 0 : liLastPeople.length(), saved;
      synchronized (this) { saved = liSentPeople.size(); }
      phone.put("reactionsReceived", received).put("reactionsSaved", saved).put("waitingInPage", liQueuedInPage).put("uploadsOk", liUploadsOk).put("uploadsFailed", liUploadsFailed).put("batches", liBatchSeq).put("lastUploadError", liUploadError).put("at", now);
      counts.put("phone", phone);
      counts.put("counters", liCountsJson());
      body.put("counts", counts);
      if (snapshot != null) { JSONObject cs = compactSnapshot(snapshot); JSONObject crx = cs.optJSONObject("reactions"); if (crx != null) { crx.put("savedInBatches", saved); crx.put("retrieved", received); } body.put("result", cs); }
      if (sendBatch) { body.put("batch", batch); body.put("seq", seq); }
      // Over the relay limit, the batch matters more than the snapshot (the comments are re-sent at the end).
      if (body.toString().length() > 240000) body.remove("result");
    } catch (Exception ignored) {}
    liUploadWorker.execute(() -> {
      boolean stop = false, sent = false; String err = "";
      try {
        JSONObject res = new JSONObject(RelayClient.request("POST", "/api/devices/linkedin", RelayClient.token(this), body.toString()));
        stop = res.optBoolean("stop"); sent = true;
      } catch (Exception e) { err = String.valueOf(e.getMessage()); android.util.Log.w("CamMicGoLinkedIn", "Progress upload failed", e); }
      boolean s2 = stop, ok = sent; String e2 = err;
      ui.post(() -> {
        liUploadBusy = false;
        if (ok) { liUploadsOk++; } else { liUploadsFailed++; liUploadError = e2.length() > 160 ? e2.substring(0, 160) : e2; }
        if (ok && sendBatch) ui.post(this::liDrawCounts);
        if (ok && sendBatch) { liBatchSeq = seq + 1; synchronized (MainActivity.this) { for (int i = 0; i < batch.length(); i++) liSentPeople.add(liPersonKey(batch.optJSONObject(i))); } }
        if (s2 && !liStopRequested) { liStopRequested = true; if (linkedinStopButton != null) { linkedinStopButton.setEnabled(false); linkedinStopButton.setText(I18n.t(this, "li_stopping")); } }
      });
    });
  }

  private static String liPersonKey(JSONObject p) {
    if (p == null) return "";
    String u = p.optString("profileUrl", "").split("[?#]")[0].replaceAll("/+$", "").toLowerCase(java.util.Locale.ROOT);
    return u.isEmpty() ? "name:" + p.optString("name", "").trim().toLowerCase(java.util.Locale.ROOT) : u;
  }

  /** People of the list not yet saved on the server (name, link, headline, reaction, photo link only). */
  private synchronized JSONArray liUnsentPeople(JSONArray people, int max) {
    JSONArray out = new JSONArray();
    if (people == null) return out;
    for (int i = 0; i < people.length() && out.length() < max; i++) {
      JSONObject p = people.optJSONObject(i);
      String k = liPersonKey(p);
      if (p == null || k.equals("name:") || liSentPeople.contains(k)) continue;
      JSONObject q = new JSONObject();
      try { for (String f : new String[]{"name", "profileUrl", "headline", "reaction", "photoUrl"}) if (p.has(f) && !p.isNull(f)) q.put(f, p.opt(f)); } catch (Exception ignored) {}
      out.put(q);
    }
    return out;
  }

  /** Before the final answer: the people not saved yet go up in batches (runs on the worker thread). */
  private void liFlushBatches(String id) {
    if (id == null || !id.equals(liProgressJob) || liLastPeople == null) return;
    for (int guard = 0; guard < 200; guard++) {
      JSONArray batch = liUnsentPeople(liLastPeople, 100);
      if (batch.length() == 0) return;
      try {
        JSONObject body = new JSONObject().put("id", id).put("progress", true).put("batch", batch).put("seq", liBatchSeq);
        RelayClient.request("POST", "/api/devices/linkedin", RelayClient.token(this), body.toString());
        liBatchSeq++;
        synchronized (this) { for (int i = 0; i < batch.length(); i++) liSentPeople.add(liPersonKey(batch.optJSONObject(i))); }
      } catch (Exception e) { android.util.Log.w("CamMicGoLinkedIn", "Batch flush failed", e); return; }
    }
  }

  /** The snapshot without duplicate image links, kept under the relay size limit (people trimmed last). */
  private static JSONObject compactSnapshot(JSONObject snap) {
    try {
      JSONObject out = new JSONObject(snap.toString());
      out.put("status", "partial"); out.put("inProgress", true);
      JSONObject rx = out.optJSONObject("reactions");
      JSONArray people = rx == null ? null : rx.optJSONArray("people");
      if (people != null && people.length() > 0) { rx.put("savedInBatches", people.length()); rx.put("people", new JSONArray()); people = null; }
      if (people != null) {
        JSONArray slim = new JSONArray();
        for (int i = 0; i < people.length(); i++) {
          JSONObject p = people.optJSONObject(i); if (p == null) continue;
          JSONObject q = new JSONObject();
          for (String k : new String[]{"name", "profileUrl", "headline", "reaction", "photoUrl"}) if (p.has(k) && !p.isNull(k)) q.put(k, p.opt(k));
          slim.put(q);
        }
        rx.put("people", slim);
        while (out.toString().length() > 230000 && slim.length() > 0) { slim.remove(slim.length() - 1); rx.put("truncated", true); }
      }
      return out;
    } catch (Exception e) { return new JSONObject(); }
  }

  private void finishLinkedInJs(String id, String raw) {
    try {
      String decoded = new JSONArray("[" + raw + "]").getString(0);
      finishLinkedInJob(id, new JSONObject(decoded), null);
    } catch (Exception e) { finishLinkedInJob(id, null, e.getMessage()); }
  }

  private void finishLinkedInJob(String id, JSONObject result, String error) {
    if (id != null && !id.isEmpty()) { if (liFinishedJobs.contains(id)) return; liFinishedJobs.add(id); }
    // The page must not go on reading for a job that is over (it would scroll for nothing).
    if (linkedinWeb != null && id != null && id.equals(liProgressJob)) linkedinWeb.evaluateJavascript("window.__cmgLiStop=true;", null);
    if (liStopRequested && result != null) { try { result.put("stoppedByUser", true); if ("ok".equals(result.optString("status"))) result.put("status", "partial"); } catch (Exception ignored) {} }
    liStopRequested = false; liStopAt = 0; liProgressJob = null; liUploadedPeople = -1; liLastUpload = 0;
    if (linkedinStopButton != null) linkedinStopButton.setVisibility(View.GONE);
    if (liProgressPanel != null) liProgressPanel.setVisibility(View.GONE);
    liProgressNotify(null, 0, 0);
    String extractionStatus = result == null ? "" : result.optString("status");
    recordLinkedInActivity(id, "", error != null || "timeout".equals(extractionStatus) || "failed".equals(extractionStatus) ? "failed" : "partial".equals(extractionStatus) ? "partial" : "done", error == null ? "" : error, "");
    if (id != null && id.equals(linkedinBusyJob)) linkedinBusyJob = null;
    linkedinPollBusy = false;
    worker.execute(() -> {
      try {
        JSONObject body = new JSONObject();
        body.put("id", id);
        if (error != null) body.put("error", error);
        // Diagnostics travel with failures too (what LinkedIn showed), never file contents.
        if (result != null) body.put("result", result);
        RelayClient.request("POST", "/api/devices/linkedin", RelayClient.token(this), body.toString());
      } catch (Exception e) { android.util.Log.w("CamMicGoLinkedIn", "Relay result failed", e); }
    });
  }

  /** Recipient (or search words) and file name shown in the activity list; never message text. */
  private void liExtras(String id, String target, String file) {
    try {
      SharedPreferences prefs = RelayClient.prefs(this);
      JSONArray list = new JSONArray(prefs.getString("linkedinAssistantHistory", "[]"));
      for (int i = 0; i < list.length(); i++) {
        JSONObject o = list.optJSONObject(i);
        if (o == null || !id.equals(o.optString("id"))) continue;
        if (target != null && !target.isEmpty()) o.put("target", target.length() > 80 ? target.substring(0, 80) : target);
        if (file != null && !file.isEmpty()) o.put("file", file);
      }
      prefs.edit().putString("linkedinAssistantHistory", list.toString()).apply();
      ui.post(() -> { historyShown = null; if (historyList != null) refreshHistory(prefs); });
    } catch (Exception ignored) {}
  }
  /** Current step of a running job, shown live in the activity list. */
  private void liStep(String id, String step) {
    // Progress is shown as a step of a running job; only finishLinkedInJob decides done or failed.
    String known = step != null && step.matches("[a-z_]{3,20}") ? step : "running";
    recordLinkedInActivity(id, "", known, "", "");
  }

  /** Only operation metadata is retained, never LinkedIn messages or credentials. */
  private void recordLinkedInActivity(String id, String operation, String status, String error, String agentName) {
    if (id == null || id.isEmpty()) return;
    try {
      SharedPreferences prefs = RelayClient.prefs(this);
      JSONArray previous = new JSONArray(prefs.getString("linkedinAssistantHistory", "[]"));
      JSONArray updated = new JSONArray();
      JSONObject item = new JSONObject();
      for (int i = 0; i < previous.length(); i++) {
        JSONObject old = previous.optJSONObject(i);
        if (old == null) continue;
        if (id.equals(old.optString("id"))) item = old;
        else if (updated.length() < 29) updated.put(old);
      }
      item.put("id", id);
      if (!operation.isEmpty()) item.put("operation", operation);
      if (agentName != null && !agentName.isEmpty()) item.put("agentName", agentName);
      item.put("status", status);
      item.put("error", error);
      item.put("at", System.currentTimeMillis());
      updated.put(item);
      prefs.edit().putString("linkedinAssistantHistory", updated.toString()).apply();
      ui.post(() -> { historyShown = null; if (historyList != null) refreshHistory(prefs); });
    } catch (Exception e) { android.util.Log.w("CamMicGoLinkedIn", "Journal error", e); }
  }

  /** User-initiated local JSON export of the currently loaded conversation. */
  private void exportLinkedInThreadJson() {
    if (linkedinWeb == null || linkedinWeb.getUrl() == null ||
        !linkedinWeb.getUrl().startsWith("https://www.linkedin.com/")) {
      Toast.makeText(this, "Ouvrez une conversation ou un profil LinkedIn.", Toast.LENGTH_LONG).show();
      return;
    }
    // Keep each image on its original message, and distinguish author avatars from attachments.
    String js = "(function(){const nodes=[...document.querySelectorAll('li[class*=message],[class*=msg-s-event-listitem],[class*=message-event]')];const img=i=>({url:i.currentSrc||i.src||'',alt:i.alt||'',role:'attachment'});const messages=nodes.map((n,index)=>({index,text:(n.innerText||'').trim().slice(0,8000),timestamp:n.querySelector('time')?.getAttribute('datetime')||null,author:(n.querySelector('[class*=actor-name],[class*=sender-name]')?.innerText||'').trim(),images:[...n.querySelectorAll('img')].map(img).filter(i=>i.url&&/messaging-image|licdn/i.test(i.url)).slice(0,20),files:[...n.querySelectorAll('a[download]')].map(a=>({name:(a.innerText||'').trim(),url:a.href})).slice(0,20)})).filter(m=>m.text||m.images.length||m.files.length);const header=document.querySelector('[class*=conversation-header],h2,h3');const profile=location.pathname.includes('/in/');const avatars=[...document.querySelectorAll(profile?'main img[class*=profile],main img[class*=photo],main img[class*=avatar]':'[class*=conversation-header] img')].slice(0,10).map(i=>({url:i.currentSrc||i.src||'',alt:i.alt||'',role:'profile'})).filter(i=>i.url);return JSON.stringify({format:'cammicgo-linkedin-multimodal-v2',url:location.href,kind:profile?'profile':'conversation',participant:(header?.innerText||'').trim().slice(0,250),avatars,messages,loadedMessages:messages.length,partial:true,exportedAt:new Date().toISOString()});})()";
    linkedinWeb.evaluateJavascript(js, raw -> {
      try {
        JSONObject data = new JSONObject(new JSONArray("[" + raw + "]").getString(0));
        JSONArray messages = data.optJSONArray("messages");
        JSONArray avatars = data.optJSONArray("avatars");
        if ((messages == null || messages.length() == 0) && (avatars == null || avatars.length() == 0)) {
          Toast.makeText(this, "Aucune donnée chargée à exporter.", Toast.LENGTH_LONG).show();
          return;
        }
        new AlertDialog.Builder(this).setTitle("Export multimodal LinkedIn")
          .setMessage("Inclure les images accessibles en Base64 dans le JSON ? Les images indisponibles garderont leur URL et leur statut. L'export contient uniquement les éléments chargés à l'écran.")
          .setNegativeButton("Annuler", null)
          .setPositiveButton("Enregistrer", (dialog, which) -> buildLinkedInMultimodalExport(data, false))
          .show();
      } catch (Exception e) { Toast.makeText(this, "Export JSON impossible : " + e.getMessage(), Toast.LENGTH_LONG).show(); }
    });
  }

  /** Download bounded image data on a worker thread; never put LinkedIn cookies in the export. */
  private void buildLinkedInMultimodalExport(JSONObject data, boolean share) {
    final String cookie = CookieManager.getInstance().getCookie("https://www.linkedin.com/");
    final String agent = linkedinWeb.getSettings().getUserAgentString();
    Toast.makeText(this, "Préparation des images de l'export…", Toast.LENGTH_SHORT).show();
    worker.execute(() -> {
      try {
        java.util.HashMap<String, JSONObject> cache = new java.util.HashMap<>();
        int[] remaining = {24};
        embedLinkedInImageArray(data.optJSONArray("avatars"), cookie, agent, cache, remaining);
        JSONArray messages = data.optJSONArray("messages");
        if (messages != null) for (int i = 0; i < messages.length(); i++)
          embedLinkedInImageArray(messages.optJSONObject(i) == null ? null : messages.optJSONObject(i).optJSONArray("images"), cookie, agent, cache, remaining);
        data.put("imageEncoding", "data-uri-base64");
        data.put("embeddedImages", cache.size());
        String content = data.toString();
        ui.post(() -> {
          if (share) shareLinkedInMultimodalJson(content);
          else save(content, "application/json", "linkedin-multimodal-" + System.currentTimeMillis() + ".json");
        });
      } catch (Exception e) {
        ui.post(() -> Toast.makeText(this, "Export multimodal impossible : " + e.getMessage(), Toast.LENGTH_LONG).show());
      }
    });
  }

  private void embedLinkedInImageArray(JSONArray images, String cookie, String agent,
      java.util.HashMap<String, JSONObject> cache, int[] remaining) throws org.json.JSONException {
    if (images == null) return;
    for (int i = 0; i < images.length(); i++) {
      JSONObject image = images.optJSONObject(i);
      if (image == null) continue;
      String url = image.optString("url", "");
      if (cache.containsKey(url)) {
        JSONObject existing = cache.get(url);
        image.put("status", existing.optString("status"));
        if (existing.has("dataUri")) image.put("dataUri", existing.optString("dataUri"));
        if (existing.has("mimeType")) image.put("mimeType", existing.optString("mimeType"));
        continue;
      }
      JSONObject result = new JSONObject();
      String status = "unavailable";
      if (remaining[0] <= 0) status = "limit_reached";
      else {
        Uri parsed = Uri.parse(url);
        String host = parsed.getHost();
        if ("https".equalsIgnoreCase(parsed.getScheme()) && host != null &&
            (host.equals("linkedin.com") || host.endsWith(".linkedin.com") ||
             host.equals("licdn.com") || host.endsWith(".licdn.com"))) {
          remaining[0]--;
          java.net.HttpURLConnection connection = null;
          try {
            connection = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(15000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("User-Agent", agent);
            connection.setRequestProperty("Referer", "https://www.linkedin.com/");
            if (cookie != null) connection.setRequestProperty("Cookie", cookie);
            if (connection.getResponseCode() == 200) {
              String mime = connection.getContentType();
              if (mime != null) mime = mime.split(";")[0].trim().toLowerCase(java.util.Locale.ROOT);
              if ("image/jpeg".equals(mime) || "image/png".equals(mime) ||
                  "image/webp".equals(mime) || "image/gif".equals(mime)) {
                if (connection.getContentLengthLong() > 2_000_000L) status = "too_large";
                else {
                  java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
                  try (java.io.InputStream in = connection.getInputStream()) {
                    byte[] buffer = new byte[8192];
                    int n;
                    while ((n = in.read(buffer)) != -1) {
                      if (bytes.size() + n > 2_000_000) { status = "too_large"; break; }
                      bytes.write(buffer, 0, n);
                    }
                  }
                  if (bytes.size() > 0 && !"too_large".equals(status)) {
                    result.put("dataUri", "data:" + mime + ";base64," +
                        android.util.Base64.encodeToString(bytes.toByteArray(), android.util.Base64.NO_WRAP));
                    result.put("mimeType", mime);
                    status = "embedded";
                  }
                }
              }
            }
          } catch (Exception ignored) {
            status = "unavailable";
          } finally { if (connection != null) connection.disconnect(); }
        }
      }
      result.put("status", status);
      cache.put(url, result);
      image.put("status", status);
      if (result.has("dataUri")) image.put("dataUri", result.optString("dataUri"));
      if (result.has("mimeType")) image.put("mimeType", result.optString("mimeType"));
    }
  }

  private void shareLinkedInMultimodalJson(String content) {
    worker.execute(() -> {
      try {
        java.io.File dir = new java.io.File(getCacheDir(), "linkedin-shared");
        if (!dir.exists() && !dir.mkdirs()) throw new java.io.IOException("Cache unavailable");
        java.io.File file = new java.io.File(dir, "linkedin-multimodal-" + System.currentTimeMillis() + ".json");
        try (java.io.FileOutputStream out = new java.io.FileOutputStream(file)) {
          out.write(content.getBytes(StandardCharsets.UTF_8));
        }
        Uri uri = androidx.core.content.FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", file);
        ui.post(() -> {
          Intent send = new Intent(Intent.ACTION_SEND);
          send.setType("application/json");
          send.putExtra(Intent.EXTRA_STREAM, uri);
          send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          startActivity(Intent.createChooser(send, "Partager l'export multimodal"));
        });
      } catch (Exception e) {
        ui.post(() -> Toast.makeText(this, "Partage JSON impossible : " + e.getMessage(), Toast.LENGTH_LONG).show());
      }
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
    boolean fr = I18n.code(this).equals("fr");
    // Same toolbar as LinkedIn: [expand] [Notebooks] [Sources] [refresh] [browser]
    LinearLayout actions=toolbarRow();
    android.widget.ImageButton expand = iconButton(UiIcons.Kind.EXPAND, fr ? "Agrandir" : "Expand");
    notebookExpand = expand;
    Button notebooks=toolButton("Notebooks", UiIcons.Kind.BOOK);
    Button sources=toolButton("Sources", UiIcons.Kind.PLUS);
    android.widget.ImageButton reload=iconButton(UiIcons.Kind.REFRESH, fr ? "Actualiser" : "Refresh");
    android.widget.ImageButton chrome=iconButton(UiIcons.Kind.BROWSER, fr ? "Ouvrir dans le navigateur" : "Open in browser");
    actions.addView(expand, toolLp(dp(40),0,false));
    actions.addView(notebooks, toolLp(0,1,true));
    actions.addView(sources, toolLp(0,1,true));
    actions.addView(reload, toolLp(dp(40),0,true));
    actions.addView(chrome, toolLp(dp(40),0,true));
    notebookActions = actions;
    root.addView(actions, new LinearLayout.LayoutParams(-1,-2));
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
    if (notebookExpand != null) {
      String d = I18n.code(this).equals("fr") ? (expanded ? "Réduire" : "Agrandir") : (expanded ? "Collapse" : "Expand");
      notebookExpand.setImageDrawable(UiIcons.make(expanded ? UiIcons.Kind.COLLAPSE : UiIcons.Kind.EXPAND, expanded ? Color.WHITE : BLUE, dp(20)));
      notebookExpand.setBackground(expanded ? shape(BLUE, 12, 0) : toolBackground(TOOL_FILL, TOOL_LINE));
      notebookExpand.setContentDescription(d);
      if (android.os.Build.VERSION.SDK_INT >= 26) notebookExpand.setTooltipText(d);
    }
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
    Button langBtn = withIcon(secondary(I18n.NAMES[I18n.index(this)]), UiIcons.Kind.BROWSER, BLUE);
    langBtn.setOnClickListener(v -> pickLanguage());
    lc.addView(langBtn);

    section(root, t("sec_tips"));
    LinearLayout tips = card(root);
    tip(tips, UiIcons.Kind.BATTERY, t("tip_batt_t"), t("tip_batt"));
    Button battery = secondary(t("battery_btn"));
    battery.setOnClickListener(v -> {
      try { startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); }
      catch (Exception e) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
    });
    tips.addView(battery, gapTop(4));
    tip(tips, UiIcons.Kind.PHONE, t("tip_awake_t"), t("tip_awake"));
    tip(tips, UiIcons.Kind.REFRESH, t("tip_resume_t"), t("tip_resume"));
    tip(tips, UiIcons.Kind.SHIELD, t("tip_a15_t"), t("tip_a15"));

    TextView versionBanner = text(root, "CamMicGo SEO MCP — VERSION INSTALLÉE : " + version(), 17, BLUE, true);
    versionBanner.setPadding(dp(12), dp(14), dp(12), dp(14));
    versionBanner.setContentDescription("Version installée de CamMicGo SEO MCP : " + version());
    TextView v = text(root, "CamMicGo SEO MCP · " + t("version") + " " + version() + " · seo.cammicgo.com", 12, MUTED, false);
    v.setGravity(Gravity.CENTER);
    v.setPadding(0, dp(6), 0, 0);
  }

  private void tip(LinearLayout parent, UiIcons.Kind icon, String title, String body) {
    LinearLayout row = new LinearLayout(this);
    row.setPadding(0, dp(8), 0, dp(8));
    android.widget.ImageView i = new android.widget.ImageView(this);
    i.setImageDrawable(UiIcons.make(icon, BLUE, dp(20)));
    i.setScaleType(android.widget.ImageView.ScaleType.CENTER);
    i.setBackground(shape(Color.rgb(236, 242, 254), 10, 0));
    LinearLayout.LayoutParams ilp = new LinearLayout.LayoutParams(dp(34), dp(34));
    ilp.setMarginEnd(dp(12));
    row.addView(i, ilp);
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

  /** Refresh only sanitized MCP request metadata; no secrets or tool arguments. */
  private void fetchMcpDebugHistory() {
    if (!RelayClient.isPaired(this) || System.currentTimeMillis() - lastMcpDebugFetch < 30000L) return;
    lastMcpDebugFetch = System.currentTimeMillis();
    worker.execute(() -> {
      try {
        String raw = RelayClient.request("GET", "/api/devices/mcp-debug", RelayClient.token(this), null);
        JSONArray all = new JSONObject(raw).optJSONArray("calls");
        if (all == null) return;
        // The server keeps the last calls: those from before "Clear the list" are not shown again.
        long clearedAt = RelayClient.prefs(this).getLong("mcpDebugClearedAt", 0L);
        JSONArray calls = new JSONArray();
        for (int i = 0; i < all.length(); i++) {
          JSONObject c = all.optJSONObject(i);
          if (c == null) continue;
          long at; try { at = Instant.parse(c.optString("at")).toEpochMilli(); } catch (Exception e) { at = Long.MAX_VALUE; }
          if (at > clearedAt && !RelayClient.prefs(this).getString("mcpDebugHidden", "[]").contains("\"" + c.optString("at") + "\"")) calls.put(c);
        }
        RelayClient.prefs(this).edit().putString("mcpDebugHistory", calls.toString()).apply();
        ui.post(() -> { historyShown = null; refreshHistory(RelayClient.prefs(this)); });
      } catch (Exception ignored) { /* Debug history is best-effort. */ }
    });
  }

  private void refreshRelay() {
    if (statusLine == null) return;
    fetchMcpDebugHistory();
    SharedPreferences p = RelayClient.prefs(this);
    boolean paired = RelayClient.isPaired(this);
    long now = System.currentTimeMillis();
    long syncAge = now - p.getLong("lastSync", 0L);
    long startAge = now - p.getLong("startRequestedAt", 0L);
    boolean serviceRunning = paired && p.getBoolean("connected", false);
    boolean connected = serviceRunning && syncAge >= 0 && syncAge < 30000L;
    boolean starting = paired && !connected && startAge >= 0 && startAge < 30000L;
    unpairedBox.setVisibility(paired ? View.GONE : View.VISIBLE);
    if (requestsTitle != null) { requestsTitle.setVisibility(paired ? View.VISIBLE : View.GONE); requestsCard.setVisibility(paired ? View.VISIBLE : View.GONE); }
    pairedBox.setVisibility(paired ? View.VISIBLE : View.GONE);

    int chipColor = !paired ? GREY : connected ? GREEN : starting ? AMBER : AMBER;
    chipDot.setBackground(dot(chipColor));
    chipText.setText(!paired ? t("chip_unpaired") : connected ? t("chip_connected") : starting ? "Démarrage…" : t("chip_stopped"));

    if (retryYoutubeButton != null) retryYoutubeButton.setVisibility(paired && (p.getBoolean("youtube429ManualPause", false) || p.getLong("youtubePausedUntil", 0L) > System.currentTimeMillis()) ? View.VISIBLE : View.GONE);
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
    refreshHistory(p);
  }

  private String linkedinHistoryShown;
  private void refreshLinkedInRequests(SharedPreferences prefs) {
    if (linkedinRequests == null) return;
    String raw = prefs.getString("linkedinAssistantHistory", "[]");
    if (raw.equals(linkedinHistoryShown)) return;
    linkedinHistoryShown = raw;
    linkedinRequests.removeAllViews();
    try {
      JSONArray jobs = new JSONArray(raw);
      if (jobs.length() == 0) {
        text(linkedinRequests, "Aucune tâche LinkedIn réceptionnée par cet appareil.", 12, MUTED, false);
        return;
      }
      for (int i = jobs.length() - 1; i >= 0 && i >= jobs.length() - 20; i--) {
        JSONObject job = jobs.optJSONObject(i);
        if (job == null) continue;
        String status = job.optString("status", "pending");
        String operation = job.optString("operation", "LinkedIn");
        TextView item = text(linkedinRequests, operation + " · " + status + " · " + job.optString("id"), 12, "failed".equals(status) ? RED : INK, false);
        item.setPadding(0, dp(5), 0, dp(5));
      }
    } catch (Exception e) {
      text(linkedinRequests, "Historique LinkedIn indisponible.", 12, RED, false);
    }
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
    long pausedUntil = p.getLong("youtubePausedUntil", 0L);
    boolean ytPaused = paired && (pausedUntil > System.currentTimeMillis() || p.getBoolean("youtube429ManualPause", false));
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
    if (waiting > 0 && ytPaused) note = fr() ? "Transcriptions suspendues par YouTube (429) : détail dans la liste ci-dessous." : "Transcripts paused by YouTube (429): details in the list below.";
    else if (waiting > 0 && !connected) note = t("stopped_resume");
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

  /** Translate persisted historical labels on display without changing their original data. */
  private String localizedOperation(String value) {
    if (value == null) return "";
    String out = value;
    String[][] labels = {
      {"Consulter un notebook", "Get notebook", "Consultar un cuaderno", "Notizbuch abrufen", "Consultar caderno", "Consulta notebook", "Открыть блокнот", "查看笔记本", "ノートブックを取得", "노트북 조회", "عرض دفتر الملاحظات"},
      {"Lister les notebooks", "List notebooks", "Listar cuadernos", "Notizbücher auflisten", "Listar cadernos", "Elenca notebook", "Список блокнотов", "列出笔记本", "ノートブック一覧", "노트북 목록", "قائمة دفاتر الملاحظات"},
      {"Créer un notebook", "Create notebook", "Crear cuaderno", "Notizbuch erstellen", "Criar caderno", "Crea notebook", "Создать блокнот", "创建笔记本", "ノートブックを作成", "노트북 생성", "إنشاء دفتر ملاحظات"},
      {"Ajouter une source", "Add source", "Añadir fuente", "Quelle hinzufügen", "Adicionar fonte", "Aggiungi fonte", "Добавить источник", "添加来源", "ソースを追加", "소스 추가", "إضافة مصدر"},
      {"Supprimer une source", "Delete source", "Eliminar fuente", "Quelle löschen", "Eliminar fonte", "Elimina fonte", "Удалить источник", "删除来源", "ソースを削除", "소스 삭제", "حذف مصدر"},
      {"Mettre à jour une source", "Update source", "Actualizar fuente", "Quelle aktualisieren", "Atualizar fonte", "Aggiorna fonte", "Обновить источник", "更新来源", "ソースを更新", "소스 업데이트", "تحديث مصدر"},
      {"Lister les sources", "List sources", "Listar fuentes", "Quellen auflisten", "Listar fontes", "Elenca fonti", "Список источников", "列出来源", "ソース一覧", "소스 목록", "قائمة المصادر"},
      {"Extraire une transcription", "Extract transcript", "Extraer transcripción", "Transkript extrahieren", "Extrair transcrição", "Estrai trascrizione", "Извлечь транскрипт", "提取字幕", "文字起こしを抽出", "전사 추출", "استخراج النص"},
      {"Extraire les transcriptions", "Extract transcripts", "Extraer transcripciones", "Transkripte extrahieren", "Extrair transcrições", "Estrai trascrizioni", "Извлечь транскрипты", "提取字幕", "文字起こしを抽出", "전사 추출", "استخراج النصوص"},
      {"demande", "request", "solicitud", "Anfrage", "pedido", "richiesta", "запрос", "请求", "リクエスト", "요청", "طلب"}
    };
    int lang = I18n.index(this);
    for (String[] label : labels) {
      // Match labels already stored in French or English; never translate URLs or IDs.
      out = out.replace(label[0], label[lang]).replace(label[1], label[lang]);
    }
    return out;
  }

  /** Label shared by the assistant activity button and its diagnostics dialog. */
  /** Compact LinkedIn toolbar translations in I18n.CODES order. */
  /** Native vector shield, consistent across Android fonts and locales (no lock emoji). */

  private String linkedinToolbarText(String key) {
    String[][] labels = {
      {"Expand LinkedIn","Agrandir LinkedIn","Ampliar LinkedIn","LinkedIn vergrößern","Ampliar LinkedIn","Espandi LinkedIn","Развернуть LinkedIn","展开 LinkedIn","LinkedInを拡大","LinkedIn 확대","توسيع لينكدإن"},
      {"Collapse LinkedIn","Réduire LinkedIn","Reducir LinkedIn","LinkedIn verkleinern","Reduzir LinkedIn","Riduci LinkedIn","Свернуть LinkedIn","收起 LinkedIn","LinkedInを縮小","LinkedIn 축소","تصغير لينكدإن"},
      {"Allow MCP","Autoriser MCP","Permitir MCP","MCP erlauben","Permitir MCP","Autorizza MCP","Разрешить MCP","授权 MCP","MCPを許可","MCP 허용","السماح لـ MCP"},
      {"✓ MCP allowed","✓ MCP autorisé","✓ MCP autorizado","✓ MCP erlaubt","✓ MCP autorizado","✓ MCP autorizzato","✓ MCP разрешён","✓ MCP 已授权","✓ MCP 許可済み","✓ MCP 허용됨","✓ MCP مسموح"},
      {"Export conversation or profile as JSON with images","Exporter la conversation ou le profil en JSON avec images","Exportar conversación o perfil a JSON con imágenes","Konversation oder Profil als JSON mit Bildern exportieren","Exportar conversa ou perfil em JSON com imagens","Esporta conversazione o profilo in JSON con immagini","Экспорт беседы или профиля в JSON с изображениями","将对话或个人资料及图片导出为 JSON","会話またはプロフィールを画像付きJSONで書き出す","대화 또는 프로필을 이미지 포함 JSON으로 내보내기","تصدير المحادثة أو الملف الشخصي بصيغة JSON مع الصور"},
      {"Allow or revoke LinkedIn MCP access","Autoriser ou révoquer l'accès MCP à LinkedIn","Permitir o revocar acceso MCP a LinkedIn","LinkedIn-MCP-Zugriff erlauben oder widerrufen","Permitir ou revogar acesso MCP ao LinkedIn","Autorizza o revoca accesso MCP a LinkedIn","Разрешить или отозвать доступ MCP к LinkedIn","允许或撤销 LinkedIn MCP 访问权限","LinkedIn MCPアクセスを許可または取り消す","LinkedIn MCP 접근 허용 또는 취소","السماح بوصول MCP إلى لينكدإن أو إلغاؤه"}
    };
    int index;
    switch (key) {
      case "expand": index=0; break;
      case "collapse": index=1; break;
      case "allow": index=2; break;
      case "allowed": index=3; break;
      case "export": index=4; break;
      default: index=5; break;
    }
    int lang=I18n.index(this);
    return labels[index][lang>=0 && lang<11 ? lang : 0];
  }


  private String localizedMcpDiagnosticTitle() {
    String[] labels = {
      "MCP request diagnostics", "Diagnostic des requêtes MCP",
      "Diagnóstico de solicitudes MCP", "MCP-Anfragendiagnose",
      "Diagnóstico de solicitações MCP", "Diagnostica richieste MCP",
      "Диагностика запросов MCP", "MCP 请求诊断",
      "MCPリクエスト診断", "MCP 요청 진단", "تشخيص طلبات MCP"
    };
    int index = I18n.index(this);
    return labels[index >= 0 && index < labels.length ? index : 0];
  }

  private String localizedJobStatus(String status) {
    String[] completed = {"Completed","Terminé","Completado","Abgeschlossen","Concluído","Completato","Завершено","已完成","完了","완료","مكتمل"};
    String[] failed = {"Failed","Échec","Error","Fehlgeschlagen","Falhou","Errore","Ошибка","失败","失敗","실패","فشل"};
    String[] pending = {"Pending","En attente","Pendiente","Ausstehend","Pendente","In attesa","Ожидание","等待中","保留中","대기 중","قيد الانتظار"};
    String[] working = {"In progress","En cours","En curso","In Bearbeitung","Em andamento","In corso","Выполняется","进行中","処理中","진행 중","قيد التنفيذ"};
    int lang = I18n.index(this);
    String[][] steps = {
      {"waiting", "Waiting for the app", "En attente de l'application", "Esperando la app", "Wartet auf die App", "Aguardando o app", "In attesa dell'app", "Ожидает приложение", "等待应用", "アプリ待ち", "앱 대기 중", "بانتظار التطبيق"},
      {"received", "Received by Android", "Reçue par Android", "Recibida por Android", "Von Android empfangen", "Recebida pelo Android", "Ricevuta da Android", "Получено Android", "Android 已接收", "Android が受信", "Android 수신", "استلمها Android"},
      {"opening", "Opening the conversation", "Ouverture de la conversation", "Abriendo la conversación", "Unterhaltung wird geöffnet", "Abrindo a conversa", "Apertura della conversazione", "Открытие беседы", "正在打开对话", "会話を開いています", "대화 여는 중", "فتح المحادثة"},
      {"downloading", "Downloading the file", "Téléchargement du fichier", "Descargando el archivo", "Datei wird geladen", "Baixando o arquivo", "Download del file", "Загрузка файла", "正在下载文件", "ファイルを取得中", "파일 다운로드 중", "تنزيل الملف"},
      {"attaching", "Attaching the file", "Ajout de la pièce jointe", "Adjuntando el archivo", "Anhang wird hinzugefügt", "Anexando o arquivo", "Aggiunta dell'allegato", "Прикрепление файла", "正在添加附件", "添付中", "첨부 중", "إرفاق الملف"},
      {"verifying", "Checking the attachment", "Vérification de la pièce jointe", "Comprobando el adjunto", "Anhang wird geprüft", "Verificando o anexo", "Verifica dell'allegato", "Проверка вложения", "正在检查附件", "添付を確認中", "첨부 확인 중", "التحقق من المرفق"},
      {"writing", "Writing the message", "Rédaction du message", "Escribiendo el mensaje", "Nachricht wird geschrieben", "Escrevendo a mensagem", "Scrittura del messaggio", "Ввод сообщения", "正在输入消息", "メッセージ入力中", "메시지 작성 중", "كتابة الرسالة"},
      {"sending", "Sending the message", "Envoi du message", "Enviando el mensaje", "Nachricht wird gesendet", "Enviando a mensagem", "Invio del messaggio", "Отправка сообщения", "正在发送消息", "送信中", "메시지 전송 중", "إرسال الرسالة"},
      {"expired", "Expired (never picked up)", "Expirée (jamais récupérée)", "Caducada (no recogida)", "Abgelaufen (nie abgeholt)", "Expirada (não recebida)", "Scaduta (mai ricevuta)", "Истекло (не получено)", "已过期（未接收）", "期限切れ（未受信）", "만료됨(수신 안 됨)", "منتهية (لم تُستلم)"}};
    for (String[] row : steps) if (row[0].equals(status)) return row[1 + Math.max(0, Math.min(10, lang))];
    if ("partial".equals(status)) return new String[]{"Partial","Partiel","Parcial","Teilweise","Parcial","Parziale","Частично","部分完成","一部完了","부분 완료","جزئي"}[lang];
    if ("done".equals(status) || "completed".equals(status)) return completed[lang];
    if ("failed".equals(status) || "error".equals(status)) return failed[lang];
    if ("pending".equals(status) || "queued".equals(status) || "received".equals(status)) return pending[lang];
    if ("working".equals(status) || "running".equals(status) || "in_progress".equals(status)) return working[lang];
    return status;
  }

  private void refreshHistory(SharedPreferences p) {
    String raw = p.getString("history", "[]");
    String notebookRaw = p.getString("assistantNotebookHistory", "[]");
    String mcpDebugRaw = p.getString("mcpDebugHistory", "[]");
    String linkedinRaw = p.getString("linkedinAssistantHistory", "[]");
    long minute = System.currentTimeMillis() / 60_000;
    String progressRaw = p.getString("progress", "");
    long ytPausedUntil = p.getLong("youtubePausedUntil", 0L);
    boolean ytManual = p.getBoolean("youtube429ManualPause", false);
    String key = I18n.code(this) + ":" + raw.hashCode() + ":" + notebookRaw.hashCode() + ":" + mcpDebugRaw.hashCode() + ":" + linkedinRaw.hashCode() + ":" + progressRaw.hashCode() + ":" + ytPausedUntil + ":" + ytManual + ":" + minute;
    if (key.equals(historyShown)) return;
    historyShown = key;
    historyList.removeAllViews();
    historyBoxes.clear();
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
        entry.put("key", "nb:" + n.optString("jobId") + ":" + n.optLong("at"));
        entry.put("title", n.optString("label", "NotebookLM"));
        entry.put("agentName", n.optString("agentName", ""));
        entry.put("status", "done".equals(n.optString("status")) ? "done" : n.optString("status"));
        entry.put("at", n.optLong("at"));
        entry.put("error", n.optString("error", ""));
        h.put(entry);
      }
      JSONArray linkedinJobs = new JSONArray(linkedinRaw);
      for (int i = 0; i < linkedinJobs.length(); i++) {
        JSONObject job = linkedinJobs.optJSONObject(i);
        if (job == null) continue;
        JSONObject entry = new JSONObject();
        entry.put("type", "linkedin_mcp");
        entry.put("key", "li:" + job.optString("id", ""));
        String target = job.optString("target", "");
        entry.put("title", "LinkedIn · " + job.optString("operation", "demande") + (target.isEmpty() ? "" : " · " + target));
        entry.put("file", job.optString("file", ""));
        entry.put("status", job.optString("status"));
        entry.put("at", job.optLong("at"));
        entry.put("error", job.optString("error", ""));
        entry.put("jobId", job.optString("id", ""));
        entry.put("agentName", job.optString("agentName", ""));
        h.put(entry);
      }
      JSONArray calls = new JSONArray(mcpDebugRaw);
      for (int i = 0; i < calls.length(); i++) {
        JSONObject c = calls.optJSONObject(i);
        if (c == null) continue;
        JSONObject entry = new JSONObject();
        entry.put("type", "mcp_debug");
        entry.put("key", "mcp:" + c.optString("at"));
        entry.put("title", c.optString("tool", "MCP request"));
        entry.put("agentName", c.optString("agentName", ""));
        entry.put("status", c.optBoolean("ok", false) ? "done" : "failed");
        entry.put("at", java.time.Instant.parse(c.optString("at")).toEpochMilli());
        entry.put("requestDebug", c.optJSONObject("requestDebug"));
        h.put(entry);
      }
      java.util.ArrayList<JSONObject> ordered = new java.util.ArrayList<>();
      for (int i = 0; i < h.length(); i++) if (h.optJSONObject(i) != null) ordered.add(h.optJSONObject(i));
      ordered.sort((a,b) -> Long.compare(b.optLong("at"), a.optLong("at")));
      h = new JSONArray();
      for (JSONObject item : ordered) h.put(item);
    } catch (Exception ignored) {}
    // Transcript requests still waiting on this phone (from the server's progress): they are
    // listed with the assistant that asked, and a 429 pause is explained in one card on top.
    java.util.ArrayList<JSONObject> waitingTranscripts = new java.util.ArrayList<>();
    try {
      JSONArray recent = new JSONObject(progressRaw).optJSONArray("recent");
      if (recent != null && System.currentTimeMillis() - p.getLong("progressAt", 0) < 120_000L) for (int i = 0; i < recent.length(); i++) {
        JSONObject r = recent.optJSONObject(i);
        if (r != null && ("pending".equals(r.optString("status")) || "working".equals(r.optString("status")))) waitingTranscripts.add(r);
      }
    } catch (Exception ignored) {}
    boolean ytPaused = ytManual || ytPausedUntil > System.currentTimeMillis();
    if (ytPaused) addYoutubePauseCard(waitingTranscripts, ytManual ? 0L : ytPausedUntil);
    try {
      JSONArray merged = new JSONArray();
      for (JSONObject r : waitingTranscripts) {
        JSONObject entry = new JSONObject();
        entry.put("type", "transcript_waiting");
        entry.put("title", (fr() ? "Transcription YouTube · " : "YouTube transcript · ") + (r.isNull("title") ? r.optString("videoId") : r.optString("title")));
        entry.put("videoId", r.optString("videoId"));
        entry.put("agentName", r.isNull("agent") ? "" : r.optString("agent"));
        entry.put("status", "working".equals(r.optString("status")) ? "running" : "waiting");
        entry.put("paused", ytPaused && !"working".equals(r.optString("status")));
        try { entry.put("at", java.time.Instant.parse(r.optString("createdAt")).toEpochMilli()); } catch (Exception ex) { entry.put("at", System.currentTimeMillis()); }
        merged.put(entry);
      }
      for (int i = 0; i < h.length(); i++) merged.put(h.get(i));
      h = merged;
    } catch (Exception ignored) {}
    if (h.length() == 0) {
      updateSelectionUi();
      TextView empty = text(historyList, t("history_empty"), 13, MUTED, false);
      empty.setPadding(dp(12), dp(10), dp(12), dp(10));
      return;
    }
    int max = Math.min(h.length(), 50);
    for (int i = 0; i < max; i++) {
      JSONObject e = h.optJSONObject(i);
      if (e == null) continue;
      String state = e.optString("status");
      boolean ok = "done".equals(state);
      boolean failedState = java.util.Arrays.asList("failed", "error", "expired", "cancelled", "canceled", "timeout").contains(state);
      boolean pending = !ok && (java.util.Arrays.asList("pending", "received", "queued", "running", "in_progress", "waiting", "opening", "downloading", "attaching", "verifying", "writing", "sending").contains(state)
          || ("linkedin_mcp".equals(e.optString("type")) && !failedState));
      boolean notebookEntry = "notebooklm".equals(e.optString("type"));
      boolean mcpDebugEntry = "mcp_debug".equals(e.optString("type"));
      boolean linkedinEntry = "linkedin_mcp".equals(e.optString("type"));
      boolean waitingEntry = "transcript_waiting".equals(e.optString("type"));
      LinearLayout row = new LinearLayout(this);
      row.setGravity(Gravity.CENTER_VERTICAL);
      row.setPadding(dp(2), dp(9), dp(10), dp(9));
      final String rowKey = waitingEntry ? null : (e.has("key") ? e.optString("key") : "yt:" + e.optString("videoId") + ":" + e.optLong("at"));
      CheckBox box = null;
      if (rowKey != null) {
        box = new CheckBox(this);
        box.setChecked(historySelected.contains(rowKey));
        box.setContentDescription(t("select_all"));
        box.setOnCheckedChangeListener((b, checked) -> {
          if (syncingSelection) return;
          if (checked) historySelected.add(rowKey); else historySelected.remove(rowKey);
          updateSelectionUi();
        });
        historyBoxes.put(rowKey, box);
        row.addView(box, new LinearLayout.LayoutParams(dp(40), dp(40)));
      } else {
        row.addView(new View(this), new LinearLayout.LayoutParams(dp(40), dp(40)));
      }
      final CheckBox rowBox = box;
      if (pending) {
        // Work in progress: a spinner, never a cross, until the final result arrives.
        android.widget.ProgressBar spin = new android.widget.ProgressBar(this, null, android.R.attr.progressBarStyleSmall);
        spin.setIndeterminate(true);
        spin.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(Color.rgb(10, 102, 194)));
        spin.setContentDescription(fr() ? "En cours" : "In progress");
        row.addView(spin, new LinearLayout.LayoutParams(dp(24), dp(24)));
      } else {
        TextView icon = text(null, ok ? "✓" : "✕", 14, Color.WHITE, true);
        icon.setGravity(Gravity.CENTER);
        icon.setBackground(dot(ok ? GREEN : RED));
        row.addView(icon, new LinearLayout.LayoutParams(dp(24), dp(24)));
      }
      LinearLayout texts = new LinearLayout(this);
      texts.setOrientation(LinearLayout.VERTICAL);
      texts.setPadding(dp(10), 0, 0, 0);
      String title = e.isNull("title") ? null : localizedOperation(e.optString("title", null));
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
      origin.setCompoundDrawables(null, null, null, null);
      android.graphics.drawable.Drawable providerLogo = AgentIcons.forProvider(this, provider);
      origin.setCompoundDrawables(providerLogo, null, null, null);
      origin.setCompoundDrawablePadding(dp(5));
      String when = DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(e.optLong("at")));
      String detail = waitingEntry ? ((e.optBoolean("paused") ? (fr() ? "En pause (YouTube 429)" : "Paused (YouTube 429)") : "running".equals(state) ? (fr() ? "En cours" : "In progress") : (fr() ? "En attente" : "Waiting")) + " · " + when) : linkedinEntry ? (localizedJobStatus(e.optString("status")) + " · " + when + (e.optString("file").isEmpty() ? "" : " · " + e.optString("file")) + (e.optString("error").isEmpty() ? "" : " · " + e.optString("error"))) : mcpDebugEntry ? ("MCP HTTP · " + when + " · " + ("fr".equals(I18n.code(this)) ? "Appuyer pour déboguer" : "Tap for diagnostics")) : notebookEntry ? ("NotebookLM · " + localizedJobStatus(e.optString("status")) + " · " + when) : ok ? t("segments", e.optInt("segments")) + " · " + when : when + " · " + e.optString("error", t("failed"));
      TextView d = text(texts, detail, 12, waitingEntry && e.optBoolean("paused") ? AMBER : ok || pending ? MUTED : RED, false);
      d.setMaxLines(1); d.setEllipsize(TextUtils.TruncateAt.END);
      row.addView(texts, new LinearLayout.LayoutParams(0, -2, 1));
      final String vid = e.optString("videoId");
      final long at = e.optLong("at");
      row.setOnClickListener(v -> { if (linkedinEntry) { showDiagnostic("Demande LinkedIn MCP", "ID : " + e.optString("jobId") + "\nÉtat : " + e.optString("status") + "\nErreur : " + e.optString("error", "aucune")); } else if (mcpDebugEntry) { JSONObject debug = e.optJSONObject("requestDebug"); showDiagnostic("Diagnostic identité MCP (données masquées)", debug == null ? "Métadonnées absentes pour cette requête." : prettyJson(debug.toString())); } else if (notebookEntry) selectTab(2); else startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com/watch?v=" + vid))); });
      if (waitingEntry) {
        // Live server state, not local history: nothing to remove.
        historyList.addView(row);
        View sep = new View(this); sep.setBackgroundColor(LINE);
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(-1, dp(1)); sl.leftMargin = dp(82);
        historyList.addView(sep, sl);
        continue;
      }
      // Long press checks or unchecks the row, as in a mailbox.
      row.setOnLongClickListener(v -> { if (rowBox != null) rowBox.toggle(); return true; });
      historyList.addView(row);
      if (i < max - 1) {
        View sep = new View(this);
        sep.setBackgroundColor(LINE);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(1));
        lp.leftMargin = dp(82);
        historyList.addView(sep, lp);
      }
    }
    updateSelectionUi();
  }

  private boolean fr() { return "fr".equals(I18n.code(this)); }

  private String appVersion() {
    try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "?"; }
  }

  private static String prettyJson(String raw) {
    try { String t = raw == null ? "" : raw.trim(); return t.startsWith("[") ? new JSONArray(t).toString(2) : t.startsWith("{") ? new JSONObject(t).toString(2) : raw; }
    catch (Exception e) { return raw; }
  }

  /** Diagnostic dialog with selectable text, Copy and Share (the content is already redacted: no tokens, no request bodies). */
  private void showDiagnostic(String title, String report) {
    boolean fr = fr();
    AlertDialog dialog = new AlertDialog.Builder(this).setTitle(title).setMessage(report)
        .setPositiveButton("OK", null)
        .setNeutralButton(fr ? "Copier" : "Copy", null)
        .setNegativeButton(fr ? "Partager" : "Share", null).create();
    dialog.setOnShowListener(d -> {
      TextView msg = dialog.findViewById(android.R.id.message);
      if (msg != null) { msg.setTextIsSelectable(true); msg.setTextSize(12); msg.setTypeface(Typeface.MONOSPACE); }
      // Copy keeps the dialog open so the user can still read it.
      dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v -> {
        android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        if (cm != null) cm.setPrimaryClip(android.content.ClipData.newPlainText(title, title + "\n\n" + report));
        Toast.makeText(this, fr ? "Diagnostic copié : collez-le où vous voulez." : "Diagnostics copied.", Toast.LENGTH_SHORT).show();
      });
      dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener(v -> {
        Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain")
            .putExtra(Intent.EXTRA_SUBJECT, title).putExtra(Intent.EXTRA_TEXT, title + "\n\n" + report);
        try { startActivity(Intent.createChooser(send, fr ? "Partager le diagnostic" : "Share diagnostics")); } catch (Exception ignored) {}
      });
    });
    dialog.show();
  }

  /** Display name of the assistant that sent a request (same mapping as the activity rows). */
  private String providerName(String agent) {
    String id = agent == null ? "" : agent.toLowerCase(java.util.Locale.ROOT);
    if (id.contains("antigravity")) return "Antigravity";
    if (id.contains("cursor")) return "Cursor";
    if (id.contains("codex")) return "Codex";
    if (id.contains("chatgpt") || id.contains("openai")) return "ChatGPT";
    if (id.contains("claude") || id.contains("anthropic")) return "Claude";
    if (id.contains("gemini cli")) return "Gemini CLI";
    if (id.contains("gemini")) return "Gemini";
    return agent == null || agent.trim().isEmpty() ? (fr() ? "Assistant inconnu" : "Unknown assistant") : agent.trim();
  }

  /** Amber card on top of the activity list while YouTube rate-limits this phone (HTTP 429). */
  private void addYoutubePauseCard(java.util.List<JSONObject> waiting, long resumesAt) {
    boolean fr = fr();
    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setPadding(dp(14), dp(12), dp(14), dp(12));
    card.setBackground(shape(Color.rgb(255, 247, 230), 14, Color.rgb(250, 214, 150)));
    TextView title = text(card, "⏸  " + (fr ? "Transcriptions YouTube temporairement suspendues" : "YouTube transcripts temporarily paused"), 15, Color.rgb(146, 64, 14), true);
    title.setPadding(0, 0, 0, dp(4));
    text(card, fr ? "YouTube limite temporairement les demandes (erreur 429). Les transcriptions reprendront lorsque la limitation sera levée."
        : "YouTube is temporarily limiting requests (error 429). Transcripts will resume once the limit is lifted.", 13, INK, false);
    // Who asked, and what: assistant logo + name, request type.
    java.util.LinkedHashMap<String, Integer> byAgent = new java.util.LinkedHashMap<>();
    for (JSONObject r : waiting) { String a = providerName(r.isNull("agent") ? "" : r.optString("agent")); byAgent.put(a, byAgent.getOrDefault(a, 0) + 1); }
    for (java.util.Map.Entry<String, Integer> en : byAgent.entrySet()) {
      TextView who = text(card, en.getKey() + " · " + (fr ? "Transcription YouTube" : "YouTube transcript") + (en.getValue() > 1 ? " ×" + en.getValue() : ""), 13, INK, true);
      who.setPadding(0, dp(8), 0, 0);
      android.graphics.drawable.Drawable logo = AgentIcons.forProvider(this, en.getKey());
      who.setCompoundDrawables(logo, null, null, null);
      who.setCompoundDrawablePadding(dp(6));
      who.setGravity(Gravity.CENTER_VERTICAL);
    }
    int n = waiting.size();
    TextView count = text(card, (fr ? n + (n > 1 ? " transcriptions en attente" : " transcription en attente") + " · Aucune donnée perdue"
        : n + (n == 1 ? " transcript waiting" : " transcripts waiting") + " · No data lost"), 13, MUTED, false);
    count.setPadding(0, dp(8), 0, 0);
    TextView nextLabel = text(card, fr ? "Prochaine tentative" : "Next attempt", 12, Color.rgb(146, 64, 14), true);
    nextLabel.setPadding(0, dp(10), 0, 0);
    text(card, resumesAt > System.currentTimeMillis()
        ? (fr ? "Automatique vers " : "Automatic around ") + DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(resumesAt)) + (fr ? " (estimation : la durée exacte dépend de YouTube)" : " (estimate: the exact duration depends on YouTube)")
        : (fr ? "À déterminer selon la durée de la limitation YouTube." : "Depends on how long YouTube keeps the limit."), 13, INK, false);
    Button retry = toolButton(fr ? "Réessayer maintenant" : "Retry now", UiIcons.Kind.REFRESH);
    LinearLayout.LayoutParams rl = new LinearLayout.LayoutParams(-2, dp(40));
    rl.topMargin = dp(10);
    card.addView(retry, rl);
    retry.setOnClickListener(v -> { if (retryYoutubeButton != null) retryYoutubeButton.performClick(); });
    LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(-1, -2);
    cl.bottomMargin = dp(8);
    historyList.addView(card, cl);
  }

  @Override protected void onResume() {
    super.onResume();
    foreground = true;
    historyShown = null;
    // A persisted connected=true flag does not mean Android kept the service alive.
    SharedPreferences p=RelayClient.prefs(this);
    recoverRelayIfNeeded();
    ui.post(refresher);
    // Preserve the explicit LinkedIn permission within this Activity session.
    // Polling is suspended while the Activity is not in the foreground.
    if (linkedinMcpEnabled && linkedinWeb != null) {
      ui.removeCallbacks(linkedinPoll);
      ui.post(linkedinPoll);
      if (linkedinMcpControlButton != null) { linkedinMcpControlButton.setText(linkedinToolbarText("allowed")); setToggleState(linkedinMcpControlButton, true); }
    }
  }
  @Override protected void onPause() {
    foreground = false;
    linkedinControlOn = false;
    ui.removeCallbacks(refresher);
    ui.removeCallbacks(linkedinPoll);
    // Do not revoke the user's explicit consent on tab switches or temporary pauses.
    // A fresh Activity starts with linkedinMcpEnabled=false, requiring consent again.
    super.onPause();
  }

  // ---------- manual extraction ----------

  @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); handleShare(intent); }
  @Override protected void onDestroy() { ui.removeCallbacks(linkedinPoll); linkedinPollWorker.shutdownNow(); worker.shutdownNow(); super.onDestroy(); }

  private void handleShare(Intent intent) {
    // Tapped the "LinkedIn command waiting" notification: show the LinkedIn tab and its control.
    if (intent != null && intent.getBooleanExtra("openLinkedIn", false)) {
      intent.removeExtra("openLinkedIn");
      selectTab(3);
      if (!linkedinMcpEnabled) Toast.makeText(this, "fr".equals(I18n.code(this)) ? "Autorisez « LinkedIn MCP » pour exécuter la demande de l'assistant." : "Allow \"LinkedIn MCP\" to run the assistant's request.", Toast.LENGTH_LONG).show();
      return;
    }
    if (intent != null && Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
      String t = intent.getStringExtra(Intent.EXTRA_TEXT);
      if (t != null) { selectTab(1); urlInput.setText(t); if (TranscriptFetcher.videoId(t) != null) extract(); }
    }
  }

  /**
   * Adds a YouTube video to one of the user's NotebookLM notebooks (NotebookLM reads its transcript
   * itself). Uses the NotebookLM session of this phone; nothing goes through CamMicGo servers.
   */
  private void addVideoToNotebook(String link) {
    String videoId = TranscriptFetcher.videoId(link == null ? "" : link.trim());
    if (videoId == null) { Toast.makeText(this, "Collez d'abord un lien YouTube valide.", Toast.LENGTH_LONG).show(); return; }
    String url = "https://www.youtube.com/watch?v=" + videoId;
    Toast.makeText(this, "Lecture de vos notebooks…", Toast.LENGTH_SHORT).show();
    worker.execute(() -> {
      try {
        JSONArray notebooks = new NotebookClient(this).list().getJSONArray("notebooks");
        ui.post(() -> {
          if (notebooks.length() == 0) {
            new AlertDialog.Builder(this).setTitle("Aucun notebook").setMessage("Créez d'abord un notebook dans l'onglet NotebookLM.")
                .setPositiveButton("OK", null).show();
            return;
          }
          String[] titles = new String[notebooks.length()];
          for (int i = 0; i < titles.length; i++) titles[i] = notebooks.optJSONObject(i).optString("title", "Sans titre");
          new AlertDialog.Builder(this).setTitle("Ajouter la vidéo à…")
              .setItems(titles, (d, which) -> {
                String nb = notebooks.optJSONObject(which).optString("url");
                worker.execute(() -> {
                  String msg;
                  try { new NotebookClient(this).addUrl(nb, url); msg = "Vidéo ajoutée à « " + titles[which] + " ». NotebookLM la traite en quelques instants."; }
                  catch (Exception e) { msg = "NotebookLM a refusé la vidéo : " + e.getMessage(); }
                  final String m = msg;
                  ui.post(() -> Toast.makeText(this, m, Toast.LENGTH_LONG).show());
                });
              })
              .setNegativeButton(t("cancel"), null).show();
        });
      } catch (Exception e) {
        ui.post(() -> new AlertDialog.Builder(this).setTitle("NotebookLM indisponible")
            .setMessage("Connectez-vous à NotebookLM dans l'onglet NotebookLM, puis réessayez.\n\n" + e.getMessage())
            .setPositiveButton("Ouvrir NotebookLM", (d, w) -> selectTab(2)).setNegativeButton(t("cancel"), null).show());
      }
    });
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

  /**
   * Local speech recognition was removed in 0.8.0. Its temporary audio is cleared automatically; the
   * downloaded models (up to about 2 GB) are only deleted after the user confirms.
   */
  private void offerOldModelCleanup(LinearLayout root) {
    deleteTree(new java.io.File(getCacheDir(), "audio-temp"));
    java.io.File models = new java.io.File(getFilesDir(), "asr");
    long size = treeSize(models);
    if (size <= 0) { deleteTree(models); return; }
    LinearLayout c = card(root);
    text(c, "Espace à libérer", 15, INK, true);
    TextView info = text(c, "Les modèles de transcription locale (Whisper, Qwen3) ne sont plus utilisés par l'application. Ils occupent "
        + humanSize(size) + " sur ce téléphone.", 13, MUTED, false);
    info.setPadding(0, dp(4), 0, dp(10));
    Button free = secondary("Supprimer ces fichiers (" + humanSize(size) + ")");
    c.addView(free);
    free.setOnClickListener(v -> new AlertDialog.Builder(this)
        .setTitle("Supprimer les anciens modèles ?")
        .setMessage(humanSize(size) + " seront libérés. Rien d'autre n'est effacé : appairage, historique et réglages sont conservés.")
        .setNegativeButton(t("cancel"), null)
        .setPositiveButton("Supprimer", (d, w) -> worker.execute(() -> {
          deleteTree(models);
          ui.post(() -> c.setVisibility(View.GONE));
        }))
        .show());
  }

  private static long treeSize(java.io.File f) {
    if (f == null || !f.exists()) return 0;
    if (f.isFile()) return f.length();
    long s = 0;
    java.io.File[] kids = f.listFiles();
    if (kids != null) for (java.io.File k : kids) s += treeSize(k);
    return s;
  }

  private static void deleteTree(java.io.File f) {
    if (f == null || !f.exists()) return;
    java.io.File[] kids = f.listFiles();
    if (kids != null) for (java.io.File k : kids) deleteTree(k);
    //noinspection ResultOfMethodCallIgnored
    f.delete();
  }

  private static String humanSize(long bytes) {
    return bytes >= 1_000_000_000L ? String.format(java.util.Locale.FRANCE, "%.2f Go", bytes / 1e9)
        : String.format(java.util.Locale.FRANCE, "%d Mo", Math.round(bytes / 1e6));
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
          if (TranscriptFetcher.noCaptions(err)) {
            resultMeta.setText("Transcription indisponible");
            output.setText(TranscriptFetcher.NO_CAPTIONS_MESSAGE);
            return;
          }
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
    if (requestCode == LINKEDIN_FILE_REQUEST) {
      if (linkedinFileCallback != null) {
        Uri[] selected = resultCode == RESULT_OK ? WebChromeClient.FileChooserParams.parseResult(resultCode, data) : null;
        linkedinFileCallback.onReceiveValue(selected);
        linkedinFileCallback = null;
      }
      return;
    }
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


