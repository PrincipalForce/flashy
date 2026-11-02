// Line styles, and the scaling mode.
//
// Flash's Stroke panel offered seven styles and a Scale menu. Flashy had
// three of the styles — solid, dashed, dotted — and none of the scaling, and
// two of the three it did have were wrong outside the stage: the engine's
// lineStyle had no dash argument at all, so every dashed and dotted stroke
// published SOLID.
//
// The missing four are hairline (one screen pixel at every scale) and the
// three textured ones: ragged, stipple and hatched. Those are not a pen —
// Flash drew them procedurally and turned them into filled shapes on export,
// which is also the only way a canvas, an SVG and a SWF can show the same
// scatter. So they are filled geometry here in every render path, from one
// Flashy.Stroke.decorate.
import { test, expect } from "@playwright/test";
import { openEditor, downloadFromAction, runExportedHTML } from "./helpers.js";

/** A document with one shape, selected. */
async function oneShape(page, extra = {}) {
  await page.evaluate((extra) => {
    window._flashyEditor.loadDoc({
      width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [Object.assign({
          type: "rect", x: 100, y: 50, width: 120, height: 80,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#FFFFFF", fillAlpha: 1, fillType: "none",
          strokeColor: "#1133CC", strokeAlpha: 1, strokeWidth: 4,
          strokeStyle: "solid", strokeScale: "normal",
        }, extra)],
      }] }],
    });
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    F.updateProps();
  }, extra);
}

/* ------------------------------------------------------------------ *
 * The dash patterns
 * ------------------------------------------------------------------ */

test("the dash pattern is proportional to the line width", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const S = window.Flashy.Stroke;
    return {
      thin: S.dash("dashed", 1),
      thick: S.dash("dashed", 10),
      dotted: S.dash("dotted", 4),
      solid: S.dash("solid", 4),
      hairline: S.dash("hairline", 4),
      ragged: S.dash("ragged", 4),
    };
  });
  /* A 1px dashed line and a 10px one have the same rhythm, not the same gap,
     which is what Flash's dashes did. */
  expect(r.thin).toEqual([3, 2]);
  expect(r.thick).toEqual([30, 20]);
  // Dotted is a near-zero dash with round caps: dots, not short dashes.
  expect(r.dotted[0]).toBeLessThan(0.2);
  expect(r.dotted[1]).toBe(8);
  expect(r.solid).toBe(null);
  expect(r.hairline).toBe(null);
  // The textured styles are geometry; a dash would be meaningless on them.
  expect(r.ragged).toBe(null);
});

test("the scaling modes decide which axes reach the line width", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const S = window.Flashy.Stroke;
    // A uniform 4x, then a 3x-wide 1x-tall one.
    const u = (style, scale) => S.width(style, 10, scale, 4, 4);
    const n = (style, scale) => +S.width(style, 10, scale, 3, 1).toFixed(4);
    return {
      normal: u("solid", "normal"),
      none: u("solid", "none"),
      hairline: u("hairline", "normal"),
      hairlineIgnoresWidth: S.width("hairline", 99, "normal", 4, 4),
      horizNonUniform: n("solid", "horizontal"),
      vertNonUniform: n("solid", "vertical"),
      noneNonUniform: n("solid", "none"),
    };
  });
  /* Every number here is the width to HAND the context, which has already
     applied the scale: "normal" passes the authored width through so the
     context scales it, everything else divides the wanted screen width back
     out by that same scale. */
  expect(r.normal).toBe(10);
  expect(r.none).toBe(2.5);          // 10 screen px under a 4x context
  expect(r.hairline).toBe(0.25);     // 1 screen px under a 4x context
  // A hairline is one pixel whatever the authored width says.
  expect(r.hairlineIgnoresWidth).toBe(0.25);
  // Mean scale here is 2, so horizontal wants 10*3 screen px -> 15.
  expect(r.horizNonUniform).toBe(15);
  expect(r.vertNonUniform).toBe(5);
  expect(r.noneNonUniform).toBe(5);
});

/* ------------------------------------------------------------------ *
 * The textured geometry
 * ------------------------------------------------------------------ */

test("the three textured styles produce fillable loops", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const S = window.Flashy.Stroke;
    const line = [0, 0, 0, 1, 100, 0];
    const look = (style) => {
      const g = S.decorate(line, style, 6);
      let loops = 0, ops = new Set();
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < g.length;) {
        const op = g[i]; ops.add(op);
        if (op === 3) { loops++; i += 1; continue; }
        x0 = Math.min(x0, g[i + 1]); x1 = Math.max(x1, g[i + 1]);
        y0 = Math.min(y0, g[i + 2]); y1 = Math.max(y1, g[i + 2]);
        i += 3;
      }
      return { loops, ops: [...ops].sort(), h: +(y1 - y0).toFixed(2),
               w: +(x1 - x0).toFixed(2) };
    };
    return { ragged: look("ragged"), stipple: look("stipple"),
             hatched: look("hatched"), solid: S.decorate(line, "solid", 6) };
  });
  /* One closed ribbon for ragged, so it fills under the same even-odd rule as
     everything else; many small loops for the other two. */
  expect(r.ragged.loops).toBe(1);
  expect(r.stipple.loops).toBeGreaterThan(8);
  expect(r.hatched.loops).toBeGreaterThan(8);
  // Moves, lines and closes only — nothing here needs a curve opcode.
  [r.ragged, r.stipple, r.hatched].forEach((v) => {
    expect(v.ops).toEqual([0, 1, 3]);
    // All three stay near the line and span it.
    expect(v.w).toBeGreaterThan(90);
    expect(v.h).toBeGreaterThan(1);
    expect(v.h).toBeLessThan(20);
  });
  // A style that is a pen has no geometry.
  expect(r.solid).toEqual([]);
});

test("the scatter is deterministic, not random", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const S = window.Flashy.Stroke;
    const line = [0, 0, 0, 1, 80, 20];
    const once = JSON.stringify(S.decorate(line, "stipple", 5));
    const twice = JSON.stringify(S.decorate(line, "stipple", 5));
    const ragged = JSON.stringify(S.decorate(line, "ragged", 5));
    const raggedAgain = JSON.stringify(S.decorate(line, "ragged", 5));
    return { same: once === twice, raggedSame: ragged === raggedAgain,
             // A different width is a different drawing, which it must be.
             different: once !== JSON.stringify(S.decorate(line, "stipple", 9)) };
  });
  /* Math.random here would mean a stippled line that re-scatters between the
     stage and the export — a different drawing, not the same one twice. */
  expect(r.same).toBe(true);
  expect(r.raggedSame).toBe(true);
  expect(r.different).toBe(true);
});

test("every stroked kind has a spine for the texture to follow", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const S = window.Flashy.Stroke, W = window.Flashy.Warp, P = window.Flashy.Primitives;
    const n = (o) => { const sp = S.spine(o, W, P); return sp ? sp.length : 0; };
    return {
      rect: n({ type: "rect", width: 20, height: 10 }),
      oval: n({ type: "oval", width: 20, height: 10 }),
      line: S.spine({ type: "line", width: -40, height: 30 }, W, P),
      pencil: n({ type: "pencil", width: 10, height: 10, points: [0, 0, 5, 5, 10, 0] }),
      path: n({ type: "path", width: 20, height: 20, pathW: 20, pathH: 20,
                path: [0, 0, 0, 1, 20, 0, 1, 20, 20, 3] }),
      symbol: S.spine({ type: "symbol", width: 20, height: 10 }, W, P),
      text: S.spine({ type: "text", width: 20, height: 10 }, W, P),
    };
  });
  expect(r.rect).toBeGreaterThan(0);
  expect(r.oval).toBeGreaterThan(0);
  expect(r.pencil).toBeGreaterThan(0);
  expect(r.path).toBeGreaterThan(0);
  /* A negative width is how the line tool records which diagonal it drew, so
     the spine has to start at the right corner — reading the unsigned box
     would draw the other diagonal. */
  expect(r.line).toEqual([0, 40, 0, 1, 0, 30]);
  // Nothing to stroke: these have contents, not an outline.
  expect(r.symbol).toBe(null);
  expect(r.text).toBe(null);
});

test("a warped shape's texture follows the warped outline", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const S = window.Flashy.Stroke, W = window.Flashy.Warp;
    const o = { type: "rect", width: 100, height: 60, strokeWidth: 3,
                strokeStyle: "hatched" };
    const plain = S.spine(o, W, window.Flashy.Primitives);
    o.warp = W.distortFor(100, 60);
    o.warp.points[2] = 200;
    const warped = S.spine(o, W, window.Flashy.Primitives);
    let max = 0;
    for (let i = 0; i < warped.length;) {
      const op = warped[i];
      if (op === 3) { i += 1; continue; }
      max = Math.max(max, warped[i + 1]); i += 3;
    }
    return { plainLen: plain.length, warpedMaxX: max };
  });
  expect(r.plainLen).toBeGreaterThan(0);
  // The stroke follows the shape you can see, not the box it started in.
  expect(r.warpedMaxX).toBeCloseTo(200, 3);
});

/* ------------------------------------------------------------------ *
 * The editor
 * ------------------------------------------------------------------ */

test("the current style is sticky and reaches a drawn shape", async ({ page }) => {
  await openEditor(page);
  await oneShape(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const before = F.strokeStyleNow();
    F.setStrokeStyle({ style: "hatched", scale: "none", width: 3 });
    const picked = F.strokeStyleNow();
    const next = F.newStrokeStyle();
    // With no width there is no line at all, whatever style is picked --
    // except hairline, which is a style rather than a width.
    F.setStrokeStyle({ width: 0 });
    const noWidth = F.newStrokeStyle();
    F.setStrokeStyle({ style: "hairline" });
    const hair = F.newStrokeStyle();
    return { before, picked, next, noWidth, hair };
  });
  expect(r.before).toEqual({ style: "solid", scale: "normal" });
  expect(r.picked).toEqual({ style: "hatched", scale: "none" });
  expect(r.next).toBe("hatched");
  expect(r.noWidth).toBe("none");
  expect(r.hair).toBe("hairline");
});

test("the ink bottle applies the style it is showing", async ({ page }) => {
  await openEditor(page);
  await oneShape(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setStrokeStyle({ style: "ragged", scale: "vertical", width: 5,
                       color: "#AA2200" });
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.setSelection([o]);
    F.inkBottleApply(o);
    return { style: o.strokeStyle, scale: o.strokeScale, width: o.strokeWidth };
  });
  /* The bottle used to keep whatever style the shape already had, so there
     was no way to make an existing line hatched at all. */
  expect(r.style).toBe("ragged");
  expect(r.scale).toBe("vertical");
  expect(r.width).toBe(5);
});

test("a style survives a save and open", async ({ page }) => {
  await openEditor(page);
  await oneShape(page, { strokeStyle: "stipple", strokeScale: "none" });
  const r = await page.evaluate(() => {
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    return { style: o.strokeStyle, scale: o.strokeScale,
             saved: /"strokeScale"/.test(json) };
  });
  expect(r.saved).toBe(true);
  expect(r.style).toBe("stipple");
  expect(r.scale).toBe("none");
});

test("the Property inspector offers all seven styles and the Scale menu", async ({ page }) => {
  await openEditor(page);
  await oneShape(page);
  const r = await page.evaluate(() => {
    const sels = [...document.querySelectorAll("#propsPanel select")];
    const values = sels.map((s) => [...s.options].map((o) => o.value));
    return {
      styles: values.find((v) => v.includes("hatched")) || null,
      scales: values.find((v) => v.includes("horizontal")) || null,
    };
  });
  expect(r.styles).toEqual(["hairline", "solid", "dashed", "dotted",
                            "ragged", "stipple", "hatched", "none"]);
  expect(r.scales).toEqual(["normal", "horizontal", "vertical", "none"]);
});

test("a hairline hides its width and scale, because it ignores them", async ({ page }) => {
  await openEditor(page);
  await oneShape(page, { strokeStyle: "hairline" });
  const r = await page.evaluate(() => {
    window._flashyAI.updateProps();
    const sels = [...document.querySelectorAll("#propsPanel select")];
    const values = sels.map((s) => [...s.options].map((o) => o.value));
    return {
      hasScale: values.some((v) => v.includes("horizontal")),
      text: document.getElementById("propsPanel").textContent,
    };
  });
  expect(r.hasScale).toBe(false);
  // And says why, rather than leaving a dead control.
  expect(r.text).toContain("one screen pixel");
});

/* ------------------------------------------------------------------ *
 * The render paths
 * ------------------------------------------------------------------ */

test("the SVG export carries the dash, the hairline and the texture", async ({ page }) => {
  await openEditor(page);

  await oneShape(page, { strokeStyle: "dashed" });
  const dashed = await downloadFromAction(page, "exportSVG");
  expect(dashed).toMatch(/stroke-dasharray="12 8"/);

  await oneShape(page, { strokeStyle: "hairline" });
  const hair = await downloadFromAction(page, "exportSVG");
  /* SVG has its own name for exactly this, and using it means the hairline
     stays a hairline when the file is scaled rather than merely thin. */
  expect(hair).toContain('vector-effect="non-scaling-stroke"');

  await oneShape(page, { strokeStyle: "hatched" });
  const hatched = await downloadFromAction(page, "exportSVG");
  // The pen is off and the decoration is a filled sibling path.
  expect(hatched).toMatch(/<rect[^>]*stroke="none"/);
  expect(hatched).toMatch(/<path[^>]*fill="#1133CC"[^>]*fill-rule="evenodd"/);
});

test("the exported player draws a dashed line dashed", async ({ page, context }) => {
  await openEditor(page);
  /* A horizontal line across a white stage, dashed. The engine's lineStyle
     had no dash argument at all, so this published solid: ink at every
     sample. */
  await page.evaluate(() => {
    window._flashyEditor.loadDoc({
      width: 200, height: 100, fps: 24, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "line", x: 10, y: 50, width: 180, height: 0,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillType: "none", fillColor: "#FFFFFF", fillAlpha: 1,
          strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 6,
          strokeStyle: "dashed", strokeScale: "normal", strokeCap: "butt",
        }],
      }] }],
    });
  });
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForTimeout(250);
  const run = await out.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const sx = c.width / 200, sy = c.height / 100;
    let dark = 0, light = 0;
    for (let x = 12; x < 188; x++) {
      const d = g.getImageData(Math.round(x * sx), Math.round(50 * sy), 1, 1).data;
      if (d[0] < 100) dark++; else light++;
    }
    return { dark, light };
  });
  await out.close();
  expect(errors).toEqual([]);
  // Both, in quantity: a solid publish would be all dark.
  expect(run.dark).toBeGreaterThan(30);
  expect(run.light).toBeGreaterThan(30);
});

test("the exported player fills a hatched stroke as geometry", async ({ page, context }) => {
  await openEditor(page);
  await page.evaluate(() => {
    window._flashyEditor.loadDoc({
      width: 200, height: 100, fps: 24, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "line", x: 10, y: 50, width: 180, height: 0,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillType: "none", fillColor: "#FFFFFF", fillAlpha: 1,
          strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 8,
          strokeStyle: "hatched", strokeScale: "normal",
        }],
      }] }],
    });
  });
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForTimeout(250);
  const run = await out.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const sx = c.width / 200, sy = c.height / 100;
    let onLine = 0, above = 0;
    for (let x = 12; x < 188; x++) {
      const d = g.getImageData(Math.round(x * sx), Math.round(50 * sy), 1, 1).data;
      if (d[0] < 100) onLine++;
      // The ticks cross the line, so there is ink well off its centre too.
      const u = g.getImageData(Math.round(x * sx), Math.round(44 * sy), 1, 1).data;
      if (u[0] < 100) above++;
    }
    return { onLine, above };
  });
  await out.close();
  expect(errors).toEqual([]);
  /* Ink both on the line and 6px off it, and broken along the line: that is a
     row of ticks, which a solid 8px pen could not produce. */
  expect(run.onLine).toBeGreaterThan(20);
  expect(run.onLine).toBeLessThan(170);
  expect(run.above).toBeGreaterThan(10);
});

test("the stage draws a hatched stroke off the line it follows", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    window._flashyEditor.loadDoc({
      width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "line", x: 100, y: 150, width: 200, height: 0,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillType: "none", fillColor: "#FFFFFF", fillAlpha: 1,
          strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 10,
          strokeStyle: "hatched", strokeScale: "normal",
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
    const ox = (c.clientWidth - F.doc.width) / 2;
    const oy = (c.clientHeight - F.doc.height) / 2;
    const dark = (dx, dy) => {
      const d = g.getImageData(Math.round((ox + dx) * dpr),
                               Math.round((oy + dy) * dpr), 1, 1).data;
      return d[0] < 100 && d[3] > 0;
    };
    let on = 0, off = 0, gaps = 0;
    for (let x = 105; x < 295; x++) {
      if (dark(x, 150)) on++; else gaps++;
      if (dark(x, 142)) off++;
    }
    return { on, off, gaps };
  });
  // Ink on the line, ink 8px off it, and gaps along it: a row of ticks.
  expect(r.on).toBeGreaterThan(20);
  expect(r.gaps).toBeGreaterThan(20);
  expect(r.off).toBeGreaterThan(10);
});

test("a hairline stays one pixel however the shape is scaled", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const S = window.Flashy.Stroke;
    /* Through the real formula at the scales the stage would hand it: the
       whole point of the style is that this number comes out the same screen
       width every time. */
    return [1, 2, 4, 10].map((k) => +(S.width("hairline", 3, "normal", k, k) * k).toFixed(6));
  });
  expect(r).toEqual([1, 1, 1, 1]);
});
