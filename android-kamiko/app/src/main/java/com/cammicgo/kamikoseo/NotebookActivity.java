package com.cammicgo.kamikoseo;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import java.lang.ref.WeakReference;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
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
import android.webkit.WebResourceError;
import android.webkit.CookieManager;
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
  private static final String HOME="https://notebook.google.com/";
  private static volatile WeakReference<NotebookActivity> active=new WeakReference<>(null);
  private volatile boolean notebookPageReady;
  private WebView browser;
  private TextView location;
  private String lastNotebookUrl;
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    active=new WeakReference<>(this);
    LinearLayout root=new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setBackgroundColor(android.graphics.Color.rgb(244,247,253));
    location=new TextView(this);
    location.setText("NotebookLM · "+(I18n.code(this).equals("fr")?"Session Google locale":"Local Google session"));
    location.setTextSize(17);
    location.setTypeface(null,android.graphics.Typeface.BOLD);
    location.setTextColor(android.graphics.Color.rgb(25,43,83));
    location.setPadding(dp(18),dp(18),dp(18),dp(14));
    root.addView(location);
    LinearLayout navigation=new LinearLayout(this);
    navigation.setGravity(Gravity.CENTER_VERTICAL);
    navigation.setPadding(dp(12),dp(2),dp(12),dp(6));
    Button back=button(I18n.code(this).equals("fr")?"← CamMicGo":"← CamMicGo");
    Button refresh=button("↻");
    navigation.addView(back,new LinearLayout.LayoutParams(0,dp(44),1));
    navigation.addView(refresh,new LinearLayout.LayoutParams(dp(52),dp(44)));
    root.addView(navigation);
    back.setOnClickListener(v->finish());
    refresh.setContentDescription(I18n.code(this).equals("fr")?"Actualiser NotebookLM":"Refresh NotebookLM");
    refresh.setOnClickListener(v->{notebookPageReady=false;browser.reload();});
    browser=new WebView(this);
    browser.getSettings().setJavaScriptEnabled(true);
    browser.getSettings().setDomStorageEnabled(true);
    browser.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES);
    browser.getSettings().setSupportMultipleWindows(false);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(browser,true);
    browser.setWebChromeClient(new WebChromeClient());
    browser.setWebViewClient(new WebViewClient(){
      @Override public void onPageFinished(WebView view,String url) {
        notebookPageReady=url!=null&&(url.startsWith(HOME)||url.startsWith("https://notebooklm.google.com/"));
        if(url!=null&&url.startsWith("https://accounts.google.com/")){
          notebookPageReady=false;
          location.setText("Connexion Google dans WebView distincte de Chrome");
        }
        if(notebookPageReady) {
          location.setText(url);
          if(url.matches("https://(?:notebooklm|notebook)\\.google\\.com/notebook/[A-Za-z0-9_-]+.*"))lastNotebookUrl=url;
        }
      }
      @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){
        if(request.isForMainFrame()){
          notebookPageReady=false;
          location.setText("Erreur de chargement NotebookLM : "+error.getDescription()+" (code "+error.getErrorCode()+")");
        }
      }
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
        Uri uri=request.getUrl();
        if("notebooklm.google.com".equals(uri.getHost())||"notebook.google.com".equals(uri.getHost())||"accounts.google.com".equals(uri.getHost()))return false;
        if("https".equalsIgnoreCase(uri.getScheme())&&uri.getHost()!=null&&uri.getHost().endsWith(".google.com")){
          // Keep Google sign-in redirects in the same WebView cookie jar.
          return false;
        }
        startActivity(new Intent(Intent.ACTION_VIEW,uri));
        return true;
      }
    });
    root.addView(browser,new LinearLayout.LayoutParams(-1,0,1));
    setContentView(root);
    browser.loadUrl(HOME);
  }
  @Override protected void onResume(){
    super.onResume();
    active=new WeakReference<>(this);
    if(browser!=null){
      String url=browser.getUrl();
      notebookPageReady=url!=null&&(url.startsWith(HOME)||url.startsWith("https://notebooklm.google.com/"));
    }
    // Do not force-reload Google's sign-in flow when returning from another app.
    // Reloading here can restart the login form and discard user input.
  }
  private void notice(String message){new AlertDialog.Builder(this).setMessage(message).setPositiveButton("OK",null).show();}
  private void setNotebookTitle(String name){
    String js="(function(){const e=[...document.querySelectorAll('input,[contenteditable=true]')].find(e=>/title|titre|notebook/i.test((e.getAttribute('aria-label')||'')+' '+(e.getAttribute('placeholder')||'')));if(!e)return 'missing';e.focus();if(e.isContentEditable){e.textContent="+JSONObject.quote(name)+";e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:"+JSONObject.quote(name)+"}));}else{const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(e,"+JSONObject.quote(name)+");e.dispatchEvent(new Event('input',{bubbles:true}));}e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));return 'attempted'})()";
    browser.evaluateJavascript(js,result->{if(!"\\\"attempted\\\"".equals(result))notice("Notebook ouvert, mais le champ de titre n'a pas été trouvé. Renommez-le dans NotebookLM.");else notice("Renommage demandé. Vérifiez que le titre apparaît dans NotebookLM avant de considérer la création comme terminée.");});
  }
  private int dp(int value){return Math.round(getResources().getDisplayMetrics().density*value);}
  private Button button(String text){
    Button b=new Button(this);
    b.setText(text);
    b.setTextSize(12);
    b.setAllCaps(false);
    b.setTextColor(android.graphics.Color.rgb(32,91,192));
    b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(android.graphics.Color.WHITE));
    b.setMinHeight(dp(48));
    b.setPadding(dp(5),dp(4),dp(5),dp(4));
    return b;
  }
  @Override public void onBackPressed(){if(browser.canGoBack())browser.goBack();else super.onBackPressed();}

  /** Same-origin fetch from the signed-in WebView; no Google credentials leave Android. */
  static String authenticatedRequest(String url,String method,String body) throws Exception {
    NotebookActivity a=active.get();
    if(a==null||a.browser==null)
      throw new java.io.IOException("NotebookLM : écran Android fermé. Ouvrez NotebookLM dans CamMicGo.");
    // WebView.getUrl() is UI-thread-only. Use the URL cached by WebViewClient.
    // Never access WebView methods from the relay worker thread.
    if(!a.notebookPageReady)
      throw new java.io.IOException("NotebookLM : page non prête dans l'APK. Attendez son chargement.");
    if(Looper.myLooper()==Looper.getMainLooper())throw new java.io.IOException("WebView RPC called on UI thread");
    java.net.URL u=new java.net.URL(url);
    if(!"https".equals(u.getProtocol())||!"notebook.google.com".equalsIgnoreCase(u.getHost()))
      throw new java.io.IOException("NotebookLM origin not allowed");
    CountDownLatch latch=new CountDownLatch(1);
    AtomicReference<String> response=new AtomicReference<>();
    // evaluateJavascript does not await a Promise: async IIFEs return "null".
    // Store the fetch result on the page and poll it from the UI thread.
    String js="window.__cmgRpcResult=null;(async()=>{try{const r=await fetch("+JSONObject.quote(url)+",{method:"+JSONObject.quote(method)+",credentials:'include',headers:{'Accept':'*/*'"+(body==null?"":",'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'")+"}"+(body==null?"":",body:"+JSONObject.quote(body))+"});window.__cmgRpcResult=JSON.stringify({status:r.status,text:(await r.text()).slice(0,4000000)});}catch(e){window.__cmgRpcResult=JSON.stringify({error:String(e)});}})();";
    Handler ui=new Handler(Looper.getMainLooper());
    ui.post(()->{
      try{
        a.browser.evaluateJavascript(js,ignored->{
          final Runnable[] poll=new Runnable[1];
          poll[0]=()->{
            try{
              a.browser.evaluateJavascript("window.__cmgRpcResult",value->{
                if(value!=null&&!"null".equals(value)){
                  response.set(value);
                  latch.countDown();
                }else if(latch.getCount()>0)ui.postDelayed(poll[0],200);
              });
            }catch(Exception e){response.set(null);latch.countDown();}
          };
          ui.post(poll[0]);
        });
      }catch(Exception e){response.set(null);latch.countDown();}
    });
    if(!latch.await(45,TimeUnit.SECONDS))throw new java.io.IOException("NotebookLM WebView timeout (45 s)");
    String raw=response.get();
    if(raw==null||"null".equals(raw))throw new java.io.IOException("NotebookLM WebView returned no response");
    // evaluateJavascript returns a JSON-encoded JavaScript string. Unwrap it
    // before parsing the actual {status,text} object returned by fetch().
    Object decoded=new org.json.JSONTokener(raw).nextValue();
    if(!(decoded instanceof String))
      throw new java.io.IOException("NotebookLM WebView unexpected JS response type");
    JSONObject o=new JSONObject((String)decoded);
    if(o.has("error"))throw new java.io.IOException("NotebookLM WebView: "+o.optString("error"));
    int code=o.optInt("status");
    if(code<200||code>=300)throw new java.io.IOException("NotebookLM WebView HTTP "+code);
    return o.optString("text","");
  }
  @Override protected void onDestroy(){if(active.get()==this)active=new WeakReference<>(null);notebookPageReady=false;browser.destroy();super.onDestroy();}
}
