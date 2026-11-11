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
      while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>8_000_000)throw new IOException("NotebookLM response too large");}
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
  private String request(String url,String method,String body) throws IOException { return request(url,method,body,25000); }
  private String request(String url,String method,String body,int readTimeoutMs) throws IOException {
    URL u=new URL(url);
    if(!"https".equalsIgnoreCase(u.getProtocol())||!"notebook.google.com".equalsIgnoreCase(u.getHost()))
      throw new IOException("NotebookLM : origine HTTP interdite");
    HttpURLConnection connection=null;
    try {
      connection=(HttpURLConnection)u.openConnection();
      connection.setInstanceFollowRedirects(false);
      connection.setConnectTimeout(12000);
      connection.setReadTimeout(readTimeoutMs);
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
    // youtu.be, Shorts and mobile links: NotebookLM imports the canonical watch URL reliably.
    String videoId=youtube?TranscriptFetcher.videoId(sourceUrl):null;
    if(youtube&&videoId!=null)sourceUrl="https://www.youtube.com/watch?v="+videoId;
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
      .put("sourceUrl",sourceUrl).put("sourceType",youtube?"youtube":"web").put("method","android-java-rpc");
  }

  /** Several links, one by one (NotebookLM confirms each); a failure does not stop the others. */
  JSONObject addUrls(String notebookUrl,JSONArray urls) throws Exception {
    if(urls==null||urls.length()==0)throw new IOException("At least one source URL required");
    JSONArray results=new JSONArray();int added=0;
    for(int i=0;i<urls.length()&&i<20;i++){
      String url=urls.optString(i);
      try{JSONObject r=addUrl(notebookUrl,url);results.put(r);added++;}
      catch(Exception e){results.put(new JSONObject().put("sourceUrl",url).put("sourceAdded",false).put("error",String.valueOf(e.getMessage())));}
      if(i<urls.length()-1)Thread.sleep(1200);
    }
    return new JSONObject().put("notebookUrl",notebookUrl).put("requested",Math.min(20,urls.length())).put("added",added).put("results",results);
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
    String title=null;
    for(int i=0;i<items.length();i++)if(id.equals(items.getJSONObject(i).optString("id")))
      title=items.getJSONObject(i).optString("title");
    Object raw=rpc(NotebookRpcCodec.GET,new JSONArray().put(id).put(JSONObject.NULL)
      .put(new JSONArray().put(2)).put(JSONObject.NULL).put(0),"/notebook/"+id);
    if(!(raw instanceof JSONArray))throw new IOException("Notebook details unavailable");
    JSONArray wrapper=(JSONArray)raw;
    JSONArray details=wrapper.optJSONArray(0);
    if(details==null)details=wrapper;
    JSONArray sources=details.optJSONArray(1);
    if(sources==null)throw new IOException("Source list unavailable: do not treat notebook as empty");
    JSONArray output=new JSONArray();
    for(int i=0;i<sources.length();i++){
      JSONArray src=sources.optJSONArray(i);
      if(src==null)throw new IOException("Malformed NotebookLM source; cannot verify completeness");
      JSONArray ids=src.optJSONArray(0),meta=src.optJSONArray(2),state=src.optJSONArray(3);
      int status=state==null?-1:state.optInt(1,-1);
      int sourceType=meta==null?-1:meta.optInt(4,-1);
      JSONArray drive=meta==null?null:meta.optJSONArray(0);
      JSONObject entry=new JSONObject().put("id",ids==null?JSONObject.NULL:ids.optString(0))
        .put("title",src.optString(1,"Sans titre")).put("statusCode",status)
        .put("sourceType",sourceType).put("status",
          status==1?"processing":status==2?"ready":status==3?"error_or_audio_completed":
          status==5?"preparing":"unknown");
      if(drive!=null&&drive.opt(0) instanceof String)entry.put("driveDocumentId",drive.optString(0));
      output.put(entry);
    }
    return new JSONObject().put("id",id).put("url",notebookUrl)
      .put("title",title==null?JSONObject.NULL:title).put("sourceCount",output.length())
      .put("sources",output).put("verified",true);
  }
  JSONObject sourceList(String notebookUrl) throws Exception {
    JSONObject notebook=getNotebook(notebookUrl);
    return new JSONObject().put("notebookId",notebook.getString("id"))
      .put("sourceCount",notebook.getInt("sourceCount"))
      .put("sources",notebook.getJSONArray("sources"));
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
    JSONObject notebook=getNotebook(notebookUrl);
    int count=notebook.getInt("sourceCount");
    return new JSONObject().put("id",notebook.getString("id"))
      .put("title",notebook.getString("title")).put("sourceCount",count)
      .put("requiresConfirmation",true)
      .put("warning","NotebookLM deletes notebook sources, notes and generated artifacts. Original Drive files are preserved.");
  }
  JSONObject deleteNotebook(String notebookUrl,String expectedTitle,boolean confirm) throws Exception {
    if(!confirm)throw new IOException("Deletion requires explicit confirmation");
    String id=ownedNotebookId(notebookUrl);
    JSONArray before=list().getJSONArray("notebooks");
    String actualTitle=null;
    for(int i=0;i<before.length();i++){
      JSONObject notebook=before.getJSONObject(i);
      if(id.equals(notebook.optString("id"))){actualTitle=notebook.optString("title");break;}
    }
    if(actualTitle==null||expectedTitle==null||!expectedTitle.trim().equals(actualTitle.trim()))
      throw new IOException("Notebook title changed; deletion refused");
    // Verify notebook identity against the authenticated account, not the source list.
    rpc(NotebookRpcCodec.DELETE,new JSONArray().put(new JSONArray().put(id)).put(new JSONArray().put(2)),"/");
    JSONArray after=list().getJSONArray("notebooks");
    for(int i=0;i<after.length();i++){
      if(id.equals(after.getJSONObject(i).optString("id")))
        throw new IOException("Notebook deletion not verified");
    }
    return new JSONObject().put("deleted",true).put("id",id)
      .put("title",actualTitle).put("verified",true);
  }

  private JSONArray sourceMetadata(){
    JSONArray m=new JSONArray().put(1);
    for(int i=0;i<9;i++)m.put(JSONObject.NULL);
    m.put(new JSONArray().put(1));
    return m;
  }
  private JSONObject addStructuredSource(String notebookUrl,JSONArray source,String expectedTitle) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    JSONObject before=deletionPreview(notebookUrl);
    JSONArray params=new JSONArray().put(new JSONArray().put(source)).put(id)
      .put(new JSONArray().put(2)).put(sourceMetadata());
    try {
      rpc("izAoDd",params,"/notebook/"+id);
    }catch(IOException e){
      // Jacob's client reconciles RPC 3/9 because they may indicate accepted-pending.
      if(!e.getMessage().matches(".*error (3|9)$"))throw e;
    }
    JSONObject after=deletionPreview(notebookUrl);
    if(after.optInt("sourceCount")<=before.optInt("sourceCount"))
      throw new IOException("Source was not verified in NotebookLM; it may still be processing. Recheck before retrying.");
    return new JSONObject().put("sourceAdded",true).put("sourceCount",after.optInt("sourceCount"))
      .put("title",expectedTitle).put("verified",true);
  }
  JSONObject addText(String notebookUrl,String title,String text) throws Exception {
    if(title==null||title.trim().isEmpty()||text==null||text.trim().isEmpty())
      throw new IOException("Source title and text are required");
    if(text.length()>400000)throw new IOException("Text exceeds CamMicGo safety limit; split Markdown into parts");
    JSONArray source=new JSONArray().put(JSONObject.NULL).put(new JSONArray().put(title.trim()).put(text))
      .put(JSONObject.NULL).put(2);
    for(int i=0;i<6;i++)source.put(JSONObject.NULL);
    source.put(1);
    return addStructuredSource(notebookUrl,source,title);
  }
  JSONObject addDrive(String notebookUrl,String documentId,String title,String mimeType) throws Exception {
    if(documentId==null||!documentId.matches("[A-Za-z0-9_-]{10,200}"))
      throw new IOException("Invalid Drive document ID");
    if(title==null||title.trim().isEmpty())throw new IOException("Missing source title");
    if(!("application/vnd.google-apps.spreadsheet".equals(mimeType)||
         "application/vnd.google-apps.document".equals(mimeType)||
         "application/vnd.google-apps.presentation".equals(mimeType)||
         "application/pdf".equals(mimeType)))throw new IOException("Unsupported Drive MIME type");
    JSONArray source=new JSONArray().put(new JSONArray().put(documentId).put(mimeType).put(1).put(title))
      .put(JSONObject.NULL).put(JSONObject.NULL).put(JSONObject.NULL);
    for(int i=0;i<6;i++)source.put(JSONObject.NULL);
    source.put(1);
    return addStructuredSource(notebookUrl,source,title);
  }

  private String findTier(Object node,int depth){
    if(depth>12||node==null)return null;
    if(node instanceof String){
      String v=(String)node;return v.startsWith("NOTEBOOKLM_TIER_")?v:null;
    }
    if(node instanceof JSONArray){
      JSONArray a=(JSONArray)node;
      for(int j=0;j<a.length();j++){String t=findTier(a.opt(j),depth+1);if(t!=null)return t;}
    }
    return null;
  }
  JSONObject usage() throws Exception {
    JSONArray header=new JSONArray().put(2).put(JSONObject.NULL).put(new JSONArray().put(1));
    JSONArray metadata=new JSONArray().put(1);
    for(int i=0;i<9;i++)metadata.put(JSONObject.NULL);
    metadata.put(new JSONArray().put(1).put(3));
    header.put(metadata);
    Object raw=rpc("EylDcb",new JSONArray().put(header),"/");
    if(!(raw instanceof JSONArray))throw new IOException("NotebookLM usage RPC returned invalid response");
    JSONArray windows=((JSONArray)raw).optJSONArray(1);
    if(windows==null)throw new IOException("NotebookLM usage windows unavailable");
    JSONArray output=new JSONArray();
    for(int i=0;i<windows.length();i++){
      JSONArray w=windows.optJSONArray(i);
      if(w==null||w.length()<8)continue;
      int kind=w.optInt(4,-1);
      if(kind!=1&&kind!=2)continue;
      JSONObject entry=new JSONObject().put("window",kind==1?"rolling":"weekly");
      if(w.opt(6) instanceof Number)entry.put("percentUsed",w.optDouble(6));
      if(w.opt(7) instanceof Number)entry.put("percentRemaining",w.optDouble(7));
      JSONArray reset=w.optJSONArray(5);
      if(reset!=null&&reset.opt(0) instanceof Number)entry.put("resetsAtEpochSeconds",reset.optLong(0));
      output.put(entry);
    }
    if(output.length()==0)throw new IOException("No usable NotebookLM usage windows");
    JSONArray entitlement=new JSONArray().put(
      new JSONArray().put(
        new JSONArray().put(
          new JSONArray().put(JSONObject.NULL).put("1").put(627)
        ).put(new JSONArray().put(JSONObject.NULL).put(JSONObject.NULL).put(JSONObject.NULL)
          .put(JSONObject.NULL).put(JSONObject.NULL).put(JSONObject.NULL).put(JSONObject.NULL)
          .put(JSONObject.NULL).put(JSONObject.NULL).put(new JSONArray().put(JSONObject.NULL).put(JSONObject.NULL).put(2))
        ).put(1)
      )
    );
    String tier=null,entitlementError=null;
    try{tier=findTier(rpc("ozz5Z",entitlement,"/"),0);}
    catch(Exception e){entitlementError=e.getMessage();}
    JSONObject result=new JSONObject().put("windows",output).put("tier",tier==null?JSONObject.NULL:tier)
      .put("source","notebooklm-live-rpc").put("fetchedAt",System.currentTimeMillis())
      .put("quotaScope","account").put("generationAvailability","not-guaranteed");
    if(entitlementError!=null)result.put("tierError",entitlementError);
    return result;
  }

  private JSONArray studioOnly;
  private JSONArray studioSources(String notebookUrl,boolean nested) throws Exception {
    if(studioOnly!=null&&studioOnly.length()>0){
      JSONArray ids=new JSONArray();
      for(int j=0;j<studioOnly.length();j++){JSONArray single=new JSONArray().put(studioOnly.getString(j));ids.put(nested?new JSONArray().put(single):single);}
      return ids;
    }
    JSONArray entries=getNotebook(notebookUrl).getJSONArray("sources");
    JSONArray ids=new JSONArray();
    for(int j=0;j<entries.length();j++){
      JSONObject src=entries.getJSONObject(j);
      if(!"ready".equals(src.optString("status")))continue;
      String id=src.optString("id");
      if(id.isEmpty())continue;
      JSONArray single=new JSONArray().put(id);
      ids.put(nested?new JSONArray().put(single):single);
    }
    if(ids.length()==0)throw new IOException("No ready NotebookLM sources; check pink source errors before generating");
    return ids;
  }
  JSONObject studioCreate(String notebookUrl,String kind,String language,String focus) throws Exception {
    return studioCreateAdvanced(notebookUrl,kind,language,focus,"",1,2);
  }
  JSONObject studioCreateAdvanced(String notebookUrl,String kind,String language,String focus,
      String format,int optionA,int optionB) throws Exception {
    return studioCreateAdvanced(notebookUrl,kind,language,focus,format,optionA,optionB,"",null);
  }
  /** stylePrompt: custom visual style (video, with style code 2 "custom"); sourceIds: only these sources. */
  JSONObject studioCreateAdvanced(String notebookUrl,String kind,String language,String focus,
      String format,int optionA,int optionB,String stylePrompt,JSONArray sourceIds) throws Exception {
    studioOnly=sourceIds;
    try { return studioCreateInner(notebookUrl,kind,language,focus,format,optionA,optionB,stylePrompt==null?"":stylePrompt); }
    finally { studioOnly=null; }
  }
  private JSONObject studioCreateInner(String notebookUrl,String kind,String language,String focus,
      String format,int optionA,int optionB,String stylePrompt) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    JSONArray nested=studioSources(notebookUrl,true),simple=studioSources(notebookUrl,false);
    String lang=language==null||language.isEmpty()?"fr":language;
    String prompt=focus==null?"":focus;
    JSONArray content=new JSONArray().put(JSONObject.NULL).put(JSONObject.NULL);
    if("audio".equals(kind)){
      int fmt="brief".equals(format)?2:"critique".equals(format)?3:"debate".equals(format)?4:1;
      int length=optionA>=1&&optionA<=3?optionA:2;
      content.put(1).put(nested).put(JSONObject.NULL).put(JSONObject.NULL)
        .put(new JSONArray().put(JSONObject.NULL).put(new JSONArray().put(prompt)
          .put(length).put(JSONObject.NULL).put(simple).put(lang).put(JSONObject.NULL).put(fmt)));
    }else if("video".equals(kind)){
      int fmt="brief".equals(format)?2:"cinematic".equals(format)?3:"short".equals(format)?4:1;
      JSONArray opts=new JSONArray().put(simple).put(fmt==4?JSONObject.NULL:lang)
        .put(prompt).put(JSONObject.NULL).put(fmt);
      if(fmt==4)opts.put(JSONObject.NULL).put(JSONObject.NULL).put(1);
      else if(fmt!=3){opts.put(optionA>=1?optionA:1);if(!stylePrompt.isEmpty())opts.put(stylePrompt);}
      content.put(3).put(nested);
      for(int j=0;j<4;j++)content.put(JSONObject.NULL);
      content.put(new JSONArray().put(JSONObject.NULL).put(JSONObject.NULL).put(opts));
    }else if("quiz".equals(kind)||"flashcards".equals(kind)){
      content.put(4).put(nested);
      for(int j=0;j<5;j++)content.put(JSONObject.NULL);
      boolean quiz="quiz".equals(kind);
      JSONArray opts=new JSONArray().put(quiz?2:1).put(JSONObject.NULL)
        .put(prompt.isEmpty()?JSONObject.NULL:prompt);
      for(int j=0;j<(quiz?4:3);j++)opts.put(JSONObject.NULL);
      opts.put(new JSONArray().put(optionA>=1?optionA:2).put(optionB>=1?optionB:2));
      content.put(new JSONArray().put(JSONObject.NULL).put(opts));
    }else if("report".equals(kind)){
      String title="Study Guide".equals(format)?"Study Guide":"Blog Post".equals(format)?"Blog Post":
        "Create Your Own".equals(format)?"Custom Report":"Briefing Doc";
      String instruction=prompt.isEmpty()?"Create a detailed "+title+" based on the provided sources.":prompt;
      JSONArray options=new JSONArray().put(JSONObject.NULL).put(new JSONArray()
        .put(title).put(title).put(JSONObject.NULL).put(simple).put(lang)
        .put(instruction).put(JSONObject.NULL).put(true));
      content.put(2).put(nested).put(JSONObject.NULL).put(JSONObject.NULL)
        .put(JSONObject.NULL).put(options);
    }else if("slide_deck".equals(kind)){
      content.put(8).put(nested);
      for(int j=0;j<12;j++)content.put(JSONObject.NULL);
      content.put(new JSONArray().put(new JSONArray().put(prompt.isEmpty()?JSONObject.NULL:prompt)
        .put(lang).put(optionA>=1?optionA:1).put(optionB>=1?optionB:3)));
    }else if("infographic".equals(kind)){
      content.put(7).put(nested);
      for(int j=0;j<10;j++)content.put(JSONObject.NULL);
      content.put(new JSONArray().put(new JSONArray().put(prompt.isEmpty()?JSONObject.NULL:prompt)
        .put(lang).put(JSONObject.NULL).put(optionA>=1?optionA:1)
        .put(optionB>=1?optionB:2).put(1)));
    }else if("interactive_report".equals(kind)){
      content.put(11).put(nested);
      for(int j=0;j<30;j++)content.put(JSONObject.NULL);
      content.put(new JSONArray().put(JSONObject.NULL).put(new JSONArray().put(prompt).put(lang)));
    }else if("data_table".equals(kind)){
      content.put(9).put(nested);
      for(int j=0;j<14;j++)content.put(JSONObject.NULL);
      content.put(new JSONArray().put(JSONObject.NULL).put(new JSONArray().put(prompt).put(lang)));
    }else throw new IOException("Unsupported Studio artifact type: "+kind);
    JSONArray config=new JSONArray().put(2);
    if("interactive_report".equals(kind)){
      config.put(JSONObject.NULL).put(JSONObject.NULL);
      JSONArray template=new JSONArray().put(1);
      for(int j=0;j<9;j++)template.put(JSONObject.NULL);
      template.put(new JSONArray().put(optionA>=1?optionA:1));
      config.put(template);
      config.put(new JSONArray().put(new JSONArray().put(1).put(4).put(8).put(10).put(14).put(2).put(3).put(6)));
    }
    Object result=rpc("R7cb6c",new JSONArray().put(config).put(id).put(content),"/notebook/"+id);
    if(!(result instanceof JSONArray))throw new IOException("Studio generation not accepted");
    JSONArray artifact=((JSONArray)result).optJSONArray(0);
    if(artifact==null||artifact.optString(0).isEmpty())
      throw new IOException("Studio RPC did not return an artifact ID");
    return new JSONObject().put("artifactId",artifact.optString(0)).put("kind",kind)
      .put("notebookId",id).put("status","submitted").put("verifiedComplete",false);
  }
  /** Revises slides of a deck: creates a NEW deck (the original stays). instructions: [[index0, text], ...]. */
  JSONObject studioRevise(String notebookUrl,String artifactId,JSONArray instructions) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    Object raw=rpc("KmcKPe",new JSONArray().put(new JSONArray().put(2)).put(artifactId).put(new JSONArray().put(instructions)),"/notebook/"+id);
    JSONArray art=raw instanceof JSONArray?((JSONArray)raw).optJSONArray(0):null;
    if(art==null||art.optString(0).isEmpty())throw new IOException("Slide revision not accepted");
    return new JSONObject().put("artifactId",art.optString(0)).put("title",art.optString(1,"")).put("originalArtifactId",artifactId)
      .put("notebookId",id).put("status","submitted").put("verifiedComplete",false);
  }
  /** Exports a report (Docs) or a data table (Sheets) into the user's Google Drive. */
  JSONObject exportArtifact(String notebookUrl,String artifactId,String title,String type) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    int code="sheets".equals(type)?2:1;
    Object raw=rpc("Krh3pd",new JSONArray().put(JSONObject.NULL).put(artifactId).put(JSONObject.NULL).put(title).put(code),"/notebook/"+id);
    String url=null;
    if(raw instanceof JSONArray){
      JSONArray r=(JSONArray)raw;Object first=r.opt(0);
      if(first instanceof JSONArray){Object inner=((JSONArray)first).opt(0);url=inner instanceof JSONArray?((JSONArray)inner).optString(0,null):inner instanceof String?(String)inner:null;}
      else if(first instanceof String)url=(String)first;
    }
    if(url==null||!url.startsWith("https://"))throw new IOException("Export not confirmed by NotebookLM");
    return new JSONObject().put("exported",true).put("url",url).put("type",code==2?"sheets":"docs").put("title",title);
  }
  /** AI summary of the notebook and suggested topics. */
  JSONObject describeNotebook(String notebookUrl) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    Object raw=rpc("VfAZjd",new JSONArray().put(id).put(new JSONArray().put(2)),"/notebook/"+id);
    String summary="";JSONArray topics=new JSONArray();
    if(raw instanceof JSONArray){
      JSONArray r=(JSONArray)raw;
      JSONArray s0=r.optJSONArray(0);if(s0!=null)summary=s0.optString(0,"");
      JSONArray t1=r.optJSONArray(1);JSONArray list=t1==null?null:t1.optJSONArray(0);
      if(list!=null)for(int j=0;j<list.length();j++){JSONArray t=list.optJSONArray(j);if(t!=null&&t.length()>=2)topics.put(new JSONObject().put("question",t.optString(0)).put("prompt",t.optString(1)));}
    }
    return new JSONObject().put("notebookId",id).put("summary",summary).put("suggestedTopics",topics);
  }
  // ---- Ported from jacob-bd/notebooklm-mcp-cli (MIT, Jacob Ben David): chats, source search, Drive freshness, collections ----
  private static JSONArray consumerHeader(){
    JSONArray inner=new JSONArray().put(1);for(int j=0;j<9;j++)inner.put(JSONObject.NULL);inner.put(new JSONArray().put(1).put(3));
    return new JSONArray().put(2).put(JSONObject.NULL).put(new JSONArray().put(1)).put(inner);
  }
  /** Chat goal (default | custom with prompt | learning_guide) and answer length (default | longer | shorter). */
  JSONObject chatConfigure(String notebookUrl,String goal,String customPrompt,String length) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    int g="custom".equals(goal)?2:"learning_guide".equals(goal)?3:1;
    int l="longer".equals(length)?4:"shorter".equals(length)?5:1;
    JSONArray goalSetting=new JSONArray().put(g);
    if(g==2){if(customPrompt==null||customPrompt.isEmpty())throw new IOException("customPrompt required for goal=custom");goalSetting.put(customPrompt);}
    JSONArray settings=new JSONArray().put(goalSetting).put(new JSONArray().put(l));
    JSONArray holder=new JSONArray();for(int j=0;j<7;j++)holder.put(JSONObject.NULL);holder.put(settings);
    Object raw=rpc("s0tc2d",new JSONArray().put(id).put(new JSONArray().put(holder)),"/notebook/"+id);
    if(raw==null)throw new IOException("Chat settings not confirmed");
    return new JSONObject().put("notebookId",id).put("goal",goal).put("responseLength",length).put("configured",true);
  }
  private String conversationId(String id) throws Exception {
    Object raw=rpc("hPTbtc",new JSONArray().put(new JSONArray()).put(JSONObject.NULL).put(id).put(20),"/notebook/"+id);
    if(raw instanceof JSONArray){Object l1=((JSONArray)raw).opt(0);
      if(l1 instanceof JSONArray){Object l2=((JSONArray)l1).opt(0);
        if(l2 instanceof String)return (String)l2;
        if(l2 instanceof JSONArray&&((JSONArray)l2).opt(0) instanceof String)return ((JSONArray)l2).optString(0);}}
    return null;
  }
  /** The notebook's chat history (questions and answers, oldest first). */
  JSONObject chatGet(String notebookUrl,int limit) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    String conv=conversationId(id);
    JSONArray turns=new JSONArray();
    if(conv!=null){
      Object raw=rpc("khqZz",new JSONArray().put(consumerHeader()).put(JSONObject.NULL).put(JSONObject.NULL).put(conv).put(Math.max(1,Math.min(100,limit))),"/notebook/"+id);
      JSONArray list=raw instanceof JSONArray?((JSONArray)raw).optJSONArray(0):null;
      java.util.List<String[]> pairs=new java.util.ArrayList<>();String answer=null;
      if(list!=null)for(int j=0;j<list.length();j++){
        JSONArray e=list.optJSONArray(j);if(e==null||e.length()<3)continue;
        int type=e.optInt(2);
        if(type==2){JSONArray c=e.optJSONArray(4);JSONArray w=c==null?null:c.optJSONArray(0);answer=w==null?"":w.optString(0,"");}
        else if(type==1&&answer!=null){pairs.add(new String[]{e.optString(3,""),answer});answer=null;}
      }
      java.util.Collections.reverse(pairs);
      for(int j=0;j<pairs.size();j++)turns.put(new JSONObject().put("turn",j+1).put("question",pairs.get(j)[0]).put("answer",pairs.get(j)[1]));
    }
    return new JSONObject().put("notebookId",id).put("conversationId",conv==null?JSONObject.NULL:conv).put("turnCount",turns.length()).put("turns",turns);
  }
  /** Permanently deletes the notebook's chat history (confirm=true only after the user's explicit yes). */
  JSONObject chatDelete(String notebookUrl,boolean confirm) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    String conv=conversationId(id);
    if(conv==null)return new JSONObject().put("notebookId",id).put("deleted",false).put("reason","no chat history");
    if(!confirm)return new JSONObject().put("notebookId",id).put("conversationId",conv).put("deleted",false).put("requiresConfirmation",true);
    Object raw=rpc("J7Gthc",new JSONArray().put(consumerHeader()).put(conv).put(JSONObject.NULL).put(1),"/notebook/"+id);
    if(raw==null)throw new IOException("Deletion not confirmed by NotebookLM");
    return new JSONObject().put("notebookId",id).put("conversationId",conv).put("deleted",true);
  }
  /** Passages of the notebook's sources matching a query (excerpts with their source). */
  JSONObject sourceSearch(String notebookUrl,String query,JSONArray sourceIds,int max) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    JSONObject nb=getNotebook(notebookUrl);JSONArray srcs=nb.getJSONArray("sources");
    java.util.Map<String,String> titles=new java.util.HashMap<>();
    for(int j=0;j<srcs.length();j++){JSONObject o=srcs.getJSONObject(j);titles.put(o.optString("id").toLowerCase(),o.optString("title"));}
    JSONArray params=new JSONArray().put(id).put(query).put(JSONObject.NULL).put(new JSONArray().put(1));
    if(sourceIds!=null&&sourceIds.length()>0){for(int j=0;j<sourceIds.length();j++)if(!titles.containsKey(sourceIds.getString(j).toLowerCase()))throw new IOException("Unknown source ID for this notebook");params.put(new JSONArray().put(sourceIds));}
    Object raw=rpc("ASU5Oe",params,"/notebook/"+id);
    JSONArray groups=raw instanceof JSONArray?((JSONArray)raw).optJSONArray(0):null;
    if(groups==null)throw new IOException("NotebookLM returned an unrecognized search result");
    java.util.LinkedHashMap<String,java.util.List<String>> by=new java.util.LinkedHashMap<>();
    for(int j=0;j<groups.length();j++){
      JSONArray g=groups.optJSONArray(j);if(g==null||g.length()!=2||!(g.opt(0) instanceof String))continue;
      String sid=g.optString(0).toLowerCase();if(!titles.containsKey(sid))continue;
      JSONArray items=g.optJSONArray(1);if(items==null)continue;
      java.util.List<String> ps=by.computeIfAbsent(sid,k->new java.util.ArrayList<>());
      for(int k=0;k<items.length();k++){
        JSONArray it=items.optJSONArray(k);JSONArray a=it==null?null:it.optJSONArray(0);JSONArray b=a==null?null:a.optJSONArray(0);JSONArray c=b==null?null:b.optJSONArray(0);
        if(c!=null&&c.opt(0) instanceof String&&!c.optString(0).trim().isEmpty())ps.add(c.optString(0));
      }
    }
    // Round robin over sources so one long source cannot fill the answer.
    JSONArray hits=new JSONArray();int total=0;for(java.util.List<String> l:by.values())total+=l.size();
    for(int depth=0;hits.length()<max;depth++){
      boolean any=false;
      for(java.util.Map.Entry<String,java.util.List<String>> en:by.entrySet()){
        if(hits.length()>=max)break;if(en.getValue().size()<=depth)continue;any=true;
        String t=en.getValue().get(depth);
        hits.put(new JSONObject().put("sourceId",en.getKey()).put("sourceTitle",titles.get(en.getKey())).put("excerpt",t.length()>900?t.substring(0,900):t).put("truncated",t.length()>900));
      }
      if(!any)break;
    }
    return new JSONObject().put("notebookId",id).put("query",query).put("returned",hits.length()).put("available",total).put("results",hits);
  }
  /** Drive sources and whether each is up to date with Google Drive (source_sync_drive refreshes stale ones). */
  JSONObject sourceListDrive(String notebookUrl) throws Exception {
    JSONObject nb=getNotebook(notebookUrl);JSONArray srcs=nb.getJSONArray("sources");JSONArray out=new JSONArray();int stale=0;
    for(int j=0;j<srcs.length();j++){
      JSONObject o=srcs.getJSONObject(j);
      JSONObject e=new JSONObject().put("id",o.opt("id")).put("title",o.optString("title")).put("sourceType",o.opt("sourceType")).put("status",o.optString("status"));
      if(o.has("driveDocumentId")){
        e.put("drive",true).put("driveDocumentId",o.optString("driveDocumentId"));
        Boolean fresh=null;
        try{Object raw=rpc("yR9Yof",new JSONArray().put(JSONObject.NULL).put(new JSONArray().put(o.optString("id"))).put(new JSONArray().put(2)),"/");
          JSONArray inner=raw instanceof JSONArray?((JSONArray)raw).optJSONArray(0):null;
          if(inner!=null&&inner.length()>=2&&inner.opt(1) instanceof Boolean)fresh=inner.optBoolean(1);}catch(Exception ignored){}
        e.put("fresh",fresh==null?JSONObject.NULL:fresh);if(Boolean.FALSE.equals(fresh))stale++;
      }else e.put("drive",false);
      out.put(e);
    }
    return new JSONObject().put("notebookId",nb.optString("id")).put("sources",out).put("staleDriveSources",stale);
  }
  private static JSONArray collectionsHeader(){return consumerHeader();}
  private static JSONArray readCollections(Object raw,String skipName) throws Exception {
    JSONArray out=new JSONArray();
    JSONArray list=raw instanceof JSONArray?((JSONArray)raw).optJSONArray(2):null;
    if(list!=null)for(int j=0;j<list.length();j++){JSONArray c=list.optJSONArray(j);if(c==null||c.length()<3)continue;
      if(skipName!=null&&skipName.equals(c.optString(0)))continue;
      out.put(new JSONObject().put("id",c.optString(2)).put("name",c.optString(0)).put("notebookIds",c.optJSONArray(1)==null?new JSONArray():c.optJSONArray(1)).put("emoji",c.optString(3,"")));}
    return out;
  }
  private static String tempCollectionId(Object raw,String name){
    JSONArray list=raw instanceof JSONArray?((JSONArray)raw).optJSONArray(2):null;
    if(list!=null)for(int j=0;j<list.length();j++){JSONArray c=list.optJSONArray(j);if(c!=null&&name.equals(c.optString(0)))return c.optString(2);}
    return null;
  }
  /** NotebookLM has no read call for collections: a temporary hidden one is created, read, then deleted (as the original tool). */
  JSONObject collectionList() throws Exception {
    String temp="_temp_list_query_"+java.util.UUID.randomUUID().toString().replace("-","");
    Object raw=rpc("agX4Bc",new JSONArray().put(collectionsHeader()).put(JSONObject.NULL).put(JSONObject.NULL).put(JSONObject.NULL).put(JSONObject.NULL)
      .put(new JSONArray().put(new JSONArray().put(temp)).put(JSONObject.NULL).put(new JSONArray())).put(3),"/");
    String tempId=tempCollectionId(raw,temp);
    JSONArray cols=readCollections(raw,temp);
    if(tempId==null)throw new IOException("Collection listing could not identify its temporary entry "+temp+": check NotebookLM");
    rpc("GyzE7e",new JSONArray().put(collectionsHeader()).put(JSONObject.NULL).put(new JSONArray().put(tempId)).put(3),"/");
    return new JSONObject().put("collections",cols).put("count",cols.length());
  }
  JSONObject collectionCreate(String name,JSONArray notebookUrls) throws Exception {
    JSONArray ids=new JSONArray();for(int j=0;j<notebookUrls.length();j++)ids.put(ownedNotebookId(notebookUrls.getString(j)));
    Object raw=rpc("agX4Bc",new JSONArray().put(collectionsHeader()).put(JSONObject.NULL).put(JSONObject.NULL).put(JSONObject.NULL).put(JSONObject.NULL)
      .put(new JSONArray().put(new JSONArray().put(name)).put(JSONObject.NULL).put(ids)).put(3),"/");
    String cid=tempCollectionId(raw,name);
    if(cid==null)throw new IOException("Collection creation not confirmed");
    return new JSONObject().put("id",cid).put("name",name).put("notebookIds",ids).put("created",true);
  }
  /** One change per call, as NotebookLM expects: rename, add notebooks, remove notebooks, or set the emoji. */
  JSONObject collectionEdit(String collectionId,String name,JSONArray addUrls,JSONArray removeUrls,String emoji) throws Exception {
    JSONArray done=new JSONArray();
    if(name!=null&&!name.isEmpty()){rpc("le8sX",new JSONArray().put(collectionsHeader()).put(JSONObject.NULL).put(collectionId).put(new JSONArray().put(new JSONArray().put(new JSONArray().put(name)))).put(3),"/");done.put("renamed");}
    if(addUrls!=null&&addUrls.length()>0){JSONArray ids=new JSONArray();for(int j=0;j<addUrls.length();j++)ids.put(ownedNotebookId(addUrls.getString(j)));
      rpc("le8sX",new JSONArray().put(collectionsHeader()).put(JSONObject.NULL).put(collectionId).put(new JSONArray().put(new JSONArray().put(JSONObject.NULL).put(JSONObject.NULL).put(JSONObject.NULL).put(new JSONArray().put(ids))).put(new JSONArray())).put(3),"/");done.put("added "+ids.length());}
    if(removeUrls!=null&&removeUrls.length()>0){JSONArray ids=new JSONArray();for(int j=0;j<removeUrls.length();j++)ids.put(ownedNotebookId(removeUrls.getString(j)));
      rpc("le8sX",new JSONArray().put(collectionsHeader()).put(JSONObject.NULL).put(collectionId).put(new JSONArray().put(new JSONArray().put(JSONObject.NULL).put(JSONObject.NULL).put(JSONObject.NULL).put(JSONObject.NULL).put(new JSONArray().put(ids))).put(new JSONArray())).put(3),"/");done.put("removed "+ids.length());}
    if(emoji!=null){rpc("le8sX",new JSONArray().put(collectionsHeader()).put(JSONObject.NULL).put(collectionId).put(new JSONArray().put(new JSONArray().put(new JSONArray().put(JSONObject.NULL).put(emoji)))).put(3),"/");done.put("emoji");}
    return new JSONObject().put("id",collectionId).put("changes",done);
  }
  /** Deletes a collection only (its notebooks stay). */
  JSONObject collectionDelete(String collectionId,boolean confirm) throws Exception {
    if(!confirm)return new JSONObject().put("id",collectionId).put("deleted",false).put("requiresConfirmation",true);
    rpc("GyzE7e",new JSONArray().put(collectionsHeader()).put(JSONObject.NULL).put(new JSONArray().put(collectionId)).put(3),"/");
    return new JSONObject().put("id",collectionId).put("deleted",true).put("notebooksKept",true);
  }
  JSONObject studioStatus(String notebookUrl) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    Object raw=rpc("gArtLc",new JSONArray().put(new JSONArray().put(2)).put(id)
      .put("NOT artifact.status = \"ARTIFACT_STATUS_SUGGESTED\""),"/notebook/"+id);
    if(!(raw instanceof JSONArray))throw new IOException("Studio status unavailable");
    JSONArray outer=(JSONArray)raw,items=outer.optJSONArray(0);
    if(items==null)items=outer;
    JSONArray output=new JSONArray();
    for(int j=0;j<items.length();j++){
      JSONArray a=items.optJSONArray(j);if(a==null||a.length()<5)continue;
      int type=a.optInt(2,-1),status=a.optInt(4,-1);
      JSONObject entry=new JSONObject().put("id",a.optString(0)).put("title",a.optString(1))
        .put("typeCode",type).put("statusCode",status);
      String mediaUrl=null;
      if(type==1){
        JSONArray options=a.optJSONArray(6),media=options==null?null:options.optJSONArray(5);
        if(media!=null){
          for(int k=0;k<media.length();k++){
            JSONArray candidate=media.optJSONArray(k);
            if(candidate==null)continue;
            String url=candidate.optString(0,"");
            if(url.startsWith("https://")&&"audio/mp4".equals(candidate.optString(2))){
              if(mediaUrl==null||url.endsWith("-dv"))mediaUrl=url;
            }
          }
        }
        if(mediaUrl==null&&options!=null&&options.optString(3,"").startsWith("https://"))
          mediaUrl=options.optString(3);
      }else if(type==3){
        JSONArray options=a.optJSONArray(8);
        if(options!=null&&options.optString(3,"").startsWith("https://"))
          mediaUrl=options.optString(3);
      }
      if(mediaUrl!=null)entry.put("mediaUrl",mediaUrl);
      String label=status==1?"in_progress":status==3?"completed":status==4?"failed":
        status==5?"suggested":status==2?"queued":"unknown";
      if(type==1&&status==2&&mediaUrl!=null)label="completed";
      entry.put("status",label);
      output.put(entry);
    }
    return new JSONObject().put("notebookId",id).put("artifacts",output).put("count",output.length());
  }
  JSONObject mindMapCreate(String notebookUrl,String title) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    JSONArray nested=studioSources(notebookUrl,true),simple=studioSources(notebookUrl,false);
    JSONArray params=new JSONArray().put(nested);
    for(int j=0;j<4;j++)params.put(JSONObject.NULL);
    params.put(new JSONArray().put("interactive_mindmap")
      .put(new JSONArray().put(new JSONArray().put("[CONTEXT]").put(""))).put(""));
    params.put(JSONObject.NULL).put(new JSONArray().put(2).put(JSONObject.NULL).put(new JSONArray().put(1)));
    Object raw=rpc("yyryJe",params,"/notebook/"+id);
    if(!(raw instanceof JSONArray))throw new IOException("Mind map generation failed");
    JSONArray generated=((JSONArray)raw).optJSONArray(0);
    if(generated==null||!(generated.opt(0) instanceof String))throw new IOException("No mind map JSON returned");
    String json=generated.getString(0);
    if(json.length()>1_000_000)throw new IOException("Mind map exceeds safety limit");
    JSONArray metadata=new JSONArray().put(2).put(JSONObject.NULL).put(JSONObject.NULL).put(5).put(simple);
    Object saved=rpc("CYK0Xb",new JSONArray().put(id).put(json).put(metadata)
      .put(JSONObject.NULL).put(title==null||title.trim().isEmpty()?"Mind Map":title.trim()),"/notebook/"+id);
    if(!(saved instanceof JSONArray))throw new IOException("Mind map save not confirmed");
    JSONArray item=((JSONArray)saved).optJSONArray(0);
    if(item==null||item.optString(0).isEmpty())throw new IOException("Mind map ID missing after save");
    return new JSONObject().put("mindMapId",item.optString(0)).put("title",item.optString(4,title))
      .put("notebookId",id).put("saved",true);
  }
  JSONObject shareStatus(String notebookUrl) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    Object raw=rpc("JFMDGd",new JSONArray().put(id).put(new JSONArray().put(2)),"/");
    if(!(raw instanceof JSONArray))throw new IOException("Sharing status unavailable");
    // Preserve raw response; do not infer public access from a partial response.
    return new JSONObject().put("notebookId",id).put("shareData",(JSONArray)raw);
  }

  JSONObject queryNotebook(String notebookUrl,String question) throws Exception { return queryNotebook(notebookUrl,question,null); }

  /** sourceIds (optional) limits the answer to those READY sources. */
  JSONObject queryNotebook(String notebookUrl,String question,JSONArray sourceIds) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    if(question==null||question.trim().isEmpty()||question.length()>10000)
      throw new IOException("Question required (max 10000 characters)");
    JSONArray ready=getNotebook(notebookUrl).getJSONArray("sources");
    JSONArray sources=new JSONArray();
    for(int i=0;i<ready.length();i++){
      JSONObject src=ready.getJSONObject(i);
      if(!"ready".equals(src.optString("status"))||src.optString("id").isEmpty())continue;
      if(sourceIds!=null&&sourceIds.length()>0){
        boolean wanted=false;
        for(int k=0;k<sourceIds.length();k++)if(src.getString("id").equals(sourceIds.optString(k)))wanted=true;
        if(!wanted)continue;
      }
      sources.put(new JSONArray().put(new JSONArray().put(src.getString("id"))));
    }
    if(sources.length()==0)throw new IOException(sourceIds!=null&&sourceIds.length()>0?"None of the requested sources is ready in this notebook":"No ready NotebookLM sources to query");
    String page=request(HOME,"GET",null);
    String csrf=field(page,"SNlM0e"),sid=field(page,"FdrFJe"),bl=field(page,"cfb2h");
    if(csrf.isEmpty())throw new IOException("NotebookLM session token missing");
    String convId=java.util.UUID.randomUUID().toString();
    JSONArray params=new JSONArray().put(sources).put(question).put(JSONObject.NULL)
      .put(new JSONArray().put(2).put(JSONObject.NULL).put(new JSONArray().put(1))).put(convId);
    JSONArray req=new JSONArray().put(JSONObject.NULL).put(params.toString());
    String endpoint=HOME+"_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed";
    String url=endpoint+"?hl=fr&rt=c&_reqid=100000";
    if(!bl.isEmpty())url+="&bl="+URLEncoder.encode(bl,"UTF-8");
    if(!sid.isEmpty())url+="&f.sid="+URLEncoder.encode(sid,"UTF-8");
    String body="f.req="+URLEncoder.encode(req.toString(),"UTF-8")+"&at="+URLEncoder.encode(csrf,"UTF-8")+"&";
    String stream=request(url,"POST",body,120000);
    String answer="",thinking="";
    for(String line:stream.replace(")]}'","").split("\\r?\\n")){
      if(!line.trim().startsWith("["))continue;
      JSONArray frames;
      try{frames=new JSONArray(line);}catch(Exception ignored){continue;}
      for(int i=0;i<frames.length();i++){
        JSONArray frame=frames.optJSONArray(i);
        if(frame==null||!"wrb.fr".equals(frame.optString(0)))continue;
        JSONArray error=frame.optJSONArray(5);
        if(frame.isNull(2)&&error!=null&&error.length()>0)
          throw new IOException("NotebookLM query rejected (code "+error.optInt(0)+")");
        String payload=frame.optString(2,"");
        if(payload.isEmpty())continue;
        JSONArray parsed;
        try{parsed=new JSONArray(payload);}catch(Exception ignored){continue;}
        JSONArray first=parsed.optJSONArray(0);if(first==null)continue;
        String text=first.optString(0,"");
        JSONArray type=first.optJSONArray(4);
        boolean actual=type!=null&&type.optInt(type.length()-1,-1)==1;
        if(actual&&text.length()>answer.length())answer=text;
        else if(!actual&&text.length()>thinking.length())thinking=text;
        JSONArray conv=first.optJSONArray(2);
        if(conv!=null&&!conv.optString(0).isEmpty())convId=conv.optString(0);
      }
    }
    if(answer.isEmpty())throw new IOException("NotebookLM returned no final answer; do not present thinking as answer");
    return new JSONObject().put("answer",answer).put("conversationId",convId)
      .put("notebookId",id).put("sourceCount",sources.length())
      .put("citationsVerified",false).put("followUpHistorySupported",false);
  }

  JSONObject sharePublic(String notebookUrl,boolean makePublic,boolean confirmed) throws Exception {
    if(!confirmed)throw new IOException("Sharing change requires explicit confirmation");
    String id=ownedNotebookId(notebookUrl);
    JSONArray item=new JSONArray().put(id).put(JSONObject.NULL)
      .put(new JSONArray().put(makePublic?1:0)).put(new JSONArray().put(0).put(""));
    Object raw=rpc("QDyure",new JSONArray().put(new JSONArray().put(item))
      .put(1).put(JSONObject.NULL).put(new JSONArray().put(2)),"/");
    if(raw==null)throw new IOException("NotebookLM did not confirm sharing request");
    return new JSONObject().put("notebookId",id).put("requestedPublic",makePublic)
      .put("shareUrl",makePublic?HOME+"notebook/"+id:JSONObject.NULL)
      .put("operationAccepted",true).put("shareStatusRecheckRequired",true);
  }
  JSONObject shareInvite(String notebookUrl,String email,String role,boolean confirmed) throws Exception {
    if(!confirmed)throw new IOException("Invitation requires explicit user confirmation");
    if(email==null||!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"))
      throw new IOException("Invalid collaborator email");
    if(!"viewer".equals(role)&&!"editor".equals(role))throw new IOException("Invalid role");
    String id=ownedNotebookId(notebookUrl);
    JSONArray invite=new JSONArray().put(email).put(JSONObject.NULL).put("editor".equals(role)?2:3);
    JSONArray item=new JSONArray().put(id).put(new JSONArray().put(invite))
      .put(JSONObject.NULL).put(new JSONArray().put(0).put(""));
    Object raw=rpc("QDyure",new JSONArray().put(new JSONArray().put(item))
      .put(1).put(JSONObject.NULL).put(new JSONArray().put(2)),"/");
    if(raw==null)throw new IOException("NotebookLM did not confirm invitation");
    return new JSONObject().put("notebookId",id).put("email",email).put("role",role)
      .put("operationAccepted",true).put("shareStatusRecheckRequired",true);
  }

  JSONObject artifactDownloadLink(String notebookUrl,String artifactId) throws Exception {
    if(artifactId==null||!artifactId.matches("[A-Za-z0-9_-]{8,128}"))
      throw new IOException("Invalid artifact ID");
    JSONArray artifacts=studioStatus(notebookUrl).getJSONArray("artifacts");
    for(int j=0;j<artifacts.length();j++){
      JSONObject item=artifacts.getJSONObject(j);
      if(!artifactId.equals(item.optString("id")))continue;
      if(!"completed".equals(item.optString("status")))
        throw new IOException("Artifact is not completed");
      String media=item.optString("mediaUrl","");
      if(media.isEmpty())throw new IOException("Artifact has no downloadable media URL");
      return new JSONObject().put("artifactId",artifactId).put("downloadUrl",media)
        .put("typeCode",item.optInt("typeCode")).put("title",item.optString("title"))
        .put("warning","Signed media URLs may expire; remote agents may need authenticated download proxy");
    }
    throw new IOException("Artifact not found in notebook Studio");
  }

  private JSONObject requireSource(String notebookUrl,String sourceId) throws Exception {
    if(sourceId==null||!sourceId.matches("[A-Za-z0-9_-]{8,128}"))
      throw new IOException("Invalid source ID");
    JSONArray sources=sourceList(notebookUrl).getJSONArray("sources");
    for(int i=0;i<sources.length();i++){
      JSONObject src=sources.getJSONObject(i);
      if(sourceId.equals(src.optString("id")))return src;
    }
    throw new IOException("Source not found in this notebook");
  }
  JSONObject sourceRename(String notebookUrl,String sourceId,String title) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    requireSource(notebookUrl,sourceId);
    if(title==null||title.trim().isEmpty()||title.length()>200)
      throw new IOException("Invalid source title");
    rpc("b7Wfje",new JSONArray().put(JSONObject.NULL).put(new JSONArray().put(sourceId))
      .put(new JSONArray().put(new JSONArray().put(new JSONArray().put(title.trim())))),"/notebook/"+id);
    JSONObject updated=requireSource(notebookUrl,sourceId);
    if(!title.trim().equals(updated.optString("title")))
      throw new IOException("Source rename not yet verified");
    return new JSONObject().put("sourceId",sourceId).put("title",title.trim()).put("verified",true);
  }
  JSONObject sourceSyncDrive(String notebookUrl,String sourceId) throws Exception {
    requireSource(notebookUrl,sourceId);
    Object raw=rpc("FLmJqe",new JSONArray().put(JSONObject.NULL)
      .put(new JSONArray().put(sourceId)).put(new JSONArray().put(2)),"/");
    if(!(raw instanceof JSONArray))throw new IOException("Drive source sync not accepted");
    return new JSONObject().put("sourceId",sourceId).put("syncRequested",true)
      .put("status","pending_verification").put("checkWith","source_list");
  }
  JSONObject sourceDelete(String notebookUrl,String sourceId,String expectedTitle,boolean confirm) throws Exception {
    if(!confirm)throw new IOException("Source deletion requires explicit user confirmation");
    JSONObject src=requireSource(notebookUrl,sourceId);
    if(expectedTitle==null||!expectedTitle.equals(src.optString("title")))
      throw new IOException("Source title changed; re-confirm deletion");
    rpc("tGMBJ",new JSONArray().put(new JSONArray().put(new JSONArray().put(sourceId)))
      .put(new JSONArray().put(2)),"/");
    JSONArray after=sourceList(notebookUrl).getJSONArray("sources");
    for(int i=0;i<after.length();i++)if(sourceId.equals(after.getJSONObject(i).optString("id")))
      throw new IOException("Source deletion not verified");
    return new JSONObject().put("sourceId",sourceId).put("deleted",true).put("verified",true);
  }

  JSONObject studioGet(String notebookUrl,String artifactId) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    if(artifactId==null||!artifactId.matches("[A-Za-z0-9_-]{8,128}"))
      throw new IOException("Invalid artifact ID");
    JSONArray allowed=new JSONArray();
    int[] types={1,4,8,10,14,2,3,6,7};
    for(int type:types)allowed.put(type);
    JSONArray flags=new JSONArray().put(1);
    for(int j=0;j<9;j++)flags.put(JSONObject.NULL);
    flags.put(new JSONArray().put(1));
    JSONArray config=new JSONArray().put(2).put(JSONObject.NULL).put(JSONObject.NULL)
      .put(flags).put(new JSONArray().put(allowed));
    Object raw=rpc("v9rmvd",new JSONArray().put(artifactId).put(config),"/notebook/"+id);
    if(!(raw instanceof JSONArray))throw new IOException("Artifact details unavailable");
    JSONArray a=((JSONArray)raw).optJSONArray(0);
    if(a==null||!artifactId.equals(a.optString(0)))throw new IOException("Artifact ID mismatch");
    if(a.toString().length()>350000)throw new IOException("Artifact too large for relay JSON response");
    return new JSONObject().put("artifactId",artifactId).put("notebookId",id)
      .put("typeCode",a.optInt(2,-1)).put("rawArtifact",a)
      .put("format","notebooklm-native-artifact");
  }

  JSONObject researchStart(String notebookUrl,String query,String source,String mode) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    if(query==null||query.trim().isEmpty()||query.length()>3000)
      throw new IOException("Research query required, max 3000 characters");
    if(!"web".equals(source)&&!"drive".equals(source))throw new IOException("Invalid research source");
    if(!"fast".equals(mode)&&!"deep".equals(mode))throw new IOException("Invalid research mode");
    if("deep".equals(mode)&&"drive".equals(source))throw new IOException("Deep Drive research unsupported");
    int sourceCode="web".equals(source)?1:2;
    JSONArray params;
    String rpcId;
    if("fast".equals(mode)){
      rpcId="Ljjv0c";
      params=new JSONArray().put(new JSONArray().put(query).put(sourceCode))
        .put(JSONObject.NULL).put(1).put(id);
    }else{
      rpcId="QA9ei";
      params=new JSONArray().put(JSONObject.NULL).put(new JSONArray().put(1))
        .put(new JSONArray().put(query).put(sourceCode)).put(5).put(id);
    }
    Object raw=rpc(rpcId,params,"/notebook/"+id);
    if(!(raw instanceof JSONArray))throw new IOException("Research start not accepted");
    JSONArray result=(JSONArray)raw;
    if(result.optString(0).isEmpty())throw new IOException("Research task ID missing");
    return new JSONObject().put("taskId",result.optString(0))
      .put("reportId",result.optString(1)).put("notebookId",id)
      .put("source",source).put("mode",mode).put("status","started");
  }
  JSONObject researchStatus(String notebookUrl,String taskId) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    Object raw=rpc("e3bVqc",new JSONArray().put(JSONObject.NULL).put(JSONObject.NULL).put(id),"/notebook/"+id);
    if(!(raw instanceof JSONArray))throw new IOException("Research status unavailable");
    JSONArray items=(JSONArray)raw;
    if(items.optJSONArray(0)!=null&&items.optJSONArray(0).optJSONArray(0)!=null)
      items=items.getJSONArray(0);
    JSONArray tasks=new JSONArray();
    for(int j=0;j<items.length();j++){
      JSONArray item=items.optJSONArray(j);
      if(item==null||!(item.opt(0) instanceof String))continue;
      String foundId=item.optString(0);
      if(taskId!=null&&!taskId.isEmpty()&&!taskId.equals(foundId))continue;
      JSONArray info=item.optJSONArray(1);
      if(info==null)continue;
      JSONArray queryInfo=info.optJSONArray(1);
      JSONObject t=new JSONObject().put("taskId",foundId)
        .put("query",queryInfo==null?"":queryInfo.optString(0))
        .put("modeCode",info.opt(2)).put("statusCode",info.opt(4));
      JSONArray discovered=info.optJSONArray(3);
      if(discovered!=null){
        if(discovered.toString().length()>180000)throw new IOException("Research results exceed relay limit");
        t.put("discoveredRaw",discovered);
      }
      tasks.put(t);
    }
    return new JSONObject().put("notebookId",id).put("tasks",tasks).put("count",tasks.length())
      .put("note","Raw discovered results are untrusted; import only user-selected URLs");
  }
  JSONObject researchImport(String notebookUrl,String taskId,JSONArray sources,boolean confirm) throws Exception {
    if(!confirm)throw new IOException("Research source import requires confirmation");
    String id=ownedNotebookId(notebookUrl);
    if(taskId==null||taskId.isEmpty()||sources==null||sources.length()==0||sources.length()>50)
      throw new IOException("Invalid research import selection");
    JSONArray payload=new JSONArray();
    for(int i=0;i<sources.length();i++){
      JSONObject source=sources.getJSONObject(i);
      String url=source.optString("url"),title=source.optString("title","Untitled");
      if(!url.startsWith("https://")||url.length()>3000)
        throw new IOException("Research source URL must be HTTPS");
      if(title.length()>250)throw new IOException("Research source title too long");
      JSONArray row=new JSONArray().put(JSONObject.NULL).put(JSONObject.NULL)
        .put(new JSONArray().put(url).put(title));
      for(int j=0;j<7;j++)row.put(JSONObject.NULL);
      row.put(2);
      payload.put(row);
    }
    Object raw=rpc("LBwxtb",new JSONArray().put(JSONObject.NULL).put(new JSONArray().put(1))
      .put(taskId).put(id).put(payload),"/notebook/"+id);
    if(!(raw instanceof JSONArray))throw new IOException("Research import not confirmed");
    return new JSONObject().put("notebookId",id).put("taskId",taskId)
      .put("requestedSources",sources.length()).put("status","accepted")
      .put("verifyWith","source_list");
  }

  JSONArray noteListInternal(String id) throws Exception {
    Object raw=rpc("cFji9",new JSONArray().put(id),"/notebook/"+id);
    if(!(raw instanceof JSONArray))throw new IOException("NotebookLM notes unavailable");
    JSONArray items=((JSONArray)raw).optJSONArray(0),output=new JSONArray();
    if(items==null)return output;
    for(int j=0;j<items.length();j++){
      JSONArray item=items.optJSONArray(j);
      if(item==null||item.optInt(2,-1)==2)continue;
      JSONArray note=item.optJSONArray(1);
      if(note==null||note.length()<5)continue;
      String content=note.optString(1,"");
      if(content.trim().startsWith("{")&&content.contains("\"nodes\""))continue;
      output.put(new JSONObject().put("id",item.optString(0))
        .put("title",note.optString(4)).put("content",content));
    }
    return output;
  }
  JSONObject noteManage(String notebookUrl,String action,String noteId,String title,String content,boolean confirm) throws Exception {
    String id=ownedNotebookId(notebookUrl);
    if("list".equals(action))return new JSONObject().put("notebookId",id).put("notes",noteListInternal(id));
    if("create".equals(action)){
      if(title==null||title.isEmpty())title="New Note";
      Object raw=rpc("CYK0Xb",new JSONArray().put(id).put("")
        .put(new JSONArray().put(1)).put(JSONObject.NULL).put(title),"/notebook/"+id);
      if(!(raw instanceof JSONArray))throw new IOException("Note creation not accepted");
      JSONArray a=((JSONArray)raw).optJSONArray(0);
      String newId=a==null?"":a.optString(0);
      if(newId.isEmpty())throw new IOException("New note ID missing");
      if(content!=null&&!content.isEmpty())
        rpc("cYAfTb",new JSONArray().put(id).put(newId)
          .put(new JSONArray().put(new JSONArray().put(new JSONArray()
            .put(content).put(title).put(new JSONArray()).put(0)))),"/notebook/"+id);
      return new JSONObject().put("id",newId).put("title",title).put("created",true);
    }
    if(noteId==null||noteId.isEmpty())throw new IOException("Note ID required");
    JSONArray notes=noteListInternal(id);
    JSONObject existing=null;
    for(int j=0;j<notes.length();j++)if(noteId.equals(notes.getJSONObject(j).optString("id")))
      existing=notes.getJSONObject(j);
    if(existing==null)throw new IOException("Note not found");
    if("update".equals(action)){
      String newTitle=title==null||title.isEmpty()?existing.optString("title"):title;
      String newContent=content==null?existing.optString("content"):content;
      rpc("cYAfTb",new JSONArray().put(id).put(noteId)
        .put(new JSONArray().put(new JSONArray().put(new JSONArray()
          .put(newContent).put(newTitle).put(new JSONArray()).put(0)))),"/notebook/"+id);
      return new JSONObject().put("id",noteId).put("updated",true);
    }
    if("delete".equals(action)){
      if(!confirm)throw new IOException("Deleting a note requires confirmation");
      rpc("AH0mwd",new JSONArray().put(id).put(JSONObject.NULL)
        .put(new JSONArray().put(noteId)),"/notebook/"+id);
      return new JSONObject().put("id",noteId).put("deleteRequested",true);
    }
    throw new IOException("Unsupported note action");
  }

  JSONObject sourceDescribe(String notebookUrl,String sourceId) throws Exception {
    requireSource(notebookUrl,sourceId);
    Object raw=rpc("tr032e",new JSONArray().put(new JSONArray().put(new JSONArray()
      .put(new JSONArray().put(sourceId)))),"/");
    if(!(raw instanceof JSONArray))throw new IOException("Source guide unavailable");
    JSONArray outer=(JSONArray)raw,level1=outer.optJSONArray(0);
    JSONArray inner=level1==null?null:level1.optJSONArray(0);
    String summary="";
    JSONArray keywords=new JSONArray();
    if(inner!=null){
      JSONArray summaryArray=inner.optJSONArray(1);
      if(summaryArray!=null)summary=summaryArray.optString(0,"");
      JSONArray keywordArray=inner.optJSONArray(2);
      if(keywordArray!=null&&keywordArray.optJSONArray(0)!=null)keywords=keywordArray.optJSONArray(0);
    }
    return new JSONObject().put("sourceId",sourceId).put("summary",summary).put("keywords",keywords);
  }
  private void collectSourceText(JSONArray array,StringBuilder output) throws Exception {
    for(int j=0;j<array.length();j++){
      Object part=array.opt(j);
      if(part instanceof String){
        String t=(String)part;
        if(!t.isEmpty()){
          if(output.length()+t.length()>85000)throw new IOException("Source text exceeds relay limit; use local export");
          output.append(t).append("\\n");
        }
      }else if(part instanceof JSONArray)collectSourceText((JSONArray)part,output);
    }
  }
  JSONObject sourceContent(String notebookUrl,String sourceId) throws Exception {
    requireSource(notebookUrl,sourceId);
    Object raw=rpc("hizoJc",new JSONArray().put(new JSONArray().put(sourceId))
      .put(new JSONArray().put(2)).put(new JSONArray().put(2)),"/");
    if(!(raw instanceof JSONArray))throw new IOException("Source content unavailable");
    JSONArray outer=(JSONArray)raw,meta=outer.optJSONArray(0);
    JSONArray blocks=outer.optJSONArray(3),texts=blocks==null?null:blocks.optJSONArray(0);
    if(texts==null)throw new IOException("Source content blocks missing; not treating as empty");
    StringBuilder content=new StringBuilder();
    for(int j=0;j<texts.length();j++){
      JSONArray block=texts.optJSONArray(j);
      if(block!=null)collectSourceText(block,content);
    }
    return new JSONObject().put("sourceId",sourceId)
      .put("title",meta==null?"":meta.optString(1))
      .put("content",content.toString()).put("charCount",content.length())
      .put("truncated",false);
  }

  JSONObject artifactDownloadBinary(String notebookUrl,String artifactId,String token,String jobId) throws Exception {
    JSONObject artifact=artifactDownloadLink(notebookUrl,artifactId);
    String mediaUrl=artifact.getString("downloadUrl");
    URL current=new URL(mediaUrl);
    HttpURLConnection c=null;
    byte[] bytes;
    String mime=artifact.optInt("typeCode")==1?"audio/mp4":"video/mp4";
    try{
      for(int redirects=0;redirects<4;redirects++){
        String host=current.getHost().toLowerCase(java.util.Locale.ROOT);
        boolean trusted=host.equals("notebook.google.com")||host.endsWith(".googleusercontent.com")||
          host.equals("googleusercontent.com")||host.endsWith(".googlevideo.com")||
          host.equals("googlevideo.com")||host.endsWith(".ggpht.com");
        if(!"https".equals(current.getProtocol())||!trusted)
          throw new IOException("Refusing untrusted media download host");
        c=(HttpURLConnection)current.openConnection();
        c.setInstanceFollowRedirects(false);
        c.setConnectTimeout(15000);c.setReadTimeout(60000);
        c.setRequestProperty("Accept","*/*");
        if(host.equals("notebook.google.com"))c.setRequestProperty("Cookie",cookie());
        int status=c.getResponseCode();
        if(status==301||status==302||status==303||status==307||status==308){
          String location=c.getHeaderField("Location");c.disconnect();c=null;
          if(location==null)throw new IOException("Media redirect without location");
          current=new URL(current,location);continue;
        }
        if(status!=200)throw new IOException("Media download HTTP "+status);
        try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
          byte[] buf=new byte[16384];int n;
          while((n=in.read(buf))!=-1){
            if(out.size()+n>15_000_000)throw new IOException("Artifact exceeds 15 MB private relay limit");
            out.write(buf,0,n);
          }
          bytes=out.toByteArray();
        }
        JSONObject uploaded=RelayClient.uploadArtifact(token,jobId,bytes,mime);
        if(!uploaded.optBoolean("ok",false)||uploaded.optString("storagePath").isEmpty())
          throw new IOException("Binary upload not confirmed");
        return new JSONObject().put("artifactId",artifactId).put("storagePath",uploaded.getString("storagePath"))
          .put("mime",mime).put("bytes",bytes.length).put("private",true).put("uploaded",true);
      }
      throw new IOException("Too many media redirects");
    }finally{if(c!=null)c.disconnect();}
  }

  JSONObject studioDelete(String notebookUrl,String artifactId,boolean confirm) throws Exception {
    if(!confirm)throw new IOException("Studio deletion requires explicit confirmation");
    String id=ownedNotebookId(notebookUrl);
    JSONArray artifacts=studioStatus(notebookUrl).getJSONArray("artifacts");
    boolean exists=false;
    for(int j=0;j<artifacts.length();j++)
      if(artifactId.equals(artifacts.getJSONObject(j).optString("id")))exists=true;
    if(!exists)throw new IOException("Artifact not found in notebook Studio");
    Object raw=rpc("V5N4be",new JSONArray().put(new JSONArray().put(2)).put(artifactId),"/");
    if(raw==null)throw new IOException("Studio deletion not accepted");
    JSONArray after=studioStatus(notebookUrl).getJSONArray("artifacts");
    for(int j=0;j<after.length();j++)
      if(artifactId.equals(after.getJSONObject(j).optString("id")))
        throw new IOException("Studio artifact deletion not verified");
    return new JSONObject().put("artifactId",artifactId).put("deleted",true).put("verified",true).put("notebookId",id);
  }

}
