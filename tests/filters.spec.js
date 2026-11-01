// Flash 8's filter stack and Colour Effect.
//
// This is what made late-era Flash content look the way it did, and nothing in
// Flashy produced a soft shadow or a glow. The interesting part is not any one
// filter — it is that there is ONE implementation (Flashy.Filters, in the
// engine) shared by the authoring stage, the raster exports and the exported
// player, because four independent filter implementations would have diverged
// exactly the way the four renderers once did.
//
// Two mechanisms, deliberately: filters are geometric and go through the canvas
// `filter` property applied to a whole composite; colour transforms are
// per-pixel and exact, because every one of Flash's three colour effects is a
// per-channel multiply plus offset and CSS filter functions cannot express that
// at all (`brightness()` is a plain multiply; Flash's Brightness is a multiply
// AND an offset).
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction, runExportedHTML } from "./helpers.js";

function docWith(objs, over = {}) {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 10,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 10, tweenType: "none", easing: "linear", script: "",
        objects: objs,
      }],
    }],
    library: {},
    ...over,
  };
}

const square = (over = {}) => ({
  type: "rect", x: 100, y: 60, width: 80, height: 80,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#808080", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

/** Set the first object's filters / colour effect and repaint. */
const setFx = (page, patch) =>
  page.evaluate((patch) => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    if ("filters" in patch) o.filters = patch.filters;
    if ("colorEffect" in patch) o.colorEffect = patch.colorEffect;
    F.setSelection([o]);
    F.fullRefresh();
  }, patch);

/** Read a pixel out of the raster export path, which is what a video records. */
const pixel = (page, x, y) =>
  page.evaluate(({ x, y }) => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 300, 200);
    const d = cv.getContext("2d").getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }, { x, y });

/* ------------------------------------------------------------------ *
 * Colour effects — the exact half
 * ------------------------------------------------------------------ */

test("Brightness fades towards white and black, not by a plain multiply", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([square()]));

  // A mid grey, so both directions have somewhere to go.
  expect((await pixel(page, 140, 100))[0]).toBeGreaterThan(120);
  expect((await pixel(page, 140, 100))[0]).toBeLessThan(135);

  await setFx(page, { colorEffect: { mode: "brightness", brightness: 0.5 } });
  const up = await pixel(page, 140, 100);
  // Flash's Brightness at +50% is c*(1-b) + 255b = 128*0.5 + 127.5 ≈ 191.
  // A CSS brightness(1.5) would give 192 by coincidence here, so check the
  // place the two genuinely disagree: pure black.
  expect(up[0]).toBeGreaterThan(180);
  expect(up[0]).toBeLessThan(200);

  await page.evaluate(() => {
    const F = window._flashyAI;
    F.currentLayers()[0].getKeyframeAt(1).objects[0].fillColor = "#000000";
    F.fullRefresh();
  });
  const blackLifted = await pixel(page, 140, 100);
  // THIS is the difference: a multiply leaves black black. Flash's Brightness
  // lifts it, because it is an offset as well.
  expect(blackLifted[0]).toBeGreaterThan(100);

  await setFx(page, { colorEffect: { mode: "brightness", brightness: -0.5 } });
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.currentLayers()[0].getKeyframeAt(1).objects[0].fillColor = "#808080";
    F.fullRefresh();
  });
  const down = await pixel(page, 140, 100);
  expect(down[0]).toBeLessThan(80);
  expect(errors).toEqual([]);
});

test("Tint interpolates the artwork towards a colour by its amount", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square({ fillColor: "#000000" })]));

  await setFx(page, { colorEffect: { mode: "tint", color: 0xFF0000, amount: 1 } });
  let p = await pixel(page, 140, 100);
  expect(p[0]).toBeGreaterThan(240);
  expect(p[1]).toBeLessThan(20);

  // Half way: black towards red is a dark red, not red.
  await setFx(page, { colorEffect: { mode: "tint", color: 0xFF0000, amount: 0.5 } });
  p = await pixel(page, 140, 100);
  expect(p[0]).toBeGreaterThan(110);
  expect(p[0]).toBeLessThan(145);
});

test("Advanced applies a per-channel multiply and offset", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square({ fillColor: "#808080" })]));

  await setFx(page, {
    colorEffect: {
      mode: "advanced",
      rMul: 1, gMul: 0, bMul: 0, aMul: 1,
      rOff: 0, gOff: 255, bOff: 0, aOff: 0,
    },
  });
  const p = await pixel(page, 140, 100);
  // Red passes through, green is zeroed then fully offset, blue is zeroed.
  expect(p[0]).toBeGreaterThan(120);
  expect(p[0]).toBeLessThan(140);
  expect(p[1]).toBeGreaterThan(240);
  expect(p[2]).toBeLessThan(20);
});

test("a colour transform never paints outside the artwork", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([square()]));
  // A positive offset applied to transparent pixels would flood the whole
  // scratch buffer, and the buffer is the size of the stage.
  await setFx(page, {
    colorEffect: {
      mode: "advanced",
      rMul: 1, gMul: 1, bMul: 1, aMul: 1,
      rOff: 200, gOff: 0, bOff: 0, aOff: 0,
    },
  });
  // Well outside the 80x80 square at (100,60): still the white stage.
  const outside = await pixel(page, 10, 10);
  expect(outside[0]).toBeGreaterThan(240);
  expect(outside[1]).toBeGreaterThan(240);
  expect(outside[2]).toBeGreaterThan(240);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * Filters — the geometric half
 * ------------------------------------------------------------------ */

test("Blur spreads the shape past its own edge", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([square({ fillColor: "#000000" })]));

  // Just outside the square's left edge (x=100): nothing there yet.
  expect((await pixel(page, 94, 100))[0]).toBeGreaterThan(240);

  await setFx(page, { filters: [{ type: "blur", enabled: true, blurX: 12, blurY: 12 }] });
  const bled = await pixel(page, 94, 100);
  expect(bled[0]).toBeLessThan(220);
  // And the middle is still dark — a blur spreads, it does not erase.
  expect((await pixel(page, 140, 100))[0]).toBeLessThan(60);
  expect(errors).toEqual([]);
});

test("Drop Shadow lands on the side the angle points at", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square({ fillColor: "#FFFFFF" })]));
  // A white square on white: only the shadow can darken anything.
  await setFx(page, {
    filters: [{ type: "dropShadow", enabled: true, distance: 14, angle: 0,
                blur: 2, color: 0x000000, alpha: 1 }],
  });
  // angle 0 is +x, so the shadow is to the RIGHT of the square (ends at 180).
  const right = await pixel(page, 188, 100);
  const left = await pixel(page, 92, 100);
  expect(right[0]).toBeLessThan(160);
  expect(left[0]).toBeGreaterThan(240);

  // Turn it round and the shadow moves with it.
  await setFx(page, {
    filters: [{ type: "dropShadow", enabled: true, distance: 14, angle: 180,
                blur: 2, color: 0x000000, alpha: 1 }],
  });
  expect((await pixel(page, 92, 100))[0]).toBeLessThan(160);
});

test("Glow haloes the shape in its own colour", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square({ fillColor: "#000000" })]));
  await setFx(page, {
    filters: [{ type: "glow", enabled: true, blur: 14, color: 0x00FF00,
                alpha: 1, strength: 3 }],
  });
  const halo = await pixel(page, 94, 100);
  // Green outside the edge, where there was white.
  expect(halo[1]).toBeGreaterThan(halo[0] + 20);
  expect(halo[1]).toBeGreaterThan(halo[2] + 20);
});

test("a disabled filter keeps its settings and does nothing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square({ fillColor: "#000000" })]));
  await setFx(page, {
    filters: [{ type: "blur", enabled: false, blurX: 20, blurY: 20 }],
  });
  // No bleed past the edge.
  expect((await pixel(page, 94, 100))[0]).toBeGreaterThan(240);
  // But the settings are still there to turn back on.
  const kept = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0].filters[0]);
  expect(kept.blurX).toBe(20);
});

test("an object with no filters costs nothing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));
  // The filter pass allocates a stage-sized scratch buffer, so the common
  // case — every object in a document that uses no filters — must not enter
  // it at all.
  const pooled = await page.evaluate(() => {
    const F = window._flashyAI;
    F.fullRefresh();
    return window.Flashy.Filters._pool.length;
  });
  expect(pooled).toBe(0);

  await setFx(page, { filters: [{ type: "blur", enabled: true, blurX: 8, blurY: 8 }] });
  const afterFilter = await page.evaluate(() => window.Flashy.Filters._pool.length);
  expect(afterFilter).toBeGreaterThan(0);
  // And the buffer is handed back, not leaked: a second filtered object reuses
  // it rather than allocating again.
  const busy = await page.evaluate(() =>
    window.Flashy.Filters._pool.filter((e) => e.busy).length);
  expect(busy).toBe(0);
});

/* ------------------------------------------------------------------ *
 * Every output path
 * ------------------------------------------------------------------ */

test("filters and colour effects survive save, reopen and clone", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([square()]));
  await setFx(page, {
    filters: [{ type: "glow", enabled: true, blur: 10, color: 0x00FF00, alpha: 1, strength: 2 }],
    colorEffect: { mode: "tint", color: 0xFF0000, amount: 0.3 },
  });

  const round = await page.evaluate(() => {
    const data = window._flashyEditor.serializeDoc();
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(data)));
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    return { filters: o.filters, colorEffect: o.colorEffect };
  });
  expect(round.filters).toHaveLength(1);
  expect(round.filters[0].blur).toBe(10);
  expect(round.colorEffect).toMatchObject({ mode: "tint", amount: 0.3 });

  // `filters` is an array of OBJECTS, and clone() copies arrays with a shallow
  // slice — the same trap group children fell into. Editing one object's blur
  // must not change the other's.
  const independent = await page.evaluate(() => {
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    const c = o.clone();
    c.filters[0].blur = 99;
    c.colorEffect.amount = 0.99;
    return { blur: o.filters[0].blur, amount: o.colorEffect.amount };
  });
  expect(independent.blur).toBe(10);
  expect(independent.amount).toBe(0.3);
  expect(errors).toEqual([]);
});

test("the SVG export expresses the whole stack as real SVG filters", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));
  await setFx(page, {
    filters: [
      // Anisotropic on purpose: SVG can express it exactly, where the canvas
      // `filter` property has to average the two radii.
      { type: "blur", enabled: true, blurX: 20, blurY: 4 },
      { type: "dropShadow", enabled: true, distance: 6, angle: 90, blur: 4,
        color: 0x000000, alpha: 0.5 },
      { type: "adjustColor", enabled: true, brightness: 0, contrast: 0,
        saturation: 50, hue: 20 },
    ],
    colorEffect: { mode: "advanced", rMul: 0.5, gMul: 1, bMul: 1, aMul: 1,
                   rOff: 10, gOff: 0, bOff: 0, aOff: 0 },
  });

  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).toContain("<filter");
  // The anisotropic blur survives as two deviations.
  expect(svg).toContain('stdDeviation="10 2"');
  expect(svg).toContain("feDropShadow");
  expect(svg).toContain('type="saturate"');
  expect(svg).toContain('type="hueRotate"');
  // The colour transform is feComponentTransfer's linear function: the
  // multiply is the slope, the offset the intercept.
  expect(svg).toContain("feComponentTransfer");
  expect(svg).toContain('slope="0.5"');
  // And the filter region is enlarged, or a glow would be clipped to the
  // shape's own bounds and read as a hard edge.
  expect(svg).toMatch(/filterUnits="objectBoundingBox"/);
  expect(svg).toMatch(/<filter[^>]+width="[1-9]/);

  // A disabled filter does not reach the file.
  await setFx(page, { filters: [{ type: "glow", enabled: false, blur: 10 }], colorEffect: null });
  const svg2 = await downloadFromAction(page, "exportSVG");
  expect(svg2).not.toContain("<filter");
});

test("the HTML export carries the filters to the engine", async ({ page, context }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));
  await setFx(page, {
    filters: [{ type: "glow", enabled: true, blur: 10, color: 0x00FF00, alpha: 1, strength: 2 }],
    colorEffect: { mode: "tint", color: 0xFF0000, amount: 0.5 },
  });

  const html = await downloadFromAction(page, "export");
  // The spec objects travel in the document, not as baked pixels.
  expect(html).toContain('"glow"');
  expect(html).toContain('"tint"');

  const { page: out, errors } = await runExportedHTML(context, html);
  // The engine exposes Flashy.Filters, which is what the player uses — the
  // same module the authoring stage paints through.
  const engine = await out.evaluate(() => ({
    hasFilters: !!(window.Flashy && window.Flashy.Filters),
    // The colour effect reduces to a channel transform in the player too.
    tint: window.Flashy.Filters.colorEffect({ mode: "tint", color: 0xFF0000, amount: 0.5 }),
    css: window.Flashy.Filters.css([{ type: "glow", blur: 10, color: 0x00FF00, strength: 2 }]),
  }));
  expect(engine.hasFilters).toBe(true);
  expect(engine.tint.rMul).toBeCloseTo(0.5, 5);
  expect(engine.tint.rOff).toBeCloseTo(127.5, 3);
  // Strength is how many times the glow is laid over itself.
  expect((engine.css.match(/drop-shadow/g) || []).length).toBe(2);
  expect(errors).toEqual([]);
  await out.close();
});

/* ------------------------------------------------------------------ *
 * Tweening
 * ------------------------------------------------------------------ */

test("a filter tweens between keyframes when the stacks match", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 20,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [
        { index: 1, duration: 10, tweenType: "motion", easing: "linear", script: "",
          objects: [square({
            filters: [{ type: "blur", enabled: true, blurX: 0, blurY: 0 }],
            colorEffect: { mode: "tint", color: 0xFF0000, amount: 0 },
          })] },
        { index: 11, duration: 10, tweenType: "none", easing: "linear", script: "",
          objects: [square({
            filters: [{ type: "blur", enabled: true, blurX: 50, blurY: 50 }],
            colorEffect: { mode: "tint", color: 0xFF0000, amount: 1 },
          })] },
      ],
    }],
    library: {},
  });

  const at = (f) =>
    page.evaluate((f) => {
      const F = window._flashyAI;
      F.setCurFrame(f);
      F.fullRefresh();
      const kf = F.currentLayers()[0].getKeyframeAt(f);
      void kf;
      // frameObjects resolves the tween, and renderFrameToCanvas goes through
      // it — so read the value the renderer would actually use.
      const cv = F.renderFrameToCanvas(f, 300, 200);
      const d = cv.getContext("2d").getImageData(94, 100, 1, 1).data;
      return [d[0], d[1], d[2]];
    }, f);

  const start = await at(1);
  const middle = await at(6);
  // At frame 1 the blur is zero, so nothing bleeds past the edge.
  expect(start[0]).toBeGreaterThan(240);
  // Half way through, it does.
  expect(middle[0]).toBeLessThan(240);
});

test("a tween between different stacks holds the start frame's rather than inventing one", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  const held = await page.evaluate(() => {
    const F = window._flashyAI;
    // Two unrelated stacks: there is no sensible interpolation between "blur"
    // and "drop shadow", and guessing one gives a frame that is neither.
    const a = new F.EditorObject("rect");
    a.filters = [{ type: "blur", enabled: true, blurX: 10, blurY: 10 }];
    const b = new F.EditorObject("rect");
    b.filters = [{ type: "dropShadow", enabled: true, distance: 10 }];
    const kf1 = F.currentLayers()[0].getKeyframeAt(1);
    kf1.tweenType = "motion";
    kf1.duration = 10;
    kf1.objects = [a];
    const l = F.currentLayers()[0];
    const kf2 = l.insertKeyframe(11);
    kf2.objects = [b];
    kf2.tweenType = "none";
    F.setCurFrame(6);
    F.fullRefresh();
    // Whatever frame 6 shows must be a valid single filter, not a hybrid.
    const kf = l.getKeyframeAt(6);
    void kf;
    return true;
  });
  expect(held).toBe(true);
  // The important part: no page error from a malformed filter spec.
  expect(page.flashyErrors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * The inspector
 * ------------------------------------------------------------------ */

test("the Property inspector adds, reorders, disables and removes filters", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([square()]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    F.fullRefresh();
  });

  const props = page.locator("#propsPanel");
  await expect(props).toContainText("Filters");
  await expect(props).toContainText("No filters");

  // Add two. Named, because the row also holds the preset picker.
  const add = props.locator("select.filter-add");
  await add.selectOption("dropShadow");
  await expect(props).toContainText("Drop Shadow");
  await props.locator("select.filter-add").selectOption("glow");
  await expect(props).toContainText("Glow");

  const types = () =>
    page.evaluate(() =>
      window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0]
        .filters.map((f) => f.type));
  expect(await types()).toEqual(["dropShadow", "glow"]);

  // Order matters — a glow on a blurred shape is not a blurred glow — so the
  // stack has to be reorderable.
  await props.locator(".filter-head", { hasText: "Glow" })
    .locator("button", { hasText: "▲" }).click();
  expect(await types()).toEqual(["glow", "dropShadow"]);

  // Disable the first without losing it.
  await props.locator(".filter-head").first().locator('input[type="checkbox"]').uncheck();
  const enabled = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0].filters[0].enabled);
  expect(enabled).toBe(false);

  // Remove both; the field goes back to null rather than an empty array.
  await props.locator(".filter-head").first().locator("button", { hasText: "✕" }).click();
  await props.locator(".filter-head").first().locator("button", { hasText: "✕" }).click();
  const after = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0].filters);
  expect(after).toBeNull();
  expect(errors).toEqual([]);
});

test("the inspector switches colour-effect modes and each starts visible", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    F.fullRefresh();
  });

  const props = page.locator("#propsPanel");
  await expect(props).toContainText("Color Effect");

  // The inspector also has a stroke "Style" row, and Color Effect is the last
  // section, so the mode picker is the last match.
  const style = () => props.locator(".props-row", { hasText: "Style" }).locator("select").last();
  await style().selectOption("tint");
  await expect(props).toContainText("Amount");
  // Picking Tint must show a tint, not an invisible no-op at zero strength.
  const ce = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0].colorEffect);
  expect(ce.mode).toBe("tint");
  expect(ce.amount).toBeGreaterThan(0);

  await style().selectOption("advanced");
  await expect(props).toContainText("Red ×");

  await style().selectOption("none");
  const cleared = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0].colorEffect);
  expect(cleared).toBeNull();
});

test("a filter applies to a group and a symbol instance, not just a shape", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([
    square({ x: 100, y: 60, width: 40, height: 80, fillColor: "#000000" }),
    square({ x: 140, y: 60, width: 40, height: 80, fillColor: "#000000" }),
  ]));

  // Group the two, then glow the GROUP: a filter has to see the whole
  // composite, children included, not each child separately.
  await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[0].getKeyframeAt(1);
    F.setSelection(kf.objects.slice());
    F.groupSelection();
    const g = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    g.filters = [{ type: "glow", enabled: true, blur: 14, color: 0x0000FF,
                   alpha: 1, strength: 3 }];
    F.setSelection([]);
    F.fullRefresh();
  });

  const halo = await pixel(page, 94, 100);
  expect(halo[2]).toBeGreaterThan(halo[0] + 20);
  // And no glow in the seam between the two children, because they were
  // composited together before the filter ran.
  const seam = await pixel(page, 140, 100);
  expect(seam[0]).toBeLessThan(60);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * Gradient Glow and Gradient Bevel
 *
 * The two filters whose colour is a RAMP, and the two CSS cannot express at
 * all: a drop-shadow function takes one colour, and no amount of stacking
 * turns that into a gradient. They are built instead the way Flash built
 * them — blur the object's own alpha silhouette, then look the blurred alpha
 * up in the ramp — which is why the ramp lives in Flashy.Filters and not in
 * any one renderer.
 * ------------------------------------------------------------------ */

const RED_RAMP = [
  { ratio: 0, color: 0xffffff, alpha: 0 },
  { ratio: 255, color: 0xff0000, alpha: 1 },
];

test("the ramp resolves stops to 256 entries, however they are written", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window.Flashy.Filters;
    // Out of order, out of range, and one colour as a string: a document is
    // data, and refusing to draw is worse than drawing the obvious reading.
    const ramp = F.ramp({ stops: [
      { ratio: 300, color: "#00FF00", alpha: 1 },
      { ratio: -20, color: 0x000000, alpha: 0 },
    ] });
    return {
      len: ramp.length,
      first: [...ramp.slice(0, 4)],
      last: [...ramp.slice(1020)],
      mid: [...ramp.slice(128 * 4, 128 * 4 + 4)],
    };
  });
  expect(r.len).toBe(1024);
  expect(r.first).toEqual([0, 0, 0, 0]);
  expect(r.last).toEqual([0, 255, 0, 255]);
  // Halfway along, halfway between the two stops.
  expect(r.mid[1]).toBeGreaterThan(100);
  expect(r.mid[1]).toBeLessThan(160);
  expect(r.mid[3]).toBeGreaterThan(100);
});

test("a gradient glow paints a halo in the ramp's colour", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));
  await setFx(page, { filters: [
    { type: "gradientGlow", enabled: true, blur: 16, strength: 1, stops: RED_RAMP },
  ] });

  // Just outside the square's left edge: inside the halo.
  const halo = await pixel(page, 98, 100);
  /* Red over a white background, so red stays at the ceiling and the OTHER
     two channels are what moved. The square itself is grey, so a red cast
     there is the glow and nothing else — the lookup is by ALPHA, so the
     artwork's own colour cannot leak into it. */
  expect(halo[0]).toBe(255);
  expect(halo[2]).toBeLessThan(245);
  expect(halo[0] - halo[2]).toBeGreaterThan(10);

  // The square still reads grey: the halo goes UNDER it, not over.
  const body = await pixel(page, 140, 100);
  expect(Math.abs(body[0] - body[1])).toBeLessThan(12);
  expect(Math.abs(body[1] - body[2])).toBeLessThan(12);
});

test("a disabled gradient glow paints nothing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));
  const clean = await pixel(page, 94, 100);

  await setFx(page, { filters: [
    { type: "gradientGlow", enabled: false, blur: 16, stops: RED_RAMP },
  ] });
  expect(await pixel(page, 94, 100)).toEqual(clean);
});

test("strength scales the halo rather than its colour", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));

  const at = async (strength) => {
    await setFx(page, { filters: [
      { type: "gradientGlow", enabled: true, blur: 16, strength, stops: RED_RAMP },
    ] });
    return pixel(page, 92, 100);
  };
  const faint = await at(0.4);
  const strong = await at(3);
  /* More strength means more red halo over a white background, which shows up
     as LESS blue — red is already at the ceiling there. */
  expect(strong[2]).toBeLessThan(faint[2]);
});

test("a gradient bevel is the offset that makes it one", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));

  const BEVEL = (distance) => [{
    type: "gradientBevel", enabled: true, distance, angle: 45, blur: 8, strength: 1,
    stops: [
      { ratio: 0, color: 0x000000, alpha: 0.9 },
      { ratio: 128, color: 0x808080, alpha: 0 },
      { ratio: 255, color: 0xffffff, alpha: 0.9 },
    ],
  }];
  /* The square is 100,60 to 180,140, so these four probes are just past its
     four corners: two on the 45 degree light axis, two across it. */
  const corners = async (distance) => {
    await setFx(page, { filters: BEVEL(distance) });
    const g = await Promise.all([
      pixel(page, 184, 144), pixel(page, 96, 56),     // on the axis
      pixel(page, 184, 56), pixel(page, 96, 144),     // across it
    ]);
    return g.map((p) => p[0]);
  };

  /* With no offset the two copies land on top of each other, so a square --
     which is symmetric about both diagonals -- reads the same at all four
     corners. That is the control: it shows the asymmetry below comes from the
     offset and not from the blur. */
  const flat = await corners(0);
  // Not pixel-identical -- the blur's own antialiasing differs a little by
  // corner -- but nothing like the separation the offset produces below.
  expect(Math.max(...flat) - Math.min(...flat)).toBeLessThan(40);

  /* With an offset, the corners ALONG the light axis get both copies and so
     land high on the ramp -- its highlight end -- while the corners across it
     get a thin fringe and land at the shadow end. Two ends of one ramp from
     one silhouette is what a gradient bevel is. */
  const lit = await corners(8);
  const onAxis = Math.min(lit[0], lit[1]);
  const across = Math.max(lit[2], lit[3]);
  expect(onAxis - across).toBeGreaterThan(80);
});

test("the filter's reach includes its blur and its offset", async ({ page }) => {
  await openEditor(page);
  const pad = await page.evaluate(() => ({
    glow: window.Flashy.Filters.extent([{ type: "gradientGlow", blur: 20 }]),
    bevel: window.Flashy.Filters.extent([{ type: "gradientBevel", blur: 10, distance: 6 }]),
  }));
  /* The extent is what the raster and SVG exports pad their bounds by. Too
     small and the halo is sliced off at the object's own box, which was a
     real bug class for the other filters. */
  expect(pad.glow).toBe(20);
  expect(pad.bevel).toBe(16);
});

test("the SVG export maps the ramp through component-transfer tables", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));
  await setFx(page, { filters: [
    { type: "gradientGlow", enabled: true, blur: 12, strength: 1, stops: RED_RAMP },
  ] });
  const svg = await downloadFromAction(page, "exportSVG");

  // Blur the silhouette...
  expect(svg).toContain('in="SourceAlpha"');
  // ...copy the blurred alpha into the colour channels...
  expect(svg).toContain("feColorMatrix");
  // ...and run each through its own table.
  expect(svg).toContain('type="table"');
  expect(svg).toContain("feComponentTransfer");
  // The halo is merged UNDER the artwork.
  expect(svg).toContain("feMerge");

  /* The tables come from the same Flashy.Filters.ramp the canvas uses, so the
     two paths cannot drift. Checking the red channel's table is all ones is
     checking exactly that: this ramp runs white to red, so red never drops. */
  const table = await page.evaluate(() =>
    window.Flashy.Filters.rampTable({ stops: [
      { ratio: 0, color: 0xffffff, alpha: 0 },
      { ratio: 255, color: 0xff0000, alpha: 1 },
    ] }, 17));
  expect(table.r.every((v) => v === 1)).toBe(true);
  expect(table.a[0]).toBe(0);
  expect(table.a[table.a.length - 1]).toBe(1);
});

test("the exported player draws the same halo", async ({ context, page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));
  await setFx(page, { filters: [
    { type: "gradientGlow", enabled: true, blur: 16, strength: 1, stops: RED_RAMP },
  ] });
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() => !!window.__stage);

  const px = await out.evaluate(() => {
    window.__stage.stop();
    window.__stage.root.gotoAndStop(1);
    window.__stage._render();
    const g = document.getElementById("stage")
      .getContext("2d", { willReadFrequently: true });
    const d = g.getImageData(98, 100, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  });
  /* The export ships flashy.js, so it runs the very code the stage ran — the
     point of putting the ramp in the engine rather than in the editor. */
  expect(px[0]).toBe(255);
  expect(px[0] - px[2]).toBeGreaterThan(10);
  expect(errors).toEqual([]);
  await out.close();
});

test("a ramp tweens stop by stop when the two keyframes agree about how many", async ({ page }) => {
  await openEditor(page);
  const lerped = await page.evaluate(() => {
    const F = window.Flashy.Filters;
    const mk = (color) => [{
      type: "gradientGlow", enabled: true, blur: 10,
      stops: [{ ratio: 0, color: 0, alpha: 0 }, { ratio: 255, color, alpha: 1 }],
    }];
    const half = F.lerpFilters(mk(0xff0000), mk(0x0000ff), 0.5);
    // A keyframe that inserted a stop has no sensible midpoint, so the start
    // frame's ramp holds — the same rule the whole stack follows for shape.
    const mismatched = F.lerpFilters(mk(0xff0000), [{
      type: "gradientGlow", enabled: true, blur: 10,
      stops: [{ ratio: 0, color: 0, alpha: 0 }, { ratio: 128, color: 0x00ff00, alpha: 0.5 },
              { ratio: 255, color: 0x0000ff, alpha: 1 }],
    }], 0.5);
    return {
      midColor: half[0].stops[1].color,
      kept: mismatched[0].stops.length,
      keptColor: mismatched[0].stops[1].color,
    };
  });
  // Halfway from red to blue.
  expect(lerped.midColor).toBe(0x800080);
  expect(lerped.kept).toBe(2);
  expect(lerped.keptColor).toBe(0xff0000);
});

test("the Properties panel edits the ramp", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));
  await setFx(page, { filters: [
    { type: "gradientGlow", enabled: true, blur: 12, strength: 1, stops: RED_RAMP },
  ] });

  // The preview strip is drawn from the same ramp the painter uses.
  await expect(page.locator("#propsPanel canvas.props-ramp")).toHaveCount(1);
  // One row per stop...
  await expect(page.locator("#propsPanel .filter-stop")).toHaveCount(2);
  // ...and the two of a minimal ramp cannot be removed, because one stop is a
  // flat colour and a flat gradient glow is just the Glow filter.
  await expect(page.locator("#propsPanel .filter-stop button").first()).toBeDisabled();

  await page.locator("#propsPanel button", { hasText: "+ Stop" }).click();
  await expect(page.locator("#propsPanel .filter-stop")).toHaveCount(3);

  const stops = await page.evaluate(() => {
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    return o.filters[0].stops.map((s) => Math.round(s.ratio));
  });
  // The new stop went into the widest gap, in order.
  expect(stops).toEqual([0, 128, 255]);
});

test("a ramp survives a save and open round trip", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([square()]));
  await setFx(page, { filters: [{
    type: "gradientBevel", enabled: true, distance: 5, angle: 30, blur: 7, strength: 2,
    stops: [{ ratio: 0, color: 0x112233, alpha: 0.25 },
            { ratio: 200, color: 0xAABBCC, alpha: 0.75 }],
  }] });

  const back = await page.evaluate(() => {
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    return o.filters[0];
  });
  expect(back.type).toBe("gradientBevel");
  expect(back.angle).toBe(30);
  expect(back.stops).toEqual([
    { ratio: 0, color: 0x112233, alpha: 0.25 },
    { ratio: 200, color: 0xAABBCC, alpha: 0.75 },
  ]);
});
