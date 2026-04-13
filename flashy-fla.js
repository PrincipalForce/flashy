/* flashy-fla.js — FLA / XFL importer for Flashy
 *
 * Modern Flash FLA files are ZIP archives of XFL (XML) documents. This loader:
 *   1. Reads the ZIP (using the browser's native DecompressionStream for
 *      deflate — no third-party zlib needed)
 *   2. Parses DOMDocument.xml and LIBRARY/*.xml via DOMParser
 *   3. Builds a Flashy.MovieClip tree that mirrors the FLA timeline structure
 *
 * SCOPE — what is supported:
 *   - FLA (ZIP) or an unzipped XFL directory via File[] input (webkitdirectory)
 *   - DOMTimeline → MovieClip with one frame per DOMFrame
 *   - DOMLayer rendering order
 *   - DOMShape with solid fills and solid strokes, straight/quadratic edges
 *   - DOMSymbolInstance — references to library MovieClips (nested timelines)
 *   - Basic matrix transforms on symbol instances
 *
 * NOT SUPPORTED: motion/classic tweens, masks, guides, filters, 3D, bitmaps,
 * text, sound, actionscript, legacy (pre-CS5) OLE compound FLA format.
 *
 * Usage:
 *   const loader = new Flashy.FLALoader();
 *   const mc = await loader.loadFile(fileFromInput);        // FLA zip
 *   const mc = await loader.loadXFLDirectory(filesFromDir); // unzipped XFL
 */
(function (global) {
  'use strict';

  const F = global.Flashy;
  if (!F) throw new Error('flashy.js must be loaded before flashy-fla.js');

  // -------------------- minimal ZIP reader --------------------
  async function unzip(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // Find End Of Central Directory
    let eocd = -1;
    const minScan = Math.max(0, bytes.length - 65558);
    for (let i = bytes.length - 22; i >= minScan; i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a valid ZIP/FLA');

    const cdSize   = view.getUint32(eocd + 12, true);
    const cdOffset = view.getUint32(eocd + 16, true);

    const files = {};
    let p = cdOffset;
    const cdEnd = cdOffset + cdSize;
    while (p < cdEnd) {
      if (view.getUint32(p, true) !== 0x02014b50) break;
      const method    = view.getUint16(p + 10, true);
      const compSize  = view.getUint32(p + 20, true);
      const nameLen   = view.getUint16(p + 28, true);
      const extraLen  = view.getUint16(p + 30, true);
      const commentLn = view.getUint16(p + 32, true);
      const localOff  = view.getUint32(p + 42, true);
      const name      = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
      files[name] = { method, compSize, localOff };
      p += 46 + nameLen + extraLen + commentLn;
    }

    const out = {};
    for (const name in files) {
      const e = files[name];
      const lh = e.localOff;
      if (view.getUint32(lh, true) !== 0x04034b50) continue;
      const lnl = view.getUint16(lh + 26, true);
      const lxl = view.getUint16(lh + 28, true);
      const dataStart = lh + 30 + lnl + lxl;
      const data = bytes.subarray(dataStart, dataStart + e.compSize);
      if (e.method === 0) {
        out[name] = data;
      } else if (e.method === 8) {
        if (typeof DecompressionStream === 'undefined') {
          throw new Error('DecompressionStream not available');
        }
        const ds = new DecompressionStream('deflate-raw');
        const stream = new Blob([data]).stream().pipeThrough(ds);
        out[name] = new Uint8Array(await new Response(stream).arrayBuffer());
      }
    }
    return out;
  }

  // -------------------- XFL edge-string parser --------------------
  // The "edges" attribute of a DOMEdge is a compact string like:
  //     "!0 0|100 0|100 100|0 100|0 0"
  // with operators:
  //     !x y           moveTo
  //     | x y          lineTo
  //     / x y          lineTo (also used)
  //     [ cx cy x y    quadratic curveTo
  //     ] cx cy x y    quadratic curveTo (variant)
  // Numbers may be decimals in twips-like units, or hex with a leading '#'.
  function tokenizeEdges(str) {
    const tokens = [];
    let i = 0;
    const n = str.length;
    while (i < n) {
      const ch = str[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
      if (ch === '!' || ch === '|' || ch === '/' || ch === '[' || ch === ']' || ch === 'S') {
        tokens.push(ch); i++; continue;
      }
      // number: optional leading '#' (hex), sign, digits, optional dot, optional fraction
      let j = i;
      if (str[j] === '#') { // hex with optional '.' fractional bytes
        j++;
        while (j < n && /[0-9A-Fa-f]/.test(str[j])) j++;
        if (str[j] === '.') { j++; while (j < n && /[0-9A-Fa-f]/.test(str[j])) j++; }
        const hex = str.slice(i + 1, j);
        const [whole, frac] = hex.split('.');
        let val = parseInt(whole, 16);
        if (whole[0] && parseInt(whole[0], 16) >= 8 && whole.length >= 2) {
          // signed interpretation: subtract if top bit set
          const bits = whole.length * 4;
          if (val & (1 << (bits - 1))) val -= (1 << bits);
        }
        if (frac) val += parseInt(frac, 16) / 256;
        tokens.push(val / 20); // twips → pixels
        i = j; continue;
      }
      if (ch === '-' || ch === '+' || (ch >= '0' && ch <= '9') || ch === '.') {
        while (j < n && /[0-9.\-+eE]/.test(str[j])) j++;
        tokens.push(parseFloat(str.slice(i, j)));
        i = j; continue;
      }
      i++; // unknown — skip
    }
    return tokens;
  }

  function renderEdgesToGraphics(edgeStr, graphics) {
    const t = tokenizeEdges(edgeStr);
    let k = 0;
    let x = 0, y = 0;
    const readPair = () => {
      const a = t[k++]; const b = t[k++];
      return [a, b];
    };
    while (k < t.length) {
      const op = t[k++];
      if (op === '!') {
        [x, y] = readPair(); graphics.moveTo(x, y);
      } else if (op === '|' || op === '/') {
        [x, y] = readPair(); graphics.lineTo(x, y);
      } else if (op === '[' || op === ']') {
        const [cx, cy] = readPair();
        const [nx, ny] = readPair();
        x = nx; y = ny;
        graphics.curveTo(cx, cy, x, y);
      } else if (op === 'S') {
        // Select — skip one following number (style index)
        k++;
      } else if (typeof op === 'number') {
        // stray number, skip
      }
    }
  }

  // -------------------- color helpers --------------------
  function parseColorAttr(str) {
    if (!str) return 0x000000;
    if (str[0] === '#') {
      return parseInt(str.slice(1), 16) & 0xffffff;
    }
    return 0x000000;
  }

  // -------------------- FLA / XFL loader --------------------
  class FLALoader {
    async loadFile(file) {
      const buf = await file.arrayBuffer();
      const files = await unzip(new Uint8Array(buf));
      return this._buildFromFiles(files, name => {
        const bytes = files[name];
        return bytes ? new TextDecoder().decode(bytes) : null;
      });
    }

    async loadXFLDirectory(fileList) {
      // fileList is a FileList from <input type="file" webkitdirectory>
      const files = {};
      const texts = {};
      const promises = [];
      for (const file of fileList) {
        const path = file.webkitRelativePath || file.name;
        // strip top-level folder name so paths match ZIP layout
        const slash = path.indexOf('/');
        const key = slash >= 0 ? path.slice(slash + 1) : path;
        files[key] = file;
        if (/\.xml$/i.test(key)) {
          promises.push(file.text().then(txt => { texts[key] = txt; }));
        }
      }
      await Promise.all(promises);
      return this._buildFromFiles(files, name => texts[name] || null);
    }

    _buildFromFiles(files, readText) {
      const domXml = readText('DOMDocument.xml');
      if (!domXml) throw new Error('DOMDocument.xml not found — not a valid FLA/XFL');
      const parser = new DOMParser();
      const doc = parser.parseFromString(domXml, 'application/xml');

      const root = doc.documentElement;
      const width  = parseFloat(root.getAttribute('width'))  || 550;
      const height = parseFloat(root.getAttribute('height')) || 400;
      const fps    = parseFloat(root.getAttribute('frameRate')) || 24;

      // Build symbol library on demand
      const library = {};
      const libItems = doc.querySelectorAll('Include');
      const libHrefs = [];
      libItems.forEach(inc => libHrefs.push(inc.getAttribute('href')));

      const resolveSymbol = (name) => {
        if (library[name]) return library[name];
        const href = libHrefs.find(h => h && h.replace(/\\/g, '/') === name + '.xml')
                  || libHrefs.find(h => h && h.endsWith('/' + name + '.xml'))
                  || (name + '.xml');
        const xml = readText('LIBRARY/' + href) || readText('LIBRARY/' + name + '.xml');
        if (!xml) return null;
        const symDoc = parser.parseFromString(xml, 'application/xml');
        const tl = symDoc.querySelector('DOMTimeline');
        if (!tl) return null;
        const mc = new F.MovieClip();
        library[name] = mc;         // register early to avoid infinite recursion
        this._buildTimeline(tl, mc, resolveSymbol);
        return mc;
      };

      // Build root timeline
      const rootMC = new F.MovieClip();
      const rootTL = doc.querySelector('timelines > DOMTimeline') || doc.querySelector('DOMTimeline');
      if (rootTL) this._buildTimeline(rootTL, rootMC, resolveSymbol);
      rootMC.flaInfo = { width, height, fps };
      return rootMC;
    }

    _buildTimeline(tlNode, mc, resolveSymbol) {
      const layers = Array.from(tlNode.querySelectorAll(':scope > layers > DOMLayer'));
      // Frames are per-layer; compute total frames
      let totalFrames = 1;
      for (const layer of layers) {
        const frames = layer.querySelectorAll(':scope > frames > DOMFrame');
        frames.forEach(f => {
          const idx = parseInt(f.getAttribute('index'), 10) || 0;
          const dur = parseInt(f.getAttribute('duration'), 10) || 1;
          if (idx + dur > totalFrames) totalFrames = idx + dur;
        });
      }
      mc.timeline.setTotalFrames(Math.max(1, totalFrames));

      // Children are added once; frame scripts toggle visibility/transform.
      // For simplicity each frame rebuilds the display list via a frame script.
      const layersReversed = layers.slice().reverse(); // DOMLayer order: top to bottom

      for (let fi = 1; fi <= totalFrames; fi++) {
        const frameCmds = [];
        for (const layer of layersReversed) {
          const frames = Array.from(layer.querySelectorAll(':scope > frames > DOMFrame'));
          // Find frame that contains fi (index <= fi-1 < index+duration)
          const active = frames.find(f => {
            const idx = parseInt(f.getAttribute('index'), 10) || 0;
            const dur = parseInt(f.getAttribute('duration'), 10) || 1;
            return idx <= (fi - 1) && (fi - 1) < idx + dur;
          });
          if (!active) continue;
          const elements = Array.from(active.querySelectorAll(':scope > elements > *'));
          for (const el of elements) {
            frameCmds.push(this._buildElement(el, resolveSymbol));
          }
        }
        const createNodes = frameCmds.filter(Boolean);
        mc.timeline.addFrameScript(fi, function () {
          this.removeAllChildren();
          for (const node of createNodes) this.addChild(node);
        });
      }
    }

    _buildElement(el, resolveSymbol) {
      const tag = el.tagName;
      if (tag === 'DOMShape') return this._buildShape(el);
      if (tag === 'DOMSymbolInstance') {
        const libName = el.getAttribute('libraryItemName');
        const sym = resolveSymbol(libName);
        if (!sym) return null;
        // Each placement needs an independent instance — clone via a thin
        // MovieClip wrapper that re-hosts the same symbol. Since Flashy's
        // display tree assumes single-parent, we build a shallow copy.
        const inst = this._cloneMovieClip(sym);
        this._applyMatrix(inst, el.querySelector('matrix > Matrix'));
        return inst;
      }
      return null;
    }

    _buildShape(shapeEl) {
      const shape = new F.Shape();
      const g = shape.graphics;
      // Collect fill and stroke styles keyed by index
      const fills = {};
      const strokes = {};
      shapeEl.querySelectorAll(':scope > fills > FillStyle').forEach(fs => {
        const idx = parseInt(fs.getAttribute('index'), 10);
        const solid = fs.querySelector('SolidColor');
        if (solid) {
          fills[idx] = {
            color: parseColorAttr(solid.getAttribute('color')),
            alpha: parseFloat(solid.getAttribute('alpha') || '1'),
          };
        }
      });
      shapeEl.querySelectorAll(':scope > strokes > StrokeStyle').forEach(ss => {
        const idx = parseInt(ss.getAttribute('index'), 10);
        const solid = ss.querySelector('SolidStroke');
        if (solid) {
          const fill = solid.querySelector('SolidColor');
          strokes[idx] = {
            width: parseFloat(solid.getAttribute('weight') || '1'),
            color: fill ? parseColorAttr(fill.getAttribute('color')) : 0,
            alpha: fill ? parseFloat(fill.getAttribute('alpha') || '1') : 1,
          };
        }
      });

      const edges = shapeEl.querySelectorAll(':scope > edges > Edge');
      edges.forEach(edge => {
        const fs = edge.getAttribute('fillStyle1');
        const ss = edge.getAttribute('strokeStyle');
        if (fs && fills[parseInt(fs, 10)]) {
          const f = fills[parseInt(fs, 10)];
          g.beginFill(f.color, f.alpha);
        }
        if (ss && strokes[parseInt(ss, 10)]) {
          const s = strokes[parseInt(ss, 10)];
          g.lineStyle(s.width, s.color, s.alpha);
        } else {
          g.lineStyle(0);
        }
        const str = edge.getAttribute('edges');
        if (str) renderEdgesToGraphics(str, g);
        if (fs) g.endFill();
      });
      return shape;
    }

    _applyMatrix(node, mEl) {
      if (!mEl) return;
      const a  = parseFloat(mEl.getAttribute('a')  || '1');
      const b  = parseFloat(mEl.getAttribute('b')  || '0');
      const c  = parseFloat(mEl.getAttribute('c')  || '0');
      const d  = parseFloat(mEl.getAttribute('d')  || '1');
      const tx = parseFloat(mEl.getAttribute('tx') || '0');
      const ty = parseFloat(mEl.getAttribute('ty') || '0');
      node.x = tx;
      node.y = ty;
      node.scaleX = Math.hypot(a, b) || 1;
      node.scaleY = Math.hypot(c, d) || 1;
      node.rotation = Math.atan2(b, a);
    }

    // Minimal deep-ish clone of a MovieClip, sharing Graphics data (which is
    // immutable command lists) but duplicating nodes so each placement lives
    // independently in the display tree.
    _cloneMovieClip(mc) {
      const copy = new F.MovieClip();
      copy.graphics = mc.graphics; // share commands
      copy.timeline = mc.timeline; // share timeline (frame scripts rebuild children)
      copy.loop = mc.loop;
      return copy;
    }
  }

  F.FLALoader = FLALoader;
})(typeof window !== 'undefined' ? window : this);
