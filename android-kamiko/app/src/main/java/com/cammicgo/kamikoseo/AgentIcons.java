package com.cammicgo.kamikoseo;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.content.Context;
import android.util.Base64;

/** User-supplied logos, losslessly positioned in a 7-cell sprite (32x32 per icon). */
final class AgentIcons {
  private AgentIcons() {}
  private static final String PNG = "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";
  private static Bitmap sheet;
  static Drawable forProvider(Context context, String provider) {
    int index;
    switch (provider) {
      case "ChatGPT": index=2; break;
      case "Claude": index=3; break;
      case "Antigravity": index=4; break;
      case "Gemini": case "Gemini CLI": index=5; break;
      case "Cursor": index=6; break;
      case "Codex": index=1; break;
      default: index=0; break;
    }
    if (sheet == null) sheet=BitmapFactory.decodeByteArray(Base64.decode(PNG,Base64.DEFAULT),0,Base64.decode(PNG,Base64.DEFAULT).length);
    if (sheet == null) return null;
    Bitmap icon=Bitmap.createBitmap(sheet,index*32,0,32,32);
    Drawable drawable=new BitmapDrawable(context.getResources(),icon);
    int px=(int)(20*context.getResources().getDisplayMetrics().density+0.5f);
    drawable.setBounds(0,0,px,px);
    return drawable;
  }
}
