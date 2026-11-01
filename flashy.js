/* flashy.js — a Flash-inspired vector animation engine for HTML5 Canvas
 *
 * Provides:
 *   - Graphics        : AS3-style vector drawing (moveTo/lineTo/curveTo/beginFill/gradients/...)
 *   - DisplayObject   : transform, alpha, events
 *   - Shape           : a leaf with a Graphics
 *   - TextField       : simple text rendering
 *   - Bitmap/Bitmaps  : raster images, cached by name and drawn scaled
 *   - MovieClip       : container + Graphics + its own Timeline, nestable
 *   - Timeline        : tweens, frame scripts, labels, looping
 *   - Stage           : the canvas-backed root with fixed-step ticking
 */
(function (global) {
  'use strict';

  // -------------------- easing --------------------
  const Easing = {
    linear:     t => t,
    quadIn:     t => t * t,
    quadOut:    t => 1 - (1 - t) * (1 - t),
    quadInOut:  t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    cubicIn:    t => t * t * t,
    cubicOut:   t => 1 - Math.pow(1 - t, 3),
    cubicInOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    sineIn:     t => 1 - Math.cos((t * Math.PI) / 2),
    sineOut:    t => Math.sin((t * Math.PI) / 2),
    sineInOut:  t => -(Math.cos(Math.PI * t) - 1) / 2,
    expoOut:    t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    backIn:     t => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
    backOut:    t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    elasticOut: t => {
      if (t === 0 || t === 1) return t;
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    bounceOut:  t => {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) { t -= 1.5 / d1;   return n1 * t * t + 0.75; }
      if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
      t -= 2.625 / d1; return n1 * t * t + 0.984375;
    }
  };

  /**
   * A custom easing curve, as a cubic Bézier on (0,0)→(1,1).
   *
   * Flash's Custom Ease In/Ease Out editor was a draggable curve, and a cubic
   * Bézier is the same shape with four numbers — so a curve survives a save
   * and can be evaluated identically by the editor and by the player, which a
   * hand-drawn point list could not.
   *
   * Newton–Raphson on x, falling back to bisection: the curve is monotonic in
   * x for sane control points, and the fallback keeps a silly one (x1 > 1, say)
   * from spinning.
   */
  function cubicBezierEase(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sampleX = t => ((ax * t + bx) * t + cx) * t;
    const sampleY = t => ((ay * t + by) * t + cy) * t;
    const slopeX = t => (3 * ax * t + 2 * bx) * t + cx;
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const d = sampleX(t) - x;
        if (Math.abs(d) < 1e-6) return sampleY(t);
        const s = slopeX(t);
        if (Math.abs(s) < 1e-6) break;
        t -= d / s;
      }
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 24; i++) {
        const v = sampleX(t);
        if (Math.abs(v - x) < 1e-6) break;
        if (v > x) hi = t; else lo = t;
        t = (lo + hi) / 2;
      }
      return sampleY(t);
    };
  }

  /**
   * The easing function for a keyframe: a named preset, or its own curve.
   *
   * One resolver, used by the editor's stage and by the exported player, so a
   * custom curve cannot ease one way while authoring and another way in the
   * movie.
   */
  function resolveEasing(name, bezier) {
    if (name === "custom" && bezier && bezier.length >= 4) {
      return cubicBezierEase(bezier[0], bezier[1], bezier[2], bezier[3]);
    }
    return Easing[name] || Easing.linear;
  }

  Easing.cubicBezier = cubicBezierEase;
  Easing.resolve = resolveEasing;

  /* -------------------- Output --------------------
   *
   * Where trace() goes.
   *
   * `trace()` is the primary debugging affordance of Flash, and it went to the
   * browser console — which is to say nowhere a user of the editor would ever
   * look. A sink here means the authoring Output panel, the exported player
   * and an imported movie's ActionScript all write to the same place.
   * ------------------------------------------------------------------ */
  const Output = {
    lines: [],
    /** Bounded: a trace in an enterFrame handler fires sixty times a second. */
    max: 500,
    _listeners: [],

    write() {
      const text = Array.prototype.map.call(arguments, v => {
        if (typeof v === "string") return v;
        if (v == null) return String(v);
        try { return JSON.stringify(v); } catch (e) { return String(v); }
      }).join(" ");
      this.lines.push(text);
      if (this.lines.length > this.max) this.lines.splice(0, this.lines.length - this.max);
      const copy = this._listeners.slice();
      for (let i = 0; i < copy.length; i++) {
        try { copy[i](text); } catch (e) { /* a bad listener must not stop a trace */ }
      }
      return text;
    },

    clear() {
      this.lines.length = 0;
      const copy = this._listeners.slice();
      for (let i = 0; i < copy.length; i++) {
        try { copy[i](null); } catch (e) { /* as above */ }
      }
    },

    /** Called with each line as it arrives, and with null when cleared. */
    onWrite(fn) { this._listeners.push(fn); return fn; },
    offWrite(fn) {
      const i = this._listeners.indexOf(fn);
      if (i >= 0) this._listeners.splice(i, 1);
    },

    text() { return this.lines.join("\n"); }
  };

  // -------------------- color helpers --------------------
  function toRGBA(color, alpha) {
    if (alpha == null) alpha = 1;
    if (typeof color === 'string') {
      if (alpha === 1) return color;
      if (color[0] === '#' && color.length === 7) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
      }
      return color;
    }
    const n = color | 0;
    const r = (n >> 16) & 0xff;
    const g = (n >> 8) & 0xff;
    const b = n & 0xff;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // -------------------- Graphics --------------------
  // Records vector drawing commands and replays them to a 2D context.
  // beginFill/endFill group path commands into a single filled path; lineStyle
  // produces a matching stroke. Multiple fill groups can be recorded in sequence.
  class Graphics {
    constructor() {
      this._cmds = [];
      this._bounds = null;
    }
    clear() { this._cmds.length = 0; this._bounds = null; return this; }

    moveTo(x, y)              { this._cmds.push([0, x, y]);                this._touch(x, y); return this; }
    lineTo(x, y)              { this._cmds.push([1, x, y]);                this._touch(x, y); return this; }
    curveTo(cx, cy, x, y)     { this._cmds.push([2, cx, cy, x, y]);        this._touch(x, y); this._touch(cx, cy); return this; }
    cubicCurveTo(c1x, c1y, c2x, c2y, x, y) {
      this._cmds.push([3, c1x, c1y, c2x, c2y, x, y]);
      this._touch(x, y); return this;
    }
    closePath() { this._cmds.push([4]); return this; }

    lineStyle(thickness, color, alpha, caps, joints, miterLimit) {
      if (thickness == null || thickness === 0) {
        this._cmds.push([10, 0]);
      } else {
        this._cmds.push([10, thickness, color == null ? 0 : color, alpha == null ? 1 : alpha,
          caps || 'round', joints || 'round', miterLimit || 3]);
      }
      return this;
    }

    /**
     * `rule` is the canvas fill rule, 'nonzero' (the default) or 'evenodd'.
     * Even-odd is what a traced outline needs: its holes arrive as extra
     * loops in the same path and their winding is whatever the boundary walk
     * produced, so nonzero fills them in.
     */
    beginFill(color, alpha, rule) {
      this._cmds.push([11, color == null ? 0 : color, alpha == null ? 1 : alpha,
        rule === 'evenodd' ? 'evenodd' : 'nonzero']);
      return this;
    }
    beginGradientFill(type, colors, alphas, ratios, x0, y0, x1, y1) {
      this._cmds.push([12, type, colors, alphas, ratios, x0, y0, x1, y1]);
      return this;
    }
    endFill() { this._cmds.push([13]); return this; }

    drawRect(x, y, w, h)              { this._cmds.push([20, x, y, w, h]);    this._touch(x, y); this._touch(x + w, y + h); return this; }
    drawRoundRect(x, y, w, h, r)      { this._cmds.push([21, x, y, w, h, r]); this._touch(x, y); this._touch(x + w, y + h); return this; }
    drawCircle(x, y, r)               { this._cmds.push([22, x, y, r]);       this._touch(x - r, y - r); this._touch(x + r, y + r); return this; }
    drawEllipse(x, y, w, h)           { this._cmds.push([23, x, y, w, h]);    this._touch(x, y); this._touch(x + w, y + h); return this; }
    drawPolygon(points) {
      this._cmds.push([24, points]);
      for (let i = 0; i < points.length; i += 2) this._touch(points[i], points[i + 1]);
      return this;
    }
    drawStar(cx, cy, points, outerR, innerR, rotation) {
      this._cmds.push([25, cx, cy, points, outerR, innerR, rotation || 0]);
      this._touch(cx - outerR, cy - outerR); this._touch(cx + outerR, cy + outerR);
      return this;
    }

    _touch(x, y) {
      if (!this._bounds) { this._bounds = { minX: x, minY: y, maxX: x, maxY: y }; return; }
      if (x < this._bounds.minX) this._bounds.minX = x;
      if (y < this._bounds.minY) this._bounds.minY = y;
      if (x > this._bounds.maxX) this._bounds.maxX = x;
      if (y > this._bounds.maxY) this._bounds.maxY = y;
    }
    getBounds() {
      if (!this._bounds) return { x: 0, y: 0, width: 0, height: 0 };
      return {
        x: this._bounds.minX, y: this._bounds.minY,
        width: this._bounds.maxX - this._bounds.minX,
        height: this._bounds.maxY - this._bounds.minY
      };
    }

    render(ctx) {
      let fill = null;
      let fillRule = 'nonzero';
      let stroke = null;
      let strokeWidth = 0;
      let caps = 'round', joins = 'round', miter = 3;
      let inPath = false;

      const ensurePath = () => { if (!inPath) { ctx.beginPath(); inPath = true; } };
      const commit = () => {
        if (!inPath) return;
        if (fill)   { ctx.fillStyle = fill;     ctx.fill(fillRule); }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth   = strokeWidth;
          ctx.lineCap     = caps;
          ctx.lineJoin    = joins;
          ctx.miterLimit  = miter;
          ctx.stroke();
        }
        inPath = false;
      };

      for (let k = 0; k < this._cmds.length; k++) {
        const c = this._cmds[k];
        switch (c[0]) {
          case 0: ensurePath(); ctx.moveTo(c[1], c[2]); break;
          case 1: ensurePath(); ctx.lineTo(c[1], c[2]); break;
          case 2: ensurePath(); ctx.quadraticCurveTo(c[1], c[2], c[3], c[4]); break;
          case 3: ensurePath(); ctx.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]); break;
          case 4: ensurePath(); ctx.closePath(); break;
          case 10:
            if (c[1] === 0) { stroke = null; strokeWidth = 0; }
            else {
              strokeWidth = c[1];
              stroke = toRGBA(c[2], c[3]);
              caps = c[4]; joins = c[5]; miter = c[6];
            }
            break;
          case 11: commit(); fill = toRGBA(c[1], c[2]); fillRule = c[3] || 'nonzero'; break;
          case 12: {
            commit();
            fillRule = 'nonzero';
            const type = c[1], colors = c[2], alphas = c[3], ratios = c[4];
            const x0 = c[5], y0 = c[6], x1 = c[7], y1 = c[8];
            let grad;
            if (type === 'linear') grad = ctx.createLinearGradient(x0, y0, x1, y1);
            else                   grad = ctx.createRadialGradient(x0, y0, 0, x0, y0, Math.hypot(x1 - x0, y1 - y0));
            for (let i = 0; i < colors.length; i++) grad.addColorStop(ratios[i], toRGBA(colors[i], alphas[i]));
            fill = grad;
            break;
          }
          case 13: commit(); fill = null; break;
          case 20: ensurePath(); ctx.rect(c[1], c[2], c[3], c[4]); break;
          case 21: {
            ensurePath();
            const x = c[1], y = c[2], w = c[3], h = c[4];
            const rr = Math.min(c[5], Math.min(w, h) / 2);
            ctx.moveTo(x + rr, y);
            ctx.lineTo(x + w - rr, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
            ctx.lineTo(x + w, y + h - rr);
            ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
            ctx.lineTo(x + rr, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
            ctx.lineTo(x, y + rr);
            ctx.quadraticCurveTo(x, y, x + rr, y);
            break;
          }
          case 22:
            ensurePath();
            ctx.moveTo(c[1] + c[3], c[2]);
            ctx.arc(c[1], c[2], c[3], 0, Math.PI * 2);
            break;
          case 23: {
            ensurePath();
            const ex = c[1], ey = c[2], ew = c[3], eh = c[4];
            ctx.moveTo(ex + ew, ey + eh / 2);
            ctx.ellipse(ex + ew / 2, ey + eh / 2, ew / 2, eh / 2, 0, 0, Math.PI * 2);
            break;
          }
          case 24: {
            ensurePath();
            const pts = c[1];
            if (pts.length >= 2) {
              ctx.moveTo(pts[0], pts[1]);
              for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
              ctx.closePath();
            }
            break;
          }
          case 25: {
            ensurePath();
            const cx = c[1], cy = c[2], n = c[3], or = c[4], ir = c[5], rot = c[6];
            for (let i = 0; i < n * 2; i++) {
              const r = (i % 2 === 0) ? or : ir;
              const a = rot - Math.PI / 2 + (i * Math.PI) / n;
              const x = cx + Math.cos(a) * r;
              const y = cy + Math.sin(a) * r;
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
            break;
          }
        }
      }
      commit();
    }
  }

  /* -------------------- Filters and colour transforms --------------------
   *
   * Flash 8's filter stack — drop shadow, blur, glow, bevel, adjust colour —
   * and its Color Effect — brightness, tint, advanced — are what made late-era
   * Flash content look the way it did. This module is the one implementation
   * of both, shared by the engine and by the editor's own stage painter, so a
   * glow on the authoring stage is the same glow in every export.
   *
   * TWO MECHANISMS, because the two things need different ones:
   *
   *   Filters are geometric: a blur has to see the shape's neighbourhood. They
   *   go through the canvas `filter` property, which takes CSS filter
   *   functions and is applied to a whole composited image rather than to each
   *   fill and stroke separately — which matters, because applying
   *   `drop-shadow` per drawing operation gives a shape with a stroke two
   *   shadows, one of them printed over the fill.
   *
   *   Colour transforms are per-pixel and exact: every one of Flash's three
   *   colour effects reduces to a per-channel multiply plus offset, and that
   *   cannot be expressed in CSS filter functions at all. `brightness()` is
   *   multiplicative; Flash's Brightness interpolates towards white, which is
   *   a multiply AND an offset. So they run as a real pixel pass.
   *
   * Both therefore need the object rendered off-screen first. The scratch
   * buffer is the full canvas size and pooled: filtered objects are normally
   * few, and sizing to an object's bounds would mean every caller — including
   * a MovieClip that does not know its own extent — having to supply them.
   * -------------------------------------------------------------------- */
  const Filters = {
    /** Identity colour transform: multiply by one, add nothing. */
    IDENTITY: { rMul: 1, gMul: 1, bMul: 1, aMul: 1, rOff: 0, gOff: 0, bOff: 0, aOff: 0 },

    /** True when a colour transform would actually change anything. */
    hasColor(ct) {
      if (!ct) return false;
      return ct.rMul !== 1 || ct.gMul !== 1 || ct.bMul !== 1 || ct.aMul !== 1 ||
             !!ct.rOff || !!ct.gOff || !!ct.bOff || !!ct.aOff;
    },

    /**
     * Flash's three Colour Effects, each reduced to one channel transform.
     *
     *   brightness  b in -1..1. Positive interpolates towards white, so it is
     *               c*(1-b) + 255b; negative scales towards black.
     *   tint        amount t towards a colour, so c*(1-t) + tc*t.
     *   advanced    the channel transform written out directly, which is what
     *               Flash's Advanced panel always was.
     */
    colorEffect(e) {
      if (!e || !e.mode || e.mode === 'none') return null;
      const id = Object.assign({}, this.IDENTITY);
      if (e.mode === 'brightness') {
        const b = Math.max(-1, Math.min(1, e.brightness || 0));
        if (!b) return null;
        if (b > 0) { const m = 1 - b, o = 255 * b;
          return { rMul: m, gMul: m, bMul: m, aMul: 1, rOff: o, gOff: o, bOff: o, aOff: 0 }; }
        const m2 = 1 + b;
        return { rMul: m2, gMul: m2, bMul: m2, aMul: 1, rOff: 0, gOff: 0, bOff: 0, aOff: 0 };
      }
      if (e.mode === 'tint') {
        const t = Math.max(0, Math.min(1, e.amount == null ? 1 : e.amount));
        const n = typeof e.color === 'string'
          ? parseInt(String(e.color).replace('#', ''), 16) : (e.color | 0);
        const m = 1 - t;
        return {
          rMul: m, gMul: m, bMul: m, aMul: 1,
          rOff: ((n >> 16) & 0xff) * t,
          gOff: ((n >> 8) & 0xff) * t,
          bOff: (n & 0xff) * t,
          aOff: 0
        };
      }
      if (e.mode === 'advanced') {
        return {
          rMul: e.rMul == null ? 1 : e.rMul, gMul: e.gMul == null ? 1 : e.gMul,
          bMul: e.bMul == null ? 1 : e.bMul, aMul: e.aMul == null ? 1 : e.aMul,
          rOff: e.rOff || 0, gOff: e.gOff || 0, bOff: e.bOff || 0, aOff: e.aOff || 0
        };
      }
      return id;
    },

    /**
     * Two colour transforms, applied one after the other.
     *
     * A per-object Colour Effect and a per-LAYER tint both end up here, and a
     * tinted layer holding a tinted object has to show both. Each transform is
     * a per-channel multiply and offset, so composing them is arithmetic:
     * applying `a` then `b` gives b.mul*a.mul and b.mul*a.off + b.off.
     *
     * Here rather than in the editor because the authoring stage, the SVG
     * export and the exported player all need the same answer.
     */
    composeColor(a, b) {
      if (!a) return b || null;
      if (!b) return a;
      const out = {};
      ['r', 'g', 'b', 'a'].forEach(ch => {
        const am = a[ch + 'Mul'] == null ? 1 : a[ch + 'Mul'];
        const bm = b[ch + 'Mul'] == null ? 1 : b[ch + 'Mul'];
        out[ch + 'Mul'] = bm * am;
        out[ch + 'Off'] = bm * (a[ch + 'Off'] || 0) + (b[ch + 'Off'] || 0);
      });
      return out;
    },

    /** A transform as a Colour Effect spec, so it can live on an object. */
    asEffect(t) {
      if (!t) return null;
      return {
        mode: 'advanced',
        rMul: t.rMul == null ? 1 : t.rMul, gMul: t.gMul == null ? 1 : t.gMul,
        bMul: t.bMul == null ? 1 : t.bMul, aMul: t.aMul == null ? 1 : t.aMul,
        rOff: t.rOff || 0, gOff: t.gOff || 0, bOff: t.bOff || 0, aOff: t.aOff || 0
      };
    },

    /**
     * A filter stack as a CSS filter string.
     *
     * `blurX`/`blurY` collapse to one radius: the canvas filter property has
     * no anisotropic blur, and a shape blurred 20 across and 2 down is rare
     * enough that an averaged radius beats not having blur at all. The SVG
     * export, which CAN express it, does.
     */
    css(filters) {
      if (!filters || !filters.length) return '';
      const parts = [];
      for (let i = 0; i < filters.length; i++) {
        const f = filters[i];
        if (!f || f.enabled === false) continue;
        const rgba = (c, a) => toRGBA(c == null ? 0 : c, a == null ? 1 : a);
        if (f.type === 'blur') {
          const r = (Math.abs(f.blurX == null ? 4 : f.blurX) +
                     Math.abs(f.blurY == null ? 4 : f.blurY)) / 4;
          if (r > 0) parts.push('blur(' + r.toFixed(2) + 'px)');
        } else if (f.type === 'dropShadow') {
          const d = f.distance == null ? 4 : f.distance;
          const a = ((f.angle == null ? 45 : f.angle) * Math.PI) / 180;
          const bl = Math.abs(f.blur == null ? 4 : f.blur) / 2;
          parts.push('drop-shadow(' + (Math.cos(a) * d).toFixed(2) + 'px ' +
                     (Math.sin(a) * d).toFixed(2) + 'px ' + bl.toFixed(2) + 'px ' +
                     rgba(f.color == null ? 0x000000 : f.color, f.alpha == null ? 0.6 : f.alpha) + ')');
        } else if (f.type === 'glow') {
          const bl2 = Math.abs(f.blur == null ? 6 : f.blur) / 2;
          const col = rgba(f.color == null ? 0xff0000 : f.color, f.alpha == null ? 1 : f.alpha);
          // Strength is how many times the glow is laid over itself, which is
          // what Flash's `strength` did — one pass reads as a faint halo.
          const reps = Math.max(1, Math.min(4, Math.round(f.strength == null ? 2 : f.strength)));
          for (let k = 0; k < reps; k++) parts.push('drop-shadow(0 0 ' + bl2.toFixed(2) + 'px ' + col + ')');
        } else if (f.type === 'bevel') {
          // A highlight on one side and a shadow on the other: the two
          // offset shadows Flash's bevel came down to.
          const d2 = f.distance == null ? 4 : f.distance;
          const a2 = ((f.angle == null ? 45 : f.angle) * Math.PI) / 180;
          const bl3 = Math.abs(f.blur == null ? 4 : f.blur) / 2;
          parts.push('drop-shadow(' + (Math.cos(a2) * d2).toFixed(2) + 'px ' +
                     (Math.sin(a2) * d2).toFixed(2) + 'px ' + bl3.toFixed(2) + 'px ' +
                     rgba(f.shadowColor == null ? 0x000000 : f.shadowColor, 0.6) + ')');
          parts.push('drop-shadow(' + (-Math.cos(a2) * d2).toFixed(2) + 'px ' +
                     (-Math.sin(a2) * d2).toFixed(2) + 'px ' + bl3.toFixed(2) + 'px ' +
                     rgba(f.highlightColor == null ? 0xffffff : f.highlightColor, 0.6) + ')');
        } else if (f.type === 'adjustColor') {
          // These four ARE expressible in CSS filter functions, and doing them
          // here keeps them off the pixel pass.
          const br = (f.brightness || 0) / 100, co = (f.contrast || 0) / 100;
          const sa = (f.saturation || 0) / 100, hu = f.hue || 0;
          if (br) parts.push('brightness(' + (1 + br).toFixed(3) + ')');
          if (co) parts.push('contrast(' + (1 + co).toFixed(3) + ')');
          if (sa) parts.push('saturate(' + (1 + sa).toFixed(3) + ')');
          if (hu) parts.push('hue-rotate(' + hu + 'deg)');
        }
      }
      return parts.join(' ');
    },

    /* ---- gradient glow and gradient bevel ---------------------------
     * The two filters whose colour is a RAMP rather than a single value, and
     * the two that CSS cannot express at all: a drop-shadow function takes one
     * colour, and no amount of stacking turns that into a gradient.
     *
     * Flash's construction, which is what is built here: blur the object's own
     * alpha silhouette, then look the blurred alpha up in the ramp. Where the
     * silhouette is solid you get the ramp's far end; where it has faded away
     * to nothing you get the near end. A glow lays that halo under the object;
     * a bevel offsets it twice along the light angle, taking one half of the
     * ramp for the lit side and the other for the shadowed one.
     *
     * The ramp lives here because four things need the same colours: this
     * canvas pass, the SVG export's feComponentTransfer tables, the exported
     * player (which runs this very code), and the tween between keyframes.
     * ------------------------------------------------------------------ */

    /** The default ramp: transparent at the centre, solid colour at the edge. */
    DEFAULT_STOPS: [
      { ratio: 0, color: 0xffffff, alpha: 0 },
      { ratio: 255, color: 0xff3366, alpha: 1 }
    ],

    /**
     * A filter's ramp as 256 RGBA entries, indexed by blurred alpha.
     *
     * `stops` are Flash's: a ratio from 0 to 255, a colour, and an alpha.
     * Unsorted or out-of-range stops are tolerated — a document is data, and
     * refusing to draw is worse than drawing the obvious interpretation.
     */
    ramp(f) {
      const raw = (f && f.stops && f.stops.length ? f.stops : this.DEFAULT_STOPS)
        .map(s => ({
          ratio: Math.max(0, Math.min(255, s.ratio == null ? 0 : s.ratio)),
          color: typeof s.color === 'string'
            ? parseInt(String(s.color).replace('#', ''), 16) : (s.color | 0),
          alpha: s.alpha == null ? 1 : Math.max(0, Math.min(1, s.alpha))
        }))
        .sort((a, b) => a.ratio - b.ratio);
      const out = new Uint8ClampedArray(256 * 4);
      let k = 0;
      for (let i = 0; i < 256; i++) {
        while (k < raw.length - 2 && raw[k + 1].ratio < i) k++;
        const a = raw[k], b = raw[Math.min(k + 1, raw.length - 1)];
        const span = b.ratio - a.ratio;
        const t = span > 0 ? Math.max(0, Math.min(1, (i - a.ratio) / span))
                           : (i >= b.ratio ? 1 : 0);
        const mix = (sh) => ((a.color >> sh) & 0xff) +
                            (((b.color >> sh) & 0xff) - ((a.color >> sh) & 0xff)) * t;
        out[i * 4] = mix(16);
        out[i * 4 + 1] = mix(8);
        out[i * 4 + 2] = mix(0);
        out[i * 4 + 3] = (a.alpha + (b.alpha - a.alpha) * t) * 255;
      }
      return out;
    },

    /**
     * The ramp as per-channel tables for SVG's feComponentTransfer.
     *
     * `n` samples, each 0..1. The SVG export copies the blurred alpha into
     * R, G and B and then maps each through its own table, which is how an
     * alpha-indexed colour ramp is expressed in a filter primitive.
     */
    rampTable(f, n) {
      n = Math.max(2, n || 16);
      const r = this.ramp(f);
      const ch = [[], [], [], []];
      for (let i = 0; i < n; i++) {
        const at = Math.round((i / (n - 1)) * 255) * 4;
        for (let c = 0; c < 4; c++) ch[c].push(+(r[at + c] / 255).toFixed(4));
      }
      return { r: ch[0], g: ch[1], b: ch[2], a: ch[3] };
    },

    /** The enabled gradient filters in a stack, in order. */
    gradientPasses(filters) {
      const out = [];
      if (!filters) return out;
      for (let i = 0; i < filters.length; i++) {
        const f = filters[i];
        if (!f || f.enabled === false) continue;
        if (f.type === 'gradientGlow' || f.type === 'gradientBevel') out.push(f);
      }
      return out;
    },

    /**
     * One halo layer, built from an already-rendered silhouette.
     *
     * The source canvas holds the object as drawn. Blurring it and then
     * replacing every pixel's colour with the ramp entry its blurred alpha
     * points at turns the silhouette into the halo — and because the lookup is
     * by alpha, the object's own colours never leak into the glow.
     */
    halo(src, f) {
      const w = src.width, h = src.height;
      const slot = this._acquire(w, h);
      if (!slot) return null;
      const g = slot.ctx;
      const blur = Math.max(0, f.blur == null ? 8 : f.blur) / 2;
      const ang = ((f.angle == null ? 45 : f.angle) * Math.PI) / 180;
      const dist = f.type === 'gradientBevel' ? (f.distance == null ? 4 : f.distance) : 0;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, w, h);
      g.filter = blur > 0 ? 'blur(' + blur.toFixed(2) + 'px)' : 'none';
      if (f.type === 'gradientBevel') {
        /* Two offset copies, one each way along the light angle. They overlap
           in the middle, where the ramp is at its transparent centre, which is
           what makes a bevel read as an edge rather than two shadows. */
        g.drawImage(src, Math.cos(ang) * dist, Math.sin(ang) * dist);
        g.drawImage(src, -Math.cos(ang) * dist, -Math.sin(ang) * dist);
      } else {
        g.drawImage(src, 0, 0);
      }
      g.filter = 'none';
      let img;
      try { img = g.getImageData(0, 0, w, h); }
      catch (e) { this._release(slot); return null; }   // a tainted canvas
      const d = img.data;
      const ramp = this.ramp(f);
      // Strength multiplies the halo's alpha, which is what Flash's did.
      const str = Math.max(0, Math.min(4, f.strength == null ? 1 : f.strength));
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (!a) continue;
        const at = a * 4;
        d[i] = ramp[at];
        d[i + 1] = ramp[at + 1];
        d[i + 2] = ramp[at + 2];
        d[i + 3] = Math.min(255, ramp[at + 3] * str);
      }
      g.putImageData(img, 0, 0);
      /* The slot is handed back to the caller still busy: it IS the returned
         canvas, so releasing it here would let the next nested filter paint
         over a layer that has not been composited yet. */
      return { canvas: slot.canvas, slot: slot };
    },

    /** How far outside its box a filter stack can reach, in pixels. */
    extent(filters) {
      let pad = 0;
      if (!filters) return 0;
      for (let i = 0; i < filters.length; i++) {
        const f = filters[i];
        if (!f || f.enabled === false) continue;
        if (f.type === 'blur') {
          pad = Math.max(pad, Math.abs(f.blurX || 0), Math.abs(f.blurY || 0));
        } else if (f.type === 'dropShadow' || f.type === 'bevel') {
          pad = Math.max(pad, Math.abs(f.distance || 0) + Math.abs(f.blur || 0));
        } else if (f.type === 'glow') {
          pad = Math.max(pad, Math.abs(f.blur || 0));
        } else if (f.type === 'gradientGlow' || f.type === 'gradientBevel') {
          pad = Math.max(pad, Math.abs(f.blur || 0) + Math.abs(f.distance || 0));
        }
      }
      return pad;
    },

    /* A pool of full-canvas scratch buffers. Filters nest (a glowing symbol
       containing a blurred shape), so one shared buffer would be overwritten
       mid-composite; the pool hands out a fresh one per nesting level and
       takes it back afterwards. */
    _pool: [],
    _acquire(w, h) {
      for (let i = 0; i < this._pool.length; i++) {
        const e = this._pool[i];
        if (!e.busy && e.canvas.width === w && e.canvas.height === h) {
          e.busy = true;
          e.ctx.setTransform(1, 0, 0, 1, 0, 0);
          e.ctx.clearRect(0, 0, w, h);
          return e;
        }
      }
      const canvas = typeof document !== 'undefined'
        ? document.createElement('canvas') : null;
      if (!canvas) return null;
      canvas.width = w; canvas.height = h;
      const e = { canvas, ctx: canvas.getContext('2d'), busy: true };
      // Bounded, so a long session cannot accumulate buffers. Four levels of
      // nested filters is already more than any real document uses.
      if (this._pool.length < 6) this._pool.push(e);
      return e;
    },
    _release(e) { if (e) e.busy = false; },

    /* ---- tweening ----------------------------------------------------
     * Filters and the Colour Effect interpolate between keyframes — how a
     * glow pulses and a tint fades. Here rather than in the editor because
     * the exported player interpolates its own keyframes and would otherwise
     * need a second copy of this, which is how the four renderers drifted
     * apart in the first place.
     * ------------------------------------------------------------------ */

    /** Numeric fields each filter type interpolates. */
    TWEEN_NUMS: {
      blur: ["blurX", "blurY", "quality"],
      dropShadow: ["distance", "angle", "blur", "alpha", "strength"],
      glow: ["blur", "alpha", "strength"],
      bevel: ["distance", "angle", "blur", "strength"],
      gradientGlow: ["blur", "angle", "strength"],
      gradientBevel: ["distance", "angle", "blur", "strength"],
      adjustColor: ["brightness", "contrast", "saturation", "hue"]
    },
    /** Colour fields each filter type blends. */
    TWEEN_COLORS: {
      dropShadow: ["color"],
      glow: ["color"],
      bevel: ["highlightColor", "shadowColor"]
    },

    _num(a, b, t, dflt) {
      const av = typeof a === "number" ? a : dflt;
      const bv = typeof b === "number" ? b : dflt;
      return av + (bv - av) * t;
    },
    _color(a, b, t) {
      const n = v => typeof v === "string"
        ? parseInt(String(v).replace("#", ""), 16) : (v | 0);
      const an = n(a), bn = n(b);
      const mix = sh => {
        const av = (an >> sh) & 0xff, bv = (bn >> sh) & 0xff;
        return Math.max(0, Math.min(255, Math.round(av + (bv - av) * t))) << sh;
      };
      return mix(16) | mix(8) | mix(0);
    },
    _clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); },

    /**
     * Two filter stacks, blended.
     *
     * Only when they agree about the SHAPE of the stack — same filters, in the
     * same order. There is no sensible interpolation between "blur" and "drop
     * shadow", and guessing one produces a frame that is neither, so the start
     * frame's stack holds instead.
     */
    lerpFilters(a, b, t) {
      if (!a || !a.length) return (b && b.length) ? this._clone(b) : null;
      if (!b || !b.length) return this._clone(a);
      if (a.length !== b.length) return this._clone(a);
      const out = [];
      for (let i = 0; i < a.length; i++) {
        if (!a[i] || !b[i] || a[i].type !== b[i].type) {
          out.push(this._clone(a[i] || b[i]));
          continue;
        }
        const f = this._clone(a[i]);
        (this.TWEEN_NUMS[f.type] || []).forEach(k => {
          if (a[i][k] != null || b[i][k] != null) f[k] = this._num(a[i][k], b[i][k], t, 0);
        });
        (this.TWEEN_COLORS[f.type] || []).forEach(k => {
          if (a[i][k] != null && b[i][k] != null) f[k] = this._color(a[i][k], b[i][k], t);
        });
        /* A gradient ramp tweens stop by stop, but only when the two
           keyframes agree about how MANY stops there are — inserting a stop
           mid-tween has no sensible meaning, so the start frame's ramp holds,
           the same rule the whole stack already follows for its shape. */
        if (a[i].stops && b[i].stops && a[i].stops.length === b[i].stops.length) {
          f.stops = a[i].stops.map((sa, si) => {
            const sb = b[i].stops[si];
            return {
              ratio: this._num(sa.ratio, sb.ratio, t, 0),
              color: this._color(sa.color == null ? 0 : sa.color,
                                 sb.color == null ? 0 : sb.color, t),
              alpha: this._num(sa.alpha, sb.alpha, t, 1)
            };
          });
        }
        out.push(f);
      }
      return out;
    },

    /** One colour effect at `t` of its full strength; 0 is no effect at all. */
    rampColorEffect(e, t) {
      if (!e || !e.mode || e.mode === "none") return null;
      const out = this._clone(e);
      if (e.mode === "brightness") out.brightness = (e.brightness || 0) * t;
      else if (e.mode === "tint") out.amount = (e.amount == null ? 1 : e.amount) * t;
      else if (e.mode === "advanced") {
        ["rMul", "gMul", "bMul", "aMul"].forEach(k => {
          const v = e[k] == null ? 1 : e[k];
          out[k] = 1 + (v - 1) * t;
        });
        ["rOff", "gOff", "bOff", "aOff"].forEach(k => { out[k] = (e[k] || 0) * t; });
      }
      return out;
    },

    /**
     * Two colour effects, blended.
     *
     * Fading INTO or OUT OF an effect is the common case and has an obvious
     * answer: ramp the effect's strength from (or to) nothing. Between two
     * different modes it does not, so the start frame's wins.
     */
    lerpColorEffect(a, b, t) {
      const am = (a && a.mode) || "none", bm = (b && b.mode) || "none";
      if (am === "none" && bm === "none") return null;
      if (am === "none") return this.rampColorEffect(b, t);
      if (bm === "none") return this.rampColorEffect(a, 1 - t);
      if (am !== bm) return this._clone(a);
      const out = this._clone(a);
      if (am === "brightness") out.brightness = this._num(a.brightness, b.brightness, t, 0);
      else if (am === "tint") {
        out.amount = this._num(a.amount, b.amount, t, 1);
        if (a.color != null && b.color != null) out.color = this._color(a.color, b.color, t);
      } else if (am === "advanced") {
        ["rMul", "gMul", "bMul", "aMul"].forEach(k => { out[k] = this._num(a[k], b[k], t, 1); });
        ["rOff", "gOff", "bOff", "aOff"].forEach(k => { out[k] = this._num(a[k], b[k], t, 0); });
      }
      return out;
    },

    /** Per-channel multiply and offset, over a whole scratch buffer. */
    applyColor(ctx, w, h, ct) {
      if (!this.hasColor(ct) || !w || !h) return;
      let img;
      try {
        img = ctx.getImageData(0, 0, w, h);
      } catch (e) {
        return;   // a tainted canvas: leave the pixels alone rather than throw
      }
      const d = img.data;
      const rm = ct.rMul, gm = ct.gMul, bm = ct.bMul, am = ct.aMul;
      const ro = ct.rOff, go = ct.gOff, bo = ct.bOff, ao = ct.aOff;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        // Fully transparent pixels must stay transparent: a positive offset
        // applied to them would paint the whole scratch buffer, and the buffer
        // is the size of the stage.
        if (a === 0) continue;
        d[i]     = d[i]     * rm + ro;
        d[i + 1] = d[i + 1] * gm + go;
        d[i + 2] = d[i + 2] * bm + bo;
        d[i + 3] = a * am + ao;
      }
      ctx.putImageData(img, 0, 0);
    },

    /**
     * Run `draw` through a filter stack and a colour transform.
     *
     * With neither, `draw` is called straight on `ctx` and nothing is
     * allocated — which is the case for almost every object in a document.
     */
    render(ctx, filters, colorTransform, draw) {
      const css = this.css(filters);
      const needsColor = this.hasColor(colorTransform);
      const grads = this.gradientPasses(filters);
      if (!css && !needsColor && !grads.length) { draw(ctx); return; }
      const target = ctx.canvas;
      const slot = this._acquire(target.width, target.height);
      if (!slot) { draw(ctx); return; }     // no DOM: render unfiltered
      const octx = slot.ctx;
      const halos = [];
      // Same transform, so the object lands in the same device pixels; the
      // composite is then a straight 1:1 blit.
      octx.setTransform(ctx.getTransform());
      octx.globalAlpha = ctx.globalAlpha;
      try {
        draw(octx);
        if (needsColor) {
          octx.setTransform(1, 0, 0, 1, 0, 0);
          this.applyColor(octx, target.width, target.height, colorTransform);
        }
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Alpha is already baked into the buffer; applying it again would
        // square it.
        ctx.globalAlpha = 1;
        /* Gradient halos go UNDER the object, and with no CSS filter of their
           own — the stack's blur or glow applies to the artwork, not to a halo
           that has already been blurred to build it. */
        for (let gi = 0; gi < grads.length; gi++) {
          const made = this.halo(slot.canvas, grads[gi]);
          if (!made) continue;
          ctx.filter = 'none';
          ctx.drawImage(made.canvas, 0, 0);
          halos.push(made.slot);
        }
        ctx.filter = css || 'none';
        ctx.drawImage(slot.canvas, 0, 0);
        ctx.filter = 'none';
        ctx.restore();
      } finally {
        for (let hi = 0; hi < halos.length; hi++) this._release(halos[hi]);
        this._release(slot);
      }
    }
  };

  /* -------------------- 9-slice scaling --------------------
   *
   * Four guides cut a symbol into nine pieces. Scaling it then stretches only
   * the middles: the corners keep their size, the top and bottom edges stretch
   * horizontally, the left and right edges vertically. It is the difference
   * between a button that can be any width and a button whose rounded corners
   * smear when you widen it.
   *
   * The cell maths is here, in one place, because three renderers need it and
   * they must agree to the pixel: the authoring stage, the SVG export, and the
   * NineSlice display object below that the exported player uses.
   * -------------------------------------------------------------------- */
  const Slice9 = {
    /**
     * The nine source→destination rectangles.
     *
     * `grid` is {left, right, top, bottom} in the symbol's own pixels —
     * distances in from each edge, which is how Flash's guides were specified.
     * Guides that do not fit the destination are scaled down together, so a
     * button narrower than its own two corners degrades instead of overlapping
     * them.
     */
    cells(grid, natW, natH, dstW, dstH) {
      natW = Math.abs(natW) || 1; natH = Math.abs(natH) || 1;
      dstW = Math.abs(dstW) || 1; dstH = Math.abs(dstH) || 1;
      let l = Math.max(0, grid && grid.left || 0);
      let r = Math.max(0, grid && grid.right || 0);
      let t = Math.max(0, grid && grid.top || 0);
      let b = Math.max(0, grid && grid.bottom || 0);
      // Clamp in source space first: guides wider than the symbol are a
      // document error, not a reason to produce negative-width cells.
      if (l + r > natW) { const k = natW / (l + r); l *= k; r *= k; }
      if (t + b > natH) { const k = natH / (t + b); t *= k; b *= k; }
      // Then in destination space, so the corners never overlap.
      let dl = l, dr = r, dt = t, db = b;
      if (dl + dr > dstW) { const k = dstW / (dl + dr); dl *= k; dr *= k; }
      if (dt + db > dstH) { const k = dstH / (dt + db); dt *= k; db *= k; }

      const sxs = [0, l, natW - r, natW];
      const dxs = [0, dl, dstW - dr, dstW];
      const sys = [0, t, natH - b, natH];
      const dys = [0, dt, dstH - db, dstH];
      const out = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const sw = sxs[col + 1] - sxs[col], sh = sys[row + 1] - sys[row];
          const dw = dxs[col + 1] - dxs[col], dh = dys[row + 1] - dys[row];
          // A zero-width cell is what you get when a guide sits on an edge;
          // emitting it would mean a divide by zero in the scale below.
          if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) continue;
          out.push({
            sx: sxs[col], sy: sys[row], sw, sh,
            dx: dxs[col], dy: dys[row], dw, dh
          });
        }
      }
      return out;
    },

    /** True when a grid would actually change anything. */
    active(grid) {
      return !!(grid && (grid.left || grid.right || grid.top || grid.bottom));
    },

    /**
     * Draw `content` nine times, each piece clipped and scaled into place.
     *
     * `draw(ctx)` paints the content at its natural size with its origin at
     * (0,0) — which is the convention the editor's symbol painter and the
     * engine's container both already use.
     */
    render(ctx, grid, natW, natH, dstW, dstH, draw) {
      const cells = this.cells(grid, natW, natH, dstW, dstH);
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        ctx.save();
        ctx.beginPath();
        ctx.rect(c.dx, c.dy, c.dw, c.dh);
        ctx.clip();
        ctx.translate(c.dx, c.dy);
        ctx.scale(c.dw / c.sw, c.dh / c.sh);
        ctx.translate(-c.sx, -c.sy);
        draw(ctx);
        ctx.restore();
      }
    }
  };

  /* -------------------- Motion guides --------------------
   *
   * A motion guide layer holds a drawn path, and the layers beneath it follow
   * it: a tween's position comes from the path rather than from a straight
   * line between its keyframes. It is how anything arcs — a thrown ball, a
   * paper aeroplane, a camera push — and the alternative is a keyframe every
   * few frames with the curve eyeballed by hand.
   *
   * The sampler is here rather than in the editor because the exported player
   * has its own copy of the keyframe interpolator and would otherwise need a
   * second copy of this. `polyline()` takes a plain object with the fields
   * every artwork object carries, so both sides hand it the same thing.
   * ------------------------------------------------------------------ */
  const MotionGuide = {
    /** Flatten a drawn object into a stage-space polyline, or null. */
    polyline(o) {
      if (!o) return null;
      const hw = Math.abs(o.width || 0) / 2, hh = Math.abs(o.height || 0) / 2;
      // The painter's convention: translate to the centre, rotate, scale.
      const rot = (o.rotation || 0) * Math.PI / 180;
      const cs = Math.cos(rot), sn = Math.sin(rot);
      const sx = o.scaleX == null ? 1 : o.scaleX, sy = o.scaleY == null ? 1 : o.scaleY;
      const cx = (o.x || 0) + hw, cy = (o.y || 0) + hh;
      const map = (lx, ly) => {
        const px = lx * sx, py = ly * sy;
        return [cx + px * cs - py * sn, cy + px * sn + py * cs];
      };
      const out = [];
      if ((o.type === "pencil" || o.type === "brush" || o.type === "path-points") &&
          o.points && o.points.length >= 4) {
        for (let i = 0; i < o.points.length; i += 2) {
          const p = map(o.points[i] - hw, o.points[i + 1] - hh);
          out.push(p[0], p[1]);
        }
        return out;
      }
      if (o.type === "line") {
        // A straight guide is still a guide, and it is the one people draw
        // first to check the feature does anything.
        const a = map(-hw, -hh), b = map(hw, hh);
        return [a[0], a[1], b[0], b[1]];
      }
      if (o.type === "path" && o.path && o.path.length) {
        /* The four-opcode command stream, replayed inline: 0 moveTo, 1 lineTo,
           2 quadTo, 3 closePath. Quadratics are flattened at a fixed step —
           a guide only needs to be smooth enough to sample along. */
        const psx = o.pathW ? (Math.abs(o.width) / o.pathW) : 1;
        const psy = o.pathH ? (Math.abs(o.height) / o.pathH) : 1;
        const X = v => v * psx - hw, Y = v => v * psy - hh;
        let k = 0, lx = 0, ly = 0, started = false;
        const push = (x, y) => { const p = map(x, y); out.push(p[0], p[1]); };
        while (k < o.path.length) {
          const cmd = o.path[k];
          if (cmd === 0 || cmd === 1) {
            lx = X(o.path[k + 1]); ly = Y(o.path[k + 2]);
            // A second moveTo starts a new subpath; a guide is one stroke, so
            // the first subpath is the guide and the rest are ignored.
            if (cmd === 0 && started) break;
            push(lx, ly); started = true; k += 3;
          } else if (cmd === 2) {
            const qx = X(o.path[k + 1]), qy = Y(o.path[k + 2]);
            const ex = X(o.path[k + 3]), ey = Y(o.path[k + 4]);
            for (let s = 1; s <= 8; s++) {
              const u = s / 8, iu = 1 - u;
              push(iu * iu * lx + 2 * iu * u * qx + u * u * ex,
                   iu * iu * ly + 2 * iu * u * qy + u * u * ey);
            }
            lx = ex; ly = ey; k += 5;
          } else {
            k += 1;
          }
        }
        return out.length >= 4 ? out : null;
      }
      return null;
    },

    /** Cumulative arc lengths along a polyline, and its total. */
    arc(pts) {
      const lens = [0];
      let total = 0;
      for (let i = 2; i < pts.length; i += 2) {
        total += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
        lens.push(total);
      }
      return { lens, total };
    },

    /**
     * The point `t` of the way along a polyline, by ARC LENGTH, with the
     * tangent angle there.
     *
     * By length rather than by vertex index, because a traced or hand-drawn
     * path has its points bunched up round the curves — indexing would make an
     * object crawl through the bends and bolt down the straights.
     */
    sampleAt(pts, t, cached) {
      if (!pts || pts.length < 4) return null;
      const a = cached || this.arc(pts);
      if (!a.total) return { x: pts[0], y: pts[1], angle: 0 };
      const want = Math.max(0, Math.min(1, t)) * a.total;
      let i = 1;
      while (i < a.lens.length - 1 && a.lens[i] < want) i++;
      const l0 = a.lens[i - 1], l1 = a.lens[i];
      const seg = l1 - l0 || 1;
      const u = (want - l0) / seg;
      const x0 = pts[(i - 1) * 2], y0 = pts[(i - 1) * 2 + 1];
      const x1 = pts[i * 2], y1 = pts[i * 2 + 1];
      return {
        x: x0 + (x1 - x0) * u,
        y: y0 + (y1 - y0) * u,
        angle: Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI
      };
    },

    /**
     * Which motion-guide layer governs the layer at `index`, or null.
     *
     * The same flat-list-with-a-run idiom mask layers use: a layer of type
     * "motionguide", and the "guided" layers directly beneath it follow it.
     */
    guideFor(layers, index) {
      if (!layers || !layers[index]) return null;
      if ((layers[index].layerType || "normal") !== "guided") return null;
      for (let i = index - 1; i >= 0; i--) {
        const t = layers[i].layerType || "normal";
        if (t === "motionguide") return layers[i];
        if (t !== "guided") return null;
      }
      return null;
    }
  };

  /* -------------------- Shape tweening --------------------
   *
   * A shape tween is supposed to MORPH one outline into another — a circle
   * into a star, a mouth into a different mouth. What it actually did was
   * interpolate the two objects' boxes and transforms, exactly like a motion
   * tween with a different colour in the timeline: a rectangle tweened to an
   * oval stayed a rectangle the whole way and then snapped.
   *
   * This walks both outlines at an even arc-length step, pairs them up, and
   * interpolates point by point. Shape hints steer the pairing, which is the
   * entire reason Flash had them: without one, "which bit of the circle
   * becomes which bit of the star" is a guess, and the wrong guess makes the
   * shape turn inside out on its way across.
   *
   * It lives here, not in the editor, because the exported player tweens its
   * own keyframes and would otherwise need a second copy — the same reason
   * Filters and Slice9 are here.
   * ------------------------------------------------------------------ */
  const Morph = {
    /** Signed area of a flat loop; the sign is its winding direction. */
    area2(loop) {
      let a = 0;
      for (let i = 0, n = loop.length; i < n; i += 2) {
        const j = (i + 2) % n;
        a += loop[i] * loop[j + 1] - loop[j] * loop[i + 1];
      }
      return a;
    },

    reverse(loop) {
      const out = [];
      for (let i = loop.length - 2; i >= 0; i -= 2) out.push(loop[i], loop[i + 1]);
      return out;
    },

    /**
     * An object's outline(s) as flat loops in stage space.
     *
     * Deliberately independent of the editor's geometry module, which is an
     * authoring-time file and is not shipped with an export.
     */
    loops(o) {
      if (!o) return [];
      const w = Math.abs(o.width || 0), h = Math.abs(o.height || 0);
      const hw = w / 2, hh = h / 2;
      const rot = (o.rotation || 0) * Math.PI / 180;
      const cs = Math.cos(rot), sn = Math.sin(rot);
      const sx = o.scaleX == null ? 1 : o.scaleX, sy = o.scaleY == null ? 1 : o.scaleY;
      const cx = (o.x || 0) + hw, cy = (o.y || 0) + hh;
      const map = (lx, ly) => {
        const px = lx * sx, py = ly * sy;
        return [cx + px * cs - py * sn, cy + px * sn + py * cs];
      };
      const emit = local => {
        const out = [];
        for (let i = 0; i < local.length; i += 2) {
          const p = map(local[i], local[i + 1]);
          out.push(p[0], p[1]);
        }
        return out;
      };

      /* Only things that ARE an outline. A symbol, group, bitmap or text
         block has contents rather than a shape, and morphing its bounding box
         would throw those contents away — Flash made you Break Apart first for
         exactly this reason. The caller falls back to interpolating the
         transform, which is at least still the object. */
      /* A parameterised primitive morphs from its real outline, not from its
         bounding box — a pie wedge that grew out of a circle should morph as a
         wedge. Primitives.path emits box coordinates, so handing it back
         through the "path" branch with pathW/pathH equal to the box leaves the
         scale factors at 1 and reuses one loop-walker. */
      if (Primitives.active(o)) {
        const prim = Primitives.path(o);
        if (prim && prim.length) {
          return this.loops({ ...o, type: "path", path: prim, pathW: w, pathH: h });
        }
      }
      if (o.type === "rect") {
        return [emit([-hw, -hh, hw, -hh, hw, hh, -hw, hh])];
      }
      if (o.type === "oval") {
        const local = [];
        const steps = Math.max(16, Math.min(96, Math.round((w + h) / 4)));
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          local.push(Math.cos(a) * hw, Math.sin(a) * hh);
        }
        return [emit(local)];
      }
      if ((o.type === "pencil" || o.type === "brush") && o.points && o.points.length >= 6) {
        const local = [];
        for (let i = 0; i < o.points.length; i += 2) {
          local.push(o.points[i] - hw, o.points[i + 1] - hh);
        }
        return [emit(local)];
      }
      if (o.type === "line") {
        return [emit([-hw, -hh, hw, hh])];
      }
      if (o.type === "path" && o.path && o.path.length) {
        const psx = o.pathW ? (w / o.pathW) : 1, psy = o.pathH ? (h / o.pathH) : 1;
        const X = v => v * psx - hw, Y = v => v * psy - hh;
        const out = [];
        let cur = null, lx = 0, ly = 0;
        let k = 0;
        const close = () => {
          if (cur && cur.length >= 6) out.push(emit(cur));
          cur = null;
        };
        while (k < o.path.length) {
          const cmd = o.path[k];
          if (cmd === 0) {
            close();
            lx = X(o.path[k + 1]); ly = Y(o.path[k + 2]);
            cur = [lx, ly]; k += 3;
          } else if (cmd === 1) {
            lx = X(o.path[k + 1]); ly = Y(o.path[k + 2]);
            if (cur) cur.push(lx, ly);
            k += 3;
          } else if (cmd === 2) {
            const qx = X(o.path[k + 1]), qy = Y(o.path[k + 2]);
            const ex = X(o.path[k + 3]), ey = Y(o.path[k + 4]);
            for (let s = 1; s <= 6; s++) {
              const u = s / 6, iu = 1 - u;
              if (cur) {
                cur.push(iu * iu * lx + 2 * iu * u * qx + u * u * ex,
                         iu * iu * ly + 2 * iu * u * qy + u * u * ey);
              }
            }
            lx = ex; ly = ey; k += 5;
          } else {
            k += 1;
          }
        }
        close();
        return out;
      }
      return [];
    },

    /** `n` points evenly spaced by arc length round a closed loop. */
    resample(loop, n) {
      const m = loop.length / 2;
      if (m < 2) return loop.slice();
      const lens = [0];
      let total = 0;
      for (let i = 0; i < m; i++) {
        const j = (i + 1) % m;
        total += Math.hypot(loop[j * 2] - loop[i * 2], loop[j * 2 + 1] - loop[i * 2 + 1]);
        lens.push(total);
      }
      if (!total) return loop.slice();
      const out = [];
      let seg = 0;
      for (let k = 0; k < n; k++) {
        const want = (k / n) * total;
        while (seg < m - 1 && lens[seg + 1] < want) seg++;
        const l0 = lens[seg], l1 = lens[seg + 1];
        const u = (l1 - l0) ? (want - l0) / (l1 - l0) : 0;
        const i = seg, j = (seg + 1) % m;
        out.push(loop[i * 2] + (loop[j * 2] - loop[i * 2]) * u,
                 loop[i * 2 + 1] + (loop[j * 2 + 1] - loop[i * 2 + 1]) * u);
      }
      return out;
    },

    /** Where a point sits round a loop, as 0..1 of its arc length. */
    paramOf(loop, x, y) {
      const m = loop.length / 2;
      let best = 0, bestD = Infinity, bestLen = 0, total = 0;
      const lens = [0];
      for (let i = 0; i < m; i++) {
        const j = (i + 1) % m;
        total += Math.hypot(loop[j * 2] - loop[i * 2], loop[j * 2 + 1] - loop[i * 2 + 1]);
        lens.push(total);
      }
      for (let i = 0; i < m; i++) {
        const j = (i + 1) % m;
        const ax = loop[i * 2], ay = loop[i * 2 + 1];
        const bx = loop[j * 2], by = loop[j * 2 + 1];
        const vx = bx - ax, vy = by - ay;
        const len2 = vx * vx + vy * vy;
        let u = len2 ? ((x - ax) * vx + (y - ay) * vy) / len2 : 0;
        u = Math.max(0, Math.min(1, u));
        const qx = ax + vx * u, qy = ay + vy * u;
        const d = (x - qx) * (x - qx) + (y - qy) * (y - qy);
        if (d < bestD) {
          bestD = d; best = i;
          bestLen = lens[i] + Math.sqrt(len2) * u;
        }
      }
      void best;
      return total ? bestLen / total : 0;
    },

    /**
     * A parameter map from loop A's outline to loop B's, built from hints.
     *
     * No hints: identity, with B rotated so its nearest-to-A's-start point
     * lines up — which is the best guess available and is usually right for
     * two shapes drawn in the same orientation.
     *
     * One hint: a constant offset, so the marked point of A becomes the marked
     * point of B.
     *
     * Several: piecewise linear between them, wrapping round. This is what
     * makes a hand morph into another hand instead of turning inside out.
     */
    paramMap(pairs) {
      if (!pairs || !pairs.length) return u => u;
      if (pairs.length === 1) {
        const d = pairs[0][1] - pairs[0][0];
        return u => ((u + d) % 1 + 1) % 1;
      }
      const sorted = pairs.slice().sort((p, q) => p[0] - q[0]);
      return u => {
        u = ((u % 1) + 1) % 1;
        for (let i = 0; i < sorted.length; i++) {
          const a = sorted[i];
          const b = sorted[(i + 1) % sorted.length];
          let a0 = a[0], a1 = b[0];
          let b0 = a[1], b1 = b[1];
          // The last span wraps past 1 back to the first.
          if (a1 <= a0) a1 += 1;
          if (b1 <= b0) b1 += 1;
          let uu = u;
          if (uu < a0) uu += 1;
          if (uu >= a0 && uu <= a1) {
            const f = (a1 - a0) ? (uu - a0) / (a1 - a0) : 0;
            return ((b0 + (b1 - b0) * f) % 1 + 1) % 1;
          }
        }
        return u;
      };
    },

    /** How many samples to morph with: enough for the bigger shape. */
    sampleCount(a, b) {
      const n = Math.max(a.length, b.length) / 2;
      return Math.max(24, Math.min(240, Math.round(n)));
    },

    /**
     * Morph `a` into `b` at `t`, as a path command stream in stage space.
     *
     * Returns `{path, x, y, width, height, pathW, pathH}` or null when either
     * object has no outline to morph.
     */
    between(a, b, t, hints) {
      const la = this.loops(a), lb = this.loops(b);
      if (!la.length || !lb.length) return null;
      // Biggest first, so the body of a shape pairs with the body of the other
      // rather than with one of its holes.
      const byArea = arr => arr.slice().sort((p, q) =>
        Math.abs(this.area2(q)) - Math.abs(this.area2(p)));
      const sa = byArea(la), sb = byArea(lb);
      const pairs = Math.min(sa.length, sb.length);
      const path = [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      for (let p = 0; p < pairs; p++) {
        let A = sa[p], B = sb[p];
        // Opposite windings make the two walk round each other backwards, so
        // every point pairs with the far side of the shape.
        if ((this.area2(A) < 0) !== (this.area2(B) < 0)) B = this.reverse(B);
        const n = this.sampleCount(A, B);
        const ra = this.resample(A, n);
        let rb = this.resample(B, n);

        let map;
        if (p === 0 && hints && hints.length) {
          const hp = [];
          for (let i = 0; i < hints.length; i++) {
            const hint = hints[i];
            hp.push([this.paramOf(A, hint[0], hint[1]), this.paramOf(B, hint[2], hint[3])]);
          }
          map = this.paramMap(hp);
        } else {
          // Rotate B so its start is nearest A's, the best guess with nothing
          // to go on.
          let bestK = 0, bestD = Infinity;
          for (let k = 0; k < n; k++) {
            const d = Math.hypot(rb[k * 2] - ra[0], rb[k * 2 + 1] - ra[1]);
            if (d < bestD) { bestD = d; bestK = k; }
          }
          const rot = [];
          for (let k = 0; k < n; k++) {
            const j = (bestK + k) % n;
            rot.push(rb[j * 2], rb[j * 2 + 1]);
          }
          rb = rot;
          map = u => u;
        }

        const at = (loop, u) => {
          const m = loop.length / 2;
          const f = (((u % 1) + 1) % 1) * m;
          const i = Math.floor(f) % m, j = (i + 1) % m;
          const g = f - Math.floor(f);
          return [loop[i * 2] + (loop[j * 2] - loop[i * 2]) * g,
                  loop[i * 2 + 1] + (loop[j * 2 + 1] - loop[i * 2 + 1]) * g];
        };

        for (let k = 0; k < n; k++) {
          const u = k / n;
          const pa = at(ra, u);
          const pb = at(rb, map(u));
          const x = pa[0] + (pb[0] - pa[0]) * t;
          const y = pa[1] + (pb[1] - pa[1]) * t;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          path.push(k === 0 ? 0 : 1, x, y);
        }
        path.push(3);
      }
      if (!isFinite(minX)) return null;
      // Shifted to a 0,0 origin, which is what a path object's stream expects.
      for (let i = 0; i < path.length;) {
        const cmd = path[i];
        if (cmd === 3) { i += 1; continue; }
        path[i + 1] -= minX;
        path[i + 2] -= minY;
        i += 3;
      }
      const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
      return { path, x: minX, y: minY, width: w, height: h, pathW: w, pathH: h };
    }
  };

  /* -------------------- Shape primitives --------------------
   *
   * A rectangle with rounded corners, and an oval that can be an arc, a pie
   * or a donut. Flash called these the Rectangle and Oval PRIMITIVE tools, and
   * the point of them is that the parameters stay editable: a rounded
   * rectangle is still a rectangle with a radius, not a path that has
   * forgotten it ever had one.
   *
   * The geometry lives here, as a path command stream in the same four-opcode
   * encoding flashy-trace.js uses, because five things need it and must agree:
   * the canvas painter, the SVG exporter, the exported player, the morph, and
   * the eraser's region maths. A rounded corner that is one shape on the stage
   * and another in the export is worse than no rounded corner.
   * -------------------------------------------------------------------- */
  const Primitives = {
    /** True when an object carries primitive parameters worth honouring. */
    active(o) {
      if (!o) return false;
      if (o.type === 'rect') return (o.cornerRadius || 0) > 0;
      if (o.type === 'oval') {
        return (o.ovalStart || 0) !== 0 || (o.ovalEnd == null ? 360 : o.ovalEnd) !== 360 ||
               (o.ovalInner || 0) > 0;
      }
      return false;
    },

    /**
     * The primitive's outline as a command stream, in a 0,0-origin box of
     * `w` x `h`. Returns null when the object is not a parameterised
     * primitive, so every caller can fall back to its plain shape.
     */
    path(o) {
      const w = Math.abs(o.width || 0), h = Math.abs(o.height || 0);
      if (!w || !h) return null;
      if (o.type === 'rect') {
        const r0 = Math.max(0, o.cornerRadius || 0);
        if (!r0) return null;
        // A radius larger than half the shorter side would make the corners
        // overlap, so it is capped rather than allowed to invert the outline.
        const r = Math.min(r0, Math.min(w, h) / 2);
        const p = [];
        p.push(0, 0, r);                      // MOVE, start below the top-left
        p.push(1, 0, h - r);                  // down the left side
        p.push(2, 0, h, r, h);                // bottom-left corner
        p.push(1, w - r, h);                  // along the bottom
        p.push(2, w, h, w, h - r);            // bottom-right
        p.push(1, w, r);                      // up the right
        p.push(2, w, 0, w - r, 0);            // top-right
        p.push(1, r, 0);                      // along the top
        p.push(2, 0, 0, 0, r);                // top-left
        p.push(3);
        return p;
      }
      if (o.type === 'oval') {
        const start = (o.ovalStart || 0);
        const end = (o.ovalEnd == null ? 360 : o.ovalEnd);
        /* The inner radius is a PERCENTAGE of the outer, which is what the
           Properties panel and the tool options both show — 0 is a solid
           oval, 50 is a band half the radius wide. */
        const inner = Math.max(0, Math.min(99, o.ovalInner || 0)) / 100;
        const sweep = end - start;
        if (Math.abs(sweep) < 0.01) return null;
        const full = Math.abs(sweep) >= 359.99;
        const cx = w / 2, cy = h / 2;
        const p = [];
        const arc = (rx, ry, from, to, moveFirst) => {
          /* Quadratics, one per 45 degrees or less. A quadratic cannot draw a
             circular arc exactly, but at 45 degrees the error is under a
             thousandth of the radius — far below a pixel at any size anyone
             draws — and it keeps the whole outline in one encoding. */
          const steps = Math.max(1, Math.ceil(Math.abs(to - from) / 45));
          const step = (to - from) / steps;
          const rad = d => (d - 90) * Math.PI / 180;    // 0 degrees at the top
          let a0 = from;
          const at = d => [cx + Math.cos(rad(d)) * rx, cy + Math.sin(rad(d)) * ry];
          if (moveFirst) { const s = at(from); p.push(0, s[0], s[1]); }
          for (let i = 0; i < steps; i++) {
            const a1 = a0 + step;
            const mid = (a0 + a1) / 2;
            const pm = at(mid), p1 = at(a1), p0 = at(a0);
            // The control point that makes the quadratic pass through the
            // arc's midpoint: 2*mid - (start + end)/2.
            p.push(2, 2 * pm[0] - (p0[0] + p1[0]) / 2,
                      2 * pm[1] - (p0[1] + p1[1]) / 2, p1[0], p1[1]);
            a0 = a1;
          }
        };
        if (inner > 0) {
          // A donut (or a ring segment): the outer arc, then the inner one
          // walked backwards, so the hole is a loop wound the other way.
          arc(w / 2, h / 2, start, end, true);
          if (full) {
            p.push(3);
            arc((w / 2) * inner, (h / 2) * inner, end, start, true);
            p.push(3);
          } else {
            /* A ring segment is one loop: out along the outer arc, straight
               in across the end cap, back along the inner arc, and closed
               across the start cap. The explicit line is what makes the cap
               straight — without it the first inner quadratic would curve
               across the gap. */
            const rad = d => (d - 90) * Math.PI / 180;
            p.push(1, cx + Math.cos(rad(end)) * (w / 2) * inner,
                      cy + Math.sin(rad(end)) * (h / 2) * inner);
            arc((w / 2) * inner, (h / 2) * inner, end, start, false);
            p.push(3);
          }
        } else if (full) {
          arc(w / 2, h / 2, start, end, true);
          p.push(3);
        } else {
          // A pie: out from the centre, round, and back.
          p.push(0, cx, cy);
          arc(w / 2, h / 2, start, end, false);
          p.push(1, cx, cy);
          p.push(3);
        }
        return p;
      }
      return null;
    }
  };

  // -------------------- DisplayObject --------------------
  class DisplayObject {
    constructor() {
      this.name = '';
      this.x = 0; this.y = 0;
      this.scaleX = 1; this.scaleY = 1;
      this.rotation = 0;
      this.skewX = 0; this.skewY = 0;
      this.alpha = 1;
      this.visible = true;
      this.mouseEnabled = true;
      this.blendMode = null;
      this.shadowBlur = 0;
      this.shadowColor = 0x000000;
      /* Flash 8 filters and the Colour Effect. Both default to nothing, and
         when they are nothing the render path below allocates nothing — which
         is every object in a document that does not use them. */
      this.filters = null;
      this.colorTransform = null;
      this.parent = null;
      this._listeners = {};
    }
    get rotationDeg()  { return this.rotation * 180 / Math.PI; }
    set rotationDeg(v) { this.rotation = v * Math.PI / 180; }

    addEventListener(type, fn) {
      const arr = this._listeners[type] || (this._listeners[type] = []);
      arr.push(fn);
      return this;
    }
    removeEventListener(type, fn) {
      const arr = this._listeners[type]; if (!arr) return;
      const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1);
    }
    hasEventListener(type) { return !!(this._listeners[type] && this._listeners[type].length); }
    dispatchEvent(type, evt) {
      const arr = this._listeners[type]; if (!arr || !arr.length) return;
      evt = evt || { type };
      evt.type = type;
      evt.target = evt.target || this;
      evt.currentTarget = this;
      const copy = arr.slice();
      for (let i = 0; i < copy.length; i++) copy[i].call(this, evt);
    }

    _applyTransform(ctx) {
      if (this.x !== 0 || this.y !== 0) ctx.translate(this.x, this.y);
      if (this.rotation) ctx.rotate(this.rotation);
      if (this.skewX || this.skewY) ctx.transform(1, Math.tan(this.skewY), Math.tan(this.skewX), 1, 0, 0);
      if (this.scaleX !== 1 || this.scaleY !== 1) ctx.scale(this.scaleX, this.scaleY);
      if (this.alpha !== 1) ctx.globalAlpha *= this.alpha;
      if (this.blendMode) ctx.globalCompositeOperation = this.blendMode;
      if (this.shadowBlur) {
        ctx.shadowColor = toRGBA(this.shadowColor, 1);
        ctx.shadowBlur  = this.shadowBlur;
      }
    }

    _tick(dt) { /* override */ }
    render(ctx) { /* override */ }

    /**
     * render(), through this object's filters and colour transform.
     *
     * Containers and the Stage call THIS, never render() directly: a filter
     * has to see the object's whole composite, children included, so it has
     * to wrap the subtree rather than each drawing operation.
     */
    _renderFiltered(ctx) {
      const hasF = this.filters && this.filters.length &&
                   this.filters.some(f => f && f.enabled !== false);
      if (!hasF && !Filters.hasColor(this.colorTransform)) { this.render(ctx); return; }
      Filters.render(ctx, this.filters, this.colorTransform, c => this.render(c));
    }

    removeFromParent() { if (this.parent) this.parent.removeChild(this); return this; }
  }

  // -------------------- Shape --------------------
  class Shape extends DisplayObject {
    constructor() { super(); this.graphics = new Graphics(); }
    render(ctx) { this.graphics.render(ctx); }
  }

  // -------------------- TextField --------------------
  /**
   * A text field.
   *
   * Three kinds, as in Flash, and the difference is what they can do rather
   * than how they look:
   *
   *   static   drawn and forgotten — a caption
   *   dynamic  has a name, so a script can write to it: a score, a timer, a
   *            line of dialogue
   *   input    the reader can type into it: a name, an answer, a search box
   *
   * Without the last two there is no score display, no form and no typed-in
   * name — an entire class of Flash content is unreachable.
   */
  /* -------------------- Rich text --------------------
   *
   * Flash's `TextField.html`: a dynamic field whose VALUE is markup. It is how
   * every score display with a coloured number, every chat window and every
   * styled caption in Flash content was built, because a field could only have
   * one format otherwise.
   *
   * The subset is Flash's own, and it is small: b, i, u, br, p align, font
   * with color/size/face, and a href (drawn as a link, not clickable — there
   * is nothing here to navigate). Anything else is dropped rather than shown,
   * because showing a tag the user did not write is worse than ignoring one
   * this does not know.
   *
   * It lives here, beside TextField, because the authoring stage, the raster
   * exports and the exported player all draw through that one class. The SVG
   * export emits tspans from the same run list.
   * ------------------------------------------------------------------ */
  const RichText = {
    /** The five entities Flash decoded, and the only ones worth the table. */
    ENTITIES: { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: '\u00a0' },

    decode(s) {
      return String(s).replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, k) => {
        if (k[0] === '#') {
          const n = k[1] === 'x' || k[1] === 'X'
            ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
          return isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
        }
        const e = this.ENTITIES[k.toLowerCase()];
        return e == null ? m : e;
      });
    },

    /**
     * Parse markup into paragraphs of styled runs.
     *
     * Returns `[{align, runs: [{text, bold, italic, underline, color, size,
     * face, link}]}]`. Style is a stack, so nesting works and a stray closing
     * tag pops nothing rather than throwing — a field's value is data, usually
     * assembled by a script, and refusing to draw it is the worst outcome.
     */
    parse(src, base) {
      base = base || {};
      const paras = [];
      let runs = [];
      let align = base.align || 'left';
      /* Whether the last paragraph break came from </p> rather than <br>. A
         trailing </p> closes the last paragraph and does NOT add a blank line
         after it; a trailing <br> does, because that is what a line break at
         the end of a value means. */
      let closedByP = false;
      const stack = [{
        bold: !!base.bold, italic: !!base.italic, underline: !!base.underline,
        color: base.color == null ? null : base.color,
        size: base.size || null, face: base.face || null, link: null
      }];
      const top = () => stack[stack.length - 1];
      const endPara = () => { paras.push({ align, runs }); runs = []; };
      const push = text => {
        if (!text) return;
        const st = top();
        runs.push({
          text, bold: st.bold, italic: st.italic, underline: st.underline,
          color: st.color, size: st.size, face: st.face, link: st.link
        });
      };

      const re = /<\s*(\/?)\s*([a-zA-Z]+)([^>]*)>/g;
      let at = 0, m;
      while ((m = re.exec(String(src))) !== null) {
        push(this.decode(String(src).slice(at, m.index)));
        at = m.index + m[0].length;
        const closing = m[1] === '/';
        const tag = m[2].toLowerCase();
        const attrs = m[3] || '';
        const attr = name => {
          const a = new RegExp(name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')
            .exec(attrs);
          return a ? this.decode(a[2] != null ? a[2] : (a[3] != null ? a[3] : a[4])) : null;
        };
        if (tag === 'br') { endPara(); closedByP = false; continue; }
        if (tag === 'p') {
          if (closing) { endPara(); closedByP = true; continue; }
          // An opening <p> starts a paragraph only if the current one has
          // content; otherwise it is just setting this one's alignment.
          if (runs.length) endPara();
          align = (attr('align') || 'left').toLowerCase();
          continue;
        }
        if (closing) {
          if (stack.length > 1) stack.pop();
          continue;
        }
        const st = Object.assign({}, top());
        if (tag === 'b' || tag === 'strong') st.bold = true;
        else if (tag === 'i' || tag === 'em') st.italic = true;
        else if (tag === 'u') st.underline = true;
        else if (tag === 'a') { st.link = attr('href') || ''; st.underline = true; }
        else if (tag === 'font') {
          const c = attr('color');
          if (c) st.color = parseInt(String(c).replace('#', ''), 16);
          const sz = parseFloat(attr('size'));
          if (isFinite(sz) && sz > 0) st.size = sz;
          const f = attr('face');
          if (f) st.face = f;
        }
        /* An unknown tag still pushes a style frame, so its closing tag pops
           that frame rather than one that mattered. */
        stack.push(st);
      }
      push(this.decode(String(src).slice(at)));
      if (runs.length || !closedByP || !paras.length) endPara();
      return paras;
    },

    /** The canvas font string for one run, given the field's own. */
    fontFor(run, baseSize, baseFace, bold, italic) {
      const size = run.size || baseSize;
      const face = run.face || baseFace;
      const parts = [];
      if (run.italic || italic) parts.push('italic');
      if (run.bold || bold) parts.push('bold');
      parts.push(size + 'px');
      parts.push(face);
      return parts.join(' ');
    }
  };

  /* -------------------- Fonts --------------------
   *
   * Flash's text had two decisions that look like preferences and are not.
   *
   * ANTI-ALIAS MODE really changed the pixels. "Bitmap text" switched the
   * rasteriser off entirely, "readability" hinted the glyphs onto the pixel
   * grid, and "animation" left them smooth so sub-pixel motion did not
   * shimmer. Flashy recorded the setting and drew the same thing four ways,
   * and said so in the inspector, which was honest but not a feature.
   *
   * EMBEDDING decided whether the viewer needed the font installed. A device
   * font used whatever the player had; an embedded one shipped the outlines.
   * Without it, a cartoon set in anything but Arial renders in a fallback on
   * most machines, which is the single most visible way Flash content aged.
   *
   * Both are here rather than in the editor because the authoring stage, the
   * raster exports and the exported player all draw through TextField.
   * ------------------------------------------------------------------ */
  const Fonts = {
    /* A device font is the player's own. Flash's three were _sans, _serif and
       _typewriter, and they map onto the generic families every browser has
       -- which is the same promise: whatever this machine has. */
    DEVICE: {
      _sans: 'sans-serif',
      _serif: 'serif',
      _typewriter: 'monospace'
    },

    /** The family to draw with, after the device-font substitution. */
    familyFor(face, antiAlias) {
      const f = String(face || 'Arial');
      if (this.DEVICE[f]) return this.DEVICE[f];
      /* "Use device fonts" means do not ship outlines and do not insist on
         the named face: take the generic family it belongs to. Naming the
         face as well keeps it when the viewer happens to have it. */
      if (antiAlias === 'device') return f + ', sans-serif';
      return f;
    },

    /**
     * Snap a coordinate to the pixel grid for the readability mode.
     *
     * Hinting proper needs the font's own instructions, which a browser will
     * not hand over. What it IS possible to do is stop a glyph straddling a
     * pixel boundary, which is where most of the blur in small text comes
     * from -- so that is what this does, and the claim is no bigger.
     */
    snap(v, antiAlias) {
      return antiAlias === 'readability' ? Math.round(v) : v;
    },

    /**
     * Harden a drawn region to pure on-or-off pixels.
     *
     * Flash's "Bitmap text (no anti-alias)" at work. Alpha above the midpoint
     * becomes solid and the rest disappears, which is exactly what a
     * one-bit rasteriser produces -- small text goes crisp and ugly, which is
     * the point of choosing it.
     */
    threshold(ctx, x, y, w, h) {
      w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
      x = Math.floor(x); y = Math.floor(y);
      let img;
      try { img = ctx.getImageData(x, y, w, h); }
      catch (e) { return false; }          // a tainted canvas: leave it smooth
      const d = img.data;
      for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 127 ? 255 : 0;
      ctx.putImageData(img, x, y);
      return true;
    },

    /* ---- embedded outlines -------------------------------------------
     * A glyph becomes a path the same way a bitmap does: it is drawn big and
     * then traced. Flashy already has a tracer that turns a rendered image
     * into outlines, and a glyph is just a very simple image -- so embedding
     * needs no font parser, and the outlines it produces go down the same
     * four render paths every other path object does.
     * ------------------------------------------------------------------ */

    /** The size a glyph is rasterised at before tracing. */
    EM: 128,

    /** Which characters a range means. */
    RANGES: {
      used: null,                                  // whatever the document uses
      numerals: '0123456789.,-+$%',
      basic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ',
      latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ' +
             '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~ ¡¿‘’“”–—…',
      punctuation: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
    },

    /**
     * Trace one glyph into a path, in a 0..1 em box.
     *
     * Normalised to the em rather than kept at 128px, so a field can use the
     * outlines at any size without re-tracing -- which is the difference
     * between embedding a font once and embedding it per text block.
     */
    traceGlyph(ch, font, tracer) {
      if (typeof document === 'undefined' || !tracer) return null;
      const em = this.EM;
      const pad = Math.ceil(em * 0.4);
      const cv = document.createElement('canvas');
      cv.width = em * 2; cv.height = em * 2;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.font = font.replace(/\d+(?:\.\d+)?px/, em + 'px');
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#000000';
      ctx.fillText(ch, pad, em + pad * 0.5);
      const advance = ctx.measureText(ch).width / em;
      // A space has no ink; it is an advance and nothing else.
      if (!String(ch).trim()) return { advance, path: null };

      let traced;
      try {
        /* The tracer takes ImageData, not a canvas, and its thresholds are
           named keys rather than numbers. A high colour threshold is wanted
           here: a glyph is two colours and anything between them is the
           rasteriser's edge, which should go with the ink. */
        traced = tracer.trace(ctx.getImageData(0, 0, cv.width, cv.height),
                              { colorThreshold: 200, minArea: 2,
                                curveFit: 'normal', cornerThreshold: 'normal' });
      } catch (e) { return null; }
      if (!traced || !traced.shapes || !traced.shapes.length) {
        return { advance, path: null };
      }
      /* The tracer returns one shape per colour region and the lightest is
         the paper, so the glyph is everything else. Dropping the biggest
         region by area is the reliable test: the background always is. */
      const shapes = traced.shapes.slice().sort((a, b) => b.area - a.area);
      const ink = shapes.slice(1);
      if (!ink.length) return { advance, path: null };
      const path = [];
      ink.forEach(sh => {
        for (let i = 0; i < sh.path.length;) {
          const op = sh.path[i];
          const n = op === 0 || op === 1 ? 2 : op === 2 ? 4 : 0;
          path.push(op);
          for (let k = 0; k < n; k += 2) {
            // Into em units, with the pen origin at the glyph's own origin.
            path.push((sh.path[i + 1 + k] - pad) / em);
            path.push((sh.path[i + 2 + k] - em - pad * 0.5) / em);
          }
          i += 1 + n;
        }
      });
      return { advance, path };
    },

    /**
     * Build an embedded face: a glyph table for a set of characters.
     *
     * Slow -- one rasterise and trace per character -- which is why it is a
     * command rather than something that happens while you type. The result
     * goes on the document and is reused by every field that asks for it.
     */
    embed(face, opts, tracer) {
      opts = opts || {};
      const chars = Array.from(new Set(Array.from(String(opts.chars || ''))))
        .filter(c => c !== '\n' && c !== '\r');
      const font = (opts.italic ? 'italic ' : '') + (opts.bold ? 'bold ' : '') +
                   this.EM + 'px ' + face;
      const glyphs = {};
      let traced = 0;
      chars.forEach(ch => {
        const g = this.traceGlyph(ch, font, tracer);
        if (!g) return;
        glyphs[ch] = g;
        if (g.path) traced++;
      });
      return {
        face, bold: !!opts.bold, italic: !!opts.italic,
        glyphs, count: Object.keys(glyphs).length, traced
      };
    },

    /** The key a document files an embedded face under. */
    faceKey(face, bold, italic) {
      return String(face || 'Arial') + (bold ? '|b' : '') + (italic ? '|i' : '');
    },

    /**
     * Draw a string from an embedded face.
     *
     * Returns the width drawn, or null when the face cannot cover the string
     * -- the caller then falls back to the system font rather than dropping
     * characters, because a missing glyph is far more visible than a
     * substituted one.
     */
    drawEmbedded(ctx, face, str, x, y, size, letterSpacing) {
      if (!face || !face.glyphs) return null;
      const text = String(str == null ? '' : str);
      for (let i = 0; i < text.length; i++) {
        if (!face.glyphs[text[i]]) return null;
      }
      let pen = x;
      for (let i = 0; i < text.length; i++) {
        const g = face.glyphs[text[i]];
        if (g.path && g.path.length) {
          ctx.beginPath();
          for (let k = 0; k < g.path.length;) {
            const op = g.path[k];
            if (op === 0) { ctx.moveTo(pen + g.path[k + 1] * size, y + g.path[k + 2] * size); k += 3; }
            else if (op === 1) { ctx.lineTo(pen + g.path[k + 1] * size, y + g.path[k + 2] * size); k += 3; }
            else if (op === 2) {
              ctx.quadraticCurveTo(pen + g.path[k + 1] * size, y + g.path[k + 2] * size,
                                   pen + g.path[k + 3] * size, y + g.path[k + 4] * size);
              k += 5;
            } else { ctx.closePath(); k += 1; }
          }
          ctx.fill('evenodd');
        }
        pen += g.advance * size + (letterSpacing || 0);
      }
      return pen - x;
    },

    /** How wide a string is in an embedded face, or null if it cannot cover it. */
    measureEmbedded(face, str, size, letterSpacing) {
      if (!face || !face.glyphs) return null;
      const text = String(str == null ? '' : str);
      let w = 0;
      for (let i = 0; i < text.length; i++) {
        const g = face.glyphs[text[i]];
        if (!g) return null;
        w += g.advance * size + (letterSpacing || 0);
      }
      return w;
    }
  };

  class TextField extends DisplayObject {
    constructor(text, opts) {
      super();
      opts = opts || {};
      this.text     = text || '';
      this.font     = opts.font || '24px sans-serif';
      this.color    = opts.color != null ? opts.color : 0x000000;
      this.align    = opts.align || 'left';
      this.baseline = opts.baseline || 'top';
      this.stroke   = opts.stroke || null;
      this.strokeWidth = opts.strokeWidth || 0;
      this.lineHeight = opts.lineHeight || null;

      // The box. Zero width means "as wide as the text", which is what a
      // static caption wants and what this class used to assume always.
      this.width  = opts.width  || 0;
      this.height = opts.height || 0;

      this.type = opts.type || 'static';
      /** Dynamic and input fields can be bound to a name a script reads. */
      this.variable = opts.variable || '';
      this.selectable = !!opts.selectable;
      this.border = !!opts.border;
      this.borderColor = opts.borderColor != null ? opts.borderColor : 0x000000;
      this.background = opts.background != null ? opts.background : null;
      /** single | multiline | multilineNoWrap | password */
      this.lineType = opts.lineType || 'single';
      this.letterSpacing = opts.letterSpacing || 0;
      this.maxChars = opts.maxChars || 0;
      this.underline = !!opts.underline;
      /** Render the value as markup rather than as literal text. */
      this.html = !!opts.html;
      /* Auto-kern. Canvas applies a font's kerning pairs when it draws a whole
         string and cannot when it draws one character at a time, so this is
         literally a choice between the two draw paths rather than a table
         lookup. Default on, which is what every existing document has been
         getting. */
      this.kerning = opts.kerning !== false;
      /* Baseline shift, in pixels: positive lifts. Superscript and subscript
         are this plus a smaller size, which is what they always were. */
      this.baselineShift = opts.baselineShift || 0;
      this.scriptStyle = opts.scriptStyle || 'normal';   // normal|super|sub
      /* Anti-alias mode. Not a recorded preference: `bitmap` hardens the
         rasterised pixels, `readability` snaps the glyphs onto the pixel
         grid, `device` substitutes the player's own family, and `animation`
         leaves it smooth because sub-pixel motion should not shimmer. */
      this.antiAlias = opts.antiAlias || 'normal';
      /* An embedded face: a glyph table built by tracing the font once. Null
         means draw with whatever the machine has, which is what a device font
         asks for and what every document did before this existed. */
      this.embedded = opts.embedded || null;

      // Input state. A field only reacts when the Stage has focused it.
      this.focused = false;
      this.caret = String(this.text).length;
      this.mouseEnabled = this.type === 'input' || this.selectable;
    }

    /** What is actually drawn: a password field shows dots, not its value. */
    displayText() {
      const t = String(this.text == null ? '' : this.text);
      if (this.lineType === 'password') return t.replace(/[^\n]/g, '•');
      return t;
    }

    fontSize() { return parseInt(this.font, 10) || 24; }
    lineStep() { return this.lineHeight || this.fontSize() * 1.2; }

    /**
     * The font and baseline offset after superscript or subscript.
     *
     * Flash drew both as a smaller face shifted off the baseline -- there is no
     * separate glyph set -- and at 58% and a third of the size the result
     * matches the proportions it used closely enough to be unremarkable.
     */
    scriptMetrics() {
      const size = this.fontSize();
      let shift = this.baselineShift;
      let scale = 1;
      if (this.scriptStyle === 'super') { shift += size * 0.33; scale = 0.58; }
      else if (this.scriptStyle === 'sub') { shift -= size * 0.16; scale = 0.58; }
      return { shift, scale, size: Math.max(1, Math.round(size * scale)) };
    }

    /** The font string with one size swapped in, keeping style and face. */
    _fontAtSize(size) {
      return this.font.replace(/(\d+(?:\.\d+)?)px/, size + 'px');
    }

    /** Measure a string, honouring letter spacing. */
    measure(ctx, str) {
      /* An embedded face measures from its own advances. It has to: the
         system font may not even be installed, so asking the canvas would
         measure a fallback and lay the line out for the wrong font. */
      if (this.embedded) {
        const w = Fonts.measureEmbedded(this.embedded, str, this.fontSize(),
                                        this.letterSpacing);
        if (w != null) return w;
      }
      if (!this.kerning && !this.letterSpacing) {
        /* Unkerned: the width is the sum of the individual advances, which is
           what the unkerned DRAW produces. Measuring the whole string here
           and drawing it per character would misplace every centred line. */
        let sum = 0;
        for (let i = 0; i < str.length; i++) sum += ctx.measureText(str[i]).width;
        return sum;
      }
      const w = ctx.measureText(str).width;
      return this.letterSpacing ? w + this.letterSpacing * str.length : w;
    }

    /**
     * The lines to draw.
     *
     * `single` collapses newlines — a single-line field that silently grew a
     * second line would overflow its box with no way to see why. `multiline`
     * wraps at the box width; `multilineNoWrap` does not.
     */
    lines(ctx) {
      const raw = this.displayText();
      if (this.lineType === 'single' || this.lineType === 'password') {
        return [raw.replace(/\n/g, ' ')];
      }
      const src = raw.split('\n');
      if (this.lineType !== 'multiline' || !this.width) return src;
      const out = [];
      for (let i = 0; i < src.length; i++) {
        const words = src[i].split(' ');
        let line = '';
        for (let w = 0; w < words.length; w++) {
          const next = line ? line + ' ' + words[w] : words[w];
          if (line && this.measure(ctx, next) > this.width) {
            out.push(line);
            line = words[w];
          } else {
            line = next;
          }
        }
        out.push(line);
      }
      return out;
    }

    /** Draw one line, character by character when letter spacing is in play. */
    _drawLine(ctx, str, x, y) {
      /* Embedded outlines first. They are real paths, so they scale, rotate
         and export like any other artwork -- and the viewer does not need the
         font installed, which is the whole reason to embed. */
      if (this.embedded) {
        const size = this.fontSize();
        const total = Fonts.measureEmbedded(this.embedded, str, size,
                                            this.letterSpacing);
        if (total != null) {
          let pen = x;
          if (ctx.textAlign === 'center') pen = x - total / 2;
          else if (ctx.textAlign === 'right') pen = x - total;
          ctx.fillStyle = toRGBA(this.color, 1);
          /* The baseline. `textBaseline` does not apply to a path, so the
             offset the canvas would have added is added here: `top` means the
             box's top, and a glyph sits one em-ascent below it. */
          const base = this.baseline === 'top' ? y + size * 0.8 : y;
          Fonts.drawEmbedded(ctx, this.embedded, str,
                             Fonts.snap(pen, this.antiAlias),
                             Fonts.snap(base, this.antiAlias),
                             size, this.letterSpacing);
          return;
        }
        /* The face cannot cover this string, so fall through to the system
           font: a substituted glyph is far less visible than a missing one. */
      }
      x = Fonts.snap(x, this.antiAlias);
      y = Fonts.snap(y, this.antiAlias);
      if (!this.letterSpacing && this.kerning) {
        if (this.strokeWidth > 0 && this.stroke != null) {
          ctx.lineWidth = this.strokeWidth;
          ctx.strokeStyle = toRGBA(this.stroke, 1);
          ctx.strokeText(str, x, y);
        }
        ctx.fillStyle = toRGBA(this.color, 1);
        ctx.fillText(str, x, y);
        return;
      }
      /* Canvas gained a `letterSpacing` property only recently, and the whole
         point of an export is that it runs anywhere — so the spacing is
         applied by walking the string. */
      const total = this.measure(ctx, str);
      let pen = x;
      if (ctx.textAlign === 'center') pen = x - total / 2;
      else if (ctx.textAlign === 'right') pen = x - total;
      const prev = ctx.textAlign;
      ctx.textAlign = 'left';
      for (let i = 0; i < str.length; i++) {
        if (this.strokeWidth > 0 && this.stroke != null) {
          ctx.lineWidth = this.strokeWidth;
          ctx.strokeStyle = toRGBA(this.stroke, 1);
          ctx.strokeText(str[i], pen, y);
        }
        ctx.fillStyle = toRGBA(this.color, 1);
        ctx.fillText(str[i], pen, y);
        pen += ctx.measureText(str[i]).width + this.letterSpacing;
      }
      ctx.textAlign = prev;
    }

    render(ctx) {
      /* Bitmap text: the field is drawn normally and then its pixels are
         hardened to on-or-off. Done as a second pass over the region rather
         than by a different draw, because every other feature -- wrapping,
         markup, borders, embedded glyphs -- has to keep working underneath
         it. */
      if (this.antiAlias === 'bitmap' && typeof document !== 'undefined') {
        /* Drawn into a scratch canvas of its own and thresholded there, then
           blitted back. Hardening the live canvas in place would need the
           field's box in DEVICE pixels -- and the painter has already
           translated, rotated and scaled by then, so that box is not a
           rectangle any more. A scratch sidesteps the question: the field is
           the only thing in it. */
        const box = this.hitBox();
        const m = ctx.getTransform ? ctx.getTransform() : null;
        const sx = m ? Math.max(0.05, Math.hypot(m.a, m.b)) : 1;
        const sy = m ? Math.max(0.05, Math.hypot(m.c, m.d)) : 1;
        const pad = 2;
        const w = Math.ceil((box.maxX + pad * 2) * sx);
        const h = Math.ceil((box.maxY + pad * 2) * sy);
        // A field bigger than this is not going to be read as bitmap text,
        // and a scratch that size costs more than the effect is worth.
        if (w > 0 && h > 0 && w * h <= 16e6) {
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const g = cv.getContext('2d', { willReadFrequently: true });
          g.scale(sx, sy);
          g.translate(pad, pad);
          const was = this.antiAlias;
          this.antiAlias = 'readability';      // snap while drawing
          try { this._renderInner(g); } finally { this.antiAlias = was; }
          Fonts.threshold(g, 0, 0, w, h);
          ctx.save();
          ctx.imageSmoothingEnabled = false;   // a hard edge must stay hard
          ctx.drawImage(cv, -pad, -pad, w / sx, h / sy);
          ctx.restore();
          return;
        }
      }
      this._renderInner(ctx);
    }

    _renderInner(ctx) {
      /* Markup is a different layout problem -- runs with their own fonts,
         measured and wrapped together -- so it gets its own pass rather than
         a flag threaded through this one. */
      if (this.html) { this._renderHTML(ctx); return; }
      const met = this.scriptMetrics();
      ctx.font = met.scale === 1 ? this.font : this._fontAtSize(met.size);
      ctx.textAlign = this.align;
      ctx.textBaseline = this.baseline;
      const lh = this.lineStep();
      const lines = this.lines(ctx);
      const boxW = this.width || this.measure(ctx, lines[0] || '');
      const boxH = this.height || lines.length * lh;

      // Background and border are what make an input field look like one.
      if (this.background != null) {
        ctx.fillStyle = toRGBA(this.background, 1);
        ctx.fillRect(0, 0, boxW, boxH);
      }
      if (this.border) {
        ctx.strokeStyle = toRGBA(this.borderColor, 1);
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, boxW - 1, boxH - 1);
      }

      const x = this.align === 'center' ? boxW / 2
              : (this.align === 'right' ? boxW : 0);
      for (let i = 0; i < lines.length; i++) {
        // A positive shift LIFTS, so it subtracts from a downward y axis.
        this._drawLine(ctx, lines[i], x, i * lh - met.shift);
        if (this.underline) {
          const w = this.measure(ctx, lines[i]);
          let ux = x;
          if (this.align === 'center') ux = x - w / 2;
          else if (this.align === 'right') ux = x - w;
          ctx.strokeStyle = toRGBA(this.color, 1);
          ctx.lineWidth = 1;
          ctx.beginPath();
          const uy = i * lh + this.fontSize() + 1 - met.shift;
          ctx.moveTo(ux, uy);
          ctx.lineTo(ux + w, uy);
          ctx.stroke();
        }
      }

      /* The caret, while this field has focus. Blinking, because a static bar
         reads as a character of the text. */
      if (this.focused && this.type === 'input') {
        if (Math.floor(Date.now() / 500) % 2 === 0) {
          const upto = this.displayText().slice(0, this.caret);
          const run = this.measure(ctx, upto);
          const first = lines[0] || '';
          let cx = run;
          if (this.align === 'center') cx = boxW / 2 - this.measure(ctx, first) / 2 + run;
          else if (this.align === 'right') cx = boxW - this.measure(ctx, first) + run;
          ctx.fillStyle = toRGBA(this.color, 1);
          ctx.fillRect(cx, 0, 1, lh);
        }
      }
    }

    /**
     * Lay markup out as lines of runs.
     *
     * Each run keeps its own font, so a line's height is its tallest run and
     * wrapping has to measure run by run. Returns `[{runs, align, h}]` with
     * every run carrying the width it measured at, because the draw would
     * otherwise have to set every font a second time to find out.
     */
    _htmlLines(ctx) {
      const baseSize = this.fontSize();
      const faceMatch = /\d+(?:\.\d+)?px\s+(.*)$/.exec(this.font);
      const baseFace = faceMatch ? faceMatch[1] : 'sans-serif';
      const bold = /bold/.test(this.font), italic = /italic/.test(this.font);
      const paras = RichText.parse(this.text, {
        align: this.align, bold, italic, underline: this.underline,
        color: this.color
      });
      const wrap = this.lineType === 'multiline' && this.width;
      const out = [];
      paras.forEach(p => {
        let line = [], used = 0, tallest = baseSize;
        const flush = () => {
          out.push({ runs: line, align: p.align, h: tallest });
          line = []; used = 0; tallest = baseSize;
        };
        p.runs.forEach(run => {
          ctx.font = RichText.fontFor(run, baseSize, baseFace, bold, italic);
          const size = run.size || baseSize;
          // Split on spaces only when wrapping; otherwise the run is one piece.
          const pieces = wrap ? String(run.text).split(/(\s+)/) : [String(run.text)];
          pieces.forEach(piece => {
            if (!piece) return;
            const w = this.measure(ctx, piece);
            if (wrap && used && used + w > this.width && piece.trim()) {
              flush();
              ctx.font = RichText.fontFor(run, baseSize, baseFace, bold, italic);
            }
            line.push(Object.assign({}, run, { text: piece, w, size }));
            used += w;
            if (size > tallest) tallest = size;
          });
        });
        flush();
      });
      return out;
    }

    _renderHTML(ctx) {
      const baseSize = this.fontSize();
      const faceMatch = /\d+(?:\.\d+)?px\s+(.*)$/.exec(this.font);
      const baseFace = faceMatch ? faceMatch[1] : 'sans-serif';
      const bold = /bold/.test(this.font), italic = /italic/.test(this.font);
      const lines = this._htmlLines(ctx);
      const lh = this.lineStep();
      const boxW = this.width ||
        lines.reduce((m, l) => Math.max(m, l.runs.reduce((a, r) => a + r.w, 0)), 0);
      const boxH = this.height || lines.length * lh;

      if (this.background != null) {
        ctx.fillStyle = toRGBA(this.background, 1);
        ctx.fillRect(0, 0, boxW, boxH);
      }
      if (this.border) {
        ctx.strokeStyle = toRGBA(this.borderColor, 1);
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, boxW - 1, boxH - 1);
      }

      // Runs are drawn left to right from a pen, so the alignment is applied
      // once per line rather than through ctx.textAlign.
      ctx.textAlign = 'left';
      ctx.textBaseline = this.baseline;
      const met = this.scriptMetrics();
      lines.forEach((line, i) => {
        const total = line.runs.reduce((a, r) => a + r.w, 0);
        let pen = line.align === 'center' ? (boxW - total) / 2
                : line.align === 'right' ? boxW - total : 0;
        const y = i * lh - met.shift;
        line.runs.forEach(run => {
          ctx.font = RichText.fontFor(run, baseSize, baseFace, bold, italic);
          ctx.fillStyle = toRGBA(run.color == null ? this.color : run.color, 1);
          ctx.fillText(run.text, pen, y);
          if (run.underline) {
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = 1;
            ctx.beginPath();
            const uy = y + run.size + 1;
            ctx.moveTo(pen, uy);
            ctx.lineTo(pen + run.w, uy);
            ctx.stroke();
          }
          pen += run.w;
        });
      });
      ctx.textAlign = this.align;
    }

    /**
     * The box this field occupies, for the Stage's hit test.
     *
     * A TextField has no `graphics`, so without this the hit test walked past
     * it and an input field could never be clicked into.
     */
    hitBox() {
      const size = this.fontSize();
      const text = String(this.text == null ? '' : this.text);
      return {
        minX: 0, minY: 0,
        maxX: this.width || Math.max(size, size * text.length * 0.6),
        maxY: this.height || this.lineStep() * Math.max(1, text.split('\n').length)
      };
    }

    /**
     * A field built from a document text object.
     *
     * One place the document's text fields turn into a renderer, shared by the
     * authoring stage, the raster exports and the player — the same reason
     * paintObj is the only painter. Before this the editor had its own text
     * drawing code and the export had another, and only one of them knew
     * about alignment.
     */
    static fromObject(o, opts) {
      opts = opts || {};
      const size = o.fontSize || 24;
      const f = new TextField(o.text == null ? '' : o.text, {
        /* The family, after the device-font substitution: `_sans`, `_serif`
           and `_typewriter` are Flash's three device fonts and map onto the
           generic families every browser has, which is the same promise. */
        font: (o.fontItalic ? 'italic ' : '') + (o.fontBold ? 'bold ' : '') +
              size + 'px ' + Fonts.familyFor(o.font, o.antiAlias),
        color: o.fillColor == null ? 0x000000 : o.fillColor,
        align: o.textAlign || 'left',
        lineHeight: (o.lineHeight || 1.2) * size,
        width: Math.abs(o.width || 0),
        height: Math.abs(o.height || 0),
        type: o.textType || 'static',
        variable: o.variableName || '',
        selectable: !!o.selectable,
        border: !!o.textBorder,
        borderColor: o.textBorderColor == null ? 0x000000 : o.textBorderColor,
        background: o.textBackground ? (o.textBackgroundColor == null ? 0xFFFFFF : o.textBackgroundColor) : null,
        lineType: o.lineType || 'single',
        letterSpacing: o.letterSpacing || 0,
        maxChars: o.maxChars || 0,
        underline: !!o.fontUnderline,
        /* Render as HTML, auto-kern, baseline shift and super/subscript.
           `renderAsHtml` has been on every text object since text fields were
           added and was read by nothing at all -- a field could be marked as
           markup and would still draw its tags. */
        html: !!o.renderAsHtml,
        /* The anti-alias mode, which now changes the pixels rather than
           being recorded and ignored. */
        antiAlias: o.antiAlias || 'normal',
        /* An embedded face, when the object asks to be embedded AND the
           document carries one for its family. `opts.fonts` is the table;
           without it there is nothing to embed from and the system font is
           used, which is what a device font wants anyway. */
        embedded: (o.embedFont && o.antiAlias !== 'device' && opts.fonts)
          ? (opts.fonts[Fonts.faceKey(o.font, o.fontBold, o.fontItalic)] || null)
          : null,
        kerning: o.kerning !== false,
        baselineShift: o.baselineShift || 0,
        scriptStyle: o.scriptStyle || 'normal'
      });
      /* On the authoring stage an empty field would be invisible, so it shows
         its placeholder — but an EXPORT must contain the artwork and nothing
         else, or every unfilled dynamic field ships reading "Text". */
      if (opts.chrome && (o.text == null || o.text === '')) f.text = 'Text';
      return f;
    }

    /** Apply one key to an input field. Returns true if the text changed. */
    keyInput(key, ctrlKey) {
      if (this.type !== 'input') return false;
      const t = String(this.text == null ? '' : this.text);
      if (key === 'Backspace') {
        if (!this.caret) return false;
        this.text = t.slice(0, this.caret - 1) + t.slice(this.caret);
        this.caret--;
        return true;
      }
      if (key === 'Delete') {
        if (this.caret >= t.length) return false;
        this.text = t.slice(0, this.caret) + t.slice(this.caret + 1);
        return true;
      }
      if (key === 'ArrowLeft') { this.caret = Math.max(0, this.caret - 1); return false; }
      if (key === 'ArrowRight') { this.caret = Math.min(t.length, this.caret + 1); return false; }
      if (key === 'Home') { this.caret = 0; return false; }
      if (key === 'End') { this.caret = t.length; return false; }
      if (key === 'Enter') {
        if (this.lineType === 'single' || this.lineType === 'password') return false;
        key = '\n';
      }
      /* Anything that is not a single character is a modifier or a function
         key, and must not be typed into the field as its own name — which is
         what happens if you forward every keydown. */
      if (ctrlKey || key.length !== 1) return false;
      if (this.maxChars && t.length >= this.maxChars) return false;
      this.text = t.slice(0, this.caret) + key + t.slice(this.caret);
      this.caret++;
      return true;
    }
  }

  // -------------------- Bitmaps --------------------
  //
  // Raster assets, keyed by name, mirroring how `Sound` holds audio: the
  // document carries encoded bytes, this holds the decoded image, and a
  // `Bitmap` display object refers to one by name. Decoding is async and
  // cached, so the same asset placed on forty frames decodes once.
  //
  // A Bitmap whose image has not arrived yet draws nothing rather than
  // throwing, which is what lets an export start on frame one instead of
  // holding the whole movie hostage to a 3MB photo.
  const Bitmaps = {
    _images: Object.create(null),
    _loading: Object.create(null),

    /** True once `name` has a decoded image ready to draw. */
    has(name) { return !!this._images[name]; },

    /** The decoded image for `name`, or null. */
    get(name) { return this._images[name] || null; },

    /** Every asset name currently decoded. */
    names() { return Object.keys(this._images); },

    /**
     * Decode `src` (a data URI or URL) and cache it as `name`.
     * Repeat calls for a name already loaded (or in flight) share the result.
     */
    load(name, src) {
      if (this._images[name]) return Promise.resolve(this._images[name]);
      if (this._loading[name]) return this._loading[name];
      const p = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this._images[name] = img;
          delete this._loading[name];
          resolve(img);
        };
        img.onerror = () => {
          delete this._loading[name];
          reject(new Error('could not decode bitmap "' + name + '"'));
        };
        img.src = src;
      });
      this._loading[name] = p;
      return p;
    },

    /** Adopt an already-decoded image (canvas, ImageBitmap, HTMLImageElement). */
    put(name, image) { this._images[name] = image; return image; },

    remove(name) { delete this._images[name]; delete this._loading[name]; },
    clear() { this._images = Object.create(null); this._loading = Object.create(null); },

    /** Natural size of an asset, or null if it is not decoded yet. */
    sizeOf(name) {
      const i = this._images[name];
      if (!i) return null;
      return { width: i.naturalWidth || i.width, height: i.naturalHeight || i.height };
    }
  };

  // -------------------- Bitmap --------------------
  class Bitmap extends DisplayObject {
    /**
     * `source` is either an asset name registered with `Flashy.Bitmaps` or an
     * image-like object (HTMLImageElement, canvas, ImageBitmap) to draw
     * directly. `width`/`height` default to the image's natural size.
     */
    constructor(source, opts) {
      super();
      opts = opts || {};
      if (typeof source === 'string') { this.asset = source; this.image = null; }
      else { this.asset = null; this.image = source || null; }
      this.width = opts.width != null ? opts.width : 0;
      this.height = opts.height != null ? opts.height : 0;
      // Nearest-neighbour is what you want for pixel art, and for anything
      // you are about to trace; smoothing is the sane default otherwise.
      this.smoothing = opts.smoothing !== false;
      /* Erased areas, as a flat path command stream (0 moveTo x y · 1 lineTo
         x y · 2 quadTo cx cy x y · 3 closePath) in a box of maskWidth x
         maskHeight, scaled to fit this Bitmap's own box when drawn.
         Read under the NONZERO rule, with each loop wound backwards against
         the box so it subtracts. The loops are expected not to overlap each
         other — the editor unions them as they are made — because an area
         covered by two reversed loops would total -1, which is nonzero, and
         would come back into view. */
      this.mask = opts.mask || null;
      this.maskWidth = opts.maskWidth || 0;
      this.maskHeight = opts.maskHeight || 0;
    }

    /** The clip to draw through: this bitmap's box, minus the erased loops. */
    _maskPath(w, h) {
      const p = new Path2D();
      p.rect(0, 0, w, h);
      const sx = this.maskWidth ? w / this.maskWidth : 1;
      const sy = this.maskHeight ? h / this.maskHeight : 1;
      // Each loop is replayed BACKWARDS so it winds against the rect: under
      // nonzero that subtracts it. Reversing is also why the mask may be
      // stored in its natural orientation and still read as holes here.
      const m = this.mask;
      let i = 0;
      const loops = [];
      let cur = null;
      while (i < m.length) {
        const op = m[i];
        if (op === 0) { if (cur && cur.length >= 6) loops.push(cur); cur = [m[i + 1] * sx, m[i + 2] * sy]; i += 3; }
        else if (op === 1) { if (cur) cur.push(m[i + 1] * sx, m[i + 2] * sy); i += 3; }
        else if (op === 2) { if (cur) cur.push(m[i + 3] * sx, m[i + 4] * sy); i += 5; }
        else if (op === 3) { if (cur && cur.length >= 6) loops.push(cur); cur = null; i += 1; }
        else break;
      }
      if (cur && cur.length >= 6) loops.push(cur);
      for (let l = 0; l < loops.length; l++) {
        const pts = loops[l];
        p.moveTo(pts[pts.length - 2], pts[pts.length - 1]);
        for (let k = pts.length - 4; k >= 0; k -= 2) p.lineTo(pts[k], pts[k + 1]);
        p.closePath();
      }
      return p;
    }

    /** The image to draw, resolving an asset name through the cache. */
    source() { return this.image || (this.asset ? Bitmaps.get(this.asset) : null); }

    getBounds() {
      const img = this.source();
      const nw = img ? (img.naturalWidth || img.width) : 0;
      const nh = img ? (img.naturalHeight || img.height) : 0;
      return { x: 0, y: 0, width: this.width || nw, height: this.height || nh };
    }

    render(ctx) {
      const img = this.source();
      if (!img) return;
      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      if (!nw || !nh) return;
      const w = this.width || nw, h = this.height || nh;
      const prev = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = !!this.smoothing;
      const masked = this.mask && this.mask.length;
      if (masked) { ctx.save(); ctx.clip(this._maskPath(w, h), 'nonzero'); }
      ctx.drawImage(img, 0, 0, nw, nh, 0, 0, w, h);
      if (masked) ctx.restore();
      ctx.imageSmoothingEnabled = prev;
    }
  }

  // -------------------- DisplayObjectContainer --------------------
  class DisplayObjectContainer extends DisplayObject {
    constructor() {
      super();
      this.children = [];
    }
    addChild(c)          { if (c.parent) c.parent.removeChild(c); c.parent = this; this.children.push(c); return c; }
    addChildAt(c, i)     { if (c.parent) c.parent.removeChild(c); c.parent = this; this.children.splice(i, 0, c); return c; }
    removeChild(c)       { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parent = null; } return c; }
    removeChildAt(i)     { const c = this.children[i]; if (c) { this.children.splice(i, 1); c.parent = null; } return c; }
    removeAllChildren()  { for (let i = 0; i < this.children.length; i++) this.children[i].parent = null; this.children.length = 0; }
    getChildByName(name) { for (let i = 0; i < this.children.length; i++) if (this.children[i].name === name) return this.children[i]; return null; }
    getChildAt(i)        { return this.children[i]; }
    contains(c)          { return this.children.indexOf(c) >= 0; }
    get numChildren()    { return this.children.length; }

    _tick(dt) {
      const copy = this.children.slice();
      for (let i = 0; i < copy.length; i++) copy[i]._tick(dt);
    }

    render(ctx) {
      const kids = this.children;
      for (let i = 0; i < kids.length; i++) {
        const c = kids[i];
        if (!c.visible || c.alpha === 0) continue;
        ctx.save();
        c._applyTransform(ctx);
        c._renderFiltered(ctx);
        ctx.restore();
      }
    }
  }

  /**
   * A container that 9-slices its contents.
   *
   * It keeps scaleX/scaleY at 1 and stretches by `targetWidth`/`targetHeight`
   * instead. That is the whole trick: the scale has to be applied INSIDE the
   * node, cell by cell, because a parent's scale is already baked into the
   * context by the time render() runs and would stretch every cell alike.
   */
  class NineSlice extends DisplayObjectContainer {
    constructor(grid, naturalWidth, naturalHeight) {
      super();
      this.grid = grid || null;
      this.naturalWidth = naturalWidth || 1;
      this.naturalHeight = naturalHeight || 1;
      this.targetWidth = this.naturalWidth;
      this.targetHeight = this.naturalHeight;
    }
    render(ctx) {
      if (!Slice9.active(this.grid)) {
        // No guides: a plain stretch, so the node still honours its target.
        ctx.save();
        ctx.scale(this.targetWidth / this.naturalWidth,
                  this.targetHeight / this.naturalHeight);
        super.render(ctx);
        ctx.restore();
        return;
      }
      Slice9.render(ctx, this.grid, this.naturalWidth, this.naturalHeight,
                    this.targetWidth, this.targetHeight,
                    c => super.render(c));
    }
  }

  // -------------------- Tween / Timeline --------------------
  class Tween {
    constructor(target, prop, from, to, startFrame, endFrame, ease) {
      this.target     = target;
      this.prop       = prop;
      this.from       = from;
      this.to         = to;
      this.startFrame = startFrame;
      this.endFrame   = endFrame;
      this.ease       = ease || 'linear';
    }
    apply(frame) {
      if (frame < this.startFrame || frame > this.endFrame) return;
      if (this.endFrame === this.startFrame) { this.target[this.prop] = this.to; return; }
      const p = (frame - this.startFrame) / (this.endFrame - this.startFrame);
      const fn = Easing[this.ease] || Easing.linear;
      this.target[this.prop] = this.from + (this.to - this.from) * fn(p);
    }
  }

  class Timeline {
    constructor(owner) {
      this.owner        = owner;
      this.totalFrames  = 1;
      this.tweens       = [];
      this.frameScripts = {};
      this.labels       = {};
    }
    setTotalFrames(n) { this.totalFrames = Math.max(1, n | 0); return this; }
    addTween(target, prop, from, to, startFrame, endFrame, ease) {
      const t = new Tween(target, prop, from, to, startFrame, endFrame, ease);
      this.tweens.push(t);
      if (endFrame > this.totalFrames) this.totalFrames = endFrame;
      return t;
    }
    tweenProps(target, props, startFrame, endFrame, ease) {
      const out = [];
      for (const k in props) if (Object.prototype.hasOwnProperty.call(props, k)) {
        const pair = props[k];
        out.push(this.addTween(target, k, pair[0], pair[1], startFrame, endFrame, ease));
      }
      return out;
    }
    addFrameScript(frame, fn) { this.frameScripts[frame] = fn; return this; }
    addLabel(name, frame) {
      this.labels[name] = frame;
      if (frame > this.totalFrames) this.totalFrames = frame;
      return this;
    }
    resolveFrame(x) {
      if (typeof x === 'string') return this.labels[x] != null ? this.labels[x] : 1;
      return x | 0;
    }
    update(frame) {
      for (let i = 0; i < this.tweens.length; i++) this.tweens[i].apply(frame);
    }
  }

  // -------------------- MovieClip --------------------
  class MovieClip extends DisplayObjectContainer {
    constructor() {
      super();
      this.graphics     = new Graphics();
      this.timeline     = new Timeline(this);
      this.currentFrame = 1;
      this.playing      = true;
      this.loop         = true;
      this._primed      = false;
    }
    get totalFrames() { return this.timeline.totalFrames; }

    play() { this.playing = true;  return this; }
    stop() { this.playing = false; return this; }
    gotoAndPlay(f) { this._goto(this.timeline.resolveFrame(f)); this.playing = true;  return this; }
    gotoAndStop(f) { this._goto(this.timeline.resolveFrame(f)); this.playing = false; return this; }
    nextFrame() { this._goto(this.currentFrame + 1); this.playing = false; }
    prevFrame() { this._goto(this.currentFrame - 1); this.playing = false; }

    _goto(f) {
      const total = Math.max(1, this.totalFrames);
      if (this.loop) f = ((f - 1) % total + total) % total + 1;
      else f = Math.max(1, Math.min(total, f));
      this.currentFrame = f;
      this.timeline.update(f);
      this._primed = true;
      const script = this.timeline.frameScripts[f];
      if (script) script.call(this);
    }

    _tick(dt) {
      if (!this._primed) {
        this._primed = true;
        this.timeline.update(this.currentFrame);
      } else if (this.playing) {
        let next = this.currentFrame + 1;
        if (next > this.totalFrames) {
          if (this.loop) next = 1;
          else { next = this.totalFrames; this.playing = false; }
        }
        this.currentFrame = next;
        this.timeline.update(next);
      }
      this.dispatchEvent('enterFrame');
      const script = this.timeline.frameScripts[this.currentFrame];
      if (script) script.call(this);
      super._tick(dt);
    }

    render(ctx) {
      this.graphics.render(ctx);
      super.render(ctx);
    }
  }

  // -------------------- Stage --------------------
  class Stage {
    constructor(canvas, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.ctx    = canvas.getContext('2d');
      this.width  = opts.width  || canvas.width  || 800;
      this.height = opts.height || canvas.height || 600;
      this.fps    = opts.fps || 30;
      this.backgroundColor = opts.backgroundColor != null ? opts.backgroundColor : 0xffffff;

      const pr = opts.pixelRatio || (typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1);
      this.pixelRatio = pr;
      canvas.width  = Math.round(this.width  * pr);
      canvas.height = Math.round(this.height * pr);
      canvas.style.width  = this.width  + 'px';
      canvas.style.height = this.height + 'px';
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';

      this.root = new MovieClip();
      this.root.name = 'root';
      this.mouseX = 0; this.mouseY = 0;

      this._listeners = {};
      this._last = 0;
      this._acc  = 0;
      this._running = false;
      this._raf = null;
      this._bindInput();
      /** The text field taking keystrokes, or null. */
      this.focusedText = null;
      this._bindKeys();
    }

    addEventListener(type, fn) {
      (this._listeners[type] || (this._listeners[type] = [])).push(fn);
    }
    removeEventListener(type, fn) {
      const arr = this._listeners[type]; if (!arr) return;
      const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1);
    }
    dispatchEvent(type, e) {
      const arr = this._listeners[type]; if (!arr || !arr.length) return;
      e = e || { type };
      e.type = type; e.target = this; e.currentTarget = this;
      const copy = arr.slice();
      for (let i = 0; i < copy.length; i++) copy[i].call(this, e);
    }

    start() {
      if (this._running) return;
      this._running = true;
      this._last = performance.now();
      this._acc  = 0;
      const loop = (t) => {
        if (!this._running) return;
        const frameMs = 1000 / this.fps;
        let dt = t - this._last;
        this._last = t;
        // Clamp dt so a tab switch / throttle / GC pause doesn't produce a
        // backlog that replays as a visible speed-up. Anything longer than
        // ~2 frames is treated as a discontinuity and we resume fresh.
        if (dt > frameMs * 2) dt = frameMs;
        this._acc += dt;
        let ticks = 0;
        while (this._acc >= frameMs && ticks < 2) {
          this.root._tick(frameMs);
          this.dispatchEvent('enterFrame');
          this._acc -= frameMs;
          ticks++;
        }
        if (this._acc > frameMs) this._acc = frameMs;
        /* If no tick yet (just started), prime the root so frame 1 state
           renders — INCLUDING its frame script. Priming without it marks
           the root as primed, so the first real tick takes the "advance"
           branch and frame 1's script is never run at all: a `stop()` on
           frame 1 does nothing, and an imported movie loses the frame where
           it sets everything up. */
        if (!this.root._primed) {
          this.root._primed = true;
          this.root.timeline.update(this.root.currentFrame);
          const first = this.root.timeline.frameScripts[this.root.currentFrame];
          if (first) first.call(this.root);
        }
        this._render();
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }
    stop() {
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    }

    _render() {
      const ctx = this.ctx;
      ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      if (this.backgroundColor == null) {
        ctx.clearRect(0, 0, this.width, this.height);
      } else {
        ctx.fillStyle = toRGBA(this.backgroundColor, 1);
        ctx.fillRect(0, 0, this.width, this.height);
      }
      ctx.save();
      this.root._applyTransform(ctx);
      this.root._renderFiltered(ctx);
      ctx.restore();
    }

    _bindInput() {
      // Pointer Events cover mouse, pen and touch in one path. This used to
      // bind mouse events only — the touch branch in convert() below was
      // unreachable — so an exported game or animation was completely
      // unresponsive on phones and tablets.
      //
      // The canvas is also opted out of browser touch gestures, or the first
      // drag inside an interactive movie scrolls the page instead.
      const style = this.canvas.style;
      if (!style.touchAction) style.touchAction = 'none';

      const convert = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const src = (e.touches && e.touches[0]) || e;
        // The canvas may be displayed at a different size than its coordinate
        // space (CSS sizing, fullscreen), so scale into stage coordinates.
        const sx = rect.width  ? this.width  / rect.width  : 1;
        const sy = rect.height ? this.height / rect.height : 1;
        return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
      };
      const handle = (type) => (e) => {
        const p = convert(e);
        this.mouseX = p.x; this.mouseY = p.y;
        const evt = { type, stageX: p.x, stageY: p.y, nativeEvent: e };
        this.dispatchEvent(type, evt);
        const hit = this._hitTest(this.root, p.x, p.y);
        /* A press moves text focus: into an input field, or out of the one
           that had it. Flash behaved the same way, and without it a field
           keeps the keyboard forever once clicked. */
        if (type === "mouseDown") {
          this.focusText(hit && hit.type === "input" ? hit : null);
        }
        if (hit) {
          let node = hit;
          while (node) {
            evt.target = hit; evt.currentTarget = node;
            const listeners = node._listeners && node._listeners[type];
            if (listeners && listeners.length) {
              const copy = listeners.slice();
              for (let i = 0; i < copy.length; i++) copy[i].call(node, evt);
            }
            node = node.parent;
          }
        }
      };
      if (typeof window !== 'undefined' && window.PointerEvent) {
        this.canvas.addEventListener('pointerdown',   handle('mouseDown'));
        this.canvas.addEventListener('pointerup',     handle('mouseUp'));
        this.canvas.addEventListener('pointermove',   handle('mouseMove'));
        // A pointer lifted outside the canvas never produces a 'click', so on
        // touch the up event has to stand in for it.
        this.canvas.addEventListener('pointercancel', handle('mouseUp'));
        this.canvas.addEventListener('click',         handle('click'));
      } else {
        this.canvas.addEventListener('mousedown', handle('mouseDown'));
        this.canvas.addEventListener('mouseup',   handle('mouseUp'));
        this.canvas.addEventListener('mousemove', handle('mouseMove'));
        this.canvas.addEventListener('click',     handle('click'));
      }
    }

    _hitTest(node, x, y) {
      if (!node.visible) return null;
      if (node.children && node.children.length) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          const child = node.children[i];
          if (!child.visible || !child.mouseEnabled) continue;
          let px = x - child.x, py = y - child.y;
          if (child.rotation) {
            const cos = Math.cos(-child.rotation);
            const sin = Math.sin(-child.rotation);
            const nx = px * cos - py * sin;
            const ny = px * sin + py * cos;
            px = nx; py = ny;
          }
          if (child.scaleX && child.scaleX !== 1) px /= child.scaleX;
          if (child.scaleY && child.scaleY !== 1) py /= child.scaleY;
          const found = this._hitTest(child, px, py);
          if (found) return found;
        }
      }
      const g = node.graphics;
      if (g && g._bounds) {
        const b = g._bounds;
        if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY) return node;
      }
      /* A TextField has no `graphics`, so the hit test used to walk straight
         past it — which meant an input field could never be clicked into and a
         selectable one could never be reached. */
      if (typeof node.hitBox === "function") {
        const tb = node.hitBox();
        if (x >= tb.minX && x <= tb.maxX && y >= tb.minY && y <= tb.maxY) return node;
      }
      return null;
    }

    /* ---- text input -------------------------------------------------- *
     * One focused field at a time, as in a browser form. The keyboard is
     * bound to the window rather than the canvas because a canvas is not
     * focusable without a tabindex, and demanding one of every host page
     * would make input text work only in our own exports.
     * ------------------------------------------------------------------ */

    /** Focus a text field, blurring whatever had focus. */
    focusText(field) {
      if (this.focusedText === field) return field;
      if (this.focusedText) this.focusedText.focused = false;
      this.focusedText = (field && field.type === "input") ? field : null;
      if (this.focusedText) {
        this.focusedText.focused = true;
        this.focusedText.caret = String(this.focusedText.text || "").length;
      }
      return this.focusedText;
    }

    blurText() { return this.focusText(null); }

    _bindKeys() {
      if (typeof window === "undefined" || this._keysBound) return;
      this._keysBound = true;
      this._onKeyDown = (e) => {
        const f = this.focusedText;
        if (!f) return;
        /* Swallow the keys the field consumes, or typing in a form also
           scrolls the page and Backspace navigates back. Modifier
           combinations are left alone so Ctrl+R still reloads. */
        if (!e.ctrlKey && !e.metaKey &&
            (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete" ||
             e.key === "Enter" || e.key.indexOf("Arrow") === 0)) {
          e.preventDefault();
        }
        f.keyInput(e.key, e.ctrlKey || e.metaKey);
        if (f.variable && this.root) this.root[f.variable] = f.text;
        this.dispatchEvent("textInput", { type: "textInput", field: f, key: e.key });
      };
      window.addEventListener("keydown", this._onKeyDown);
    }
  }

  // -------------------- Sound --------------------
  //
  // Audio assets and playback, on WebAudio. Two things make this more than a
  // thin wrapper around <audio>:
  //
  //   * Playback position is readable against the audio clock, which is what
  //     lets the animation follow the sound (Flash's "Stream" sync) instead of
  //     the other way round. A timer-driven playhead drifts against audio
  //     within seconds; an audio-driven playhead cannot.
  //   * Decoded buffers are cached per asset, so scrubbing — which starts and
  //     stops a short slice many times a second — costs nothing after the
  //     first decode.
  //
  // Browsers refuse to start audio before a user gesture. `unlock()` is wired
  // to the first pointer/key event and resumes the context; until then,
  // `play()` is a no-op that reports it did nothing rather than throwing.
  const Sound = {
    _ctx: null,
    _master: null,
    _buffers: Object.create(null),
    _loading: Object.create(null),
    _peaks: Object.create(null),
    _muted: false,

    /** The shared AudioContext, created on first use (never before). */
    context() {
      if (this._ctx) return this._ctx;
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      this._ctx = new AC();
      this._master = this._ctx.createGain();
      this._master.gain.value = this._muted ? 0 : 1;
      this._master.connect(this._ctx.destination);
      return this._ctx;
    },

    /** Resume after the autoplay policy suspended us. Safe to call often. */
    unlock() {
      const ctx = this.context();
      if (ctx && ctx.state === 'suspended') return ctx.resume();
      return Promise.resolve();
    },

    /** True once audio can actually be heard. */
    ready() {
      const ctx = this._ctx;
      return !!ctx && ctx.state === 'running';
    },

    /**
     * Decode an asset and cache it. `src` is a data: URL or any fetchable URL.
     * Repeated calls for the same name share one in-flight decode.
     */
    load(name, src) {
      if (this._buffers[name]) return Promise.resolve(this._buffers[name]);
      if (this._loading[name]) return this._loading[name];
      const ctx = this.context();
      if (!ctx) return Promise.reject(new Error('WebAudio unavailable'));

      const p = fetch(src)
        .then((r) => r.arrayBuffer())
        .then((buf) => ctx.decodeAudioData(buf))
        .then((audio) => {
          this._buffers[name] = audio;
          delete this._loading[name];
          return audio;
        })
        .catch((err) => {
          delete this._loading[name];
          throw err;
        });
      this._loading[name] = p;
      return p;
    },

    buffer(name) { return this._buffers[name] || null; },
    duration(name) {
      const b = this._buffers[name];
      return b ? b.duration : 0;
    },
    has(name) { return !!this._buffers[name]; },

    /**
     * Amplitude envelope for drawing a waveform: `buckets` values in 0..1.
     * Cached per (name, buckets) because the timeline redraws constantly.
     */
    peaks(name, buckets) {
      const b = this._buffers[name];
      if (!b) return null;
      buckets = Math.max(1, buckets | 0);
      const key = name + '@' + buckets;
      if (this._peaks[key]) return this._peaks[key];

      const chan = b.getChannelData(0);
      const per = chan.length / buckets;
      const out = new Float32Array(buckets);
      for (let i = 0; i < buckets; i++) {
        const from = Math.floor(i * per);
        const to = Math.min(chan.length, Math.floor((i + 1) * per));
        let peak = 0;
        // Stride large windows: a 3-minute track at 48kHz is 8.6M samples and
        // the drawn result is identical.
        const step = Math.max(1, Math.floor((to - from) / 400));
        for (let j = from; j < to; j += step) {
          const v = chan[j] < 0 ? -chan[j] : chan[j];
          if (v > peak) peak = v;
        }
        out[i] = peak;
      }
      this._peaks[key] = out;
      return out;
    },

    /**
     * Start a sound. Returns a handle, or null if audio is not running yet.
     * `offset` seconds into the asset; `volume` 0..1; `loop` repeats.
     */
    play(name, opts) {
      opts = opts || {};
      const ctx = this.context();
      const buf = this._buffers[name];
      if (!ctx || !buf || ctx.state !== 'running') return null;

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = !!opts.loop;
      const gain = ctx.createGain();
      const base = opts.volume != null ? opts.volume : 1;
      gain.gain.value = base;
      src.connect(gain);

      /* Panning. A StereoPannerNode is how "fade left to right" and a
         one-sided sound are actually done; without one, Flash's pan effects
         could only ever be faked by changing the volume of both channels at
         once, which is not the same sound. Browsers without the node fall
         back to no panning rather than to no audio. */
      let panNode = null;
      if ((opts.pan || opts.envelope) && typeof ctx.createStereoPanner === 'function') {
        panNode = ctx.createStereoPanner();
        panNode.pan.value = Math.max(-1, Math.min(1, opts.pan || 0));
        gain.connect(panNode);
        panNode.connect(this._master);
      } else {
        gain.connect(this._master);
      }

      const offset = Math.max(0, Math.min(opts.offset || 0, buf.duration));
      const when = ctx.currentTime;

      /* A volume envelope, scheduled on the gain node.
       *
       * Points are [timeInAsset, left, right]. The two channels collapse to
       * one gain plus one pan value — a true per-channel envelope needs a
       * channel splitter, and the difference is inaudible against the thing
       * this is for, which is fades and sweeps. Scheduled rather than polled
       * so it stays sample-accurate while the main thread is busy drawing.
       */
      if (opts.envelope && opts.envelope.length) {
        const env = opts.envelope;
        gain.gain.cancelScheduledValues(when);
        let started = false;
        for (let i = 0; i < env.length; i++) {
          const t = env[i][0], l = env[i][1], r = env[i][2] == null ? env[i][1] : env[i][2];
          const level = base * Math.max(0, (l + r) / 2);
          // Everything before the start offset has already happened.
          if (t < offset) continue;
          const at = when + (t - offset);
          if (!started) {
            // Start from the first point's value rather than ramping up to it
            // from the base volume, which would add a fade nobody asked for.
            gain.gain.setValueAtTime(level, at);
            started = true;
          } else {
            gain.gain.linearRampToValueAtTime(level, at);
          }
          if (panNode) {
            const bal = (l + r) > 0 ? (r - l) / (l + r) : 0;
            if (i === 0) panNode.pan.setValueAtTime(bal, at);
            else panNode.pan.linearRampToValueAtTime(bal, at);
          }
        }
      }

      /* A repeat count, as distinct from looping forever. `src.loop` with a
         scheduled stop is the only way to get "play it three times": there is
         no loopCount on a BufferSource. */
      const repeat = opts.repeat != null ? (opts.repeat | 0) : 0;
      if (repeat > 1 && buf.duration > 0) {
        src.loop = true;
        src.start(when, offset);
        try { src.stop(when + (buf.duration - offset) + buf.duration * (repeat - 1)); }
        catch (e) { /* a browser that refuses a future stop just loops on */ }
      } else if (opts.duration != null) {
        src.start(when, offset, Math.max(0, opts.duration));
      } else {
        src.start(when, offset);
      }

      return { name: name, src: src, gain: gain, pan: panNode,
               startedAt: when, offset: offset, loop: !!src.loop };
    },

    /** Where a handle is in its asset, in seconds. */
    positionOf(handle) {
      const ctx = this._ctx;
      if (!ctx || !handle) return 0;
      const elapsed = ctx.currentTime - handle.startedAt + handle.offset;
      const dur = this.duration(handle.name);
      if (handle.loop && dur > 0) return elapsed % dur;
      return elapsed;
    },

    stop(handle) {
      if (!handle || !handle.src) return;
      try { handle.src.stop(); } catch (e) { /* already ended */ }
      try {
        handle.src.disconnect();
        handle.gain.disconnect();
        if (handle.pan) handle.pan.disconnect();
      } catch (e) { /* ditto */ }
    },


    setVolume(handle, v) {
      if (handle && handle.gain) handle.gain.gain.value = v;
    },

    setMuted(m) {
      this._muted = !!m;
      if (this._master) this._master.gain.value = this._muted ? 0 : 1;
    },
    muted() { return this._muted; }
  };

  // -------------------- Speech analysis --------------------
  //
  // Per-frame features used for lip sync. This runs entirely locally on the
  // decoded buffer — no API key, no upload, works offline. That matters: lip
  // sync is the single most tedious job in 2D animation, and gating it behind
  // a paid key would put it out of reach of exactly the people this tool is
  // for.
  //
  // What comes out is deliberately low-level (energy, zero crossings, three
  // formant-ish bands). Turning that into mouth shapes is the editor's job,
  // because which shapes exist depends on the artist's mouth sheet.

  /** In-place iterative radix-2 FFT. `re`/`im` are Float32Array of length n. */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ar = re[i + k], ai = im[i + k];
          const br = re[i + k + len / 2], bi = im[i + k + len / 2];
          const tr = br * cr - bi * ci, ti = br * ci + bi * cr;
          re[i + k] = ar + tr; im[i + k] = ai + ti;
          re[i + k + len / 2] = ar - tr; im[i + k + len / 2] = ai - ti;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }

  /**
   * Analyse a decoded sound frame by frame.
   *
   * Returns `{fps, frames, rms[], peak, zcr[], low[], mid[], high[], centroid[]}`
   * where each array has one entry per animation frame. Bands are chosen for
   * speech rather than music: `low` covers the first formant region for close
   * vowels, `mid` the first formant of open vowels, `high` the second formant
   * that separates "ee" from "oo".
   */
  Sound.analyze = function (name, opts) {
    opts = opts || {};
    const buf = this._buffers[name];
    if (!buf) return null;
    const fps = opts.fps || 24;
    const offset = Math.max(0, opts.offset || 0);
    const rate = buf.sampleRate;
    const data = buf.getChannelData(0);
    const hop = Math.max(1, Math.round(rate / fps));
    const start = Math.round(offset * rate);
    const total = Math.max(0, Math.floor((data.length - start) / hop));
    const frames = opts.frames ? Math.min(opts.frames, total) : total;

    // Window at least 1024 samples so the spectrum has usable resolution even
    // at high frame rates, rounded up to a power of two for the FFT.
    let win = 1024;
    while (win < hop) win <<= 1;
    const half = win / 2;
    const hann = new Float32Array(win);
    for (let i = 0; i < win; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (win - 1));

    const out = {
      fps: fps, frames: frames, peak: 0,
      rms: new Float32Array(frames), zcr: new Float32Array(frames),
      low: new Float32Array(frames), mid: new Float32Array(frames),
      high: new Float32Array(frames), centroid: new Float32Array(frames)
    };

    const re = new Float32Array(win), im = new Float32Array(win);
    const binHz = rate / win;
    const bin = (hz) => Math.min(half - 1, Math.max(1, Math.round(hz / binHz)));
    const L0 = bin(150), L1 = bin(550);     // close-vowel F1 ("oo", "ee")
    const M0 = bin(550), M1 = bin(1300);    // open-vowel F1 ("ah")
    const H0 = bin(1800), H1 = bin(3400);   // F2 — separates "ee" from "oo"

    for (let f = 0; f < frames; f++) {
      const s = start + f * hop;
      let sum = 0, crossings = 0, prev = 0;
      for (let i = 0; i < win; i++) {
        const v = (s + i < data.length) ? data[s + i] : 0;
        sum += v * v;
        if (i > 0 && ((v >= 0) !== (prev >= 0))) crossings++;
        prev = v;
        re[i] = v * hann[i];
        im[i] = 0;
      }
      const rms = Math.sqrt(sum / win);
      out.rms[f] = rms;
      if (rms > out.peak) out.peak = rms;
      out.zcr[f] = crossings / win;

      fft(re, im);
      let lo = 0, md = 0, hi = 0, wsum = 0, msum = 0;
      for (let k = 1; k < half; k++) {
        const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
        if (k >= L0 && k < L1) lo += mag;
        if (k >= M0 && k < M1) md += mag;
        if (k >= H0 && k < H1) hi += mag;
        wsum += mag * k * binHz;
        msum += mag;
      }
      out.low[f] = lo; out.mid[f] = md; out.high[f] = hi;
      out.centroid[f] = msum > 0 ? wsum / msum : 0;
    }
    return out;
  };

  // -------------------- SoundTrack --------------------
  //
  // Keeps a set of timeline sounds in agreement with a frame number.
  //
  // `stream` items behave like Flash's Stream sync: one continuous playback
  // whose position is derived from the frame, re-seeked whenever the playhead
  // jumps or drifts past tolerance. `event` items fire once on entering their
  // start frame and run to their own end, unaffected by the playhead.
  class SoundTrack {
    constructor(opts) {
      opts = opts || {};
      this.fps = opts.fps || 24;
      this.items = [];
      this._active = Object.create(null); // item id -> handle
      this._lastFrame = -1;
      // How far playback may drift from the frame before being re-seeked.
      // Tight enough that lip sync stays believable, loose enough that we are
      // not restarting the source every frame.
      this.tolerance = opts.tolerance != null ? opts.tolerance : 0.12;
    }

    /**
     * Flash's sound effect presets, as an envelope.
     *
     * An envelope point is [timeInAsset, leftGain, rightGain]. Generating the
     * presets from one place means the editor's dialog, the authoring preview
     * and the exported player cannot disagree about what "Fade In" is — and
     * "custom" is simply an envelope somebody edited, so a preset and a hand
     * drawn curve are the same kind of thing.
     */
    static envelopeFor(effect, duration) {
      const d = duration > 0 ? duration : 1;
      switch (effect) {
        case 'fadeIn':   return [[0, 0, 0], [Math.min(1, d * 0.25), 1, 1]];
        case 'fadeOut':  return [[Math.max(0, d - Math.min(1, d * 0.25)), 1, 1], [d, 0, 0]];
        case 'fadeLR':   return [[0, 1, 0], [d, 0, 1]];
        case 'fadeRL':   return [[0, 0, 1], [d, 1, 0]];
        case 'left':     return [[0, 1, 0], [d, 1, 0]];
        case 'right':    return [[0, 0, 1], [d, 0, 1]];
        default:         return null;    // "none", and "custom" brings its own
      }
    }

    /** items: [{id, asset, startFrame, endFrame, sync, volume, loop, offset,
                 envelope, repeat}] */
    setItems(items) {
      this.stopAll();
      this.items = (items || []).slice();
      return this;
    }

    stopAll() {
      for (const id in this._active) Sound.stop(this._active[id]);
      this._active = Object.create(null);
      this._lastFrame = -1;
    }

    /** Where in its asset should `item` be at `frame`? */
    _positionFor(item, frame) {
      return (frame - item.startFrame) / this.fps + (item.offset || 0);
    }

    _covers(item, frame) {
      /* A sync-"stop" marker is an instant, not a span: it has no sound of its
         own to bound. Treating it like one meant it only acted while the
         playhead sat inside a span it did not really have. */
      if (item.sync === 'stop') return frame >= item.startFrame;
      return frame >= item.startFrame && frame <= item.endFrame;
    }

    /**
     * Reconcile playback with `frame`.
     *
     * `seeked` tells us the playhead jumped rather than advanced, so stream
     * sounds re-seek immediately instead of waiting for drift to accumulate.
     */
    update(frame, seeked) {
      if (!Sound.ready()) return;
      const jumped = seeked || this._lastFrame < 0 || Math.abs(frame - this._lastFrame) > 1;

      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        const id = item.id != null ? item.id : i;
        const handle = this._active[id];
        const inside = this._covers(item, frame);

        if (!inside) {
          // Stream sounds are bounded by their span; event sounds are not —
          // once fired they play out on their own.
          if (handle && item.sync !== 'event') { Sound.stop(handle); delete this._active[id]; }
          else if (handle && item.sync === 'event' && frame < item.startFrame) {
            // Scrubbed back before it started: cancel it.
            Sound.stop(handle); delete this._active[id];
          }
          continue;
        }

        /* Sync STOP: a keyframe whose job is to silence an asset. It was
           stored on the keyframe, written to the file, and honoured by
           nothing — so "stop the music here" did nothing at all. It stops
           every handle playing that asset, including an event sound fired
           long ago, which is the only reading that makes it useful. */
        if (item.sync === 'stop') {
          if (jumped ? frame >= item.startFrame : this._lastFrame < item.startFrame) {
            for (const other in this._active) {
              const oi = this.items.filter(x => String(x.id) === String(other))[0];
              if (!oi || oi.asset !== item.asset) continue;
              Sound.stop(this._active[other]);
              delete this._active[other];
            }
          }
          continue;
        }

        if (item.sync === 'event') {
          // Fire once, on entry.
          if (!handle && (jumped ? frame === item.startFrame : this._lastFrame < item.startFrame)) {
            const h = Sound.play(item.asset, {
              volume: item.volume, loop: item.loop, offset: item.offset || 0,
              envelope: item.envelope, repeat: item.repeat
            });
            if (h) this._active[id] = h;
          }
          continue;
        }

        // Stream.
        const want = this._positionFor(item, frame);
        const playOpts = {
          offset: want, volume: item.volume, loop: item.loop,
          envelope: item.envelope, repeat: item.repeat
        };
        if (!handle) {
          const h = Sound.play(item.asset, playOpts);
          if (h) this._active[id] = h;
        } else if (jumped || Math.abs(Sound.positionOf(handle) - want) > this.tolerance) {
          Sound.stop(handle);
          const h = Sound.play(item.asset, playOpts);
          if (h) this._active[id] = h; else delete this._active[id];
        }
      }
      this._lastFrame = frame;
    }

    /**
     * The audio clock for the stream sound covering `frame`, as a frame
     * number — what the playhead should follow so the animation tracks the
     * sound rather than a timer. Returns null when nothing is streaming.
     */
    frameFromAudio(frame) {
      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        if (item.sync === 'event' || !this._covers(item, frame)) continue;
        const handle = this._active[item.id != null ? item.id : i];
        if (!handle) continue;
        const pos = Sound.positionOf(handle) - (item.offset || 0);
        return item.startFrame + pos * this.fps;
      }
      return null;
    }
  }

  // -------------------- export --------------------
  const Flashy = {
    // Keep in step with package.json's "version" and the splash card in
    // editor.html; they had drifted to three different numbers.
    version: '0.7.6',
    Easing, Graphics,
    DisplayObject, DisplayObjectContainer,
    Shape, TextField, RichText, Fonts, Bitmap, MovieClip, Timeline, Tween, Stage,
    /* 9-slice: the cell maths plus the container that uses it, shared with the
       authoring stage and the SVG export so all three agree to the pixel. */
    Slice9, NineSlice,
    /* Motion guides: the polyline sampler, shared with the editor and with the
       exported player's own interpolator. */
    MotionGuide,
    /* Shape tweening: a real outline morph, shared with the editor and the
       exported player. */
    Morph,
    /* Rounded rectangles and oval arcs/pies/donuts. One geometry, shared by
       the painter, the SVG export, the player, the morph and the eraser. */
    Primitives,
    Sound, SoundTrack, Bitmaps,
    /* Where trace() goes: the authoring Output panel, the exported player and
       an imported movie's ActionScript all write here. */
    Output,
    /* Shared with the editor's own stage painter and with the SVG exporter, so
       a glow on the authoring stage is the same glow in every export. */
    Filters,
    toRGBA
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Flashy;
  global.Flashy = Flashy;
})(typeof window !== 'undefined' ? window : this);
