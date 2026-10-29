package com.cammicgo.kamikoseo;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.graphics.Color;
import android.view.View;
import android.widget.*;
import android.text.method.ScrollingMovementMethod;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.regex.*;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
  EditText input; TextView output; Button run;
  static String read(String url) throws Exception {
    HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
    c.setConnectTimeout(12000); c.setReadTimeout(15000);
    c.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36");
    try(InputStream stream=c.getInputStream()){ByteArrayOutputStream b=new ByteArrayOutputStream();byte[] buf=new byte[8192];int n;while((n=stream.read(buf))!=-1){b.write(buf,0,n);if(b.size()>4000000)throw new IOException("Response too large");}return b.toString("UTF-8");}finally{c.disconnect();}
  }
  static String id(String s) {
    Matcher m=Pattern.compile("(?:v=|youtu\\.be/|shorts/|embed/)([A-Za-z0-9_-]{11})").matcher(s);
    if(m.find())return m.group(1);
    return s.matches("[A-Za-z0-9_-]{11}")?s:null;
  }
  static String unescape(String s){return s.replace("\\u0026","&").replace("\\/","/");}
  static String transcript(String video) throws Exception {
    String html=read("https://www.youtube.com/watch?v="+video);
    int start=html.indexOf("ytInitialPlayerResponse = ");
    if(start<0)start=html.indexOf("ytInitialPlayerResponse=");
    if(start<0)throw new IOException("YouTube player metadata unavailable");
    int brace=html.indexOf('{',start),depth=0,end=-1;boolean quote=false,escape=false;
    for(int i=brace;i<html.length();i++){char ch=html.charAt(i);if(quote){if(escape)escape=false;else if(ch=='\\')escape=true;else if(ch=='"')quote=false;}else{if(ch=='"')quote=true;else if(ch=='{')depth++;else if(ch=='}'&&--depth==0){end=i+1;break;}}}
    if(end<0)throw new IOException("Invalid player metadata");
    JSONObject root=new JSONObject(html.substring(brace,end));
    JSONObject captions=root.optJSONObject("captions");
    if(captions==null)throw new IOException("No accessible captions for this video");
    JSONArray tracks=captions.getJSONObject("playerCaptionsTracklistRenderer").getJSONArray("captionTracks");
    JSONObject track=tracks.getJSONObject(0);
    for(int i=0;i<tracks.length();i++){JSONObject t=tracks.getJSONObject(i);if(t.optString("languageCode").startsWith("fr")){track=t;break;}}
    String base=unescape(track.getString("baseUrl"));
    String xml=read(base);
    StringBuilder result=new StringBuilder();
    Matcher m=Pattern.compile("<(?:text|p)\\b([^>]*)>(.*?)</(?:text|p)>",Pattern.DOTALL).matcher(xml);
    while(m.find()){String attr=m.group(1),text=m.group(2).replaceAll("<[^>]+>","").replace("&amp;","&").replace("&quot;","\\\"").replace("&#39;","'").replace("&lt;","<").replace("&gt;",">");Matcher t=Pattern.compile("(?:start|t)=\\\"([0-9.]+)\\\"").matcher(attr);String stamp=t.find()?t.group(1):"?";result.append("[").append(stamp).append("] ").append(text).append("\\n");}
    if(result.length()==0)throw new IOException("Caption track empty or blocked");
    return result.toString();
  }
  @Override public void onCreate(Bundle b){super.onCreate(b);LinearLayout l=new LinearLayout(this);l.setOrientation(1);l.setPadding(24,32,24,24);l.setBackgroundColor(Color.WHITE);
    TextView title=new TextView(this);title.setText("CamMicGo SEO MCP — YouTube captions");title.setTextSize(22);title.setTextColor(Color.BLACK);l.addView(title);
    TextView note=new TextView(this);note.setText("Prototype local : collez ou partagez une URL YouTube. L'extraction peut échouer si YouTube bloque les sous-titres. Aucune synchronisation MCP distante n'est encore active.");note.setTextColor(Color.DKGRAY);l.addView(note);
    input=new EditText(this);input.setHint("https://www.youtube.com/watch?v=...");input.setSingleLine(true);l.addView(input);
    run=new Button(this);run.setText("Extraire les sous-titres");l.addView(run);
    Button copy=new Button(this);copy.setText("Copier le résultat");l.addView(copy);
    output=new TextView(this);output.setTextColor(Color.BLACK);output.setTextIsSelectable(true);output.setMovementMethod(new ScrollingMovementMethod());ScrollView scroll=new ScrollView(this);scroll.addView(output);l.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));setContentView(l);
    if(Intent.ACTION_SEND.equals(getIntent().getAction())&&"text/plain".equals(getIntent().getType()))input.setText(getIntent().getStringExtra(Intent.EXTRA_TEXT));
    run.setOnClickListener(v->{String video=id(input.getText().toString());if(video==null){output.setText("URL YouTube invalide");return;}run.setEnabled(false);output.setText("Extraction en cours...");Executors.newSingleThreadExecutor().execute(()->{String result;try{result=transcript(video);}catch(Exception e){result="Extraction impossible : "+e.getMessage();}final String text=result;runOnUiThread(()->{output.setText(text);run.setEnabled(true);});});});
    copy.setOnClickListener(v->{android.content.ClipboardManager cm=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);cm.setPrimaryClip(android.content.ClipData.newPlainText("YouTube transcript",output.getText()));Toast.makeText(this,"Copié",Toast.LENGTH_SHORT).show();});
  }
}
