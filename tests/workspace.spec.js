// The dockable workspace.
//
// Panels used to be nailed in place: Properties/Color/Library in a fixed right
// column, Actions/AI in a fixed bottom bar — and the bottom bar's "Properties"
// tab rendered an empty box, because the real Properties panel only ever
// existed on the right. Now any panel docks anywhere, and the arrangement
// persists.
//
// The riskiest part is not the dragging — it is that a saved layout is
// untrusted input (older release, newer release, corrupted value) and must
// never leave the editor unusable. Several specs below are about exactly that.
import { test, expect } from "@playwright/test";
import { openEditor } from "./helpers.js";

const ws = (page, fn) => page.evaluate(fn);

/** Panel ids in each dock, in order, from the live layout. */
async function docks(page) {
  return page.evaluate(() => {
    const l = window._flashyWorkspace.layout();
    const map = {};
    for (const zone of Object.keys(l.zones)) {
      map[zone] = l.zones[zone].groups.map((g) => g.panels);
    }
    map.closed = l.closed;
    return map;
  });
}

test("every panel starts docked, and there is exactly one of each", async ({ page }) => {
  const errors = await openEditor(page);
  await page.waitForFunction(() => !!window._flashyWorkspace);

  const d = await docks(page);
  expect(d.right).toEqual([["props"], ["color"], ["library"]]);
  expect(d.bottom).toEqual([["actions", "ai"]]);
  expect(d.closed).toEqual([]);

  // Each panel's content element — the node editor-app.js writes into — must
  // be inside a dock body, not stranded in the parking store.
  const placed = await page.evaluate(() =>
    ["propsPanel", "colorPanel", "libPanel"].map(
      (id) => !!document.getElementById(id)?.closest(".dock-body"),
    ),
  );
  expect(placed).toEqual([true, true, true]);

  // Exactly one Properties panel in the whole document — the old duplicate
  // bottom tab rendered nothing and is gone.
  expect(await page.locator("#propsPanel").count()).toBe(1);
  expect(await page.locator('.dock-tab[data-panel="props"]').count()).toBe(1);

  // And it is actually populated.
  await expect(page.locator("#propsPanel")).toContainText("Layer");
  expect(errors).toEqual([]);
});

test("dragging a tab re-docks the panel and keeps its DOM state", async ({ page }) => {
  await openEditor(page);
  await page.waitForFunction(() => !!window._flashyWorkspace);

  // Tag the live AI panel node so we can tell "moved" from "rebuilt".
  await page.evaluate(() => {
    document.getElementById("aiPanel").dataset.probe = "same-node";
  });

  await page
    .locator('.dock-tab[data-panel="ai"]')
    .dragTo(page.locator("#dock-right .dock-tabs").first());

  const d = await docks(page);
  expect(d.right[0]).toEqual(["props", "ai"]);
  expect(d.bottom).toEqual([["actions"]]);

  const moved = await page.evaluate(() => ({
    inRightDock: !!document.getElementById("aiPanel").closest("#dock-right"),
    probe: document.getElementById("aiPanel").dataset.probe,
    // The panel was re-docked, so its tab should now be the active one.
    active: window._flashyWorkspace.layout().zones.right.groups[0].active,
  }));

  expect(moved.inRightDock).toBe(true);
  // The same node moved — state (an AI conversation, a half-typed script)
  // survives re-docking because the content is never rebuilt.
  expect(moved.probe).toBe("same-node");
  expect(moved.active).toBe("ai");
});

test("the arrangement survives a reload", async ({ page }) => {
  await openEditor(page);
  await page.waitForFunction(() => !!window._flashyWorkspace);

  await ws(page, () => {
    window._flashyWorkspace.dock("library", "bottom", { group: 0, index: 0 });
    window._flashyWorkspace.close("color");
  });
  const before = await docks(page);

  await page.reload();
  await page.waitForFunction(() => !!(window._flashyWorkspace && window._flashyEditor));

  expect(await docks(page)).toEqual(before);
  expect(await docks(page)).toMatchObject({ closed: ["color"] });
});

test("a corrupt or stale saved layout cannot brick the editor", async ({ page }) => {
  await openEditor(page);
  await page.waitForFunction(() => !!window._flashyWorkspace);

  // A layout from a different build: an unknown panel, a duplicate, a missing
  // panel, a nonsense size, and a malformed group.
  await page.evaluate(() => {
    localStorage.setItem(
      "flashy_workspace_v2",
      JSON.stringify({
        zones: {
          right: { groups: [{ panels: ["props", "props", "ghost-panel"], active: "ghost-panel" }, null, { panels: [] }] },
          bottom: { groups: "not-an-array" },
          atlantis: { groups: [{ panels: ["library"] }] },
        },
        sizes: { right: 99999, bottom: "wide", timeline: NaN },
        collapsed: { right: "yes" },
        closed: ["ai", "another-ghost"],
      }),
    );
  });

  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.reload();
  await page.waitForFunction(() => !!(window._flashyWorkspace && window._flashyEditor));

  const l = await page.evaluate(() => window._flashyWorkspace.layout());
  const all = [];
  for (const zone of Object.keys(l.zones)) {
    for (const g of l.zones[zone].groups) all.push(...g.panels);
  }
  all.push(...l.closed);

  // Every registered panel appears exactly once; ghosts and duplicates gone.
  expect(all.slice().sort()).toEqual(["actions", "ai", "color", "library", "props"]);
  expect(all).not.toContain("ghost-panel");
  expect(all).not.toContain("another-ghost");
  // The explicit close is honoured; the unknown zone is ignored.
  expect(l.closed).toEqual(["ai"]);
  expect(Object.keys(l.zones).sort()).toEqual(["bottom", "right"]);
  // Sizes clamped back into range rather than producing a 99999px dock.
  expect(l.sizes.right).toBeLessThanOrEqual(640);
  expect(typeof l.sizes.bottom).toBe("number");
  expect(Number.isFinite(l.sizes.timeline)).toBe(true);

  // And the editor is alive.
  await expect(page.locator("#propsPanel")).toContainText("Layer");
  expect(errors).toEqual([]);
});

test("panels can be closed and reopened, and closing them all is survivable", async ({ page }) => {
  const errors = await openEditor(page);
  await page.waitForFunction(() => !!window._flashyWorkspace);

  // Close via the tab's × …
  await page.locator('.dock-tab[data-panel="library"] .dock-tab-close').click();
  expect(await page.locator('.dock-tab[data-panel="library"]').count()).toBe(0);
  expect((await docks(page)).closed).toContain("library");

  // …reopen through the Window menu verb the menu item fires.
  await ws(page, () => window._flashyEditor.doAction("winLibrary"));
  await expect(page.locator('.dock-tab[data-panel="library"]')).toHaveCount(1);
  await expect(page.locator("#libPanel")).toBeVisible();

  // Close everything: the docks go empty but the stage still works.
  await ws(page, () => {
    for (const p of window._flashyWorkspace.panels()) window._flashyWorkspace.close(p.id);
  });
  expect(await page.locator(".dock-tab").count()).toBe(0);
  await expect(page.locator(".dock-empty-hint").first()).toBeVisible();

  // Drawing still works with no panels at all.
  await page.locator('button[title*="Rectangle"]').click();
  const box = await page.locator("#stageCanvas").boundingBox();
  await page.evaluate(({ box }) => {
    const canvas = document.getElementById("stageCanvas");
    const at = (type, dx, dy) =>
      canvas.dispatchEvent(new PointerEvent(type, {
        pointerId: 1, isPrimary: true, button: 0, buttons: 1,
        clientX: box.x + dx, clientY: box.y + dy, bubbles: true,
      }));
    at("pointerdown", 300, 300);
    at("pointermove", 360, 350);
    at("pointerup", 360, 350);
  }, { box });

  const drew = await page.evaluate(() => {
    const F = window._flashyAI;
    return F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).objects.length;
  });
  expect(drew).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("dragging a splitter resizes the dock, re-measures the stage, and persists", async ({ page }) => {
  await openEditor(page);
  await page.waitForFunction(() => !!window._flashyWorkspace);

  const canvasBefore = await page.evaluate(() => document.getElementById("stageCanvas").clientWidth);
  const sizeBefore = await page.evaluate(() => window._flashyWorkspace.layout().sizes.right);

  const sp = page.locator('.dock-splitter[data-resize="right"]');
  const box = await sp.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x - 100, box.y + 200, { steps: 8 });
  await page.mouse.up();

  const sizeAfter = await page.evaluate(() => window._flashyWorkspace.layout().sizes.right);
  expect(sizeAfter).toBeGreaterThan(sizeBefore + 50);

  // The stage canvas is sized from its container, so a wider dock must have
  // shrunk it. Without the re-measure, drawing coordinates stop matching the
  // cursor after any dock resize.
  const canvasAfter = await page.evaluate(() => document.getElementById("stageCanvas").clientWidth);
  expect(canvasAfter).toBeLessThan(canvasBefore);

  await page.reload();
  await page.waitForFunction(() => !!window._flashyWorkspace);
  expect(await page.evaluate(() => window._flashyWorkspace.layout().sizes.right)).toBe(sizeAfter);
});

test("workspace presets and reset", async ({ page }) => {
  await openEditor(page);
  await page.waitForFunction(() => !!window._flashyWorkspace);

  await ws(page, () => window._flashyEditor.doAction("wsCoding"));
  let d = await docks(page);
  // Coding puts the script panels on the right, with room.
  expect(d.right).toEqual([["actions", "ai"]]);
  expect(await page.evaluate(() => window._flashyWorkspace.layout().sizes.right)).toBe(420);

  await ws(page, () => window._flashyEditor.doAction("wsDrawing"));
  expect(await page.evaluate(() => window._flashyWorkspace.layout().collapsed.bottom)).toBe(true);

  await ws(page, () => window._flashyEditor.doAction("wsReset"));
  d = await docks(page);
  expect(d.right).toEqual([["props"], ["color"], ["library"]]);
  expect(d.bottom).toEqual([["actions", "ai"]]);
  expect(d.closed).toEqual([]);
});

test("the Actions panel keeps working wherever it is docked", async ({ page }) => {
  await openEditor(page);
  await page.waitForFunction(() => !!window._flashyWorkspace);

  // Move it to the right dock, then type a frame script into it there.
  await ws(page, () => window._flashyWorkspace.dock("actions", "right", { group: null }));
  const ta = page.locator("#frame-script");
  await expect(ta).toBeVisible();
  await ta.fill("stop();");
  await ta.blur();

  const stored = await page.evaluate(() => {
    const F = window._flashyAI;
    return F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame()).script;
  });
  expect(stored).toBe("stop();");
});
