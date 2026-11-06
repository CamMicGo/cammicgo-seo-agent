package com.cammicgo.kamikoseo;

import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;

/**
 * Stroke icons drawn on a 24x24 grid, identical on every device (no emoji or font glyphs).
 * Colour follows setTint(), so a button can switch its icon colour with its state.
 */
final class UiIcons {
  enum Kind { EXPAND, COLLAPSE, REFRESH, IMAGE, CLIP, DOWNLOAD, SHIELD, SHIELD_OK, BROWSER, BOOK, PLUS, CHAT, PEOPLE, SEARCH }

  private UiIcons() {}

  static Drawable make(Kind kind, int color, int sizePx) {
    Icon d = new Icon(kind, color, sizePx);
    d.setBounds(0, 0, sizePx, sizePx);
    return d;
  }

  private static final class Icon extends Drawable {
    private final Kind kind;
    private final int size;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

    Icon(Kind kind, int color, int size) {
      this.kind = kind; this.size = size;
      paint.setColor(color);
      paint.setStyle(Paint.Style.STROKE);
      paint.setStrokeWidth(2f);
      paint.setStrokeCap(Paint.Cap.ROUND);
      paint.setStrokeJoin(Paint.Join.ROUND);
    }

    @Override public void setTint(int tint) { paint.setColor(tint); invalidateSelf(); }
    @Override public void setTintList(android.content.res.ColorStateList tint) {
      if (tint != null) setTint(tint.getColorForState(getState(), tint.getDefaultColor()));
    }
    @Override public void setAlpha(int alpha) { paint.setAlpha(alpha); invalidateSelf(); }
    @Override public void setColorFilter(ColorFilter filter) { paint.setColorFilter(filter); invalidateSelf(); }
    @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
    @Override public int getIntrinsicWidth() { return size; }
    @Override public int getIntrinsicHeight() { return size; }

    @Override public void draw(Canvas c) {
      Rect b = getBounds();
      c.save();
      c.translate(b.left, b.top);
      c.scale(b.width() / 24f, b.height() / 24f);
      Path p = new Path();
      switch (kind) {
        case EXPAND:
          p.moveTo(4, 9); p.lineTo(4, 4); p.lineTo(9, 4);
          p.moveTo(15, 4); p.lineTo(20, 4); p.lineTo(20, 9);
          p.moveTo(20, 15); p.lineTo(20, 20); p.lineTo(15, 20);
          p.moveTo(9, 20); p.lineTo(4, 20); p.lineTo(4, 15);
          break;
        case COLLAPSE:
          p.moveTo(4, 9); p.lineTo(9, 9); p.lineTo(9, 4);
          p.moveTo(15, 4); p.lineTo(15, 9); p.lineTo(20, 9);
          p.moveTo(20, 15); p.lineTo(15, 15); p.lineTo(15, 20);
          p.moveTo(9, 20); p.lineTo(9, 15); p.lineTo(4, 15);
          break;
        case REFRESH:
          p.addArc(new RectF(4.5f, 4.5f, 19.5f, 19.5f), -60, 290);
          p.moveTo(15.5f, 2.5f); p.lineTo(16.2f, 6.2f); p.lineTo(12.5f, 7);
          break;
        case IMAGE:
          p.addRoundRect(new RectF(3, 4.5f, 21, 19.5f), 2.5f, 2.5f, Path.Direction.CW);
          p.addCircle(8.5f, 9.5f, 1.6f, Path.Direction.CW);
          p.moveTo(3.5f, 17.5f); p.lineTo(9, 12.5f); p.lineTo(13, 16); p.lineTo(16, 13.5f); p.lineTo(20.5f, 17.5f);
          break;
        case CLIP:
          p.moveTo(20, 11.5f); p.lineTo(12, 19.5f);
          p.cubicTo(9.8f, 21.7f, 6.3f, 21.7f, 4.2f, 19.5f);
          p.cubicTo(2, 17.3f, 2, 13.8f, 4.2f, 11.6f);
          p.lineTo(12.5f, 3.4f);
          p.cubicTo(14, 1.9f, 16.4f, 1.9f, 17.9f, 3.4f);
          p.cubicTo(19.4f, 4.9f, 19.4f, 7.3f, 17.9f, 8.8f);
          p.lineTo(9.6f, 17);
          p.cubicTo(8.9f, 17.8f, 7.6f, 17.8f, 6.9f, 17);
          p.cubicTo(6.1f, 16.3f, 6.1f, 15, 6.9f, 14.3f);
          p.lineTo(14.5f, 6.7f);
          break;
        case DOWNLOAD:
          p.moveTo(12, 4); p.lineTo(12, 15);
          p.moveTo(7.5f, 10.5f); p.lineTo(12, 15); p.lineTo(16.5f, 10.5f);
          p.moveTo(4.5f, 16.5f); p.lineTo(4.5f, 19.5f); p.lineTo(19.5f, 19.5f); p.lineTo(19.5f, 16.5f);
          break;
        case SHIELD:
        case SHIELD_OK:
          p.moveTo(12, 2.5f); p.cubicTo(9.6f, 4.3f, 6.8f, 5.2f, 4, 5.6f);
          p.lineTo(4, 11); p.cubicTo(4, 16.2f, 7.4f, 19.6f, 12, 21.5f);
          p.cubicTo(16.6f, 19.6f, 20, 16.2f, 20, 11); p.lineTo(20, 5.6f);
          p.cubicTo(17.2f, 5.2f, 14.4f, 4.3f, 12, 2.5f); p.close();
          if (kind == Kind.SHIELD_OK) { p.moveTo(8.5f, 12); p.lineTo(11, 14.5f); p.lineTo(15.8f, 9.5f); }
          break;
        case BROWSER:
          p.addCircle(12, 12, 8.5f, Path.Direction.CW);
          p.moveTo(3.5f, 12); p.lineTo(20.5f, 12);
          p.addOval(new RectF(8, 3.5f, 16, 20.5f), Path.Direction.CW);
          break;
        case BOOK:
          p.moveTo(12, 6.5f); p.cubicTo(10, 5, 7, 4.5f, 3.5f, 5); p.lineTo(3.5f, 18.5f);
          p.cubicTo(7, 18, 10, 18.5f, 12, 20); p.cubicTo(14, 18.5f, 17, 18, 20.5f, 18.5f);
          p.lineTo(20.5f, 5); p.cubicTo(17, 4.5f, 14, 5, 12, 6.5f); p.lineTo(12, 20);
          break;
        case PLUS:
          p.addRoundRect(new RectF(3.5f, 3.5f, 20.5f, 20.5f), 4, 4, Path.Direction.CW);
          p.moveTo(12, 8); p.lineTo(12, 16); p.moveTo(8, 12); p.lineTo(16, 12);
          break;
        case CHAT:
          p.moveTo(4, 5.5f); p.lineTo(20, 5.5f); p.lineTo(20, 16); p.lineTo(10, 16);
          p.lineTo(6, 19.5f); p.lineTo(6, 16); p.lineTo(4, 16); p.close();
          p.moveTo(8, 9.5f); p.lineTo(16, 9.5f); p.moveTo(8, 12.5f); p.lineTo(13, 12.5f);
          break;
        case PEOPLE:
          p.addCircle(9, 8.5f, 3.2f, Path.Direction.CW);
          p.moveTo(3, 19.5f); p.cubicTo(3.5f, 15.8f, 6, 14, 9, 14); p.cubicTo(12, 14, 14.5f, 15.8f, 15, 19.5f);
          p.addCircle(16.5f, 9, 2.5f, Path.Direction.CW);
          p.moveTo(16.5f, 14); p.cubicTo(19, 14.2f, 20.6f, 16, 21, 19);
          break;
        case SEARCH:
          p.addCircle(10.5f, 10.5f, 6.5f, Path.Direction.CW);
          p.moveTo(15.3f, 15.3f); p.lineTo(20.5f, 20.5f);
          break;
      }
      c.drawPath(p, paint);
      c.restore();
    }
  }
}
