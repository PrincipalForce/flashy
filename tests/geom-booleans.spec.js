// The polygon booleans, and the coincident-edge bug.
//
// `FlashyGeom.union`, `intersection` and `difference` are under Combine
// Objects, the eraser, the paint bucket, the shaped brush and merge drawing.
// They were correct for shapes that overlap at an angle and WRONG whenever
// two shapes shared an edge exactly:
//
//     union(rect(50,50,100,100), rect(100,50,100,100))
//
// — two squares side by side overlapping by half, sharing their top and
// bottom edges — came back as the second square alone. Two rectangles drawn
// aligned is something people do constantly, so this is not an edge case in
// any useful sense.
//
// The cause was two deliberate simplifications meeting. `crossCut` skipped
// parallel edges, with a comment saying the midpoint classification would
// place them correctly; and the classifier tested each half-edge's MIDPOINT
// against the other region. For a shared edge that midpoint lies exactly on
// the other region's boundary, where the winding test is a coin toss — so one
// edge of the outline was dropped, the outline chained into two loops, and
// normalize() discarded one.
//
// These specs pin the behaviour at the level the callers depend on.
import { test, expect } from "@playwright/test";
import { openEditor } from "./helpers.js";

/** Run a boolean in the page and report area, bounds and loop count. */
const op = (page, kind, a, b) =>
  page.evaluate(({ kind, a, b }) => {
    const G = window.FlashyGeom;
    const r = G[kind](a, b);
    const bb = r.length ? G.bounds(r) : { width: 0, height: 0 };
    return { loops: r.length, area: Math.round(G.area(r)),
             width: +bb.width.toFixed(2), height: +bb.height.toFixed(2) };
  }, { kind, a, b });

/** A rectangle as a single clockwise loop, the shape objectRegion produces. */
const rect = (x, y, w, h) => [[x, y, x + w, y, x + w, y + h, x, y + h]];

/* ------------------------------------------------------------------ *
 * Shapes that share an edge
 * ------------------------------------------------------------------ */

test("two squares sharing top and bottom edges union into one", async ({ page }) => {
  await openEditor(page);
  // The reported case: 50..150 and 100..200, sharing y=50 and y=150.
  const r = await op(page, "union", rect(50, 50, 100, 100), rect(100, 50, 100, 100));
  expect(r.loops).toBe(1);
  expect(r.width).toBeCloseTo(150, 0);
  expect(r.height).toBeCloseTo(100, 0);
  expect(r.area).toBeGreaterThan(14900);
  expect(r.area).toBeLessThan(15100);
});

test("the same union works wherever the pair is placed", async ({ page }) => {
  await openEditor(page);
  // It used to depend on position, because a hash-based jitter decided the
  // coin toss differently at different coordinates.
  const places = [[0, 0], [0, 50], [50, 0], [50, 50], [10, 10],
                  [7, 123], [-40, -9], [250, 310]];
  for (const [x, y] of places) {
    const r = await op(page, "union", rect(x, y, 100, 100), rect(x + 50, y, 100, 100));
    expect(r.loops, `loops at ${x},${y}`).toBe(1);
    expect(r.width, `width at ${x},${y}`).toBeCloseTo(150, 0);
  }
});

test("intersecting two edge-sharing squares gives the overlap", async ({ page }) => {
  await openEditor(page);
  const r = await op(page, "intersection", rect(50, 50, 100, 100), rect(100, 50, 100, 100));
  expect(r.loops).toBe(1);
  expect(r.width).toBeCloseTo(50, 0);
  expect(r.height).toBeCloseTo(100, 0);
  expect(r.area).toBeGreaterThan(4900);
  expect(r.area).toBeLessThan(5100);
});

test("subtracting an edge-sharing square leaves the other half", async ({ page }) => {
  await openEditor(page);
  const r = await op(page, "difference", rect(50, 50, 100, 100), rect(100, 50, 100, 100));
  expect(r.loops).toBe(1);
  expect(r.width).toBeCloseTo(50, 0);
  expect(r.area).toBeGreaterThan(4900);
  expect(r.area).toBeLessThan(5100);
});

test("sharing one edge vertically works the same way", async ({ page }) => {
  await openEditor(page);
  // Stacked rather than side by side: the shared edges are left and right.
  const r = await op(page, "union", rect(50, 50, 100, 100), rect(50, 100, 100, 100));
  expect(r.loops).toBe(1);
  expect(r.height).toBeCloseTo(150, 0);
  expect(r.width).toBeCloseTo(100, 0);
});

test("two squares meeting along a single edge join into one", async ({ page }) => {
  await openEditor(page);
  /* Touching, not overlapping: the shared edge is the whole of one side.
     A union of these is one 200x100 rectangle. */
  const r = await op(page, "union", rect(0, 0, 100, 100), rect(100, 0, 100, 100));
  expect(r.loops).toBe(1);
  expect(r.width).toBeCloseTo(200, 0);
  expect(r.area).toBeGreaterThan(19800);
});

test("a shape flush against another's edge subtracts cleanly", async ({ page }) => {
  await openEditor(page);
  // The cutter's left edge sits exactly on the target's middle.
  const r = await op(page, "difference", rect(0, 0, 100, 100), rect(50, 0, 100, 100));
  expect(r.loops).toBe(1);
  expect(r.width).toBeCloseTo(50, 0);
  expect(r.area).toBeGreaterThan(4900);
  expect(r.area).toBeLessThan(5100);
});

test("a notch cut from one side, sharing that side exactly", async ({ page }) => {
  await openEditor(page);
  /* The cutter spans the full height and overhangs, so it shares the top and
     bottom edges AND crosses the right one -- three coincidences at once. */
  const r = await op(page, "difference", rect(0, 0, 100, 100), rect(60, 0, 80, 100));
  expect(r.loops).toBe(1);
  expect(r.width).toBeCloseTo(60, 0);
  expect(r.area).toBeGreaterThan(5900);
  expect(r.area).toBeLessThan(6100);
});

/* ------------------------------------------------------------------ *
 * The cases that already worked, which must not regress
 * ------------------------------------------------------------------ */

test("shapes overlapping at an offset are unchanged", async ({ page }) => {
  await openEditor(page);
  const u = await op(page, "union", rect(0, 0, 100, 100), rect(40, 40, 100, 100));
  expect(u.loops).toBe(1);
  expect(u.width).toBeCloseTo(140, 0);
  expect(u.area).toBeGreaterThan(16300);     // 20000 - 3600 overlap

  const d = await op(page, "difference", rect(0, 0, 100, 100), rect(40, 40, 100, 100));
  expect(d.area).toBeGreaterThan(6300);
  expect(d.area).toBeLessThan(6500);
});

test("disjoint shapes stay two loops", async ({ page }) => {
  await openEditor(page);
  const u = await op(page, "union", rect(0, 0, 10, 10), rect(100, 100, 10, 10));
  expect(u.loops).toBe(2);
  const i = await op(page, "intersection", rect(0, 0, 10, 10), rect(100, 100, 10, 10));
  expect(i.loops).toBe(0);
  const d = await op(page, "difference", rect(0, 0, 10, 10), rect(100, 100, 10, 10));
  expect(d.area).toBe(100);
});

test("a hole punched in the middle stays a hole", async ({ page }) => {
  await openEditor(page);
  const d = await op(page, "difference", rect(0, 0, 100, 100), rect(30, 30, 40, 40));
  // Two loops: the outside and the hole.
  expect(d.loops).toBe(2);
  expect(d.area).toBeGreaterThan(8300);
  expect(d.area).toBeLessThan(8500);
});

test("a shape wholly inside another behaves", async ({ page }) => {
  await openEditor(page);
  const u = await op(page, "union", rect(0, 0, 100, 100), rect(20, 20, 20, 20));
  expect(u.width).toBeCloseTo(100, 0);
  const i = await op(page, "intersection", rect(0, 0, 100, 100), rect(20, 20, 20, 20));
  expect(i.area).toBeGreaterThan(390);
  expect(i.area).toBeLessThan(410);
});

test("identical shapes union to one and subtract to nothing", async ({ page }) => {
  await openEditor(page);
  const u = await op(page, "union", rect(50, 50, 100, 100), rect(50, 50, 100, 100));
  expect(u.area).toBeGreaterThan(9900);
  expect(u.area).toBeLessThan(10100);
  const d = await op(page, "difference", rect(50, 50, 100, 100), rect(50, 50, 100, 100));
  expect(d.area).toBeLessThan(60);
});

test("a triangle crossing a square, which shares no edge at all", async ({ page }) => {
  await openEditor(page);
  const tri = [[0, 0, 100, 0, 50, 100]];
  const u = await op(page, "union", rect(0, 50, 100, 50), tri);
  expect(u.loops).toBe(1);
  expect(u.area).toBeGreaterThan(5000);
  const d = await op(page, "difference", rect(0, 50, 100, 50), tri);
  expect(d.loops).toBeGreaterThanOrEqual(1);
  expect(d.area).toBeGreaterThan(0);
});

test("an empty operand is handled by the rules, not by accident", async ({ page }) => {
  await openEditor(page);
  const a = rect(0, 0, 50, 50);
  const out = await page.evaluate((a) => {
    const G = window.FlashyGeom;
    return {
      unionEmptyB: Math.round(G.area(G.union(a, []))),
      unionEmptyA: Math.round(G.area(G.union([], a))),
      diffEmptyB: Math.round(G.area(G.difference(a, []))),
      diffEmptyA: Math.round(G.area(G.difference([], a))),
      interEmpty: G.intersection(a, []).length,
    };
  }, a);
  expect(out.unionEmptyB).toBe(2500);
  expect(out.unionEmptyA).toBe(2500);
  expect(out.diffEmptyB).toBe(2500);
  expect(out.diffEmptyA).toBe(0);
  expect(out.interEmpty).toBe(0);
});

/* ------------------------------------------------------------------ *
 * Through the features that use them
 * ------------------------------------------------------------------ */

test("Combine Union on two aligned rectangles spans both", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    window._flashyEditor.loadDoc({
      width: 400, height: 300, fps: 24, backgroundColor: "#FFF", totalFrames: 1,
      library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [0, 50].map((dx) => ({
          type: "rect", x: 50 + dx, y: 50, width: 100, height: 100,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#CC3344", fillAlpha: 1, fillType: "solid",
          strokeColor: "#000", strokeAlpha: 1, strokeWidth: 0,
          strokeStyle: "none",
        })),
      }] }],
    });
    F.setSelection(F.currentLayers()[0].getKeyframeAt(1).objects.slice());
    window._flashyEditor.doAction("combineUnion");
    const objs = F.currentLayers()[0].getKeyframeAt(1).objects;
    return { n: objs.length, w: Math.round(objs[0].width) };
  });
  /* The menu command people would reach for first on two aligned
     rectangles, and it was losing one of them. */
  expect(r.n).toBe(1);
  expect(r.w).toBe(150);
});
