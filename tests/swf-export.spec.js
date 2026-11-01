// Writing a .swf.
//
// Flashy has read `.swf` and `.fla` since early on and could not write either,
// which made the import a one-way door: a movie could come in and never go
// back out.
//
// Every spec here round-trips through the project's OWN parser
// (flashy-swf.js), which is the point: the writer is built to match what the
// reader reads, so the reader is its oracle. Two independent interpretations
// of the same spec would have no such check — and SWF is a format where a
// single misplaced bit makes everything after it unreadable.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc } from "./helpers.js";

const obj = (type, over = {}) => ({
  type, x: 0, y: 0, width: 60, height: 40,
  rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, alpha: 1,
  fillColor: "#FF0000", fillAlpha: 1, fillType: "solid",
  strokeColor: "#0000FF", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

function docWith(objs, extra = {}) {
  return {
    width: 300, height: 200, fps: 12, backgroundColor: "#102030", totalFrames: 1,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: objs,
      }],
    }],
    library: {},
    ...extra,
  };
}

/** Write the open document as a SWF and read it back with the real parser. */
const roundTrip = (page) =>
  page.evaluate(async () => {
    const r = window._flashyAI.exportSWF();
    if (!r.ok) return { ok: false, reason: r.reason };
    const parsed = await window.Flashy.SWF.parse(r.bytes.buffer);
    const shapes = {};
    Object.keys(parsed.characters || {}).forEach((id) => {
      const c = parsed.characters[id];
      const it = (c.items || [])[0] || {};
      shapes[id] = {
        kind: c.kind,
        fill: it.fill ? it.fill.type : null,
        fillColor: it.fill ? it.fill.color : null,
        fillAlpha: it.fill ? it.fill.alpha : null,
        strokeWidth: it.stroke ? it.stroke.width : null,
        strokeColor: it.stroke ? it.stroke.color : null,
        pathLength: (it.path || []).length,
        itemCount: (c.items || []).length,
        frameCount: c.frameCount != null ? c.frameCount : null,
      };
    });
    const frames = (parsed.timeline.frames || []).map((f) => ({
      label: f.label,
      commands: f.commands.map((c) => ({
        type: c.type, id: c.id, depth: c.depth,
        place: c.matrix ? window.Flashy.SWF.decomposeMatrix(c.matrix) : null,
        alpha: c.colorTransform && c.colorTransform.mul
          ? c.colorTransform.mul[3] : null,
        mulRGB: c.colorTransform && c.colorTransform.mul
          ? c.colorTransform.mul.slice(0, 3) : null,
      })),
    }));
    return {
      ok: true,
      bytes: r.bytes.length,
      report: r.report,
      missing: r.missing,
      signature: String.fromCharCode(r.bytes[0], r.bytes[1], r.bytes[2]),
      version: r.bytes[3],
      declaredLength: r.bytes[4] | (r.bytes[5] << 8) |
                      (r.bytes[6] << 16) | (r.bytes[7] << 24),
      doc: {
        width: parsed.width, height: parsed.height,
        fps: parsed.fps, frameCount: parsed.frameCount,
        background: parsed.backgroundColor,
        warnings: parsed.warnings,
      },
      shapes, frames,
    };
  });

/* ------------------------------------------------------------------ *
 * The file itself
 * ------------------------------------------------------------------ */

test("the header describes the file it is on the front of", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([obj("rect")]));
  const r = await roundTrip(page);

  expect(r.signature).toBe("FWS");
  expect(r.version).toBeGreaterThanOrEqual(6);
  // The length field covers the whole file, header included. A wrong one makes
  // some players truncate and others refuse the file outright.
  expect(r.declaredLength).toBe(r.bytes);
  // And the project's own parser reads it without complaint.
  expect(r.doc.warnings).toEqual([]);
  expect(errors).toEqual([]);
});

test("the stage comes back at its own size, rate and colour", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([obj("rect")]));
  const r = await roundTrip(page);
  // In twips in the file, in pixels here: getting that conversion wrong is the
  // classic SWF bug, and the symptom is a movie twenty times too big.
  expect(r.doc.width).toBe(300);
  expect(r.doc.height).toBe(200);
  expect(r.doc.fps).toBe(12);
  expect(r.doc.background).toBe(0x102030);
});

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

test("a rectangle round-trips as a closed filled path", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([obj("rect", { fillColor: "#CC3344", fillAlpha: 0.75 })]));
  const r = await roundTrip(page);

  const shape = r.shapes[Object.keys(r.shapes)[0]];
  expect(shape.kind).toBe("shape");
  expect(shape.fill).toBe("solid");
  expect(shape.fillColor).toBe(0xCC3344);
  expect(shape.fillAlpha).toBeCloseTo(0.75, 2);
  // Move + four edges + close.
  expect(shape.pathLength).toBe(16);
  expect(errors).toEqual([]);
});

test("an oval stays a curve rather than being flattened", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([obj("oval")]));
  const r = await roundTrip(page);
  const shape = r.shapes[Object.keys(r.shapes)[0]];
  /* A SWF curved edge IS a quadratic, so an oval needs no flattening at all:
     four quadratics, which stay smooth at any zoom. A flattened one would be
     dozens of line commands. */
  expect(shape.pathLength).toBe(24);
});

test("a stroke comes back as a stroke, not as a filled outline", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([obj("pencil", {
    points: [0, 0, 30, 20, 60, 0],
    fillType: "none", strokeWidth: 3, strokeStyle: "solid", strokeColor: "#224466",
  })]));
  const r = await roundTrip(page);
  const shape = r.shapes[Object.keys(r.shapes)[0]];
  expect(shape.fill).toBeNull();
  // Widths are in twips in the file: 3px is 60.
  expect(shape.strokeWidth).toBe(60);
  expect(shape.strokeColor).toBe(0x224466);
  expect(errors).toEqual([]);
});

test("a brush stroke keeps the width it is drawn at", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([obj("brush", {
    points: [0, 0, 40, 10], fillColor: "#884400", strokeWidth: 2, fillType: "none",
  })]));
  const r = await roundTrip(page);
  const shape = r.shapes[Object.keys(r.shapes)[0]];
  // The canvas painter draws a brush at three times its stroke width, and its
  // colour lives in fillColor — so the SWF has to agree on both.
  expect(shape.strokeWidth).toBe(2 * 3 * 20);
  expect(shape.strokeColor).toBe(0x884400);
});

test("a gradient fill survives with its own matrix", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([obj("rect", {
    fillType: "linear",
    fillStops: [0, 0xFF0000, 1, 1, 0x0000FF, 1],
    fillGrad: [0, 0, 1, 0],
  })]));
  const r = await roundTrip(page);
  const shape = r.shapes[Object.keys(r.shapes)[0]];
  expect(shape.fill).toBe("linear");
  expect(errors).toEqual([]);

  // The gradient's end points land on the shape, not somewhere off the stage:
  // SWF maps a gradient through a matrix onto a fixed 32768-twip square, and
  // without that matrix every gradient comes out as a band in the middle of
  // the movie.
  const ends = await page.evaluate(async () => {
    const r2 = window._flashyAI.exportSWF();
    const p = await window.Flashy.SWF.parse(r2.bytes.buffer);
    const c = p.characters[Object.keys(p.characters)[0]];
    const fill = c.items[0].fill;
    // It takes the gradient's MATRIX and returns the transformed ends of the
    // standard 32768-twip square, in pixels.
    return window.Flashy.SWF.gradientEndPoints(fill.matrix);
  });
  // The shape is 60 wide and centre-origin, so its edges are at ±30: the
  // gradient has to run across the shape, not across the stage.
  expect(Math.abs(ends.from.x)).toBeLessThan(40);
  expect(Math.abs(ends.to.x)).toBeLessThan(40);
  expect(ends.to.x - ends.from.x).toBeCloseTo(60, 0);
  /* Horizontal, because fillGrad runs (0,0)→(1,0). Its y sits on the box's top
     edge, exactly as createLinearGradient's own end points do on the canvas —
     for a linear gradient the band direction is what matters, not where along
     it the line is drawn, so the two agree. */
  expect(ends.from.y).toBeCloseTo(ends.to.y, 3);
});

test("a traced path's curves and straights both survive", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  const r = await page.evaluate(async () => {
    const F = window._flashyAI;
    const T = window.FlashyTrace;
    const o = new F.EditorObject("path");
    // move, quad, line, close — one of each kind of record.
    o.path = [T.CMD.MOVE, 0, 0, T.CMD.QUAD, 30, 40, 60, 0, T.CMD.LINE, 60, 40, T.CMD.CLOSE];
    o.pathW = 60; o.pathH = 40;
    o.x = 10; o.y = 10; o.width = 60; o.height = 40;
    o.fillColor = "#336699"; o.fillType = "solid";
    o.strokeWidth = 0; o.strokeStyle = "none";
    F.currentLayers()[0].getKeyframeAt(1).objects.push(o);
    F.fullRefresh();
    const out = F.exportSWF();
    const p = await window.Flashy.SWF.parse(out.bytes.buffer);
    const c = p.characters[Object.keys(p.characters)[0]];
    const T2 = window.Flashy.SWF.CMD;
    let quads = 0, lines = 0;
    const path = c.items[0].path;
    for (let i = 0; i < path.length;) {
      const cmd = path[i];
      if (cmd === T2.MOVE) i += 3;
      else if (cmd === T2.LINE) { lines++; i += 3; }
      else if (cmd === T2.QUAD) { quads++; i += 5; }
      else i += 1;
    }
    return { quads, lines, warnings: p.warnings };
  });
  // The quadratic stayed a quadratic rather than being approximated.
  expect(r.quads).toBe(1);
  expect(r.lines).toBeGreaterThanOrEqual(2);
  expect(r.warnings).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * Placement
 * ------------------------------------------------------------------ */

test("an object lands where it was, about its own centre", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([obj("rect", { x: 100, y: 50 })]));
  const r = await roundTrip(page);
  const place = r.frames[0].commands[0].place;
  // The painter transforms about an object's centre, so the SWF matrix has to
  // put the centre where the object is: 100 + 30, 50 + 20.
  expect(place.x).toBeCloseTo(130, 1);
  expect(place.y).toBeCloseTo(70, 1);
  expect(errors).toEqual([]);
});

test("rotation and scale survive the matrix", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([obj("rect", {
    x: 20, y: 20, rotation: 30, scaleX: 2, scaleY: 0.5,
  })]));
  const r = await roundTrip(page);
  const place = r.frames[0].commands[0].place;
  // SWF has no rotation field — the rotate slots are the off-diagonal terms
  // of the 2x2 — so this has to come back out of a decomposition.
  expect((place.rotation * 180) / Math.PI).toBeCloseTo(30, 1);
  expect(place.scaleX).toBeCloseTo(2, 3);
  expect(place.scaleY).toBeCloseTo(0.5, 3);
});

test("alpha survives as a colour transform, and the colour is untouched", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([obj("rect", { alpha: 0.4 })]));
  const r = await roundTrip(page);
  const cmd = r.frames[0].commands[0];
  expect(cmd.alpha).toBeCloseTo(0.4, 2);
  /* The red, green and blue multipliers must be 1. They are 8.8 fixed point,
     so 1.0 is 256 — which does not fit in the 8-bit field the format's name
     suggests, and writing it there made every channel come back as zero. */
  expect(cmd.mulRGB).toEqual([1, 1, 1]);
  expect(errors).toEqual([]);
});

test("a fully opaque object carries no colour transform at all", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([obj("rect", { alpha: 1 })]));
  const r = await roundTrip(page);
  // Nothing to say, so nothing is written: a transform that multiplies by one
  // is bytes in every frame for no effect.
  expect(r.frames[0].commands[0].alpha).toBeNull();
});

test("z-order is preserved as depth", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    obj("rect", { x: 0, fillColor: "#AA0000" }),
    obj("rect", { x: 40, fillColor: "#00AA00" }),
    obj("rect", { x: 80, fillColor: "#0000AA" }),
  ]));
  const r = await roundTrip(page);
  const depths = r.frames[0].commands.map((c) => c.depth);
  expect(depths).toEqual([1, 2, 3]);
  // The first object drawn is the lowest depth, which is the back.
  const ids = r.frames[0].commands.map((c) => c.id);
  expect(r.shapes[ids[0]].fillColor).toBe(0xAA0000);
  expect(r.shapes[ids[2]].fillColor).toBe(0x0000AA);
});

/* ------------------------------------------------------------------ *
 * Frames, labels and symbols
 * ------------------------------------------------------------------ */

test("frames and labels come back, and a comment does not", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, {
    width: 200, height: 100, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 3,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [
        { index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
          label: "intro", labelType: "name", objects: [obj("rect")] },
        { index: 2, duration: 1, tweenType: "none", easing: "linear", script: "",
          label: "fix this", labelType: "comment", objects: [obj("rect", { x: 50 })] },
        { index: 3, duration: 1, tweenType: "none", easing: "linear", script: "",
          label: "end", labelType: "name", objects: [obj("rect", { x: 100 })] },
      ],
    }],
    library: {},
  });
  const r = await roundTrip(page);
  expect(r.doc.frameCount).toBe(3);
  expect(r.frames).toHaveLength(3);
  expect(r.frames[0].label).toBe("intro");
  // A comment is an authoring note, not a script target: exporting it as a
  // label would make gotoAndPlay("fix this") a working instruction.
  expect(r.frames[1].label).toBeNull();
  expect(r.frames[2].label).toBe("end");
  expect(errors).toEqual([]);
});

test("a symbol becomes a sprite with its own timeline", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([
    obj("symbol", { symbolName: "Ball", width: 40, height: 40, x: 50, y: 50 }),
  ], {
    library: {
      Ball: {
        totalFrames: 2, behavior: "movieclip",
        layers: [{
          name: "L1", visible: true, locked: false,
          keyframes: [
            { index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
              objects: [obj("rect", { width: 40, height: 40, fillColor: "#00FF00" })] },
            { index: 2, duration: 1, tweenType: "none", easing: "linear", script: "",
              objects: [obj("oval", { width: 40, height: 40, fillColor: "#0000FF" })] },
          ],
        }],
      },
    },
  }));
  const r = await roundTrip(page);

  const sprite = Object.keys(r.shapes).map((k) => r.shapes[k])
    .filter((c) => c.kind === "sprite")[0];
  expect(sprite).toBeTruthy();
  expect(sprite.frameCount).toBe(2);
  expect(r.report.sprites).toBe(1);
  // The instance is placed, and the shapes inside the sprite are defined too.
  expect(r.frames[0].commands).toHaveLength(1);
  expect(r.report.shapes).toBe(2);
  expect(errors).toEqual([]);
});

test("a symbol used twice is defined once", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    obj("symbol", { symbolName: "Ball", width: 40, height: 40, x: 10 }),
    obj("symbol", { symbolName: "Ball", width: 40, height: 40, x: 100 }),
  ], {
    library: {
      Ball: {
        totalFrames: 1, behavior: "graphic",
        layers: [{
          name: "L1", visible: true, locked: false,
          keyframes: [{ index: 1, duration: 1, tweenType: "none", easing: "linear",
                        script: "", objects: [obj("rect", { width: 40, height: 40 })] }],
        }],
      },
    },
  }));
  const r = await roundTrip(page);
  expect(r.report.sprites).toBe(1);
  // Two placements of one character.
  const ids = r.frames[0].commands.map((c) => c.id);
  expect(ids[0]).toBe(ids[1]);
});

test("a symbol containing itself stops instead of recursing forever", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([
    obj("symbol", { symbolName: "Loop", width: 40, height: 40 }),
  ], {
    library: {
      Loop: {
        totalFrames: 1, behavior: "graphic",
        layers: [{
          name: "L1", visible: true, locked: false,
          keyframes: [{
            index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
            objects: [obj("symbol", { symbolName: "Loop", width: 20, height: 20 })],
          }],
        }],
      },
    },
  }));
  // The id is reserved before the sprite is built, so the inner reference
  // resolves to the one already in flight rather than defining another.
  const r = await roundTrip(page);
  expect(r.ok).toBe(true);
  expect(r.report.sprites).toBe(1);
  expect(errors).toEqual([]);
});

test("a guide layer is not in the SWF either", async ({ page }) => {
  await openEditor(page);
  const d = docWith([obj("rect", { fillColor: "#AA0000" })]);
  d.layers.push({
    name: "Reference", visible: true, locked: false, layerType: "guide",
    keyframes: [{ index: 1, duration: 1, tweenType: "none", easing: "linear",
                  script: "", objects: [obj("rect", { fillColor: "#00AA00" })] }],
  });
  await loadDoc(page, d);
  const r = await roundTrip(page);
  // One shape, not two: a guide layer is reference art in every output.
  expect(r.report.shapes).toBe(1);
  const only = r.shapes[Object.keys(r.shapes)[0]];
  expect(only.fillColor).toBe(0xAA0000);
});

/* ------------------------------------------------------------------ *
 * The report
 * ------------------------------------------------------------------ */

test("the writer says what it left out", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([
    obj("rect"),
    obj("text", { text: "hello", x: 100 }),
    obj("bitmap", { bitmapAsset: "Pic", x: 150 }),
  ], {
    bitmaps: { Pic: { name: "Pic", mediaType: "image/png", data: "AAAA", width: 10, height: 10 } },
  }));
  const r = await roundTrip(page);

  expect(r.report.skipped.text).toBe(1);
  expect(r.report.skipped.bitmap).toBe(1);
  // A quiet omission in an export is the worst kind, so the report names what
  // is missing in words rather than leaving it to be discovered.
  expect(r.missing).toContain("1 text block");
  expect(r.missing).toContain("1 bitmap");
  // And what WAS written is still correct.
  expect(r.report.shapes).toBe(1);
  expect(r.frames[0].commands).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("a document with nothing missing says nothing is missing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([obj("rect"), obj("oval", { x: 80 })]));
  const r = await roundTrip(page);
  expect(r.missing).toBe("");
});

test("the dialog warns before the download, not after", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([obj("text", { text: "hello" })]));
  await page.evaluate(() => window._flashyEditor.doAction("exportSWF"));
  // The point of the warning is to stop somebody shipping a file they think
  // is complete, so it has to come first.
  await expect(page.locator(".fy-dialog")).toContainText("will NOT contain");
  await expect(page.locator(".fy-dialog")).toContainText("1 text block");
  await expect(page.locator(".fy-dialog-foot button").last()).toContainText("Export anyway");
  expect(errors).toEqual([]);
});

test("Export as SWF downloads a file", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([obj("rect")]));
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.evaluate(() => window._flashyEditor.doAction("exportSWF")),
  ]);
  expect(download.suggestedFilename()).toBe("animation.swf");
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const buf = Buffer.concat(chunks);
  expect(buf.slice(0, 3).toString("ascii")).toBe("FWS");
  expect(buf.readUInt32LE(4)).toBe(buf.length);
});

test("SWF is a publish target, remembered with the document", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([obj("rect")]));
  const back = await page.evaluate(() => {
    const F = window._flashyAI;
    const p = F.publishSettings();
    p.targets.swf = true;
    const d = window._flashyEditor.serializeDoc();
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(d)));
    return F.publishSettings().targets;
  });
  expect(back.swf).toBe(true);

  // A document from before SWF was a target gets the field rather than
  // undefined, which the publish loop would read as "do not produce it".
  const legacy = await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    delete d.publish.targets.swf;
    window._flashyEditor.loadDoc(d);
    return window._flashyAI.publishSettings().targets;
  });
  expect(legacy.swf).toBe(false);
});
