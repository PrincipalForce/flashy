/* ------------------------------------------------------------------ *
 * FlashyGif — a GIF89a encoder
 *
 * Flash's File ▸ Export Movie offered Animated GIF, and it was how most
 * Flash animation actually left Flash: a looping banner, an avatar, a
 * walk cycle you could paste anywhere. Flashy's "Export as Sprite Sheet"
 * writes a PNG grid inside an HTML player, which is a sprite sheet — useful,
 * and not a GIF. A GIF plays in an <img>, in a chat window, in a forum post
 * and in a text message, and nothing else in the export list does.
 *
 * So this is the real format, written out properly:
 *
 *   - a GLOBAL palette, median-cut over every frame at once, because a
 *     per-frame palette makes the colours shift as the animation plays;
 *   - optional ordered or diffusion dithering, which are the two Flash
 *     offered and are the difference between a usable gradient and bands;
 *   - the NETSCAPE2.0 loop extension, without which a GIF plays once;
 *   - frame differencing: each frame is cropped to what actually changed and
 *     the unchanged pixels are left transparent over the frame before. On
 *     cartoon animation — a still background and a moving character — that
 *     is most of the file.
 *
 * LZW is the GIF variant: variable code width, a clear code when the table
 * fills, and the whole stream chopped into sub-blocks of at most 255 bytes.
 *
 * Browser-free: everything here takes ImageData-shaped {width, height, data}
 * and returns bytes, so the encoder is testable without a canvas and the
 * editor, the specs and any future command-line use share one implementation.
 * ------------------------------------------------------------------ */
(function (root) {
  "use strict";

  /* ---------------- a growable byte sink ---------------------------- */
  function Bytes() { this.a = []; }
  Bytes.prototype.u8 = function (v) { this.a.push(v & 0xFF); return this; };
  Bytes.prototype.u16 = function (v) {
    // GIF is little-endian throughout.
    this.a.push(v & 0xFF, (v >> 8) & 0xFF); return this;
  };
  Bytes.prototype.str = function (s) {
    for (var i = 0; i < s.length; i++) this.a.push(s.charCodeAt(i) & 0xFF);
    return this;
  };
  Bytes.prototype.raw = function (arr) {
    for (var i = 0; i < arr.length; i++) this.a.push(arr[i] & 0xFF);
    return this;
  };
  /** The stream chopped into GIF sub-blocks: a length byte then that many. */
  Bytes.prototype.blocks = function (arr) {
    var i = 0;
    while (i < arr.length) {
      var n = Math.min(255, arr.length - i);
      this.u8(n);
      for (var k = 0; k < n; k++) this.a.push(arr[i + k] & 0xFF);
      i += n;
    }
    this.u8(0);                       // the block terminator
    return this;
  };
  Bytes.prototype.bytes = function () { return new Uint8Array(this.a); };

  /* ---------------- palette ----------------------------------------- *
   * Median cut. Each box is split across its widest channel at the median,
   * which is what keeps a 256-colour palette spending its entries where the
   * picture actually varies -- a uniform grid wastes most of them on colours
   * no frame contains.
   * ------------------------------------------------------------------ */

  /** Every distinct opaque colour in `frames`, with its pixel count. */
  function histogram(frames, alphaThreshold) {
    var map = new Map();
    for (var f = 0; f < frames.length; f++) {
      var d = frames[f].data;
      for (var i = 0; i < d.length; i += 4) {
        if (d[i + 3] < alphaThreshold) continue;
        /* Quantised to 5 bits per channel for the histogram only. At 8 bits a
           photographic frame has more distinct colours than pixels in a small
           GIF, and the median cut then spends all its time sorting noise. */
        var key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
        var e = map.get(key);
        if (e) { e.n++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2]; }
        else map.set(key, { n: 1, r: d[i], g: d[i + 1], b: d[i + 2] });
      }
    }
    var out = [];
    map.forEach(function (e) {
      out.push({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n, n: e.n });
    });
    return out;
  }

  function boxOf(entries) {
    var lo = [255, 255, 255], hi = [0, 0, 0], n = 0;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var c = [e.r, e.g, e.b];
      for (var k = 0; k < 3; k++) {
        if (c[k] < lo[k]) lo[k] = c[k];
        if (c[k] > hi[k]) hi[k] = c[k];
      }
      n += e.n;
    }
    return { entries: entries, lo: lo, hi: hi, n: n };
  }

  /**
   * A palette of at most `max` colours over every frame.
   *
   * Returns a flat [r,g,b, r,g,b, …]. Fewer than `max` distinct colours come
   * back exactly, which matters: flat-colour cartoon artwork is the case GIF
   * is best at, and requantising twelve colours into twelve would be a way
   * to make them all slightly wrong.
   */
  function quantize(frames, max, alphaThreshold) {
    var hist = histogram(frames, alphaThreshold);
    if (!hist.length) return [0, 0, 0];
    if (hist.length <= max) {
      var exact = [];
      hist.sort(function (a, b) { return b.n - a.n; });
      hist.forEach(function (e) {
        exact.push(Math.round(e.r), Math.round(e.g), Math.round(e.b));
      });
      return exact;
    }
    var boxes = [boxOf(hist)];
    while (boxes.length < max) {
      // Split the box with the most pixels in it that still can be split.
      var pick = -1, best = -1;
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        if (b.entries.length < 2) continue;
        if (b.n > best) { best = b.n; pick = i; }
      }
      if (pick < 0) break;
      var box = boxes[pick];
      var axis = 0, span = -1;
      for (var k = 0; k < 3; k++) {
        var s = box.hi[k] - box.lo[k];
        if (s > span) { span = s; axis = k; }
      }
      var key = axis === 0 ? "r" : axis === 1 ? "g" : "b";
      box.entries.sort(function (a, b2) { return a[key] - b2[key]; });
      /* Split at the pixel-count median rather than the entry-count median:
         one colour covering half the picture must not share a box with the
         long tail of colours covering a few pixels each. */
      var half = box.n / 2, run = 0, cut = 1;
      for (var e2 = 0; e2 < box.entries.length - 1; e2++) {
        run += box.entries[e2].n;
        if (run >= half) { cut = e2 + 1; break; }
        cut = e2 + 1;
      }
      boxes.splice(pick, 1,
        boxOf(box.entries.slice(0, cut)),
        boxOf(box.entries.slice(cut)));
    }
    var pal = [];
    boxes.forEach(function (b) {
      var r = 0, g = 0, bl = 0, n = 0;
      b.entries.forEach(function (e) { r += e.r * e.n; g += e.g * e.n; bl += e.b * e.n; n += e.n; });
      n = n || 1;
      pal.push(Math.round(r / n), Math.round(g / n), Math.round(bl / n));
    });
    return pal;
  }

  /** The palette entry nearest a colour, by squared distance. */
  function nearest(pal, count, r, g, b) {
    var best = 0, bestD = Infinity;
    for (var i = 0; i < count; i++) {
      var dr = pal[i * 3] - r, dg = pal[i * 3 + 1] - g, db = pal[i * 3 + 2] - b;
      /* Plain squared distance, not a perceptual metric. GIF's 256 entries
         are chosen from the picture's own colours, so the nearest one is
         almost always obvious and the weighting would not change it. */
      var d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  /* The 8x8 Bayer matrix, which is what "ordered" dithering means. Cheap,
     deterministic, and it does not smear -- on animation that matters more
     than it does on a still, because diffusion error travels differently in
     each frame and the texture crawls. */
  var BAYER = [
     0, 32,  8, 40,  2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44,  4, 36, 14, 46,  6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
     3, 35, 11, 43,  1, 33,  9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47,  7, 39, 13, 45,  5, 37,
    63, 31, 55, 23, 61, 29, 53, 21
  ];

  /**
   * One frame's pixels as palette indices.
   *
   * `transparentIndex` is used for pixels below the alpha threshold and, when
   * `prev` is given, for pixels that have not changed since it -- which is
   * the frame differencing, and is where the compression on cartoon
   * animation comes from.
   */
  function indexFrame(frame, pal, count, opts, prev) {
    var w = frame.width, h = frame.height, d = frame.data;
    var out = new Uint8Array(w * h);
    var ti = opts.transparentIndex;
    var dither = opts.dither;
    // Diffusion needs a mutable copy of the row errors.
    var err = dither === "diffusion" ? new Float32Array(w * 2 * 3) : null;
    var cache = new Map();

    for (var y = 0; y < h; y++) {
      if (err) {
        // Roll the next row's accumulated error into the current one.
        for (var c = 0; c < w * 3; c++) { err[c] = err[w * 3 + c]; err[w * 3 + c] = 0; }
      }
      for (var x = 0; x < w; x++) {
        var p = (y * w + x) * 4, oi = y * w + x;
        if (d[p + 3] < opts.alphaThreshold) { out[oi] = ti; continue; }
        if (prev) {
          var q = p;
          if (prev.data[q] === d[p] && prev.data[q + 1] === d[p + 1] &&
              prev.data[q + 2] === d[p + 2] && prev.data[q + 3] >= opts.alphaThreshold) {
            out[oi] = ti;
            continue;
          }
        }
        var r = d[p], g = d[p + 1], b = d[p + 2];
        if (dither === "ordered") {
          /* The threshold is scaled to the palette's own coarseness: a
             sixteen-colour palette needs a far bigger nudge than a 256-colour
             one, and a fixed amplitude either does nothing or shreds. */
          var amp = opts.ditherAmount * (BAYER[(y & 7) * 8 + (x & 7)] / 63 - 0.5);
          r += amp; g += amp; b += amp;
        } else if (dither === "diffusion") {
          r += err[x * 3]; g += err[x * 3 + 1]; b += err[x * 3 + 2];
        }
        r = r < 0 ? 0 : r > 255 ? 255 : r;
        g = g < 0 ? 0 : g > 255 ? 255 : g;
        b = b < 0 ? 0 : b > 255 ? 255 : b;

        var idx;
        if (dither) {
          idx = nearest(pal, count, r, g, b);
        } else {
          // Exact colours repeat constantly in flat artwork; the cache turns
          // the palette search into one lookup for all but the first pixel.
          var ck = (r << 16) | (g << 8) | b;
          idx = cache.get(ck);
          if (idx === undefined) { idx = nearest(pal, count, r, g, b); cache.set(ck, idx); }
        }
        if (idx === ti) {
          /* The transparent slot must never be written as a colour, or the
             pixel disappears. Second nearest instead. */
          idx = secondNearest(pal, count, r, g, b, ti);
        }
        out[oi] = idx;

        if (dither === "diffusion") {
          // Floyd–Steinberg: 7/16 right, 3/16 below-left, 5/16 below, 1/16 below-right.
          var er = r - pal[idx * 3], eg = g - pal[idx * 3 + 1], eb = b - pal[idx * 3 + 2];
          var push = function (xx, row, f) {
            if (xx < 0 || xx >= w) return;
            var o = row * w * 3 + xx * 3;
            err[o] += er * f; err[o + 1] += eg * f; err[o + 2] += eb * f;
          };
          push(x + 1, 0, 7 / 16);
          push(x - 1, 1, 3 / 16);
          push(x, 1, 5 / 16);
          push(x + 1, 1, 1 / 16);
        }
      }
    }
    return out;
  }

  function secondNearest(pal, count, r, g, b, skip) {
    var best = skip === 0 ? 1 : 0, bestD = Infinity;
    for (var i = 0; i < count; i++) {
      if (i === skip) continue;
      var dr = pal[i * 3] - r, dg = pal[i * 3 + 1] - g, db = pal[i * 3 + 2] - b;
      var d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  /* ---------------- LZW ---------------------------------------------- */

  /**
   * GIF's LZW: variable code width starting at minCodeSize+1, a CLEAR code
   * when the 12-bit table fills, and an END code to finish.
   *
   * The dictionary is keyed by (prefix << 8) | pixel, which fits every entry
   * because the code space is 12 bits and a pixel is 8 -- a string map would
   * work and would be several times slower on a full-size frame.
   */
  function lzw(indices, minCodeSize) {
    var clear = 1 << minCodeSize, end = clear + 1;
    var out = [];
    var cur = 0, curBits = 0;
    var codeSize = minCodeSize + 1;
    var dict = new Map();
    var next = end + 1;

    function emit(code) {
      cur |= code << curBits;
      curBits += codeSize;
      while (curBits >= 8) { out.push(cur & 0xFF); cur >>= 8; curBits -= 8; }
    }
    function reset() {
      dict.clear();
      next = end + 1;
      codeSize = minCodeSize + 1;
    }

    emit(clear);
    reset();
    if (!indices.length) { emit(end); if (curBits) out.push(cur & 0xFF); return out; }

    var prefix = indices[0];
    for (var i = 1; i < indices.length; i++) {
      var k = indices[i];
      var key = (prefix << 8) | k;
      var found = dict.get(key);
      if (found !== undefined) { prefix = found; continue; }
      emit(prefix);
      if (next < 4096) {
        dict.set(key, next);
        next++;
        /* The code width grows only once the table has PASSED the current
           width's capacity. Growing one entry early is the classic GIF
           encoder bug: every decoder then reads the rest of the stream
           shifted by a bit. */
        if (next - 1 === (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        emit(clear);
        reset();
      }
      prefix = k;
    }
    emit(prefix);
    emit(end);
    if (curBits) out.push(cur & 0xFF);
    return out;
  }

  /* ---------------- frame differencing ------------------------------- */

  /** The smallest rectangle containing every pixel that differs. */
  function changedRect(frame, prev) {
    var w = frame.width, h = frame.height;
    if (!prev) return { x: 0, y: 0, w: w, h: h };
    var a = frame.data, b = prev.data;
    var x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var p = (y * w + x) * 4;
        if (a[p] !== b[p] || a[p + 1] !== b[p + 1] ||
            a[p + 2] !== b[p + 2] || a[p + 3] !== b[p + 3]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    // Nothing changed: a 1x1 placeholder, because a zero-sized frame is not
    // legal GIF and dropping the frame would lose its delay.
    if (x1 < 0) return { x: 0, y: 0, w: 1, h: 1 };
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  /** A sub-rectangle of a frame, as its own frame. */
  function crop(frame, r) {
    var out = { width: r.w, height: r.h, data: new Uint8ClampedArray(r.w * r.h * 4) };
    for (var y = 0; y < r.h; y++) {
      var src = ((y + r.y) * frame.width + r.x) * 4;
      out.data.set(frame.data.subarray(src, src + r.w * 4), y * r.w * 4);
    }
    return out;
  }

  /* ---------------- the encoder -------------------------------------- */

  /**
   * Encode frames as an animated GIF.
   *
   * `frames` are ImageData-shaped, all the same size. Options:
   *   colors     palette size, 2..256 (default 256)
   *   delay      hundredths of a second per frame, or an array, one each
   *   loop       0 for forever (the default), n for n extra plays, null for once
   *   dither     null | "ordered" | "diffusion"
   *   transparent  true to keep the source's own transparency
   *   optimize   true (default) to crop each frame to what changed
   */
  function encode(frames, opts) {
    opts = opts || {};
    if (!frames || !frames.length) throw new Error("No frames to encode.");
    var w = frames[0].width, h = frames[0].height;
    var wantAlpha = opts.transparent !== false;
    var alphaThreshold = opts.alphaThreshold != null ? opts.alphaThreshold : 128;
    var optimize = opts.optimize !== false;
    var maxColors = Math.max(2, Math.min(256, opts.colors || 256));

    /* A transparent slot is needed whenever the source has transparency OR
       the frames are being differenced -- differencing EXPRESSES "unchanged"
       as transparent, so without the slot every frame has to be whole. */
    var anyAlpha = false;
    if (wantAlpha) {
      for (var f0 = 0; f0 < frames.length && !anyAlpha; f0++) {
        var dd = frames[f0].data;
        for (var i0 = 3; i0 < dd.length; i0 += 4) {
          if (dd[i0] < alphaThreshold) { anyAlpha = true; break; }
        }
      }
    }
    var needTransparent = anyAlpha || (optimize && frames.length > 1);

    var pal = quantize(frames, needTransparent ? maxColors - 1 : maxColors, alphaThreshold);
    var colorCount = pal.length / 3;
    var transparentIndex = -1;
    if (needTransparent) {
      transparentIndex = colorCount;
      pal = pal.concat([0, 0, 0]);
      colorCount++;
    }

    // The table size is a power of two, at least 2 entries.
    var bits = 1;
    while ((1 << bits) < colorCount) bits++;
    if (bits > 8) bits = 8;
    var tableSize = 1 << bits;
    var table = pal.slice();
    while (table.length < tableSize * 3) table.push(0);

    var out = new Bytes();
    out.str("GIF89a");
    out.u16(w).u16(h);
    // Global colour table present, 8-bit colour resolution, unsorted.
    out.u8(0x80 | (7 << 4) | (bits - 1));
    out.u8(0).u8(0);
    out.raw(table);

    if (opts.loop !== null && frames.length > 1) {
      out.u8(0x21).u8(0xFF).u8(0x0B).str("NETSCAPE2.0");
      out.u8(0x03).u8(0x01).u16(opts.loop || 0).u8(0x00);
    }

    var delays = Array.isArray(opts.delay) ? opts.delay : null;
    var defaultDelay = (!delays && opts.delay != null) ? opts.delay : 10;
    var prev = null;
    var minCode = Math.max(2, bits);

    for (var f = 0; f < frames.length; f++) {
      var frame = frames[f];
      var rect = optimize ? changedRect(frame, prev) : { x: 0, y: 0, w: w, h: h };
      var piece = (rect.x || rect.y || rect.w !== w || rect.h !== h) ? crop(frame, rect) : frame;
      var prevPiece = (prev && piece !== frame) ? crop(prev, rect) : prev;
      var indices = indexFrame(piece, table, colorCount, {
        transparentIndex: transparentIndex < 0 ? 0 : transparentIndex,
        dither: opts.dither || null,
        ditherAmount: opts.ditherAmount != null ? opts.ditherAmount : 256 / tableSize * 2,
        alphaThreshold: alphaThreshold
      }, optimize && transparentIndex >= 0 ? prevPiece : null);

      var delay = delays ? (delays[f] || 10) : defaultDelay;
      out.u8(0x21).u8(0xF9).u8(0x04);
      /* Disposal 1 (leave in place) when frames are differenced, because the
         transparent pixels mean "whatever was already there"; 2 (restore to
         background) otherwise, so a shape that moves does not smear. */
      var disposal = (optimize && frames.length > 1) ? 1 : (anyAlpha ? 2 : 0);
      out.u8((disposal << 2) | (transparentIndex >= 0 ? 1 : 0));
      out.u16(Math.max(0, Math.round(delay)));
      out.u8(transparentIndex >= 0 ? transparentIndex : 0);
      out.u8(0x00);

      out.u8(0x2C);
      out.u16(rect.x).u16(rect.y).u16(rect.w).u16(rect.h);
      out.u8(0x00);                   // no local table, not interlaced
      out.u8(minCode);
      out.blocks(lzw(indices, minCode));

      prev = frame;
    }

    out.u8(0x3B);
    return out.bytes();
  }

  root.FlashyGif = {
    encode: encode,
    quantize: quantize,
    lzw: lzw,
    changedRect: changedRect,
    crop: crop,
    indexFrame: indexFrame,
    nearest: nearest,
    BAYER: BAYER,
    DITHER: [[null, "None"], ["ordered", "Ordered"], ["diffusion", "Diffusion"]]
  };
})(typeof window !== "undefined" ? window : globalThis);
