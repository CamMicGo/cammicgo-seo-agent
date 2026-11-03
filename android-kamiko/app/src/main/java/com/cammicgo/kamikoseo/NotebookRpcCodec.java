package com.cammicgo.kamikoseo;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.URLEncoder;

/**
 * Pure-Java NotebookLM Web RPC framing, without Python, Node.js or cookies.
 * Authentication and HTTP transport MUST be provided by an authenticated
 * NotebookLM session owned by the Android app; do not reuse Chrome cookies.
 *
 * NotebookLM uses an undocumented protocol; IDs and payload shapes can change.
 */
final class NotebookRpcCodec {
  static final String LIST = "wXbhsf";
  static final String CREATE = "CCqFvf";
  static final String RENAME = "s0tc2d";
  static final String DELETE = "WWINqb";
  static final String GET = "rLM1Ne";
  private NotebookRpcCodec() {}

  static String envelope(String rpcId, JSONArray params) throws JSONException {
    if (rpcId == null || !rpcId.matches("[A-Za-z0-9]{6}"))
      throw new JSONException("Invalid NotebookLM RPC identifier");
    JSONArray call = new JSONArray().put(rpcId).put(params.toString()).put(JSONObject.NULL).put("generic");
    return new JSONArray().put(new JSONArray().put(call)).toString();
  }

  static String formBody(String rpcId, JSONArray params, String csrfToken) throws JSONException, java.io.UnsupportedEncodingException {
    String body = "f.req=" + URLEncoder.encode(envelope(rpcId, params), "UTF-8");
    if (csrfToken != null && !csrfToken.isEmpty())
      body += "&at=" + URLEncoder.encode(csrfToken, "UTF-8");
    return body;
  }

  static JSONArray responseFrames(String response) throws JSONException {
    if (response == null || response.isEmpty()) throw new JSONException("Empty NotebookLM response");
    // Google batchexecute uses an anti-XSSI prefix and length-delimited JSON lines.
    String raw = response.startsWith(")]}'") ? response.substring(4) : response;
    JSONArray frames = new JSONArray();
    for (String line : raw.split("\\r?\\n")) {
      String trimmed = line.trim();
      if (!trimmed.startsWith("[")) continue;
      try { frames.put(new JSONArray(trimmed)); } catch (JSONException ignored) {
        // Some server responses contain diagnostic lines; they are not RPC frames.
      }
    }
    if (frames.length() == 0) throw new JSONException("No NotebookLM RPC frames");
    return frames;
  }
}
