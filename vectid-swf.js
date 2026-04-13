/* vectid-swf.js — minimal SWF importer for Vectid
 *
 * SCOPE — what this loader aims to handle:
 *   - FWS (uncompressed) and CWS (zlib) headers
 *     ZWS (LZMA) is not supported — browsers lack a native LZMA decoder.
 *   - Tag iteration with long/short form
 *   - DefineShape, DefineShape2, DefineShape3 — straight & curved edges,
 *     solid fills, stroked lines. Gradients/bitmaps are rendered as flat fills.
 *   - DefineSprite — nested timelines become nested Vectid.MovieClips
 *   - PlaceObject2, RemoveObject2 — display list with depth ordering
 *   - SetBackgroundColor, ShowFrame, End, FileAttributes (skipped)
 *   - Matrix transforms on placed objects
 *
 * NOT SUPPORTED: ActionScript 1/2/3 bytecode, morph shapes, text (DefineText/
 * DefineEditText), sound, buttons, DefineShape4 line styles, color transforms
 * beyond multiplicative alpha, bitmaps, fonts. Real fidelity is a huge
 * undertaking (see Ruffle); this loader handles simple vector SWFs.
 *
 * Usage:
 *   const loader = new Vectid.SWFLoader();
 *   const mc = await loader.loadURL('anim.swf');  // returns a MovieClip
 *   stage.root.addChild(mc);
 */
(function (global) {
  'use strict';

  const F = global.Vectid;
  if (!F) throw new Error('vectid.js must be loaded before vectid-swf.js');

  // -------------------- inflate via browser --------------------
  async function inflate(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream not available — cannot read CWS SWF');
    }
    const ds = new DecompressionStream('deflate');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  // -------------------- bit reader --------------------
  class BitReader {
    constructor(bytes) {
      this.bytes = bytes;
      this.view  = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      this.pos = 0;
      this.bitBuf = 0;
      this.bitPos = 0;
    }
    align() { this.bitPos = 0; this.bitBuf = 0; }
    get eof() { return this.pos >= this.bytes.length; }
    u8()    { this.align(); return this.bytes[this.pos++]; }
    u16()   { this.align(); const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
    u32()   { this.align(); const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
    s16()   { this.align(); const v = this.view.getInt16(this.pos, true);  this.pos += 2; return v; }
    s32()   { this.align(); const v = this.view.getInt32(this.pos, true);  this.pos += 4; return v; }

    ub(n) {
      let v = 0;
      while (n > 0) {
        if (this.bitPos === 0) { this.bitBuf = this.bytes[this.pos++]; this.bitPos = 8; }
        const take = Math.min(n, this.bitPos);
        v = (v << take) | ((this.bitBuf >> (this.bitPos - take)) & ((1 << take) - 1));
        this.bitPos -= take;
        n -= take;
      }
      return v;
    }
    sb(n) {
      if (n === 0) return 0;
      const v = this.ub(n);
      return (v & (1 << (n - 1))) ? v - (1 << n) : v;
    }
    fb(n) { return this.sb(n) / 65536; }

    rect() {
      this.align();
      const n = this.ub(5);
      return { xMin: this.sb(n), xMax: this.sb(n), yMin: this.sb(n), yMax: this.sb(n) };
    }

    matrix() {
      this.align();
      let sx = 1, sy = 1, rs0 = 0, rs1 = 0;
      if (this.ub(1)) { const n = this.ub(5); sx = this.fb(n); sy = this.fb(n); }
      if (this.ub(1)) { const n = this.ub(5); rs0 = this.fb(n); rs1 = this.fb(n); }
      const n = this.ub(5);
      const tx = this.sb(n);
      const ty = this.sb(n);
      return { sx, rs0, rs1, sy, tx, ty };
    }

    colorRGB()  { return (this.u8() << 16) | (this.u8() << 8) | this.u8(); }
    colorRGBA() {
      const c = this.colorRGB();
      const a = this.u8() / 255;
      return { color: c, alpha: a };
    }

    cxform(hasAlpha) {
      this.align();
      const hasAdd = this.ub(1);
      const hasMul = this.ub(1);
      const n = this.ub(4);
      const channels = hasAlpha ? 4 : 3;
      let mul = null, add = null;
      if (hasMul) { mul = []; for (let i = 0; i < channels; i++) mul.push(this.sb(n) / 256); }
      if (hasAdd) { add = []; for (let i = 0; i < channels; i++) add.push(this.sb(n)); }
      return { mul, add };
    }

    string() {
      this.align();
      let end = this.pos;
      while (this.bytes[end] !== 0) end++;
      const s = new TextDecoder('utf-8').decode(this.bytes.subarray(this.pos, end));
      this.pos = end + 1;
      return s;
    }
  }

  // -------------------- style & shape parsing --------------------
  function readFillStyleArray(br, version) {
    let count = br.u8();
    if (count === 0xff && version >= 2) count = br.u16();
    const styles = [];
    for (let i = 0; i < count; i++) styles.push(readFillStyle(br, version));
    return styles;
  }

  function readFillStyle(br, version) {
    const type = br.u8();
    if (type === 0x00) { // solid
      if (version >= 3) { const c = br.colorRGBA(); return { type: 'solid', color: c.color, alpha: c.alpha }; }
      return { type: 'solid', color: br.colorRGB(), alpha: 1 };
    }
    if (type === 0x10 || type === 0x12 || type === 0x13) { // gradients
      br.matrix();
      let count;
      if (type === 0x13) { br.u8(); count = br.u8(); } else { count = br.u8() & 0x0f; }
      let avg = 0x808080, avgA = 1;
      for (let i = 0; i < count; i++) {
        br.u8();
        if (version >= 3) { const c = br.colorRGBA(); avg = c.color; avgA = c.alpha; }
        else avg = br.colorRGB();
      }
      return { type: 'gradient', color: avg, alpha: avgA };
    }
    if (type >= 0x40 && type <= 0x43) { // bitmap fill
      br.u16();      // bitmap id
      br.matrix();
      return { type: 'bitmap', color: 0x999999, alpha: 1 };
    }
    return { type: 'unknown', color: 0x000000, alpha: 1 };
  }

  function readLineStyleArray(br, version) {
    let count = br.u8();
    if (count === 0xff) count = br.u16();
    const styles = [];
    for (let i = 0; i < count; i++) {
      const width = br.u16();
      if (version >= 3) { const c = br.colorRGBA(); styles.push({ width, color: c.color, alpha: c.alpha }); }
      else               styles.push({ width, color: br.colorRGB(), alpha: 1 });
    }
    return styles;
  }

  // Decodes shape records to a Vectid Graphics. This is the simplified
  // per-edge emission: groups edges by the currently-active fillStyle1 and
  // emits them in sequence. Multi-fill shapes built from closed graphs may
  // not render perfectly.
  function parseShapeInto(br, graphics, version) {
    const fillStyles = readFillStyleArray(br, version);
    const lineStyles = readLineStyleArray(br, version);
    let nFillBits = br.ub(4);
    let nLineBits = br.ub(4);

    let x = 0, y = 0;
    let curFill0 = 0, curFill1 = 0, curLine = 0;
    let openFill = false, openLine = false;

    const applyStyles = () => {
      if (openFill) { graphics.endFill(); openFill = false; }
      if (curFill1 && fillStyles[curFill1 - 1]) {
        const f = fillStyles[curFill1 - 1];
        graphics.beginFill(f.color, f.alpha);
        openFill = true;
      }
      if (curLine && lineStyles[curLine - 1]) {
        const l = lineStyles[curLine - 1];
        graphics.lineStyle(l.width / 20, l.color, l.alpha);
        openLine = true;
      } else if (openLine) {
        graphics.lineStyle(0);
        openLine = false;
      }
      graphics.moveTo(x / 20, y / 20);
    };

    while (true) {
      const type = br.ub(1);
      if (type === 0) {
        const flags = br.ub(5);
        if (flags === 0) { if (openFill) graphics.endFill(); break; }
        if (flags & 0x01) { const n = br.ub(5); x = br.sb(n); y = br.sb(n); }
        if (flags & 0x02) curFill0 = br.ub(nFillBits);
        if (flags & 0x04) curFill1 = br.ub(nFillBits);
        if (flags & 0x08) curLine  = br.ub(nLineBits);
        if (flags & 0x10) {
          // NewStyles (DefineShape2+): re-read style arrays and bit sizes
          if (openFill) { graphics.endFill(); openFill = false; }
          const newFills = readFillStyleArray(br, version);
          const newLines = readLineStyleArray(br, version);
          for (let i = 0; i < newFills.length; i++) fillStyles.push(newFills[i]);
          for (let i = 0; i < newLines.length; i++) lineStyles.push(newLines[i]);
          nFillBits = br.ub(4);
          nLineBits = br.ub(4);
        }
        applyStyles();
      } else {
        const straight = br.ub(1);
        if (straight === 1) {
          const n = br.ub(4) + 2;
          const general = br.ub(1);
          if (general === 1) { x += br.sb(n); y += br.sb(n); }
          else {
            const vert = br.ub(1);
            if (vert === 0) x += br.sb(n);
            else            y += br.sb(n);
          }
          graphics.lineTo(x / 20, y / 20);
        } else {
          const n = br.ub(4) + 2;
          const cx = x + br.sb(n);
          const cy = y + br.sb(n);
          x = cx + br.sb(n);
          y = cy + br.sb(n);
          graphics.curveTo(cx / 20, cy / 20, x / 20, y / 20);
        }
      }
    }
  }

  // -------------------- SWF top-level parser --------------------
  class SWFLoader {
    async loadURL(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error('SWF fetch failed: ' + res.status);
      return this.parse(await res.arrayBuffer());
    }
    async loadFile(file) { return this.parse(await file.arrayBuffer()); }

    async parse(buffer) {
      const head = new Uint8Array(buffer);
      const sig = String.fromCharCode(head[0], head[1], head[2]);
      const version = head[3];
      if (sig !== 'FWS' && sig !== 'CWS' && sig !== 'ZWS') {
        throw new Error('Not a SWF file');
      }
      if (sig === 'ZWS') throw new Error('LZMA-compressed SWF (ZWS) is not supported');

      let body;
      if (sig === 'FWS') {
        body = head.subarray(8);
      } else {
        body = await inflate(head.subarray(8));
      }

      const br = new BitReader(body);
      const bounds = br.rect();
      const fpsRaw = br.u16();
      const fps = fpsRaw / 256;
      const frameCount = br.u16();

      const width  = (bounds.xMax - bounds.xMin) / 20;
      const height = (bounds.yMax - bounds.yMin) / 20;

      const dictionary = {}; // characterId -> { kind, ... }
      let backgroundColor = 0xffffff;

      // Read root frames
      const rootFrames = this._readFrames(br, dictionary, version, null);

      // Background color may have been set during tag iteration — stored on dict meta
      if (dictionary.__bg != null) backgroundColor = dictionary.__bg;

      const rootMC = this._buildMovieClip(rootFrames, dictionary);
      rootMC.loop = true;

      // Attach metadata for the caller
      rootMC.swfInfo = { width, height, fps, frameCount, version, backgroundColor };
      return rootMC;
    }

    // Reads tags up to End (or DefineSprite-local End when isSprite is true),
    // returning an array of frames. Each frame is an array of display-list
    // commands: {type:'place', depth, id, matrix, name?} / {type:'remove', depth}.
    _readFrames(br, dict, version, spriteEnd) {
      const frames = [];
      let current = [];
      while (!br.eof) {
        br.align();
        const ch = br.u16();
        const code = ch >> 6;
        let len = ch & 0x3f;
        if (len === 0x3f) len = br.u32();
        const end = br.pos + len;
        try {
          if (code === 0) {                 // End
            if (current.length) frames.push(current);
            break;
          } else if (code === 1) {          // ShowFrame
            frames.push(current);
            current = [];
          } else if (code === 9) {          // SetBackgroundColor
            dict.__bg = br.colorRGB();
          } else if (code === 2 || code === 22 || code === 32) {
            // DefineShape / 2 / 3
            const id = br.u16();
            br.rect();                       // shape bounds (twips)
            const g = new F.Graphics();
            const ver = code === 2 ? 1 : (code === 22 ? 2 : 3);
            parseShapeInto(br, g, ver);
            dict[id] = { kind: 'shape', graphics: g };
          } else if (code === 39) {         // DefineSprite
            const spriteId = br.u16();
            const spriteFrames = br.u16(); // eslint-disable-line no-unused-vars
            const subFrames = this._readFrames(br, dict, version, true);
            dict[spriteId] = { kind: 'sprite', frames: subFrames };
          } else if (code === 4) {          // PlaceObject (v1)
            const id = br.u16();
            const depth = br.u16();
            const m = br.matrix();
            current.push({ type: 'place', id, depth, matrix: m, move: false });
          } else if (code === 26) {         // PlaceObject2
            const flags = br.u8();
            const depth = br.u16();
            const hasClipActions = !!(flags & 0x80);
            const hasClipDepth   = !!(flags & 0x40);
            const hasName        = !!(flags & 0x20);
            const hasRatio       = !!(flags & 0x10);
            const hasCX          = !!(flags & 0x08);
            const hasMatrix      = !!(flags & 0x04);
            const hasChar        = !!(flags & 0x02);
            const move           = !!(flags & 0x01);
            const cmd = { type: 'place', depth, move };
            if (hasChar)   cmd.id = br.u16();
            if (hasMatrix) cmd.matrix = br.matrix();
            if (hasCX)     br.cxform(true);
            if (hasRatio)  br.u16();
            if (hasName)   cmd.name = br.string();
            if (hasClipDepth)   br.u16();
            if (hasClipActions) { /* skip */ }
            current.push(cmd);
          } else if (code === 5) {          // RemoveObject
            br.u16(); // character id
            const depth = br.u16();
            current.push({ type: 'remove', depth });
          } else if (code === 28) {         // RemoveObject2
            const depth = br.u16();
            current.push({ type: 'remove', depth });
          }
          // unknown or skipped tags fall through to `br.pos = end`
        } catch (e) {
          // be forgiving — skip malformed tag
          // eslint-disable-next-line no-console
          console.warn('SWF: tag', code, 'parse failed:', e.message);
        }
        br.align();
        br.pos = end;
      }
      if (current.length && !frames.length) frames.push(current);
      return frames;
    }

    _instantiate(id, dict) {
      const entry = dict[id];
      if (!entry) return null;
      if (entry.kind === 'shape') {
        const s = new F.Shape();
        s.graphics = entry.graphics;
        return s;
      }
      if (entry.kind === 'sprite') {
        return this._buildMovieClip(entry.frames, dict);
      }
      return null;
    }

    _applyMatrix(node, m) {
      node.x = m.tx / 20;
      node.y = m.ty / 20;
      node.scaleX = m.sx;
      node.scaleY = m.sy;
      node.rotation = Math.atan2(m.rs0, m.sx);
    }

    // Build a MovieClip that executes the given frame commands. Each frame
    // script mutates a per-clip depth table to add/remove/move children.
    _buildMovieClip(frames, dict) {
      const mc = new F.MovieClip();
      const total = Math.max(1, frames.length);
      mc.timeline.setTotalFrames(total);
      const self = this;

      for (let i = 0; i < frames.length; i++) {
        const cmds = frames[i];
        const frameNum = i + 1;
        mc.timeline.addFrameScript(frameNum, function () {
          if (!this._depths) this._depths = {};
          for (let k = 0; k < cmds.length; k++) {
            const cmd = cmds[k];
            if (cmd.type === 'place') {
              let inst = this._depths[cmd.depth];
              if (cmd.move && inst) {
                if (cmd.matrix) self._applyMatrix(inst, cmd.matrix);
                if (cmd.name) inst.name = cmd.name;
              } else {
                if (inst) inst.removeFromParent();
                if (cmd.id != null) {
                  inst = self._instantiate(cmd.id, dict);
                  if (inst) {
                    if (cmd.matrix) self._applyMatrix(inst, cmd.matrix);
                    if (cmd.name) inst.name = cmd.name;
                    // Insert sorted by depth
                    const entries = Object.keys(this._depths).map(Number).sort((a, b) => a - b);
                    let insertAt = this.children.length;
                    for (let j = 0; j < entries.length; j++) {
                      if (entries[j] > cmd.depth) {
                        const other = this._depths[entries[j]];
                        const idx = this.children.indexOf(other);
                        if (idx >= 0) { insertAt = idx; break; }
                      }
                    }
                    this.addChildAt(inst, insertAt);
                    this._depths[cmd.depth] = inst;
                  }
                }
              }
            } else if (cmd.type === 'remove') {
              const inst = this._depths[cmd.depth];
              if (inst) { inst.removeFromParent(); delete this._depths[cmd.depth]; }
            }
          }
        });
      }
      return mc;
    }
  }

  F.SWFLoader = SWFLoader;
})(typeof window !== 'undefined' ? window : this);
