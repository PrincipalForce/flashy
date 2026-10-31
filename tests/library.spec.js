// Browsing the Library.
//
// The panel had exactly one gesture: a click, which placed an instance. That
// makes a library you cannot look through — opening an imported movie put a
// thousand symbols one click away from littering the timeline — so a click
// selects and shows a preview, dragging to the stage places, and opening an
// item goes into the item itself. These specs are the behaviours those three
// sentences promise.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, sampleDoc } from "./helpers.js";

/** Objects on the current frame of the current layer. */
async function objects(page) {
  return page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    return (kf ? kf.objects : []).map((o) => ({
      type: o.type, symbolName: o.symbolName,
      x: o.x, y: o.y, width: o.width, height: o.height,
    }));
  });
}

async function openLibrary(page) {
  await openEditor(page);
  await loadDoc(page, sampleDoc());
  await page.evaluate(() => window._flashyWorkspace.show("library"));
  return page.locator("#libPanel");
}

test("clicking a symbol previews it instead of placing it", async ({ page }) => {
  const lib = await openLibrary(page);
  const before = (await objects(page)).length;

  const item = lib.locator(".lib-item", { hasText: "Star" });
  await expect(item).toHaveCount(1);
  await item.click();

  expect((await objects(page)).length).toBe(before);
  await expect(item).toHaveClass(/sel/);
  // The preview says what it is: a 50x50 movieclip.
  await expect(lib.locator(".lib-preview-meta")).toContainText("Star");
  await expect(lib.locator(".lib-preview-meta")).toContainText("50\u00D750");

  /* And it really draws it. The symbol's artwork is a green rectangle, so
     green pixels in the preview canvas mean the symbol was rendered, not
     merely measured. */
  const green = await page.evaluate(() => {
    const cv = document.querySelector("#libPanel .lib-preview-canvas");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 180 && d[i] < 120) n++;
    return n;
  });
  expect(green).toBeGreaterThan(200);
});

test("Place on Stage places the selected symbol, at its own size", async ({ page }) => {
  const lib = await openLibrary(page);
  const before = (await objects(page)).length;
  await lib.locator(".lib-item", { hasText: "Star" }).click();
  await lib.locator(".lib-btn", { hasText: "Place on Stage" }).click();

  const objs = await objects(page);
  expect(objs.length).toBe(before + 1);
  const placed = objs[objs.length - 1];
  expect(placed.symbolName).toBe("Star");
  // 50x50, the size of what is inside it. Every symbol used to arrive as a
  // 50x50 box whatever it contained, which was right only by accident here —
  // so the drag spec below checks a symbol of another size.
  expect(placed.width).toBe(50);
  expect(placed.height).toBe(50);
});

test("the buttons do nothing until something is selected", async ({ page }) => {
  const lib = await openLibrary(page);
  await expect(lib.locator(".lib-btn", { hasText: "Place on Stage" })).toBeDisabled();
  await expect(lib.locator(".lib-btn", { hasText: "Open" })).toBeDisabled();
  await lib.locator(".lib-item", { hasText: "Star" }).click();
  await expect(lib.locator(".lib-btn", { hasText: "Place on Stage" })).toBeEnabled();
  // Opening a symbol means editing it, and the button says so.
  await expect(lib.locator(".lib-btn", { hasText: "Edit Symbol" })).toHaveCount(1);
});

test("a symbol dragged onto the stage lands where it was dropped", async ({ page }) => {
  const lib = await openLibrary(page);
  // A symbol whose artwork is not 50x50, so its size cannot come out right by
  // coincidence.
  await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    d.library.Wide = {
      objects: [{
        type: "rect", x: 0, y: 0, width: 120, height: 40,
        rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
        fillColor: "#0000FF", fillAlpha: 1, fillType: "solid",
        strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
      }],
      layers: null, totalFrames: 60, behavior: "movieclip",
    };
    window._flashyEditor.loadDoc(d);
  });
  await expect(lib.locator(".lib-item", { hasText: "Wide" })).toHaveCount(1);
  const before = (await objects(page)).length;

  /* A real HTML5 drag cannot be driven from a test, so this dispatches the
     two events the panel and the stage actually listen for, sharing one
     DataTransfer — which is what makes the payload the panel sets on dragstart
     the payload the stage reads on drop. */
  await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll("#libPanel .lib-item"))
      .find((r) => r.dataset.libName === "Wide");
    const dt = new DataTransfer();
    row.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true }));
    const c = document.getElementById("stageCanvas");
    const r = c.getBoundingClientRect();
    const F = window._flashyAI;
    // Drop at document (400, 300), the way the image-drop spec does it.
    c.dispatchEvent(new DragEvent("drop", {
      dataTransfer: dt, bubbles: true, cancelable: true,
      clientX: r.left + (c.clientWidth - F.doc.width) / 2 + 400,
      clientY: r.top + (c.clientHeight - F.doc.height) / 2 + 300,
    }));
  });

  const objs = await objects(page);
  expect(objs.length).toBe(before + 1);
  const placed = objs[objs.length - 1];
  expect(placed.symbolName).toBe("Wide");
  expect(placed.width).toBe(120);
  expect(placed.height).toBe(40);
  // Centred on the drop point, not on the stage.
  expect(placed.x + placed.width / 2).toBeCloseTo(400, 0);
  expect(placed.y + placed.height / 2).toBeCloseTo(300, 0);
});

test("opening a symbol from the Library edits it, and places nothing", async ({ page }) => {
  const lib = await openLibrary(page);
  const before = (await objects(page)).length;
  await lib.locator(".lib-item", { hasText: "Star" }).dblclick();

  await expect(page.locator("#breadcrumb")).toContainText("Star");
  // Inside the symbol, so "the current frame" is the symbol's own.
  const inside = await objects(page);
  expect(inside.length).toBe(1);
  expect(inside[0].type).toBe("rect");

  await page.locator("#breadcrumb span", { hasText: "Scene 1" }).click();
  expect((await objects(page)).length).toBe(before);
});

test("the context menu places, opens, renames and deletes", async ({ page }) => {
  const lib = await openLibrary(page);
  const item = lib.locator(".lib-item", { hasText: "Star" });
  await item.click({ button: "right" });
  const menu = page.locator("#ctxMenu");
  await expect(menu).toBeVisible();
  await expect(menu).toContainText("Place on Stage");
  await expect(menu).toContainText("Edit Symbol");

  await menu.locator(".ctx-entry", { hasText: "Rename..." }).click();
  await page.locator("#fy-dialog .fy-dialog-input").fill("Comet");
  await page.locator("#fy-dialog").getByText("OK").click();

  // Renamed in the library and on every instance that referred to it, or the
  // stage would be full of instances of a symbol that no longer exists.
  await expect(lib.locator(".lib-item", { hasText: "Comet" })).toHaveCount(1);
  expect(await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    const refs = [];
    d.layers.forEach((l) => l.keyframes.forEach((kf) => kf.objects.forEach((o) => {
      if (o.type === "symbol") refs.push(o.symbolName);
    })));
    return { names: Object.keys(d.library), refs };
  })).toEqual({ names: ["Comet"], refs: ["Comet"] });

  // And deleting takes the instances with it.
  await lib.locator(".lib-item", { hasText: "Comet" }).click({ button: "right" });
  await page.locator("#ctxMenu .ctx-entry", { hasText: "Delete" }).click();
  await page.locator("#fy-dialog .fy-dialog-btn.primary").click();
  expect(await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    let instances = 0;
    d.layers.forEach((l) => l.keyframes.forEach((kf) => kf.objects.forEach((o) => {
      if (o.type === "symbol") instances++;
    })));
    return { names: Object.keys(d.library), instances };
  })).toEqual({ names: [], instances: 0 });
});

test("the selection survives a refresh of the panel", async ({ page }) => {
  const lib = await openLibrary(page);
  const item = lib.locator(".lib-item", { hasText: "Star" });
  await item.click();
  await expect(item).toHaveClass(/sel/);

  // Anything that touches the document rebuilds the panel. Losing the
  // highlight there means losing your place in a thousand-item library.
  await page.evaluate(() => window._flashyEditor.doAction("addLayer"));
  await expect(lib.locator(".lib-item", { hasText: "Star" })).toHaveClass(/sel/);
  await expect(lib.locator(".lib-preview-meta")).toContainText("Star");
});
