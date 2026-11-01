// Button authoring, templates, the ComboBox component, History replay and
// saved commands, Save a Copy, and the two publish switches.
//
// The through-line is that each of these needed something else to exist first.
// A button's four states were already interpreted by the runtime and invisible
// to the author. Replay needed each history step to record the COMMAND behind
// it rather than only a label, because a snapshot is a state and replaying a
// state against a different document means nothing. The ComboBox needed
// somewhere for its dropdown to be, which is a second frame.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction } from "./helpers.js";

const kf = (objects, over = {}) => ({
  index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
  objects, ...over,
});

const box = (color, over = {}) => ({
  type: "rect", x: 0, y: 0, width: 80, height: 30,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: color, fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

/** A document with one Button symbol placed on the stage. */
function buttonDoc() {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([
      { type: "symbol", symbolName: "Btn", instanceName: "b1",
        symbolBehavior: "button", x: 40, y: 40, width: 80, height: 30,
        rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 },
    ])] }],
    library: {
      Btn: {
        totalFrames: 4, behavior: "button",
        layers: [{ name: "Layer 1", visible: true, locked: false, keyframes: [
          // Up, Over, Down, Hit — four distinct colours, so a pixel says
          // which state is showing.
          kf([box("#2244CC")], { index: 1 }),
          kf([box("#44CC22")], { index: 2 }),
          kf([box("#CC2244")], { index: 3 }),
          kf([box("#FFFF00")], { index: 4 }),
        ] }],
      },
    },
  };
}

const px = (page, x, y) =>
  page.evaluate(({ x, y }) => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 300, 200);
    const d = cv.getContext("2d").getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2]];
  }, { x, y });

/* ------------------------------------------------------------------ *
 * Button authoring
 * ------------------------------------------------------------------ */

test("the four states are named, and only the first four", async ({ page }) => {
  await openEditor(page);
  const names = await page.evaluate(() => {
    const F = window._flashyAI;
    return [1, 2, 3, 4, 5].map((f) => F.buttonStateName(f));
  });
  expect(names).toEqual(["Up", "Over", "Down", "Hit", ""]);
});

test("the timeline knows it is inside a button", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, buttonDoc());

  // On the main timeline, no.
  expect(await page.evaluate(() => window._flashyAI.editingButton())).toBe(false);

  // enterSymbol is what a double-click on an instance does.
  const inside = await page.evaluate(() => {
    const F = window._flashyAI;
    F.enterSymbol("Btn");
    return F.editingButton();
  });
  /* Yes: this is the one place a button looks exactly like every other symbol
     and is not one, which is why the timeline has to say so. */
  expect(inside).toBe(true);

  const back = await page.evaluate(() => {
    const F = window._flashyAI;
    F.exitSymbol();
    return F.editingButton();
  });
  expect(back).toBe(false);
});

test("Enable Simple Buttons is off by default, so a button can still be edited", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, buttonDoc());

  expect(await page.evaluate(() => window._flashyAI.simpleButtons())).toBe(false);
  // Up: the blue frame.
  const up = await px(page, 80, 55);
  expect(up[2]).toBeGreaterThan(up[0]);

  // And nothing is a live button while the toggle is off.
  const found = await page.evaluate(() => !!window._flashyAI.buttonAt(80, 55));
  expect(found).toBe(false);
});

test("a live button shows Over and Down, and never the Hit frame", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, buttonDoc());
  await page.evaluate(() => window._flashyAI.setSimpleButtons(true));

  const inst = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.buttonAt(80, 55);
    return o ? { has: true, frame: F.buttonStateFrame(o) } : { has: false };
  });
  expect(inst.has).toBe(true);
  // Nothing hovered yet, so Up.
  expect(inst.frame).toBe(1);

  const frames = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.buttonAt(80, 55);
    const out = {};
    F.setButtonPointer(o, false);
    out.over = F.buttonStateFrame(o);
    F.setButtonPointer(o, true);
    out.down = F.buttonStateFrame(o);
    F.setButtonPointer(null, false);
    out.away = F.buttonStateFrame(o);
    return out;
  });
  /* 2 and 3. Frame 4 is the Hit area: it says where the button can be
     clicked, which is exactly why drawing it would be wrong. */
  expect(frames).toEqual({ over: 2, down: 3, away: 1 });
});

test("the hovered state reaches the authoring stage and not the export", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, buttonDoc());

  /* Counted on the real stage canvas rather than at a coordinate, so the test
     does not have to redo the zoom and pan maths. Each state is its own
     colour, so a count says which one is showing. */
  const counts = () =>
    page.evaluate(() => {
      const cv = document.getElementById("stageCanvas");
      const g = cv.getContext("2d", { willReadFrequently: true });
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      let up = 0, over = 0, down = 0, hit = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (b > 150 && r < 90 && gg < 110) up++;
        else if (gg > 150 && r < 110 && b < 90) over++;
        else if (r > 150 && gg < 90 && b < 110) down++;
        else if (r > 200 && gg > 200 && b < 90) hit++;
      }
      return { up, over, down, hit };
    });

  await page.evaluate(() => window._flashyAI.setSimpleButtons(true));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setButtonPointer(F.buttonAt(80, 55), false);
  });
  const hovered = await counts();
  expect(hovered.over).toBeGreaterThan(50);
  expect(hovered.up).toBe(0);

  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setButtonPointer(F.buttonAt(80, 55), true);
  });
  const pressed = await counts();
  expect(pressed.down).toBeGreaterThan(50);
  // The Hit frame is never drawn, in any state: it says where the button can
  // be clicked, which is exactly why drawing it would be wrong.
  expect(pressed.hit).toBe(0);

  /* And none of this reaches an export. A hover state is authoring chrome --
     a sprite sheet recorded mid-hover would be a bug. */
  const exported = await px(page, 80, 55);
  expect(exported[2]).toBeGreaterThan(exported[0]);

  await page.evaluate(() => window._flashyAI.setSimpleButtons(false));
  const back = await counts();
  expect(back.up).toBeGreaterThan(50);
});

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

test("every template is a real document the normal load path accepts", async ({ page }) => {
  await openEditor(page);
  const checked = await page.evaluate(() => {
    const all = window._flashyAI.docTemplates();
    return Object.keys(all).map((name) => {
      const t = all[name];
      return {
        name,
        hint: !!t.hint,
        w: t.doc.width, h: t.doc.height,
        layers: (t.doc.layers || []).length,
        frames: t.doc.totalFrames,
      };
    });
  });
  expect(checked.length).toBeGreaterThanOrEqual(3);
  checked.forEach((t) => {
    expect(t.hint).toBe(true);
    expect(t.w).toBeGreaterThan(0);
    expect(t.h).toBeGreaterThan(0);
    expect(t.layers).toBeGreaterThan(0);
  });
});

test("a template loads through the ordinary document path", async ({ page }) => {
  await openEditor(page);
  const loaded = await page.evaluate(() => {
    const F = window._flashyAI;
    const t = F.docTemplates()["Banner 468x60"];
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(t.doc)));
    return {
      w: F.doc.width, h: F.doc.height,
      layers: F.currentLayers().length,
      // The last frame holds a stop(), which is what makes a banner a banner.
      script: F.currentLayers()[1].getKeyframeAt(24).script,
    };
  });
  expect(loaded.w).toBe(468);
  expect(loaded.h).toBe(60);
  expect(loaded.layers).toBe(2);
  expect(loaded.script).toContain("stop()");
});

/* ------------------------------------------------------------------ *
 * The ComboBox
 * ------------------------------------------------------------------ */

test("the item list is parsed from what someone would actually type", async ({ page }) => {
  await openEditor(page);
  const items = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      typed: F.comboItems(" One, Two ,Three "),
      empty: F.comboItems(""),
      blank: F.comboItems(" , , "),
      capped: F.comboItems(Array.from({ length: 30 }, (_, i) => "i" + i).join(",")).length,
    };
  });
  expect(items.typed).toEqual(["One", "Two", "Three"]);
  // An empty list still produces rows: a combo box with none would look
  // broken rather than empty.
  expect(items.empty.length).toBe(3);
  expect(items.blank.length).toBe(3);
  expect(items.capped).toBe(12);
});

test("a combo box is two frames, with the open list on the second", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([])] }],
    library: {},
  });

  const made = await page.evaluate(() => {
    const F = window._flashyAI;
    const r = F.addComponent("combo", { items: "Red, Green, Blue",
                                        instanceName: "pick", width: 160, height: 22 });
    if (!r.ok) return { ok: false, reason: r.reason };
    const sym = F.doc.library[r.name];
    const layer = sym.layers[0];
    return {
      ok: true,
      frames: layer.keyframes.length,
      // Frame 1 is the closed box; frame 2 has the box plus one row per item.
      closed: layer.getKeyframeAt(1).objects.length,
      open: layer.getKeyframeAt(2).objects.length,
      script: r.instance.clipScript,
    };
  });
  expect(made.ok).toBe(true);
  expect(made.frames).toBe(2);
  /* The dropdown needed somewhere to BE, and a second frame is that
     somewhere -- which is how Flash's own components did it. */
  expect(made.open).toBeGreaterThan(made.closed);
  expect(made.script).toContain("gotoAndStop(open ? 2 : 1)");
  expect(made.script).toContain('"Red"');
});

/* ------------------------------------------------------------------ *
 * History replay and saved commands
 * ------------------------------------------------------------------ */

test("each history step records the command behind it, not just a label", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 5,
    layers: [{ name: "L", visible: true, locked: false,
               keyframes: [kf([box("#CC3344")], { duration: 5 })] }],
    library: {},
  });

  await page.evaluate(() => {
    window._flashyEditor.doAction("addLayer");
    window._flashyEditor.doAction("addLayer");
  });
  const steps = await page.evaluate(() => window._flashyAI.replayableSteps());
  expect(steps.length).toBeGreaterThanOrEqual(2);
  const last = steps[steps.length - 1];
  /* The ACTION, which is what makes Replay mean anything: a snapshot is a
     state, and replaying a state against a different document means nothing. */
  expect(last.action).toBe("addLayer");
  expect(last.label).toBeTruthy();
});

test("Replay runs the commands again against the document as it is now", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 5,
    layers: [{ name: "L", visible: true, locked: false,
               keyframes: [kf([box("#CC3344")], { duration: 5 })] }],
    library: {},
  });

  const before = await page.evaluate(() => {
    window._flashyEditor.doAction("addLayer");
    return window._flashyAI.currentLayers().length;
  });

  const after = await page.evaluate(() => {
    const F = window._flashyAI;
    const steps = F.replayableSteps().filter((s) => s.action === "addLayer");
    F.replayActions(steps.slice(-1).map((s) => s.action));
    return F.currentLayers().length;
  });
  expect(after).toBe(before + 1);
});

test("a step with no command behind it cannot be replayed, and says so", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([box("#CC3344")])] }],
    library: {},
  });

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    // A direct property edit, the way a slider drag commits: a state change
    // with no command behind it.
    F.pushUndo();
    F.currentLayers()[0].getKeyframeAt(1).objects[0].x = 99;
    F.fullRefresh();
    const steps = F.replayableSteps();
    const ran = F.replayActions(steps.map((s) => s.action));
    return { lastAction: steps[steps.length - 1].action, ran };
  });
  expect(out.lastAction).toBeNull();
  expect(out.ran).toBe(0);
});

test("a run of steps can be saved as a command and run again later", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([box("#CC3344")])] }],
    library: {},
  });

  const saved = await page.evaluate(() =>
    window._flashyAI.saveCommand("Two layers", ["addLayer", "addLayer"]));
  expect(saved).toMatchObject({ ok: true, steps: 2 });

  const grew = await page.evaluate(() => {
    const F = window._flashyAI;
    const before = F.currentLayers().length;
    const ran = F.runCommand("Two layers");
    return { ran, added: F.currentLayers().length - before };
  });
  expect(grew).toEqual({ ran: 2, added: 2 });

  await page.evaluate(() => window._flashyAI.deleteCommand("Two layers"));
});

test("a command refuses a blank name or a run with no commands in it", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      nameless: F.saveCommand("  ", ["addLayer"]),
      empty: F.saveCommand("Nothing", [null, null]),
    };
  });
  expect(out.nameless.ok).toBe(false);
  expect(out.nameless.why).toContain("name");
  expect(out.empty.ok).toBe(false);
  expect(out.empty.why).toContain("command");
});

test("a saved command outlives a reload, and only known actions survive", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    window._flashyAI.saveCommand("Real", ["addLayer"]);
    // A hand-edited store must not be able to run something unrecognisable.
    const raw = JSON.parse(localStorage.getItem("flashy_commands"));
    raw.Bogus = ["totallyNotAnAction"];
    localStorage.setItem("flashy_commands", JSON.stringify(raw));
  });

  await page.reload();
  await page.waitForFunction(() => !!window._flashyAI);
  const names = await page.evaluate(() => Object.keys(window._flashyAI.savedCommands()));
  expect(names).toContain("Real");
  expect(names).not.toContain("Bogus");

  await page.evaluate(() => window._flashyAI.deleteCommand("Real"));
});

/* ------------------------------------------------------------------ *
 * Publish switches, and Save a Copy
 * ------------------------------------------------------------------ */

test("omitting trace actions strips the statements and leaves the rest", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const strip = window._flashyAI.stripTraceCalls;
    return {
      plain: strip('trace("hello");'),
      indented: strip('  trace(x);'),
      noSemi: strip('trace(1)'),
      // Not a statement on its own: leave it alone rather than cut a line in
      // half.
      inline: strip('if (x) trace("y");'),
      assigned: strip('var t = trace;'),
      // Unbalanced, or a quote left open: refuse.
      broken: strip('trace("a(b");'),
      kept: strip('gotoAndStop(2);'),
    };
  });
  expect(out.plain).toContain("omitted");
  expect(out.indented).toContain("omitted");
  expect(out.noSemi).toContain("omitted");
  expect(out.inline).toContain("trace");
  expect(out.assigned).toContain("trace");
  expect(out.kept).toBe("gotoAndStop(2);");
  // "a(b" balances once the quotes are respected, so this one does go.
  expect(out.broken).toContain("omitted");
});

test("the publish switches reach the exported data, and the document keeps its traces", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false,
               keyframes: [kf([box("#CC3344")], { script: 'trace("tick");\nstop();' })] }],
    library: {},
  });

  const off = await page.evaluate(() => {
    const F = window._flashyAI;
    F.docPublish().omitTrace = false;
    F.docPublish().protect = false;
    const d = F.exportDocData();
    return { script: d.layers[0].keyframes[0].script, protect: !!d.protect };
  });
  expect(off.script).toContain("trace");
  expect(off.protect).toBe(false);

  const on = await page.evaluate(() => {
    const F = window._flashyAI;
    F.docPublish().omitTrace = true;
    F.docPublish().protect = true;
    const d = F.exportDocData();
    return {
      script: d.layers[0].keyframes[0].script,
      protect: !!d.protect,
      // The DOCUMENT is untouched: the strip runs on the exported copy.
      live: F.currentLayers()[0].getKeyframeAt(1).script,
    };
  });
  expect(on.script).not.toContain("trace(");
  expect(on.script).toContain("stop()");
  expect(on.protect).toBe(true);
  expect(on.live).toContain("trace(");
});

test("the publish switches survive a save and reopen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([])] }],
    library: {},
  });
  const back = await page.evaluate(() => {
    const F = window._flashyAI;
    F.docPublish().omitTrace = true;
    F.docPublish().protect = true;
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const p = F.docPublish();
    return { omitTrace: p.omitTrace, protect: p.protect };
  });
  expect(back).toEqual({ omitTrace: true, protect: true });
});

test("Save a Copy writes a file without claiming the document is saved", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [kf([box("#CC3344")])] }],
    library: {},
  });
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.pushUndo();
    F.currentLayers()[0].getKeyframeAt(1).objects[0].x = 50;
    F.fullRefresh();
  });
  expect(await page.evaluate(() => window._flashyEditor.isDirty())).toBe(true);

  const copy = await downloadFromAction(page, "saveCopy");
  expect(JSON.parse(copy).width).toBe(300);
  /* Still dirty: the point of Save a Copy is to put one aside and carry on in
     the original, so marking the document saved would be a lie. */
  expect(await page.evaluate(() => window._flashyEditor.isDirty())).toBe(true);
});
