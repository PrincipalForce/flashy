// Free Transform: Distort and Envelope.
//
// Flash's Free Transform tool had four modifiers. Scale, rotate and skew are
// matrix transforms and Flashy has always had them; Distort (drag one corner
// of the box on its own) and Envelope (two tangent handles per corner, so each
// side bends) are not matrices and were absent entirely — the tool selected a
// shape and then did nothing at all.
//
// The geometry is Flashy.Warp, in the engine, because four render paths have
// to agree about it: the stage painter, the SVG export, the exported player
// and the eraser's region. Most of what is checked here is that they do.
import { test, expect } from "@playwright/test";
import { openEditor, downloadFromAction, runExportedHTML } from "./helpers.js";

/** A document with one rectangle, selected. */
async function oneRect(page, extra = {}) {
  await page.evaluate((extra) => {
    window._flashyEditor.loadDoc({
      width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [Object.assign({
          type: "rect", x: 100, y: 50, width: 100, height: 60,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#CC3344", fillAlpha: 1, fillType: "solid",
          strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0,
          strokeStyle: "none",
        }, extra)],
      }] }],
    });
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
  }, extra);
}

/* ------------------------------------------------------------------ *
 * The geometry
 * ------------------------------------------------------------------ */

test("a fresh distort is the object's own box, so nothing moves", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const W = window.Flashy.Warp;
    const w = W.distortFor(100, 60);
    return {
      points: w.points,
      // The unit square has to map back onto the box exactly.
      corners: [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => W.point(w, u, v)),
      middle: W.point(w, 0.5, 0.5),
    };
  });
  expect(r.points).toEqual([0, 0, 100, 0, 100, 60, 0, 60]);
  expect(r.corners).toEqual([[0, 0], [100, 0], [100, 60], [0, 60]]);
  expect(r.middle).toEqual([50, 30]);
});

test("a fresh envelope is also the identity", async ({ page }) => {
  await openEditor(page);
  /* The tangents start at the thirds of each straight side, which makes the
     cubic through them the straight line. An envelope that bowed the shape the
     moment you chose the mode would be unusable. */
  const r = await page.evaluate(() => {
    const W = window.Flashy.Warp;
    const w = W.envelopeFor(100, 60);
    const grid = [];
    for (let u = 0; u <= 1.001; u += 0.25) {
      for (let v = 0; v <= 1.001; v += 0.25) {
        const p = W.point(w, u, v);
        grid.push([+(p[0] - u * 100).toFixed(6), +(p[1] - v * 60).toFixed(6)]);
      }
    }
    return { n: w.points.length, maxErr: Math.max(...grid.flat().map(Math.abs)) };
  });
  expect(r.n).toBe(24);
  // The Coons patch of four straight edges IS the bilinear box.
  expect(r.maxErr).toBeLessThan(1e-6);
});

test("dragging a distort corner moves that corner and nothing else", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const W = window.Flashy.Warp;
    const w = W.distortFor(100, 60);
    w.points[2] = 160;              // top-right pulled out to the right
    return {
      tr: W.point(w, 1, 0),
      tl: W.point(w, 0, 0),
      br: W.point(w, 1, 1),
      // Halfway along the top edge: halfway between the two moved corners.
      topMid: W.point(w, 0.5, 0),
      // Halfway down the right edge: between the moved corner and the fixed one.
      rightMid: W.point(w, 1, 0.5),
    };
  });
  expect(r.tr).toEqual([160, 0]);
  expect(r.tl).toEqual([0, 0]);
  expect(r.br).toEqual([100, 60]);
  expect(r.topMid[0]).toBeCloseTo(80, 6);
  expect(r.rightMid[0]).toBeCloseTo(130, 6);
});

test("an envelope tangent bends the side it belongs to", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const W = window.Flashy.Warp;
    const w = W.envelopeFor(100, 60);
    /* Both top tangents pushed up, so the top edge bows upwards. The top
       edge's handles are points 4 and 5, which is indices 8,9 and 10,11 --
       the corners occupy 0..7. */
    w.points[9] = -40;
    w.points[11] = -40;
    return {
      topMid: W.point(w, 0.5, 0).map((v) => +v.toFixed(3)),
      bottomMid: W.point(w, 0.5, 1).map((v) => +v.toFixed(3)),
      // The interior follows the edge, fading out towards the far side.
      quarter: W.point(w, 0.5, 0.25)[1],
      threeQ: W.point(w, 0.5, 0.75)[1],
    };
  });
  // The cubic's midpoint with both handles at -40 sits at 3/4 of -40.
  expect(r.topMid[1]).toBeCloseTo(-30, 3);
  expect(r.topMid[0]).toBeCloseTo(50, 3);
  // The opposite edge is untouched.
  expect(r.bottomMid).toEqual([50, 60]);
  // And the interior is pulled less the further from the bent edge it is.
  expect(r.quarter).toBeLessThan(15);
  expect(r.threeQ).toBeGreaterThan(r.quarter);
});

test("a warped outline is flattened to moves and lines only", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const W = window.Flashy.Warp;
    const o = { type: "oval", width: 100, height: 60,
                warp: W.distortFor(100, 60) };
    o.warp.points[2] = 160;
    const cmds = W.outlineOf(o, window.Flashy.Primitives);
    const ops = new Set();
    for (let i = 0; i < cmds.length;) {
      const op = cmds[i]; ops.add(op);
      i += 1 + (op === 0 || op === 1 ? 2 : op === 2 ? 4 : 0);
    }
    return { ops: [...ops].sort(), n: cmds.length };
  });
  /* A warped quadratic is not a quadratic. Keeping the curve opcode would mean
     drawing a different shape from the one the handles describe, so curves are
     subdivided: 0 move, 1 line, 3 close, and never 2. */
  expect(r.ops).toEqual([0, 1, 3]);
  expect(r.n).toBeGreaterThan(20);
});

test("only shapes and drawings can be warped", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const W = window.Flashy.Warp;
    const of = (o) => W.outline(o, window.Flashy.Primitives) !== null;
    return {
      rect: of({ type: "rect", width: 50, height: 50 }),
      oval: of({ type: "oval", width: 50, height: 50 }),
      path: of({ type: "path", width: 50, height: 50, pathW: 50, pathH: 50,
                 path: [0, 0, 0, 1, 50, 0, 1, 50, 50, 3] }),
      // These have contents, not an outline — the same list Flash refused.
      symbol: of({ type: "symbol", width: 50, height: 50 }),
      text: of({ type: "text", width: 50, height: 50 }),
      group: of({ type: "group", width: 50, height: 50, children: [] }),
      bitmap: of({ type: "bitmap", width: 50, height: 50 }),
      pencil: of({ type: "pencil", width: 50, height: 50, points: [0, 0, 10, 10] }),
      // And a shape with no area has no outline either.
      flat: of({ type: "rect", width: 0, height: 50 }),
    };
  });
  expect(r.rect).toBe(true);
  expect(r.oval).toBe(true);
  expect(r.path).toBe(true);
  expect(r.symbol).toBe(false);
  expect(r.text).toBe(false);
  expect(r.group).toBe(false);
  expect(r.bitmap).toBe(false);
  expect(r.pencil).toBe(false);
  expect(r.flat).toBe(false);
});

/* ------------------------------------------------------------------ *
 * The tool
 * ------------------------------------------------------------------ */

test("arming a modifier fits the selection with its cage", async ({ page }) => {
  await openEditor(page);
  await oneRect(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setWarpMode("distort");
    const after = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    return { mode: F.warpMode(), kind: after.warp.kind,
             points: after.warp.points, handles: F.warpHandles(after).length };
  });
  expect(r.mode).toBe("distort");
  expect(r.kind).toBe("distort");
  expect(r.points).toEqual([0, 0, 100, 0, 100, 60, 0, 60]);
  expect(r.handles).toBe(4);
});

test("an envelope shows twelve handles, eight of them tethered", async ({ page }) => {
  await openEditor(page);
  await oneRect(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setWarpMode("envelope");
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const hs = F.warpHandles(o);
    return {
      n: hs.length,
      corners: hs.filter((h) => h.kind === "corner").length,
      tangents: hs.filter((h) => h.kind === "tangent").length,
      tethers: hs.filter((h) => h.tether >= 0).map((h) => h.tether),
      // In stage space: the object sits at 100,50 and is 100x60.
      first: [Math.round(hs[0].x), Math.round(hs[0].y)],
      third: [Math.round(hs[2].x), Math.round(hs[2].y)],
    };
  });
  expect(r.n).toBe(12);
  expect(r.corners).toBe(4);
  expect(r.tangents).toBe(8);
  // Each side's two tangents hang off the two corners either end of it.
  expect(r.tethers).toEqual([0, 1, 1, 2, 2, 3, 3, 0]);
  expect(r.first).toEqual([100, 50]);
  expect(r.third).toEqual([200, 110]);
});

test("a distort promoted to an envelope keeps its shape", async ({ page }) => {
  await openEditor(page);
  await oneRect(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const W = window.Flashy.Warp;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.setWarpMode("distort");
    o.warp.points[2] = 170;                  // pull the top-right corner out
    const before = [[0.5, 0], [0.5, 0.5], [1, 0.5]].map((uv) => W.point(o.warp, uv[0], uv[1]));
    F.setWarpMode("envelope");
    const after = [[0.5, 0], [0.5, 0.5], [1, 0.5]].map((uv) => W.point(o.warp, uv[0], uv[1]));
    return { kind: o.warp.kind, n: o.warp.points.length, before, after };
  });
  /* The tangents are regrown at the thirds of the already-distorted sides, so
     the promotion is the identity until one is dragged. Regrowing them from
     the ORIGINAL box instead would snap a carefully distorted shape back. */
  expect(r.kind).toBe("envelope");
  expect(r.n).toBe(24);
  r.after.forEach((p, i) => {
    expect(p[0]).toBeCloseTo(r.before[i][0], 6);
    expect(p[1]).toBeCloseTo(r.before[i][1], 6);
  });
});

test("dragging a corner handle in stage space lands on the pointer", async ({ page }) => {
  await openEditor(page);
  // Rotated and scaled, which is the case a naive implementation gets wrong:
  // the drag has to come back through the object's own matrix.
  await oneRect(page, { rotation: 30, scaleX: 1.5, scaleY: 0.8 });
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setWarpMode("distort");
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.setWarpHandle(o, 1, 250, 40);           // the top-right corner, to 250,40
    const h = F.warpHandles(o)[1];
    return { x: h.x, y: h.y, local: o.warp.points.slice(2, 4) };
  });
  expect(r.x).toBeCloseTo(250, 3);
  expect(r.y).toBeCloseTo(40, 3);
  // And it did not move any of the other three.
  expect(r.local[0]).not.toBeCloseTo(100, 1);
});

test("moving an envelope corner carries its two tangents", async ({ page }) => {
  await openEditor(page);
  await oneRect(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.setWarpMode("envelope");
    const before = o.warp.points.slice();
    // Corner 0 (top-left) dragged 30 right and 20 down, in stage space.
    F.setWarpHandle(o, 0, 130, 70);
    const P = o.warp.points;
    // Corner 0 owns tangent 4 (first on the top) and tangent 11 (last on the left).
    return {
      corner: [P[0], P[1]],
      t4: [P[8] - before[8], P[9] - before[9]],
      t11: [P[22] - before[22], P[23] - before[23]],
      // The tangents belonging to other corners stay put.
      t5: [P[10] - before[10], P[11] - before[11]],
      t7: [P[14] - before[14], P[15] - before[15]],
    };
  });
  expect(r.corner[0]).toBeCloseTo(30, 6);
  expect(r.corner[1]).toBeCloseTo(20, 6);
  /* Flash moved a corner's tangents with it, and without this an envelope is
     unusable: adjusting any corner straightens the two curves beside it. */
  expect(r.t4[0]).toBeCloseTo(30, 6);
  expect(r.t4[1]).toBeCloseTo(20, 6);
  expect(r.t11[0]).toBeCloseTo(30, 6);
  expect(r.t11[1]).toBeCloseTo(20, 6);
  expect(r.t5).toEqual([0, 0]);
  expect(r.t7).toEqual([0, 0]);
});

test("Reset drops the warp and is undoable", async ({ page }) => {
  await openEditor(page);
  await oneRect(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setWarpMode("distort");
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.setWarpHandle(o, 1, 260, 20);
    const distorted = F.currentLayers()[0].getKeyframeAt(1).objects[0].warp.points[2];
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    const did = F.resetWarpSelection();
    const cleared = F.currentLayers()[0].getKeyframeAt(1).objects[0].warp;
    window._flashyEditor.doAction("undo");
    const restored = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const back = restored.warp;
    // Undo rebuilds the objects, so the selection has to be taken again --
    // it is holding the pre-undo instance, which is no longer in the frame.
    F.setSelection([restored]);
    const again = F.resetWarpSelection();
    return { distorted, did, cleared, back: back && back.kind, again };
  });
  expect(r.distorted).toBeGreaterThan(140);
  expect(r.did).toBe(true);
  expect(r.cleared).toBe(null);
  expect(r.back).toBe("distort");
  // Nothing warped left to reset once it is reset again.
  expect(r.again).toBe(true);
});

test("a symbol cannot be warped and says so", async ({ page }) => {
  await openEditor(page);
  await oneRect(page, { type: "symbol", symbolName: "S" });
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.setWarpMode("envelope");
    return { can: F.canWarp(o), warp: o.warp, handles: F.warpHandles(o).length };
  });
  expect(r.can).toBe(false);
  expect(r.warp).toBe(null);
  expect(r.handles).toBe(0);
});

/* ------------------------------------------------------------------ *
 * The four render paths
 * ------------------------------------------------------------------ */

test("a warp survives a save and open", async ({ page }) => {
  await openEditor(page);
  await oneRect(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setWarpMode("envelope");
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    o.warp.points[9] = -35;
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const back = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    return { saved: /"warp"/.test(json), kind: back.warp.kind,
             n: back.warp.points.length, y: back.warp.points[9] };
  });
  expect(r.saved).toBe(true);
  expect(r.kind).toBe("envelope");
  expect(r.n).toBe(24);
  expect(r.y).toBe(-35);
});

test("cloning a warped object does not share its handles", async ({ page }) => {
  await openEditor(page);
  await oneRect(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setWarpMode("distort");
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const c = o.clone();
    c.warp.points[2] = 999;
    return { original: o.warp.points[2], copy: c.warp.points[2] };
  });
  // The same bug class as a group's children and a filter stack.
  expect(r.original).toBe(100);
  expect(r.copy).toBe(999);
});

test("the SVG export emits the warped outline, not the box", async ({ page }) => {
  await openEditor(page);
  await oneRect(page);
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setWarpMode("distort");
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.setWarpHandle(o, 1, 280, 50);      // the top-right corner, well outside
    F.fullRefresh();
  });
  const svg = await downloadFromAction(page, "exportSVG");
  /* A <rect> in the output would mean the exporter took the shape's type at
     face value and dropped the warp — an SVG that is quietly the original. */
  expect(svg).toContain("<path");
  expect(/<rect[^>]*width="100"/.test(svg)).toBe(false);
  // 280 in stage space is 130 in the object's centre-origin space (hw = 50).
  expect(svg).toMatch(/13[01](\.\d+)?[, ]/);
  expect(svg).toContain('fill-rule="evenodd"');
});

test("the eraser's region follows the distortion", async ({ page }) => {
  await openEditor(page);
  await oneRect(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const G = window.FlashyGeom;
    const E = window._flashyEraser;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const plain = G.bounds(E.objectRegion(o));
    F.setWarpMode("distort");
    o.warp.points[2] = 200;            // top-right pulled 100px right
    const warped = E.objectRegion(o);
    const wb = G.bounds(warped);
    return {
      plainW: Math.round(plain.width),
      warpedW: Math.round(wb.width),
      /* The quadrilateral (0,0) (200,0) (100,60) (0,60) in the object's own
         box, which is 9000 square units by the shoelace rule. */
      area: Math.round(G.area(warped)),
    };
  });
  expect(r.plainW).toBe(100);
  /* The box is unchanged, so an eraser that read the box would still think the
     shape was 100 wide and leave the overhang untouched. */
  expect(r.warpedW).toBe(200);
  expect(r.area).toBeGreaterThan(8900);
  expect(r.area).toBeLessThan(9100);
});

test("the exported player draws the warp, not the box", async ({ page, context }) => {
  await openEditor(page);
  await oneRect(page);
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setWarpMode("distort");
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.setWarpHandle(o, 1, 320, 50);
    F.fullRefresh();
  });
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForTimeout(250);
  const ink = await out.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const sx = c.width / 400;                  // the canvas may be scaled
    let hits = 0;
    for (let y = 55; y < 105; y += 4) {
      const d = g.getImageData(Math.round(280 * sx), Math.round(y * sx), 1, 1).data;
      if (d[0] > 150 && d[1] < 120 && d[2] < 120) hits++;
    }
    return hits;
  });
  await out.close();
  expect(errors).toEqual([]);
  /* x=280 is 80px beyond the rectangle's right edge, so there can only be ink
     there if the player resolved the same Flashy.Warp outline the stage did. */
  expect(ink).toBeGreaterThan(0);
});

/* Is there red ink at this document coordinate? The stage canvas is the
   viewport, not the movie: the document is centred in it, which is the same
   mapping the eraser specs use to probe pixels. */
function redAt(page, dx, dy) {
  return page.evaluate(({ dx, dy }) => {
    const c = document.getElementById("stageCanvas");
    const g = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const F = window._flashyAI;
    const ox = (c.clientWidth - F.doc.width) / 2;
    const oy = (c.clientHeight - F.doc.height) / 2;
    const d = g.getImageData(Math.round((ox + dx) * dpr),
                             Math.round((oy + dy) * dpr), 1, 1).data;
    return d[0] > 150 && d[1] < 120 && d[2] < 120;
  }, { dx, dy });
}

test("the stage draws a warped shape outside its own box", async ({ page }) => {
  await openEditor(page);
  await oneRect(page);
  await page.evaluate(() => { window._flashyAI.setSelection([]); window._flashyAI.render(); });
  /* The end-to-end check: pixels. The rectangle covers 100..200 by 50..110, so
     ink at x=280 is impossible unless the painter read the warp. */
  /* y=60, not y=70: with the top-right corner at x=320 the warped right
     edge passes through exactly (280,70), and a probe on the boundary is a
     coin toss. */
  const before = await redAt(page, 280, 60);
  const inside = await redAt(page, 150, 80);
  await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.setSelection([o]);
    F.setWarpMode("distort");
    F.setWarpHandle(o, 1, 320, 50);
    F.setSelection([]);
    F.fullRefresh();
  });
  const after = await redAt(page, 280, 60);
  // The probe itself has to be working, or "before is false" proves nothing.
  expect(inside).toBe(true);
  expect(before).toBe(false);
  expect(after).toBe(true);
});
