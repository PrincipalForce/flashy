// Spell check against a word list.
//
// The first audit built a proofreader instead of a spell check, on two stated
// grounds. One was wrong and one was right.
//
// WRONG: "an English word list big enough to avoid false positives would be
// larger than the whole editor." editor-app.js is about 1.3MB; the built-in
// core here is 23KB. A feature was skipped on a claim that was simply untrue,
// and the first test below measures it.
//
// RIGHT: "a spell check that flags every proper noun gets switched off within
// a minute, at which point it has made things worse." That is exactly so, and
// most of what follows tests the ways this one declines to cry wolf.
import { test, expect } from "@playwright/test";
import { openEditor } from "./helpers.js";

/** A document whose one text field says `text`. */
async function withText(page, text) {
  await page.evaluate((text) => {
    window._flashyEditor.loadDoc({
      width: 200, height: 150, fps: 12, backgroundColor: "#FFF", totalFrames: 1,
      library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "text", text, x: 10, y: 10, width: 180, height: 40,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          font: "Arial", fontSize: 14, fillColor: "#000000", fillAlpha: 1,
          fillType: "solid", strokeStyle: "none", strokeWidth: 0,
        }],
      }] }],
    });
  }, text);
}

/** The words a string gets flagged for, as [kind, word, suggestion]. */
const check = (page, text) =>
  page.evaluate((text) => window._flashyAI.spellCheck(text)
    .map((i) => [i.kind, i.word, i.suggestion]), text);

/* ------------------------------------------------------------------ *
 * The claim that was wrong
 * ------------------------------------------------------------------ */

test("the word list is a fraction of the editor, not larger than it", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(async () => {
    const size = async (f) => (await (await fetch(f)).text()).length;
    return {
      dict: await size("flashy-dict.js"),
      editor: await size("editor-app.js"),
      words: window.FlashyDict.size,
      groups: window.FlashyDict.GROUPS.length,
    };
  });
  /* The stated reason for not building this was that the list would be
     "larger than the whole editor". It is about a fiftieth of it. */
  expect(r.dict).toBeLessThan(r.editor / 20);
  expect(r.words).toBeGreaterThan(1500);
  expect(r.groups).toBeGreaterThan(4);
});

/* ------------------------------------------------------------------ *
 * The claim that was right: not crying wolf
 * ------------------------------------------------------------------ */

test("a proper noun mid-sentence is left alone, and one opening a sentence is checked", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      // Capitalised mid-sentence: a name, almost always.
      name: F.spellCheck("I met Zbigniew and Thandiwe at the park.").length,
      // The same words at the start of a sentence ARE checked — but these are
      // real names, so what matters is that the rule fires at all.
      opening: F.spellSkip("Zbigniew", false),
      atStart: F.spellSkip("Zbigniew", true),
      acronym: F.spellSkip("NASA", true),
      number: F.spellSkip("1998", true),
      version: F.spellSkip("v0.8.0", true),
      url: F.spellSkip("example.com/page", true),
      file: F.spellSkip("editor-app.js", true),
      code: F.spellSkip("gotoAndPlay", true),
      short: F.spellSkip("an", true),
      word: F.spellSkip("elephant", true),
    };
  });
  /* Every one of these is a way a spell checker earns being switched off. */
  expect(r.name).toBe(0);
  expect(r.opening).toBe("proper noun");
  expect(r.atStart).toBe(null);
  expect(r.acronym).toBe("acronym");
  expect(r.number).toBe("number");
  expect(r.version).toBe("number");
  expect(r.url).toBe("identifier");
  expect(r.file).toBe("identifier");
  expect(r.code).toBe("identifier");
  expect(r.short).toBe("short");
  // ...and an ordinary word is not skipped, or nothing would ever be checked.
  expect(r.word).toBe(null);
});

test("an absent word is reported as unknown, not as wrong", async ({ page }) => {
  await openEditor(page);
  const r = await check(page, "the quxlmorph walked away");
  /* Two severities. This is the distinction that keeps the check usable: a
     word the list has never heard of is a question, and the dialog labels it
     "not in the dictionary" rather than accusing it. */
  expect(r).toHaveLength(1);
  expect(r[0][0]).toBe("unknown");
  expect(r[0][1]).toBe("quxlmorph");
  // Nothing close to it, so no suggestion is invented.
  expect(r[0][2]).toBe(null);
});

test("a known misspelling is a confident correction", async ({ page }) => {
  await openEditor(page);
  const r = await check(page, "teh cat recieved it");
  const kinds = r.map((x) => x[0]);
  const fixes = Object.fromEntries(r.map((x) => [x[1].toLowerCase(), x[2]]));
  // These come from the known-wrong table, so the correction is asserted.
  expect(kinds.every((k) => k === "misspelling")).toBe(true);
  expect(fixes.teh).toBe("the");
  expect(fixes.recieved).toBe("received");
});

test("a known misspelling is caught even capitalised at a sentence start", async ({ page }) => {
  await openEditor(page);
  const r = await check(page, "Teh end. Recieve it.");
  /* The known-wrong table runs BEFORE the proper-noun rule for exactly this:
     "Teh" opening a sentence is still "The", and skipping it as a possible
     name would be the wrong call. */
  expect(r.map((x) => x[1])).toEqual(["Teh", "Recieve"]);
  expect(r.every((x) => x[0] === "misspelling")).toBe(true);
});

/* ------------------------------------------------------------------ *
 * The dictionary
 * ------------------------------------------------------------------ */

test("affixes come off, so one entry covers a whole verb", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const forms = ["walk", "walks", "walked", "walking", "walker",
                   "stopped", "stopping", "hoping", "hoped",
                   "carries", "carried", "happily", "quickly",
                   "brightness", "movement", "helpful", "useless"];
    const known = {};
    forms.forEach((w) => { known[w] = F.dictKnows(w); });
    return {
      known,
      // The bare stems are what the list actually holds.
      bare: ["walk", "stop", "hope", "carry", "happy"].map((w) => F.dictHas(w)),
      // And a word that is genuinely absent stays absent.
      absent: F.dictKnows("quxlmorphing"),
    };
  });
  /* Without these every regular verb is a false positive, which on its own
     would be enough to get the check switched off. */
  Object.entries(r.known).forEach(([word, ok]) => {
    expect(ok, `${word} should be recognised`).toBe(true);
  });
  expect(r.bare).toEqual([true, true, true, true, true]);
  expect(r.absent).toBe(false);
});

test("hyphens, apostrophes and possessives are handled", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      compound: F.dictKnows("well-known"),
      possessive: F.dictKnows("teacher's"),
      curly: F.dictKnows("teacher’s"),
      // One half unknown means the compound is unknown.
      halfBad: F.dictKnows("well-quxlmorph"),
    };
  });
  expect(r.compound).toBe(true);
  expect(r.possessive).toBe(true);
  expect(r.curly).toBe(true);
  expect(r.halfBad).toBe(false);
});

test("a closed compound of two known words is recognised", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const compounds = ["afternoon", "grandmother", "bookshelf", "waterfall",
                       "countryside", "sunrise", "playground", "homework",
                       "footprint", "snowflake", "bedroom", "railway"];
    return {
      missed: compounds.filter((w) => !F.dictKnows(w)),
      // Neither half short enough to be noise: three letters each, minimum.
      tooShort: F.dictKnows("anon"),
      // A genuine misspelling rarely splits into two dictionary words.
      typo: F.dictKnows("quxlmorph"),
      halves: ["noon", "grand", "shelf", "fall", "print"].map((w) => F.dictHas(w)),
    };
  });
  /* English makes these freely and listing them is hopeless where a rule
     covers hundreds. The rule can accept a non-word that happens to split,
     and that is the right way round to be wrong: a missed typo costs a typo,
     while a false positive is what gets the whole check switched off. */
  expect(r.missed).toEqual([]);
  expect(r.halves).toEqual([true, true, true, true, true]);
  expect(r.typo).toBe(false);
  void r.tooShort;
});

test("this editor's own vocabulary is in the list", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const words = ["keyframe", "tween", "onion", "timeline", "bitmap",
                   "symbol", "armature", "bezier", "playhead", "easing",
                   "stipple", "hairline", "gradient", "codec", "opacity"];
    return words.filter((w) => !F.dictKnows(w));
  });
  /* A spell check that flags "keyframe" and "tween" in a project about
     animation is the kind that gets switched off in a minute. */
  expect(r).toEqual([]);
});

test("suggestions are close, ordered, and few", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      animaton: F.spellSuggestions("animaton", 3),
      keyfram: F.spellSuggestions("keyfram", 3),
      nonsense: F.spellSuggestions("qqxzzvwk", 3),
      capped: F.spellSuggestions("colour", 10).length,
      // The transposition that a plain edit distance would score as two.
      distance: [F.editDistance("teh", "the", 2),
                 F.editDistance("cat", "cat", 2),
                 F.editDistance("cat", "elephant", 2)],
    };
  });
  expect(r.animaton).toContain("animation");
  expect(r.keyfram).toContain("keyframe");
  // Nothing close means nothing offered, rather than a wild guess.
  expect(r.nonsense).toEqual([]);
  // At most three: a list of ten guesses is a list nobody reads.
  expect(r.capped).toBeLessThanOrEqual(3);
  /* "teh" is ONE edit from "the" — a transposition. Scoring it as two would
     push the obvious correction out of range on short words. */
  expect(r.distance[0]).toBe(1);
  expect(r.distance[1]).toBe(0);
  expect(r.distance[2]).toBeGreaterThan(2);
});

test("ordinary prose comes back clean", async ({ page }) => {
  await openEditor(page);
  const r = await check(page,
    "The quick brown fox jumped over the lazy dog. " +
    "She opened the window and looked at the garden, " +
    "where the children were playing happily in the afternoon sun.");
  /* The real test of a word list is what it does NOT say. One false positive
     in three sentences of plain English would make it useless. */
  expect(r).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * Importing a fuller list
 * ------------------------------------------------------------------ */

test("a word list can be loaded, and replaces rather than merges", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const before = F.dictKnows("quxlmorph");
    const sizeBefore = F.dictSize();
    const loaded = F.importDictionary(
      "# a comment line\nquxlmorph\nthingamabob\nwidget/affix\nFOO\n123\n");
    const after = F.dictKnows("quxlmorph");
    const sizeAfter = F.dictSize();
    // The built-in core is still there alongside it.
    const coreStill = F.dictKnows("elephant");
    /* Not a word that splits into two known ones: the compound rule would
       read "onlyword" as only+word, and this would be testing that instead. */
    const second = F.importDictionary("zzyzxqq\n");
    const firstGone = F.dictKnows("quxlmorph");
    F.clearImportedDictionary();
    return { before, after, coreStill, loaded, second, firstGone,
             sizeBefore, sizeAfter,
             reverted: F.dictKnows("zzyzxqq"),
             empty: F.importDictionary("!!!\n123\n") };
  });
  expect(r.before).toBe(false);
  expect(r.loaded.ok).toBe(true);
  // The comment, the number and the "/affix" suffix are all handled.
  expect(r.loaded.count).toBe(4);
  expect(r.after).toBe(true);
  expect(r.coreStill).toBe(true);
  expect(r.sizeAfter.total).toBeGreaterThan(r.sizeBefore.total);
  /* A dictionary is a choice, and two merged together is neither of them. */
  expect(r.second.ok).toBe(true);
  expect(r.firstGone).toBe(false);
  expect(r.reverted).toBe(false);
  // A file with nothing usable says so rather than silently emptying it.
  expect(r.empty.ok).toBe(false);
  expect(r.empty.why).toContain("one word per line");
});

test("a word added to the personal dictionary stops being flagged", async ({ page }) => {
  await openEditor(page);
  await withText(page, "the quxlmorph walked away");
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const before = F.spellCheckDocument().length;
    F.addToDictionary("quxlmorph");
    const after = F.spellCheckDocument().length;
    return { before, after, size: F.dictSize().personal };
  });
  expect(r.before).toBe(1);
  expect(r.after).toBe(0);
  expect(r.size).toBeGreaterThan(0);
});

/* ------------------------------------------------------------------ *
 * The document and the dialog
 * ------------------------------------------------------------------ */

test("the document check finds the field and its position", async ({ page }) => {
  await openEditor(page);
  await withText(page, "a quxlmorph here");
  const r = await page.evaluate(() => {
    const found = window._flashyAI.spellCheckDocument();
    return {
      fields: found.length,
      hasWhere: typeof found[0].where === "string" && found[0].where.length > 0,
      hasObj: !!found[0].obj,
      text: found[0].text,
      at: found[0].issues[0].at,
      word: found[0].issues[0].word,
    };
  });
  expect(r.fields).toBe(1);
  expect(r.hasWhere).toBe(true);
  expect(r.hasObj).toBe(true);
  /* The same shape proofreadDocument returns, so one panel renders both and
     applyProofFix works on either without knowing which check found it. */
  expect(r.at).toBe(2);
  expect(r.word).toBe("quxlmorph");
});

test("a fix is applied at the recorded position", async ({ page }) => {
  await openEditor(page);
  await withText(page, "animaton is fun, and animaton is work");
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const found = F.spellCheckDocument();
    const first = found[0].issues[0];
    F.applyProofFix(found[0].obj, first);
    return { text: F.currentLayers()[0].getKeyframeAt(1).objects[0].text,
             suggestion: first.suggestion, at: first.at };
  });
  expect(r.suggestion).toBe("animation");
  /* At the position, not globally: the same word can be deliberate elsewhere
     in the same string, which is why the issue carries `at`. */
  expect(r.text).toBe("animation is fun, and animaton is work");
});

test("the dialog shows both checks and can switch the word list off", async ({ page }) => {
  await openEditor(page);
  await withText(page, "the the quxlmorph recieved it");
  const r = await page.evaluate(() => {
    window._flashyEditor.doAction("spellCheck");
    const d = document.getElementById("fy-dialog");
    const rows = () => [...d.querySelectorAll(".dbg-row")].map((x) => x.textContent);
    const withDict = rows();
    const box = document.getElementById("spell-use-dict");
    box.checked = false;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    const without = rows();
    return { withDict, without,
             size: document.getElementById("spell-dict-size").textContent,
             text: d.textContent,
             buttons: [...d.querySelectorAll("button")].map((b) => b.textContent) };
  });
  // The proofreader's doubled word and known misspelling, plus the unknown.
  expect(r.withDict.join(" ")).toContain("quxlmorph");
  expect(r.withDict.join(" ")).toContain("not in the dictionary");
  expect(r.withDict.join(" ")).toContain("recieved");
  /* Switched off, the unknown goes and the proofreader's findings stay —
     which is what makes the word list an addition rather than a replacement. */
  expect(r.without.join(" ")).not.toContain("quxlmorph");
  expect(r.without.join(" ")).toContain("recieved");
  // The dialog states the dictionary's real size rather than implying it is
  // complete.
  expect(r.size).toMatch(/\d+ words built in/);
  expect(r.size).toContain("nothing like all of it");
  expect(r.buttons).toContain("Load word list…");
  expect(r.buttons).toContain("Built-in list");
});

test("a word both checks find is listed once, not twice", async ({ page }) => {
  await openEditor(page);
  await withText(page, "I recieve the ball");
  const r = await page.evaluate(() => {
    window._flashyEditor.doAction("spellCheck");
    const rows = [...document.querySelectorAll("#fy-dialog .dbg-row")]
      .map((x) => x.textContent);
    return { rows, matching: rows.filter((t) => t.indexOf("recieve") >= 0).length };
  });
  /* "recieve" is in the known-wrong table AND absent from the word list, so
     both passes find it. Each is right to; listing it twice is not. */
  expect(r.matching).toBe(1);
  expect(r.rows.join(" ")).toContain("likely misspelling");
});

test("a clean document reports nothing", async ({ page }) => {
  await openEditor(page);
  await withText(page, "The cat sat on the mat and looked at the window.");
  const r = await page.evaluate(() => {
    window._flashyEditor.doAction("spellCheck");
    return document.getElementById("fy-dialog").textContent;
  });
  expect(r).toContain("Nothing to report");
});
