// Strings and localisation, Accessibility, and Shared Libraries.
//
// Three panels Flash had that Flashy did not, and all three are about a movie
// being readable by something other than the person who drew it: a translator,
// a screen reader, and another document.
//
// The Strings table and the accessibility settings belong to the DOCUMENT — a
// translation is part of the movie and so is what it says it is — unlike the
// filter presets and saved commands, which belong to the person.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction, runExportedHTML } from "./helpers.js";

const kf = (objects, over = {}) => ({
  index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
  objects, ...over,
});

const text = (t, over = {}) => ({
  type: "text", x: 20, y: 20, width: 200, height: 40,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  text: t, font: "Arial", fontSize: 20, textAlign: "left", lineHeight: 1.2,
  textType: "static",
  fillColor: "#000000", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

function docWith(objs, over = {}) {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf(objs)] }],
    library: {},
    ...over,
  };
}

/* ------------------------------------------------------------------ *
 * Strings
 * ------------------------------------------------------------------ */

test("a document starts with one language and an empty table", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("Hello")]));
  const st = await page.evaluate(() => window._flashyAI.docStrings());
  expect(st.languages).toEqual(["en"]);
  expect(st.active).toBe("en");
  expect(st.table).toEqual({});
});

test("Assign IDs names every field and seeds the first language", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    text("Play Game"), text("Options", { y: 80 }), text("Play Game", { y: 140 }),
  ]));

  const r = await page.evaluate(() => window._flashyAI.autoAssignStringIds());
  expect(r).toMatchObject({ ok: true, assigned: 3 });

  const ids = await page.evaluate(() =>
    window._flashyAI.stringFields().map((f) => f.id));
  // Derived from the text, and made unique: two fields reading "Play Game"
  // must not share a key.
  expect(ids).toContain("play_game");
  expect(ids).toContain("options");
  expect(new Set(ids).size).toBe(3);

  const table = await page.evaluate(() => window._flashyAI.docStrings().table);
  // Seeded with what is on the stage, so the panel opens showing the movie
  // rather than empty rows.
  expect(table.play_game.en).toBe("Play Game");

  // Nothing left to do the second time.
  const again = await page.evaluate(() => window._flashyAI.autoAssignStringIds());
  expect(again.ok).toBe(false);
  expect(again.why).toContain("already");
});

test("a second language translates the fields and switching back restores them", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("Play Game"), text("Options", { y: 80 })]));
  await page.evaluate(() => window._flashyAI.autoAssignStringIds());

  const added = await page.evaluate(() => window._flashyAI.addStringLanguage("fr"));
  expect(added).toMatchObject({ ok: true, lang: "fr" });

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setString("play_game", "fr", "Jouer");
    F.setString("options", "fr", "Réglages");
    F.setActiveLanguage("fr");
    const fr = F.currentLayers()[0].getKeyframeAt(1).objects.map((o) => o.text);
    F.setActiveLanguage("en");
    const en = F.currentLayers()[0].getKeyframeAt(1).objects.map((o) => o.text);
    return { fr, en };
  });
  expect(out.fr).toEqual(["Jouer", "Réglages"]);
  // Switching back is lossless: a document is never stuck in a language.
  expect(out.en).toEqual(["Play Game", "Options"]);
});

test("a missing translation falls back rather than going blank", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("Play Game")]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.autoAssignStringIds();
    F.addStringLanguage("de");
  });

  const shown = await page.evaluate(() => {
    const F = window._flashyAI;
    // No German translation given at all.
    F.setActiveLanguage("de");
    return F.currentLayers()[0].getKeyframeAt(1).objects[0].text;
  });
  /* A field that went blank would look like the field broke rather than like
     the translation is missing. */
  expect(shown).toBe("Play Game");
});

test("a field with no ID is left alone entirely", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    text("Translated", { stringId: "greeting" }),
    text("Untouched", { y: 80 }),
  ]));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.addStringLanguage("fr");
    F.setString("greeting", "fr", "Bonjour");
    F.setActiveLanguage("fr");
    return F.currentLayers()[0].getKeyframeAt(1).objects.map((o) => o.text);
  });
  // Which is what lets a language be added to an existing document without
  // changing anything until IDs are handed out.
  expect(out).toEqual(["Bonjour", "Untouched"]);
});

test("the last language cannot be removed, and removing one drops its column", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("Hi", { stringId: "hi" })]));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    const lastOne = F.removeStringLanguage("en");
    F.addStringLanguage("fr");
    F.setString("hi", "fr", "Salut");
    const removed = F.removeStringLanguage("fr");
    return { lastOne, removed, st: F.docStrings() };
  });
  expect(out.lastOne.ok).toBe(false);
  expect(out.lastOne.why).toContain("at least one");
  expect(out.removed.ok).toBe(true);
  expect(out.st.languages).toEqual(["en"]);
  expect(out.st.table.hi.fr).toBeUndefined();
});

test("the table round-trips through CSV, which is what a translator gets", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("Hello, world"), text('He said "hi"', { y: 80 })]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.autoAssignStringIds();
    F.addStringLanguage("fr");
  });

  const csv = await page.evaluate(() => window._flashyAI.stringsToCSV());
  // Commas and quotes in the text must survive, or the first real sentence
  // breaks the file.
  expect(csv.split("\n")[0]).toBe("id,en,fr");
  expect(csv).toContain('"Hello, world"');
  expect(csv).toContain('"He said ""hi"""');

  const back = await page.evaluate(() => {
    const F = window._flashyAI;
    const r = F.stringsFromCSV('id,en,es\nhello_world,Hello world,Hola mundo\n');
    return { r, table: F.docStrings().table, langs: F.docStrings().languages };
  });
  expect(back.r.ok).toBe(true);
  // A language the CSV brings is added rather than rejected.
  expect(back.langs).toContain("es");
  expect(back.table.hello_world.es).toBe("Hola mundo");
});

test("a CSV with no id column is refused with the reason", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("Hi")]));
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    return { noHeader: F.stringsFromCSV("name,en\nx,y\n"),
             empty: F.stringsFromCSV("") };
  });
  expect(out.noHeader.ok).toBe(false);
  expect(out.noHeader.why).toContain('"id"');
  expect(out.empty.ok).toBe(false);
});

test("the table survives a save and reopen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("Hi", { stringId: "hi" })]));
  const back = await page.evaluate(() => {
    const F = window._flashyAI;
    F.addStringLanguage("fr");
    F.setString("hi", "fr", "Salut");
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const st = F.docStrings();
    return { langs: st.languages, fr: st.table.hi.fr,
             id: F.currentLayers()[0].getKeyframeAt(1).objects[0].stringId };
  });
  expect(back.langs).toEqual(["en", "fr"]);
  expect(back.fr).toBe("Salut");
  expect(back.id).toBe("hi");
});

test("the exported movie carries the table and can switch language at runtime", async ({ context, page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("Play Game", { stringId: "play" })]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.addStringLanguage("fr");
    F.setString("play", "en", "Play Game");
    F.setString("play", "fr", "Jouer");
  });

  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() => !!window.__stage);

  const langs = await out.evaluate(() => {
    const st = window.__stage;
    return { has: !!st.strings, active: st.strings && st.strings.active,
             list: st.strings && st.strings.languages,
             switched: st.setLanguage("fr"),
             bogus: st.setLanguage("klingon") };
  });
  /* One exported file serving every language, rather than one build per
     locale, is the whole point of the table travelling. */
  expect(langs.has).toBe(true);
  expect(langs.list).toEqual(["en", "fr"]);
  expect(langs.switched).toBe(true);
  expect(langs.bogus).toBe(false);
  expect(errors).toEqual([]);
  await out.close();
});

/* ------------------------------------------------------------------ *
 * Accessibility
 * ------------------------------------------------------------------ */

test("the export labels the canvas and lists what is in it", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    text("Welcome"),
    { type: "symbol", symbolName: "Btn", instanceName: "startBtn",
      x: 20, y: 100, width: 80, height: 30,
      rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
      accessName: "Start", accessDescription: "Begins the animation" },
  ], { library: { Btn: { totalFrames: 1, behavior: "button", layers: [] } } }));

  await page.evaluate(() => {
    const a = window._flashyAI.docAccess();
    a.name = "A short cartoon";
    a.description = "Two shapes greet you.";
  });

  const html = await downloadFromAction(page, "export");
  /* A canvas is one opaque rectangle to a screen reader, so the alternative
     has to be real markup rather than an alt attribute: a cartoon is a
     sequence of named things and one string cannot carry that. */
  expect(html).toContain('role="img"');
  expect(html).toContain('aria-label="A short cartoon"');
  expect(html).toContain('aria-describedby="flashy-a11y-desc"');
  expect(html).toContain("Two shapes greet you.");
  expect(html).toContain("<li>Welcome</li>");
  expect(html).toContain("Start — Begins the animation");
});

test("turning accessibility off hides the canvas from assistive technology", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("Decoration")]));
  await page.evaluate(() => { window._flashyAI.docAccess().enabled = false; });

  const html = await downloadFromAction(page, "export");
  // Which is the right answer for pure decoration: announced decoration is
  // worse than ignored decoration.
  expect(html).toContain('aria-hidden="true"');
  expect(html).not.toContain('role="img"');
  expect(html).not.toContain("flashy-a11y");
});

test("an object marked inaccessible is left out of the list", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    text("Readable"),
    text("Just a texture", { y: 80, accessible: false }),
  ]));

  const items = await page.evaluate(() =>
    window._flashyAI.accessibleObjects().map((i) => i.name));
  expect(items).toContain("Readable");
  expect(items).not.toContain("Just a texture");
});

test("a text object needs no accessibility name, because it has text", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("Chapter One")]));
  const items = await page.evaluate(() => window._flashyAI.accessibleObjects());
  expect(items).toHaveLength(1);
  // The text IS the name: making the author type it twice would guarantee the
  // two drift apart.
  expect(items[0].name).toBe("Chapter One");
});

test("the accessibility settings survive a save and reopen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text("Hi", { accessName: "Greeting" })]));
  const back = await page.evaluate(() => {
    const a = window._flashyAI.docAccess();
    a.name = "Named"; a.description = "Described";
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const F = window._flashyAI;
    return { doc: F.docAccess(),
             obj: F.currentLayers()[0].getKeyframeAt(1).objects[0].accessName };
  });
  expect(back.doc).toMatchObject({ enabled: true, name: "Named",
                                   description: "Described" });
  expect(back.obj).toBe("Greeting");
});

/* ------------------------------------------------------------------ *
 * Shared libraries
 * ------------------------------------------------------------------ */

/** A second document to import symbols out of. */
function otherDoc() {
  return {
    width: 200, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([])] }],
    bitmaps: { logo: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" },
    library: {
      Logo: { totalFrames: 1, behavior: "graphic",
        layers: [{ name: "Layer 1", visible: true, locked: false,
          keyframes: [kf([{ type: "rect", x: 0, y: 0, width: 40, height: 40,
            rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
            fillColor: "#112233", fillAlpha: 1, fillType: "solid",
            strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0,
            strokeStyle: "none" }])] }] },
      Spinner: { totalFrames: 4, behavior: "movieclip",
        layers: [{ name: "Layer 1", visible: true, locked: false,
          keyframes: [kf([])] }] },
    },
  };
}

test("symbols are imported into this document, assets and all", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));

  const r = await page.evaluate((other) => {
    const out = window._flashyAI.importSharedLibrary(other, null, "kit.flashy");
    window._flashyAI.fullRefresh();
    return { out, names: Object.keys(window._flashyAI.doc.library),
             bitmaps: Object.keys(window._flashyAI.doc.bitmaps || {}) };
  }, otherDoc());

  expect(r.out.ok).toBe(true);
  expect(r.names.sort()).toEqual(["Logo", "Spinner"]);
  /* The symbol really is in this document, so every export path already
     handles it -- which is why author-time sharing is the one worth having. */
  expect(r.bitmaps).toContain("logo");
  expect(r.out.assets).toBe(1);
});

test("a name clash renames rather than overwriting", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([], {
    library: { Logo: { totalFrames: 1, behavior: "graphic",
      layers: [{ name: "Layer 1", visible: true, locked: false,
        keyframes: [kf([])] }] } },
  }));

  const r = await page.evaluate((other) => {
    const out = window._flashyAI.importSharedLibrary(other, ["Logo"], "kit.flashy");
    return { out, names: Object.keys(window._flashyAI.doc.library).sort() };
  }, otherDoc());

  // The local symbol might be the one the movie is built on, so it stays put.
  expect(r.out.renamed).toBe(1);
  expect(r.names).toEqual(["Logo", "Logo 2"]);
});

test("the link back is recorded, and Update refreshes the contents in place", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  await page.evaluate((other) =>
    window._flashyAI.importSharedLibrary(other, ["Logo"], "kit.flashy"),
    otherDoc());

  const linked = await page.evaluate(() => window._flashyAI.sharedSymbols());
  expect(linked).toHaveLength(1);
  expect(linked[0]).toMatchObject({ name: "Logo" });
  expect(linked[0].from).toMatchObject({ source: "kit.flashy", symbol: "Logo" });

  const updated = await page.evaluate((other) => {
    // A newer version of the same file, with the symbol changed.
    other.library.Logo.totalFrames = 7;
    const r = window._flashyAI.updateSharedSymbol("Logo", other);
    return { r, frames: window._flashyAI.doc.library.Logo.totalFrames,
             stillLinked: !!window._flashyAI.doc.library.Logo.sharedFrom };
  }, otherDoc());

  expect(updated.r.ok).toBe(true);
  expect(updated.frames).toBe(7);
  /* The CONTENTS are replaced and the entry kept: every instance on the stage
     points at this name, so swapping the entry would orphan them. */
  expect(updated.stillLinked).toBe(true);
});

test("sharing explains itself when there is nothing to share", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      noLibrary: F.importSharedLibrary({}, null, "x"),
      emptyLibrary: F.importSharedLibrary({ library: {} }, null, "x"),
      missing: F.importSharedLibrary({ library: { A: {} } }, ["NotThere"], "x"),
      notShared: F.updateSharedSymbol("Nope", { library: {} }),
    };
  });
  expect(out.noLibrary.ok).toBe(false);
  expect(out.noLibrary.why).toContain("no library");
  expect(out.emptyLibrary.ok).toBe(false);
  expect(out.missing.ok).toBe(false);
  expect(out.notShared.ok).toBe(false);
  expect(out.notShared.why).toContain("not shared");
});

test("the shared link survives a save and reopen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  await page.evaluate((other) =>
    window._flashyAI.importSharedLibrary(other, ["Logo"], "kit.flashy"),
    otherDoc());

  const back = await page.evaluate(() => {
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    return window._flashyAI.sharedSymbols();
  });
  expect(back).toHaveLength(1);
  expect(back[0].from.source).toBe("kit.flashy");
});
