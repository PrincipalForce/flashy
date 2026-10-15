// The eraser.
//
// One tool over two completely different mechanics: a vector shape is
// subtracted as real geometry, a bitmap is stencilled. These specs check the
// things that have to be true for that to be worth having.
//
// For vectors: the shape that comes back is still editable vector art, in the
// right place, with the right colour; erasing through the middle gives two
// objects you can move apart; a drawn line stays a line; and — the one that
// matters most — an edge the brush never touched is bit-for-bit where it was,
// however many strokes have been made. A rasterise-and-retrace eraser would
// pass everything here except that last one, and would quietly degrade the
// whole drawing every time it was used.
//
// For bitmaps: the pixels are kept and masked, so erasing is reversible, costs
// nothing in the document, and survives every exporter.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, runExportedHTML, downloadFromAction } from "./helpers.js";

/* A document with one object on one layer, so each spec states exactly what it
   is erasing. */
function docWith(objects, over = {}) {
  return {
    width: 550, height: 400, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 10,
    layers: [{
      name: "Art", visible: true, locked: false,
      keyframes: [{ index: 1, duration: 10, tweenType: "none", easing: "linear", script: "", objects }],
    }],
    library: {}, sounds: {}, bitmaps: {},
    ...over,
  };
}

const shape = (over = {}) => ({
  type: "rect", x: 100, y: 100, width: 200, height: 150,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#CC3344", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

/** Drag the eraser along a list of document points, through the real tool. */
async function eraseDrag(page, points, opts = {}) {
  return page.evaluate(({ points, opts }) => {
    const F = window._flashyAI;
    const canvas = document.getElementById("stageCanvas");
    const r = canvas.getBoundingClientRect();
    const ox = r.left + (canvas.clientWidth - F.doc.width) / 2;
    const oy = r.top + (canvas.clientHeight - F.doc.height) / 2;
    if (opts.size) window._flashyEraser.setSize(opts.size);
    if (opts.shape) window._flashyEraser.setShape(opts.shape);
    F.setTool("eraser");
    const ev = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
      clientX: ox + x, clientY: oy + y, bubbles: true, button: 0, pointerId: 1, isPrimary: true,
    }));
    ev("pointerdown", points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ev("pointermove", points[i][0], points[i][1]);
    ev("pointerup", points[points.length - 1][0], points[points.length - 1][1]);
  }, { points, opts });
}

/** The objects on the current keyframe, in paint order. */
function objects(page) {
  return page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    return kf.objects.map((o) => ({
      type: o.type, x: o.x, y: o.y, width: o.width, height: o.height,
      fillColor: o.fillColor, fillType: o.fillType,
      bitmapAsset: o.bitmapAsset,
      maskLen: o.eraseMask ? o.eraseMask.length : 0,
      points: o.points ? o.points.length : 0,
      area: o.type === "path" && o.path
        ? window.FlashyGeom.area(window.FlashyGeom.pathToLoops(o.path, 0.05))
        : null,
    }));
  });
}

/* Colour of one stage pixel, in document coordinates.
   The stage canvas is the viewport, not the movie: the 550x400 stage is
   centred in a ~991x310 canvas, so rows above about y=45 are off the canvas.
   Probe the middle, never the top or bottom. */
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

function renderClean(page) {
  return page.evaluate(() => {
    window._flashyAI.setSelection([]);
    window._flashyAI.render();
  });
}

/* Build a PNG in the page and import it, the way the File menu does. */
const MAKE_IMAGE = `
window.__importImage = async function (w, h, drawSrc, name) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  new Function("cx", "w", "h", drawSrc)(cv.getContext("2d"), w, h);
  const url = cv.toDataURL("image/png");
  const blob = await (await fetch(url)).blob();
  return window._flashyBitmap.importImageFile(new File([blob], (name || "Pic") + ".png", { type: "image/png" }));
};
`;
const SOLID = `cx.fillStyle = "#2277dd"; cx.fillRect(0, 0, w, h);`;

async function open(page) {
  const errors = await openEditor(page);
  await page.addScriptTag({ content: MAKE_IMAGE });
  return errors;
}

// ───────────────────────────── the tool itself ────────────────────────────

test("the eraser is in the toolbox with its own options", async ({ page }) => {
  await open(page);
  const btn = page.locator('button[title*="Eraser"]');
  await expect(btn).toHaveCount(1);

  // Options are hidden until the tool is picked.
  await expect(page.locator("#tool-options")).toBeHidden();
  await btn.click();
  await expect(page.locator("#tool-options")).toBeVisible();
  await expect(page.locator("#eraserSizeLabel")).toHaveText(/\d+ px/);

  // The bracket keys resize it, as in every other drawing application.
  const before = await page.evaluate(() => window._flashyEraser.size());
  await page.keyboard.press("]");
  const bigger = await page.evaluate(() => window._flashyEraser.size());
  expect(bigger).toBeGreaterThan(before);
  await page.keyboard.press("[");
  expect(await page.evaluate(() => window._flashyEraser.size())).toBeLessThan(bigger);

  // Round and square are both offered, and the choice sticks.
  await page.locator('.tool-opt-btn[data-shape="square"]').click();
  expect(await page.evaluate(() => window._flashyEraser.shape())).toBe("square");
  await expect(page.locator('.tool-opt-btn[data-shape="square"]')).toHaveClass(/active/);
});

test("the E key picks the eraser", async ({ page }) => {
  await open(page);
  await page.keyboard.press("e");
  await expect(page.locator('button[title*="Eraser"]')).toHaveClass(/active/);
});

// ──────────────────────────── erasing vectors ─────────────────────────────

test("erasing a corner leaves an editable path in the same place and colour", async ({ page }) => {
  const errors = await open(page);
  await loadDoc(page, docWith([shape()]));
  // Clip a corner off the top-left of the 200x150 rect at (100,100).
  await eraseDrag(page, [[80, 120], [120, 80]], { size: 40 });

  const objs = await objects(page);
  expect(objs).toHaveLength(1);
  // A rectangle with a bite out of it is no longer a rectangle; it is a path,
  // which is what makes the result editable rather than a special case.
  expect(objs[0].type).toBe("path");
  expect(objs[0].fillColor.toLowerCase()).toBe("#cc3344");
  expect(objs[0].fillType).toBe("solid");
  // Still where it was, minus the corner.
  expect(objs[0].x).toBeCloseTo(100, 0);
  expect(objs[0].y).toBeCloseTo(100, 0);
  expect(objs[0].width).toBeCloseTo(200, 0);
  expect(objs[0].height).toBeCloseTo(150, 0);
  expect(objs[0].area).toBeLessThan(200 * 150);
  expect(objs[0].area).toBeGreaterThan(200 * 150 * 0.9);

  await renderClean(page);
  expect(await stagePixel(page, 200, 180)).toBe("#cc3344");  // untouched middle
  expect(await stagePixel(page, 104, 104)).toBe("#ffffff");  // the bite
  expect(errors).toEqual([]);
});

test("erasing through the middle splits a shape into two objects", async ({ page }) => {
  await open(page);
  await loadDoc(page, docWith([shape()]));
  // A vertical swipe clean through the 200x150 rect.
  await eraseDrag(page, [[200, 80], [200, 270]], { size: 30 });

  const objs = await objects(page);
  expect(objs).toHaveLength(2);
  expect(objs.every((o) => o.type === "path")).toBe(true);
  // Two separate objects, left and right of the cut — not one object in two
  // pieces, so they can be selected and moved apart.
  const xs = objs.map((o) => o.x).sort((a, b) => a - b);
  expect(xs[0]).toBeCloseTo(100, 0);
  expect(xs[1]).toBeGreaterThan(200);

  await renderClean(page);
  expect(await stagePixel(page, 140, 180)).toBe("#cc3344");
  expect(await stagePixel(page, 200, 180)).toBe("#ffffff");
  expect(await stagePixel(page, 270, 180)).toBe("#cc3344");
});

test("erasing the inside of a shape punches a hole, not a notch", async ({ page }) => {
  await open(page);
  await loadDoc(page, docWith([shape()]));
  await eraseDrag(page, [[200, 175]], { size: 50 });

  const objs = await objects(page);
  expect(objs).toHaveLength(1);
  // Outer boundary plus the hole, both on the one path.
  const loops = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).objects[0];
    return window.FlashyGeom.pathToLoops(o.path, 0.05).length;
  });
  expect(loops).toBe(2);

  await renderClean(page);
  expect(await stagePixel(page, 200, 175)).toBe("#ffffff");
  expect(await stagePixel(page, 120, 175)).toBe("#cc3344");
  expect(await stagePixel(page, 280, 175)).toBe("#cc3344");
});

test("erasing a whole shape removes it", async ({ page }) => {
  await open(page);
  await loadDoc(page, docWith([shape({ x: 200, y: 180, width: 30, height: 30 })]));
  await eraseDrag(page, [[215, 195]], { size: 90 });
  expect(await objects(page)).toHaveLength(0);
});

test("an untouched edge does not drift, however many strokes are made", async ({ page }) => {
  await open(page);
  await loadDoc(page, docWith([shape()]));

  // Twenty strokes nibbling the left edge. The right edge is never touched.
  for (let i = 0; i < 20; i++) {
    await eraseDrag(page, [[92, 110 + i * 6], [104, 110 + i * 6]], { size: 10 });
  }
  const objs = await objects(page);
  expect(objs.length).toBeGreaterThanOrEqual(1);

  const right = await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    return Math.max(...kf.objects.map((o) => o.x + o.width));
  });
  /* Exactly 300, not approximately: the subtraction is real geometry, so an
     edge the brush never reached keeps its original coordinates to the bit.
     An eraser that rasterised and re-traced would land near 300 and drift
     a little further every stroke. */
  expect(right).toBe(300);

  /* And the left side really was eaten into. Checked by area, not by the
     bounding box: most of the left edge is untouched, so the box still starts
     at x=100 even though there are twenty bites out of it. */
  const area = await page.evaluate(() => {
    const F = window._flashyAI;
    const G = window.FlashyGeom;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    return kf.objects.reduce((a, o) => a + G.area(G.pathToLoops(o.path, 0.05)), 0);
  });
  expect(area).toBeLessThan(200 * 150 - 500);
  expect(area).toBeGreaterThan(200 * 150 * 0.8);
});

test("erasing part of a line leaves lines, not filled outlines", async ({ page }) => {
  await open(page);
  await loadDoc(page, docWith([{
    type: "pencil", x: 100, y: 200, width: 200, height: 0,
    rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
    points: [0, 0, 200, 0],
    fillColor: "#000000", fillAlpha: 1, fillType: "none",
    strokeColor: "#1133AA", strokeAlpha: 1, strokeWidth: 3, strokeStyle: "solid",
  }]));
  await eraseDrag(page, [[200, 200]], { size: 40 });

  const objs = await objects(page);
  expect(objs).toHaveLength(2);
  /* Still pencil strokes. Subtracting from the line's outline would also
     "work" and would turn something you can still restyle into a filled
     shape you cannot. */
  expect(objs.every((o) => o.type === "pencil")).toBe(true);
  expect(objs[0].x).toBeCloseTo(100, 0);
  expect(objs[0].x + objs[0].width).toBeLessThan(185);
  expect(objs[1].x).toBeGreaterThan(215);
  expect(objs[1].x + objs[1].width).toBeCloseTo(300, 0);

  const kept = await page.evaluate(() => {
    const F = window._flashyAI;
    return F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame())
      .objects.map((o) => ({ c: o.strokeColor, w: o.strokeWidth }));
  });
  expect(kept).toEqual([{ c: "#1133AA", w: 3 }, { c: "#1133AA", w: 3 }]);
});

test("a rotated shape is erased where it actually appears", async ({ page }) => {
  await open(page);
  // A long thin bar, rotated 90°, so its drawn box and its x/y/w/h disagree.
  await loadDoc(page, docWith([shape({ x: 150, y: 190, width: 200, height: 20, rotation: 90 })]));
  await renderClean(page);
  // Rotated about its centre (250,200): the bar now runs vertically.
  expect(await stagePixel(page, 250, 130)).toBe("#cc3344");

  await eraseDrag(page, [[250, 130]], { size: 40 });
  await renderClean(page);
  // Erased where it looked, and still present further down the bar.
  expect(await stagePixel(page, 250, 130)).toBe("#ffffff");
  expect(await stagePixel(page, 250, 250)).toBe("#cc3344");
});

test("symbols and text are left alone, and the tool says why", async ({ page }) => {
  await open(page);
  await loadDoc(page, docWith(
    [{
      type: "symbol", symbolName: "Box", instanceName: "", x: 150, y: 150,
      width: 100, height: 100, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
    }],
    {
      library: {
        Box: {
          objects: [shape({ x: 0, y: 0, width: 100, height: 100, fillColor: "#22AA66" })],
          totalFrames: 1, behavior: "graphic",
        },
      },
    }
  ));
  await eraseDrag(page, [[180, 180], [220, 220]], { size: 40 });

  const objs = await objects(page);
  expect(objs).toHaveLength(1);
  expect(objs[0].type).toBe("symbol");
  // Silence here is the commonest possible confusion, so it is explained.
  await expect(page.locator("#fy-dialog .fy-dialog-title")).toHaveText("Eraser");
  await expect(page.locator("#fy-dialog .fy-dialog-msg")).toContainText("Symbols, text");
});

test("a locked layer cannot be erased", async ({ page }) => {
  await open(page);
  const d = docWith([shape()]);
  d.layers[0].locked = true;
  await loadDoc(page, d);
  await eraseDrag(page, [[200, 175]], { size: 60 });
  const objs = await objects(page);
  expect(objs).toHaveLength(1);
  expect(objs[0].type).toBe("rect");
  await expect(page.locator("#fy-dialog .fy-dialog-msg")).toContainText("locked");
});

test("one stroke is one undo step", async ({ page }) => {
  await open(page);
  await loadDoc(page, docWith([shape()]));
  await eraseDrag(page, [[200, 80], [200, 270]], { size: 30 });
  expect(await objects(page)).toHaveLength(2);

  await page.keyboard.press("Control+z");
  const objs = await objects(page);
  expect(objs).toHaveLength(1);
  expect(objs[0].type).toBe("rect");
  expect(objs[0].width).toBe(200);
});

test("a stroke that misses everything changes nothing", async ({ page }) => {
  await open(page);
  await loadDoc(page, docWith([shape()]));
  const before = await page.evaluate(() => JSON.stringify(window._flashyEditor.serializeDoc()));
  await eraseDrag(page, [[450, 300], [500, 330]], { size: 30 });
  const after = await page.evaluate(() => JSON.stringify(window._flashyEditor.serializeDoc()));
  expect(after).toBe(before);
  // And it did not push a pointless undo step either.
  await page.keyboard.press("Control+z");
  expect(await page.evaluate(() => JSON.stringify(window._flashyEditor.serializeDoc()))).toBe(before);
});

test("the square eraser cuts square corners", async ({ page }) => {
  await open(page);
  await loadDoc(page, docWith([shape()]));
  await eraseDrag(page, [[200, 175]], { size: 60, shape: "square" });
  await renderClean(page);
  // A 60px square centred at (200,175) reaches its corners; a circle of the
  // same size would not.
  expect(await stagePixel(page, 200, 175)).toBe("#ffffff");
  expect(await stagePixel(page, 226, 201)).toBe("#ffffff");
  expect(await stagePixel(page, 236, 211)).toBe("#cc3344");
});

// ──────────────────────────── erasing bitmaps ─────────────────────────────

test("erasing a bitmap masks it without touching the pixels", async ({ page }) => {
  const errors = await open(page);
  await page.evaluate((d) => window.__importImage(200, 150, d, "Pic"), SOLID);
  await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).objects[0];
    o.x = 175; o.y = 125;
  });
  await renderClean(page);
  expect(await stagePixel(page, 275, 200)).toBe("#2277dd");

  const assetBefore = await page.evaluate(() => window._flashyBitmap.assets().Pic.data);
  await eraseDrag(page, [[275, 200]], { size: 50 });

  const objs = await objects(page);
  expect(objs).toHaveLength(1);
  expect(objs[0].type).toBe("bitmap");
  expect(objs[0].maskLen).toBeGreaterThan(0);
  /* The image itself is untouched — erasing is a stencil, so it costs nothing
     in the document and can be taken back at any time. Baking it into a new
     asset per stroke would mean a fresh copy of the PNG in every undo step. */
  expect(await page.evaluate(() => window._flashyBitmap.assets().Pic.data)).toBe(assetBefore);

  await renderClean(page);
  expect(await stagePixel(page, 275, 200)).toBe("#ffffff");
  expect(await stagePixel(page, 200, 150)).toBe("#2277dd");
  expect(errors).toEqual([]);
});

test("overlapping bitmap strokes stay erased instead of cancelling out", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(200, 150, d, "Pic"), SOLID);
  await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).objects[0];
    o.x = 175; o.y = 125;
  });
  // Two strokes crossing at (275,200). Read under even-odd the overlap would
  // come back into view; this is the whole reason the mask uses nonzero.
  await eraseDrag(page, [[235, 200], [315, 200]], { size: 30 });
  await eraseDrag(page, [[275, 160], [275, 240]], { size: 30 });

  await renderClean(page);
  expect(await stagePixel(page, 275, 200)).toBe("#ffffff");
  expect(await stagePixel(page, 250, 200)).toBe("#ffffff");
  expect(await stagePixel(page, 275, 180)).toBe("#ffffff");
  expect(await stagePixel(page, 200, 140)).toBe("#2277dd");
});

test("a fully erased bitmap is removed", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(40, 40, d, "Pic"), SOLID);
  await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).objects[0];
    o.x = 250; o.y = 180;
  });
  await eraseDrag(page, [[270, 200]], { size: 140 });
  expect(await objects(page)).toHaveLength(0);
});

test("erased bitmap areas can be restored from the Properties panel", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(200, 150, d, "Pic"), SOLID);
  await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).objects[0];
    o.x = 175; o.y = 125;
  });
  await eraseDrag(page, [[275, 200]], { size: 50 });
  await renderClean(page);
  expect(await stagePixel(page, 275, 200)).toBe("#ffffff");

  await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).objects[0];
    F.setSelection([o]);
    F.updateProps();
  });
  await page.evaluate(() => window._flashyWorkspace.show("props"));
  const pp = page.locator("#propsPanel");
  await expect(pp).toContainText("pixels are still there");
  await pp.locator("button", { hasText: "Restore Erased Areas" }).click();

  await renderClean(page);
  expect(await stagePixel(page, 275, 200)).toBe("#2277dd");
});

test("an erased bitmap survives save and reload", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(200, 150, d, "Pic"), SOLID);
  await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).objects[0];
    o.x = 175; o.y = 125;
  });
  await eraseDrag(page, [[275, 200]], { size: 50 });

  const saved = await page.evaluate(() => window._flashyEditor.serializeDoc());
  expect(saved.layers[0].keyframes[0].objects[0].eraseMask.length).toBeGreaterThan(0);

  await loadDoc(page, saved);
  await page.waitForFunction(() => window._flashyBitmap.image("Pic"));
  await renderClean(page);
  expect(await stagePixel(page, 275, 200)).toBe("#ffffff");
  expect(await stagePixel(page, 200, 150)).toBe("#2277dd");
});

test("an erase mask is not shared between a copy and its original", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(200, 150, d, "Pic"), SOLID);
  await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).objects[0];
    o.x = 175; o.y = 125;
  });
  await eraseDrag(page, [[275, 200]], { size: 40 });

  /* clone() copies arrays with a shallow slice, so anything stored as an
     array of loops would be SHARED with the copy and every later erase would
     show up in both. The flat command stream is what prevents that. */
  const independent = await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    const copy = kf.objects[0].clone();
    const before = copy.eraseMask.length;
    kf.objects[0].eraseMask.push(0, 1, 1, 1, 2, 2, 1, 3, 3, 3);
    return { shared: copy.eraseMask.length !== before, before };
  });
  expect(independent.before).toBeGreaterThan(0);
  expect(independent.shared).toBe(false);
});

// ───────────────────────────── the exporters ──────────────────────────────

test("an erased bitmap and an erased shape both export", async ({ page, context }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(120, 100, d, "Pic"), SOLID);
  await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    kf.objects[0].x = 60; kf.objects[0].y = 60;
    const o = new F.EditorObject("rect");
    o.x = 300; o.y = 60; o.width = 160; o.height = 100;
    o.fillColor = "#CC3344"; o.fillType = "solid"; o.strokeStyle = "none"; o.strokeWidth = 0;
    kf.objects.push(o);
    F.fullRefresh();
  });
  // Hole in the bitmap, hole in the shape.
  await eraseDrag(page, [[120, 110]], { size: 40 });
  await eraseDrag(page, [[380, 110]], { size: 40 });

  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() => window.__stage && window.__stage.root.children.length > 0);
  await out.waitForFunction(() => window.Flashy.Bitmaps.has("Pic"));
  await out.addScriptTag({ content: `
    window.__read = function (x, y) {
      const d = document.getElementById("stage").getContext("2d", { willReadFrequently: true });
      const p = d.getImageData(x, y, 1, 1).data;
      return "#" + [p[0], p[1], p[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
    };` });
  // Bitmap decoding is async in the export, so wait for the pixel rather than
  // counting animation frames.
  await out.waitForFunction(() => window.__read(70, 70) === "#2277dd", null, { timeout: 10000 });

  const px = await out.evaluate(() => ({
    bitmapKept: window.__read(70, 70),
    bitmapErased: window.__read(120, 110),
    shapeKept: window.__read(320, 70),
    shapeErased: window.__read(380, 110),
  }));
  expect(px.bitmapKept).toBe("#2277dd");
  expect(px.bitmapErased).not.toBe("#2277dd");
  expect(px.shapeKept).toBe("#cc3344");
  expect(px.shapeErased).not.toBe("#cc3344");
  expect(errors).toEqual([]);
  await out.close();
});

test("the SVG export carries the erase mask as a clip path", async ({ page }) => {
  await open(page);
  await page.evaluate((d) => window.__importImage(120, 100, d, "Pic"), SOLID);
  await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).objects[0];
    o.x = 200; o.y = 150;
  });
  await eraseDrag(page, [[260, 200]], { size: 40 });

  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).toContain("<clipPath");
  expect(svg).toContain('clip-rule="nonzero"');
  expect(svg).toMatch(/<image[^>]+clip-path="url\(#/);
  const parsed = await page.evaluate((s) => {
    const d = new DOMParser().parseFromString(s, "image/svg+xml");
    const clip = d.querySelector("clipPath");
    const img = d.querySelector("image");
    return {
      error: !!d.querySelector("parsererror"),
      // The clip must actually reference the clipPath that is present.
      wired: !!clip && !!img && img.getAttribute("clip-path") === "url(#" + clip.getAttribute("id") + ")",
    };
  }, svg);
  expect(parsed.error).toBe(false);
  expect(parsed.wired).toBe(true);
});

test("the sprite sheet export rasterises an erased shape", async ({ page }) => {
  await open(page);
  await loadDoc(page, docWith([shape()]));
  await eraseDrag(page, [[200, 175]], { size: 50 });

  const html = await downloadFromAction(page, "exportGIF");
  const sheet = (html.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/) || [])[0];
  expect(sheet).toBeTruthy();
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
    return { kept: read(120, 175), erased: read(200, 175) };
  }, sheet);
  expect(px.kept).toBe("#cc3344");
  expect(px.erased).toBe("#ffffff");
});

// ────────────────────────────── the geometry ──────────────────────────────

test("the swept area matches the brush, and a scribble stays one region", async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const G = window.FlashyGeom;
    const straight = window._flashyEraser.region([0, 0, 100, 0], 20, "round");
    // A stroke that crosses itself must stay solid at the crossing: that is
    // the case a naive outline-the-polyline eraser gets wrong, and scribbling
    // is how people actually erase.
    const scribble = window._flashyEraser.region([0, 0, 60, 60, 60, 0, 0, 60], 18, "round");
    return {
      straightArea: G.area(straight),
      straightLoops: straight.length,
      coversLine: G.contains(straight, 50, 0) && G.contains(straight, 50, 9),
      stopsAtEdge: !G.contains(straight, 50, 11),
      crossingSolid: G.contains(scribble, 30, 30),
    };
  });
  expect(r.straightLoops).toBe(1);
  // 100x20 band plus a circle of radius 10 at the ends.
  expect(r.straightArea).toBeGreaterThan(100 * 20 + Math.PI * 100 - 30);
  expect(r.straightArea).toBeLessThan(100 * 20 + Math.PI * 100 + 30);
  expect(r.coversLine).toBe(true);
  expect(r.stopsAtEdge).toBe(true);
  expect(r.crossingSolid).toBe(true);
});

test("erasing a big shape with a long stroke stays quick", async ({ page }) => {
  await open(page);
  await loadDoc(page, docWith([shape({ x: 20, y: 60, width: 500, height: 300 })]));
  const ms = await page.evaluate(() => {
    const pts = [];
    for (let i = 0; i <= 200; i++) pts.push(30 + i * 2.4, 200 + Math.sin(i / 7) * 90);
    const t0 = performance.now();
    window._flashyEraser.stroke(pts, { size: 24 });
    return performance.now() - t0;
  });
  expect(ms).toBeLessThan(4000);
  const objs = await objects(page);
  expect(objs.length).toBeGreaterThanOrEqual(1);
  expect(objs.every((o) => o.type === "path")).toBe(true);
});
