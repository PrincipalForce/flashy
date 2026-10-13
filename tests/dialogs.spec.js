// Dialogs, and the long-timeline bug class.
//
// Two defects found in the desktop build, both invisible in a browser:
//
//   1. `window.prompt()` throws "prompt() is not supported." in Electron, so
//      every feature that asked for a value with it was dead in the app: the
//      API key, Document Settings, the Text tool, renaming a layer, New
//      Symbol, Convert to Symbol, Import from URL. The browser build worked,
//      which is the worst way for this to fail.
//   2. The timeline sized one canvas to the whole movie at 12px/frame. A
//      five-minute soundtrack is 7,200 frames → an 86,000px canvas, past
//      Chromium's 65,535px limit, so the canvas silently stopped painting and
//      the timeline became a blank area you could still click and hear.
//
// These specs run in Chromium, where prompt() works — so the first one
// *disables* prompt to prove the editor no longer reaches for it.
import { test, expect } from "@playwright/test";
import { openEditor } from "./helpers.js";

/** Make any prompt()/confirm() call an immediate, loud failure. */
async function banPrompt(page) {
  await page.evaluate(() => {
    window.__promptCalls = 0;
    window.prompt = function () {
      window.__promptCalls++;
      // Mirror Electron, where this is what actually happens.
      throw new Error("prompt() is not supported.");
    };
  });
}

test("nothing in the editor calls prompt() — it throws in the desktop app", async ({ page }) => {
  const errors = await openEditor(page);
  await banPrompt(page);

  // Every feature that used to ask with prompt().
  await page.evaluate(() => window._flashyEditor.doAction("docSettings"));
  await expect(page.locator("#fy-dialog")).toBeVisible();
  await page.locator("#fy-dialog").getByText("Cancel").click();

  await page.evaluate(() => window._flashyEditor.doAction("newSymbol"));
  await expect(page.locator("#fy-dialog")).toBeVisible();
  await page.locator("#fy-dialog").getByText("Cancel").click();

  await page.evaluate(() => window._flashyEditor.doAction("importURL"));
  await expect(page.locator("#fy-dialog")).toBeVisible();
  await page.locator("#fy-dialog").getByText("Cancel").click();

  await page.evaluate(() => window._flashyEditor.doAction("prefs"));
  await expect(page.locator("#fy-dialog")).toBeVisible();
  await page.locator("#fy-dialog").getByText("Cancel").click();

  // The Text tool asked with prompt() too, so you could not make text at all.
  await page.locator('button[title*="Text"]').click();
  const box = await page.locator("#stageCanvas").boundingBox();
  await page.evaluate(({ box }) => {
    const c = document.getElementById("stageCanvas");
    const at = (type, dx, dy) => c.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, isPrimary: true, button: 0, buttons: 1,
      clientX: box.x + dx, clientY: box.y + dy, bubbles: true,
    }));
    at("pointerdown", 300, 300);
    at("pointermove", 420, 340);
    at("pointerup", 420, 340);
  }, { box });
  await expect(page.locator("#fy-dialog")).toBeVisible();
  await page.locator("#fy-dialog .fy-dialog-input").fill("HELLO");
  await page.locator("#fy-dialog").getByText("OK").click();

  const made = await page.evaluate(() => {
    const F = window._flashyAI;
    const objs = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).objects;
    const last = objs[objs.length - 1];
    return last ? { type: last.type, text: last.text } : null;
  });
  expect(made).toEqual({ type: "text", text: "HELLO" });

  expect(await page.evaluate(() => window.__promptCalls)).toBe(0);
  expect(errors).toEqual([]);
});

test("Document Settings applies all four fields and validates", async ({ page }) => {
  await openEditor(page);
  await banPrompt(page);
  await page.evaluate(() => window._flashyEditor.doAction("docSettings"));

  const d = page.locator("#fy-dialog");
  const inputs = d.locator(".fy-dialog-input");
  await inputs.nth(0).fill("800");
  await inputs.nth(1).fill("600");
  await inputs.nth(2).fill("30");
  await inputs.nth(3).fill("not-a-colour");
  await d.getByText("OK").click();

  // A bad colour keeps the dialog open with a message, rather than silently
  // writing "not-a-colour" into the document as the old prompt() did.
  await expect(d.locator(".fy-dialog-error")).toContainText("hex colour");
  await inputs.nth(3).fill("#102030");
  await d.getByText("OK").click();
  await expect(d).toHaveCount(0);

  expect(await page.evaluate(() => {
    const dd = window._flashyAI.doc;
    return { w: dd.width, h: dd.height, fps: dd.fps, bg: dd.backgroundColor };
  })).toEqual({ w: 800, h: 600, fps: 30, bg: "#102030" });
});

test("the API key dialog saves, reports and removes a key", async ({ page }) => {
  await openEditor(page);
  await banPrompt(page);

  // Reachable from the menu — there was previously no way to find this at all.
  const editMenu = await page.evaluate(() =>
    window._flashyEditor.menus.find((m) => m.label === "Edit").items.map((i) => i.action));
  expect(editMenu).toContain("prefs");

  // And from the panel, which says so instead of looking broken.
  await page.locator('.dock-tab[data-panel="ai"]').click();
  await expect(page.locator("#ai-key-notice")).toBeVisible();
  await page.locator("#ai-key-notice .ai-key-btn").click();

  const d = page.locator("#fy-dialog");
  await d.locator(".fy-dialog-input").fill("short");
  await d.getByText("Save key").click();
  await expect(d.locator(".fy-dialog-error")).toContainText("too short");

  await d.locator(".fy-dialog-input").fill("sk-ant-api03-not-a-real-key");
  await d.getByText("Save key").click();
  await expect(d).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("flashy_ai_key")))
    .toBe("sk-ant-api03-not-a-real-key");
  // The banner goes once a key exists.
  await expect(page.locator("#ai-key-notice")).toHaveCount(0);

  await page.evaluate(() => window._flashyEditor.doAction("prefs"));
  await page.locator("#fy-dialog").getByText("Remove key").click();
  expect(await page.evaluate(() => localStorage.getItem("flashy_ai_key"))).toBeNull();
  await expect(page.locator("#ai-key-notice")).toBeVisible();
});

test("a five-minute soundtrack does not blank the timeline", async ({ page }) => {
  const errors = await openEditor(page);

  // 7,200 frames at 24fps — the length that used to ask for an 86,000px
  // canvas and silently stop painting.
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.doc.layers[0].getKeyframeAt(1).duration = 7200;
    F.doc.totalFrames = 7200;
    F.fullRefresh();
  });

  const state = await page.evaluate(() => {
    const c = document.getElementById("tlCanvas");
    const wrap = document.getElementById("tl-frames");
    const spacer = document.getElementById("tl-spacer");
    const ctx = c.getContext("2d");
    // Sample inside the first keyframe cell; anything but transparent means
    // the canvas is painting.
    const px = ctx.getImageData(4, 30, 1, 1).data;
    return {
      canvasW: c.width,
      viewportW: wrap.clientWidth,
      spacerW: parseInt(spacer.style.width, 10),
      alpha: px[3],
    };
  });

  // The canvas never exceeds the viewport, however long the movie is …
  expect(state.canvasW).toBeLessThan(8000);
  // … while the spacer still carries the real extent, so scrolling works.
  expect(state.spacerW).toBeGreaterThan(80000);
  // … and it is actually painting.
  expect(state.alpha).toBe(255);
  expect(errors).toEqual([]);
});

test("timeline zoom changes the frame width and keeps clicks accurate", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.doc.layers[0].getKeyframeAt(1).duration = 2000;
    F.doc.totalFrames = 2000;
    F.fullRefresh();
  });

  const widthNow = () => page.evaluate(() => parseInt(document.getElementById("tl-spacer").style.width, 10));
  const wide = await widthNow();

  // Fit collapses the whole movie into the visible width.
  await page.locator("#tlZoomFit").click();
  const fitted = await widthNow();
  expect(fitted).toBeLessThan(wide);

  await page.locator("#tlZoomIn").click();
  expect(await widthNow()).toBeGreaterThan(fitted);

  // Clicking a frame must land on that frame at any zoom and scroll offset —
  // the handlers used to assume 12px columns and a non-scrolled canvas.
  await page.evaluate(() => {
    document.getElementById("tl-frames").scrollLeft = 300;
  });
  await page.waitForTimeout(80);
  const box = await page.locator("#tlCanvas").boundingBox();
  await page.mouse.click(box.x + 120, box.y + 30);

  const picked = await page.evaluate(() => {
    const wrap = document.getElementById("tl-frames");
    return { frame: window._flashyAI.curFrame(), scroll: wrap.scrollLeft };
  });
  const expected = await page.evaluate(
    ({ scroll }) => Math.floor((scroll + 120) / window._flashyAI.tlFrameWidth()) + 1,
    { scroll: picked.scroll },
  );
  expect(picked.frame).toBe(expected);
});
