// Desktop shell smoke tests — run against the real Electron app.
//
// These cover the seam between editor-app.js and the shell, which is otherwise
// completely untested: the editor publishes dirty state, desktop.js forwards it
// over IPC, and the main process uses it to decide whether closing a window has
// to ask first. Getting that wrong either loses documents or makes windows
// refuse to close.
//
// The native Save / Don't Save / Cancel dialog itself cannot be driven from a
// test (it is an OS-modal window), so what is verified here is everything up to
// it: the state reaches the main process, and the title reflects it.
import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";

// Playwright transpiles these specs to CJS, so `import.meta` is unavailable.
// The runner always starts at the project root, where package.json's "main"
// points Electron at electron/main.cjs.
const ROOT = path.resolve(process.cwd());

/** Launch the app in a scratch userData dir so it never touches a real profile. */
async function launch(tmpDir) {
  return electron.launch({
    args: [ROOT, `--user-data-dir=${tmpDir}`],
    cwd: ROOT,
  });
}

test("the desktop shell boots the editor and installs its bridge", async ({}, testInfo) => {
  const app = await launch(testInfo.outputPath("userData"));
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !!(window._flashyEditor && window._flashyAI));

  // Served over flashy://, not file://, so the renderer has a real origin.
  expect(page.url()).toContain("flashy://app/editor.html");

  const bridge = await page.evaluate(() => ({
    isDesktop: window.flashyDesktop && window.flashyDesktop.isDesktop,
    // desktop.js only installs itself if both halves of the seam exist.
    hasSetDirty: typeof window.flashyDesktop.setDirty === "function",
    hasSaveThenClose: typeof window.flashyDesktop.onSaveThenClose === "function",
    // …and the File menu gained the desktop-only entries.
    fileItems: window._flashyEditor.menus
      .find((m) => m.label === "File")
      .items.map((i) => i.action),
  }));

  expect(bridge.isDesktop).toBe(true);
  expect(bridge.hasSetDirty).toBe(true);
  expect(bridge.hasSaveThenClose).toBe(true);
  expect(bridge.fileItems).toContain("saveAs");
  expect(bridge.fileItems).toContain("newWindow");

  await app.close();
});

test("dirty state shows in the title and is accepted by the main process", async ({}, testInfo) => {
  const app = await launch(testInfo.outputPath("userData"));
  const page = await app.firstWindow();
  await page.waitForFunction(() => !!(window._flashyEditor && window._flashyAI));

  // Clean to start with: no bullet.
  await expect.poll(() => page.title()).not.toContain("•");

  await page.evaluate(() => {
    const F = window._flashyAI;
    F.pushUndo();
    F.doc.layers[0].getKeyframeAt(1).objects.push(new F.EditorObject("rect"));
    F.fullRefresh();
  });

  // desktop.js reacts to flashy:dirtychange and re-titles the window.
  await expect.poll(() => page.title()).toContain("•");

  // The main process must accept the state, because that is what gates the
  // close dialog. ipcRenderer.invoke rejects with "No handler registered for
  // 'channel'" if the main side is missing, so a clean resolve is the proof.
  //
  // Deliberately NOT tested here: actually closing a dirty window. That opens
  // an OS-modal dialog, which blocks the main process — the test would hang
  // rather than fail.
  const accepted = await page.evaluate(async () => {
    try {
      await window.flashyDesktop.setDirty(true);
      await window.flashyDesktop.setDirty(false);
      return "ok";
    } catch (e) {
      return String(e && e.message);
    }
  });
  expect(accepted).toBe("ok");

  // Saving clears it again.
  await page.evaluate(() => window._flashyEditor.markSaved());
  await expect.poll(() => page.title()).not.toContain("•");

  await app.close();
});

test("the in-app dialogs work in the desktop build, where prompt() does not", async ({}, testInfo) => {
  const app = await launch(testInfo.outputPath("userData"));
  const page = await app.firstWindow();
  await page.waitForFunction(() => !!(window._flashyEditor && window._flashyAI));

  // prompt() genuinely throws here. This is not a stub — it is the real
  // behaviour that silently killed the Text tool, Document Settings, the API
  // key, New Symbol and Import from URL in the app while the browser build
  // looked fine. Confirm it, so the rest of this test means something.
  const promptDead = await page.evaluate(() => {
    try { window.prompt("x"); return "worked"; } catch (e) { return "throws"; }
  });
  expect(promptDead).toBe("throws");

  // Auto Lip Sync is the newest dialog and the first to use a <select> field,
  // so it is the most likely to be broken in a way only the app shows.
  await page.evaluate(() => window._flashyEditor.doAction("lipSync"));
  const dialog = page.locator("#fy-dialog");
  await expect(dialog).toBeVisible();

  // With no sound imported it must say so rather than present an empty picker.
  await expect(dialog).toContainText(/sound/i);
  await dialog.getByText("OK").click();
  await expect(dialog).toHaveCount(0);

  // And the key dialog, which is how anyone actually gets the assistant going.
  await page.evaluate(() => window._flashyEditor.doAction("prefs"));
  await expect(page.locator("#fy-dialog")).toBeVisible();
  await page.locator("#fy-dialog .fy-dialog-input").fill("sk-ant-api03-desktop-smoke-test");
  await page.locator("#fy-dialog").getByText("Save key").click();
  await expect(page.locator("#fy-dialog")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("flashy_ai_key")))
    .toBe("sk-ant-api03-desktop-smoke-test");

  await app.close();
});
