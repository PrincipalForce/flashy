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
    constructor(maxCommands) {
      this._cmds = [];
      this._bounds = null;
      this._maxCommands = maxCommands || null;
    }

    clear() { 
      this._cmds.length = 0; 
      this._bounds = null; 
      return this; 
    }

    _cleanup() {
      this.clear();
    }

    _enforceLimits() {
      if (this._maxCommands && this._cmds.length > this._maxCommands) {
        const excess = this._cmds.length - this._maxCommands;
        this._cmds.splice(0, excess);
        this._recalculateBounds();
      }
    }

    _recalculateBounds() {
      this._bounds = null;
      for (let i = 0; i < this._cmds.length; i++) {
        const c = this._cmds[i];
        switch (c[0]) {
          case 0: case 1: this._touch(c[1], c[2]); break;
          case 2: this._touch(c[1], c[2]); this._touch(c[3], c[4]); break;
          case 3: this._touch(c[5], c[6]); break;
          case 20: this._touch(c[1], c[2]); this._touch(c[1] + c[3], c[2] + c[4]); break;
          case 21: this._touch(c[1], c[2]); this._touch(c[1] + c[3], c[2] + c[4]); break;
          case 22: this._touch(c[1] - c[3], c[2] - c[3]); this._touch(c[1] + c[3], c[2] + c[3]); break;
          case 23: this._touch(c[1], c[2]); this._touch(c[1] + c[3], c[2] + c[4]); break;
          case 25: this._touch(c[1] - c[4], c[2] - c[4]); this._touch(c[1] + c[4], c[2] + c[4]); break;
        }
      }
    }

    moveTo(x, y)              { this._cmds.push([0, x, y]);                this._touch(x, y); this._enforceLimits(); return this; }
    lineTo(x, y)              { this._cmds.push([1, x, y]);                this._touch(x, y); this._enforceLimits(); return this; }
    curveTo(cx, cy, x, y)     { this._cmds.push([2, cx, cy, x, y]);        this._touch(x, y); this._touch(cx, cy); this._enforceLimits(); return this; }
    cubicCurveTo(c1x, c1y, c2x, c2y, x, y) {
      this._cmds.push([3, c1x, c1y, c2x, c2y, x, y]);
      this._touch(x, y); this._enforceLimits(); return this;
    }
    closePath() { this._cmds.push([4]); this._enforceLimits(); return this; }

    lineStyle(thickness, color, alpha, caps, joints, miterLimit) {
      if (thickness == null || thickness === 0) {
        this._cmds.push([10, 0]);
      } else {
        this._cmds.push([10, thickness, color == null ? 0 : color, alpha == null ? 1 : alpha,
          caps || 'round', joints || 'round', miterLimit || 3]);
      }
      this._enforceLimits(); return this;
    }

    beginFill(color, alpha) {
      this._cmds.push([11, color == null ? 0 : color, alpha == null ? 1 : alpha]);
      this._enforceLimits(); return this;
    }
    beginGradientFill(type, colors, alphas, ratios, x0, y0, x1, y1) {
      this._cmds.push([12, type, colors, alphas, ratios, x0, y0, x1, y1]);
      this._enforceLimits(); return this;
    }
    endFill() { this._cmds.push([13]); this._enforceLimits(); return this; }

    drawRect(x, y, w, h)              { this._cmds.push([20, x, y, w, h]);    this._touch(x, y); this._touch(x + w, y + h); this._enforceLimits(); return this; }
    drawRoundRect(x, y, w, h, r)      { this._cmds.push([21, x, y, w, h, r]); this._touch(x, y); this._touch(x + w, y + h); this._enforceLimits(); return this; }
    drawCircle(x, y, r)               { this._cmds.push([22, x, y, r]);       this._touch(x - r, y - r); this._touch(x + r, y + r); this._enforceLimits(); return this; }
    drawEllipse(x, y, w, h)           { this._cmds.push([23, x, y, w, h]);    this._touch(x, y); this._touch(x + w, y + h); this._enforceLimits(); return this; }
    drawPolygon(points) {
      this._cmds.push([24, points]);
      for (let i = 0; i < points.length; i += 2) this._touch(points[i], points[i + 1]);
      this._enforceLimits(); return this;
    }
    drawStar(cx, cy, points, outerR, innerR, rotation) {
      this._cmds.push([25, cx, cy, points, outerR, innerR, rotation || 0]);
      this._touch(cx - outerR, cy - outerR); this._touch(cx + outerR, cy + outerR);
      this._enforceLimits(); return this;
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

    _cleanup() {
      if (this.graphics && this.graphics._cleanup) {
        this.graphics._cleanup();
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
    removeChild(c)       { 
      const i = this.children.indexOf(c); 
      if (i >= 0) { 
        this.children.splice(i, 1); 
        c.parent = null; 
        if (c._cleanup) c._cleanup();
      } 
      return c; 
    }
    removeChildAt(i)     { const c = this.children[i]; if (c) { this.children.splice(i, 1); c.parent = null; if (c._cleanup) c._cleanup(); } return c; }
    removeAllChildren()  { 
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].parent = null;
        if (this.children[i]._cleanup) this.children[i]._cleanup();
      }
      this.children.length = 0; 
    }
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
      if (script) {
        try {
          script.call(this);
        } catch (e) {
          console.warn('Frame script error:', e);
        }
      }
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
      if (script) {
        try {
          script.call(this);
        } catch (e) {
          console.warn('Frame script error:', e);
        }
      }
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
