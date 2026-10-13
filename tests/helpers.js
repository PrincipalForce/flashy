// Shared plumbing for the editor specs.
//
// editor-app.js is wrapped in an IIFE, so there are no globals to poke. It
// publishes two deliberate seams instead, and the tests use both:
//
//   window._flashyEditor  serializeDoc / loadDoc / doAction / isDirty / markSaved
//   window._flashyAI      doc, currentLayers(), pushUndo(), fullRefresh(), …
//
// Driving the app through those is the point: a test that reached into private
// state would not be testing the thing the editor and the desktop shell
// actually rely on.

/** Open the editor and wait until init() has run and the UI is reachable. */
export async function openEditor(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/editor.html");
  await page.waitForFunction(() => !!(window._flashyEditor && window._flashyAI));
  // init() builds the toolbox from DOMContentLoaded; wait for real UI.
  await page.locator('button[title*="Selection"]').waitFor();
  // The loading card is a fixed, full-viewport overlay that removes itself on
  // a timer. Playwright's own click/drag auto-waiting handles it, but raw
  // page.mouse coordinates do not — they land on the splash and silently do
  // nothing. Wait for it to be gone so every spec sees the same page.
  await page.waitForSelector("#splash", { state: "detached" });
  page.flashyErrors = errors;
  return errors;
}

/** A document with one tweened rectangle and one edited symbol instance. */
export function sampleDoc() {
  const rect = (over = {}) => ({
    type: "rect", x: 20, y: 30, width: 100, height: 60,
    rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
    fillColor: "#FF0000", fillAlpha: 1, fillType: "solid",
    strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 1, strokeStyle: "solid",
    ...over,
  });
  return {
    width: 550, height: 400, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 60,
    layers: [
      {
        name: "Shapes", visible: true, locked: false,
        keyframes: [
          { index: 1, duration: 10, tweenType: "motion", easing: "linear", script: "", objects: [rect()] },
          { index: 11, duration: 1, tweenType: "none", easing: "linear", script: "stop();", objects: [rect({ x: 300 })] },
        ],
      },
      {
        name: "Symbols", visible: true, locked: false,
        keyframes: [
          {
            index: 1, duration: 20, tweenType: "none", easing: "linear", script: "",
            objects: [{
              type: "symbol", symbolName: "Star", instanceName: "star1",
              x: 200, y: 100, width: 50, height: 50,
              rotation: 45, scaleX: 2, scaleY: 2, alpha: 1,
            }],
          },
        ],
      },
    ],
    // A symbol that has been OPENED FOR EDITING, so it carries `layers`. This
    // is the shape that used to come back from disk without a prototype and
    // crash the editor on the next double-click.
    library: {
      Star: {
        objects: [rect({ fillColor: "#00FF00", x: 0, y: 0, width: 50, height: 50 })],
        layers: [{
          name: "Layer 1", visible: true, locked: false,
          keyframes: [{
            index: 1, duration: 60, tweenType: "none", easing: "linear", script: "",
            objects: [rect({ fillColor: "#00FF00", x: 0, y: 0, width: 50, height: 50 })],
          }],
        }],
        totalFrames: 60,
      },
    },
  };
}

/** Load a document object into the open editor. */
export async function loadDoc(page, doc) {
  await page.evaluate((d) => window._flashyEditor.loadDoc(d), doc);
}

/**
 * Enter a symbol the way a user does: double-click its instance on the stage.
 * `layerIdx` is the index in currentLayers() holding the instance.
 */
export async function enterSymbolByDblClick(page, layerIdx = 1, objIdx = 0) {
  return page.evaluate(({ layerIdx, objIdx }) => {
    const F = window._flashyAI;
    // hitTest() only searches the ACTIVE layer, so selecting the layer first
    // is part of how a user reaches an object on it. (That restriction is a
    // known divergence from Flash — see ROADMAP.md.)
    F.setCurLayer(layerIdx);
    const canvas = document.getElementById("stageCanvas");
    const inst = F.currentLayers()[layerIdx].getKeyframeAt(F.curFrame()).objects[objIdx];
    const r = canvas.getBoundingClientRect();
    // centerStage() puts the stage origin at ((canvasW - docWidth)/2, …) at zoom 1.
    const clientX = r.left + (canvas.clientWidth - F.doc.width) / 2 + inst.x + inst.width / 2;
    const clientY = r.top + (canvas.clientHeight - F.doc.height) / 2 + inst.y + inst.height / 2;
    canvas.dispatchEvent(new MouseEvent("dblclick", {
      clientX, clientY, bubbles: true, button: 0,
    }));
    return document.getElementById("breadcrumb").textContent;
  }, { layerIdx, objIdx });
}

/** Trigger a File ▸ … export and return the downloaded file's text. */
export async function downloadFromAction(page, action) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.evaluate((a) => window._flashyEditor.doAction(a), action),
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Run a generated export's HTML in a blank page and report what the engine
 * actually put on the stage. This is how the export specs check real output
 * rather than grepping the generated source for hopeful substrings.
 */
export async function runExportedHTML(context, html) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setContent(html);
  await page.waitForFunction(() => typeof window.Flashy !== "undefined");
  return { page, errors };
}
