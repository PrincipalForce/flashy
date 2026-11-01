// Publish Settings and the Size Report.
//
// Publishing was six separate menu items, each with its own hard-coded choices
// and none of them remembered: export the same movie twice and you made the
// same decisions twice. And there was no way at all to see what made a movie
// heavy — a 3MB export is almost always one photograph or one music track, and
// without a breakdown the only way to find it is to delete things until the
// number moves.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction } from "./helpers.js";

const rect = (over = {}) => ({
  type: "rect", x: 10, y: 10, width: 60, height: 40,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#CC2222", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

function docWith(extra = {}) {
  return {
    width: 320, height: 180, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 6,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 6, tweenType: "none", easing: "linear", script: "",
        objects: [rect()],
      }],
    }],
    library: {},
    ...extra,
  };
}

const act = (page, a) => page.evaluate((a) => window._flashyEditor.doAction(a), a);

/* ------------------------------------------------------------------ *
 * Publish Settings
 * ------------------------------------------------------------------ */

test("the settings have the defaults the separate commands used", async ({ page }) => {
  const errors = await openEditor(page);
  const p = await page.evaluate(() => window._flashyAI.publishSettings());
  // HTML on, the rest off: that is what a single "Export as HTML" meant.
  expect(p.targets).toMatchObject({ html: true, sprite: false, video: false });
  expect(p.loop).toBe(true);
  expect(p.scaleMode).toBe("movie");
  expect(p.title).toBe("Flashy Animation");
  expect(errors).toEqual([]);
});

test("the settings are part of the document and survive a save", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith());
  await page.evaluate(() => window._flashyAI.publishSettings({
    title: "My Cartoon", loop: false, scaleMode: "fit",
    targets: { html: true, sprite: true, video: false, svg: false, module: false },
  }));

  const back = await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(d)));
    return window._flashyAI.publishSettings();
  });
  // Publishing the same movie twice should not mean making the same decisions
  // twice.
  expect(back.title).toBe("My Cartoon");
  expect(back.loop).toBe(false);
  expect(back.scaleMode).toBe("fit");
  expect(back.targets.sprite).toBe(true);

  // A document from before publish settings existed gets the defaults rather
  // than undefined fields the exporter would read.
  const legacy = await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    delete d.publish;
    window._flashyEditor.loadDoc(d);
    return window._flashyAI.publishSettings();
  });
  expect(legacy.targets.html).toBe(true);
  expect(legacy.title).toBe("Flashy Animation");
});

test("the title, background and loop reach the HTML export", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith());
  await page.evaluate(() => window._flashyAI.publishSettings({
    title: "Night & Day <test>", background: "#223344", loop: false,
  }));

  const html = await downloadFromAction(page, "export");
  // Escaped, because a title is user text going into markup.
  expect(html).toContain("Night &amp; Day &lt;test&gt;");
  expect(html).not.toContain("<title>Night & Day <test></title>");
  expect(html).toContain("background:#223344");
  expect(html).toContain("loop:false");
  expect(errors).toEqual([]);
});

test("each scale mode produces its own canvas rule", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith());

  const html = async (mode, percent) => {
    await page.evaluate(({ mode, percent }) => window._flashyAI.publishSettings({
      scaleMode: mode, scalePercent: percent,
    }), { mode, percent });
    return downloadFromAction(page, "export");
  };

  // Match movie is the historic behaviour and stays the plain rule.
  expect(await html("movie", 100)).toContain("canvas{display:block;}");
  expect(await html("fit", 100)).toContain("object-fit:contain");
  expect(await html("fill", 100)).toContain("object-fit:cover");
  // Percent is a flat multiplier in CSS, so the canvas keeps its own pixel
  // size and the drawing stays sharp.
  const pct = await html("percent", 200);
  expect(pct).toContain("width:640px");
  expect(pct).toContain("height:360px");
});

test("Publish with nothing ticked says so rather than doing nothing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith());
  await page.evaluate(() => window._flashyAI.publishSettings({
    targets: { html: false, sprite: false, video: false, svg: false, module: false },
  }));
  await act(page, "publish");
  await expect(page.locator(".fy-dialog")).toContainText("nothing to produce");
});

test("Publish produces every ticked target", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith());
  await page.evaluate(() => window._flashyAI.publishSettings({
    targets: { html: true, sprite: false, video: false, svg: true, module: true },
  }));

  const downloads = [];
  page.on("download", (d) => downloads.push(d.suggestedFilename()));
  const res = await page.evaluate(() => window._flashyAI.publishAll());
  expect(res).toMatchObject({ ok: true, count: 3 });

  // Sequentially, with a gap: five downloads fired at the same instant is how
  // a browser decides to block four of them.
  await expect.poll(() => downloads.length, { timeout: 8000 }).toBe(3);
  expect(downloads.join(" ")).toContain(".html");
  expect(downloads.join(" ")).toContain(".svg");
  expect(downloads.join(" ")).toContain(".js");
  expect(errors).toEqual([]);
});

test("the Publish Settings dialog writes what was chosen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith());
  await act(page, "publishSettings");
  await expect(page.locator(".fy-dialog")).toContainText("Publish Settings");

  const dlg = page.locator(".fy-dialog");
  await dlg.locator(".fy-dialog-row", { hasText: "Sprite sheet" })
    .locator("input").check();
  await dlg.locator(".fy-dialog-row", { hasText: "Page title" })
    .locator("input").fill("Chosen");
  await dlg.locator(".fy-dialog-foot button").last().click();

  const p = await page.evaluate(() => window._flashyAI.publishSettings());
  expect(p.targets.sprite).toBe(true);
  expect(p.title).toBe("Chosen");
});

/* ------------------------------------------------------------------ *
 * Size Report
 * ------------------------------------------------------------------ */

test("the report splits the weight by kind, heaviest first", async ({ page }) => {
  const errors = await openEditor(page);
  // A big sound and a small bitmap, so the ordering is unambiguous.
  await loadDoc(page, docWith({
    sounds: {
      Music: { name: "Music", mediaType: "audio/mpeg", data: "A".repeat(4000), duration: 30 },
      Blip: { name: "Blip", mediaType: "audio/wav", data: "A".repeat(400), duration: 1 },
    },
    bitmaps: {
      Pic: { name: "Pic", mediaType: "image/png", data: "A".repeat(800), width: 20, height: 20 },
    },
  }));

  const r = await page.evaluate(() => window._flashyAI.sizeReport());
  // Base64 decodes to three quarters of its length.
  expect(r.soundBytes).toBeCloseTo(3300, -2);
  expect(r.bitmapBytes).toBeCloseTo(600, -2);
  expect(r.vectorBytes).toBeGreaterThan(100);
  expect(r.totalBytes).toBe(r.vectorBytes + r.soundBytes + r.bitmapBytes);
  // Heaviest first, because the question is always "what is most of this file".
  expect(r.sounds.map((s) => s.name)).toEqual(["Music", "Blip"]);
  expect(errors).toEqual([]);
});

test("the report measures the EXPORT document, not the editing one", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith());
  await page.evaluate(() => {
    const F = window._flashyAI;
    // Guides and a guide layer are authoring furniture: neither is published,
    // and counting them would mislead about what a viewer downloads.
    F.guides().v.push(10, 20, 30);
    const l = F.currentLayers()[0];
    const g = new F.Layer("Reference");
    g.layerType = "guide";
    g.keyframes[0].duration = 6;
    const o = new F.EditorObject("rect");
    o.width = 300; o.height = 160;
    g.keyframes[0].objects.push(o);
    F.doc.layers.push(g);
    void l;
    F.fullRefresh();
  });

  const r = await page.evaluate(() => window._flashyAI.sizeReport());
  const exported = await page.evaluate(() =>
    JSON.stringify(window._flashyAI.exportDocData()).indexOf("Reference"));
  expect(exported).toBe(-1);
  // The guide layer's object is not in the measured bytes either.
  const withoutGuide = await page.evaluate(() => {
    const F = window._flashyAI;
    F.doc.layers = F.doc.layers.filter((l) => (l.layerType || "normal") !== "guide");
    F.fullRefresh();
    return window._flashyAI.sizeReport().vectorBytes;
  });
  expect(r.vectorBytes).toBe(withoutGuide);
});

test("the report finds the busiest frame", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 200, height: 100, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 4,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [
        { index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
          objects: [rect()] },
        { index: 2, duration: 1, tweenType: "none", easing: "linear", script: "",
          objects: [rect(), rect({ x: 80 }), rect({ x: 150 })] },
        { index: 3, duration: 2, tweenType: "none", easing: "linear", script: "",
          objects: [rect()] },
      ],
    }],
    library: {},
  });
  const r = await page.evaluate(() => window._flashyAI.sizeReport());
  expect(r.heaviest.frame).toBe(2);
  expect(r.heaviest.nodes).toBe(3);
  expect(r.frames).toHaveLength(4);
});

test("a group's children count towards the frame's weight", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith());
  await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[0].getKeyframeAt(1);
    const o = new F.EditorObject("rect");
    o.x = 100; o.width = 40; o.height = 40;
    kf.objects.push(o);
    F.setSelection(kf.objects.slice());
    F.groupSelection();
    F.fullRefresh();
  });
  const r = await page.evaluate(() => window._flashyAI.sizeReport());
  // One group on the frame, but three nodes to build: the group and its two
  // children. The player builds all three.
  expect(r.frames[0].objects).toBe(1);
  expect(r.frames[0].nodes).toBe(3);
});

test("the dialog lists the breakdown and says what dominates", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith({
    bitmaps: {
      Huge: { name: "Huge", mediaType: "image/png", data: "A".repeat(40000),
              width: 800, height: 600 },
    },
  }));
  await act(page, "sizeReport");

  const dlg = page.locator(".fy-dialog");
  await expect(dlg).toContainText("Size Report");
  await expect(dlg).toContainText("Bitmaps");
  await expect(dlg).toContainText("Huge");
  await expect(dlg).toContainText("Download time");
  // Advice that names the actual fix, not a generic nudge.
  await expect(dlg).toContainText("Trace Bitmap");
  // Every line gets a share bar: the question is never "how many bytes".
  expect(await dlg.locator(".size-bar").count()).toBeGreaterThan(2);
  expect(errors).toEqual([]);
});

test("download times are reported for the speeds people have", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith());
  await act(page, "sizeReport");
  const dlg = page.locator(".fy-dialog");
  await expect(dlg).toContainText("3G");
  await expect(dlg).toContainText("4G");
  await expect(dlg).toContainText("Broadband");
  // A tiny document is honestly reported as instant rather than as 0.0 s.
  await expect(dlg).toContainText("under a second");
});
