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
import org.json.JSONObject;
import org.json.JSONArray;
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
      EditText title=new EditText(this);
      title.setSingleLine(true);
      title.setHint("Titre du nouveau notebook");
      new AlertDialog.Builder(this).setTitle("Créer un notebook").setView(title)
        .setNegativeButton("Annuler",null)
        .setPositiveButton("Créer",(dialog,which)->{
          String name=title.getText().toString().trim();
          if(name.isEmpty()||name.length()>160){notice("Saisissez un titre de 1 à 160 caractères.");return;}
          // Click only the real NotebookLM UI. No undocumented Google API or session export.
          String js="(function(){const x=[...document.querySelectorAll('button,[role=button]')].find(e=>/create new|new notebook|créer|nouveau notebook/i.test(e.innerText||e.getAttribute('aria-label')||''));if(!x)return 'missing';x.click();return 'clicked'})()";
          browser.evaluateJavascript(js,result->{
            if(!"\\\"clicked\\\"".equals(result)){notice("Ouvrez NotebookLM et connectez-vous dans cette fenêtre avant de créer un notebook.");return;}
            // NotebookLM often opens a source dialog first. Only attempt title editing on its notebook page.
            browser.postDelayed(()->setNotebookTitle(name),2500);
          });
        }).show();
    });
    source.setOnClickListener(v->{
      if(lastNotebookUrl==null){notice("Sélectionnez d'abord un notebook dans la liste.");browser.loadUrl(HOME);return;}
      browser.evaluateJavascript("(function(){const x=[...document.querySelectorAll('button,[role=button]')].find(e=>/add sources?|ajouter (des |une )?sources?/i.test(e.innerText||e.getAttribute('aria-label')||''));if(!x)return 'missing';x.click();return 'clicked'})()",result->{
        if(!"\\\"clicked\\\"".equals(result))notice("Ouvrez le notebook et sélectionnez Ajouter des sources dans NotebookLM.");
        else notice("Sélectionnez la source dans la fenêtre NotebookLM. L'ajout n'est confirmé qu'une fois visible dans le notebook.");
      });
    });
    chrome.setOnClickListener(v->startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(lastNotebookUrl==null?HOME:lastNotebookUrl))));
    browser.loadUrl(HOME);
  }
  private void notice(String message){new AlertDialog.Builder(this).setMessage(message).setPositiveButton("OK",null).show();}
  private void setNotebookTitle(String name){
    String js="(function(){const e=[...document.querySelectorAll('input,[contenteditable=true]')].find(e=>/title|titre|notebook/i.test((e.getAttribute('aria-label')||'')+' '+(e.getAttribute('placeholder')||'')));if(!e)return 'missing';e.focus();if(e.isContentEditable){e.textContent="+JSONObject.quote(name)+";e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:"+JSONObject.quote(name)+"}));}else{const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(e,"+JSONObject.quote(name)+");e.dispatchEvent(new Event('input',{bubbles:true}));}e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));return 'attempted'})()";
    browser.evaluateJavascript(js,result->{if(!"\\\"attempted\\\"".equals(result))notice("Notebook ouvert, mais le champ de titre n'a pas été trouvé. Renommez-le dans NotebookLM.");else notice("Renommage demandé. Vérifiez que le titre apparaît dans NotebookLM avant de considérer la création comme terminée.");});
  }
  private Button button(String text){Button b=new Button(this);b.setText(text);b.setTextSize(12);b.setAllCaps(false);return b;}
  @Override public void onBackPressed(){if(browser.canGoBack())browser.goBack();else super.onBackPressed();}
  @Override protected void onDestroy(){browser.destroy();super.onDestroy();}
}
