// Importing Flash: SWF and FLA in, an editable document out.
//
// The fixtures in flash-fixtures.js are written byte by byte rather than
// checked in, so these specs exercise the real formats: bit-packed shape
// records, tag lengths, AVM1 bytecode, and a ZIP of XFL XML.
//
// What is worth asserting here is not "it parsed" but the three things that
// are silently wrong when an importer is nearly right:
//   - geometry lands where the movie put it (twips, matrices, registration)
//   - reuse survives as library symbols rather than being flattened
//   - the timeline comes back as keyframes and tweens, not as one baked
//     keyframe per frame
import { test, expect } from "@playwright/test";
import { openEditor, downloadFromAction, runExportedHTML } from "./helpers.js";
import {
  makeSWF, makeFLA, makeSkewSWF, makeGradientSWF, makeAS3SWF, makeLayeringSWF,
  makeClipHandlerSWF,
} from "./flash-fixtures.js";

const SWF_B64 = makeSWF().toString("base64");
const FLA_B64 = makeFLA().toString("base64");
const SKEW_B64 = makeSkewSWF().toString("base64");
const GRAD_B64 = makeGradientSWF().toString("base64");
const AS3_B64 = makeAS3SWF().toString("base64");
const LAYERS_B64 = makeLayeringSWF().toString("base64");
const CLIP_B64 = makeClipHandlerSWF().toString("base64");
const CLIP_ABS_B64 = makeClipHandlerSWF({ absolute: true }).toString("base64");

async function open(page) {
  const errors = await openEditor(page);
  await page.waitForFunction(() => !!(window.Flashy && window.Flashy.SWF &&
    window.FlashyImport && window.FlashyAVM1 && window.Flashy.FLALoader));
  // Turn a base64 fixture into bytes, a File, and a parsed model, in the page.
  await page.addScriptTag({
    content: `
      window.__bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      window.__file = (b64, name) => new File([window.__bytes(b64)], name);
      window.__parseSWF = (b64) => {
        const b = window.__bytes(b64);
        return Flashy.SWF.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
      };
    `,
  });
  return errors;
}

/* Colour of one stage pixel, in document coordinates. The stage canvas is the
   viewport, not the movie, so the document origin is the centring offset. */
function stagePixel(page, dx, dy) {
  return page.evaluate(({ dx, dy }) => {
    const c = document.getElementById("stageCanvas");
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const F = window._flashyAI;
    const ox = (c.clientWidth - F.doc.width) / 2;
    const oy = (c.clientHeight - F.doc.height) / 2;
    const d = ctx.getImageData(Math.round((ox + dx) * dpr), Math.round((oy + dy) * dpr), 1, 1).data;
    return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
  }, { dx, dy });
}

// ───────────────────────────── AVM1 ─────────────────────────────

/* Hand-assembled AVM1, so each case says exactly which bytes it is about.
   `push` encodes one string or one 32-bit integer. */
const AVM1_HELPERS = `
  window.__asm = (parts) => {
    const out = [];
    const pushStr = (s) => {
      const d = [0];
      for (const ch of s) d.push(ch.charCodeAt(0));
      d.push(0);
      out.push(0x96, d.length & 255, d.length >> 8, ...d);
    };
    const pushInt = (n) => {
      const dv = new DataView(new ArrayBuffer(4));
      dv.setInt32(0, n, true);
      out.push(0x96, 5, 0, 7, dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
    };
    for (const p of parts) {
      if (typeof p === "number") out.push(p);
      else if (typeof p === "string") pushStr(p);
      else if (p.int !== undefined) pushInt(p.int);
      else if (p.raw) out.push(...p.raw);
    }
    out.push(0x00);
    return new Uint8Array(out);
  };
  window.__decompile = (parts) => FlashyAVM1.decompile(window.__asm(parts));
`;

test("AVM1 bytecode comes back as readable ActionScript", async ({ page }) => {
  const errors = await open(page);
  await page.addScriptTag({ content: AVM1_HELPERS });

  const out = await page.evaluate(() => ({
    // 0x07 Stop
    stop: window.__decompile([0x07]),
    // GotoFrame 4 (0-based) + Play — how gotoAndPlay(5) is compiled
    goto: window.__decompile([{ raw: [0x81, 2, 0, 4, 0] }, 0x06]),
    // push "x", push 5, SetVariable
    assign: window.__decompile(["x", { int: 5 }, 0x1d]),
    // push "hello", Trace
    trace: window.__decompile(["hello", 0x26]),
    // args(0), object(_root), method("play"), CallMethod, Pop
    call: window.__decompile([{ int: 0 }, "_root", 0x1c, "play", 0x52, 0x17]),
    // push "x", GetVariable, push 3, Greater, Not, If(+1) { Stop }
    branch: window.__decompile([
      "x", 0x1c, { int: 3 }, 0x67, 0x12, { raw: [0x9d, 2, 0, 1, 0] }, 0x07,
    ]),
    // target "n", property index 0 (_x), value 50, SetProperty — the
    // property index table in use
    property: window.__decompile(["n", { int: 0 }, { int: 50 }, 0x23]),
  }));

  expect(out.stop).toBe("stop();");
  expect(out.goto).toBe("gotoAndPlay(5);");
  expect(out.assign).toBe("x = 5;");
  expect(out.trace).toBe('trace("hello");');
  expect(out.call).toBe("_root.play();");
  // The compiled test is negated to jump OVER the body, so the source
  // condition is the negation of what the bytecode holds.
  expect(out.branch).toBe("if (x > 3) {\n  stop();\n}");
  expect(out.property).toBe("n._x = 50;");
  expect(errors).toEqual([]);
});

test("AVM1 clip and button event flags are named", async ({ page }) => {
  await open(page);
  const names = await page.evaluate(() => ({
    load: FlashyAVM1.clipEventNames(0x01),
    enterFrame: FlashyAVM1.clipEventNames(0x02),
    both: FlashyAVM1.clipEventNames(0x03),
    release: FlashyAVM1.buttonConditionNames(0x0008),
  }));
  expect(names.load).toEqual(["load"]);
  expect(names.enterFrame).toEqual(["enterFrame"]);
  expect(names.both).toEqual(["load", "enterFrame"]);
  expect(names.release).toEqual(["overDownToOverUp"]);
});

// ───────────────────────────── SWF model ─────────────────────────────

test("a SWF parses into a document model with characters and a timeline", async ({ page }) => {
  const errors = await open(page);
  const model = await page.evaluate(async (b64) => {
    const doc = await window.__parseSWF(b64);
    return {
      width: doc.width, height: doc.height, fps: doc.fps,
      frameCount: doc.frameCount, background: doc.backgroundColor,
      kinds: Object.keys(doc.characters).map((id) => doc.characters[id].kind),
      exports: doc.exports,
      labels: doc.timeline.labels,
      frames: doc.timeline.frames.length,
      firstActions: doc.timeline.frames[0].actions,
      lastActions: doc.timeline.frames[11].actions,
      shapePath: doc.characters[1].items[0].path,
      shapeFill: doc.characters[1].items[0].fill,
      placements: doc.timeline.frames[0].commands.map((c) => [c.depth, c.id, c.matrix.tx, c.matrix.ty, c.name || ""]),
      warnings: doc.warnings,
    };
  }, SWF_B64);

  expect(model.width).toBe(320);
  expect(model.height).toBe(240);
  expect(model.fps).toBe(12);
  expect(model.frameCount).toBe(12);
  expect(model.background).toBe(0xc0c0c0);
  expect(model.kinds.sort()).toEqual(["shape", "shape", "sprite"]);
  expect(model.exports).toEqual({ Ball: 3 });
  expect(model.labels).toEqual({ 1: "start" });
  expect(model.frames).toBe(12);
  expect(model.firstActions).toEqual(["stop();"]);
  expect(model.lastActions).toEqual(["gotoAndPlay(1);"]);
  expect(model.warnings).toEqual([]);

  // The rectangle's edges are stitched into ONE closed loop, in pixels:
  // moveTo 0,0 · lineTo ×4 · closePath.
  expect(model.shapePath).toEqual([0, 0, 0, 1, 100, 0, 1, 100, 50, 1, 0, 50, 1, 0, 0, 3]);
  expect(model.shapeFill).toMatchObject({ type: "solid", color: 0xff0000, alpha: 1 });

  // Placement matrices are in twips: (20,30)px and (100,100)px.
  expect(model.placements).toEqual([
    [1, 1, 400, 600, ""],
    [2, 3, 2000, 2000, "ball"],
  ]);
  expect(errors).toEqual([]);
});

test("a SWF with no shape records still parses, and says what it could not read", async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    try {
      await Flashy.SWF.parse(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer);
      return "no error";
    } catch (e) {
      return e.message;
    }
  });
  expect(result).toContain("Not a SWF");
});

// ───────────────────── SWF → editor document ─────────────────────

test("a SWF is back-engineered into stage, layers, symbols and tweens", async ({ page }) => {
  const errors = await open(page);
  const out = await page.evaluate(async (b64) => {
    const model = await window.__parseSWF(b64);
    const { doc, report } = FlashyImport.toDocument(model, {});
    return {
      stage: [doc.width, doc.height, doc.fps, doc.backgroundColor, doc.totalFrames],
      layers: doc.layers.map((l) => ({
        name: l.name,
        keys: l.keyframes.map((k) => [k.index, k.duration, k.tweenType, k.objects.length]),
      })),
      library: Object.keys(doc.library),
      scripts: doc.layers[0].keyframes.map((k) => k.script).filter(Boolean),
      report,
    };
  }, SWF_B64);

  expect(out.stage).toEqual([320, 240, 12, "#C0C0C0", 12]);
  // Actions first (Flash's own convention), then one layer per depth, with
  // the frontmost depth on top. A depth is named after the instance name the
  // movie gave it ("ball"), or failing that after what is on it.
  expect(out.layers.map((l) => l.name)).toEqual(["Actions", "ball", "Shape 1"]);

  // Ten baked placements of a straight slide fold back into ONE motion tween
  // plus its end keyframe.
  expect(out.layers[1].keys).toEqual([
    [1, 10, "motion", 1],
    [11, 1, "none", 1],
  ]);
  // The rectangle never moves, so it is a single keyframe held for the movie.
  expect(out.layers[2].keys).toEqual([[1, 12, "none", 1]]);

  // The sprite was exported as "Ball", so that is its name in the library.
  expect(out.library).toEqual(["Ball"]);

  expect(out.scripts[0]).toBe("// frame label: start\nstop();");
  expect(out.scripts[1]).toBe("gotoAndPlay(1);");
  expect(out.report.tweens).toBe(1);
  expect(out.report.symbols).toBe(1);
  expect(errors).toEqual([]);
});

test("imported artwork keeps its geometry, colour and curves", async ({ page }) => {
  await open(page);
  const out = await page.evaluate(async (b64) => {
    const model = await window.__parseSWF(b64);
    const { doc } = FlashyImport.toDocument(model, {});
    const red = doc.layers[2].keyframes[0].objects[0];
    const ball = doc.layers[1].keyframes[0].objects[0];
    const inside = doc.library.Ball.layers[0].keyframes[0].objects[0];
    return { red, ball, inside };
  }, SWF_B64);

  // A shape placed once stays as artwork — a `path` object with the real
  // outline, positioned where the movie placed it.
  expect(out.red.type).toBe("path");
  expect([out.red.x, out.red.y, out.red.width, out.red.height]).toEqual([20, 30, 100, 50]);
  expect(out.red.fillColor).toBe("#FF0000");
  expect(out.red.pathW).toBe(100);
  // Path coordinates are object-local, with the bounding box at (0,0).
  expect(out.red.path).toEqual([0, 0, 0, 1, 100, 0, 1, 100, 50, 1, 0, 50, 1, 0, 0, 3]);

  // A sprite becomes a symbol instance, placed at the matrix translation.
  expect(out.ball.type).toBe("symbol");
  expect(out.ball.symbolName).toBe("Ball");
  expect(out.ball.instanceName).toBe("ball");
  expect([out.ball.x, out.ball.y, out.ball.width, out.ball.height]).toEqual([100, 100, 40, 40]);

  // …and the symbol holds the artwork, in the symbol's own space.
  expect(out.inside.type).toBe("path");
  expect(out.inside.fillColor).toBe("#0000FF");
  expect([out.inside.x, out.inside.y]).toEqual([0, 0]);
});

test("a skewed placement is baked into the path, not approximated", async ({ page }) => {
  await open(page);
  const out = await page.evaluate(async (b64) => {
    const model = await window.__parseSWF(b64);
    const { doc, report } = FlashyImport.toDocument(model, {});
    const o = doc.layers[0].keyframes[0].objects[0];
    return {
      type: o.type, x: o.x, y: o.y, width: o.width, height: o.height,
      rotation: o.rotation, scaleX: o.scaleX, scaleY: o.scaleY,
      path: o.path, pathW: o.pathW,
      warnings: report.warnings,
    };
  }, SKEW_B64);

  // The editor has rotation and scale but no skew, so the transform goes into
  // the geometry: a 100×50 box sheared by x += y/2 is 125 wide, upright, and
  // unscaled.
  expect(out.type).toBe("path");
  expect([out.rotation, out.scaleX, out.scaleY]).toEqual([0, 1, 1]);
  expect([out.width, out.height]).toEqual([125, 50]);
  expect(out.pathW).toBe(125);
  // Its bottom edge has slid right by half the height: (0,50) → (25,50).
  expect(out.path).toEqual([0, 0, 0, 1, 100, 0, 1, 125, 50, 1, 25, 50, 1, 0, 0, 3]);
  // Nothing was approximated, so nothing is reported as approximate.
  expect(out.warnings).toEqual([]);
});

test("a gradient fill imports as a gradient, and is drawn as one", async ({ page }) => {
  const errors = await open(page);
  const report = await page.evaluate(async (b64) => {
    const file = window.__file(b64, "gradient.swf");
    return window._flashyFlash.importFile(file, { force: true, quiet: true });
  }, GRAD_B64);
  expect(report.gradients).toBe(1);

  const o = await page.evaluate(() => {
    const kf = window._flashyAI.doc.layers[0].keyframes[0];
    const obj = kf.objects[0];
    return {
      fillType: obj.fillType, stops: obj.fillStops, grad: obj.fillGrad,
      x: obj.x, y: obj.y, width: obj.width, height: obj.height,
    };
  });
  expect(o.fillType).toBe("linear");
  // Two stops: red at 0, blue at 1, both opaque.
  expect(o.stops).toEqual([0, 0xff0000, 1, 1, 0x0000ff, 1]);
  // The ramp runs left to right across the whole box.
  expect(o.grad[0]).toBeCloseTo(0, 1);
  expect(o.grad[2]).toBeCloseTo(1, 1);
  expect([o.x, o.y, o.width, o.height]).toEqual([50, 50, 200, 100]);

  // On the stage: red at the left end, blue at the right, mixed in between.
  const left = await stagePixel(page, 55, 100);
  const mid = await stagePixel(page, 150, 100);
  const right = await stagePixel(page, 245, 100);
  const chan = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  expect(chan(left, 0)).toBeGreaterThan(200);
  expect(chan(left, 2)).toBeLessThan(60);
  expect(chan(right, 2)).toBeGreaterThan(200);
  expect(chan(right, 0)).toBeLessThan(60);
  expect(chan(mid, 0)).toBeGreaterThan(60);
  expect(chan(mid, 2)).toBeGreaterThan(60);
  expect(errors).toEqual([]);
});

test("an imported gradient survives the HTML and SVG exports", async ({ page, context }) => {
  await open(page);
  await page.evaluate(async (b64) => {
    const file = window.__file(b64, "gradient.swf");
    return window._flashyFlash.importFile(file, { force: true, quiet: true });
  }, GRAD_B64);

  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).toContain("<linearGradient");
  expect(svg).toContain("#ff0000");
  expect(svg).toContain("#0000ff");

  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() => window.__stage && window.__stage.root.children.length > 0);
  const px = await out.evaluate(() => {
    const c = document.getElementById("stage");
    const d = c.getContext("2d", { willReadFrequently: true });
    const at = (x, y) => Array.from(d.getImageData(x, y, 1, 1).data).slice(0, 3);
    return { left: at(55, 100), right: at(245, 100) };
  });
  // The exported engine draws the same ramp: red one end, blue the other.
  expect(px.left[0]).toBeGreaterThan(200);
  expect(px.right[2]).toBeGreaterThan(200);
  expect(errors).toEqual([]);
  await out.close();
});

test("File ▸ Import Flash Movie replaces the document and draws it", async ({ page }) => {
  const errors = await open(page);
  const report = await page.evaluate(async (b64) => {
    const file = window.__file(b64, "fixture.swf");
    return window._flashyFlash.importFile(file, { force: true, quiet: true });
  }, SWF_B64);

  expect(report).not.toBeNull();
  expect(report.stage).toBe("320×240 @ 12fps");

  const parsed = await page.evaluate(() => window._flashyEditor.serializeDoc());
  expect(parsed.width).toBe(320);
  expect(parsed.fps).toBe(12);
  expect(Object.keys(parsed.library)).toEqual(["Ball"]);

  // The real check: the red rectangle is on the stage, where the movie put
  // it. Its box is (20,30)-(120,80) in document space.
  expect(await stagePixel(page, 70, 55)).toBe("#ff0000");
  // …and the stage around it is the movie's own background colour.
  expect(await stagePixel(page, 250, 200)).toBe("#c0c0c0");

  // An import has never been saved, so the document is dirty.
  expect(await page.evaluate(() => window._flashyEditor.isDirty())).toBe(true);
  expect(errors).toEqual([]);
});

test("importing a file that is not Flash reports it rather than throwing", async ({ page }) => {
  await open(page);
  const report = await page.evaluate(async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "notes.txt");
    return window._flashyFlash.importFile(file, { force: true, quiet: true });
  });
  expect(report).toBeNull();
  await expect(page.locator("#fy-dialog")).toBeVisible();
});



// ─────────────────────────── object handlers ───────────────────────────

test("onClipEvent handlers import as handlers, not as a comment", async ({ page }) => {
  const errors = await open(page);
  const out = await page.evaluate(async (b64) => {
    const model = await window.__parseSWF(b64);
    const { doc, report } = FlashyImport.toDocument(model, {});
    const o = doc.layers[0].keyframes[0].objects[0];
    return { script: o.clipScript, handlers: report.handlers };
  }, CLIP_B64);

  expect(out.handlers).toBe(1);
  // The author's own form, decompiled out of AVM1 clip actions.
  expect(out.script).toBe(
    "onClipEvent(load) {" + "\n" + "  startX = _x;" + "\n" + "}" + "\n" +
    "onClipEvent(enterFrame) {" + "\n" + "  _x = startX + 40;" + "\n" + "}");
  expect(errors).toEqual([]);
});

test("the AS2 scope speaks Flash's property names and units", async ({ page }) => {
  await open(page);
  const out = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const stage = new Flashy.Stage(canvas, { width: 200, height: 200, pixelRatio: 1 });
    const clip = new Flashy.MovieClip();
    clip.x = 10; clip.y = 20; clip.alpha = 0.5; clip.rotation = Math.PI / 2;
    stage.root.addChild(clip);
    const ctl = Flashy.AS2.attach(clip, `
      onClipEvent(load) {
        readX = _x;
        readAlpha = _alpha;
        readRotation = _rotation;
        _x = 100;
        _alpha = 25;
        _rotation = 180;
        made = {a: 1, b: 2};
      }
    `, { stage: stage });
    return {
      readX: ctl.scope.readX,
      readAlpha: ctl.scope.readAlpha,
      readRotation: Math.round(ctl.scope.readRotation),
      nodeX: clip.x,
      nodeAlpha: clip.alpha,
      nodeRotation: Math.round(clip.rotation * 180 / Math.PI),
      made: ctl.scope.made,
    };
  });

  expect(out.readX).toBe(10);
  // Flash counts alpha in percent and angles in degrees; the engine does not.
  expect(out.readAlpha).toBe(50);
  expect(out.readRotation).toBe(90);
  expect(out.nodeX).toBe(100);
  expect(out.nodeAlpha).toBe(0.25);
  expect(out.nodeRotation).toBe(180);
  // An object literal in a handler body is the thing a brace-counting parser
  // has to survive — a regex-matched block ends inside it.
  expect(out.made).toEqual({ a: 1, b: 2 });
});

test("an imported handler actually runs in the export", async ({ page, context }) => {
  await open(page);
  await page.evaluate(async (b64) => {
    const file = window.__file(b64, "handlers.swf");
    return window._flashyFlash.importFile(file, { force: true, quiet: true });
  }, CLIP_B64);

  const html = await downloadFromAction(page, "export");
  // The handler runtime rides along only because this document uses it.
  expect(html).toContain("flashy-as2.js");

  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() => window.__stage && window.__stage.root.children.length > 0);
  // onClipEvent(load) read _x, onClipEvent(enterFrame) set it 40 to the
  // right — so the red box ends up 40px along from where it was placed.
  await out.waitForFunction(() => {
    const c = document.getElementById("stage");
    const d = c.getContext("2d", { willReadFrequently: true }).getImageData(70, 40, 1, 1).data;
    return d[0] > 200 && d[1] < 60;
  }, null, { timeout: 5000 });
  const px = await out.evaluate(() => {
    const d = document.getElementById("stage").getContext("2d", { willReadFrequently: true });
    const at = (x, y) => Array.from(d.getImageData(x, y, 1, 1).data).slice(0, 3);
    return { moved: at(70, 40), vacated: at(30, 40) };
  });
  expect(px.moved[0]).toBeGreaterThan(200);     // red, 40px along
  expect(px.vacated).toEqual([255, 255, 255]);  // and gone from where it was
  expect(errors).toEqual([]);
  await out.close();
});

test("a handler with a baked-in coordinate lands where Flash put it", async ({ page, context }) => {
  await open(page);
  await page.evaluate(async (b64) => {
    const file = window.__file(b64, "absolute.swf");
    return window._flashyFlash.importFile(file, { force: true, quiet: true });
  }, CLIP_ABS_B64);

  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() => window.__stage && window.__stage.root.children.length > 0);
  await out.waitForFunction(() => {
    const d = document.getElementById("stage").getContext("2d", { willReadFrequently: true });
    return d.getImageData(120, 40, 1, 1).data[0] > 200;
  }, null, { timeout: 5000 });

  const px = await out.evaluate(() => {
    const d = document.getElementById("stage").getContext("2d", { willReadFrequently: true });
    const at = (x, y) => Array.from(d.getImageData(x, y, 1, 1).data).slice(0, 3);
    return { inside: at(120, 40), justLeft: at(98, 40), farRight: at(142, 40) };
  });
  // `_x = 100` means the box's registration point — its top-left, as Flash
  // placed it — is at 100, so the 40px box covers 100..140 exactly. Measured
  // from the centre instead it would sit at 80..120 and this would be white.
  expect(px.inside[0]).toBeGreaterThan(200);
  expect(px.justLeft).toEqual([255, 255, 255]);
  expect(px.farRight).toEqual([255, 255, 255]);
  expect(errors).toEqual([]);
  await out.close();
});

// ───────────────────────────── layers ─────────────────────────────

test("depths that take turns share a layer; ones that overlap do not", async ({ page }) => {
  const errors = await open(page);
  const out = await page.evaluate(async (b64) => {
    const model = await window.__parseSWF(b64);
    const { doc } = FlashyImport.toDocument(model, {});
    return doc.layers.map((l) => l.keyframes.map((k) => [k.index, k.duration, k.objects.length]));
  }, LAYERS_B64);

  // Four depths, three layers: the red box (frames 1-2) and the blue one
  // (frame 3) take turns in the same place, so they pack together; the green
  // box and the yellow one that overlaps it stay apart.
  expect(out).toHaveLength(3);
  const packed = out.filter((keys) => keys.length === 2);
  expect(packed).toHaveLength(1);
  expect(packed[0]).toEqual([[1, 2, 1], [3, 1, 1]]);
  expect(errors).toEqual([]);
});

test("packing never changes what is drawn in front of what", async ({ page }) => {
  await open(page);
  await page.evaluate(async (b64) => {
    const file = window.__file(b64, "layers.swf");
    return window._flashyFlash.importFile(file, { force: true, quiet: true });
  }, LAYERS_B64);
  await page.evaluate(() => { window._flashyAI.setCurFrame(3); window._flashyAI.fullRefresh(); });

  // The yellow box was placed above the green one and overlaps it. Packed
  // onto the wrong layer it would end up underneath, and this reads green.
  expect(await stagePixel(page, 215, 25)).toBe("#ffff00");
  // The blue box took the red one's slot, and its own corner is still blue.
  expect(await stagePixel(page, 30, 30)).toBe("#0000ff");
  // Green where only green is.
  expect(await stagePixel(page, 202, 55)).toBe("#00ff00");
});

// ──────────────────────────── ActionScript 3 ────────────────────────────

test("an ActionScript 3 movie brings its classes and frame scripts", async ({ page }) => {
  const errors = await open(page);
  const report = await page.evaluate(async (b64) => {
    const file = window.__file(b64, "as3.swf");
    return window._flashyFlash.importFile(file, { force: true, quiet: true });
  }, AS3_B64);

  expect(report.as3).toBe(true);
  expect(report.as3Classes).toBe(1);
  expect(report.scripts).toBeGreaterThan(0);

  const script = await page.evaluate(() => {
    const layer = window._flashyAI.doc.layers.find((l) => l.name === "Actions");
    return layer ? layer.keyframes[0].script : null;
  });
  // The frame script the constructor registered with addFrameScript, read
  // back out of AVM2 bytecode…
  expect(script).toContain("stop();");
  // …and the outline of what the movie's code was.
  expect(script).toContain("class Main extends flash.display.MovieClip");
  expect(script).toContain("function frame1()");
  // It says plainly that none of it runs here.
  expect(report.warnings.join(" ")).toContain("ActionScript 3");
  expect(errors).toEqual([]);
});

test("the AS3 reader decompiles a method body on its own", async ({ page }) => {
  await open(page);
  const out = await page.evaluate(async (b64) => {
    const bytes = window.__bytes(b64);
    const doc = await Flashy.SWF.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    return { blocks: doc.abc.length, outline: doc.abc[0].outline, frames: doc.as3FrameScripts };
  }, AS3_B64);
  expect(out.blocks).toBe(1);
  expect(out.outline).toContain("class Main");
  expect(out.frames[1]).toContain("stop();");
});

// ───────────────────────────── FLA / XFL ─────────────────────────────

test("XFL edge strings are read in twips", async ({ page }) => {
  await open(page);
  const out = await page.evaluate(() => ({
    // 2000 twips is 100 pixels — reading it as pixels is the classic
    // twenty-times-too-big import.
    decimal: Flashy.XFL.edgesFromString("!0 0|2000 0", 1, 1, 0),
    // The same number written as hex fixed-point.
    hex: Flashy.XFL.tokenizeEdges("#7D0.00 #0.00"),
    quad: Flashy.XFL.edgesFromString("!0 0[100 200 300 400", 0, 1, 0).length,
  }));
  expect(out.decimal).toHaveLength(1);
  expect(out.decimal[0]).toMatchObject({ x0: 0, y0: 0, x1: 2000, y1: 0 });
  expect(out.hex[0]).toBe(2000);
  expect(out.quad).toBe(1);
});

test("a FLA parses into the same model shape a SWF does", async ({ page }) => {
  const errors = await open(page);
  const model = await page.evaluate(async (b64) => {
    const file = window.__file(b64, "fixture.fla");
    const m = await new Flashy.FLALoader().parseFile(file);
    return {
      source: m.source,
      stage: [m.width, m.height, m.fps, m.backgroundColor],
      frames: m.timeline.frames.length,
      labels: m.timeline.labels,
      actions: m.timeline.frames[0].actions,
      kinds: Object.keys(m.characters).map((id) => m.characters[id].kind).sort(),
      warnings: m.warnings,
    };
  }, FLA_B64);

  expect(model.source).toBe("fla");
  expect(model.stage).toEqual([400, 300, 24, 0x336699]);
  expect(model.frames).toBe(10);
  expect(model.labels).toEqual({ 1: "open" });
  expect(model.actions).toEqual(["stop();"]);
  expect(model.kinds).toEqual(["shape", "shape", "sprite"]);
  expect(model.warnings).toEqual([]);
  expect(errors).toEqual([]);
});

test("a FLA imports with its own layer names, symbols and tween", async ({ page }) => {
  const errors = await open(page);
  const report = await page.evaluate(async (b64) => {
    const file = window.__file(b64, "fixture.fla");
    return window._flashyFlash.importFile(file, { force: true, quiet: true });
  }, FLA_B64);
  expect(report).not.toBeNull();

  const out = await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    return {
      stage: [d.width, d.height, d.fps, d.backgroundColor],
      layers: d.layers.map((l) => ({
        name: l.name,
        keys: l.keyframes.map((k) => [k.index, k.duration, k.tweenType]),
        first: l.keyframes[0].objects[0] || null,
      })),
      library: Object.keys(d.library),
    };
  });

  expect(out.stage).toEqual([400, 300, 24, "#336699"]);
  // The author's own layer names, in the author's own order.
  expect(out.layers.map((l) => l.name)).toEqual(["Actions", "Ball", "Sky"]);
  expect(out.library).toEqual(["Ball"]);

  // A motion tween in the FLA is sampled per frame by the reader and folded
  // back into one tweened keyframe by the importer.
  expect(out.layers[1].keys).toEqual([[1, 9, "motion"], [10, 1, "none"]]);
  expect(out.layers[1].first.type).toBe("symbol");
  expect(out.layers[1].first.symbolName).toBe("Ball");
  expect(out.layers[1].first.symbolBehavior).toBe("graphic");
  expect([out.layers[1].first.x, out.layers[1].first.y]).toEqual([10, 20]);

  // The background rectangle is 400×300 pixels, not 8000×6000 twips.
  expect(out.layers[2].first.type).toBe("path");
  expect([out.layers[2].first.width, out.layers[2].first.height]).toEqual([400, 300]);
  expect(out.layers[2].first.fillColor).toBe("#112233");

  // And it is actually drawn, in the colour the FLA asked for.
  expect(await stagePixel(page, 200, 150)).toBe("#112233");
  expect(errors).toEqual([]);
});

test("an imported symbol opens for editing like any other", async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(async (b64) => {
    const file = window.__file(b64, "fixture.swf");
    return window._flashyFlash.importFile(file, { force: true, quiet: true });
  }, SWF_B64);

  /* The real question about an import is not whether it drew — it is whether
     what landed is a document. Entering a library symbol exercises the lot:
     the symbol has to revive (its layers arrive as plain JSON), its keyframes
     have to be real keyframes, and editing inside has to stick. */
  const inside = await page.evaluate(() => {
    const F = window._flashyAI;
    // The ball instance is on the layer named after it.
    const li = F.doc.layers.findIndex((l) => l.name === "ball");
    F.setCurLayer(li);
    const inst = F.currentLayers()[li].getKeyframeAt(1).objects[0];
    const canvas = document.getElementById("stageCanvas");
    const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent("dblclick", {
      clientX: r.left + (canvas.clientWidth - F.doc.width) / 2 + inst.x + inst.width / 2,
      clientY: r.top + (canvas.clientHeight - F.doc.height) / 2 + inst.y + inst.height / 2,
      bubbles: true, button: 0,
    }));
    const layers = F.currentLayers();
    return {
      breadcrumb: document.getElementById("breadcrumb").textContent,
      layerCount: layers.length,
      objectType: layers[0].getKeyframeAt(1).objects[0].type,
      nodes: layers[0].getKeyframeAt(1).objects[0].path.length,
    };
  });

  expect(inside.breadcrumb).toContain("Ball");
  expect(inside.layerCount).toBeGreaterThan(0);
  expect(inside.objectType).toBe("path");
  expect(inside.nodes).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("the Flash readers also build a playable MovieClip", async ({ page }) => {
  await open(page);
  const out = await page.evaluate(async (b64) => {
    const file = window.__file(b64, "fixture.swf");
    const mc = await new Flashy.SWFLoader().loadFile(file);
    mc.gotoAndStop(1);
    return {
      info: mc.swfInfo,
      totalFrames: mc.timeline.totalFrames,
      children: mc.children.length,
    };
  }, SWF_B64);
  expect(out.info.width).toBe(320);
  expect(out.info.fps).toBe(12);
  expect(out.totalFrames).toBe(12);
  // Frame 1 places two things: the rectangle and the sprite.
  expect(out.children).toBe(2);
});
