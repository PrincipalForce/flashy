/* flashy.js — a Flash-inspired vector animation engine for HTML5 Canvas
 *
 * Provides:
 *   - Graphics        : AS3-style vector drawing (moveTo/lineTo/curveTo/beginFill/gradients/...)
 *   - DisplayObject   : transform, alpha, events
 *   - Shape           : a leaf with a Graphics
 *   - TextField       : simple text rendering
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

    beginFill(color, alpha) {
      this._cmds.push([11, color == null ? 0 : color, alpha == null ? 1 : alpha]);
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
      let stroke = null;
      let strokeWidth = 0;
      let caps = 'round', joins = 'round', miter = 3;
      let inPath = false;

      const ensurePath = () => { if (!inPath) { ctx.beginPath(); inPath = true; } };
      const commit = () => {
        if (!inPath) return;
        if (fill)   { ctx.fillStyle = fill;     ctx.fill(); }
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
          case 11: commit(); fill = toRGBA(c[1], c[2]); break;
          case 12: {
            commit();
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

    removeFromParent() { if (this.parent) this.parent.removeChild(this); return this; }
  }

  // -------------------- Shape --------------------
  class Shape extends DisplayObject {
    constructor() { super(); this.graphics = new Graphics(); }
    render(ctx) { this.graphics.render(ctx); }
  }

  // -------------------- TextField --------------------
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
    }
    render(ctx) {
      ctx.font = this.font;
      ctx.textAlign = this.align;
      ctx.textBaseline = this.baseline;
      const lines = String(this.text).split('\n');
      const lh = this.lineHeight || (parseInt(this.font, 10) || 24) * 1.2;
      for (let i = 0; i < lines.length; i++) {
        const y = i * lh;
        if (this.strokeWidth > 0 && this.stroke != null) {
          ctx.lineWidth = this.strokeWidth;
          ctx.strokeStyle = toRGBA(this.stroke, 1);
          ctx.strokeText(lines[i], 0, y);
        }
        ctx.fillStyle = toRGBA(this.color, 1);
        ctx.fillText(lines[i], 0, y);
      }
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
        c.render(ctx);
        ctx.restore();
      }
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
        // If no tick yet (just started), prime the root so frame 1 state renders.
        if (!this.root._primed) {
          this.root._primed = true;
          this.root.timeline.update(this.root.currentFrame);
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
      this.root.render(ctx);
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
      return null;
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
      gain.gain.value = opts.volume != null ? opts.volume : 1;
      src.connect(gain);
      gain.connect(this._master);

      const offset = Math.max(0, Math.min(opts.offset || 0, buf.duration));
      const when = ctx.currentTime;
      if (opts.duration != null) src.start(when, offset, Math.max(0, opts.duration));
      else src.start(when, offset);

      return { name: name, src: src, gain: gain, startedAt: when, offset: offset, loop: !!opts.loop };
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
      try { handle.src.disconnect(); handle.gain.disconnect(); } catch (e) { /* ditto */ }
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

    /** items: [{id, asset, startFrame, endFrame, sync, volume, loop, offset}] */
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

        if (item.sync === 'event') {
          // Fire once, on entry.
          if (!handle && (jumped ? frame === item.startFrame : this._lastFrame < item.startFrame)) {
            const h = Sound.play(item.asset, { volume: item.volume, loop: item.loop, offset: item.offset || 0 });
            if (h) this._active[id] = h;
          }
          continue;
        }

        // Stream.
        const want = this._positionFor(item, frame);
        if (!handle) {
          const h = Sound.play(item.asset, { offset: want, volume: item.volume, loop: item.loop });
          if (h) this._active[id] = h;
        } else if (jumped || Math.abs(Sound.positionOf(handle) - want) > this.tolerance) {
          Sound.stop(handle);
          const h = Sound.play(item.asset, { offset: want, volume: item.volume, loop: item.loop });
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
    version: '0.7.0',
    Easing, Graphics,
    DisplayObject, DisplayObjectContainer,
    Shape, TextField, MovieClip, Timeline, Tween, Stage,
    Sound, SoundTrack,
    toRGBA
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Flashy;
  global.Flashy = Flashy;
})(typeof window !== 'undefined' ? window : this);
