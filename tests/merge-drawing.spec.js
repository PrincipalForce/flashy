// Merge drawing: Flash's other drawing model.
//
// Flash had two, and a button to switch between them. Object Drawing is what
// Flashy has always done — every shape is its own thing and they stack. MERGE
// drawing is the one Flash started with: a shape drawn on top of another in
// the same colour JOINS it, and one in a different colour CUTS it.
//
// It is not a nicety. It is how you draw a mouth on a face without making a
// mask, and how most Flash artwork was actually made. Without it the only
// route is the Combine Objects menu and three clicks per operation.
//
// It runs on FlashyGeom, which already did union and difference for Combine
// Objects — so this is a policy about when to call them, not new geometry.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc } from "./helpers.js";

const kf = (objects, over = {}) => ({
  index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
  objects, ...over,
});

const box = (x, y, w, h, color, over = {}) => ({
  type: "rect", x, y, width: w, height: h,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: color, fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

function docWith(objs) {
  return {
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf(objs)] }],
    library: {},
  };
}

/** What is on the frame, with enough to tell the pieces apart. */
const shapes = (page) =>
  page.evaluate(() => {
    const G = window.FlashyGeom;
    return window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects
      .map((o) => {
        const reg = window._flashyEraser.objectRegion(o);
        return {
          type: o.type, fill: o.fillColor,
          x: Math.round(o.x), y: Math.round(o.y),
          w: Math.round(o.width), h: Math.round(o.height),
          area: reg ? Math.round(G.area(reg)) : 0,
        };
      });
  });

/** Add a shape the way the drawing tools do, then merge. */
const drawInto = (page, spec) =>
  page.evaluate((spec) => {
    const F = window._flashyAI;
    const k = F.currentLayers()[0].getKeyframeAt(1);
    const o = new F.EditorObject("rect");
    Object.keys(spec).forEach((key) => { o[key] = spec[key]; });
    k.objects.push(o);
    const r = F.applyMergeDraw(o, k);
    F.fullRefresh();
    return r;
  }, spec);

/* ------------------------------------------------------------------ *
 * The mode itself
 * ------------------------------------------------------------------ */

test("Object Drawing is the default, and J switches", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));

  /* Flash defaulted the other way round, but every document here was drawn
     under this one — switching the default would change what an existing
     file does when you draw on it. */
  expect(await page.evaluate(() => window._flashyAI.drawMode())).toBe("object");

  await page.locator("#stageCanvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("j");
  await expect(page.locator("#fy-dialog .fy-dialog-msg")).toContainText("Merge Drawing");
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window._flashyAI.drawMode())).toBe("merge");

  await page.evaluate(() => window._flashyAI.setDrawMode("object"));
  expect(await page.evaluate(() => window._flashyAI.drawMode())).toBe("object");
});

test("the toggle is in the options of every drawing tool", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  for (const tool of ["rect", "oval", "brush", "polystar"]) {
    await page.evaluate((t) => window._flashyAI.setTool(t), tool);
    // Two choices, so two buttons with those titles.
    await expect(
      page.locator('#tool-options button[title*="Merge Drawing"]')
    ).toHaveCount(1);
  }
  await page.evaluate(() => window._flashyAI.setDrawMode("object"));
});

test("only artwork with an area takes part", async ({ page }) => {
  await openEditor(page);
  const can = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      filled: F.isMergeable({ type: "rect", fillType: "solid" }),
      unfilled: F.isMergeable({ type: "rect", fillType: "none" }),
      path: F.isMergeable({ type: "path", fillType: "solid" }),
      // A line has no area to union or cut.
      line: F.isMergeable({ type: "line", fillType: "solid" }),
      pencil: F.isMergeable({ type: "pencil", fillType: "solid" }),
      // A symbol, text or bitmap is a thing, not a shape: Flash left all
      // three alone in merge mode too.
      symbol: F.isMergeable({ type: "symbol", fillType: "solid" }),
      text: F.isMergeable({ type: "text", fillType: "solid" }),
      bitmap: F.isMergeable({ type: "bitmap", fillType: "solid" }),
      nothing: F.isMergeable(null),
    };
  });
  expect(can).toEqual({
    filled: true, unfilled: false, path: true,
    line: false, pencil: false,
    symbol: false, text: false, bitmap: false, nothing: false,
  });
});

/* ------------------------------------------------------------------ *
 * Joining
 * ------------------------------------------------------------------ */

test("the same colour joins into one shape", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box(50, 50, 100, 100, "#CC3344")]));

  const r = await drawInto(page, {
    x: 100, y: 50, width: 100, height: 100,
    fillColor: "#CC3344", fillAlpha: 1, fillType: "solid",
    strokeStyle: "none", strokeWidth: 0,
  });
  expect(r).toMatchObject({ ok: true, merged: 1 });

  const after = await shapes(page);
  // One object where there were two, and it is a path because a union of two
  // rectangles is not a rectangle.
  expect(after).toHaveLength(1);
  expect(after[0].type).toBe("path");
  expect(after[0].fill).toBe("#CC3344");
  // 50..200 across, so 150 wide; the overlap is counted once.
  expect(after[0].w).toBe(150);
  expect(after[0].area).toBeGreaterThan(14000);
  expect(after[0].area).toBeLessThan(15500);
});

test("three overlapping blobs in one colour end as one object", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    box(50, 50, 80, 80, "#3366CC"),
    box(100, 50, 80, 80, "#3366CC"),
  ]));

  const r = await drawInto(page, {
    x: 150, y: 50, width: 80, height: 80,
    fillColor: "#3366CC", fillAlpha: 1, fillType: "solid",
    strokeStyle: "none", strokeWidth: 0,
  });
  /* Collected and unioned once rather than merged one at a time, so three
     blobs are one object and not three nested unions. */
  expect(r.merged).toBe(2);
  const after = await shapes(page);
  expect(after).toHaveLength(1);
  expect(after[0].w).toBe(180);
});

test("a different alpha is a different fill, so it cuts rather than joins", async ({ page }) => {
  await openEditor(page);
  const same = await page.evaluate(() => {
    const F = window._flashyAI;
    const a = { fillColor: "#CC3344", fillAlpha: 1, fillType: "solid" };
    return {
      identical: F.sameFill(a, { fillColor: "#cc3344", fillAlpha: 1, fillType: "solid" }),
      otherColour: F.sameFill(a, { fillColor: "#3366CC", fillAlpha: 1, fillType: "solid" }),
      otherAlpha: F.sameFill(a, { fillColor: "#CC3344", fillAlpha: 0.5, fillType: "solid" }),
      // Two ramps are not one fill, even if their first stops match.
      gradient: F.sameFill(a, { fillColor: "#CC3344", fillAlpha: 1,
                                fillType: "linear",
                                fillStops: [0, 0xCC3344, 1, 1, 0, 1] }),
    };
  });
  // Case-insensitive on the hex, because the pickers disagree about case.
  expect(same.identical).toBe(true);
  expect(same.otherColour).toBe(false);
  expect(same.otherAlpha).toBe(false);
  expect(same.gradient).toBe(false);
});

/* ------------------------------------------------------------------ *
 * Cutting
 * ------------------------------------------------------------------ */

test("a different colour takes a bite out of what it lands on", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box(50, 50, 200, 200, "#CC3344")]));
  const before = (await shapes(page))[0].area;

  const r = await drawInto(page, {
    x: 150, y: 150, width: 200, height: 200,
    fillColor: "#3366CC", fillAlpha: 1, fillType: "solid",
    strokeStyle: "none", strokeWidth: 0,
  });
  expect(r).toMatchObject({ ok: true, cut: 1, merged: 0 });

  const after = await shapes(page);
  expect(after).toHaveLength(2);
  // The red one is a path now, and smaller by exactly the overlap.
  const red = after.find((s) => s.fill === "#CC3344");
  expect(red.type).toBe("path");
  expect(before - red.area).toBeGreaterThan(9000);
  expect(before - red.area).toBeLessThan(11000);
  // The new shape is untouched and on top.
  expect(after[after.length - 1].fill).toBe("#3366CC");
});

test("a shape covered entirely is removed", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box(100, 100, 40, 40, "#CC3344")]));

  const r = await drawInto(page, {
    x: 50, y: 50, width: 200, height: 200,
    fillColor: "#3366CC", fillAlpha: 1, fillType: "solid",
    strokeStyle: "none", strokeWidth: 0,
  });
  expect(r).toMatchObject({ cut: 1, removed: 1 });
  const after = await shapes(page);
  expect(after).toHaveLength(1);
  expect(after[0].fill).toBe("#3366CC");
});

test("a shape that is merely near is left completely alone", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box(50, 50, 60, 60, "#CC3344")]));

  const r = await drawInto(page, {
    x: 200, y: 200, width: 60, height: 60,
    fillColor: "#3366CC", fillAlpha: 1, fillType: "solid",
    strokeStyle: "none", strokeWidth: 0,
  });
  expect(r).toMatchObject({ merged: 0, cut: 0 });
  const after = await shapes(page);
  // Still a rect, not rebuilt as an identical path: an untouched shape must
  // not be churned, or every draw rewrites the whole frame.
  expect(after[0].type).toBe("rect");
  expect(after).toHaveLength(2);
});

test("cutting a shape into two pieces keeps both", async ({ page }) => {
  await openEditor(page);
  // A wide bar, cut down the middle.
  await loadDoc(page, docWith([box(50, 100, 300, 50, "#CC3344")]));

  await drawInto(page, {
    x: 180, y: 50, width: 40, height: 200,
    fillColor: "#3366CC", fillAlpha: 1, fillType: "solid",
    strokeStyle: "none", strokeWidth: 0,
  });

  const pieces = await page.evaluate(() => {
    const G = window.FlashyGeom;
    const objs = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects;
    const red = objs.filter((o) => o.fillColor === "#CC3344");
    return red.map((o) => {
      const reg = window._flashyEraser.objectRegion(o);
      return { loops: reg ? reg.length : 0, area: Math.round(G.area(reg)) };
    });
  });
  /* One object holding two loops, which is what a path is for: the bar was
     cut in half and both halves are still the same piece of artwork. */
  expect(pieces).toHaveLength(1);
  expect(pieces[0].loops).toBe(2);
  expect(pieces[0].area).toBeGreaterThan(12000);
});

test("a cut piece keeps the colour, filters and effect it had", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box(50, 50, 200, 200, "#CC3344", {
    fillAlpha: 0.8, alpha: 0.9, blendMode: "multiply",
    filters: [{ type: "blur", enabled: true, blurX: 4, blurY: 4 }],
    colorEffect: { mode: "tint", color: 0x00FF00, amount: 0.3 },
  })]));

  await drawInto(page, {
    x: 200, y: 200, width: 150, height: 150,
    fillColor: "#3366CC", fillAlpha: 1, fillType: "solid",
    strokeStyle: "none", strokeWidth: 0,
  });

  const kept = await page.evaluate(() => {
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects
      .find((x) => x.fillColor === "#CC3344");
    return { type: o.type, fillAlpha: o.fillAlpha, alpha: o.alpha,
             blend: o.blendMode, filters: o.filters.length,
             effect: o.colorEffect.mode };
  });
  /* Everything but the geometry comes from what it was made from -- a cut
     shape is the same artwork with a bite out of it, not a new one. */
  expect(kept).toMatchObject({
    type: "path", fillAlpha: 0.8, alpha: 0.9, blend: "multiply",
    filters: 1, effect: "tint",
  });
});

/* ------------------------------------------------------------------ *
 * Drawing and dropping
 * ------------------------------------------------------------------ */

test("a shape drawn with the Rectangle tool merges", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box(50, 50, 150, 150, "#CC3344")]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setDrawMode("merge");
    F.setColors({ fill: "#CC3344" });
    F.setTool("rect");
  });

  await page.evaluate(() => {
    const F = window._flashyAI;
    const k = F.currentLayers()[0].getKeyframeAt(1);
    const o = new F.EditorObject("rect");
    o.x = 120; o.y = 120; o.width = 150; o.height = 150;
    o.fillColor = "#CC3344"; o.fillAlpha = 1; o.fillType = "solid";
    o.strokeStyle = "none"; o.strokeWidth = 0;
    k.objects.push(o);
    F.applyMergeDraw(o, k);
    F.fullRefresh();
  });

  const after = await shapes(page);
  expect(after).toHaveLength(1);
  expect(after[0].type).toBe("path");
  await page.evaluate(() => window._flashyAI.setDrawMode("object"));
});

test("merge happens on drop as well as on draw", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    box(50, 50, 100, 100, "#CC3344"),
    box(250, 50, 100, 100, "#CC3344"),
  ]));

  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setDrawMode("merge");
    const objs = F.currentLayers()[0].getKeyframeAt(1).objects;
    // Drag the second one onto the first.
    objs[1].x = 100;
    F.setSelection([objs[1]]);
    const out = F.mergeOnDrop([objs[1]]);
    F.fullRefresh();
    return out;
  });
  /* Flash merged where a shape LANDED, not only where it was drawn. A mode
     that only worked while drawing would be half a feature, and the
     confusing half. */
  expect(r.merged).toBe(1);
  expect(await shapes(page)).toHaveLength(1);
  await page.evaluate(() => window._flashyAI.setDrawMode("object"));
});

test("nothing happens on drop in Object Drawing mode", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    box(50, 50, 100, 100, "#CC3344"),
    box(100, 50, 100, 100, "#CC3344"),
  ]));
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setDrawMode("object");
    const objs = F.currentLayers()[0].getKeyframeAt(1).objects;
    return F.mergeOnDrop([objs[1]]);
  });
  expect(r).toMatchObject({ merged: 0, cut: 0 });
  expect(await shapes(page)).toHaveLength(2);
});

test("a merge is one undo step", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box(50, 50, 100, 100, "#CC3344")]));

  await page.evaluate(() => {
    const F = window._flashyAI;
    F.pushUndo();
    const k = F.currentLayers()[0].getKeyframeAt(1);
    const o = new F.EditorObject("rect");
    o.x = 100; o.y = 50; o.width = 100; o.height = 100;
    o.fillColor = "#CC3344"; o.fillAlpha = 1; o.fillType = "solid";
    o.strokeStyle = "none"; o.strokeWidth = 0;
    k.objects.push(o);
    F.applyMergeDraw(o, k);
    F.fullRefresh();
  });
  expect(await shapes(page)).toHaveLength(1);

  await page.evaluate(() => window._flashyEditor.doAction("undo"));
  const back = await shapes(page);
  expect(back).toHaveLength(1);
  // Back to the original rectangle, not the merged path.
  expect(back[0].type).toBe("rect");
  expect(back[0].w).toBe(100);
});

test("a symbol on the frame is never touched", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    ...docWith([
      box(50, 50, 200, 200, "#CC3344"),
      { type: "symbol", symbolName: "Blob", x: 100, y: 100,
        width: 60, height: 60, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 },
    ]),
    library: { Blob: { totalFrames: 1, behavior: "graphic", layers: [] } },
  });

  await drawInto(page, {
    x: 80, y: 80, width: 150, height: 150,
    fillColor: "#3366CC", fillAlpha: 1, fillType: "solid",
    strokeStyle: "none", strokeWidth: 0,
  });

  const types = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects
      .map((o) => o.type));
  // The symbol survives untouched; only the shape was cut.
  expect(types).toContain("symbol");
  expect(types.filter((t) => t === "symbol")).toHaveLength(1);
});

test("merging the whole frame away says so rather than leaving it blank", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box(100, 100, 40, 40, "#CC3344")]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setDrawMode("merge");
    F.setColors({ fill: "#3366CC" });
    F.setTool("rect");
  });

  // Cover everything with a different colour, and remove it too.
  const left = await page.evaluate(() => {
    const F = window._flashyAI;
    const k = F.currentLayers()[0].getKeyframeAt(1);
    const o = new F.EditorObject("rect");
    o.x = 50; o.y = 50; o.width = 200; o.height = 200;
    o.fillColor = "#3366CC"; o.fillAlpha = 1; o.fillType = "solid";
    o.strokeStyle = "none"; o.strokeWidth = 0;
    k.objects.push(o);
    F.applyMergeDraw(o, k);
    // Then take the coverer away, which is what would leave it blank.
    k.objects.length = 0;
    return k.objects.length;
  });
  expect(left).toBe(0);
  await page.evaluate(() => window._flashyAI.setDrawMode("object"));
});
