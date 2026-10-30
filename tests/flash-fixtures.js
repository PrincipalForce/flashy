import { makeABC } from "./abc-fixture.js";

// Binary fixtures for the Flash import specs, written rather than shipped.
//
// The rest of this suite generates its own PNGs and WAVs in the page instead
// of committing binaries, for the same reason it is done here: a fixture you
// can read the source of says what it is testing. A checked-in .swf would be
// an opaque blob that nobody can tell is still correct.
//
// `makeSWF()` writes a real, uncompressed SWF — header, tag lengths, bit-
// packed shape records and all — and `makeFLA()` a real ZIP of XFL XML. If
// the readers stop agreeing with the formats, these stop parsing.

/** Bit-level writer for SWF's packed structures. */
class SWFWriter {
  constructor() {
    this.bytes = [];
    this.bitBuf = 0;
    this.bitCount = 0;
  }
  align() {
    // A partial byte pads on the RIGHT: the bits written so far are the most
    // significant ones. Flushing them without the shift leaves every
    // bit-packed structure correct up to its last byte and quietly wrong
    // after it — which reads back as coordinates that are nearly right.
    if (this.bitCount) {
      this.bytes.push((this.bitBuf << (8 - this.bitCount)) & 0xff);
      this.bitBuf = 0;
      this.bitCount = 0;
    }
  }
  u8(v) { this.align(); this.bytes.push(v & 0xff); return this; }
  u16(v) { this.align(); this.bytes.push(v & 0xff, (v >> 8) & 0xff); return this; }
  u32(v) {
    this.align();
    this.bytes.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
    return this;
  }
  s16(v) { return this.u16(v < 0 ? v + 0x10000 : v); }
  string(s) {
    this.align();
    for (const ch of Buffer.from(s, "utf8")) this.bytes.push(ch);
    this.bytes.push(0);
    return this;
  }
  ub(nbits, value) {
    for (let i = nbits - 1; i >= 0; i--) {
      const bit = (value >> i) & 1;
      this.bitBuf = (this.bitBuf << 1) | bit;
      this.bitCount++;
      if (this.bitCount === 8) { this.bytes.push(this.bitBuf & 0xff); this.bitBuf = 0; this.bitCount = 0; }
    }
    return this;
  }
  sb(nbits, value) { return this.ub(nbits, value < 0 ? value + (1 << nbits) : value); }
  rgb(color) { return this.u8((color >> 16) & 0xff).u8((color >> 8) & 0xff).u8(color & 0xff); }
  rgba(color, alpha) { return this.rgb(color).u8(Math.round((alpha == null ? 1 : alpha) * 255)); }

  rect(xMin, xMax, yMin, yMax) {
    const n = bitsNeededSigned([xMin, xMax, yMin, yMax]);
    this.align();
    this.ub(5, n);
    this.sb(n, xMin); this.sb(n, xMax); this.sb(n, yMin); this.sb(n, yMax);
    this.align();
    return this;
  }

  /** A translate-only matrix, in twips. */
  matrix(tx, ty, scale) {
    this.align();
    if (scale != null && scale !== 1) {
      const fixed = Math.round(scale * 65536);
      const n = bitsNeededSigned([fixed]);
      this.ub(1, 1); this.ub(5, n); this.sb(n, fixed); this.sb(n, fixed);
    } else {
      this.ub(1, 0);
    }
    this.ub(1, 0);                       // no rotate/skew
    const n2 = bitsNeededSigned([tx, ty]);
    this.ub(5, n2); this.sb(n2, tx); this.sb(n2, ty);
    this.align();
    return this;
  }

  /** A full matrix, including the rotate/skew pair. */
  matrixFull(a, b, c, d, tx, ty) {
    this.align();
    const fx = (v) => Math.round(v * 65536);
    const sn = bitsNeededSigned([fx(a), fx(d)]);
    this.ub(1, 1); this.ub(5, sn); this.sb(sn, fx(a)); this.sb(sn, fx(d));
    const rn = bitsNeededSigned([fx(b), fx(c)]);
    this.ub(1, 1); this.ub(5, rn); this.sb(rn, fx(b)); this.sb(rn, fx(c));
    const tn = bitsNeededSigned([tx, ty]);
    this.ub(5, tn); this.sb(tn, tx); this.sb(tn, ty);
    this.align();
    return this;
  }

  bytesOf() { this.align(); return Buffer.from(this.bytes); }
}

function bitsNeededSigned(values) {
  let n = 1;
  for (const v of values) {
    let need = 1;
    const x = v < 0 ? -v - 1 : v;
    while (x >= (1 << need) - 1 && need < 31) need++;
    need += 1;                           // the sign bit
    if (need > n) n = need;
  }
  return Math.min(n, 31);
}

/** A tag with its code and length header. */
function tag(code, payload) {
  const body = Buffer.isBuffer(payload) ? payload : payload.bytesOf();
  const head = new SWFWriter();
  if (body.length < 0x3f) head.u16((code << 6) | body.length);
  else { head.u16((code << 6) | 0x3f); head.u32(body.length); }
  return Buffer.concat([head.bytesOf(), body]);
}

/** A filled rectangle as a DefineShape3, in pixels. */
function defineRect(id, x, y, w, h, color, alpha) {
  const T = 20;
  const w2 = new SWFWriter();
  w2.u16(id);
  w2.rect(x * T, (x + w) * T, y * T, (y + h) * T);
  // One solid fill, no lines.
  w2.u8(1);
  w2.u8(0x00).rgba(color, alpha);
  w2.u8(0);
  w2.align();
  w2.ub(4, 1);                           // fill index bits
  w2.ub(4, 0);                           // line index bits
  // StyleChangeRecord: moveTo + fillStyle1 = 1
  w2.ub(1, 0);
  w2.ub(5, 0x01 | 0x04);
  const mb = bitsNeededSigned([x * T, y * T]);
  w2.ub(5, mb); w2.sb(mb, x * T); w2.sb(mb, y * T);
  w2.ub(1, 1);                           // fillStyle1 = 1, in 1 bit
  // Four straight edges round the box.
  const edge = (dx, dy) => {
    const n = Math.max(2, bitsNeededSigned([dx, dy]));
    w2.ub(1, 1);                         // edge record
    w2.ub(1, 1);                         // straight
    w2.ub(4, n - 2);
    w2.ub(1, 1);                         // general line
    w2.sb(n, dx); w2.sb(n, dy);
  };
  edge(w * T, 0);
  edge(0, h * T);
  edge(-w * T, 0);
  edge(0, -h * T);
  w2.ub(1, 0); w2.ub(5, 0);              // EndShapeRecord
  w2.align();
  return tag(32, w2);                    // DefineShape3
}

/**
 * A rectangle filled with a horizontal linear gradient, as DefineShape3.
 *
 * A SWF gradient is a matrix applied to a square 32768 twips across centred
 * on the origin, so covering a `w`-wide box that starts at `x` means scaling
 * that square down to the box and moving its centre to the box's centre.
 */
function defineGradientRect(id, x, y, w, h, from, to) {
  const T = 20;
  const w2 = new SWFWriter();
  w2.u16(id);
  w2.rect(x * T, (x + w) * T, y * T, (y + h) * T);
  w2.u8(1);                              // one fill style
  w2.u8(0x10);                           // linear gradient
  const scale = (w * T) / 32768;
  w2.matrixFull(scale, 0, 0, (h * T) / 32768, (x + w / 2) * T, (y + h / 2) * T);
  w2.align();
  w2.ub(4, 0);                           // spread / interpolation
  w2.ub(4, 2);                           // two stops
  w2.u8(0).rgba(from, 1);
  w2.u8(255).rgba(to, 1);
  w2.u8(0);                              // no line styles
  w2.align();
  w2.ub(4, 1); w2.ub(4, 0);
  w2.ub(1, 0);
  w2.ub(5, 0x01 | 0x04);
  const mb = bitsNeededSigned([x * T, y * T]);
  w2.ub(5, mb); w2.sb(mb, x * T); w2.sb(mb, y * T);
  w2.ub(1, 1);
  const edge = (dx, dy) => {
    const n = Math.max(2, bitsNeededSigned([dx, dy]));
    w2.ub(1, 1); w2.ub(1, 1); w2.ub(4, n - 2); w2.ub(1, 1);
    w2.sb(n, dx); w2.sb(n, dy);
  };
  edge(w * T, 0); edge(0, h * T); edge(-w * T, 0); edge(0, -h * T);
  w2.ub(1, 0); w2.ub(5, 0);
  w2.align();
  return tag(32, w2);
}

/**
 * A PlaceObject2 carrying clip event handlers — the `onClipEvent` blocks
 * Flash attached to an instance. `handlers` is a list of
 * `{ flags, actions }`, where `actions` is raw AVM1.
 */
function placeWithClipActions(depth, charId, tx, ty, handlers) {
  const w = new SWFWriter();
  w.u8(0x02 | 0x04 | 0x80);              // character, matrix, clip actions
  w.u16(depth);
  w.u16(charId);
  w.matrix(tx * 20, ty * 20);
  w.u16(0);                              // reserved
  let all = 0;
  for (const h of handlers) all |= h.flags;
  w.u32(all);                            // all event flags (SWF 6+: 32 bits)
  for (const h of handlers) {
    w.u32(h.flags);
    w.u32(h.actions.length);
    for (const b of h.actions) w.u8(b);
  }
  w.u32(0);                              // end of the handler list
  return tag(26, w);
}

function placeObject2(depth, charId, tx, ty, opts) {
  opts = opts || {};
  const w = new SWFWriter();
  let flags = 0;
  if (opts.move) flags |= 0x01;
  if (charId != null) flags |= 0x02;
  flags |= 0x04;                         // always a matrix here
  if (opts.name) flags |= 0x20;
  w.u8(flags);
  w.u16(depth);
  if (charId != null) w.u16(charId);
  w.matrix(tx * 20, ty * 20, opts.scale);
  if (opts.name) w.string(opts.name);
  return tag(26, w);
}

const removeObject2 = (depth) => tag(28, new SWFWriter().u16(depth));
const showFrame = () => tag(1, new SWFWriter());
const setBackground = (color) => tag(9, new SWFWriter().rgb(color));
const frameLabel = (name) => tag(43, new SWFWriter().string(name));

/** DoAction holding a single `stop();` (action 0x07, then the terminator). */
function doActionStop() {
  return tag(12, Buffer.from([0x07, 0x00]));
}

/** DoAction for `gotoAndPlay(n)`: GotoFrame (0-based) followed by Play. */
function doActionGoto(frame) {
  const f = frame - 1;
  return tag(12, Buffer.from([0x81, 0x02, 0x00, f & 0xff, (f >> 8) & 0xff, 0x06, 0x00]));
}

function exportAssets(pairs) {
  const w = new SWFWriter();
  w.u16(pairs.length);
  for (const [id, name] of pairs) { w.u16(id); w.string(name); }
  return tag(56, w);
}

function defineSprite(id, frameCount, frameTags) {
  const inner = Buffer.concat(frameTags.concat([tag(0, new SWFWriter())]));
  const head = new SWFWriter();
  head.u16(id);
  head.u16(frameCount);
  return tag(39, Buffer.concat([head.bytesOf(), inner]));
}

/**
 * The fixture movie, which every SWF spec reads:
 *
 *   320×240, 12fps, grey background
 *   1  a red 100×50 rectangle
 *   2  a blue 40×40 rectangle
 *   3  a sprite that shows #2 over two frames, exported as "Ball"
 *
 *   frame 1      label "start", `stop();`, #1 at (20,30) on depth 1,
 *                the sprite at (100,100) on depth 2 named "ball"
 *   frames 2-11  the sprite moves 10px right per frame — a baked tween
 *   frame 12     the sprite is removed; `gotoAndPlay(1)`
 */
function makeSWF() {
  const spriteFrames = [
    placeObject2(1, 2, 0, 0),
    showFrame(),
    showFrame()
  ];

  const tags = [
    tag(69, new SWFWriter().u32(0)),     // FileAttributes
    setBackground(0xc0c0c0),
    defineRect(1, 0, 0, 100, 50, 0xff0000, 1),
    defineRect(2, 0, 0, 40, 40, 0x0000ff, 1),
    defineSprite(3, 2, spriteFrames),
    exportAssets([[3, "Ball"]]),
    frameLabel("start"),
    doActionStop(),
    placeObject2(1, 1, 20, 30),
    placeObject2(2, 3, 100, 100, { name: "ball" }),
    showFrame()
  ];
  for (let i = 1; i <= 10; i++) {
    tags.push(placeObject2(2, null, 100 + i * 10, 100, { move: true }));
    tags.push(showFrame());
  }
  tags.push(removeObject2(2));
  tags.push(doActionGoto(1));
  tags.push(showFrame());
  tags.push(tag(0, new SWFWriter()));

  const body = new SWFWriter();
  body.rect(0, 320 * 20, 0, 240 * 20);
  body.u16(12 * 256);                    // frame rate, 8.8 fixed
  body.u16(12);                          // frame count
  const payload = Buffer.concat([body.bytesOf(), ...tags]);

  const head = Buffer.from([0x46, 0x57, 0x53, 0x06]);   // "FWS", version 6
  const size = Buffer.alloc(4);
  size.writeUInt32LE(8 + payload.length, 0);
  return Buffer.concat([head, size, payload]);
}

// -------------------- FLA (a ZIP of XFL) --------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A stored-entry ZIP — no compression, so the reader's inflate path is not
    what is under test here; the XFL parsing is. */
function makeZip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const data = Buffer.from(text, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);           // stored
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(local, 30);
    locals.push(local, data);

    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 10);             // stored
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    nameBuf.copy(cd, 46);
    central.push(cd);

    offset += local.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, eocd]);
}

/** A rectangle as XFL edges. Coordinates in the `edges` string are TWIPS. */
function xflRect(x, y, w, h, color) {
  const T = 20;
  const x0 = x * T, y0 = y * T, x1 = (x + w) * T, y1 = (y + h) * T;
  return `
      <DOMShape>
        <fills><FillStyle index="1"><SolidColor color="${color}"/></FillStyle></fills>
        <edges>
          <Edge fillStyle1="1" edges="!${x0} ${y0}|${x1} ${y0}|${x1} ${y1}|${x0} ${y1}|${x0} ${y0}"/>
        </edges>
      </DOMShape>`;
}

/**
 * The fixture FLA: 400×300 at 24fps, two named layers, a symbol in the
 * library placed with a matrix, a motion tween, a frame label and a frame
 * script.
 */
function makeFLA() {
  const ball = `<?xml version="1.0" encoding="UTF-8"?>
<DOMSymbolItem xmlns="http://ns.adobe.com/xfl/2008/" name="Ball" symbolType="graphic">
  <timeline>
    <DOMTimeline name="Ball">
      <layers>
        <DOMLayer name="Layer 1">
          <frames>
            <DOMFrame index="0" duration="1">
              <elements>${xflRect(0, 0, 30, 30, "#00FF00")}</elements>
            </DOMFrame>
          </frames>
        </DOMLayer>
      </layers>
    </DOMTimeline>
  </timeline>
</DOMSymbolItem>`;

  const doc = `<?xml version="1.0" encoding="UTF-8"?>
<DOMDocument xmlns="http://ns.adobe.com/xfl/2008/" width="400" height="300"
             frameRate="24" backgroundColor="#336699">
  <symbols>
    <Include href="Ball.xml"/>
  </symbols>
  <timelines>
    <DOMTimeline name="Scene 1">
      <!-- XFL lists layers top-first, so the ball is above the sky. -->
      <layers>
        <DOMLayer name="Ball">
          <frames>
            <DOMFrame index="0" duration="9" tweenType="motion">
              <elements>
                <DOMSymbolInstance libraryItemName="Ball" symbolType="graphic" name="ball">
                  <matrix><Matrix tx="10" ty="20"/></matrix>
                </DOMSymbolInstance>
              </elements>
            </DOMFrame>
            <DOMFrame index="9" duration="1">
              <elements>
                <DOMSymbolInstance libraryItemName="Ball" symbolType="graphic" name="ball">
                  <matrix><Matrix tx="100" ty="20"/></matrix>
                </DOMSymbolInstance>
              </elements>
            </DOMFrame>
          </frames>
        </DOMLayer>
        <DOMLayer name="Sky" color="#4FFF4F">
          <frames>
            <DOMFrame index="0" duration="10" name="open" labelType="name">
              <Actionscript><script><![CDATA[stop();]]></script></Actionscript>
              <elements>${xflRect(0, 0, 400, 300, "#112233")}</elements>
            </DOMFrame>
          </frames>
        </DOMLayer>
      </layers>
    </DOMTimeline>
  </timelines>
</DOMDocument>`;

  return makeZip([
    ["DOMDocument.xml", doc],
    ["LIBRARY/Ball.xml", ball]
  ]);
}

/**
 * A one-frame movie whose only shape is placed through a SKEWED matrix —
 * `x' = x + y/2` — which the editor's rotation-and-scale fields cannot
 * express. The import is expected to bake it into the path instead.
 */
function makeSkewSWF() {
  const place = new SWFWriter();
  place.u8(0x02 | 0x04);                 // has character, has matrix
  place.u16(1);
  place.u16(1);
  place.matrixFull(1, 0, 0.5, 1, 0, 0);

  const tags = [
    setBackground(0xffffff),
    defineRect(1, 0, 0, 100, 50, 0x00ff00, 1),
    tag(26, place),
    showFrame(),
    tag(0, new SWFWriter())
  ];
  const body = new SWFWriter();
  body.rect(0, 320 * 20, 0, 240 * 20);
  body.u16(12 * 256);
  body.u16(1);
  const payload = Buffer.concat([body.bytesOf(), ...tags]);
  const head = Buffer.from([0x46, 0x57, 0x53, 0x06]);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(8 + payload.length, 0);
  return Buffer.concat([head, size, payload]);
}

/** One frame, one rectangle, filled red-to-blue left to right. */
function makeGradientSWF() {
  const tags = [
    setBackground(0xffffff),
    defineGradientRect(1, 50, 50, 200, 100, 0xff0000, 0x0000ff),
    placeObject2(1, 1, 0, 0),
    showFrame(),
    tag(0, new SWFWriter())
  ];
  const body = new SWFWriter();
  body.rect(0, 320 * 20, 0, 240 * 20);
  body.u16(12 * 256);
  body.u16(1);
  const payload = Buffer.concat([body.bytesOf(), ...tags]);
  const head = Buffer.from([0x46, 0x57, 0x53, 0x06]);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(8 + payload.length, 0);
  return Buffer.concat([head, size, payload]);
}

/**
 * An ActionScript 3 movie: one rectangle, and a `DoABC` block defining
 * `class Main extends MovieClip` whose constructor registers `frame1` as the
 * frame-1 script, which calls `stop()`. That is exactly the shape the Flash
 * compiler emits, and what an AS3 import has to recognise to find any code
 * at all.
 */
function makeAS3SWF() {
  const abc = makeABC();
  const doAbc = new SWFWriter();
  doAbc.u32(1);                          // flags: lazy initialize
  doAbc.string("Main");                  // the block's name
  const abcTag = tag(82, Buffer.concat([doAbc.bytesOf(), abc]));

  const tags = [
    tag(69, new SWFWriter().u32(0x08)),  // FileAttributes: ActionScript 3
    setBackground(0xffffff),
    defineRect(1, 10, 10, 60, 40, 0x00aa00, 1),
    placeObject2(1, 1, 0, 0),
    abcTag,
    showFrame(),
    tag(0, new SWFWriter())
  ];
  const body = new SWFWriter();
  body.rect(0, 320 * 20, 0, 240 * 20);
  body.u16(24 * 256);
  body.u16(1);
  const payload = Buffer.concat([body.bytesOf(), ...tags]);
  const head = Buffer.from([0x46, 0x57, 0x53, 0x09]);   // "FWS", version 9
  const size = Buffer.alloc(4);
  size.writeUInt32LE(8 + payload.length, 0);
  return Buffer.concat([head, size, payload]);
}

/**
 * Four depths, arranged to exercise both halves of the packing rule:
 *
 *   1  a red box, frames 1-2 only
 *   2  a green box far to the right, all three frames
 *   3  a blue box where the red one was, frame 3 — never on screen with it,
 *      and nothing in between touches it, so it should SHARE depth 1's layer
 *   4  a yellow box overlapping the green one, frame 3 — on top of it, so it
 *      must NOT be moved below it
 */
function makeLayeringSWF() {
  const tags = [
    setBackground(0xffffff),
    defineRect(1, 0, 0, 50, 50, 0xff0000, 1),
    defineRect(2, 0, 0, 50, 50, 0x00ff00, 1),
    defineRect(3, 0, 0, 50, 50, 0x0000ff, 1),
    defineRect(4, 0, 0, 50, 50, 0xffff00, 1),
    placeObject2(1, 1, 10, 10),
    placeObject2(2, 2, 200, 10),
    showFrame(),
    showFrame(),
    removeObject2(1),
    placeObject2(3, 3, 10, 10),
    placeObject2(4, 4, 205, 15),
    showFrame(),
    tag(0, new SWFWriter())
  ];
  const body = new SWFWriter();
  body.rect(0, 320 * 20, 0, 240 * 20);
  body.u16(12 * 256);
  body.u16(3);
  const payload = Buffer.concat([body.bytesOf(), ...tags]);
  const head = Buffer.from([0x46, 0x57, 0x53, 0x06]);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(8 + payload.length, 0);
  return Buffer.concat([head, size, payload]);
}

/**
 * A movie whose clip has handlers that actually do something:
 *
 *   onClipEvent(load)       { startX = _x; }
 *   onClipEvent(enterFrame) { _x = startX + 40; }
 *
 * Written as the AVM1 those compile to, so the import runs through the real
 * decompiler and the real handler runtime rather than a convenient shortcut.
 */
function makeClipHandlerSWF(opts) {
  opts = opts || {};
  const pushStr = (str) => {
    const d = [0];
    for (const ch of str) d.push(ch.charCodeAt(0));
    d.push(0);
    return [0x96, d.length & 0xff, d.length >> 8, ...d];
  };
  const pushInt = (n) => {
    const dv = new DataView(new ArrayBuffer(4));
    dv.setInt32(0, n, true);
    return [0x96, 5, 0, 7, dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)];
  };
  // startX = _x;   →  push "startX", push "" , push 0, getProperty, setVariable
  const load = [
    ...pushStr("startX"),
    ...pushStr(""), ...pushInt(0), 0x22,  // getProperty(_x) of this
    0x1d,                                 // setVariable
    0x00
  ];
  // _x = startX + 40;  →  push "", 0, then startX + 40, setProperty
  const enterFrame = [
    ...pushStr(""), ...pushInt(0),
    ...pushStr("startX"), 0x1c,           // getVariable startX
    ...pushInt(40), 0x47,                 // add
    0x23,                                 // setProperty
    0x00
  ];

  /* `_x = 100;` — an absolute coordinate, the way a published handler bakes
     one in. Flash measures it from the instance's registration point, so an
     import that measures from the centre of the box puts it 20px out. */
  const absolute = [
    ...pushStr(""), ...pushInt(0), ...pushInt(100), 0x23,
    0x00
  ];
  const handlers = opts.absolute
    ? [{ flags: 0x0001, actions: absolute }]
    : [{ flags: 0x0001, actions: load }, { flags: 0x0002, actions: enterFrame }];

  const tags = [
    setBackground(0xffffff),
    defineRect(1, 0, 0, 40, 40, 0xff0000, 1),
    placeWithClipActions(1, 1, 20, 20, handlers),
    showFrame(),
    tag(0, new SWFWriter())
  ];
  const body = new SWFWriter();
  body.rect(0, 320 * 20, 0, 240 * 20);
  body.u16(24 * 256);
  body.u16(1);
  const payload = Buffer.concat([body.bytesOf(), ...tags]);
  const head = Buffer.from([0x46, 0x57, 0x53, 0x08]);   // SWF 8: 32-bit clip flags
  const size = Buffer.alloc(4);
  size.writeUInt32LE(8 + payload.length, 0);
  return Buffer.concat([head, size, payload]);
}

export {
  makeSWF, makeFLA, makeSkewSWF, makeGradientSWF, makeAS3SWF, makeLayeringSWF,
  makeClipHandlerSWF,
  makeZip, SWFWriter, tag
};
