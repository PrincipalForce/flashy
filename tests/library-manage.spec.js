// Library management: folders, search, sort, use counts, Duplicate Symbol,
// Swap Symbol, unused items, and symbol linkage with a working attachMovie.
//
// The Library was a flat, unsorted, unsearchable list with Rename and Delete
// on it. A document with thirty symbols — a short cartoon — was unusable.
//
// Linkage is the one here that had to do something rather than be a field:
// `attachMovie` was a stub that logged a warning, so every movie that spawns
// anything did nothing at all.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction, runExportedHTML } from "./helpers.js";

const rect = (over = {}) => ({
  type: "rect", x: 0, y: 0, width: 40, height: 40,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#CC2222", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

const sym = (objs, over = {}) => ({
  totalFrames: 1, behavior: "movieclip",
  layers: [{
    name: "Layer 1", visible: true, locked: false,
    keyframes: [{
      index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
      objects: objs,
    }],
  }],
  ...over,
});

/** Two symbols, one used twice and one not used at all. */
function libDoc() {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 5,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 5, tweenType: "none", easing: "linear", script: "",
        objects: [
          { type: "symbol", symbolName: "Ball", x: 20, y: 20, width: 40, height: 40,
            rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 },
          { type: "symbol", symbolName: "Ball", x: 120, y: 20, width: 40, height: 40,
            rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 },
        ],
      }],
    }],
    library: {
      Ball: sym([rect()]),
      Spare: sym([rect({ fillColor: "#2222CC" })]),
      Nested: sym([{ type: "symbol", symbolName: "Spare", x: 0, y: 0,
                     width: 40, height: 40, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 }]),
    },
  };
}

const act = (page, a) => page.evaluate((a) => window._flashyEditor.doAction(a), a);

/* ------------------------------------------------------------------ *
 * Use counts and unused items
 * ------------------------------------------------------------------ */

test("a use count sees instances inside other symbols", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, libDoc());

  const counts = await page.evaluate(() => ({
    ball: window._flashyAI.libUseCount("symbol", "Ball"),
    // Spare is used only INSIDE another symbol, and that still counts —
    // reporting it as unused would invite deleting something in use.
    spare: window._flashyAI.libUseCount("symbol", "Spare"),
    nested: window._flashyAI.libUseCount("symbol", "Nested"),
  }));
  expect(counts.ball).toBe(2);
  expect(counts.spare).toBe(1);
  expect(counts.nested).toBe(0);
  expect(errors).toEqual([]);
});

test("the use count counts across every scene", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, libDoc());
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.addScene({});
    const kf = F.currentLayers()[0].getKeyframeAt(1);
    const o = new F.EditorObject("symbol");
    o.symbolName = "Nested";
    o.width = 40; o.height = 40;
    kf.objects.push(o);
    F.gotoScene(0);
  });
  // A parked scene's instances count: they are in the movie.
  expect(await page.evaluate(() => window._flashyAI.libUseCount("symbol", "Nested"))).toBe(1);
});

test("unused items are found and can be deleted in one go", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, libDoc());

  let unused = await page.evaluate(() => window._flashyAI.unusedLibraryItems());
  expect(unused.map((u) => u.name)).toEqual(["Nested"]);

  await act(page, "libUnused");
  await expect(page.locator(".fy-dialog")).toContainText("Nested");
  await expect(page.locator(".fy-dialog")).toContainText("1 item");
  await page.locator(".fy-dialog-foot button").last().click();

  const names = await page.evaluate(() => Object.keys(window._flashyAI.doc.library));
  expect(names.sort()).toEqual(["Ball", "Spare"]);
  // Deleting them is one undo step, not three.
  await act(page, "undo");
  expect(await page.evaluate(() =>
    Object.keys(window._flashyAI.doc.library).length)).toBe(3);
  expect(errors).toEqual([]);
});

test("nothing unused says so rather than offering an empty dialog", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 200, height: 100, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 2,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 2, tweenType: "none", easing: "linear", script: "",
        objects: [{ type: "symbol", symbolName: "Only", x: 0, y: 0, width: 40, height: 40,
                    rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 }],
      }],
    }],
    library: { Only: sym([rect()]) },
  });
  await act(page, "libUnused");
  await expect(page.locator(".fy-dialog")).toContainText("used somewhere");
});

/* ------------------------------------------------------------------ *
 * Folders, search and sort
 * ------------------------------------------------------------------ */

test("a folder is a path on the item, and survives a save", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, libDoc());

  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setLibFolder("symbol", "Ball", "Characters/Heads");
    F.setLibFolder("symbol", "Spare", "Characters");
    F.fullRefresh();
  });
  expect(await page.evaluate(() => window._flashyAI.libraryFolders()))
    .toEqual(["Characters", "Characters/Heads"]);

  const back = await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(d)));
    return window._flashyAI.doc.library.Ball.folder;
  });
  expect(back).toBe("Characters/Heads");

  // A document from before folders existed has no `folder` and must not break.
  const legacy = await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    Object.keys(d.library).forEach((k) => { delete d.library[k].folder; });
    window._flashyEditor.loadDoc(d);
    return window._flashyAI.libraryFolders();
  });
  expect(legacy).toEqual([]);
  expect(errors).toEqual([]);
});

test("the panel groups by folder and collapses one", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, libDoc());
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setLibFolder("symbol", "Ball", "Characters");
    F.setLibFolder("symbol", "Spare", "Characters");
    F.fullRefresh();
  });

  const lib = page.locator("#libPanel");
  await expect(lib.locator(".lib-folder")).toHaveCount(1);
  await expect(lib.locator(".lib-folder")).toContainText("Characters");
  // Nested is at the top level, so three items in all.
  await expect(lib.locator(".lib-item")).toHaveCount(3);

  await lib.locator(".lib-folder").click();
  await expect(lib.locator(".lib-item")).toHaveCount(1);
  await lib.locator(".lib-folder").click();
  await expect(lib.locator(".lib-item")).toHaveCount(3);
});

test("search flattens the grouping and finds by name", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, libDoc());
  await page.evaluate(() => {
    window._flashyAI.setLibFolder("symbol", "Ball", "Characters");
    window._flashyAI.fullRefresh();
  });

  await page.evaluate(() => window._flashyAI.librarySearch("ball"));
  const lib = page.locator("#libPanel");
  // Case-insensitive, and flat: when you are looking for one thing, which
  // folder it is in is the answer rather than an obstacle.
  await expect(lib.locator(".lib-item")).toHaveCount(1);
  await expect(lib.locator(".lib-folder")).toHaveCount(0);

  await page.evaluate(() => window._flashyAI.librarySearch("zzz"));
  await expect(lib).toContainText("Nothing matches");
  await page.evaluate(() => window._flashyAI.librarySearch(""));
  await expect(lib.locator(".lib-item")).toHaveCount(3);
});

test("sorting by use puts the most used first", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, libDoc());
  await page.evaluate(() => window._flashyAI.librarySort("use"));
  const names = await page.evaluate(() =>
    window._flashyAI.libraryRows().rows.map((r) => r.name));
  expect(names[0]).toBe("Ball");
  expect(names[names.length - 1]).toBe("Nested");
  await page.evaluate(() => window._flashyAI.librarySort("name"));
});

test("every row shows whether the item is used", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, libDoc());
  const lib = page.locator("#libPanel");
  // "unused" is the one piece of information that decides whether an item can
  // go, and it has its own slot rather than displacing the dimensions.
  await expect(lib.locator(".lib-item", { hasText: "Nested" })
    .locator(".lib-use")).toHaveText("unused");
  await expect(lib.locator(".lib-item", { hasText: "Ball" })
    .locator(".lib-use")).toHaveText("2×");
});

/* ------------------------------------------------------------------ *
 * Duplicate and Swap
 * ------------------------------------------------------------------ */

test("Duplicate Symbol makes an independent copy", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, libDoc());

  const res = await page.evaluate(() => {
    const F = window._flashyAI;
    const r = F.duplicateSymbol("Ball", "Ball variant");
    // Edit the copy; the original must not move. A symbol's layers hold
    // keyframes which hold objects which may hold children and filters, so
    // anything shallower than a full copy leaves the two sharing structure.
    const copy = F.doc.library[r.name];
    copy.layers[0].keyframes[0].objects[0].fillColor = "#00FF00";
    return {
      name: r.name,
      copyFill: copy.layers[0].keyframes[0].objects[0].fillColor,
      origFill: F.doc.library.Ball.layers[0].keyframes[0].objects[0].fillColor,
    };
  });
  expect(res.name).toBe("Ball variant");
  expect(res.copyFill).toBe("#00FF00");
  expect(res.origFill).toBe("#CC2222");
  expect(errors).toEqual([]);
});

test("Duplicate Symbol will not collide with an existing name", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, libDoc());
  const names = await page.evaluate(() => {
    const F = window._flashyAI;
    F.duplicateSymbol("Ball", "Spare");   // already taken
    return Object.keys(F.doc.library);
  });
  expect(names).toContain("Spare");
  expect(names.filter((n) => n.indexOf("Spare") === 0).length).toBeGreaterThan(1);
});

test("Swap Symbol repoints the instance and keeps its transform", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, libDoc());

  const before = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    o.rotation = 30; o.scaleX = 2;
    F.setSelection([o]);
    return { x: o.x, rotation: o.rotation, scaleX: o.scaleX };
  });

  const res = await page.evaluate(() =>
    window._flashyAI.swapSymbolOnSelection("Spare"));
  expect(res.ok).toBe(true);

  const after = await page.evaluate(() => {
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    return { name: o.symbolName, x: o.x, rotation: o.rotation, scaleX: o.scaleX };
  });
  expect(after.name).toBe("Spare");
  // Swapping is replacing what is drawn, not where it is — a walk cycle
  // becomes a run cycle without re-placing it.
  expect(after.x).toBe(before.x);
  expect(after.rotation).toBe(30);
  expect(after.scaleX).toBe(2);
  expect(errors).toEqual([]);
});

test("Swap Symbol says what it needs", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, libDoc());
  await page.evaluate(() => window._flashyAI.setSelection([]));
  await act(page, "swapSymbol");
  await expect(page.locator(".fy-dialog")).toContainText("symbol instances");
});

/* ------------------------------------------------------------------ *
 * Linkage and attachMovie
 * ------------------------------------------------------------------ */

test("linkage travels in the export and registers the symbol", async ({ page, context }) => {
  const errors = await openEditor(page);
  await loadDoc(page, libDoc());
  await page.evaluate(() => {
    const s = window._flashyAI.doc.library.Spare;
    s.exportForAS = true;
    s.linkageName = "Bullet";
    window._flashyAI.fullRefresh();
  });

  const back = await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(d)));
    const s = window._flashyAI.doc.library.Spare;
    return { exported: s.exportForAS, name: s.linkageName };
  });
  expect(back).toEqual({ exported: true, name: "Bullet" });

  const html = await downloadFromAction(page, "export");
  expect(html).toContain("Bullet");
  const { page: out, errors: outErrors } = await runExportedHTML(context, html);
  const reg = await out.evaluate(() => {
    const stage = window.__stage;
    return stage ? { linkage: stage.linkage, hasAttach: typeof stage.attachSymbol } : null;
  });
  if (reg) {
    expect(reg.linkage).toMatchObject({ Bullet: "Spare" });
    expect(reg.hasAttach).toBe("function");
  }
  expect(outErrors).toEqual([]);
  await out.close();
  expect(errors).toEqual([]);
});

test("attachMovie really creates a clip, and it survives the next frame", async ({ page, context }) => {
  await openEditor(page);
  const d = libDoc();
  d.library.Spare.exportForAS = true;
  d.library.Spare.linkageName = "Bullet";
  // A frame script that spawns one, then a second frame so the display list
  // gets rebuilt underneath it.
  d.totalFrames = 4;
  d.layers[0].keyframes[0].duration = 4;
  d.layers[0].keyframes[0].script =
    'var c = stage.attachSymbol("Bullet", "bullet1", 99); ' +
    'trace(c ? "attached" : "failed");';
  await loadDoc(page, d);

  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() =>
    window.Flashy && window.Flashy.Output && window.Flashy.Output.lines.length > 0);
  const state = await out.evaluate(() => ({
    traced: window.Flashy.Output.lines.slice(),
    present: !!(window.__stage && window.__stage.root.getChildByName("bullet1")),
  }));
  expect(state.traced.join(" ")).toContain("attached");
  expect(state.present).toBe(true);

  // The root rebuilds its display list every frame from the document, and a
  // clip a script created is not in the document — without lifting it out and
  // putting it back, every attachMovie() vanished on the next frame.
  await out.waitForTimeout(250);
  const stillThere = await out.evaluate(() =>
    !!(window.__stage && window.__stage.root.getChildByName("bullet1")));
  expect(stillThere).toBe(true);
  expect(errors).toEqual([]);
  await out.close();
});

test("attachMovie on an unregistered name reports it and carries on", async ({ page, context }) => {
  await openEditor(page);
  const d = libDoc();
  d.layers[0].keyframes[0].script =
    'var c = stage.attachSymbol("NotRegistered", "x", 1); trace("got " + c);';
  await loadDoc(page, d);
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() =>
    window.Flashy.Output.lines.join(" ").indexOf("got") >= 0);
  const lines = await out.evaluate(() => window.Flashy.Output.lines.join(" "));
  // Null rather than an exception: a movie that spawns a missing symbol should
  // carry on without it rather than stop dead.
  expect(lines).toContain("no symbol exported");
  expect(lines).toContain("got null");
  expect(errors).toEqual([]);
  await out.close();
});

test("the Linkage dialog fills in an identifier rather than leaving it blank", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, libDoc());
  /* show(), not the Window-menu toggle: the Library is open by default, so
     toggling it CLOSES it and the row is then unreachable. */
  await page.evaluate(() => window._flashyWorkspace.show("library"));
  await page.locator('#libPanel .lib-item[data-lib-name="Spare"]')
    .click({ button: "right" });
  await page.locator(".ctx-entry", { hasText: "Linkage" }).click();

  await expect(page.locator(".fy-dialog")).toContainText("attachMovie");
  // Tick the box and clear the name: an exported symbol with no identifier
  // cannot be reached, which is the one combination that means nothing.
  await page.locator('.fy-dialog input[type="checkbox"]').check();
  await page.locator('.fy-dialog input[type="text"]').fill("");
  await page.locator(".fy-dialog-foot button").last().click();

  const s = await page.evaluate(() => window._flashyAI.doc.library.Spare);
  expect(s.exportForAS).toBe(true);
  expect(s.linkageName).toBeTruthy();
  expect(errors).toEqual([]);
});
