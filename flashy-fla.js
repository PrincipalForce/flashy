/* flashy-fla.js — FLA / XFL reader for Flashy
 *
 * A modern FLA is a ZIP of XFL: `DOMDocument.xml` for the stage and the root
 * timeline, one `LIBRARY/<name>.xml` per symbol, and the media alongside
 * them. Unlike a SWF, which is a compiled movie, this is the *source* — the
 * layers, the symbol names, the tweens and the scripts as the author left
 * them — so an import from here should keep all of it.
 *
 * Like `flashy-swf.js`, this file stops at a **document model**: the same
 * plain structure of characters and timelines, so `flashy-import.js` turns
 * either of them into an editable document with one body of code, and
 * `Flashy.SWFLoader.build()` plays either of them with one body of code.
 *
 * WHAT IS READ
 *   Stage          width, height, frame rate, background colour
 *   Library        every DOMSymbolItem, recursively, keeping its symbol type
 *                  (graphic / movie clip / button) and its linkage name
 *   Layers         name, visibility, lock, and ordering — including guide
 *                  and mask layers, which come in as ordinary ones
 *   Frames         keyframes with their durations, labels, and frame scripts
 *   Tweens         motion and classic tweens are sampled per frame, which
 *                  the importer then folds back into a single tweened
 *                  keyframe. Shape tweens hold their first drawing.
 *   Shapes         fills and strokes with the same edge-stitching the SWF
 *                  reader uses, so filled regions and their holes are real
 *                  closed paths rather than a trail of unclosed edges
 *   Fills          solid, linear and radial gradients, bitmap fills
 *   Instances      symbol instances with their matrix, loop mode, first
 *                  frame, and colour effect (alpha / brightness / tint)
 *   Text           static, dynamic and input text, with face, size, colour
 *                  and alignment per run
 *   Bitmaps/sound  media whose original file is in the archive
 *   Groups         DOMGroup, as a one-frame symbol holding its members
 *
 * NOT SUPPORTED: filters, 3D, inverse kinematics (armatures), the legacy
 * pre-CS5 binary FLA (an OLE compound file, a different format entirely),
 * and bitmaps stored only in Flash's internal `.dat` form rather than as
 * the original PNG/JPEG. Each of these is reported in `model.warnings`.
 *
 * Usage:
 *   const model = await new Flashy.FLALoader().parseFile(file);   // model
 *   const mc    = await new Flashy.FLALoader().loadFile(file);    // MovieClip
 */
(function (global) {
  'use strict';

  const F = global.Flashy;
  if (!F) throw new Error('flashy.js must be loaded before flashy-fla.js');
  if (!F.SWF) throw new Error('flashy-swf.js must be loaded before flashy-fla.js');

  const TWIPS = 20;
  const buildItems = F.SWF.buildItems;

  // -------------------- ZIP --------------------
  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream not available — cannot read a FLA');
    }
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    const minScan = Math.max(0, bytes.length - 65558);
    for (let i = bytes.length - 22; i >= minScan; i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a valid ZIP/FLA (no end-of-archive record). ' +
      'A pre-CS5 binary FLA cannot be read — open and re-save it in a newer Flash.');

    const cdSize = view.getUint32(eocd + 12, true);
    const cdOffset = view.getUint32(eocd + 16, true);

    const entries = [];
    let p = cdOffset;
    const cdEnd = Math.min(cdOffset + cdSize, bytes.length);
    while (p < cdEnd) {
      if (view.getUint32(p, true) !== 0x02014b50) break;
      const method = view.getUint16(p + 10, true);
      const compSize = view.getUint32(p + 20, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLn = view.getUint16(p + 32, true);
      const localOff = view.getUint32(p + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
      entries.push({ name, method, compSize, localOff });
      p += 46 + nameLen + extraLen + commentLn;
    }

    const out = {};
    for (const e of entries) {
      const lh = e.localOff;
      if (view.getUint32(lh, true) !== 0x04034b50) continue;
      const lnl = view.getUint16(lh + 26, true);
      const lxl = view.getUint16(lh + 28, true);
      const dataStart = lh + 30 + lnl + lxl;
      const data = bytes.subarray(dataStart, dataStart + e.compSize);
      if (e.method === 0) out[e.name] = data;
      else if (e.method === 8) out[e.name] = await inflateRaw(data);
      // other methods (bzip2, lzma) are not used by Flash's own writer
    }
    return out;
  }

  // -------------------- edge strings --------------------
  /*
   * The `edges` attribute of a DOMEdge is the same shape description a SWF
   * carries, written as text:
   *
   *     !0 0|2000 0|2000 2000[1000 3000 0 2000|0 0
   *
   *   !x y            moveTo
   *   |x y  /x y      lineTo  (the two differ only in how Flash drew them)
   *   [cx cy x y      quadratic curveTo
   *   ]cx cy x y      quadratic curveTo
   *   Sn              style selector, which the Edge element's attributes
   *                   already say — skipped
   *
   * Numbers are **twips** either way: plain decimals, or `#` followed by a
   * signed hexadecimal integer and an optional `.` plus two hex digits of
   * fraction. Reading the decimals as pixels — which is the obvious mistake,
   * and was live here — scales every shape by twenty.
   */
  function tokenizeEdges(str) {
    const tokens = [];
    let i = 0;
    const n = str.length;
    while (i < n) {
      const ch = str[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === ',') { i++; continue; }
      if (ch === '!' || ch === '|' || ch === '/' || ch === '[' || ch === ']') {
        tokens.push(ch); i++; continue;
      }
      if (ch === 'S') {
        i++;
        while (i < n && /[0-9]/.test(str[i])) i++;
        continue;
      }
      if (ch === '#') {
        let j = i + 1;
        if (str[j] === '-') j++;
        while (j < n && /[0-9A-Fa-f]/.test(str[j])) j++;
        let frac = 0;
        let whole = str.slice(i + 1, j);
        if (str[j] === '.') {
          let k = j + 1;
          while (k < n && /[0-9A-Fa-f]/.test(str[k])) k++;
          const fracHex = str.slice(j + 1, k);
          frac = parseInt(fracHex, 16) / Math.pow(16, fracHex.length);
          j = k;
        }
        let negative = false;
        if (whole[0] === '-') { negative = true; whole = whole.slice(1); }
        let val = parseInt(whole, 16);
        if (!isFinite(val)) val = 0;
        /* A full-width hex integer is two's complement, not sign-prefixed. */
        if (!negative && whole.length >= 8 && val >= 0x80000000) val -= 0x100000000;
        val = negative ? -(val + frac) : val + frac;
        tokens.push(val);
        i = j;
        continue;
      }
      if (ch === '-' || ch === '+' || ch === '.' || (ch >= '0' && ch <= '9')) {
        let j = i + 1;
        while (j < n && /[0-9.eE+\-]/.test(str[j])) j++;
        const v = parseFloat(str.slice(i, j));
        tokens.push(isFinite(v) ? v : 0);
        i = j;
        continue;
      }
      i++;                              // unknown character — skip it
    }
    return tokens;
  }

  /** An edge string → edges in twips, tagged with this DOMEdge's styles. */
  function edgesFromString(str, fill0, fill1, line) {
    const t = tokenizeEdges(str);
    const out = [];
    let x = 0, y = 0, k = 0;
    while (k < t.length) {
      const op = t[k++];
      if (op === '!') { x = t[k++]; y = t[k++]; }
      else if (op === '|' || op === '/') {
        const nx = t[k++], ny = t[k++];
        out.push({ x0: x, y0: y, x1: nx, y1: ny, cx: null, cy: null, fill0, fill1, line });
        x = nx; y = ny;
      } else if (op === '[' || op === ']') {
        const cx = t[k++], cy = t[k++], nx = t[k++], ny = t[k++];
        out.push({ x0: x, y0: y, x1: nx, y1: ny, cx, cy, fill0, fill1, line });
        x = nx; y = ny;
      }
      // a stray number cannot be acted on without an operator
    }
    return out;
  }

  // -------------------- XML helpers --------------------
  function childrenNamed(el, name) {
    const out = [];
    if (!el) return out;
    for (let i = 0; i < el.childNodes.length; i++) {
      const c = el.childNodes[i];
      if (c.nodeType === 1 && (c.localName === name || c.nodeName === name)) out.push(c);
    }
    return out;
  }
  function firstNamed(el, name) { return childrenNamed(el, name)[0] || null; }
  /** The first descendant with this tag name, at any depth. */
  function deepFirst(el, name) {
    if (!el) return null;
    const direct = firstNamed(el, name);
    if (direct) return direct;
    for (let i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType !== 1) continue;
      const hit = deepFirst(el.childNodes[i], name);
      if (hit) return hit;
    }
    return null;
  }
  function attr(el, name, fallback) {
    if (!el || !el.getAttribute) return fallback;
    const v = el.getAttribute(name);
    return v == null ? fallback : v;
  }
  function num(el, name, fallback) {
    const v = parseFloat(attr(el, name, ''));
    return isFinite(v) ? v : fallback;
  }
  function bool(el, name, fallback) {
    const v = attr(el, name, null);
    if (v == null) return fallback;
    return v === 'true' || v === '1';
  }
  function parseColor(str) {
    if (!str) return 0x000000;
    if (str[0] === '#') return parseInt(str.slice(1), 16) & 0xffffff;
    const n = parseInt(str, 10);
    return isFinite(n) ? n & 0xffffff : 0x000000;
  }

  const IDENTITY = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

  /** `<matrix><Matrix …/></matrix>` → a model matrix (translation in twips). */
  function matrixOf(el) {
    const holder = firstNamed(el, 'matrix');
    const m = holder ? firstNamed(holder, 'Matrix') : null;
    if (!m) return IDENTITY;
    return {
      a: num(m, 'a', 1), b: num(m, 'b', 0),
      c: num(m, 'c', 0), d: num(m, 'd', 1),
      tx: num(m, 'tx', 0) * TWIPS, ty: num(m, 'ty', 0) * TWIPS
    };
  }

  function matrixMultiply(m1, m2) {
    // m1 applied after m2 — i.e. the child's matrix composed into the parent's.
    return {
      a: m1.a * m2.a + m1.c * m2.b,
      b: m1.b * m2.a + m1.d * m2.b,
      c: m1.a * m2.c + m1.c * m2.d,
      d: m1.b * m2.c + m1.d * m2.d,
      tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
      ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty
    };
  }

  /**
   * `<color><Color …/></color>` → the same colour transform a SWF carries.
   * Flash writes the effect the author picked (Alpha / Brightness / Tint /
   * Advanced); they all reduce to a multiply and an add per channel.
   */
  function colorOf(el) {
    const holder = firstNamed(el, 'color');
    const c = holder ? firstNamed(holder, 'Color') : null;
    if (!c) return null;
    let mul = [1, 1, 1, 1];
    let add = [0, 0, 0, 0];
    const brightness = num(c, 'brightness', 0);
    const tint = num(c, 'tintMultiplier', 0);
    if (brightness) {
      const b = Math.max(-1, Math.min(1, brightness));
      if (b > 0) { mul = [1 - b, 1 - b, 1 - b, 1]; add = [255 * b, 255 * b, 255 * b, 0]; }
      else { mul = [1 + b, 1 + b, 1 + b, 1]; }
    }
    if (tint) {
      const tc = parseColor(attr(c, 'tintColor', '#000000'));
      mul = [1 - tint, 1 - tint, 1 - tint, mul[3]];
      add = [((tc >> 16) & 0xff) * tint, ((tc >> 8) & 0xff) * tint, (tc & 0xff) * tint, add[3]];
    }
    mul[0] = num(c, 'redMultiplier', mul[0]);
    mul[1] = num(c, 'greenMultiplier', mul[1]);
    mul[2] = num(c, 'blueMultiplier', mul[2]);
    mul[3] = num(c, 'alphaMultiplier', mul[3]);
    add[0] = num(c, 'redOffset', add[0]);
    add[1] = num(c, 'greenOffset', add[1]);
    add[2] = num(c, 'blueOffset', add[2]);
    add[3] = num(c, 'alphaOffset', add[3]);
    return { mul, add };
  }

  // -------------------- transforms for tweens --------------------
  function decompose(m) {
    return {
      tx: m.tx, ty: m.ty,
      sx: Math.sqrt(m.a * m.a + m.b * m.b) || 0,
      sy: Math.sqrt(m.c * m.c + m.d * m.d) || 0,
      rot: Math.atan2(m.b, m.a),
      skew: Math.atan2(-m.c, m.d) - Math.atan2(m.b, m.a)
    };
  }
  function recompose(d) {
    const cos = Math.cos(d.rot), sin = Math.sin(d.rot);
    const cs = Math.cos(d.rot + d.skew), ss = Math.sin(d.rot + d.skew);
    return {
      a: d.sx * cos, b: d.sx * sin,
      c: -d.sy * ss, d: d.sy * cs,
      tx: d.tx, ty: d.ty
    };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /** Interpolate two matrices the way a tween does: by parts, not by cell. */
  function tweenMatrix(m1, m2, t) {
    const a = decompose(m1), b = decompose(m2);
    let dRot = b.rot - a.rot;
    while (dRot > Math.PI) dRot -= Math.PI * 2;
    while (dRot < -Math.PI) dRot += Math.PI * 2;
    return recompose({
      tx: lerp(a.tx, b.tx, t), ty: lerp(a.ty, b.ty, t),
      sx: lerp(a.sx, b.sx, t), sy: lerp(a.sy, b.sy, t),
      rot: a.rot + dRot * t,
      skew: lerp(a.skew, b.skew, t)
    });
  }
  function tweenColor(c1, c2, t) {
    if (!c1 && !c2) return null;
    const a = c1 || { mul: [1, 1, 1, 1], add: [0, 0, 0, 0] };
    const b = c2 || { mul: [1, 1, 1, 1], add: [0, 0, 0, 0] };
    const mul = [], add = [];
    for (let i = 0; i < 4; i++) {
      mul.push(lerp(a.mul ? a.mul[i] : 1, b.mul ? b.mul[i] : 1, t));
      add.push(lerp(a.add ? a.add[i] : 0, b.add ? b.add[i] : 0, t));
    }
    return { mul, add };
  }

  // -------------------- the parser --------------------
  class XFLParser {
    constructor() {
      this.files = {};
      this.model = null;
      this.nextId = 1;
      this.symbolIds = {};              // library item name → character id
      this.shapeIds = {};               // shape XML → character id
      this.mediaIds = {};               // library item name → character id
      this.building = {};
      this.said = {};
    }

    warn(key, message) {
      if (key && this.said[key]) return;
      if (key) this.said[key] = true;
      this.model.warnings.push(message);
    }

    // ---- file access ----
    _key(name) { return String(name).replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase(); }

    _setFiles(map) {
      this.files = {};
      for (const name in map) this.files[this._key(name)] = map[name];
    }

    bytes(name) {
      const direct = this.files[this._key(name)];
      if (direct) return direct;
      /* An unzipped XFL handed over as a directory arrives with the folder
         name on the front of every path; match on the tail instead. */
      const tail = this._key(name);
      for (const k in this.files) if (k === tail || k.endsWith('/' + tail)) return this.files[k];
      return null;
    }

    text(name) {
      const b = this.bytes(name);
      if (!b) return null;
      return new TextDecoder('utf-8').decode(b);
    }

    // ---- entry points ----
    async parseFile(file) {
      const buf = await file.arrayBuffer();
      this._setFiles(await unzip(new Uint8Array(buf)));
      return this._build();
    }

    async parseBuffer(buffer) {
      this._setFiles(await unzip(new Uint8Array(buffer)));
      return this._build();
    }

    /** An unzipped XFL folder, from `<input type="file" webkitdirectory>`. */
    async parseDirectory(fileList) {
      const map = {};
      const files = Array.prototype.slice.call(fileList);
      await Promise.all(files.map(async (file) => {
        const path = file.webkitRelativePath || file.name;
        const slash = path.indexOf('/');
        const key = slash >= 0 ? path.slice(slash + 1) : path;
        map[key] = new Uint8Array(await file.arrayBuffer());
      }));
      this._setFiles(map);
      return this._build();
    }

    _build() {
      const domXml = this.text('DOMDocument.xml');
      if (!domXml) throw new Error('DOMDocument.xml not found — not a FLA or XFL folder');
      const doc = new DOMParser().parseFromString(domXml, 'application/xml');
      const root = doc.documentElement;
      if (!root || root.nodeName === 'parsererror') throw new Error('DOMDocument.xml is not valid XML');

      this.model = {
        source: 'fla',
        width: num(root, 'width', 550),
        height: num(root, 'height', 400),
        fps: num(root, 'frameRate', 24),
        backgroundColor: parseColor(attr(root, 'backgroundColor', '#FFFFFF')),
        frameCount: 1,
        characters: {},
        fonts: {},
        exports: {},
        classes: {},
        timeline: { frames: [], labels: {}, layers: {} },
        warnings: [],
        hasAS3: /^3/.test(attr(root, 'as3', '') || attr(root, 'actionScriptVersion', ''))
      };

      // Media first: a shape's bitmap fill may reference one.
      this._readMedia(root);
      this._indexSymbols(root);

      const rootTimeline = deepFirst(firstNamed(root, 'timelines') || root, 'DOMTimeline');
      const built = rootTimeline
        ? this.readTimeline(rootTimeline, this.model.timeline.layers)
        : { frames: [{ commands: [], actions: [], sounds: [], label: null }], labels: {} };
      this.model.timeline.frames = built.frames;
      this.model.timeline.labels = built.labels;
      this.model.frameCount = built.frames.length;
      return this.model;
    }

    _readMedia(root) {
      const media = firstNamed(root, 'media');
      if (!media) return;
      for (let i = 0; i < media.childNodes.length; i++) {
        const item = media.childNodes[i];
        if (item.nodeType !== 1) continue;
        const name = attr(item, 'name', '');
        if (!name) continue;
        if (item.nodeName === 'DOMBitmapItem') this._readBitmapItem(item, name);
        else if (item.nodeName === 'DOMSoundItem') this._readSoundItem(item, name);
      }
    }

    _readBitmapItem(item, name) {
      const href = attr(item, 'href', '') || attr(item, 'bitmapDataHRef', '');
      const data = href ? (this.bytes('LIBRARY/' + href) || this.bytes(href) ||
        this.bytes('bin/' + href)) : null;
      const id = this.nextId++;
      /* frameRight/frameBottom are the image's size in twips, which is how
         the size is known without decoding anything. */
      const width = Math.round(num(item, 'frameRight', 0) / TWIPS);
      const height = Math.round(num(item, 'frameBottom', 0) / TWIPS);
      if (!data || /\.dat$/i.test(href)) {
        this.warn('datmedia', 'Bitmap "' + name + '" is stored in Flash\'s internal ' +
          'format rather than as a PNG or JPEG, and could not be imported.');
        return;
      }
      this.model.characters[id] = {
        kind: 'bitmap', id, exportName: name, width, height,
        mime: /\.jpe?g$/i.test(href) ? 'image/jpeg' : /\.gif$/i.test(href) ? 'image/gif' : 'image/png',
        data
      };
      this.mediaIds[name] = id;
    }

    _readSoundItem(item, name) {
      const href = attr(item, 'href', '');
      const data = href ? (this.bytes('LIBRARY/' + href) || this.bytes(href) ||
        this.bytes('bin/' + href)) : null;
      if (!data) {
        this.warn('datsound', 'Sound "' + name + '" is not stored as an audio file ' +
          'in the archive and could not be imported.');
        return;
      }
      const id = this.nextId++;
      this.model.characters[id] = {
        kind: 'sound', id, exportName: name,
        mime: /\.wav$/i.test(href) ? 'audio/wav' : 'audio/mpeg',
        data, rate: num(item, 'sampleRate', 44100), sampleCount: 0
      };
      this.mediaIds[name] = id;
    }

    _indexSymbols(root) {
      this.includes = {};
      const symbols = firstNamed(root, 'symbols');
      childrenNamed(symbols, 'Include').forEach((inc) => {
        const href = attr(inc, 'href', '');
        if (!href) return;
        const name = href.replace(/\\/g, '/').replace(/\.xml$/i, '');
        this.includes[name] = href;
      });
    }

    // ---- symbols ----
    /** The character id for a library symbol, building it on first use. */
    symbolCharacter(libraryName) {
      if (this.symbolIds[libraryName] != null) return this.symbolIds[libraryName];
      const id = this.nextId++;
      this.symbolIds[libraryName] = id;          // claim it first: symbols nest
      const href = this.includes[libraryName] || (libraryName + '.xml');
      const xml = this.text('LIBRARY/' + href) || this.text('LIBRARY/' + libraryName + '.xml');
      if (!xml) {
        this.warn('missingsym', 'Library symbol "' + libraryName + '" is referenced but its ' +
          'XML is missing from the archive.');
        this.model.characters[id] = {
          kind: 'sprite', id, exportName: libraryName, frameCount: 1,
          frames: [{ commands: [], actions: [], sounds: [], label: null }], labels: {}
        };
        return id;
      }
      const symDoc = new DOMParser().parseFromString(xml, 'application/xml');
      const item = symDoc.documentElement;
      const timeline = deepFirst(item, 'DOMTimeline');
      const built = timeline
        ? this.readTimeline(timeline, null)
        : { frames: [{ commands: [], actions: [], sounds: [], label: null }], labels: {} };
      const linkage = attr(item, 'linkageClassName', '') || attr(item, 'linkageIdentifier', '');
      this.model.characters[id] = {
        kind: 'sprite', id,
        exportName: attr(item, 'name', libraryName).replace(/^.*\//, ''),
        className: linkage || null,
        symbolType: attr(item, 'symbolType', 'movie clip'),
        frameCount: built.frames.length,
        frames: built.frames,
        labels: built.labels
      };
      if (linkage) this.model.exports[linkage] = id;
      return id;
    }

    // ---- shapes ----
    shapeCharacter(shapeEl) {
      const key = shapeEl.outerHTML || new XMLSerializer().serializeToString(shapeEl);
      if (this.shapeIds[key] != null) return this.shapeIds[key];
      const fills = {}, lines = {};
      let maxFill = 0, maxLine = 0;

      childrenNamed(firstNamed(shapeEl, 'fills'), 'FillStyle').forEach((fs) => {
        const index = parseInt(attr(fs, 'index', '0'), 10);
        const style = this.readFill(fs);
        if (style) { fills[index] = style; maxFill = Math.max(maxFill, index); }
      });
      childrenNamed(firstNamed(shapeEl, 'strokes'), 'StrokeStyle').forEach((ss) => {
        const index = parseInt(attr(ss, 'index', '0'), 10);
        const style = this.readStroke(ss);
        if (style) { lines[index] = style; maxLine = Math.max(maxLine, index); }
      });

      /* buildItems() indexes styles from 1, like SWF, and XFL numbers them
         the same way — so a plain array with a hole at 0 lines up. */
      const fillArr = [], lineArr = [];
      for (let i = 1; i <= maxFill; i++) fillArr.push(fills[i] || null);
      for (let j = 1; j <= maxLine; j++) lineArr.push(lines[j] || null);

      let edges = [];
      childrenNamed(firstNamed(shapeEl, 'edges'), 'Edge').forEach((edge) => {
        const f0 = parseInt(attr(edge, 'fillStyle0', '0'), 10) || 0;
        const f1 = parseInt(attr(edge, 'fillStyle1', '0'), 10) || 0;
        const ls = parseInt(attr(edge, 'strokeStyle', '0'), 10) || 0;
        const str = attr(edge, 'edges', '');
        if (str) edges = edges.concat(edgesFromString(str, f0, f1, ls));
      });

      const id = this.nextId++;
      const items = buildItems(edges, fillArr, lineArr);
      this.model.characters[id] = { kind: 'shape', id, items, bounds: null };
      this.shapeIds[key] = id;
      return id;
    }

    readFill(fs) {
      const solid = firstNamed(fs, 'SolidColor');
      if (solid) {
        return {
          type: 'solid', color: parseColor(attr(solid, 'color', '#000000')),
          alpha: num(solid, 'alpha', 1)
        };
      }
      const linear = firstNamed(fs, 'LinearGradient');
      const radial = firstNamed(fs, 'RadialGradient');
      const grad = linear || radial;
      if (grad) {
        const stops = childrenNamed(grad, 'GradientEntry').map((e) => ({
          ratio: num(e, 'ratio', 0),
          color: parseColor(attr(e, 'color', '#000000')),
          alpha: num(e, 'alpha', 1)
        }));
        return {
          type: linear ? 'linear' : 'radial',
          stops: stops.length ? stops : [{ ratio: 0, color: 0x808080, alpha: 1 }],
          matrix: matrixOf(grad)
        };
      }
      const bitmap = firstNamed(fs, 'BitmapFill');
      if (bitmap) {
        const name = attr(bitmap, 'bitmapPath', '');
        return {
          type: 'bitmap', bitmapId: this.mediaIds[name] != null ? this.mediaIds[name] : -1,
          matrix: matrixOf(bitmap), repeat: !bool(bitmap, 'bitmapIsClipped', false), smooth: true
        };
      }
      return null;
    }

    readStroke(ss) {
      const solid = firstNamed(ss, 'SolidStroke') || firstNamed(ss, 'DashedStroke') ||
        firstNamed(ss, 'DottedStroke') || firstNamed(ss, 'RaggedStroke') ||
        firstNamed(ss, 'StippleStroke') || firstNamed(ss, 'HatchedStroke');
      if (!solid) return null;
      const fill = deepFirst(solid, 'SolidColor');
      return {
        /* XFL stroke weights are in pixels; everything downstream of here
           works in twips. */
        width: num(solid, 'weight', 1) * TWIPS,
        color: fill ? parseColor(attr(fill, 'color', '#000000')) : 0x000000,
        alpha: fill ? num(fill, 'alpha', 1) : 1,
        cap: attr(solid, 'caps', 'round'),
        join: attr(solid, 'joints', 'round'),
        miter: num(solid, 'miterLimit', 3)
      };
    }

    // ---- text ----
    textCharacter(el) {
      const id = this.nextId++;
      const runs = [];
      let y = 0;
      childrenNamed(firstNamed(el, 'textRuns'), 'DOMTextRun').forEach((run) => {
        const chars = firstNamed(run, 'characters');
        const text = chars ? (chars.textContent || '') : '';
        const attrsEl = deepFirst(run, 'DOMTextAttrs');
        const size = num(attrsEl, 'size', 12);
        runs.push({
          text,
          font: (attr(attrsEl, 'face', 'Arial') || 'Arial').replace(/\*?$/, ''),
          size,
          color: parseColor(attr(attrsEl, 'fillColor', '#000000')),
          alpha: num(attrsEl, 'alpha', 1),
          align: attr(attrsEl, 'alignment', 'left'),
          bold: bool(attrsEl, 'bold', false),
          italic: bool(attrsEl, 'italic', false),
          /* Runs are laid out by the player; the model's run positions are
             twips from the element's origin, and the baseline sits about
             four fifths of the way down the first line. */
          x: 0, y: (y + size * 0.8) * TWIPS,
          glyphs: []
        });
        y += size * 1.2 + num(attrsEl, 'lineSpacing', 0);
      });
      this.model.characters[id] = {
        kind: 'text', id, runs, items: [],
        text: runs.map((r) => r.text).join(''),
        matrix: null,
        bounds: {
          x: 0, y: 0,
          width: num(el, 'width', 100), height: num(el, 'height', 20)
        }
      };
      return id;
    }

    // ---- groups ----
    groupCharacter(el) {
      const id = this.nextId++;
      const commands = [];
      const members = firstNamed(el, 'members');
      let depth = 1;
      if (members) {
        for (let i = 0; i < members.childNodes.length; i++) {
          const child = members.childNodes[i];
          if (child.nodeType !== 1) continue;
          const cmd = this.elementCommand(child, depth++);
          if (cmd) commands.push(cmd);
        }
      }
      this.model.characters[id] = {
        kind: 'sprite', id, exportName: 'Group ' + id, frameCount: 1,
        frames: [{ commands, actions: [], sounds: [], label: null }], labels: {}
      };
      return id;
    }

    /** One element on one frame → a place command, or null if unsupported. */
    elementCommand(el, depth, overrideMatrix, overrideColor) {
      const tag = el.nodeName;
      let id = null;
      let extra = {};
      if (tag === 'DOMShape') id = this.shapeCharacter(el);
      else if (tag === 'DOMSymbolInstance') {
        const libName = attr(el, 'libraryItemName', '');
        if (!libName) return null;
        id = this.symbolCharacter(libName);
        extra.name = attr(el, 'name', '');
        const type = attr(el, 'symbolType', '');
        if (type === 'graphic') {
          extra.graphic = true;
          extra.firstFrame = parseInt(attr(el, 'firstFrame', '0'), 10) + 1;
          extra.loopMode = attr(el, 'loop', 'loop');
        }
      } else if (tag === 'DOMBitmapInstance') {
        const name = attr(el, 'libraryItemName', '');
        id = this.mediaIds[name];
        if (id == null) return null;
      } else if (tag === 'DOMStaticText' || tag === 'DOMDynamicText' || tag === 'DOMInputText') {
        id = this.textCharacter(el);
        extra.name = attr(el, 'name', '');
      } else if (tag === 'DOMGroup') {
        id = this.groupCharacter(el);
      } else if (tag === 'DOMVideoInstance') {
        this.warn('video', 'Video instances are not supported and were skipped.');
        return null;
      } else {
        return null;
      }
      const cmd = {
        type: 'place', depth, id, move: false,
        matrix: overrideMatrix || matrixOf(el)
      };
      const color = overrideColor !== undefined ? overrideColor : colorOf(el);
      if (color) cmd.colorTransform = color;
      for (const k in extra) if (extra[k] !== '' && extra[k] != null) cmd[k] = extra[k];
      return cmd;
    }

    // ---- timelines ----
    /**
     * A DOMTimeline → frames of display-list commands.
     *
     * XFL has layers where a SWF has depths, so each layer is given a band
     * of depths (and every depth in the band is labelled with the layer's
     * name) — which is what lets the importer rebuild the author's layers
     * instead of inventing new ones.
     */
    readTimeline(tlNode, layerMeta) {
      const layers = childrenNamed(firstNamed(tlNode, 'layers'), 'DOMLayer');
      const perLayer = layers.map((layer) => childrenNamed(firstNamed(layer, 'frames'), 'DOMFrame'));

      let total = 1;
      perLayer.forEach((frames) => {
        frames.forEach((f) => {
          const idx = parseInt(attr(f, 'index', '0'), 10) || 0;
          const dur = parseInt(attr(f, 'duration', '1'), 10) || 1;
          if (idx + dur > total) total = idx + dur;
        });
      });

      const DEPTH_BAND = 256;            // room for several elements per layer
      const out = [];
      const labels = {};
      for (let f = 0; f < total; f++) {
        out.push({ commands: [], actions: [], sounds: [], label: null });
      }

      layers.forEach((layer, li) => {
        /* XFL lists layers top-first and higher depth draws on top, so the
           first layer gets the highest band. */
        const base = (layers.length - li) * DEPTH_BAND;
        const layerType = attr(layer, 'layerType', 'normal');
        const name = attr(layer, 'name', 'Layer ' + (li + 1));
        if (layerType === 'folder') return;
        if (layerType === 'guide') {
          this.warn('guide', 'Guide layers were imported as ordinary layers.');
        }
        if (layerType === 'mask') {
          this.warn('xflmask', 'Mask layers were imported as ordinary layers — the ' +
            'masked artwork is all visible.');
        }
        if (layerMeta) {
          for (let d = 0; d < DEPTH_BAND; d++) {
            layerMeta[base + d] = {
              name, visible: bool(layer, 'visible', true), locked: bool(layer, 'locked', false)
            };
          }
        }

        const frames = perLayer[li];
        let occupied = {};               // depth → still placed last frame
        for (let f = 0; f < total; f++) {
          const active = frames.find((fr) => {
            const idx = parseInt(attr(fr, 'index', '0'), 10) || 0;
            const dur = parseInt(attr(fr, 'duration', '1'), 10) || 1;
            return idx <= f && f < idx + dur;
          });
          const nowOccupied = {};
          if (active) {
            const idx = parseInt(attr(active, 'index', '0'), 10) || 0;
            if (f === idx) {
              const label = attr(active, 'name', '');
              if (label && attr(active, 'labelType', 'none') !== 'none') {
                labels[f + 1] = label;
                out[f].label = label;
              }
              const script = this._frameScript(active);
              if (script) out[f].actions.push(script);
              const soundName = attr(active, 'soundName', '');
              if (soundName && this.mediaIds[soundName] != null) {
                out[f].sounds.push({ id: this.mediaIds[soundName], info: { loops: parseInt(attr(active, 'soundLoop', '1'), 10) || 1 } });
              }
            }
            const cmds = this._frameElements(active, frames, f, base);
            cmds.forEach((cmd) => {
              nowOccupied[cmd.depth] = true;
              out[f].commands.push(cmd);
            });
          }
          for (const d in occupied) {
            if (!nowOccupied[d]) out[f].commands.push({ type: 'remove', depth: parseInt(d, 10) });
          }
          occupied = nowOccupied;
        }
      });

      return { frames: out, labels };
    }

    _frameScript(frameEl) {
      const as = firstNamed(frameEl, 'Actionscript');
      if (!as) return '';
      const script = firstNamed(as, 'script');
      const src = script ? (script.textContent || '') : '';
      return src.trim();
    }

    /**
     * The elements a layer shows on frame `f`, tweened if this keyframe is a
     * tween. Flash stores only the two ends; the frames in between are
     * computed here, and `flashy-import.js` folds a straight run of them
     * back into a single tweened keyframe.
     */
    _frameElements(active, frames, f, base) {
      const idx = parseInt(attr(active, 'index', '0'), 10) || 0;
      const dur = parseInt(attr(active, 'duration', '1'), 10) || 1;
      const tweenType = attr(active, 'tweenType', 'none');
      const elements = [];
      const holder = firstNamed(active, 'elements');
      if (holder) {
        for (let i = 0; i < holder.childNodes.length; i++) {
          if (holder.childNodes[i].nodeType === 1) elements.push(holder.childNodes[i]);
        }
      }
      const isTween = (tweenType === 'motion' || tweenType === 'motion object') && dur > 1 && f > idx;
      if (tweenType === 'shape' && f > idx) {
        this.warn('shapetween', 'Shape tweens cannot be recreated; the first drawing ' +
          'is held for the length of the tween.');
      }
      let next = null;
      if (isTween) {
        next = frames.find((fr) => (parseInt(attr(fr, 'index', '0'), 10) || 0) === idx + dur);
      }
      const nextElements = [];
      if (next) {
        const nh = firstNamed(next, 'elements');
        if (nh) {
          for (let j = 0; j < nh.childNodes.length; j++) {
            if (nh.childNodes[j].nodeType === 1) nextElements.push(nh.childNodes[j]);
          }
        }
      }
      const t = isTween ? (f - idx) / dur : 0;

      const out = [];
      elements.forEach((el, i) => {
        let matrix, color;
        if (isTween && nextElements[i]) {
          matrix = tweenMatrix(matrixOf(el), matrixOf(nextElements[i]), t);
          color = tweenColor(colorOf(el), colorOf(nextElements[i]), t);
        }
        const cmd = this.elementCommand(el, base + i, matrix, color);
        if (cmd) out.push(cmd);
      });
      return out;
    }
  }

  // -------------------- loader --------------------
  /**
   * The same two layers the SWF reader has: `parse*` gives the document
   * model, `load*` gives a live MovieClip built from it.
   */
  class FLALoader {
    parseFile(file) { return new XFLParser().parseFile(file); }
    parseBuffer(buffer) { return new XFLParser().parseBuffer(buffer); }
    parseDirectory(list) { return new XFLParser().parseDirectory(list); }

    async loadFile(file) { return this._build(await this.parseFile(file)); }
    async loadXFLDirectory(list) { return this._build(await this.parseDirectory(list)); }

    _build(model) {
      const mc = new F.SWFLoader().build(model);
      mc.flaInfo = { width: model.width, height: model.height, fps: model.fps, warnings: model.warnings };
      return mc;
    }
  }

  F.XFL = {
    parse: (buffer) => new XFLParser().parseBuffer(buffer),
    Parser: XFLParser,
    tokenizeEdges,
    edgesFromString,
    unzip
  };
  F.FLALoader = FLALoader;
})(typeof window !== 'undefined' ? window : this);
