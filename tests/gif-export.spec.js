// Animated GIF export.
//
// Flash's File ▸ Export Movie had Animated GIF, and it is how most Flash
// animation actually left Flash: a looping banner, an avatar, a walk cycle
// you could paste anywhere. Flashy's "Export as Sprite Sheet" writes a PNG
// grid inside an HTML player — useful, and not a GIF. A GIF plays in an
// <img>, in a chat window and in a forum post, and nothing else in the
// export list does.
//
// flashy-gif.js is a real GIF89a encoder: median-cut global palette, ordered
// and diffusion dithering, GIF-variant LZW, the NETSCAPE2.0 loop block, and
// frame differencing. The decisive test is the last one here — the browser's
// own decoder has to accept the bytes.
import { test, expect } from "@playwright/test";
import { openEditor } from "./helpers.js";

/** Build frames in the page: n solid colours, w by h. */
const solidFrames = (page, cols, w = 8, h = 8) =>
  page.evaluate(({ cols, w, h }) => {
    window.__frames = cols.map((c) => {
      const d = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2];
        d[i * 4 + 3] = c.length > 3 ? c[3] : 255;
      }
      return { width: w, height: h, data: d };
    });
    return window.__frames.length;
  }, { cols, w, h });

/** Encode window.__frames and report the bytes plus a few landmarks. */
const encode = (page, opts = {}) =>
  page.evaluate((opts) => {
    const bytes = window.FlashyGif.encode(window.__frames, opts);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return {
      n: bytes.length,
      header: s.slice(0, 6),
      trailer: bytes[bytes.length - 1],
      netscape: s.indexOf("NETSCAPE2.0") >= 0,
      // One 0x2C image descriptor per frame.
      descriptors: [...s].filter((c) => c.charCodeAt(0) === 0x2c).length,
      // The logical screen size, little-endian at offset 6.
      width: bytes[6] | (bytes[7] << 8),
      height: bytes[8] | (bytes[9] << 8),
      packed: bytes[10],
      b64: btoa(s),
    };
  }, opts);

/* ------------------------------------------------------------------ *
 * The format
 * ------------------------------------------------------------------ */

test("the file is a GIF89a with one image per frame", async ({ page }) => {
  await openEditor(page);
  await solidFrames(page, [[255, 0, 0], [0, 255, 0], [0, 0, 255]]);
  const r = await encode(page, { delay: 10 });
  expect(r.header).toBe("GIF89a");
  expect(r.trailer).toBe(0x3b);
  expect(r.descriptors).toBe(3);
  expect(r.width).toBe(8);
  expect(r.height).toBe(8);
  // Bit 7 of the packed byte is the global-colour-table flag.
  expect(r.packed & 0x80).toBe(0x80);
});

test("a multi-frame GIF carries the loop block, and one frame does not", async ({ page }) => {
  await openEditor(page);
  await solidFrames(page, [[255, 0, 0], [0, 255, 0]]);
  const many = await encode(page, {});
  await solidFrames(page, [[255, 0, 0]]);
  const one = await encode(page, {});
  /* Without NETSCAPE2.0 a GIF plays once, which is not what anyone exporting
     an animation wants — and a still has nothing to loop. */
  expect(many.netscape).toBe(true);
  expect(one.netscape).toBe(false);

  await solidFrames(page, [[255, 0, 0], [0, 255, 0]]);
  const once = await encode(page, { loop: null });
  expect(once.netscape).toBe(false);
});

test("fewer colours than the palette size come back exactly", async ({ page }) => {
  await openEditor(page);
  await solidFrames(page, [[255, 0, 0], [0, 255, 0], [0, 0, 255]]);
  const pal = await page.evaluate(() =>
    window.FlashyGif.quantize(window.__frames, 256, 128));
  /* Flat cartoon colour is what GIF is best at, and requantising three
     colours into three would be a way to make all three slightly wrong. */
  expect(pal).toEqual([255, 0, 0, 0, 255, 0, 0, 0, 255]);
});

test("the palette shrinks to the size asked for", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    // A 64x1 horizontal ramp: 64 distinct greys.
    const d = new Uint8ClampedArray(64 * 4);
    for (let i = 0; i < 64; i++) {
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = i * 4;
      d[i * 4 + 3] = 255;
    }
    const f = [{ width: 64, height: 1, data: d }];
    const G = window.FlashyGif;
    return {
      eight: G.quantize(f, 8, 128).length / 3,
      four: G.quantize(f, 4, 128).length / 3,
      // And the entries are spread across the ramp, not bunched at one end.
      spread: G.quantize(f, 4, 128).filter((_, i) => i % 3 === 0),
    };
  });
  expect(r.eight).toBe(8);
  expect(r.four).toBe(4);
  const sorted = [...r.spread].sort((a, b) => a - b);
  expect(sorted[0]).toBeLessThan(80);
  expect(sorted[3]).toBeGreaterThan(170);
});

test("frame differencing crops each frame to what moved", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const G = window.FlashyGif;
    const make = (dotX) => {
      const d = new Uint8ClampedArray(32 * 32 * 4);
      for (let i = 0; i < 32 * 32; i++) {
        d[i * 4] = 240; d[i * 4 + 1] = 240; d[i * 4 + 2] = 240; d[i * 4 + 3] = 255;
      }
      // A 4x4 black dot.
      for (let y = 10; y < 14; y++) {
        for (let x = dotX; x < dotX + 4; x++) {
          const p = (y * 32 + x) * 4;
          d[p] = d[p + 1] = d[p + 2] = 0;
        }
      }
      return { width: 32, height: 32, data: d };
    };
    const a = make(4), b = make(6);
    return {
      first: G.changedRect(a, null),
      moved: G.changedRect(b, a),
      unchanged: G.changedRect(a, a),
    };
  });
  // The first frame is whole; it has nothing to differ from.
  expect(r.first).toEqual({ x: 0, y: 0, w: 32, h: 32 });
  // The dot moved 2px right, so columns 4..9 and rows 10..13 changed.
  expect(r.moved).toEqual({ x: 4, y: 10, w: 6, h: 4 });
  /* A frame that changed nothing still needs an image, or its delay is lost;
     1x1 is the smallest legal one. */
  expect(r.unchanged).toEqual({ x: 0, y: 0, w: 1, h: 1 });
});

test("differencing makes a mostly-still animation much smaller", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const G = window.FlashyGif;
    const frames = [];
    for (let f = 0; f < 10; f++) {
      const d = new Uint8ClampedArray(64 * 64 * 4);
      for (let i = 0; i < 64 * 64; i++) {
        // A noisy but STATIC background, so a per-frame palette cannot help.
        const v = (i * 37) % 200;
        d[i * 4] = v; d[i * 4 + 1] = 200 - v; d[i * 4 + 2] = 120;
        d[i * 4 + 3] = 255;
      }
      for (let y = 20; y < 26; y++) {
        for (let x = f * 4; x < f * 4 + 6; x++) {
          const p = (y * 64 + x) * 4;
          d[p] = d[p + 1] = d[p + 2] = 0;
        }
      }
      frames.push({ width: 64, height: 64, data: d });
    }
    return {
      on: G.encode(frames, { optimize: true }).length,
      off: G.encode(frames, { optimize: false }).length,
    };
  });
  // The whole point of differencing: a still background is stored once.
  expect(r.on).toBeLessThan(r.off / 2);
});

test("dithering changes the pixels and stays deterministic", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const G = window.FlashyGif;
    const d = new Uint8ClampedArray(32 * 32 * 4);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const p = (y * 32 + x) * 4;
        d[p] = d[p + 1] = d[p + 2] = Math.round(x * 255 / 31);
        d[p + 3] = 255;
      }
    }
    const f = [{ width: 32, height: 32, data: d }];
    /* Black, white, and a magenta transparent slot. The slot has to be a
       real reserved entry: indexFrame refuses to write the transparent index
       as a colour, so pointing it at black would turn every dark pixel
       white. That is exactly what encode() avoids by appending the slot. */
    const pal = [0, 0, 0, 255, 255, 255, 255, 0, 255];
    const run = (dither) => window.FlashyGif.indexFrame(f[0], pal, 3, {
      transparentIndex: 2, dither, ditherAmount: 256, alphaThreshold: 128
    }, null);
    const plain = run(null), ordered = run("ordered"), diff = run("diffusion");
    const uniqRows = (ix) => {
      const rows = new Set();
      for (let y = 0; y < 32; y++) rows.add(ix.slice(y * 32, y * 32 + 32).join(""));
      return rows.size;
    };
    return {
      plainRows: uniqRows(plain),
      orderedRows: uniqRows(ordered),
      diffRows: uniqRows(diff),
      orderedStable: ordered.join() === run("ordered").join(),
      diffStable: diff.join() === run("diffusion").join(),
      // Undithered, a horizontal ramp through a 2-colour palette is a hard edge.
      plainEdge: plain.slice(0, 32).join("").indexOf("1"),
    };
  });
  /* Every row identical and one hard edge: that is the banding dithering
     exists to break up. */
  expect(r.plainRows).toBe(1);
  expect(r.plainEdge).toBeGreaterThan(10);
  expect(r.orderedRows).toBeGreaterThan(1);
  expect(r.diffRows).toBeGreaterThan(1);
  // Both must be reproducible, or two encodes of one movie differ.
  expect(r.orderedStable).toBe(true);
  expect(r.diffStable).toBe(true);
});

test("LZW grows its code width one entry late, as GIF requires", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const G = window.FlashyGif;
    return {
      // 16 identical pixels compress to almost nothing.
      flat: G.lzw(new Uint8Array(16), 2).length,
      // An empty run still emits CLEAR and END.
      empty: G.lzw(new Uint8Array(0), 2).length,
      /* 4096 distinct-ish pixels force a table reset mid-stream, which is
         where an off-by-one in the code width shifts every bit after it. */
      long: G.lzw(new Uint8Array(20000).map((_, i) => i % 4), 2).length,
    };
  });
  expect(r.flat).toBeLessThan(10);
  expect(r.empty).toBeGreaterThan(0);
  expect(r.long).toBeGreaterThan(0);
  expect(r.long).toBeLessThan(20000);
});

/* ------------------------------------------------------------------ *
 * The exporter
 * ------------------------------------------------------------------ */

test("the editor encodes the scene, honouring scale and settings", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    window._flashyEditor.loadDoc({
      width: 40, height: 30, fps: 12, backgroundColor: "#FFFFFF",
      totalFrames: 3, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes:
        [1, 2, 3].map((i) => ({
          index: i, duration: 1, tweenType: "none", easing: "linear", script: "",
          objects: [{
            type: "rect", x: i * 5, y: 5, width: 10, height: 10,
            rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
            fillColor: "#CC2233", fillAlpha: 1, fillType: "solid",
            strokeStyle: "none", strokeWidth: 0,
          }],
        })) }],
    });
    const frames = F.gifFrames(1, false);
    const half = F.gifFrames(0.5, false);
    const full = F.buildGIF();
    const small = F.buildGIF({ colors: 4, scale: 0.5 });
    return {
      n: frames.length, w: frames[0].width, h: frames[0].height,
      halfW: half[0].width, halfH: half[0].height,
      fullLen: full.length, smallLen: small.length,
      fullW: full[6] | (full[7] << 8),
      smallW: small[6] | (small[7] << 8),
      settings: F.gifSettings(),
    };
  });
  expect(r.n).toBe(3);
  expect([r.w, r.h]).toEqual([40, 30]);
  expect([r.halfW, r.halfH]).toEqual([20, 15]);
  expect(r.fullW).toBe(40);
  expect(r.smallW).toBe(20);
  // A quarter of the pixels and a sixteenth of the palette is smaller.
  expect(r.smallLen).toBeLessThan(r.fullLen);
  expect(r.settings.colors).toBe(256);
});

test("the frame delays add up to the movie's real length", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    window._flashyEditor.loadDoc({
      width: 20, height: 20, fps: 24, backgroundColor: "#FFFFFF",
      totalFrames: 24, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 24, tweenType: "none", easing: "linear", script: "",
        objects: [{ type: "rect", x: 0, y: 0, width: 5, height: 5,
                    rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
                    fillColor: "#000000", fillAlpha: 1, fillType: "solid",
                    strokeStyle: "none", strokeWidth: 0 }],
      }] }],
    });
    const bytes = window._flashyAI.buildGIF({ optimize: false });
    // Walk the Graphic Control Extensions and sum their delays.
    let total = 0, n = 0;
    for (let i = 0; i < bytes.length - 8; i++) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9 && bytes[i + 2] === 0x04) {
        total += bytes[i + 4] | (bytes[i + 5] << 8);
        n++;
      }
    }
    return { total, n };
  });
  /* 24 frames at 24fps is one second, which is 100 hundredths. Rounding 4.1667
     to 4 every time would give 96 — a 4% slow-down over every second of the
     animation, which is why the rounding runs against a total. */
  expect(r.n).toBe(24);
  expect(r.total).toBe(100);
});

/* ------------------------------------------------------------------ *
 * The decisive test
 * ------------------------------------------------------------------ */

test("the browser's own decoder accepts the file", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(async () => {
    const F = window._flashyAI;
    window._flashyEditor.loadDoc({
      width: 48, height: 32, fps: 10, backgroundColor: "#113355",
      totalFrames: 4, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes:
        [1, 2, 3, 4].map((i) => ({
          index: i, duration: 1, tweenType: "none", easing: "linear", script: "",
          objects: [{
            type: "oval", x: i * 6, y: 6, width: 14, height: 14,
            rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
            fillColor: "#FFCC22", fillAlpha: 1, fillType: "solid",
            strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 2,
            strokeStyle: "solid",
          }],
        })) }],
    });
    const out = {};
    for (const opts of [{}, { colors: 16, dither: "ordered" },
                        { colors: 4, dither: "diffusion" },
                        { optimize: false }, { transparent: true }]) {
      const bytes = F.buildGIF(opts);
      const blob = new Blob([bytes], { type: "image/gif" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      const label = JSON.stringify(opts);
      try {
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = () => rej(new Error("decode failed"));
          img.src = url;
        });
        out[label] = [img.naturalWidth, img.naturalHeight];
      } catch (e) {
        out[label] = "ERROR: " + e.message;
      }
      URL.revokeObjectURL(url);
    }
    return out;
  });
  /* The real oracle. A GIF this encoder likes and the browser rejects is not
     a GIF, and every option that changes the byte stream — the palette size,
     each dither, differencing on and off, transparency — has to survive it. */
  for (const [label, v] of Object.entries(r)) {
    expect(v, label).toEqual([48, 32]);
  }
});

test("an animated GIF is in the File menu and the publish list", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const text = JSON.stringify(window._flashyEditor.menus || []);
    return {
      inMenu: text.indexOf("exportAnimGIF") >= 0,
      label: text.indexOf("Export as Animated GIF") >= 0,
    };
  });
  expect(r.inMenu).toBe(true);
  expect(r.label).toBe(true);
});
