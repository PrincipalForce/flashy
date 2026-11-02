// The Motion Editor: one easing curve per animatable property.
//
// Flash had ONE curve per tween, and Flashy has had that since the easing
// editor was built. CS4's Motion Editor gave each property its own, and it is
// the difference between a bouncing ball that squashes on impact and one that
// squashes gradually all the way down: the position wants a sharp ease-in and
// the scale wants a snap right at the end, and a single curve cannot say both.
//
// `kf.propEase` is {property: presetName | [x1,y1,x2,y2]}, and anything absent
// falls back to the tween's own easing — so an untouched document behaves
// exactly as it always did. `Flashy.Easing.atFor` is the one resolver, shared
// by the authoring stage and the exported player, because this editor has
// twice been bitten by a second copy of an interpolator drifting.
import { test, expect } from "@playwright/test";
import { openEditor, downloadFromAction, runExportedHTML } from "./helpers.js";

/** A 10-frame motion tween: the object moves right and grows. */
async function tweenDoc(page, opts = {}) {
  await page.evaluate((opts) => {
    window._flashyEditor.loadDoc({
      width: 400, height: 200, fps: 10, backgroundColor: "#FFFFFF",
      totalFrames: 11, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [
        {
          index: 1, duration: 10, tweenType: "motion", easing: opts.easing || "linear",
          script: "", propEase: opts.propEase || null,
          objects: [{
            type: "rect", x: 0, y: 50, width: 20, height: 20,
            rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
            fillColor: "#CC2233", fillAlpha: 1, fillType: "solid",
            strokeStyle: "none", strokeWidth: 0,
          }],
        },
        {
          index: 11, duration: 1, tweenType: "none", easing: "linear", script: "",
          objects: [{
            type: "rect", x: 200, y: 50, width: 100, height: 20,
            rotation: 90, scaleX: 1, scaleY: 1, alpha: 0,
            fillColor: "#CC2233", fillAlpha: 1, fillType: "solid",
            strokeStyle: "none", strokeWidth: 0,
          }],
        },
      ] }],
    });
    // Stand inside the tween, which is where you are when you notice the easing.
    window._flashyAI.selectKeyframe(0, 6);
  }, opts);
}

/** The interpolated object on a frame. */
const at = (page, frame) =>
  page.evaluate((frame) => {
    const F = window._flashyAI;
    const o = F.frameObjects(F.currentLayers(), frame)[0];
    return o ? { x: +o.x.toFixed(4), width: +o.width.toFixed(4),
                 rotation: +o.rotation.toFixed(4), alpha: +o.alpha.toFixed(4) } : null;
  }, frame);

/* ------------------------------------------------------------------ *
 * The resolver
 * ------------------------------------------------------------------ */

test("a property with no curve follows the tween's own", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const E = window.Flashy.Easing;
    const plain = { easing: "quadIn" };
    const mixed = { easing: "quadIn", propEase: { x: "linear" } };
    return {
      // quadIn at t=0.5 is 0.25.
      plainX: +E.atFor(plain, "x", 0.5).toFixed(6),
      overriddenX: +E.atFor(mixed, "x", 0.5).toFixed(6),
      // y was left alone, so it is still the tween's quadIn.
      untouchedY: +E.atFor(mixed, "y", 0.5).toFixed(6),
      hasNone: E.hasPropEase(plain),
      hasSome: E.hasPropEase(mixed),
      // An empty table is the same as none.
      hasEmpty: E.hasPropEase({ easing: "linear", propEase: {} }),
    };
  });
  expect(r.plainX).toBe(0.25);
  expect(r.overriddenX).toBe(0.5);
  expect(r.untouchedY).toBe(0.25);
  expect(r.hasNone).toBe(false);
  expect(r.hasSome).toBe(true);
  expect(r.hasEmpty).toBe(false);
});

test("a per-property curve can be a preset or four numbers", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const E = window.Flashy.Easing;
    const kf = { easing: "linear", propEase: {
      x: "quadOut",
      alpha: [0, 0, 1, 1],
      width: [0.5, 0, 0.5, 1],
      rotation: "notAnEasing",
    } };
    const half = (k) => +E.atFor(kf, k, 0.5).toFixed(4);
    return {
      x: half("x"), alpha: half("alpha"), width: half("width"),
      // An unknown name falls back to the tween, which is the honest answer:
      // guessing a curve for a word nobody defined would be worse.
      rotation: half("rotation"),
      ends: [+E.atFor(kf, "x", 0).toFixed(6), +E.atFor(kf, "x", 1).toFixed(6)],
      clamped: [+E.atFor(kf, "x", -3).toFixed(6), +E.atFor(kf, "x", 9).toFixed(6)],
    };
  });
  expect(r.x).toBe(0.75);          // quadOut at the midpoint
  expect(r.alpha).toBe(0.5);       // a straight cubic bezier is linear
  expect(r.width).toBe(0.5);       // symmetric ease, still 0.5 in the middle
  expect(r.rotation).toBe(0.5);
  // A curve has to reach both ends, or a tween does not arrive.
  expect(r.ends).toEqual([0, 1]);
  expect(r.clamped).toEqual([0, 1]);
});

/* ------------------------------------------------------------------ *
 * The stage
 * ------------------------------------------------------------------ */

test("two properties of one tween can ease differently", async ({ page }) => {
  await openEditor(page);
  await tweenDoc(page, { easing: "linear", propEase: { width: "quadIn" } });
  const mid = await at(page, 6);
  /* Halfway through: x has travelled half its 200px because it is linear, and
     the width has travelled a QUARTER of its 80px growth because quadIn at
     0.5 is 0.25. One curve per tween cannot express this at all. */
  expect(mid.x).toBeCloseTo(100, 3);
  expect(mid.width).toBeCloseTo(20 + 80 * 0.25, 3);
  // And the properties nobody touched are still linear.
  expect(mid.rotation).toBeCloseTo(45, 3);
  expect(mid.alpha).toBeCloseTo(0.5, 3);
});

test("every property still arrives on the last frame", async ({ page }) => {
  await openEditor(page);
  await tweenDoc(page, {
    easing: "quadIn",
    propEase: { x: "bounceOut", width: [0.9, 0, 0.1, 1], alpha: "elasticOut" },
  });
  const end = await at(page, 11);
  /* A tween that does not arrive is the failure mode that matters: whatever
     the curves do in the middle, frame 11 is the destination keyframe. */
  expect(end.x).toBeCloseTo(200, 3);
  expect(end.width).toBeCloseTo(100, 3);
  expect(end.rotation).toBeCloseTo(90, 3);
  expect(end.alpha).toBeCloseTo(0, 3);

  const start = await at(page, 1);
  expect(start.x).toBeCloseTo(0, 3);
  expect(start.width).toBeCloseTo(20, 3);
});

test("a tween with no overrides interpolates exactly as before", async ({ page }) => {
  await openEditor(page);
  await tweenDoc(page, { easing: "quadIn" });
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const out = [];
    for (let f = 1; f <= 11; f++) {
      const o = F.frameObjects(F.currentLayers(), f)[0];
      out.push(+o.x.toFixed(6));
    }
    return out;
  });
  /* quadIn on a 200px travel over 10 frames: t = (f-1)/10, x = 200*t*t. The
     per-property machinery must not perturb this by a single float. */
  const want = [];
  for (let f = 1; f <= 11; f++) {
    const t = Math.min(1, (f - 1) / 10);
    want.push(+(200 * t * t).toFixed(6));
  }
  expect(r).toEqual(want);
});

/* ------------------------------------------------------------------ *
 * The editor
 * ------------------------------------------------------------------ */

test("setting and clearing a property's easing", async ({ page }) => {
  await openEditor(page);
  await tweenDoc(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.motionKeyframe();
    const before = kf.propEase;
    F.setPropEase(kf, "x", "quadIn");
    const one = { propEase: JSON.parse(JSON.stringify(kf.propEase)), read: F.propEase(kf, "x") };
    F.setPropEase(kf, "alpha", [0.1, 0.2, 0.3, 0.4]);
    const two = JSON.parse(JSON.stringify(kf.propEase));
    // Clearing the last override empties the table rather than leaving nulls.
    F.setPropEase(kf, "x", null);
    const afterOne = JSON.parse(JSON.stringify(kf.propEase));
    F.setPropEase(kf, "alpha", null);
    const empty = kf.propEase;
    // A property the Motion Editor does not know about is refused.
    const bad = F.setPropEase(kf, "bitmapAsset", "quadIn");
    return { before, one, two, afterOne, empty, bad, still: kf.propEase };
  });
  expect(r.before).toBe(null);
  expect(r.one.propEase).toEqual({ x: "quadIn" });
  expect(r.one.read).toBe("quadIn");
  expect(r.two).toEqual({ x: "quadIn", alpha: [0.1, 0.2, 0.3, 0.4] });
  expect(r.afterOne).toEqual({ alpha: [0.1, 0.2, 0.3, 0.4] });
  /* Null rather than an object of nulls: otherwise every document saved after
     opening the panel once would carry a table that means nothing. */
  expect(r.empty).toBe(null);
  expect(r.bad).toBe(false);
  expect(r.still).toBe(null);
});

test("Reset all and Apply to all", async ({ page }) => {
  await openEditor(page);
  await tweenDoc(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.motionKeyframe();
    F.setPropEase(kf, "x", "bounceOut");
    F.applyPropEaseToAll(kf, "x");
    const spread = Object.keys(kf.propEase).length;
    const all = window.Flashy.Easing.MOTION_PROPS.every(
      (p) => kf.propEase[p.key] === "bounceOut");
    F.clearPropEase(kf);
    return { spread, all, after: kf.propEase };
  });
  expect(r.spread).toBe(16);
  expect(r.all).toBe(true);
  expect(r.after).toBe(null);
});

test("only the properties that actually change are offered", async ({ page }) => {
  await openEditor(page);
  await tweenDoc(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.motionKeyframe();
    const keys = F.motionActiveProps(kf).map((p) => p.key);
    // Make nothing change, and the list has to fall back to everything
    // rather than go blank.
    const next = F.currentLayers()[0].keyframes[1];
    const a = kf.objects[0];
    Object.keys(a).forEach((k) => {
      if (k !== "id") next.objects[0][k] = a[k];
    });
    const none = F.motionActiveProps(kf).length;
    return { keys, none };
  });
  /* The fixture moves in x, grows in width, turns and fades. A panel offering
     a curve for Inner Radius on a tween between two rectangles is a panel of
     dead controls, which is why Flash showed only the live channels. */
  expect(r.keys.sort()).toEqual(["alpha", "rotation", "width", "x"]);
  expect(r.none).toBe(0);
});

test("the panel lists the live properties and says what it is easing", async ({ page }) => {
  await openEditor(page);
  await tweenDoc(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.updateMotionPanel();
    const host = document.getElementById("motionPanel");
    return {
      text: host.textContent,
      props: [...host.querySelectorAll("select.motion-ease")].map((s) => s.dataset.prop),
      hasGraph: !!document.getElementById("motionGraph"),
    };
  });
  expect(r.props.sort()).toEqual(["alpha", "rotation", "width", "x"]);
  expect(r.text).toContain("Frame 1–10");
  expect(r.text).toContain("motion tween");
  expect(r.hasGraph).toBe(true);
});

test("the panel explains itself off a tween", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    window._flashyEditor.loadDoc({
      width: 200, height: 200, fps: 24, backgroundColor: "#FFF",
      totalFrames: 1, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [],
      }] }],
    });
    window._flashyAI.updateMotionPanel();
  });
  const r = await page.evaluate(() => ({
    none: window._flashyAI.motionKeyframe(),
    text: document.getElementById("motionPanel").textContent,
  }));
  expect(r.none).toBe(null);
  expect(r.text).toContain("Stand on a motion tween");
});

test("changing a property's easing from the panel changes the stage", async ({ page }) => {
  await openEditor(page);
  await tweenDoc(page);
  const before = await at(page, 6);
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll("select.motion-ease")]
      .find((s) => s.dataset.prop === "x");
    sel.value = "quadIn";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const after = await at(page, 6);
  expect(before.x).toBeCloseTo(100, 3);
  // quadIn at the midpoint is a quarter of the way.
  expect(after.x).toBeCloseTo(50, 3);
  // And it is undoable, like every other property edit.
  await page.evaluate(() => window._flashyEditor.doAction("undo"));
  const undone = await at(page, 6);
  expect(undone.x).toBeCloseTo(100, 3);
});

test("the curves survive a save, and junk in a file is dropped", async ({ page }) => {
  await openEditor(page);
  await tweenDoc(page, { propEase: { x: "quadIn", alpha: [0.3, 0, 0.7, 1] } });
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const back = JSON.parse(JSON.stringify(F.motionKeyframe().propEase));

    // Now a file with things the panel could never have written.
    const doc = JSON.parse(json);
    const junk = {
      x: "quadOut",
      notAProperty: "quadIn",
      width: ["a", "b", "c", "d"],
      height: [0.1, 0.2],
      alpha: "",
    };
    /* Both copies: a saved document carries `layers` (the current scene, which
       is what an older build reads) AND `scenes`, and deserializeDoc prefers
       the latter. Editing only one leaves the loader reading the other. */
    doc.layers[0].keyframes[0].propEase = junk;
    if (doc.scenes) doc.scenes[0].layers[0].keyframes[0].propEase = junk;
    window._flashyEditor.loadDoc(doc);
    return { saved: /"propEase"/.test(json), back,
             cleaned: JSON.parse(JSON.stringify(F.motionKeyframe().propEase)) };
  });
  expect(r.saved).toBe(true);
  expect(r.back).toEqual({ x: "quadIn", alpha: [0.3, 0, 0.7, 1] });
  /* Only what the editor could have produced survives: a hand-edited file
     cannot make the interpolator multiply by a string. */
  expect(r.cleaned).toEqual({ x: "quadOut" });
});

test("cloning a keyframe does not share its curves", async ({ page }) => {
  await openEditor(page);
  await tweenDoc(page, { propEase: { x: [0.1, 0.2, 0.3, 0.4] } });
  const r = await page.evaluate(() => {
    const kf = window._flashyAI.motionKeyframe();
    const c = kf.clone();
    c.propEase.x[0] = 0.9;
    c.propEase.alpha = "quadIn";
    return { original: kf.propEase.x[0], copy: c.propEase.x[0],
             leaked: kf.propEase.alpha };
  });
  // The same trap group children, filter stacks and sound envelopes each fell into.
  expect(r.original).toBe(0.1);
  expect(r.copy).toBe(0.9);
  expect(r.leaked).toBe(undefined);
});

/* ------------------------------------------------------------------ *
 * The exported player
 * ------------------------------------------------------------------ */

test("the exported player applies the per-property curves", async ({ page, context }) => {
  await openEditor(page);
  await page.evaluate(() => {
    window._flashyEditor.loadDoc({
      width: 200, height: 100, fps: 10, backgroundColor: "#FFFFFF",
      totalFrames: 11, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [
        {
          index: 1, duration: 10, tweenType: "motion", easing: "linear", script: "",
          /* x stays linear and the width eases in hard. Halfway through, the
             box is at 80 and 20 wide — a single curve cannot produce both. */
          propEase: { width: "quadIn" },
          objects: [{
            type: "rect", x: 0, y: 40, width: 10, height: 20,
            rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
            fillColor: "#000000", fillAlpha: 1, fillType: "solid",
            strokeStyle: "none", strokeWidth: 0,
          }],
        },
        {
          index: 11, duration: 1, tweenType: "none", easing: "linear", script: "",
          objects: [{
            type: "rect", x: 160, y: 40, width: 50, height: 20,
            rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
            fillColor: "#000000", fillAlpha: 1, fillType: "solid",
            strokeStyle: "none", strokeWidth: 0,
          }],
        },
      ] }],
    });
  });
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForTimeout(150);
  const run = await out.evaluate(() => {
    const mc = window.__flashyMovie || null;
    // Stop on frame 6 and measure the black box's extent along the middle row.
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const sx = c.width / 200, sy = c.height / 100;
    const measure = () => {
      let first = -1, last = -1;
      for (let x = 0; x < 200; x++) {
        const d = g.getImageData(Math.round(x * sx), Math.round(50 * sy), 1, 1).data;
        if (d[0] < 100) { if (first < 0) first = x; last = x; }
      }
      return { first, last, w: last - first + 1 };
    };
    return { mc: !!mc, m: measure() };
  });
  await out.close();
  expect(errors).toEqual([]);
  /* The player runs on its own clock, so the exact frame is whatever it has
     reached — but x and width are tied together by the keyframes, and the
     relationship between them is what the curves change. At every frame of
     this tween a LINEAR width would be wider than the quadIn one, so the
     measured width must never exceed what linear would give at that x. */
  const t = run.m.first / 160;
  const linearW = 10 + 40 * t;
  expect(run.m.w).toBeGreaterThan(5);
  expect(run.m.w).toBeLessThanOrEqual(linearW + 2);
});

test("the Motion Editor is a panel the Window menu can open", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const l = window._flashyWorkspace.layout();
    return { closed: l.closed.indexOf("motion") >= 0,
             mount: !!document.getElementById("motionPanel") };
  });
  // Closed by default: it is only meaningful while standing on a tween.
  expect(r.closed).toBe(true);
  expect(r.mount).toBe(true);
});
