// The History panel, the Movie Explorer and Behaviors.
//
// Three things the document already contained and nothing exposed. A 50-deep
// undo stack existed and was completely invisible — no way to see what Ctrl+Z
// was about to undo. There was no structural view at all, so "where is every
// instance of this symbol" or "which frames have scripts" meant clicking
// through the timeline. And the only way to make anything interactive was to
// know the handler syntax and type it.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction, runExportedHTML } from "./helpers.js";

const rect = (over = {}) => ({
  type: "rect", x: 10, y: 10, width: 60, height: 40,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#CC2222", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

const act = (page, a) => page.evaluate((a) => window._flashyEditor.doAction(a), a);

function docWith(objs, kfOver = {}) {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 6,
    layers: [{
      name: "Art", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 6, tweenType: "none", easing: "linear", script: "",
        objects: objs, ...kfOver,
      }],
    }],
    library: {},
  };
}

/* ------------------------------------------------------------------ *
 * History
 * ------------------------------------------------------------------ */

test("undo steps are named after the command that made them", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([rect(), rect({ x: 120 })]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection(F.currentLayers()[0].getKeyframeAt(1).objects.slice());
  });

  await act(page, "group");
  await act(page, "flipH");
  await act(page, "bringForward");

  const steps = await page.evaluate(() => window._flashyAI.historySteps());
  // Named after the thing that caused them, which is the whole point: a list
  // of fifty entries all saying "Edit" is no more use than no list.
  expect(steps.undo).toEqual(["Group", "Flip Horizontal", "Bring Forward"]);
  expect(steps.redo).toEqual([]);
  expect(errors).toEqual([]);
});

test("a label moves with its step through undo and redo", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
  });
  await act(page, "flipH");
  await act(page, "rot90cw");

  await act(page, "undo");
  let steps = await page.evaluate(() => window._flashyAI.historySteps());
  // The undone step keeps its own name on the redo side — otherwise redoing a
  // change shows a different label from undoing it.
  expect(steps.undo).toEqual(["Flip Horizontal"]);
  expect(steps.redo).toEqual(["Rotate 90° CW"]);

  await act(page, "redo");
  steps = await page.evaluate(() => window._flashyAI.historySteps());
  expect(steps.undo).toEqual(["Flip Horizontal", "Rotate 90° CW"]);
  expect(steps.redo).toEqual([]);
});

test("the History panel lists the steps and stepping back works from it", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([rect()]));
  await page.evaluate(() => window._flashyEditor.doAction("winHistory"));
  await expect(page.locator("#historyPanel")).toContainText("Nothing to undo yet");

  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
  });
  await act(page, "flipH");
  await act(page, "flipV");
  await act(page, "rot90cw");

  const panel = page.locator("#historyPanel");
  await expect(panel.locator(".history-row")).toHaveCount(3);
  await expect(panel.locator(".history-here")).toHaveCount(1);

  // Clicking the FIRST step undoes everything after it, which is what a
  // history list is for — three Ctrl+Z presses and watching to see what
  // happened is the thing it replaces.
  await panel.locator(".history-row").first().click();
  const o = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0]);
  expect(o.rotation).toBe(0);
  expect(o.scaleY).toBe(1);
  expect(o.scaleX).toBe(-1);

  // The two undone steps are listed as undone, and can be stepped forward.
  await expect(panel.locator(".history-row.undone")).toHaveCount(2);
  await panel.locator(".history-row.undone").last().click();
  const back = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0]);
  expect(back.rotation).toBe(90);
  expect(errors).toEqual([]);
});

test("a tool commit is named after the tool, not after nothing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  await page.evaluate(() => window._flashyAI.setTool("oval"));

  const box = await page.locator("#stageCanvas").boundingBox();
  await page.evaluate(({ box }) => {
    const c = document.getElementById("stageCanvas");
    const ox = (c.clientWidth - 300) / 2, oy = (c.clientHeight - 200) / 2;
    const at = (t, x, y, b) => c.dispatchEvent(new PointerEvent(t, {
      pointerId: 1, isPrimary: true, button: 0, buttons: b,
      clientX: box.x + ox + x, clientY: box.y + oy + y, bubbles: true,
    }));
    at("pointerdown", 20, 20, 1);
    at("pointermove", 90, 80, 1);
    at("pointerup", 90, 80, 0);
  }, { box });

  const steps = await page.evaluate(() => window._flashyAI.historySteps());
  expect(steps.undo).toHaveLength(1);
  expect(steps.undo[0]).toContain("Oval");
});

/* ------------------------------------------------------------------ *
 * Movie Explorer
 * ------------------------------------------------------------------ */

function explorerDoc() {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 10,
    layers: [
      {
        name: "Captions", visible: true, locked: false,
        keyframes: [{
          index: 1, duration: 10, tweenType: "none", easing: "linear", script: "",
          objects: [{
            type: "text", text: "Hello world", x: 10, y: 10, width: 100, height: 30,
            rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, fillColor: "#000000",
            font: "Arial", fontSize: 16, textAlign: "left",
            textType: "dynamic", instanceName: "caption",
          }],
        }],
      },
      {
        name: "Actors", visible: true, locked: false,
        keyframes: [
          {
            index: 1, duration: 5, tweenType: "none", easing: "linear",
            script: "stop();", label: "intro",
            objects: [{
              type: "symbol", symbolName: "Star", instanceName: "star1",
              x: 100, y: 50, width: 40, height: 40,
              rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
            }],
          },
          {
            index: 6, duration: 5, tweenType: "none", easing: "linear", script: "",
            objects: [{
              type: "symbol", symbolName: "Star", x: 200, y: 50, width: 40, height: 40,
              rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
            }],
          },
        ],
      },
    ],
    library: {
      Star: { objects: [], layers: null, totalFrames: 1, behavior: "movieclip" },
      Unused: { objects: [], layers: null, totalFrames: 1, behavior: "graphic" },
    },
  };
}

test("the Movie Explorer lists the whole document", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, explorerDoc());
  await page.evaluate(() => window._flashyEditor.doAction("winExplorer"));

  const panel = page.locator("#explorerPanel");
  await expect(panel).toContainText("Scene 1");
  await expect(panel).toContainText("Captions");
  await expect(panel).toContainText("Actors");
  // Every instance of a symbol, which is the question the explorer exists for.
  const rows = await page.evaluate(() =>
    window._flashyAI.explorerItems().map((i) => i.kind + ":" + i.label));
  expect(rows.filter((r) => r.startsWith("instance:Star"))).toHaveLength(2);
  // Scripts, labels, text and the library all listed.
  expect(rows.some((r) => r.startsWith("script:"))).toBe(true);
  expect(rows.some((r) => r.indexOf("label “intro”") >= 0)).toBe(true);
  expect(rows.some((r) => r.indexOf("dynamic text") >= 0)).toBe(true);
  expect(rows.some((r) => r === "libSymbol:Unused")).toBe(true);
  expect(errors).toEqual([]);
});

test("the filters narrow what is listed", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, explorerDoc());
  await page.evaluate(() => window._flashyEditor.doAction("winExplorer"));

  const kinds = () =>
    page.evaluate(() => window._flashyAI.explorerItems().map((i) => i.kind));

  await page.evaluate(() =>
    window._flashyAI.explorerFilters({ text: false, symbols: false, bitmaps: false, sounds: false }));
  await page.evaluate(() => window._flashyAI.explorerSearch(""));
  let k = await kinds();
  // Scripts and labels only.
  expect(k).not.toContain("text");
  expect(k).not.toContain("instance");
  expect(k).toContain("script");

  await page.evaluate(() => window._flashyAI.explorerFilters({ scripts: false }));
  k = await kinds();
  expect(k).not.toContain("script");
  /* With every filter off there is nothing left to show, so the layers go
     too. In the DEFAULT view — nothing filtered, nothing searched — the
     explorer is a structural view and lists every layer including an empty
     one, because its being empty is part of the structure. */
  expect(k.filter((x) => x === "layer")).toHaveLength(0);
});

test("the search narrows whatever the filters left", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, explorerDoc());
  await page.evaluate(() => window._flashyEditor.doAction("winExplorer"));
  await page.evaluate(() => window._flashyAI.explorerFilters({
    text: true, scripts: true, symbols: true, bitmaps: true, sounds: true,
  }));

  await page.evaluate(() => window._flashyAI.explorerSearch("Hello"));
  const labels = await page.evaluate(() =>
    window._flashyAI.explorerItems().filter((i) => !i.always).map((i) => i.label));
  expect(labels.join(" ")).toContain("Hello world");
  expect(labels.join(" ")).not.toContain("Star");

  await page.evaluate(() => window._flashyAI.explorerSearch("nothing-matches-this"));
  await expect(page.locator("#explorerPanel")).toContainText("Nothing matches");
  await page.evaluate(() => window._flashyAI.explorerSearch(""));
});

test("clicking a row goes to what it points at", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, explorerDoc());
  await page.evaluate(() => window._flashyEditor.doAction("winExplorer"));
  await page.evaluate(() => window._flashyAI.explorerSearch(""));

  // The second Star instance is on layer 1 at frame 6.
  await page.locator("#explorerPanel .explorer-row", { hasText: "Star  @ frame 6" })
    .first().click();
  const at = await page.evaluate(() => ({
    layer: window._flashyAI.curLayer(),
    frame: window._flashyAI.curFrame(),
    selected: window._flashyAI.selection().length,
  }));
  expect(at.layer).toBe(1);
  expect(at.frame).toBe(6);
  // …and it selects the object, so the inspector is already showing it.
  expect(at.selected).toBe(1);
  expect(errors).toEqual([]);
});

test("the Movie Explorer reaches every scene, not just the open one", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, explorerDoc());
  await page.evaluate(() => {
    window._flashyAI.addScene({});
    window._flashyAI.currentLayers()[0].name = "Second scene layer";
    window._flashyAI.gotoScene(0);
  });
  const labels = await page.evaluate(() =>
    window._flashyAI.explorerItems().map((i) => i.label));
  expect(labels).toContain("Scene 2");
  expect(labels).toContain("Second scene layer");
});

/* ------------------------------------------------------------------ *
 * Behaviors
 * ------------------------------------------------------------------ */

test("a behaviour writes a handler that the exported player runs", async ({ page, context }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([rect({ instanceName: "btn" })]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    F.fullRefresh();
  });

  const res = await page.evaluate(() =>
    window._flashyAI.addBehavior("trace", "release", { message: "clicked it" }));
  expect(res.ok).toBe(true);
  // Flash's own handler form, which flashy-as2.js already runs.
  expect(res.script).toContain("on (release)");
  expect(res.script).toContain('trace("clicked it")');

  const html = await downloadFromAction(page, "export");
  const { page: out, errors: outErrors } = await runExportedHTML(context, html);
  // The handler is attached in the player, so a click reaches it.
  const traced = await out.evaluate(() => {
    const cv = document.querySelector("canvas");
    const r = cv.getBoundingClientRect();
    const at = (t) => cv.dispatchEvent(new PointerEvent(t, {
      pointerId: 1, isPrimary: true, button: 0, buttons: t === "pointerup" ? 0 : 1,
      clientX: r.left + 40, clientY: r.top + 30, bubbles: true,
    }));
    at("pointerdown");
    at("pointerup");
    return window.Flashy.Output.lines.slice();
  });
  expect(traced.join(" ")).toContain("clicked it");
  expect(outErrors).toEqual([]);
  await out.close();
  expect(errors).toEqual([]);
});

test("behaviours stack rather than replacing each other", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
  });
  await page.evaluate(() => {
    window._flashyAI.addBehavior("play", "release", {});
    window._flashyAI.addBehavior("hide", "rollOver", {});
  });
  const handlers = await page.evaluate(() => {
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    return window._flashyAI.behaviorsOn(o).map((h) => h.event);
  });
  // An object usually ends up with two or three, and a panel that silently
  // overwrote the last one would be unusable.
  expect(handlers).toEqual(["release", "rollOver"]);
});

test("generated handlers are safe to generate from arbitrary input", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
  });

  const scripts = await page.evaluate(() => {
    const A = window._flashyAI;
    const out = {};
    // A quote in a message must not break out of the string it is in.
    out.quoted = A.addBehavior("trace", "release", { message: 'he said "hi"' }).script;
    const o = A.currentLayers()[0].getKeyframeAt(1).objects[0];
    o.clipScript = "";
    // A field name that is not an identifier must not be spliced in raw.
    out.badIdent = A.addBehavior("setText", "release",
      { field: "not an identifier!", value: "x" }).script;
    o.clipScript = "";
    // A movement that is not a number must not become an expression.
    out.badNum = A.addBehavior("nudge", "release", { dx: "1); evil(", dy: "2" }).script;
    return out;
  });
  expect(scripts.quoted).toContain('\\"hi\\"');
  expect(scripts.badIdent).toContain("_root.field.text");
  expect(scripts.badIdent).not.toContain("not an identifier!");
  expect(scripts.badNum).toContain("this._x += 0;");
  expect(scripts.badNum).not.toContain("evil(");
});

test("the Behaviors panel adds and removes handlers", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([rect()]));
  await page.evaluate(() => window._flashyEditor.doAction("winBehaviors"));

  const panel = page.locator("#behaviorsPanel");
  await expect(panel).toContainText("Select an object");

  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
    F.fullRefresh();
  });
  await expect(panel).toContainText("Add a behaviour");
  await expect(panel).toContainText("No handlers yet");

  await panel.locator("button", { hasText: "Add behaviour" }).click();
  await expect(panel.locator(".behavior-row")).toHaveCount(1);
  await expect(panel.locator(".behavior-event")).toHaveText("release");

  // Removing is by TEXT, not by index: the script may have been hand-edited
  // since the panel listed it, and an index would remove the wrong one.
  await panel.locator(".behavior-row .scene-btn").click();
  await expect(panel.locator(".behavior-row")).toHaveCount(0);
  const script = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0].clipScript);
  expect(script).toBe("");
  expect(errors).toEqual([]);
});

test("a frame-event behaviour uses onClipEvent, not on", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
  });
  const res = await page.evaluate(() =>
    window._flashyAI.addBehavior("show", "load", {}));
  // `load` and `enterFrame` are clip events; `release` and `rollOver` are
  // mouse events. Flash used two different wrappers and so does this.
  expect(res.script).toContain("onClipEvent (load)");
  expect(res.script).not.toContain("on (load)");
});
