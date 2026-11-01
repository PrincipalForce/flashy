// Several documents at once, recent files, and Edit in New Window.
//
// Flashy opened one document and that was that: New threw away what you had,
// and comparing two cartoons meant two browser windows with no way to move
// anything between them.
//
// A document here is its serialised form plus a name, so switching tabs is
// parking one and loading another through the paths that already exist. There
// is no second kind of document and no second loader — which is what keeps
// this from becoming a second editor.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc } from "./helpers.js";

const kf = (objects, over = {}) => ({
  index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
  objects, ...over,
});

const box = (color, over = {}) => ({
  type: "rect", x: 10, y: 10, width: 50, height: 50,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: color, fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

function docWith(objs, over = {}) {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf(objs)] }],
    library: {},
    ...over,
  };
}

const tabs = (page) =>
  page.evaluate(() => {
    const F = window._flashyAI;
    return { names: F.openDocs().map((d) => d.name), active: F.activeDocId() };
  });

/* ------------------------------------------------------------------ *
 * Tabs
 * ------------------------------------------------------------------ */

test("one document means no tab bar", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box("#CC3344")]));

  const t = await tabs(page);
  expect(t.names).toHaveLength(1);
  // A bar showing a single tab is pure chrome, and the editor has always had
  // exactly one document.
  await expect(page.locator("#doc-tabs")).toBeHidden();
});

test("a second document opens beside the first, not over it", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box("#CC3344")]));
  await page.evaluate(() => window._flashyAI.renameDocTab(
    window._flashyAI.activeDocId(), "First"));

  await page.evaluate(() =>
    window._flashyAI.addDocTab("Second", JSON.stringify({
      width: 400, height: 300, fps: 12, backgroundColor: "#000000",
      totalFrames: 1, library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear",
        script: "", objects: [] }] }],
    })));

  const t = await tabs(page);
  expect(t.names).toEqual(["First", "Second"]);
  await expect(page.locator("#doc-tabs")).toBeVisible();
  await expect(page.locator(".doc-tab")).toHaveCount(2);

  // The second one is on screen, with its own stage size and frame rate.
  const now = await page.evaluate(() => ({
    w: window._flashyAI.doc.width, fps: window._flashyAI.doc.fps,
  }));
  expect(now).toEqual({ w: 400, fps: 12 });
});

test("switching back finds the first document exactly as it was", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box("#CC3344")]));

  const ids = await page.evaluate(() => {
    const F = window._flashyAI;
    const first = F.activeDocId();
    F.renameDocTab(first, "First");
    // Move the playhead and add artwork, so there is state worth keeping.
    F.doc.totalFrames = 9;
    F.setCurFrame(5);
    const second = F.addDocTab("Second", null).id;
    return { first, second };
  });

  await page.evaluate((id) => window._flashyAI.showDocTab(id), ids.first);
  const back = await page.evaluate(() => ({
    frame: window._flashyAI.curFrame(),
    objects: window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects.length,
    colour: window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0].fillColor,
  }));
  /* The playhead too: parking a document that only remembered its artwork
     would drop you back on frame 1 every time, which is maddening in a long
     movie. */
  expect(back.frame).toBe(5);
  expect(back.objects).toBe(1);
  expect(back.colour).toBe("#CC3344");
});

test("a tab carries its own unsaved state", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box("#CC3344")]));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    const first = F.activeDocId();
    // Dirty the first document.
    F.pushUndo();
    F.currentLayers()[0].getKeyframeAt(1).objects[0].x = 99;
    F.fullRefresh();
    const dirtyBefore = window._flashyEditor.isDirty();

    const second = F.addDocTab("Clean", JSON.stringify({
      width: 300, height: 200, fps: 24, backgroundColor: "#FFF", totalFrames: 1,
      library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear",
        script: "", objects: [] }] }],
    })).id;
    void second;
    const dirtyOnSecond = window._flashyEditor.isDirty();

    F.showDocTab(first);
    return { dirtyBefore, dirtyOnSecond,
             dirtyBack: window._flashyEditor.isDirty(),
             x: F.currentLayers()[0].getKeyframeAt(1).objects[0].x };
  });
  expect(out.dirtyBefore).toBe(true);
  // A freshly loaded tab is clean...
  expect(out.dirtyOnSecond).toBe(false);
  /* ...and coming back to one with unsaved changes finds them still unsaved.
     loadDocFromObject marks a document clean, which is right for a file off
     disk and wrong for a tab. */
  expect(out.dirtyBack).toBe(true);
  expect(out.x).toBe(99);
});

test("a tab shows a marker when it has unsaved changes", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box("#CC3344")]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.renameDocTab(F.activeDocId(), "Work");
    F.addDocTab("Other", null);
    F.showDocTab(F.openDocs()[0].id);
    F.pushUndo();
    F.currentLayers()[0].getKeyframeAt(1).objects[0].x = 42;
    F.fullRefresh();
    F.updateDocTabs();
  });
  await expect(page.locator(".doc-tab.active")).toContainText("Work *");
});

test("the last document cannot be closed", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box("#CC3344")]));
  const r = await page.evaluate(() =>
    window._flashyAI.closeDocTab(window._flashyAI.activeDocId()));
  /* An editor with no document is a state with no way out of it, and Flash
     never had one either. */
  expect(r.ok).toBe(false);
  expect(r.why).toContain("only document");
});

test("closing the active tab shows a neighbour", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box("#CC3344")]));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.renameDocTab(F.activeDocId(), "One");
    F.addDocTab("Two", null);
    F.addDocTab("Three", null);
    const closing = F.activeDocId();
    const r = F.closeDocTab(closing);
    return { r, names: F.openDocs().map((d) => d.name),
             active: F.openDocs().filter((d) => d.id === F.activeDocId())[0].name };
  });
  expect(out.r.ok).toBe(true);
  expect(out.r.closed).toBe("Three");
  expect(out.names).toEqual(["One", "Two"]);
  expect(out.active).toBe("Two");
});

test("closing an inactive tab leaves the current document alone", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box("#CC3344")]));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    const first = F.activeDocId();
    F.renameDocTab(first, "One");
    F.addDocTab("Two", null);
    const active = F.activeDocId();
    F.closeDocTab(first);
    return { stillActive: F.activeDocId() === active,
             names: F.openDocs().map((d) => d.name) };
  });
  expect(out.stillActive).toBe(true);
  expect(out.names).toEqual(["Two"]);
});

test("clicking a tab switches to it", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box("#CC3344")]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.renameDocTab(F.activeDocId(), "Alpha");
    F.addDocTab("Beta", JSON.stringify({
      width: 640, height: 480, fps: 24, backgroundColor: "#FFF", totalFrames: 1,
      library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear",
        script: "", objects: [] }] }],
    }));
  });

  await page.locator(".doc-tab", { hasText: "Alpha" }).click();
  expect(await page.evaluate(() => window._flashyAI.doc.width)).toBe(300);
  await page.locator(".doc-tab", { hasText: "Beta" }).click();
  expect(await page.evaluate(() => window._flashyAI.doc.width)).toBe(640);
});

/* ------------------------------------------------------------------ *
 * Recent files
 * ------------------------------------------------------------------ */

test("a document is remembered, and reopens into a tab", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box("#3366CC")]));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.clearRecent();
    F.rememberRecent("Cartoon");
    const list = F.recentFiles();
    // Something else on screen, so reopening has to really restore.
    F.doc.width = 999;
    const r = F.openRecent("Cartoon");
    return { list: list.map((x) => x.name), r, width: F.doc.width,
             colour: F.currentLayers()[0].getKeyframeAt(1).objects[0].fillColor };
  });
  expect(out.list).toEqual(["Cartoon"]);
  expect(out.r.ok).toBe(true);
  expect(out.width).toBe(300);
  expect(out.colour).toBe("#3366CC");
  await page.evaluate(() => window._flashyAI.clearRecent());
});

test("the list is newest first, deduplicated by name, and bounded", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box("#CC3344")]));

  const names = await page.evaluate(() => {
    const F = window._flashyAI;
    F.clearRecent();
    ["a", "b", "c", "d", "e", "f", "g", "h"].forEach((n) => F.rememberRecent(n));
    // The same name again moves it to the front rather than appearing twice.
    F.rememberRecent("c");
    return F.recentFiles().map((r) => r.name);
  });
  expect(names[0]).toBe("c");
  // Bounded: localStorage is a few megabytes for the whole origin.
  expect(names.length).toBeLessThanOrEqual(6);
  expect(new Set(names).size).toBe(names.length);
  await page.evaluate(() => window._flashyAI.clearRecent());
});

test("a document too big to keep is listed by name and says so", async ({ page }) => {
  await openEditor(page);
  // A document carrying a large asset, which is what actually blows the quota.
  await loadDoc(page, {
    ...docWith([box("#CC3344")]),
    // A bitmap is a record, not a bare data URL: a bare string is dropped by
    // the serialiser and the document would stay small.
    bitmaps: { huge: { name: "huge", mediaType: "image/png",
                       data: "data:image/png;base64," + "A".repeat(1200000),
                       width: 10, height: 10, folder: "" } },
  });

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.clearRecent();
    const entry = F.rememberRecent("Heavy");
    const reopen = F.openRecent("Heavy");
    return { tooBig: !!entry.tooBig, hasJson: !!entry.json, reopen };
  });
  /* One photograph can be most of the origin's whole allowance, so the
     document is recorded by name and the reason is given rather than quietly
     evicting the other five. */
  expect(out.tooBig).toBe(true);
  expect(out.hasJson).toBe(false);
  expect(out.reopen.ok).toBe(false);
  expect(out.reopen.why).toContain("too big");
  await page.evaluate(() => window._flashyAI.clearRecent());
});

test("the list survives a reload, and clears", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box("#CC3344")]));
  await page.evaluate(() => {
    window._flashyAI.clearRecent();
    window._flashyAI.rememberRecent("Persisted");
  });

  await page.reload();
  await page.waitForFunction(() => !!window._flashyAI);
  const kept = await page.evaluate(() =>
    window._flashyAI.recentFiles().map((r) => r.name));
  expect(kept).toContain("Persisted");

  await page.evaluate(() => window._flashyAI.clearRecent());
  const gone = await page.evaluate(() => window._flashyAI.recentFiles());
  expect(gone).toEqual([]);
});

test("Open Recent says so when there is nothing yet", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => window._flashyAI.clearRecent());
  await page.evaluate(() => window._flashyEditor.doAction("openRecent"));
  await expect(page.locator("#fy-dialog .fy-dialog-msg")).toContainText("Nothing yet");
});

/* ------------------------------------------------------------------ *
 * Edit in New Window
 * ------------------------------------------------------------------ */

test("a symbol becomes a document, library and assets included", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([], {
    bitmaps: { tex: { name: "tex", mediaType: "image/gif",
                      data: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
                      width: 1, height: 1, folder: "" } },
    library: {
      Walk: { totalFrames: 8, behavior: "movieclip",
        layers: [{ name: "Layer 1", visible: true, locked: false,
          keyframes: [kf([box("#CC3344")])] }] },
      Inner: { totalFrames: 1, behavior: "graphic",
        layers: [{ name: "Layer 1", visible: true, locked: false,
          keyframes: [kf([])] }] },
    },
  }));

  const payload = await page.evaluate(() =>
    window._flashyAI.symbolAsDocument("Walk"));
  expect(payload.totalFrames).toBe(8);
  expect(payload.layers).toHaveLength(1);
  expect(payload.layers[0].keyframes[0].objects).toHaveLength(1);
  /* The library travels, or a symbol containing another symbol opens empty --
     and so do the bitmaps, for the same reason. */
  expect(Object.keys(payload.library).sort()).toEqual(["Inner", "Walk"]);
  expect(Object.keys(payload.bitmaps)).toEqual(["tex"]);
  // It IS a .flashy, which is what lets the other window be just the editor.
  expect(payload.width).toBe(300);
  expect(payload.scriptDialect).toBe("js");

  const missing = await page.evaluate(() =>
    window._flashyAI.symbolAsDocument("NotThere"));
  expect(missing).toBeNull();
});

test("a document comes back into the symbol, keeping its instances", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    { type: "symbol", symbolName: "Walk", instanceName: "w1",
      x: 40, y: 40, width: 50, height: 50,
      rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 },
  ], {
    library: { Walk: { totalFrames: 8, behavior: "movieclip",
      layers: [{ name: "Layer 1", visible: true, locked: false,
        keyframes: [kf([box("#CC3344")])] }] } },
  }));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    const r = F.applySymbolDocument("Walk", {
      totalFrames: 20,
      layers: [
        { name: "Redrawn", visible: true, locked: false, keyframes: [{
          index: 1, duration: 1, tweenType: "none", easing: "linear",
          script: "", objects: [] }] },
        { name: "Second", visible: true, locked: false, keyframes: [{
          index: 1, duration: 1, tweenType: "none", easing: "linear",
          script: "", objects: [] }] },
      ],
    });
    const sym = F.doc.library.Walk;
    const inst = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    return { r, frames: sym.totalFrames,
             layers: sym.layers.map((l) => l.name),
             instanceStillPoints: inst.symbolName };
  });
  expect(out.r.ok).toBe(true);
  expect(out.frames).toBe(20);
  expect(out.layers).toEqual(["Redrawn", "Second"]);
  /* The CONTENTS are replaced and the entry kept: every instance on the stage
     points at this name, so swapping the entry would orphan them. */
  expect(out.instanceStillPoints).toBe("Walk");
});

test("a reply for a vanished symbol or with nothing usable is refused", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      gone: F.applySymbolDocument("Vanished", { layers: [] }),
      empty: F.applySymbolDocument("Vanished", null),
    };
  });
  expect(out.gone.ok).toBe(false);
  expect(out.gone.why).toContain("no longer here");
  expect(out.empty.ok).toBe(false);
});

test("applying a symbol document is one undo step", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([], {
    library: { Walk: { totalFrames: 8, behavior: "movieclip",
      layers: [{ name: "Original", visible: true, locked: false,
        keyframes: [kf([])] }] } },
  }));

  await page.evaluate(() => window._flashyAI.applySymbolDocument("Walk", {
    totalFrames: 3,
    layers: [{ name: "Replaced", visible: true, locked: false, keyframes: [{
      index: 1, duration: 1, tweenType: "none", easing: "linear",
      script: "", objects: [] }] }],
  }));
  expect(await page.evaluate(() =>
    window._flashyAI.doc.library.Walk.layers[0].name)).toBe("Replaced");

  await page.evaluate(() => window._flashyEditor.doAction("undo"));
  expect(await page.evaluate(() =>
    window._flashyAI.doc.library.Walk.layers[0].name)).toBe("Original");
});
