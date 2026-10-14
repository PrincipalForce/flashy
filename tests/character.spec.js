// Character rigging.
//
// A rig is a flat list of parts in one keyframe, each carrying its parent and
// its pivot. Transforms compose as translate(pivot) · rotate · scale ·
// translate(-pivot) for every ancestor and then the part itself, all in one
// shared space.
//
// Two properties have to hold or the feature is worthless, and both are easy
// to get subtly wrong:
//
//   1. Parenting must not move anything. If attaching an arm to a torso
//      shifted the arm, building a rig would destroy the artwork.
//   2. The stage and the HTML export must agree exactly. A rig that poses
//      correctly in the editor and collapses on export is worse than no rig.
//
// So the geometry here is asserted against hand-computed numbers rather than
// against whatever the code currently returns, and the export is compared to
// the editor's own world-space answer.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction, runExportedHTML } from "./helpers.js";

/** A plain square symbol, so part geometry is easy to reason about. */
function squareSymbol(colour) {
  return {
    objects: [],
    totalFrames: 1,
    behavior: "graphic",
    layers: [{
      name: "Layer 1", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "rect", x: 0, y: 0, width: 40, height: 100,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: colour, fillAlpha: 1, fillType: "solid",
          strokeColor: colour, strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
        }],
      }],
    }],
  };
}

/**
 * A two-link arm: upper arm pivoting at its top, forearm parented to it and
 * pivoting at *its* top. The classic case — and the one where a wrong pivot
 * shows up immediately.
 */
function armDoc() {
  const part = (id, parent, x, y, z, colour) => ({
    type: "symbol", symbolName: colour === "#FF0000" ? "Upper" : "Fore",
    x, y, width: 40, height: 100,
    rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
    fillColor: colour, fillAlpha: 1, fillType: "solid",
    strokeColor: "#000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
    symbolBehavior: "graphic", loopMode: "single", firstFrame: 1,
    // buildObj copies instanceName onto the exported node, which is how the
    // parity test finds the same part in the runtime's display tree.
    instanceName: id,
    rigChar: "Hero", rigPart: id, rigParent: parent,
    // Joint at the top-centre of each limb.
    pivotX: 20, pivotY: 0, rigZ: z,
    name: id,
  });

  return {
    width: 400, height: 400, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 10,
    layers: [{
      name: "Layer 1", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 10, tweenType: "none", easing: "linear", script: "",
        objects: [
          part("upper", "", 100, 100, 0, "#FF0000"),
          // Forearm hangs off the bottom of the upper arm.
          part("fore", "upper", 100, 200, 1, "#00AA00"),
        ],
      }],
    }],
    library: { Upper: squareSymbol("#FF0000"), Fore: squareSymbol("#00AA00") },
    sounds: {},
    characters: { Hero: { name: "Hero", parts: [], poses: {} } },
  };
}

test("parenting a part does not move it", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, armDoc());

  // The forearm's own pivot sits at (120, 200) whatever the hierarchy says,
  // because nothing is rotated yet.
  const at = await page.evaluate(() => {
    const R = window._flashyRig;
    const fore = R.partById("Hero", "fore");
    return { pivot: R.pivotWorld(fore), topLeft: R.worldPoint(fore, fore.x, fore.y) };
  });
  expect(at.pivot.x).toBeCloseTo(120, 5);
  expect(at.pivot.y).toBeCloseTo(200, 5);
  expect(at.topLeft.x).toBeCloseTo(100, 5);
  expect(at.topLeft.y).toBeCloseTo(200, 5);
  expect(errors).toEqual([]);
});

test("rotating a parent swings the child about the parent's joint", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  // Turn the upper arm 90° about its own joint at (120, 100).
  const after = await page.evaluate(() => {
    const R = window._flashyRig;
    R.partById("Hero", "upper").rotation = 90;
    const fore = R.partById("Hero", "fore");
    return { forePivot: R.pivotWorld(fore), upperPivot: R.pivotWorld(R.partById("Hero", "upper")) };
  });

  // The parent's own joint cannot move — a part rotates *about* its pivot.
  expect(after.upperPivot.x).toBeCloseTo(120, 5);
  expect(after.upperPivot.y).toBeCloseTo(100, 5);

  // The forearm's joint was 100px below the shoulder; a +90° turn (canvas
  // y-down, so positive is clockwise) swings it to 100px to the LEFT.
  //   (120,200) about (120,100) by 90° → (120 - 100, 100) = (20, 100)
  expect(after.forePivot.x).toBeCloseTo(20, 5);
  expect(after.forePivot.y).toBeCloseTo(100, 5);
});

test("a child's own rotation compounds with its parent's", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  const tip = await page.evaluate(() => {
    const R = window._flashyRig;
    R.partById("Hero", "upper").rotation = 90;
    R.partById("Hero", "fore").rotation = -90;   // elbow bends back straight
    const fore = R.partById("Hero", "fore");
    // The far end of the forearm, in its own space.
    return R.worldPoint(fore, fore.x + 20, fore.y + 100);
  });

  // Upper +90 puts the elbow at (20,100) pointing left. The forearm then turns
  // -90 about the elbow, cancelling to point straight down again: its tip ends
  // 100px below the elbow.
  expect(tip.x).toBeCloseTo(20, 5);
  expect(tip.y).toBeCloseTo(200, 5);
});

test("a cycle in the hierarchy is refused rather than left undrawable", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, armDoc());

  const result = await page.evaluate(() => {
    const R = window._flashyRig;
    return {
      // Parenting the upper arm to its own child would make a loop.
      loop: R.reparent("Hero", "upper", "fore"),
      self: R.reparent("Hero", "upper", "upper"),
      ok: R.reparent("Hero", "fore", ""),
    };
  });

  expect(result.loop).toMatch(/loop/i);
  expect(result.self).toMatch(/own parent/i);
  expect(result.ok).toBeNull();

  // And the document still draws.
  await page.evaluate(() => window._flashyAI.fullRefresh());
  expect(errors).toEqual([]);
});

test("draw order is the rig's own, independent of the hierarchy", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  // A child is drawn after its parent by default …
  let order = await page.evaluate(() =>
    window._flashyRig.drawPlan().map((e) => e.obj.rigPart));
  expect(order).toEqual(["upper", "fore"]);

  // … but a far limb has to be able to sit behind the body it hangs off, which
  // nesting could never express.
  order = await page.evaluate(() => {
    const R = window._flashyRig;
    R.nudgeZ("Hero", "fore", -1);
    return R.drawPlan().map((e) => e.obj.rigPart);
  });
  expect(order).toEqual(["fore", "upper"]);
});

test("the stage and the HTML export agree on where a posed limb is", async ({ page, context }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  // Pose it into something with both rotations non-trivial, so an error in the
  // composition cannot cancel out.
  const expected = await page.evaluate(() => {
    const R = window._flashyRig;
    R.partById("Hero", "upper").rotation = 35;
    R.partById("Hero", "fore").rotation = 50;
    R.partById("Hero", "upper").scaleX = 1.2;
    window._flashyAI.fullRefresh();
    const fore = R.partById("Hero", "fore");
    // Mid-point of the forearm, which depends on every term in the chain.
    return R.worldPoint(fore, fore.x + 20, fore.y + 50);
  });

  // Where does the export put the same point? Walk the display tree the
  // runtime actually built and accumulate its transforms.
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  // The display list is built by the frame script on the first tick, so wait
  // for actual children rather than just the stage object.
  await out.waitForFunction(() => window.__stage && window.__stage.root.children.length > 0);
  const got = await out.evaluate(() => {
      const stage = window.__stage;
      if (!stage) return null;
      // The forearm's node, by instance name.
      let found = null;
      (function walk(node) {
        if (found) return;
        if (node.name === "fore") { found = node; return; }
        (node.children || []).forEach(walk);
      })(stage.root);
      if (!found) return null;

      // buildObj puts the node's origin at the part's centre (x + hw, y + hh),
      // so accumulating from (0,0) up to the root gives that centre in world
      // space — the same point the editor was asked for.
      let x = 0, y = 0, node = found;
      while (node) {
        const sx = node.scaleX != null ? node.scaleX : 1;
        const sy = node.scaleY != null ? node.scaleY : 1;
        x *= sx; y *= sy;
        const r = node.rotation || 0;
        if (r) {
          const c = Math.cos(r), s = Math.sin(r);
          const nx = x * c - y * s, ny = x * s + y * c;
          x = nx; y = ny;
        }
        x += node.x || 0;
        y += node.y || 0;
        node = node.parent;
      }
    return { x: x, y: y };
  });

  expect(errors).toEqual([]);
  expect(got).not.toBeNull();
  // Sub-pixel agreement: this is the same arithmetic done two different ways.
  expect(got.x).toBeCloseTo(expected.x, 3);
  expect(got.y).toBeCloseTo(expected.y, 3);
});

test("a pose stores transforms, re-applies them, and survives a save/open", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  const round = await page.evaluate(() => {
    const R = window._flashyRig, F = window._flashyAI;
    R.partById("Hero", "upper").rotation = 40;
    R.partById("Hero", "fore").rotation = 15;
    R.savePose("Hero", "reach");

    // Move away from the pose entirely.
    R.partById("Hero", "upper").rotation = 0;
    R.partById("Hero", "fore").rotation = 0;
    const away = R.partById("Hero", "upper").rotation;

    R.applyPose("Hero", "reach");
    const back = {
      upper: R.partById("Hero", "upper").rotation,
      fore: R.partById("Hero", "fore").rotation,
    };

    // Round-trip the document.
    const saved = JSON.parse(JSON.stringify(window._flashyEditor.serializeDoc()));
    window._flashyEditor.loadDoc(saved);
    const poses = Object.keys(R.characters().Hero.poses);
    return { away, back, poses, stored: R.characters().Hero.poses.reach };
  });

  expect(round.away).toBe(0);
  expect(round.back).toEqual({ upper: 40, fore: 15 });
  expect(round.poses).toContain("reach");
  // A pose is transforms only — never artwork.
  expect(Object.keys(round.stored.upper).sort())
    .toEqual(["rotation", "scaleX", "scaleY", "x", "y"]);
});

test("mirroring a pose swaps left and right and reverses the swing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  const mirrored = await page.evaluate(() => {
    const R = window._flashyRig;
    // Name the parts as a person would, which is what mirroring reads.
    R.partById("Hero", "upper").name = "Left Arm";
    R.partById("Hero", "fore").name = "Right Arm";
    R.partById("Hero", "upper").rotation = 30;
    R.partById("Hero", "fore").rotation = -10;
    R.savePose("Hero", "step");
    R.mirrorPose("Hero", "step", "step mirrored");
    return {
      partner: R.mirrorPartner("Hero", "upper"),
      src: R.characters().Hero.poses.step,
      out: R.characters().Hero.poses["step mirrored"],
    };
  });

  // Left Arm's partner is Right Arm …
  expect(mirrored.partner).toBe("fore");
  // … so the mirrored pose puts Left's angle on Right, negated.
  expect(mirrored.out.fore.rotation).toBeCloseTo(-30, 5);
  expect(mirrored.out.upper.rotation).toBeCloseTo(10, 5);
  // The original is untouched.
  expect(mirrored.src.upper.rotation).toBe(30);
});

test("Animate Poses writes tweened keyframes that move the character", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  const res = await page.evaluate(() => {
    const R = window._flashyRig, F = window._flashyAI;
    R.sync("Hero");                        // template from what is on stage

    R.partById("Hero", "upper").rotation = -30;
    R.savePose("Hero", "back");
    R.partById("Hero", "upper").rotation = 30;
    R.savePose("Hero", "forward");

    const out = R.animate({
      character: "Hero",
      steps: [{ pose: "back", frames: 4 }, { pose: "forward", frames: 4 }],
      startFrame: 1, loop: true, tween: true,
    });
    const layer = F.currentLayers()[out.layerIndex];
    return {
      out: out,
      kfs: layer.keyframes.map((k) => ({
        at: k.index, dur: k.duration, tween: k.tweenType,
        upper: (k.objects.find((o) => o.rigPart === "upper") || {}).rotation,
      })),
    };
  });

  // back(4) + forward(4) + return to back(1)
  expect(res.out.startFrame).toBe(1);
  expect(res.out.endFrame).toBe(9);
  expect(res.kfs.map((k) => k.at)).toEqual([1, 5, 9]);
  expect(res.kfs.map((k) => k.upper)).toEqual([-30, 30, -30]);
  // Tweened between poses, and the last one holds.
  expect(res.kfs[0].tween).toBe("motion");
  expect(res.kfs[1].tween).toBe("motion");
  expect(res.kfs[2].tween).toBe("none");
});

test("the Character panel shows the hierarchy and follows the selection", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  // The panel is registered and dockable like every other panel.
  await page.locator('.dock-tab[data-panel="character"]').click();
  const panel = page.locator("#charPanel");
  await expect(panel).toBeVisible();

  // Both parts listed, the child indented under its parent.
  const rows = panel.locator(".ch-part");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("upper");
  await expect(rows.nth(1)).toContainText("fore");
  const pads = await rows.evaluateAll((els) => els.map((e) => parseInt(e.style.paddingLeft, 10)));
  expect(pads[1]).toBeGreaterThan(pads[0]);

  // Clicking a row selects that part and switches to the Pose tool, because
  // the next thing you want to do is swing it.
  await rows.nth(1).locator(".ch-part-name").click();
  const state = await page.evaluate(() => ({
    sel: (window._flashyAI.selection()[0] || {}).rigPart,
    tool: document.querySelector(".tool-btn.active").dataset.tool,
  }));
  expect(state.sel).toBe("fore");
  expect(state.tool).toBe("pose");

  // The selected part's joint is reported, so a wrong pivot is visible.
  await expect(panel.locator(".ch-detail")).toContainText("Joint");
});

test("dragging a limb with the Pose tool rotates it about its joint, once", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  await page.evaluate(() => {
    window._flashyRig.setTool("pose");
    window._flashyAI.fullRefresh();
  });

  const box = await page.locator("#stageCanvas").boundingBox();
  // Stage origin on screen, so the drag can target the forearm's middle.
  const origin = await page.evaluate(() => {
    const c = document.getElementById("stageCanvas");
    const F = window._flashyAI;
    return { ox: (c.clientWidth - F.doc.width) / 2, oy: (c.clientHeight - F.doc.height) / 2 };
  });

  const at = (dx, dy) => ({ x: box.x + origin.ox + dx, y: box.y + origin.oy + dy });
  const from = at(120, 250);   // on the forearm
  const to = at(220, 250);     // swing it out to the side

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  const after = await page.evaluate(() => ({
    rot: window._flashyRig.partById("Hero", "fore").rotation,
    undos: window._flashyAI.undoDepth ? window._flashyAI.undoDepth() : null,
  }));

  // It turned, and the parent did not.
  expect(Math.abs(after.rot)).toBeGreaterThan(5);
  expect(await page.evaluate(() => window._flashyRig.partById("Hero", "upper").rotation)).toBe(0);

  // One drag is one undo step, and undo puts it back.
  await page.keyboard.press("Control+z");
  expect(await page.evaluate(() => window._flashyRig.partById("Hero", "fore").rotation)).toBe(0);
});

test("a character can be built from scratch through the menus", async ({ page }) => {
  const errors = await openEditor(page);
  // Two symbols to build from, as if the parts had been drawn and F8'd.
  await loadDoc(page, {
    width: 400, height: 400, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 10,
    layers: [{
      name: "Layer 1", visible: true, locked: false,
      keyframes: [{ index: 1, duration: 10, tweenType: "none", easing: "linear", script: "", objects: [] }],
    }],
    library: { Torso: squareSymbol("#884422"), Arm: squareSymbol("#CC8844") },
    sounds: {}, characters: {},
  });

  const d = page.locator("#fy-dialog");

  // Character ▸ New Character… is on the menu bar, not buried.
  const menu = await page.evaluate(() =>
    window._flashyEditor.menus.find((m) => m.label === "Character").items.map((i) => i.action));
  expect(menu).toContain("newCharacter");
  expect(menu).toContain("addCharacterPart");
  expect(menu).toContain("saveCharacterPose");
  expect(menu).toContain("animateCharacter");

  await page.evaluate(() => window._flashyEditor.doAction("newCharacter"));
  await expect(d).toBeVisible();
  await d.locator(".fy-dialog-input").fill("Hero");
  await d.getByRole("button", { name: "Create" }).click();

  // Creating a character leads straight into adding its first part — with
  // symbols in the library there is nothing else you'd want next.
  await expect(d).toContainText("Add Part");
  const selects = d.locator("select.fy-dialog-input, .fy-dialog-input");
  await d.locator("select").first().selectOption("Torso");
  await d.locator('input.fy-dialog-input').first().fill("Torso");
  await d.getByRole("button", { name: "Add" }).click();
  await expect(d).toHaveCount(0);

  // Add an arm, attached to the torso.
  await page.evaluate(() => window._flashyEditor.doAction("addCharacterPart"));
  await d.locator("select").first().selectOption("Arm");
  await d.locator('input.fy-dialog-input').first().fill("Left Arm");
  // "Attached to" defaults to the selected part, which is the torso we just made.
  const parentValue = await d.locator("select").nth(1).inputValue();
  expect(parentValue).toBe("torso");
  await d.getByRole("button", { name: "Add" }).click();
  await expect(d).toHaveCount(0);

  const built = await page.evaluate(() => {
    const R = window._flashyRig;
    const parts = R.partsOnStage("Hero");
    return {
      count: parts.length,
      names: parts.map((o) => o.name),
      parents: parts.map((o) => o.rigParent),
      // A part arrives at its symbol's drawn size, not an arbitrary square.
      sizes: parts.map((o) => o.width + "x" + o.height),
      // Joint at the top-centre, where a shoulder sits.
      pivots: parts.map((o) => o.pivotX + "," + o.pivotY),
      template: (R.characters().Hero.parts || []).length,
    };
  });

  expect(built.count).toBe(2);
  expect(built.names).toEqual(["Torso", "Left Arm"]);
  expect(built.parents).toEqual(["", "torso"]);
  expect(built.sizes).toEqual(["40x100", "40x100"]);
  expect(built.pivots).toEqual(["20,0", "20,0"]);
  // The template tracks the stage, so the character can be placed elsewhere.
  expect(built.template).toBe(2);

  // Pose it, save that, and animate — the whole point of the rig.
  await page.evaluate(() => {
    window._flashyRig.partById("Hero", "left-arm").rotation = 40;
  });
  await page.evaluate(() => window._flashyEditor.doAction("saveCharacterPose"));
  await d.locator(".fy-dialog-input").fill("reach");
  await d.getByRole("button", { name: "Save" }).click();
  await expect(d).toHaveCount(0);

  await page.evaluate(() => window._flashyEditor.doAction("animateCharacter"));
  await expect(d).toContainText("Animate Poses");
  await d.getByRole("button", { name: "Animate" }).click();
  await expect(d).toContainText("keyframes written");
  await d.getByRole("button", { name: "Done" }).click();

  const animated = await page.evaluate(() => {
    const F = window._flashyAI;
    const layer = F.currentLayers()[F.curLayer()];
    return layer.keyframes.length;
  });
  expect(animated).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});
