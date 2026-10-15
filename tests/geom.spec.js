// flashy-geom.js — the polygon geometry the eraser is built on.
//
// Separate from eraser.spec.js on purpose. These are the properties the
// boolean has to hold for ANY input, stated as arithmetic rather than as
// pixels, so when an erase comes out wrong it is immediately clear whether the
// geometry or the editor is at fault.
//
// The module is pure — numbers in, numbers out, no DOM — so every check here
// is a plain page.evaluate with no canvas, no document and no tool involved.
import { test, expect } from "@playwright/test";
import { openEditor } from "./helpers.js";

/** Run a function against FlashyGeom in the page. */
function geom(page, fn, arg) {
  return page.evaluate(({ src, arg }) => {
    // eslint-disable-next-line no-new-func
    return new Function("G", "arg", "return (" + src + ")(G, arg)")(window.FlashyGeom, arg);
  }, { src: fn.toString(), arg: arg === undefined ? null : arg });
}

test.beforeEach(async ({ page }) => { await openEditor(page); });

test("orientation carries the meaning: outers clockwise, holes counter-clockwise", async ({ page }) => {
  const r = await geom(page, (G) => {
    const ring = G.normalize([G.rectLoop(0, 0, 100, 100), G.rectLoop(30, 30, 40, 40)]);
    // Normalising must fix input wound the wrong way round, because a `path`
    // object can have come from an older document or a hand-written fixture.
    const backwards = G.normalize([G.reverseLoop(G.rectLoop(0, 0, 10, 10))]);
    return {
      outer: G.signedArea2(ring[0]) > 0,
      hole: G.signedArea2(ring[1]) < 0,
      fixed: G.signedArea2(backwards[0]) > 0,
      area: G.area(ring),
      holeIsEmpty: !G.contains(ring, 50, 50),
      bodyIsSolid: G.contains(ring, 10, 50),
    };
  });
  expect(r).toMatchObject({ outer: true, hole: true, fixed: true, holeIsEmpty: true, bodyIsSolid: true });
  expect(r.area).toBeCloseTo(100 * 100 - 40 * 40, 1);
});

test("difference handles every containment case without a special case for any", async ({ page }) => {
  const r = await geom(page, (G) => {
    const R = (x, y, w, h) => G.normalize([G.rectLoop(x, y, w, h)]);
    const bite = G.difference(R(0, 0, 100, 100), R(-10, 40, 30, 20));
    const hole = G.difference(R(0, 0, 100, 100), R(40, 40, 20, 20));
    const covered = G.difference(R(10, 10, 20, 20), R(0, 0, 100, 100));
    const missed = G.difference(R(0, 0, 10, 10), R(50, 50, 10, 10));
    return {
      biteLoops: bite.length, biteArea: G.area(bite), biteGone: !G.contains(bite, 10, 50),
      // A clip strictly inside gives a hole, which falls out of the same code
      // path rather than being detected and handled.
      holeLoops: hole.length, holeArea: G.area(hole), holeEmpty: !G.contains(hole, 50, 50),
      coveredLoops: covered.length,
      missedArea: G.area(missed),
    };
  });
  expect(r.biteLoops).toBe(1);
  expect(r.biteArea).toBeCloseTo(10000 - 400, 0);
  expect(r.biteGone).toBe(true);
  expect(r.holeLoops).toBe(2);
  expect(r.holeArea).toBeCloseTo(10000 - 400, 0);
  expect(r.holeEmpty).toBe(true);
  expect(r.coveredLoops).toBe(0);
  expect(r.missedArea).toBe(100);
});

test("a cut clean through separates into independent regions", async ({ page }) => {
  const r = await geom(page, (G) => {
    const R = (x, y, w, h) => G.normalize([G.rectLoop(x, y, w, h)]);
    const d = G.difference(R(0, 0, 100, 40), R(45, -10, 10, 60));
    const parts = G.separate(d);
    return {
      parts: parts.length,
      area: G.area(d),
      // Each piece holds one side and not the other, which is what lets the
      // editor turn them into two objects you can move apart.
      split: G.contains(parts[0], 20, 20) !== G.contains(parts[1], 20, 20),
    };
  });
  expect(r.parts).toBe(2);
  expect(r.area).toBeCloseTo(100 * 40 - 10 * 40, 0);
  expect(r.split).toBe(true);
});

test("A equals (A minus B) plus (A intersect B)", async ({ page }) => {
  const r = await geom(page, (G) => {
    const subj = G.normalize([G.rectLoop(0, 0, 100, 100)]);
    const er = G.strokeRegion([50, -20, 50, 120], 10, false);
    return { diff: G.area(G.difference(subj, er)), inter: G.area(G.intersection(subj, er)) };
  });
  expect(r.diff + r.inter).toBeCloseTo(10000, 0);
});

test("a stroke's swept area is the brush, and a self-crossing one stays solid", async ({ page }) => {
  const r = await geom(page, (G) => {
    const straight = G.strokeRegion([0, 0, 100, 0], 10, false);
    /* A scribble is how people actually erase. Offsetting the polyline
       self-intersects here and a capsule union goes degenerate; the distance
       contour does neither. */
    const cross = G.strokeRegion([0, 0, 60, 60, 60, 0, 0, 60], 9, false);
    const fat = G.strokeRegion([0, 0, 60, 60, 60, 0, 0, 60], 16, false);
    const corner = G.strokeRegion([0, 0, 50, 0, 50, 50], 8, false);
    const sq = G.strokeRegion([0, 0, 40, 0], 10, true);
    return {
      loops: straight.length,
      area: G.area(straight),
      covers: G.contains(straight, 50, 9),
      stops: !G.contains(straight, 50, 11),
      cap: G.contains(straight, -9, 0) && !G.contains(straight, -11, 0),
      crossSolid: G.contains(cross, 30, 30),
      // The triangle this path encloses is wider than a 9px brush, so a hole
      // there is correct; a 16px brush fills it in.
      crossHoles: cross.filter((l) => G.signedArea2(l) < 0).length,
      fatHoles: fat.filter((l) => G.signedArea2(l) < 0).length,
      cornerJoined: corner.length === 1 && G.contains(corner, 49, 1),
      squareCorner: G.contains(sq, -9, -9) && !G.contains(sq, 20, 12),
    };
  });
  expect(r.loops).toBe(1);
  expect(r.area).toBeCloseTo(100 * 20 + Math.PI * 100, -1);
  expect(r).toMatchObject({
    covers: true, stops: true, cap: true, crossSolid: true,
    crossHoles: 1, fatHoles: 0, cornerJoined: true, squareCorner: true,
  });
});

test("cutting a polyline keeps the pieces outside the region", async ({ page }) => {
  const r = await geom(page, (G) => {
    const R = (x, y, w, h) => G.normalize([G.rectLoop(x, y, w, h)]);
    const split = G.cutPolyline([0, 0, 100, 0], R(40, -10, 20, 20));
    return {
      pieces: split.length,
      leftEnd: split[0][split[0].length - 2],
      rightStart: split[1][0],
      gone: G.cutPolyline([0, 0, 100, 0], R(-10, -10, 200, 20)).length,
      untouched: G.cutPolyline([0, 0, 100, 0], R(0, 50, 10, 10)).length,
      multiSeg: G.cutPolyline([0, 0, 50, 0, 50, 50], R(45, -5, 10, 30)).length,
    };
  });
  expect(r.pieces).toBe(2);
  expect(r.leftEnd).toBeCloseTo(40, 1);
  expect(r.rightStart).toBeCloseTo(60, 1);
  expect(r.gone).toBe(0);
  expect(r.untouched).toBe(1);
  expect(r.multiSeg).toBe(2);
});

test("untouched coordinates survive repeated subtraction exactly", async ({ page }) => {
  const r = await geom(page, (G) => {
    let shape = G.normalize([G.rectLoop(0, 0, 100, 100)]);
    for (let i = 0; i < 12; i++) {
      shape = G.difference(shape, G.strokeRegion([-5, 5 + i * 8, 8, 5 + i * 8], 4, false));
    }
    const b = G.bounds(shape);
    return { maxX: b.maxX, minY: b.minY, maxY: b.maxY, area: G.area(shape) };
  });
  /* Exactly, not approximately. This is the whole reason the eraser does real
     geometry instead of rasterising and re-tracing: the edges the brush never
     reached are untouched to the bit, twelve strokes later. */
  expect(r.maxX).toBe(100);
  expect(r.minY).toBe(0);
  expect(r.maxY).toBe(100);
  expect(r.area).toBeLessThan(10000);
});

test("subtraction never grows a shape, over hundreds of random strokes", async ({ page }) => {
  const r = await geom(page, (G) => {
    let seed = 42;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    let grew = 0, worst = 0, nonFinite = 0;
    for (let k = 0; k < 300; k++) {
      const subj = rnd() < 0.5
        ? G.normalize([G.rectLoop(0, 0, 100, 80)])
        : G.normalize([G.ellipseLoop(50, 40, 45, 35)]);
      const pts = [];
      const steps = 2 + Math.floor(rnd() * 5);
      for (let i = 0; i < steps; i++) pts.push(rnd() * 140 - 20, rnd() * 120 - 20);
      const d = G.difference(subj, G.strokeRegion(pts, 4 + rnd() * 20, rnd() < 0.3));
      const diff = G.area(d) - G.area(subj);
      if (diff > 0.5) { grew++; worst = Math.max(worst, diff); }
      for (const l of d) if (!isFinite(G.signedArea2(l))) nonFinite++;
    }
    return { grew, worst, nonFinite };
  });
  expect(r).toEqual({ grew: 0, worst: 0, nonFinite: 0 });
});

test("flattening a path keeps its curves inside their own hull", async ({ page }) => {
  const r = await geom(page, (G) => {
    // moveTo, a quadratic bulging up to y=-80, then back round.
    const curved = [0, 0, 0, 2, 50, -80, 100, 0, 1, 100, 100, 1, 0, 100, 3];
    const loops = G.pathToLoops(curved, 0.05);
    const b = G.loopBounds(loops[0]);
    const square = G.pathToLoops([0, 0, 0, 1, 40, 0, 1, 40, 60, 1, 0, 60, 3], 0.2);
    return {
      points: loops[0].length / 2,
      // A quadratic peaks at half the control point's offset, so -40, and it
      // must never overshoot its control point.
      minY: b.minY,
      squarePoints: square[0].length / 2,
      roundTrip: G.loopsToPath(square).length,
    };
  });
  expect(r.points).toBeGreaterThan(8);
  expect(r.minY).toBeLessThan(-30);
  expect(r.minY).toBeGreaterThan(-41);
  expect(r.squarePoints).toBe(4);
  // 4 lineTo-style commands of 3 numbers plus the closePath.
  expect(r.roundTrip).toBe(13);
});
