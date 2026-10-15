// Bitmaps, and tracing them into vector shapes.
//
// Two features in one file because the second needs the first: nothing in the
// document model could hold an image before this, so Trace Bitmap had nowhere
// to get pixels from.
//
// The promise of tracing is "a raster becomes editable vector art", so these
// specs check the things that have to be true for that to be worth having:
// the shapes land where the image was, in the image's own colours, as ordinary
// objects you can recolour and move; each of the four settings actually
// changes the result in the direction its label claims; holes come out as
// holes; and what the exporters produce agrees with what the stage draws.
//
// Fixtures are generated in the page — a canvas, drawn on, read back as a PNG
// — so there is no binary asset and the expected colours and geometry are
// known exactly rather than recorded.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, runExportedHTML, downloadFromAction } from "./helpers.js";

/* Build a PNG in the page and hand it to the importer as a File, which is
   what both the File menu and the drop handlers do. `draw` is stringified, so
   it must not close over anything. */
const MAKE_IMAGE = `
window.__makeImage = async function (w, h, drawSrc, name) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const cx = cv.getContext("2d");
  // eslint-disable-next-line no-new-func
  new Function("cx", "w", "h", drawSrc)(cx, w, h);
  const url = cv.toDataURL("image/png");
  const blob = await (await fetch(url)).blob();
  return new File([blob], (name || "fixture") + ".png", { type: "image/png" });
};
window.__importImage = async function (w, h, drawSrc, name, opts) {
  const file = await window.__makeImage(w, h, drawSrc, name);
  return window._flashyBitmap.importImageFile(file, opts || {});
};
`;

/** Two flat halves: red left, blue right. The simplest thing with two regions. */
const HALVES = `
cx.fillStyle = "#ff0000"; cx.fillRect(0, 0, w / 2, h);
cx.fillStyle = "#0000ff"; cx.fillRect(w / 2, 0, w / 2, h);
`;

/** A red ring on white — the shape that proves holes survive. */
const RING = `
cx.fillStyle = "#ffffff"; cx.fillRect(0, 0, w, h);
cx.fillStyle = "#ff0000";
cx.beginPath(); cx.arc(w / 2, h / 2, w * 0.38, 0, Math.PI * 2);
cx.arc(w / 2, h / 2, w * 0.2, 0, Math.PI * 2, true);
cx.fill("evenodd");
`;

/** A black disc on white, with a scatter of single-pixel specks. */
const SPECKLED = `
cx.fillStyle = "#ffffff"; cx.fillRect(0, 0, w, h);
cx.fillStyle = "#000000";
cx.beginPath(); cx.arc(w / 2, h / 2, w * 0.3, 0, Math.PI * 2); cx.fill();
for (let y = 2; y < h; y += 11) for (let x = 2; x < w; x += 11) cx.fillRect(x, y, 1, 1);
`;

/** A hard-edged left-to-right ramp: many near colours, no anti-aliasing. */
const RAMP = `
for (let x = 0; x < w; x++) {
  cx.fillStyle = "rgb(" + Math.round(x * 255 / w) + ",80," + (255 - Math.round(x * 255 / w)) + ")";
  cx.fillRect(x, 0, 1, h);
}
`;

/** A black square with four hard 90° corners. */
const SQUARE = `
cx.fillStyle = "#ffffff"; cx.fillRect(0, 0, w, h);
cx.fillStyle = "#000000"; cx.fillRect(w * 0.2, h * 0.2, w * 0.6, h * 0.6);
`;

async function open(page) {
  const errors = await openEditor(page);
  await page.addScriptTag({ content: MAKE_IMAGE });
  return errors;
}

/** The objects on the current keyframe. */
function objects(page) {
  return page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    return kf.objects.map((o) => ({
      type: o.type, x: o.x, y: o.y, width: o.width, height: o.height,
      fillColor: o.fillColor, fillType: o.fillType,
      strokeStyle: o.strokeStyle, strokeWidth: o.strokeWidth,
      bitmapAsset: o.bitmapAsset, pathW: o.pathW, pathH: o.pathH,
      nodes: o.path ? window.FlashyTrace.pathNodeCount(o.path) : 0,
    }));
  });
}

/** How many separate loops a traced object's path has. */
function loopCount(page, index) {
  return page.evaluate((i) => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    let n = 0;
    window.FlashyTrace.eachCommand(kf.objects[i].path, (op) => {
      if (op === window.FlashyTrace.CMD.MOVE) n++;
    });
    return n;
  }, index);
}

/* Selection chrome is drawn over the artwork in blue, so anything that probes
   pixels clears the selection first. Importing and tracing both leave what
   they made selected, which is right for a user and wrong for a probe. */
function renderClean(page) {
  return page.evaluate(() => {
    window._flashyAI.setSelection([]);
    window._flashyAI.render();
  });
}

/* Read a pixel from an exported page's canvas (which is movie-sized, so
   document coordinates map straight through). */
const EXPORT_READ = `
window.__read = function (x, y) {
  const d = document.getElementById("stage").getContext("2d", { willReadFrequently: true });
  const p = d.getImageData(x, y, 1, 1).data;
  return "#" + [p[0], p[1], p[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
};
`;

/* Wait for an exported page to paint `hex` at a point.
   Bitmap decoding is async in the export on purpose — the movie starts and
   each image joins when it lands, rather than frame one waiting on a photo —
   so "the export draws the image" is an eventual property. Polling the pixel
   is the honest assertion; counting animation frames is a race, and was one. */
async function waitForPixel(out, x, y, hex) {
  await out.waitForFunction(
    ({ x, y, hex }) => window.__read(x, y) === hex, { x, y, hex }, { timeout: 10000 });
}

/* Colour of one stage pixel, in document coordinates.
   The stage canvas is the VIEWPORT, not the movie: at the default window the
   550x400 stage is centred in a ~991x310 canvas, so `oy` is negative and
   document rows above about y=45 are simply not on the canvas. Probe near the
   middle of the stage, never near its top or bottom edge. */
function stagePixel(page, dx, dy) {
  return page.evaluate(({ dx, dy }) => {
    const c = document.getElementById("stageCanvas");
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const F = window._flashyAI;
    const ox = (c.clientWidth - F.doc.width) / 2;
    const oy = (c.clientHeight - F.doc.height) / 2;
    const d = ctx.getImageData(Math.round((ox + dx) * dpr), Math.round((oy + dy) * dpr), 1, 1).data;
    return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
  }, { dx, dy });
}

// ───────────────────────────── bitmap import ─────────────────────────────

test("importing an image adds a library asset and places it on the stage", async ({ page }) => {
  const errors = await open(page);
  const name = await page.evaluate((d) => window.__importImage(80, 60, d, "Halves"), HALVES);
  expect(name).toBe("Halves");

  const assets = await page.evaluate(() => window._flashyBitmap.assets());
  expect(Object.keys(assets)).toEqual(["Halves"]);
  expect(assets.Halves.width).toBe(80);
  expect(assets.Halves.height).toBe(60);
  expect(assets.Halves.mediaType).toBe("image/png");
  expect(assets.Halves.data.length).toBeGreaterThan(0);

  const objs = await objects(page);
  expect(objs).toHaveLength(1);
  expect(objs[0].type).toBe("bitmap");
  expect(objs[0].bitmapAsset).toBe("Halves");
  expect(objs[0].width).toBe(80);
  expect(objs[0].height).toBe(60);
  // Centred on the stage, and the pixels are actually drawn.
  expect(objs[0].x).toBe((550 - 80) / 2);
  await renderClean(page);
  expect(await stagePixel(page, 255, 200)).toBe("#ff0000");
  expect(await stagePixel(page, 295, 200)).toBe("#0000ff");
  expect(errors).toEqual([]);
});

test("a second import of the same name gets its own name, not a collision", async ({ page }) => {
  await open(page);
  const a = await page.evaluate((d) => window.__importImage(20, 20, d, "Pic"), HALVES);
  const b = await page.evaluate((d) => window.__importImage(20, 20, d, "Pic"), HALVES);
  expect([a, b]).toEqual(["Pic", "Pic 2"]);
  expect(Object.keys(await page.evaluate(() => window._flashyBitmap.assets()))).toEqual(["Pic", "Pic 2"]);
});

test("a non-image file is refused without adding an asset", async ({ page }) => {
  await open(page);
  const name = await page.evaluate(() =>
    window._flashyBitmap.importImageFile(new File(["nope"], "notes.txt", { type: "text/plain" })));
  expect(name).toBe(null);
  expect(await page.evaluate(() => Object.keys(window._flashyBitmap.assets()).length)).toBe(0);
  // Refused through the editor's own dialog, never a native alert.
  await expect(page.locator("#fy-dialog .fy-dialog-title")).toHaveText("Import Image");
});

test("an image survives save and reload, and still draws", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(80, 60, d, "Halves"), HALVES);
  const saved = await page.evaluate(() => window._flashyEditor.serializeDoc());
  expect(Object.keys(saved.bitmaps)).toEqual(["Halves"]);

  await loadDoc(page, saved);
  // Decoding is async on load; the stage draws a labelled frame until it lands.
  await page.waitForFunction(() => window._flashyBitmap.image("Halves"));
  await page.evaluate(() => window._flashyAI.render());
  expect(await stagePixel(page, 255, 200)).toBe("#ff0000");
  expect((await objects(page))[0].bitmapAsset).toBe("Halves");
});

test("deleting an asset removes every instance of it, and undo brings both back", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(40, 40, d, "Pic"), HALVES);
  await page.evaluate(() => {
    window._flashyAI.pushUndo();
    window._flashyBitmap.place("Pic", {});
    window._flashyAI.fullRefresh();
  });
  expect((await objects(page)).length).toBe(2);

  await page.evaluate(() => window._flashyBitmap.deleteBitmapAsset("Pic"));
  expect(await page.evaluate(() => Object.keys(window._flashyBitmap.assets()).length)).toBe(0);
  expect((await objects(page)).length).toBe(0);

  await page.keyboard.press("Control+z");
  expect(await page.evaluate(() => Object.keys(window._flashyBitmap.assets()))).toEqual(["Pic"]);
  expect((await objects(page)).length).toBe(2);
});

test("undo snapshots do not carry a copy of the image bytes", async ({ page }) => {
  await open(page);
  // Incompressible noise from a linear congruential generator, so the stored
  // PNG really is about a megabyte rather than a periodic pattern PNG squashes
  // down to nothing.
  await page.evaluate(() => window.__importImage(600, 600, `
    const im = cx.createImageData(w, h);
    let s = 123456789;
    for (let i = 0; i < im.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      im.data[i] = s & 255;
      im.data[i + 1] = (s >> 8) & 255;
      im.data[i + 2] = (s >> 16) & 255;
      im.data[i + 3] = 255;
    }
    cx.putImageData(im, 0, 0);
  `, "Noise"));

  const { bytes, jsonLen, carried } = await page.evaluate(() => {
    const snap = window._flashyAI.snapshot();
    const data = window._flashyBitmap.assets().Noise.data;
    return {
      bytes: data.length,
      jsonLen: snap.json.length,
      // The asset is still reachable from the snapshot — it has to be, or undo
      // past an import would lose the image — just not stringified into it.
      carried: snap.bitmaps.Noise.data === data,
    };
  });
  expect(bytes).toBeGreaterThan(100000);
  expect(carried).toBe(true);
  // Fifty of these is the undo stack; at base64 scale that was ~100MB of
  // duplicated text per large image.
  expect(jsonLen).toBeLessThan(bytes / 10);
});

// ─────────────────────────────── the tracer ───────────────────────────────

test("tracing a two-colour image produces one filled path per region, where the bitmap was", async ({ page }) => {
  const errors = await open(page);
  await page.evaluate((d) => window.__importImage(80, 60, d, "Halves"), HALVES);
  const before = (await objects(page))[0];

  const res = await page.evaluate(() => window._flashyBitmap.trace(
    window._flashyBitmap.selected(),
    { colorThreshold: 100, minArea: 8, curveFit: "pixels" }));
  expect(res.shapes).toBe(2);

  const objs = await objects(page);
  // The bitmap is gone, replaced by its trace.
  expect(objs.map((o) => o.type)).toEqual(["path", "path"]);
  const colors = objs.map((o) => o.fillColor).sort();
  expect(colors).toEqual(["#0000ff", "#ff0000"]);

  for (const o of objs) {
    expect(o.fillType).toBe("solid");
    // Filled regions, no outline: a 1px stroke on every traced shape is a mess
    // you then have to undo by hand.
    expect(o.strokeStyle).toBe("none");
    expect(o.strokeWidth).toBe(0);
    expect(o.pathW).toBeCloseTo(o.width, 5);
    expect(o.pathH).toBeCloseTo(o.height, 5);
    // Inside the box the bitmap occupied.
    expect(o.x).toBeGreaterThanOrEqual(before.x - 1);
    expect(o.y).toBeGreaterThanOrEqual(before.y - 1);
    expect(o.x + o.width).toBeLessThanOrEqual(before.x + before.width + 1);
    expect(o.y + o.height).toBeLessThanOrEqual(before.y + before.height + 1);
  }

  // And it looks like the image it came from.
  await renderClean(page);
  expect(await stagePixel(page, 255, 200)).toBe("#ff0000");
  expect(await stagePixel(page, 295, 200)).toBe("#0000ff");
  expect(errors).toEqual([]);
});

test("keeping the bitmap leaves it under the trace instead of replacing it", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(80, 60, d, "Halves"), HALVES);
  await page.evaluate(() => window._flashyBitmap.trace(
    window._flashyBitmap.selected(),
    { colorThreshold: 100, minArea: 8, curveFit: "pixels", replace: false }));

  const types = (await objects(page)).map((o) => o.type);
  // The bitmap comes first, so it is painted first and the trace sits on top.
  // The other order hides the trace under the image it came from, which
  // defeats the only reason to keep the bitmap.
  expect(types).toEqual(["bitmap", "path", "path"]);
});

test("a traced ring keeps its hole", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(120, 120, d, "Ring"), RING);
  await page.evaluate(() => window._flashyBitmap.trace(
    window._flashyBitmap.selected(),
    { colorThreshold: 100, minArea: 10, curveFit: "normal" }));

  const objs = await objects(page);
  const ringIdx = objs.findIndex((o) => o.fillColor === "#ff0000");
  expect(ringIdx).toBeGreaterThanOrEqual(0);
  // Outer boundary plus the hole: one path, two loops. Flattening the hole
  // into a separate overlapping shape would also "work" and would be wrong.
  expect(await loopCount(page, ringIdx)).toBe(2);

  // The hole has to read as a hole on the stage: the ring's own colour on the
  // band, and NOT the ring's colour at the centre.
  await renderClean(page);
  const cx = 550 / 2, cy = 400 / 2;
  expect(await stagePixel(page, cx, cy - 36)).toBe("#ff0000");
  expect(await stagePixel(page, cx, cy)).not.toBe("#ff0000");
});

test("color threshold trades colour fidelity for fewer shapes", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(128, 40, d, "Ramp"), RAMP);
  const counts = await page.evaluate(() => {
    const obj = window._flashyBitmap.selected();
    return [1, 40, 150, 500].map((ct) => {
      const r = window._flashyBitmap.preview(obj, {
        colorThreshold: ct, minArea: 1, curveFit: "normal", cornerThreshold: "normal",
      });
      return { ct, colors: r.colors, shapes: r.shapes.length };
    });
  });
  // Monotone: raising the threshold never increases the palette.
  for (let i = 1; i < counts.length; i++) {
    expect(counts[i].colors).toBeLessThanOrEqual(counts[i - 1].colors);
  }
  // And the ends are genuinely different, not a flat line.
  expect(counts[0].colors).toBeGreaterThan(counts[counts.length - 1].colors * 4);
  expect(counts[counts.length - 1].colors).toBe(1);
});

test("minimum area absorbs specks into their neighbours", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(100, 100, d, "Speckled"), SPECKLED);
  const counts = await page.evaluate(() => {
    const obj = window._flashyBitmap.selected();
    return [1, 6, 400].map((ma) => window._flashyBitmap.preview(obj, {
      colorThreshold: 100, minArea: ma, curveFit: "pixels", cornerThreshold: "normal",
    }).shapes.length);
  });
  // 1px keeps every speck; a handful of pixels wipes them out; and the disc
  // and its background survive even a very large minimum.
  expect(counts[0]).toBeGreaterThan(20);
  expect(counts[1]).toBeLessThan(counts[0] / 4);
  expect(counts[2]).toBeGreaterThanOrEqual(1);
});

test("curve fit trades nodes for smoothness, and Pixels keeps the staircase", async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__importImage(120, 120, `
    cx.fillStyle = "#ffffff"; cx.fillRect(0, 0, w, h);
    cx.fillStyle = "#008000";
    cx.beginPath(); cx.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2); cx.fill();
  `, "Disc"));
  const rows = await page.evaluate(() => {
    const obj = window._flashyBitmap.selected();
    const T = window.FlashyTrace;
    return T.CURVE_FITS.map(([key]) => {
      const r = window._flashyBitmap.preview(obj, {
        colorThreshold: 100, minArea: 8, curveFit: key, cornerThreshold: "normal",
      });
      const disc = r.shapes.find((s) => s.color !== "#ffffff");
      let quads = 0;
      T.eachCommand(disc.path, (op) => { if (op === T.CMD.QUAD) quads++; });
      return { key, nodes: T.pathNodeCount(disc.path), quads };
    });
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  // Pixels is the pixel staircase: no curves at all, and the most nodes.
  expect(byKey.pixels.quads).toBe(0);
  expect(byKey.pixels.nodes).toBe(Math.max(...rows.map((r) => r.nodes)));
  // Smoother settings never need more nodes than tighter ones.
  for (let i = 1; i < rows.length; i++) {
    expect(rows[i].nodes).toBeLessThanOrEqual(rows[i - 1].nodes);
  }
  // And the smooth end is actually curves, not a coarser polygon.
  expect(byKey.verySmooth.quads).toBeGreaterThan(0);
  expect(byKey.normal.quads).toBeGreaterThan(0);
  expect(byKey.verySmooth.nodes).toBeLessThan(byKey.pixels.nodes / 4);
});

test("corner threshold decides whether a square keeps its corners", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(100, 100, d, "Square"), SQUARE);
  const rows = await page.evaluate(() => {
    const obj = window._flashyBitmap.selected();
    const T = window.FlashyTrace;
    return ["many", "normal", "few"].map((ct) => {
      const r = window._flashyBitmap.preview(obj, {
        colorThreshold: 100, minArea: 8, curveFit: "normal", cornerThreshold: ct,
      });
      const sq = r.shapes.find((s) => s.color === "#000000");
      let lines = 0, quads = 0;
      T.eachCommand(sq.path, (op) => {
        if (op === T.CMD.LINE) lines++;
        if (op === T.CMD.QUAD) quads++;
      });
      return { ct, lines, quads, nodes: T.pathNodeCount(sq.path) };
    });
  });
  const byCt = Object.fromEntries(rows.map((r) => [r.ct, r]));
  // Many Corners: a square is four straight sides and four hard corners.
  expect(byCt.many.quads).toBe(0);
  expect(byCt.many.nodes).toBe(4);
  // Few Corners rounds even a 90° turn into the curve.
  expect(byCt.few.quads).toBeGreaterThan(0);
  expect(byCt.few.lines).toBe(0);
});

test("a traced path rescales when you edit its width and height", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(80, 60, d, "Halves"), HALVES);
  await page.evaluate(() => window._flashyBitmap.trace(
    window._flashyBitmap.selected(),
    { colorThreshold: 100, minArea: 8, curveFit: "pixels" }));

  // The red half fills its own box edge to edge. Change the box and the fill
  // has to follow — a pencil stroke would not, and a trace must, because
  // resizing is the first thing anyone does to a trace.
  const probe = await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    const red = kf.objects.find((o) => o.fillColor === "#ff0000");
    // Park it mid-stage (see stagePixel: the top of the document is off the
    // canvas) and stretch it to a square, which its 40x60 path is not.
    red.x = 150; red.y = 120; red.width = 120; red.height = 120;
    kf.objects = [red];
    // Selection chrome is drawn over the artwork in blue.
    F.setSelection([]);
    F.render();
    return { pathW: red.pathW, pathH: red.pathH };
  });
  // The authored size is remembered, which is what makes the rescale possible.
  expect(probe.pathW).toBe(40);
  expect(probe.pathH).toBe(60);

  // Filled right into both far corners of the new box, non-uniformly scaled.
  expect(await stagePixel(page, 154, 124)).toBe("#ff0000");
  expect(await stagePixel(page, 266, 236)).toBe("#ff0000");
  expect(await stagePixel(page, 210, 180)).toBe("#ff0000");
  // And not outside it.
  expect(await stagePixel(page, 144, 180)).toBe("#ffffff");
  expect(await stagePixel(page, 276, 180)).toBe("#ffffff");
});

test("a trace is one undo step that restores the bitmap", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(80, 60, d, "Halves"), HALVES);
  await page.evaluate(() => window._flashyBitmap.trace(
    window._flashyBitmap.selected(),
    { colorThreshold: 100, minArea: 8, curveFit: "pixels" }));
  expect((await objects(page)).map((o) => o.type)).toEqual(["path", "path"]);

  await page.keyboard.press("Control+z");
  const objs = await objects(page);
  expect(objs.map((o) => o.type)).toEqual(["bitmap"]);
  expect(objs[0].bitmapAsset).toBe("Halves");
  // The asset is still decoded, so it draws immediately rather than after a
  // round trip through the image loader.
  await renderClean(page);
  expect(await stagePixel(page, 255, 200)).toBe("#ff0000");
});

// ────────────────────────────── the exporters ─────────────────────────────

test("an exported HTML file draws the bitmap and the traced paths", async ({ page, context }) => {
  await open(page);
  // One of each on the stage: a bitmap on the left, its trace on the right.
  await page.evaluate((d) => window.__importImage(80, 60, d, "Halves"), HALVES);
  await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    kf.objects[0].x = 20; kf.objects[0].y = 20;
    const copy = window._flashyBitmap.place("Halves", { x: 300, y: 20 });
    F.setSelection([copy]);
    window._flashyBitmap.trace(copy, { colorThreshold: 100, minArea: 8, curveFit: "pixels" });
  });

  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() => window.__stage && window.__stage.root.children.length > 0);

  const shown = await out.evaluate(() => {
    const kinds = [];
    const walk = (n) => {
      kinds.push(n.constructor.name);
      (n.children || []).forEach(walk);
    };
    window.__stage.root.children.forEach(walk);
    return kinds;
  });
  expect(shown).toContain("Bitmap");
  expect(shown.filter((k) => k === "Shape").length).toBeGreaterThanOrEqual(2);

  // And the pixels: the bitmap's left half and the trace's left half are both
  // red, which is only true if both paths through the engine work.
  await out.addScriptTag({ content: EXPORT_READ });
  await waitForPixel(out, 40, 50, "#ff0000");
  const px = await out.evaluate(() => ({
    bitmapLeft: window.__read(40, 50),
    bitmapRight: window.__read(80, 50),
    traceLeft: window.__read(320, 50),
    traceRight: window.__read(360, 50),
  }));
  expect(px.bitmapLeft).toBe("#ff0000");
  expect(px.bitmapRight).toBe("#0000ff");
  expect(px.traceLeft).toBe("#ff0000");
  expect(px.traceRight).toBe("#0000ff");
  expect(errors).toEqual([]);
  await out.close();
});

test("an exported ring still has its hole in the engine's own renderer", async ({ page, context }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(120, 120, d, "Ring"), RING);
  await page.evaluate(() => {
    const obj = window._flashyBitmap.selected();
    obj.x = 100; obj.y = 100; obj.width = 120; obj.height = 120;
    window._flashyBitmap.trace(obj, { colorThreshold: 100, minArea: 10, curveFit: "normal" });
  });
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() => window.__stage && window.__stage.root.children.length > 0);
  await out.addScriptTag({ content: EXPORT_READ });
  // Ring centre is doc (160,160); the band sits about 35px out.
  await waitForPixel(out, 160, 125, "#ff0000");
  const px = await out.evaluate(() => ({
    band: window.__read(160, 125), hole: window.__read(160, 160),
  }));
  // Even-odd in the exported Graphics too. With nonzero the hole fills in and
  // this is the only thing that catches it.
  expect(px.band).toBe("#ff0000");
  expect(px.hole).not.toBe("#ff0000");
  expect(errors).toEqual([]);
  await out.close();
});

test("the SVG export carries the embedded image and the traced path", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(80, 60, d, "Halves"), HALVES);
  await page.evaluate(() => {
    const copy = window._flashyBitmap.place("Halves", { x: 300, y: 20 });
    window._flashyAI.setSelection([copy]);
    window._flashyBitmap.trace(copy, { colorThreshold: 100, minArea: 8, curveFit: "normal" });
  });
  const svg = await downloadFromAction(page, "exportSVG");

  expect(svg).toContain('xmlns:xlink=');
  // The image travels inside the file — an export that needs a sidecar PNG is
  // not an export.
  expect(svg).toMatch(/<image[^>]+data:image\/png;base64,/);
  expect(svg).toMatch(/<path[^>]+fill-rule="evenodd"/);
  expect(svg).toContain('fill="#ff0000"');
  // Valid XML, not just the right substrings.
  const parsed = await page.evaluate((s) => {
    const d = new DOMParser().parseFromString(s, "image/svg+xml");
    return {
      error: !!d.querySelector("parsererror"),
      images: d.getElementsByTagName("image").length,
      paths: d.getElementsByTagName("path").length,
    };
  }, svg);
  expect(parsed.error).toBe(false);
  expect(parsed.images).toBe(1);
  expect(parsed.paths).toBeGreaterThanOrEqual(2);
});

test("the sprite sheet export rasterises bitmaps and traces alike", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(80, 60, d, "Halves"), HALVES);
  await page.evaluate(() => {
    const copy = window._flashyBitmap.place("Halves", { x: 300, y: 20 });
    window._flashyAI.setSelection([copy]);
    window._flashyBitmap.trace(copy, { colorThreshold: 100, minArea: 8, curveFit: "pixels" });
  });
  const html = await downloadFromAction(page, "exportGIF");
  const sheet = (html.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/) || [])[0];
  expect(sheet).toBeTruthy();

  /* The raster exporters go through paintObj, so this is the one check that
     the authoring painter draws both new object types with no chrome — the
     sprite sheet, the GIF and the video all share that path. */
  const px = await page.evaluate(async (url) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const d = c.getContext("2d");
    d.drawImage(img, 0, 0);
    const read = (x, y) => {
      const p = d.getImageData(x, y, 1, 1).data;
      return "#" + [p[0], p[1], p[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
    };
    // Frame 1 is the first cell. The bitmap sits where placeBitmap centred it;
    // the trace is the copy at (300,20).
    return { bitmap: read(255, 200), traceLeft: read(320, 50), traceRight: read(360, 50) };
  }, sheet);
  expect(px.bitmap).toBe("#ff0000");
  expect(px.traceLeft).toBe("#ff0000");
  expect(px.traceRight).toBe("#0000ff");
});

// ───────────────────────────── the editor chrome ──────────────────────────

test("the menu offers importing and tracing, and says what to do when nothing is selected", async ({ page }) => {
  await open(page);
  const labels = await page.evaluate(() => {
    const out = {};
    window._flashyEditor.menus.forEach((m) => {
      out[m.label] = m.items.map((i) => i.label || "—");
    });
    return out;
  });
  expect(labels.File).toContain("Import Image...");
  expect(labels.Modify).toContain("Trace Bitmap...");
  expect(labels.Modify).toContain("Swap Bitmap...");

  // Nothing imported: the dialog should point at Import Image rather than
  // failing silently.
  await page.evaluate(() => window._flashyEditor.doAction("traceBitmap"));
  await expect(page.locator("#fy-dialog .fy-dialog-title")).toHaveText("Trace Bitmap");
  await expect(page.locator("#fy-dialog .fy-dialog-msg")).toContainText("Import Image");
  await page.locator("#fy-dialog .fy-dialog-btn.primary").click();

  // Imported but not selected: a different, equally specific message.
  await page.evaluate((d) => window.__importImage(40, 40, d, "Pic"), HALVES);
  await page.evaluate(() => window._flashyAI.setSelection([]));
  await page.evaluate(() => window._flashyEditor.doAction("traceBitmap"));
  await expect(page.locator("#fy-dialog .fy-dialog-msg")).toContainText("Select a bitmap");
});

test("the Trace Bitmap dialog previews the result and traces what it previewed", async ({ page }) => {
  const errors = await open(page);
  await page.evaluate((d) => window.__importImage(100, 100, d, "Speckled"), SPECKLED);
  await page.evaluate(() => window._flashyEditor.doAction("traceBitmap"));

  const dlg = page.locator("#fy-dialog");
  await expect(dlg.locator(".fy-dialog-title")).toHaveText("Trace Bitmap");
  // The four settings the feature promises, in order, plus Keep bitmap:
  // two numbers (Color Threshold, Minimum Area) and two pickers (Curve Fit,
  // Corner Threshold).
  const fields = await dlg.locator("select.fy-dialog-input, input.fy-dialog-input").evaluateAll(
    (els) => els.map((e) => e.tagName.toLowerCase() + ":" + e.type));
  expect(fields).toEqual(["input:number", "input:number", "select:select-one", "select:select-one", "input:checkbox"]);

  // Two preview canvases, original and traced, and a readout that fills in.
  await expect(dlg.locator(".fy-trace-cell canvas")).toHaveCount(2);
  await expect(dlg.locator(".fy-trace-readout")).toContainText(/shapes?,/);

  // Editing a setting has to change the reported shape count, which is the
  // whole reason the preview exists. Minimum Area down to 1 keeps every speck
  // in the fixture instead of absorbing them.
  const first = await dlg.locator(".fy-trace-readout").textContent();
  await dlg.locator("input[type=number]").nth(1).fill("1");
  await expect(dlg.locator(".fy-trace-readout")).not.toHaveText(first);
  const second = await dlg.locator(".fy-trace-readout").textContent();
  expect(parseInt(second, 10)).toBeGreaterThan(parseInt(first, 10));

  // Trace, and the document gets the shapes the preview was showing.
  await dlg.locator(".fy-dialog-btn.primary").click();
  await expect(page.locator("#fy-dialog .fy-dialog-msg")).toContainText("Traced into");
  await page.locator("#fy-dialog .fy-dialog-btn.primary").click();
  const objs = await objects(page);
  expect(objs.length).toBeGreaterThanOrEqual(2);
  expect(objs.every((o) => o.type === "path")).toBe(true);
  expect(errors).toEqual([]);
});

test("Keep bitmap in the dialog leaves the original in place", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(60, 60, d, "Halves"), HALVES);
  await page.evaluate(() => window._flashyEditor.doAction("traceBitmap"));
  const dlg = page.locator("#fy-dialog");
  await expect(dlg.locator(".fy-trace-readout")).toContainText(/shapes?,/);
  await dlg.locator("input[type=checkbox]").check();
  await dlg.locator(".fy-dialog-btn.primary").click();
  await page.locator("#fy-dialog .fy-dialog-btn.primary").click();
  expect((await objects(page)).map((o) => o.type)).toContain("bitmap");
});

test("Swap Bitmap repoints an instance and keeps its box", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(80, 60, d, "Halves"), HALVES);
  await page.evaluate(() => window.__importImage(40, 40, `
    cx.fillStyle = "#00ff00"; cx.fillRect(0, 0, w, h);
  `, "Green", { place: false }));

  await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    F.setSelection([kf.objects[0]]);
  });
  await page.evaluate(() => window._flashyEditor.doAction("swapBitmap"));
  await page.locator("#fy-dialog select").selectOption("Green");
  await page.locator("#fy-dialog .fy-dialog-btn.primary").click();

  const objs = await objects(page);
  expect(objs[0].bitmapAsset).toBe("Green");
  // Box unchanged — that is the point of a swap.
  expect(objs[0].width).toBe(80);
  expect(objs[0].height).toBe(60);
  await renderClean(page);
  expect(await stagePixel(page, 255, 200)).toBe("#00ff00");
});

test("the Library panel lists bitmaps and placing one from it works", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(40, 40, d, "Pic", { place: false }), HALVES);
  await page.evaluate(() => window._flashyWorkspace.show("library"));
  const lib = page.locator("#libPanel");
  await expect(lib.locator(".lib-subtitle")).toHaveText("Bitmaps");
  const item = lib.locator(".lib-item", { hasText: "Pic" });
  await expect(item).toHaveCount(1);
  await expect(item.locator(".lib-dim")).toHaveText("40×40");

  expect((await objects(page)).length).toBe(0);
  await item.click();
  const objs = await objects(page);
  expect(objs.length).toBe(1);
  expect(objs[0].bitmapAsset).toBe("Pic");
});

test("the Properties inspector shows a bitmap's source and offers to trace it", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(80, 60, d, "Halves"), HALVES);
  await page.evaluate(() => window._flashyWorkspace.show("props"));
  const pp = page.locator("#propsPanel");
  await expect(pp).toContainText("Bitmap Properties");
  await expect(pp).toContainText("80 × 60 px");
  await expect(pp.locator("button", { hasText: "Trace Bitmap..." })).toHaveCount(1);
  // A bitmap has no fill or stroke; showing dead controls is noise.
  await expect(pp).not.toContainText("Stroke");

  await pp.locator("button", { hasText: "Trace Bitmap..." }).click();
  await expect(page.locator("#fy-dialog .fy-dialog-title")).toHaveText("Trace Bitmap");
});

test("dropping an image on the stage places it where it was dropped", async ({ page }) => {
  await open(page);
  const where = await page.evaluate(async () => {
    const file = await window.__makeImage(40, 40, `
      cx.fillStyle = "#ff00ff"; cx.fillRect(0, 0, w, h);
    `, "Dropped");
    const dt = new DataTransfer();
    dt.items.add(file);
    const c = document.getElementById("stageCanvas");
    const r = c.getBoundingClientRect();
    const F = window._flashyAI;
    // Drop at document (200, 150).
    const clientX = r.left + (c.clientWidth - F.doc.width) / 2 + 200;
    const clientY = r.top + (c.clientHeight - F.doc.height) / 2 + 150;
    c.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, clientX, clientY, bubbles: true, cancelable: true }));
    return { clientX, clientY };
  });
  expect(where.clientX).toBeGreaterThan(0);

  await page.waitForFunction(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    return kf.objects.length === 1;
  });
  const objs = await objects(page);
  expect(objs[0].type).toBe("bitmap");
  // Centred on the drop point, not on the stage.
  expect(objs[0].x + objs[0].width / 2).toBeCloseTo(200, 0);
  expect(objs[0].y + objs[0].height / 2).toBeCloseTo(150, 0);
});

test("tracing a very large image downscales rather than grinding", async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__importImage(1600, 1200, `
    cx.fillStyle = "#ffffff"; cx.fillRect(0, 0, w, h);
    cx.fillStyle = "#123456";
    cx.beginPath(); cx.arc(w / 2, h / 2, w * 0.3, 0, Math.PI * 2); cx.fill();
  `, "Big"));

  const { ms, shapes, bounds, objWidth } = await page.evaluate(() => {
    const obj = window._flashyBitmap.selected();
    const t0 = performance.now();
    const r = window._flashyBitmap.trace(obj, {
      colorThreshold: 100, minArea: 8, curveFit: "normal",
    });
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    const disc = kf.objects.find((o) => o.fillColor !== "#ffffff");
    return {
      ms: performance.now() - t0, shapes: r.shapes,
      bounds: { w: disc.width, h: disc.height }, objWidth: obj.width,
    };
  });
  expect(shapes).toBeGreaterThanOrEqual(2);
  expect(ms).toBeLessThan(10000);
  // Import fitted a 1600px image onto a 550px stage; the trace has to come
  // back in the object's displayed space, not the source image's.
  expect(objWidth).toBeLessThanOrEqual(550);
  expect(bounds.w).toBeLessThan(objWidth + 2);
  // A disc at 0.3 of the width, so about 60% of the box across.
  expect(bounds.w).toBeGreaterThan(objWidth * 0.5);
});
