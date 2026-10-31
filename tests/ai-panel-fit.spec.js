// The assistant panel has to be the size of the panel it is docked in.
//
// It was authored before the dockable workspace existed and kept `height:
// 200px`, which the dock could not override: its container was a row flex
// container, so the flex rule grew the panel sideways and left the height to
// the panel itself. Docked into a tall column, or moved to the bottom dock
// and dragged taller, the assistant stayed 200px with empty space under it.
import { test, expect } from "@playwright/test";
import { openEditor } from "./helpers.js";

/** The panel's own height against the height of the dock body holding it. */
async function fit(page) {
  return page.evaluate(() => {
    const panel = document.getElementById("aiPanel");
    const body = panel.closest(".panel-body");
    return {
      panel: Math.round(panel.getBoundingClientRect().height),
      body: Math.round(body.getBoundingClientRect().height),
      // The chat log is what the space is for; it must take the slack.
      chat: Math.round(document.getElementById("ai-chat").getBoundingClientRect().height),
    };
  });
}

test("the assistant fills its panel, at whatever size the dock is", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => window._flashyWorkspace.show("ai"));

  const docked = await fit(page);
  expect(docked.body).toBeGreaterThan(120);
  expect(docked.panel).toBe(docked.body);
  /* In a short dock the input row and the "add a key" notice take most of
     the room, so this is not a claim about how much the chat log gets — only
     that it gets the slack, and that the slack grows with the dock. */
  expect(docked.chat).toBeGreaterThan(0);

  /* And it follows the dock when that changes size, rather than being a
     200px island in it. The bottom dock is resizable, so grow it. */
  const sp = page.locator('.dock-splitter[data-resize="bottom"]');
  const box = await sp.boundingBox();
  await page.mouse.move(box.x + 200, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y - 160, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const grown = await fit(page);
  expect(grown.body).toBeGreaterThan(docked.body);
  expect(grown.panel).toBe(grown.body);
  expect(grown.chat).toBeGreaterThan(docked.chat);
});
