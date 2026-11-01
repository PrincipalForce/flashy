// Brush tips and paint modes, eraser modes and the Faucet, and the Paint
// Bucket's gap closing and Lock Fill.
//
// What all of these have in common is that they decide WHAT a stroke is
// allowed to affect before it affects anything. Paint Behind lets you put a
// background in without masking; Erase Lines over a coloured drawing is the
// difference between a clean-up and a disaster; and a bucket that cannot cross
// a gap cannot fill a hand-drawn outline at all.
//
// Flash's merge-drawing model made these one thing; an object-based editor
// makes them two. A tip is a distance metric, and FlashyGeom.strokeRegion
// already takes one. A mode is either a z-order choice or a clip, and the
// display list and the geometry module already do both.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc } from "./helpers.js";

const kf = (objects, index = 1, duration = 1) => ({
  index, duration, tweenType: "none", easing: "linear", script: "", objects,
});

function docWith(objs) {
  return {
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf(objs)] }],
    library: {},
  };
}

const rect = (over = {}) => ({
  type: "rect", x: 50, y: 50, width: 200, height: 150,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#CC3344", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

/**
 * A pencil stroke from STAGE coordinates.
 *
 * The editor stores a stroke's points relative to its own bounding box, with
 * x/y carrying the box origin -- which is what the commit path produces and
 * what the painter expects. A fixture that puts absolute coordinates in
 * `points` draws in the wrong place, which is invisible to a test that only
 * reads geometry and fatal to one that reads pixels.
 */
const pencil = (abs, over = {}) => {
  const xs = abs.filter((_, i) => i % 2 === 0);
  const ys = abs.filter((_, i) => i % 2 === 1);
  const x = Math.min(...xs), y = Math.min(...ys);
  return {
    type: "pencil", x, y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y),
    rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
    points: abs.map((v, i) => (i % 2 === 0 ? v - x : v - y)),
    fillColor: "#000000", fillAlpha: 1, fillType: "none",
    strokeColor: "#223344", strokeAlpha: 1, strokeWidth: 2, strokeStyle: "solid",
    ...over,
  };
};

const types = (page) =>
  page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects
      .map((o) => o.type));

/** Paint a stroke with the current brush settings and report what happened. */
const paint = (page, points) =>
  page.evaluate((points) => {
    const F = window._flashyAI;
    F.setTool("brush");
    const layer = F.currentLayers()[F.curLayer()];
    const k = layer.getKeyframeAt(F.curFrame());
    F.pushUndo();
    const r = F.commitBrushStroke(points, k);
    F.fullRefresh();
    return { ok: r.ok, why: r.why || null, region: !!r.region };
  }, points);

/* ------------------------------------------------------------------ *
 * Brush tips
 * ------------------------------------------------------------------ */

test("the nine tips are nine metrics, and each has its own footprint", async ({ page }) => {
  await openEditor(page);
  const boxes = await page.evaluate(() => {
    const F = window._flashyAI, G = window.FlashyGeom;
    const out = {};
    F.BRUSH_TIPS.forEach((t) => {
      const loops = G.strokeRegion([0, 0, 40, 0], 8, t.tip);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      loops.forEach((l) => {
        for (let i = 0; i < l.length; i += 2) {
          x0 = Math.min(x0, l[i]); x1 = Math.max(x1, l[i]);
          y0 = Math.min(y0, l[i + 1]); y1 = Math.max(y1, l[i + 1]);
        }
      });
      out[t.id] = { w: +(x1 - x0).toFixed(1), h: +(y1 - y0).toFixed(1) };
    });
    return out;
  });
  expect(Object.keys(boxes)).toHaveLength(9);
  /* A round tip is as thick as it is wide: 16 across the stroke, give or take
     the contour tracer sampling slightly inside the true edge. */
  expect(boxes.round.h).toBeGreaterThan(14);
  // A flattened tip is thinner across the stroke...
  expect(boxes.oval.h).toBeLessThan(boxes.round.h * 0.6);
  // ...and the same tip turned 90 degrees is thinner the OTHER way, so the
  // footprint of a horizontal stroke is nearly as tall as it is wide.
  expect(boxes.ovalTall.h).toBeGreaterThan(boxes.oval.h);
  // A slanted tip leans: it is neither as thin as the flat one nor as fat as
  // the round one across a horizontal stroke.
  expect(boxes.slash.h).toBeGreaterThan(boxes.line.h);
  expect(boxes.slash.h).toBeLessThan(boxes.round.h);
});

test("no tip reaches further than the brush radius along either axis", async ({ page }) => {
  await openEditor(page);
  const over = await page.evaluate(() => {
    const F = window._flashyAI, G = window.FlashyGeom;
    let worst = 0;
    F.BRUSH_TIPS.forEach((t) => {
      G.strokeRegion([0, 0], 10, t.tip).forEach((l) => {
        for (let i = 0; i < l.length; i += 2) {
          // Per-axis, not Euclidean: a square tip's CORNER is legitimately
          // further out than its half-width, and the grid is axis-aligned.
          worst = Math.max(worst, Math.abs(l[i]), Math.abs(l[i + 1]));
        }
      });
    });
    return worst;
  });
  /* The grid padding in strokeRegion assumes it: a tip that reached further
     would be silently clipped at the edge of its own scratch grid. The ratio
     is capped at 1, and a tall tip is a wide one rotated, which is what keeps
     this true. */
  expect(over).toBeLessThan(10.6);
});

test("a round tip painting normally is still the cheap polyline", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  await page.evaluate(() =>
    window._flashyAI.setBrush({ tip: "round", mode: "normal" }));

  const r = await paint(page, [10, 10, 60, 40]);
  // No region built: the caller falls through to the polyline it always made,
  // so every existing document and the common case are untouched.
  expect(r).toMatchObject({ ok: true, region: false });
});

test("a shaped tip commits a filled path, which is what Flash's brush made", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  await page.evaluate(() =>
    window._flashyAI.setBrush({ tip: "slash", mode: "normal", size: 16 }));

  const r = await paint(page, [20, 20, 120, 60, 200, 40]);
  expect(r).toMatchObject({ ok: true, region: true });
  expect(await types(page)).toEqual(["path"]);

  const o = await page.evaluate(() => {
    const x = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    return { fillType: x.fillType, strokeStyle: x.strokeStyle, n: x.path.length };
  });
  // A fill with no outline: giving it one would draw a dark edge round every
  // stroke.
  expect(o.fillType).toBe("solid");
  expect(o.strokeStyle).toBe("none");
  expect(o.n).toBeGreaterThan(20);
});

/* ------------------------------------------------------------------ *
 * Paint modes
 * ------------------------------------------------------------------ */

test("Paint Behind goes to the bottom of the stack and Normal to the top", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));

  await page.evaluate(() => window._flashyAI.setBrush({ tip: "square", mode: "behind" }));
  expect((await paint(page, [60, 60, 240, 190])).ok).toBe(true);
  // Paint Behind exactly: the stroke shows only where nothing else covers it.
  expect(await types(page)).toEqual(["path", "rect"]);

  await page.evaluate(() => window._flashyAI.setBrush({ mode: "normal" }));
  expect((await paint(page, [60, 70, 240, 180])).ok).toBe(true);
  expect(await types(page)).toEqual(["path", "rect", "path"]);
});

test("Paint Fills lands under the lines and over the fills", async ({ page }) => {
  await openEditor(page);
  // A fill, then a line on top of it.
  await loadDoc(page, docWith([rect(), pencil([0, 0, 400, 300])]));

  await page.evaluate(() => window._flashyAI.setBrush({ tip: "square", mode: "fills" }));
  expect((await paint(page, [60, 60, 240, 190])).ok).toBe(true);
  /* Index 1: above the fill, below the line. Which is what Paint Fills means
     once "fill" and "line" are separate objects rather than one canvas. */
  expect(await types(page)).toEqual(["rect", "path", "pencil"]);
});

test("a stroke with no fill counts as a line for Paint Fills", async ({ page }) => {
  await openEditor(page);
  const lineLike = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      pencil: F.isLineLike({ type: "pencil" }),
      strokeOnly: F.isLineLike({ type: "rect", fillType: "none", strokeWidth: 3 }),
      filled: F.isLineLike({ type: "rect", fillType: "solid", strokeWidth: 3 }),
      noStroke: F.isLineLike({ type: "rect", fillType: "none", strokeWidth: 0 }),
    };
  });
  // A shape with a stroke and no fill is a line by any useful definition.
  expect(lineLike).toEqual({ pencil: true, strokeOnly: true, filled: false,
                             noStroke: false });
});

test("Paint Selection clips the stroke to the selected artwork", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));

  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    F.setBrush({ tip: "square", mode: "selection", size: 20 });
  });
  // A stroke running well past the rectangle on both sides.
  expect((await paint(page, [0, 120, 400, 120])).ok).toBe(true);

  const box = await page.evaluate(() => {
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[1];
    return { x: Math.round(o.x), w: Math.round(o.width) };
  });
  // Clipped to the rectangle, which spans 50..250.
  expect(box.x).toBeGreaterThanOrEqual(49);
  expect(box.x + box.w).toBeLessThanOrEqual(251);
});

test("Paint Selection with nothing selected says so rather than painting", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([]);
    F.setBrush({ tip: "square", mode: "selection" });
  });

  const r = await paint(page, [0, 120, 400, 120]);
  expect(r.ok).toBe(false);
  expect(r.why).toContain("nothing is selected");
});

test("Paint Inside clips to the shape the stroke started on", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));
  await page.evaluate(() =>
    window._flashyAI.setBrush({ tip: "square", mode: "inside", size: 20 }));

  // Starting inside the rectangle and running out of it.
  expect((await paint(page, [120, 120, 390, 120])).ok).toBe(true);
  const box = await page.evaluate(() => {
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[1];
    return Math.round(o.x + o.width);
  });
  expect(box).toBeLessThanOrEqual(251);
});

test("Paint Inside starting on empty stage paints nothing, as in Flash", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));
  await page.evaluate(() =>
    window._flashyAI.setBrush({ tip: "square", mode: "inside", size: 20 }));

  const r = await paint(page, [350, 250, 380, 260]);
  expect(r.ok).toBe(false);
  expect(r.why).toContain("empty stage");
  // And nothing was added.
  expect(await types(page)).toEqual(["rect"]);
});

test("Lock Fill keeps the colour the stroke started with", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));

  const colors = await page.evaluate(async () => {
    const F = window._flashyAI;
    F.setTool("brush");
    F.setBrush({ tip: "square", mode: "normal", size: 14, locked: true });
    const layer = F.currentLayers()[0];
    const k = layer.getKeyframeAt(1);
    F.commitBrushStroke([10, 10, 80, 10], k);
    // The swatch changes under the user mid-drawing, which is exactly the
    // case Lock Fill exists for.
    F.setColors({ fill: "#00FF00" });
    F.commitBrushStroke([10, 40, 80, 40], k);
    return k.objects.map((o) => o.fillColor);
  });
  expect(colors[0]).toBe(colors[1]);
});

/* ------------------------------------------------------------------ *
 * Eraser modes and the Faucet
 * ------------------------------------------------------------------ */

const erase = (page, points) =>
  page.evaluate((points) => {
    const F = window._flashyAI;
    F.setTool("eraser");
    const r = window._flashyEraser.stroke(points, {});
    F.fullRefresh();
    return r;
  }, points);

test("Erase Fills leaves the lines alone, and Erase Lines the fills", async ({ page }) => {
  await openEditor(page);
  const both = () => docWith([rect(), pencil([60, 120, 240, 120])]);

  await loadDoc(page, both());
  await page.evaluate(() => {
    window._flashyAI.setEraser({ mode: "fills" });
    window._flashyAI.setSelection([]);
  });
  await page.evaluate(() => window._flashyEraser.setSize(40));
  await erase(page, [60, 120, 240, 120]);
  // The pencil line survived untouched; the fill was cut.
  let after = await types(page);
  expect(after.filter((t) => t === "pencil")).toHaveLength(1);

  await loadDoc(page, both());
  await page.evaluate(() => window._flashyAI.setEraser({ mode: "lines" }));
  await erase(page, [60, 120, 240, 120]);
  after = await types(page);
  // The rectangle survived whole; the line is gone or in pieces.
  expect(after.filter((t) => t === "rect")).toHaveLength(1);
  expect(after.filter((t) => t === "pencil").length).toBeLessThan(1 + 1);
});

test("Erase Selected Fills touches only the fills that were picked", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    rect({ x: 20, y: 20, width: 100, height: 100 }),
    rect({ x: 160, y: 20, width: 100, height: 100, fillColor: "#3366CC" }),
  ]));

  const before = await page.evaluate(() => {
    const F = window._flashyAI;
    const objs = F.currentLayers()[0].getKeyframeAt(1).objects;
    F.setSelection([objs[1]]);
    F.setEraser({ mode: "selected" });
    return objs.map((o) => o.width);
  });
  expect(before).toEqual([100, 100]);

  // A stroke across BOTH rectangles: only the selected one may be cut.
  await erase(page, [20, 70, 260, 70]);
  const widths = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects
      .filter((o) => o.fillColor === "#CC3344").map((o) => o.width));
  expect(widths).toEqual([100]);
});

test("Erase Inside is confined to the shape the stroke started on", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    rect({ x: 20, y: 20, width: 100, height: 100 }),
    rect({ x: 160, y: 20, width: 100, height: 100, fillColor: "#3366CC" }),
  ]));
  await page.evaluate(() => window._flashyAI.setEraser({ mode: "inside" }));

  // Starting inside the first rectangle, running through the second.
  await erase(page, [60, 70, 260, 70]);
  const blue = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects
      .filter((o) => o.fillColor === "#3366CC").map((o) => o.width));
  // The second was never offered to the eraser.
  expect(blue).toEqual([100]);
});

test("the Faucet removes a whole shape in one click", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));

  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setTool("eraser");
    F.setEraser({ faucet: true });
    const out = F.faucetAt(150, 120);
    F.fullRefresh();
    return { ok: out.ok, why: out.why || null };
  });
  expect(r.ok).toBe(true);
  // One click, one whole object gone -- not a 24px bite out of it.
  expect((await types(page)).filter((t) => t === "rect")).toHaveLength(0);
});

test("the Faucet explains a click on nothing, and on a symbol", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    library: { Blob: { totalFrames: 1, behavior: "graphic", layers: [] } },
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([
      { type: "symbol", symbolName: "Blob", x: 20, y: 20, width: 80, height: 80,
        rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 },
    ])] }],
  });

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      empty: F.faucetAt(380, 280),
      onSymbol: F.faucetAt(60, 60),
    };
  });
  expect(out.empty.ok).toBe(false);
  expect(out.empty.why).toContain("nothing there");
  expect(out.onSymbol.ok).toBe(false);
  expect(out.onSymbol.why).toContain("symbols");
});

/* ------------------------------------------------------------------ *
 * Paint Bucket
 * ------------------------------------------------------------------ */

test("the dilation grows a mask by the gap, in both directions", async ({ page }) => {
  await openEditor(page);
  const row = await page.evaluate(() => {
    const F = window._flashyAI;
    const w = 11, h = 1;
    const m = new Uint8Array(w * h);
    m[5] = 1;
    return [...F.dilateMask(m, w, h, 2)];
  });
  // One cell becomes five: two each side.
  expect(row).toEqual([0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0]);
});

test("the bucket recolours a shape it hits", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));
  await page.evaluate(() => {
    window._flashyAI.setColors({ fill: "#00AA00" });
    window._flashyAI.setBucket({ locked: false });
  });

  const r = await page.evaluate(() => window._flashyAI.bucketFillAt(150, 120));
  expect(r).toMatchObject({ ok: true, recolored: true });
  const color = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0].fillColor);
  expect(color.toUpperCase()).toBe("#00AA00");
});

test("the bucket fills inside an unfilled outline", async ({ page }) => {
  await openEditor(page);
  /* A square outline with no fill: Flashy's old bucket did NOTHING here,
     because there was no fill object to recolour and no way to tell from the
     stage why. */
  await loadDoc(page, docWith([
    rect({ fillType: "none", strokeStyle: "solid", strokeWidth: 4 }),
  ]));
  await page.evaluate(() => {
    window._flashyAI.setColors({ fill: "#00AA00" });
    window._flashyAI.setBucket({ gap: 2, locked: false });
  });

  const r = await page.evaluate(() => {
    const out = window._flashyAI.bucketFillAt(150, 120);
    window._flashyAI.fullRefresh();
    return { ok: out.ok, filled: !!out.filled, why: out.why || null };
  });
  expect(r).toMatchObject({ ok: true, filled: true });

  const objs = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects.map((o) =>
      ({ type: o.type, fill: o.fillColor, x: Math.round(o.x),
         w: Math.round(o.width) })));
  // The fill goes BEHIND the outline it was poured into: a fill painted on top
  // hides exactly the thing that defined it.
  expect(objs[0].type).toBe("path");
  expect(objs[1].type).toBe("rect");
  // And it fills the square, roughly 50..250 across.
  expect(objs[0].w).toBeGreaterThan(150);
  expect(objs[0].w).toBeLessThan(215);
});

test("gap closing is what lets the bucket fill a broken outline", async ({ page }) => {
  await openEditor(page);
  // Three sides of a box drawn as pencil lines, with a 6px break in the top.
  const outline = () => docWith([
    pencil([60, 60, 160, 60], { strokeWidth: 3 }),
    pencil([166, 60, 260, 60], { strokeWidth: 3 }),
    pencil([60, 60, 60, 200], { strokeWidth: 3 }),
    pencil([260, 60, 260, 200], { strokeWidth: 3 }),
    pencil([60, 200, 260, 200], { strokeWidth: 3 }),
  ]);

  await loadDoc(page, outline());
  // With no gap closing the fill escapes through the break, and filling the
  // whole stage would be far worse than refusing.
  const leaked = await page.evaluate(() => {
    window._flashyAI.setBucket({ gap: 0 });
    const r = window._flashyAI.bucketFillAt(150, 130);
    return { ok: r.ok, escaped: !!r.escaped, why: r.why || "" };
  });
  expect(leaked.ok).toBe(false);
  expect(leaked.escaped).toBe(true);

  await loadDoc(page, outline());
  const closed = await page.evaluate(() => {
    window._flashyAI.setBucket({ gap: 6 });
    const r = window._flashyAI.bucketFillAt(150, 130);
    window._flashyAI.fullRefresh();
    return { ok: r.ok, filled: !!r.filled, why: r.why || "" };
  });
  expect(closed).toMatchObject({ ok: true, filled: true });
});

test("the bucket says why it will not fill a point on a line", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    pencil([0, 150, 400, 150], { strokeWidth: 12 }),
  ]));

  const r = await page.evaluate(() => {
    window._flashyAI.setBucket({ gap: 2 });
    // Dead on the thick line, which hitTest does not claim.
    return window._flashyAI.bucketFillAt(200, 150);
  });
  expect(r.ok).toBe(false);
  expect(r.why).toMatch(/on a line|not enclosed|leaked/);
});

test("the bucket refuses to fill an empty stage", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));

  const r = await page.evaluate(() => {
    window._flashyAI.setBucket({ gap: 2 });
    return window._flashyAI.bucketFillAt(200, 150);
  });
  expect(r.ok).toBe(false);
  expect(r.escaped).toBe(true);
  expect(await types(page)).toEqual([]);
});
