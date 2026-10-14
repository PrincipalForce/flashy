// Copy / Cut / Paste Frames.
//
// These were stubs that popped "coming soon" for the life of the project. The
// hard part is not the clipboard, it is `clearSpan`: emptying a range of frames
// without destroying what lies either side of it. A keyframe running frames
// 1-8 with frames 3-6 cleared must leave 1-2 and 7-8 intact, and the obvious
// implementation — drop any keyframe that overlaps — silently loses both.
//
// That same bug was live in Convert Frames to Symbol, so it is covered here
// too.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc } from "./helpers.js";

function rect(colour, x) {
  return {
    type: "rect", x, y: 100, width: 40, height: 40,
    rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
    fillColor: colour, fillAlpha: 1, fillType: "solid",
    strokeColor: colour, strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  };
}

/** One layer, one keyframe held across frames 1-8. */
function heldDoc() {
  return {
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 8,
    layers: [{
      name: "Only", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 8, tweenType: "none", easing: "linear", script: "",
        objects: [rect("#CC3333", 100)],
      }],
    }],
    library: {}, sounds: {}, characters: {},
  };
}

/** Two layers, two keyframes each, over frames 1-8. */
function sceneDoc() {
  const layer = (name, colour, x) => ({
    name, visible: true, locked: false,
    keyframes: [
      { index: 1, duration: 4, tweenType: "motion", easing: "linear", script: "",
        objects: [rect(colour, x)] },
      { index: 5, duration: 4, tweenType: "none", easing: "linear", script: "",
        objects: [rect(colour, x + 60)] },
    ],
  });
  return {
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 8,
    layers: [layer("Top", "#CC3333", 100), layer("Bottom", "#3333CC", 200)],
    library: {}, sounds: {}, characters: {},
  };
}

const kfsOf = (page, li = 0) => page.evaluate((li) => {
  const l = window._flashyAI.currentLayers()[li];
  return l.keyframes.map((k) => ({ i: k.index, d: k.duration, n: k.objects.length }));
}, li);

test("clearing the middle of a held keyframe keeps both ends", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, heldDoc());

  // Frames 3-6 of a keyframe running 1-8.
  await page.evaluate(() => window._flashyAI.clearSpan(0, 3, 6));

  // Head keeps frames 1-2, tail resumes at 7 with the same artwork showing —
  // which is what the timeline looked like before the clear.
  expect(await kfsOf(page)).toEqual([
    { i: 1, d: 2, n: 1 },
    { i: 7, d: 2, n: 1 },
  ]);
  expect(errors).toEqual([]);
});

test("clearing an edge trims rather than removing", async ({ page }) => {
  await openEditor(page);

  // From the front.
  await loadDoc(page, heldDoc());
  await page.evaluate(() => window._flashyAI.clearSpan(0, 1, 3));
  expect(await kfsOf(page)).toEqual([{ i: 4, d: 5, n: 1 }]);

  // From the back.
  await loadDoc(page, heldDoc());
  await page.evaluate(() => window._flashyAI.clearSpan(0, 6, 8));
  expect(await kfsOf(page)).toEqual([{ i: 1, d: 5, n: 1 }]);

  // The whole thing.
  await loadDoc(page, heldDoc());
  await page.evaluate(() => window._flashyAI.clearSpan(0, 1, 8));
  expect(await kfsOf(page)).toEqual([]);
});

test("copy then paste reproduces the block somewhere else", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, sceneDoc());

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.tlSelect(0, 1, 1, 8);
    const copied = F.copyFrames();
    // Paste further along, on the same layers.
    F.setCurFrame(11);
    F.setCurLayer(0);
    const pasted = F.pasteFrames();
    return {
      copied, pasted,
      top: F.currentLayers()[0].keyframes.map((k) => ({ i: k.index, d: k.duration })),
      bottom: F.currentLayers()[1].keyframes.map((k) => ({ i: k.index, d: k.duration })),
      totalFrames: F.doc.totalFrames,
      // The pasted block is left selected, ready to paste again.
      range: F.tlRange(),
    };
  });

  expect(out.copied).toEqual({ frames: 8, layers: 2 });
  expect(out.pasted).toMatchObject({ frames: 8, layers: 2, startFrame: 11, endFrame: 18 });
  // Original 1-8 untouched, copy at 11-18 with the same internal spacing.
  expect(out.top).toEqual([
    { i: 1, d: 4 }, { i: 5, d: 4 }, { i: 11, d: 4 }, { i: 15, d: 4 },
  ]);
  expect(out.bottom).toEqual([
    { i: 1, d: 4 }, { i: 5, d: 4 }, { i: 11, d: 4 }, { i: 15, d: 4 },
  ]);
  expect(out.totalFrames).toBeGreaterThanOrEqual(18);
  expect(out.range).toEqual({ l0: 0, l1: 1, f0: 11, f1: 18 });
  expect(errors).toEqual([]);
});

test("the clipboard is a deep copy, so later edits do not follow it", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sceneDoc());

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.tlSelect(0, 1, 0, 4);
    F.copyFrames();
    // Change the source after copying. A clipboard holding live references
    // would paste this change — and undo/redo rebuilds every object in the
    // document, so references would be dangling too.
    F.currentLayers()[0].keyframes[0].objects[0].fillColor = "#00FF00";
    F.setCurFrame(20);
    F.pasteFrames();
    return {
      source: F.currentLayers()[0].keyframes[0].objects[0].fillColor,
      pasted: F.currentLayers()[0].keyframes.find((k) => k.index === 20).objects[0].fillColor,
    };
  });

  expect(out.source).toBe("#00FF00");
  expect(out.pasted).toBe("#CC3333");
});

test("pasting overwrites the destination without harming its surroundings", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, heldDoc());

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    // Copy two frames from the start.
    F.tlSelect(0, 1, 0, 2);
    F.copyFrames();
    // Paste into the middle of the held keyframe.
    F.setCurFrame(4);
    F.setCurLayer(0);
    F.pasteFrames();
    return F.currentLayers()[0].keyframes.map((k) => ({ i: k.index, d: k.duration }));
  });

  // 1-3 survives, the pasted 2 frames land at 4-5, and the tail resumes at 6.
  expect(out).toEqual([
    { i: 1, d: 3 }, { i: 4, d: 2 }, { i: 6, d: 3 },
  ]);
});

test("pasting deeper than the layers available creates them", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sceneDoc());

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.tlSelect(0, 1, 1, 4);     // two layers
    F.copyFrames();
    // Paste starting on the *bottom* layer: there is only one layer below, so
    // the second would otherwise be dropped on the floor.
    F.setCurLayer(1);
    F.setCurFrame(1);
    const res = F.pasteFrames();
    return {
      res,
      layers: F.currentLayers().map((l) => l.name),
      newLayerKfs: F.currentLayers()[2]
        ? F.currentLayers()[2].keyframes.map((k) => k.index) : null,
    };
  });

  expect(out.res.layersCreated).toBe(1);
  expect(out.layers.length).toBe(3);
  expect(out.newLayerKfs).toEqual([1]);
});

test("cut copies and empties, and one undo puts it back", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sceneDoc());

  const afterCut = await page.evaluate(() => {
    const F = window._flashyAI;
    F.tlSelect(0, 1, 0, 4);
    window._flashyEditor.doAction("cutFrames");
    return {
      top: F.currentLayers()[0].keyframes.map((k) => ({ i: k.index, d: k.duration })),
      clipboard: F.hasFrameClipboard(),
    };
  });

  // Frames 1-4 gone, 5-8 untouched.
  expect(afterCut.top).toEqual([{ i: 5, d: 4 }]);
  expect(afterCut.clipboard).toBe(true);

  await page.keyboard.press("Control+z");
  expect(await kfsOf(page)).toEqual([
    { i: 1, d: 4, n: 1 }, { i: 5, d: 4, n: 1 },
  ]);
});

test("pasting with nothing copied says so instead of doing nothing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sceneDoc());

  expect(await page.evaluate(() => window._flashyAI.hasFrameClipboard())).toBe(false);
  await page.evaluate(() => window._flashyEditor.doAction("pasteFrames"));
  const d = page.locator("#fy-dialog");
  await expect(d).toContainText("Nothing has been copied");
  await d.getByText("OK").click();

  // And copying with no selection likewise.
  await page.evaluate(() => {
    window._flashyAI.tlSelect(0, 40, 0, 44);
  });
  const res = await page.evaluate(() => window._flashyAI.copyFrames({ range: null }));
  expect(typeof res).toBe("object");   // frames 40-44 is a legal, empty block
});

test("Ctrl+Alt+C/V copy frames, and plain Ctrl+C still copies objects", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sceneDoc());

  // Ctrl+Alt+C must not fall through to the object Copy below it in the
  // handler, which is exactly what it did before the guard.
  await page.evaluate(() => { window._flashyAI.tlSelect(0, 1, 1, 4); });
  await page.keyboard.press("Control+Alt+c");
  expect(await page.evaluate(() => window._flashyAI.hasFrameClipboard())).toBe(true);

  await page.evaluate(() => {
    window._flashyAI.setCurFrame(21);
    window._flashyAI.setCurLayer(0);
  });
  await page.keyboard.press("Control+Alt+v");
  expect(await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].keyframes.some((k) => k.index === 21))).toBe(true);

  // Plain Ctrl+C still means "copy the selected objects".
  const objCopy = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setCurFrame(1);
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.setSelection([o]);
    return o.fillColor;
  });
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  const count = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects.length);
  expect(count).toBe(2);
  expect(objCopy).toBe("#CC3333");
});

test("Copy/Paste Frames are on the Edit menu and the timeline menu", async ({ page }) => {
  await openEditor(page);

  const edit = await page.evaluate(() =>
    window._flashyEditor.menus.find((m) => m.label === "Edit").items.map((i) => i.action));
  expect(edit).toContain("copyFrames");
  expect(edit).toContain("cutFrames");
  expect(edit).toContain("pasteFrames");

  // No stubs left anywhere.
  const stubbed = await page.evaluate(() =>
    document.body.textContent.indexOf("coming soon") >= 0);
  expect(stubbed).toBe(false);
});

test("converting frames to a symbol no longer eats the frames either side", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, heldDoc());

  // The latent bug clearSpan fixes: replacing frames 3-6 of a keyframe running
  // 1-8 used to drop the whole keyframe, losing frames 1-2 and 7-8.
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.tlSelect(0, 3, 0, 6);
    const res = F.framesToSymbol({ name: "Mid", replace: true });
    if (typeof res === "string") return { error: res };
    return {
      kfs: F.currentLayers()[0].keyframes.map((k) => ({
        i: k.index, d: k.duration,
        objs: k.objects.map((o) => o.symbolName || o.type),
      })),
    };
  });

  expect(out.error).toBeUndefined();
  expect(out.kfs).toEqual([
    { i: 1, d: 2, objs: ["rect"] },   // kept
    { i: 3, d: 4, objs: ["Mid"] },    // the instance
    { i: 7, d: 2, objs: ["rect"] },   // kept
  ]);
});
