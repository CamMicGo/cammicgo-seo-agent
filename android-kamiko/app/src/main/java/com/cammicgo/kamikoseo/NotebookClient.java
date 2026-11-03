package com.cammicgo.kamikoseo;

import android.content.Context;
import android.webkit.CookieManager;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Pure Java, on-device NotebookLM client. Session cookies never leave the device.
 * Requires a Google login in the app's NotebookLM WebView (not external Chrome).
 * Google's private RPC interface can change without notice.
 */
final class NotebookClient {
  private static final String HOME="https://notebook.google.com/";
  private final Context context;
  NotebookClient(Context c){context=c.getApplicationContext();}

  private static String field(String page,String key) {
    Matcher m=Pattern.compile("\\\""+Pattern.quote(key)+"\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"").matcher(page);
    return m.find()?m.group(1):"";
  }
  private static String read(InputStream stream) throws IOException {
    try(InputStream in=stream;ByteArrayOutputStream out=new ByteArrayOutputStream()){
      byte[] b=new byte[8192];int n;
      while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>4_000_000)throw new IOException("NotebookLM response too large");}
      return out.toString("UTF-8");
    }
  }
  /**
   * Background HTTP transport. Google session cookies remain on this Android device.
   * CookieManager is read on the main thread, while network I/O stays on the relay worker.
   * This transport does not require an open NotebookActivity.
   */
  private String cookie() throws IOException {
    final java.util.concurrent.atomic.AtomicReference<String> value=new java.util.concurrent.atomic.AtomicReference<>();
    final java.util.concurrent.CountDownLatch done=new java.util.concurrent.CountDownLatch(1);
    new android.os.Handler(android.os.Looper.getMainLooper()).post(()->{
      try { value.set(CookieManager.getInstance().getCookie(HOME)); }
      finally { done.countDown(); }
    });
    try {
      if(!done.await(5,java.util.concurrent.TimeUnit.SECONDS))
        throw new IOException("NotebookLM : délai de lecture de la session Google");
    } catch(InterruptedException e){Thread.currentThread().interrupt();throw new IOException("NotebookLM : lecture de session interrompue",e);}
    String c=value.get();
    if(c==null||c.trim().isEmpty())
      throw new IOException("NotebookLM : aucune session Google persistante. Connectez-vous une fois dans l'APK.");
    return c;
  }
  private String request(String url,String method,String body) throws IOException {
    URL u=new URL(url);
    if(!"https".equalsIgnoreCase(u.getProtocol())||!"notebook.google.com".equalsIgnoreCase(u.getHost()))
      throw new IOException("NotebookLM : origine HTTP interdite");
    HttpURLConnection connection=null;
    try {
      connection=(HttpURLConnection)u.openConnection();
      connection.setInstanceFollowRedirects(false);
      connection.setConnectTimeout(12000);
      connection.setReadTimeout(25000);
      connection.setRequestMethod(method);
      connection.setRequestProperty("Cookie",cookie());
      connection.setRequestProperty("Accept","*/*");
      connection.setRequestProperty("Origin",HOME.substring(0,HOME.length()-1));
      connection.setRequestProperty("Referer",HOME);
      connection.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");
      if(body!=null){
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type","application/x-www-form-urlencoded;charset=UTF-8");
        byte[] bytes=body.getBytes(StandardCharsets.UTF_8);
        try(OutputStream out=connection.getOutputStream()){out.write(bytes);}
      }
      int status=connection.getResponseCode();
      if(status==401||status==403||status==302||status==303)
        throw new IOException("NotebookLM : session Google expirée ou refusée (HTTP "+status+"). Rouvrez NotebookLM pour vous reconnecter.");
      if(status<200||status>=300)
        throw new IOException("NotebookLM : requête RPC HTTP "+status);
      return read(connection.getInputStream());
    } catch(IOException e){throw e;}
    finally {if(connection!=null)connection.disconnect();}
  }
  private Object rpc(String id,JSONArray args,String sourcePath) throws Exception {
    String page=request(HOME,"GET",null);
    String csrf=field(page,"SNlM0e"),sid=field(page,"FdrFJe"),bl=field(page,"cfb2h");
    if(csrf.isEmpty())throw new IOException("Page NotebookLM accessible mais jeton RPC absent (SNlM0e). Vérifier le chargement de la session WebView et les paramètres de la page.");
    String url=HOME+"_/LabsTailwindUi/data/batchexecute?rpcids="+id+"&source-path="+
      URLEncoder.encode(sourcePath,"UTF-8")+"&hl=fr&rt=c";
    if(!bl.isEmpty())url+="&bl="+URLEncoder.encode(bl,"UTF-8");
    if(!sid.isEmpty())url+="&f.sid="+URLEncoder.encode(sid,"UTF-8");
    String response=request(url,"POST",NotebookRpcCodec.formBody(id,args,csrf)+"&");
    JSONArray frames=NotebookRpcCodec.responseFrames(response);
    for(int i=0;i<frames.length();i++){
      JSONArray chunk=frames.optJSONArray(i);if(chunk==null)continue;
      for(int j=0;j<chunk.length();j++){
        JSONArray item=chunk.optJSONArray(j);
        if(item==null||!"wrb.fr".equals(item.optString(0))||!id.equals(item.optString(1)))continue;
        JSONArray error=item.optJSONArray(5);
        if(error!=null&&error.length()>0)throw new IOException("NotebookLM RPC "+id+" error "+error.optInt(0));
        String payload=item.optString(2,"");
        if(payload.isEmpty())throw new IOException("NotebookLM RPC returned no data");
        return new org.json.JSONTokener(payload).nextValue();
      }
    }
    throw new IOException("NotebookLM RPC "+id+" response not found");
  }
  private JSONArray notebooks() throws Exception {
    Object result=rpc(NotebookRpcCodec.LIST,new JSONArray().put(JSONObject.NULL).put(1).put(JSONObject.NULL).put(new JSONArray().put(2)),"/");
    if(!(result instanceof JSONArray))throw new IOException("Unexpected NotebookLM list response");
    JSONArray outer=(JSONArray)result;
    JSONArray nested=outer.optJSONArray(0);
    return nested==null?outer:nested;
  }
  JSONObject list() throws Exception {
    JSONArray items=new JSONArray();
    JSONArray raw=notebooks();
    for(int i=0;i<raw.length();i++){
      JSONArray nb=raw.optJSONArray(i);
      if(nb==null||nb.length()<3||! (nb.opt(2) instanceof String))continue;
      // NotebookLM metadata[0]: 1 = owned by this Google account; 2 = shared with me.
      JSONArray metadata=nb.optJSONArray(5);
      if(metadata!=null&&metadata.length()>0&&metadata.optInt(0,-1)!=1)continue;
      String id=nb.optString(2),title=nb.optString(0,"Sans titre");
      items.put(new JSONObject().put("id",id).put("title",title).put("url",HOME+"notebook/"+id));
    }
    return new JSONObject().put("notebooks",items).put("count",items.length()).put("method","android-background-http-rpc");
  }
  JSONObject create(String title) throws Exception {
    if(title==null||title.trim().isEmpty()||title.length()>160)throw new IOException("Titre invalide");
    // Check before mutation to avoid duplicate notebooks on retries.
    JSONArray existing=list().getJSONArray("notebooks");
    for(int i=0;i<existing.length();i++)if(title.equals(existing.getJSONObject(i).optString("title")))
      return new JSONObject().put("notebookCreated",false).put("verifiedInList",true)
        .put("alreadyExists",true).put("title",title).put("id",existing.getJSONObject(i).optString("id")).put("url",existing.getJSONObject(i).optString("url"));
    JSONArray flags=new JSONArray().put(1);
    JSONArray metadata=new JSONArray().put(1);
    for(int i=0;i<9;i++)metadata.put(JSONObject.NULL);
    metadata.put(flags);
    JSONArray params=new JSONArray().put(title).put(JSONObject.NULL).put(JSONObject.NULL)
      .put(new JSONArray().put(2)).put(metadata);
    Object response=rpc(NotebookRpcCodec.CREATE,params,"/");
    if(!(response instanceof JSONArray))throw new IOException("NotebookLM create response invalid");
    JSONArray created=(JSONArray)response;
    String id=created.optString(2,"");
    if(id.isEmpty())throw new IOException("NotebookLM did not return notebook ID");
    boolean verified=false;
    // NotebookLM's list index can lag behind a successful create RPC.
    // Reconcile the returned ID before reporting failure; never issue create twice.
    for(int attempt=0;attempt<4&&!verified;attempt++){
      if(attempt>0)Thread.sleep(1200L*attempt);
      JSONArray after=list().getJSONArray("notebooks");
      for(int i=0;i<after.length();i++)
        if(id.equals(after.getJSONObject(i).optString("id")))verified=true;
    }
    if(!verified)throw new IOException("NotebookLM a renvoyé un identifiant, mais le notebook n’est pas visible dans Mes notebooks : "+id);
    return new JSONObject().put("notebookCreated",true).put("verifiedInList",verified)
      .put("title",title).put("id",id).put("url",HOME+"notebook/"+id);
  }
  JSONObject addUrl(String notebookUrl,String sourceUrl) throws Exception {
    if(notebookUrl==null||sourceUrl==null)throw new IOException("Notebook and source URL required");
    Matcher m=Pattern.compile("^https://(?:notebooklm|notebook)\\.google\\.com/notebook/([A-Za-z0-9_-]+)").matcher(notebookUrl);
    if(!m.find())throw new IOException("Invalid NotebookLM notebook URL");
    URL source=new URL(sourceUrl);
    if(!"https".equals(source.getProtocol())||source.getHost().isEmpty())throw new IOException("Source must be HTTPS");
    // Google Drive documents must be imported using their native Drive IDs and MIME types.
    // Passing a Sheets URL as a generic web page produces an unusable NotebookLM source.
    String host=source.getHost().toLowerCase(java.util.Locale.ROOT);
    if(host.equals("docs.google.com")||host.equals("drive.google.com"))
      throw new IOException("Google Drive/Sheets : import natif requis (source_type=drive, document_id, doc_type=sheets). L’import URL est désactivé pour éviter les sources invalides.");
    String id=m.group(1);
    boolean youtube=source.getHost().equals("youtube.com")||source.getHost().endsWith(".youtube.com")||source.getHost().equals("youtu.be");
    JSONArray data=new JSONArray();
    for(int i=0;i<11;i++)data.put(JSONObject.NULL);
    data.put(youtube?7:2,new JSONArray().put(sourceUrl));data.put(10,1);
    JSONArray metadata=new JSONArray().put(1);
    for(int i=0;i<9;i++)metadata.put(JSONObject.NULL);
    metadata.put(new JSONArray().put(1));
    JSONArray params=new JSONArray().put(new JSONArray().put(data)).put(id)
      .put(new JSONArray().put(2)).put(metadata);
    Object result=rpc("izAoDd",params,"/notebook/"+id);
    if(!(result instanceof JSONArray))throw new IOException("Source not confirmed by NotebookLM");
    JSONArray outer=(JSONArray)result;
    JSONArray sources=outer.optJSONArray(0);
    if(sources==null||sources.length()==0)throw new IOException("Source not confirmed by NotebookLM");
    return new JSONObject().put("sourceAdded",true).put("notebookUrl",notebookUrl)
      .put("sourceUrl",sourceUrl).put("method","android-java-rpc");
  }
  private String ownedNotebookId(String notebookUrl) throws Exception {
    if(notebookUrl==null)throw new IOException("Notebook URL required");
    Matcher match=Pattern.compile("^https://(?:notebooklm|notebook)\\.google\\.com/notebook/([A-Za-z0-9_-]+)$").matcher(notebookUrl);
    if(!match.matches())throw new IOException("Invalid notebook URL");
    String id=match.group(1);
    JSONArray owned=list().getJSONArray("notebooks");
    for(int i=0;i<owned.length();i++)if(id.equals(owned.getJSONObject(i).optString("id")))return id;
    throw new IOException("Notebook not found in the authenticated account's owned notebooks");
  }
  JSONObject getNotebook(String notebookUrl) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    JSONArray items=list().getJSONArray("notebooks");
    JSONObject notebook=null;
    for(int i=0;i<items.length();i++)if(id.equals(items.getJSONObject(i).optString("id")))notebook=items.getJSONObject(i);
    Object raw=rpc(NotebookRpcCodec.GET,new JSONArray().put(id).put(JSONObject.NULL).put(new JSONArray().put(2)).put(JSONObject.NULL).put(0),"/notebook/"+id);
    if(!(raw instanceof JSONArray))throw new IOException("Notebook details unavailable");
    JSONArray details=(JSONArray)raw;
    JSONArray sources=details.optJSONArray(1);
    JSONArray output=new JSONArray();
    if(sources!=null)for(int i=0;i<sources.length();i++){
      JSONArray src=sources.optJSONArray(i);if(src==null)continue;
      JSONArray ids=src.optJSONArray(0);
      output.put(new JSONObject().put("id",ids==null?JSONObject.NULL:ids.optString(0))
        .put("title",src.optString(1,"Sans titre")));
    }
    return new JSONObject().put("id",id).put("url",notebookUrl)
      .put("title",notebook.optString("title")).put("sourceCount",output.length())
      .put("sources",output).put("verified",true);
  }
  JSONObject renameNotebook(String notebookUrl,String title) throws Exception {
    if(title==null||title.trim().isEmpty()||title.length()>160)throw new IOException("Invalid title");
    String id=ownedNotebookId(notebookUrl);
    JSONArray update=new JSONArray().put(JSONObject.NULL).put(JSONObject.NULL).put(JSONObject.NULL)
      .put(new JSONArray().put(JSONObject.NULL).put(title.trim()));
    rpc(NotebookRpcCodec.RENAME,new JSONArray().put(id).put(new JSONArray().put(update)),"/notebook/"+id);
    JSONArray after=list().getJSONArray("notebooks");
    for(int i=0;i<after.length();i++){
      JSONObject nb=after.getJSONObject(i);
      if(id.equals(nb.optString("id"))&&title.trim().equals(nb.optString("title")))
        return new JSONObject().put("renamed",true).put("id",id).put("title",title.trim()).put("verified",true);
    }
    throw new IOException("Rename was not confirmed by NotebookLM notebook list");
  }

  /** Source-aware deletion preview. The caller must show the exact count to the user. */
  JSONObject deletionPreview(String notebookUrl) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    JSONArray raw=notebooks();
    for(int i=0;i<raw.length();i++){
      JSONArray nb=raw.optJSONArray(i);
      if(nb==null||!id.equals(nb.optString(2)))continue;
      JSONArray metadata=nb.optJSONArray(5);
      if(metadata==null||metadata.optInt(0,-1)!=1)throw new IOException("Not the notebook owner");
      JSONArray sources=nb.optJSONArray(1);
      if(sources==null)throw new IOException("Cannot verify source count: refusing deletion");
      return new JSONObject().put("id",id).put("title",nb.optString(0))
        .put("sourceCount",sources.length()).put("requiresConfirmation",sources.length()>0)
        .put("warning","Deleting a notebook permanently deletes its NotebookLM copies of sources, notes and generated audio/video. Original Google Drive files and external URLs are not deleted by this operation.");
    }
    throw new IOException("Notebook missing from authenticated account");
  }
  JSONObject deleteNotebook(String notebookUrl,String expectedTitle,int expectedSourceCount,boolean confirm) throws Exception {
    JSONObject before=deletionPreview(notebookUrl);
    if(!confirm)throw new IOException("Deletion requires explicit confirmation in a separate user message");
    if(expectedTitle==null||!expectedTitle.equals(before.optString("title"))||
       expectedSourceCount<0||expectedSourceCount!=before.optInt("sourceCount"))
      throw new IOException("Notebook title/source count changed; request a new deletion preview");
    String id=before.getString("id");
    rpc(NotebookRpcCodec.DELETE,new JSONArray().put(new JSONArray().put(id)).put(new JSONArray().put(2)),"/");
    JSONArray after=notebooks();
    for(int i=0;i<after.length();i++){
      JSONArray nb=after.optJSONArray(i);
      if(nb!=null&&id.equals(nb.optString(2)))throw new IOException("Notebook deletion not verified");
    }
    return new JSONObject().put("deleted",true).put("id",id).put("title",expectedTitle)
      .put("deletedNotebookSourceCount",expectedSourceCount).put("verified",true);
  }

}
