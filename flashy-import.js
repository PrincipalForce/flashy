/* flashy-import.js — a parsed Flash movie back into an editable document
 *
 * `flashy-swf.js` and `flashy-fla.js` both stop at the same place: a plain
 * **document model** of characters and timelines. This file is what turns
 * that into a Flashy document — a stage, layers, keyframes, a library of
 * symbols, bitmap and sound assets, and frame scripts. In other words it is
 * the part that makes an import *editable* rather than merely playable.
 *
 * HOW A MOVIE IS TAKEN APART
 *
 *   Depths become layers. A SWF display list is a set of numbered depths,
 *   and a depth holds at most one object at a time — which is exactly what a
 *   layer is. Higher depth draws on top, so the depths are stacked with the
 *   highest first (`doc.layers[0]` is the top layer in this editor).
 *
 *   Placements become keyframes. The display list is replayed frame by
 *   frame; a depth that is given a different character, moved, recoloured or
 *   removed starts a new keyframe, and a depth that is left alone extends
 *   the one it is on.
 *
 *   Straight-line motion becomes a motion tween. Flash's publisher bakes a
 *   tween into one placement per frame, so a 40-frame slide arrives as 40
 *   identical-looking keyframes. Any run whose transforms sit on a straight
 *   line between its ends is folded back into a single tweened keyframe —
 *   which is both what the author drew and far less to edit.
 *
 *   Sprites become library symbols, recursively, with their own layers and
 *   frames. A shape placed more than once becomes a graphic symbol so the
 *   reuse survives; a shape placed once stays as ordinary artwork on the
 *   stage, because a library full of single-use symbols is worse than no
 *   library at all.
 *
 *   Buttons become 4-frame button symbols (up, over, down, hit) — Flash's
 *   own structure for them.
 *
 *   Shapes become `path` objects with their real curves. The editor's path
 *   type already holds exactly what a SWF shape is: quadratics and lines in
 *   closed loops, filled even-odd.
 *
 *   ActionScript lands on an Actions layer, at the frame it ran on, the way
 *   an author would have written it. Frame labels are kept as a comment on
 *   the same keyframe, since the editor has no label of its own yet. Clip
 *   and button handlers come across commented out, attached to the frame
 *   that placed them: they cannot run here, and deleting them would throw
 *   away the only copy.
 *
 *   Skews are baked. The editor has rotation and scale, not a full matrix,
 *   and about one placement in six of a real cartoon is skewed. Where the
 *   artwork is a path, the matrix goes into the points instead, so it lands
 *   exactly right; only symbol instances, whose geometry is shared, fall
 *   back to an approximation.
 *
 * WHAT IS LOST, AND SAID SO (in `report.warnings`)
 *   Masks (clip depths), filters, blend modes beyond the canvas set, skewed
 *   *symbol instances*, morph tweening, and ActionScript 3. Gradients come
 *   across as gradients — stops, geometry and all.
 *
 * Pure data in, pure data out: no DOM except the optional canvas used to
 * re-encode raw bitmap pixels, which the caller can supply instead.
 */
(function (global) {
  'use strict';

  var MOVE = 0, LINE = 1, QUAD = 2, CLOSE = 3;
  var TWIPS = 20;
  var IDENTITY = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

  /* How close two numbers have to be to count as "on the same straight
     line" when folding baked frames back into a tween. A twentieth of a
     pixel is below what anybody can see and well above the rounding a
     publisher introduces. */
  var TWEEN_EPS = 0.05;
  var TWEEN_ANGLE_EPS = 0.25;          // degrees

  // -------------------- small helpers --------------------
  function hexColor(n) {
    if (typeof n === 'string') return n;
    n = (n | 0) & 0xffffff;
    return '#' + ('000000' + n.toString(16)).slice(-6).toUpperCase();
  }

  function base64(bytes) {
    if (!bytes || !bytes.length) return '';
    if (typeof btoa === 'function') {
      var CHUNK = 0x8000, parts = [];
      for (var i = 0; i < bytes.length; i += CHUNK) {
        parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
      }
      return btoa(parts.join(''));
    }
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    return '';
  }

  function pathBounds(path) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function touch(x, y) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    for (var i = 0; i < path.length;) {
      var op = path[i++];
      if (op === MOVE || op === LINE) { touch(path[i], path[i + 1]); i += 2; }
      else if (op === QUAD) { touch(path[i], path[i + 1]); touch(path[i + 2], path[i + 3]); i += 4; }
    }
    if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  /* Rounded to a hundredth of a pixel: the source coordinates are twips
     (a twentieth), so nothing is lost, and unrounded floats serialise as
     17 digits apiece — which on a feature-length movie is the difference
     between a 17MB document and a 90MB one. */
  function r2(v) { return Math.round(v * 100) / 100; }

  function translatePath(path, dx, dy) {
    var out = path.slice();
    for (var i = 0; i < out.length;) {
      var op = out[i++];
      if (op === MOVE || op === LINE) { out[i] = r2(out[i] + dx); out[i + 1] = r2(out[i + 1] + dy); i += 2; }
      else if (op === QUAD) {
        out[i] = r2(out[i] + dx); out[i + 1] = r2(out[i + 1] + dy);
        out[i + 2] = r2(out[i + 2] + dx); out[i + 3] = r2(out[i + 3] + dy);
        i += 4;
      }
    }
    return out;
  }

  /**
   * Put a path through a full Flash matrix.
   *
   * The editor can rotate and scale an object but not skew it, and about one
   * placement in six of a real cartoon is skewed. A `path` object's geometry
   * is arbitrary, though — so where the transform cannot be expressed in the
   * object's fields, it is baked into the points instead and the object is
   * left unrotated and unscaled. The artwork is then exactly right, which is
   * worth more than keeping a rotation value the renderer would ignore.
   *
   * `ox/oy` is where the path's local (0,0) sits in character space.
   */
  function transformPath(path, m, ox, oy) {
    var out = path.slice();
    function px(x, y) { return r2(m.a * (x + ox) + m.c * (y + oy) + m.tx / TWIPS); }
    function py(x, y) { return r2(m.b * (x + ox) + m.d * (y + oy) + m.ty / TWIPS); }
    for (var i = 0; i < out.length;) {
      var op = out[i++];
      if (op === MOVE || op === LINE) {
        var x = out[i], y = out[i + 1];
        out[i] = px(x, y); out[i + 1] = py(x, y);
        i += 2;
      } else if (op === QUAD) {
        var cx1 = out[i], cy1 = out[i + 1], x2 = out[i + 2], y2 = out[i + 3];
        out[i] = px(cx1, cy1); out[i + 1] = py(cx1, cy1);
        out[i + 2] = px(x2, y2); out[i + 3] = py(x2, y2);
        i += 4;
      }
    }
    return out;
  }

  /**
   * Put a box-fraction gradient through the same matrix a baked path took.
   *
   * The fractions were relative to the character-space box; after baking,
   * the box is the transformed bounding box, so each end point goes through
   * the matrix and is re-expressed against the new box.
   */
  function bakeGradient(grad, m, bb, pf) {
    var oldW = pf.width || 1, oldH = pf.height || 1;
    function map(fx, fy) {
      var x = pf.originX + fx * oldW, y = pf.originY + fy * oldH;
      var wx = m.a * x + m.c * y + m.tx / TWIPS;
      var wy = m.b * x + m.d * y + m.ty / TWIPS;
      return [r2((wx - bb.x) / (bb.width || 1)), r2((wy - bb.y) / (bb.height || 1))];
    }
    var p0 = map(grad[0], grad[1]), p1 = map(grad[2], grad[3]);
    return [p0[0], p0[1], p1[0], p1[1]];
  }

  /* An editor object is plain data — loadDoc() revives it. Writing them as
     literals here keeps this file independent of editor-app.js. */
  function obj(type, over) {
    var o = {
      type: type, x: 0, y: 0, width: 0, height: 0,
      rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, alpha: 1, name: '',
      fillColor: '#000000', fillAlpha: 1, fillType: 'solid',
      strokeColor: '#000000', strokeAlpha: 1, strokeWidth: 0,
      strokeStyle: 'none', strokeCap: 'round', strokeJoin: 'round',
      points: null, text: '', font: 'Arial', fontSize: 24,
      fontBold: false, fontItalic: false, fontUnderline: false,
      textAlign: 'left', lineHeight: 1.2,
      symbolName: '', instanceName: '', symbolBehavior: 'movieclip',
      firstFrame: 1, loopMode: 'loop', blendMode: 'source-over',
      bitmapAsset: '', smoothing: true, path: null, pathW: 0, pathH: 0,
      eraseMask: null, maskW: 0, maskH: 0
    };
    if (over) for (var k in over) if (Object.prototype.hasOwnProperty.call(over, k)) o[k] = over[k];
    return o;
  }

  function keyframe(index, over) {
    var kf = {
      index: index, duration: 1, tweenType: 'none', easing: 'linear',
      objects: [], script: '', label: '', sound: null
    };
    if (over) for (var k in over) if (Object.prototype.hasOwnProperty.call(over, k)) kf[k] = over[k];
    return kf;
  }

  // -------------------- transforms --------------------
  /**
   * Turn a Flash matrix plus a piece of content into the editor's fields.
   *
   * The editor draws an object as `translate(x + w/2, y + h/2) · rotate ·
   * scale`, with the content's own origin at `(-w/2, -h/2)`. Flash draws it
   * as a plain 2×3 matrix. Solving one for the other is where a rotated
   * import either lands exactly or drifts by half a bounding box, so it is
   * done once, here.
   *
   * `originX/originY` is where the content's local (0,0) sits in the
   * character's own space; `w/h` is the box the content is stored in.
   */
  function placeFields(matrix, originX, originY, w, h) {
    var m = matrix || IDENTITY;
    var scaleX = Math.sqrt(m.a * m.a + m.b * m.b);
    var scaleY = Math.sqrt(m.c * m.c + m.d * m.d);
    var rotation = Math.atan2(m.b, m.a);
    /* A mirrored matrix has a negative determinant; the editor can only show
       that as a negative scale on one axis. */
    if (m.a * m.d - m.b * m.c < 0) scaleY = -scaleY;
    var skew = Math.atan2(-m.c, m.d) - (scaleY < 0 ? -rotation : rotation);
    while (skew > Math.PI) skew -= Math.PI * 2;
    while (skew < -Math.PI) skew += Math.PI * 2;

    var tx = m.a * originX + m.c * originY + m.tx / TWIPS;
    var ty = m.b * originX + m.d * originY + m.ty / TWIPS;
    var cos = Math.cos(rotation), sin = Math.sin(rotation);
    var hw = w / 2, hh = h / 2;
    // The rotate·scale part applied to the content's centre.
    var cx = (scaleX * cos) * hw + (-scaleY * sin) * hh;
    var cy = (scaleX * sin) * hw + (scaleY * cos) * hh;
    return {
      x: tx + cx - hw,
      y: ty + cy - hh,
      width: w, height: h,
      /* Where the content's own origin sat, which bakeGradient needs. */
      originX: originX, originY: originY,
      /* How far Flash's registration point is from the centre this editor
         transforms about — what an imported `onClipEvent` needs to agree
         with the coordinates baked into it. */
      regX: r2(cx), regY: r2(cy),
      scaleX: scaleX || 1e-6,
      scaleY: scaleY || 1e-6,
      rotation: rotation * 180 / Math.PI,
      skew: skew
    };
  }

  /** Multiplicative alpha out of a colour transform. */
  function cxAlpha(cx) {
    if (!cx) return 1;
    var a = 1;
    if (cx.mul && cx.mul.length >= 4) a *= cx.mul[3];
    if (cx.add && cx.add.length >= 4) a += cx.add[3] / 255;
    return Math.max(0, Math.min(1, a));
  }

  /** Apply a colour transform's RGB part to one colour. */
  function cxColor(color, cx) {
    if (!cx || (!cx.mul && !cx.add)) return color;
    var r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
    if (cx.mul) { r *= cx.mul[0]; g *= cx.mul[1]; b *= cx.mul[2]; }
    if (cx.add) { r += cx.add[0]; g += cx.add[1]; b += cx.add[2]; }
    var cl = function (v) { return Math.max(0, Math.min(255, Math.round(v))); };
    return (cl(r) << 16) | (cl(g) << 8) | cl(b);
  }

  function isIdentityCx(cx) {
    if (!cx) return true;
    if (cx.add) for (var i = 0; i < cx.add.length; i++) if (cx.add[i]) return false;
    if (cx.mul) for (var j = 0; j < cx.mul.length; j++) if (Math.abs(cx.mul[j] - 1) > 0.004) return false;
    return true;
  }

  /** The colour a gradient reads as once flattened: its widest stop. */
  function dominantStop(stops) {
    if (!stops || !stops.length) return { color: 0x808080, alpha: 1 };
    if (stops.length === 1) return stops[0];
    var best = stops[0], bestSpan = -1;
    for (var i = 0; i < stops.length; i++) {
      var prev = i > 0 ? stops[i - 1].ratio : 0;
      var next = i + 1 < stops.length ? stops[i + 1].ratio : 1;
      var span = (next - prev) / 2 + (stops[i].alpha > 0 ? 0 : -1);
      if (span > bestSpan) { bestSpan = span; best = stops[i]; }
    }
    return best;
  }

  // -------------------- the converter --------------------
  function Converter(model, opts) {
    this.model = model;
    this.opts = opts || {};
    this.warnings = (model.warnings || []).slice();
    this.library = {};
    this.bitmaps = {};
    this.sounds = {};
    this.names = {};               // characterId → symbol name
    this.assetNames = {};          // characterId → bitmap/sound asset name
    this.used = {};                // taken names
    this.usage = {};               // characterId → number of placements
    this.building = {};            // cycle guard
    this.stats = {
      layers: 0, keyframes: 0, objects: 0, symbols: 0, shapes: 0,
      scripts: 0, sounds: 0, bitmaps: 0, texts: 0, tweens: 0, gradients: 0,
      handlers: 0, masks: 0
    };
    this.said = {};                // one warning per kind, not per placement
    /* Where every imported script ended up. A movie can put most of its code
       inside symbols — this test movie puts 990 of its 1085 there — and
       "I did not see any code" is then a navigation problem, not an import
       one. */
    this.scriptIndex = [];
    this.scriptsOnStage = 0;
    this.scriptsInSymbols = 0;
    this.context = 'Scene';        // whose timeline is being built right now
  }

  Converter.prototype.warn = function (key, message) {
    if (key && this.said[key]) return;
    if (key) this.said[key] = true;
    this.warnings.push(message);
  };

  Converter.prototype.uniqueName = function (base) {
    var name = String(base || 'Symbol').replace(/[\r\n\t]/g, ' ').trim() || 'Symbol';
    if (!this.used[name]) { this.used[name] = true; return name; }
    var n = 2;
    while (this.used[name + ' ' + n]) n++;
    this.used[name + ' ' + n] = true;
    return name + ' ' + n;
  };

  Converter.prototype.character = function (id) {
    return this.model.characters[id] || null;
  };

  /** A readable name for a character: what it was exported as, or its kind. */
  Converter.prototype.nameFor = function (id) {
    if (this.names[id]) return this.names[id];
    var c = this.character(id);
    var base;
    if (!c) base = 'Missing ' + id;
    else if (c.exportName) base = c.exportName;
    else if (c.className) base = c.className.replace(/^.*[.:]/, '');
    else if (c.name) base = c.name;
    else base = c.kind.charAt(0).toUpperCase() + c.kind.slice(1) + ' ' + id;
    this.names[id] = this.uniqueName(base);
    return this.names[id];
  };

  // ---- usage counting -------------------------------------------------
  Converter.prototype.countUsage = function () {
    var self = this;
    /* What counts as "used twice" is appearing on two depths or twice over
       time — NOT being on screen for two frames. A SWF places a character
       once and leaves it there, but an XFL timeline re-states every element
       on every frame of its span, so counting raw place commands would make
       a library symbol out of every background in the movie. */
    function countFrames(frames) {
      var states = simulate(frames);
      var last = {};
      for (var i = 0; i < states.length; i++) {
        var snap = states[i];
        var now = {};
        for (var d in snap) {
          now[d] = snap[d].id;
          if (last[d] !== snap[d].id) {
            self.usage[snap[d].id] = (self.usage[snap[d].id] || 0) + 1;
          }
        }
        last = now;
      }
    }
    countFrames(this.model.timeline.frames);
    for (var id in this.model.characters) {
      var c = this.model.characters[id];
      if (c.kind === 'sprite') countFrames(c.frames);
      else if (c.kind === 'button') {
        ['up', 'over', 'down', 'hit'].forEach(function (state) {
          (c.states[state] || []).forEach(function (rec) {
            self.usage[rec.id] = (self.usage[rec.id] || 0) + 1;
          });
        });
      }
    }
  };

  /** Characters that earn a place in the library rather than being inlined. */
  Converter.prototype.isSymbol = function (id) {
    var c = this.character(id);
    if (!c) return false;
    if (c.kind === 'sprite' || c.kind === 'button') return true;
    if (c.exportName || c.className) return true;
    if (c.kind === 'shape' || c.kind === 'morph' || c.kind === 'text') {
      return (this.usage[id] || 0) > 1;
    }
    return false;
  };

  // ---- artwork --------------------------------------------------------
  /**
   * The editor objects for one character, in the character's own coordinate
   * space (so a symbol built from them keeps Flash's registration point).
   */
  Converter.prototype.artworkFor = function (id) {
    var c = this.character(id);
    if (!c) return [];
    if (c.kind === 'shape' || c.kind === 'morph') return this.shapeObjects(c);
    if (c.kind === 'text') return this.textObjects(c);
    if (c.kind === 'edittext') return [this.editTextObject(c)];
    if (c.kind === 'bitmap') return this.bitmapObjects(c);
    return [];
  };

  Converter.prototype.shapeObjects = function (c) {
    var out = [];
    for (var i = 0; i < c.items.length; i++) {
      var o = this.itemObject(c.items[i], c, i);
      if (o) out.push(o);
    }
    this.stats.shapes += out.length;
    return out;
  };

  Converter.prototype.itemObject = function (item, c, index) {
    if (!item.path || !item.path.length) return null;
    var b = pathBounds(item.path);
    if (!(b.width > 0) && !(b.height > 0)) return null;
    var local = translatePath(item.path, -b.x, -b.y);
    var o = obj('path', {
      path: local, pathW: b.width, pathH: b.height,
      x: b.x, y: b.y, width: b.width, height: b.height,
      name: (c.exportName || c.kind + ' ' + c.id) + (index ? ' ' + (index + 1) : '')
    });
    if (item.fill) {
      var fill = item.fill;
      if (fill.type === 'solid') {
        o.fillColor = hexColor(fill.color);
        o.fillAlpha = fill.alpha != null ? fill.alpha : 1;
      } else if (fill.type === 'linear' || fill.type === 'radial') {
        this.applyGradient(o, fill, b);
      } else if (fill.type === 'bitmap') {
        var asset = this.bitmapAsset(fill.bitmapId);
        if (asset) {
          /* A bitmap-filled rectangle is how Flash places a photo, so the
             common case comes back as the image itself rather than as a
             grey box the user has to recognise. */
          return obj('bitmap', {
            bitmapAsset: asset, x: b.x, y: b.y, width: b.width, height: b.height,
            fillType: 'none', strokeStyle: 'none', strokeWidth: 0,
            name: asset
          });
        }
        o.fillColor = '#999999';
        this.warn('bitmapfill', 'A bitmap fill had no decodable image and became flat grey.');
      } else {
        o.fillColor = '#999999';
      }
    } else {
      o.fillType = 'none';
    }
    if (item.stroke) {
      o.strokeStyle = 'solid';
      o.strokeWidth = Math.max(0.05, item.stroke.width / TWIPS);
      o.strokeColor = hexColor(item.stroke.color);
      o.strokeAlpha = item.stroke.alpha != null ? item.stroke.alpha : 1;
      o.strokeCap = item.stroke.cap || 'round';
      o.strokeJoin = item.stroke.join || 'round';
    }
    return o;
  };

  /**
   * A Flash gradient onto an editor object.
   *
   * SWF and XFL both describe a gradient as a matrix applied to a fixed
   * square 32768 twips across, centred on the origin: the ends of the ramp
   * are that square's left and right edges put through the matrix. The
   * editor stores the ramp as fractions of the object's own box, so the
   * gradient scales and rotates with the shape — and so one definition feeds
   * the canvas painter, the exported engine, and SVG's objectBoundingBox
   * units alike.
   */
  Converter.prototype.applyGradient = function (o, fill, box) {
    var m = fill.matrix || IDENTITY;
    var at = function (gx, gy) {
      return {
        x: (m.a * gx + m.c * gy + m.tx) / TWIPS,
        y: (m.b * gx + m.d * gy + m.ty) / TWIPS
      };
    };
    var from = fill.type === 'radial' ? at(0, 0) : at(-16384, 0);
    var to = at(16384, 0);
    var w = box.width || 1, h = box.height || 1;
    o.fillType = fill.type;
    o.fillGrad = [
      r2((from.x - box.x) / w), r2((from.y - box.y) / h),
      r2((to.x - box.x) / w), r2((to.y - box.y) / h)
    ];
    var stops = [];
    for (var i = 0; i < fill.stops.length; i++) {
      var st = fill.stops[i];
      stops.push(Math.round(st.ratio * 1000) / 1000, st.color | 0,
        st.alpha == null ? 1 : Math.round(st.alpha * 1000) / 1000);
    }
    o.fillStops = stops;
    /* Keep a flat colour as well: anything that has not learned about
       gradients still draws something sensible rather than black. */
    var dom = dominantStop(fill.stops);
    o.fillColor = hexColor(dom.color);
    o.fillAlpha = dom.alpha != null ? dom.alpha : 1;
    this.stats.gradients++;
  };

  Converter.prototype.textObjects = function (c) {
    /* Static text is glyph indices into a font. When the font carried a code
       table the words are recoverable and come back as editable text; when
       it did not, the outlines are all there is, and an outline the user can
       still reshape beats a box reading "(text)". */
    var out = [];
    var runs = c.runs || [];
    var readable = runs.some(function (r) { return r.text && r.text.trim(); });
    /* `textAsOutlines` trades editability for exactness: a Flash movie
       embeds the glyphs it uses, so the outlines are the real artwork and a
       system font is an approximation of it. Editable text is the better
       default — but when the import is for preservation rather than for
       editing, the outlines are what matches the original pixel for pixel. */
    if (this.opts.textAsOutlines && (c.items || []).length) readable = false;
    if (!readable) {
      var items = c.items || [];
      for (var k = 0; k < items.length; k++) {
        var o = this.itemObject(items[k], c, k);
        if (o) out.push(o);
      }
      if (out.length && !this.opts.textAsOutlines) {
        this.warn('textoutline', 'Static text without a font code table was imported as outlines.');
      }
      return out;
    }
    for (var i = 0; i < runs.length; i++) {
      var run = runs[i];
      if (!run.text) continue;
      var size = run.size || 12;
      out.push(obj('text', {
        text: run.text,
        font: run.font || 'Arial',
        fontSize: size,
        fillColor: hexColor(run.color),
        fillAlpha: run.alpha != null ? run.alpha : 1,
        /* The pen sits on the baseline; the editor's y is the top of the
           line, so back up by roughly the ascent. */
        x: run.x / TWIPS,
        y: run.y / TWIPS - size * 0.8,
        width: this.measure(run.text, size, run.font),
        height: size * 1.2,
        strokeWidth: 0, strokeStyle: 'none'
      }));
      this.stats.texts++;
    }
    /* A transform on the whole text block (DefineText's own matrix) applies
       to every run in it. */
    if (c.matrix && out.length) {
      for (var t = 0; t < out.length; t++) {
        var f = placeFields(c.matrix, out[t].x, out[t].y, out[t].width, out[t].height);
        out[t].x = f.x; out[t].y = f.y;
        out[t].scaleX = f.scaleX; out[t].scaleY = f.scaleY;
        out[t].rotation = f.rotation;
      }
    }
    return out;
  };

  /* How wide a line of text actually is. Guessing at it (`0.6 × size × the
     character count`, which is what this did first) puts every selection box
     and every symbol's bounds visibly wrong on a movie with two thousand
     text objects in it, so measure where a canvas is available. */
  Converter.prototype.measure = function (text, size, font) {
    var fallback = Math.max(size * 0.6 * (text ? text.length : 1), size);
    if (this.opts.measureText) return r2(this.opts.measureText(text, size, font) || fallback);
    if (this._measureCtx === undefined) {
      this._measureCtx = null;
      try {
        if (typeof document !== 'undefined' && document.createElement) {
          this._measureCtx = document.createElement('canvas').getContext('2d');
        }
      } catch (e) { this._measureCtx = null; }
    }
    if (!this._measureCtx) return r2(fallback);
    try {
      this._measureCtx.font = size + 'px ' + (font || 'Arial') + ', sans-serif';
      var w = this._measureCtx.measureText(text || '').width;
      return r2(w > 0 ? w : fallback);
    } catch (e) {
      return r2(fallback);
    }
  };

  Converter.prototype.editTextObject = function (c) {
    this.stats.texts++;
    return obj('text', {
      text: c.text || '',
      font: (this.model.fonts && c.fontId != null && this.model.fonts[c.fontId]
        ? this.model.fonts[c.fontId].name : '') || 'Arial',
      fontSize: c.fontHeight || 12,
      fillColor: hexColor(c.color),
      fillAlpha: c.alpha != null ? c.alpha : 1,
      textAlign: c.align || 'left',
      x: c.bounds.x, y: c.bounds.y,
      width: c.bounds.width, height: c.bounds.height,
      instanceName: c.variableName || '',
      strokeWidth: 0, strokeStyle: 'none'
    });
  };

  Converter.prototype.bitmapObjects = function (c) {
    var asset = this.bitmapAsset(c.id);
    if (!asset) return [];
    var a = this.bitmaps[asset];
    return [obj('bitmap', {
      bitmapAsset: asset, x: 0, y: 0,
      width: a.width || 0, height: a.height || 0,
      fillType: 'none', strokeStyle: 'none', strokeWidth: 0, name: asset
    })];
  };

  // ---- assets ---------------------------------------------------------
  /** Register a bitmap character as a document asset; returns its name. */
  Converter.prototype.bitmapAsset = function (id) {
    if (this.assetNames[id]) return this.assetNames[id];
    var c = this.character(id);
    if (!c || c.kind !== 'bitmap') return null;
    var name = this.uniqueName(c.exportName || ('Bitmap ' + id));
    var record = null;
    if (c.data && c.mime) {
      record = {
        name: name, mediaType: c.mime, data: base64(c.data),
        width: c.width || 0, height: c.height || 0
      };
      /* JPEG and PNG payloads carry their own size; measuring them needs a
         decode, which the editor does on load anyway. */
    } else if (c.rgba && c.width && c.height) {
      var url = this.encodeRGBA(c.rgba, c.width, c.height);
      if (url) {
        record = {
          name: name, mediaType: 'image/png',
          data: url.slice(url.indexOf(',') + 1),
          width: c.width, height: c.height
        };
      }
    }
    if (!record) {
      this.warn('bitmapdecode', 'A bitmap could not be re-encoded and was skipped.');
      return null;
    }
    this.bitmaps[name] = record;
    this.assetNames[id] = name;
    this.stats.bitmaps++;
    return name;
  };

  /** Raw pixels → a PNG data URL. Overridable; falls back to a canvas. */
  Converter.prototype.encodeRGBA = function (rgba, width, height) {
    if (this.opts.encodeRGBA) return this.opts.encodeRGBA(rgba, width, height);
    try {
      var canvas;
      if (typeof document !== 'undefined' && document.createElement) {
        canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
      } else if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(width, height);
      } else return null;
      var ctx = canvas.getContext('2d');
      var img = ctx.createImageData(width, height);
      img.data.set(rgba);
      ctx.putImageData(img, 0, 0);
      return canvas.toDataURL ? canvas.toDataURL('image/png') : null;
    } catch (e) {
      return null;
    }
  };

  /** Register a sound character as a document asset; returns its name. */
  Converter.prototype.soundAsset = function (id) {
    if (this.assetNames['s' + id]) return this.assetNames['s' + id];
    var c = this.character(id);
    if (!c || c.kind !== 'sound') return null;
    if (!c.data || !c.mime) {
      this.warn('sounddecode', 'A sound was in a format Flashy cannot play (' +
        (c.unsupported || 'unknown') + ') and was skipped.');
      return null;
    }
    var name = this.uniqueName(c.exportName || ('Sound ' + id));
    this.sounds[name] = {
      name: name, mediaType: c.mime, data: base64(c.data),
      duration: c.rate ? c.sampleCount / c.rate : 0
    };
    this.assetNames['s' + id] = name;
    this.stats.sounds++;
    return name;
  };

  // ---- symbols --------------------------------------------------------
  /** Build (once) and name the library symbol for a character. */
  Converter.prototype.symbolFor = function (id) {
    var name = this.nameFor(id);
    if (this.library[name]) return name;
    if (this.building[id]) return name;        // recursive reference
    this.building[id] = true;
    var c = this.character(id);
    var entry = null;
    if (!c) {
      entry = { layers: [{ name: 'Layer 1', visible: true, locked: false, keyframes: [keyframe(1)] }], totalFrames: 1 };
    } else if (c.kind === 'sprite') {
      var outer = this.context;
      this.context = name;
      var built = this.buildLayers(c.frames, c.labels, {
        initScripts: c.initScripts, name: name
      });
      this.context = outer;
      entry = { layers: built.layers, totalFrames: built.totalFrames };
    } else if (c.kind === 'button') {
      entry = this.buttonSymbol(c);
    } else {
      var art = this.artworkFor(id).map(tidy);
      entry = {
        layers: [{
          name: 'Layer 1', visible: true, locked: false,
          keyframes: [keyframe(1, { duration: 1, objects: art })]
        }],
        totalFrames: 1
      };
    }
    entry.objects = entry.layers[0] && entry.layers[0].keyframes[0]
      ? entry.layers[0].keyframes[0].objects.slice() : [];
    this.library[name] = entry;
    this.stats.symbols++;
    delete this.building[id];
    return name;
  };

  /** A button's four states, as the four frames Flash would have used. */
  Converter.prototype.buttonSymbol = function (c) {
    var self = this;
    var states = ['up', 'over', 'down', 'hit'];
    var byDepth = {};
    states.forEach(function (state, frameIdx) {
      (c.states[state] || []).forEach(function (rec) {
        var d = rec.depth;
        if (!byDepth[d]) byDepth[d] = [null, null, null, null];
        byDepth[d][frameIdx] = rec;
      });
    });
    var depths = Object.keys(byDepth).map(Number).sort(function (a, b) { return b - a; });
    var layers = depths.map(function (depth, i) {
      var recs = byDepth[depth];
      var keyframes = [];
      for (var f = 0; f < 4; f++) {
        var kf = keyframe(f + 1, { duration: 1 });
        if (recs[f]) {
          kf.objects = self.objectsForPlacement({
            id: recs[f].id, matrix: recs[f].matrix,
            colorTransform: recs[f].colorTransform
          });
        }
        keyframes.push(kf);
      }
      return {
        name: 'Layer ' + (i + 1), visible: true, locked: false, keyframes: keyframes
      };
    });
    if (!layers.length) {
      layers = [{ name: 'Layer 1', visible: true, locked: false, keyframes: [keyframe(1)] }];
    }
    var entry = { layers: layers, totalFrames: 4 };
    /* A button's handlers belong to the instance that gets clicked, not to
       the symbol's own timeline, so they are carried out to each placement. */
    if (c.handlers && c.handlers.length) {
      entry.handlerSource = this.handlerSource(c.handlers, 'on', 1);
    }
    return entry;
  };

  /**
   * Clip and button handlers, as source an object can actually run.
   *
   * These used to be imported commented out, because nothing could execute
   * them. `flashy-as2.js` now does, so they come across as the author wrote
   * them: `onClipEvent(load) { … }` blocks on the object itself, which is
   * where Flash kept them and where the Actions panel shows them.
   */
  Converter.prototype.handlerSource = function (handlers, kind, frame) {
    var lines = [];
    for (var i = 0; i < handlers.length; i++) {
      var h = handlers[i];
      var events = (h.conditions || h.events || []).filter(function (e) {
        /* A keyPress condition carries a key code this runtime cannot bind
           yet; the handler still runs on whatever else it listens for. */
        return e && e.indexOf('keyPress') !== 0;
      });
      if (!events.length) events = [kind === 'on' ? 'release' : 'load'];
      lines.push((kind === 'on' ? 'on(' : 'onClipEvent(') + events.join(', ') + ') {');
      var body = (h.source || '').split('\n');
      for (var j = 0; j < body.length; j++) lines.push('  ' + body[j]);
      lines.push('}');
    }
    this.stats.scripts++;
    this.stats.handlers++;
    this.note(frame || 1, 'handler');
    return lines.join('\n');
  };

  // ---- placements -----------------------------------------------------
  /**
   * The objects one display-list entry contributes to a keyframe: a symbol
   * instance, or the character's artwork transformed into place.
   */
  Converter.prototype.objectsForPlacement = function (state) {
    var id = state.id;
    var c = this.character(id);
    if (!c) return [];
    var alpha = cxAlpha(state.colorTransform);
    var out;

    if (this.isSymbol(id)) {
      var name = this.symbolFor(id);
      var size = this.symbolSize(name);
      var f = placeFields(state.matrix, 0, 0, size.width, size.height);
      var behavior = c.kind === 'button' ? 'button'
        : (state.graphic || c.symbolType === 'graphic') ? 'graphic' : 'movieclip';
      var inst = obj('symbol', {
        symbolName: name,
        symbolBehavior: behavior,
        firstFrame: state.firstFrame || 1,
        loopMode: state.loopMode === 'single frame' ? 'single'
          : state.loopMode === 'play once' ? 'once' : 'loop',
        instanceName: state.name || '',
        name: state.name || '',
        x: f.x, y: f.y, width: f.width, height: f.height,
        scaleX: f.scaleX, scaleY: f.scaleY, rotation: f.rotation,
        alpha: alpha
      });
      if (state.blend && state.blend !== 'normal') inst.blendMode = canvasBlend(state.blend);
      /* A button's `on(press)` handlers belong to the instance, and a clip's
         `onClipEvent` handlers to this placement of it. */
      var entry = this.library[name];
      var scripts = [];
      if (entry && entry.handlerSource) scripts.push(entry.handlerSource);
      if (state.clipActions) scripts.push(this.handlerSource(state.clipActions, 'clip', 1));
      if (scripts.length) {
        inst.clipScript = scripts.join('\n');
        inst.regX = f.regX; inst.regY = f.regY;
      }
      this.noteSkew(f);
      out = [inst];
    } else {
      out = [];
      var art = this.artworkFor(id);
      for (var i = 0; i < art.length; i++) {
        var a = art[i];
        var pf = placeFields(state.matrix, a.x, a.y, a.width, a.height);
        if (a.type === 'path' && a.path && Math.abs(pf.skew) > 0.01) {
          /* Skewed: bake the whole matrix into the points rather than
             approximating it with a rotation the shape never had. */
          var baked = transformPath(a.path, state.matrix, a.x, a.y);
          var bb = pathBounds(baked);
          a.path = translatePath(baked, -bb.x, -bb.y);
          a.x = r2(bb.x); a.y = r2(bb.y);
          a.width = a.pathW = r2(bb.width);
          a.height = a.pathH = r2(bb.height);
          a.scaleX = 1; a.scaleY = 1; a.rotation = 0;
          /* The gradient is stored in box fractions and the box just moved
             and sheared, so re-express it against the new one. */
          if (a.fillGrad) a.fillGrad = bakeGradient(a.fillGrad, state.matrix, bb, pf);
          if (a.strokeWidth) {
            a.strokeWidth = Math.max(0.05, a.strokeWidth * (Math.abs(pf.scaleX) + Math.abs(pf.scaleY)) / 2);
          }
          pf.skew = 0;
        } else {
          a.x = pf.x; a.y = pf.y;
          a.scaleX = pf.scaleX; a.scaleY = pf.scaleY; a.rotation = pf.rotation;
        }
        a.alpha = alpha;
        if (state.name && i === 0) { a.name = state.name; a.instanceName = state.name; }
        if (state.clipActions && i === 0) {
          a.clipScript = this.handlerSource(state.clipActions, 'clip', 1);
          a.regX = pf.regX; a.regY = pf.regY;
        }
        if (state.colorTransform && !isIdentityCx(state.colorTransform)) {
          if (a.fillType !== 'none') a.fillColor = hexColor(cxColor(parseInt(a.fillColor.slice(1), 16), state.colorTransform));
          if (a.strokeWidth) a.strokeColor = hexColor(cxColor(parseInt(a.strokeColor.slice(1), 16), state.colorTransform));
        }
        this.noteSkew(pf);
        out.push(a);
      }
    }
    for (var r = 0; r < out.length; r++) tidy(out[r]);
    this.stats.objects += out.length;
    return out;
  };

  /* Matrix maths leaves `163.99999999999997` behind. Rounding the geometry
     to what the format can mean keeps documents small and, more to the
     point, keeps the inspector readable. */
  function tidy(o) {
    o.x = r2(o.x); o.y = r2(o.y);
    o.width = r2(o.width); o.height = r2(o.height);
    o.scaleX = Math.round(o.scaleX * 10000) / 10000;
    o.scaleY = Math.round(o.scaleY * 10000) / 10000;
    o.rotation = Math.round(o.rotation * 1000) / 1000;
    o.alpha = Math.round(o.alpha * 1000) / 1000;
    return o;
  }

  Converter.prototype.noteSkew = function (f) {
    if (Math.abs(f.skew) > 0.01) {
      this.warn('skew', 'Some symbol instances were skewed; the editor has ' +
        'rotation and scale only, so those placements are approximate. ' +
        '(Skewed artwork is exact — the transform is baked into the paths.)');
    }
  };

  /** A symbol's content box, for the instance's width/height. */
  Converter.prototype.symbolSize = function (name) {
    var entry = this.library[name];
    if (!entry) return { width: 0, height: 0 };
    if (entry._size) return entry._size;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    (entry.layers || []).forEach(function (layer) {
      (layer.keyframes || []).forEach(function (kf) {
        (kf.objects || []).forEach(function (o) {
          var w = (o.width || 0) * Math.abs(o.scaleX || 1);
          var h = (o.height || 0) * Math.abs(o.scaleY || 1);
          if (o.x < minX) minX = o.x;
          if (o.y < minY) minY = o.y;
          if (o.x + w > maxX) maxX = o.x + w;
          if (o.y + h > maxY) maxY = o.y + h;
        });
      });
    });
    entry._size = (minX === Infinity)
      ? { width: 0, height: 0 }
      /* Symbol space starts at the instance's top-left in this editor, so a
         symbol whose artwork starts away from its origin needs that gap
         inside the box or the instance draws clipped out of its own bounds. */
      : { width: r2(Math.max(0, maxX)), height: r2(Math.max(0, maxY)) };
    return entry._size;
  };

  // ---- timelines ------------------------------------------------------
  /** Replay the display list, giving the state of every depth on every frame. */
  function simulate(frames) {
    var current = {};
    var out = [];
    for (var i = 0; i < frames.length; i++) {
      var cmds = frames[i].commands || [];
      for (var j = 0; j < cmds.length; j++) {
        var cmd = cmds[j];
        if (cmd.type === 'remove') { delete current[cmd.depth]; continue; }
        if (cmd.type !== 'place') continue;
        var prev = current[cmd.depth];
        var keep = cmd.move && prev && (cmd.id == null || cmd.id === prev.id);
        var st = keep
          ? { id: prev.id, matrix: prev.matrix, colorTransform: prev.colorTransform,
              name: prev.name, ratio: prev.ratio, clipDepth: prev.clipDepth,
              blend: prev.blend, clipActions: prev.clipActions,
              graphic: prev.graphic, firstFrame: prev.firstFrame, loopMode: prev.loopMode }
          : { id: cmd.id, matrix: IDENTITY, colorTransform: null, name: '', ratio: 0 };
        if (cmd.id != null) st.id = cmd.id;
        if (cmd.matrix) st.matrix = cmd.matrix;
        if (cmd.colorTransform) st.colorTransform = cmd.colorTransform;
        if (cmd.name) st.name = cmd.name;
        if (cmd.ratio != null) st.ratio = cmd.ratio;
        if (cmd.clipDepth != null) st.clipDepth = cmd.clipDepth;
        if (cmd.blendMode) st.blend = cmd.blendMode;
        if (cmd.clipActions && cmd.clipActions.length) st.clipActions = cmd.clipActions;
        /* A FLA says outright whether an instance is a graphic, and with
           which frame and loop mode — a SWF has thrown that away. */
        if (cmd.graphic) { st.graphic = true; st.firstFrame = cmd.firstFrame || 1; st.loopMode = cmd.loopMode || 'loop'; }
        if (st.id == null) continue;
        current[cmd.depth] = st;
      }
      var snap = {};
      for (var d in current) snap[d] = current[d];
      out.push(snap);
    }
    return out;
  }

  /** The numbers a tween interpolates, for deciding whether one exists. */
  function propsOf(objects) {
    var p = [];
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      p.push(o.x, o.y, o.scaleX, o.scaleY, o.rotation, o.alpha);
    }
    return p;
  }

  function propsClose(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      var eps = (i % 6 === 4) ? TWEEN_ANGLE_EPS : TWEEN_EPS;
      if (Math.abs(a[i] - b[i]) > eps) return false;
    }
    return true;
  }

  function lerpProps(a, b, t) {
    var out = [];
    for (var i = 0; i < a.length; i++) out.push(a[i] + (b[i] - a[i]) * t);
    return out;
  }

  /**
   * Build the layers of one timeline.
   *
   * `frames` is the parsed frame list, `labels` a map of frame number to
   * label. Returns `{ layers, totalFrames }` with the Actions layer first.
   */
  Converter.prototype.buildLayers = function (frames, labels, opts) {
    opts = opts || {};
    var self = this;
    var states = simulate(frames);
    var total = Math.max(1, frames.length);

    // Which depths are ever occupied, highest (frontmost) first.
    var depthSet = {};
    states.forEach(function (snap) { for (var d in snap) depthSet[d] = true; });
    var depths = Object.keys(depthSet).map(Number).sort(function (a, b) { return b - a; });

    var layerInfo = (this.model.timeline && this.model.timeline.layers) || null;
    var layers = [];

    /* A clip depth makes one placement the mask for everything between its
       own depth and that clip depth — Flash's mask layer, written as a
       range. Collect the ranges first so each layer knows which it is. */
    var maskRanges = [];
    states.forEach(function (snap) {
      for (var d in snap) {
        if (!snap[d].clipDepth) continue;
        var from = Number(d), to = snap[d].clipDepth;
        var known = maskRanges.some(function (r) { return r.from === from && r.to === to; });
        if (!known) maskRanges.push({ from: from, to: to });
      }
    });
    function layerTypeFor(depth) {
      for (var i = 0; i < maskRanges.length; i++) {
        if (depth === maskRanges[i].from) return 'mask';
      }
      for (var j = 0; j < maskRanges.length; j++) {
        if (depth > maskRanges[j].from && depth <= maskRanges[j].to) return 'masked';
      }
      return 'normal';
    }

    depths.forEach(function (depth, index) {
      var keyframes = self.depthKeyframes(depth, states, total);
      if (!keyframes.length) return;
      var meta = layerInfo && layerInfo[depth];
      var type = layerTypeFor(depth);
      layers.push({
        name: (meta && meta.name) || self.layerName(depth, states),
        visible: meta ? meta.visible !== false : true,
        locked: meta ? !!meta.locked : false,
        layerType: type,
        keyframes: keyframes
      });
      if (type === 'mask') self.stats.masks++;
      self.stats.keyframes += keyframes.length;
    });

    /* In the file a mask sits BELOW what it masks — a clip depth reaches
       upwards from it. In a layer stack it sits above, which is both how
       Flash showed it and how the renderers here find the run a mask
       applies to, so each mask layer is lifted over its own range. */
    layers = liftMasksAboveTheirRange(layers, maskRanges, depths);

    if (this.opts.coalesceLayers !== false) {
      layers = coalesceLayers(layers, this.opts.layerTarget);
    }


    var actions = this.actionsLayer(frames, labels, total, states, opts.initScripts,
      { root: opts.root });
    if (actions) layers.unshift(actions);

    if (!layers.length) {
      layers = [{ name: 'Layer 1', visible: true, locked: false, keyframes: [keyframe(1, { duration: total })] }];
    }
    this.stats.layers += layers.length;
    return { layers: layers, totalFrames: total };
  };

  /*
   * A publisher reuses depths freely, so a two-minute cartoon can arrive as
   * two hundred layers that are each occupied for four frames. Where two
   * layers that sit next to each other in z are never both occupied on the
   * same frame, they can share one layer without changing what is drawn in
   * front of what — which is how the author's handful of layers is
   * approximately recovered. Only adjacent layers are ever merged; skipping
   * one would reorder everything between them.
   */
  /**
   * When a layer is occupied, and by what — a span plus the box its drawing
   * covers. The box is what lets two layers that ARE on screen together
   * still share a slot: if their artwork never touches, nothing can be drawn
   * in front of anything.
   */
  function layerSpans(layer) {
    var spans = [];
    (layer.keyframes || []).forEach(function (kf) {
      if (!kf.objects || !kf.objects.length) return;
      var b = objectsBox(kf.objects);
      spans.push({
        s: kf.index, e: kf.index + Math.max(1, kf.duration) - 1,
        x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1
      });
    });
    return spans;
  }

  function objectsBox(objects) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      var w = Math.abs((o.width || 0) * (o.scaleX || 1));
      var h = Math.abs((o.height || 0) * (o.scaleY || 1));
      /* A rotated box is bounded by the circle through its corners; using
         that keeps this an over-estimate, which is the safe direction. */
      if (o.rotation) { var r = Math.hypot(w, h); w = r; h = r; }
      if (o.x < x0) x0 = o.x;
      if (o.y < y0) y0 = o.y;
      if (o.x + w > x1) x1 = o.x + w;
      if (o.y + h > y1) y1 = o.y + h;
    }
    if (x0 === Infinity) return { x0: 0, y0: 0, x1: 0, y1: 0 };
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  /** Do two sets of spans share a frame at all? */
  function spansOverlap(a, b) {
    for (var i = 0; i < a.length; i++) {
      for (var j = 0; j < b.length; j++) {
        if (a[i].s <= b[j].e && b[j].s <= a[i].e) return true;
      }
    }
    return false;
  }

  /** Do they share a frame AND touch on it? */
  function spansCollide(a, b) {
    for (var i = 0; i < a.length; i++) {
      for (var j = 0; j < b.length; j++) {
        var p = a[i], q = b[j];
        if (p.s > q.e || q.s > p.e) continue;
        if (p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1) return true;
      }
    }
    return false;
  }

  /* A layer holds one drawing at a time only if you insist it does — the
     editor's keyframes carry a LIST of objects, as Flash's layers do. So two
     depths that are on screen together can still share a layer: the spans
     are cut at every boundary and the incoming layer's objects are appended
     after the host's, which is exactly their original order (this runs
     bottom-up, so anything merged later was above anything merged earlier).
     Without that, a movie with twenty things on screen at once can never
     have fewer than twenty layers, however briefly each one appears. */
  var MAX_MERGED_KEYFRAMES = 600;

  function contentIntervals(keyframes) {
    var out = [];
    (keyframes || []).forEach(function (kf) {
      if (kf.objects && kf.objects.length) {
        out.push({ s: kf.index, e: kf.index + Math.max(1, kf.duration) - 1, kf: kf });
      }
    });
    return out;
  }

  function intervalAt(intervals, frame) {
    for (var i = 0; i < intervals.length; i++) {
      if (intervals[i].s <= frame && frame <= intervals[i].e) return intervals[i];
    }
    return null;
  }

  /**
   * Merge two layers' keyframes into one list: `below` first, `above`
   * appended, spans cut wherever either changes. Consecutive spans that end
   * up with the same objects are joined back up, so a long hold stays one
   * keyframe instead of becoming one per boundary.
   */
  function mergeKeyframes(below, above) {
    var A = contentIntervals(below), B = contentIntervals(above);
    if (!A.length) return above.slice();
    if (!B.length) return below.slice();

    var cuts = {};
    A.concat(B).forEach(function (iv) { cuts[iv.s] = true; cuts[iv.e + 1] = true; });
    var marks = Object.keys(cuts).map(Number).sort(function (x, y) { return x - y; });

    var out = [];
    for (var i = 0; i < marks.length - 1; i++) {
      var from = marks[i], to = marks[i + 1] - 1;
      if (to < from) continue;
      var ia = intervalAt(A, from), ib = intervalAt(B, from);
      var objects = (ia ? ia.kf.objects : []).concat(ib ? ib.kf.objects : []);
      var prev = out.length ? out[out.length - 1] : null;
      if (prev && sameObjects(prev.objects, objects) && prev.index + prev.duration === from) {
        prev.duration = to - prev.index + 1;
        continue;
      }
      var kf = keyframe(from, { duration: to - from + 1, objects: objects });
      /* A script or a sound belongs to the frame it was written on, so it
         only rides along when the span still starts there. */
      var src = (ia && ia.kf.index === from) ? ia.kf : (ib && ib.kf.index === from) ? ib.kf : null;
      if (src) {
        kf.script = src.script || '';
        kf.label = src.label || '';
        kf.sound = src.sound || null;
      }
      out.push(kf);
    }
    while (out.length && !out[out.length - 1].objects.length) out.pop();
    return out;
  }

  function sameObjects(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  /** A layer carrying a tween is left alone: merging would break the
      index-for-index pairing a motion tween interpolates through. */
  function hasTween(layer) {
    return (layer.keyframes || []).some(function (kf) {
      return kf.tweenType && kf.tweenType !== 'none';
    });
  }

  function isGenericName(name) {
    return /^(Depth|Shape|Sprite|Text|Edittext|Button|Morph|Bitmap|Missing) /.test(name);
  }

  /* How many layers an imported timeline may keep before depths that ARE on
     screen together start sharing one. Below this, separate layers are worth
     more than tidiness: each can be hidden, locked and dragged on its own.
     Above it, nobody is editing two hundred layers anyway. */
  var LAYER_TARGET = 12;

  /**
   * Pack depths into layers.
   *
   * Pass one merges depths that are never on screen at the same time — a
   * publisher cycles through depths, so this is pure recovery of slot reuse
   * and cannot change a single pixel. A depth may move past others in z to
   * reach a free slot, provided nothing in between touches it while both are
   * visible.
   *
   * Pass two runs only when a timeline is still unmanageably tall. It merges
   * neighbouring layers outright, letting one keyframe hold several objects
   * the way Flash's own layers do. Neighbours only, and the lower layer's
   * objects stay first, so the drawing order is exactly preserved.
   */
  function coalesceLayers(layers, target) {
    var out = [];                        // bottom-up; out[0] is the lowest
    var spans = [];
    var locked = [];
    for (var i = layers.length - 1; i >= 0; i--) {
      var layer = layers[i];
      var mine = layerSpans(layer);
      var type = layer.layerType || 'normal';
      /* A mask and the layers it masks are a group whose order IS the
         feature; packing them into other layers would dissolve it. */
      var tweened = hasTween(layer) || type === 'mask' || type === 'masked';
      var above = [];
      var host = -1;
      if (!tweened) {
        for (var h = out.length - 1; h >= 0; h--) {
          if (!locked[h] && !spansOverlap(spans[h], mine) && !spansCollide(above, mine) &&
              out[h].keyframes.length + layer.keyframes.length <= MAX_MERGED_KEYFRAMES) {
            host = h;
            break;
          }
          above = above.concat(spans[h]);
        }
      }
      if (host >= 0) {
        out[host].keyframes = mergeKeyframes(out[host].keyframes, layer.keyframes);
        spans[host] = spans[host].concat(mine);
        if (isGenericName(out[host].name) && !isGenericName(layer.name)) {
          out[host].name = layer.name;   // a real instance name beats a generated one
        }
      } else {
        out.push(layer);
        spans.push(mine);
        locked.push(tweened);
      }
    }
    out.reverse();                       // back to top-first
    locked.reverse();
    return packNeighbours(out, locked, target == null ? LAYER_TARGET : target);
  }

  function packNeighbours(layers, locked, target) {
    while (layers.length > target) {
      var best = -1, bestCost = Infinity;
      for (var i = 0; i + 1 < layers.length; i++) {
        if (locked[i] || locked[i + 1]) continue;
        var cost = layers[i].keyframes.length + layers[i + 1].keyframes.length;
        if (cost > MAX_MERGED_KEYFRAMES) continue;
        if (cost < bestCost) { bestCost = cost; best = i; }
      }
      if (best < 0) break;               // nothing left that can be merged
      /* layers[best] is above layers[best + 1], so the LOWER one's objects
         go first and the upper one's after it. */
      var merged = {
        name: isGenericName(layers[best].name) ? layers[best + 1].name : layers[best].name,
        visible: layers[best].visible !== false && layers[best + 1].visible !== false,
        locked: false,
        keyframes: mergeKeyframes(layers[best + 1].keyframes, layers[best].keyframes)
      };
      layers.splice(best, 2, merged);
      locked.splice(best, 2, false);
    }
    return layers;
  }

  /**
   * Move each mask layer directly above the layers it masks.
   *
   * `layers` is top-first (descending depth) and `depths` matches it, so a
   * mask's range is a contiguous block immediately before it. Lifting it to
   * the front of that block turns a clip depth into Flash's own layer
   * arrangement without changing what covers what.
   */
  function liftMasksAboveTheirRange(layers, maskRanges, depths) {
    if (!maskRanges.length) return layers;
    var byDepth = {};
    for (var i = 0; i < layers.length; i++) byDepth[depths[i]] = layers[i];
    var out = layers.slice();
    maskRanges.forEach(function (range) {
      var mask = byDepth[range.from];
      if (!mask) return;
      var at = out.indexOf(mask);
      if (at < 0) return;
      /* The topmost layer this mask covers: depths descend, so it is the
         earliest index whose depth is inside the range. */
      var target = -1;
      for (var j = 0; j < out.length; j++) {
        var d = depths[layers.indexOf(out[j])];
        if (d > range.from && d <= range.to) { target = j; break; }
      }
      if (target < 0 || target > at) return;    // nothing above it to mask
      out.splice(at, 1);
      out.splice(target, 0, mask);
    });
    return out;
  }

  /** Name a layer after whatever was on it, the way an author would. */
  Converter.prototype.layerName = function (depth, states) {
    var fallback = null;
    var isMask = false;
    for (var i = 0; i < states.length; i++) {
      var st = states[i][depth];
      if (!st) continue;
      if (st.clipDepth) isMask = true;
      var c = this.character(st.id);
      var named = st.name ||
        (c && (c.exportName || c.className) ? (c.exportName || c.className).replace(/^.*[.:]/, '') : null);
      if (named) return isMask ? named + ' (mask)' : named;
      /* Nothing in the file names this depth, so name it after whatever is
         on it — "Shape 356" beats "Depth 42" when looking for something. */
      if (!fallback && c) fallback = c.kind.charAt(0).toUpperCase() + c.kind.slice(1) + ' ' + c.id;
    }
    var name = fallback || ('Depth ' + depth);
    return isMask ? name + ' (mask)' : name;
  };

  /** One depth across the whole timeline, as keyframes (and tweens). */
  Converter.prototype.depthKeyframes = function (depth, states, total) {
    var self = this;
    var keyframes = [];
    var frame = 0;

    while (frame < total) {
      var st = states[frame] ? states[frame][depth] : null;
      if (!st) {
        /* An empty stretch is a blank keyframe, so the gap is visible in the
           timeline instead of the previous drawing appearing to persist. */
        var blankStart = frame;
        while (frame < total && !(states[frame] && states[frame][depth])) frame++;
        if (keyframes.length) {
          keyframes.push(keyframe(blankStart + 1, { duration: frame - blankStart }));
        }
        continue;
      }
      // A run is one character staying on this depth.
      var runStart = frame;
      var id = st.id;
      var perFrame = [];
      while (frame < total) {
        var s = states[frame] ? states[frame][depth] : null;
        if (!s || s.id !== id) break;
        perFrame.push(s);
        frame++;
      }
      // Objects (and the numbers a tween would interpolate) per frame.
      var built = perFrame.map(function (s) { return self.objectsForPlacement(s); });
      var props = built.map(propsOf);

      var i = 0;
      while (i < built.length) {
        /* Extend while every frame in between sits on the straight line
           between the ends — that is exactly what a published tween looks
           like once it has been baked out to one placement per frame. */
        var end = i;
        for (var cand = i + 1; cand < built.length; cand++) {
          var ok = true;
          for (var k = i + 1; k < cand; k++) {
            if (!propsClose(props[k], lerpProps(props[i], props[cand], (k - i) / (cand - i)))) { ok = false; break; }
          }
          if (!ok) break;
          end = cand;
        }
        var startFrame = runStart + i + 1;
        if (end === i) {
          keyframes.push(keyframe(startFrame, { duration: 1, objects: built[i] }));
          i++;
        } else if (propsClose(props[i], props[end])) {
          /* Nothing moved: one keyframe held for the whole stretch. */
          keyframes.push(keyframe(startFrame, { duration: end - i + 1, objects: built[i] }));
          i = end + 1;
        } else {
          /* A tween interpolates towards the *next* keyframe, so the one at
             `end` is left for the next pass to emit. */
          keyframes.push(keyframe(startFrame, {
            duration: end - i, objects: built[i], tweenType: 'motion'
          }));
          self.stats.tweens++;
          i = end;
        }
      }
    }
    // Trailing blank keyframes carry nothing; drop them.
    while (keyframes.length && !keyframes[keyframes.length - 1].objects.length) keyframes.pop();
    return keyframes;
  };

  /** Frame scripts, labels and sounds, on their own layer as in Flash. */
  /** Text that is for reading, not running. */
  function commentBlock(text) {
    return String(text).split('\n').map(function (l) { return '// ' + l; }).join('\n');
  }

  /** Record that a script landed on `frame` of whatever is being built. */
  Converter.prototype.note = function (frame, kind) {
    /* Count every one, but only keep the first few hundred locations: the
       counts are what the report says, the list is only for naming examples.
       (Capping the count as well is how "95 scripts on the main timeline"
       became "0" — they are recorded last, after the symbols have filled
       the list.) */
    if (this.context === 'Scene') this.scriptsOnStage++;
    else this.scriptsInSymbols++;
    if (this.scriptIndex.length > 500) return;
    this.scriptIndex.push({ where: this.context, frame: frame, kind: kind });
  };

  Converter.prototype.actionsLayer = function (frames, labels, total, states, initScripts, opts) {
    opts = opts || {};
    var self = this;
    var entries = {};                  // frame → { script:[], sound }
    function at(f) {
      if (!entries[f]) entries[f] = { script: [], sound: null, label: '' };
      return entries[f];
    }

    /* ActionScript 3 lives in the movie, not on its frames — except for the
       frame scripts the compiler registers with addFrameScript, which the
       ABC reader recovers. Those land on the frames they were written on;
       the class outline goes on frame 1, because an imported movie should
       say what its code was even when the bodies are beyond this reader. */
    if (opts.root && this.model.as3FrameScripts) {
      for (var af in this.model.as3FrameScripts) {
        at(parseInt(af, 10)).script.push(this.model.as3FrameScripts[af]);
        this.stats.scripts++;
        this.note(parseInt(af, 10), 'as3');
      }
    }
    if (opts.root && this.model.abc && this.model.abc.length) {
      var classCount = 0, outlines = [];
      for (var ab = 0; ab < this.model.abc.length; ab++) {
        classCount += this.model.abc[ab].classes || 0;
        if (this.model.abc[ab].outline) outlines.push(this.model.abc[ab].outline);
      }
      if (outlines.length) {
        at(1).script.push('/* ActionScript 3. The bodies run on a virtual machine \n' +
          '   Flashy does not have, so they are not executable here. This is an \n' +
          '   outline of the ' + classCount + ' class' + (classCount === 1 ? '' : 'es') +
          ' the movie defined, \n   kept so the code is not simply lost. */\n' +
          commentBlock(outlines.join('\n\n')));
        this.stats.scripts++;
        this.note(1, 'as3-outline');
      }
    }

    if (initScripts && initScripts.length) {
      at(1).script.push('/* Imported from DoInitAction — ran once when this ' +
        'symbol was first used. */\n' + initScripts.join('\n'));
      this.stats.scripts++;
      this.note(1, 'init');
    }
    for (var f in labels || {}) {
      at(parseInt(f, 10)).label = labels[f];
    }
    frames.forEach(function (frame, i) {
      var n = i + 1;
      (frame.actions || []).forEach(function (src) {
        if (!src) return;
        at(n).script.push(src);
        self.stats.scripts++;
        self.note(n, 'frame');
      });
      (frame.sounds || []).forEach(function (s) {
        if (s.id == null) return;
        var asset = self.soundAsset(s.id);
        if (!asset) return;
        var e = at(n);
        if (e.sound) return;           // one sound per keyframe in this model
        e.sound = {
          asset: asset, sync: 'event',
          volume: 1, loop: !!(s.info && s.info.loops > 1), offset: 0
        };
      });
    });
    var marks = Object.keys(entries).map(Number).sort(function (a, b) { return a - b; });
    if (!marks.length) return null;

    var keyframes = [];
    if (marks[0] !== 1) keyframes.push(keyframe(1, { duration: marks[0] - 1 }));
    marks.forEach(function (m, i) {
      var next = i + 1 < marks.length ? marks[i + 1] : total + 1;
      var e = entries[m];
      keyframes.push(keyframe(m, {
        duration: Math.max(1, next - m),
        script: e.script.join('\n'),
        label: e.label || '',
        sound: e.sound
      }));
    });
    this.stats.keyframes += keyframes.length;
    return { name: 'Actions', visible: true, locked: false, keyframes: keyframes };
  };

  // ---- entry point ----------------------------------------------------
  var CANVAS_BLENDS = {
    normal: 'source-over', multiply: 'multiply', screen: 'screen',
    lighten: 'lighten', darken: 'darken', difference: 'difference',
    add: 'lighter', overlay: 'overlay', hardlight: 'hard-light'
  };
  function canvasBlend(mode) { return CANVAS_BLENDS[mode] || 'source-over'; }

  Converter.prototype.run = function () {
    this.countUsage();
    var root = this.buildLayers(this.model.timeline.frames, this.model.timeline.labels,
      { root: true });
    /* Symbol entries carry a cached size for the instance maths; it is not
       part of the document format. */
    for (var name in this.library) delete this.library[name]._size;

    var doc = {
      width: Math.max(1, Math.round(this.model.width || 550)),
      height: Math.max(1, Math.round(this.model.height || 400)),
      fps: Math.max(1, Math.round(this.model.fps || 24)),
      backgroundColor: hexColor(this.model.backgroundColor != null ? this.model.backgroundColor : 0xffffff),
      totalFrames: Math.max(root.totalFrames, 1),
      /* These scripts are ActionScript, so the player has to run them with
         AS2's scope — `_root`, `_parent`, timeline variables — rather than
         as the plain JavaScript the editor's own scripts are. */
      scriptDialect: 'as2',
      layers: root.layers,
      library: this.library,
      sounds: this.sounds,
      bitmaps: this.bitmaps
    };
    if (this.model.hasAS3) {
      var n3 = (this.model.abc || []).reduce(function (a, b) { return a + (b.classes || 0); }, 0);
      this.warn('as3', 'This movie is ActionScript 3. Its ' + n3 + ' classes are outlined on ' +
        'the Actions layer and its frame scripts were recovered, but AS3 method bodies ' +
        'are only partly readable and none of it runs here.');
    }
    return {
      doc: doc,
      report: {
        source: this.model.source || 'swf',
        as3: !!this.model.hasAS3,
        as3Classes: (this.model.abc || []).reduce(function (n, b) { return n + (b.classes || 0); }, 0),
        stage: doc.width + '×' + doc.height + ' @ ' + doc.fps + 'fps',
        frames: doc.totalFrames,
        layers: this.stats.layers,
        keyframes: this.stats.keyframes,
        objects: this.stats.objects,
        shapes: this.stats.shapes,
        symbols: this.stats.symbols,
        tweens: this.stats.tweens,
        texts: this.stats.texts,
        gradients: this.stats.gradients,
        handlers: this.stats.handlers,
        masks: this.stats.masks,
        scripts: this.stats.scripts,
        scriptsOnStage: this.scriptsOnStage,
        scriptsInSymbols: this.scriptsInSymbols,
        scriptLocations: this.scriptIndex,
        sounds: this.stats.sounds,
        bitmaps: this.stats.bitmaps,
        warnings: this.warnings
      }
    };
  };

  /** Convert a parsed SWF/XFL document model into an editor document. */
  function toDocument(model, opts) {
    if (!model || !model.timeline) throw new Error('Not a parsed Flash document');
    return new Converter(model, opts).run();
  }

  global.FlashyImport = {
    toDocument: toDocument,
    Converter: Converter,
    placeFields: placeFields,
    pathBounds: pathBounds,
    base64: base64,
    hexColor: hexColor
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.FlashyImport;
})(typeof window !== 'undefined' ? window : globalThis);
