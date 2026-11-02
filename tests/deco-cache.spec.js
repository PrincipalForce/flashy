// The Deco tool, the Spray brush, and Cache as bitmap.
//
// The two generative tools Flash CS4 added, and the only ones in the box that
// MAKE artwork rather than edit it: Deco fills a region with a pattern, Spray
// scatters copies of a symbol along a drag. Both produce ordinary objects, as
// Flash's did — a live procedural fill that regenerated on every edit would
// mean never being able to fix one leaf.
//
// And Flash's "Use runtime bitmap caching", which was on every symbol
// instance's Property inspector and is not a micro-optimisation: a background
// drawn as a few thousand vector paths is the difference between a cartoon
// that plays at its frame rate and one that does not.
import { test, expect } from "@playwright/test";
import { openEditor, downloadFromAction, runExportedHTML } from "./helpers.js";

async function blank(page) {
  await page.evaluate(() => {
    window._flashyEditor.loadDoc({
      width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [],
      }] }],
    });
  });
}

const objects = (page) =>
  page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects.map((o) => ({
      type: o.type, symbolName: o.symbolName,
      x: +o.x.toFixed(3), y: +o.y.toFixed(3),
      w: +o.width.toFixed(3), rotation: +o.rotation.toFixed(3),
    })));

/* ------------------------------------------------------------------ *
 * Determinism
 * ------------------------------------------------------------------ */

test("the same seed gives the same artwork, a different one does not", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const reg = { x: 0, y: 0, w: 100, h: 100 };
    const key = (o) => o.map((v) => [v.x, v.y, v.width].join()).join("|");
    const a = key(F.decoObjects(reg, { pattern: "scatter", count: 20, seed: 7 }));
    const b = key(F.decoObjects(reg, { pattern: "scatter", count: 20, seed: 7 }));
    const c = key(F.decoObjects(reg, { pattern: "scatter", count: 20, seed: 8 }));
    // And the generator itself is the same sequence everywhere.
    const rnd = F.decoRandom(7);
    const first = [rnd(), rnd(), rnd()].map((v) => +v.toFixed(8));
    const again = F.decoRandom(7);
    const second = [again(), again(), again()].map((v) => +v.toFixed(8));
    return { same: a === b, different: a !== c, first, second,
             inRange: first.every((v) => v >= 0 && v < 1) };
  });
  /* Flash reseeded from the clock, which meant an accidental undo lost a
     spray you liked for ever. A seed in the settings is recoverable. */
  expect(r.same).toBe(true);
  expect(r.different).toBe(true);
  expect(r.first).toEqual(r.second);
  expect(r.inRange).toBe(true);
});

/* ------------------------------------------------------------------ *
 * The four patterns
 * ------------------------------------------------------------------ */

test("a grid fill covers the region in rows and columns", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const made = F.decoObjects({ x: 0, y: 0, w: 100, h: 100 },
      { pattern: "grid", spacing: 25, size: 10, jitter: 0, seed: 1 });
    const xs = [...new Set(made.map((o) => Math.round(o.x + o.width / 2)))].sort((a, b) => a - b);
    const ys = [...new Set(made.map((o) => Math.round(o.y + o.height / 2)))].sort((a, b) => a - b);
    return { n: made.length, xs, ys,
             allOvals: made.every((o) => o.type === "oval"),
             size: made[0].width };
  });
  // 100 wide at 25 apart, starting at the half-step: four columns, four rows.
  expect(r.xs).toEqual([13, 38, 63, 88]);
  expect(r.ys).toEqual([13, 38, 63, 88]);
  expect(r.n).toBe(16);
  // With no library the stamp is a dot in the current fill colour, so the
  // tool does something useful on an empty document.
  expect(r.allOvals).toBe(true);
  expect(r.size).toBe(10);
});

test("jitter moves the grid off its own lines", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const reg = { x: 0, y: 0, w: 100, h: 100 };
    const exact = F.decoObjects(reg, { pattern: "grid", spacing: 25, jitter: 0, seed: 3 });
    const loose = F.decoObjects(reg, { pattern: "grid", spacing: 25, jitter: 0.8, seed: 3 });
    const off = loose.filter((o, i) => Math.abs(o.x - exact[i].x) > 0.5).length;
    const sizes = new Set(loose.map((o) => +o.width.toFixed(4)));
    return { n: exact.length, off, sizeVariety: sizes.size };
  });
  /* A perfectly regular grid reads as a texture map rather than as drawing,
     which is why Flash's grid fill had a randomness control at all. */
  expect(r.off).toBeGreaterThan(r.n / 2);
  expect(r.sizeVariety).toBeGreaterThan(1);
});

test("a vine grows upwards and stays inside the region", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const reg = { x: 0, y: 0, w: 200, h: 200 };
    const made = F.decoObjects(reg, { pattern: "vine", count: 30, spacing: 12,
                                      size: 10, jitter: 0.3, seed: 5 });
    const ys = made.map((o) => o.y + o.height / 2);
    const inside = made.every((o) => {
      const cx = o.x + o.width / 2, cy = o.y + o.height / 2;
      return cx > reg.x - 20 && cx < reg.x + reg.w + 20 &&
             cy > reg.y - 20 && cy < reg.y + reg.h + 20;
    });
    const turned = new Set(made.map((o) => Math.round(o.rotation))).size;
    return { n: made.length, first: ys[0], last: ys[ys.length - 1], inside, turned };
  });
  expect(r.n).toBeGreaterThan(5);
  // It starts at the bottom of the region and climbs.
  expect(r.last).toBeLessThan(r.first);
  expect(r.inside).toBe(true);
  // Leaves alternate sides and the stem turns, so the rotations differ.
  expect(r.turned).toBeGreaterThan(2);
});

test("a symmetry brush makes identical arms around the centre", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const made = F.decoObjects({ x: 0, y: 0, w: 200, h: 200 },
      { pattern: "symmetry", branches: 6, spacing: 20, size: 8, jitter: 0.2, seed: 11 });
    const cx = 100, cy = 100;
    // Every stamp's distance from the centre, rounded.
    const radii = made.map((o) =>
      Math.round(Math.hypot(o.x + o.width / 2 - cx, o.y + o.height / 2 - cy)));
    const perArm = {};
    radii.forEach((v) => { perArm[v] = (perArm[v] || 0) + 1; });
    return { n: made.length,
             // Each radius appears once per arm, which is what "symmetry" means.
             counts: [...new Set(Object.values(perArm))],
             distinctRadii: Object.keys(perArm).length };
  });
  /* The arm is generated from its OWN seed, reset per arm, so all six arms are
     the same shape — a kaleidoscope rather than six unrelated sprays. */
  expect(r.counts).toEqual([6]);
  expect(r.distinctRadii).toBeGreaterThan(2);
  expect(r.n).toBe(r.distinctRadii * 6);
});

test("a scatter puts exactly the asked-for number inside the region", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const reg = { x: 50, y: 20, w: 120, h: 80 };
    const made = F.decoObjects(reg, { pattern: "scatter", count: 37, size: 6,
                                      jitter: 0.5, seed: 2 });
    const inside = made.every((o) => {
      const cx = o.x + o.width / 2, cy = o.y + o.height / 2;
      return cx >= reg.x && cx <= reg.x + reg.w &&
             cy >= reg.y && cy <= reg.y + reg.h;
    });
    const rotations = new Set(made.map((o) => Math.round(o.rotation))).size;
    return { n: made.length, inside, rotations };
  });
  expect(r.n).toBe(37);
  expect(r.inside).toBe(true);
  expect(r.rotations).toBeGreaterThan(10);
});

/* ------------------------------------------------------------------ *
 * The spray brush
 * ------------------------------------------------------------------ */

test("spray stamps are placed along arc length, not per pointer event", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    // The same 300px straight line, sampled coarsely and finely.
    const coarse = [0, 0, 300, 0];
    const fine = [];
    for (let x = 0; x <= 300; x += 3) fine.push(x, 0);
    const opts = { spacing: 20, size: 0, scaleJitter: 0, rotationJitter: 0,
                   density: 1, seed: 9 };
    return {
      coarse: F.sprayObjects(coarse, opts).length,
      fine: F.sprayObjects(fine, opts).length,
      // And density multiplies it.
      dense: F.sprayObjects(coarse, Object.assign({}, opts, { density: 2 })).length,
      short: F.sprayObjects([10, 10], opts).length,
    };
  });
  /* A fast drag and a slow one over the same path must put down the same
     paint, or the tool is a lottery. */
  expect(r.coarse).toBe(r.fine);
  expect(r.coarse).toBe(15);
  expect(r.dense).toBe(30);
  expect(r.short).toBe(0);
});

test("spray scatters across the brush and jitters size and rotation", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const line = [0, 100, 300, 100];
    const tight = F.sprayObjects(line, { spacing: 10, size: 0,
      scaleJitter: 0, rotationJitter: 0, seed: 6 });
    const loose = F.sprayObjects(line, { spacing: 10, size: 30,
      scaleJitter: 0.8, rotationJitter: 180, seed: 6 });
    const spread = (list) => {
      const ys = list.map((o) => o.y + o.height / 2);
      return Math.max(...ys) - Math.min(...ys);
    };
    return {
      tightSpread: +spread(tight).toFixed(3),
      looseSpread: spread(loose),
      sizes: new Set(loose.map((o) => +o.width.toFixed(3))).size,
      rotations: new Set(tight.map((o) => Math.round(o.rotation))).size,
      looseRotations: new Set(loose.map((o) => Math.round(o.rotation))).size,
    };
  });
  /* Stamps scattered ACROSS the brush, not strung along its centre line: a
     spray brush with no width is a dotted line. */
  expect(r.tightSpread).toBe(0);
  expect(r.looseSpread).toBeGreaterThan(20);
  expect(r.sizes).toBeGreaterThan(5);
  // No jitter means no jitter, which is what the "none" option promises.
  expect(r.rotations).toBe(1);
  expect(r.looseRotations).toBeGreaterThan(5);
});

test("a library symbol is what gets stamped when there is one", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    window._flashyEditor.loadDoc({
      width: 300, height: 200, fps: 24, backgroundColor: "#FFF", totalFrames: 1,
      library: { Leaf: { objects: [], layers: [{ name: "L", visible: true,
        locked: false, keyframes: [{ index: 1, duration: 1, tweenType: "none",
        easing: "linear", script: "", objects: [] }] }],
        totalFrames: 1, behavior: "graphic" } },
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear",
        script: "", objects: [] }] }],
    });
    const withSym = F.decoObjects({ x: 0, y: 0, w: 60, h: 60 },
      { pattern: "scatter", count: 5, symbol: "Leaf", seed: 1 });
    // A name that is not in the library falls back to a dot rather than
    // producing an instance of nothing.
    const missing = F.decoObjects({ x: 0, y: 0, w: 60, h: 60 },
      { pattern: "scatter", count: 5, symbol: "Nope", seed: 1 });
    return {
      kinds: [...new Set(withSym.map((o) => o.type))],
      names: [...new Set(withSym.map((o) => o.symbolName))],
      behavior: withSym[0].symbolBehavior,
      fallback: [...new Set(missing.map((o) => o.type))],
      stamps: F.stampSymbols(),
    };
  });
  expect(r.kinds).toEqual(["symbol"]);
  expect(r.names).toEqual(["Leaf"]);
  // Graphic, not movieclip: a sprayed leaf is artwork, not a thing with a
  // timeline of its own.
  expect(r.behavior).toBe("graphic");
  expect(r.fallback).toEqual(["oval"]);
  expect(r.stamps).toEqual(["Leaf"]);
});

/* ------------------------------------------------------------------ *
 * Committing to the document
 * ------------------------------------------------------------------ */

test("a Deco fill is one undoable action that leaves the stamps selected", async ({ page }) => {
  await openEditor(page);
  await blank(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setDeco({ pattern: "grid", spacing: 40, size: 10, jitter: 0, seed: 1 });
    const res = F.applyDecoFill({ x: 0, y: 0, w: 200, h: 200 });
    const after = F.currentLayers()[0].getKeyframeAt(1).objects.length;
    const selected = F.selection().length;
    window._flashyEditor.doAction("undo");
    const undone = F.currentLayers()[0].getKeyframeAt(1).objects.length;
    // Too small an area says so rather than filling nothing silently.
    const tiny = F.applyDecoFill({ x: 0, y: 0, w: 0.5, h: 0.5 });
    return { res, after, selected, undone, tiny };
  });
  expect(r.res.ok).toBe(true);
  expect(r.res.count).toBe(25);
  expect(r.after).toBe(25);
  // Selected, so the whole fill can be moved or deleted as one gesture.
  expect(r.selected).toBe(25);
  expect(r.undone).toBe(0);
  expect(r.tiny.ok).toBe(false);
  expect(r.tiny.why).toContain("too small");
});

test("a spray drag commits and is undoable", async ({ page }) => {
  await openEditor(page);
  await blank(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSpray({ spacing: 15, size: 10, seed: 3 });
    const res = F.applySpray([20, 20, 200, 120]);
    const after = F.currentLayers()[0].getKeyframeAt(1).objects.length;
    window._flashyEditor.doAction("undo");
    const undone = F.currentLayers()[0].getKeyframeAt(1).objects.length;
    const nothing = F.applySpray([5, 5]);
    return { res, after, undone, nothing };
  });
  expect(r.res.ok).toBe(true);
  expect(r.after).toBe(r.res.count);
  expect(r.after).toBeGreaterThan(5);
  expect(r.undone).toBe(0);
  expect(r.nothing.ok).toBe(false);
});

test("both tools are in the toolbox with their own options", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("#toolbox .tool-btn")]
      .map((b) => b.dataset.tool);
    const opts = (tool) => {
      window._flashyAI.setTool(tool);
      return [...document.querySelectorAll("#tool-options .tool-opt-btn")]
        .map((b) => b.dataset.shape || b.textContent);
    };
    const deco = opts("deco");
    const spray = opts("spray");
    window._flashyAI.setTool("select");
    return { hasDeco: ids.indexOf("deco") >= 0, hasSpray: ids.indexOf("spray") >= 0,
             deco, spray };
  });
  expect(r.hasDeco).toBe(true);
  expect(r.hasSpray).toBe(true);
  // The four Deco patterns, and a Reseed button.
  expect(r.deco).toContain("grid");
  expect(r.deco).toContain("vine");
  expect(r.deco).toContain("symmetry");
  expect(r.deco).toContain("scatter");
  expect(r.deco).toContain("Reseed");
  expect(r.spray).toContain("Reseed");
});

/* ------------------------------------------------------------------ *
 * Cache as bitmap
 * ------------------------------------------------------------------ */

test("caching is offered on the kinds it helps and not on the rest", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const path = [0, 0, 0];
    for (let i = 1; i < 40; i++) path.push(1, i, i);
    return {
      symbol: F.canCache({ type: "symbol" }),
      group: F.canCache({ type: "group" }),
      text: F.canCache({ type: "text" }),
      bigPath: F.canCache({ type: "path", path }),
      // One fill: caching it costs a canvas to save nothing, and offering the
      // checkbox anyway would be offering a mistake.
      rect: F.canCache({ type: "rect" }),
      oval: F.canCache({ type: "oval" }),
      smallPath: F.canCache({ type: "path", path: [0, 0, 0, 1, 10, 10] }),
      nothing: F.canCache(null),
    };
  });
  expect(r.symbol).toBe(true);
  expect(r.group).toBe(true);
  expect(r.text).toBe(true);
  expect(r.bigPath).toBe(true);
  expect(r.rect).toBe(false);
  expect(r.oval).toBe(false);
  expect(r.smallPath).toBe(false);
  expect(r.nothing).toBe(false);
});

test("the cached surface is padded for the filters that draw outside the box", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const plain = F.cacheBoundsOf({ type: "symbol", width: 100, height: 50 });
    const blurred = F.cacheBoundsOf({ type: "symbol", width: 100, height: 50,
      filters: [{ type: "blur", blurX: 20, blurY: 20, enabled: true }] });
    const off = F.cacheBoundsOf({ type: "symbol", width: 100, height: 50,
      filters: [{ type: "blur", blurX: 20, blurY: 20, enabled: false }] });
    return { plain, blurred, off,
             empty: F.cacheBoundsOf({ type: "symbol", width: 0, height: 50 }) };
  });
  // Centred on the object's own origin, which is where it draws.
  expect(r.plain).toEqual({ x: -50, y: -25, w: 100, h: 50 });
  /* A glow on a cached symbol sliced off at the edge looks exactly like a
     clipping bug, and is the first thing caching gets blamed for. */
  expect(r.blurred.w).toBeGreaterThan(130);
  expect(r.blurred.x).toBeLessThan(-60);
  // A disabled filter reaches nowhere.
  expect(r.off).toEqual(r.plain);
  expect(r.empty).toBe(null);
});

test("a cached object draws the same pixels as an uncached one", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    window._flashyEditor.loadDoc({
      width: 200, height: 200, fps: 24, backgroundColor: "#FFFFFF",
      totalFrames: 1,
      library: { Box: { objects: [], layers: [{ name: "L", visible: true,
        locked: false, keyframes: [{ index: 1, duration: 1, tweenType: "none",
        easing: "linear", script: "", objects: [{
          type: "rect", x: 0, y: 0, width: 60, height: 40,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#2255CC", fillAlpha: 1, fillType: "solid",
          strokeStyle: "none", strokeWidth: 0 }] }] }],
        totalFrames: 1, behavior: "graphic" } },
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{ type: "symbol", symbolName: "Box", symbolBehavior: "graphic",
          x: 50, y: 60, width: 60, height: 40,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, firstFrame: 1,
          loopMode: "loop" }] }] }],
    });
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const shot = () => {
      F.setSelection([]);
      F.render();
      const c = document.getElementById("stageCanvas");
      const g = c.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const ox = (c.clientWidth - 200) / 2, oy = (c.clientHeight - 200) / 2;
      const out = [];
      for (let y = 55; y < 105; y += 5) {
        for (let x = 45; x < 115; x += 5) {
          const d = g.getImageData(Math.round((ox + x) * dpr),
                                   Math.round((oy + y) * dpr), 1, 1).data;
          out.push(d[0], d[1], d[2]);
        }
      }
      return out;
    };
    const plain = shot();
    o.cacheAsBitmap = true;
    const cached = shot();
    // Changing the symbol has to invalidate the cache, or the stage shows
    // artwork that no longer exists.
    F.doc.library.Box.layers[0].keyframes[0].objects[0].fillColor = "#CC2222";
    const edited = shot();
    return { plain, cached, edited };
  });
  /* The stage has to agree with the player about what the cached version
     looks like, or "cache as bitmap" is a checkbox whose effect you can only
     see after exporting. */
  expect(r.cached).toEqual(r.plain);
  /* And the signature includes the LIBRARY entry, because a symbol's
     appearance does not live in the instance — the instance's own record
     cannot see an edit to the symbol at all. */
  expect(r.edited).not.toEqual(r.plain);
});

test("the inspector offers the checkbox, with the trade stated", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    const F = window._flashyAI;
    window._flashyEditor.loadDoc({
      width: 200, height: 200, fps: 24, backgroundColor: "#FFF", totalFrames: 1,
      library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{ type: "group", x: 10, y: 10, width: 50, height: 50,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, children: [] }] }] }],
    });
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    F.updateProps();
  });
  const before = await page.evaluate(() =>
    document.getElementById("propsPanel").textContent);
  expect(before).toContain("Cache as bitmap");
  // The warning appears only once it is on, where it is relevant.
  expect(before).not.toContain("goes soft");

  const after = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    o.cacheAsBitmap = true;
    F.updateProps();
    return document.getElementById("propsPanel").textContent;
  });
  expect(after).toContain("goes soft");
});

test("the flag survives a save and reaches the exported player", async ({ page, context }) => {
  await openEditor(page);
  await page.evaluate(() => {
    window._flashyEditor.loadDoc({
      width: 200, height: 120, fps: 12, backgroundColor: "#FFFFFF",
      totalFrames: 1,
      library: { Box: { objects: [], layers: [{ name: "L", visible: true,
        locked: false, keyframes: [{ index: 1, duration: 1, tweenType: "none",
        easing: "linear", script: "", objects: [{
          type: "rect", x: 0, y: 0, width: 80, height: 40,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#117733", fillAlpha: 1, fillType: "solid",
          strokeStyle: "none", strokeWidth: 0 }] }] }],
        totalFrames: 1, behavior: "graphic" } },
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{ type: "symbol", symbolName: "Box", symbolBehavior: "graphic",
          x: 40, y: 40, width: 80, height: 40, cacheAsBitmap: true,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, firstFrame: 1,
          loopMode: "loop" }] }] }],
    });
  });
  const saved = await page.evaluate(() => {
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    return { has: /"cacheAsBitmap":true/.test(json),
             back: window._flashyAI.currentLayers()[0]
                     .getKeyframeAt(1).objects[0].cacheAsBitmap };
  });
  expect(saved.has).toBe(true);
  expect(saved.back).toBe(true);

  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForTimeout(200);
  const run = await out.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const sx = c.width / 200, sy = c.height / 120;
    const px = (x, y) => {
      const d = g.getImageData(Math.round(x * sx), Math.round(y * sy), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    return { inside: px(80, 60), outside: px(10, 10) };
  });
  await out.close();
  expect(errors).toEqual([]);
  /* The player blits the cached surface and the pixels are the artwork's own
     — a green box where the box is, white where it is not. A cache that
     mis-places its surface shows up here as a blank stage. */
  expect(run.inside[1]).toBeGreaterThan(run.inside[0]);
  expect(run.inside[1]).toBeGreaterThan(80);
  expect(run.outside).toEqual([255, 255, 255]);
});

test("the engine refuses to cache without bounds, and at absurd sizes", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const sh = new window.Flashy.Shape();
    sh.graphics.beginFill(0x3366cc).drawRect(0, 0, 10, 10).endFill();
    const c = document.createElement("canvas");
    c.width = c.height = 40;
    const g = c.getContext("2d");

    sh.cacheAsBitmap = true;
    sh.cacheBounds = null;
    sh._renderFiltered(g);
    const noBounds = !sh._cacheCanvas;

    sh.cacheBounds = { x: 0, y: 0, w: 0, h: 10 };
    sh._renderFiltered(g);
    const zero = !sh._cacheCanvas;

    sh.cacheBounds = { x: 0, y: 0, w: 99999, h: 99999 };
    sh._renderFiltered(g);
    const huge = !sh._cacheCanvas;

    sh.cacheBounds = { x: 0, y: 0, w: 10, h: 10 };
    sh._renderFiltered(g);
    const made = !!sh._cacheCanvas;
    const first = sh._cacheCanvas;
    sh._renderFiltered(g);
    const reused = sh._cacheCanvas === first;
    sh.invalidateCache();
    const dropped = !sh._cacheCanvas;
    return { noBounds, zero, huge, made, reused, dropped };
  });
  /* No bounds means no cache rather than a guess: a wrong guess would clip
     the artwork and look like a rendering bug. */
  expect(r.noBounds).toBe(true);
  expect(r.zero).toBe(true);
  // Past the cliff the blit costs as much as the drawing and the memory is real.
  expect(r.huge).toBe(true);
  expect(r.made).toBe(true);
  expect(r.reused).toBe(true);
  expect(r.dropped).toBe(true);
});
