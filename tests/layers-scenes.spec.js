// Timeline depth: layer folders, guide layers, outline view, layer height —
// and scenes.
//
// Three of these were already in the document model and in the save format and
// were read by nothing. The Property inspector offered Short/Normal/Tall and a
// per-layer outline colour, and the layer list drew every row at a fixed 20px
// with no outline mode anywhere; a layer could be marked "guide" and was then
// published along with everything else. That last one is the serious case —
// the whole point of marking a layer as a guide is that your pencil test does
// not ship.
//
// Scenes are new. `doc.layers` is a LIVE ALIAS of the current scene's layer
// array, not a copy, because every part of the editor reaches doc.layers
// directly — and an alias cannot drift out of sync with a copy that does not
// exist. Several specs below pin that down.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction, runExportedHTML } from "./helpers.js";

const rect = (over = {}) => ({
  type: "rect", x: 10, y: 10, width: 60, height: 40,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#CC2222", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

const layer = (name, objs, over = {}) => ({
  name, visible: true, locked: false,
  keyframes: [{
    index: 1, duration: 8, tweenType: "none", easing: "linear", script: "",
    objects: objs,
  }],
  ...over,
});

function docWith(layers) {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 8,
    layers, library: {},
  };
}

const act = (page, a) => page.evaluate((a) => window._flashyEditor.doAction(a), a);

/** Count reddish pixels in the raster export — what a video records. */
const inkedExport = (page, frame = 1) =>
  page.evaluate((frame) => {
    const cv = window._flashyAI.renderFrameToCanvas(frame, 300, 200);
    const d = cv.getContext("2d").getImageData(0, 0, 300, 200).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 150 && d[i + 1] < 100 && d[i + 2] < 100) n++;
    }
    return n;
  }, frame);

/* ------------------------------------------------------------------ *
 * Guide layers
 * ------------------------------------------------------------------ */

test("a guide layer shows on the stage and in no export", async ({ page, context }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([
    layer("Reference", [rect({ x: 10 })], { layerType: "guide" }),
    layer("Art", [rect({ x: 150, fillColor: "#2222CC" })]),
  ]));

  // The authoring stage still draws it — that is what reference art is for.
  const onStage = await page.evaluate(() => {
    const cv = document.getElementById("stageCanvas");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 150 && d[i + 1] < 100 && d[i + 2] < 100) n++;
    }
    return n;
  });
  expect(onStage).toBeGreaterThan(100);

  // The raster export does not.
  expect(await inkedExport(page)).toBe(0);

  // Nor does the SVG.
  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).not.toContain("#CC2222");
  expect(svg).toContain("#2222CC");

  // Nor does the player: the guide layer's objects must not be in the display
  // list at all.
  const html = await downloadFromAction(page, "export");
  expect(html).not.toContain("CC2222");
  const { page: out, errors: outErrors } = await runExportedHTML(context, html);
  expect(outErrors).toEqual([]);
  await out.close();
  expect(errors).toEqual([]);
});

test("a guide layer is marked as one in the layer list", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    layer("Reference", [rect()], { layerType: "guide" }),
    layer("Art", [rect({ x: 150 })]),
  ]));
  // The only visible difference between reference art and art that ships, so
  // it has to be visible.
  await expect(page.locator("#layerList")).toContainText("(guide)");
});

/* ------------------------------------------------------------------ *
 * Outline view and layer height
 * ------------------------------------------------------------------ */

test("outline view draws a layer as outlines in its own colour", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([layer("Art", [rect({ x: 100, y: 60, width: 80, height: 80 })])]));

  const fillCount = () =>
    page.evaluate(() => {
      const cv = document.getElementById("stageCanvas");
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      let red = 0, green = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 150 && d[i + 1] < 100 && d[i + 2] < 100) red++;
        if (d[i + 1] > 150 && d[i] < 100) green++;
      }
      return { red, green };
    });

  const solid = await fillCount();
  expect(solid.red).toBeGreaterThan(1000);

  await page.evaluate(() => {
    const F = window._flashyAI;
    const l = F.currentLayers()[0];
    l.outlines = true;
    l.outlineColor = "#00CC00";
    F.fullRefresh();
  });
  const outlined = await fillCount();
  // The fill is gone; an outline in the layer's own colour is there instead.
  expect(outlined.red).toBeLessThan(solid.red / 10);
  expect(outlined.green).toBeGreaterThan(100);

  // It is an authoring aid, so it must not reach an export.
  expect(await inkedExport(page)).toBeGreaterThan(1000);
  expect(errors).toEqual([]);
});

test("layer height changes the row and the timeline together", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    layer("Short", [rect()], { layerHeight: "short" }),
    layer("Normal", [rect()]),
    layer("Tall", [rect()], { layerHeight: "tall" }),
  ]));

  // The list rows.
  const heights = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#layerList .layer-row"))
      .map((r) => r.getBoundingClientRect().height));
  expect(heights[0]).toBeLessThan(heights[1]);
  expect(heights[2]).toBeGreaterThan(heights[1]);

  // And the timeline canvas, which used to assume index * 20 everywhere.
  const rows = await page.evaluate(() => window._flashyAI.layerRows());
  expect(rows.map((r) => r.name)).toEqual(["Short", "Normal", "Tall"]);
  expect(rows[1].y).toBe(rows[0].y + rows[0].h);
  expect(rows[2].y).toBe(rows[1].y + rows[1].h);
  expect(rows[0].h).toBeLessThan(rows[2].h);
});

/* ------------------------------------------------------------------ *
 * Layer folders
 * ------------------------------------------------------------------ */

test("Insert Layer Folder puts the current layer into a folder", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([layer("Art", [rect()]), layer("Bg", [rect({ x: 150 })])]));
  await page.evaluate(() => window._flashyAI.setCurLayer(0));
  await act(page, "addFolder");

  const state = await page.evaluate(() => {
    const F = window._flashyAI;
    return F.currentLayers().map((l) => ({
      name: l.name, type: l.layerType || "normal", indent: l.indent || 0,
    }));
  });
  // Folder first, then the layer that was selected, now inside it.
  expect(state[0].type).toBe("folder");
  expect(state[1].name).toBe("Art");
  expect(state[1].indent).toBe(1);
  // …and the layer that was not selected stays where it was.
  expect(state[2].name).toBe("Bg");
  expect(state[2].indent).toBe(0);
  expect(errors).toEqual([]);
});

test("collapsing a folder hides its rows and changes nothing on the stage", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([layer("Art", [rect()])]));
  await page.evaluate(() => window._flashyAI.setCurLayer(0));
  await act(page, "addFolder");

  let rows = await page.evaluate(() => window._flashyAI.layerRows());
  expect(rows).toHaveLength(2);

  const inkBefore = await inkedExport(page);

  // Collapse it.
  await page.locator(".layer-row.folder .layer-disclose").click();
  rows = await page.evaluate(() => window._flashyAI.layerRows());
  expect(rows).toHaveLength(1);
  expect(rows[0].name).toContain("Folder");

  // Collapsing is organisational: the artwork is still there, on the stage and
  // in the export. Anything else would make folders unusable for tidying.
  expect(await inkedExport(page)).toBe(inkBefore);

  // Expanding brings the row back.
  await page.locator(".layer-row.folder .layer-disclose").click();
  rows = await page.evaluate(() => window._flashyAI.layerRows());
  expect(rows).toHaveLength(2);
});

test("a folder itself contributes no artwork to any output", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    layer("Folder", [rect()], { layerType: "folder" }),
    layer("Art", [rect({ x: 150, fillColor: "#2222CC" })], { indent: 1 }),
  ]));
  // Even with objects on it — which a folder should never have, but a hand-
  // edited or imported document might — a folder draws nothing.
  expect(await inkedExport(page)).toBe(0);
  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).not.toContain("#CC2222");
  expect(svg).toContain("#2222CC");
});

test("folders, heights and the outline flag survive a save and reopen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    layer("F", [], { layerType: "folder" }),
    layer("Inside", [rect()], { indent: 1, layerHeight: "tall", outlines: true, outlineColor: "#FF00FF" }),
  ]));
  const back = await page.evaluate(() => {
    const data = window._flashyEditor.serializeDoc();
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(data)));
    return window._flashyAI.currentLayers().map((l) => ({
      type: l.layerType || "normal", indent: l.indent || 0,
      h: l.layerHeight, outlines: !!l.outlines, colour: l.outlineColor,
    }));
  });
  expect(back[0].type).toBe("folder");
  expect(back[1]).toMatchObject({ indent: 1, h: "tall", outlines: true, colour: "#FF00FF" });
});

/* ------------------------------------------------------------------ *
 * Scenes
 * ------------------------------------------------------------------ */

test("a document starts with one scene named by the breadcrumb", async ({ page }) => {
  await openEditor(page);
  const scenes = await page.evaluate(() => window._flashyAI.scenes().map((s) => s.name));
  expect(scenes).toEqual(["Scene 1"]);
  await expect(page.locator("#breadcrumb")).toContainText("Scene 1");
});

test("adding a scene switches to it, and doc.layers stays an alias not a copy", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([layer("Art", [rect()])]));

  await act(page, "addSceneAction");
  const after = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      count: F.scenes().length,
      index: F.sceneIndex(),
      layers: F.currentLayers().map((l) => l.name),
      // The critical invariant: doc.layers IS the current scene's array.
      aliased: F.scenes()[F.sceneIndex()].layers === F.doc.layers,
    };
  });
  expect(after.count).toBe(2);
  expect(after.index).toBe(1);
  expect(after.layers).toEqual(["Layer 1"]);
  expect(after.aliased).toBe(true);
  await expect(page.locator("#breadcrumb")).toContainText("Scene 2");

  // Editing the new scene must not touch the first.
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.currentLayers()[0].name = "Edited";
    F.gotoScene(0);
  });
  const names = await page.evaluate(() => ({
    first: window._flashyAI.currentLayers().map((l) => l.name),
    second: window._flashyAI.scenes()[1].layers.map((l) => l.name),
    aliased: window._flashyAI.scenes()[0].layers === window._flashyAI.doc.layers,
  }));
  expect(names.first).toEqual(["Art"]);
  expect(names.second).toEqual(["Edited"]);
  expect(names.aliased).toBe(true);
  expect(errors).toEqual([]);
});

test("switching scenes remembers where you were in each", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([layer("Art", [rect()])]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setCurFrame(5);
    F.addScene({});
    F.setCurFrame(3);
    F.gotoScene(0);
  });
  expect(await page.evaluate(() => window._flashyAI.curFrame())).toBe(5);
  await page.evaluate(() => window._flashyAI.gotoScene(1));
  expect(await page.evaluate(() => window._flashyAI.curFrame())).toBe(3);
});

test("Duplicate Scene copies the timeline without sharing it", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([layer("Art", [rect()])]));
  await act(page, "duplicateScene");

  const shared = await page.evaluate(() => {
    const F = window._flashyAI;
    // Edit the copy's artwork; the original must not move.
    F.currentLayers()[0].getKeyframeAt(1).objects[0].x = 999;
    return {
      copyX: F.scenes()[1].layers[0].getKeyframeAt(1).objects[0].x,
      origX: F.scenes()[0].layers[0].getKeyframeAt(1).objects[0].x,
      names: F.scenes().map((s) => s.name),
    };
  });
  expect(shared.copyX).toBe(999);
  expect(shared.origX).toBe(10);
  expect(shared.names[1]).toContain("copy");
});

test("scenes reorder, and deleting the last one is refused", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.addScene({});
    F.addScene({});
  });
  let names = await page.evaluate(() => window._flashyAI.scenes().map((s) => s.name));
  expect(names).toHaveLength(3);

  // Move the last scene to the front; the current-scene pointer follows it.
  await page.evaluate(() => window._flashyAI.moveScene(2, -1));
  const reordered = await page.evaluate(() => ({
    names: window._flashyAI.scenes().map((s) => s.name),
    index: window._flashyAI.sceneIndex(),
    aliased: window._flashyAI.scenes()[window._flashyAI.sceneIndex()].layers
             === window._flashyAI.doc.layers,
  }));
  expect(reordered.names[1]).toBe(names[2]);
  expect(reordered.aliased).toBe(true);

  // Delete down to one, then refuse.
  await page.evaluate(() => {
    window._flashyAI.deleteScene(2);
    window._flashyAI.deleteScene(1);
  });
  expect(await page.evaluate(() => window._flashyAI.scenes().length)).toBe(1);
  expect(await page.evaluate(() => window._flashyAI.deleteScene(0))).toBe(false);
});

test("scenes save, reopen, and a document without them opens as one scene", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([layer("Art", [rect()])]));
  await page.evaluate(() => {
    window._flashyAI.addScene({});
    window._flashyAI.currentLayers()[0].name = "Second";
  });

  const round = await page.evaluate(() => {
    const data = window._flashyEditor.serializeDoc();
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(data)));
    const F = window._flashyAI;
    return {
      names: F.scenes().map((s) => s.name),
      index: F.sceneIndex(),
      layers: F.currentLayers().map((l) => l.name),
      aliased: F.scenes()[F.sceneIndex()].layers === F.doc.layers,
      // `layers` at the top level is still the CURRENT scene, so an older
      // build reading this file finds what it expects.
      topLevelIsCurrent: data.layers.length === F.scenes()[data.sceneIndex].layers.length,
    };
  });
  expect(round.names).toHaveLength(2);
  expect(round.index).toBe(1);
  expect(round.layers).toEqual(["Second"]);
  expect(round.aliased).toBe(true);
  expect(round.topLevelIsCurrent).toBe(true);

  // A file written before scenes existed.
  const legacy = await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    delete d.scenes;
    delete d.sceneIndex;
    window._flashyEditor.loadDoc(d);
    const F = window._flashyAI;
    return { count: F.scenes().length, aliased: F.scenes()[0].layers === F.doc.layers };
  });
  expect(legacy.count).toBe(1);
  expect(legacy.aliased).toBe(true);
  expect(errors).toEqual([]);
});

test("an export lays the scenes end to end with their names as labels", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([layer("A", [rect({ fillColor: "#CC2222" })])]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.addScene({});
    // Put something different on scene 2, on its own frames.
    const kf = F.currentLayers()[0].getKeyframeAt(1);
    kf.duration = 6;
    const o = new F.EditorObject("rect");
    o.x = 150; o.y = 60; o.width = 60; o.height = 40;
    o.fillColor = "#2222CC"; o.fillType = "solid"; o.strokeWidth = 0; o.strokeStyle = "none";
    kf.objects.push(o);
    F.doc.totalFrames = 6;
    F.fullRefresh();
  });

  const movie = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      total: F.moviesTotalFrames(),
      layers: F.flattenScenes().map((l) => l.name),
    };
  });
  // Scene 1 is 8 frames, scene 2 is 6: 14 in all.
  expect(movie.total).toBe(14);
  // One layer per scene layer, named for its scene, plus the label layer.
  expect(movie.layers).toContain("Scene labels");
  expect(movie.layers.some((n) => n.startsWith("Scene 1 /"))).toBe(true);
  expect(movie.layers.some((n) => n.startsWith("Scene 2 /"))).toBe(true);

  // Each scene's artwork exists only during its own frames.
  const frames = await page.evaluate(() => {
    const F = window._flashyAI;
    const read = (f) => {
      const cv = F.renderFrameToCanvas(f, 300, 200);
      const d = cv.getContext("2d").getImageData(0, 0, 300, 200).data;
      let red = 0, blue = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 150 && d[i + 2] < 100) red++;
        if (d[i + 2] > 150 && d[i] < 100) blue++;
      }
      return { red, blue };
    };
    return { early: read(2), late: read(11) };
  });
  expect(frames.early.red).toBeGreaterThan(100);
  expect(frames.early.blue).toBe(0);
  expect(frames.late.blue).toBeGreaterThan(100);
  expect(frames.late.red).toBe(0);

  // And the exported document carries the scene names as frame labels, so
  // gotoAndPlay("Scene 2") works in the player.
  const exported = await page.evaluate(() => {
    const d = window._flashyAI.exportDocData();
    const labels = [];
    d.layers.forEach((l) => (l.keyframes || []).forEach((k) => {
      if (k.label) labels.push({ label: k.label, index: k.index });
    }));
    return { labels, hasScenes: "scenes" in d, total: d.totalFrames };
  });
  expect(exported.labels).toEqual([
    { label: "Scene 1", index: 1 },
    { label: "Scene 2", index: 9 },
  ]);
  // The scenes are baked into `layers`; shipping them again would have the
  // player build every scene twice.
  expect(exported.hasScenes).toBe(false);
  expect(exported.total).toBe(14);
});

test("the Scene panel lists, switches and labels the scenes", async ({ page }) => {
  const errors = await openEditor(page);
  await page.evaluate(() => window._flashyEditor.doAction("winScene"));
  await page.evaluate(() => window._flashyAI.addScene({}));

  const panel = page.locator("#scenePanel");
  await expect(panel).toContainText("Scene 1");
  await expect(panel).toContainText("Scene 2");
  await expect(panel.locator(".scene-row.active")).toHaveCount(1);

  // Clicking a name opens that scene.
  await panel.locator(".scene-name", { hasText: "Scene 1" }).click();
  expect(await page.evaluate(() => window._flashyAI.sceneIndex())).toBe(0);
  await expect(page.locator("#breadcrumb")).toContainText("Scene 1");

  // With one scene the delete button is disabled rather than absent, so the
  // row does not change shape as you add scenes.
  await page.evaluate(() => window._flashyAI.deleteScene(1));
  await expect(panel.locator(".scene-btn:disabled")).toHaveCount(1);
  expect(errors).toEqual([]);
});
