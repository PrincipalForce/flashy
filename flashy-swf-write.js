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
    FileAttributes: 69,
    /* The rest of what a real movie needs: scripts, sound, bitmaps, fonts and
       text, and PlaceObject3 for the filter list. Every one of these is
       already understood by the reader in flashy-swf.js, which is what makes
       it a usable oracle for the writer. */
    DoAction: 12, DefineSound: 14, StartSound: 15,
    DefineBitsLossless2: 36, DefineBitsJPEG2: 21,
    DefineFont2: 48, DefineText2: 33, PlaceObject3: 70,
    DefineShape4: 83
  };

  /* ------------------------------------------------------------------ *
   * zlib, by the shortest honest route
   *
   * DefineBitsLossless wants its pixels zlib-compressed, and there is no
   * compressor here. But deflate has a STORED block type -- literally "the
   * next N bytes, uncompressed" -- and a stream of stored blocks is a valid
   * deflate stream. Wrapped in a zlib header and an Adler-32 it is a zlib
   * stream every inflater accepts, including the reader in flashy-swf.js that
   * these tests check against.
   *
   * It compresses nothing, which is the honest trade: a 32-bit bitmap comes
   * out the size of its pixels. Writing a real deflate encoder is a project
   * of its own, and shipping a file that cannot be opened at all would be
   * worse than shipping a big one.
   * ------------------------------------------------------------------ */
  function adler32(bytes) {
    var a = 1, b = 0;
    for (var i = 0; i < bytes.length; i++) {
      a = (a + bytes[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b * 65536) + a) >>> 0;
  }

  function zlibStore(bytes) {
    var out = [];
    // CMF 0x78: deflate with a 32K window. FLG 0x01 makes the pair's checksum
    // a multiple of 31, which the spec requires.
    out.push(0x78, 0x01);
    var MAX = 65535;                 // the largest a stored block can be
    var at = 0;
    do {
      var len = Math.min(MAX, bytes.length - at);
      var last = (at + len >= bytes.length) ? 1 : 0;
      out.push(last);                // BFINAL in bit 0, BTYPE 00 = stored
      out.push(len & 0xff, (len >> 8) & 0xff);
      out.push(~len & 0xff, (~len >> 8) & 0xff);
      for (var i = 0; i < len; i++) out.push(bytes[at + i]);
      at += len;
    } while (at < bytes.length);
    var sum = adler32(bytes);
    out.push((sum >>> 24) & 0xff, (sum >>> 16) & 0xff,
             (sum >>> 8) & 0xff, sum & 0xff);
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Bitmaps
   *
   * Two routes, and which is used depends on what the document holds. A JPEG
   * goes in as DefineBitsJPEG2 BYTE FOR BYTE -- it is already compressed and
   * re-encoding it would only lose quality. Anything else is decoded to
   * pixels and written as DefineBitsLossless2, the only format in the file
   * that is lossless and the only one that carries alpha.
   * ------------------------------------------------------------------ */

  /**
   * The bytes of a bitmap asset.
   *
   * A document stores RAW base64 plus a separate `mediaType` -- the data URL
   * is assembled on demand by the editor -- so both shapes are accepted
   * here. Taking only one would work until the day the other turned up.
   */
  function base64Bytes(b64) {
    var s = String(b64 || '');
    var at = s.indexOf(',');
    if (/^data:/.test(s) && at >= 0) s = s.slice(at + 1);
    var bin;
    try { bin = atob(s); } catch (e) { return null; }
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /**
   * An image's pixels, by drawing it.
   *
   * Synchronous, which a decode is not -- so the image has to be loaded
   * already. The editor keeps decoded images for the stage and hands one in;
   * this writer never loads anything itself.
   */
  function bitmapPixels(img) {
    if (!img || typeof document === 'undefined') return null;
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    try { return { w: w, h: h, data: ctx.getImageData(0, 0, w, h).data }; }
    catch (e) { return null; }       // a cross-origin image: nothing to read
  }

  /** DefineBitsLossless2: 32-bit ARGB, premultiplied, zlib-wrapped. */
  function losslessBody(id, px) {
    var w = new Writer();
    w.u16(id);
    w.u8(5);                         // format 5: 32-bit ARGB
    w.u16(px.w);
    w.u16(px.h);
    var raw = new Uint8Array(px.w * px.h * 4);
    for (var i = 0, n = px.w * px.h; i < n; i++) {
      var a = px.data[i * 4 + 3];
      /* SWF's ARGB is PREMULTIPLIED and canvas's is not. Skipping this makes
         every semi-transparent pixel too bright -- a 50% red reads as pink
         over black instead of dark red. */
      var k = a / 255;
      raw[i * 4] = a;
      raw[i * 4 + 1] = Math.round(px.data[i * 4] * k);
      raw[i * 4 + 2] = Math.round(px.data[i * 4 + 1] * k);
      raw[i * 4 + 3] = Math.round(px.data[i * 4 + 2] * k);
    }
    w.bytesOf(zlibStore(raw));
    return w;
  }

  /** DefineBitsJPEG2: the original bytes, untouched. */
  function jpegBody(id, bytes) {
    var w = new Writer();
    w.u16(id);
    w.bytesOf(bytes);
    return w;
  }

  /* ------------------------------------------------------------------ *
   * Sound
   *
   * DefineSound with uncompressed PCM. No MP3 encoder is needed, because SWF
   * has always allowed raw samples -- format 0 -- and the decoded buffer is
   * already there for the stage to play.
   *
   * Big, like the bitmaps, and for the same reason: the alternative is a .swf
   * with no audio in it at all.
   * ------------------------------------------------------------------ */

  /* SWF has four sample rates and they are an enum, not a number. Anything
     else has to be resampled, so the nearest is chosen and the samples are
     stretched to match. */
  var SWF_RATES = [5512, 11025, 22050, 44100];

  function nearestSWFRate(rate) {
    var best = 0;
    for (var i = 1; i < SWF_RATES.length; i++) {
      if (Math.abs(SWF_RATES[i] - rate) < Math.abs(SWF_RATES[best] - rate)) best = i;
    }
    return best;
  }

  /** DefineSound: 16-bit PCM, little-endian, at one of SWF's four rates. */
  function soundBody(id, buffer) {
    var rateIdx = nearestSWFRate(buffer.sampleRate);
    var rate = SWF_RATES[rateIdx];
    var stereo = buffer.numberOfChannels > 1 ? 1 : 0;
    var chans = [];
    for (var c = 0; c <= stereo; c++) chans.push(buffer.getChannelData(c));
    var ratio = rate / buffer.sampleRate;
    var count = Math.max(1, Math.floor(chans[0].length * ratio));

    var w = new Writer();
    w.u16(id);
    /* One packed byte: format, rate, size, type. Written as bit fields rather
       than arithmetic so the order is visible and checkable against the
       spec. */
    w.ub(4, 0);                      // format 0: uncompressed, little-endian
    w.ub(2, rateIdx);
    w.ub(1, 1);                      // 16-bit
    w.ub(1, stereo);
    w.align();
    w.u32(count);                    // sample COUNT, per channel
    for (var i = 0; i < count; i++) {
      for (var ch = 0; ch < chans.length; ch++) {
        var at = i / ratio;
        var i0 = Math.floor(at), i1 = Math.min(chans[ch].length - 1, i0 + 1);
        var t = at - i0;
        var v = chans[ch][i0] * (1 - t) + chans[ch][i1] * t;
        v = Math.max(-1, Math.min(1, v));
        w.i16(v < 0 ? Math.round(v * 0x8000) : Math.round(v * 0x7fff));
      }
    }
    return { writer: w, samples: count, rate: rate, stereo: !!stereo };
  }

  /** StartSound: play a defined sound on this frame. */
  function startSoundBody(id, opts) {
    opts = opts || {};
    var w = new Writer();
    w.u16(id);
    // SOUNDINFO. Everything optional is left out.
    var loops = Math.max(0, Math.min(65535, opts.loops || 0));
    w.ub(2, 0);                      // reserved
    w.ub(1, 0);                      // SyncStop
    w.ub(1, opts.noMultiple ? 1 : 0);
    w.ub(1, 0);                      // HasEnvelope
    w.ub(1, loops > 1 ? 1 : 0);      // HasLoops
    w.ub(1, 0);                      // HasOutPoint
    w.ub(1, 0);                      // HasInPoint
    w.align();
    if (loops > 1) w.u16(loops);
    return w;
  }

  /* ------------------------------------------------------------------ *
   * Fonts and text
   *
   * DefineFont2 carries glyph outlines as shape records, and Flashy already
   * has those: embedding traces each glyph into a 0..1 em path with the
   * project's own tracer. So the font tag is a unit conversion -- em
   * fractions into SWF's 1024-per-em grid -- rather than a font parser.
   *
   * A field whose face has not been embedded cannot be written: the glyphs
   * ARE the text in a DefineText, so there is nothing to emit. That is
   * reported, with the fix named, rather than silently dropping the words.
   * ------------------------------------------------------------------ */

  var EM_UNITS = 1024;               // SWF's em square for DefineFont2

  /**
   * One glyph's outline as a SWF SHAPE.
   *
   * No style arrays: a glyph's fill comes from the DefineText that uses it,
   * which is why both counts are zero and the fill index is one bit wide
   * carrying the value 1.
   */
  function glyphShape(path) {
    var w = new Writer();
    w.ub(4, 0);                      // FillStyleCount
    w.ub(4, 0);                      // LineStyleCount
    w.ub(4, 1);                      // NumFillBits
    w.ub(4, 0);                      // NumLineBits

    var penX = 0, penY = 0;
    var em = function (v) { return Math.round(v * EM_UNITS); };
    var first = true;

    var cmds = path || [];
    for (var i = 0; i < cmds.length;) {
      var op = cmds[i];
      if (op === 0) {                // moveTo
        var mx = em(cmds[i + 1]), my = em(cmds[i + 2]);
        var dx = mx - penX, dy = my - penY;
        var bits = Math.max(Writer.bitsFor(dx), Writer.bitsFor(dy));
        w.ub(1, 0);                  // a style-change record
        w.ub(1, 0);                  // StateNewStyles
        w.ub(1, 0);                  // StateLineStyle
        w.ub(1, 0);                  // StateFillStyle1
        w.ub(1, first ? 1 : 0);      // StateFillStyle0, set once
        w.ub(1, 1);                  // StateMoveTo
        w.ub(5, bits);
        w.sb(bits, dx);
        w.sb(bits, dy);
        if (first) { w.ub(1, 1); first = false; }   // FillStyle0 = index 1
        penX = mx; penY = my;
        i += 3;
      } else if (op === 1) {          // lineTo
        var lx = em(cmds[i + 1]), ly = em(cmds[i + 2]);
        var ldx = lx - penX, ldy = ly - penY;
        i += 3;
        if (!ldx && !ldy) continue;
        var lb = Math.max(2, Math.max(Writer.bitsFor(ldx), Writer.bitsFor(ldy)));
        w.ub(1, 1);                  // an edge
        w.ub(1, 1);                  // straight
        w.ub(4, lb - 2);
        if (ldx && ldy) { w.ub(1, 1); w.sb(lb, ldx); w.sb(lb, ldy); }
        else if (ldx) { w.ub(1, 0); w.ub(1, 0); w.sb(lb, ldx); }
        else { w.ub(1, 0); w.ub(1, 1); w.sb(lb, ldy); }
        penX = lx; penY = ly;
      } else if (op === 2) {          // quadTo
        var cx = em(cmds[i + 1]), cy = em(cmds[i + 2]);
        var ax = em(cmds[i + 3]), ay = em(cmds[i + 4]);
        /* Both deltas are relative to where the pen has got to: the control
           from the pen, and the anchor from the CONTROL. Measuring the second
           from the pen instead is the classic way to get a curve that
           overshoots by exactly the control offset. */
        var c1x = cx - penX, c1y = cy - penY;
        var a1x = ax - cx, a1y = ay - cy;
        var cb = Math.max(2, Math.max(
          Writer.bitsFor(c1x), Writer.bitsFor(c1y),
          Writer.bitsFor(a1x), Writer.bitsFor(a1y)));
        w.ub(1, 1);                  // an edge
        w.ub(1, 0);                  // curved
        w.ub(4, cb - 2);
        w.sb(cb, c1x); w.sb(cb, c1y);
        w.sb(cb, a1x); w.sb(cb, a1y);
        penX = ax; penY = ay;
        i += 5;
      } else {
        i += 1;                      // close: implicit in a glyph outline
      }
    }
    w.ub(1, 0);                      // end record: not an edge
    w.ub(5, 0);                      // with no state flags
    w.align();
    return w;
  }

  /**
   * DefineFont2 for a set of traced glyphs.
   *
   * The offset table is the fiddly part: byte offsets from the START of the
   * offset table to each glyph, plus one more marking the end of the last.
   * Getting it wrong does not fail loudly -- the glyphs simply come back as
   * other glyphs.
   */
  function fontBody(id, name, glyphs) {
    var chars = Object.keys(glyphs).filter(function (c) {
      return glyphs[c] && glyphs[c].path && glyphs[c].path.length;
    });
    if (!chars.length) return null;
    var shapes = chars.map(function (c) { return glyphShape(glyphs[c].path); });

    var w = new Writer();
    w.u16(id);
    /* Wide offsets and wide codes both on. A font with more than a handful of
       glyphs needs the first, and mixing the two widths per font is a bug
       waiting to happen. HasLayout is off: the advances travel in the text
       records, which is where Flashy measures them anyway. */
    w.ub(1, 0);                      // HasLayout
    w.ub(1, 0);                      // ShiftJIS
    w.ub(1, 0);                      // SmallText
    w.ub(1, 0);                      // ANSI
    w.ub(1, 1);                      // WideOffsets
    w.ub(1, 1);                      // WideCodes
    w.ub(1, 0);                      // Italic
    w.ub(1, 0);                      // Bold
    w.align();
    w.u8(0);                         // LanguageCode: none
    var nm = String(name || 'Font').slice(0, 100);
    w.u8(nm.length);
    for (var i = 0; i < nm.length; i++) w.u8(nm.charCodeAt(i) & 0xff);
    w.u16(chars.length);

    /* Offsets run from the start of the offset table, which begins at the
       next byte. With wide offsets each entry is 4 bytes and there are n+1
       of them, the last marking where the glyphs end. */
    var at = (chars.length + 1) * 4;
    var offsets = [];
    shapes.forEach(function (sh) { offsets.push(at); at += sh.bytes.length; });
    offsets.push(at);
    offsets.forEach(function (o) { w.u32(o); });
    shapes.forEach(function (sh) { w.bytesOf(sh.bytes); });
    chars.forEach(function (c) { w.u16(c.charCodeAt(0)); });
    return { writer: w, chars: chars };
  }

  /**
   * DefineText2 for one text object.
   *
   * One record carrying the font, colour, position and the glyph advances.
   * The advances come from the traced face, so the spacing in the .swf is the
   * spacing Flashy laid out rather than the player's guess.
   */
  function textBody(id, opts) {
    var index = {};
    opts.chars.forEach(function (c, i) { index[c] = i; });
    var text = String(opts.text || '');
    var used = [];
    for (var i = 0; i < text.length; i++) {
      // A character the face has no glyph for is dropped from this record;
      // the caller counts it so the report can say how many went.
      if (index[text[i]] != null) used.push(text[i]);
    }
    if (!used.length) return null;

    var w = new Writer();
    w.u16(id);
    /* Bounds, generous rather than exact. A tight box that is slightly wrong
       clips the text; a loose one costs nothing. `rect` takes pixels. */
    w.rect(opts.x - 2, opts.y - opts.size - 2,
           opts.x + opts.width + 2, opts.y + opts.size + 2);
    w.matrix({});                    // identity: the glyphs carry the offsets
    var GLYPH_BITS = 16, ADVANCE_BITS = 16;
    w.u8(GLYPH_BITS);
    w.u8(ADVANCE_BITS);

    w.ub(1, 1);                      // TextRecordType 1
    w.ub(3, 0);                      // reserved
    w.ub(1, 1);                      // HasFont
    w.ub(1, 1);                      // HasColor
    w.ub(1, 1);                      // HasYOffset
    w.ub(1, 1);                      // HasXOffset
    w.align();
    w.u16(opts.fontId);
    w.rgba(opts.color, 1);           // DefineText2 carries alpha
    w.i16(Math.round(opts.x * TWIPS));
    w.i16(Math.round((opts.y + opts.size) * TWIPS));   // baseline, not top
    w.u16(Math.round(opts.size * TWIPS));

    w.u8(used.length);
    used.forEach(function (c) {
      w.ub(GLYPH_BITS, index[c]);
      var adv = Math.round((opts.glyphs[c].advance || 0.5) * opts.size * TWIPS);
      w.sb(ADVANCE_BITS, adv);
    });
    w.align();
    w.u8(0);                         // end of records
    return { writer: w, drawn: used.length, dropped: text.length - used.length };
  }

  /* ------------------------------------------------------------------ *
   * Filters
   *
   * PlaceObject3 carries a filter list, and the four filters Flashy shares
   * with Flash map onto SWF's own four. The gradient pair do not: their ramp
   * is a different record with its own stop list, so they are reported as
   * unwritten rather than approximated by a plain glow that would look wrong.
   * ------------------------------------------------------------------ */

  var SWF_FILTER = { dropShadow: 0, blur: 1, glow: 2, bevel: 3 };

  function filterListBody(filters) {
    var all = (filters || []).filter(function (f) { return f && f.enabled !== false; });
    var usable = all.filter(function (f) { return SWF_FILTER[f.type] != null; });
    if (!usable.length) return null;
    var w = new Writer();
    w.u8(usable.length);
    usable.forEach(function (f) {
      w.u8(SWF_FILTER[f.type]);
      var rgba = function (c, a) {
        var n = typeof c === 'string' ? parseInt(String(c).replace('#', ''), 16)
                                      : (c | 0);
        w.u8((n >> 16) & 0xff); w.u8((n >> 8) & 0xff); w.u8(n & 0xff);
        w.u8(Math.round(Math.max(0, Math.min(1, a == null ? 1 : a)) * 255));
      };
      var q = Math.max(1, Math.min(15, f.quality || 1));
      if (f.type === 'blur') {
        w.fixed(Math.abs(f.blurX == null ? 4 : f.blurX));
        w.fixed(Math.abs(f.blurY == null ? 4 : f.blurY));
        w.ub(5, q);
        w.ub(3, 0);                  // reserved
        w.align();
      } else if (f.type === 'glow') {
        rgba(f.color == null ? 0xff0000 : f.color, f.alpha);
        var gb = Math.abs(f.blur == null ? 6 : f.blur);
        w.fixed(gb); w.fixed(gb);
        w.fixed8(f.strength == null ? 1 : f.strength);
        w.ub(1, 0);                  // InnerGlow
        w.ub(1, 0);                  // Knockout
        w.ub(1, 1);                  // CompositeSource
        w.ub(5, q);
        w.align();
      } else if (f.type === 'dropShadow') {
        rgba(f.color == null ? 0 : f.color, f.alpha == null ? 0.6 : f.alpha);
        var db = Math.abs(f.blur == null ? 4 : f.blur);
        w.fixed(db); w.fixed(db);
        w.fixed((f.angle == null ? 45 : f.angle) * Math.PI / 180);
        w.fixed(f.distance == null ? 4 : f.distance);
        w.fixed8(f.strength == null ? 1 : f.strength);
        w.ub(1, 0);                  // InnerShadow
        w.ub(1, 0);                  // Knockout
        w.ub(1, 1);                  // CompositeSource
        w.ub(5, q);
        w.align();
      } else {
        // Bevel: shadow colour first, as the spec orders them.
        rgba(f.shadowColor == null ? 0 : f.shadowColor, 0.6);
        rgba(f.highlightColor == null ? 0xffffff : f.highlightColor, 0.6);
        var bb = Math.abs(f.blur == null ? 4 : f.blur);
        w.fixed(bb); w.fixed(bb);
        w.fixed((f.angle == null ? 45 : f.angle) * Math.PI / 180);
        w.fixed(f.distance == null ? 4 : f.distance);
        w.fixed8(f.strength == null ? 1 : f.strength);
        w.ub(1, 0);                  // InnerShadow
        w.ub(1, 0);                  // Knockout
        w.ub(1, 1);                  // CompositeSource
        w.ub(1, 1);                  // OnTop
        w.ub(4, q);
        w.align();
      }
    });
    return { writer: w, count: usable.length,
             skipped: all.length - usable.length };
  }

  /* ------------------------------------------------------------------ *
   * Actions
   *
   * An assembler for the five verbs a Flashy frame script actually uses. Not
   * a compiler: the script is matched against five shapes and anything else
   * is reported as unwritten, with the offending line named.
   *
   * That is a deliberate line to draw. A real AS2 compiler is a parser, a
   * scope model and a bytecode generator -- a project of its own -- and a
   * .swf carrying half-compiled scripts would be worse than one that says
   * which scripts it left out and why.
   * ------------------------------------------------------------------ */

  var ACTION = {
    Play: 0x06, Stop: 0x07, GotoFrame: 0x81, GotoLabel: 0x8C,
    Push: 0x96, Trace: 0x26
  };

  /** Assemble one script, or report the line that stopped it. */
  function assembleActions(src) {
    var lines = String(src == null ? '' : src).split('\n');
    var out = [];
    var u16 = function (v) { out.push(v & 0xff, (v >> 8) & 0xff); };
    var str = function (s) {
      for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
      out.push(0);
    };
    var inBlockComment = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (inBlockComment) {
        if (/\*\//.test(line)) inBlockComment = false;
        continue;
      }
      if (!line || /^\/\//.test(line)) continue;
      if (/^\/\*/.test(line)) {
        if (!/\*\//.test(line)) inBlockComment = true;
        continue;
      }
      var m;
      if (/^stop\s*\(\s*\)\s*;?$/.test(line)) { out.push(ACTION.Stop); continue; }
      if (/^play\s*\(\s*\)\s*;?$/.test(line)) { out.push(ACTION.Play); continue; }
      if ((m = /^gotoAndStop\s*\(\s*(\d+)\s*\)\s*;?$/.exec(line))) {
        // GotoFrame is zero-based and stops there by definition.
        out.push(ACTION.GotoFrame); u16(2);
        u16(Math.max(0, parseInt(m[1], 10) - 1));
        continue;
      }
      if ((m = /^gotoAndPlay\s*\(\s*(\d+)\s*\)\s*;?$/.exec(line))) {
        out.push(ACTION.GotoFrame); u16(2);
        u16(Math.max(0, parseInt(m[1], 10) - 1));
        out.push(ACTION.Play);
        continue;
      }
      if ((m = /^(gotoAndStop|gotoAndPlay)\s*\(\s*["'](.+?)["']\s*\)\s*;?$/.exec(line))) {
        out.push(ACTION.GotoLabel); u16(m[2].length + 1); str(m[2]);
        if (m[1] === 'gotoAndPlay') out.push(ACTION.Play);
        continue;
      }
      if ((m = /^trace\s*\(\s*["'](.*?)["']\s*\)\s*;?$/.exec(line))) {
        // Push a string constant, then Trace.
        out.push(ACTION.Push); u16(m[1].length + 2); out.push(0); str(m[1]);
        out.push(ACTION.Trace);
        continue;
      }
      return { unsupported: line };
    }
    out.push(0);                     // End of actions
    return { bytes: out };
  }

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
      /* What was WRITTEN, not only what was left out. The old report could
         only say what it had failed at, which made it impossible to tell a
         movie with no sound from one whose sound had been dropped. */
      texts: 0, fonts: 0, bitmaps: 0, sounds: 0, filters: 0, scripts: 0,
      glyphsDropped: 0,
      unsupportedScript: null,
      skipped: { text: 0, bitmap: 0, sound: 0, filter: 0, script: 0, group: 0, other: 0 }
    };
    var nextId = 1;
    var defs = [];            // definition tags, emitted before the timeline

    var layers = (doc.layers || []).filter(function (l) {
      var t = (l && l.layerType) || 'normal';
      return t !== 'guide' && t !== 'folder' && t !== 'motionguide';
    });

    /* Preloaded images and decoded audio, handed in by the editor. This
       writer never loads anything: a decode is asynchronous and `write` is
       not, so the alternative would be a promise running through every layer
       of this file. */
    var images = opts.images || null;        // name -> HTMLImageElement
    var buffers = opts.buffers || null;      // name -> AudioBuffer
    var fonts = opts.fonts || null;          // faceKey -> traced glyph table

    /** A bitmap asset as a character, by whichever route suits its bytes. */
    var bitmapCache = Object.create(null);
    var defineBitmap = function (name) {
      if (bitmapCache[name] !== undefined) return bitmapCache[name];
      var asset = (doc.bitmaps || {})[name];
      if (!asset || !asset.data) { bitmapCache[name] = null; return null; }
      var id = null;
      /* A JPEG goes in byte for byte: it is already compressed, and decoding
         and re-encoding it would only lose quality. */
      var jpegBytes = /jpe?g/i.test(asset.mediaType || '')
        ? base64Bytes(asset.data) : null;
      if (jpegBytes && jpegBytes.length) {
        id = nextId++;
        defs.push(tag(TAG.DefineBitsJPEG2, jpegBody(id, jpegBytes).bytes));
      } else {
        var px = images ? bitmapPixels(images[name]) : null;
        if (!px) { bitmapCache[name] = null; return null; }
        id = nextId++;
        defs.push(tag(TAG.DefineBitsLossless2, losslessBody(id, px).bytes));
      }
      report.bitmaps++;
      bitmapCache[name] = id;
      return id;
    };

    /**
     * A bitmap placed on the stage.
     *
     * A bitmap character cannot be placed directly at a size: SWF scales it
     * through a shape that uses it as a FILL, which is also how Flash did it.
     * So the bitmap becomes a clipped-bitmap fill on a rectangle the size the
     * object asks for.
     */
    var bitmapShapeCache = new Map();
    var defineBitmapShape = function (o) {
      if (bitmapShapeCache.has(o)) return bitmapShapeCache.get(o);
      var bid = defineBitmap(o.bitmapAsset);
      if (bid == null) { bitmapShapeCache.set(o, null); return null; }
      var asset = (doc.bitmaps || {})[o.bitmapAsset] || {};
      var natW = asset.width || (images && images[o.bitmapAsset]
        ? (images[o.bitmapAsset].naturalWidth || 1) : 1);
      var natH = asset.height || (images && images[o.bitmapAsset]
        ? (images[o.bitmapAsset].naturalHeight || 1) : 1);
      var id = nextId++;
      var w = Math.abs(o.width || natW), h = Math.abs(o.height || natH);
      var hw = w / 2, hh = h / 2;

      var body = new Writer();
      body.u16(id);
      body.rect(-hw, -hh, hw, hh);
      // One fill style: a clipped bitmap, with the matrix that maps the
      // image's own pixels onto the rectangle.
      body.u8(1);
      body.u8(0x41);                 // clipped bitmap fill
      body.u16(bid);
      /* The fill matrix is in TWIPS per image pixel, which is the one place
         this is easy to get wrong: a scale of 1 means one twip per pixel and
         the image comes out a twentieth of its size. */
      body.matrix({ a: (w / natW) * TWIPS, d: (h / natH) * TWIPS,
                    tx: -hw, ty: -hh });
      body.u8(0);                    // no line styles
      body.ub(4, 1);                 // NumFillBits
      body.ub(4, 0);                 // NumLineBits
      // A rectangle, drawn as four straight edges from the top-left.
      var tw = Math.round(w * TWIPS), th = Math.round(h * TWIPS);
      var x0 = -Math.round(hw * TWIPS), y0 = -Math.round(hh * TWIPS);
      body.ub(1, 0);                 // style change
      body.ub(1, 0); body.ub(1, 0); body.ub(1, 0); body.ub(1, 1); body.ub(1, 1);
      var mb = Math.max(Writer.bitsFor(x0), Writer.bitsFor(y0));
      body.ub(5, mb);
      body.sb(mb, x0); body.sb(mb, y0);
      body.ub(1, 1);                 // FillStyle0 = 1
      var edge = function (dx, dy) {
        var b = Math.max(2, Math.max(Writer.bitsFor(dx), Writer.bitsFor(dy)));
        body.ub(1, 1); body.ub(1, 1); body.ub(4, b - 2);
        if (dx && dy) { body.ub(1, 1); body.sb(b, dx); body.sb(b, dy); }
        else if (dx) { body.ub(1, 0); body.ub(1, 0); body.sb(b, dx); }
        else { body.ub(1, 0); body.ub(1, 1); body.sb(b, dy); }
      };
      edge(tw, 0); edge(0, th); edge(-tw, 0); edge(0, -th);
      body.ub(1, 0); body.ub(5, 0);
      body.align();
      defs.push(tag(TAG.DefineShape3, body.bytes));
      bitmapShapeCache.set(o, id);
      return id;
    };

    /** A sound asset as a DefineSound character. */
    var soundCache = Object.create(null);
    var defineSound = function (name) {
      if (soundCache[name] !== undefined) return soundCache[name];
      var buf = buffers ? buffers[name] : null;
      if (!buf || !buf.getChannelData) { soundCache[name] = null; return null; }
      var id = nextId++;
      var built = soundBody(id, buf);
      defs.push(tag(TAG.DefineSound, built.writer.bytes));
      report.sounds++;
      soundCache[name] = id;
      return id;
    };

    /** A traced face as a DefineFont2 character. */
    var fontCache = Object.create(null);
    var defineFont = function (key, face) {
      if (fontCache[key] !== undefined) return fontCache[key];
      var table = fonts ? fonts[key] : null;
      if (!table || !table.glyphs) { fontCache[key] = null; return null; }
      var id = nextId++;
      var built = fontBody(id, face, table.glyphs);
      if (!built) { nextId--; fontCache[key] = null; return null; }
      defs.push(tag(TAG.DefineFont2, built.writer.bytes));
      report.fonts++;
      fontCache[key] = { id: id, chars: built.chars, glyphs: table.glyphs };
      return fontCache[key];
    };

    /** A text object as a DefineText2 character. */
    var textCache = new Map();
    var defineText = function (o) {
      if (textCache.has(o)) return textCache.get(o);
      var key = String(o.font || 'Arial') + (o.fontBold ? '|b' : '') +
                (o.fontItalic ? '|i' : '');
      var face = defineFont(key, o.font || 'Arial');
      if (!face) {
        /* The glyphs ARE the text in a DefineText, so a face that was never
           embedded leaves nothing to write. Reported with the fix named. */
        report.skipped.text++;
        textCache.set(o, null);
        return null;
      }
      var id = nextId++;
      var built = textBody(id, {
        chars: face.chars, glyphs: face.glyphs, fontId: face.id,
        text: o.text, size: o.fontSize || 24,
        color: o.fillColor == null ? '#000000' : o.fillColor,
        x: 0, y: -(o.fontSize || 24) / 2, width: Math.abs(o.width || 0)
      });
      if (!built) { nextId--; report.skipped.text++; textCache.set(o, null); return null; }
      defs.push(tag(TAG.DefineText2, built.writer.bytes));
      report.texts++;
      report.glyphsDropped += built.dropped;
      textCache.set(o, id);
      return id;
    };

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
        var p3 = place3(d, cid, o, true);
        inner.push(p3 ? tag(TAG.PlaceObject3, p3)
                      : tag(TAG.PlaceObject2, placeBody(d, cid, o, true)));
        report.placed++;
        return true;
      }
    };

    /**
     * PlaceObject3, when the object has filters SWF can express.
     *
     * Returns null when PlaceObject2 will do, which is almost always: a tag
     * the player has to parse further costs something, and a movie with no
     * filters in it should not pay for the ones it does not have.
     */
    function place3(depth, charId, o, fresh) {
      var fl = filterListBody(o.filters);
      if (!fl) {
        if (o.filters && o.filters.length) report.skipped.filter++;
        return null;
      }
      report.filters += fl.count;
      report.skipped.filter += fl.skipped;
      var w = new Writer();
      /* The first flag byte is PlaceObject2's, and the second is
         PlaceObject3's own. Writing one byte and forgetting the other is how
         a filter list ends up being read as a blend mode. */
      w.ub(1, 0);                    // HasClipActions
      w.ub(1, 0);                    // HasClipDepth
      w.ub(1, 0);                    // HasName
      w.ub(1, 0);                    // HasRatio
      w.ub(1, 1);                    // HasColorTransform
      w.ub(1, 1);                    // HasMatrix
      w.ub(1, 1);                    // HasCharacter
      w.ub(1, fresh ? 0 : 1);        // Move
      w.ub(1, 0);                    // reserved
      w.ub(1, 0);                    // OpaqueBackground
      w.ub(1, 0);                    // HasVisible
      w.ub(1, 0);                    // HasImage
      w.ub(1, 0);                    // HasClassName
      w.ub(1, 0);                    // HasCacheAsBitmap
      w.ub(1, 0);                    // HasBlendMode
      w.ub(1, 1);                    // HasFilterList
      w.align();
      w.u16(depth);
      w.u16(charId);
      w.matrix(placeMatrix(o));
      w.cxform(o.alpha == null ? 1 : o.alpha);
      w.bytesOf(fl.writer.bytes);
      return w.bytes;
    }

    /** The character id for an object, defining it if need be. */
    function characterFor(o) {
      if (!o) return null;
      if (o.type === 'text') return defineText(o);
      if (o.type === 'bitmap') {
        var bid = defineBitmapShape(o);
        if (bid == null) report.skipped.bitmap++;
        return bid;
      }
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
      /* Frame scripts, as DoAction. The assembler handles five verbs and
         names the line that stopped it on anything else -- a .swf carrying
         half-compiled scripts would be worse than one that says which it
         left out. */
      layers.forEach(function (l) {
        (l.keyframes || []).forEach(function (k) {
          if (k.index !== f || !k.script || !k.script.trim()) return;
          var asm = assembleActions(k.script);
          if (asm.unsupported) {
            report.skipped.script++;
            if (!report.unsupportedScript) report.unsupportedScript = asm.unsupported;
            return;
          }
          timeline.push(tag(TAG.DoAction, asm.bytes));
          report.scripts++;
        });
      });
      /* Sounds, as StartSound on the frame they begin. Event sounds only:
         a stream sound is interleaved with the frames through
         SoundStreamBlock, which means re-chunking the samples per frame and
         is a different piece of work. */
      layers.forEach(function (l) {
        (l.keyframes || []).forEach(function (k) {
          if (k.index !== f || !k.sound || !k.sound.asset) return;
          var sid = defineSound(k.sound.asset);
          if (sid == null) { report.skipped.sound++; return; }
          timeline.push(tag(TAG.StartSound, startSoundBody(sid, {
            loops: k.sound.loop ? 65535 : (k.sound.repeat || 0)
          }).bytes));
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
        var rp3 = place3(depth, cid, o, true);
          timeline.push(rp3 ? tag(TAG.PlaceObject3, rp3)
                            : tag(TAG.PlaceObject2, placeBody(depth, cid, o, true)));
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
    /* The one case worth naming rather than counting: a script was left out
       because of a specific line, and knowing which line is the difference
       between fixing it and guessing. */
    if (report.unsupportedScript) {
      parts.push('a script stopped at: ' + report.unsupportedScript);
    }
    return parts.join(', ');
  }

  /** What the writer DID produce, for the export dialog to show. */
  function wroteText(report) {
    var parts = [];
    var add = function (n, one, many) {
      if (n) parts.push(n + ' ' + (n === 1 ? one : many));
    };
    add(report.shapes, 'shape', 'shapes');
    add(report.sprites, 'symbol', 'symbols');
    add(report.texts, 'text block', 'text blocks');
    add(report.fonts, 'embedded font', 'embedded fonts');
    add(report.bitmaps, 'bitmap', 'bitmaps');
    add(report.sounds, 'sound', 'sounds');
    add(report.filters, 'filter', 'filters');
    add(report.scripts, 'frame script', 'frame scripts');
    return parts.join(', ');
  }

  global.FlashySWFWriter = {
    write: write,
    reportText: reportText,
    wroteText: wroteText,
    /* The assembler and the glyph writer, exposed so a spec can check them
       without building a whole movie round them. */
    assembleActions: assembleActions,
    glyphShape: glyphShape,
    zlibStore: zlibStore,
    adler32: adler32,
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
