// The gradient editor: stops, overflow, focal point, and a stroke's own
// gradient.
//
// `fillStops` had been in the save format and the painter since gradients
// arrived, and nothing could author it. The Properties panel said so in a
// comment — "there is no stop editor yet, so switching away from one is a
// one-way trip" — which made a gradient something a document could only
// acquire by being imported from a .swf.
//
// Three things were missing beside it, and all three are visible on the
// stage: the overflow mode (the only way to get stripes out of two stops), a
// radial focal point (what makes a sphere look lit rather than flat), and a
// gradient on a STROKE, which Flash allowed and the data model here never
// had.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction, runExportedHTML } from "./helpers.js";

const kf = (objects, over = {}) => ({
  index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
  objects, ...over,
});

const box = (over = {}) => ({
  type: "rect", x: 50, y: 50, width: 200, height: 100,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#CC3344", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

function docWith(objs) {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf(objs)] }],
    library: {},
  };
}

/** The first object, selected. */
const pick = (page) =>
  page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.setSelection([o]);
    return true;
  });

const px = (page, x, y) =>
  page.evaluate(({ x, y }) => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 300, 200);
    const d = cv.getContext("2d").getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }, { x, y });

/* ------------------------------------------------------------------ *
 * Stops
 * ------------------------------------------------------------------ */

test("the flat stop list reads and writes as objects, always sorted", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box({
    fillType: "linear", fillGrad: [0, 0.5, 1, 0.5],
    // Deliberately out of order, which the flat form allows and the editor
    // must not care about.
    fillStops: [1, 0x0000FF, 1, 0, 0xFF0000, 1, 0.5, 0x00FF00, 0.5],
  })]));

  const stops = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    return F.gradientStops(o, "fill");
  });
  expect(stops.map((s) => s.ratio)).toEqual([0, 0.5, 1]);
  expect(stops[1]).toMatchObject({ color: 0x00FF00, alpha: 0.5 });

  const back = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.setGradientStops(o, [
      { ratio: 0.8, color: 0x111111, alpha: 1 },
      { ratio: 0.2, color: 0x222222, alpha: 1 },
    ], "fill");
    return o.fillStops;
  });
  /* Written back flat, in order. Flat because EditorObject.clone() copies
     arrays with a shallow slice, so anything nested would be shared between
     an object and its copy. */
  expect(back).toEqual([0.2, 0x222222, 1, 0.8, 0x111111, 1]);
});

test("a stop added takes the colour already there, so nothing changes", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box({
    fillType: "linear", fillGrad: [0, 0.5, 1, 0.5],
    fillStops: [0, 0xFF0000, 1, 1, 0x0000FF, 1],
  })]));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const before = F.gradientAt(F.gradientStops(o, "fill"), 0.25);
    const r = F.addGradientStop(o, 0.25, "fill");
    const stops = F.gradientStops(o, "fill");
    const added = stops.find((s) => Math.abs(s.ratio - 0.25) < 1e-6);
    return { r, count: stops.length, before, added };
  });
  expect(out.r).toMatchObject({ ok: true, count: 3 });
  /* Which is the point: adding a stop gives you something to grab without
     altering the gradient. The same rule the filter ramp follows. */
  expect(out.added.color).toBe(out.before.color);
  expect(out.added.alpha).toBeCloseTo(out.before.alpha, 6);
  // A quarter of the way from red to blue.
  expect((out.added.color >> 16) & 0xff).toBeCloseTo(191, -1);
});

test("interpolation walks the ramp, and holds at both ends", async ({ page }) => {
  await openEditor(page);
  const at = await page.evaluate(() => {
    const F = window._flashyAI;
    const stops = [
      { ratio: 0.25, color: 0x000000, alpha: 1 },
      { ratio: 0.75, color: 0xFFFFFF, alpha: 0 },
    ];
    return {
      before: F.gradientAt(stops, 0),
      start: F.gradientAt(stops, 0.25),
      mid: F.gradientAt(stops, 0.5),
      end: F.gradientAt(stops, 0.75),
      after: F.gradientAt(stops, 1),
      empty: F.gradientAt([], 0.5),
    };
  });
  // Outside the span the end colours hold, which is Flash's "Extend".
  expect(at.before).toEqual(at.start);
  expect(at.after).toEqual(at.end);
  expect((at.mid.color >> 16) & 0xff).toBe(128);
  expect(at.mid.alpha).toBeCloseTo(0.5, 6);
  expect(at.empty).toEqual({ color: 0, alpha: 1 });
});

test("a gradient cannot be cut below two stops, nor grow past fifteen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box({
    fillType: "linear", fillGrad: [0, 0.5, 1, 0.5],
    fillStops: [0, 0xFF0000, 1, 1, 0x0000FF, 1],
  })]));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const cut = F.removeGradientStop(o, 0, "fill");
    // Fill it up, then try one more.
    let last = null;
    for (let i = 0; i < 20; i++) last = F.addGradientStop(o, i / 25 + 0.01, "fill");
    return { cut, last, count: F.gradientStops(o, "fill").length };
  });
  // One stop is a flat colour, and a flat gradient is not a gradient.
  expect(out.cut.ok).toBe(false);
  expect(out.cut.why).toContain("two stops");
  expect(out.last.ok).toBe(false);
  expect(out.count).toBe(15);
});

test("switching to a gradient seeds it, and switching back keeps the artwork", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box({ fillColor: "#3366CC" })]));

  const made = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.makeGradient(o, "linear", "fill");
    const stops = F.gradientStops(o, "fill");
    return { type: o.fillType, stops };
  });
  // Seeded from the colour it had, fading to transparent: the gradient people
  // reach for first, and it reads as a fade rather than as a mistake.
  expect(made.type).toBe("linear");
  expect(made.stops).toHaveLength(2);
  expect(made.stops[0].color).toBe(0x3366CC);
  expect(made.stops[1].alpha).toBe(0);

  const flat = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.flattenGradient(o, "fill");
    return { type: o.fillType, color: o.fillColor, alpha: o.fillAlpha,
             stops: o.fillStops };
  });
  /* The MIDDLE of the ramp, not the first stop: a fade to transparent would
     otherwise flatten to something invisible, and losing the artwork is worse
     than losing the gradient. */
  expect(flat.type).toBe("solid");
  expect(flat.stops).toBeNull();
  expect(flat.alpha).toBeCloseTo(0.5, 2);
  expect(flat.color).toBe("#3366CC");
});

/* ------------------------------------------------------------------ *
 * Overflow
 * ------------------------------------------------------------------ */

test("Extend holds the end colours; Reflect and Repeat tile the ramp", async ({ page }) => {
  await openEditor(page);
  const tiled = await page.evaluate(() => {
    const F = window._flashyAI;
    const flat = [0, 0xFF0000, 1, 1, 0x0000FF, 1];
    const count = (m) => F.overflowStops(flat, m).length;
    const pad = F.overflowStops(flat, "pad");
    const reflect = F.overflowStops(flat, "reflect");
    return {
      pad: count("pad"), reflect: count("reflect"), repeat: count("repeat"),
      padFirst: pad[0], reflectAt: reflect.map((s) => +s.r.toFixed(3)),
    };
  });
  // Extend is the ramp as written: canvas already holds end colours outside.
  expect(tiled.pad).toBe(2);
  expect(tiled.padFirst).toMatchObject({ r: 0, c: 0xFF0000 });
  /* Canvas has no overflow setting, so Reflect and Repeat are produced by
     TILING the stop list over a compressed span -- seven tiles, three either
     side of the original. */
  expect(tiled.reflect).toBe(14);
  expect(tiled.repeat).toBe(14);
  expect(tiled.reflectAt[0]).toBe(0);
  expect(tiled.reflectAt[tiled.reflectAt.length - 1]).toBeCloseTo(1, 2);
});

test("a reflected gradient really repeats across the shape", async ({ page }) => {
  await openEditor(page);
  // A narrow span, so the tiling is visible inside the shape.
  const makeDoc = (overflow) => docWith([box({
    x: 0, y: 0, width: 300, height: 200,
    fillType: "linear", fillGrad: [0, 0.5, 0.2, 0.5],
    fillStops: [0, 0x000000, 1, 1, 0xFFFFFF, 1],
    fillOverflow: overflow,
  })]);

  await loadDoc(page, makeDoc("pad"));
  const padRight = await px(page, 280, 100);

  await loadDoc(page, makeDoc("reflect"));
  const reflectRight = await px(page, 280, 100);

  /* With Extend the far side holds the end colour, which here is white. With
     Reflect the ramp has bounced back and forth several times, so the same
     place is a different value. */
  expect(padRight[0]).toBeGreaterThan(200);
  expect(Math.abs(reflectRight[0] - padRight[0])).toBeGreaterThan(30);
});

/* ------------------------------------------------------------------ *
 * The focal point
 * ------------------------------------------------------------------ */

test("a focal point moves the highlight off centre", async ({ page }) => {
  await openEditor(page);
  const makeDoc = (focal) => docWith([box({
    x: 0, y: 0, width: 300, height: 200,
    fillType: "radial", fillGrad: [0.5, 0.5, 1, 0.5],
    fillStops: [0, 0xFFFFFF, 1, 1, 0x000000, 1],
    fillFocal: focal,
  })]);

  await loadDoc(page, makeDoc(0));
  const centred = { left: await px(page, 60, 100), right: await px(page, 240, 100) };

  await loadDoc(page, makeDoc(-0.6));
  const shifted = { left: await px(page, 60, 100), right: await px(page, 240, 100) };

  // Centred: symmetric either side of the middle.
  expect(Math.abs(centred.left[0] - centred.right[0])).toBeLessThan(12);
  /* Shifted toward the left: the bright end is nearer the left edge, which is
     what makes a sphere look lit rather than flat. */
  expect(shifted.left[0]).toBeGreaterThan(shifted.right[0] + 25);
});

/* ------------------------------------------------------------------ *
 * A gradient on a stroke
 * ------------------------------------------------------------------ */

test("a stroke can carry its own gradient", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box({
    fillType: "none", strokeStyle: "solid", strokeWidth: 12,
    strokeColor: "#FF0000",
  })]));

  const made = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.makeGradient(o, "linear", "stroke");
    F.setGradientStops(o, [
      { ratio: 0, color: 0xFF0000, alpha: 1 },
      { ratio: 1, color: 0x0000FF, alpha: 1 },
    ], "stroke");
    F.fullRefresh();
    return { isGrad: F.isStrokeGradient(o), kind: o.strokeFillType,
             // The FILL's gradient is untouched: they are two gradients.
             fillStops: o.fillStops };
  });
  expect(made.isGrad).toBe(true);
  expect(made.kind).toBe("linear");
  expect(made.fillStops).toBeFalsy();

  // Red at the left end of the stroke, blue at the right.
  const left = await px(page, 52, 100);
  const right = await px(page, 248, 100);
  expect(left[0]).toBeGreaterThan(left[2]);
  expect(right[2]).toBeGreaterThan(right[0]);
});

test("flattening a stroke gradient leaves a solid stroke", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box({
    strokeStyle: "solid", strokeWidth: 8, strokeColor: "#00FF00",
  })]));

  const flat = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.makeGradient(o, "radial", "stroke");
    F.flattenGradient(o, "stroke");
    return { kind: o.strokeFillType, color: o.strokeColor,
             stops: o.strokeStops, grad: o.strokeGrad };
  });
  expect(flat.kind).toBe("solid");
  expect(flat.stops).toBeNull();
  expect(flat.grad).toBeNull();
  expect(flat.color).toBe("#00FF00");
});

/* ------------------------------------------------------------------ *
 * Every render path agrees
 * ------------------------------------------------------------------ */

test("the SVG export uses spreadMethod and fx, which it has natively", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box({
    fillType: "radial", fillGrad: [0.5, 0.5, 1, 0.5],
    fillStops: [0, 0xFFFFFF, 1, 0.5, 0xFF8800, 1, 1, 0x000000, 1],
    fillOverflow: "reflect", fillFocal: -0.4,
  })]));

  const svg = await downloadFromAction(page, "exportSVG");
  /* SVG is the one path of the four where the overflow mode is native rather
     than faked by tiling -- and the names even match Flash's. */
  expect(svg).toContain('spreadMethod="reflect"');
  expect(svg).toContain("<radialGradient");
  expect(svg).toContain(' fx="');
  // Three stops, all of them.
  expect((svg.match(/<stop /g) || []).length).toBe(3);
});

test("a three-stop gradient with overflow reaches the exported player", async ({ context, page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box({
    x: 0, y: 0, width: 300, height: 200,
    fillType: "linear", fillGrad: [0, 0.5, 0.25, 0.5],
    fillStops: [0, 0x000000, 1, 0.5, 0xFF0000, 1, 1, 0xFFFFFF, 1],
    fillOverflow: "repeat",
  })]));

  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() => !!window.__stage);

  const scan = await out.evaluate(() => {
    window.__stage.stop();
    window.__stage.root.gotoAndStop(1);
    window.__stage._render();
    const g = document.getElementById("stage")
      .getContext("2d", { willReadFrequently: true });
    const d = g.getImageData(0, 100, 300, 1).data;
    // Count how many times the row goes from dark to bright: a repeating
    // gradient crosses several times, a padded one once.
    let crossings = 0, wasDark = d[0] < 90;
    for (let x = 1; x < 300; x++) {
      const dark = d[x * 4] < 90;
      if (dark !== wasDark) { crossings++; wasDark = dark; }
    }
    return crossings;
  });
  /* The overflow mode travels into the export. Without it a repeating
     gradient on the stage published as a plain one -- the divergence class
     this project keeps rediscovering. */
  expect(scan).toBeGreaterThan(3);
  expect(errors).toEqual([]);
  await out.close();
});

test("all four gradient settings survive a save and reopen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box({
    fillType: "radial", fillGrad: [0.4, 0.6, 0.9, 0.6],
    fillStops: [0, 0x112233, 1, 0.6, 0x445566, 0.5, 1, 0x778899, 0],
    fillOverflow: "reflect", fillFocal: 0.35,
    strokeStyle: "solid", strokeWidth: 4, strokeFillType: "linear",
    strokeStops: [0, 0xAABBCC, 1, 1, 0xDDEEFF, 1],
    strokeGrad: [0, 0, 1, 1], strokeOverflow: "repeat",
  })]));

  const back = await page.evaluate(() => {
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    return {
      stops: o.fillStops.length, overflow: o.fillOverflow, focal: o.fillFocal,
      strokeKind: o.strokeFillType, strokeStops: o.strokeStops.length,
      strokeOverflow: o.strokeOverflow,
    };
  });
  expect(back).toEqual({
    stops: 9, overflow: "reflect", focal: 0.35,
    strokeKind: "linear", strokeStops: 6, strokeOverflow: "repeat",
  });
});

/* ------------------------------------------------------------------ *
 * The panel and the dialog
 * ------------------------------------------------------------------ */

test("the Fill panel offers the editor instead of apologising", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box({
    fillType: "radial", fillGrad: [0.5, 0.5, 1, 0.5],
    fillStops: [0, 0xFF0000, 1, 1, 0x0000FF, 1],
  })]));
  await pick(page);
  await page.evaluate(() => window._flashyAI.updateProps());

  const props = page.locator("#propsPanel");
  await expect(props).toContainText("2 stops");
  await expect(props.locator(".props-row", { hasText: "Overflow" })).toHaveCount(1);
  // The focal point only appears for a radial, where it means something.
  await expect(props.locator(".props-slider-row", { hasText: "Focal" })).toHaveCount(1);
  await expect(props.locator("button", { hasText: "Edit gradient" })).toHaveCount(1);
});

test("the dialog lists the stops and the strip adds one", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box({
    fillType: "linear", fillGrad: [0, 0.5, 1, 0.5],
    fillStops: [0, 0xFF0000, 1, 1, 0x0000FF, 1],
  })]));
  await pick(page);

  await page.evaluate(() => window._flashyEditor.doAction("gradientFill"));
  await expect(page.locator("#fy-dialog .filter-stop")).toHaveCount(2);
  await expect(page.locator("#fy-dialog canvas.grad-strip")).toHaveCount(1);

  // Clicking the strip adds a stop where it was clicked.
  await page.locator("#fy-dialog canvas.grad-strip").click({ position: { x: 110, y: 9 } });
  await expect(page.locator("#fy-dialog .filter-stop")).toHaveCount(3);

  const ratios = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    return F.gradientStops(o, "fill").map((s) => Math.round(s.ratio * 100));
  });
  expect(ratios[0]).toBe(0);
  expect(ratios[2]).toBe(100);
  // Roughly halfway, where the click landed.
  expect(ratios[1]).toBeGreaterThan(35);
  expect(ratios[1]).toBeLessThan(65);
});

test("the dialog needs one shape selected, and says why", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box(), box({ x: 200 })]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection(F.currentLayers()[0].getKeyframeAt(1).objects.slice());
  });
  await page.evaluate(() => window._flashyEditor.doAction("gradientFill"));
  /* A gradient belongs to a shape: applying one to several at once would need
     them all to share a span, which they do not. */
  await expect(page.locator("#fy-dialog .fy-dialog-msg")).toContainText("one shape");
});
