/* flashy-swf.js — SWF reader for Flashy
 *
 * Reads a compiled Flash movie back into something editable. There are two
 * layers here, and the split is the point:
 *
 *   1. `Flashy.SWF.parse(buffer)` → a **document model**. Plain data: a
 *      dictionary of characters (shapes as real closed paths, sprites as
 *      timelines, bitmaps, fonts, text, buttons, sounds), the root timeline
 *      as a list of display-list commands per frame, frame labels, exported
 *      names, and the ActionScript decompiled to source. No display objects,
 *      no DOM, nothing to render — which is what lets the editor import a
 *      movie as a *document* (stage, layers, library symbols) rather than as
 *      a black box that merely plays.
 *
 *   2. `Flashy.SWFLoader` builds a live `MovieClip` out of that model, which
 *      is what the demo page uses.
 *
 * WHAT IS READ
 *   Headers        FWS (raw) and CWS (zlib). ZWS (LZMA) is not supported —
 *                  browsers have no LZMA decoder.
 *   Shapes         DefineShape 1-4. Edges are **stitched into closed loops**
 *                  per fill style, which is how SWF actually describes a
 *                  filled region: each edge names the fill on its left and
 *                  its right, and a shape is only coherent once those are
 *                  assembled. Strokes come out as their own open paths, with
 *                  caps and joins from DefineShape4's line style 2.
 *   Fills          Solid, linear/radial gradients (all stops, with the
 *                  gradient matrix resolved to end points), bitmap fills.
 *   Sprites        DefineSprite, recursively, with their own labels and
 *                  scripts.
 *   Display list   PlaceObject 1/2/3 and RemoveObject 1/2, with matrices,
 *                  colour transforms, ratios, clip depths, names, blend
 *                  modes and per-instance clip event handlers.
 *   Bitmaps        DefineBits + JPEGTables, DefineBitsJPEG2/3/4,
 *                  DefineBitsLossless 1/2 (8/15/16/24/32-bit, de-zlibbed to
 *                  RGBA).
 *   Text           DefineFont 1/2/3 glyph outlines and code tables, so
 *                  DefineText/2 comes back both as **readable strings** and
 *                  as exact glyph outlines; DefineEditText as a text field.
 *   Buttons        DefineButton/DefineButton2 — the up state becomes the
 *                  artwork, and the handlers are decompiled.
 *   Morph shapes   DefineMorphShape 1/2, as their start shape.
 *   Sound          DefineSound (MP3 and PCM; ADPCM and Nellymoser are
 *                  reported, not decoded) and StartSound per frame.
 *   Scripts        DoAction, DoInitAction and clip/button handlers, run
 *                  through `FlashyAVM1` and attached to the frame they are
 *                  on. DoABC (ActionScript 3) is recorded as present but not
 *                  decompiled — a different virtual machine entirely.
 *
 * Unknown tags are skipped by length rather than guessed at, and a tag that
 * throws is recorded in `doc.warnings` and skipped: a 7MB cartoon with one
 * malformed sprite should still import.
 *
 * Usage:
 *   const doc = await Flashy.SWF.parse(arrayBuffer);     // document model
 *   const mc  = await new Flashy.SWFLoader().loadURL(u); // MovieClip
 */
(function (global) {
  'use strict';

  const F = global.Flashy;
  if (!F) throw new Error('flashy.js must be loaded before flashy-swf.js');

  const TWIPS = 20;                     // SWF's unit: 1/20 px

  // Path opcodes, deliberately the same numbers FlashyTrace uses, so a path
  // parsed out of a SWF can go straight into an editor `path` object.
  const MOVE = 0, LINE = 1, QUAD = 2, CLOSE = 3;

  // -------------------- decompression --------------------
  async function inflate(bytes, raw) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream not available — cannot read compressed SWF data');
    }
    const ds = new DecompressionStream(raw ? 'deflate-raw' : 'deflate');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // -------------------- bit reader --------------------
  class BitReader {
    constructor(bytes, pos, end) {
      this.bytes = bytes;
      this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      this.pos = pos || 0;
      this.end = end == null ? bytes.length : end;
      this.bitBuf = 0;
      this.bitPos = 0;
    }
    align() { this.bitPos = 0; this.bitBuf = 0; }
    get eof() { return this.pos >= this.end; }
    u8() { this.align(); return this.bytes[this.pos++]; }
    u16() { this.align(); const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
    u32() { this.align(); const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
    s16() { this.align(); const v = this.view.getInt16(this.pos, true); this.pos += 2; return v; }
    s32() { this.align(); const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
    f32() { this.align(); const v = this.view.getFloat32(this.pos, true); this.pos += 4; return v; }
    fixed8() { this.align(); const v = this.view.getInt16(this.pos, true) / 256; this.pos += 2; return v; }

    ub(n) {
      let v = 0;
      while (n > 0) {
        if (this.bitPos === 0) { this.bitBuf = this.bytes[this.pos++] | 0; this.bitPos = 8; }
        const take = Math.min(n, this.bitPos);
        v = (v * (1 << take)) + ((this.bitBuf >> (this.bitPos - take)) & ((1 << take) - 1));
        this.bitPos -= take;
        n -= take;
      }
      return v;
    }
    sb(n) {
      if (n === 0) return 0;
      const v = this.ub(n);
      const half = Math.pow(2, n - 1);
      return v >= half ? v - half * 2 : v;
    }
    fb(n) { return this.sb(n) / 65536; }

    rect() {
      this.align();
      const n = this.ub(5);
      return { xMin: this.sb(n), xMax: this.sb(n), yMin: this.sb(n), yMax: this.sb(n) };
    }

    /** A SWF matrix, in SWF terms: scale/rotateSkew/translate, twips for tx/ty. */
    matrix() {
      this.align();
      let a = 1, d = 1, b = 0, c = 0;
      if (this.ub(1)) { const n = this.ub(5); a = this.fb(n); d = this.fb(n); }
      if (this.ub(1)) { const n = this.ub(5); b = this.fb(n); c = this.fb(n); }
      const n2 = this.ub(5);
      const tx = this.sb(n2);
      const ty = this.sb(n2);
      return { a, b, c, d, tx, ty };
    }

    colorRGB() { return (this.u8() << 16) | (this.u8() << 8) | this.u8(); }
    colorRGBA() {
      const c = this.colorRGB();
      return { color: c, alpha: this.u8() / 255 };
    }
    colorARGB() {
      const a = this.u8() / 255;
      return { color: this.colorRGB(), alpha: a };
    }

    /** A colour transform. `mul`/`add` are per channel, RGB(A). */
    cxform(hasAlpha) {
      this.align();
      const hasAdd = this.ub(1);
      const hasMul = this.ub(1);
      const n = this.ub(4);
      const channels = hasAlpha ? 4 : 3;
      let mul = null, add = null;
      if (hasMul) { mul = []; for (let i = 0; i < channels; i++) mul.push(this.sb(n) / 256); }
      if (hasAdd) { add = []; for (let i = 0; i < channels; i++) add.push(this.sb(n)); }
      if (hasAlpha) {
        if (mul && mul.length < 4) mul.push(1);
        if (add && add.length < 4) add.push(0);
      }
      return { mul, add };
    }

    string() {
      this.align();
      let end = this.pos;
      while (end < this.end && this.bytes[end] !== 0) end++;
      const s = decodeString(this.bytes.subarray(this.pos, end));
      this.pos = end + 1;
      return s;
    }
    /** A length-prefixed (u8) string — DefineFont2's name, DefineButton2's. */
    lenString() {
      const n = this.u8();
      const s = decodeString(this.bytes.subarray(this.pos, this.pos + n));
      this.pos += n;
      return s.replace(/\0+$/, '');
    }
  }

  function decodeString(bytes) {
    try { return new TextDecoder('utf-8').decode(bytes); }
    catch (e) {
      let s = '';
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return s;
    }
  }

  // -------------------- fill & line styles --------------------
  function readFillStyleArray(br, version) {
    let count = br.u8();
    if (count === 0xff && version >= 2) count = br.u16();
    const styles = [];
    for (let i = 0; i < count; i++) styles.push(readFillStyle(br, version));
    return styles;
  }

  function readGradient(br, version, type) {
    const matrix = br.matrix();
    br.align();
    let spread = 0, interpolation = 0, count;
    if (type === 'focal' || version >= 4) {
      spread = br.ub(2); interpolation = br.ub(2); count = br.ub(4);
    } else {
      br.ub(4); count = br.ub(4);
    }
    const stops = [];
    for (let i = 0; i < count; i++) {
      const ratio = br.u8() / 255;
      const c = version >= 3 ? br.colorRGBA() : { color: br.colorRGB(), alpha: 1 };
      stops.push({ ratio, color: c.color, alpha: c.alpha });
    }
    const focal = type === 'focal' ? br.fixed8() : 0;
    return { matrix, stops, spread, interpolation, focal };
  }

  function readFillStyle(br, version) {
    const type = br.u8();
    if (type === 0x00) {
      const c = version >= 3 ? br.colorRGBA() : { color: br.colorRGB(), alpha: 1 };
      return { type: 'solid', color: c.color, alpha: c.alpha };
    }
    if (type === 0x10 || type === 0x12 || type === 0x13) {
      const kind = type === 0x10 ? 'linear' : 'radial';
      const g = readGradient(br, version, type === 0x13 ? 'focal' : kind);
      return { type: kind, stops: g.stops, matrix: g.matrix, spread: g.spread, focal: g.focal };
    }
    if (type >= 0x40 && type <= 0x43) {
      const bitmapId = br.u16();
      const matrix = br.matrix();
      return {
        type: 'bitmap', bitmapId, matrix,
        repeat: type === 0x40 || type === 0x42,
        smooth: type === 0x40 || type === 0x41
      };
    }
    return { type: 'unknown', color: 0x000000, alpha: 1 };
  }

  const CAPS = ['round', 'butt', 'square'];
  const JOINS = ['round', 'bevel', 'miter'];

  function readLineStyleArray(br, version, isShape4) {
    let count = br.u8();
    if (count === 0xff) count = br.u16();
    const styles = [];
    for (let i = 0; i < count; i++) {
      const width = br.u16();
      if (!isShape4) {
        const c = version >= 3 ? br.colorRGBA() : { color: br.colorRGB(), alpha: 1 };
        styles.push({ width, color: c.color, alpha: c.alpha, cap: 'round', join: 'round' });
        continue;
      }
      // LINESTYLE2 — the one that carries caps, joins and a fill-as-stroke.
      br.align();
      const startCap = br.ub(2);
      const join = br.ub(2);
      const hasFill = br.ub(1);
      const noHScale = br.ub(1);
      const noVScale = br.ub(1);
      br.ub(1);                        // pixel hinting
      br.ub(5);                        // reserved
      const noClose = br.ub(1);
      const endCap = br.ub(2);
      const miter = join === 2 ? br.fixed8() : 3;
      let style;
      if (hasFill) {
        const fill = readFillStyle(br, version);
        style = {
          width, color: fill.color != null ? fill.color : 0x000000,
          alpha: fill.alpha != null ? fill.alpha : 1, fill
        };
      } else {
        const c = br.colorRGBA();
        style = { width, color: c.color, alpha: c.alpha };
      }
      style.cap = CAPS[startCap] || 'round';
      style.endCap = CAPS[endCap] || style.cap;
      style.join = JOINS[join] || 'round';
      style.miter = miter;
      style.noHScale = !!noHScale;
      style.noVScale = !!noVScale;
      style.noClose = !!noClose;
      styles.push(style);
    }
    return styles;
  }

  // -------------------- shapes --------------------
  /*
   * A SWF shape is a list of edges, and every edge names the fill style on
   * each side of it (fillStyle0 to its right, fillStyle1 to its left) plus
   * the line style along it. Nothing in the file says "here is a triangle":
   * the filled regions only exist once the edges that share a style are
   * stitched end-to-end into closed loops.
   *
   * Emitting edges in file order and hoping — which is what this file used to
   * do — draws every shape as an unterminated scribble and fills whatever the
   * canvas happens to close. So: collect directed edges per fill style (an
   * edge with the style on its *right* is walked backwards), chain them into
   * loops, and emit a closed path per loop. Holes fall out of this for free:
   * they are simply loops wound the other way.
   */
  function parseShape(br, version, isShape4, preStyles) {
    let fillStyles = preStyles ? preStyles.fills : readFillStyleArray(br, version);
    let lineStyles = preStyles ? preStyles.lines : readLineStyleArray(br, version, isShape4);
    br.align();
    let nFillBits = br.ub(4);
    let nLineBits = br.ub(4);

    const groups = [];                 // one per style set (NewStyles starts another)
    let group = { fills: fillStyles, lines: lineStyles, edges: [] };

    let x = 0, y = 0;
    let fill0 = 0, fill1 = 0, line = 0;

    function edgeTo(nx, ny, cx, cy) {
      group.edges.push({
        x0: x, y0: y, x1: nx, y1: ny,
        cx: cx == null ? null : cx, cy: cy == null ? null : cy,
        fill0, fill1, line
      });
      x = nx; y = ny;
    }

    for (;;) {
      if (br.pos >= br.end) break;
      const type = br.ub(1);
      if (type === 0) {
        const flags = br.ub(5);
        if (flags === 0) break;                      // EndShapeRecord
        if (flags & 0x01) { const n = br.ub(5); x = br.sb(n); y = br.sb(n); }
        if (flags & 0x02) { fill0 = br.ub(nFillBits); }
        if (flags & 0x04) { fill1 = br.ub(nFillBits); }
        if (flags & 0x08) { line = br.ub(nLineBits); }
        if (flags & 0x10) {
          /* NewStyles restarts the style indices, so the edges collected so
             far belong to the old arrays and have to be closed off now. */
          groups.push(group);
          fillStyles = readFillStyleArray(br, version);
          lineStyles = readLineStyleArray(br, version, isShape4);
          group = { fills: fillStyles, lines: lineStyles, edges: [] };
          br.align();
          nFillBits = br.ub(4);
          nLineBits = br.ub(4);
          fill0 = fill1 = line = 0;
        }
      } else {
        const straight = br.ub(1);
        if (straight) {
          const n = br.ub(4) + 2;
          let nx = x, ny = y;
          if (br.ub(1)) { nx = x + br.sb(n); ny = y + br.sb(n); }
          else if (br.ub(1) === 0) { nx = x + br.sb(n); }
          else { ny = y + br.sb(n); }
          edgeTo(nx, ny);
        } else {
          const n = br.ub(4) + 2;
          const cx = x + br.sb(n);
          const cy = y + br.sb(n);
          const nx = cx + br.sb(n);
          const ny = cy + br.sb(n);
          edgeTo(nx, ny, cx, cy);
        }
      }
    }
    groups.push(group);

    let items = [];
    for (const g of groups) items = items.concat(buildItems(g.edges, g.fills, g.lines));
    return items;
  }

  /**
   * Edges (in twips, each naming the fill on either side of it and the line
   * along it) → draw items with closed, stitched paths.
   *
   * Shared with the XFL reader, whose `edges` attribute describes a shape
   * the same way SWF's shape records do — which is no coincidence: it is the
   * same model written out as text.
   */
  function buildItems(edges, fills, lines) {
    const byFill = new Map();
    const strokes = [];
    let run = null;

    for (const e of edges) {
      if (e.fill1) pushTo(byFill, e.fill1, e);
      if (e.fill0) pushTo(byFill, e.fill0, reverseEdge(e));
      if (e.line) {
        if (!run || run.style !== e.line || run.x !== e.x0 || run.y !== e.y0) {
          if (run && run.segs.length) strokes.push(run);
          run = { style: e.line, segs: [] };
        }
        run.segs.push(e);
        run.x = e.x1; run.y = e.y1;
      } else if (run) {
        if (run.segs.length) strokes.push(run);
        run = null;
      }
    }
    if (run && run.segs.length) strokes.push(run);

    const items = [];
    /* Fills first, in style order, then strokes — SWF paints them that way
       and a stroke under its own fill disappears. */
    const indices = Array.from(byFill.keys()).sort((a, b) => a - b);
    for (const idx of indices) {
      const style = fills[idx - 1];
      if (!style) continue;
      const path = loopsToPath(stitch(byFill.get(idx)));
      if (path.length) items.push({ fill: style, stroke: null, path });
    }
    for (const r of strokes) {
      const style = lines[r.style - 1];
      if (!style) continue;
      const path = runToPath(r);
      if (path.length) items.push({ fill: null, stroke: style, path });
    }
    return items;
  }

  function pushTo(map, key2, value) {
    let arr = map.get(key2);
    if (!arr) { arr = []; map.set(key2, arr); }
    arr.push(value);
  }

  function reverseEdge(e) {
    return { x0: e.x1, y0: e.y1, x1: e.x0, y1: e.y0, cx: e.cx, cy: e.cy };
  }

  const key = (x, y) => x + ',' + y;

  /** Chain directed edges into closed loops. Leftovers become open loops. */
  function stitch(edges) {
    const byStart = new Map();
    for (let i = 0; i < edges.length; i++) {
      const k = key(edges[i].x0, edges[i].y0);
      let arr = byStart.get(k);
      if (!arr) { arr = []; byStart.set(k, arr); }
      arr.push(i);
    }
    const used = new Array(edges.length).fill(false);
    const loops = [];
    for (let i = 0; i < edges.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      const loop = [edges[i]];
      let cur = edges[i];
      for (;;) {
        const candidates = byStart.get(key(cur.x1, cur.y1));
        if (!candidates) break;
        let next = -1;
        for (let c = 0; c < candidates.length; c++) {
          if (!used[candidates[c]]) { next = candidates[c]; break; }
        }
        if (next < 0) break;
        used[next] = true;
        cur = edges[next];
        loop.push(cur);
        if (cur.x1 === edges[i].x0 && cur.y1 === edges[i].y0) break;
      }
      loops.push(loop);
    }
    return loops;
  }

  function loopsToPath(loops) {
    const path = [];
    for (const loop of loops) {
      if (!loop.length) continue;
      path.push(MOVE, px(loop[0].x0), px(loop[0].y0));
      for (const e of loop) pushSeg(path, e);
      path.push(CLOSE);
    }
    return path;
  }

  function runToPath(run) {
    if (!run.segs.length) return [];
    const path = [MOVE, px(run.segs[0].x0), px(run.segs[0].y0)];
    for (const e of run.segs) pushSeg(path, e);
    return path;
  }

  function pushSeg(path, e) {
    if (e.cx == null) path.push(LINE, px(e.x1), px(e.y1));
    else path.push(QUAD, px(e.cx), px(e.cy), px(e.x1), px(e.y1));
  }

  /* Twips to pixels, rounded to a hundredth. A twip IS a hundredth of a
     pixel to within rounding (1/20 = 0.05), so this loses nothing — but
     without it every coordinate serialises as 17 digits of float noise, and
     a feature-length movie's paths come to 90MB of JSON instead of 17. */
  function px(twips) { return Math.round(twips * (100 / TWIPS)) / 100; }

  function pathBounds(path) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const touch = (px, py) => {
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
    };
    for (let i = 0; i < path.length;) {
      const op = path[i++];
      if (op === MOVE || op === LINE) { touch(path[i], path[i + 1]); i += 2; }
      else if (op === QUAD) { touch(path[i], path[i + 1]); touch(path[i + 2], path[i + 3]); i += 4; }
    }
    if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  function itemsBounds(items) {
    let b = null;
    for (const it of items) {
      const ib = pathBounds(it.path);
      if (!ib.width && !ib.height && !it.path.length) continue;
      const pad = it.stroke ? (it.stroke.width / TWIPS) / 2 : 0;
      const x0 = ib.x - pad, y0 = ib.y - pad, x1 = ib.x + ib.width + pad, y1 = ib.y + ib.height + pad;
      if (!b) b = { x0, y0, x1, y1 };
      else {
        b.x0 = Math.min(b.x0, x0); b.y0 = Math.min(b.y0, y0);
        b.x1 = Math.max(b.x1, x1); b.y1 = Math.max(b.y1, y1);
      }
    }
    if (!b) return { x: 0, y: 0, width: 0, height: 0 };
    return { x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0 };
  }

  /** Morph fill/line styles, keeping only the start of each pair. */
  function readMorphStyles(br, isV2) {
    let fillCount = br.u8();
    if (fillCount === 0xff) fillCount = br.u16();
    const fills = [];
    for (let i = 0; i < fillCount; i++) {
      const type = br.u8();
      if (type === 0x00) {
        const start = br.colorRGBA();
        br.colorRGBA();                 // end colour
        fills.push({ type: 'solid', color: start.color, alpha: start.alpha });
      } else if (type === 0x10 || type === 0x12) {
        const matrix = br.matrix();
        br.matrix();                    // end matrix
        const n = br.u8();
        const stops = [];
        for (let s = 0; s < n; s++) {
          const ratio = br.u8() / 255;
          const c = br.colorRGBA();
          br.u8(); br.colorRGBA();      // end ratio and colour
          stops.push({ ratio, color: c.color, alpha: c.alpha });
        }
        fills.push({ type: type === 0x10 ? 'linear' : 'radial', stops, matrix });
      } else if (type >= 0x40 && type <= 0x43) {
        const bitmapId = br.u16();
        const matrix = br.matrix();
        br.matrix();
        fills.push({ type: 'bitmap', bitmapId, matrix, repeat: true, smooth: true });
      } else {
        fills.push({ type: 'unknown', color: 0, alpha: 1 });
      }
    }
    let lineCount = br.u8();
    if (lineCount === 0xff) lineCount = br.u16();
    const lines = [];
    for (let i = 0; i < lineCount; i++) {
      const width = br.u16();
      br.u16();                         // end width
      if (!isV2) {
        const c = br.colorRGBA();
        br.colorRGBA();
        lines.push({ width, color: c.color, alpha: c.alpha, cap: 'round', join: 'round' });
        continue;
      }
      br.align();
      const startCap = br.ub(2);
      const join = br.ub(2);
      const hasFill = br.ub(1);
      br.ub(1); br.ub(1); br.ub(1); br.ub(5);
      br.ub(1);
      const endCap = br.ub(2);
      if (join === 2) br.fixed8();
      let color = 0x000000, alpha = 1;
      if (hasFill) {
        const f = readMorphStyles.readOneFill(br);
        color = f.color != null ? f.color : 0;
        alpha = f.alpha != null ? f.alpha : 1;
      } else {
        const c = br.colorRGBA();
        br.colorRGBA();
        color = c.color; alpha = c.alpha;
      }
      lines.push({
        width, color, alpha,
        cap: CAPS[startCap] || 'round', endCap: CAPS[endCap] || 'round',
        join: JOINS[join] || 'round'
      });
    }
    return { fills, lines };
  }
  readMorphStyles.readOneFill = function (br) {
    const type = br.u8();
    if (type === 0x00) { const c = br.colorRGBA(); br.colorRGBA(); return c; }
    br.matrix(); br.matrix();
    const n = br.u8();
    let last = { color: 0x808080, alpha: 1 };
    for (let i = 0; i < n; i++) { br.u8(); last = br.colorRGBA(); br.u8(); br.colorRGBA(); }
    return last;
  };

  // -------------------- fonts & text --------------------
  /* Glyph outlines live in the font, and a DefineText only names glyph
     indices — so the *text* of a Flash movie is only recoverable by pairing
     the two. DefineFont2/3 also carry a code table, which is what turns
     "glyph 37" back into "a". */
  function parseFontGlyphs(br, count, offsetBase, wideOffsets, version, hasEndOffset) {
    const offsets = [];
    for (let i = 0; i < count; i++) offsets.push(wideOffsets ? br.u32() : br.u16());
    /* DefineFont2/3 close the offset table with one extra entry marking the
       end of the last glyph; DefineFont 1 does not, and reading one anyway
       eats the first glyph's shape records. */
    const tableEnd = (count && hasEndOffset) ? (wideOffsets ? br.u32() : br.u16())
      : (br.end - offsetBase);
    const glyphs = [];
    for (let i = 0; i < count; i++) {
      const start = offsetBase + offsets[i];
      const end = offsetBase + (i + 1 < count ? offsets[i + 1] : tableEnd);
      try {
        const gr = new BitReader(br.bytes, start, Math.min(end, br.end));
        glyphs.push(parseShape(gr, version, false));
      } catch (e) {
        glyphs.push([]);
      }
    }
    return glyphs;
  }

  /** Scale a glyph's paths from EM units to a given point size. */
  function scalePath(path, s, dx, dy) {
    const out = path.slice();
    const at = (v, d) => Math.round((v * s + d) * 100) / 100;
    for (let i = 0; i < out.length;) {
      const op = out[i++];
      if (op === MOVE || op === LINE) { out[i] = at(out[i], dx); out[i + 1] = at(out[i + 1], dy); i += 2; }
      else if (op === QUAD) {
        out[i] = at(out[i], dx); out[i + 1] = at(out[i + 1], dy);
        out[i + 2] = at(out[i + 2], dx); out[i + 3] = at(out[i + 3], dy);
        i += 4;
      }
    }
    return out;
  }

  // -------------------- sound --------------------
  const SOUND_RATES = [5512, 11025, 22050, 44100];

  /** Wrap raw PCM in a WAV header so the editor can treat it as an asset. */
  function pcmToWav(data, rate, channels, bits) {
    const blockAlign = channels * (bits / 8);
    const out = new Uint8Array(44 + data.length);
    const dv = new DataView(out.buffer);
    const ascii = (off, s) => { for (let i = 0; i < s.length; i++) out[off + i] = s.charCodeAt(i); };
    ascii(0, 'RIFF'); dv.setUint32(4, 36 + data.length, true); ascii(8, 'WAVE');
    ascii(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, channels, true); dv.setUint32(24, rate, true);
    dv.setUint32(28, rate * blockAlign, true); dv.setUint16(32, blockAlign, true);
    dv.setUint16(34, bits, true);
    ascii(36, 'data'); dv.setUint32(40, data.length, true);
    out.set(data, 44);
    return out;
  }

  /* IMA ADPCM, which is what SWF means by "compressed" before MP3 came
     along. The step table is the standard 89-entry one; the index table
     depends on how many bits each sample was packed into, which the stream
     says up front. */
  var ADPCM_STEP = [
    7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41,
    45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190,
    209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724,
    796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272,
    2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132,
    7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500,
    20350, 22385, 24623, 27086, 29794, 32767
  ];
  var ADPCM_INDEX = {
    2: [-1, 2],
    3: [-1, -1, 2, 4],
    4: [-1, -1, -1, -1, 2, 4, 6, 8],
    5: [-1, -1, -1, -1, -1, -1, -1, -1, 1, 2, 4, 6, 8, 10, 13, 16]
  };

  /**
   * Decode an ADPCM sound to 16-bit PCM.
   *
   * The stream is a run of packets, each 4096 samples: a full 16-bit sample
   * and a step index per channel, then 4095 coded deltas of `bits` each.
   */
  function decodeADPCM(bytes, channels, sampleCount) {
    var br = new BitReader(bytes);
    var bits = br.ub(2) + 2;
    var indexTable = ADPCM_INDEX[bits];
    if (!indexTable) return null;
    var out = new Int16Array(sampleCount * channels);
    var at = 0;
    var sample = [0, 0], index = [0, 0];
    var signBit = 1 << (bits - 1);
    var mask = signBit - 1;

    while (at < out.length && br.pos < br.end) {
      for (var c = 0; c < channels; c++) {
        sample[c] = br.sb(16);
        index[c] = br.ub(6);
        if (at < out.length) out[at++] = sample[c];
      }
      for (var i = 1; i < 4096 && at < out.length; i++) {
        for (var ch = 0; ch < channels; ch++) {
          var code = br.ub(bits);
          var step = ADPCM_STEP[index[ch]];
          var delta = code & mask;
          /* The usual IMA reconstruction, written for any width: half a
             step, then a step shifted down once per bit. */
          var diff = step >> (bits - 1);
          for (var b = 0; b < bits - 1; b++) {
            if (delta & (1 << b)) diff += step >> (bits - 2 - b);
          }
          var value = sample[ch] + ((code & signBit) ? -diff : diff);
          sample[ch] = value > 32767 ? 32767 : (value < -32768 ? -32768 : value);
          index[ch] += indexTable[delta];
          if (index[ch] < 0) index[ch] = 0;
          if (index[ch] > 88) index[ch] = 88;
          if (at < out.length) out[at++] = sample[ch];
        }
      }
    }
    return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
  }

  /** Silence of a known length — a sound whose format we cannot decode, but
      whose place in the timeline we can still keep. */
  function silentPCM(sampleCount, channels) {
    return new Uint8Array(Math.max(0, sampleCount) * channels * 2);
  }

  // -------------------- bitmaps --------------------
  /* SWF's own JPEG quirk: the data may begin with an EOI/SOI pair that no
     decoder accepts. Strip it. */
  function stripJPEGPrefix(bytes) {
    if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd9 &&
        bytes[2] === 0xff && bytes[3] === 0xd8) return bytes.subarray(4);
    return bytes;
  }

  function concatBytes(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0); out.set(b, a.length);
    return out;
  }

  function sniffImageMime(bytes) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
    if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
    return 'image/jpeg';
  }

  /** DefineBitsLossless pixel data → RGBA, once inflated. */
  function losslessToRGBA(format, width, height, colorTableSize, raw, hasAlpha) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    if (format === 3) {
      const entry = hasAlpha ? 4 : 3;
      const tableBytes = (colorTableSize + 1) * entry;
      const stride = (width + 3) & ~3;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = raw[tableBytes + y * stride + x] || 0;
          const p = idx * entry;
          const o = (y * width + x) * 4;
          rgba[o] = raw[p]; rgba[o + 1] = raw[p + 1]; rgba[o + 2] = raw[p + 2];
          rgba[o + 3] = hasAlpha ? raw[p + 3] : 255;
        }
      }
      return rgba;
    }
    if (format === 4) {                 // 15-bit, padded to 16, row-aligned to 4
      const stride = ((width * 2) + 3) & ~3;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const p = y * stride + x * 2;
          const v = (raw[p] << 8) | raw[p + 1];
          const o = (y * width + x) * 4;
          rgba[o] = ((v >> 10) & 0x1f) * 255 / 31;
          rgba[o + 1] = ((v >> 5) & 0x1f) * 255 / 31;
          rgba[o + 2] = (v & 0x1f) * 255 / 31;
          rgba[o + 3] = 255;
        }
      }
      return rgba;
    }
    // format 5: 24- or 32-bit, stored as (pix24) 0,R,G,B or (pix32) A,R,G,B
    const stride = width * 4;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * stride + x * 4;
        const o = (y * width + x) * 4;
        const a = hasAlpha ? raw[p] : 255;
        /* 32-bit lossless is premultiplied; undo it or every edge pixel
           comes out dark against its own alpha. */
        const f = hasAlpha && a ? 255 / a : 1;
        rgba[o] = Math.min(255, raw[p + 1] * f);
        rgba[o + 1] = Math.min(255, raw[p + 2] * f);
        rgba[o + 2] = Math.min(255, raw[p + 3] * f);
        rgba[o + 3] = a;
      }
    }
    return rgba;
  }

  // -------------------- tag codes --------------------
  const TAG = {
    End: 0, ShowFrame: 1, DefineShape: 2, PlaceObject: 4, RemoveObject: 5,
    DefineBits: 6, DefineButton: 7, JPEGTables: 8, SetBackgroundColor: 9,
    DefineFont: 10, DefineText: 11, DoAction: 12, DefineFontInfo: 13,
    DefineSound: 14, StartSound: 15, DefineButtonSound: 17,
    SoundStreamHead: 18, SoundStreamBlock: 19, DefineBitsLossless: 20,
    DefineBitsJPEG2: 21, DefineShape2: 22, DefineButtonCxform: 23,
    Protect: 24, PlaceObject2: 26, RemoveObject2: 28, DefineShape3: 32,
    DefineText2: 33, DefineButton2: 34, DefineBitsJPEG3: 35,
    DefineBitsLossless2: 36, DefineEditText: 37, DefineSprite: 39,
    FrameLabel: 43, SoundStreamHead2: 45, DefineMorphShape: 46,
    DefineFont2: 48, ExportAssets: 56, ImportAssets: 57, EnableDebugger: 58,
    DoInitAction: 59, DefineVideoStream: 60, VideoFrame: 61,
    DefineFontInfo2: 62, EnableDebugger2: 64, ScriptLimits: 65,
    SetTabIndex: 66, FileAttributes: 69, PlaceObject3: 70, ImportAssets2: 71,
    DefineFontAlignZones: 73, CSMTextSettings: 74, DefineFont3: 75,
    SymbolClass: 76, Metadata: 77, DefineScalingGrid: 78,
    DoABC: 82, DefineShape4: 83, DefineMorphShape2: 84,
    DefineSceneAndFrameLabelData: 86, DefineBinaryData: 87, DefineFontName: 88,
    StartSound2: 89, DefineBitsJPEG4: 90, DefineFont4: 91
  };

  const BLEND_MODES = [
    'normal', 'normal', 'layer', 'multiply', 'screen', 'lighten', 'darken',
    'difference', 'add', 'subtract', 'invert', 'alpha', 'erase', 'overlay',
    'hardlight'
  ];

  // -------------------- the parser --------------------
  class SWFParser {
    constructor() {
      this.doc = null;
    }

    async parse(buffer) {
      const head = new Uint8Array(buffer);
      if (head.length < 8) throw new Error('Not a SWF file (too short)');
      const sig = String.fromCharCode(head[0], head[1], head[2]);
      const version = head[3];
      if (sig !== 'FWS' && sig !== 'CWS' && sig !== 'ZWS') throw new Error('Not a SWF file');
      if (sig === 'ZWS') {
        throw new Error('LZMA-compressed SWF (ZWS) is not supported — re-save it uncompressed or as CWS');
      }

      const body = sig === 'FWS' ? head.subarray(8) : await inflate(head.subarray(8));
      const br = new BitReader(body);
      const bounds = br.rect();
      const fps = br.u16() / 256;
      const frameCount = br.u16();

      const doc = {
        source: 'swf',
        version,
        compressed: sig === 'CWS',
        bounds: {
          x: bounds.xMin / TWIPS, y: bounds.yMin / TWIPS,
          width: (bounds.xMax - bounds.xMin) / TWIPS,
          height: (bounds.yMax - bounds.yMin) / TWIPS
        },
        width: (bounds.xMax - bounds.xMin) / TWIPS,
        height: (bounds.yMax - bounds.yMin) / TWIPS,
        fps: fps || 12,
        frameCount,
        backgroundColor: 0xffffff,
        characters: {},
        fonts: {},
        exports: {},
        classes: {},
        timeline: { frames: [], labels: {} },
        scenes: [],
        hasAS3: false,
        /* One entry per DoABC tag: what classes it defined, as an outline.
           The bodies are a different virtual machine from AVM1 and are not
           decompiled — but a movie saying nothing about its own code is the
           worst of the options. */
        abc: [],
        as3FrameScripts: {},
        warnings: []
      };
      this.doc = doc;
      this.jpegTables = null;
      this.pendingBitmaps = [];

      doc.timeline = this._readTimeline(br, null);
      /* Bitmap payloads are zlib streams and decompression is async, so they
         are collected during the walk and finished here in one go. */
      await this._finishBitmaps();
      return doc;
    }

    _warn(msg) { this.doc.warnings.push(msg); }

    async _finishBitmaps() {
      for (const job of this.pendingBitmaps) {
        try {
          const raw = await inflate(job.data);
          job.character.rgba = losslessToRGBA(job.format, job.width, job.height,
            job.colorTableSize, raw, job.hasAlpha);
          delete job.character.pending;
        } catch (e) {
          this._warn('bitmap ' + job.character.id + ': ' + e.message);
        }
      }
      this.pendingBitmaps = [];
    }

    /**
     * Read tags until End, returning a timeline. Used for the root and, with
     * a bounded reader, for each DefineSprite.
     */
    _readTimeline(br, spriteId) {
      const doc = this.doc;
      const frames = [];
      const labels = {};
      let current = newFrame();

      function newFrame() {
        return { commands: [], actions: [], sounds: [], label: null };
      }

      while (br.pos < br.end) {
        br.align();
        if (br.pos + 2 > br.end) break;
        const ch = br.u16();
        const code = ch >> 6;
        let len = ch & 0x3f;
        if (len === 0x3f) len = br.u32();
        const end = Math.min(br.pos + len, br.end);
        const tagStart = br.pos;

        if (code === TAG.End) { br.pos = end; break; }

        try {
          this._readTag(code, br, end, current, frames, labels, spriteId);
        } catch (e) {
          this._warn('tag ' + code + ' at ' + tagStart + ': ' + e.message);
        }

        if (code === TAG.ShowFrame) {
          frames.push(current);
          current = newFrame();
        }
        br.align();
        br.pos = end;
      }
      if (current.commands.length || current.actions.length || current.sounds.length) {
        frames.push(current);
      }
      if (!frames.length) frames.push(newFrame());
      return { frames, labels };
    }

    _readTag(code, br, end, frame, frames, labels, spriteId) {
      const doc = this.doc;
      switch (code) {
      case TAG.ShowFrame:
        break;

      case TAG.SetBackgroundColor:
        doc.backgroundColor = br.colorRGB();
        break;

      case TAG.FrameLabel: {
        const name = br.string();
        labels[frames.length + 1] = name;
        frame.label = name;
        break;
      }

      case TAG.DefineShape:
      case TAG.DefineShape2:
      case TAG.DefineShape3:
      case TAG.DefineShape4: {
        const id = br.u16();
        const rect = br.rect();
        const isShape4 = code === TAG.DefineShape4;
        if (isShape4) {
          br.rect();                    // edge bounds
          br.align();
          br.ub(5);                     // reserved
          br.ub(1); br.ub(1); br.ub(1); // fill winding / non-scaling / scaling strokes
        }
        const version = code === TAG.DefineShape ? 1 : code === TAG.DefineShape2 ? 2
          : code === TAG.DefineShape3 ? 3 : 4;
        const sr = new BitReader(br.bytes, br.pos, end);
        const items = parseShape(sr, version, isShape4);
        doc.characters[id] = {
          kind: 'shape', id, items,
          bounds: {
            x: rect.xMin / TWIPS, y: rect.yMin / TWIPS,
            width: (rect.xMax - rect.xMin) / TWIPS,
            height: (rect.yMax - rect.yMin) / TWIPS
          }
        };
        break;
      }

      case TAG.DefineMorphShape:
      case TAG.DefineMorphShape2: {
        /* A morph is two shapes sharing one edge list. Flashy has no morph
           primitive, so what imports is the start shape — which is what the
           movie shows at ratio 0 anyway. Its styles are stored as start/end
           pairs, so they need their own reader before the ordinary shape
           records can be walked. */
        const id = br.u16();
        const rect = br.rect();
        br.rect();                      // end bounds
        if (code === TAG.DefineMorphShape2) { br.rect(); br.rect(); br.u8(); }
        br.u32();                       // offset to the end-shape edges
        const styles = readMorphStyles(br, code === TAG.DefineMorphShape2);
        const mr = new BitReader(br.bytes, br.pos, end);
        const items = parseShape(mr, 3, false, styles);
        doc.characters[id] = {
          kind: 'morph', id, items,
          bounds: {
            x: rect.xMin / TWIPS, y: rect.yMin / TWIPS,
            width: (rect.xMax - rect.xMin) / TWIPS,
            height: (rect.yMax - rect.yMin) / TWIPS
          }
        };
        this._warn('morph shape ' + id + ' imported as its start shape');
        break;
      }

      case TAG.DefineSprite: {
        const id = br.u16();
        const frameCount = br.u16();
        const sub = new BitReader(br.bytes, br.pos, end);
        const tl = this._readTimeline(sub, id);
        doc.characters[id] = {
          kind: 'sprite', id, frameCount: Math.max(frameCount, tl.frames.length),
          frames: tl.frames, labels: tl.labels
        };
        break;
      }

      case TAG.PlaceObject: {
        const id = br.u16();
        const depth = br.u16();
        const matrix = br.matrix();
        const cmd = { type: 'place', depth, id, matrix, move: false };
        if (br.pos < end) cmd.colorTransform = br.cxform(false);
        frame.commands.push(cmd);
        break;
      }

      case TAG.PlaceObject2:
      case TAG.PlaceObject3: {
        const cmd = this._readPlace(br, end, code === TAG.PlaceObject3);
        frame.commands.push(cmd);
        break;
      }

      case TAG.RemoveObject: {
        br.u16();
        frame.commands.push({ type: 'remove', depth: br.u16() });
        break;
      }
      case TAG.RemoveObject2:
        frame.commands.push({ type: 'remove', depth: br.u16() });
        break;

      case TAG.DoAction:
      case TAG.DoInitAction: {
        let initId = null;
        if (code === TAG.DoInitAction) initId = br.u16();
        const source = this._decompile(br.bytes, br.pos, end);
        if (code === TAG.DoInitAction) {
          const c = doc.characters[initId];
          if (c) (c.initScripts = c.initScripts || []).push(source);
          else (doc.initScripts = doc.initScripts || []).push({ id: initId, source });
        } else {
          frame.actions.push(source);
        }
        break;
      }

      case TAG.DoABC:
      case 72: {                        // DoABC1, the version without a name
        doc.hasAS3 = true;
        var abcStart = br.pos;
        var abcName = '';
        if (code === TAG.DoABC) {
          br.u32();                     // flags
          abcName = br.string();
          abcStart = br.pos;
        }
        if (!global.FlashyABC) {
          this._warn('ActionScript 3 (DoABC) is present; flashy-abc.js is not loaded');
          break;
        }
        try {
          var read = global.FlashyABC.read(br.bytes, abcStart, end);
          doc.abc.push({ name: abcName, classes: read.classes, outline: read.outline });
          for (var fr in read.frameScripts) {
            var n = parseInt(fr, 10);
            doc.as3FrameScripts[n] = doc.as3FrameScripts[n]
              ? doc.as3FrameScripts[n] + '\n' + read.frameScripts[fr]
              : read.frameScripts[fr];
          }
        } catch (e) {
          this._warn('ActionScript 3 block could not be read: ' + e.message);
        }
        break;
      }

      case TAG.ExportAssets: {
        const count = br.u16();
        for (let i = 0; i < count; i++) {
          const id = br.u16();
          const name = br.string();
          doc.exports[name] = id;
          if (doc.characters[id]) doc.characters[id].exportName = name;
        }
        break;
      }

      case TAG.SymbolClass: {
        const count = br.u16();
        for (let i = 0; i < count; i++) {
          const id = br.u16();
          const name = br.string();
          doc.classes[name] = id;
          if (doc.characters[id] && !doc.characters[id].exportName) {
            doc.characters[id].className = name;
          }
        }
        break;
      }

      case TAG.JPEGTables:
        this.jpegTables = br.bytes.subarray(br.pos, end);
        break;

      case TAG.DefineBits: {
        const id = br.u16();
        let data = stripJPEGPrefix(br.bytes.subarray(br.pos, end));
        if (this.jpegTables && this.jpegTables.length > 2) {
          /* DefineBits carries only the scan data; the tables live once in
             JPEGTables and have to be spliced back in before the SOI. */
          const tables = stripJPEGPrefix(this.jpegTables);
          data = concatBytes(tables.subarray(0, tables.length - 2), data);
        }
        doc.characters[id] = { kind: 'bitmap', id, mime: 'image/jpeg', data };
        break;
      }

      case TAG.DefineBitsJPEG2:
      case TAG.DefineBitsJPEG3:
      case TAG.DefineBitsJPEG4: {
        const id = br.u16();
        let dataEnd = end;
        if (code !== TAG.DefineBitsJPEG2) {
          const alphaOffset = br.u32();
          if (code === TAG.DefineBitsJPEG4) br.u16();   // deblock
          dataEnd = Math.min(br.pos + alphaOffset, end);
        }
        const data = stripJPEGPrefix(br.bytes.subarray(br.pos, dataEnd));
        doc.characters[id] = { kind: 'bitmap', id, mime: sniffImageMime(data), data };
        break;
      }

      case TAG.DefineBitsLossless:
      case TAG.DefineBitsLossless2: {
        const id = br.u16();
        const format = br.u8();
        const width = br.u16();
        const height = br.u16();
        const colorTableSize = format === 3 ? br.u8() : 0;
        const character = { kind: 'bitmap', id, width, height, pending: true };
        doc.characters[id] = character;
        this.pendingBitmaps.push({
          character, format, width, height, colorTableSize,
          hasAlpha: code === TAG.DefineBitsLossless2,
          data: br.bytes.slice(br.pos, end)
        });
        break;
      }

      case TAG.DefineFont: {
        const id = br.u16();
        const base = br.pos;
        /* DefineFont 1 has no glyph count: the first offset is the size of
           the offset table, so it divides out to the number of glyphs. */
        const first = br.u16();
        const count = first / 2;
        br.pos = base;
        const glyphs = parseFontGlyphs(br, count, base, false, 1, false);
        doc.fonts[id] = { id, name: '', glyphs, codes: null, emSize: 1024 };
        break;
      }

      case TAG.DefineFont2:
      case TAG.DefineFont3: {
        const id = br.u16();
        br.align();
        const hasLayout = br.ub(1);
        br.ub(1);                       // shift JIS
        br.ub(1);                       // small text
        br.ub(1);                       // ANSI
        const wideOffsets = br.ub(1);
        const wideCodes = br.ub(1);
        const italic = br.ub(1);
        const bold = br.ub(1);
        br.u8();                        // language code
        const name = br.lenString();
        const count = br.u16();
        const base = br.pos;
        const glyphs = parseFontGlyphs(br, count, base, !!wideOffsets,
          code === TAG.DefineFont3 ? 3 : 2, true);
        /* The code table starts where the glyph shapes end, which the last
           entry of the offset table points at. */
        br.pos = this._glyphTableEnd(br, base, count, !!wideOffsets);
        const codes = [];
        for (let i = 0; i < count && br.pos < br.end; i++) {
          codes.push(wideCodes ? br.u16() : br.u8());
        }
        let advances = null;
        if (hasLayout) {
          try {
            br.s16(); br.s16(); br.s16();  // ascent, descent, leading
            advances = [];
            for (let i = 0; i < count; i++) advances.push(br.s16());
          } catch (e) { advances = null; }
        }
        doc.fonts[id] = {
          id, name, glyphs, codes, advances, bold: !!bold, italic: !!italic,
          emSize: code === TAG.DefineFont3 ? 20480 : 1024
        };
        break;
      }

      case TAG.DefineFontName: {
        const id = br.u16();
        const name = br.string();
        if (doc.fonts[id] && !doc.fonts[id].name) doc.fonts[id].name = name;
        break;
      }

      case TAG.DefineText:
      case TAG.DefineText2: {
        const id = br.u16();
        const rect = br.rect();
        const matrix = br.matrix();
        const glyphBits = br.u8();
        const advanceBits = br.u8();
        const withAlpha = code === TAG.DefineText2;
        const runs = this._readTextRecords(br, end, glyphBits, advanceBits, withAlpha);
        doc.characters[id] = {
          kind: 'text', id, matrix, runs,
          items: this._textToItems(runs),
          text: runs.map(r => r.text).join(''),
          bounds: {
            x: rect.xMin / TWIPS, y: rect.yMin / TWIPS,
            width: (rect.xMax - rect.xMin) / TWIPS,
            height: (rect.yMax - rect.yMin) / TWIPS
          }
        };
        break;
      }

      case TAG.DefineEditText: {
        const id = br.u16();
        const rect = br.rect();
        br.align();
        const hasText = br.ub(1);
        const wordWrap = br.ub(1);
        const multiline = br.ub(1);
        const password = br.ub(1);
        const readOnly = br.ub(1);
        const hasColor = br.ub(1);
        const hasMaxLength = br.ub(1);
        const hasFont = br.ub(1);
        const hasFontClass = br.ub(1);
        const autoSize = br.ub(1);
        const hasLayout = br.ub(1);
        br.ub(1);                       // no select
        const border = br.ub(1);
        br.ub(1);                       // was static
        const html = br.ub(1);
        const useOutlines = br.ub(1);
        let fontId = null, fontHeight = 240, fontClass = null;
        if (hasFont) { fontId = br.u16(); }
        if (hasFontClass) fontClass = br.string();
        if (hasFont) fontHeight = br.u16();
        let color = 0x000000, alpha = 1;
        if (hasColor) { const c = br.colorRGBA(); color = c.color; alpha = c.alpha; }
        if (hasMaxLength) br.u16();
        let align = 0, leading = 0;
        if (hasLayout) {
          align = br.u8();
          br.u16(); br.u16(); br.u16();  // left/right/indent margins
          leading = br.s16();
        }
        const variableName = br.string();
        const initialText = hasText ? br.string() : '';
        doc.characters[id] = {
          kind: 'edittext', id, fontId, fontClass, fontHeight: fontHeight / TWIPS,
          color, alpha, align: ['left', 'right', 'center', 'justify'][align] || 'left',
          leading: leading / TWIPS, multiline: !!multiline, wordWrap: !!wordWrap,
          password: !!password, readOnly: !!readOnly, border: !!border,
          html: !!html, useOutlines: !!useOutlines, autoSize: !!autoSize,
          variableName, text: stripHTML(initialText, !!html),
          bounds: {
            x: rect.xMin / TWIPS, y: rect.yMin / TWIPS,
            width: (rect.xMax - rect.xMin) / TWIPS,
            height: (rect.yMax - rect.yMin) / TWIPS
          }
        };
        break;
      }

      case TAG.DefineButton: {
        const id = br.u16();
        const states = this._readButtonRecords(br, end, false);
        const source = this._decompile(br.bytes, br.pos, end);
        doc.characters[id] = {
          kind: 'button', id, states,
          handlers: source ? [{ conditions: ['release'], source }] : []
        };
        break;
      }

      case TAG.DefineButton2: {
        const id = br.u16();
        br.u8();                        // track as menu
        /* The offset counts from the START of this field, which is the only
           reliable way in: deriving the position from where record parsing
           happens to stop drifts by a byte on anything with filters or a
           blend mode, and a one-byte drift decompiles the handler as
           garbage or as nothing at all. */
        const offsetField = br.pos;
        const actionOffset = br.u16();
        const states = this._readButtonRecords(br, end, true);
        const handlers = [];
        if (actionOffset) {
          let p = offsetField + actionOffset;
          while (p < end) {
            const sub = new BitReader(br.bytes, p, end);
            const size = sub.u16();
            const conditions = sub.u16();
            const stop = size ? Math.min(p + size, end) : end;
            const source = this._decompile(br.bytes, sub.pos, stop);
            handlers.push({
              conditions: global.FlashyAVM1
                ? global.FlashyAVM1.buttonConditionNames(conditions) : [],
              conditionFlags: conditions, source
            });
            if (!size) break;
            p += size;
          }
        }
        doc.characters[id] = { kind: 'button', id, states, handlers };
        break;
      }

      case TAG.DefineSound: {
        const id = br.u16();
        br.align();
        const format = br.ub(4);
        const rateIdx = br.ub(2);
        const is16 = br.ub(1);
        const stereo = br.ub(1);
        const sampleCount = br.u32();
        const rate = SOUND_RATES[rateIdx] || 44100;
        const raw = br.bytes.subarray(br.pos, end);
        const sound = {
          kind: 'sound', id, format, rate, sampleCount,
          stereo: !!stereo, bits: is16 ? 16 : 8
        };
        if (format === 2) {
          /* MP3 in SWF has a 2-byte seek-sample prefix before the frames. */
          sound.mime = 'audio/mpeg';
          sound.data = raw.subarray(2);
        } else if (format === 0 || format === 3) {
          sound.mime = 'audio/wav';
          sound.data = pcmToWav(raw, rate, stereo ? 2 : 1, is16 ? 16 : 8);
        } else if (format === 1) {
          var pcm = null;
          try { pcm = decodeADPCM(raw, stereo ? 2 : 1, sampleCount); }
          catch (e) { pcm = null; }
          if (pcm) {
            sound.mime = 'audio/wav';
            sound.data = pcmToWav(pcm, rate, stereo ? 2 : 1, 16);
            sound.decoded = 'ADPCM';
          } else {
            sound.unsupported = 'ADPCM';
            this._warn('sound ' + id + ' is ADPCM and could not be decoded');
          }
        } else {
          /* Nellymoser (and the handful of other codecs) need a decoder this
             project does not have. Rather than drop the sound — which loses
             its place on the timeline as well as its audio — keep silence of
             the right length, and say so. */
          sound.unsupported = format === 6 || format === 5 ? 'Nellymoser'
            : format === 4 ? 'Nellymoser 16kHz' : 'format ' + format;
          sound.mime = 'audio/wav';
          sound.data = pcmToWav(silentPCM(sampleCount, stereo ? 2 : 1), rate, stereo ? 2 : 1, 16);
          sound.silent = true;
          this._warn('sound ' + id + ' is ' + sound.unsupported + ', which Flashy cannot ' +
            'decode; it was imported as silence of the same length so the timing survives');
        }
        doc.characters[id] = sound;
        break;
      }

      case TAG.StartSound: {
        const id = br.u16();
        const info = this._readSoundInfo(br);
        frame.sounds.push({ id, info });
        break;
      }
      case TAG.StartSound2: {
        const className = br.string();
        const info = this._readSoundInfo(br);
        frame.sounds.push({ className, info });
        break;
      }

      case TAG.DefineSceneAndFrameLabelData: {
        const sceneCount = readEncodedU32(br);
        for (let i = 0; i < sceneCount; i++) {
          const offset = readEncodedU32(br);
          doc.scenes.push({ frame: offset + 1, name: br.string() });
        }
        const labelCount = readEncodedU32(br);
        for (let i = 0; i < labelCount; i++) {
          const f = readEncodedU32(br);
          labels[f + 1] = br.string();
        }
        break;
      }

      default:
        /* Deliberately not guessed at — the tag length takes us past it. */
        break;
      }
    }

    /** Where a DefineFont2/3 glyph table ends — i.e. where its codes start. */
    _glyphTableEnd(br, base, count, wideOffsets) {
      if (!count) return base;
      const save = br.pos;
      br.pos = base + count * (wideOffsets ? 4 : 2);
      const tableEnd = wideOffsets ? br.u32() : br.u16();
      br.pos = save;
      return base + tableEnd;
    }

    _readPlace(br, end, isV3) {
      const flags = br.u8();
      let flags2 = 0;
      if (isV3) flags2 = br.u8();
      const depth = br.u16();
      const cmd = { type: 'place', depth, move: !!(flags & 0x01) };

      if (isV3 && (flags2 & 0x08)) cmd.className = br.string();
      if (isV3 && (flags2 & 0x10)) cmd.isImage = true;
      if (flags & 0x02) cmd.id = br.u16();
      if (flags & 0x04) cmd.matrix = br.matrix();
      if (flags & 0x08) cmd.colorTransform = br.cxform(true);
      if (flags & 0x10) cmd.ratio = br.u16();
      if (flags & 0x20) cmd.name = br.string();
      if (flags & 0x40) cmd.clipDepth = br.u16();
      if (isV3) {
        if (flags2 & 0x01) cmd.filters = this._readFilters(br);
        if (flags2 & 0x02) cmd.blendMode = BLEND_MODES[br.u8()] || 'normal';
        if (flags2 & 0x04) cmd.cacheAsBitmap = !!br.u8();
        if (flags2 & 0x20) { br.u8(); /* visible */ }
        if (flags2 & 0x40) { br.colorARGB(); /* background colour */ }
      }
      if (flags & 0x80) cmd.clipActions = this._readClipActions(br, end);
      return cmd;
    }

    _readFilters(br) {
      const count = br.u8();
      const out = [];
      for (let i = 0; i < count; i++) {
        const id = br.u8();
        const filter = { id };
        switch (id) {
        case 0: filter.type = 'dropShadow'; br.colorRGBA(); br.s32(); br.s32(); br.s32(); br.s32(); br.u8(); break;
        case 1: filter.type = 'blur'; br.u32(); br.u32(); br.u8(); break;
        case 2: filter.type = 'glow'; br.colorRGBA(); br.s32(); br.s32(); br.s32(); br.u8(); break;
        case 3: filter.type = 'bevel'; br.colorRGBA(); br.colorRGBA(); br.s32(); br.s32(); br.s32(); br.s32(); br.s32(); br.u8(); break;
        case 4: case 5: {
          filter.type = id === 4 ? 'gradientGlow' : 'gradientBevel';
          const n = br.u8();
          for (let g = 0; g < n; g++) br.colorRGBA();
          for (let g2 = 0; g2 < n; g2++) br.u8();
          br.s32(); br.s32(); br.s32(); br.s32(); br.s32(); br.u8();
          break;
        }
        case 6: {
          filter.type = 'colorMatrix';
          filter.matrix = [];
          for (let m = 0; m < 20; m++) filter.matrix.push(br.f32());
          break;
        }
        case 7: {
          filter.type = 'convolution';
          const cx = br.u8(), cy = br.u8();
          br.f32(); br.f32();
          for (let k = 0; k < cx * cy; k++) br.f32();
          br.colorRGBA(); br.u8();
          break;
        }
        default: return out;            // unknown filter: stop, do not drift
        }
        out.push(filter);
      }
      return out;
    }

    _readClipActions(br, end) {
      /* The event flag fields widened from 16 to 32 bits in SWF 6. Reading
         the wrong width walks off the end of every handler after the first. */
      const wide = this.doc.version >= 6;
      br.u16();                         // reserved
      if (wide) br.u32(); else br.u16();  // all event flags
      const out = [];
      while (br.pos < end) {
        const flags = wide ? br.u32() : br.u16();
        if (!flags) break;
        const size = br.u32();
        const stop = Math.min(br.pos + size, end);
        let start = br.pos;
        if (flags & 0x00020000) start += 1;  // keyPress code
        const source = this._decompile(br.bytes, start, stop);
        out.push({
          flags,
          events: global.FlashyAVM1 ? global.FlashyAVM1.clipEventNames(flags) : [],
          source
        });
        br.pos = stop;
      }
      return out;
    }

    _readSoundInfo(br) {
      br.align();
      br.ub(2);
      const stop = br.ub(1);
      const noMultiple = br.ub(1);
      const hasEnvelope = br.ub(1);
      const hasLoops = br.ub(1);
      const hasOutPoint = br.ub(1);
      const hasInPoint = br.ub(1);
      const info = { stop: !!stop, noMultiple: !!noMultiple, loops: 1 };
      if (hasInPoint) info.inPoint = br.u32();
      if (hasOutPoint) info.outPoint = br.u32();
      if (hasLoops) info.loops = br.u16();
      if (hasEnvelope) {
        const n = br.u8();
        for (let i = 0; i < n; i++) { br.u32(); br.u16(); br.u16(); }
      }
      return info;
    }

    _readButtonRecords(br, end, isV2) {
      const states = { up: [], over: [], down: [], hit: [] };
      while (br.pos < end) {
        br.align();
        const flags = br.u8();
        if (!flags) break;
        const record = {
          hit: !!(flags & 0x08), down: !!(flags & 0x04),
          over: !!(flags & 0x02), up: !!(flags & 0x01)
        };
        record.id = br.u16();
        record.depth = br.u16();
        record.matrix = br.matrix();
        if (isV2) record.colorTransform = br.cxform(true);
        if (isV2 && (flags & 0x10)) this._readFilters(br);
        if (isV2 && (flags & 0x20)) br.u8();   // blend mode
        if (record.up) states.up.push(record);
        if (record.over) states.over.push(record);
        if (record.down) states.down.push(record);
        if (record.hit) states.hit.push(record);
      }
      return states;
    }

    _readTextRecords(br, end, glyphBits, advanceBits, withAlpha) {
      const runs = [];
      let fontId = null, size = 12, color = 0x000000, alpha = 1, x = 0, y = 0;
      while (br.pos < end) {
        br.align();
        const flags = br.u8();
        if (!flags) break;
        if (flags & 0x80) {
          if (flags & 0x08) fontId = br.u16();
          if (flags & 0x04) { const c = withAlpha ? br.colorRGBA() : { color: br.colorRGB(), alpha: 1 }; color = c.color; alpha = c.alpha; }
          if (flags & 0x01) x = br.s16();
          if (flags & 0x02) y = br.s16();
          if (flags & 0x08) size = br.u16();
          continue;
        }
        const count = flags & 0x7f;
        const glyphs = [];
        br.align();
        for (let i = 0; i < count; i++) {
          glyphs.push({ index: br.ub(glyphBits), advance: br.sb(advanceBits) });
        }
        br.align();
        const font = this.doc.fonts[fontId];
        let text = '';
        if (font && font.codes) {
          for (const g of glyphs) {
            const cp = font.codes[g.index];
            if (cp != null) text += String.fromCharCode(cp);
          }
        }
        runs.push({ fontId, font: font ? font.name : '', size: size / TWIPS, color, alpha, x, y, glyphs, text });
        /* Advance the pen so the next run starts where this one ended. */
        for (const g of glyphs) x += g.advance;
      }
      return runs;
    }

    /** Glyph outlines for a text character, in the character's own space. */
    _textToItems(runs) {
      const items = [];
      for (const run of runs) {
        const font = this.doc.fonts[run.fontId];
        if (!font || !font.glyphs) continue;
        /* Glyph outlines come out of parseShape already divided by 20, so a
           coordinate is `fontUnits / 20`. One em is `font.emSize` font units
           and should measure `run.size` px, which makes the factor
           `20 * size / emSize`. Getting this wrong is invisible in the
           structure and glaring on the stage. */
        const scale = (TWIPS * run.size) / font.emSize;
        let penX = run.x;
        for (const g of run.glyphs) {
          const glyph = font.glyphs[g.index];
          if (glyph) {
            for (const item of glyph) {
              if (!item.fill) continue;
              items.push({
                fill: { type: 'solid', color: run.color, alpha: run.alpha },
                stroke: null,
                path: scalePath(item.path, scale, penX / TWIPS, run.y / TWIPS)
              });
            }
          }
          penX += g.advance;
        }
      }
      return items;
    }

    _decompile(bytes, start, end) {
      if (end <= start) return '';
      if (!global.FlashyAVM1) return '// ActionScript present (flashy-avm1.js not loaded)';
      return global.FlashyAVM1.decompile(bytes, start, end);
    }
  }

  function stripHTML(text, isHTML) {
    if (!isHTML) return text;
    return String(text)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      .replace(/\n+$/, '');
  }

  /** SWF's variable-length u32, used by DefineSceneAndFrameLabelData. */
  function readEncodedU32(br) {
    let result = 0;
    for (let i = 0; i < 5; i++) {
      const b = br.u8();
      result |= (b & 0x7f) << (7 * i);
      if (!(b & 0x80)) break;
    }
    return result >>> 0;
  }

  // -------------------- model → display objects --------------------
  /** Decompose a SWF matrix into the position/scale/rotation Flashy uses. */
  function decomposeMatrix(m) {
    const scaleX = Math.sqrt(m.a * m.a + m.b * m.b) || 0;
    const scaleY = Math.sqrt(m.c * m.c + m.d * m.d) || 0;
    const rotation = Math.atan2(m.b, m.a);
    /* The second axis can be skewed relative to the first; Flashy's display
       objects have no skew, so it is reported for the importer to use. */
    const skew = Math.atan2(-m.c, m.d) - rotation;
    return {
      x: m.tx / TWIPS, y: m.ty / TWIPS,
      scaleX: m.a < 0 && Math.abs(rotation) < 1e-6 ? -scaleX : scaleX,
      scaleY,
      rotation, skew
    };
  }

  function gradientEndPoints(matrix) {
    /* SWF gradients are defined across a 32768-twip square centred on the
       origin and then transformed, so the end points are the transformed
       (-16384,0) and (16384,0). */
    const tp = (px, py) => ({
      x: (matrix.a * px + matrix.c * py + matrix.tx) / TWIPS,
      y: (matrix.b * px + matrix.d * py + matrix.ty) / TWIPS
    });
    return { from: tp(-16384, 0), to: tp(16384, 0), center: tp(0, 0) };
  }

  function applyFill(g, fill) {
    if (!fill) return false;
    if (fill.type === 'solid') { g.beginFill(fill.color, fill.alpha); return true; }
    if (fill.type === 'linear' || fill.type === 'radial') {
      const pts = gradientEndPoints(fill.matrix);
      const colors = fill.stops.map(s => s.color);
      const alphas = fill.stops.map(s => s.alpha);
      const ratios = fill.stops.map(s => s.ratio);
      if (fill.type === 'linear') {
        g.beginGradientFill('linear', colors, alphas, ratios, pts.from.x, pts.from.y, pts.to.x, pts.to.y);
      } else {
        g.beginGradientFill('radial', colors, alphas, ratios, pts.center.x, pts.center.y, pts.to.x, pts.to.y);
      }
      return true;
    }
    /* A bitmap fill has no engine equivalent yet — use the mid grey the old
       loader used, so the shape is at least visible and obviously a stand-in. */
    g.beginFill(0x999999, 1);
    return true;
  }

  function pathToGraphics(path, g) {
    for (let i = 0; i < path.length;) {
      const op = path[i++];
      if (op === MOVE) { g.moveTo(path[i], path[i + 1]); i += 2; }
      else if (op === LINE) { g.lineTo(path[i], path[i + 1]); i += 2; }
      else if (op === QUAD) { g.curveTo(path[i], path[i + 1], path[i + 2], path[i + 3]); i += 4; }
      else if (op === CLOSE) { /* Graphics closes a fill on endFill */ }
    }
  }

  function itemsToGraphics(items) {
    const g = new F.Graphics();
    for (const item of items) {
      const filled = applyFill(g, item.fill);
      if (item.stroke) {
        g.lineStyle(item.stroke.width / TWIPS, item.stroke.color, item.stroke.alpha,
          item.stroke.cap, item.stroke.join, item.stroke.miter);
      } else {
        g.lineStyle(0);
      }
      pathToGraphics(item.path, g);
      if (filled) g.endFill();
    }
    return g;
  }

  // -------------------- loader (live MovieClip) --------------------
  class SWFLoader {
    async loadURL(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error('SWF fetch failed: ' + res.status);
      return this.parse(await res.arrayBuffer());
    }
    async loadFile(file) { return this.parse(await file.arrayBuffer()); }

    /** Parse and build — the demo page's entry point. */
    async parse(buffer) {
      const doc = await new SWFParser().parse(buffer);
      return this.build(doc);
    }

    build(doc) {
      this.doc = doc;
      this._cache = {};
      const mc = this._buildTimeline(doc.timeline.frames, doc.timeline.labels);
      mc.loop = true;
      mc.swfInfo = {
        width: doc.width, height: doc.height, fps: doc.fps,
        frameCount: doc.frameCount, version: doc.version,
        backgroundColor: doc.backgroundColor,
        warnings: doc.warnings
      };
      mc.swfDocument = doc;
      return mc;
    }

    _instantiate(id) {
      const c = this.doc.characters[id];
      if (!c) return null;
      if (c.kind === 'shape' || c.kind === 'text' || c.kind === 'morph') {
        const s = new F.Shape();
        if (!this._cache[id]) this._cache[id] = itemsToGraphics(c.items || []);
        s.graphics = this._cache[id];
        return s;
      }
      if (c.kind === 'sprite') return this._buildTimeline(c.frames, c.labels);
      if (c.kind === 'button') {
        /* A button's up state is what it looks like at rest; that is the
           honest still for an engine with no button primitive. */
        const holder = new F.MovieClip();
        for (const rec of c.states.up) {
          const child = this._instantiate(rec.id);
          if (child) { applyMatrixTo(child, rec.matrix); holder.addChild(child); }
        }
        return holder;
      }
      if (c.kind === 'bitmap' && F.Bitmap) {
        const name = 'swf_bitmap_' + id;
        return new F.Bitmap(name);
      }
      return null;
    }

    /**
     * Build a MovieClip whose every frame restores the WHOLE display list,
     * not just that frame's changes.
     *
     * A SWF timeline is a stream of deltas, and replaying deltas only works
     * if you started at frame 1 and never jumped. `gotoAndStop(40)` would
     * then show whatever frame 40 happened to place — which on a real movie
     * is two objects out of thirty. So the cumulative state of every frame is
     * worked out once here, and the frame script diffs the display list
     * against it: anything already in place is left alone (so a nested sprite
     * keeps playing rather than restarting), anything missing is created, and
     * anything no longer there is removed.
     */
    _buildTimeline(frames, labels) {
      const mc = new F.MovieClip();
      const total = Math.max(1, frames.length);
      mc.timeline.setTotalFrames(total);
      if (labels) {
        for (const f in labels) {
          if (mc.timeline.addLabel) mc.timeline.addLabel(labels[f], parseInt(f, 10));
        }
      }
      const states = cumulativeStates(frames);
      const self = this;

      for (let i = 0; i < frames.length; i++) {
        const state = states[i];
        mc.timeline.addFrameScript(i + 1, function () {
          if (!this._depths) this._depths = {};
          // Remove what is no longer on this frame, or has been replaced.
          for (const d in this._depths) {
            const want = state[d];
            const have = this._depths[d];
            if (!want || want.id !== have._swfId) {
              have.removeFromParent();
              delete this._depths[d];
            }
          }
          // Add or update the rest, then restore depth order.
          const depths = Object.keys(state).map(Number).sort((a, b) => a - b);
          let changed = false;
          for (const depth of depths) {
            const want = state[depth];
            let inst = this._depths[depth];
            if (!inst) {
              inst = self._instantiate(want.id);
              if (!inst) continue;
              inst._swfId = want.id;
              inst._swfDepth = depth;
              this.addChild(inst);
              this._depths[depth] = inst;
              changed = true;
            }
            if (want.matrix) applyMatrixTo(inst, want.matrix);
            if (want.colorTransform) applyColorTransform(inst, want.colorTransform);
            if (want.name) inst.name = want.name;
          }
          if (changed) {
            for (const depth of depths) {
              const inst = this._depths[depth];
              if (inst) this.addChild(inst);     // addChild moves to the top
            }
          }
        });
      }
      return mc;
    }
  }

  /** The complete display-list state of every frame, not just its changes. */
  function cumulativeStates(frames) {
    const current = {};
    const out = [];
    for (const frame of frames) {
      for (const cmd of frame.commands) {
        if (cmd.type === 'remove') { delete current[cmd.depth]; continue; }
        if (cmd.type !== 'place') continue;
        const prev = current[cmd.depth];
        const keep = cmd.move && prev && (cmd.id == null || cmd.id === prev.id);
        const st = keep
          ? { id: prev.id, matrix: prev.matrix, colorTransform: prev.colorTransform, name: prev.name }
          : { id: cmd.id, matrix: null, colorTransform: null, name: '' };
        if (cmd.id != null) st.id = cmd.id;
        if (cmd.matrix) st.matrix = cmd.matrix;
        if (cmd.colorTransform) st.colorTransform = cmd.colorTransform;
        if (cmd.name) st.name = cmd.name;
        if (st.id == null) continue;
        current[cmd.depth] = st;
      }
      const snap = {};
      for (const d in current) snap[d] = current[d];
      out.push(snap);
    }
    return out;
  }

  function applyMatrixTo(node, m) {
    const d = decomposeMatrix(m);
    node.x = d.x; node.y = d.y;
    node.scaleX = d.scaleX; node.scaleY = d.scaleY;
    node.rotation = d.rotation;
  }

  function applyColorTransform(node, cx) {
    if (cx && cx.mul && cx.mul.length >= 4) node.alpha = Math.max(0, Math.min(1, cx.mul[3]));
  }

  F.SWF = {
    parse: (buffer) => new SWFParser().parse(buffer),
    Parser: SWFParser,
    decomposeMatrix,
    gradientEndPoints,
    itemsToGraphics,
    buildItems,
    decodeADPCM,
    pathBounds,
    itemsBounds,
    TWIPS,
    CMD: { MOVE, LINE, QUAD, CLOSE }
  };
  F.SWFLoader = SWFLoader;
})(typeof window !== 'undefined' ? window : this);
