// Timeline Effects.
//
// Flash MX 2004's one-click animations, and the one feature in this audit that
// Adobe itself dropped. The reason usually given is that the generated frames
// were opaque: you could not open one and nudge it, only delete the effect and
// start over.
//
// So they are generated as ORDINARY keyframes here, with the spec kept on the
// first one — editable like any other frames, re-runnable with new settings,
// and removable back to the original object. That is the feature without the
// part that killed it.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc } from "./helpers.js";

const kf = (objects, over = {}) => ({
  index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
  objects, ...over,
});

const square = (over = {}) => ({
  type: "rect", x: 100, y: 100, width: 60, height: 60,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#CC3344", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

function docWith(objs) {
  return {
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf(objs)] }],
    library: {},
  };
}

/** Select the first object and apply an effect. */
const apply = (page, id, params = {}) =>
  page.evaluate(({ id, params }) => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    const r = F.applyTimelineEffect(id, params);
    F.fullRefresh();
    return { ok: r.ok, why: r.why || null, frames: r.frames || 0 };
  }, { id, params });

/** What the layer holds, frame by frame. */
const frames = (page) =>
  page.evaluate(() => {
    const F = window._flashyAI;
    const l = F.currentLayers()[0];
    return l.keyframes.map((k) => ({
      index: k.index,
      n: k.objects.length,
      alpha: k.objects[0] ? k.objects[0].alpha : null,
      w: k.objects[0] ? Math.round(k.objects[0].width) : null,
      x: k.objects[0] ? Math.round(k.objects[0].x) : null,
      blur: k.objects[0] && k.objects[0].filters
        ? Math.round(k.objects[0].filters[0].blurX) : null,
      effect: k.effect ? k.effect.id : null,
    }));
  });

/* ------------------------------------------------------------------ *
 * The catalogue
 * ------------------------------------------------------------------ */

test("every effect declares its parameters and generates frames", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));

  const all = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    return F.TIMELINE_EFFECTS.map((e) => ({
      id: e.id,
      label: e.label,
      describe: !!e.describe,
      params: Object.keys(e.params).length,
      // Every generator must produce at least one frame holding at least one
      // object from the defaults alone -- a dialog that needs tuning before it
      // does anything is not one-click.
      built: e.build(o, e.params).length,
      firstFrameObjects: e.build(o, e.params)[0].length,
    }));
  });

  expect(all.length).toBe(8);
  all.forEach((e) => {
    expect(e.describe).toBe(true);
    expect(e.params).toBeGreaterThan(0);
    expect(e.built).toBeGreaterThan(0);
    expect(e.firstFrameObjects).toBeGreaterThan(0);
  });
  expect(all.map((e) => e.id).sort()).toEqual([
    "blurIn", "copyToGrid", "duplicate", "dropShadow", "explode", "expand",
    "transform", "transition",
  ].sort());
});

/* ------------------------------------------------------------------ *
 * What the effects actually do
 * ------------------------------------------------------------------ */

test("Blur writes a span that fades and unblurs", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));

  const r = await apply(page, "blurIn", { frames: 6, amount: 20,
                                          direction: "in", ease: "linear" });
  expect(r).toMatchObject({ ok: true, frames: 6 });

  const f = await frames(page);
  expect(f).toHaveLength(6);
  // In: starts invisible and fully blurred, ends solid and sharp.
  expect(f[0].alpha).toBeCloseTo(0, 3);
  expect(f[0].blur).toBe(20);
  expect(f[5].alpha).toBeCloseTo(1, 3);
  expect(f[5].blur).toBe(0);
  // The spec rides on the first frame.
  expect(f[0].effect).toBe("blurIn");
  expect(f[1].effect).toBeNull();
});

test("Expand grows about the registration point, not the corner", async ({ page }) => {
  await openEditor(page);
  // Registration at the centre: growing should keep the centre still.
  await loadDoc(page, docWith([square()]));

  await apply(page, "expand", { frames: 4, from: 0.5, to: 1, ease: "linear" });
  const centres = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].keyframes.map((k) => {
      const o = k.objects[0];
      return Math.round(o.x + o.width / 2);
    }));
  // Every frame shares a centre: growing about the top-left would slide it.
  expect(new Set(centres).size).toBe(1);
  expect(centres[0]).toBe(130);
});

test("Explode sends pieces out and fades them", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));

  const r = await apply(page, "explode", { frames: 5, pieces: 6, spread: 100,
                                           spin: 90, ease: "linear" });
  expect(r.ok).toBe(true);

  const f = await frames(page);
  // Six pieces on every frame...
  expect(f.every((x) => x.n === 6)).toBe(true);
  // ...which start together and end apart.
  const spread = await page.evaluate(() => {
    const l = window._flashyAI.currentLayers()[0];
    const span = (k) => {
      const xs = k.objects.map((o) => o.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    return { first: span(l.keyframes[0]), last: span(l.keyframes[4]) };
  });
  expect(spread.last).toBeGreaterThan(spread.first + 50);
  expect(f[4].alpha).toBeLessThan(0.3);
});

test("Transform moves, scales, spins and fades to a target", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));

  await apply(page, "transform", { frames: 5, dx: 100, dy: 0, scale: 2,
                                   spin: 90, alpha: 0.2, ease: "linear" });
  const last = await page.evaluate(() => {
    const l = window._flashyAI.currentLayers()[0];
    const o = l.keyframes[4].objects[0];
    return { x: Math.round(o.x), w: Math.round(o.width),
             rot: Math.round(o.rotation), alpha: +o.alpha.toFixed(2) };
  });
  // 60 wide becomes 120; the centre moved 100, so x moved 100 minus the extra
  // 30 the growth takes from the left.
  expect(last.w).toBe(120);
  expect(last.x).toBe(170);
  expect(last.rot).toBe(90);
  expect(last.alpha).toBeCloseTo(0.2, 2);
});

test("Transition wipes from the chosen edge, and fades when asked", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));

  await apply(page, "transition", { frames: 4, mode: "wipe", edge: "right",
                                    ease: "linear" });
  const wipe = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].keyframes.map((k) => ({
      w: Math.round(k.objects[0].width),
      right: Math.round(k.objects[0].x + k.objects[0].width),
    })));
  // Grows from the right edge, so the right edge never moves.
  expect(wipe[0].w).toBeLessThan(wipe[3].w);
  expect(new Set(wipe.map((x) => x.right)).size).toBe(1);

  await loadDoc(page, docWith([square()]));
  await apply(page, "transition", { frames: 4, mode: "fade", ease: "linear" });
  const fade = await frames(page);
  expect(fade[0].alpha).toBeCloseTo(0, 3);
  expect(fade[3].alpha).toBeCloseTo(1, 3);
});

test("Drop Shadow adds a filter and keeps the ones already there", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square({
    filters: [{ type: "blur", enabled: true, blurX: 3, blurY: 3 }],
  })]));

  await apply(page, "dropShadow", { distance: 8, angle: 30, blur: 6, alpha: 0.6 });
  const types = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0]
      .filters.map((f) => f.type));
  expect(types).toEqual(["blur", "dropShadow"]);
});

test("Copy to Grid tiles the object", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));

  await apply(page, "copyToGrid", { rows: 2, cols: 3, gapX: 10, gapY: 10 });
  const grid = await page.evaluate(() => {
    const k = window._flashyAI.currentLayers()[0].getKeyframeAt(1);
    return { n: k.objects.length,
             xs: [...new Set(k.objects.map((o) => Math.round(o.x)))].sort((a, b) => a - b),
             ys: [...new Set(k.objects.map((o) => Math.round(o.y)))].sort((a, b) => a - b) };
  });
  expect(grid.n).toBe(6);
  // Three columns 70 apart, two rows 70 apart.
  expect(grid.xs).toEqual([100, 170, 240]);
  expect(grid.ys).toEqual([100, 170]);
});

test("Distributed Duplicate stamps a trail, or animates one copy", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));

  await apply(page, "duplicate", { frames: 4, dx: 25, dy: 0, scale: 1,
                                   spin: 0, alpha: 1, trail: true });
  const trail = await frames(page);
  // With a trail every copy so far stays on screen: a stamped path.
  expect(trail.map((f) => f.n)).toEqual([1, 2, 3, 4]);

  await loadDoc(page, docWith([square()]));
  await apply(page, "duplicate", { frames: 4, dx: 25, dy: 0, scale: 1,
                                   spin: 0, alpha: 1, trail: false });
  const motion = await frames(page);
  // Without one, each frame holds one copy: a motion.
  expect(motion.map((f) => f.n)).toEqual([1, 1, 1, 1]);
  expect(motion[3].x).toBe(175);
});

/* ------------------------------------------------------------------ *
 * The part Adobe got wrong
 * ------------------------------------------------------------------ */

test("the generated frames are ordinary keyframes and can be edited", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));
  await apply(page, "blurIn", { frames: 4, amount: 10, direction: "in",
                                ease: "linear" });

  const edited = await page.evaluate(() => {
    const F = window._flashyAI;
    const l = F.currentLayers()[0];
    const k = l.keyframes[2];
    // Nudge one generated frame, the way you would any other.
    k.objects[0].x = 300;
    k.tweenType = "motion";
    F.fullRefresh();
    return { x: l.keyframes[2].objects[0].x, tween: l.keyframes[2].tweenType };
  });
  /* Which was the whole complaint about Flash's version: the frames were
     opaque, so the only repair was to delete the effect and start again. */
  expect(edited).toEqual({ x: 300, tween: "motion" });
});

test("Remove Effect puts the original object back", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square({ x: 123, y: 45 })]));
  await apply(page, "explode", { frames: 6, pieces: 4, spread: 80, spin: 0,
                                 ease: "linear" });
  expect((await frames(page)).length).toBe(6);

  const back = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setCurFrame(1);
    const r = F.removeTimelineEffect();
    F.fullRefresh();
    const l = F.currentLayers()[0];
    const o = l.getKeyframeAt(1).objects[0];
    return { ok: r.ok, keyframes: l.keyframes.length, n: l.getKeyframeAt(1).objects.length,
             x: o.x, y: o.y, w: o.width, effect: !!l.getKeyframeAt(1).effect };
  });
  expect(back.ok).toBe(true);
  expect(back.keyframes).toBe(1);
  expect(back.n).toBe(1);
  // Exactly where it was, which is why the originals are kept on the spec.
  expect(back).toMatchObject({ x: 123, y: 45, w: 60, effect: false });
});

test("an effect can be re-run with different settings", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));
  await apply(page, "blurIn", { frames: 4, amount: 10, direction: "in",
                                ease: "linear" });

  const again = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setCurFrame(1);
    // Re-applying from the originals, which is what the dialog's Re-apply
    // does: starting from the generated state instead would compound.
    const original = F.effectHere().effect.original;
    F.removeTimelineEffect();
    F.setSelection(F.currentLayers()[0].getKeyframeAt(1).objects);
    const r = F.applyTimelineEffect("blurIn", { frames: 9, amount: 40,
                                                direction: "out", ease: "linear" });
    F.fullRefresh();
    const l = F.currentLayers()[0];
    return { ok: r.ok, frames: l.keyframes.length,
             hadOriginal: original.length,
             firstAlpha: l.keyframes[0].objects[0].alpha,
             params: l.keyframes[0].effect.params.amount };
  });
  expect(again.ok).toBe(true);
  expect(again.frames).toBe(9);
  expect(again.hadOriginal).toBe(1);
  // Out, this time: starts solid.
  expect(again.firstAlpha).toBeCloseTo(1, 3);
  expect(again.params).toBe(40);
});

test("the spec survives a save and reopen, so the effect stays re-editable", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));
  await apply(page, "expand", { frames: 5, from: 0.3, to: 1.5, ease: "out" });

  const back = await page.evaluate(() => {
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const F = window._flashyAI;
    F.setCurFrame(1);
    const here = F.effectHere();
    return here
      ? { id: here.effect.id, frames: here.effect.frames,
          from: here.effect.params.from, originals: here.effect.original.length }
      : null;
  });
  /* Without this the generated frames are exactly as opaque as Flash's were,
     which is the thing worth fixing about them. */
  expect(back).toEqual({ id: "expand", frames: 5, from: 0.3, originals: 1 });
});

test("an effect explains itself rather than failing silently", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([]);
    const nothing = F.applyTimelineEffect("blurIn", {});
    const unknown = F.applyTimelineEffect("notAnEffect", {});
    F.setCurFrame(1);
    const noEffect = F.removeTimelineEffect();
    return { nothing, unknown, noEffect };
  });
  expect(out.nothing.ok).toBe(false);
  expect(out.nothing.why).toContain("nothing is selected");
  expect(out.unknown.ok).toBe(false);
  expect(out.noEffect.ok).toBe(false);
  expect(out.noEffect.why).toContain("no effect");
});

test("an effect applies to a whole selection, not just the first object", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square(), square({ x: 250, fillColor: "#3366CC" })]));

  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection(F.currentLayers()[0].getKeyframeAt(1).objects.slice());
    const out = F.applyTimelineEffect("blurIn", { frames: 4, amount: 10,
                                                  direction: "in", ease: "linear" });
    F.fullRefresh();
    const l = F.currentLayers()[0];
    return { ok: out.ok, perFrame: l.keyframes.map((k) => k.objects.length) };
  });
  expect(r.ok).toBe(true);
  // Both animate: merged frame by frame rather than only the first one.
  expect(r.perFrame).toEqual([2, 2, 2, 2]);
});

test("an effect refuses a locked layer", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    F.currentLayers()[0].locked = true;
    return F.applyTimelineEffect("blurIn", {});
  });
  expect(r.ok).toBe(false);
  expect(r.why).toContain("locked");
});
