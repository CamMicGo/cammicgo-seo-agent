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
  private static final String HOME="https://notebooklm.google.com/";
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
  private String cookie() throws IOException {
    String c=CookieManager.getInstance().getCookie(HOME);
    if(c==null||c.trim().isEmpty())throw new IOException("Connectez votre compte Google dans l'onglet NotebookLM de l'APK (la session Chrome est distincte).");
    return c;
  }
  private String request(String url,String method,String body) throws IOException {
    return request(url,method,body,0);
  }
  private String request(String url,String method,String body,int redirects) throws IOException {
    CookieManager.getInstance().flush();
    HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
    try {
      c.setConnectTimeout(15000);c.setReadTimeout(30000);
      c.setRequestMethod(method);c.setInstanceFollowRedirects(false);
      c.setRequestProperty("Cookie",cookie());
      c.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");
      c.setRequestProperty("Accept","*/*");
      c.setRequestProperty("Referer",HOME);
      c.setRequestProperty("Origin","https://notebooklm.google.com");
      if(body!=null){
        c.setDoOutput(true);c.setRequestProperty("Content-Type","application/x-www-form-urlencoded;charset=UTF-8");
        try(OutputStream out=c.getOutputStream()){out.write(body.getBytes(StandardCharsets.UTF_8));}
      }
      int status=c.getResponseCode();
      if(status==301||status==302||status==303||status==307||status==308){
        String location=c.getHeaderField("Location");
        URL next=location==null?null:new URL(new URL(url),location);
        if(next!=null&&"https".equals(next.getProtocol())&&"notebooklm.google.com".equalsIgnoreCase(next.getHost())&&redirects<3){
          return request(next.toString(),status==307||status==308?method:"GET",status==307||status==308?body:null,redirects+1);
        }
        throw new IOException("NotebookLM redirige vers "+(next==null?"une adresse inconnue":next.getHost())+" (HTTP "+status+"). Vérifiez la session WebView.");
      }
      if(status==401||status==403)throw new IOException("NotebookLM refuse la requête (HTTP "+status+").");
      if(status<200||status>=300)throw new IOException("NotebookLM HTTP "+status);
      return read(c.getInputStream());
    } finally {c.disconnect();}
  }
  private Object rpc(String id,JSONArray args,String sourcePath) throws Exception {
    String page=request(HOME,"GET",null);
    String csrf=field(page,"SNlM0e"),sid=field(page,"FdrFJe"),bl=field(page,"cfb2h");
    if(csrf.isEmpty())throw new IOException("Session NotebookLM indisponible : ouvrez NotebookLM dans l'APK et connectez-vous.");
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
      String id=nb.optString(2),title=nb.optString(0,"Sans titre");
      items.put(new JSONObject().put("id",id).put("title",title).put("url",HOME+"notebook/"+id));
    }
    return new JSONObject().put("notebooks",items).put("count",items.length()).put("method","android-java-rpc");
  }
  JSONObject create(String title) throws Exception {
    if(title==null||title.trim().isEmpty()||title.length()>160)throw new IOException("Titre invalide");
    // Check before mutation to avoid duplicate notebooks on retries.
    JSONArray existing=list().getJSONArray("notebooks");
    for(int i=0;i<existing.length();i++)if(title.equals(existing.getJSONObject(i).optString("title")))
      return new JSONObject().put("notebookCreated",false).put("verifiedInList",true)
        .put("alreadyExists",true).put("title",title).put("url",existing.getJSONObject(i).optString("url"));
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
    JSONArray after=list().getJSONArray("notebooks");
    for(int i=0;i<after.length();i++)if(id.equals(after.getJSONObject(i).optString("id")))verified=true;
    return new JSONObject().put("notebookCreated",true).put("verifiedInList",verified)
      .put("title",title).put("id",id).put("url",HOME+"notebook/"+id);
  }
  JSONObject addUrl(String notebookUrl,String sourceUrl) throws Exception {
    if(notebookUrl==null||sourceUrl==null)throw new IOException("Notebook and source URL required");
    Matcher m=Pattern.compile("^https://notebooklm\\.google\\.com/notebook/([A-Za-z0-9_-]+)").matcher(notebookUrl);
    if(!m.find())throw new IOException("Invalid NotebookLM notebook URL");
    URL source=new URL(sourceUrl);
    if(!"https".equals(source.getProtocol())||source.getHost().isEmpty())throw new IOException("Source must be HTTPS");
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
}
