// Regressions around library symbols surviving a trip through serialization.
//
// Both of these were silent data-loss bugs. deserializeDoc() used to assign
// doc.library straight off the parsed JSON, so a symbol's layers came back as
// plain objects with no Layer prototype while the scene's layers were revived
// properly through the constructors.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, sampleDoc, enterSymbolByDblClick } from "./helpers.js";

test("a saved document can be reopened and its symbol entered", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, sampleDoc());

  // Round-trip exactly the way File ▸ Save / File ▸ Open does: through JSON.
  const revived = await page.evaluate(() => {
    const text = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(text));
    const sym = window._flashyAI.doc.library.Star;
    return {
      hasLayers: !!sym.layers,
      // The crash was `l.getKeyframeAt is not a function` on the next render.
      layersRevived: typeof sym.layers[0].getKeyframeAt === "function",
      objectsRevived: typeof sym.objects[0].clone === "function",
      keyframeObjects: sym.layers[0].keyframes[0].objects.length,
      scriptKept: window._flashyAI.doc.layers[0].keyframes[1].script,
    };
  });

  expect(revived.hasLayers).toBe(true);
  expect(revived.layersRevived).toBe(true);
  expect(revived.objectsRevived).toBe(true);
  expect(revived.keyframeObjects).toBe(1);
  expect(revived.scriptKept).toBe("stop();");

  // Entering the symbol is what used to throw.
  const breadcrumb = await enterSymbolByDblClick(page, 1);
  expect(breadcrumb).toContain("Star");

  expect(errors, "no page errors during symbol round-trip").toEqual([]);
});

test("undo while editing a symbol keeps you inside it and restores its content", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, sampleDoc());

  const breadcrumb = await enterSymbolByDblClick(page, 1);
  expect(breadcrumb, "double-click entered the symbol").toContain("Star");

  const result = await page.evaluate(() => {
    const E = window._flashyEditor;
    const F = window._flashyAI;
    const kf = () => F.currentLayers()[0].getKeyframeAt(1);

    const countBefore = kf().objects.length;
    F.pushUndo();
    const extra = new F.EditorObject("oval");
    extra.x = 5; extra.y = 5; extra.width = 10; extra.height = 10;
    kf().objects.push(extra);
    F.fullRefresh();
    const countAfterAdd = kf().objects.length;

    E.doAction("undo");

    return {
      countBefore,
      countAfterAdd,
      // After undo we must STILL be inside Star…
      breadcrumbAfterUndo: document.getElementById("breadcrumb").textContent,
      countAfterUndo: kf().objects.length,
      // …editing the array that is actually in the library, not a detached
      // copy stranded by deserializeDoc rebuilding doc.library underneath us.
      editingLiveSymbol: F.currentLayers() === F.doc.library.Star.layers,
    };
  });

  expect(result.countAfterAdd).toBe(result.countBefore + 1);
  expect(result.breadcrumbAfterUndo).toContain("Star");
  expect(result.countAfterUndo).toBe(result.countBefore);
  expect(result.editingLiveSymbol).toBe(true);
  expect(errors, "no page errors during undo inside a symbol").toEqual([]);
});
