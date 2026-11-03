// Runtime shared libraries.
//
// Flash's Linkage dialog had two halves. "Export for ActionScript" names a
// symbol so a script can create one, and Flashy has had that. "Export for
// runtime sharing" and "Import for runtime sharing" are the other half: a
// symbol lives in ONE movie and every other movie loads it from there at run
// time. It is how a studio kept one logo across thirty files and updated all
// thirty by republishing one.
//
// The audit refused to build it, on the grounds that it needs a second file
// that has to still be there — a large part of why Flash content rotted. That
// is a real objection, and it is a reason to build it DIFFERENTLY rather than
// to leave it out: the embedded copy stays in the document as a fallback, so
// a shared symbol is an upgrade and not a dependency. A shared file that
// cannot be reached means the movie draws what it shipped with and says so.
// Flash's version drew nothing, which is the rot the objection described.
import { test, expect } from "@playwright/test";
import { openEditor, downloadFromAction, runExportedHTML } from "./helpers.js";

/** A symbol whose one frame is a solid box of `colour`. */
const boxSymbol = (colour, totalFrames = 1) => ({
  objects: [],
  layers: [{
    name: "L", visible: true, locked: false,
    keyframes: [{
      index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
      objects: [{
        type: "rect", x: 0, y: 0, width: 60, height: 40,
        rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
        fillColor: colour, fillAlpha: 1, fillType: "solid",
        strokeStyle: "none", strokeWidth: 0,
      }],
    }],
  }],
  totalFrames,
  behavior: "graphic",
});

/** A document with one symbol in the library and one instance of it. */
async function withSymbol(page, colour = "#CC2222", extra = {}) {
  await page.evaluate(({ colour, extra, sym }) => {
    window._flashyEditor.loadDoc({
      width: 200, height: 150, fps: 12, backgroundColor: "#FFFFFF",
      totalFrames: 1,
      library: { Logo: Object.assign(JSON.parse(JSON.stringify(sym)), extra) },
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "symbol", symbolName: "Logo", symbolBehavior: "graphic",
          x: 40, y: 50, width: 60, height: 40,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          firstFrame: 1, loopMode: "loop",
        }],
      }] }],
    });
    void colour;
  }, { colour, extra, sym: boxSymbol(colour) });
}

/** A shared-library manifest as a data: URL, which fetch() accepts. */
function manifestURL(symbols) {
  const json = JSON.stringify({ flashyShared: 1, symbols });
  return "data:application/json;base64," + Buffer.from(json, "utf8").toString("base64");
}

/* ------------------------------------------------------------------ *
 * Marking a symbol
 * ------------------------------------------------------------------ */

test("a symbol can be marked for import or export, and unmarked", async ({ page }) => {
  await openEditor(page);
  await withSymbol(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const before = F.runtimeShare("Logo");
    const imp = F.setRuntimeShare("Logo", "import", "shared.flashy", "BrandLogo");
    const asImport = F.runtimeShare("Logo");
    const exp = F.setRuntimeShare("Logo", "export", "", "BrandLogo");
    const asExport = F.runtimeShare("Logo");
    // The identifier defaults to the symbol's own name.
    F.setRuntimeShare("Logo", "export", "", "");
    const defaulted = F.runtimeShare("Logo").identifier;
    const cleared = (F.setRuntimeShare("Logo", null), F.runtimeShare("Logo"));
    // An imported symbol with no URL has nowhere to look.
    const noUrl = F.setRuntimeShare("Logo", "import", "", "X");
    const missing = F.setRuntimeShare("Nope", "import", "x.flashy", "X");
    return { before, imp, asImport, exp, asExport, defaulted, cleared,
             noUrl, missing, still: F.runtimeShare("Logo") };
  });
  expect(r.before).toBe(null);
  expect(r.imp.ok).toBe(true);
  expect(r.asImport).toEqual({ mode: "import", url: "shared.flashy", identifier: "BrandLogo" });
  expect(r.exp.ok).toBe(true);
  expect(r.asExport.mode).toBe("export");
  /* The identifier is the contract between the two movies, so it defaults to
     something rather than being empty — an empty one matches nothing. */
  expect(r.defaulted).toBe("Logo");
  expect(r.cleared).toBe(null);
  expect(r.noUrl.ok).toBe(false);
  expect(r.noUrl.why).toContain("URL");
  expect(r.missing.ok).toBe(false);
  // The failed calls left it unshared rather than half-shared.
  expect(r.still).toBe(null);
});

test("the manifest publishes only the exported symbols, keyed by identifier", async ({ page }) => {
  await openEditor(page);
  await page.evaluate((sym) => {
    window._flashyEditor.loadDoc({
      width: 200, height: 150, fps: 12, backgroundColor: "#FFF", totalFrames: 1,
      library: {
        Logo: JSON.parse(JSON.stringify(sym)),
        Private: JSON.parse(JSON.stringify(sym)),
        Incoming: JSON.parse(JSON.stringify(sym)),
      },
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear",
        script: "", objects: [] }] }],
    });
    const F = window._flashyAI;
    F.setRuntimeShare("Logo", "export", "", "BrandLogo");
    F.setRuntimeShare("Incoming", "import", "other.flashy", "Thing");
  }, boxSymbol("#112233"));
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const m = F.runtimeShareManifest();
    return {
      marker: m.flashyShared,
      ids: Object.keys(m.symbols),
      localName: m.symbols.BrandLogo.name,
      hasLayers: Array.isArray(m.symbols.BrandLogo.layers),
      hasAssets: "bitmaps" in m.symbols.BrandLogo && "sounds" in m.symbols.BrandLogo,
      shared: F.runtimeShared().map((s) => [s.name, s.mode]).sort(),
    };
  });
  expect(r.marker).toBe(1);
  /* Keyed by the IDENTIFIER, not the local name: renaming the symbol in the
     source movie must not break the files that import it. */
  expect(r.ids).toEqual(["BrandLogo"]);
  expect(r.localName).toBe("Logo");
  expect(r.hasLayers).toBe(true);
  // The assets the symbol uses travel with it, or it arrives as an empty box.
  expect(r.hasAssets).toBe(true);
  expect(r.shared).toEqual([["Incoming", "import"], ["Logo", "export"]]);
});

/* ------------------------------------------------------------------ *
 * Resolving
 * ------------------------------------------------------------------ */

test("applying a shared symbol replaces its contents, not the library entry", async ({ page }) => {
  await openEditor(page);
  await withSymbol(page, "#CC2222");
  const r = await page.evaluate((shared) => {
    const F = window._flashyAI;
    F.setRuntimeShare("Logo", "import", "shared.flashy", "BrandLogo");
    const before = F.doc.library.Logo.layers[0].keyframes[0].objects[0].fillColor;
    const res = F.applyRuntimeShare("Logo", shared);
    const after = F.doc.library.Logo.layers[0].keyframes[0].objects[0].fillColor;
    return {
      res, before, after,
      /* The instance on the stage still points at the LOCAL name, which is
         why the contents are replaced and the entry is not. */
      stillNamed: F.currentLayers()[0].getKeyframeAt(1).objects[0].symbolName,
      stillInLibrary: !!F.doc.library.Logo,
      frames: F.doc.library.Logo.totalFrames,
      // A symbol that is not imported cannot be resolved into.
      notShared: F.applyRuntimeShare("Nope", shared),
      wrongId: F.applyRuntimeShare("Logo", { flashyShared: 1, symbols: {} }),
    };
  }, { flashyShared: 1, symbols: { BrandLogo: Object.assign(
        { name: "Logo" },
        { layers: [{ name: "L", visible: true, locked: false, keyframes: [{
            index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
            objects: [{ type: "rect", x: 0, y: 0, width: 60, height: 40,
              rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
              fillColor: "#22AA44", fillAlpha: 1, fillType: "solid",
              strokeStyle: "none", strokeWidth: 0 }] }] }],
          totalFrames: 3, behavior: "graphic", bitmaps: {}, sounds: {} }) } });
  expect(r.res.ok).toBe(true);
  expect(r.before).toBe("#CC2222");
  expect(r.after).toBe("#22AA44");
  expect(r.stillNamed).toBe("Logo");
  expect(r.stillInLibrary).toBe(true);
  expect(r.frames).toBe(3);
  expect(r.notShared.ok).toBe(false);
  expect(r.wrongId.ok).toBe(false);
  expect(r.wrongId.why).toContain("BrandLogo");
});

test("an incoming asset is added but never overwrites a local one", async ({ page }) => {
  await openEditor(page);
  await withSymbol(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.doc.bitmaps = { Mine: { name: "Mine", mediaType: "image/png",
      data: "LOCAL", width: 1, height: 1, folder: "" } };
    F.setRuntimeShare("Logo", "import", "shared.flashy", "BrandLogo");
    const res = F.applyRuntimeShare("Logo", { flashyShared: 1, symbols: {
      BrandLogo: {
        name: "Logo",
        layers: [{ name: "L", visible: true, locked: false, keyframes: [{
          index: 1, duration: 1, tweenType: "none", easing: "linear",
          script: "", objects: [] }] }],
        totalFrames: 1, behavior: "graphic",
        bitmaps: {
          Mine: { name: "Mine", mediaType: "image/png", data: "INCOMING",
                  width: 9, height: 9, folder: "" },
          Theirs: { name: "Theirs", mediaType: "image/png", data: "NEW",
                    width: 2, height: 2, folder: "" },
        },
        sounds: {},
      } } });
    return { res, mine: F.doc.bitmaps.Mine.data,
             theirs: F.doc.bitmaps.Theirs && F.doc.bitmaps.Theirs.data,
             names: Object.keys(F.doc.bitmaps).sort() };
  });
  expect(r.res.ok).toBe(true);
  /* Added, not overwritten: a local bitmap of the same name may be the one
     the rest of the movie is built on. */
  expect(r.mine).toBe("LOCAL");
  expect(r.theirs).toBe("NEW");
  expect(r.names).toEqual(["Mine", "Theirs"]);
  expect(r.res.assets).toBe(1);
});

test("a plain .flashy works as a source, not just a published manifest", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(async () => {
    const F = window._flashyAI;
    const asURL = (o) =>
      "data:application/json;base64," + btoa(JSON.stringify(o));
    const manifest = await F.loadRuntimeShare(asURL({
      flashyShared: 1, symbols: { A: { layers: [], totalFrames: 1 } } }));
    const plain = await F.loadRuntimeShare(asURL({
      width: 100, height: 100, fps: 12, layers: [],
      library: { A: { layers: [], totalFrames: 7, behavior: "graphic" } } }));
    const junk = await F.loadRuntimeShare(asURL({ hello: true }));
    const broken = await F.loadRuntimeShare("data:application/json,{{{");
    const gone = await F.loadRuntimeShare("/no/such/file.flashy");
    return {
      manifestIds: Object.keys(manifest.symbols),
      plainIds: Object.keys(plain.symbols),
      plainFrames: plain.symbols.A.totalFrames,
      junk, broken, gone,
    };
  });
  /* Asking the author to publish a manifest before sharing would be a step
     with no purpose: the common case is "share out of that file there". */
  expect(r.manifestIds).toEqual(["A"]);
  expect(r.plainIds).toEqual(["A"]);
  expect(r.plainFrames).toBe(7);
  // A file that is neither resolves to null rather than throwing.
  expect(r.junk).toBe(null);
  expect(r.broken).toBe(null);
  expect(r.gone).toBe(null);
});

test("resolving fetches once per URL and reports what failed", async ({ page }) => {
  await openEditor(page);
  await page.evaluate((sym) => {
    window._flashyEditor.loadDoc({
      width: 200, height: 150, fps: 12, backgroundColor: "#FFF", totalFrames: 1,
      library: {
        A: JSON.parse(JSON.stringify(sym)),
        B: JSON.parse(JSON.stringify(sym)),
        C: JSON.parse(JSON.stringify(sym)),
      },
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear",
        script: "", objects: [] }] }],
    });
  }, boxSymbol("#CC2222"));
  const r = await page.evaluate(async () => {
    const F = window._flashyAI;
    const green = (name) => ({
      name, totalFrames: 1, behavior: "graphic", bitmaps: {}, sounds: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{ type: "rect", x: 0, y: 0, width: 60, height: 40,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#22AA44", fillAlpha: 1, fillType: "solid",
          strokeStyle: "none", strokeWidth: 0 }] }] }],
    });
    const good = "data:application/json;base64," + btoa(JSON.stringify({
      flashyShared: 1, symbols: { A: green("A"), B: green("B") } }));

    // A and B share one URL; C points at one that does not resolve.
    F.setRuntimeShare("A", "import", good, "A");
    F.setRuntimeShare("B", "import", good, "B");
    F.setRuntimeShare("C", "import", "/no/such/file.flashy", "C");

    let fetches = 0;
    const real = window.fetch;
    window.fetch = function (...args) { fetches++; return real.apply(this, args); };
    const res = await F.resolveRuntimeShares();
    window.fetch = real;

    const colourOf = (n) =>
      F.doc.library[n].layers[0].keyframes[0].objects[0].fillColor;
    return { res, fetches, a: colourOf("A"), b: colourOf("B"), c: colourOf("C") };
  });
  expect(r.res.resolved).toBe(2);
  /* One request per URL, not per symbol: thirty symbols out of one file is
     the normal case and thirty waits would be absurd. */
  expect(r.fetches).toBe(2);
  expect(r.a).toBe("#22AA44");
  expect(r.b).toBe("#22AA44");
  // The one that failed is named, and still draws what it shipped with.
  expect(r.res.failed).toHaveLength(1);
  expect(r.res.failed[0].name).toBe("C");
  expect(r.c).toBe("#CC2222");
});

/* ------------------------------------------------------------------ *
 * The editor
 * ------------------------------------------------------------------ */

test("the Linkage dialog sets runtime sharing and refuses an import with no URL", async ({ page }) => {
  await openEditor(page);
  await withSymbol(page);
  const dialog = await page.evaluate(() => {
    window._flashyAI.showLinkage("Logo");
    const d = document.getElementById("fy-dialog");
    const sels = [...d.querySelectorAll("select")];
    const inputs = [...d.querySelectorAll("input")];
    const modes = sels.map((s) => [...s.options].map((o) => o.value));
    // Choose Import but leave the URL empty.
    const mode = sels.find((s) => [...s.options].some((o) => o.value === "import"));
    mode.value = "import";
    mode.dispatchEvent(new Event("change", { bubbles: true }));
    [...d.querySelectorAll("button")].find((b) => b.textContent === "OK").click();
    const err = d.querySelector(".fy-dialog-error").textContent;
    return { modes, err, fields: inputs.length };
  });
  expect(dialog.modes.some((m) => m.includes("import") && m.includes("export"))).toBe(true);
  // Refused, with the reason, rather than stored as a request that can never
  // succeed.
  expect(dialog.err).toContain("URL");

  const applied = await page.evaluate(() => {
    const d = document.getElementById("fy-dialog");
    const inputs = [...d.querySelectorAll("input")];
    const url = inputs.find((i) => i.placeholder === "shared-library.flashy");
    url.value = "shared.flashy";
    url.dispatchEvent(new Event("change", { bubbles: true }));
    [...d.querySelectorAll("button")].find((b) => b.textContent === "OK").click();
    return window._flashyAI.runtimeShare("Logo");
  });
  expect(applied.mode).toBe("import");
  expect(applied.url).toBe("shared.flashy");
});

test("sharing survives a save, and an unusable record is normalised away", async ({ page }) => {
  await openEditor(page);
  await withSymbol(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setRuntimeShare("Logo", "import", "shared.flashy", "BrandLogo");
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const back = F.runtimeShare("Logo");

    // Records the dialog could never have produced.
    const doc = JSON.parse(json);
    const bad = [
      { mode: "import", url: "", identifier: "X" },   // nowhere to look
      { mode: "sideways", url: "a", identifier: "X" }, // not a mode
      { mode: "export", url: "", identifier: "" },     // identifier defaults
    ];
    const out = bad.map((rs) => {
      const d = JSON.parse(JSON.stringify(doc));
      d.library.Logo.runtimeShare = rs;
      if (d.scenes) d.scenes[0].layers = d.layers;
      window._flashyEditor.loadDoc(d);
      return F.runtimeShare("Logo");
    });
    return { saved: /"runtimeShare"/.test(json), back, out };
  });
  expect(r.saved).toBe(true);
  expect(r.back).toEqual({ mode: "import", url: "shared.flashy", identifier: "BrandLogo" });
  /* An import with no URL and a mode that is not a mode both come back as not
     shared, rather than as a request that can never succeed. */
  expect(r.out[0]).toBe(null);
  expect(r.out[1]).toBe(null);
  // An export needs no URL, and its identifier falls back to the name.
  expect(r.out[2]).toEqual({ mode: "export", url: "", identifier: "Logo" });
});

test("the dialog explains itself with nothing shared", async ({ page }) => {
  await openEditor(page);
  await withSymbol(page);
  await page.evaluate(() => window._flashyEditor.doAction("runtimeShare"));
  const text = await page.evaluate(() =>
    document.getElementById("fy-dialog").textContent);
  expect(text).toContain("No symbol in this document is shared");
  expect(text).toContain("Linkage");
});

/* ------------------------------------------------------------------ *
 * The exported player
 * ------------------------------------------------------------------ */

test("the exported player loads the shared symbol and draws it", async ({ page, context }) => {
  await openEditor(page);
  await withSymbol(page, "#CC2222");
  const url = manifestURL({
    BrandLogo: {
      name: "Logo", totalFrames: 1, behavior: "graphic", bitmaps: {}, sounds: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{ type: "rect", x: 0, y: 0, width: 60, height: 40,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#22AA44", fillAlpha: 1, fillType: "solid",
          strokeStyle: "none", strokeWidth: 0 }] }] }],
    },
  });
  await page.evaluate((url) => {
    window._flashyAI.setRuntimeShare("Logo", "import", url, "BrandLogo");
    window._flashyAI.fullRefresh();
  }, url);
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  // Wait for the swap rather than sleeping: the fetch is async by design and
  // nothing in the movie blocks on it.
  await out.waitForFunction(() => {
    const c = document.querySelector("canvas");
    if (!c) return false;
    const g = c.getContext("2d");
    const d = g.getImageData(Math.round(70 * (c.width / 200)),
                             Math.round(70 * (c.height / 150)), 1, 1).data;
    return d[1] > d[0] + 40;
  }, null, { timeout: 15000 });
  const run = await out.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const d = g.getImageData(Math.round(70 * (c.width / 200)),
                             Math.round(70 * (c.height / 150)), 1, 1).data;
    return { px: [d[0], d[1], d[2]],
             traced: (window.Flashy.Output.lines || []).join(" ") };
  });
  await out.close();
  expect(errors).toEqual([]);
  /* Green, not the red the movie shipped with: the player fetched the shared
     file, swapped the symbol's layers, and the next repaint drew them. */
  expect(run.px[1]).toBeGreaterThan(run.px[0] + 40);
  expect(run.traced).toContain("Runtime sharing: loaded 1 symbol");
});

test("an unreachable shared file falls back to the embedded copy", async ({ page, context }) => {
  await openEditor(page);
  await withSymbol(page, "#CC2222");
  await page.evaluate(() => {
    window._flashyAI.setRuntimeShare("Logo", "import", "/no/such/file.flashy", "BrandLogo");
    window._flashyAI.fullRefresh();
  });
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(
    () => (window.Flashy.Output.lines || []).some((l) => /Runtime sharing/.test(l)),
    null, { timeout: 15000 });
  const run = await out.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const d = g.getImageData(Math.round(70 * (c.width / 200)),
                             Math.round(70 * (c.height / 150)), 1, 1).data;
    return { px: [d[0], d[1], d[2]],
             traced: (window.Flashy.Output.lines || []).join(" ") };
  });
  await out.close();
  expect(errors).toEqual([]);
  /* THE WHOLE POINT. Flash drew nothing here, and that is a large part of why
     Flash content rotted. The movie draws the copy it shipped with — red —
     and says what happened once. */
  expect(run.px[0]).toBeGreaterThan(run.px[1] + 40);
  expect(run.traced).toContain("could not load");
  expect(run.traced).toContain("shipped with");
});

test("Runtime Shared Symbols is in the menus", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const text = JSON.stringify(window._flashyEditor.menus || []);
    return { action: text.indexOf("runtimeShare") >= 0,
             label: text.indexOf("Runtime Shared Symbols") >= 0 };
  });
  expect(r.action).toBe(true);
  expect(r.label).toBe(true);
});
