// Core authoring paths: drawing with a pointer (which is how a tablet draws at
// all), and the Actions panel, whose textarea had no handler whatsoever.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, sampleDoc } from "./helpers.js";

test("drawing with touch-style pointer events creates an object", async ({ page }) => {
  const errors = await openEditor(page);

  await page.locator('button[title*="Rectangle"]').click();

  const box = await page.locator("#stageCanvas").boundingBox();
  // Synthetic touch pointer: the editor bound mouse events only, so this
  // produced nothing at all before.
  await page.evaluate(({ box }) => {
    const canvas = document.getElementById("stageCanvas");
    const at = (type, dx, dy) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: "touch", isPrimary: true, button: 0, buttons: 1,
      clientX: box.x + dx, clientY: box.y + dy, bubbles: true,
    }));
    at("pointerdown", 300, 300);
    at("pointermove", 380, 360);
    at("pointerup", 380, 360);
  }, { box });

  const created = await page.evaluate(() => {
    const F = window._flashyAI;
    const objs = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).objects;
    const last = objs[objs.length - 1];
    return last ? { type: last.type, width: Math.round(last.width), height: Math.round(last.height) } : null;
  });

  expect(created, "a rectangle was drawn").not.toBeNull();
  expect(created.type).toBe("rect");
  expect(created.width).toBe(80);
  expect(created.height).toBe(60);
  expect(errors).toEqual([]);
});

test("a cancelled pointer does not leave a drag stuck open", async ({ page }) => {
  await openEditor(page);
  await page.locator('button[title*="Pencil"]').click();
  const box = await page.locator("#stageCanvas").boundingBox();

  const countBefore = await page.evaluate(() => {
    const F = window._flashyAI;
    return F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).objects.length;
  });

  await page.evaluate(({ box }) => {
    const canvas = document.getElementById("stageCanvas");
    const at = (type, dx, dy) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 2, pointerType: "touch", isPrimary: true, button: 0, buttons: 1,
      clientX: box.x + dx, clientY: box.y + dy, bubbles: true,
    }));
    at("pointerdown", 300, 300);
    at("pointermove", 320, 320);
    at("pointercancel", 320, 320);
    // A second, clean stroke must start fresh rather than continue the first.
    at("pointerdown", 500, 400);
    at("pointermove", 520, 420);
    at("pointerup", 520, 420);
  }, { box });

  const after = await page.evaluate(() => {
    const F = window._flashyAI;
    const objs = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).objects;
    const last = objs[objs.length - 1];
    return { count: objs.length, points: last && last.points ? last.points.length : 0 };
  });

  // The cancelled stroke contributes nothing; the clean one contributes one.
  expect(after.count).toBe(countBefore + 1);
  expect(after.points).toBeGreaterThan(0);
});

test("the Actions tab edits the current keyframe's frame script", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sampleDoc());

  await page.locator('.dock-tab[data-panel="actions"]').click();
  const ta = page.locator("#frame-script");
  await expect(ta).toBeVisible();

  // Frame 1 of the sample has no script; frame 11 has `stop();`.
  await expect(ta).toHaveValue("");

  await ta.fill("gotoAndStop(3);");
  await ta.blur(); // the editor commits on `change`

  const stored = await page.evaluate(() => {
    const F = window._flashyAI;
    return F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).script;
  });
  expect(stored).toBe("gotoAndStop(3);");
  expect(await page.evaluate(() => window._flashyEditor.isDirty())).toBe(true);

  // Moving the playhead to the scripted keyframe shows that keyframe's script.
  await page.evaluate(() => { window._flashyAI.setCurFrame(11); window._flashyAI.fullRefresh(); });
  await expect(ta).toHaveValue("stop();");
});
