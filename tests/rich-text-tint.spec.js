// Render as HTML, auto-kern, baseline shift and super/subscript; per-layer
// tint; tween Snap and Sync and the registration point they need; and filter
// presets.
//
// Two of these were flags the save format already carried and nothing read:
// `renderAsHtml` was on every text object from the day text fields were added
// and a field marked as markup still drew its tags. The rest are the Flash
// options that only make sense once something else exists to hang them on —
// Snap needs a registration point, Sync needs a graphic symbol's own
// timeline, a preset needs a filter stack.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction, runExportedHTML } from "./helpers.js";

const kf = (objects, over = {}) => ({
  index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
  objects, ...over,
});

const text = (t, over = {}) => ({
  type: "text", x: 20, y: 20, width: 260, height: 120,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  text: t, font: "Arial", fontSize: 24, textAlign: "left", lineHeight: 1.2,
  textType: "dynamic", instanceName: "t",
  fillColor: "#000000", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

const rect = (over = {}) => ({
  type: "rect", x: 20, y: 20, width: 100, height: 100,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#FFFFFF", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

function docWith(objs, layerOver = {}) {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false,
               keyframes: [kf(objs)], ...layerOver }],
    library: {},
  };
}

const pixel = (page, x, y) =>
  page.evaluate(({ x, y }) => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 300, 200);
    const d = cv.getContext("2d").getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }, { x, y });

/* ------------------------------------------------------------------ *
 * The markup parser
 * ------------------------------------------------------------------ */

test("the parser produces styled runs and decodes entities", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const R = window.Flashy.RichText;
    const paras = R.parse('Score: <font color="#FF0000" size="32"><b>42</b></font>' +
                          '<br>next &amp; last', { color: 0 });
    return paras.map((p) => ({
      align: p.align,
      runs: p.runs.map((r) => ({ t: r.text, b: r.bold, c: r.color, s: r.size })),
    }));
  });
  expect(out).toHaveLength(2);
  expect(out[0].runs[0]).toMatchObject({ t: "Score: ", b: false });
  // The styles compose: bold inside a coloured, resized font.
  expect(out[0].runs[1]).toMatchObject({ t: "42", b: true, c: 0xFF0000, s: 32 });
  expect(out[1].runs[0].t).toBe("next & last");
});

test("paragraph alignment and line breaks count the way Flash counted them", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const R = window.Flashy.RichText;
    const shape = (t) => R.parse(t).map((p) =>
      ({ a: p.align, t: p.runs.map((r) => r.text).join("") }));
    return {
      paras: shape('<p align="center">mid</p><p align="right">end</p>'),
      br: shape("a<br>b"),
      // A trailing <br> IS a blank line; a trailing </p> is not.
      trailingBr: shape("a<br>"),
      plain: shape("plain"),
    };
  });
  expect(out.paras).toEqual([{ a: "center", t: "mid" }, { a: "right", t: "end" }]);
  expect(out.br).toHaveLength(2);
  expect(out.trailingBr).toHaveLength(2);
  expect(out.plain).toEqual([{ a: "left", t: "plain" }]);
});

test("a malformed value still draws, because a field's value is data", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const R = window.Flashy.RichText;
    return {
      // Unclosed tags, a stray close, and a tag nobody has heard of.
      unclosed: R.parse("<b>bold forever").map((p) => p.runs.map((r) => r.text)),
      stray: R.parse("plain</b></i></p>").map((p) => p.runs.map((r) => r.text)),
      unknown: R.parse("<blink>x</blink>y").map((p) => p.runs.map((r) => r.text)),
    };
  });
  expect(out.unclosed[0]).toEqual(["bold forever"]);
  expect(out.stray[0]).toEqual(["plain"]);
  // An unknown tag is dropped, not drawn: showing a tag the user did not
  // write is worse than ignoring one the parser does not know.
  expect(out.unknown.flat().join("")).toBe("xy");
});

/* ------------------------------------------------------------------ *
 * Render as HTML, on the stage and in the exports
 * ------------------------------------------------------------------ */

test("a field marked as HTML draws its runs, not its tags", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    text('<font color="#FF0000">RED</font>', { renderAsHtml: true, fontSize: 40 }),
  ]));

  /* Somewhere in the first line there is red ink. Before this flag was read,
     the field drew the literal string "<font color..." in black. */
  const scan = await page.evaluate(() => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 300, 200);
    const d = cv.getContext("2d").getImageData(0, 0, 300, 200).data;
    let red = 0, black = 0;
    for (let i = 0; i < 300 * 200; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      if (r > 120 && g < 80 && b < 80) red++;
      if (r < 60 && g < 60 && b < 60) black++;
    }
    return { red, black };
  });
  expect(scan.red).toBeGreaterThan(20);
  // And no literal tag text, which would be black.
  expect(scan.black).toBeLessThan(scan.red);
});

test("HTML is off by default, so an existing document is untouched", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("<b>x</b>", { fontSize: 40 })]));
  const scan = await page.evaluate(() => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 300, 200);
    const d = cv.getContext("2d").getImageData(0, 0, 300, 200).data;
    let black = 0;
    for (let i = 0; i < 300 * 200; i++) if (d[i * 4] < 60) black++;
    return black;
  });
  // Seven characters of literal markup is a lot more ink than one bold x.
  expect(scan).toBeGreaterThan(60);
});

test("the SVG export emits one tspan per run, from the same parser", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    text('a<font color="#00FF00" size="30"><b>B</b></font>c', { renderAsHtml: true }),
  ]));
  const svg = await downloadFromAction(page, "exportSVG");

  expect(svg).toContain('fill="#00ff00"');
  expect(svg).toContain('font-size="30"');
  expect(svg).toContain('font-weight="bold"');
  // The literal tags must not be in there as text.
  expect(svg).not.toContain("&lt;font");
});

test("the exported player renders the markup too", async ({ context, page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    text('<font color="#FF0000">RED</font>', { renderAsHtml: true, fontSize: 40 }),
  ]));
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() => !!window.__stage);

  const red = await out.evaluate(() => {
    window.__stage.stop();
    window.__stage.root.gotoAndStop(1);
    window.__stage._render();
    const g = document.getElementById("stage")
      .getContext("2d", { willReadFrequently: true });
    const d = g.getImageData(0, 0, 300, 200).data;
    let n = 0;
    for (let i = 0; i < 300 * 200; i++) {
      if (d[i * 4] > 120 && d[i * 4 + 1] < 80 && d[i * 4 + 2] < 80) n++;
    }
    return n;
  });
  // The export ships flashy.js, so the markup runs through the same TextField.
  expect(red).toBeGreaterThan(20);
  expect(errors).toEqual([]);
  await out.close();
});

/* ------------------------------------------------------------------ *
 * Kerning, baseline shift, super and subscript
 * ------------------------------------------------------------------ */

test("auto-kern chooses between the two draw paths, and measures to match", async ({ page }) => {
  await openEditor(page);
  const widths = await page.evaluate(() => {
    const cv = document.createElement("canvas");
    const ctx = cv.getContext("2d");
    const mk = (kerning) => {
      const f = new window.Flashy.TextField("AVWAVA", {
        font: "48px Georgia", kerning,
      });
      ctx.font = f.font;
      return f.measure(ctx, "AVWAVA");
    };
    return { kerned: mk(true), unkerned: mk(false) };
  });
  /* Unkerned is the sum of the individual advances; kerned is what the font
     says the pairs should be. They must not be measured the same way, or a
     centred unkerned line lands in the wrong place. */
  expect(widths.unkerned).toBeGreaterThanOrEqual(widths.kerned);
  expect(widths.kerned).toBeGreaterThan(0);
});

test("superscript is a smaller face lifted off the baseline", async ({ page }) => {
  await openEditor(page);
  const met = await page.evaluate(() => {
    const mk = (scriptStyle, baselineShift) =>
      new window.Flashy.TextField("x", {
        font: "30px Arial", scriptStyle, baselineShift,
      }).scriptMetrics();
    return {
      normal: mk("normal", 0),
      sup: mk("super", 0),
      sub: mk("sub", 0),
      shifted: mk("normal", 8),
    };
  });
  expect(met.normal).toMatchObject({ shift: 0, scale: 1 });
  // Up and smaller...
  expect(met.sup.shift).toBeGreaterThan(0);
  expect(met.sup.size).toBeLessThan(30);
  // ...down and smaller.
  expect(met.sub.shift).toBeLessThan(0);
  expect(met.sub.size).toBeLessThan(30);
  // A plain shift does not resize anything.
  expect(met.shifted).toMatchObject({ shift: 8, scale: 1 });
});

test("a baseline shift moves the ink up the stage", async ({ page }) => {
  await openEditor(page);
  const topRow = async (shift) => {
    await loadDoc(page, docWith([
      text("Hg", { fontSize: 40, baselineShift: shift, textType: "static" }),
    ]));
    return page.evaluate(() => {
      const cv = window._flashyAI.renderFrameToCanvas(1, 300, 200);
      const d = cv.getContext("2d").getImageData(0, 0, 300, 200).data;
      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 300; x++) if (d[(y * 300 + x) * 4] < 80) return y;
      }
      return -1;
    });
  };
  const flat = await topRow(0);
  const lifted = await topRow(12);
  expect(flat).toBeGreaterThan(0);
  // Positive lifts, which on a downward y axis means a smaller row.
  expect(lifted).toBeLessThan(flat);
});

test("the text options survive a save and reopen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("x", {
    renderAsHtml: true, kerning: false, baselineShift: -4, scriptStyle: "sub",
  })]));
  const back = await page.evaluate(() => {
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    return { html: o.renderAsHtml, kerning: o.kerning,
             shift: o.baselineShift, script: o.scriptStyle };
  });
  expect(back).toEqual({ html: true, kerning: false, shift: -4, script: "sub" });
});

/* ------------------------------------------------------------------ *
 * Per-layer tint
 * ------------------------------------------------------------------ */

test("a layer tint washes everything the layer draws", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()], {
    tint: true, tintColor: "#FF0000", tintAmount: 1,
  }));

  // A white rectangle under a full red tint is red.
  const px = await pixel(page, 60, 60);
  expect(px[0]).toBeGreaterThan(200);
  expect(px[1]).toBeLessThan(80);
  expect(px[2]).toBeLessThan(80);
});

test("the tint is a view, so switching it off loses nothing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()], {
    tint: true, tintColor: "#FF0000", tintAmount: 1,
  }));

  const own = await page.evaluate(() => {
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    // The DOCUMENT object is untouched: the tint lives on a prototype view.
    return o.colorEffect;
  });
  expect(own).toBeFalsy();

  await page.evaluate(() => {
    const l = window._flashyAI.currentLayers()[0];
    l.tint = false;
    window._flashyAI.fullRefresh();
  });
  const px = await pixel(page, 60, 60);
  expect(px[1]).toBeGreaterThan(200);
});

test("a tint composes over an object's own colour effect", async ({ page }) => {
  await openEditor(page);
  const composed = await page.evaluate(() => {
    const F = window.Flashy.Filters;
    // Halve the brightness, then tint fully to red.
    const a = F.colorEffect({ mode: "advanced", rMul: 0.5, gMul: 0.5, bMul: 0.5 });
    const b = F.colorEffect({ mode: "tint", color: 0xFF0000, amount: 1 });
    return F.composeColor(a, b);
  });
  /* A full tint multiplies by 0 and offsets to the colour, so composing it
     over anything gives the tint -- which is what "a tint washes the layer"
     has to mean for the result not to depend on what was underneath. */
  expect(composed.rMul).toBeCloseTo(0, 6);
  expect(composed.rOff).toBeCloseTo(255, 3);
  expect(composed.gOff).toBeCloseTo(0, 3);
});

test("a layer tint reaches the SVG export and the player", async ({ context, page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()], {
    tint: true, tintColor: "#FF0000", tintAmount: 1,
  }));

  // The SVG carries it as the per-channel transform it is.
  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).toContain("feComponentTransfer");

  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() => !!window.__stage);
  const px = await out.evaluate(() => {
    window.__stage.stop();
    window.__stage.root.gotoAndStop(1);
    window.__stage._render();
    const g = document.getElementById("stage")
      .getContext("2d", { willReadFrequently: true });
    const d = g.getImageData(60, 60, 1, 1).data;
    return [d[0], d[1], d[2]];
  });
  /* The player builds its own display list, so a tint taught only to
     frameObjects would show on the stage and vanish in the export. */
  expect(px[0]).toBeGreaterThan(200);
  expect(px[1]).toBeLessThan(80);
  expect(errors).toEqual([]);
  await out.close();
});

test("a tint survives a save and reopen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()], {
    tint: true, tintColor: "#3366CC", tintAmount: 0.4,
  }));
  const back = await page.evaluate(() => {
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const l = window._flashyAI.currentLayers()[0];
    return { tint: l.tint, color: l.tintColor, amount: l.tintAmount };
  });
  expect(back).toEqual({ tint: true, color: "#3366CC", amount: 0.4 });
});

/* ------------------------------------------------------------------ *
 * The registration point, Snap and Sync
 * ------------------------------------------------------------------ */

test("the registration point defaults to the centre", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      dflt: F.regPoint({}),
      set: F.regPoint({ regX: 0, regY: 1 }),
    };
  });
  // The centre, which is what Flashy has always used -- so every existing
  // document keeps exactly the geometry it had.
  expect(r.dflt).toEqual({ x: 0.5, y: 0.5 });
  expect(r.set).toEqual({ x: 0, y: 1 });
});

test("Snap rides the guide by the registration point, not the centre", async ({ page }) => {
  await openEditor(page);
  // A guide layer with a straight horizontal path, and a square tweening
  // along it.
  const guided = (snap, regY) => ({
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 11,
    library: {},
    layers: [
      { name: "Guide", visible: true, locked: false, layerType: "motionguide",
        keyframes: [{ index: 1, duration: 11, tweenType: "none", easing: "linear",
          script: "", objects: [{
            type: "pencil", x: 20, y: 150, width: 300, height: 1,
            rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
            points: [0, 0, 300, 0],
            fillColor: "#000000", fillAlpha: 1, fillType: "none",
            strokeColor: "#00CC00", strokeAlpha: 1, strokeWidth: 1,
            strokeStyle: "solid",
          }] }] },
      { name: "Car", visible: true, locked: false, layerType: "guided",
        keyframes: [
          { index: 1, duration: 10, tweenType: "motion", easing: "linear",
            script: "", tweenSnap: snap, objects: [{
              type: "rect", x: 0, y: 0, width: 40, height: 40,
              rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, regX: 0.5, regY,
              fillColor: "#CC3344", fillAlpha: 1, fillType: "solid",
              strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0,
              strokeStyle: "none",
            }] },
          { index: 11, duration: 1, tweenType: "none", easing: "linear",
            script: "", objects: [{
              type: "rect", x: 300, y: 0, width: 40, height: 40,
              rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, regX: 0.5, regY,
              fillColor: "#CC3344", fillAlpha: 1, fillType: "solid",
              strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0,
              strokeStyle: "none",
            }] },
        ] },
    ],
  });

  const yAt = async (snap, regY) => {
    await loadDoc(page, guided(snap, regY));
    return page.evaluate(() => {
      const F = window._flashyAI;
      const objs = F.frameObjects(F.currentLayers(), 6);
      return objs.length ? objs[objs.length - 1].y : null;
    });
  };

  // Off: the object's centre sits on the path at y=150, so its top is 130.
  expect(await yAt(false, 1)).toBeCloseTo(130, 0);
  /* On, with the registration point at the BOTTOM: the bottom edge sits on
     the path, so the top is 40 higher. A car's wheels on the road rather than
     its middle. */
  expect(await yAt(true, 1)).toBeCloseTo(110, 0);
});

test("Sync stretches a graphic symbol over the tween instead of looping it", async ({ page }) => {
  await openEditor(page);
  const frames = await page.evaluate(() => {
    const F = window._flashyAI;
    const sym = { totalFrames: 12 };
    const base = { type: "symbol", symbolName: "Walk", symbolBehavior: "graphic",
                   firstFrame: 1, loopMode: "loop" };
    const unsynced = [];
    const synced = [];
    for (let f = 1; f <= 24; f++) {
      unsynced.push(F.symbolDisplayFrame(base, sym, f, 1));
      synced.push(F.symbolDisplayFrame(
        Object.assign({}, base, { _syncSpan: 24 }), sym, f, 1));
    }
    return { unsynced, synced };
  });
  // Unsynced: a frame per frame, so a 12-frame cycle goes round twice.
  expect(frames.unsynced[0]).toBe(1);
  expect(frames.unsynced[12]).toBe(1);
  expect(frames.unsynced[23]).toBe(12);
  /* Synced: the 12 frames are spread over all 24, so halfway through the
     tween the symbol is halfway through its own animation and it never
     repeats. */
  expect(frames.synced[0]).toBe(1);
  expect(frames.synced[12]).toBeGreaterThan(5);
  expect(frames.synced[12]).toBeLessThan(9);
  expect(frames.synced[23]).toBe(12);
});

test("Snap and Sync survive a save and reopen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 11,
    library: {},
    layers: [{ name: "L", visible: true, locked: false, keyframes: [
      { index: 1, duration: 10, tweenType: "motion", easing: "linear",
        script: "", tweenSnap: true, tweenSync: true,
        objects: [rect({ regX: 0.25, regY: 0.75 })] },
      { index: 11, duration: 1, tweenType: "none", easing: "linear",
        script: "", objects: [rect({ x: 200, regX: 0.25, regY: 0.75 })] },
    ] }],
  });
  const back = await page.evaluate(() => {
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const l = window._flashyAI.currentLayers()[0];
    const k = l.getKeyframeAt(1);
    return { snap: k.tweenSnap, sync: k.tweenSync,
             regX: k.objects[0].regX, regY: k.objects[0].regY };
  });
  expect(back).toEqual({ snap: true, sync: true, regX: 0.25, regY: 0.75 });
});

/* ------------------------------------------------------------------ *
 * Filter presets
 * ------------------------------------------------------------------ */

test("a preset is a saved stack that can be dropped on anything else", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect(), rect({ x: 160 })]));

  const saved = await page.evaluate(() => {
    const F = window._flashyAI;
    F.clearShortcutOverrides && null;
    const objs = F.currentLayers()[0].getKeyframeAt(1).objects;
    objs[0].filters = [
      { type: "glow", enabled: true, blur: 8, color: 0xFF3366, alpha: 1, strength: 2 },
      { type: "blur", enabled: true, blurX: 3, blurY: 3 },
    ];
    return F.saveFilterPreset("Neon", objs[0].filters);
  });
  expect(saved.ok).toBe(true);

  const applied = await page.evaluate(() => {
    const F = window._flashyAI;
    const objs = F.currentLayers()[0].getKeyframeAt(1).objects;
    F.setSelection([objs[1]]);
    const n = F.applyFilterPreset("Neon");
    return { n, types: objs[1].filters.map((f) => f.type),
             shared: objs[1].filters === objs[0].filters };
  });
  expect(applied.n).toBe(1);
  expect(applied.types).toEqual(["glow", "blur"]);
  /* A deep copy per object: sharing one array would make editing one
     instance's blur change every other instance's too. */
  expect(applied.shared).toBe(false);

  await page.evaluate(() => window._flashyAI.deleteFilterPreset("Neon"));
});

test("a preset refuses to be saved empty or nameless", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      nameless: F.saveFilterPreset("   ", [{ type: "blur" }]),
      empty: F.saveFilterPreset("Nothing", []),
    };
  });
  expect(out.nameless.ok).toBe(false);
  expect(out.nameless.why).toContain("name");
  expect(out.empty.ok).toBe(false);
  expect(out.empty.why).toContain("no filters");
});

test("a preset outlives a reload, because it belongs to the person", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => window._flashyAI.saveFilterPreset("Kept",
    [{ type: "glow", enabled: true, blur: 4, color: 0x00FF00, alpha: 1, strength: 1 }]));

  await page.reload();
  await page.waitForFunction(() => !!window._flashyAI);
  const names = await page.evaluate(() => Object.keys(window._flashyAI.filterPresets()));
  expect(names).toContain("Kept");

  await page.evaluate(() => window._flashyAI.deleteFilterPreset("Kept"));
  const after = await page.evaluate(() => Object.keys(window._flashyAI.filterPresets()));
  expect(after).not.toContain("Kept");
});

test("applying a preset with nothing selected changes nothing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));
  await page.evaluate(() => window._flashyAI.saveFilterPreset("P",
    [{ type: "blur", enabled: true, blurX: 2, blurY: 2 }]));

  const n = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([]);
    return F.applyFilterPreset("P");
  });
  expect(n).toBe(0);
  await page.evaluate(() => window._flashyAI.deleteFilterPreset("P"));
});
