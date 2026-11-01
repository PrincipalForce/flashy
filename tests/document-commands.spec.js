// Find and Replace, Match Stage Size to Contents, Revert, and keyboard
// shortcut customisation.
//
// The four document-wide commands. What they have in common is reach: every
// one of them does something a click cannot, because the thing it acts on is
// either spread across the whole document or is not on the stage at all.
//
// Find and Replace is the interesting one. The places artwork hides — nested
// groups, library symbols, other scenes — are exactly the places a per-kind
// search would forget, so the four search kinds share one walker and differ
// only in which field they read.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc } from "./helpers.js";

const text = (t, over = {}) => ({
  type: "text", x: 10, y: 10, width: 200, height: 40,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  text: t, font: "Arial", fontSize: 24, textAlign: "left", lineHeight: 1.2,
  fillColor: "#000000", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

const rect = (over = {}) => ({
  type: "rect", x: 0, y: 0, width: 50, height: 50,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#CC3344", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

const kf = (objects, index = 1, duration = 1) => ({
  index, duration, tweenType: "none", easing: "linear", script: "", objects,
});

/**
 * A document with text in four of the places text can hide: on the stage, in
 * a group, on a second scene, and inside a library symbol.
 */
function hidingPlacesDoc() {
  const sceneTwo = [{ name: "L", visible: true, locked: false,
    keyframes: [kf([text("hello from scene two")])] }];
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 5,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [kf([
        text("hello world"),
        { type: "group", x: 0, y: 60, width: 200, height: 40,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, groupW: 200, groupH: 40,
          children: [text("hello from a group", { x: 0, y: 0 })] },
      ], 1, 5)],
    }],
    scenes: [
      { name: "Scene 1", totalFrames: 5, layers: [{
        name: "L", visible: true, locked: false,
        keyframes: [kf([
          text("hello world"),
          { type: "group", x: 0, y: 60, width: 200, height: 40,
            rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, groupW: 200, groupH: 40,
            children: [text("hello from a group", { x: 0, y: 0 })] },
        ], 1, 5)],
      }] },
      { name: "Scene 2", totalFrames: 5, layers: sceneTwo },
    ],
    sceneIndex: 0,
    library: {
      Badge: {
        totalFrames: 1, behavior: "graphic",
        layers: [{ name: "Layer 1", visible: true, locked: false,
          keyframes: [kf([text("hello from a symbol")])] }],
      },
    },
  };
}

const find = (page, kind, term, opts = {}) =>
  page.evaluate(({ kind, term, opts }) =>
    window._flashyAI.frFind(kind, term, opts).map((h) => ({
      where: h.where, field: h.field, value: h.value,
      sceneIndex: h.sceneIndex, symbolName: h.symbolName,
    })), { kind, term, opts });

/* ------------------------------------------------------------------ *
 * Find
 * ------------------------------------------------------------------ */

test("a search reaches groups, other scenes and library symbols", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, hidingPlacesDoc());

  const hits = await find(page, "text", "hello");
  // Four places text can hide, and all four are found.
  expect(hits).toHaveLength(4);
  expect(hits.some((h) => h.where.includes("group"))).toBe(true);
  expect(hits.some((h) => h.where.includes("Scene 2"))).toBe(true);
  expect(hits.some((h) => h.symbolName === "Badge")).toBe(true);
});

test("the current scene scope stops at the current scene", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, hidingPlacesDoc());

  const hits = await find(page, "text", "hello", { scope: "scene" });
  // The stage text and the one in the group; not the other scene, not the
  // symbol.
  expect(hits).toHaveLength(2);
  expect(hits.every((h) => h.symbolName == null)).toBe(true);
});

test("match case and whole word narrow a text search", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, { ...hidingPlacesDoc(), scenes: undefined, library: {},
    layers: [{ name: "L", visible: true, locked: false,
      keyframes: [kf([text("Cat"), text("cat"), text("concatenate")])] }] });

  expect(await find(page, "text", "cat")).toHaveLength(3);
  expect(await find(page, "text", "cat", { matchCase: true })).toHaveLength(2);
  // "concatenate" contains cat but is not the word cat.
  expect(await find(page, "text", "cat", { wholeWord: true })).toHaveLength(2);
  expect(await find(page, "text", "cat", { wholeWord: true, matchCase: true }))
    .toHaveLength(1);
});

test("a regular expression search, and an unfinished one, are both survivable", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, { width: 300, height: 200, fps: 24, backgroundColor: "#FFF",
    totalFrames: 1, library: {},
    layers: [{ name: "L", visible: true, locked: false,
      keyframes: [kf([text("frame 1"), text("frame 22"), text("no digits here")])] }] });

  expect(await find(page, "text", "\\d+", { regex: true })).toHaveLength(2);
  // A half-typed pattern is a user mid-thought, not an error to throw at them.
  expect(await find(page, "text", "[unclosed", { regex: true })).toHaveLength(0);
});

test("a colour search finds fills and strokes, however the colour is written", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, { width: 300, height: 200, fps: 24, backgroundColor: "#FFF",
    totalFrames: 1, library: {},
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([
      rect({ fillColor: "#cc3344" }),
      rect({ fillColor: "#FFFFFF", strokeColor: "#CC3344", strokeWidth: 2,
             strokeStyle: "solid" }),
      rect({ fillColor: "#00FF00" }),
    ])] }] });

  // Lower case on the object, upper in the search, and a leading # that may or
  // may not be there: all the same colour.
  expect(await find(page, "color", "#CC3344")).toHaveLength(2);
  expect(await find(page, "color", "cc3344")).toHaveLength(2);
  const fields = (await find(page, "color", "#CC3344")).map((h) => h.field);
  expect(fields.sort()).toEqual(["fillColor", "strokeColor"]);
  // A three-digit colour means the same as its doubled form.
  expect(await find(page, "color", "#0F0")).toHaveLength(1);
});

test("font and symbol searches match a whole field, not part of one", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, { width: 300, height: 200, fps: 24, backgroundColor: "#FFF",
    totalFrames: 1,
    library: { Star: { totalFrames: 1, behavior: "graphic", layers: [] },
               Starburst: { totalFrames: 1, behavior: "graphic", layers: [] } },
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([
      text("a", { font: "Arial" }),
      text("b", { font: "Arial Black" }),
      { type: "symbol", symbolName: "Star", x: 0, y: 0, width: 10, height: 10,
        rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 },
      { type: "symbol", symbolName: "Starburst", x: 0, y: 0, width: 10, height: 10,
        rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 },
    ])] }] });

  // "Arial" must not match "Arial Black": a font is a name, not a substring.
  expect(await find(page, "font", "Arial")).toHaveLength(1);
  expect(await find(page, "symbol", "Star")).toHaveLength(1);
});

/* ------------------------------------------------------------------ *
 * Replace
 * ------------------------------------------------------------------ */

test("Replace All reaches every hiding place in one pass", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, hidingPlacesDoc());

  const n = await page.evaluate(() =>
    window._flashyAI.frReplaceAll("text", "hello", "goodbye", {}));
  expect(n).toBe(4);
  expect(await find(page, "text", "hello")).toHaveLength(0);
  expect(await find(page, "text", "goodbye")).toHaveLength(4);
});

test("every occurrence within one field is replaced", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, { width: 300, height: 200, fps: 24, backgroundColor: "#FFF",
    totalFrames: 1, library: {},
    layers: [{ name: "L", visible: true, locked: false,
      keyframes: [kf([text("red fish, red fish")])] }] });

  await page.evaluate(() => window._flashyAI.frReplaceAll("text", "red", "blue", {}));
  const after = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0].text);
  expect(after).toBe("blue fish, blue fish");
});

test("a symbol swap is refused when the replacement is not in the Library", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, { width: 300, height: 200, fps: 24, backgroundColor: "#FFF",
    totalFrames: 1,
    library: { Star: { totalFrames: 1, behavior: "graphic", layers: [] } },
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([
      { type: "symbol", symbolName: "Star", x: 0, y: 0, width: 10, height: 10,
        rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 },
    ])] }] });

  // An instance pointed at a symbol that does not exist draws nothing and
  // gives no clue why, so the swap is refused instead.
  const n = await page.evaluate(() =>
    window._flashyAI.frReplaceAll("symbol", "Star", "NotThere", {}));
  expect(n).toBe(0);
  const still = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0].symbolName);
  expect(still).toBe("Star");
});

test("Replace All is one undo step", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, hidingPlacesDoc());

  await page.evaluate(() => window._flashyAI.frReplaceAll("text", "hello", "goodbye", {}));
  expect(await find(page, "text", "goodbye")).toHaveLength(4);

  await page.evaluate(() => window._flashyEditor.doAction("undo"));
  expect(await find(page, "text", "hello")).toHaveLength(4);
});

test("the Find and Replace dialog lists what it found", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, hidingPlacesDoc());

  await page.evaluate(() => window._flashyEditor.doAction("findReplace"));
  await page.locator("#fy-dialog .fy-dialog-input").first().waitFor();
  // The second field is Find; typing in it re-runs the search live.
  await page.locator("#fy-dialog .fy-dialog-input").nth(1).fill("hello");
  await expect(page.locator("#fy-dialog .fr-hit")).toHaveCount(4);
  await expect(page.locator("#fy-dialog .fr-count")).toContainText("4 matches");
});

/* ------------------------------------------------------------------ *
 * Match Stage Size to Contents
 * ------------------------------------------------------------------ */

test("the stage shrinks to its contents and the artwork moves to the origin", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, { width: 800, height: 600, fps: 24, backgroundColor: "#FFF",
    totalFrames: 1, library: {},
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([
      rect({ x: 100, y: 50, width: 60, height: 40 }),
      rect({ x: 200, y: 120, width: 40, height: 30 }),
    ])] }] });

  const r = await page.evaluate(() => window._flashyAI.matchStageToContents(0));
  // 100..240 across and 50..150 down.
  expect(r).toMatchObject({ ok: true, width: 140, height: 100 });

  const boxes = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects
      .map((o) => [o.x, o.y]));
  // A stage is always 0,0 to width,height, so fitting content that started at
  // 100,50 means moving it rather than inventing a negative stage.
  expect(boxes[0]).toEqual([0, 0]);
  expect(boxes[1]).toEqual([100, 70]);
});

test("the measure covers every frame, not just the one on screen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, { width: 800, height: 600, fps: 24, backgroundColor: "#FFF",
    totalFrames: 10, library: {},
    layers: [{ name: "L", visible: true, locked: false, keyframes: [
      kf([rect({ x: 0, y: 0, width: 50, height: 50 })], 1, 5),
      // Frame 6's artwork is far to the right; a stage sized to frame 1 would
      // clip it, which is the opposite of what this command is for.
      kf([rect({ x: 300, y: 0, width: 50, height: 50 })], 6, 5),
    ] }] });

  const r = await page.evaluate(() => window._flashyAI.matchStageToContents(0));
  expect(r.width).toBe(350);
});

test("a rotated object is measured by the space it actually occupies", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, { width: 800, height: 600, fps: 24, backgroundColor: "#FFF",
    totalFrames: 1, library: {},
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([
      rect({ x: 100, y: 100, width: 100, height: 100, rotation: 45 }),
    ])] }] });

  const r = await page.evaluate(() => window._flashyAI.matchStageToContents(0));
  // A 100px square turned 45 degrees needs about 141px each way.
  expect(r.width).toBeGreaterThan(138);
  expect(r.width).toBeLessThan(144);
  expect(r.width).toBe(r.height);
});

test("an empty stage says so rather than collapsing to nothing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, { width: 400, height: 300, fps: 24, backgroundColor: "#FFF",
    totalFrames: 1, library: {},
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([])] }] });

  const r = await page.evaluate(() => window._flashyAI.matchStageToContents(0));
  expect(r.ok).toBe(false);
  const size = await page.evaluate(() =>
    [window._flashyAI.doc.width, window._flashyAI.doc.height]);
  expect(size).toEqual([400, 300]);
});

/* ------------------------------------------------------------------ *
 * Revert
 * ------------------------------------------------------------------ */

test("Revert goes back to the last saved version", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, { width: 300, height: 200, fps: 24, backgroundColor: "#FFF",
    totalFrames: 1, library: {},
    layers: [{ name: "L", visible: true, locked: false,
      keyframes: [kf([text("as saved")])] }] });

  await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.pushUndo();
    o.text = "edited since";
    F.fullRefresh();
  });
  expect(await page.evaluate(() => window._flashyEditor.isDirty())).toBe(true);

  await page.evaluate(() => window._flashyEditor.doAction("revert"));
  await page.locator("#fy-dialog .fy-dialog-btn.primary").click();

  const back = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0].text);
  expect(back).toBe("as saved");
  // Reverting lands on the saved state, so the document is clean again.
  expect(await page.evaluate(() => window._flashyEditor.isDirty())).toBe(false);
});

test("Revert declines when there is nothing to discard", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, { width: 300, height: 200, fps: 24, backgroundColor: "#FFF",
    totalFrames: 1, library: {},
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([])] }] });

  await page.evaluate(() => window._flashyEditor.doAction("revert"));
  await expect(page.locator("#fy-dialog .fy-dialog-msg"))
    .toContainText("no unsaved changes");
});

/* ------------------------------------------------------------------ *
 * Keyboard shortcuts
 * ------------------------------------------------------------------ */

test("a key event resolves to one canonical chord", async ({ page }) => {
  await openEditor(page);
  const chords = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      plain: F.keyChord({ key: "k" }),
      shifted: F.keyChord({ key: "K", ctrlKey: true, shiftKey: true }),
      lower: F.keyChord({ key: "k", ctrlKey: true, shiftKey: true }),
      fn: F.keyChord({ key: "F7" }),
      meta: F.keyChord({ key: "s", metaKey: true }),
      bare: F.keyChord({ key: "Shift", shiftKey: true }),
    };
  });
  expect(chords.plain).toBe("K");
  /* The browser reports the SHIFTED character, so binding one spelling while
     the user presses the other is a shortcut that never fires. Both spellings
     resolve to the same chord. */
  expect(chords.shifted).toBe("Ctrl+Shift+K");
  expect(chords.lower).toBe("Ctrl+Shift+K");
  expect(chords.fn).toBe("F7");
  // Cmd on a Mac is the same key as Ctrl everywhere else in the editor.
  expect(chords.meta).toBe("Ctrl+S");
  // A modifier alone is half a chord, not a chord.
  expect(chords.bare).toBe("");
});

test("every menu command is bindable", async ({ page }) => {
  await openEditor(page);
  const cmds = await page.evaluate(() => window._flashyAI.shortcutCommands());
  expect(cmds.length).toBeGreaterThan(50);
  // Each carries where it lives and what it already answers to.
  const save = cmds.find((c) => c.action === "save");
  expect(save.label).toContain("File");
  expect(save.dflt).toBe("Ctrl+S");
  expect(cmds.some((c) => c.action === "findReplace")).toBe(true);
});

test("a user binding fires, and survives a reload", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, { width: 300, height: 200, fps: 24, backgroundColor: "#FFF",
    totalFrames: 1, library: {},
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([])] }] });

  await page.evaluate(() =>
    window._flashyAI.setShortcutOverride("Ctrl+Alt+J", "findReplace"));

  // Focus the document, not a field: the handler ignores keys typed into one.
  await page.locator("#stageCanvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+Alt+J");
  await expect(page.locator("#fy-dialog .fy-dialog-title"))
    .toHaveText("Find and Replace");
  await page.keyboard.press("Escape");

  // It is stored, not just set: a binding that evaporated on reload would be
  // worse than no customisation at all.
  await page.reload();
  await page.waitForFunction(() => !!window._flashyAI);
  const kept = await page.evaluate(() => window._flashyAI.shortcutOverrides());
  expect(kept["Ctrl+Alt+J"]).toBe("findReplace");

  await page.evaluate(() => window._flashyAI.clearShortcutOverrides());
});

test("the shortcuts dialog lists and filters the commands", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => window._flashyEditor.doAction("shortcuts"));
  await expect(page.locator("#fy-dialog .sc-row").first()).toBeVisible();

  const all = await page.locator("#fy-dialog .sc-row").count();
  await page.locator("#fy-dialog .fy-dialog-input").first().fill("publish");
  const some = await page.locator("#fy-dialog .sc-row").count();
  expect(some).toBeGreaterThan(0);
  expect(some).toBeLessThan(all);
  await expect(page.locator("#fy-dialog .sc-row").first()).toContainText("Publish");
});
