/* flashy-swf-write.js — write a .swf
 *
 * Flashy has read `.swf` and `.fla` since early on and could not write either,
 * which made the import a one-way door: a movie could come in and never go
 * back out. This closes that loop.
 *
 * WHAT IT WRITES
 *   SWF 6, uncompressed (FWS), with SetBackgroundColor, DefineShape3 for the
 *   artwork, DefineSprite for symbols, PlaceObject2 with a matrix and a colour
 *   transform, FrameLabel, ShowFrame and End. Solid and gradient fills, and
 *   strokes with real caps and joins.
 *
 * WHAT IT DOES NOT
 *   Text, bitmaps, sounds, filters and scripts. Each needs a whole subsystem
 *   of its own — glyph tables, JPEG/zlib encoding, MP3 framing, filter tags,
 *   an ActionScript assembler — and the writer REPORTS what it left out rather
 *   than producing a file that silently lost half the movie. That report is
 *   the feature: a quiet omission in an export is the worst kind.
 *
 * WHY IT MIRRORS THE READER
 *   flashy-swf.js already parses all of this, so the structures here are
 *   written to match what it reads. That makes the reader this writer's test
 *   oracle: write a movie, read it back, compare. Two independent
 *   interpretations of the same spec would have no such check.
 *
 * COORDINATES
 *   SWF measures in twips — one twentieth of a pixel — and every rectangle,
 *   matrix translation and edge below is converted. Getting this wrong is the
 *   classic SWF bug: the file parses, and everything is twenty times too big.
 */
(function (global) {
  'use strict';

  var TWIPS = 20;

  var TAG = {
    End: 0, ShowFrame: 1, SetBackgroundColor: 9, DefineShape3: 32,
    PlaceObject2: 26, RemoveObject2: 28, DefineSprite: 39, FrameLabel: 43,
    FileAttributes: 69
  };

  /* ------------------------------------------------------------------ *
   * The writer
   *
   * Bit-level, because SWF packs shape records, style-index widths and
   * rectangles into bit fields that do not sit on byte boundaries. Every
   * byte-level write aligns first; forgetting that is how a file ends up one
   * bit out and unreadable from that point on.
   * ------------------------------------------------------------------ */
  function Writer() {
    this.bytes = [];
    this.bitBuf = 0;
    this.bitPos = 0;
  }

  Writer.prototype.align = function () {
    if (this.bitPos > 0) {
      /* Shifted LEFT into the high bits of the byte. `bitBuf` accumulates
         bits in its low end, so pushing it as-is leaves a partial final byte
         right-aligned — the real bits in the low half and zero padding in the
         high half, which is the wrong way round. Every bit field that did not
         happen to end on a byte boundary came out shifted, and the symptom
         was a value read back as an unrelated number: an object at 40%
         opacity arriving as 28%. */
      this.bytes.push((this.bitBuf << (8 - this.bitPos)) & 0xff);
      this.bitBuf = 0;
      this.bitPos = 0;
    }
    return this;
  };

  /** `n` unsigned bits, most significant first. */
  Writer.prototype.ub = function (n, value) {
    value = value >>> 0;
    for (var i = n - 1; i >= 0; i--) {
      var bit = (value >>> i) & 1;
      this.bitBuf = (this.bitBuf << 1) | bit;
      this.bitPos++;
      if (this.bitPos === 8) {
        this.bytes.push(this.bitBuf & 0xff);
        this.bitBuf = 0;
        this.bitPos = 0;
      }
    }
    return this;
  };

  /** `n` two's-complement bits. */
  Writer.prototype.sb = function (n, value) {
    var v = Math.round(value) | 0;
    if (v < 0) v = v + (1 << n);
    return this.ub(n, v);
  };

  /** How many bits a signed value needs, including its sign bit. */
  Writer.bitsFor = function (value) {
    var v = Math.round(value) | 0;
    if (v === 0) return 1;
    // Two's complement: -8 fits in 4 bits, 8 does not.
    var n = v < 0 ? ~v : v;
    var bits = 1;
    while (n > 0) { bits++; n >>= 1; }
    return bits;
  };

  Writer.prototype.u8 = function (v) {
    this.align();
    this.bytes.push(v & 0xff);
    return this;
  };
  Writer.prototype.u16 = function (v) {
    this.align();
    this.bytes.push(v & 0xff, (v >> 8) & 0xff);
    return this;
  };
  Writer.prototype.i16 = function (v) { return this.u16(v < 0 ? v + 0x10000 : v); };
  Writer.prototype.u32 = function (v) {
    this.align();
    this.bytes.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
    return this;
  };
  /** A signed 16.16 fixed-point number, as a matrix scale uses. */
  Writer.prototype.fixed = function (v) {
    return this.u32(Math.round(v * 65536));
  };
  /** A signed 8.8, as a stroke miter limit uses. */
  Writer.prototype.fixed8 = function (v) {
    return this.u16(Math.round(v * 256));
  };
  Writer.prototype.bytesOf = function (arr) {
    this.align();
    for (var i = 0; i < arr.length; i++) this.bytes.push(arr[i] & 0xff);
    return this;
  };
  Writer.prototype.string = function (s) {
    this.align();
    // SWF 6 and later are UTF-8, NUL-terminated.
    var enc = unescape(encodeURIComponent(String(s == null ? '' : s)));
    for (var i = 0; i < enc.length; i++) this.bytes.push(enc.charCodeAt(i) & 0xff);
    this.bytes.push(0);
    return this;
  };

  Writer.prototype.rgb = function (hex) {
    var c = colorOf(hex);
    return this.u8(c.r).u8(c.g).u8(c.b);
  };
  Writer.prototype.rgba = function (hex, alpha) {
    var c = colorOf(hex);
    var a = alpha == null ? 1 : Math.max(0, Math.min(1, alpha));
    return this.u8(c.r).u8(c.g).u8(c.b).u8(Math.round(a * 255));
  };

  /** A RECT, in twips. The field width is whatever the largest value needs. */
  Writer.prototype.rect = function (x0, y0, x1, y1) {
    var vals = [x0, y0, x1, y1].map(function (v) { return Math.round(v * TWIPS); });
    var bits = 1;
    for (var i = 0; i < 4; i++) bits = Math.max(bits, Writer.bitsFor(vals[i]));
    this.align();
    this.ub(5, bits);
    this.sb(bits, vals[0]).sb(bits, vals[2]).sb(bits, vals[1]).sb(bits, vals[3]);
    return this.align();
  };

  /**
   * A MATRIX.
   *
   * SWF's rotate fields are the off-diagonal terms of the 2x2, so a rotation
   * has to be written as its sine and cosine rather than as an angle —
   * which also means a skew comes out of the same four numbers for free.
   */
  Writer.prototype.matrix = function (m) {
    this.align();
    var a = m.a == null ? 1 : m.a, b = m.b || 0;
    var c = m.c || 0, d = m.d == null ? 1 : m.d;
    var hasScale = (a !== 1 || d !== 1);
    var hasRotate = (b !== 0 || c !== 0);
    this.ub(1, hasScale ? 1 : 0);
    if (hasScale) {
      this.ub(5, 20);
      this.sb(20, Math.round(a * 65536));
      this.sb(20, Math.round(d * 65536));
    }
    this.ub(1, hasRotate ? 1 : 0);
    if (hasRotate) {
      this.ub(5, 20);
      this.sb(20, Math.round(b * 65536));
      this.sb(20, Math.round(c * 65536));
    }
    var tx = Math.round((m.tx || 0) * TWIPS);
    var ty = Math.round((m.ty || 0) * TWIPS);
    var tb = Math.max(Writer.bitsFor(tx), Writer.bitsFor(ty));
    this.ub(5, tb);
    this.sb(tb, tx).sb(tb, ty);
    return this.align();
  };

  /**
   * A CXFORMWITHALPHA — multiply terms only, which is all alpha needs.
   *
   * The terms are 8.8 fixed point, so 1.0 is 256 — which does NOT fit in an
   * 8-bit signed field, whatever the name of the format suggests. Written
   * into 8 bits, the red, green and blue multipliers all came back as zero
   * and the alpha came back as a fraction of what it should be: an object at
   * 40% opacity read as 28% black. Ten bits is the smallest field that holds
   * the value.
   */
  Writer.prototype.cxform = function (alpha) {
    this.align();
    this.ub(1, 0);                 // no add terms
    this.ub(1, 1);                 // has multiply terms
    this.ub(4, 10);
    var a = Math.round(Math.max(0, Math.min(1, alpha)) * 256);
    this.sb(10, 256).sb(10, 256).sb(10, 256).sb(10, a);
    return this.align();
  };

  /**
   * One tag, with the long form chosen automatically.
   *
   * The short header carries its length in six bits, so anything 63 bytes or
   * longer needs the long form. Writing a short header for a 64-byte tag
   * truncates it and every tag after it is read from the wrong offset.
   */
  function tag(code, body) {
    var w = new Writer();
    var len = body.length;
    if (len < 0x3f) {
      w.u16((code << 6) | len);
    } else {
      w.u16((code << 6) | 0x3f);
      w.u32(len);
    }
    w.bytesOf(body);
    return w.bytes;
  }

  function colorOf(hex) {
    if (typeof hex === 'number') {
      return { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff };
    }
    var s = String(hex == null ? '#000000' : hex).replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16);
    if (!isFinite(n)) n = 0;
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
  }

  /* ------------------------------------------------------------------ *
   * Shapes
   *
   * An object's outline, in its own centre-origin space, as SWF shape
   * records. Centre-origin because the PlaceObject matrix below puts the
   * centre where the object is — the same convention the canvas painter uses,
   * so a rotation turns about the same point in both.
   * ------------------------------------------------------------------ */

  /** The loops of an object, in centre-origin local coordinates. */
  function localLoops(o) {
    var w = Math.abs(o.width || 0), h = Math.abs(o.height || 0);
    var hw = w / 2, hh = h / 2;
    /* A parameterised primitive — a rounded rectangle, or an oval arc, pie or
       donut — comes from Flashy.Primitives, the same geometry the stage and
       every other export use. Its command stream is in box coordinates, so
       handing it back through the 'path' branch with pathW/pathH set to the box
       leaves the scale at 1 and reuses one loop walker. */
    if (window.Flashy && Flashy.Primitives && Flashy.Primitives.active(o)) {
      var prim = Flashy.Primitives.path(o);
      if (prim && prim.length) {
        var pobj = {};
        for (var pk in o) if (Object.prototype.hasOwnProperty.call(o, pk)) pobj[pk] = o[pk];
        pobj.type = 'path'; pobj.path = prim; pobj.pathW = w; pobj.pathH = h;
        return localLoops(pobj);
      }
    }
    if (o.type === 'rect') {
      return [{ closed: true, pts: [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]] }];
    }
    if (o.type === 'oval') {
      /* Four quadratics, with the control points on the corners of the
         bounding box. A SWF curved edge IS a quadratic, so an oval needs no
         flattening at all — it stays a curve in the file and stays smooth at
         any zoom. */
      return [{
        closed: true, quad: true,
        pts: [
          [0, -hh], [hw, -hh], [hw, 0],
          [hw, hh], [0, hh],
          [-hw, hh], [-hw, 0],
          [-hw, -hh], [0, -hh]
        ]
      }];
    }
    if (o.type === 'line') {
      return [{ closed: false, pts: [[-hw, -hh], [hw, hh]] }];
    }
    if ((o.type === 'pencil' || o.type === 'brush') && o.points && o.points.length >= 4) {
      var pts = [];
      for (var i = 0; i < o.points.length; i += 2) {
        pts.push([o.points[i] - hw, o.points[i + 1] - hh]);
      }
      return [{ closed: false, pts: pts }];
    }
    if (o.type === 'path' && o.path && o.path.length) {
      var psx = o.pathW ? (w / o.pathW) : 1;
      var psy = o.pathH ? (h / o.pathH) : 1;
      var X = function (v) { return v * psx - hw; };
      var Y = function (v) { return v * psy - hh; };
      var loops = [], cur = null;
      var k = 0;
      while (k < o.path.length) {
        var cmd = o.path[k];
        if (cmd === 0) {
          if (cur && cur.segs.length) loops.push(cur);
          cur = { closed: false, start: [X(o.path[k + 1]), Y(o.path[k + 2])], segs: [] };
          k += 3;
        } else if (cmd === 1) {
          if (cur) cur.segs.push({ to: [X(o.path[k + 1]), Y(o.path[k + 2])] });
          k += 3;
        } else if (cmd === 2) {
          if (cur) {
            cur.segs.push({
              ctrl: [X(o.path[k + 1]), Y(o.path[k + 2])],
              to: [X(o.path[k + 3]), Y(o.path[k + 4])]
            });
          }
          k += 5;
        } else {
          if (cur) cur.closed = true;
          k += 1;
        }
      }
      if (cur && cur.segs.length) loops.push(cur);
      return loops;
    }
    return [];
  }

  /** Normalise either loop form into {start, segs, closed}. */
  function loopSegs(loop) {
    if (loop.segs) return loop;
    var pts = loop.pts || [];
    if (!pts.length) return { start: [0, 0], segs: [], closed: false };
    var segs = [];
    if (loop.quad) {
      // Pairs of (control, end) after the first point.
      for (var i = 1; i + 1 < pts.length; i += 2) {
        segs.push({ ctrl: pts[i], to: pts[i + 1] });
      }
    } else {
      for (var j = 1; j < pts.length; j++) segs.push({ to: pts[j] });
    }
    return { start: pts[0], segs: segs, closed: !!loop.closed };
  }

  /**
   * One DefineShape3 body for an object.
   *
   * Returns null when the object has no outline this writer can express, so
   * the caller can count it as skipped rather than emit an empty shape.
   */
  function shapeBody(id, o, report) {
    var loops = localLoops(o).map(loopSegs).filter(function (l) { return l.segs.length; });
    if (!loops.length) return null;

    var w = Math.abs(o.width || 0), h = Math.abs(o.height || 0);
    var hw = w / 2, hh = h / 2;
    var filled = (o.fillType || 'solid') !== 'none' && o.type !== 'pencil' &&
                 o.type !== 'line' && o.type !== 'brush';
    var stroked = (o.strokeWidth || 0) > 0 && (o.strokeStyle || 'solid') !== 'none';
    // A brush stroke is painted at three times its stroke width and its colour
    // lives in fillColor, exactly as the canvas painter draws it.
    if (o.type === 'brush') { stroked = true; }
    if (!filled && !stroked) return null;

    var w2 = new Writer();
    w2.u16(id);
    /* The bounds, padded by half the stroke: a SWF player clips to this
       rectangle, so a shape whose outline sticks out of its own bounds loses
       the outline. */
    var pad = stroked ? ((o.type === 'brush' ? (o.strokeWidth || 1) * 3 : (o.strokeWidth || 1)) / 2 + 1) : 0;
    w2.rect(-hw - pad, -hh - pad, hw + pad, hh + pad);

    // ---- fill styles
    var fills = [];
    if (filled) fills.push(o);
    w2.u8(fills.length);
    fills.forEach(function (f) {
      var type = f.fillType;
      if (type === 'linear' || type === 'radial') {
        w2.u8(type === 'linear' ? 0x10 : 0x12);
        /* A gradient's own matrix maps the standard 32768-twip square onto the
           shape. Without it every gradient comes out as a 1638px band in the
           middle of the stage, which is the other classic SWF bug. */
        var g = (f.fillGrad && f.fillGrad.length >= 4) ? f.fillGrad : [0, 0, 1, 0];
        var gx0 = -hw + g[0] * w, gy0 = -hh + g[1] * h;
        var gx1 = -hw + g[2] * w, gy1 = -hh + g[3] * h;
        var dx = gx1 - gx0, dy = gy1 - gy0;
        var len = Math.hypot(dx, dy) || 1;
        var scale = len / 1638.4;                 // 32768 twips = 1638.4 px
        var cos = dx / len, sin = dy / len;
        w2.matrix({
          a: cos * scale, b: sin * scale,
          c: -sin * scale, d: cos * scale,
          tx: (gx0 + gx1) / 2, ty: (gy0 + gy1) / 2
        });
        var stops = f.fillStops || [0, 0x000000, 1, 1, 0xffffff, 1];
        var count = Math.min(15, Math.floor(stops.length / 3));
        w2.align();
        w2.ub(2, 0);             // spread: pad
        w2.ub(2, 0);             // interpolation: RGB
        w2.ub(4, count);
        for (var si = 0; si < count; si++) {
          var ratio = Math.max(0, Math.min(1, stops[si * 3]));
          w2.u8(Math.round(ratio * 255));
          w2.rgba(stops[si * 3 + 1], stops[si * 3 + 2] == null ? 1 : stops[si * 3 + 2]);
        }
      } else {
        w2.u8(0x00);
        w2.rgba(f.fillColor, f.fillAlpha == null ? 1 : f.fillAlpha);
      }
    });

    // ---- line styles
    var lines = [];
    if (stroked) lines.push(o);
    w2.u8(lines.length);
    lines.forEach(function (l) {
      var width = l.type === 'brush' ? (l.strokeWidth || 1) * 3 : (l.strokeWidth || 1);
      w2.u16(Math.max(1, Math.round(width * TWIPS)));
      w2.rgba(l.type === 'brush' ? l.fillColor : l.strokeColor,
              (l.type === 'brush' ? l.fillAlpha : l.strokeAlpha) == null
                ? 1 : (l.type === 'brush' ? l.fillAlpha : l.strokeAlpha));
    });

    // ---- shape records
    var nFillBits = fills.length ? bitsForIndex(fills.length) : 0;
    var nLineBits = lines.length ? bitsForIndex(lines.length) : 0;
    w2.align();
    w2.ub(4, nFillBits);
    w2.ub(4, nLineBits);

    var first = true;
    loops.forEach(function (loop) {
      // StyleChangeRecord: move to the start, and on the first one name the
      // styles. fillStyle1 is the fill to the edge's LEFT, which is the side a
      // clockwise loop encloses.
      var moveBits = Math.max(
        Writer.bitsFor(Math.round(loop.start[0] * TWIPS)),
        Writer.bitsFor(Math.round(loop.start[1] * TWIPS))
      );
      w2.ub(1, 0);
      var flags = 0x01 | (first ? ((nFillBits ? 0x04 : 0) | (nLineBits ? 0x08 : 0)) : 0);
      w2.ub(5, flags);
      w2.ub(5, moveBits);
      w2.sb(moveBits, Math.round(loop.start[0] * TWIPS));
      w2.sb(moveBits, Math.round(loop.start[1] * TWIPS));
      if (first && nFillBits) w2.ub(nFillBits, fills.length ? 1 : 0);
      if (first && nLineBits) w2.ub(nLineBits, lines.length ? 1 : 0);
      first = false;

      var cx = loop.start[0], cy = loop.start[1];
      var emitStraight = function (to) {
        var dx = Math.round(to[0] * TWIPS) - Math.round(cx * TWIPS);
        var dy = Math.round(to[1] * TWIPS) - Math.round(cy * TWIPS);
        if (dx === 0 && dy === 0) return;            // a zero-length edge is noise
        var bits = Math.max(2, Writer.bitsFor(dx), Writer.bitsFor(dy));
        w2.ub(1, 1);                                 // edge record
        w2.ub(1, 1);                                 // straight
        w2.ub(4, bits - 2);
        if (dx !== 0 && dy !== 0) {
          w2.ub(1, 1);                               // general line
          w2.sb(bits, dx).sb(bits, dy);
        } else if (dx !== 0) {
          w2.ub(1, 0).ub(1, 0);                      // horizontal
          w2.sb(bits, dx);
        } else {
          w2.ub(1, 0).ub(1, 1);                      // vertical
          w2.sb(bits, dy);
        }
        cx = to[0]; cy = to[1];
      };
      var emitCurve = function (ctrl, to) {
        var cdx = Math.round(ctrl[0] * TWIPS) - Math.round(cx * TWIPS);
        var cdy = Math.round(ctrl[1] * TWIPS) - Math.round(cy * TWIPS);
        var adx = Math.round(to[0] * TWIPS) - Math.round(ctrl[0] * TWIPS);
        var ady = Math.round(to[1] * TWIPS) - Math.round(ctrl[1] * TWIPS);
        var bits = Math.max(2, Writer.bitsFor(cdx), Writer.bitsFor(cdy),
                            Writer.bitsFor(adx), Writer.bitsFor(ady));
        w2.ub(1, 1);                                 // edge record
        w2.ub(1, 0);                                 // curved
        w2.ub(4, bits - 2);
        w2.sb(bits, cdx).sb(bits, cdy).sb(bits, adx).sb(bits, ady);
        cx = to[0]; cy = to[1];
      };

      loop.segs.forEach(function (seg) {
        if (seg.ctrl) emitCurve(seg.ctrl, seg.to);
        else emitStraight(seg.to);
      });
      if (loop.closed) emitStraight(loop.start);
    });

    w2.ub(1, 0).ub(5, 0);                            // EndShapeRecord
    w2.align();
    if (report) report.shapes++;
    return w2.bytes;
  }

  /** Style indices are 1-based, so n styles need enough bits for n. */
  function bitsForIndex(n) {
    var bits = 1, v = n;
    while (v > 1) { bits++; v >>= 1; }
    return Math.max(1, bits);
  }

  /** An object's placement matrix: the painter's convention, as a 2x2 + move. */
  function placeMatrix(o) {
    var hw = (o.width || 0) / 2, hh = (o.height || 0) / 2;
    var rot = (o.rotation || 0) * Math.PI / 180;
    var cos = Math.cos(rot), sin = Math.sin(rot);
    var sx = o.scaleX == null ? 1 : o.scaleX;
    var sy = o.scaleY == null ? 1 : o.scaleY;
    var skx = Math.tan((o.skewX || 0) * Math.PI / 180);
    var sky = Math.tan((o.skewY || 0) * Math.PI / 180);
    /* rotate * skew * scale, in that order — the same order the canvas
       painter and the engine apply them, so a skewed and rotated object lands
       in the same place in a SWF as it does on the stage. */
    var m00 = 1, m01 = sky, m10 = skx, m11 = 1;
    var s00 = m00 * sx, s01 = m01 * sx, s10 = m10 * sy, s11 = m11 * sy;
    return {
      a: cos * s00 - sin * s01,
      b: sin * s00 + cos * s01,
      c: cos * s10 - sin * s11,
      d: sin * s10 + cos * s11,
      tx: (o.x || 0) + hw,
      ty: (o.y || 0) + hh
    };
  }

  function placeBody(depth, charId, o, isNew) {
    var w = new Writer();
    w.align();
    var hasCx = (o.alpha != null && o.alpha < 1);
    // PlaceFlag bits, LSB first in the byte: Move, HasCharacter, HasMatrix,
    // HasColorTransform, HasRatio, HasName, HasClipDepth, HasClipActions.
    var flags = 0;
    if (!isNew) flags |= 0x01;                 // move
    if (charId != null) flags |= 0x02;
    flags |= 0x04;                             // always a matrix
    if (hasCx) flags |= 0x08;
    w.u8(flags);
    w.u16(depth);
    if (charId != null) w.u16(charId);
    w.matrix(placeMatrix(o));
    if (hasCx) w.cxform(o.alpha);
    return w.bytes;
  }

  /* ------------------------------------------------------------------ *
   * The movie
   * ------------------------------------------------------------------ */

  /**
   * Write a Flashy document as a SWF.
   *
   * `doc` is the shape serializeDoc() produces. Returns
   * `{bytes, report}` — the report says what was written and, more
   * importantly, what was left out.
   */
  function write(doc, opts) {
    opts = opts || {};
    var report = {
      shapes: 0, sprites: 0, frames: 0, placed: 0,
      skipped: { text: 0, bitmap: 0, sound: 0, filter: 0, script: 0, group: 0, other: 0 }
    };
    var nextId = 1;
    var defs = [];            // definition tags, emitted before the timeline

    var layers = (doc.layers || []).filter(function (l) {
      var t = (l && l.layerType) || 'normal';
      return t !== 'guide' && t !== 'folder' && t !== 'motionguide';
    });

    /* A cache keyed by the object's own identity: the same object placed on
       forty frames should define one shape, not forty. */
    var shapeCache = new Map();
    var defineShape = function (o) {
      if (shapeCache.has(o)) return shapeCache.get(o);
      var id = nextId++;
      var body = shapeBody(id, o, report);
      if (!body) { nextId--; shapeCache.set(o, null); return null; }
      defs.push(tag(TAG.DefineShape3, body));
      shapeCache.set(o, id);
      return id;
    };

    /** A library symbol as a DefineSprite, with its own timeline. */
    var spriteCache = Object.create(null);
    var defineSprite = function (name, depthSeed) {
      if (spriteCache[name] != null) return spriteCache[name];
      var sym = (doc.library || {})[name];
      if (!sym) return null;
      var frames = [];
      if (sym.layers && sym.layers.length) {
        var total = 1;
        sym.layers.forEach(function (l) {
          (l.keyframes || []).forEach(function (k) {
            total = Math.max(total, k.index + k.duration - 1);
          });
        });
        for (var f = 1; f <= total; f++) frames.push(objectsAt(sym.layers, f));
      } else {
        frames.push((sym.objects || []).slice());
      }
      // Reserve the id BEFORE building, so a symbol containing itself stops
      // rather than recursing until the stack gives out.
      var id = nextId++;
      spriteCache[name] = id;
      var body = new Writer();
      body.u16(id);
      body.u16(Math.max(1, frames.length));
      var inner = [];
      var prevDepths = [];
      frames.forEach(function (objs) {
        // Everything from the previous frame goes, then this frame is placed:
        // simpler than diffing, and a sprite's frames are short.
        prevDepths.forEach(function (d) {
          var rw = new Writer();
          rw.u16(d);
          inner.push(tag(TAG.RemoveObject2, rw.bytes));
        });
        prevDepths = [];
        var depth = depthSeed || 1;
        objs.forEach(function (o) {
          var placed = placeOne(o, depth);
          if (placed) { prevDepths.push(depth); depth++; }
        });
        inner.push(tag(TAG.ShowFrame, []));
      });
      inner.push(tag(TAG.End, []));
      inner.forEach(function (t) { body.bytesOf(t); });
      defs.push(tag(TAG.DefineSprite, body.bytes));
      report.sprites++;
      return id;

      /* Placement inside a sprite writes into `inner`; the same code at the
         root writes into the timeline. The closure is what keeps the two from
         needing two copies. */
      function placeOne(o, d) {
        var cid = characterFor(o);
        if (cid == null) return false;
        inner.push(tag(TAG.PlaceObject2, placeBody(d, cid, o, true)));
        report.placed++;
        return true;
      }
    };

    /** The character id for an object, defining it if need be. */
    function characterFor(o) {
      if (!o) return null;
      if (o.filters && o.filters.length) report.skipped.filter++;
      if (o.type === 'text') { report.skipped.text++; return null; }
      if (o.type === 'bitmap') { report.skipped.bitmap++; return null; }
      if (o.type === 'group') {
        /* A group could be a sprite, but its children carry their own
           transforms relative to the group box and composing those into
           sprite-local coordinates is a second coordinate conversion with its
           own rounding. Reported rather than approximated. */
        report.skipped.group++;
        return null;
      }
      if (o.type === 'symbol') {
        var sid = defineSprite(o.symbolName, 1);
        if (sid == null) { report.skipped.other++; return null; }
        return sid;
      }
      return defineShape(o);
    }

    /** What is on `layers` at `frame`, bottom layer first. */
    function objectsAt(layerList, frame) {
      var out = [];
      for (var i = (layerList || []).length - 1; i >= 0; i--) {
        var l = layerList[i];
        var kf = null;
        (l.keyframes || []).forEach(function (k) {
          if (frame >= k.index && frame < k.index + k.duration) kf = k;
        });
        if (!kf) continue;
        (kf.objects || []).forEach(function (o) { out.push(o); });
      }
      return out;
    }

    // ---- the root timeline
    var totalFrames = 1;
    layers.forEach(function (l) {
      (l.keyframes || []).forEach(function (k) {
        totalFrames = Math.max(totalFrames, k.index + k.duration - 1);
        if (k.script && k.script.trim()) report.skipped.script++;
        if (k.sound && k.sound.asset) report.skipped.sound++;
      });
    });
    if (doc.totalFrames) totalFrames = Math.max(totalFrames, doc.totalFrames);

    var timeline = [];
    var liveDepths = [];
    for (var f = 1; f <= totalFrames; f++) {
      // Labels first, so a label names the frame it is on.
      layers.forEach(function (l) {
        (l.keyframes || []).forEach(function (k) {
          if (k.index !== f || !k.label) return;
          if ((k.labelType || 'name') === 'comment') return;
          var lw = new Writer();
          lw.string(k.label);
          timeline.push(tag(TAG.FrameLabel, lw.bytes));
        });
      });
      liveDepths.forEach(function (d) {
        var rw = new Writer();
        rw.u16(d);
        timeline.push(tag(TAG.RemoveObject2, rw.bytes));
      });
      liveDepths = [];
      var depth = 1;
      objectsAt(layers, f).forEach(function (o) {
        var cid = characterFor(o);
        if (cid == null) return;
        timeline.push(tag(TAG.PlaceObject2, placeBody(depth, cid, o, true)));
        liveDepths.push(depth);
        depth++;
        report.placed++;
      });
      timeline.push(tag(TAG.ShowFrame, []));
      report.frames++;
    }
    timeline.push(tag(TAG.End, []));

    // ---- body, then the header that describes it
    var body = new Writer();
    body.rect(0, 0, doc.width || 550, doc.height || 400);
    body.fixed8(doc.fps || 24);
    body.u16(totalFrames);
    /* FileAttributes must be the FIRST tag in SWF 8+. Written for 6 too: it is
       ignored by older players and makes the file valid for newer ones. */
    var fa = new Writer();
    fa.u32(0);
    body.bytesOf(tag(TAG.FileAttributes, fa.bytes));
    var bg = new Writer();
    bg.rgb(doc.backgroundColor || '#ffffff');
    body.bytesOf(tag(TAG.SetBackgroundColor, bg.bytes));
    defs.forEach(function (t) { body.bytesOf(t); });
    timeline.forEach(function (t) { body.bytesOf(t); });

    var head = new Writer();
    head.u8(0x46).u8(0x57).u8(0x53);          // "FWS" — uncompressed
    head.u8(opts.version || 6);
    head.u32(8 + body.bytes.length);          // whole file, header included
    var out = new Uint8Array(head.bytes.length + body.bytes.length);
    out.set(head.bytes, 0);
    out.set(body.bytes, head.bytes.length);

    report.bytes = out.length;
    report.totalFrames = totalFrames;
    return { bytes: out, report: report };
  }

  /** A sentence saying what was left out, or "" when nothing was. */
  function reportText(report) {
    var s = report.skipped;
    var parts = [];
    var add = function (n, one, many) {
      if (n) parts.push(n + ' ' + (n === 1 ? one : many));
    };
    add(s.text, 'text block', 'text blocks');
    add(s.bitmap, 'bitmap', 'bitmaps');
    add(s.sound, 'sound', 'sounds');
    add(s.group, 'group', 'groups');
    add(s.script, 'frame script', 'frame scripts');
    add(s.filter, 'filtered object', 'filtered objects');
    add(s.other, 'other object', 'other objects');
    return parts.join(', ');
  }

  global.FlashySWFWriter = {
    write: write,
    reportText: reportText,
    Writer: Writer,
    TAG: TAG,
    TWIPS: TWIPS,
    /* The outline an object contributes, before any twip conversion. Exposed
       so a spec can check that the writer and the stage agree about a shape
       without decoding a file. */
    localLoops: localLoops
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.FlashySWFWriter;
  }
})(typeof window !== 'undefined' ? window : this);
