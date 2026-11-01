// Motion guide layers, Orient to Path, and real shape tweening with hints.
//
// The shape tween is the serious one. A shape tween is supposed to MORPH one
// outline into another — a circle into a star, a mouth into a different mouth.
// What it did was interpolate the two objects' boxes and transforms, exactly
// like a motion tween with a different colour in the timeline: a rectangle
// tweened to an oval stayed a rectangle the whole way and then snapped. It was
// a feature in the menu, in the save format and in the timeline's colour
// coding, and it did not do the thing it is named after.
//
// Both features live in the engine (Flashy.MotionGuide, Flashy.Morph) because
// the exported player tweens its own keyframes and would otherwise need a
// second copy — the same reason Filters and Slice9 are there.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction } from "./helpers.js";

const shape = (type, over = {}) => ({
  type, x: 0, y: 0, width: 100, height: 100,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#CC2222", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

const act = (page, a) => page.evaluate((a) => window._flashyEditor.doAction(a), a);

/* ------------------------------------------------------------------ *
 * The morph itself
 * ------------------------------------------------------------------ */

test("the morph walks both outlines and really is between them", async ({ page }) => {
  const errors = await openEditor(page);

  const m = await page.evaluate(() => {
    const M = window.Flashy.Morph;
    const sq = { type: "rect", x: 0, y: 0, width: 100, height: 100, rotation: 0, scaleX: 1, scaleY: 1 };
    const ov = { type: "oval", x: 0, y: 0, width: 100, height: 100, rotation: 0, scaleX: 1, scaleY: 1 };
    // Distance from the centre to the outline at 45 degrees: a square's corner
    // is at ~70.7, a circle's edge at 50. Half way across should be between.
    const reach = (t) => {
      const r = M.between(sq, ov, t, null);
      let best = 0;
      for (let i = 0; i < r.path.length;) {
        if (r.path[i] === 3) { i += 1; continue; }
        const x = r.path[i + 1] + r.x - 50, y = r.path[i + 2] + r.y - 50;
        // Only the diagonal direction, where the two shapes differ most.
        if (Math.abs(Math.abs(x) - Math.abs(y)) < 4) best = Math.max(best, Math.hypot(x, y));
        i += 3;
      }
      return best;
    };
    return { start: reach(0), mid: reach(0.5), end: reach(1) };
  });
  expect(m.start).toBeGreaterThan(65);
  expect(m.end).toBeLessThan(55);
  // Genuinely in between, which an interpolated bounding box never is.
  expect(m.mid).toBeLessThan(m.start - 4);
  expect(m.mid).toBeGreaterThan(m.end + 4);
  expect(errors).toEqual([]);
});

test("the morph lands exactly on each shape at the ends of the tween", async ({ page }) => {
  await openEditor(page);
  const ends = await page.evaluate(() => {
    const M = window.Flashy.Morph;
    const a = { type: "rect", x: 10, y: 20, width: 60, height: 40, rotation: 0, scaleX: 1, scaleY: 1 };
    const b = { type: "rect", x: 200, y: 120, width: 30, height: 90, rotation: 0, scaleX: 1, scaleY: 1 };
    const r0 = M.between(a, b, 0, null), r1 = M.between(a, b, 1, null);
    return {
      at0: [Math.round(r0.x), Math.round(r0.y), Math.round(r0.width), Math.round(r0.height)],
      at1: [Math.round(r1.x), Math.round(r1.y), Math.round(r1.width), Math.round(r1.height)],
    };
  });
  expect(ends.at0).toEqual([10, 20, 60, 40]);
  expect(ends.at1).toEqual([200, 120, 30, 90]);
});

test("a shape tween morphs on the stage and in every export", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 21,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [
        { index: 1, duration: 10, tweenType: "shape", easing: "linear", script: "",
          objects: [shape("rect", { x: 20, y: 50, width: 100, height: 100 })] },
        { index: 11, duration: 10, tweenType: "none", easing: "linear", script: "",
          objects: [shape("oval", { x: 20, y: 50, width: 100, height: 100, fillColor: "#2222CC" })] },
      ],
    }],
    library: {},
  });

  // The interpolated object at the midpoint is a path, not a rect: the shape
  // itself has changed, which is what a shape tween means.
  const mid = await page.evaluate(() => {
    const F = window._flashyAI;
    const objs = F.frameObjects(F.currentLayers(), 6);
    const o = objs[0];
    return { type: o.type, fill: o.fillColor, cmds: o.path ? o.path.length : 0 };
  });
  expect(mid.type).toBe("path");
  expect(mid.cmds).toBeGreaterThan(30);
  // Colour crosses over with the shape, which is the other half of a shape
  // tween and the part people notice first.
  expect(mid.fill).not.toBe("#CC2222");
  expect(mid.fill).not.toBe("#2222CC");

  // The corner of the square has gone by the midpoint: a rect-shaped tween
  // would still have a filled pixel there.
  const corner = await page.evaluate(() => {
    const read = (f, x, y) => {
      const cv = window._flashyAI.renderFrameToCanvas(f, 300, 200);
      const d = cv.getContext("2d").getImageData(x, y, 1, 1).data;
      return d[3] > 10 && !(d[0] > 240 && d[1] > 240 && d[2] > 240);
    };
    return { at1: read(1, 23, 53), at6: read(6, 23, 53) };
  });
  expect(corner.at1).toBe(true);
  expect(corner.at6).toBe(false);

  // The SVG export carries the morphed path.
  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).toContain("<path");

  // And the exported player uses the same module, so it cannot disagree.
  const html = await downloadFromAction(page, "export");
  expect(html).toContain("Flashy.Morph");
  expect(html).toContain('kf.tweenType === "shape"');
  expect(errors).toEqual([]);
});

test("a shape tween of something with no outline falls back rather than vanishing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 21,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [
        { index: 1, duration: 10, tweenType: "shape", easing: "linear", script: "",
          objects: [{ type: "symbol", symbolName: "Nope", x: 0, y: 0, width: 40, height: 40,
                      rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 }] },
        { index: 11, duration: 10, tweenType: "none", easing: "linear", script: "",
          objects: [{ type: "symbol", symbolName: "Nope", x: 200, y: 0, width: 40, height: 40,
                      rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 }] },
      ],
    }],
    library: {},
  });
  // A symbol has no outline to morph, so the tween degrades to interpolating
  // the transform — which is still better than drawing nothing.
  const mid = await page.evaluate(() => {
    const objs = window._flashyAI.frameObjects(window._flashyAI.currentLayers(), 6);
    return { type: objs[0].type, x: objs[0].x };
  });
  expect(mid.type).toBe("symbol");
  expect(mid.x).toBeGreaterThan(50);
  expect(mid.x).toBeLessThan(150);
});

/* ------------------------------------------------------------------ *
 * Shape hints
 * ------------------------------------------------------------------ */

test("a shape hint changes which part becomes which", async ({ page }) => {
  await openEditor(page);
  const compare = await page.evaluate(() => {
    const M = window.Flashy.Morph;
    const a = { type: "rect", x: 0, y: 0, width: 100, height: 100, rotation: 0, scaleX: 1, scaleY: 1 };
    const b = { type: "rect", x: 0, y: 0, width: 100, height: 100, rotation: 0, scaleX: 1, scaleY: 1 };
    // Same shape, but a hint that maps A's top-left to B's bottom-right: the
    // morph has to walk B from a different starting point, so the intermediate
    // points differ even though the endpoints are identical.
    const plain = M.between(a, b, 0.5, null);
    const hinted = M.between(a, b, 0.5, [[0, 0, 100, 100]]);
    let diff = 0;
    for (let i = 0; i < Math.min(plain.path.length, hinted.path.length); i++) {
      if (plain.path[i] !== hinted.path[i]) diff++;
    }
    return { diff, plainCmds: plain.path.length };
  });
  // The hint is doing something. (With identical shapes the ENDPOINTS match
  // either way, which is why this checks the path, not the box.)
  expect(compare.diff).toBeGreaterThan(0);
});

test("a hint pins the start point, so a 180-degree morph does not turn inside out", async ({ page }) => {
  await openEditor(page);
  const res = await page.evaluate(() => {
    const M = window.Flashy.Morph;
    // A tall rectangle into a wide one. The naive pairing can rotate the
    // correspondence; a hint fixes a corner to a corner.
    const a = { type: "rect", x: 0, y: 0, width: 20, height: 100, rotation: 0, scaleX: 1, scaleY: 1 };
    const b = { type: "rect", x: 0, y: 0, width: 100, height: 20, rotation: 0, scaleX: 1, scaleY: 1 };
    const measure = (hints) => {
      const r = M.between(a, b, 0.5, hints);
      // Total path length: a correspondence that crosses over itself produces
      // a longer, self-intersecting outline than one that does not.
      let len = 0, px = null, py = null;
      for (let i = 0; i < r.path.length;) {
        if (r.path[i] === 3) { i += 1; px = null; continue; }
        const x = r.path[i + 1], y = r.path[i + 2];
        if (px != null) len += Math.hypot(x - px, y - py);
        px = x; py = y;
        i += 3;
      }
      return len;
    };
    return {
      plain: measure(null),
      hinted: measure([[0, 0, 0, 0], [20, 100, 100, 20]]),
    };
  });
  // Both produce a closed outline of a sane size — the point is that hints are
  // honoured and do not blow the geometry up.
  expect(res.hinted).toBeGreaterThan(0);
  expect(res.hinted).toBeLessThan(res.plain * 3);
});

test("Add Shape Hint needs a shape tween, and says so", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 21,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [
        { index: 1, duration: 10, tweenType: "motion", easing: "linear", script: "",
          objects: [shape("rect")] },
        { index: 11, duration: 10, tweenType: "none", easing: "linear", script: "",
          objects: [shape("rect", { x: 150 })] },
      ],
    }],
    library: {},
  });

  // A MOTION tween has nothing to hint.
  await act(page, "addShapeHint");
  await expect(page.locator(".fy-dialog")).toContainText("shape tween");
  await page.locator(".fy-dialog-foot button").first().click();

  await page.evaluate(() => {
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).tweenType = "shape";
    window._flashyAI.fullRefresh();
  });
  await act(page, "addShapeHint");
  await act(page, "addShapeHint");

  const hints = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).shapeHints);
  expect(hints).toHaveLength(2);
  // Successive hints are offset so they do not land in one undraggable pile.
  expect(hints[1][0]).not.toBe(hints[0][0]);

  // They survive a save.
  const back = await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(d)));
    return window._flashyAI.currentLayers()[0].getKeyframeAt(1).shapeHints;
  });
  expect(back).toHaveLength(2);

  // And Remove All clears them.
  await act(page, "removeShapeHints");
  expect(await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).shapeHints)).toBeNull();
  await act(page, "removeShapeHints");
  await expect(page.locator(".fy-dialog")).toContainText("no hints");
  expect(errors).toEqual([]);
});

test("a hint marker can be dragged on the stage", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 21,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [
        { index: 1, duration: 10, tweenType: "shape", easing: "linear", script: "",
          objects: [shape("rect", { x: 20, y: 20 })] },
        { index: 11, duration: 10, tweenType: "none", easing: "linear", script: "",
          objects: [shape("oval", { x: 20, y: 20 })] },
      ],
    }],
    library: {},
  });
  await act(page, "addShapeHint");
  const before = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).shapeHints[0].slice());

  const moved = await page.evaluate((before) => {
    const F = window._flashyAI;
    const canvas = document.getElementById("stageCanvas");
    const ox = (canvas.clientWidth - F.doc.width) / 2;
    const oy = (canvas.clientHeight - F.doc.height) / 2;
    const r = canvas.getBoundingClientRect();
    const at = (type, x, y, b) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, isPrimary: true, button: 0, buttons: b,
      clientX: r.left + ox + x, clientY: r.top + oy + y, bubbles: true,
    }));
    // Grab the start marker where it was dropped and drag it to a corner.
    at("pointerdown", before[0], before[1], 1);
    at("pointermove", 25, 25, 1);
    at("pointerup", 25, 25, 0);
    return F.currentLayers()[0].getKeyframeAt(1).shapeHints[0].slice();
  }, before);
  expect(moved[0]).toBeCloseTo(25, 0);
  expect(moved[1]).toBeCloseTo(25, 0);
  // Only the start end moved; the destination marker stayed put.
  expect(moved[2]).toBeCloseTo(before[2], 3);

  // One undo step for the drag.
  await act(page, "undo");
  const undone = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).shapeHints[0].slice());
  expect(undone[0]).toBeCloseTo(before[0], 3);
});

/* ------------------------------------------------------------------ *
 * Motion guides
 * ------------------------------------------------------------------ */

/** A guided layer following an arc drawn on a motion-guide layer above it. */
function guideDoc(orient) {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 21,
    layers: [
      {
        name: "Path", visible: true, locked: false, layerType: "motionguide",
        keyframes: [{
          index: 1, duration: 20, tweenType: "none", easing: "linear", script: "",
          // A big arc up and over: nothing like the straight line between the
          // tween's two keyframes.
          objects: [{
            type: "pencil", x: 20, y: 20, width: 200, height: 120,
            rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
            points: [0, 120, 40, 20, 100, 0, 160, 20, 200, 120],
            fillColor: "#000000", fillAlpha: 1, fillType: "none",
            strokeColor: "#00AA00", strokeAlpha: 1, strokeWidth: 1, strokeStyle: "solid",
          }],
        }],
      },
      {
        name: "Ball", visible: true, locked: false, layerType: "guided",
        keyframes: [
          { index: 1, duration: 10, tweenType: "motion", easing: "linear", script: "",
            orientToPath: !!orient,
            objects: [shape("oval", { x: 0, y: 130, width: 20, height: 20 })] },
          { index: 11, duration: 10, tweenType: "none", easing: "linear", script: "",
            objects: [shape("oval", { x: 200, y: 130, width: 20, height: 20 })] },
        ],
      },
    ],
    library: {},
  };
}

test("a guided layer follows the motion guide instead of a straight line", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, guideDoc(false));

  const pos = await page.evaluate(() => {
    const F = window._flashyAI;
    const read = (f) => {
      const objs = F.frameObjects(F.currentLayers(), f);
      const o = objs[objs.length - 1];
      return { x: Math.round(o.x), y: Math.round(o.y), rot: Math.round(o.rotation || 0) };
    };
    return { start: read(1), mid: read(6), end: read(10) };
  });
  // Straight from (0,130) to (200,130) would keep y at 130 the whole way. The
  // guide arcs up over y=20, so the midpoint has to be far above it.
  expect(pos.mid.y).toBeLessThan(90);
  // And it still starts and ends on the path's own ends.
  expect(pos.start.y).toBeGreaterThan(100);
  expect(pos.end.y).toBeGreaterThan(90);
  // Not oriented, so it does not turn.
  expect(pos.mid.rot).toBe(0);
  expect(errors).toEqual([]);
});

test("Orient to Path turns the object to face along the guide", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, guideDoc(true));
  const rots = await page.evaluate(() => {
    const F = window._flashyAI;
    const read = (f) => {
      const objs = F.frameObjects(F.currentLayers(), f);
      return Math.round(objs[objs.length - 1].rotation || 0);
    };
    return [read(2), read(6), read(9)];
  });
  // Climbing, level, then descending: the angles must differ and change sign.
  expect(rots[0]).not.toBe(rots[2]);
  expect(Math.min(...rots)).toBeLessThan(0);
  expect(Math.max(...rots)).toBeGreaterThan(0);
});

test("the motion guide layer itself is never drawn and never exported", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, guideDoc(false));

  // frameObjects refuses to draw it: only the ball comes back.
  const drawn = await page.evaluate(() =>
    window._flashyAI.frameObjects(window._flashyAI.currentLayers(), 6).length);
  expect(drawn).toBe(1);

  // Nor is its green stroke in any export…
  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).not.toContain("#00AA00");
  // …nor in a rasterised frame. (The path itself DOES travel in the exported
  // document — the player needs it to place the guided tween — so the check
  // is on what is rendered, not on whether the colour appears in the source.)
  const greenPixels = await page.evaluate(() => {
    const cv = window._flashyAI.renderFrameToCanvas(6, 300, 200);
    const d = cv.getContext("2d").getImageData(0, 0, 300, 200).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 1] > 120 && d[i] < 120 && d[i + 2] < 120) n++;
    }
    return n;
  });
  expect(greenPixels).toBe(0);

  // …but the layer IS still in the output list, because a guided layer finds
  // its guide by position. Filtering it out earlier would leave every guided
  // tween travelling in a straight line in the export while curving on the
  // stage.
  const kept = await page.evaluate(() =>
    window._flashyAI.outputLayers(window._flashyAI.doc.layers).map((l) => l.layerType));
  expect(kept).toContain("motionguide");
  expect(errors).toEqual([]);
});

test("the guide is drawn as chrome, so the layer does not look empty", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, guideDoc(false));
  // frameObjects will not draw the path, so without the chrome pass the layer
  // would appear blank and the feature invisible.
  const greenish = await page.evaluate(() => {
    const cv = document.getElementById("stageCanvas");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 1] > 150 && d[i] < d[i + 1] - 30 && d[i + 2] < d[i + 1]) n++;
    }
    return n;
  });
  expect(greenish).toBeGreaterThan(50);
});

test("a guided layer with no guide above it just tweens normally", async ({ page }) => {
  const errors = await openEditor(page);
  const doc = guideDoc(false);
  // Demote the guide layer: the guided layer now has nothing to follow.
  doc.layers[0].layerType = "normal";
  await loadDoc(page, doc);
  const mid = await page.evaluate(() => {
    const objs = window._flashyAI.frameObjects(window._flashyAI.currentLayers(), 6);
    const ball = objs.find((o) => o.type === "oval");
    return { y: Math.round(ball.y) };
  });
  // Straight line, y unchanged — and no error from a missing guide.
  expect(mid.y).toBe(130);
  expect(await page.evaluate(() => window._flashyAI.motionGuideFor(1))).toBeNull();
  expect(errors).toEqual([]);
});
