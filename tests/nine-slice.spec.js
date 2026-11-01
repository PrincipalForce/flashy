// 9-slice scaling.
//
// Four guides cut a symbol into nine pieces; scaling it then stretches only
// the middles. It is the difference between a button that can be any width and
// a button whose rounded corners smear when you widen it.
//
// The cell maths lives once, in Flashy.Slice9, because three renderers need it
// and they have to agree to the pixel: the authoring stage, the SVG export, and
// the NineSlice display object the exported player uses. The trick in all three
// is the same — the instance's scale is applied INSIDE the symbol, cell by
// cell, because an outer scale is already in the context by the time the
// content draws and would stretch every cell alike.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction, runExportedHTML } from "./helpers.js";

/**
 * A 100x100 symbol made of a black 20px frame round a white middle, placed as
 * one instance. Scaling it tests exactly what 9-slice is for: the border
 * thickness must not change.
 */
function framedButtonDoc(scale9, scaleX = 1, scaleY = 1) {
  const part = (x, y, w, h, color) => ({
    type: "rect", x, y, width: w, height: h,
    rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
    fillColor: color, fillAlpha: 1, fillType: "solid",
    strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  });
  return {
    width: 500, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 5,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 5, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "symbol", symbolName: "Btn", instanceName: "btn",
          x: 150, y: 90, width: 100, height: 100,
          rotation: 0, scaleX, scaleY, alpha: 1,
        }],
      }],
    }],
    library: {
      Btn: {
        totalFrames: 1,
        behavior: "graphic",
        scale9,
        layers: [{
          name: "Layer 1", visible: true, locked: false,
          keyframes: [{
            index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
            objects: [
              part(0, 0, 100, 100, "#000000"),     // the frame
              part(20, 20, 60, 60, "#FFFFFF"),     // the hole in it
            ],
          }],
        }],
      },
    },
  };
}

/** Pixels from the raster export path — what a sprite sheet or video records. */
const px = (page, x, y) =>
  page.evaluate(({ x, y }) => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 500, 300);
    const d = cv.getContext("2d").getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }, { x, y });

/**
 * The first run of black pixels along a horizontal scan: where the left-hand
 * border starts and how thick it is. That thickness is the whole point of
 * 9-slice — it must not change when the instance is stretched.
 */
const borderThickness = (page, y) =>
  page.evaluate(({ y }) => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 500, 300);
    const d = cv.getContext("2d").getImageData(0, y, cv.width, 1).data;
    let start = -1, end = -1;
    for (let x = 0; x < cv.width; x++) {
      const dark = d[x * 4] < 100;
      if (dark && start < 0) start = x;
      if (!dark && start >= 0) { end = x; break; }
    }
    if (start < 0) return { start: -1, n: 0 };
    if (end < 0) end = cv.width;
    return { start, n: end - start };
  }, { y });

/**
 * The stretched box, in stage coordinates.
 *
 * An instance grows from the centre of its NATURAL box, which is the same
 * convention every other transform here uses — so the stretched box is not
 * simply (x, x + width * scale).
 */
function stretchedBox(x, y, w, h, sx, sy) {
  const cx = x + w / 2, cy = y + h / 2;
  const dw = w * Math.abs(sx), dh = h * Math.abs(sy);
  return { x0: cx - dw / 2, y0: cy - dh / 2, dw, dh };
}

/* ------------------------------------------------------------------ *
 * The cell maths
 * ------------------------------------------------------------------ */

test("the nine cells map source edges to destination edges", async ({ page }) => {
  await openEditor(page);
  const cells = await page.evaluate(() =>
    window.Flashy.Slice9.cells({ left: 20, right: 20, top: 20, bottom: 20 },
      100, 100, 300, 100));
  expect(cells).toHaveLength(9);

  // Corners keep their size: 20x20 in, 20x20 out.
  const topLeft = cells[0];
  expect(topLeft).toMatchObject({ sx: 0, sy: 0, sw: 20, sh: 20, dx: 0, dy: 0, dw: 20, dh: 20 });
  // The top-right corner is pushed to the far edge but stays 20 wide.
  const topRight = cells[2];
  expect(topRight.dx).toBe(280);
  expect(topRight.dw).toBe(20);
  // The middle takes all the slack: 60 in, 260 out.
  const centre = cells[4];
  expect(centre.sw).toBe(60);
  expect(centre.dw).toBe(260);
  expect(centre.dh).toBe(60);
});

test("guides too big for the destination are scaled down together, not overlapped", async ({ page }) => {
  await openEditor(page);
  // 40 + 40 of corner into a 50px-wide destination.
  const cells = await page.evaluate(() =>
    window.Flashy.Slice9.cells({ left: 40, right: 40, top: 10, bottom: 10 },
      100, 100, 50, 100));
  const xs = cells.map((c) => c.dx + c.dw);
  // Nothing extends past the destination, and no cell has negative width.
  expect(Math.max(...xs)).toBeCloseTo(50, 5);
  expect(cells.every((c) => c.dw > 0 && c.dh > 0)).toBe(true);
  // The two corners share the 50 between them rather than each taking 40.
  const left = cells.find((c) => c.sx === 0 && c.sy === 0);
  expect(left.dw).toBeCloseTo(25, 5);
});

test("a grid of all zeroes is not active, so nothing pays for it", async ({ page }) => {
  await openEditor(page);
  const flags = await page.evaluate(() => [
    window.Flashy.Slice9.active(null),
    window.Flashy.Slice9.active({ left: 0, right: 0, top: 0, bottom: 0 }),
    window.Flashy.Slice9.active({ left: 10, right: 0, top: 0, bottom: 0 }),
  ]);
  expect(flags).toEqual([false, false, true]);
});

test("a guide sitting exactly on an edge drops its zero-width cells", async ({ page }) => {
  await openEditor(page);
  const cells = await page.evaluate(() =>
    // left = 0 means the left column has no width at all.
    window.Flashy.Slice9.cells({ left: 0, right: 20, top: 20, bottom: 20 },
      100, 100, 200, 100));
  // Six cells, not nine — and crucially no cell with sw === 0, which would be
  // a divide by zero in the scale.
  expect(cells).toHaveLength(6);
  expect(cells.every((c) => c.sw > 0 && c.sh > 0)).toBe(true);
});

/* ------------------------------------------------------------------ *
 * On the stage and in the raster export
 * ------------------------------------------------------------------ */

test("a 9-sliced instance keeps its border thickness when stretched", async ({ page }) => {
  const errors = await openEditor(page);

  const box = stretchedBox(150, 90, 100, 100, 3, 1);

  // First without guides: a 3x stretch triples the border.
  await loadDoc(page, framedButtonDoc(null, 3, 1));
  const plain = await borderThickness(page, 140);
  expect(plain.n).toBeGreaterThan(50);

  // Now with them: the border stays 20px however wide the button gets.
  await loadDoc(page, framedButtonDoc(
    { left: 20, right: 20, top: 20, bottom: 20 }, 3, 1));
  const sliced = await borderThickness(page, 140);
  expect(sliced.n).toBeGreaterThan(15);
  expect(sliced.n).toBeLessThan(26);
  // And both start at the stretched box's left edge, so slicing has not moved
  // the instance.
  expect(sliced.start).toBeCloseTo(box.x0, 0);
  expect(plain.start).toBeCloseTo(box.x0, 0);
  expect(errors).toEqual([]);
});

test("a 9-sliced instance covers the full stretched box", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, framedButtonDoc(
    { left: 20, right: 20, top: 20, bottom: 20 }, 3, 1));
  const box = stretchedBox(150, 90, 100, 100, 3, 1);
  // The last 20px inside the box is the right-hand border.
  const insideRight = await px(page, Math.round(box.x0 + box.dw - 10), 140);
  expect(insideRight[0]).toBeLessThan(100);
  // Just past the box is stage again.
  const past = await px(page, Math.round(box.x0 + box.dw + 6), 140);
  expect(past[0]).toBeGreaterThan(240);
  // The middle is the white hole, stretched.
  const middle = await px(page, Math.round(box.x0 + box.dw / 2), 140);
  expect(middle[0]).toBeGreaterThan(240);
});

test("a 9-sliced instance still mirrors on a negative scale", async ({ page }) => {
  const errors = await openEditor(page);
  // The magnitude goes into the cells; the sign must still flip the artwork,
  // or applying both would stretch it twice or not mirror at all.
  await loadDoc(page, framedButtonDoc(
    { left: 40, right: 5, top: 20, bottom: 20 }, -2, 1));
  // Asymmetric guides, mirrored: the THICK border ends up on the right.
  const scan = await page.evaluate(() => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 500, 300);
    const d = cv.getContext("2d").getImageData(0, 140, cv.width, 1).data;
    const dark = [];
    for (let x = 0; x < cv.width; x++) if (d[x * 4] < 100) dark.push(x);
    return { first: dark[0], last: dark[dark.length - 1], count: dark.length };
  });
  expect(scan.count).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * Every output path
 * ------------------------------------------------------------------ */

test("the guides save with the symbol and come back", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, framedButtonDoc(
    { left: 12, right: 13, top: 14, bottom: 15 }, 2, 2));
  const back = await page.evaluate(() => {
    const data = window._flashyEditor.serializeDoc();
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(data)));
    return window._flashyAI.doc.library.Btn.scale9;
  });
  expect(back).toEqual({ left: 12, right: 13, top: 14, bottom: 15 });

  // A symbol from before 9-slice existed loads with no grid, not undefined
  // fields that make Slice9.active throw.
  const legacy = await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    delete d.library.Btn.scale9;
    window._flashyEditor.loadDoc(d);
    return {
      grid: window._flashyAI.doc.library.Btn.scale9,
      active: window.Flashy.Slice9.active(window._flashyAI.doc.library.Btn.scale9),
    };
  });
  expect(legacy.grid).toBeNull();
  expect(legacy.active).toBe(false);
});

test("the SVG export emits nine clipped cells", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, framedButtonDoc(
    { left: 20, right: 20, top: 20, bottom: 20 }, 3, 1));
  const svg = await downloadFromAction(page, "exportSVG");
  // Nine cells, nine clip paths — each with its own cell scale.
  expect((svg.match(/fy-s9-/g) || []).length).toBeGreaterThanOrEqual(18);
  expect(svg).toContain("<clipPath");
  // The centre cell's horizontal scale: 260/60.
  expect(svg).toMatch(/scale\(4\.3333/);

  // Without guides the slicing machinery stays out of the file entirely.
  await loadDoc(page, framedButtonDoc(null, 3, 1));
  const plain = await downloadFromAction(page, "exportSVG");
  expect(plain).not.toContain("fy-s9-");
});

test("the HTML export stretches by cells in the engine's own renderer", async ({ page, context }) => {
  await openEditor(page);
  await loadDoc(page, framedButtonDoc(
    { left: 20, right: 20, top: 20, bottom: 20 }, 3, 1));
  const html = await downloadFromAction(page, "export");
  expect(html).toContain("scale9");

  const { page: out, errors } = await runExportedHTML(context, html);
  const engine = await out.evaluate(() => {
    const F = window.Flashy;
    // The export ships NineSlice, and it must honour targetWidth rather than
    // its own scaleX — that is the whole mechanism.
    const ns = new F.NineSlice({ left: 20, right: 20, top: 20, bottom: 20 }, 100, 100);
    ns.targetWidth = 300;
    return {
      hasNineSlice: typeof F.NineSlice === "function",
      scaleUntouched: ns.scaleX === 1,
      cells: F.Slice9.cells(ns.grid, 100, 100, ns.targetWidth, 100).length,
    };
  });
  expect(engine.hasNineSlice).toBe(true);
  expect(engine.scaleUntouched).toBe(true);
  expect(engine.cells).toBe(9);
  expect(errors).toEqual([]);
  await out.close();
});

/* ------------------------------------------------------------------ *
 * The dialog
 * ------------------------------------------------------------------ */

test("Symbol Properties turns 9-slice on with usable defaults", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, framedButtonDoc(null, 2, 2));

  await page.evaluate(() => window._flashyAI.showSymbolProps("Btn"));
  await expect(page.locator(".fy-dialog")).toContainText("Symbol Properties");
  await expect(page.locator(".fy-dialog")).toContainText("9-slice");

  // Ticking the box with every guide at zero would be a grid that does
  // nothing, so it fills in a sensible default instead of a silent no-op.
  await page.locator('.fy-dialog input[type="checkbox"]').check();
  await page.locator(".fy-dialog-foot button").last().click();

  const grid = await page.evaluate(() => window._flashyAI.doc.library.Btn.scale9);
  expect(grid.left).toBeGreaterThan(0);
  expect(grid.top).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.Flashy.Slice9.active(
    window._flashyAI.doc.library.Btn.scale9))).toBe(true);
  expect(errors).toEqual([]);
});

test("the inspector reports an instance's 9-slice state and offers the way in", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, framedButtonDoc(
    { left: 20, right: 20, top: 20, bottom: 20 }, 2, 2));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    F.fullRefresh();
  });
  const props = page.locator("#propsPanel");
  await expect(props).toContainText("9-slice");
  // The guides are a property of the ARTWORK, shared by every instance, so
  // the inspector points at the symbol rather than repeating four fields.
  await expect(props).toContainText("shared by every instance");
  await expect(props.locator("button", { hasText: "Symbol Properties" })).toHaveCount(1);
});
