// Color Swatches and the component set.
//
// Picking a colour was always three actions — open the picker, find the
// colour, confirm — and for the twenty colours a drawing actually uses that is
// twenty times too many. And there were no components at all, so anything with
// a user interface in it had to be drawn from scratch and wired by hand.
//
// Components are built as ordinary library symbols with handlers on them, the
// way Flash's own were. That matters more than it sounds: a component is
// therefore editable, exports through the paths that already exist, and needs
// no new runtime. A special object type would have needed a branch in all four
// renderers and would resist being restyled, which is the first thing anyone
// wants to do to one.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction, runExportedHTML } from "./helpers.js";

const rect = (over = {}) => ({
  type: "rect", x: 10, y: 10, width: 60, height: 40,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#CC2222", fillAlpha: 1, fillType: "solid",
  strokeColor: "#334455", strokeAlpha: 1, strokeWidth: 2, strokeStyle: "solid",
  ...over,
});

function docWith(objs, extra = {}) {
  return {
    width: 320, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 6,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 6, tweenType: "none", easing: "linear", script: "",
        objects: objs,
      }],
    }],
    library: {},
    ...extra,
  };
}

const act = (page, a) => page.evaluate((a) => window._flashyEditor.doAction(a), a);

/* ------------------------------------------------------------------ *
 * Swatches
 * ------------------------------------------------------------------ */

test("the document palette is gathered from the artwork, most-used first", async ({ page }) => {
  const errors = await openEditor(page);
  /* Distinct strokes, so the fills are what the ordering is about: the
     fixture's shared stroke would otherwise be the most-used colour in it,
     which is correct behaviour but not what this spec is checking. */
  await loadDoc(page, docWith([
    rect({ fillColor: "#AA0000", strokeColor: "#334455" }),
    rect({ x: 100, fillColor: "#AA0000", strokeColor: "#111111" }),
    rect({ x: 200, fillColor: "#00AA00", strokeColor: "#222222" }),
  ]));

  const pal = await page.evaluate(() => window._flashyAI.documentPalette());
  // The colour used twice comes first: a cartoon is drawn from its own
  // palette, and the one you reach for most should be nearest.
  expect(pal[0]).toBe("#AA0000");
  expect(pal).toContain("#00AA00");
  // Strokes count too, and so does the stage colour.
  expect(pal).toContain("#334455");
  expect(pal).toContain("#FFFFFF");
  expect(errors).toEqual([]);
});

test("a colour used only inside a symbol is still one of the document's", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([], {
    library: {
      Hidden: {
        totalFrames: 1, behavior: "graphic",
        layers: [{
          name: "Layer 1", visible: true, locked: false,
          keyframes: [{
            index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
            objects: [rect({ fillColor: "#123456" })],
          }],
        }],
      },
    },
  }));
  const pal = await page.evaluate(() => window._flashyAI.documentPalette());
  expect(pal).toContain("#123456");
});

test("gradient stops and filter colours are in the palette", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect({
    fillType: "linear",
    fillStops: [0, 0xFF8800, 1, 1, 0x0088FF, 1],
    fillGrad: [0, 0, 1, 0],
    filters: [{ type: "glow", enabled: true, blur: 8, color: 0x44FF44, alpha: 1 }],
  })]));
  const pal = await page.evaluate(() => window._flashyAI.documentPalette());
  expect(pal).toContain("#FF8800");
  expect(pal).toContain("#0088FF");
  expect(pal).toContain("#44FF44");
});

test("the web-safe palette is the 216 Flash shipped", async ({ page }) => {
  await openEditor(page);
  const pal = await page.evaluate(() => window._flashyAI.webSafePalette());
  expect(pal).toHaveLength(216);
  expect(pal[0]).toBe("#000000");
  expect(pal[pal.length - 1]).toBe("#FFFFFF");
  expect(pal).toContain("#336699");
  // Every entry is on the 00/33/66/99/CC/FF lattice.
  const steps = ["00", "33", "66", "99", "CC", "FF"];
  expect(pal.every((c) => steps.includes(c.slice(1, 3)) &&
                          steps.includes(c.slice(3, 5)) &&
                          steps.includes(c.slice(5, 7)))).toBe(true);
});

test("clicking a swatch sets the fill, and Shift-click the stroke", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([rect({ fillColor: "#AA0000" })]));
  await page.evaluate(() => window._flashyEditor.doAction("winSwatches"));
  await page.evaluate(() => window._flashyAI.swatchMode("document"));

  // With something selected, the swatch recolours it too: picking a colour
  // with an object selected and having nothing happen is the commonest
  // confusion with a palette.
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    F.fullRefresh();
  });
  await page.locator('#swatchesPanel .swatch[data-color="#334455"]').click();
  let o = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0]);
  expect(o.fillColor).toBe("#334455");

  await page.locator('#swatchesPanel .swatch[data-color="#FFFFFF"]')
    .click({ modifiers: ["Shift"] });
  o = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0]);
  // Two gestures rather than two grids, because the colour you want is the
  // same one either way.
  expect(o.strokeColor).toBe("#FFFFFF");
  expect(o.fillColor).toBe("#334455");

  // One undo per click, so a mis-click is one step back.
  await act(page, "undo");
  o = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0]);
  expect(o.strokeColor).toBe("#334455");
  expect(errors).toEqual([]);
});

test("a custom palette can be built, and will not take a colour twice", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));
  const n = await page.evaluate(() => {
    const F = window._flashyAI;
    F.addCustomSwatch("#112233");
    F.addCustomSwatch("#445566");
    // A palette with the same colour three times is a palette three colours
    // smaller than it looks.
    F.addCustomSwatch("#112233");
    return F.currentSwatches();
  });
  expect(n).toEqual(["#112233", "#445566"]);
  expect(await page.evaluate(() => window._flashyAI.swatchMode())).toBe("custom");
});

test("an empty custom palette says how to start one", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => window._flashyEditor.doAction("winSwatches"));
  await page.evaluate(() => window._flashyAI.swatchMode("custom"));
  await expect(page.locator("#swatchesPanel")).toContainText("Add current");
});

test("a palette saves as a readable file", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect({ fillColor: "#AA0000" })]));
  await page.evaluate(() => window._flashyEditor.doAction("winSwatches"));

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#swatchesPanel button", { hasText: "Save" }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  // Plain JSON, not Flash's .act: an .act is 768 raw bytes with no room for a
  // name and nothing else can read one.
  expect(Array.isArray(parsed.colors)).toBe(true);
  expect(parsed.colors).toContain("#AA0000");
});

/* ------------------------------------------------------------------ *
 * Components
 * ------------------------------------------------------------------ */

test("a component becomes a library symbol plus an instance", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([]));

  const res = await page.evaluate(() =>
    window._flashyAI.addComponent("button", { label: "Start", instanceName: "startBtn" }));
  expect(res.ok).toBe(true);

  const state = await page.evaluate(() => {
    const F = window._flashyAI;
    const sym = F.doc.library[Object.keys(F.doc.library)[0]];
    const inst = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    return {
      symbolNames: Object.keys(F.doc.library),
      behavior: sym.behavior,
      frames: sym.layers[0].keyframes.length,
      folder: sym.folder,
      instName: inst.instanceName,
      instType: inst.type,
      script: inst.clipScript,
      x: inst.x, y: inst.y,
    };
  });
  // An ordinary symbol, so it can be opened and changed — and it lands in a
  // Components folder rather than loose in the library.
  expect(state.symbolNames).toEqual(["Button"]);
  expect(state.folder).toBe("Components");
  // Up / Over / Down / Hit, as a Button symbol.
  expect(state.behavior).toBe("button");
  expect(state.frames).toBe(4);
  expect(state.instType).toBe("symbol");
  expect(state.instName).toBe("startBtn");
  expect(state.script).toContain("on (release)");
  // Dropped where it can be seen rather than at the origin under whatever is
  // already there.
  expect(state.x).toBeGreaterThan(0);
  expect(state.y).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("every component in the catalogue builds", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([]));
  const built = await page.evaluate(() => {
    const F = window._flashyAI;
    return F.components().map((c) => {
      const r = F.addComponent(c.id, { instanceName: c.id + "X" });
      const sym = r.ok ? F.doc.library[r.name] : null;
      return {
        id: c.id, ok: r.ok,
        objects: sym ? sym.layers[0].keyframes[0].objects.length : 0,
        hasScript: !!(r.ok && r.instance.clipScript),
      };
    });
  });
  expect(built.every((b) => b.ok)).toBe(true);
  // Each one has artwork; each one that should react has a handler.
  expect(built.every((b) => b.objects > 0)).toBe(true);
  expect(built.filter((b) => b.hasScript).length).toBe(built.length);
  expect(errors).toEqual([]);
});

test("a checkbox's state is its frame, so a script can read it", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  const res = await page.evaluate(() =>
    window._flashyAI.addComponent("checkbox", { label: "Agree" }));
  const sym = await page.evaluate((n) => window._flashyAI.doc.library[n], res.name);
  // Frame 1 is off and frame 2 is on, so the state IS the frame — no variable
  // to keep in step with the artwork.
  expect(sym.layers[0].keyframes).toHaveLength(2);
  expect(sym.layers[0].keyframes[1].objects.length)
    .toBeGreaterThan(sym.layers[0].keyframes[0].objects.length);
  expect(res.instance.clipScript).toContain("gotoAndStop(checked ? 2 : 1)");
});

test("a text input component carries a real input field", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  const res = await page.evaluate(() =>
    window._flashyAI.addComponent("input", { instanceName: "nameField" }));
  const field = await page.evaluate((n) => {
    const objs = window._flashyAI.doc.library[n].layers[0].keyframes[0].objects;
    return objs.filter((o) => o.type === "text")[0];
  }, res.name);
  // The field inside is a genuine input text object, not a drawing of one.
  expect(field.textType).toBe("input");
  expect(field.instanceName).toBe("nameField");
  expect(res.instance.clipScript).toContain("nameField");
});

test("a component's handler reaches the exported player", async ({ page, context }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([]));
  await page.evaluate(() =>
    window._flashyAI.addComponent("button", { label: "Press me" }));
  await page.evaluate(() => window._flashyAI.fullRefresh());

  const html = await downloadFromAction(page, "export");
  // The handler travels with the instance and is AS2, so the export carries
  // the AS2 runtime with it.
  expect(html).toContain("on (release)");
  expect(html).toContain("Flashy.AS2");

  const { page: out, errors: outErrors } = await runExportedHTML(context, html);
  const traced = await out.evaluate(() => {
    const cv = document.querySelector("canvas");
    const r = cv.getBoundingClientRect();
    // The button is centred on the stage.
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const at = (t) => cv.dispatchEvent(new PointerEvent(t, {
      pointerId: 1, isPrimary: true, button: 0,
      buttons: t === "pointerup" ? 0 : 1,
      clientX: x, clientY: y, bubbles: true,
    }));
    at("pointerdown");
    at("pointerup");
    return window.Flashy.Output.lines.slice();
  });
  expect(traced.join(" ")).toContain("Press me clicked");
  expect(outErrors).toEqual([]);
  await out.close();
  expect(errors).toEqual([]);
});

test("a component is a symbol, so a second instance costs nothing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    const r = F.addComponent("button", { label: "One" });
    // Place a second instance of the SAME symbol, as the Library would.
    const kf = F.currentLayers()[0].getKeyframeAt(1);
    const o = new F.EditorObject("symbol");
    o.symbolName = r.name;
    o.symbolBehavior = "button";
    o.width = 100; o.height = 28;
    o.x = 10; o.y = 10;
    kf.objects.push(o);
    F.fullRefresh();
  });
  const state = await page.evaluate(() => ({
    symbols: Object.keys(window._flashyAI.doc.library).length,
    instances: window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects.length,
    uses: window._flashyAI.libUseCount("symbol", "Button"),
  }));
  // Editing the symbol changes both, which is what a component is for.
  expect(state.symbols).toBe(1);
  expect(state.instances).toBe(2);
  expect(state.uses).toBe(2);
});

test("the Components dialog adds what was chosen", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([]));
  await act(page, "components");

  const dlg = page.locator(".fy-dialog");
  await expect(dlg).toContainText("Components");
  await dlg.locator(".fy-dialog-row", { hasText: "Component" })
    .locator("select").selectOption("progress");
  await dlg.locator(".fy-dialog-row", { hasText: "Instance name" })
    .locator("input").fill("bar1");
  await dlg.locator(".fy-dialog-foot button").last().click();

  const state = await page.evaluate(() => {
    const F = window._flashyAI;
    const inst = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    return { names: Object.keys(F.doc.library), inst: inst.instanceName,
             script: inst.clipScript };
  });
  expect(state.names).toEqual(["Progress Bar"]);
  expect(state.inst).toBe("bar1");
  expect(state.script).toContain("setProgress");
  expect(errors).toEqual([]);
});

test("a component will not be added to a locked layer", async ({ page }) => {
  await openEditor(page);
  const d = docWith([]);
  d.layers[0].locked = true;
  await loadDoc(page, d);
  const res = await page.evaluate(() => window._flashyAI.addComponent("button", {}));
  expect(res).toMatchObject({ ok: false, reason: "locked" });
  expect(await page.evaluate(() =>
    Object.keys(window._flashyAI.doc.library).length)).toBe(0);
});
