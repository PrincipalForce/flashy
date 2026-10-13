// Auto lip sync.
//
// Scrubbing a frame, listening, picking a mouth, repeating: four to six hours
// per minute of dialogue, redone every time a line is re-recorded. It is the
// single biggest time sink in 2D animation, and people bought a separate
// application for it.
//
// The promise is a *first pass you then fix*, so these specs check the things
// that have to be right for that to be worth having: silence reads as rest,
// different vowel spectra read as different shapes, the result holds instead
// of chattering, and what lands on the timeline is ordinary editable
// keyframes rather than something special.
//
// The fixture is synthesised in the page, so there is no binary asset and the
// spectral content is known exactly.
import { test, expect } from "@playwright/test";
import { openEditor } from "./helpers.js";

/**
 * Build a WAV from a list of segments, each `{seconds, type}`:
 *   silence  — nothing
 *   ah       — strong first formant around 800Hz (open vowel)
 *   ee       — energy at 300Hz and 2400Hz (wide vowel: low F1, high F2)
 *   oo       — energy at 300Hz and 800Hz (round vowel: low F1, low F2)
 *   ess      — band-limited noise (fricative)
 */
const WAV_BUILDER = `
window.__speech = function (segments, rate) {
  rate = rate || 16000;
  const total = segments.reduce((a, s) => a + Math.floor(s.seconds * rate), 0);
  const bytes = 44 + total * 2;
  const buf = new ArrayBuffer(bytes);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, bytes - 8, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, total * 2, true);

  // A buzzy glottal source shaped by the formants of each vowel.
  const voiced = (t, f1, f2) =>
    0.6 * Math.sin(2 * Math.PI * 120 * t) * Math.exp(-((t * 120) % 1) * 2) +
    0.9 * Math.sin(2 * Math.PI * f1 * t) +
    0.7 * Math.sin(2 * Math.PI * f2 * t);

  let p = 44, seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
  for (const seg of segments) {
    const n = Math.floor(seg.seconds * rate);
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      let s = 0;
      if (seg.type === "ah")  s = voiced(t, 800, 1200) * 0.3;
      else if (seg.type === "ee") s = voiced(t, 300, 2400) * 0.3;
      else if (seg.type === "oo") s = voiced(t, 300, 800) * 0.3;
      else if (seg.type === "ess") s = rnd() * 0.12;  // broadband hiss, quieter
      v.setInt16(p, Math.max(-32767, Math.min(32767, Math.round(s * 32767))), true);
      p += 2;
    }
  }
  return new File([buf], "line.wav", { type: "audio/wav" });
};`;

/** Import a synthesised line of dialogue onto the timeline. */
async function importSpeech(page, segments) {
  await page.evaluate(WAV_BUILDER);
  return page.evaluate(
    (segments) => window._flashyAudio.importSoundFile(window.__speech(segments)),
    segments,
  );
}

/** A mouth symbol with `frames` numbered frames. */
async function addMouthSymbol(page, frames = 6) {
  await page.evaluate((frames) => {
    const F = window._flashyAI;
    const kfs = [];
    for (let i = 0; i < frames; i++) {
      kfs.push({
        index: i + 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "rect", x: 0, y: 0, width: 60, height: 40,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#CC5555", fillAlpha: 1, fillType: "solid",
          strokeColor: "#000", strokeAlpha: 1, strokeWidth: 1, strokeStyle: "solid",
        }],
      });
    }
    F.doc.library.Mouth = {
      objects: [], totalFrames: frames, behavior: "movieclip",
      layers: [{ name: "Layer 1", visible: true, locked: false, keyframes: kfs }],
    };
    F.fullRefresh();
  }, frames);
}

test("silence reads as rest and speech does not", async ({ page }) => {
  await openEditor(page);
  const name = await importSpeech(page, [
    { seconds: 0.5, type: "silence" },
    { seconds: 0.8, type: "ah" },
    { seconds: 0.5, type: "silence" },
  ]);
  expect(name).toBeTruthy();

  const runs = await page.evaluate((name) => {
    const feat = window.Flashy.Sound.analyze(name, { fps: 24 });
    return window._flashyAudio.classify(feat, { minHold: 2 });
  }, name);

  // rest → something → rest. The middle run must not be rest.
  expect(runs.length).toBeGreaterThanOrEqual(3);
  expect(runs[0].id).toBe("rest");
  expect(runs[runs.length - 1].id).toBe("rest");
  const middle = runs.slice(1, -1).map((r) => r.id);
  expect(middle).not.toContain("rest");
  // ~0.8s at 24fps ≈ 19 frames of speech.
  const speech = runs.slice(1, -1).reduce((a, r) => a + r.length, 0);
  expect(speech).toBeGreaterThan(12);
  expect(speech).toBeLessThan(26);
});

test("each speech sound maps to its own mouth shape", async ({ page }) => {
  await openEditor(page);
  // Each sound held long enough to survive the minimum hold.
  const name = await importSpeech(page, [
    { seconds: 0.1, type: "silence" },
    { seconds: 0.6, type: "ah" },
    { seconds: 0.6, type: "ee" },
    { seconds: 0.6, type: "oo" },
    { seconds: 0.6, type: "ess" },
    { seconds: 0.1, type: "silence" },
  ]);

  const shapes = await page.evaluate((name) => {
    const feat = window.Flashy.Sound.analyze(name, { fps: 24 });
    const runs = window._flashyAudio.classify(feat, { minHold: 2 });
    const perFrame = [];
    runs.forEach((r) => { for (let i = 0; i < r.length; i++) perFrame.push(r.id); });
    const dominant = (from, to) => {
      const count = {};
      for (let i = from; i < Math.min(to, perFrame.length); i++) count[perFrame[i]] = (count[perFrame[i]] || 0) + 1;
      return Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    };
    // Sample the middle of each 0.6s (≈14 frame) segment.
    return { ah: dominant(5, 15), ee: dominant(19, 29), oo: dominant(33, 43), ess: dominant(47, 57) };
  }, name);

  // An open vowel, a front vowel, a round vowel and a fricative are the four
  // distinctions the signal actually supports — and the ones that make a
  // first pass worth hand-fixing rather than redoing.
  expect(shapes.ah).toBe("A");
  expect(shapes.ee).toBe("E");
  expect(shapes.oo).toBe("O");
  expect(shapes.ess).toBe("FV");
});

test("minimum hold stops the mouth chattering", async ({ page }) => {
  await openEditor(page);
  // Rapid alternation — exactly what produces one-frame flicker.
  const segs = [];
  for (let i = 0; i < 12; i++) segs.push({ seconds: 0.04, type: i % 2 ? "ee" : "oo" });
  const name = await importSpeech(page, segs);

  const held = await page.evaluate((name) => {
    const feat = window.Flashy.Sound.analyze(name, { fps: 24 });
    const loose = window._flashyAudio.classify(feat, { minHold: 1 });
    const tight = window._flashyAudio.classify(feat, { minHold: 4 });
    return {
      looseMin: Math.min.apply(null, loose.map((r) => r.length)),
      tightMin: Math.min.apply(null, tight.map((r) => r.length)),
      tightCount: tight.length,
      looseCount: loose.length,
    };
  }, name);

  // Nothing shorter than the hold survives, and the result is calmer.
  expect(held.tightMin).toBeGreaterThanOrEqual(4);
  expect(held.tightCount).toBeLessThanOrEqual(held.looseCount);
});

test("generating writes editable Graphic keyframes onto a layer", async ({ page }) => {
  const errors = await openEditor(page);
  await addMouthSymbol(page, 6);
  const name = await importSpeech(page, [
    { seconds: 0.3, type: "silence" },
    { seconds: 0.7, type: "ah" },
    { seconds: 0.2, type: "silence" },
    { seconds: 0.7, type: "ee" },
  ]);

  const result = await page.evaluate((name) => {
    const F = window._flashyAI;
    F.pushUndo();
    const res = window._flashyAudio.lipSync({
      assetName: name, startFrame: 1, symbolName: "Mouth",
      layerIndex: -1, minHold: 2, silence: 0.06,
    });
    F.fullRefresh();
    const layer = F.currentLayers()[res.layerIndex];
    const kfs = layer.keyframes.map((k) => ({
      index: k.index, duration: k.duration,
      behavior: k.objects[0] && k.objects[0].symbolBehavior,
      loop: k.objects[0] && k.objects[0].loopMode,
      frame: k.objects[0] && k.objects[0].firstFrame,
      symbol: k.objects[0] && k.objects[0].symbolName,
    }));
    return { res, layerName: layer.name, kfs };
  }, name);

  expect(result.res.keyframes).toBeGreaterThan(2);
  expect(result.layerName).toContain("Mouth");

  // Every keyframe is a plain single-frame Graphic — which is what makes the
  // output fixable by hand instead of a black box.
  for (const kf of result.kfs) {
    expect(kf.symbol).toBe("Mouth");
    expect(kf.behavior).toBe("graphic");
    expect(kf.loop).toBe("single");
    expect(kf.frame).toBeGreaterThanOrEqual(1);
    expect(kf.frame).toBeLessThanOrEqual(6);
  }
  // Contiguous cover, no gaps or overlaps.
  for (let i = 1; i < result.kfs.length; i++) {
    expect(result.kfs[i].index).toBe(result.kfs[i - 1].index + result.kfs[i - 1].duration);
  }
  // It used more than one mouth shape.
  expect(new Set(result.kfs.map((k) => k.frame)).size).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test("the mouth chart maps shapes to frames and is saved with the symbol", async ({ page }) => {
  await openEditor(page);
  await addMouthSymbol(page, 6);
  const name = await importSpeech(page, [
    { seconds: 0.4, type: "silence" },
    { seconds: 0.8, type: "ah" },
  ]);

  const framesUsed = await page.evaluate((name) => {
    const F = window._flashyAI;
    // Put every shape on frame 6 except rest, which goes to frame 2.
    F.doc.library.Mouth.mouthChart = { rest: 2, MBP: 6, FV: 6, A: 6, E: 6, O: 6 };
    const res = window._flashyAudio.lipSync({
      assetName: name, startFrame: 1, symbolName: "Mouth", layerIndex: -1, minHold: 2,
    });
    const layer = F.currentLayers()[res.layerIndex];
    const frames = layer.keyframes.map((k) => k.objects[0].firstFrame);

    // And it survives a save/reopen — a chart you set once per character is
    // worthless if it does not persist.
    const text = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(text));
    return { frames, chart: window._flashyAI.doc.library.Mouth.mouthChart };
  }, name);

  expect(new Set(framesUsed.frames)).toEqual(new Set([2, 6]));
  expect(framesUsed.chart).toMatchObject({ rest: 2, A: 6 });
});

test("re-running replaces the previous pass instead of stacking onto it", async ({ page }) => {
  await openEditor(page);
  await addMouthSymbol(page, 6);
  const name = await importSpeech(page, [
    { seconds: 0.2, type: "silence" },
    { seconds: 0.8, type: "ah" },
  ]);

  const counts = await page.evaluate((name) => {
    const F = window._flashyAI;
    const run = (hold) => window._flashyAudio.lipSync({
      assetName: name, startFrame: 1, symbolName: "Mouth",
      layerIndex: -1, minHold: hold,
    });
    const first = run(2);
    const layerIdx = first.layerIndex;
    // Re-run onto the same layer, as you would after re-recording the line.
    const second = window._flashyAudio.lipSync({
      assetName: name, startFrame: 1, symbolName: "Mouth",
      layerIndex: layerIdx, minHold: 6,
    });
    const layer = F.currentLayers()[second.layerIndex];
    return { kfs: layer.keyframes.length, generated: second.keyframes, minHold: 6,
             shortest: Math.min.apply(null, layer.keyframes.map((k) => k.duration)) };
  }, name);

  // The layer holds exactly the second pass, not both.
  expect(counts.kfs).toBe(counts.generated);
  expect(counts.shortest).toBeGreaterThanOrEqual(6);
});

test("Auto Lip Sync is reachable from the menu and explains itself", async ({ page }) => {
  await openEditor(page);

  const inModify = await page.evaluate(() =>
    window._flashyEditor.menus.find((m) => m.label === "Modify").items.map((i) => i.action));
  expect(inModify).toContain("lipSync");

  // With no sound on the timeline it says what to do rather than failing — and
  // says it in the editor's own dialog, not a native alert(), which is OS-modal
  // in the desktop build and blocks the main process.
  let native = 0;
  page.on("dialog", async (d) => { native++; await d.accept(); });
  await page.evaluate(() => window._flashyEditor.doAction("lipSync"));

  const d = page.locator("#fy-dialog");
  await expect(d).toBeVisible();
  await expect(d).toContainText("sound on the timeline");
  // A message has one button; there is nothing to cancel.
  await expect(d.locator(".fy-dialog-btn")).toHaveCount(1);
  await d.getByText("OK").click();
  await expect(d).toHaveCount(0);
  expect(native).toBe(0);
});

// The three cases below all come from a real document (LipSYncTest.flashy) in
// which lip sync reported "6 mouth keyframes written" over a mouth that never
// opened. The detection was correct; the chart that maps a shape to a frame of
// the symbol was not.

/** A mouth symbol whose shapes sit on keyframes `span` frames long. */
async function addSpannedMouthSymbol(page, shapes = 6, span = 8) {
  await page.evaluate(({ shapes, span }) => {
    const F = window._flashyAI;
    const kfs = [];
    for (let i = 0; i < shapes; i++) {
      kfs.push({
        index: i * span + 1, duration: span, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "rect", x: 0, y: 0, width: 40 + i * 10, height: 20 + i * 6,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#CC5555", fillAlpha: 1, fillType: "solid",
          strokeColor: "#000", strokeAlpha: 1, strokeWidth: 1, strokeStyle: "solid",
        }],
      });
    }
    F.doc.library.Spanned = {
      objects: [], totalFrames: shapes * span, behavior: "movieclip",
      layers: [{ name: "Mouth Shapes", visible: true, locked: false, keyframes: kfs }],
    };
    F.fullRefresh();
  }, { shapes, span });
}

test("mouth shapes drawn on multi-frame keyframes each get their own drawing", async ({ page }) => {
  await openEditor(page);
  // Six shapes at 8 frames each — what you get by pressing F6 at the default
  // span. The old default chart was 1,2,3,4,5,6, which all land inside the
  // FIRST keyframe, so every mouth resolved to the same picture.
  await addSpannedMouthSymbol(page, 6, 8);

  const chart = await page.evaluate(() =>
    window._flashyAudio.mouthChart(window._flashyAI.doc.library.Spanned));

  // The chart must point at frames where a drawing actually starts.
  expect(Object.values(chart).sort((a, b) => a - b)).toEqual([1, 9, 17, 25, 33, 41]);

  const name = await importSpeech(page, [
    { seconds: 0.1, type: "silence" }, { seconds: 0.4, type: "ah" },
    { seconds: 0.4, type: "ee" }, { seconds: 0.4, type: "oo" },
    { seconds: 0.4, type: "ess" }, { seconds: 0.1, type: "silence" },
  ]);

  const result = await page.evaluate((name) => {
    const F = window._flashyAI;
    const r = window._flashyAudio.lipSync({
      assetName: name, startFrame: 1, offset: 0,
      symbolName: "Spanned", layerIndex: 0, minHold: 2, silence: 0.06,
    });
    const kfs = F.doc.library.Spanned.layers[0].keyframes;
    // Resolve each written First to the keyframe that actually covers it.
    const drawingAt = (f) => kfs.findIndex((k) => f >= k.index && f < k.index + k.duration);
    const layer = F.currentLayers()[r.layerIndex];
    return {
      shapesUsed: r.shapesUsed,
      shapesVisible: r.shapesVisible,
      drawings: layer.keyframes.map((k) => drawingAt(k.objects[0].firstFrame)),
    };
  }, name);

  // Every shape the pass chose is a visibly different mouth …
  expect(result.shapesVisible).toBe(result.shapesUsed);
  // … and no written keyframe failed to resolve to a drawing.
  expect(result.drawings).not.toContain(-1);
  // The whole point: more than one picture is shown.
  expect(new Set(result.drawings).size).toBeGreaterThan(2);
});

test("a symbol stored without layers still reports its real length", async ({ page }) => {
  await openEditor(page);
  // Older/alternate symbols carry `objects` + `totalFrames` and no `layers`.
  // These reported one frame, so every shape clamped onto frame 1.
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.doc.library.Legacy = {
      objects: [{ type: "rect", x: 0, y: 0, width: 50, height: 30 }],
      layers: null, totalFrames: 60, behavior: "movieclip",
    };
    F.fullRefresh();
  });

  const chart = await page.evaluate(() =>
    window._flashyAudio.mouthChart(window._flashyAI.doc.library.Legacy));
  // Six distinct frames, not six copies of frame 1.
  expect(new Set(Object.values(chart)).size).toBe(6);
});

test("a chart that collapses every shape onto one drawing is reported, not hidden", async ({ page }) => {
  await openEditor(page);
  await addSpannedMouthSymbol(page, 6, 8);
  // A chart pointing every shape inside the first keyframe. This is what the
  // old default produced, and it has to be visible rather than silent.
  await page.evaluate(() => {
    window._flashyAI.doc.library.Spanned.mouthChart =
      { rest: 1, MBP: 2, FV: 3, A: 4, E: 5, O: 6 };
  });

  const name = await importSpeech(page, [
    { seconds: 0.1, type: "silence" }, { seconds: 0.4, type: "ah" },
    { seconds: 0.4, type: "ee" }, { seconds: 0.4, type: "oo" },
    { seconds: 0.1, type: "silence" },
  ]);

  const r = await page.evaluate((name) => window._flashyAudio.lipSync({
    assetName: name, startFrame: 1, offset: 0,
    symbolName: "Spanned", layerIndex: 0, minHold: 2, silence: 0.06,
  }), name);

  // Several shapes chosen, one picture available for them.
  expect(r.shapesUsed).toBeGreaterThan(1);
  expect(r.shapesVisible).toBe(1);
  expect(r.shapesVisible).toBeLessThan(r.shapesUsed);
});

test("the mouth inherits an existing instance's placement even onto a new layer", async ({ page }) => {
  await openEditor(page);
  await addMouthSymbol(page, 6);

  // A mouth already positioned on the face, on its own layer.
  await page.evaluate(() => {
    const F = window._flashyAI;
    const o = new F.EditorObject("symbol");
    o.type = "symbol"; o.symbolName = "Mouth";
    o.x = 311; o.y = 207; o.width = 64; o.height = 44;
    F.currentLayers()[0].getKeyframeAt(1).objects.push(o);
    F.fullRefresh();
  });

  const name = await importSpeech(page, [
    { seconds: 0.1, type: "silence" }, { seconds: 0.4, type: "ah" },
    { seconds: 0.4, type: "oo" }, { seconds: 0.1, type: "silence" },
  ]);

  // "New layer" is the default, and the target layer is empty by definition —
  // so the template has to be found on another layer or the mouth is dumped at
  // an arbitrary spot instead of on the face.
  const placed = await page.evaluate((name) => {
    const F = window._flashyAI;
    const r = window._flashyAudio.lipSync({
      assetName: name, startFrame: 1, offset: 0,
      symbolName: "Mouth", layerIndex: -1, minHold: 2, silence: 0.06,
    });
    const o = F.currentLayers()[r.layerIndex].keyframes[0].objects[0];
    return { x: o.x, y: o.y, w: o.width, h: o.height };
  }, name);

  expect(placed).toEqual({ x: 311, y: 207, w: 64, h: 44 });
});

test("lip syncing onto the layer that holds the sound keeps the sound", async ({ page }) => {
  await openEditor(page);
  await addMouthSymbol(page, 6);

  // Importing attaches the sound to the *current* layer, so the layer holding
  // the voice track is a perfectly normal thing to target. Replacing the
  // keyframes in that range used to take the sound with them, silently
  // removing the audio the pass was syncing to.
  const name = await importSpeech(page, [
    { seconds: 0.1, type: "silence" }, { seconds: 0.4, type: "ah" },
    { seconds: 0.4, type: "ee" }, { seconds: 0.4, type: "oo" },
    { seconds: 0.1, type: "silence" },
  ]);

  const soundLayer = await page.evaluate(() => {
    const F = window._flashyAI;
    return F.currentLayers().findIndex((l) => l.keyframes.some((k) => k.sound));
  });
  expect(soundLayer).toBeGreaterThanOrEqual(0);

  const kept = await page.evaluate(({ name, soundLayer }) => {
    const before = window._flashyAudio.soundItems().length;
    const r = window._flashyAudio.lipSync({
      assetName: name, startFrame: 1, offset: 0,
      symbolName: "Mouth", layerIndex: soundLayer, minHold: 2, silence: 0.06,
    });
    const after = window._flashyAudio.soundItems();
    return { before, after: after.length, asset: after[0] && after[0].asset, wrote: r.keyframes };
  }, { name, soundLayer });

  expect(kept.before).toBe(1);
  expect(kept.after).toBe(1);
  expect(kept.asset).toBe(name);
  expect(kept.wrote).toBeGreaterThan(1);
});

// ---------------------------------------------------------------------------
// Set Up Mouth Shapes — turning a symbol you already have into one that auto
// lip sync can drive. Before this, the only route was knowing the convention
// and building it by hand, and getting it subtly wrong produced a track that
// looked written but never moved the mouth.

/** A symbol with `n` drawings, each on a keyframe `span` frames long. */
async function addPlainSymbol(page, name, n = 1, span = 1) {
  await page.evaluate(({ name, n, span }) => {
    const F = window._flashyAI;
    const kfs = [];
    for (let i = 0; i < n; i++) {
      kfs.push({
        index: i * span + 1, duration: span, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "rect", x: 10, y: 10, width: 60 + i * 5, height: 30,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#AA3333", fillAlpha: 1, fillType: "solid",
          strokeColor: "#000", strokeAlpha: 1, strokeWidth: 1, strokeStyle: "solid",
        }],
      });
    }
    const doc = F.doc;
    doc.library[name] = {
      objects: [], totalFrames: n * span, behavior: "movieclip",
      layers: [{ name: "Layer 1", visible: true, locked: false, keyframes: kfs }],
    };
    F.fullRefresh();
  }, { name, n, span });
}

test("setting up a one-drawing symbol gives it a frame per mouth shape", async ({ page }) => {
  await openEditor(page);
  await addPlainSymbol(page, "Face", 1, 1);

  const res = await page.evaluate(() => window._flashyAudio.mouthSetup({
    symbolName: "Face", create: true, tighten: false,
  }));

  // Six shapes, six frames, all distinct.
  expect(res.created).toBe(5);
  expect(res.frames).toEqual([1, 2, 3, 4, 5, 6]);
  expect(res.distinct).toBe(6);

  const sym = await page.evaluate(() => {
    const s = window._flashyAI.doc.library.Face;
    return {
      kfs: s.layers[0].keyframes.map((k) => ({ i: k.index, d: k.duration, n: k.objects.length })),
      chart: s.mouthChart,
      totalFrames: s.totalFrames,
    };
  });

  // The new frames are seeded with the existing drawing, not left blank — a
  // blank frame renders as nothing and reads as a broken mouth.
  expect(sym.kfs.every((k) => k.n > 0)).toBe(true);
  expect(sym.kfs.map((k) => k.d)).toEqual([1, 1, 1, 1, 1, 1]);
  expect(sym.chart).toMatchObject({ rest: 1, MBP: 2, FV: 3, A: 4, E: 5, O: 6 });
  expect(sym.totalFrames).toBeGreaterThanOrEqual(6);
});

test("setting up charts the drawings a symbol already has, without adding any", async ({ page }) => {
  await openEditor(page);
  // The shape of a real hand-built mouth: six drawings on 8-frame keyframes.
  await addPlainSymbol(page, "Mouth8", 6, 8);

  const res = await page.evaluate(() => window._flashyAudio.mouthSetup({
    symbolName: "Mouth8", create: true, tighten: false,
  }));

  // Nothing added — it already had six drawings …
  expect(res.created).toBe(0);
  // … and the chart points at where they actually start.
  expect(res.frames).toEqual([1, 9, 17, 25, 33, 41]);
  expect(res.distinct).toBe(6);
});

test("tightening makes each drawing one frame long without losing artwork", async ({ page }) => {
  await openEditor(page);
  await addPlainSymbol(page, "Mouth8", 6, 8);

  const before = await page.evaluate(() =>
    window._flashyAI.doc.library.Mouth8.layers[0].keyframes.map((k) => k.objects[0].width));

  const res = await page.evaluate(() => window._flashyAudio.mouthSetup({
    symbolName: "Mouth8", create: true, tighten: true,
  }));

  expect(res.tightened).toBeGreaterThan(0);
  expect(res.frames).toEqual([1, 2, 3, 4, 5, 6]);

  const after = await page.evaluate(() => {
    const s = window._flashyAI.doc.library.Mouth8;
    return {
      widths: s.layers[0].keyframes.map((k) => k.objects[0].width),
      durations: s.layers[0].keyframes.map((k) => k.duration),
    };
  });

  // Every drawing survived, in order, now one frame each.
  expect(after.widths).toEqual(before);
  expect(after.durations).toEqual([1, 1, 1, 1, 1, 1]);
});

test("a symbol stored as objects with no layers can still be set up", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.doc.library.Old = {
      objects: [{ type: "rect", x: 0, y: 0, width: 40, height: 20 }],
      layers: null, totalFrames: 60, behavior: "movieclip",
    };
    F.fullRefresh();
  });

  const res = await page.evaluate(() => window._flashyAudio.mouthSetup({
    symbolName: "Old", create: true, tighten: false,
  }));

  expect(res).not.toBeNull();
  expect(res.distinct).toBe(6);
  expect(res.frames.length).toBe(6);
});

test("a set-up symbol drives a lip sync that actually changes the mouth", async ({ page }) => {
  await openEditor(page);
  // The end-to-end claim: set up a plain symbol, sync, and the frames written
  // resolve to different drawings.
  await addPlainSymbol(page, "Face", 1, 1);
  await page.evaluate(() => window._flashyAudio.mouthSetup({
    symbolName: "Face", create: true, tighten: false,
  }));

  const name = await importSpeech(page, [
    { seconds: 0.1, type: "silence" }, { seconds: 0.4, type: "ah" },
    { seconds: 0.4, type: "ee" }, { seconds: 0.4, type: "oo" },
    { seconds: 0.1, type: "silence" },
  ]);

  const out = await page.evaluate((name) => {
    const r = window._flashyAudio.lipSync({
      assetName: name, startFrame: 1, offset: 0,
      symbolName: "Face", layerIndex: -1, minHold: 2, silence: 0.06,
    });
    const F = window._flashyAI;
    const kfs = F.doc.library.Face.layers[0].keyframes;
    const drawingAt = (f) => kfs.findIndex((k) => f >= k.index && f < k.index + k.duration);
    const layer = F.currentLayers()[r.layerIndex];
    return {
      shapesUsed: r.shapesUsed, shapesVisible: r.shapesVisible,
      drawings: layer.keyframes.map((k) => drawingAt(k.objects[0].firstFrame)),
    };
  }, name);

  expect(out.shapesVisible).toBe(out.shapesUsed);
  expect(out.drawings).not.toContain(-1);
  expect(new Set(out.drawings).size).toBeGreaterThan(1);
});

test("Set Up Mouth Shapes is on the Modify menu and opens a dialog", async ({ page }) => {
  await openEditor(page);

  const inModify = await page.evaluate(() =>
    window._flashyEditor.menus.find((m) => m.label === "Modify").items.map((i) => i.action));
  expect(inModify).toContain("mouthSetup");

  // With no symbols it explains what to do instead of presenting an empty picker.
  await page.evaluate(() => window._flashyEditor.doAction("mouthSetup"));
  let d = page.locator("#fy-dialog");
  await expect(d).toBeVisible();
  await expect(d).toContainText("Convert to Symbol");
  await d.getByText("OK").click();

  // With a symbol, the real dialog appears and runs.
  await addPlainSymbol(page, "Face", 1, 1);
  await page.evaluate(() => window._flashyEditor.doAction("mouthSetup"));
  d = page.locator("#fy-dialog");
  await expect(d).toBeVisible();
  await expect(d).toContainText("one frame per mouth shape");
  await d.getByRole("button", { name: "Set up" }).click();

  // It reports what it did, then opens the symbol for drawing.
  await expect(page.locator("#fy-dialog")).toContainText("Mouth chart:");
  await page.locator("#fy-dialog").getByText("Got it").click();

  const entered = await page.evaluate(() => {
    const el = document.getElementById("breadcrumb");
    return el ? el.textContent : "";
  });
  expect(entered).toContain("Face");
});
