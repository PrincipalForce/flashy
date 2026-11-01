// Anti-alias modes that change the pixels, real font embedding, device fonts,
// character ranges, and a proofreader.
//
// Two of these were marked in the audit as recorded-but-not-honoured, which is
// the shape this whole audit keeps finding. Anti-alias mode was stored on the
// field and said in the inspector to be a record only. Embedding was simply
// missing, and the usual reason — "it needs a font parser" — turned out to be
// false: Flashy already has a tracer that turns a rendered image into
// outlines, and a glyph is a very simple image.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction } from "./helpers.js";

const kf = (objects, over = {}) => ({
  index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
  objects, ...over,
});

const text = (t, over = {}) => ({
  type: "text", x: 20, y: 20, width: 240, height: 60,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  text: t, font: "Georgia", fontSize: 36, textAlign: "left", lineHeight: 1.2,
  textType: "static",
  fillColor: "#000000", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

function docWith(objs) {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf(objs)] }],
    library: {},
  };
}

/** How many partly-transparent pixels the frame has — the anti-aliasing. */
const greyCount = (page) =>
  page.evaluate(() => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 300, 200);
    const d = cv.getContext("2d").getImageData(0, 0, 300, 200).data;
    let grey = 0, solid = 0;
    for (let i = 0; i < 300 * 200; i++) {
      const r = d[i * 4];
      if (r < 40) solid++;
      else if (r < 230) grey++;
    }
    return { grey, solid };
  });

/* ------------------------------------------------------------------ *
 * Anti-alias modes
 * ------------------------------------------------------------------ */

test("device fonts substitute the player's own family", async ({ page }) => {
  await openEditor(page);
  const fams = await page.evaluate(() => {
    const F = window.Flashy.Fonts;
    return {
      sans: F.familyFor("_sans"),
      serif: F.familyFor("_serif"),
      typewriter: F.familyFor("_typewriter"),
      // A named face in device mode keeps its name but adds the generic, so
      // it is used when the viewer happens to have it.
      device: F.familyFor("Georgia", "device"),
      normal: F.familyFor("Georgia", "normal"),
    };
  });
  /* Flash's three device fonts map onto the generic families every browser
     has, which is the same promise: whatever this machine has. */
  expect(fams.sans).toBe("sans-serif");
  expect(fams.serif).toBe("serif");
  expect(fams.typewriter).toBe("monospace");
  expect(fams.device).toContain("sans-serif");
  expect(fams.normal).toBe("Georgia");
});

test("bitmap text really switches the rasteriser off", async ({ page }) => {
  await openEditor(page);

  await loadDoc(page, docWith([text("Hamburg", { antiAlias: "normal" })]));
  const smooth = await greyCount(page);

  await loadDoc(page, docWith([text("Hamburg", { antiAlias: "bitmap" })]));
  const hard = await greyCount(page);

  /* Anti-aliasing IS the partly-transparent pixels along a glyph's edge, so
     switching it off removes nearly all of them. This was recorded on the
     field and ignored. */
  expect(smooth.grey).toBeGreaterThan(100);
  expect(hard.grey).toBeLessThan(smooth.grey / 4);
  // The text is still there: it is crisp, not gone.
  expect(hard.solid).toBeGreaterThan(smooth.solid * 0.7);
});

test("readability snaps glyphs onto the pixel grid", async ({ page }) => {
  await openEditor(page);
  const snapped = await page.evaluate(() => {
    const F = window.Flashy.Fonts;
    return {
      on: [F.snap(10.4, "readability"), F.snap(10.6, "readability")],
      off: [F.snap(10.4, "normal"), F.snap(10.4, "animation")],
    };
  });
  /* Real hinting needs the font's own instructions, which a browser will not
     hand over. Stopping a stem straddling a pixel boundary is what IS
     possible, and the claim is no bigger than that. */
  expect(snapped.on).toEqual([10, 11]);
  expect(snapped.off).toEqual([10.4, 10.4]);
});

test("the mode survives a save and still changes the drawing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("Hg", { antiAlias: "bitmap" })]));
  const back = await page.evaluate(() => {
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    return window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0].antiAlias;
  });
  expect(back).toBe("bitmap");
  const hard = await greyCount(page);
  expect(hard.grey).toBeLessThan(80);
});

/* ------------------------------------------------------------------ *
 * Embedding
 * ------------------------------------------------------------------ */

test("the faces in use are found, with the characters each one needs", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    text("AB", { font: "Georgia" }),
    text("BC", { font: "Georgia", y: 100 }),
    text("xy", { font: "Arial", fontBold: true, y: 150 }),
  ]));

  const inUse = await page.evaluate(() => window._flashyAI.fontsInUse());
  expect(inUse).toHaveLength(2);
  const georgia = inUse.find((f) => f.face === "Georgia");
  // Two fields, and the union of the characters they use: embedding more than
  // that is pure weight in a small movie.
  expect(georgia.fields).toBe(2);
  expect(georgia.used).toBe("ABC");
  const arial = inUse.find((f) => f.face === "Arial");
  expect(arial.bold).toBe(true);
  expect(arial.key).toBe("Arial|b");
});

test("a character range resolves to the right set", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("Hi")]));
  const sets = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      used: F.embedCharsFor("used", "Hi", ""),
      numerals: F.embedCharsFor("numerals", "Hi", "").includes("7"),
      basic: F.embedCharsFor("basic", "Hi", "").length,
      extra: F.embedCharsFor("used", "Hi", "!?"),
      // A character asked for twice is embedded once.
      dedup: F.embedCharsFor("used", "aa", "a"),
    };
  });
  expect(sets.used).toBe("Hi");
  expect(sets.numerals).toBe(true);
  expect(sets.basic).toBeGreaterThan(60);
  expect(sets.extra).toContain("!");
  expect(sets.dedup).toBe("a");
});

test("a glyph is traced into outlines, with an advance", async ({ page }) => {
  await openEditor(page);
  const g = await page.evaluate(() => {
    const F = window.Flashy.Fonts;
    const glyph = F.traceGlyph("H", "128px Georgia", window.FlashyTrace);
    const space = F.traceGlyph(" ", "128px Georgia", window.FlashyTrace);
    return {
      has: !!glyph,
      advance: glyph && glyph.advance,
      commands: glyph && glyph.path ? glyph.path.length : 0,
      // A space is an advance and nothing else: there is no ink to trace.
      spaceAdvance: space && space.advance,
      spacePath: space && space.path,
    };
  });
  expect(g.has).toBe(true);
  /* Normalised to the em, so the outlines can be used at any size without
     re-tracing -- the difference between embedding a font once and embedding
     it per text block. */
  expect(g.advance).toBeGreaterThan(0.3);
  expect(g.advance).toBeLessThan(1.5);
  expect(g.commands).toBeGreaterThan(10);
  expect(g.spaceAdvance).toBeGreaterThan(0);
  expect(g.spacePath).toBeNull();
});

test("an embedded face draws from its outlines", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    text("HI", { font: "Georgia", embedFont: true, fontSize: 60 }),
  ]));

  const built = await page.evaluate(() =>
    window._flashyAI.embedFontFace("Georgia", { chars: "HI" }));
  expect(built.ok).toBe(true);
  expect(built.count).toBe(2);
  expect(built.traced).toBe(2);

  const drawn = await page.evaluate(() => {
    window._flashyAI.fullRefresh();
    const cv = window._flashyAI.renderFrameToCanvas(1, 300, 200);
    const d = cv.getContext("2d").getImageData(0, 0, 300, 200).data;
    let ink = 0;
    for (let i = 0; i < 300 * 200; i++) if (d[i * 4] < 100) ink++;
    return ink;
  });
  /* The outlines really draw: they are paths, so they scale, rotate and
     export like any other artwork -- and the viewer does not need the font. */
  expect(drawn).toBeGreaterThan(200);
});

test("a string the face cannot cover falls back rather than dropping glyphs", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const F = window.Flashy.Fonts;
    const face = { face: "Georgia", glyphs: { A: { advance: 0.7, path: [0, 0, 0] } } };
    return {
      covered: F.measureEmbedded(face, "A", 10),
      // "B" is not in the face, so the whole measurement declines.
      uncovered: F.measureEmbedded(face, "AB", 10),
    };
  });
  /* A missing glyph is far more visible than a substituted one, so the face
     either covers the string or stands aside for the system font. */
  expect(out.covered).toBeCloseTo(7, 3);
  expect(out.uncovered).toBeNull();
});

test("an embedded face is measured from its own advances", async ({ page }) => {
  await openEditor(page);
  const widths = await page.evaluate(() => {
    const F = window.Flashy;
    const face = { face: "X", glyphs: {
      a: { advance: 0.5, path: null }, b: { advance: 0.25, path: null } } };
    const tf = new F.TextField("ab", { font: "20px X", embedded: face });
    const ctx = document.createElement("canvas").getContext("2d");
    const plain = new F.TextField("ab", { font: "20px X" });
    ctx.font = "20px X";
    return { embedded: tf.measure(ctx, "ab"), system: plain.measure(ctx, "ab") };
  });
  /* It has to measure from the face: the system font may not even be
     installed, so asking the canvas would lay the line out for a fallback. */
  expect(widths.embedded).toBeCloseTo(15, 3);
  expect(widths.embedded).not.toBeCloseTo(widths.system, 1);
});

test("only the faces a field asks for are exported", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    text("A", { font: "Georgia", embedFont: true }),
    text("B", { font: "Arial", y: 100 }),           // not embedded
  ]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.embedFontFace("Georgia", { chars: "A" });
    F.embedFontFace("Arial", { chars: "B" });
  });

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    return { inDoc: Object.keys(F.docFonts()).sort(),
             inExport: Object.keys(F.exportDocData().fonts || {}) };
  });
  // Both are in the document...
  expect(out.inDoc).toEqual(["Arial", "Georgia"]);
  /* ...but only the one a field actually uses ships. An embedded face is
     usually the heaviest thing in a small movie. */
  expect(out.inExport).toEqual(["Georgia"]);
});

test("a device font deliberately embeds nothing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    text("A", { font: "Georgia", embedFont: true, antiAlias: "device" }),
  ]));
  await page.evaluate(() => window._flashyAI.embedFontFace("Georgia", { chars: "A" }));

  const fonts = await page.evaluate(() =>
    Object.keys(window._flashyAI.exportDocData().fonts || {}));
  // "Use device fonts" means use the player's own, so there is nothing to ship.
  expect(fonts).toEqual([]);
});

test("the embedded face survives a save and reopen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("A", { font: "Georgia", embedFont: true })]));
  const back = await page.evaluate(() => {
    const F = window._flashyAI;
    F.embedFontFace("Georgia", { chars: "A" });
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const fonts = F.docFonts();
    return { keys: Object.keys(fonts),
             glyphs: fonts.Georgia ? Object.keys(fonts.Georgia.glyphs) : [],
             embedFlag: F.currentLayers()[0].getKeyframeAt(1).objects[0].embedFont };
  });
  expect(back.keys).toEqual(["Georgia"]);
  expect(back.glyphs).toEqual(["A"]);
  expect(back.embedFlag).toBe(true);
});

test("embedding refuses an empty request and reports what it managed", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("A")]));
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    return { empty: F.embedFontFace("Georgia", { chars: "" }),
             spacesOnly: F.embedFontFace("Georgia", { chars: "   " }) };
  });
  expect(out.empty.ok).toBe(false);
  expect(out.empty.why).toContain("no characters");
  /* A space traces to nothing, so the count and the traced count differ --
     and saying so beats appearing to have embedded a glyph that is not there. */
  expect(out.spacesOnly.ok).toBe(true);
  expect(out.spacesOnly.traced).toBe(0);
});

test("a removed face stops being used", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("A", { font: "Georgia", embedFont: true })]));
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.embedFontFace("Georgia", { chars: "A" });
    const size = F.embeddedFaceSize("Georgia");
    const gone = F.removeEmbeddedFace("Georgia");
    const twice = F.removeEmbeddedFace("Georgia");
    return { size, gone, twice, left: Object.keys(F.docFonts()) };
  });
  expect(out.size).toBeGreaterThan(100);
  expect(out.gone).toBe(true);
  expect(out.twice).toBe(false);
  expect(out.left).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * Proofing
 * ------------------------------------------------------------------ */

test("the proofreader finds what is wrong in any language", async ({ page }) => {
  await openEditor(page);
  const kinds = (issues) => issues.map((i) => i.kind).sort();

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      misspelling: F.proofread("I recieve the ball."),
      doubled: F.proofread("the the ball"),
      quotes: F.proofread('he said "hello'),
      brackets: F.proofread("a (b c"),
      spacing: F.proofread("one  two"),
      mixed: F.proofread("it's “fine”"),
      clean: F.proofread("A perfectly ordinary caption."),
      // A sentence boundary is not a doubled word.
      notDoubled: F.proofread("Go. Go again."),
    };
  });

  expect(kinds(out.misspelling)).toEqual(["misspelling"]);
  expect(out.misspelling[0].suggestion).toBe("receive");
  expect(kinds(out.doubled)).toEqual(["doubled"]);
  expect(kinds(out.quotes)).toEqual(["quotes"]);
  expect(kinds(out.brackets)).toEqual(["brackets"]);
  expect(kinds(out.spacing)).toEqual(["spacing"]);
  expect(kinds(out.mixed)).toEqual(["mixedQuotes"]);
  /* An ordinary caption must come back clean. A spell check that flags every
     proper noun gets switched off within a minute, at which point it has made
     things worse -- which is why this is a proofreader and not a dictionary. */
  expect(out.clean).toEqual([]);
  expect(out.notDoubled).toEqual([]);
});

test("a fix is applied at the right place, keeping the capital", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("Recieve the recieve.")]));

  const fixed = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const issues = F.proofread(o.text);
    // The first one only: the same word can be deliberate elsewhere in the
    // same caption, so a global replace would be wrong.
    F.applyProofFix(o, issues[0]);
    return o.text;
  });
  expect(fixed).toBe("Receive the recieve.");
});

test("a doubled word and a double space are repaired", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("the the ball")]));
  const a = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.applyProofFix(o, F.proofread(o.text)[0]);
    return o.text;
  });
  expect(a).toBe("the ball");

  await loadDoc(page, docWith([text("one  two")]));
  const b = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.applyProofFix(o, F.proofread(o.text)[0]);
    return o.text;
  });
  expect(b).toBe("one two");
});

test("a word added to the dictionary stops being reported", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    const before = F.proofread("teh").length;
    F.addToDictionary("teh");
    const after = F.proofread("teh").length;
    // Put the dictionary back for the next test in this file.
    localStorage.removeItem("flashy_dictionary");
    return { before, after };
  });
  expect(out.before).toBe(1);
  expect(out.after).toBe(0);
});

test("the whole document is proofread, and every field is located", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    text("I recieve"),
    text("fine", { y: 80 }),
    text("one  two", { y: 140 }),
  ]));

  const found = await page.evaluate(() =>
    window._flashyAI.proofreadDocument().map((f) => ({
      text: f.text, where: !!f.where, kinds: f.issues.map((i) => i.kind) })));
  // Only the two with something wrong, each with a trail back to it.
  expect(found).toHaveLength(2);
  expect(found.every((f) => f.where)).toBe(true);
  expect(found[0].kinds).toEqual(["misspelling"]);
  expect(found[1].kinds).toEqual(["spacing"]);
});

test("the Check Spelling dialog lists and fixes", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("I recieve the ball")]));

  await page.evaluate(() => window._flashyEditor.doAction("spellCheck"));
  const row = page.locator("#fy-dialog .dbg-row", { hasText: "recieve" });
  await expect(row).toHaveCount(1);
  await row.locator("button", { hasText: "Fix" }).click();

  const after = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0].text);
  expect(after).toBe("I receive the ball");
  await expect(page.locator("#fy-dialog")).toContainText("Nothing to report");
});
