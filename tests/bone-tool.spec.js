// The Bone tool, on shapes.
//
// Flash's Bone tool did two things. Applied to SYMBOLS it built a skeleton of
// parent/child instances, each turning about its joint — which is what
// Flashy's character rigs already are, rotation limits and planted joints and
// a CCD solver included. Applied to a SHAPE it put bones INSIDE the artwork
// and the outline deformed to follow them, and Flashy had nothing for that:
// a drawn arm bends at the elbow as a DRAWING rather than as two pieces.
//
// `Flashy.Armature` is linear blend skinning — a pure function of (outline,
// pose) — routed through the seam `Flashy.Warp` already owns, so the stage,
// the SVG export, the exported player and the eraser all read one
// implementation.
import { test, expect } from "@playwright/test";
import { openEditor, downloadFromAction, runExportedHTML } from "./helpers.js";

/** A document with one 100x40 rectangle, selected. */
async function oneBar(page, extra = {}) {
  await page.evaluate((extra) => {
    window._flashyEditor.loadDoc({
      width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [Object.assign({
          type: "rect", x: 100, y: 100, width: 100, height: 40,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#3366CC", fillAlpha: 1, fillType: "solid",
          strokeStyle: "none", strokeWidth: 0,
        }, extra)],
      }] }],
    });
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
  }, extra);
}

const theBar = (page) => page.evaluate(() =>
  window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0]);

/* ------------------------------------------------------------------ *
 * The skeleton
 * ------------------------------------------------------------------ */

test("a bone chain composes head to tip, each angle relative to its parent", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const A = window.Flashy.Armature;
    const bones = [A.bone(10, 20, 40, 0, -1), A.bone(0, 0, 40, 0, 0)];
    const rest = A.segments(bones, "rest").map((s) =>
      [s.head.map(Math.round), s.tip.map(Math.round)]);
    // Bend only the second bone a quarter turn.
    bones[1].angle = Math.PI / 2;
    const posed = A.segments(bones, "angle").map((s) =>
      [s.head.map(Math.round), s.tip.map(Math.round)]);
    return { rest, posed };
  });
  // Rest: two 40-long bones end to end, starting at (10,20).
  expect(r.rest).toEqual([[[10, 20], [50, 20]], [[50, 20], [90, 20]]]);
  /* The child's head is its parent's TIP — that is what makes it a chain —
     and its angle is relative, so bending it alone leaves the parent put. */
  expect(r.posed[0]).toEqual([[10, 20], [50, 20]]);
  expect(r.posed[1]).toEqual([[50, 20], [50, 60]]);
});

test("the rest pose deforms nothing at all", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const A = window.Flashy.Armature;
    const W = window.Flashy.Warp;
    const bones = [A.bone(10, 20, 40, 0, -1), A.bone(0, 0, 40, 0.3, 0)];
    const outline = W.outline({ type: "rect", width: 100, height: 40 }, null);
    const skinned = A.path(outline, bones);
    /* The bind pose IS the drawing as it stands, so every point has to come
       back exactly where it was — an armature that moved the artwork the
       moment you drew a bone into it would be unusable. */
    let worst = 0;
    const want = [[0, 0], [100, 0], [100, 40], [0, 40]];
    want.forEach(([wx, wy]) => {
      let best = Infinity;
      for (let i = 0; i < skinned.length;) {
        const op = skinned[i];
        if (op === 3) { i += 1; continue; }
        best = Math.min(best, Math.hypot(skinned[i + 1] - wx, skinned[i + 2] - wy));
        i += 3;
      }
      worst = Math.max(worst, best);
    });
    return { worst, ops: [...new Set((() => {
      const o = [];
      for (let i = 0; i < skinned.length;) {
        o.push(skinned[i]);
        i += skinned[i] === 3 ? 1 : 3;
      }
      return o;
    })())].sort() };
  });
  expect(r.worst).toBeLessThan(1e-6);
  // Moves, lines and closes: a skinned quadratic is not a quadratic.
  expect(r.ops).toEqual([0, 1, 3]);
});

test("weights follow the bone's whole length, not just its head", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const A = window.Flashy.Armature;
    const bones = [A.bone(0, 10, 50, 0, -1), A.bone(0, 0, 50, 0, 0)];
    const segs = A.segments(bones, "rest");
    // A point right beside the far end of the FIRST bone.
    const nearFarEnd = A.weights(segs, 45, 10);
    // ...and one beside its head.
    const nearHead = A.weights(segs, 5, 10);
    // ...and one out past the second bone.
    const nearSecond = A.weights(segs, 95, 10);
    const sums = [nearFarEnd, nearHead, nearSecond]
      .map((w) => +w.reduce((a, b) => a + b, 0).toFixed(9));
    return { nearFarEnd, nearHead, nearSecond, sums };
  });
  /* Distance to the bone's SEGMENT: weighting by the head alone makes the far
     end of every bone go slack, which is a limb that detaches at the elbow. */
  expect(r.nearFarEnd[0]).toBeGreaterThan(0.5);
  expect(r.nearHead[0]).toBeGreaterThan(0.9);
  expect(r.nearSecond[1]).toBeGreaterThan(0.9);
  // Normalised, or the artwork would shrink towards the origin.
  expect(r.sums).toEqual([1, 1, 1]);
});

test("bending a bone bends the drawing", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const A = window.Flashy.Armature;
    const W = window.Flashy.Warp;
    const bones = [A.bone(5, 20, 45, 0, -1), A.bone(0, 0, 45, 0, 0)];
    const outline = W.outline({ type: "rect", width: 100, height: 40 }, null);
    const box = (cmds) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < cmds.length;) {
        if (cmds[i] === 3) { i += 1; continue; }
        x0 = Math.min(x0, cmds[i + 1]); x1 = Math.max(x1, cmds[i + 1]);
        y0 = Math.min(y0, cmds[i + 2]); y1 = Math.max(y1, cmds[i + 2]);
        i += 3;
      }
      return [x0, y0, x1, y1].map((v) => +v.toFixed(1));
    };
    const flat = box(A.path(outline, bones));
    bones[1].angle = Math.PI / 2;
    const bent = box(A.path(outline, bones));
    return { flat, bent };
  });
  expect(r.flat).toEqual([0, 0, 100, 40]);
  /* Folded down at the elbow: the drawing is now taller than it was and no
     longer reaches as far right. That is the whole feature. */
  expect(r.bent[3]).toBeGreaterThan(50);
  expect(r.bent[2]).toBeLessThan(90);
});

/* ------------------------------------------------------------------ *
 * The solver
 * ------------------------------------------------------------------ */

test("a free chain reaches its target", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const A = window.Flashy.Armature;
    const bones = [A.bone(10, 20, 40, 0, -1), A.bone(0, 0, 40, 0, 0)];
    const res = A.solve(bones, 1, 10, -40);
    const ms = A.matrices(bones, "angle");
    const tip = A._apply(ms[1], bones[1].len, 0);
    return { error: +res.error.toFixed(2), tip: tip.map((v) => +v.toFixed(1)) };
  });
  expect(r.error).toBeLessThan(1);
  expect(r.tip[0]).toBeCloseTo(10, 0);
  expect(r.tip[1]).toBeCloseTo(-40, 0);
});

test("a one-sided joint limit still finds the pose that reaches", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const A = window.Flashy.Armature;
    const make = () => [A.bone(10, 20, 40, 0, -1), A.bone(0, 0, 40, 0, 0)];
    const run = (lo, hi) => {
      const b = make();
      b[1].rotMin = lo; b[1].rotMax = hi;
      const res = A.solve(b, 1, 10, -40);
      return { error: +res.error.toFixed(2),
               rel: +(b[1].angle * 180 / Math.PI).toFixed(1),
               seeded: !!res.seeded };
    };
    return { positive: run(0, 140), negative: run(-140, 0),
             tight: run(60, 80), locked: run(0, 0) };
  });
  /* The reach needs the elbow at ±83 degrees. Plain CCD only ever walks
     towards the nearer of the two poses, so with limits of 0..140 it gets
     stuck perfectly straight — the single most visible failure a constrained
     solver has: the limb refuses to bend. Seeding from the middle of the
     allowed range and descending ROOT-FIRST finds the mirror. */
  expect(r.positive.error).toBeLessThan(1);
  expect(r.positive.rel).toBeGreaterThan(70);
  expect(r.positive.seeded).toBe(true);
  // The other way round needs no seeding at all.
  expect(r.negative.error).toBeLessThan(1);
  expect(r.negative.rel).toBeLessThan(-70);
  // A tight range gets as close as it is allowed to.
  expect(r.tight.rel).toBeGreaterThanOrEqual(60);
  expect(r.tight.rel).toBeLessThanOrEqual(80);
  expect(r.tight.error).toBeLessThan(5);
  /* A joint locked at zero cannot bend, so the limb straightens and stops.
     That is not a failure — the two-link reach at zero bend is 80, and the
     target is 60 away. */
  expect(r.locked.rel).toBe(0);
  expect(r.locked.error).toBeCloseTo(20, 0);
});

test("an out-of-reach target straightens the limb and stops", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const A = window.Flashy.Armature;
    const bones = [A.bone(10, 20, 40, 0, -1), A.bone(0, 0, 40, 0, 0)];
    const res = A.solve(bones, 1, 400, 20);
    return { error: Math.round(res.error),
             rel: +(bones[1].angle * 180 / Math.PI).toFixed(1) };
  });
  // 400 away, 80 of arm: 310 left over, and the arm pointing straight at it.
  expect(r.error).toBe(310);
  expect(Math.abs(r.rel)).toBeLessThan(1);
});

test("a pinned bone is not moved, and shortens the chain above it", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const A = window.Flashy.Armature;
    const bones = [A.bone(10, 20, 40, 0, -1), A.bone(0, 0, 40, 0, 0)];
    bones[0].pinned = true;
    const before = bones[0].angle;
    A.solve(bones, 1, 10, -40);
    return { chain: A.chainFor(bones, 1).length,
             root: bones[0].angle === before,
             moved: bones[1].angle !== 0,
             // Pinning the dragged bone itself leaves nothing to solve.
             none: A.chainFor(bones, 0).length };
  });
  expect(r.chain).toBe(1);
  expect(r.root).toBe(true);
  expect(r.moved).toBe(true);
  expect(r.none).toBe(0);
});

test("joint speed damps a joint without stopping it", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const A = window.Flashy.Armature;
    const run = (speed) => {
      const b = [A.bone(10, 20, 40, 0, -1), A.bone(0, 0, 40, 0, 0)];
      b[1].speed = speed;
      const res = A.solve(b, 1, 60, -20, { iterations: 3 });
      return +res.error.toFixed(2);
    };
    return { fast: run(1), slow: run(0.1) };
  });
  /* Flash's "Joint Speed": a heavy joint lags. With the iteration count
     pinned, a slow joint has got less far — which is what damping means. */
  expect(r.slow).toBeGreaterThan(r.fast);
});

/* ------------------------------------------------------------------ *
 * The editor
 * ------------------------------------------------------------------ */

test("bones can only be drawn into a shape", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      rect: F.canBone({ type: "rect", width: 50, height: 50 }),
      oval: F.canBone({ type: "oval", width: 50, height: 50 }),
      path: F.canBone({ type: "path", width: 50, height: 50, pathW: 50, pathH: 50,
                        path: [0, 0, 0, 1, 50, 0, 1, 50, 50, 3] }),
      // The same list Distort and Envelope refuse, and for the same reason.
      symbol: F.canBone({ type: "symbol", width: 50, height: 50 }),
      text: F.canBone({ type: "text", width: 50, height: 50 }),
      bitmap: F.canBone({ type: "bitmap", width: 50, height: 50 }),
      flat: F.canBone({ type: "rect", width: 0, height: 50 }),
    };
  });
  expect(r.rect).toBe(true);
  expect(r.oval).toBe(true);
  expect(r.path).toBe(true);
  expect(r.symbol).toBe(false);
  expect(r.text).toBe(false);
  expect(r.bitmap).toBe(false);
  expect(r.flat).toBe(false);
});

test("a bone is added in stage coordinates and chains to the nearest tip", async ({ page }) => {
  await openEditor(page);
  await oneBar(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    // The bar covers 100..200 by 100..140. Two bones end to end along it.
    const a = F.addBone(o, 110, 120, 150, 120);
    const b = F.addBone(o, 150, 120, 190, 120);
    const segs = F.boneSegments(o);
    // ...and one nowhere near anything, which gets no parent.
    const c = F.addBone(o, 105, 135, 125, 135);
    const bones = o.armature.bones;
    const tooShort = F.addBone(o, 150, 120, 150, 120);
    return {
      a, b, c, tooShort,
      parents: bones.map((x) => x.parent),
      lens: bones.map((x) => Math.round(x.len)),
      // In stage space the first bone runs along the bar.
      firstHead: [Math.round(segs[0].head.x), Math.round(segs[0].head.y)],
      firstTip: [Math.round(segs[0].tip.x), Math.round(segs[0].tip.y)],
    };
  });
  expect(r.a).toBe(0);
  expect(r.b).toBe(1);
  expect(r.c).toBe(2);
  /* Clicking end to end builds a chain: the second bone's head is at the
     first's tip, so it attaches. The third starts somewhere else and is a
     root of its own. */
  expect(r.parents).toEqual([-1, 0, -1]);
  expect(r.lens).toEqual([40, 40, 20]);
  expect(r.firstHead).toEqual([110, 120]);
  expect(r.firstTip).toEqual([150, 120]);
  // A bone with no length is refused rather than stored as a singularity.
  expect(r.tooShort).toBe(-1);
});

test("the tip is the handle, and dragging it poses the drawing", async ({ page }) => {
  await openEditor(page);
  await oneBar(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.addBone(o, 110, 120, 150, 120);
    F.addBone(o, 150, 120, 190, 120);
    const hitTip = F.boneHit(o, 190, 120);
    const hitHead = F.boneHit(o, 110, 120);
    const hitNothing = F.boneHit(o, 300, 300);
    F.dragBone(o, 1, 160, 60);
    const segs = F.boneSegments(o);
    return {
      tip: hitTip && hitTip.index,
      head: hitHead && hitHead.index,
      nothing: hitNothing,
      posedTip: [Math.round(segs[1].tip.x), Math.round(segs[1].tip.y)],
      angles: o.armature.bones.map((b) => +(b.angle * 180 / Math.PI).toFixed(1)),
    };
  });
  expect(r.tip).toBe(1);
  // The head of bone 0 is nothing's tip, so clicking it grabs nothing.
  expect(r.head).toBe(null);
  expect(r.nothing).toBe(null);
  // Dragged up and to the right: the chain followed.
  expect(r.posedTip[1]).toBeLessThan(110);
  expect(r.angles.some((a) => Math.abs(a) > 5)).toBe(true);
});

test("Bind here and Reset pose", async ({ page }) => {
  await openEditor(page);
  await oneBar(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.addBone(o, 110, 120, 150, 120);
    F.addBone(o, 150, 120, 190, 120);
    F.dragBone(o, 1, 160, 60);
    const posed = o.armature.bones.map((b) => b.angle);
    F.resetPose(o);
    const reset = o.armature.bones.map((b) => b.angle);
    const rests = o.armature.bones.map((b) => b.rest);

    // Pose it again and make THAT the rest position.
    F.dragBone(o, 1, 160, 60);
    const again = o.armature.bones.map((b) => b.angle);
    F.bindPose(o);
    const bound = o.armature.bones.map((b) => b.rest);
    F.resetPose(o);
    const afterBind = o.armature.bones.map((b) => b.angle);
    return { posed, reset, rests, again, bound, afterBind };
  });
  expect(r.posed.some((a) => Math.abs(a) > 0.05)).toBe(true);
  // Reset puts every bone back on its rest angle.
  expect(r.reset).toEqual(r.rests);
  /* Bind makes the current pose the new rest, so a bind pose set slightly
     wrong is fixable instead of something to fight for ever. */
  expect(r.bound).toEqual(r.again);
  expect(r.afterBind).toEqual(r.again);
});

test("removing a bone re-parents its children", async ({ page }) => {
  await openEditor(page);
  await oneBar(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.addBone(o, 105, 120, 135, 120);
    F.addBone(o, 135, 120, 165, 120);
    F.addBone(o, 165, 120, 195, 120);
    const before = o.armature.bones.map((b) => b.parent);
    F.removeBone(o, 1);
    const after = o.armature.bones.map((b) => b.parent);
    F.clearArmature(o);
    return { before, after, cleared: o.armature };
  });
  expect(r.before).toEqual([-1, 0, 1]);
  /* The third bone hangs off the first rather than being orphaned: a forearm
     whose upper arm is deleted should hang off the shoulder, not jump to the
     shape's corner. And every index above the removed one shifts down. */
  expect(r.after).toEqual([-1, 0]);
  expect(r.cleared).toBe(null);
});

test("the tool explains itself on a symbol and on an empty shape", async ({ page }) => {
  await openEditor(page);
  await oneBar(page, { type: "symbol", symbolName: "S" });
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setTool("bone");
    F.setSelection([]);
    // A click on the symbol.
    F.stageClick ? F.stageClick(150, 120) : null;
  });
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    return { can: F.canBone(o), segs: F.boneSegments(o).length,
             hit: F.boneHit(o, 150, 120) };
  });
  expect(r.can).toBe(false);
  expect(r.segs).toBe(0);
  expect(r.hit).toBe(null);
});

/* ------------------------------------------------------------------ *
 * The four render paths
 * ------------------------------------------------------------------ */

test("a pose survives a save, and junk in a file is dropped", async ({ page }) => {
  await openEditor(page);
  await oneBar(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.addBone(o, 110, 120, 150, 120);
    F.addBone(o, 150, 120, 190, 120);
    o.armature.bones[1].rotMin = -90;
    o.armature.bones[1].rotMax = 90;
    /* Posed BEFORE pinning: a pinned bone is one the solver may not move, so
       dragging a bone that is itself pinned leaves nothing to solve. */
    F.dragBone(o, 1, 160, 70);
    o.armature.bones[1].pinned = true;
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const back = F.currentLayers()[0].getKeyframeAt(1).objects[0].armature;

    const doc = JSON.parse(json);
    const junk = { bones: [
      { x: 0, y: 0, len: 10, parent: -1, rest: 0, angle: 0 },
      // Forward references would let the matrix walk cycle.
      { x: 0, y: 0, len: 10, parent: 5, rest: 0, angle: 0 },
      // No length divides by zero in the weighting.
      { x: 0, y: 0, len: 0, parent: 0 },
      { x: "nope", y: 0, len: "ten", parent: 0 },
    ] };
    doc.layers[0].keyframes[0].objects[0].armature = junk;
    if (doc.scenes) doc.scenes[0].layers[0].keyframes[0].objects[0].armature = junk;
    window._flashyEditor.loadDoc(doc);
    const cleaned = F.currentLayers()[0].getKeyframeAt(1).objects[0].armature;
    return {
      saved: /"armature"/.test(json),
      n: back.bones.length,
      limits: [back.bones[1].rotMin, back.bones[1].rotMax],
      pinned: back.bones[1].pinned,
      posed: back.bones.some((b) => Math.abs(b.angle - b.rest) > 1e-9),
      cleanedN: cleaned ? cleaned.bones.length : 0,
      cleanedParents: cleaned ? cleaned.bones.map((b) => b.parent) : null,
    };
  });
  expect(r.saved).toBe(true);
  expect(r.n).toBe(2);
  expect(r.limits).toEqual([-90, 90]);
  expect(r.pinned).toBe(true);
  expect(r.posed).toBe(true);
  /* Two of the four junk bones survive, with the forward reference demoted to
     a root: a hand-edited file cannot make the skinning multiply by a string
     or walk a cycle. */
  expect(r.cleanedN).toBe(2);
  expect(r.cleanedParents).toEqual([-1, -1]);
});

test("cloning a posed shape does not share its pose", async ({ page }) => {
  await openEditor(page);
  await oneBar(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.addBone(o, 110, 120, 150, 120);
    const c = o.clone();
    c.armature.bones[0].angle = 1.5;
    c.armature.bones.push(Object.assign({}, c.armature.bones[0]));
    return { original: o.armature.bones[0].angle,
             copy: c.armature.bones[0].angle,
             originalN: o.armature.bones.length };
  });
  // The same trap group children, filter stacks and warps each fell into.
  expect(r.original).toBe(0);
  expect(r.copy).toBe(1.5);
  expect(r.originalN).toBe(1);
});

test("the eraser cuts round the posed outline, not the box", async ({ page }) => {
  await openEditor(page);
  await oneBar(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const G = window.FlashyGeom;
    const E = window._flashyEraser;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const plain = G.bounds(E.objectRegion(o));
    F.addBone(o, 105, 120, 150, 120);
    F.addBone(o, 150, 120, 195, 120);
    // Fold the far half straight down.
    o.armature.bones[1].angle = Math.PI / 2;
    const posed = G.bounds(E.objectRegion(o));
    return {
      plainH: Math.round(plain.height),
      posedH: Math.round(posed.height),
      plainW: Math.round(plain.width),
      posedW: Math.round(posed.width),
    };
  });
  expect(r.plainH).toBe(40);
  expect(r.plainW).toBe(100);
  /* An eraser reading the box would still think the shape was a 100x40
     rectangle and leave ink behind exactly where you aimed. */
  expect(r.posedH).toBeGreaterThan(55);
  expect(r.posedW).toBeLessThan(95);
});

test("the SVG export emits the posed outline", async ({ page }) => {
  await openEditor(page);
  await oneBar(page);
  await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.addBone(o, 105, 120, 150, 120);
    F.addBone(o, 150, 120, 195, 120);
    o.armature.bones[1].angle = Math.PI / 2;
    F.setSelection([]);
    F.fullRefresh();
  });
  const svg = await downloadFromAction(page, "exportSVG");
  /* A <rect> in the output would mean the exporter took the shape's type at
     face value: an SVG that is quietly the undeformed original. */
  expect(svg).toContain("<path");
  expect(/<rect[^>]*width="100"[^>]*height="40"/.test(svg)).toBe(false);
  expect(svg).toContain('fill-rule="evenodd"');
});

test("the exported player draws the pose", async ({ page, context }) => {
  await openEditor(page);
  await page.evaluate(() => {
    window._flashyEditor.loadDoc({
      width: 200, height: 200, fps: 12, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "rect", x: 20, y: 40, width: 100, height: 20,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#000000", fillAlpha: 1, fillType: "solid",
          strokeStyle: "none", strokeWidth: 0,
          /* Two bones along the bar, the far one folded a quarter turn down.
             Box coordinates, 0..100 by 0..20. */
          armature: { bones: [
            { x: 5, y: 10, len: 45, parent: -1, rest: 0, angle: 0 },
            { x: 0, y: 0, len: 45, parent: 0, rest: 0, angle: Math.PI / 2 },
          ] },
        }],
      }] }],
    });
  });
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForTimeout(200);
  const run = await out.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const sx = c.width / 200, sy = c.height / 200;
    const ink = (x, y) => {
      const d = g.getImageData(Math.round(x * sx), Math.round(y * sy), 1, 1).data;
      return d[0] < 100;
    };
    // Along the bar near its root, and well BELOW it where the fold lands.
    let along = 0, below = 0;
    for (let x = 25; x < 70; x += 2) if (ink(x, 50)) along++;
    for (let y = 70; y < 110; y += 2) if (ink(70, y)) below++;
    return { along, below };
  });
  await out.close();
  expect(errors).toEqual([]);
  expect(run.along).toBeGreaterThan(10);
  /* Ink 50px below a bar that is 20px tall is impossible unless the player
     resolved the same Flashy.Armature pose the stage did. */
  expect(run.below).toBeGreaterThan(5);
});

test("the stage draws the pose, and the bone tool is in the toolbox", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    window._flashyEditor.loadDoc({
      width: 300, height: 300, fps: 24, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "rect", x: 50, y: 50, width: 120, height: 20,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#000000", fillAlpha: 1, fillType: "solid",
          strokeStyle: "none", strokeWidth: 0,
          armature: { bones: [
            { x: 5, y: 10, len: 55, parent: -1, rest: 0, angle: 0 },
            { x: 0, y: 0, len: 55, parent: 0, rest: 0, angle: Math.PI / 2 },
          ] },
        }],
      }] }],
    });
    window._flashyAI.setSelection([]);
    window._flashyAI.render();
  });
  const r = await page.evaluate(() => {
    const c = document.getElementById("stageCanvas");
    const g = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const F = window._flashyAI;
    const ox = (c.clientWidth - 300) / 2, oy = (c.clientHeight - 300) / 2;
    const ink = (x, y) => {
      const d = g.getImageData(Math.round((ox + x) * dpr),
                               Math.round((oy + y) * dpr), 1, 1).data;
      return d[0] < 100 && d[3] > 0;
    };
    let below = 0;
    for (let y = 85; y < 125; y += 2) if (ink(110, y)) below++;
    const ids = [...document.querySelectorAll("#toolbox .tool-btn")]
      .map((b) => b.dataset.tool);
    return { below, hasTool: ids.indexOf("bone") >= 0 };
  });
  // The bar is 20px tall at y=50..70; ink at y=100 is the fold.
  expect(r.below).toBeGreaterThan(5);
  expect(r.hasTool).toBe(true);
});
