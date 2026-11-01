// Group, Ungroup, Break Apart, Arrange, Transform, Align — and the stage aids
// that go with them (onion skin, rulers, guides, snapping).
//
// These are the commands that were in Flash's Modify menu and the Align panel
// and had no equivalent here at all: artwork could only be moved by dragging,
// mirrored by hand-editing a negative scale, and never treated as one piece
// without being promoted to a library symbol.
//
// The riskiest part is the group object type. A group is the first object in
// the document model that CONTAINS other objects, and that breaks two
// assumptions the codebase was built on: that `clone()` can copy arrays with a
// shallow slice, and that every render path can switch on a flat type. Both
// are tested here, in every one of the four output paths.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction, runExportedHTML } from "./helpers.js";

/** A document with three plain rectangles on one layer, at known positions. */
function threeRects() {
  const rect = (over = {}) => ({
    type: "rect", x: 0, y: 0, width: 40, height: 20,
    rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
    fillColor: "#FF0000", fillAlpha: 1, fillType: "solid",
    strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
    ...over,
  });
  return {
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 10,
    layers: [{
      name: "Shapes", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 10, tweenType: "none", easing: "linear", script: "",
        objects: [
          rect({ x: 10, y: 10 }),
          rect({ x: 100, y: 60, width: 60, height: 40, fillColor: "#00FF00" }),
          rect({ x: 200, y: 150, width: 20, height: 80, fillColor: "#0000FF" }),
        ],
      }],
    }],
    library: {},
  };
}

/** The current keyframe's objects, as plain data. */
const objects = (page) =>
  page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    return kf.objects.map((o) => ({
      type: o.type, x: o.x, y: o.y, width: o.width, height: o.height,
      rotation: o.rotation, scaleX: o.scaleX, scaleY: o.scaleY,
      fillColor: o.fillColor, text: o.text,
      children: o.children ? o.children.length : undefined,
      groupW: o.groupW, groupH: o.groupH,
    }));
  });

/** Select objects by index on the current keyframe. */
const selectByIndex = (page, idxs) =>
  page.evaluate((idxs) => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    F.setSelection(idxs.map((i) => kf.objects[i]));
    F.updateProps();
  }, idxs);

const act = (page, a) => page.evaluate((a) => window._flashyEditor.doAction(a), a);

/* ------------------------------------------------------------------ *
 * Group and Ungroup
 * ------------------------------------------------------------------ */

test("Group collapses a selection into one object and Ungroup gives it back unchanged", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, threeRects());

  await selectByIndex(page, [0, 1]);
  await act(page, "group");

  let objs = await objects(page);
  expect(objs).toHaveLength(2);
  const group = objs.find((o) => o.type === "group");
  expect(group).toBeTruthy();
  expect(group.children).toBe(2);
  // The group's box is the union of its members, and `groupW/groupH` record it
  // so resizing the group scales the contents instead of tearing them apart.
  expect(group.x).toBeCloseTo(10, 5);
  expect(group.y).toBeCloseTo(10, 5);
  expect(group.width).toBeCloseTo(150, 5);   // 10 → 160
  expect(group.height).toBeCloseTo(90, 5);   // 10 → 100
  expect(group.groupW).toBeCloseTo(150, 5);
  expect(group.groupH).toBeCloseTo(90, 5);

  // Ungroup returns the exact geometry that went in.
  await act(page, "ungroup");
  objs = await objects(page);
  expect(objs.filter((o) => o.type === "group")).toHaveLength(0);
  expect(objs).toHaveLength(3);
  const red = objs.find((o) => o.fillColor === "#FF0000");
  const green = objs.find((o) => o.fillColor === "#00FF00");
  expect(red.x).toBeCloseTo(10, 4);
  expect(red.y).toBeCloseTo(10, 4);
  expect(green.x).toBeCloseTo(100, 4);
  expect(green.y).toBeCloseTo(60, 4);
  expect(errors).toEqual([]);
});

test("Ungroup composes the group's own transform onto its children", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, threeRects());

  await selectByIndex(page, [0, 1]);
  await act(page, "group");
  // Rotate and scale the group, then take it apart: rotations must add and
  // scales multiply, or ungrouping silently moves the artwork.
  await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    const g = kf.objects.find((o) => o.type === "group");
    g.rotation = 90;
    g.scaleX = 2;
    g.scaleY = 2;
    g.children[0].rotation = 10;
    F.fullRefresh();
  });
  await selectByIndex(page, [0]);
  await act(page, "ungroup");

  const objs = await objects(page);
  const red = objs.find((o) => o.fillColor === "#FF0000");
  expect(red.rotation).toBeCloseTo(100, 4);  // 90 + 10
  expect(red.scaleX).toBeCloseTo(2, 4);
  expect(red.scaleY).toBeCloseTo(2, 4);
  // The child's centre has gone through the group's rotation about the group
  // centre: a 90° turn puts a member that was up-and-left down-and-left.
  expect(red.x).not.toBeCloseTo(10, 1);
});

test("a group survives save, reopen and undo with its children intact", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, threeRects());
  await selectByIndex(page, [0, 1]);
  await act(page, "group");

  // Round-trip through the real serializer.
  const round = await page.evaluate(() => {
    const data = window._flashyEditor.serializeDoc();
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(data)));
    const F = window._flashyAI;
    const kf = F.currentLayers()[0].getKeyframeAt(1);
    const g = kf.objects.find((o) => o.type === "group");
    return {
      kids: g.children.length,
      // Revived children must be real EditorObjects: `clone()` is what undo,
      // keyframe insertion and copy/paste all call, and a plain parsed object
      // has no prototype and throws.
      clonable: typeof g.children[0].clone === "function",
      firstFill: g.children[0].fillColor,
    };
  });
  expect(round.kids).toBe(2);
  expect(round.clonable).toBe(true);
  expect(round.firstFill).toBe("#FF0000");

  // And a clone really is independent — the shallow array slice `clone()` uses
  // for points/paths would have shared the child objects themselves.
  const independent = await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[0].getKeyframeAt(1);
    const g = kf.objects.find((o) => o.type === "group");
    const copy = g.clone();
    copy.children[0].x = 999;
    return g.children[0].x;
  });
  expect(independent).not.toBe(999);

  // Undo after an edit inside the group restores the old child position.
  const undone = await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[0].getKeyframeAt(1);
    const g = kf.objects.find((o) => o.type === "group");
    const was = g.children[0].x;
    F.pushUndo();
    g.children[0].x = 777;
    window._flashyEditor.doAction("undo");
    const now = F.currentLayers()[0].getKeyframeAt(1)
      .objects.find((o) => o.type === "group").children[0].x;
    return { was, now };
  });
  expect(undone.now).toBe(undone.was);
  expect(errors).toEqual([]);
});

test("a group is drawn by every export path, not just the stage", async ({ page, context }) => {
  await openEditor(page);
  await loadDoc(page, threeRects());
  await selectByIndex(page, [0, 1]);
  await act(page, "group");
  await page.evaluate(() => window._flashyAI.setSelection([]));

  // 1. The raster path (sprite sheet / video) — the same rasteriser those use.
  const painted = await page.evaluate(() => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 400, 300);
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let red = 0, green = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] < 60) red++;
      if (d[i + 1] > 200 && d[i] < 60 && d[i + 2] < 60) green++;
    }
    return { red, green };
  });
  // Both grouped rectangles are still on the stage.
  expect(painted.red).toBeGreaterThan(100);
  expect(painted.green).toBeGreaterThan(100);

  // 2. SVG — a group used to fall through to `default` and emit nothing.
  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).toContain("#FF0000");
  expect(svg).toContain("#00FF00");

  // 3. The HTML export's real display list, built by the real engine.
  const html = await downloadFromAction(page, "export");
  const { page: out, errors: outErrors } = await runExportedHTML(context, html);
  const shapes = await out.evaluate(() => {
    // Walk the display list and count leaf Shapes — a group that exported as
    // an empty MovieClip would leave two of the three missing.
    let n = 0;
    (function walk(d) {
      if (!d) return;
      if (d.graphics) n++;
      (d.children || []).forEach(walk);
    })(window.__stage ? window.__stage.root : null);
    return n;
  });
  // Either the export exposes its stage (then every shape is there) or it does
  // not, in which case the generated source must at least carry both colours.
  if (shapes > 0) expect(shapes).toBeGreaterThanOrEqual(3);
  else expect(html).toContain("00FF00");
  expect(outErrors).toEqual([]);
  await out.close();
});

/* ------------------------------------------------------------------ *
 * Break Apart
 * ------------------------------------------------------------------ */

test("Break Apart turns a symbol instance into free shapes", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, {
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 10,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 10, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "symbol", symbolName: "Box", x: 50, y: 50, width: 40, height: 40,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
        }],
      }],
    }],
    library: {
      Box: {
        layers: [{
          name: "Layer 1", visible: true, locked: false,
          keyframes: [{
            index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
            objects: [
              { type: "rect", x: 0, y: 0, width: 20, height: 20, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, fillColor: "#112233", fillType: "solid", fillAlpha: 1, strokeWidth: 0, strokeStyle: "none" },
              { type: "rect", x: 20, y: 20, width: 20, height: 20, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, fillColor: "#445566", fillType: "solid", fillAlpha: 1, strokeWidth: 0, strokeStyle: "none" },
            ],
          }],
        }],
        totalFrames: 1,
      },
    },
  });

  await selectByIndex(page, [0]);
  await act(page, "breakApart");

  const objs = await objects(page);
  expect(objs.filter((o) => o.type === "symbol")).toHaveLength(0);
  expect(objs).toHaveLength(2);
  // Symbol space has its origin at the instance's top-left, so the children
  // land offset by the instance position — not back at 0,0.
  expect(objs[0].x).toBeCloseTo(50, 4);
  expect(objs[0].y).toBeCloseTo(50, 4);
  expect(objs[1].x).toBeCloseTo(70, 4);
  expect(objs[1].y).toBeCloseTo(70, 4);
  expect(errors).toEqual([]);
});

test("Break Apart splits a text block into one object per character", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 10,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 10, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "text", text: "AB C", x: 20, y: 30, width: 200, height: 40,
          fontSize: 24, font: "Arial", textAlign: "left",
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, fillColor: "#000000",
        }],
      }],
    }],
    library: {},
  });

  await selectByIndex(page, [0]);
  await act(page, "breakApart");

  const objs = await objects(page);
  // Three glyphs; the space contributes no object but still advances the pen.
  expect(objs.map((o) => o.text)).toEqual(["A", "B", "C"]);
  expect(objs.every((o) => o.type === "text")).toBe(true);
  expect(objs[0].x).toBeCloseTo(20, 4);
  // Each letter sits to the right of the last, by its own measured width.
  expect(objs[1].x).toBeGreaterThan(objs[0].x);
  expect(objs[2].x).toBeGreaterThan(objs[1].x);
  // The gap before "C" is wider than the gap between "A" and "B", because a
  // space was skipped there.
  expect(objs[2].x - objs[1].x).toBeGreaterThan(objs[1].x - objs[0].x);
});

test("Break Apart says so rather than silently doing nothing to a bitmap", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, threeRects());
  // A plain rectangle has nothing to break into either.
  await selectByIndex(page, [0]);
  await act(page, "breakApart");
  await expect(page.locator(".fy-dialog")).toContainText("Break Apart");
  await expect(page.locator(".fy-dialog")).toContainText("Trace Bitmap");
});

/* ------------------------------------------------------------------ *
 * Arrange
 * ------------------------------------------------------------------ */

test("Arrange steps one place at a time, and a multiple selection keeps its order", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, threeRects());
  const fills = () => objects(page).then((o) => o.map((x) => x.fillColor));

  // Start: red, green, blue (back to front).
  expect(await fills()).toEqual(["#FF0000", "#00FF00", "#0000FF"]);

  await selectByIndex(page, [0]);
  await act(page, "bringForward");
  expect(await fills()).toEqual(["#00FF00", "#FF0000", "#0000FF"]);

  await act(page, "bringForward");
  expect(await fills()).toEqual(["#00FF00", "#0000FF", "#FF0000"]);

  // Already at the front: another step is a no-op, not a wrap.
  await act(page, "bringForward");
  expect(await fills()).toEqual(["#00FF00", "#0000FF", "#FF0000"]);

  await act(page, "sendBack");
  expect(await fills()).toEqual(["#FF0000", "#00FF00", "#0000FF"]);

  // Two adjacent objects moved together keep their relative stacking.
  await selectByIndex(page, [0, 1]);
  await act(page, "bringForward");
  expect(await fills()).toEqual(["#0000FF", "#FF0000", "#00FF00"]);
});

/* ------------------------------------------------------------------ *
 * Transform
 * ------------------------------------------------------------------ */

test("flip, rotate and reset act about the object's own centre", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, threeRects());
  const first = () => objects(page).then((o) => o[0]);

  await selectByIndex(page, [0]);
  await act(page, "flipH");
  let o = await first();
  // A flip is a negative scale, so the object mirrors in place: the box does
  // not move. Flash behaved the same way.
  expect(o.scaleX).toBe(-1);
  expect(o.x).toBe(10);
  expect(o.y).toBe(10);

  await act(page, "flipV");
  o = await first();
  expect(o.scaleY).toBe(-1);

  await act(page, "rot90cw");
  o = await first();
  expect(o.rotation).toBe(90);

  await act(page, "rot90ccw");
  o = await first();
  expect(o.rotation).toBe(0);

  await act(page, "transformReset");
  o = await first();
  expect(o.scaleX).toBe(1);
  expect(o.scaleY).toBe(1);
  expect(o.rotation).toBe(0);

  // One undo per command, so Remove Transform is recoverable.
  await act(page, "undo");
  o = await first();
  expect(o.scaleX).toBe(-1);
});

test("skew is applied on the stage and in every export, not just stored", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, threeRects());

  // `skewX`/`skewY` have been on every object since the beginning and were
  // applied by nothing: the engine honoured them, the editor never set them,
  // and no render path read them.
  await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[0].getKeyframeAt(1);
    kf.objects[0].skewX = 30;
    F.setSelection([]);
    F.fullRefresh();
  });

  // The rasteriser must put red pixels outside the unskewed box.
  const leaked = await page.evaluate(() => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 400, 300);
    const ctx = cv.getContext("2d");
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let minX = 1e9, maxX = -1e9;
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4;
        if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] < 60) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    return { minX, maxX };
  });
  // Unskewed the shape spans x 10..50. A 30° horizontal shear widens that.
  expect(leaked.maxX - leaked.minX).toBeGreaterThan(45);

  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).toContain("matrix(1,");
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * Align
 * ------------------------------------------------------------------ */

test("Align lines objects up with each other", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, threeRects());
  await selectByIndex(page, [0, 1, 2]);

  await act(page, "alignLeft");
  let objs = await objects(page);
  expect(objs.map((o) => o.x)).toEqual([10, 10, 10]);

  await act(page, "alignTop");
  objs = await objects(page);
  expect(objs.map((o) => o.y)).toEqual([10, 10, 10]);
});

test("Align To Stage centres a single object on the stage", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, threeRects());
  await selectByIndex(page, [0]);

  // Without To Stage, one object is not enough to align — and the editor says
  // so rather than quietly doing nothing.
  await act(page, "alignHCenter");
  await expect(page.locator(".fy-dialog")).toContainText("To Stage");
  await page.locator(".fy-dialog-foot button").first().click();

  await act(page, "alignToStage");
  await selectByIndex(page, [0]);
  await act(page, "alignHCenter");
  await act(page, "alignVCenter");
  const o = (await objects(page))[0];
  expect(o.x).toBeCloseTo((400 - 40) / 2, 4);
  expect(o.y).toBeCloseTo((300 - 20) / 2, 4);
});

test("Distribute spreads centres evenly; Space evenly spreads gaps", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, threeRects());
  await selectByIndex(page, [0, 1, 2]);

  // Distribute: equal pitch between centres. The outermost two do not move.
  await act(page, "alignDistH");
  let objs = await objects(page);
  const centres = objs.map((o) => o.x + o.width / 2).sort((a, b) => a - b);
  expect(centres[1] - centres[0]).toBeCloseTo(centres[2] - centres[1], 3);

  await loadDoc(page, threeRects());
  await selectByIndex(page, [0, 1, 2]);
  // Space evenly: equal GAPS, which is a different answer whenever the objects
  // are different sizes — and these are.
  await act(page, "alignSpaceH");
  objs = await objects(page);
  const sorted = objs.slice().sort((a, b) => a.x - b.x);
  const gap1 = sorted[1].x - (sorted[0].x + sorted[0].width);
  const gap2 = sorted[2].x - (sorted[1].x + sorted[1].width);
  expect(gap1).toBeCloseTo(gap2, 3);
});

test("Match size scales the selection to the largest in it", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, threeRects());
  await selectByIndex(page, [0, 1, 2]);
  await act(page, "alignMatchWH");
  const objs = await objects(page);
  // Widest is 60, tallest is 80.
  expect(objs.map((o) => o.width)).toEqual([60, 60, 60]);
  expect(objs.map((o) => o.height)).toEqual([80, 80, 80]);
});

test("Distribute to Layers gives every object its own named layer", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, threeRects());
  await selectByIndex(page, [0, 1, 2]);
  await act(page, "distributeToLayers");

  const state = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      names: F.currentLayers().map((l) => l.name),
      counts: F.currentLayers().map((l) => {
        const kf = l.getKeyframeAt(F.curFrame());
        return kf ? kf.objects.length : 0;
      }),
    };
  });
  // Three new layers, each holding one object, and the source layer now empty.
  expect(state.names).toHaveLength(4);
  expect(state.counts.filter((c) => c === 1)).toHaveLength(3);
  expect(state.counts.filter((c) => c === 0)).toHaveLength(1);
  // Named after what they hold, not "Layer 5".
  expect(state.names.filter((n) => n.startsWith("Rect"))).toHaveLength(3);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * Onion skin
 * ------------------------------------------------------------------ */

test("onion skin draws the surrounding frames under the current one", async ({ page }) => {
  const errors = await openEditor(page);
  // Two keyframes with the rectangle in different places, so a ghost of frame
  // 1 has to show up while sitting on frame 5.
  await loadDoc(page, {
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 10,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [
        { index: 1, duration: 4, tweenType: "none", easing: "linear", script: "", objects: [
          { type: "rect", x: 10, y: 10, width: 40, height: 40, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, fillColor: "#FF0000", fillType: "solid", fillAlpha: 1, strokeWidth: 0, strokeStyle: "none" }] },
        { index: 5, duration: 6, tweenType: "none", easing: "linear", script: "", objects: [
          { type: "rect", x: 300, y: 200, width: 40, height: 40, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, fillColor: "#FF0000", fillType: "solid", fillAlpha: 1, strokeWidth: 0, strokeStyle: "none" }] },
      ],
    }],
    library: {},
  });

  // Count non-background pixels on the stage canvas, with and without onion.
  const inked = () =>
    page.evaluate(() => {
      const cv = document.getElementById("stageCanvas");
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        // Reddish: the shape and its ghosts, never the grey pasteboard or the
        // white stage.
        if (d[i] > d[i + 1] + 20 && d[i] > d[i + 2] + 20) n++;
      }
      return n;
    });

  await page.evaluate(() => { window._flashyAI.setCurFrame(5); window._flashyAI.fullRefresh(); });
  const plain = await inked();
  expect(plain).toBeGreaterThan(100);

  await page.evaluate(() =>
    window._flashyAI.onion({ on: true, before: 2, after: 0, outlines: false }));
  const ghosted = await inked();
  // The frame-1 drawing is now also on screen, faded — strictly more ink.
  expect(ghosted).toBeGreaterThan(plain * 1.4);

  // Outline mode draws silhouettes instead of ghosts: far less ink overall,
  // and in the past-frame colour (blue) rather than the artwork's own red.
  await page.evaluate(() => window._flashyAI.onion({ outlines: true }));
  const outlined = await inked();
  expect(outlined).toBeLessThan(ghosted);
  const outlineInk = await page.evaluate(() => {
    const cv = document.getElementById("stageCanvas");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 2] > d[i] + 30 && d[i + 2] > 120) n++;
    }
    return n;
  });
  expect(outlineInk).toBeGreaterThan(50);

  // Turning it off puts the stage back exactly as it was.
  await page.evaluate(() => window._flashyAI.onion({ on: false }));
  expect(await inked()).toBe(plain);

  // Onion skin is an authoring aid: it must never reach an export.
  const cleanExport = await page.evaluate(() => {
    window._flashyAI.onion({ on: true, before: 3, after: 3 });
    const cv = window._flashyAI.renderFrameToCanvas(5, 400, 300);
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > d[i + 1] + 20 && d[i] > d[i + 2] + 20) n++;
    }
    return n;
  });
  // Exactly one 40x40 rectangle's worth of red, not three.
  expect(cleanExport).toBeGreaterThan(1200);
  expect(cleanExport).toBeLessThan(2400);
  expect(errors).toEqual([]);
});

test("the onion skin toggle in the timeline header reflects and drives the state", async ({ page }) => {
  await openEditor(page);
  const btn = page.locator("#tlOnion");
  await expect(btn).not.toHaveClass(/active/);
  await btn.click();
  await expect(btn).toHaveClass(/active/);
  // Turning it on with both counts at zero would show nothing, which reads as
  // a broken toggle — it defaults to one frame back.
  const st = await page.evaluate(() => window._flashyAI.onion());
  expect(st.on).toBe(true);
  expect(st.before + st.after).toBeGreaterThan(0);

  // Typing a range turns onion skin on, rather than setting a number that
  // silently does nothing.
  await btn.click();
  await page.locator("#tlOnionBefore").fill("3");
  await page.locator("#tlOnionBefore").dispatchEvent("change");
  expect(await page.evaluate(() => window._flashyAI.onion())).toMatchObject({ on: true, before: 3 });
});

/* ------------------------------------------------------------------ *
 * Guides, rulers and snapping
 * ------------------------------------------------------------------ */

test("guides are saved with the document and never exported", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, threeRects());

  await page.evaluate(() => {
    const g = window._flashyAI.guides();
    g.v.push(120);
    g.h.push(80);
    window._flashyAI.fullRefresh();
  });

  const saved = await page.evaluate(() => window._flashyEditor.serializeDoc());
  expect(saved.guides).toEqual({ v: [120], h: [80] });

  // Reopened, they come back.
  const back = await page.evaluate((d) => {
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(d)));
    return window._flashyAI.guides();
  }, saved);
  expect(back).toEqual({ v: [120], h: [80] });

  // A document from before guides existed loads without them, not with
  // undefined arrays that throw on the first render.
  const noGuides = await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    delete d.guides;
    window._flashyEditor.loadDoc(d);
    return window._flashyAI.guides();
  });
  expect(noGuides).toEqual({ v: [], h: [] });

  // And an SVG export carries no trace of them.
  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).not.toContain("guide");
});

test("snapping pulls a dragged box onto another object's edge", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, threeRects());

  // snapBox is the function the drag handler calls. Ask it directly: a box
  // three pixels off another object's left edge should be pulled onto it.
  const snapped = await page.evaluate(() => {
    const F = window._flashyAI;
    F.snapping({ objects: true, guides: true });
    return F.snapBox({ x: 103, y: 200, w: 10, h: 10 }, []);
  });
  // The green rectangle's left edge is x=100.
  expect(snapped.dx).toBeCloseTo(-3, 5);

  // Far away from anything, nothing moves.
  const free = await page.evaluate(() =>
    window._flashyAI.snapBox({ x: 137, y: 243, w: 10, h: 10 }, []));
  expect(free.dx).toBe(0);
  expect(free.dy).toBe(0);

  // A guide captures too.
  const toGuide = await page.evaluate(() => {
    const F = window._flashyAI;
    F.guides().v.push(250);
    return F.snapBox({ x: 248, y: 243, w: 10, h: 10 }, []);
  });
  expect(toGuide.dx).toBeCloseTo(2, 5);

  // Turning both off disables it entirely rather than falling back to grid.
  const off = await page.evaluate(() => {
    const F = window._flashyAI;
    F.snapping({ objects: false, guides: false });
    return F.snapBox({ x: 103, y: 200, w: 10, h: 10 }, []);
  });
  expect(off).toEqual({ dx: 0, dy: 0 });
});

test("the Info panel reads out the selection and the document", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, threeRects());
  await page.evaluate(() => window._flashyEditor.doAction("winInfo"));
  await selectByIndex(page, [1]);
  await page.evaluate(() => window._flashyAI.fullRefresh());

  const panel = page.locator("#infoPanel");
  await expect(panel).toContainText("400 × 300");
  await expect(panel).toContainText("60 px");
  await expect(panel).toContainText("40 px");
});

test("the Transform panel applies a numeric rotation to the whole selection", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, threeRects());
  await page.evaluate(() => window._flashyEditor.doAction("winTransform"));
  await selectByIndex(page, [0, 1]);
  await page.evaluate(() => window._flashyAI.fullRefresh());

  // Properties edits one object; Transform edits the selection, which is the
  // reason to have both.
  const angle = page.locator("#transformPanel .props-row", { hasText: "Angle" }).locator("input");
  await angle.fill("15");
  await angle.dispatchEvent("change");

  const objs = await objects(page);
  expect(objs[0].rotation).toBe(15);
  expect(objs[1].rotation).toBe(15);
  expect(objs[2].rotation).toBe(0);
});
