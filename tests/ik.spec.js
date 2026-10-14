// Inverse kinematics.
//
// Drag a hand, and the elbow and shoulder bend to follow. The solver writes
// nothing but `rotation` onto the parts it moves — that is the point, because
// it means poses, keyframes, tweens and the HTML export are untouched by IK
// and a keyframe made by dragging a hand is indistinguishable from one posed
// joint by joint.
//
// What has to hold:
//   * the grabbed point actually arrives at the target when it is in reach;
//   * when it is out of reach the limb straightens toward it and stops,
//     rather than flailing or producing NaN;
//   * joint limits and locked parts are obeyed, or an elbow bends backwards
//     and a planted foot slides;
//   * nothing but rotation changes.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc } from "./helpers.js";

function squareSymbol(colour) {
  return {
    objects: [], totalFrames: 1, behavior: "graphic",
    layers: [{
      name: "Layer 1", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{
          type: "rect", x: 0, y: 0, width: 20, height: 100,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: colour, fillAlpha: 1, fillType: "solid",
          strokeColor: colour, strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
        }],
      }],
    }],
  };
}

/**
 * A three-link arm hanging straight down from (200,100): upper arm, forearm,
 * hand. Each limb is 100 long with its joint at the top, so the reach is 300
 * and every expected position can be worked out by hand.
 */
function armDoc() {
  const part = (id, parent, y, z) => ({
    type: "symbol", symbolName: "Limb",
    x: 190, y: y, width: 20, height: 100,
    rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
    fillColor: "#AA4444", fillAlpha: 1, fillType: "solid",
    strokeColor: "#000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
    symbolBehavior: "graphic", loopMode: "single", firstFrame: 1,
    instanceName: id, name: id,
    rigChar: "Hero", rigPart: id, rigParent: parent,
    pivotX: 10, pivotY: 0, rigZ: z,
  });

  return {
    width: 600, height: 600, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 10,
    layers: [{
      name: "Layer 1", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 10, tweenType: "none", easing: "linear", script: "",
        objects: [
          part("upper", "", 100, 0),
          part("fore", "upper", 200, 1),
          part("hand", "fore", 300, 2),
        ],
      }],
    }],
    library: { Limb: squareSymbol("#AA4444") },
    sounds: {},
    characters: { Hero: { name: "Hero", parts: [], poses: {} } },
  };
}

/** Solve for the hand's tip reaching (tx,ty) and report where it ended up. */
async function reach(page, tx, ty, opts = {}) {
  return page.evaluate(({ tx, ty, opts }) => {
    const R = window._flashyRig;
    const hand = R.partById("Hero", "hand");
    // The grab point is the far end of the hand — its tip.
    const grab = { x: hand.x + 10, y: hand.y + 100 };
    const res = R.solve(hand, grab, tx, ty, opts);
    const tip = R.worldPoint(hand, grab.x, grab.y);
    return {
      res,
      tip,
      rotations: ["upper", "fore", "hand"].reduce((a, id) => {
        a[id] = R.partById("Hero", id).rotation;
        return a;
      }, {}),
    };
  }, { tx, ty, opts });
}

test("dragging the hand bends the whole chain to reach the target", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, armDoc());

  // IK is the Pose tool's default, because reaching for a position is the
  // common case and is the reason to rig at all. Asserted here so the default
  // cannot drift without a test saying so.
  expect(await page.evaluate(() => window._flashyRig.poseMode())).toBe("ik");
  expect(await page.evaluate(() => window._flashyRig.bones())).toBe(2);

  // Straight down from the shoulder at (200,100), the tip starts at (200,400).
  const start = await page.evaluate(() => {
    const R = window._flashyRig;
    const hand = R.partById("Hero", "hand");
    return R.worldPoint(hand, hand.x + 10, hand.y + 100);
  });
  expect(start.x).toBeCloseTo(200, 4);
  expect(start.y).toBeCloseTo(400, 4);

  // Ask for a point well inside the 300 reach, off to one side so every joint
  // has to contribute.
  const out = await reach(page, 350, 250, { bones: 3 });

  expect(out.res.bones).toBe(3);
  expect(out.res.error).toBeLessThan(1);
  expect(out.tip.x).toBeCloseTo(350, 0);
  expect(out.tip.y).toBeCloseTo(250, 0);
  // More than one joint moved — otherwise this is just FK.
  const moved = Object.values(out.rotations).filter((r) => Math.abs(r) > 0.5);
  expect(moved.length).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test("an out-of-reach target straightens the limb instead of misbehaving", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, armDoc());

  // 1000px away: nowhere near the 300 reach.
  const out = await reach(page, 1200, 100, { bones: 3 });

  // It cannot get there, and says so rather than pretending.
  expect(out.res.error).toBeGreaterThan(100);
  // Everything is still a real number …
  Object.values(out.rotations).forEach((r) => expect(Number.isFinite(r)).toBe(true));
  expect(Number.isFinite(out.tip.x)).toBe(true);
  // … and the arm points at the target: the tip should be roughly on the line
  // from the shoulder (200,100) towards it, i.e. straight out to the right.
  expect(out.tip.x).toBeGreaterThan(400);
  expect(Math.abs(out.tip.y - 100)).toBeLessThan(60);
  expect(errors).toEqual([]);
});

test("the chain length limits how far up the drag reaches", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  // Two bones: the hand and the forearm move, the shoulder must not.
  const out = await reach(page, 300, 300, { bones: 2 });
  expect(out.res.bones).toBe(2);
  expect(out.rotations.upper).toBe(0);
  expect(Math.abs(out.rotations.fore) + Math.abs(out.rotations.hand)).toBeGreaterThan(1);

  const chain = await page.evaluate(() =>
    window._flashyRig.chain(window._flashyRig.partById("Hero", "hand"), 2));
  expect(chain).toEqual(["hand", "fore"]);
});

test("a locked part is not moved, and the chain stops there", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  const out = await page.evaluate(() => {
    const R = window._flashyRig;
    // Plant the forearm, as an animator would to pin part of a pose.
    R.partById("Hero", "fore").rigLocked = true;
    const hand = R.partById("Hero", "hand");
    const grab = { x: hand.x + 10, y: hand.y + 100 };
    const res = R.solve(hand, grab, 320, 330, { bones: 3 });
    return {
      res,
      chain: R.chain(hand, 3),
      fore: R.partById("Hero", "fore").rotation,
      upper: R.partById("Hero", "upper").rotation,
      hand: R.partById("Hero", "hand").rotation,
    };
  });

  // Only the hand is free, so that is the whole chain …
  expect(out.chain).toEqual(["hand"]);
  expect(out.res.bones).toBe(1);
  // … and nothing past the lock moved, including the parts beyond it.
  expect(out.fore).toBe(0);
  expect(out.upper).toBe(0);
  expect(Math.abs(out.hand)).toBeGreaterThan(0);
});

test("joint limits are respected, so an elbow cannot bend backwards", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  const out = await page.evaluate(() => {
    const R = window._flashyRig;
    // An elbow that only bends one way, like a real one.
    const fore = R.partById("Hero", "fore");
    fore.rigMin = 0;
    fore.rigMax = 90;
    const hand = R.partById("Hero", "hand");
    const grab = { x: hand.x + 10, y: hand.y + 100 };
    // A target that the unconstrained solver would reach by folding the elbow
    // the wrong way.
    const res = R.solve(hand, grab, 60, 220, { bones: 3 });
    return {
      res,
      fore: R.partById("Hero", "fore").rotation,
      upper: R.partById("Hero", "upper").rotation,
    };
  });

  expect(out.fore).toBeGreaterThanOrEqual(0);
  expect(out.fore).toBeLessThanOrEqual(90);
  // The shoulder has no limits, so it is free to take up the slack.
  expect(Number.isFinite(out.upper)).toBe(true);
});

test("IK changes rotation and nothing else", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  const diff = await page.evaluate(() => {
    const R = window._flashyRig;
    const ids = ["upper", "fore", "hand"];
    const watch = ["x", "y", "width", "height", "scaleX", "scaleY", "pivotX", "pivotY",
      "alpha", "rigParent", "rigZ", "symbolName", "firstFrame"];
    const before = {};
    ids.forEach((id) => {
      const o = R.partById("Hero", id);
      before[id] = {};
      watch.forEach((k) => { before[id][k] = o[k]; });
    });

    const hand = R.partById("Hero", "hand");
    R.solve(hand, { x: hand.x + 10, y: hand.y + 100 }, 330, 280, { bones: 3 });

    const changed = [];
    ids.forEach((id) => {
      const o = R.partById("Hero", id);
      watch.forEach((k) => {
        if (o[k] !== before[id][k]) changed.push(id + "." + k);
      });
    });
    return changed;
  });

  // Anything in this list would mean IK had side effects the export, the
  // tweens or the pose library would have to know about.
  expect(diff).toEqual([]);
});

test("dragging on stage with the Pose tool runs IK and is one undo step", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  await page.evaluate(() => {
    const R = window._flashyRig;
    R.setTool("pose");
    R.setPoseMode("ik");
    R.setBones(3);
    window._flashyAI.fullRefresh();
  });

  const box = await page.locator("#stageCanvas").boundingBox();
  const origin = await page.evaluate(() => {
    const c = document.getElementById("stageCanvas");
    const F = window._flashyAI;
    return { ox: (c.clientWidth - F.doc.width) / 2, oy: (c.clientHeight - F.doc.height) / 2 };
  });
  const at = (x, y) => ({ x: box.x + origin.ox + x, y: box.y + origin.oy + y });

  // Grab near the hand's tip and pull it out to the side.
  const from = at(200, 390);
  const to = at(380, 260);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();

  const after = await page.evaluate(() => {
    const R = window._flashyRig;
    return {
      upper: R.partById("Hero", "upper").rotation,
      fore: R.partById("Hero", "fore").rotation,
      hand: R.partById("Hero", "hand").rotation,
    };
  });

  // The shoulder moved, which is the thing FK could never do from a hand drag.
  expect(Math.abs(after.upper)).toBeGreaterThan(1);

  // One drag is one undo, and it restores every joint in the chain — not just
  // the one under the cursor.
  await page.keyboard.press("Control+z");
  const undone = await page.evaluate(() => {
    const R = window._flashyRig;
    return ["upper", "fore", "hand"].map((id) => R.partById("Hero", id).rotation);
  });
  expect(undone).toEqual([0, 0, 0]);
});

test("single-part mode still swings just the joint you grab", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  await page.evaluate(() => {
    const R = window._flashyRig;
    R.setTool("pose");
    R.setPoseMode("single");
    window._flashyAI.fullRefresh();
  });
  expect(await page.evaluate(() => window._flashyRig.poseMode())).toBe("single");

  const box = await page.locator("#stageCanvas").boundingBox();
  const origin = await page.evaluate(() => {
    const c = document.getElementById("stageCanvas");
    const F = window._flashyAI;
    return { ox: (c.clientWidth - F.doc.width) / 2, oy: (c.clientHeight - F.doc.height) / 2 };
  });
  const at = (x, y) => ({ x: box.x + origin.ox + x, y: box.y + origin.oy + y });

  await page.mouse.move(at(200, 390).x, at(200, 390).y);
  await page.mouse.down();
  await page.mouse.move(at(330, 330).x, at(330, 330).y, { steps: 8 });
  await page.mouse.up();

  const after = await page.evaluate(() => {
    const R = window._flashyRig;
    return {
      upper: R.partById("Hero", "upper").rotation,
      fore: R.partById("Hero", "fore").rotation,
      hand: R.partById("Hero", "hand").rotation,
    };
  });

  // Only the grabbed part turned.
  expect(Math.abs(after.hand)).toBeGreaterThan(1);
  expect(after.fore).toBe(0);
  expect(after.upper).toBe(0);
});

test("the panel exposes the drag mode, chain length and planting", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, armDoc());

  await page.locator('.dock-tab[data-panel="character"]').click();
  const panel = page.locator("#charPanel");
  await expect(panel).toBeVisible();

  // Chain (IK) is the default, with its reach shown next to it.
  const mode = panel.locator("select").nth(1);   // 0 is the character picker
  await expect(mode).toHaveValue("ik");
  await expect(panel.locator(".ch-num")).toHaveValue(String(2));

  // Changing the reach reaches the tool.
  await panel.locator(".ch-num").fill("3");
  await panel.locator(".ch-num").dispatchEvent("change");
  expect(await page.evaluate(() => window._flashyRig.bones())).toBe(3);

  // Switching to single-part hides the reach, because it means nothing there.
  await mode.selectOption("single");
  expect(await page.evaluate(() => window._flashyRig.poseMode())).toBe("single");
  await expect(panel.locator(".ch-num")).toHaveCount(0);
  await mode.selectOption("ik");

  // The lock toggle on a row plants that part and the overlay agrees.
  const handRow = panel.locator(".ch-part").filter({ hasText: "hand" });
  await handRow.locator(".ch-mini").first().click();
  expect(await page.evaluate(() =>
    window._flashyRig.partById("Hero", "hand").rigLocked)).toBe(true);
  await expect(handRow.locator(".ch-locked")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("joint limits can be set and cleared from the Edit Part dialog", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  await page.evaluate(() => {
    const R = window._flashyRig;
    window._flashyAI.setSelection([R.partById("Hero", "fore")]);
  });
  await page.evaluate(() => window._flashyEditor.doAction("editCharacterPart"));

  const d = page.locator("#fy-dialog");
  await expect(d).toBeVisible();
  const inputs = d.locator("input.fy-dialog-input");
  // Name, Joint X, Joint Y, Rotation, Limit from, Limit to
  await inputs.nth(4).fill("0");
  await inputs.nth(5).fill("90");
  await d.getByRole("button", { name: "Apply" }).click();
  await expect(d).toHaveCount(0);

  expect(await page.evaluate(() => {
    const o = window._flashyRig.partById("Hero", "fore");
    return { min: o.rigMin, max: o.rigMax };
  })).toEqual({ min: 0, max: 90 });

  // A reversed range is refused rather than silently stored.
  await page.evaluate(() => window._flashyEditor.doAction("editCharacterPart"));
  await d.locator("input.fy-dialog-input").nth(4).fill("50");
  await d.locator("input.fy-dialog-input").nth(5).fill("10");
  await d.getByRole("button", { name: "Apply" }).click();
  await expect(d.locator(".fy-dialog-error")).toContainText("not be greater");

  // Blank means no limit — which is not the same as zero.
  await d.locator("input.fy-dialog-input").nth(4).fill("");
  await d.locator("input.fy-dialog-input").nth(5).fill("");
  await d.getByRole("button", { name: "Apply" }).click();
  await expect(d).toHaveCount(0);
  expect(await page.evaluate(() => {
    const o = window._flashyRig.partById("Hero", "fore");
    return { min: o.rigMin, max: o.rigMax };
  })).toEqual({ min: null, max: null });
});

test("limits and planting survive a save and reopen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, armDoc());

  const round = await page.evaluate(() => {
    const R = window._flashyRig;
    const fore = R.partById("Hero", "fore");
    fore.rigMin = -10;
    fore.rigMax = 120;
    R.partById("Hero", "upper").rigLocked = true;
    R.sync("Hero");

    const saved = JSON.parse(JSON.stringify(window._flashyEditor.serializeDoc()));
    window._flashyEditor.loadDoc(saved);
    const f = R.partById("Hero", "fore");
    const u = R.partById("Hero", "upper");
    return {
      min: f.rigMin, max: f.rigMax, locked: !!u.rigLocked,
      // The template carries them too, so placing the character again keeps
      // the rig's constraints rather than resetting them.
      template: (R.characters().Hero.parts || []).map((t) => ({
        id: t.rigPart, min: t.rigMin, locked: !!t.rigLocked,
      })),
    };
  });

  expect(round.min).toBe(-10);
  expect(round.max).toBe(120);
  expect(round.locked).toBe(true);
  expect(round.template.find((t) => t.id === "fore").min).toBe(-10);
  expect(round.template.find((t) => t.id === "upper").locked).toBe(true);
});
