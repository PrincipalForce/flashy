---
name: verify
description: How to run and verify the Flashy editor (static HTML app) end-to-end with Playwright.
---

# Verifying Flashy

Static app, no build step. There is a real test suite — use it first:

```bash
npm install
npx playwright install chromium   # once
npm test                          # everything: editor + desktop shell
npm run test:web                  # editor only (Chromium)
npm run test:desktop              # Electron shell only
npm run test:headed               # watch it happen
npm run test:ui                   # pick individual tests
```

`playwright.config.js` starts `node scripts/serve.cjs` on port 8123 itself, so
there is **nothing to launch by hand** — do not start a server before running
the suite. In particular do not leave a `python -m http.server` on 8123: it is
single-threaded, so once the suite runs more than one page in parallel it starts
refusing connections, and you get a pile of `ERR_CONNECTION_REFUSED` failures
that look like app bugs. (`reuseExistingServer` is off, so a busy port now fails
loudly instead.)

For manual poking:

```bash
npm start           # http://127.0.0.1:8000/editor.html
```

## Writing tests

Specs live in `tests/`. `tests/helpers.js` has the plumbing:
`openEditor`, `loadDoc`, `sampleDoc`, `enterSymbolByDblClick`,
`downloadFromAction`, `runExportedHTML`.

Drive the app through its published seams, not its internals:

- `window._flashyEditor` — `serializeDoc()`, `loadDoc()`, `doAction()`,
  `isDirty()`, `markSaved()`, `menus`, `installDesktop()`. This is the same
  surface `desktop.js` uses, so testing through it tests what the desktop
  build depends on.
- `window._flashyAI` — `doc`, `currentLayers()`, `curLayer()`, `curFrame()`,
  `selection()`, `pushUndo()`, `fullRefresh()`, `EditorObject`, `Layer`,
  `KeyFrame`, `setCurFrame()`, `setCurLayer()`.
  Current keyframe: `F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame())`.
- Exported HTML publishes its stage as `window.__stage`, so an export test can
  assert on the real display list (`__stage.root.children`, `currentFrame`,
  `playing`) instead of grepping generated source.

## Gotchas

- `editor-app.js` is wrapped in an IIFE — no globals beyond those two seams
  (plus `window._flashyWorkspace`, below).
- **Panels are dockable.** There is no fixed right column or bottom bar: tabs
  are `.dock-tab[data-panel="props|color|library|actions|ai"]`, bodies live in
  `.dock-body`, and a panel that is not currently visible is parked in
  `#panel-store`. The content ids (`propsPanel`, `colorPanel`, `libPanel`,
  `aiPanel`, `frame-script`) are stable wherever the panel is docked — target
  those, never a dock position. Drive layout from `window._flashyWorkspace`:
  `dock(id, zone, target)`, `show/close/toggle(id)`, `preset(name)`, `reset()`,
  `layout()`.
- The loading card (`#splash`) is a fixed full-viewport overlay that removes
  itself on a timer. Playwright's click/drag auto-waiting handles it, but raw
  `page.mouse` coordinates land on the splash and silently do nothing —
  `openEditor()` waits for `#splash` to detach, so use it.
- Toolbar buttons carry `title` attributes ("Pencil Tool (Y)", "Selection Tool (V)"):
  `page.locator('button[title*="Pencil"]').click()`.
- Stage canvas is `#stageCanvas`. At zoom 1 the stage origin sits at
  `((canvas.clientWidth - doc.width) / 2, (canvas.clientHeight - doc.height) / 2)`
  — `enterSymbolByDblClick` does this conversion.
- Input is **Pointer Events**, so synthesise `PointerEvent` (with `pointerId`),
  not `MouseEvent`, when driving tools. `dblclick` is still a MouseEvent.
- `hitTest()` only searches the **active layer**. Call `F.setCurLayer(n)` before
  clicking an object on another layer.
- Exports always render the scene (`doc.layers`), never the symbol you are
  currently inside.
- Frame scripts do **not** run while scrubbing or playing in the editor — only
  in Test Movie and in exported files, like Flash. Assert on them through an
  export, not the editor.
- File ▸ Save/Export go through `dlFile`, which triggers a browser download:
  catch it with `page.waitForEvent("download")` (see `downloadFromAction`).
- **Never use `window.prompt()`** — it throws in Electron, so anything built on
  it works in a browser and is dead in the desktop app. Use `showDialog()` /
  `askFor()`; `tests/dialogs.spec.js` disables `prompt` to enforce this.
- **Prefer `showMessage()` over `alert()`** in anything new. `alert()` does work
  in Electron, but it is an OS-modal window that blocks the main process, so a
  spec can only reach it through `page.on("dialog")` and a desktop spec that
  triggers one *hangs rather than fails*. `showMessage(title, text)` is the same
  `#fy-dialog` with a single button and no Cancel.
- The **timeline canvas is viewport-sized**, not movie-sized: `#tl-spacer`
  carries the extent and `renderTLFrames` draws the visible columns offset by
  `#tl-frames`'s scroll. Frame width is `window._flashyAI.tlFrameWidth()` and
  is zoomable — never assume 12px, and add `scrollLeft` when converting a
  click to a frame.
- **Symbol instances** render per `symbolBehavior`: a Graphic shows a frame
  derived from the parent playhead (`symbolDisplayFrame`), a Movie Clip and a
  Button show frame 1 on the authoring stage. `frameObjects()` stamps
  `_startFrame`/`_parentFrame` onto a view of each symbol object; assert on
  pixels (distinct fill colours per symbol frame) to check which frame shows.
- `loadDoc()` re-centres the stage, so a pixel probe can assume the stage
  origin is `((canvas.clientWidth - doc.width) / 2, …)` at zoom 1.
- **Audio** lives behind `window._flashyAudio` (`importSoundFile`, `soundItems`,
  `deleteSoundAsset`, `track()`, `assets()`). Browsers block audio until a user
  gesture, so a spec that needs sound must do a real click first (a
  `page.mouse`/`locator.click` on `#tlCanvas` works) — `page.evaluate` is not a
  gesture. `tests/audio.spec.js` generates a WAV in the page rather than
  shipping a binary fixture.
- **Lip sync** is on the same seam: `_flashyAudio.classify(features, opts)`
  returns the viseme runs, `lipSync(opts)` writes the keyframes, `visemes` is
  the shape list and `mouthChart(sym)` the shape-to-frame map. Features come
  from `Flashy.Sound.analyze(name, {fps})` — pure analysis, no playback, so **no
  user gesture is needed** and these can run entirely in `page.evaluate`.
  `tests/lipsync.spec.js` synthesises vowels from known formant pairs
  (ah 800/1200, ee 300/2400, oo 300/800) plus broadband hiss, so the expected
  classification is derivable rather than recorded. When tuning the classifier,
  **measure the bands first** — print `low/mid/high`, `zcr` and `rms` for each
  segment and set the thresholds from the numbers; the original thresholds were
  guessed and collapsed "ee" and "oo" onto the same shape.
- `ensureSymbolLayers()` **revives** a symbol's layers (and a legacy
  `objects`-only symbol's objects) when they have no prototype, so anything
  that edits a symbol works on hand-written JSON, a mid-import document, or
  something the assistant produced. Before this, `clone()` and
  `getKeyframeAt()` threw on exactly the documents a repair tool is for.
- `_flashyAudio.mouthSetup({symbolName, create, tighten})` is the seam for
  **Set Up Mouth Shapes**; it returns `{created, tightened, frames, chart,
  distinct}`. It never discards artwork — new frames are clones of an existing
  drawing, and `tighten` renumbers rather than deletes.
- **Character rigs** live behind `window._flashyRig`. The rig *is* the keyframe
  objects (`rigChar`, `rigPart`, `rigParent`, `pivotX/Y`, `rigZ`);
  `doc.characters[name]` holds only the template and the pose library. There is
  deliberately one source of truth, so never assert against a stored structure
  when the stage is what gets drawn.
- Rig transforms compose as `translate(pivot) · rotate · scale ·
  translate(-pivot)` per ancestor then per part, in one shared space. All
  positional questions go through `rigApplyChain()` — use
  `_flashyRig.pivotWorld/worldPoint/localPoint` in specs rather than
  recomputing, and remember **a part's own rotation never moves its own
  pivot** (only its ancestors do).
- `paintObj()` keeps its old centre-pivot path for non-rig objects; only
  `isRigPart(o)` objects take the pivot path. Any change there must leave an
  unrigged document byte-identical, which the rest of the suite guards.
- **Export parity is the thing to protect.** `addPlanned()` in `exportRuntime`
  wraps each part in two nested containers (outer: translate+rotate+scale,
  inner: -pivot) and `buildObj` therefore zeroes rotation/scale on a rig part's
  own node — applying them in both places silently doubles every angle. The
  parity spec finds the part in the exported tree by `instanceName` and
  accumulates transforms up to the root; it must wait for
  `__stage.root.children.length > 0`, because the display list is built by the
  first frame script, not at load.
- **IK** is `ikSolve()` (CCD) behind `_flashyRig.solve/chain/poseMode/setPoseMode/bones/setBones`.
  It writes **only `rotation`** — a spec asserts no other field changes, and
  that invariant is what keeps poses, tweens and the export ignorant of IK.
  `ikChain()` stops at a part with `rigLocked`, and `clampPartRotation()`
  applies `rigMin`/`rigMax` in both IK and FK. Out-of-reach returns a non-zero
  `error` rather than failing.
- The Pose tool's **default drag is IK** (`poseMode === "ik"`, 2 bones), so a
  spec that wants one-joint FK must call `setPoseMode("single")` first — this
  caught an older spec that had encoded the pre-IK default.
- The Pose tool (`setTool("pose")`) is its own mode: drag rotates, Ctrl+drag
  moves the joint, Alt+drag moves the part, Shift snaps. One drag is one undo
  step — the snapshot is captured on mousedown and only pushed if something
  actually changed.
- The Character panel (`character.js`) owns no state and rebuilds from the
  document on `flashy:rigchange`, which `fullRefresh()` emits. Note it is
  emitted from `fullRefresh`, **not** `render()` — a pose drag calls `render()`
  per pointer move and rebuilding a DOM tree each time would fight the drag.
- Adding a panel changes `defaultLayout()` and so breaks the workspace specs
  that assert the exact dock contents. A panel can declare `with: "<panelId>"`
  to share an existing tab group instead of adding another stacked one.
- `symbolTotalFrames()` reads the keyframes directly rather than calling
  `Layer.getFrameEnd()`, so a library symbol built as a plain object (a spec
  fixture, a mid-import document, something the assistant wrote) still reports
  its real length instead of 1. It also falls back to `sym.totalFrames` for
  symbols stored as `objects` + `totalFrames` with no `layers`.
- **A mouth symbol's drawings are not on frames 1..n.** `mouthFrameCandidates()`
  returns the symbol's real keyframe *start* indices, and `mouthChartFor()`
  defaults from those. A symbol drawn with 8-frame keyframes has its shapes at
  1, 9, 17, 25, 33, 41 — a 1..6 chart puts every shape inside the first
  keyframe, so the mouth never moves while the pass still reports success.
  When asserting on lip-sync output, **resolve `firstFrame` to the covering
  keyframe and count distinct drawings** — asserting on distinct `firstFrame`
  values passes on exactly this bug. `lipSync()` returns `shapesUsed` and
  `shapesVisible` for the same reason.
- 1px strokes antialias to ~50% gray — use a lenient threshold (<200) when
  pixel-sampling, and exclude selection UI (it is blue, b≈255).
