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
- **Timeline cell selection** is `tlSelRange` — a *rectangle*
  `{layerIdx, endLayerIdx, startFrame, endFrame}`, either corner may be the
  larger. Always read it through `tlRange()`, which normalises and clamps to
  the layers that exist; `_flashyAI.tlSelect(l0,f0,l1,f1)`/`tlRange()` are the
  spec entry points.
- **`clearSpan(layer,f0,f1)` is the one way to empty a range of frames.** It
  trims and splits: a keyframe running 1-8 with 3-6 cleared leaves 1-2 and a
  tail at 7-8. The obvious alternative — filtering out any keyframe that
  overlaps — silently destroys content either side, and was live in
  Convert Frames to Symbol until the clipboard work shared this routine. Never
  reintroduce an overlap filter.
- The frame clipboard holds **plain data, not live objects**, because undo/redo
  rebuilds every object in the document from a snapshot, so references would be
  pasting things that are no longer part of anything.
- `Ctrl+Alt+C/X/V` are the frame clipboard and are tested **before** the plain
  `Ctrl+C/X/V` object handlers, which are guarded with `!e.altKey`. Without the
  guard Ctrl+Alt+C falls through and copies objects instead.
- `createSymbolFromFrames()` must leave the artwork visually where it was: the
  instance is placed at `spanBounds()` and the symbol's objects are shifted by
  that origin, because symbol space starts at the instance's top-left. When
  clearing the span, add the placeholder `KeyFrame(1)` **after** inserting the
  instance — doing it during the clear put a blank keyframe on top of the
  instance at the same index, which is the bug the position spec caught.
- A rig nested inside a symbol composes on the stage via `rigDrawPlan` in
  `paintObj`'s symbol branch, matching `addPlanned` in the export. These two
  must stay in step; they were not, and only converting a rigged character
  into a symbol exposed it.
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
- **The stage canvas is the viewport, not the movie.** At the default window a
  550×400 stage sits in a ~991×310 canvas, so `(clientHeight - doc.height) / 2`
  is **negative** and document rows above about y=45 are not on the canvas at
  all. Probe near the middle of the stage; a probe near its top or bottom edge
  reads nothing and looks exactly like a drawing bug. (Exported pages are the
  opposite — their canvas *is* movie-sized, so document coordinates map
  straight through.)
- **Bitmaps and tracing** live behind `window._flashyBitmap`: `importImageFile`,
  `place`, `assets()`, `image(name)`, `deleteBitmapAsset`, `selected()`,
  `preview(obj, opts)` (trace without touching the document — what the dialog's
  live preview uses) and `trace(obj, opts)` (trace and write the shapes onto
  the timeline — what the menu uses). Specs generate a PNG in the page with a
  canvas and `toDataURL`, so there is no binary fixture.
- The tracer itself is `window.FlashyTrace` in `flashy-trace.js` — pure, no DOM,
  `trace(imageData, opts)` in and path command streams out, so it is testable
  in plain Node as well as in the page. Walk a path with
  `FlashyTrace.eachCommand(path, fn)`; never index the array by hand, since the
  stride depends on the opcode (`0 moveTo x y · 1 lineTo x y · 2 quadTo cx cy x
  y · 3 closePath`).
- A traced region's **holes are extra loops in the same path**, filled
  **even-odd** — on the stage, in `Graphics` (via `beginFill(color, alpha,
  'evenodd')`) and in the SVG export. Nonzero fills the holes in, and the only
  thing that catches it is a pixel probe through the middle of a traced ring,
  which is why there is one for both the editor and the export.
- **Bitmap decoding is async everywhere**, on purpose: the movie starts and
  images join as they land rather than frame one waiting on a photo. So in an
  export spec, "the image is drawn" is an *eventual* property — poll the pixel
  with `waitForFunction`. Counting `requestAnimationFrame`s races and was flaky.
- `path` objects carry `pathW`/`pathH`, the size they were authored at, so
  editing W/H **rescales** them (unlike pencil/brush, which ignore it). Any new
  renderer for them must divide by that, and the stroke width must be divided
  back out or a scaled trace gets a stretched outline.
- **Undo snapshots carry asset payloads by reference, not in the JSON.**
  `snap()` returns `{json, sounds, bitmaps}`; `serializeDoc()` still embeds
  everything, since that is what gets saved. Stringifying a 2048px bitmap into
  fifty undo steps is ~100MB of duplicated base64. `_flashyAI.snapshot()` is
  the seam a spec uses to check this.
- **The eraser** is `window._flashyEraser`: `stroke(points, opts)` (the same
  entry point a drag uses), `region(points, size, shape)` (the swept area,
  without touching the document), `size/setSize`, `shape/setShape`,
  `objectRegion(o)`, `maskPath(o)`, `fullyErased(o)`. Tool state is on
  `_flashyAI`: `curTool()` / `setTool(id)`.
- Erasing a vector shape is a **real boolean subtraction** (`flashy-geom.js`),
  not a rasterise-and-retrace. The invariant that matters, and the one a spec
  pins: an edge the brush never reached keeps its **exact** coordinate however
  many strokes are made. Re-tracing would pass every other eraser spec and
  silently degrade the whole drawing. Never swap it for the tracer.
- A brush stroke's swept area is a contour of its **distance field**, not a
  union of capsules. Equal-radius capsules laid end to end share exactly
  collinear edges and land vertices exactly on each other's boundaries —
  precisely what a boolean op gets wrong — and a plain horizontal drag makes
  them every time. `boolOp` additionally perturbs one operand by 1e-5px, and
  drops result loops under 0.01px², for the same reason. If you touch either,
  re-run `tests/geom.spec.js` first: it states the invariants as arithmetic, so
  it says whether the geometry or the editor is at fault.
- A bitmap's erase mask is a flat path command stream in a `maskW` x `maskH`
  box, and its loops are **unioned, never concatenated**. The clip is the box
  plus each loop wound backwards, read **nonzero**: append two overlapping
  strokes and the overlap totals -1, which is nonzero, so it reappears. Two
  crossing strokes on a photo is the first thing anyone tries, and there is a
  spec for exactly that.
- `eraseMask`, `path` and `points` are **flat arrays of numbers, never arrays
  of arrays**. `EditorObject.clone()` copies arrays with a shallow `.slice()`,
  so a nested structure would be shared between an object and its copy.
- Erasing never touches symbols, text or rig parts, and says so in a dialog
  rather than doing nothing visible — "I dragged the eraser and nothing
  happened" is otherwise the first bug report.
- **Resizing the Playwright viewport does not re-centre the stage** —
  `resizeCanvas()` re-measures but leaves the pan set for the old size, so
  every document coordinate afterwards is off by half the difference. Call
  `_flashyAI.centerStage()` after `setViewportSize`, or the pointer events you
  synthesise land somewhere else entirely.
- `showDialog()` grew two things for Trace Bitmap: `opts.build(body, inputs)`
  for custom content inside the standard chrome (so a dialog gets Escape/Enter
  and validation for free), and `type: "checkbox"` fields, which read through
  `fieldValue()` — `values()` must never go back to plain `.value`, which
  returns `"on"` for a checkbox regardless of its state.
