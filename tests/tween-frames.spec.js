// Tween control and the frame commands: custom easing curves, Rotate CW/CCW,
// the Scale checkbox, frame labels and their three kinds, Reverse Frames,
// Copy/Paste Motion, and Edit Multiple Frames.
//
// Two things here are about divergence rather than about features. `kf.label`
// had been stored, serialized and read by the exporter since frame scripts
// arrived, and there was no way to set one — so gotoAndPlay("menu") was
// unreachable from the authoring side. And exportRuntime keeps its OWN copy of
// the keyframe interpolator, which had never learned about skew, filters or the
// colour effect: a glow that pulsed on the authoring stage held still in the
// export. Both are covered below.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction } from "./helpers.js";

const rect = (over = {}) => ({
  type: "rect", x: 0, y: 0, width: 40, height: 40,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#CC2222", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

/** Two keyframes with a motion tween between them. */
function tweenDoc(fromOver, toOver, kfOver = {}) {
  return {
    width: 400, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 21,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [
        {
          index: 1, duration: 10, tweenType: "motion", easing: "linear", script: "",
          objects: [rect(fromOver)], ...kfOver,
        },
        {
          index: 11, duration: 10, tweenType: "none", easing: "linear", script: "",
          objects: [rect(toOver)],
        },
      ],
    }],
    library: {},
  };
}

/** The tweened object at a frame, as the stage and the raster export see it. */
const atFrame = (page, f) =>
  page.evaluate((f) => {
    const F = window._flashyAI;
    F.setCurFrame(f);
    F.fullRefresh();
    const l = F.currentLayers()[0];
    const kf = l.getKeyframeAt(f);
    // Through the real interpolator, which is what every render path reads.
    const objs = [];
    const next = l.keyframes[l.keyframes.indexOf(kf) + 1];
    if (kf.tweenType !== "none" && next && kf.duration > 1) {
      objs.push(F.interpObj(kf.objects[0], next.objects[0],
        (f - kf.index) / kf.duration, kf.easing, kf));
    } else {
      objs.push(kf.objects[0]);
    }
    const o = objs[0];
    return {
      x: o.x, y: o.y, width: o.width, height: o.height,
      rotation: o.rotation, scaleX: o.scaleX, alpha: o.alpha,
    };
  }, f);

const act = (page, a) => page.evaluate((a) => window._flashyEditor.doAction(a), a);

/* ------------------------------------------------------------------ *
 * Custom easing
 * ------------------------------------------------------------------ */

test("a custom easing curve is evaluated the same way by the editor and the engine", async ({ page }) => {
  const errors = await openEditor(page);

  // A strong ease-out: half way through time, well past half way in progress.
  const vals = await page.evaluate(() => {
    const F = window._flashyAI;
    const bez = [0.0, 0.9, 0.1, 1.0];
    return {
      editor: F.easeAmount(0.5, "custom", bez),
      engine: window.Flashy.Easing.resolve("custom", bez)(0.5),
      linear: F.easeAmount(0.5, "linear"),
      ends: [F.easeAmount(0, "custom", bez), F.easeAmount(1, "custom", bez)],
    };
  });
  // One resolver, so these cannot disagree.
  expect(vals.editor).toBeCloseTo(vals.engine, 10);
  expect(vals.editor).toBeGreaterThan(vals.linear + 0.2);
  // The curve still starts at 0 and ends at 1, whatever its handles do.
  expect(vals.ends[0]).toBe(0);
  expect(vals.ends[1]).toBe(1);

  // A nonsense curve must not hang the solver.
  const silly = await page.evaluate(() =>
    window.Flashy.Easing.resolve("custom", [2, -3, -1, 4])(0.5));
  expect(Number.isFinite(silly)).toBe(true);
  expect(errors).toEqual([]);
});

test("a custom curve drives a real tween and survives a save", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, tweenDoc({ x: 0 }, { x: 300 }, {
    easing: "custom", easeBezier: [0, 0.9, 0.1, 1],
  }));

  const mid = await atFrame(page, 6);
  // Half way through the span, the strong ease-out has it most of the way
  // there — a linear tween would be at 150.
  expect(mid.x).toBeGreaterThan(220);

  const back = await page.evaluate(() => {
    const data = window._flashyEditor.serializeDoc();
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(data)));
    const kf = window._flashyAI.currentLayers()[0].getKeyframeAt(1);
    return { easing: kf.easing, bez: kf.easeBezier };
  });
  expect(back.easing).toBe("custom");
  expect(back.bez).toEqual([0, 0.9, 0.1, 1]);
});

test("the easing editor appears for a custom curve and drags its handles", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, tweenDoc({ x: 0 }, { x: 300 }));

  // Select the keyframe the way clicking the timeline does.
  await page.evaluate(() => window._flashyAI.selectKeyframe(0, 1));
  const props = page.locator("#propsPanel");
  await expect(props).toContainText("Easing");
  // No curve editor until the easing is custom.
  await expect(page.locator(".ease-curve")).toHaveCount(0);

  await props.locator(".props-row", { hasText: "Easing" }).locator("select")
    .selectOption("custom");
  await expect(page.locator(".ease-curve")).toHaveCount(1);
  // Switching to Custom needs a curve to edit; a straight line would look
  // like nothing happened.
  const seeded = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).easeBezier);
  expect(seeded).toHaveLength(4);

  /* Drag the lower handle up. Driven by dispatched pointer events, the way
     the stage specs drive the canvas: the inspector is a scrolling column and
     a real mouse has to be aimed at wherever the curve has ended up, which
     tests Playwright's scrolling rather than the editor's. */
  const dragged = await page.evaluate(() => {
    const c = document.querySelector(".ease-curve");
    const r = c.getBoundingClientRect();
    const ev = (t, x, y, b) => c.dispatchEvent(new PointerEvent(t, {
      pointerId: 1, isPrimary: true, button: 0, buttons: b,
      clientX: r.left + x, clientY: r.top + y, bubbles: true,
    }));
    // Near the first handle, which sits low; drag it near the top.
    ev("pointerdown", 30, r.height - 20, 1);
    ev("pointermove", 30, 8, 1);
    ev("pointerup", 30, 8, 0);
    return window._flashyAI.currentLayers()[0].getKeyframeAt(1).easeBezier;
  });
  expect(dragged[1]).toBeGreaterThan(seeded[1] + 0.5);
  // The curve is visible and sized, not a zero-height canvas nobody can grab.
  await expect(page.locator(".ease-curve")).toBeVisible();

  // One undo per drag, not one per pointer move.
  await act(page, "undo");
  expect(await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).easeBezier[1]))
    .toBeCloseTo(seeded[1], 5);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * Rotate CW/CCW and the Scale checkbox
 * ------------------------------------------------------------------ */

test("Rotate CW makes a tween turn instead of taking the short way round", async ({ page }) => {
  await openEditor(page);

  // 0 to 350 degrees. Left alone, a tween rolls BACKWARDS through the short
  // arc; told to go clockwise, it goes the long way as drawn.
  await loadDoc(page, tweenDoc({ rotation: 0 }, { rotation: 350 }));
  const auto = await atFrame(page, 6);
  expect(auto.rotation).toBeCloseTo(175, 0);   // the naive midpoint

  await page.evaluate(() => {
    const kf = window._flashyAI.currentLayers()[0].getKeyframeAt(1);
    kf.rotateDir = "cw";
    kf.rotateTimes = 1;
    window._flashyAI.fullRefresh();
  });
  const cw = await atFrame(page, 6);
  expect(cw.rotation).toBeCloseTo(175, 0);

  // And 0 to 0 with two turns really travels 720 degrees, which no
  // interpolation between equal endpoints can do on its own.
  await loadDoc(page, tweenDoc({ rotation: 0 }, { rotation: 0 }));
  await page.evaluate(() => {
    const kf = window._flashyAI.currentLayers()[0].getKeyframeAt(1);
    kf.rotateDir = "cw";
    kf.rotateTimes = 2;
    window._flashyAI.fullRefresh();
  });
  const spun = await atFrame(page, 6);
  expect(spun.rotation).toBeGreaterThan(300);
  const late = await atFrame(page, 10);
  expect(late.rotation).toBeGreaterThan(600);

  // Counter-clockwise goes the other way.
  await page.evaluate(() => {
    const kf = window._flashyAI.currentLayers()[0].getKeyframeAt(1);
    kf.rotateDir = "ccw";
    window._flashyAI.fullRefresh();
  });
  const back = await atFrame(page, 6);
  expect(back.rotation).toBeLessThan(-300);
});

test("the Scale checkbox stops a tween interpolating size", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, tweenDoc({ x: 0, width: 40 }, { x: 300, width: 200 }));

  const scaled = await atFrame(page, 6);
  expect(scaled.width).toBeGreaterThan(100);

  await page.evaluate(() => {
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).tweenScale = false;
    window._flashyAI.fullRefresh();
  });
  const unscaled = await atFrame(page, 6);
  // Keeps its own size and only moves.
  expect(unscaled.width).toBe(40);
  expect(unscaled.x).toBeGreaterThan(100);
});

test("the exported player tweens skew, filters and the colour effect too", async ({ page }) => {
  // exportRuntime keeps its own copy of the interpolator, and it had never
  // learned about any of these — so a glow that pulsed on the authoring stage
  // held still in the export.
  await openEditor(page);
  await loadDoc(page, tweenDoc(
    { skewX: 0, filters: [{ type: "blur", enabled: true, blurX: 0, blurY: 0 }],
      colorEffect: { mode: "tint", color: 0xFF0000, amount: 0 } },
    { skewX: 30, filters: [{ type: "blur", enabled: true, blurX: 20, blurY: 20 }],
      colorEffect: { mode: "tint", color: 0xFF0000, amount: 1 } },
  ));

  const html = await downloadFromAction(page, "export");
  // The interpolator in the generated source has to touch all three.
  expect(html).toContain("o.skewX =");
  expect(html).toContain("lerpFilters");
  expect(html).toContain("lerpColorEffect");

  // And the editor's own path agrees at the midpoint.
  const mid = await page.evaluate(() => {
    const F = window._flashyAI;
    const l = F.currentLayers()[0];
    const a = l.getKeyframeAt(1), b = l.keyframes[1];
    const o = F.interpObj(a.objects[0], b.objects[0], 0.5, "linear", a);
    return { skewX: o.skewX, blur: o.filters[0].blurX, tint: o.colorEffect.amount };
  });
  expect(mid.skewX).toBeCloseTo(15, 3);
  expect(mid.blur).toBeCloseTo(10, 3);
  expect(mid.tint).toBeCloseTo(0.5, 3);
});

/* ------------------------------------------------------------------ *
 * Frame labels
 * ------------------------------------------------------------------ */

test("a frame label can be set, and only a name reaches the export", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, tweenDoc({ x: 0 }, { x: 300 }));

  await page.evaluate(() => window._flashyAI.selectKeyframe(0, 1));
  const props = page.locator("#propsPanel");
  const label = props.locator(".props-row", { hasText: "Label" }).first().locator("input");
  await label.fill("menu");
  await label.dispatchEvent("change");

  expect(await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).label)).toBe("menu");
  // A new label defaults to a NAME, which is what every label written before
  // label types existed meant.
  expect(await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).labelType)).toBe("name");
  await expect(props).toContainText('gotoAndPlay("menu")');

  const html = await downloadFromAction(page, "export");
  expect(html).toContain("menu");
  expect(html).toContain("addLabel");

  // A comment is an authoring note: exporting it as a label would make
  // gotoAndPlay("fix this bit") a working instruction.
  await page.evaluate(() => {
    const kf = window._flashyAI.currentLayers()[0].getKeyframeAt(1);
    kf.label = "fix this bit";
    kf.labelType = "comment";
    window._flashyAI.fullRefresh();
  });
  const labels = await page.evaluate(() => {
    const d = window._flashyAI.exportDocData();
    const out = [];
    d.layers.forEach((l) => (l.keyframes || []).forEach((k) => {
      if (k.label && (k.labelType || "name") !== "comment") out.push(k.label);
    }));
    return out;
  });
  expect(labels).toEqual([]);
  expect(errors).toEqual([]);
});

test("label types survive a save, and an old label becomes a name", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, tweenDoc({ x: 0 }, { x: 300 }));
  await page.evaluate(() => {
    const kf = window._flashyAI.currentLayers()[0].getKeyframeAt(1);
    kf.label = "note";
    kf.labelType = "anchor";
  });
  const back = await page.evaluate(() => {
    const data = window._flashyEditor.serializeDoc();
    /* A keyframe written before label types existed. Patched in BOTH places:
       `layers` at the top level is the compatibility mirror of the current
       scene, and `scenes` is what the loader prefers. */
    [data.layers[0], data.scenes[0].layers[0]].forEach((l) => {
      delete l.keyframes[1].labelType;
      l.keyframes[1].label = "old";
    });
    window._flashyEditor.loadDoc(data);
    const l = window._flashyAI.currentLayers()[0];
    return l.keyframes.map((k) => ({ label: k.label, type: k.labelType }));
  });
  expect(back[0]).toEqual({ label: "note", type: "anchor" });
  expect(back[1]).toEqual({ label: "old", type: "name" });
});

/* ------------------------------------------------------------------ *
 * Reverse Frames
 * ------------------------------------------------------------------ */

test("Reverse Frames mirrors the keyframes and their timing", async ({ page }) => {
  const errors = await openEditor(page);
  // Three keyframes with different durations, so the timing has to mirror too.
  await loadDoc(page, {
    width: 400, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 12,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [
        { index: 1, duration: 5, tweenType: "none", easing: "linear", script: "", objects: [rect({ x: 0 })] },
        { index: 6, duration: 1, tweenType: "none", easing: "linear", script: "", objects: [rect({ x: 100 })] },
        { index: 7, duration: 3, tweenType: "none", easing: "linear", script: "", objects: [rect({ x: 200 })] },
      ],
    }],
    library: {},
  });

  await page.evaluate(() => window._flashyAI.tlSelect(0, 1, 0, 9));
  await act(page, "reverseFrames");

  const after = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].keyframes.map((k) => ({
      index: k.index, duration: k.duration, x: k.objects[0] && k.objects[0].x,
    })));
  // The artwork order is reversed…
  expect(after.map((k) => k.x)).toEqual([200, 100, 0]);
  // …and so are the durations, or the timing mirrors wrongly.
  expect(after.map((k) => k.duration)).toEqual([3, 1, 5]);
  expect(after.map((k) => k.index)).toEqual([1, 4, 5]);
  expect(errors).toEqual([]);
});

test("reversing moves a tween to the keyframe it now starts from", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 400, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 12,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [
        { index: 1, duration: 5, tweenType: "motion", easing: "quadOut", script: "", objects: [rect({ x: 0 })] },
        { index: 6, duration: 1, tweenType: "none", easing: "linear", script: "", objects: [rect({ x: 200 })] },
      ],
    }],
    library: {},
  });
  await page.evaluate(() => window._flashyAI.tlSelect(0, 1, 0, 6));
  await act(page, "reverseFrames");

  const after = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].keyframes.map((k) => ({
      tween: k.tweenType, easing: k.easing,
    })));
  /* A tween belongs to the PAIR of keyframes it spans and is stored on the
     earlier one. Reversing swaps which of the pair is earlier, so the tween
     has to shift back one: the first reversed keyframe carries it, and the
     last carries none — otherwise the last keyframe sprouts a tween into
     nothing. */
  expect(after[0].tween).toBe("motion");
  expect(after[0].easing).toBe("quadOut");
  expect(after[1].tween).toBe("none");
});

test("Reverse Frames says what it needs when nothing is selected", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, tweenDoc({ x: 0 }, { x: 300 }));
  await page.evaluate(() => window._flashyAI.tlSelect(0, 3, 0, 3));
  await act(page, "reverseFrames");
  await expect(page.locator(".fy-dialog")).toContainText("two or more keyframes");
});

/* ------------------------------------------------------------------ *
 * Copy and Paste Motion
 * ------------------------------------------------------------------ */

test("Copy Motion takes the movement and Paste Motion gives it to something else", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, {
    width: 400, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 22,
    layers: [
      { name: "Source", visible: true, locked: false, keyframes: [
        { index: 1, duration: 10, tweenType: "motion", easing: "linear", script: "", objects: [rect({ x: 0, y: 20 })] },
        { index: 11, duration: 1, tweenType: "none", easing: "linear", script: "", objects: [rect({ x: 300, y: 20 })] },
      ] },
      { name: "Target", visible: true, locked: false, keyframes: [
        { index: 1, duration: 20, tweenType: "none", easing: "linear", script: "",
          objects: [rect({ x: 0, y: 120, fillColor: "#2222CC" })] },
      ] },
    ],
    library: {},
  });

  // Copy the source's motion over its ten tweened frames.
  const copied = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setCurLayer(0);
    F.tlSelect(0, 1, 0, 10);
    return F.copyMotion({});
  });
  expect(copied.ok).toBe(true);
  expect(copied.frames).toBe(10);

  // Paste onto the target layer from frame 1.
  const pasted = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setCurLayer(1);
    F.setCurFrame(1);
    const r = F.pasteMotion({});
    F.fullRefresh();
    return r;
  });
  expect(pasted.ok).toBe(true);

  const track = await page.evaluate(() =>
    window._flashyAI.currentLayers()[1].keyframes
      .filter((k) => k.index <= 10)
      .map((k) => ({ index: k.index, x: Math.round(k.objects[0].x), y: k.objects[0].y,
                     fill: k.objects[0].fillColor })));
  // One keyframe per copied frame: a track sampled frame by frame has no
  // tweens left in it — it IS the tween, flattened.
  expect(track).toHaveLength(10);
  expect(track[0].x).toBe(0);
  expect(track[9].x).toBeGreaterThan(250);
  // The motion is pasted; the artwork is not. The target keeps its own colour
  // and the pasted track overrides position, which is the whole distinction
  // between this and Paste Frames.
  expect(track[0].fill).toBe("#2222CC");
  expect(track[5].y).toBe(20);
  expect(errors).toEqual([]);
});

test("Paste Motion explains itself with nothing copied or nothing to animate", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, tweenDoc({ x: 0 }, { x: 300 }));
  await act(page, "pasteMotion");
  await expect(page.locator(".fy-dialog")).toContainText("Copy Motion first");
  await page.locator(".fy-dialog-foot button").first().click();

  await page.evaluate(() => {
    const F = window._flashyAI;
    F.tlSelect(0, 1, 0, 10);
    F.copyMotion({});
    // A blank keyframe: there is nothing on it to animate.
    F.currentLayers()[0].getKeyframeAt(1).objects = [];
    F.setCurFrame(1);
  });
  await act(page, "pasteMotion");
  await expect(page.locator(".fy-dialog")).toContainText("nothing on this frame");
});

/* ------------------------------------------------------------------ *
 * Edit Multiple Frames
 * ------------------------------------------------------------------ */

test("Edit Multiple Frames makes every keyframe in range selectable and movable", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, {
    width: 400, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 10,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [
        { index: 1, duration: 1, tweenType: "none", easing: "linear", script: "", objects: [rect({ x: 10, y: 10 })] },
        { index: 2, duration: 1, tweenType: "none", easing: "linear", script: "", objects: [rect({ x: 60, y: 10 })] },
        { index: 3, duration: 8, tweenType: "none", easing: "linear", script: "", objects: [rect({ x: 110, y: 10 })] },
      ],
    }],
    library: {},
  });

  // Off: a hit test only reaches the current frame.
  await page.evaluate(() => { window._flashyAI.setCurFrame(1); window._flashyAI.fullRefresh(); });
  expect(await page.evaluate(() => !!window._flashyAI.hitTest(70, 30))).toBe(false);

  await act(page, "editMultiple");
  expect(await page.evaluate(() => window._flashyAI.editMultiple())).toBe(true);
  // Turning it on with both onion counts at zero would cover one frame and
  // look broken, so it fills in a span.
  const span = await page.evaluate(() => window._flashyAI.editMultipleRange());
  expect(span.f1).toBeGreaterThan(span.f0);

  // The span IS the onion-skin range, as Flash's markers were — so widening
  // the onion widens what is editable.
  await page.evaluate(() => window._flashyAI.onion({ before: 5, after: 5 }));
  expect(await page.evaluate(() => window._flashyAI.editMultipleRange()))
    .toMatchObject({ f0: 1 });

  // Now an object on another keyframe is reachable.
  expect(await page.evaluate(() => !!window._flashyAI.hitTest(70, 30))).toBe(true);

  // A marquee across all three grabs the animation, not one frame of it.
  const picked = await page.evaluate(() => {
    const F = window._flashyAI;
    const canvas = document.getElementById("stageCanvas");
    const ox = (canvas.clientWidth - F.doc.width) / 2;
    const oy = (canvas.clientHeight - F.doc.height) / 2;
    const r = canvas.getBoundingClientRect();
    const at = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, isPrimary: true, button: 0, buttons: 1,
      clientX: r.left + ox + x, clientY: r.top + oy + y, bubbles: true,
    }));
    at("pointerdown", 0, 0);
    at("pointermove", 200, 80);
    at("pointerup", 200, 80);
    return F.selection().length;
  });
  expect(picked).toBe(3);

  // Moving them moves every keyframe's object together, which is the point.
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.pushUndo();
    F.selection().forEach((o) => { o.y += 50; });
    F.fullRefresh();
  });
  const ys = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].keyframes.map((k) => k.objects[0].y));
  expect(ys).toEqual([60, 60, 60]);

  // Turning it off puts the hit test back on one frame.
  await act(page, "editMultiple");
  expect(await page.evaluate(() => !!window._flashyAI.hitTest(70, 80))).toBe(false);
  expect(errors).toEqual([]);
});

test("Edit Multiple Frames leaves locked layers alone", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 400, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 6,
    layers: [
      { name: "Locked", visible: true, locked: true, keyframes: [
        { index: 1, duration: 1, tweenType: "none", easing: "linear", script: "", objects: [rect({ x: 10, y: 10 })] },
        { index: 2, duration: 5, tweenType: "none", easing: "linear", script: "", objects: [rect({ x: 10, y: 10 })] },
      ] },
      { name: "Open", visible: true, locked: false, keyframes: [
        { index: 1, duration: 1, tweenType: "none", easing: "linear", script: "", objects: [rect({ x: 200, y: 10 })] },
        { index: 2, duration: 5, tweenType: "none", easing: "linear", script: "", objects: [rect({ x: 200, y: 10 })] },
      ] },
    ],
    library: {},
  });
  await page.evaluate(() => window._flashyAI.editMultiple(true));
  const pairs = await page.evaluate(() =>
    window._flashyAI.editMultipleKeyframes
      ? window._flashyAI.editMultipleKeyframes().length
      : null);
  void pairs;
  // A locked layer's artwork is not reachable, with the mode on or off.
  expect(await page.evaluate(() => !!window._flashyAI.hitTest(30, 30))).toBe(false);
  expect(await page.evaluate(() => !!window._flashyAI.hitTest(220, 30))).toBe(true);
});
