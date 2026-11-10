package com.cammicgo.kamikoseo;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Resolves the audio streams of the given videos and downloads the first 1 MiB of the best candidate. */
public final class Probe {
  public static void main(String[] args) throws Exception {
    int ok = 0;
    for (String id : args) {
      try {
        var list = NewPipeAudioResolver.resolve(id);
        var c = list.get(0);
        HttpURLConnection conn = (HttpURLConnection) new URL(c.url).openConnection();
        conn.setRequestProperty("User-Agent", c.userAgent);
        conn.setRequestProperty("Range", "bytes=0-1048575");
        int code = conn.getResponseCode();
        long got = 0;
        if (code == 206 || code == 200) try (InputStream in = conn.getInputStream()) { byte[] b = new byte[32768]; int n; while ((n = in.read(b)) != -1) got += n; }
        String client = c.url.replaceAll(".*[?&]c=([A-Z0-9_]+).*", "$1");
        System.out.println("PROBE " + id + " streams=" + list.size() + " best=" + c.mime + "@" + c.bitrate + " client=" + client
            + " range=" + code + " " + conn.getHeaderField("Content-Range") + " got=" + got);
        if (code == 206 && got > 0) ok++;
      } catch (Exception e) {
        System.out.println("PROBE " + id + " FAILED " + e.getMessage());
      }
    }
    System.out.println("PROBE_OK " + ok + "/" + args.length);
  }
}
