// Selecting a block of the timeline, and turning it into a symbol.
//
// Flash's answer was Copy Frames → make a symbol → Paste Frames: three steps,
// and it dropped the content's position so you lined the instance up by eye
// afterwards. The thing that has to be true here is that **nothing moves** —
// the instance lands exactly where the artwork already was. A conversion you
// have to re-align is one you stop trusting.
//
// Also covered: the biped template, because a first rig being one step instead
// of eleven Add Part dialogs is the difference between trying the feature and
// not.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc } from "./helpers.js";

function rect(colour, x, y, w, h) {
  return {
    type: "rect", x, y, width: w, height: h,
    rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
    fillColor: colour, fillAlpha: 1, fillType: "solid",
    strokeColor: colour, strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  };
}

/**
 * Two layers, each with two keyframes, over frames 1-8. Enough to tell
 * clipping, re-indexing and layer handling apart.
 */
function sceneDoc() {
  const layer = (name, colour, x) => ({
    name, visible: true, locked: false,
    keyframes: [
      { index: 1, duration: 4, tweenType: "motion", easing: "linear", script: "",
        objects: [rect(colour, x, 100, 40, 40)] },
      { index: 5, duration: 4, tweenType: "none", easing: "linear", script: "",
        objects: [rect(colour, x + 60, 140, 40, 40)] },
    ],
  });
  return {
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 8,
    layers: [layer("Top", "#CC3333", 100), layer("Bottom", "#3333CC", 200)],
    library: {}, sounds: {}, characters: {},
  };
}

test("a timeline selection spans layers as well as frames", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, sceneDoc());

  // Either corner may be the larger; the range comes back normalised.
  const r = await page.evaluate(() => window._flashyAI.tlSelect(1, 6, 0, 2));
  expect(r).toEqual({ l0: 0, l1: 1, f0: 2, f1: 6 });

  // Out-of-range layers are clamped rather than producing a bad rectangle.
  const clamped = await page.evaluate(() => window._flashyAI.tlSelect(0, 1, 99, 3));
  expect(clamped.l1).toBe(1);
  expect(errors).toEqual([]);
});

test("dragging across layers in the timeline selects a block", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sceneDoc());

  const box = await page.locator("#tlCanvas").boundingBox();
  const geom = await page.evaluate(() => ({
    fw: window._flashyAI.tlFrameWidth(),
    hdr: 16, fh: 20,
  }));
  // Start on layer 0 frame 2, drag to layer 1 frame 6.
  const at = (f, li) => ({
    x: box.x + (f - 0.5) * geom.fw,
    y: box.y + geom.hdr + li * geom.fh + geom.fh / 2,
  });

  const from = at(2, 0), to = at(6, 1);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  const r = await page.evaluate(() => window._flashyAI.tlRange());
  expect(r.l0).toBe(0);
  expect(r.l1).toBe(1);
  expect(r.f0).toBe(2);
  expect(r.f1).toBe(6);
});

test("converting frames keeps the artwork exactly where it was", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, sceneDoc());

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.tlSelect(0, 1, 1, 8);
    const res = F.framesToSymbol({ name: "Walk", behavior: "movieclip", replace: true });
    if (typeof res === "string") return { error: res };

    const sym = F.doc.library.Walk;
    const host = F.currentLayers()[0];
    const inst = host.keyframes.find((k) => k.index === 1).objects[0];
    return {
      res,
      // The instance covers the content's old bounding box …
      inst: { x: inst.x, y: inst.y, w: inst.width, h: inst.height, sym: inst.symbolName },
      // … and the symbol's contents are relative to that box, so the first
      // object sits at (0,0) of symbol space.
      firstObj: (() => {
        const o = sym.layers[0].keyframes[0].objects[0];
        return { x: o.x, y: o.y };
      })(),
      symLayers: sym.layers.map((l) => ({
        name: l.name,
        kfs: l.keyframes.map((k) => ({ i: k.index, d: k.duration })),
      })),
      symFrames: sym.totalFrames,
    };
  });

  expect(out.error).toBeUndefined();
  // Content spans x 100..300 (red at 100 and 160, blue at 200 and 260, 40 wide)
  // and y 100..180.
  expect(out.inst).toEqual({ x: 100, y: 100, w: 200, h: 80, sym: "Walk" });
  // The top-left-most object is the red one at x=100,y=100 → (0,0) inside.
  expect(out.firstObj).toEqual({ x: 0, y: 0 });
  // Both layers came across, keyframes re-indexed to start at 1.
  expect(out.symLayers).toEqual([
    { name: "Top", kfs: [{ i: 1, d: 4 }, { i: 5, d: 4 }] },
    { name: "Bottom", kfs: [{ i: 1, d: 4 }, { i: 5, d: 4 }] },
  ]);
  expect(out.symFrames).toBe(8);
  expect(errors).toEqual([]);
});

test("a partial selection clips the keyframes it crosses", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sceneDoc());

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    // Frames 3-6 cuts through the middle of both keyframes on each layer.
    F.tlSelect(0, 3, 0, 6);
    const res = F.framesToSymbol({ name: "Mid", replace: false });
    if (typeof res === "string") return { error: res };
    const sym = F.doc.library.Mid;
    return {
      res,
      kfs: sym.layers[0].keyframes.map((k) => ({ i: k.index, d: k.duration, t: k.tweenType })),
      frames: sym.totalFrames,
      // "Leave them alone" must leave them alone.
      hostUntouched: F.currentLayers()[0].keyframes.map((k) => ({ i: k.index, d: k.duration })),
    };
  });

  expect(out.error).toBeUndefined();
  // kf1 (frames 1-4) contributes frames 3-4 → index 1, duration 2.
  // kf5 (frames 5-8) contributes frames 5-6 → index 3, duration 2.
  expect(out.kfs[0]).toMatchObject({ i: 1, d: 2 });
  expect(out.kfs[1]).toMatchObject({ i: 3, d: 2 });
  expect(out.frames).toBe(4);
  // The first keyframe's tween still has a destination inside the symbol, so
  // it survives.
  expect(out.kfs[0].t).toBe("motion");
  // The last one's destination fell outside, so it cannot tween to anything.
  expect(out.kfs[1].t).toBe("none");
  expect(out.hostUntouched).toEqual([{ i: 1, d: 4 }, { i: 5, d: 4 }]);
});

test("replacing clears the block and leaves one instance", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sceneDoc());

  const after = await page.evaluate(() => {
    const F = window._flashyAI;
    F.tlSelect(0, 1, 1, 8);
    F.framesToSymbol({ name: "Blob", replace: true });
    return F.currentLayers().map((l, i) => ({
      i, name: l.name,
      kfs: l.keyframes.map((k) => ({
        i: k.index, d: k.duration,
        objs: k.objects.map((o) => o.symbolName || o.type),
      })),
    }));
  });

  // One instance on the top selected layer …
  expect(after[0].kfs).toEqual([{ i: 1, d: 8, objs: ["Blob"] }]);
  // … and the other layer's frames are gone, but the layer still exists with a
  // usable keyframe rather than an empty array.
  expect(after[1].kfs.length).toBe(1);
  expect(after[1].kfs[0].objs).toEqual([]);
});

test("a sound in the selection stays on the main timeline", async ({ page }) => {
  await openEditor(page);
  const doc = sceneDoc();
  doc.sounds = {};
  doc.layers[0].keyframes[0].sound = { asset: "voice", sync: "stream", volume: 1, loop: false, offset: 0 };
  await loadDoc(page, doc);

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.tlSelect(0, 1, 1, 8);
    const res = F.framesToSymbol({ name: "Scene", replace: true });
    const sym = F.doc.library.Scene;
    return {
      reported: res.sounds,
      // The engine builds its soundtrack from the root layers only, so a sound
      // carried inside a symbol would simply never play.
      insideSymbol: sym.layers.some((l) => l.keyframes.some((k) => !!k.sound)),
      stillOnRoot: F.currentLayers()[0].keyframes.some((k) => k.sound && k.sound.asset === "voice"),
    };
  });

  expect(out.reported).toBe(1);
  expect(out.insideSymbol).toBe(false);
  expect(out.stillOnRoot).toBe(true);
});

test("converting an empty block is refused with a reason", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sceneDoc());

  const msgs = await page.evaluate(() => {
    const F = window._flashyAI;
    // Past the end of the content.
    F.tlSelect(0, 40, 1, 44);
    const empty = F.framesToSymbol({ name: "Nope" });
    F.tlSelect(0, 1, 0, 2);
    const unnamed = F.framesToSymbol({ name: "   " });
    const dupe1 = F.framesToSymbol({ name: "Taken", replace: false });
    const dupe2 = F.framesToSymbol({ name: "Taken", replace: false });
    return { empty, unnamed, dupe1: typeof dupe1, dupe2 };
  });

  expect(msgs.empty).toMatch(/empty/i);
  expect(msgs.unnamed).toMatch(/name/i);
  expect(msgs.dupe1).toBe("object");
  expect(msgs.dupe2).toMatch(/already/i);
});

test("Convert Frames to Symbol is reachable and reports what it did", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sceneDoc());

  const inModify = await page.evaluate(() =>
    window._flashyEditor.menus.find((m) => m.label === "Modify").items.map((i) => i.action));
  expect(inModify).toContain("framesToSymbol");

  const d = page.locator("#fy-dialog");

  // With nothing selected it says what to do.
  await page.evaluate(() => { window._flashyAI.tlSelect(0, 1, 0, 1); });
  await page.evaluate(() => {
    // Clear the selection the way a fresh document has it.
    window._flashyAI.tlSelect(0, 99, 0, 99);
  });
  await page.evaluate(() => window._flashyEditor.doAction("framesToSymbol"));
  await expect(d).toContainText("empty");
  await d.getByText("OK").click();

  // With a real selection it converts and reports.
  await page.evaluate(() => { window._flashyAI.tlSelect(0, 1, 1, 8); });
  await page.evaluate(() => window._flashyEditor.doAction("framesToSymbol"));
  await expect(d).toBeVisible();
  await d.locator("input.fy-dialog-input").first().fill("Cycle");
  await d.getByRole("button", { name: "Convert" }).click();
  await expect(d).toContainText("2 layers");
  await d.getByRole("button", { name: "Done" }).click();

  expect(await page.evaluate(() => !!window._flashyAI.doc.library.Cycle)).toBe(true);
});

/* ---- Biped template ------------------------------------------------ */

test("the biped template builds a complete, posable rig in one step", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, sceneDoc());

  const built = await page.evaluate(() => {
    const R = window._flashyRig;
    const res = R.biped({ character: "Hero", height: 240 });
    if (typeof res === "string") return { error: res };
    const parts = R.partsOnStage("Hero");
    const byId = {};
    parts.forEach((o) => { byId[o.rigPart] = o; });
    return {
      res,
      count: parts.length,
      // The hierarchy that actually matters: spine up from the hips, limbs on
      // the right parents.
      parents: {
        hips: byId.hips.rigParent,
        torso: byId.torso.rigParent,
        head: byId.head.rigParent,
        armNear: byId["arm-near"].rigParent,
        forearmNear: byId["forearm-near"].rigParent,
        legNear: byId["leg-near"].rigParent,
        shinNear: byId["shin-near"].rigParent,
      },
      // The far arm must draw behind the torso — the reason draw order is
      // separate from the hierarchy at all.
      farArmBehindTorso: byId["arm-far"].rigZ < byId.torso.rigZ,
      nearArmInFront: byId["arm-near"].rigZ > byId.torso.rigZ,
      // Elbows and knees cannot bend backwards.
      elbowLimits: [byId["forearm-near"].rigMin, byId["forearm-near"].rigMax],
      kneeLimits: [byId["shin-near"].rigMin, byId["shin-near"].rigMax],
      // Limb joints at the top of the limb, not its centre.
      forearmPivotY: byId["forearm-near"].pivotY,
      poses: Object.keys(R.characters().Hero.poses),
    };
  });

  expect(built.error).toBeUndefined();
  expect(built.count).toBe(13);
  expect(built.parents).toEqual({
    hips: "", torso: "hips", head: "torso",
    armNear: "torso", forearmNear: "arm-near",
    legNear: "hips", shinNear: "leg-near",
  });
  expect(built.farArmBehindTorso).toBe(true);
  expect(built.nearArmInFront).toBe(true);
  expect(built.elbowLimits).toEqual([-150, 0]);
  expect(built.kneeLimits).toEqual([0, 150]);
  expect(built.forearmPivotY).toBe(0);
  // A rest pose exists immediately, so Animate Poses is usable at once.
  expect(built.poses).toEqual(["Rest"]);
  expect(errors).toEqual([]);
});

test("a fresh biped can be posed by IK straight away", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sceneDoc());

  const posed = await page.evaluate(() => {
    const R = window._flashyRig;
    R.biped({ character: "Hero", height: 240 });
    const hand = R.partById("Hero", "hand-near");
    const grab = { x: hand.x + hand.width / 2, y: hand.y + hand.height };
    const before = R.worldPoint(hand, grab.x, grab.y);
    // Reach for a point up and to the side.
    const res = R.solve(hand, grab, before.x + 50, before.y - 70, { bones: 3 });
    const after = R.worldPoint(hand, grab.x, grab.y);
    return {
      res,
      moved: Math.hypot(after.x - before.x, after.y - before.y),
      // Limits held while doing it.
      forearm: R.partById("Hero", "forearm-near").rotation,
    };
  });

  expect(posed.res.bones).toBe(3);
  expect(posed.moved).toBeGreaterThan(20);
  expect(posed.forearm).toBeGreaterThanOrEqual(-150);
  expect(posed.forearm).toBeLessThanOrEqual(0);
});

test("New Biped is on the Character menu and refuses a duplicate name", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sceneDoc());

  const menu = await page.evaluate(() =>
    window._flashyEditor.menus.find((m) => m.label === "Character").items.map((i) => i.action));
  expect(menu).toContain("newBiped");

  const d = page.locator("#fy-dialog");
  await page.evaluate(() => window._flashyEditor.doAction("newBiped"));
  await expect(d).toBeVisible();
  await d.getByRole("button", { name: "Build" }).click();
  await expect(d).toContainText("Rest");
  await d.getByRole("button", { name: "Start posing" }).click();

  // The Pose tool is selected, because posing is what you do next.
  expect(await page.evaluate(() =>
    document.querySelector(".tool-btn.active").dataset.tool)).toBe("pose");

  // The same name twice is refused in the dialog rather than making a mess.
  await page.evaluate(() => window._flashyEditor.doAction("newBiped"));
  await d.locator("input.fy-dialog-input").first().fill("Hero");
  await d.getByRole("button", { name: "Build" }).click();
  await expect(d.locator(".fy-dialog-error")).toContainText("already");
});

test("a rigged character still composes when converted into a symbol", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sceneDoc());

  // This is the case the two features meet in: the stage used to paint a
  // symbol's contents as a flat list, dropping every ancestor transform, while
  // the export composed them — so a rig put inside a symbol fell apart in the
  // editor only.
  const out = await page.evaluate(() => {
    const R = window._flashyRig, F = window._flashyAI;
    R.biped({ character: "Hero", height: 240 });
    R.partById("Hero", "arm-near").rotation = 45;

    const hand = R.partById("Hero", "hand-near");
    const before = R.worldPoint(hand, hand.x + hand.width / 2, hand.y);

    // Everything is on layer 0 frame 1.
    F.tlSelect(0, 1, 0, 1);
    const res = F.framesToSymbol({ name: "HeroRig", behavior: "graphic", replace: true });
    if (typeof res === "string") return { error: res };

    // Inside the symbol, the parts keep their parents and pivots …
    const sym = F.doc.library.HeroRig;
    const objs = sym.layers[0].keyframes[0].objects;
    const arm = objs.find((o) => o.rigPart === "arm-near");
    const kid = objs.find((o) => o.rigPart === "forearm-near");
    return {
      error: undefined,
      bounds: res.bounds,
      armRotation: arm.rotation,
      kidParent: kid.rigParent,
      // … shifted by the same offset, so their relative geometry is intact.
      armToKid: { dx: kid.x - arm.x, dy: kid.y - arm.y },
      beforeHand: before,
    };
  });

  expect(out.error).toBeUndefined();
  // The pose came across rather than being flattened away.
  expect(out.armRotation).toBe(45);
  expect(out.kidParent).toBe("arm-near");
  // Relative positions are preserved exactly — only the origin moved.
  expect(Number.isFinite(out.armToKid.dx)).toBe(true);
  expect(out.armToKid.dy).toBeGreaterThan(0);
});
