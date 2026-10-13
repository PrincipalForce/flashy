// The unsaved-work guard. Before this existed, closing a tab or an app window
// discarded the document with no warning at all — the only confirmation in the
// product was on File ▸ New.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, sampleDoc } from "./helpers.js";

test("a freshly loaded document is clean, an edit makes it dirty, saving cleans it", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sampleDoc());

  expect(await page.evaluate(() => window._flashyEditor.isDirty())).toBe(false);

  // Any mutation goes through pushUndo(), which is what advances the revision.
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.pushUndo();
    F.currentLayers()[0].getKeyframeAt(1).objects[0].x = 99;
    F.fullRefresh();
  });
  expect(await page.evaluate(() => window._flashyEditor.isDirty())).toBe(true);

  // File ▸ Save in a browser downloads the document; that counts as saved.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.evaluate(() => window._flashyEditor.doAction("save")),
  ]);
  expect(download.suggestedFilename()).toBe("animation.flashy");
  expect(await page.evaluate(() => window._flashyEditor.isDirty())).toBe(false);
});

test("the editor announces dirty-state changes for the desktop shell", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sampleDoc());

  // desktop.js relies on this event to put a • in the window title and to tell
  // the Electron main process whether closing needs to ask first.
  const events = await page.evaluate(async () => {
    const seen = [];
    window.addEventListener("flashy:dirtychange", (e) => seen.push(e.detail.dirty));
    const F = window._flashyAI;
    F.pushUndo();
    F.doc.layers[0].keyframes[0].objects[0].y = 123;
    window._flashyEditor.markSaved();
    return seen;
  });

  expect(events).toEqual([true, false]);
});

test("undo does not report the document as clean again", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sampleDoc());

  const states = await page.evaluate(() => {
    const E = window._flashyEditor;
    const F = window._flashyAI;
    F.pushUndo();
    F.doc.layers[0].keyframes[0].objects[0].x = 42;
    const afterEdit = E.isDirty();
    E.doAction("undo");
    return { afterEdit, afterUndo: E.isDirty() };
  });

  // Deliberately conservative: undoing back to the saved state still counts as
  // dirty. A spurious prompt costs a click; a missed one costs the document.
  expect(states.afterEdit).toBe(true);
  expect(states.afterUndo).toBe(true);
});
