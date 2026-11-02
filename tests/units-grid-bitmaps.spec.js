// Ruler units, the grid, and per-bitmap export settings.
//
// Three Flash settings Flashy had nothing for:
//
//   RULER UNITS   Document Properties had a units menu and every number the
//                 editor showed went through it. A movie printed to paper or
//                 laid out against a print design is authored in inches or
//                 millimetres, and converting in your head on every
//                 measurement is how you get a banner that is nearly right.
//   THE GRID      Flash set the spacing on BOTH axes, the colour, and the
//                 snap accuracy. Flashy had one gridSize, a hard-coded grey,
//                 and a snap that rounded unconditionally — which is Always
//                 Snap and nothing else.
//   BITMAPS       Sounds got per-asset export settings in Wave 11. Bitmaps
//                 had the same dialog in Flash and got nothing, so an
//                 imported photograph went into every export as the PNG it
//                 arrived as.
import { test, expect } from "@playwright/test";
import { openEditor, downloadFromAction } from "./helpers.js";

/* ------------------------------------------------------------------ *
 * Ruler units
 * ------------------------------------------------------------------ */

test("the conversions are Flash's 72 pixels to the inch", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const out = {};
    for (const [id] of F.DOC_UNITS) {
      F.setDocUnits(id);
      out[id] = { of72: +F.toUnits(72).toFixed(4), back: Math.round(F.fromUnits(1)) };
    }
    F.setDocUnits("px");
    return out;
  });
  // 72px is one inch, 2.54cm, 25.4mm, and 72 points — which makes a point a pixel.
  expect(r.px).toEqual({ of72: 72, back: 1 });
  expect(r.pt).toEqual({ of72: 72, back: 1 });
  expect(r.in.of72).toBe(1);
  expect(r.in.back).toBe(72);
  expect(r.cm.of72).toBe(2.54);
  expect(r.mm.of72).toBe(25.4);
});

test("measurements are formatted to the unit's own precision", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const at = (id, px) => { F.setDocUnits(id); return F.fmtUnits(px); };
    const out = {
      px: at("px", 137.6),
      inch: at("in", 108),
      cm: at("cm", 72),
      mm: at("mm", 36),
      // Trailing zeros trimmed, because a column padded to three decimals is
      // harder to read at a glance and that is all a readout is for.
      trimmed: at("in", 36),
      bare: (F.setDocUnits("cm"), F.fmtUnits(72, false)),
    };
    F.setDocUnits("px");
    return out;
  });
  expect(r.px).toBe("138 px");
  expect(r.inch).toBe("1.5 in");
  expect(r.cm).toBe("2.54 cm");
  expect(r.mm).toBe("12.7 mm");
  expect(r.trimmed).toBe("0.5 in");
  expect(r.bare).toBe("2.54");
});

test("a bad unit is refused rather than silently accepted", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    return { bad: F.setDocUnits("furlongs"), still: F.docUnit()[0],
             good: F.setDocUnits("mm"), now: F.docUnit()[0] };
  });
  expect(r.bad).toBe(false);
  expect(r.still).toBe("px");
  expect(r.good).toBe(true);
  expect(r.now).toBe("mm");
});

test("the Info panel reads out in the document's units", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    window._flashyEditor.loadDoc({
      width: 288, height: 144, fps: 24, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{ type: "rect", x: 72, y: 36, width: 144, height: 72,
                    rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
                    fillColor: "#000000", fillAlpha: 1, fillType: "solid",
                    strokeStyle: "none", strokeWidth: 0 }],
      }] }],
    });
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    const read = () => {
      F.updateInfoPanel();
      return document.getElementById("infoPanel").textContent;
    };
    const px = read();
    F.setDocUnits("in");
    const inches = read();
    F.setDocUnits("px");
    return { px, inches };
  });
  expect(r.px).toContain("W144 px");
  expect(r.px).toContain("Stage288 × 144 px");
  // 144px is two inches, 288 is four — and the panel names the unit it used.
  expect(r.inches).toContain("W2 in");
  expect(r.inches).toContain("H1 in");
  expect(r.inches).toContain("Stage4 × 2 in");
  expect(r.inches).toContain("Inches");
});

test("ruler ticks fall on round numbers of the document's unit", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const step = () => F.rulerStep();
    F.setDocUnits("px");
    const px = step();
    F.setDocUnits("in");
    const inch = step();
    F.setDocUnits("cm");
    const cm = step();
    F.setDocUnits("px");
    return { px, inch, cm, inchInUnits: inch / 72, cmInUnits: cm * 2.54 / 72 };
  });
  /* The pixel step is a round number of pixels; the inch step is a round
     fraction of an inch. A ruler whose ticks do not land on round numbers of
     its own unit is worse than no ruler — which is what reusing the pixel
     step for every unit would give. */
  expect([1, 2, 5, 10, 20, 50, 100, 200, 500].some((v) => Math.abs(r.px - v) < 1e-6)).toBe(true);
  expect([0.1, 0.2, 0.5, 1, 2, 5].some((v) => Math.abs(r.inchInUnits - v) < 1e-9)).toBe(true);
  expect([0.1, 0.2, 0.5, 1, 2, 5].some((v) => Math.abs(r.cmInUnits - v) < 1e-9)).toBe(true);
});

test("units and the grid are saved with the document", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setDocUnits("mm");
    F.setGrid({ x: 24, y: 8, color: "#FF00AA", accuracy: "close", show: true, snap: true });
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const back = { units: F.docUnit()[0], grid: F.gridState() };
    // And a file written before any of this existed loads as it meant.
    window._flashyEditor.loadDoc({
      width: 200, height: 200, fps: 24, backgroundColor: "#FFF",
      totalFrames: 1, library: {}, layers: [],
    });
    return { back, old: { units: F.docUnit()[0], grid: F.gridState() } };
  });
  expect(r.back.units).toBe("mm");
  expect(r.back.grid).toEqual({ x: 24, y: 8, color: "#FF00AA",
                                accuracy: "close", show: true, snap: true });
  expect(r.old.units).toBe("px");
  expect(r.old.grid.x).toBe(10);
  expect(r.old.grid.y).toBe(10);
  expect(r.old.grid.accuracy).toBe("normal");
});

test("Document Settings takes the size in the document's units", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setDocUnits("in");
    window._flashyEditor.doAction("docSettings");
    const inputs = [...document.querySelectorAll("#fy-dialog input")];
    const w = inputs.find((i) => i.previousSibling &&
                                 i.previousSibling.textContent === "Width");
    const shown = w ? w.value : null;
    // Ask for a 4-inch stage and check what the document stores.
    if (w) w.value = "4";
    [...document.querySelectorAll("#fy-dialog button")]
      .find((b) => b.textContent === "OK").click();
    const after = F.doc.width;
    F.setDocUnits("px");
    return { shown, after };
  });
  /* The default 550x400 stage is 7.639 inches wide, and typing 4 has to mean
     four INCHES — reading the field as pixels would make the stage 4px wide. */
  expect(r.shown).toBe("7.639");
  expect(r.after).toBe(288);
});

/* ------------------------------------------------------------------ *
 * The grid
 * ------------------------------------------------------------------ */

test("the grid snaps on each axis independently", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setGrid({ x: 20, y: 7, accuracy: "always" });
    return {
      x: [0, 9, 11, 25, 31].map((v) => F.snapToGrid(v, "x")),
      y: [0, 3, 4, 10, 11].map((v) => F.snapToGrid(v, "y")),
      // A grid matched to a tile sheet or a line of text is rarely square,
      // and one gridSize could not say so.
      state: F.gridState(),
    };
  });
  expect(r.x).toEqual([0, 0, 20, 20, 40]);
  expect(r.y).toEqual([0, 0, 7, 7, 14]);
  expect(r.state.x).toBe(20);
  expect(r.state.y).toBe(7);
});

test("the snap accuracy decides whether the grid takes a drag", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const probe = (acc) => {
      F.setGrid({ x: 100, y: 100, accuracy: acc });
      // At zoom 1 the tolerance is in stage units too. 3 away, 15 away, 30 away.
      return [F.snapToGrid(3, "x"), F.snapToGrid(15, "x"), F.snapToGrid(30, "x")];
    };
    const out = {
      close: probe("close"), normal: probe("normal"),
      distant: probe("distant"), always: probe("always"),
      pulls: F.GRID_ACCURACY.map((a) => a[0]),
    };
    F.setGrid({ x: 10, y: 10, accuracy: "normal" });
    return out;
  });
  /* Flash's four, and the whole difference between them: "nudge it off the
     grid deliberately" is impossible when the snap rounds unconditionally. */
  expect(r.close).toEqual([0, 15, 30]);
  expect(r.normal).toEqual([0, 15, 30]);
  expect(r.distant).toEqual([0, 0, 30]);
  expect(r.always).toEqual([0, 0, 0]);
  expect(r.pulls).toEqual(["close", "normal", "distant", "always"]);
});

test("the grid colour becomes a faint wash of that colour", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      red: F.gridRGBA("#FF0000", 0.35),
      short: F.gridRGBA("#0F0", 0.35),
      bare: F.gridRGBA("9999AA", 0.5),
      /* A hard-coded grey was invisible over grey artwork, which is most of a
         greyscale drawing — but the grid is always drawn at a low alpha
         whatever colour is chosen, because a grid as visible as the artwork
         is a grid you cannot draw over. */
      junk: F.gridRGBA("not a colour", 0.35),
      missing: F.gridRGBA(null, 0.35),
    };
  });
  expect(r.red).toBe("rgba(255,0,0,0.35)");
  expect(r.short).toBe("rgba(0,255,0,0.35)");
  expect(r.bare).toBe("rgba(153,153,170,0.5)");
  expect(r.junk).toBe("rgba(153,153,170,0.35)");
  expect(r.missing).toBe("rgba(153,153,170,0.35)");
});

test("the grid draws lines on both axes at their own spacings", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    window._flashyEditor.loadDoc({
      width: 200, height: 200, fps: 24, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {}, layers: [],
    });
    const c = document.getElementById("stageCanvas");
    const g = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const ox = (c.clientWidth - 200) / 2, oy = (c.clientHeight - 200) / 2;
    /* Count the runs of non-white along a row and a column. Each grid line is
       one run, so the counts ARE the number of lines crossed — which is what
       separate spacings have to produce differently on the two axes. */
    const runs = (horizontal) => {
      let n = 0, wasInk = false;
      for (let t = 2; t < 198; t++) {
        const px = Math.round((ox + (horizontal ? t : 101)) * dpr);
        const py = Math.round((oy + (horizontal ? 101 : t)) * dpr);
        const d = g.getImageData(px, py, 1, 1).data;
        const ink = !(d[0] > 252 && d[1] > 252 && d[2] > 252);
        if (ink && !wasInk) n++;
        wasInk = ink;
      }
      return n;
    };
    F.setGrid({ x: 40, y: 20, color: "#000000", show: true, snap: false });
    F.render();
    const on = { vertical: runs(true), horizontal: runs(false) };
    F.setGrid({ show: false });
    F.render();
    const off = { vertical: runs(true), horizontal: runs(false) };
    F.setGrid({ x: 10, y: 10, color: "#9999AA", show: false });
    return { on, off };
  });
  // 200 wide at 40 across is four interior lines; 200 tall at 20 is nine.
  expect(r.on.vertical).toBeGreaterThanOrEqual(4);
  expect(r.on.vertical).toBeLessThanOrEqual(5);
  expect(r.on.horizontal).toBeGreaterThanOrEqual(9);
  expect(r.on.horizontal).toBeLessThanOrEqual(10);
  // And hidden means hidden.
  expect(r.off).toEqual({ vertical: 0, horizontal: 0 });
});

test("a grid finer than the screen is not drawn", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    window._flashyEditor.loadDoc({
      width: 400, height: 400, fps: 24, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {}, layers: [],
    });
    const sample = () => {
      F.render();
      const c = document.getElementById("stageCanvas");
      const g = c.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const ox = (c.clientWidth - 400) / 2, oy = (c.clientHeight - 400) / 2;
      let white = 0;
      for (let i = 0; i < 40; i++) {
        const d = g.getImageData(Math.round((ox + 100 + i) * dpr),
                                 Math.round((oy + 150) * dpr), 1, 1).data;
        if (d[0] > 250 && d[1] > 250 && d[2] > 250) white++;
      }
      return white;
    };
    F.setGrid({ x: 20, y: 20, color: "#000000", show: true });
    const coarse = sample();
    F.setGrid({ x: 0.2, y: 0.2, color: "#000000", show: true });
    const fine = sample();
    F.setGrid({ x: 10, y: 10, show: false });
    return { coarse, fine };
  });
  /* At a fifth of a pixel the grid would be a flat wash that hides the
     artwork, and drawing two thousand lines to produce it is the slow way to
     get there. Skipped, so the stage stays white. */
  expect(r.coarse).toBeLessThan(40);
  expect(r.fine).toBe(40);
});

/* ------------------------------------------------------------------ *
 * Per-bitmap export settings
 * ------------------------------------------------------------------ */

/** Put a photographic and a flat bitmap in the library. */
async function twoBitmaps(page) {
  await page.evaluate(async () => {
    const make = (w, h, photo) => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d");
      if (photo) {
        /* Noise: nearly as many colours as pixels, which is what a
           photograph is. An arithmetic sequence mod 256 will NOT do -- it
           has period 256 and so only 256 distinct colours however big the
           image, which is flat artwork as far as the detector is concerned
           and rightly so. This is a hash. */
        const d = g.createImageData(w, h);
        const hash = (i) => {
          let x = (i * 2654435761) >>> 0;
          x ^= x >>> 15; x = (x * 2246822507) >>> 0;
          x ^= x >>> 13; x = (x * 3266489909) >>> 0;
          return x ^ (x >>> 16);
        };
        for (let i = 0; i < w * h; i++) {
          const v = hash(i);
          d.data[i * 4] = v & 255;
          d.data[i * 4 + 1] = (v >>> 8) & 255;
          d.data[i * 4 + 2] = (v >>> 16) & 255;
          d.data[i * 4 + 3] = 255;
        }
        g.putImageData(d, 0, 0);
      } else {
        // Flat artwork: three colours, which is what a logo is.
        g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h);
        g.fillStyle = "#CC2233"; g.fillRect(4, 4, w - 8, h - 8);
        g.fillStyle = "#2233CC"; g.fillRect(10, 10, 12, 12);
      }
      return c.toDataURL("image/png").split(",")[1];
    };
    const F = window._flashyAI;
    F.doc.bitmaps = {
      Photo: { name: "Photo", mediaType: "image/png", data: make(96, 96, true),
               width: 96, height: 96, folder: "" },
      Logo: { name: "Logo", mediaType: "image/png", data: make(64, 64, false),
              width: 64, height: 64, folder: "" },
    };
    await Promise.all(["Photo", "Logo"].map((n) => F.decodeBitmap(n)));
  });
}

test("Auto sends a photograph to JPEG and leaves flat artwork alone", async ({ page }) => {
  await openEditor(page);
  await twoBitmaps(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      photoLooks: F.bitmapLooksPhotographic("Photo"),
      logoLooks: F.bitmapLooksPhotographic("Logo"),
      photoAuto: F.bitmapCompression("Photo"),
      logoAuto: F.bitmapCompression("Logo"),
      defaults: F.bitmapSettings("Photo"),
      missing: F.bitmapSettings("Nope"),
    };
  });
  /* The cheap error is the one to prefer: JPEG on flat art rings visibly
     round every edge, PNG on a photograph is only a large file. */
  expect(r.photoLooks).toBe(true);
  expect(r.logoLooks).toBe(false);
  expect(r.photoAuto).toBe("photo");
  expect(r.logoAuto).toBe("lossless");
  expect(r.defaults).toEqual({ compression: "auto", quality: 80, smoothing: true });
  expect(r.missing).toBe(null);
});

test("transparency keeps an image lossless however photographic it looks", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const d = g.createImageData(64, 64);
    const hash = (i) => {
      let x = (i * 2654435761) >>> 0;
      x ^= x >>> 15; x = (x * 2246822507) >>> 0;
      x ^= x >>> 13; x = (x * 3266489909) >>> 0;
      return x ^ (x >>> 16);
    };
    for (let i = 0; i < 64 * 64; i++) {
      const v = hash(i);
      d.data[i * 4] = v & 255;
      d.data[i * 4 + 1] = (v >>> 8) & 255;
      d.data[i * 4 + 2] = (v >>> 16) & 255;
      // A soft edge down one side.
      d.data[i * 4 + 3] = (i % 64) < 8 ? 40 : 255;
    }
    g.putImageData(d, 0, 0);
    const F = window._flashyAI;
    F.doc.bitmaps = { Cutout: { name: "Cutout", mediaType: "image/png",
      data: c.toDataURL("image/png").split(",")[1],
      width: 64, height: 64, folder: "" } };
    await F.decodeBitmap("Cutout");
  });
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    return { looks: F.bitmapLooksPhotographic("Cutout"),
             auto: F.bitmapCompression("Cutout") };
  });
  // JPEG has no alpha channel, so this is settled before anything else.
  expect(r.looks).toBe(false);
  expect(r.auto).toBe("lossless");
});

test("a photograph set to Photo gets much smaller, and a logo does not", async ({ page }) => {
  await openEditor(page);
  await twoBitmaps(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const report = () => {
      const by = {};
      F.bitmapExportReport().forEach((e) => { by[e.name] = e; });
      return by;
    };
    const auto = report();
    F.bitmapSettings("Photo").compression = "lossless";
    const forcedLossless = report().Photo;
    F.bitmapSettings("Photo").compression = "photo";
    F.bitmapSettings("Photo").quality = 30;
    const low = report().Photo;
    /* Forcing JPEG on the flat logo is allowed -- and the encoder refuses to
       make things worse, so if the re-encode comes out BIGGER the original
       is kept. Without that check "optimise" is a pessimisation. */
    F.bitmapSettings("Logo").compression = "photo";
    const logoForced = report().Logo;
    return { auto, forcedLossless, low, logoForced };
  });
  expect(r.auto.Photo.compression).toBe("photo");
  expect(r.auto.Photo.after).toBeLessThan(r.auto.Photo.before);
  // Lossless means lossless: nothing is re-encoded.
  expect(r.forcedLossless.recoded).toBe(false);
  expect(r.forcedLossless.after).toBe(r.forcedLossless.before);
  // A lower quality is smaller still.
  expect(r.low.after).toBeLessThan(r.auto.Photo.after);
  expect(r.logoForced.after).toBeLessThanOrEqual(r.logoForced.before);
});

test("the settings survive a save and reach the export", async ({ page }) => {
  await openEditor(page);
  await twoBitmaps(page);
  const saved = await page.evaluate(() => {
    const F = window._flashyAI;
    const s = F.bitmapSettings("Photo");
    s.compression = "photo"; s.quality = 40; s.smoothing = false;
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    return { hasSettings: /"exportSettings"/.test(json), json };
  });
  /* A setting that does not survive the file is not a setting -- and
     serializeBitmaps dropped every field it did not know about. */
  expect(saved.hasSettings).toBe(true);

  const back = await page.evaluate((json) => {
    window._flashyEditor.loadDoc(JSON.parse(json));
    return window._flashyAI.bitmapSettings("Photo");
  }, saved.json);
  expect(back).toEqual({ compression: "photo", quality: 40, smoothing: false });

  const inExport = await page.evaluate(async () => {
    const F = window._flashyAI;
    await F.decodeBitmap("Photo");
    const d = F.exportDocData();
    return { type: d.bitmaps.Photo.mediaType, logo: d.bitmaps.Logo.mediaType,
             photoLen: d.bitmaps.Photo.data.length };
  });
  /* The export ships the re-encoded copy while the document keeps the
     lossless original, which is exactly what Flash's dialog did. */
  expect(inExport.type).toBe("image/jpeg");
  expect(inExport.logo).toBe("image/png");
  expect(inExport.photoLen).toBeGreaterThan(0);
});

test("Bitmap Properties explains itself with nothing selected", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    window._flashyAI.setSelection([]);
    window._flashyEditor.doAction("bitmapSettings");
  });
  const text = await page.evaluate(() =>
    document.getElementById("fy-dialog").textContent);
  expect(text).toContain("Select a bitmap");
  // And says where the setting belongs, which is the part that is not obvious.
  expect(text).toContain("IMAGE");
});

test("the grid and bitmap dialogs are in the menus", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const text = JSON.stringify(window._flashyEditor.menus || []);
    return {
      grid: text.indexOf("gridSettings") >= 0,
      gridLabel: text.indexOf("Edit Grid") >= 0,
      bitmap: text.indexOf("bitmapSettings") >= 0,
      bitmapLabel: text.indexOf("Bitmap Properties") >= 0,
    };
  });
  expect(r.grid).toBe(true);
  expect(r.gridLabel).toBe(true);
  expect(r.bitmap).toBe(true);
  expect(r.bitmapLabel).toBe(true);
});
