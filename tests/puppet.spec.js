// Puppet mechanics: Graphic / MovieClip / Button symbol behaviours.
//
// `symbolBehavior` was stored on every object and consulted by nothing — every
// symbol instance rendered frame 1 forever, which made the most common Flash
// animation technique unavailable. You animate a mouth, a hand or a blink by
// *picking a frame of a symbol*, not by redrawing.
//
// The three behaviours differ in which frame an instance shows:
//   Graphic   — chosen relative to the parent timeline, so it previews while
//               you scrub. This is what lip sync is built on.
//   MovieClip — its own independent timeline; frame 1 while editing.
//   Button    — Up/Over/Down/Hit on frames 1–4.
import { test, expect } from "@playwright/test";
import { openEditor, downloadFromAction, runExportedHTML } from "./helpers.js";

/**
 * A document with one symbol whose timeline has `frames` single-frame
 * keyframes, each holding a differently-coloured rect, plus one instance of
 * it on the scene. Distinct colours make "which frame is showing" observable
 * from pixels as well as from the model.
 */
function puppetDoc({ frames = 4, behavior = "graphic", loopMode = "loop", firstFrame = 1 } = {}) {
  const COLORS = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];
  const rect = (color) => ({
    type: "rect", x: 0, y: 0, width: 50, height: 50,
    rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
    fillColor: color, fillAlpha: 1, fillType: "solid",
    strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  });
  const keyframes = [];
  for (let i = 0; i < frames; i++) {
    keyframes.push({
      index: i + 1, duration: 1, tweenType: "none", easing: "linear", script: "",
      objects: [rect(COLORS[i % COLORS.length])],
    });
  }
  return {
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 24,
    layers: [{
      name: "Scene", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 24, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "symbol", symbolName: "Mouth", instanceName: "mouth",
          symbolBehavior: behavior, firstFrame, loopMode,
          x: 100, y: 100, width: 50, height: 50,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
        }],
      }],
    }],
    library: {
      Mouth: {
        objects: [rect(COLORS[0])],
        layers: [{ name: "Layer 1", visible: true, locked: false, keyframes }],
        totalFrames: frames,
        behavior: "movieclip",
      },
    },
    sounds: {},
  };
}

/** Which frame of the symbol the stage is showing, read from the pixels. */
async function shownColor(page) {
  return page.evaluate(() => {
    const c = document.getElementById("stageCanvas");
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    // The instance sits at doc (100,100)+25; convert to canvas pixels.
    const F = window._flashyAI;
    const ox = (c.clientWidth - F.doc.width) / 2;
    const oy = (c.clientHeight - F.doc.height) / 2;
    const d = ctx.getImageData(Math.round((ox + 125) * dpr), Math.round((oy + 125) * dpr), 1, 1).data;
    return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  });
}

test("a Graphic shows the frame you pick", async ({ page }) => {
  const errors = await openEditor(page);
  await page.evaluate((d) => window._flashyEditor.loadDoc(d), puppetDoc({ loopMode: "single", firstFrame: 1 }));

  expect(await shownColor(page)).toBe("#FF0000"); // frame 1

  for (const [frame, color] of [[2, "#00FF00"], [3, "#0000FF"], [4, "#FFFF00"]]) {
    await page.evaluate((f) => {
      const F = window._flashyAI;
      F.doc.layers[0].getKeyframeAt(1).objects[0].firstFrame = f;
      F.fullRefresh();
    }, frame);
    expect(await shownColor(page), `frame ${frame}`).toBe(color);
  }
  expect(errors).toEqual([]);
});

test("a looping Graphic advances with the parent playhead", async ({ page }) => {
  await openEditor(page);
  await page.evaluate((d) => window._flashyEditor.loadDoc(d), puppetDoc({ loopMode: "loop", firstFrame: 1 }));

  // The symbol has 4 frames; scrubbing the SCENE steps the graphic through
  // them and wraps. This is the behaviour that makes a graphic previewable.
  const seen = [];
  for (const f of [1, 2, 3, 4, 5, 6]) {
    await page.evaluate((f) => { window._flashyAI.setCurFrame(f); window._flashyAI.fullRefresh(); }, f);
    seen.push(await shownColor(page));
  }
  expect(seen).toEqual(["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF0000", "#00FF00"]);
});

test("Play Once clamps on the last frame instead of wrapping", async ({ page }) => {
  await openEditor(page);
  await page.evaluate((d) => window._flashyEditor.loadDoc(d), puppetDoc({ loopMode: "once" }));

  const seen = [];
  for (const f of [3, 4, 5, 9]) {
    await page.evaluate((f) => { window._flashyAI.setCurFrame(f); window._flashyAI.fullRefresh(); }, f);
    seen.push(await shownColor(page));
  }
  // frames 3,4 then held at 4 (#FFFF00) forever.
  expect(seen).toEqual(["#0000FF", "#FFFF00", "#FFFF00", "#FFFF00"]);
});

test("a Movie Clip shows frame 1 on the authoring stage regardless of the playhead", async ({ page }) => {
  await openEditor(page);
  await page.evaluate((d) => window._flashyEditor.loadDoc(d), puppetDoc({ behavior: "movieclip" }));

  for (const f of [1, 3, 7]) {
    await page.evaluate((f) => { window._flashyAI.setCurFrame(f); window._flashyAI.fullRefresh(); }, f);
    // Same as Flash: a MovieClip does not preview while you edit.
    expect(await shownColor(page), `scene frame ${f}`).toBe("#FF0000");
  }
});

test("Swap Symbol repoints an instance and keeps its transform", async ({ page }) => {
  await openEditor(page);
  await page.evaluate((d) => {
    window._flashyEditor.loadDoc(d);
    const F = window._flashyAI;
    // A second symbol to swap to.
    F.doc.library.Hand = {
      objects: [], totalFrames: 1, behavior: "movieclip",
      layers: [{
        name: "Layer 1", visible: true, locked: false,
        keyframes: [{
          index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
          objects: [{
            type: "rect", x: 0, y: 0, width: 50, height: 50,
            rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
            fillColor: "#112233", fillAlpha: 1, fillType: "solid",
            strokeColor: "#000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
          }],
        }],
      }],
    };
  }, puppetDoc({ loopMode: "single", firstFrame: 3 }));

  const before = await page.evaluate(() => {
    const o = window._flashyAI.doc.layers[0].getKeyframeAt(1).objects[0];
    return { x: o.x, y: o.y, behavior: o.symbolBehavior, firstFrame: o.firstFrame };
  });
  expect(before.firstFrame).toBe(3);

  const after = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.doc.layers[0].getKeyframeAt(1).objects[0];
    F.setSelection([o]);
    F.updateProps();
    // Open the Swap Symbol menu and choose the other symbol.
    const btn = Array.from(document.querySelectorAll(".props-btn-action"))
      .find((b) => b.textContent === "Swap Symbol");
    btn.click();
    const item = Array.from(document.querySelectorAll(".tl-ctx-menu *"))
      .find((n) => n.textContent.trim().endsWith("Hand"));
    item.click();
    const o2 = F.doc.layers[0].getKeyframeAt(1).objects[0];
    return { symbolName: o2.symbolName, x: o2.x, y: o2.y, behavior: o2.symbolBehavior, firstFrame: o2.firstFrame };
  });

  expect(after.symbolName).toBe("Hand");
  expect(after.x).toBe(before.x);
  expect(after.y).toBe(before.y);
  expect(after.behavior).toBe(before.behavior);
  // Hand has one frame, so a frame-3 pick has to be clamped back.
  expect(after.firstFrame).toBe(1);
});

test("exported Movie Clips run their own timeline", async ({ page, context }) => {
  await openEditor(page);
  await page.evaluate((d) => window._flashyEditor.loadDoc(d), puppetDoc({ behavior: "movieclip" }));

  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() => window.__stage && window.__stage.root.children.length > 0);

  const clip = await out.evaluate(() => {
    const inst = window.__stage.root.children.find((c) => c.name === "mouth");
    const mc = inst && inst.children[0];
    return mc ? { total: mc.totalFrames, frame: mc.currentFrame, playing: mc.playing } : null;
  });
  expect(clip, "the instance exported as a nested clip").not.toBeNull();
  expect(clip.total).toBe(4);

  // It advances on its own — and it is the SAME object each frame, not a
  // rebuilt one, or its playhead would be stuck at 1.
  await out.waitForFunction(
    () => {
      const inst = window.__stage.root.children.find((c) => c.name === "mouth");
      return inst && inst.children[0] && inst.children[0].currentFrame > 1;
    },
    null,
    { timeout: 4000 },
  );
  expect(errors).toEqual([]);
  await out.close();
});

test("exported Graphics are driven by the parent timeline", async ({ page, context }) => {
  await openEditor(page);
  await page.evaluate((d) => window._flashyEditor.loadDoc(d), puppetDoc({ behavior: "graphic", loopMode: "single", firstFrame: 2 }));

  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() => window.__stage && window.__stage.root.children.length > 0);

  // Single Frame pins it: the child is a plain holder, not a running clip.
  const held = await out.evaluate(() => {
    const inst = window.__stage.root.children.find((c) => c.name === "mouth");
    const inner = inst && inst.children[0];
    return { kids: inner ? inner.children.length : 0, isClip: !!(inner && inner.totalFrames > 1) };
  });
  expect(held.kids).toBe(1);
  expect(held.isClip).toBe(false);
  expect(errors).toEqual([]);
  await out.close();
});

test("exported Buttons build their state frames and react to the pointer", async ({ page, context }) => {
  await openEditor(page);
  await page.evaluate((d) => window._flashyEditor.loadDoc(d), puppetDoc({ behavior: "button", frames: 4 }));

  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() => window.__stage && window.__stage.root.children.length > 0);

  const states = await out.evaluate(() => {
    const inst = window.__stage.root.children.find((c) => c.name === "mouth");
    const btn = inst && inst.children[0];
    if (!btn || !btn._states) return null;
    return {
      names: Object.keys(btn._states),
      visible: Object.keys(btn._states).filter((n) => btn._states[n].visible && n !== "hit"),
    };
  });
  expect(states, "the instance exported as a button").not.toBeNull();
  expect(states.names).toEqual(["up", "over", "down", "hit"]);
  // Up is what shows until the pointer arrives.
  expect(states.visible).toEqual(["up"]);

  // Moving the pointer over it swaps to the Over frame — and survives the
  // root's per-frame rebuild, which is the whole reason buttons are cached.
  const canvas = await out.locator("#stage").boundingBox();
  await out.mouse.move(canvas.x + 125, canvas.y + 125);
  await out.waitForTimeout(250);
  const hovered = await out.evaluate(() => {
    const btn = window.__stage.root.children.find((c) => c.name === "mouth").children[0];
    return Object.keys(btn._states).filter((n) => btn._states[n].visible && n !== "hit");
  });
  expect(hovered).toEqual(["over"]);

  expect(errors).toEqual([]);
  await out.close();
});
