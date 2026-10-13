// What the exporters actually produce.
//
// Three bugs these cover, all of which shipped silently:
//   * symbol instances in the HTML export ignored x/y/rotation/scale/alpha, so
//     every symbol stacked at the stage origin;
//   * symbols had no case in the raster and SVG exporters at all, so they
//     vanished without a word;
//   * frame scripts were authored, saved, and never emitted anywhere.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, sampleDoc, downloadFromAction, runExportedHTML } from "./helpers.js";

test("exported HTML places a symbol instance at its own transform", async ({ page, context }) => {
  await openEditor(page);
  await loadDoc(page, sampleDoc());

  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  // `_primed` only means the tweens were applied; the display list is built by
  // the frame script on the first tick, so wait for actual children.
  await out.waitForFunction(() => window.__stage && window.__stage.root.children.length > 0);

  const node = await out.evaluate(() => {
    const root = window.__stage.root;
    // The "Symbols" layer is the upper one, so its node is added last.
    const mc = root.children.find((c) => c.name === "star1");
    if (!mc) return null;
    return {
      x: mc.x, y: mc.y, rotation: mc.rotation, scaleX: mc.scaleX, scaleY: mc.scaleY,
      // inner container shifts symbol space to the instance's top-left…
      innerX: mc.children[0] && mc.children[0].x,
      innerY: mc.children[0] && mc.children[0].y,
      // …and holds the symbol's actual artwork.
      grandchildren: mc.children[0] ? mc.children[0].children.length : 0,
    };
  });

  expect(node, "the symbol instance was built as a node").not.toBeNull();
  // The instance is at (200,100) 50x50, so its centre — where the node must
  // sit for rotation to pivot correctly — is (225,125). It used to land at
  // (0,0) because the symbol branch never applied the transform at all.
  expect(node.x).toBe(225);
  expect(node.y).toBe(125);
  expect(node.rotation).toBeCloseTo(Math.PI / 4, 6);
  expect(node.scaleX).toBe(2);
  expect(node.scaleY).toBe(2);
  expect(node.innerX).toBe(-25);
  expect(node.innerY).toBe(-25);
  expect(node.grandchildren).toBe(1);

  expect(errors, "exported page threw").toEqual([]);
  await out.close();
});

test("exported HTML runs frame scripts", async ({ page, context }) => {
  await openEditor(page);
  // Frame 11 of the sample carries `stop();`, and the scene is 60 frames long,
  // so a player that ignores scripts runs straight past it and loops forever.
  await loadDoc(page, sampleDoc());

  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);

  // At 24fps frame 11 arrives in well under half a second.
  await out.waitForFunction(() => window.__stage && window.__stage.root.playing === false, null, {
    timeout: 5000,
  });
  const state = await out.evaluate(() => ({
    frame: window.__stage.root.currentFrame,
    playing: window.__stage.root.playing,
  }));

  expect(state.frame).toBe(11);
  expect(state.playing).toBe(false);
  expect(errors, "exported page threw").toEqual([]);
  await out.close();
});

test("exported HTML exposes window.__stage so it can be re-imported", async ({ page, context }) => {
  await openEditor(page);
  await loadDoc(page, sampleDoc());
  const html = await downloadFromAction(page, "export");
  const { page: out } = await runExportedHTML(context, html);
  // File ▸ Import from URL looks for exactly this handle.
  expect(await out.evaluate(() => !!(window.__stage && window.__stage.root))).toBe(true);
  await out.close();
});

test("SVG export includes symbols and the current frame", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sampleDoc());

  const svg = await downloadFromAction(page, "exportSVG");

  // The symbol's child rect is #00FF00 — proof the symbol was descended into
  // rather than skipped by the old `default: return ''`.
  expect(svg).toContain("#00FF00");
  expect(svg).toMatch(/<g transform="translate\(-25,-25\)">/);
  // Centre-origin transform, matching the stage.
  expect(svg).toContain("translate(225,125)");
  expect(svg).toContain("rotate(45)");
  expect(svg).toContain("scale(2,2)");
});

test("sprite sheet export contains the symbol's pixels", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, sampleDoc());

  const sheetHTML = await downloadFromAction(page, "exportGIF");
  const dataURL = sheetHTML.match(/img\.src='(data:image\/png;base64,[^']+)'/);
  expect(dataURL, "sprite sheet embeds a PNG").not.toBeNull();

  // Decode the sheet and look for the symbol's green. Symbols used to be
  // absent from raster output entirely.
  const hasGreen = await page.evaluate(async (url) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    const { data } = c.getContext("2d").getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 80 && data[i + 1] > 180 && data[i + 2] < 80) return true;
    }
    return false;
  }, dataURL[1]);

  expect(hasGreen, "the symbol rendered into the sprite sheet").toBe(true);
});
