package com.cammicgo.kamikoseo;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Gravity;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/** On-device NotebookLM workspace. Google session stays in Android WebView storage.
 * No cookies, session tokens or page content are uploaded to CamMicGo.
 * NotebookLM may reject WebView sign-in; external Chrome is always available.
 */
public final class NotebookActivity extends Activity {
  private static final String HOME="https://notebooklm.google.com/";
  private WebView browser;
  private TextView location;
  private String lastNotebookUrl;
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    LinearLayout root=new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    location=new TextView(this);
    location.setText("NotebookLM · session locale");
    location.setPadding(16,12,16,12);
    root.addView(location);
    LinearLayout actions=new LinearLayout(this);
    Button home=button("Notebooks"), create=button("Créer"), source=button("Sources"), chrome=button("Chrome");
    actions.addView(home,new LinearLayout.LayoutParams(0,-2,1));
    actions.addView(create,new LinearLayout.LayoutParams(0,-2,1));
    actions.addView(source,new LinearLayout.LayoutParams(0,-2,1));
    actions.addView(chrome,new LinearLayout.LayoutParams(0,-2,1));
    root.addView(actions);
    browser=new WebView(this);
    browser.getSettings().setJavaScriptEnabled(true);
    browser.getSettings().setDomStorageEnabled(true);
    browser.getSettings().setSupportMultipleWindows(false);
    browser.setWebChromeClient(new WebChromeClient());
    browser.setWebViewClient(new WebViewClient(){
      @Override public void onPageFinished(WebView view,String url) {
        if(url!=null&&url.startsWith(HOME)) {
          location.setText(url);
          if(url.matches("https://notebooklm\\.google\\.com/notebook/[A-Za-z0-9_-]+.*"))lastNotebookUrl=url;
        }
      }
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
        Uri uri=request.getUrl();
        if("notebooklm.google.com".equals(uri.getHost())||"accounts.google.com".equals(uri.getHost()))return false;
        startActivity(new Intent(Intent.ACTION_VIEW,uri));
        return true;
      }
    });
    root.addView(browser,new LinearLayout.LayoutParams(-1,0,1));
    setContentView(root);
    home.setOnClickListener(v->browser.loadUrl(HOME));
    create.setOnClickListener(v->{
      // NotebookLM's internal APIs are undocumented; interact through its own UI.
      browser.evaluateJavascript("(function(){let x=[...document.querySelectorAll('button,[role=button]')].find(e=>/create new|new notebook|créer|nouveau notebook/i.test(e.innerText||e.getAttribute('aria-label')||''));if(x){x.click();return 'ok'}return 'missing'})()",result->{
        if("\"missing\"".equals(result))new AlertDialog.Builder(this).setMessage("Utilisez le bouton Nouveau notebook sur la page NotebookLM.").setPositiveButton("OK",null).show();
      });
    });
    source.setOnClickListener(v->{
      browser.evaluateJavascript("(function(){let x=[...document.querySelectorAll('button,[role=button]')].find(e=>/add sources?|ajouter (des |une )?sources?/i.test(e.innerText||e.getAttribute('aria-label')||''));if(x){x.click();return 'ok'}return 'missing'})()",result->{
        if("\"missing\"".equals(result))new AlertDialog.Builder(this).setMessage("Ouvrez un notebook, puis utilisez Ajouter des sources.").setPositiveButton("OK",null).show();
      });
    });
    chrome.setOnClickListener(v->startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(lastNotebookUrl==null?HOME:lastNotebookUrl))));
    browser.loadUrl(HOME);
  }
  private Button button(String text){Button b=new Button(this);b.setText(text);b.setTextSize(12);b.setAllCaps(false);return b;}
  @Override public void onBackPressed(){if(browser.canGoBack())browser.goBack();else super.onBackPressed();}
  @Override protected void onDestroy(){browser.destroy();super.onDestroy();}
}
