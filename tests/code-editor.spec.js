// The Actions panel's code editor.
//
// It was a bare <textarea>: no line numbers, no highlighting, and nothing to
// say where a syntax error was. A frame script is code, and writing code in a
// box that cannot tell a string from a keyword is why people stop.
//
// The textarea still HOLDS the text — the caret, selection, undo, autoscroll
// and IME behaviour are the browser's own, which no re-implemented editor gets
// right — with a highlighted <pre> underneath and the textarea's own text
// transparent. Several specs below are about the two layers staying in step,
// because that is the one way this construction goes wrong.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc } from "./helpers.js";

function docWithScript(script) {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 5,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 5, tweenType: "none", easing: "linear",
        script, objects: [],
      }],
    }],
    library: {},
  };
}

/** Type into the editor the way a user does, and let it repaint. */
async function typeScript(page, text) {
  await page.evaluate((text) => {
    const ta = document.getElementById("frame-script");
    ta.value = text;
    ta.dispatchEvent(new Event("input"));
  }, text);
}

/* ------------------------------------------------------------------ *
 * Highlighting
 * ------------------------------------------------------------------ */

test("comments and strings win over what is inside them", async ({ page }) => {
  const errors = await openEditor(page);

  const html = await page.evaluate(() => {
    const H = window._flashyAI.highlightScript;
    return {
      // A `//` inside a string must not comment out the rest of the line…
      urlInString: H('var u = "http://x.com"; stop();'),
      // …and an apostrophe inside a comment must not open a string.
      apostrophe: H("// don't stop\nplay();"),
      keyword: H("var x = 1;"),
      api: H("gotoAndPlay(2);"),
      // Angle brackets and ampersands are escaped, or a script can inject
      // markup into the panel that renders it.
      markup: H('var a = 1 < 2 && "<b>x</b>";'),
    };
  });
  // The string is one token; `stop` after it is still highlighted as API.
  expect(html.urlInString).toContain('<span class="tok-str">"http://x.com"</span>');
  expect(html.urlInString).toContain('<span class="tok-api">stop</span>');
  // The whole comment is a comment, and `play` on the next line survives.
  expect(html.apostrophe).toContain("tok-com");
  expect(html.apostrophe).toContain('<span class="tok-api">play</span>');
  expect(html.keyword).toContain('<span class="tok-key">var</span>');
  expect(html.api).toContain('<span class="tok-api">gotoAndPlay</span>');
  expect(html.markup).toContain("&lt;b&gt;");
  expect(html.markup).not.toContain("<b>x</b>");
  expect(errors).toEqual([]);
});

test("a half-typed string or comment does not run away", async ({ page }) => {
  await openEditor(page);
  const html = await page.evaluate(() => {
    const H = window._flashyAI.highlightScript;
    return {
      // The normal state of a line being written.
      openString: H('trace("hello\nstop();'),
      openBlock: H("/* unfinished\nstop();"),
    };
  });
  // The unterminated string stops at the end of its line, so the next line is
  // highlighted normally rather than being swallowed.
  expect(html.openString).toContain('<span class="tok-api">stop</span>');
  // An unterminated block comment does swallow the rest — that is what it
  // means — but it must still terminate rather than hang.
  expect(html.openBlock).toContain("tok-com");
});

test("the highlight layer tracks what is typed", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWithScript(""));
  await page.evaluate(() => window._flashyAI.selectKeyframe(0, 1));
  await page.evaluate(() => window._flashyEditor.doAction("winActions"));

  await typeScript(page, 'stop();\ntrace("hi");');
  const hl = page.locator("#code-highlight");
  await expect(hl).toContainText("stop();");
  await expect(hl.locator(".tok-api").first()).toHaveText("stop");
  await expect(hl.locator(".tok-str").first()).toHaveText('"hi"');
});

/* ------------------------------------------------------------------ *
 * Line numbers and error marking
 * ------------------------------------------------------------------ */

test("the gutter numbers every line and follows edits", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWithScript(""));
  await page.evaluate(() => window._flashyAI.selectKeyframe(0, 1));

  await typeScript(page, "a\nb\nc");
  const gutter = page.locator("#code-gutter");
  await expect(gutter).toHaveText(/1\s*2\s*3/);

  await typeScript(page, "a");
  await expect(gutter).toHaveText("1");
});

test("a syntax error is reported with its line, and clears when fixed", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWithScript(""));
  await page.evaluate(() => window._flashyAI.selectKeyframe(0, 1));

  await typeScript(page, "stop();\nif (");
  const status = page.locator("#code-status");
  await expect(status).toHaveClass(/error/);
  await expect(status).toContainText("Line 2");
  // The broken line is marked in the gutter, which is where you look.
  await expect(page.locator("#code-gutter .err")).toHaveText("2");

  await typeScript(page, "stop();\nplay();");
  await expect(status).not.toHaveClass(/error/);
  await expect(status).toContainText("2 lines, no syntax errors");
  await expect(page.locator("#code-gutter .err")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the check uses the same compiler the player does", async ({ page }) => {
  await openEditor(page);
  const res = await page.evaluate(() => {
    const C = window._flashyAI.checkScript;
    return {
      // The frame-script API is in scope, so using it is not an error.
      api: C("stop(); trace(root); gotoAndPlay(2);", "js"),
      broken: C("var x = ;", "js"),
      empty: C("   ", "js"),
      // A reference to something that does not exist is a RUNTIME error, not
      // a syntax error — flagging it here would be wrong.
      runtime: C("thisDoesNotExist();", "js"),
    };
  });
  expect(res.api.ok).toBe(true);
  expect(res.broken.ok).toBe(false);
  expect(res.broken.message).toBeTruthy();
  expect(res.empty.ok).toBe(true);
  expect(res.runtime.ok).toBe(true);
});

test("ActionScript is not run through the JavaScript parser", async ({ page }) => {
  await openEditor(page);
  const res = await page.evaluate(() => {
    const C = window._flashyAI.checkScript;
    // `_root.gotoAndPlay(2)` is valid ActionScript. Reporting it as a syntax
    // error would be both wrong and alarming for an imported movie.
    return {
      as2: C("_root.gotoAndPlay(2);", "as2"),
      // Even something the JS parser would reject outright.
      as2Odd: C("on (release) { play(); }", "as2"),
    };
  });
  expect(res.as2.ok).toBe(true);
  expect(res.as2.skipped).toBe(true);
  expect(res.as2Odd.ok).toBe(true);
});

test("an object's handlers are treated as ActionScript, not JavaScript", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 5,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 5, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "rect", x: 10, y: 10, width: 40, height: 40,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#CC2222", fillAlpha: 1, fillType: "solid",
          strokeWidth: 0, strokeStyle: "none",
          clipScript: "on (release) { gotoAndPlay(2); }",
        }],
      }],
    }],
    library: {},
  });
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    F.fullRefresh();
  });
  // The panel switches to the object's handlers — and `on (release) {}` is not
  // JavaScript, so it must not be flagged.
  await expect(page.locator("#actions-target")).toContainText("onClipEvent");
  await expect(page.locator("#code-status")).not.toHaveClass(/error/);
  await expect(page.locator("#code-status")).toContainText("AS2 runtime");
});

/* ------------------------------------------------------------------ *
 * Editing behaviour
 * ------------------------------------------------------------------ */

test("the API chips insert at the caret and take effect at once", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWithScript(""));
  await page.evaluate(() => window._flashyAI.selectKeyframe(0, 1));

  await expect(page.locator("#code-hints .code-chip").first()).toBeVisible();
  await typeScript(page, "AB");
  // Caret between the two characters: a chip that always writes to the end is
  // no quicker than typing.
  await page.evaluate(() => {
    const ta = document.getElementById("frame-script");
    ta.selectionStart = ta.selectionEnd = 1;
  });
  /* An exact match: Playwright's hasText is case-insensitive and a substring,
     so "stop()" also matches the "gotoAndStop()" chip. */
  await page.locator("#code-hints .code-chip")
    .filter({ hasText: /^stop\(\)$/ }).click();

  const value = await page.evaluate(() => document.getElementById("frame-script").value);
  expect(value).toBe("Astop();B");
  // And it is on the keyframe already — a textarea's own `change` only fires
  // on blur, which would mean the chip appeared to do nothing.
  const onKf = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).script);
  expect(onKf).toBe("Astop();B");
  expect(errors).toEqual([]);
});

test("Tab indents instead of leaving the field", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWithScript(""));
  await page.evaluate(() => window._flashyAI.selectKeyframe(0, 1));

  const ta = page.locator("#frame-script");
  await ta.click();
  await page.keyboard.type("if (x) {");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.type("stop();");

  const value = await page.evaluate(() => document.getElementById("frame-script").value);
  expect(value).toBe("if (x) {\n  stop();");
  // Focus is still in the editor: losing your place mid-script is the most
  // irritating thing a plain textarea does.
  expect(await page.evaluate(() => document.activeElement.id)).toBe("frame-script");
});

test("the editor does not overwrite what is being typed", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWithScript("stop();"));
  await page.evaluate(() => window._flashyAI.selectKeyframe(0, 1));

  const ta = page.locator("#frame-script");
  await ta.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" // mid-thought");
  // A refresh while the field has focus must leave the text alone.
  await page.evaluate(() => window._flashyAI.fullRefresh());
  const value = await page.evaluate(() => document.getElementById("frame-script").value);
  expect(value).toContain("mid-thought");
});

test("the highlight layer scrolls with the textarea", async ({ page }) => {
  await openEditor(page);
  const many = Array.from({ length: 80 }, (_, i) => "line" + i + ";").join("\n");
  await loadDoc(page, docWithScript(many));
  await page.evaluate(() => window._flashyAI.selectKeyframe(0, 1));

  const synced = await page.evaluate(() => {
    const ta = document.getElementById("frame-script");
    ta.scrollTop = 200;
    ta.dispatchEvent(new Event("scroll"));
    const hl = document.getElementById("code-highlight");
    const gut = document.getElementById("code-gutter");
    return { ta: ta.scrollTop, hl: hl.scrollTop, gut: gut.scrollTop };
  });
  // If these drift, the highlighting sits over the wrong characters and the
  // line numbers point at the wrong lines — the one way this construction
  // goes wrong.
  expect(synced.hl).toBe(synced.ta);
  expect(synced.gut).toBe(synced.ta);
});

test("an empty script says nothing rather than reporting zero lines", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWithScript(""));
  await page.evaluate(() => window._flashyAI.selectKeyframe(0, 1));
  await expect(page.locator("#code-status")).toHaveText("");
});
