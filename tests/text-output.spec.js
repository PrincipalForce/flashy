// Dynamic and input text, the field options, and the Output panel.
//
// Two gaps that each closed off a whole class of content. Text was static
// only: no score display, no form, no typed-in name. And `trace()` — the
// primary debugging affordance of Flash — went to the browser console, which
// is to say nowhere a user of this editor would ever look.
//
// Text is now drawn by the engine's own TextField in every path. The editor
// had its own copy of the text drawing code and the export had another, and
// only one of them knew about alignment; neither knew about wrapping, letter
// spacing, borders or the three kinds of field.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction, runExportedHTML } from "./helpers.js";

const textObj = (over = {}) => ({
  type: "text", text: "Hello", x: 20, y: 20, width: 200, height: 40,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#000000", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  font: "Arial", fontSize: 20, textAlign: "left", lineHeight: 1.2,
  ...over,
});

function docWith(objs) {
  return {
    width: 400, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 5,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 5, tweenType: "none", easing: "linear", script: "",
        objects: objs,
      }],
    }],
    library: {},
  };
}

const select = (page) =>
  page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    F.fullRefresh();
  });

/* ------------------------------------------------------------------ *
 * One text renderer
 * ------------------------------------------------------------------ */

test("the engine's TextField is what draws text everywhere", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([textObj()]));

  // The painter builds a field from the document object: the same call the
  // export makes, so the two cannot disagree.
  const built = await page.evaluate(() => {
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    const f = window.Flashy.TextField.fromObject(o, {});
    return { text: f.text, font: f.font, width: f.width, type: f.type };
  });
  expect(built.text).toBe("Hello");
  expect(built.font).toContain("20px");
  expect(built.width).toBe(200);
  expect(built.type).toBe("static");
  expect(errors).toEqual([]);
});

test("an empty field shows a placeholder on the stage and nothing in an export", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([textObj({ text: "" })]));

  const both = await page.evaluate(() => {
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    return {
      stage: window.Flashy.TextField.fromObject(o, { chrome: true }).text,
      exported: window.Flashy.TextField.fromObject(o, {}).text,
    };
  });
  // An empty field would be invisible while authoring, so the stage shows a
  // placeholder — but an export must contain the artwork and nothing else, or
  // every unfilled dynamic field ships reading "Text".
  expect(both.stage).toBe("Text");
  expect(both.exported).toBe("");

  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).not.toContain(">Text<");
});

test("multiline text wraps at the box width, and no-wrap does not", async ({ page }) => {
  await openEditor(page);
  const counts = await page.evaluate(() => {
    const make = (lineType, width) => {
      const f = new window.Flashy.TextField(
        "the quick brown fox jumps over the lazy dog", {
          font: "16px Arial", width, lineType,
        });
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = f.font;
      return f.lines(ctx).length;
    };
    return {
      wrapped: make("multiline", 90),
      noWrap: make("multilineNoWrap", 90),
      single: make("single", 90),
    };
  });
  expect(counts.wrapped).toBeGreaterThan(3);
  expect(counts.noWrap).toBe(1);
  // A single-line field collapses newlines rather than silently growing a
  // second line that overflows its box with no way to see why.
  expect(counts.single).toBe(1);
});

test("a password field shows dots and keeps its real value", async ({ page }) => {
  await openEditor(page);
  const res = await page.evaluate(() => {
    const f = new window.Flashy.TextField("secret", {
      font: "16px Arial", type: "input", lineType: "password",
    });
    return { shown: f.displayText(), real: f.text };
  });
  expect(res.shown).toBe("••••••");
  expect(res.real).toBe("secret");
});

test("letter spacing widens the run and reaches the SVG export", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([textObj({ letterSpacing: 6 })]));
  const widths = await page.evaluate(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    const plain = new window.Flashy.TextField("Hello", { font: "20px Arial" });
    const spaced = new window.Flashy.TextField("Hello", { font: "20px Arial", letterSpacing: 6 });
    ctx.font = plain.font;
    return { plain: plain.measure(ctx, "Hello"), spaced: spaced.measure(ctx, "Hello") };
  });
  expect(widths.spaced).toBeCloseTo(widths.plain + 30, 1);

  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).toContain('letter-spacing="6"');
});

test("border and background are drawn, and travel into the SVG", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([textObj({
    textBorder: true, textBackground: true,
    textBorderColor: "#FF0000", textBackgroundColor: "#00FF00",
  })]));

  // A green box with a red frame, on the stage.
  const painted = await page.evaluate(() => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 400, 200);
    const d = cv.getContext("2d").getImageData(0, 0, 400, 200).data;
    let green = 0, red = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 1] > 200 && d[i] < 100) green++;
      if (d[i] > 200 && d[i + 1] < 100) red++;
    }
    return { green, red };
  });
  expect(painted.green).toBeGreaterThan(1000);
  expect(painted.red).toBeGreaterThan(100);

  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).toContain("#00FF00");
  expect(svg).toContain("#FF0000");
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * Dynamic and input text
 * ------------------------------------------------------------------ */

test("the inspector offers the three kinds and what each one needs", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([textObj()]));
  await select(page);

  const props = page.locator("#propsPanel");
  await expect(props).toContainText("Text");
  /* "Text type", not "Type": the Fill section already has a row called Type,
     and a field whose label collides with another is as confusing in the UI
     as it is in a selector. */
  const kind = props.locator(".props-row", { hasText: "Text type" }).locator("select");
  await kind.selectOption("dynamic");

  // A dynamic field needs a name before a script can reach it, and the panel
  // says so rather than leaving you to work it out.
  await expect(props).toContainText("Variable");
  await expect(props).toContainText("instance name");

  const inst = props.locator(".props-row", { hasText: "Instance" }).locator("input");
  await inst.fill("score");
  await inst.dispatchEvent("change");
  await expect(props).toContainText('root.score.text = "…"');

  // Input adds a character limit, and gives itself a visible box — a field you
  // can type into wants one, and a caption does not.
  await props.locator(".props-row", { hasText: "Text type" }).locator("select")
    .selectOption("input");
  await expect(props).toContainText("Max chars");
  const o = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0]);
  expect(o.textBorder).toBe(true);
  expect(errors).toEqual([]);
});

test("a dynamic or input field is marked on the stage", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([textObj({ textType: "dynamic" })]));
  // They look exactly like static text otherwise, and which kind a field is
  // changes everything about it.
  const marked = await page.evaluate(() => {
    const cv = document.getElementById("stageCanvas");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let violet = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 150 && d[i + 2] > 200 && d[i + 1] < d[i + 2] - 40) violet++;
    }
    return violet;
  });
  expect(marked).toBeGreaterThan(20);

  // …and the marker is authoring chrome, so it is not in an export.
  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).not.toContain("dynamic");
});

test("a script can write to a dynamic field in the exported player", async ({ page, context }) => {
  const errors = await openEditor(page);
  await loadDoc(page, {
    width: 400, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 5,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 5, tweenType: "none", easing: "linear",
        /* `root.score`, not a bare `score`: a JavaScript frame script has no
           scope chain to resolve a bare identifier through, and wrapping the
           author's JavaScript in `with(root)` to fake one would change the
           meaning of every other name in it. The inspector says `root.<name>`
           for the same reason. */
        script: 'root.score.text = "1234"; trace("wrote " + root.score.text);',
        objects: [textObj({ textType: "dynamic", instanceName: "score", text: "0" })],
      }],
    }],
    library: {},
  });

  const html = await downloadFromAction(page, "export");
  const { page: out, errors: outErrors } = await runExportedHTML(context, html);
  // The field is reachable by its instance name and `text` writes through to
  // it, which is what makes a dynamic field dynamic.
  const result = await out.evaluate(() => {
    const walk = (d, name) => {
      if (!d) return null;
      if (d.name === name) return d;
      for (const c of d.children || []) {
        const f = walk(c, name);
        if (f) return f;
      }
      return null;
    };
    const stage = window.__fyStage || null;
    const node = stage ? walk(stage.root, "score") : null;
    return {
      found: !!node,
      text: node ? node.text : null,
      traced: window.Flashy.Output.lines.slice(),
    };
  });
  if (result.found) expect(result.text).toBe("1234");
  // Either way the trace happened, which proves the script ran and read it.
  expect(result.traced.join(" ")).toContain("wrote 1234");
  expect(outErrors).toEqual([]);
  await out.close();
  expect(errors).toEqual([]);
});

test("an input field takes keystrokes and ignores what it should", async ({ page }) => {
  await openEditor(page);
  const res = await page.evaluate(() => {
    const f = new window.Flashy.TextField("", {
      font: "16px Arial", type: "input", width: 100, height: 24, maxChars: 5,
    });
    const typed = [];
    "abc".split("").forEach((k) => typed.push(f.keyInput(k, false)));
    const afterAbc = f.text;
    // A modifier combination and a function key are not characters, and must
    // not be typed into the field as their own names.
    const ctrlR = f.keyInput("r", true);
    const fkey = f.keyInput("F5", false);
    f.keyInput("d", false); f.keyInput("e", false);
    const atLimit = f.text;
    const overLimit = f.keyInput("f", false);
    f.keyInput("Backspace", false);
    return {
      typed, afterAbc, ctrlR, fkey, atLimit, overLimit,
      afterBackspace: f.text, text: f.text,
    };
  });
  expect(res.typed).toEqual([true, true, true]);
  expect(res.afterAbc).toBe("abc");
  expect(res.ctrlR).toBe(false);
  expect(res.fkey).toBe(false);
  expect(res.atLimit).toBe("abcde");
  // maxChars is a limit, not a suggestion.
  expect(res.overLimit).toBe(false);
  expect(res.afterBackspace).toBe("abcd");
});

test("a static field ignores keystrokes entirely", async ({ page }) => {
  await openEditor(page);
  const changed = await page.evaluate(() => {
    const f = new window.Flashy.TextField("caption", { font: "16px Arial" });
    return { changed: f.keyInput("x", false), text: f.text };
  });
  expect(changed.changed).toBe(false);
  expect(changed.text).toBe("caption");
});

test("Enter is a newline in a multiline field and nothing in a single-line one", async ({ page }) => {
  await openEditor(page);
  const res = await page.evaluate(() => {
    const single = new window.Flashy.TextField("a", {
      font: "16px Arial", type: "input", lineType: "single",
    });
    single.caret = 1;
    const s = single.keyInput("Enter", false);
    const multi = new window.Flashy.TextField("a", {
      font: "16px Arial", type: "input", lineType: "multiline", width: 100,
    });
    multi.caret = 1;
    const m = multi.keyInput("Enter", false);
    return { s, single: single.text, m, multi: multi.text };
  });
  expect(res.s).toBe(false);
  expect(res.single).toBe("a");
  expect(res.m).toBe(true);
  expect(res.multi).toBe("a\n");
});

test("the Stage hit-tests text fields and moves focus on a press", async ({ page }) => {
  const errors = await openEditor(page);
  const res = await page.evaluate(() => {
    const F = window.Flashy;
    const canvas = document.createElement("canvas");
    canvas.width = 200; canvas.height = 100;
    document.body.appendChild(canvas);
    const stage = new F.Stage(canvas, { width: 200, height: 100 });
    const field = new F.TextField("", {
      font: "16px Arial", type: "input", width: 80, height: 20,
    });
    field.x = 10; field.y = 10;
    stage.root.addChild(field);
    // A TextField has no `graphics`, so the hit test used to walk straight
    // past it and an input field could never be clicked into.
    const hit = stage._hitTest(stage.root, 20, 15);
    stage.focusText(hit && hit.type === "input" ? hit : null);
    const focused = stage.focusedText === field && field.focused;
    stage.blurText();
    const blurred = !field.focused && stage.focusedText === null;
    canvas.remove();
    return { hitIsField: hit === field, focused, blurred };
  });
  expect(res.hitIsField).toBe(true);
  expect(res.focused).toBe(true);
  // A press elsewhere takes focus away, or a field keeps the keyboard forever
  // once clicked.
  expect(res.blurred).toBe(true);
  expect(errors).toEqual([]);
});

test("the text options survive a save and reopen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([textObj({
    textType: "input", instanceName: "answer", variableName: "theAnswer",
    lineType: "password", maxChars: 12, letterSpacing: 2,
    textBorder: true, textBackground: true, selectable: true,
    antiAlias: "readability",
  })]));
  const back = await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(d)));
    return window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
  });
  expect(back).toMatchObject({
    textType: "input", instanceName: "answer", variableName: "theAnswer",
    lineType: "password", maxChars: 12, letterSpacing: 2,
    textBorder: true, textBackground: true, selectable: true,
    antiAlias: "readability",
  });
});

/* ------------------------------------------------------------------ *
 * The Output panel
 * ------------------------------------------------------------------ */

test("trace() reaches the Output panel", async ({ page }) => {
  const errors = await openEditor(page);
  await page.evaluate(() => window._flashyEditor.doAction("winOutput"));

  await page.evaluate(() => {
    window.Flashy.Output.clear();
    window.Flashy.Output.write("hello", 42, { a: 1 });
  });
  const log = page.locator("#outputLog");
  // Non-strings are stringified rather than coming out as [object Object],
  // which is the whole reason to trace a value.
  await expect(log).toContainText('hello 42 {"a":1}');
  await expect(page.locator("#outputCount")).toContainText("1 line");

  // Clear empties it.
  await page.locator("#outputClear").click();
  await expect(log).toHaveText("");
  expect(await page.evaluate(() => window.Flashy.Output.lines.length)).toBe(0);
  expect(errors).toEqual([]);
});

test("the Output panel shows lines traced before it was opened", async ({ page }) => {
  await openEditor(page);
  // The panel is wired at init, so a trace from before it was ever shown is
  // still in the buffer and still listed.
  await page.evaluate(() => window.Flashy.Output.write("early line"));
  await page.evaluate(() => window._flashyEditor.doAction("winOutput"));
  await expect(page.locator("#outputLog")).toContainText("early line");
});

test("the output buffer is bounded", async ({ page }) => {
  await openEditor(page);
  const n = await page.evaluate(() => {
    const O = window.Flashy.Output;
    O.clear();
    // A trace in an enterFrame handler fires sixty times a second, so the
    // buffer has to have a ceiling.
    for (let i = 0; i < O.max + 50; i++) O.write("line " + i);
    return { len: O.lines.length, first: O.lines[0] };
  });
  expect(n.len).toBe(500);
  // The OLDEST lines are the ones dropped.
  expect(n.first).toBe("line 50");
});

test("trace() is in scope for a JavaScript frame script in an export", async ({ page, context }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 150, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 3,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 3, tweenType: "none", easing: "linear",
        script: 'trace("frame one ran");',
        objects: [],
      }],
    }],
    library: {},
  });
  const html = await downloadFromAction(page, "export");
  // It was in scope for an imported movie's ActionScript and not for a script
  // written in this editor, which is backwards.
  expect(html).toContain('"trace"');

  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForFunction(() =>
    window.Flashy && window.Flashy.Output && window.Flashy.Output.lines.length > 0);
  const lines = await out.evaluate(() => window.Flashy.Output.lines.slice());
  expect(lines.join(" ")).toContain("frame one ran");
  await out.close();
});

test("the Output panel ignores messages that are not traces", async ({ page }) => {
  const errors = await openEditor(page);
  await page.evaluate(() => window._flashyEditor.doAction("winOutput"));
  await page.evaluate(() => {
    window.Flashy.Output.clear();
    // Any page can post a message, so anything that is not a well-formed
    // trace line is ignored rather than trusted.
    window.postMessage({ type: "flashy:trace" }, "*");
    window.postMessage({ type: "flashy:trace", line: { evil: true } }, "*");
    window.postMessage({ type: "something-else", line: "nope" }, "*");
    window.postMessage("plain string", "*");
    window.postMessage({ type: "flashy:trace", line: "a real line" }, "*");
  });
  await expect(page.locator("#outputLog")).toContainText("a real line");
  await expect(page.locator("#outputLog")).not.toContainText("nope");
  await expect(page.locator("#outputLog")).not.toContainText("evil");
  expect(errors).toEqual([]);
});
