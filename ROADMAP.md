# Flashy Roadmap

An assessment of the project from two angles — someone maintaining the codebase,
and someone trying to actually make something with it — and the work that
follows from it.

Items are ordered by what they cost a user, not by effort. Each one says **what**
and **why**, because the why is what decides whether it is worth doing at all.

**Status key:** ✅ done · 🚧 in progress · ⬜ not started

Where a line references code, the reference is `file:symbol` rather than a line
number so it survives edits.

---

## Where the project actually stands

The engine is clean and small, the desktop seam (`window._flashyEditor` /
`desktop.js`) is genuinely well designed, and the MX2004 feel is right. What was
holding it back was not missing features. It was two things:

1. **Nothing protected unsaved work.** No dirty flag existed anywhere in the
   product; the only confirmation was on File ▸ New. Closing a tab or an app
   window destroyed the document silently.
2. **Several advertised features were wired into the UI but never executed.**
   Frame scripts had an editor, a save format, and no runtime. Symbols were
   invisible in three of five export paths. "Export as GIF" produced an HTML
   sprite sheet.

Those are fixed. Since then the editor gained a **dockable workspace** (0.3),
**audio** (0.4), **puppet mechanics** (0.5), a **zoomable timeline** (0.5.1) and
**auto lip sync** and **character rigging** (0.6) — see
[VISION.md](VISION.md), which plans the product from an animator's point of
view rather than a maintainer's. What remains here is
mostly genuine feature work, plus one large piece of housekeeping (splitting
`editor-app.js`).

---

## P0 — Data loss and features that silently did nothing

### ✅ 1. Unsaved-work guard

**What.** Document revision tracking (`editor-app.js:docRev`/`savedRev`), a
`flashy:dirtychange` event, `beforeunload` on the web, and a native
Save / Don't Save / Cancel dialog on the desktop (`electron/main.cjs`, the
`win.on("close")` handler). The window title carries a `•` while dirty, and
File ▸ New and File ▸ Open only interrupt you when there is something to lose.

**Why.** This was the single highest-severity defect in the product. For an
authoring tool, losing an hour of animation to a stray Ctrl+W is the kind of
thing a user does not come back from.

Two deliberate choices:

- Undoing back to the state that was last saved still reports dirty, because
  the revision counter moved. A spurious prompt costs a click; a missed one
  costs the document.
- Electron does **not** use `beforeunload`: returning a value from it there
  cancels the close without showing anything, so the window would simply refuse
  to close with no explanation. The desktop gets a real three-way dialog, driven
  by the dirty state `desktop.js` forwards to the main process. It has to be
  pushed rather than pulled, because `close` can only be vetoed synchronously.

### ✅ 2. Reopening a document with an edited symbol crashed the editor

**What.** `deserializeDoc` now revives the library through the same
`reviveLayers` / `reviveKeyframe` / `reviveObject` functions the scene goes
through, and `serializeLibrary` is its mirror image.

**Why.** `doc.library` used to be assigned straight off the parsed JSON, so a
symbol's layers came back as plain objects with no `Layer` prototype while the
scene's layers were revived properly. Repro: save a document after editing a
symbol's timeline, reopen it, double-click that symbol — `l.getKeyframeAt is not
a function`, editor dead. Symbol reuse is the whole point of a Flash-alike.

### ✅ 3. Undo while editing a symbol discarded your work

**What.** Undo snapshots now carry the edit stack (`snap()` records the symbol
path), and `restoreSnap` rebuilds it by name against the newly revived library.

**Why.** `deserializeDoc` rebuilds `doc.library` from scratch, so every
`editStack` entry was left holding a reference to a layer array that was no
longer part of the document. One undo inside a symbol and you were silently
editing a detached copy — no error, just work that went nowhere.

### ✅ 4. Frame scripts are real

**What.** Three parts:

- The Actions tab's `<textarea id="frame-script">` had **no handler at all**.
  It now edits the current keyframe (`initActionsPanel`, `updateActionsPanel`).
- `exportRuntime` compiles and runs each keyframe's script on entry to that
  frame, with `stop()`, `play()`, `gotoAndPlay()`, `gotoAndStop()`, `root`,
  `stage` and `Flashy` in scope, and `this` bound to the root MovieClip.
- Scripts run on **entry** to a frame, not on every tick spent sitting on it,
  which is what a `stop()` causes.

**Why.** "Attach JavaScript to any frame for interactive behavior" was a
headline README claim and a tab in the UI. `kf.script` was edited, serialized,
and read by nothing. A user would write `stop()` on frame 30, export, and watch
it loop.

Scripts deliberately do **not** run while scrubbing or playing in the editor —
the same split Flash had between authoring and Test Movie. It keeps the
authoring app from executing document content.

### ✅ 5. One renderer instead of four

**What.** `paintObj` is now the only canvas painter, used by the stage (with
authoring chrome) and by the raster exporters (without). `exportRuntime` is the
only display-list builder, shared by the HTML and JS-module exports. `interpObj`
and `frameObjects` are the only tween interpolator and the only "what is visible
on this frame" function.

This fixed four separate divergences that had crept in between the copies:

- **Symbol instances ignored their transform in the HTML export.** The symbol
  branch returned a MovieClip and never applied `x/y/rotation/scale/alpha`, so
  every symbol in an exported file stacked up at the stage origin. A document
  built the way the editor encourages exported as garbage.
- **Symbols were absent from the raster and SVG exporters entirely** — no
  `symbol` case in the switch, `default: return ''` in the SVG one. Silent
  omission, not an error.
- **The stage transformed around each object's centre; the exporters
  transformed around its top-left.** Any rotated or scaled object landed
  somewhere else in an export than where the user put it. Centre-origin now
  everywhere.
- **Tween timing disagreed.** The stage divided by `duration`, the exporters by
  `duration - 1`, so exported tweens arrived a frame early and then sat on the
  destination for two frames. Unified on `duration`, which is the Flash rule:
  the frame holding the *next* keyframe is the one that shows the destination.

`exportRuntime` is ordinary readable code serialised with
`Function.prototype.toString()`, replacing ~130 lines of string concatenation.
That is only safe because there is no bundler or minifier in this project — and
the reason the four copies drifted in the first place is that one of them was
unreadable.

### ✅ 6. Exports agree on what they are exporting

**What.** Every export path renders the scene (`doc.layers`). SVG exports the
current frame rather than always frame 1.

**Why.** `renderFrameToCanvas` and `exportAsSVG` used `currentLayers()`, so
"Export as GIF" quietly exported whichever symbol you happened to have open
while the HTML export exported the scene. "Export" meant different things
depending on where your breadcrumb was, with no indication.

### ✅ 7. Honest export labels

**What.** "Export as GIF…" → **"Export as Sprite Sheet…"**; "Export as MP4…" →
**"Export as Video (WebM/MP4)…"**, in both the in-app menu and the macOS native
menu.

**Why.** The GIF exporter builds a sprite-sheet PNG and downloads an HTML
player; there is no GIF encoder anywhere in the project. The video exporter
produces WebM in every browser that supports VP9 and only falls back to the
`.mp4` label. Menu labels are promises. Renaming is the honest fix available
today; a real encoder is ⬜ below.

### ✅ 8. Exports can be re-imported

**What.** Generated HTML publishes its stage as `window.__stage`.

**Why.** File ▸ Import from URL looks for exactly that handle — so our own
exports were the one kind of Flashy page our own importer could not read.

### ✅ 9. The AI panel could not complete a single request

**What.** Four things, all in the assistant panel:

- **The conversation began with an assistant turn.** The greeting was pushed
  into `aiMessages` (`aiAddMsg` stored any non-system role) and that array was
  sent verbatim as `messages`, so `messages[0].role` was `"assistant"` on the
  first request and, by parity, on every one after. **The Messages API requires
  the first message to use the `user` role** — confirmed against the API
  reference, where it is a documented 400. Every send failed and surfaced as
  "API error:" in the chat. The greeting is now excluded at the source
  (`opts.history === false`), and the history window additionally drops any
  leading assistant turn rather than trusting the slice to land well.
- **Assistant turns were remembered without the code.** The code block was
  stripped before storing, so "make it bigger" asked the model to revise code
  it could not see. Display and history are now separate (`opts.historyText`):
  the user sees prose plus an Apply button, the model sees the full reply.
- **No streaming, no timeout, no cancel.** A long adaptive-thinking turn showed
  a static "Creating…" indefinitely. The panel now streams (`stream: true`,
  SSE parsed in `aiCallAPI`), shows Thinking…/Writing… status, turns Send into
  **Stop**, and aborts after 5 minutes. An abort returns the UI to idle
  immediately rather than waiting for the network layer to reject — a
  connection that goes quiet instead of erroring used to leave the panel stuck.
- **Model and token budget.** `claude-opus-4-8` → **`claude-opus-5`**, and
  `max_tokens` 16000 → 32000: on current models `max_tokens` caps thinking *and*
  the reply together, so a budget sized for the reply alone could truncate a
  thinking turn mid-sentence. `thinking: {type: "adaptive"}` was already
  correct and is unchanged. Streaming is what makes the larger budget safe
  against request timeouts.

`refusal` and `max_tokens` stop reasons are now reported as readable messages
rather than silently producing an empty bubble.

Five specs in `tests/ai-panel.spec.js` cover all of it with `fetch` stubbed, so
they need no API key and make no network calls — and all five fail against the
pre-fix code.

**Still open here:** the panel talks to the API directly from the browser with
the user's own key (see §31 for the trust model) — a thin proxy would remove
browser-held keys entirely.

---

## P1 — Capability gaps that shape what people can make

### ✅ 10. Touch and pen input

**What.** The editor and the engine both use Pointer Events now
(`initMouse`, `Stage._bindInput`), with `touch-action: none` on the canvas,
`setPointerCapture` so a drag that leaves the canvas still delivers, and
`pointercancel` handling so a cancelled stroke cannot leave a drag stuck open.
The engine also scales client coordinates into stage space, which it did not
before, so a canvas displayed at a non-native size hit-tests correctly.

**Why.** Both layers bound mouse events only — the engine even had an
unreachable touch branch inside its coordinate converter. You could not draw a
single line on an iPad, and **exported games did not respond to touch at all**.

### ⬜ 11. No raster images, anywhere

**What.** Add a `Flashy.Bitmap` display object, a `bitmap` EditorObject type,
File ▸ Import Image, and the corresponding export cases.

**Why.** This is the largest missing capability for the stated audience —
nearly every real Flash project composited bitmaps with vectors. It is also
conspicuous from inside the app: the AI panel accepts a reference image you then
cannot place on the stage.

### 🚧 12. Button symbols work; text still is not clickable

**Buttons ✅ (0.5).** `symbolBehavior: 'button'` now builds Up/Over/Down/Hit
from frames 1–4 and reacts to the pointer in exports. See
[VISION.md](VISION.md) §5.

⬜ **Text is still not hit-testable.** `Stage._hitTest` requires
`node.graphics._bounds` and `TextField` has none, so a button made of text
cannot be clicked. Give `TextField` measured bounds.

### ⬜ 13. Selection only sees the active layer

**What.** `hitTest` searches `CKF()` — the current layer's keyframe — so
clicking an object on another layer selects nothing.

**Why.** Flash selected across layers. This is one of those restrictions that
reads as the app being broken rather than as a rule. (The test helper
`enterSymbolByDblClick` has to call `setCurLayer` first, which is the smell.)

### ⬜ 14. Selection is an axis-aligned bounding box

**What.** `hitTest` ignores `rotation` and `scaleX/Y` and tests a bbox.

**Why.** Rotated artwork cannot be clicked where it visibly is, and a pencil
stroke grabs clicks across its whole bounding box. Needs `isPointInPath` /
`isPointInStroke` against the transformed path — the same geometry `paintObj`
already builds.

### ⬜ 15. Real Save in the browser

**What.** Use the File System Access API (`showSaveFilePicker`) where it
exists, falling back to the download path.

**Why.** Web Save downloads a fresh `animation.flashy` every time, so a user's
Downloads folder fills with `animation (14).flashy` and they cannot tell which
is current. The desktop build already proves the real-save model works; this
gives the web build the same Ctrl+S semantics.

### ⬜ 16. A real GIF encoder, and deterministic video

**What.** An actual GIF encoder for the sprite-sheet path, and a deterministic
frame-stepped video export.

**Why.** Video recording runs in wall-clock real time, so a 60-second animation
takes 60 seconds to export and drops frames if the tab is backgrounded.
**Note the constraint added in 0.4:** the export now muxes in the soundtrack,
and live audio capture *requires* a real-time clock — so frame-stepping and
sound cannot both come from `MediaRecorder`. A deterministic export with audio
needs WebCodecs plus a muxer, which is a larger piece of work than
`captureStream(0)` alone.

### 🚧 17. Engine features Flash users expect

**Sound ✅** — `Flashy.Sound` + `Flashy.SoundTrack` shipped in 0.4: WebAudio
asset cache, waveform peaks, Stream/Event sync, and a playhead driven from the
audio clock. See [VISION.md](VISION.md) §1.

⬜ Masks, filters (blur / glow / drop shadow), and true shape tweening remain.
All three are additive and none of them block anything else.

---

## P2 — Performance and authoring ergonomics

### ⬜ 18. Undo is a full-document JSON snapshot per keystroke

**What.** `snap()` stringifies the whole document; arrow-key nudges call
`pushUndo()` on **every** keydown. The stack is capped at 50.

**Why.** Holding an arrow key for a second both flushes your real undo history
and stringifies the document ~30 times. Needs coalescing by time and operation
first, then a command/patch model instead of snapshots.

### 🚧 19. Panel rebuilds vs timeline rendering

**Timeline ✅ (0.5.1).** `renderTLFrames` used to size one canvas to the whole
movie at a fixed 12px per frame. A five-minute soundtrack is 7,200 frames — an
86,000px canvas, past Chromium's 65,535px limit — so it **silently stopped
painting** and the timeline became a blank area you could still click and hear
audio through. It now draws only the visible columns onto a viewport-sized
canvas backed by a scroll spacer, and is zoomable from 32px/frame down to ¼px
so a long dialogue track fits on screen.

⬜ `updateLayers`, `updateProps` and `updateLib` still rebuild their DOM from
scratch on every action.

### ✅ 20. Playback no longer uses `setInterval`

Replaced in 0.4 as part of the audio work. `startPlay` now runs on
`requestAnimationFrame`, and when a stream sound is playing the playhead is
derived from the **audio clock** rather than any timer — which is what Flash's
Stream sync meant. With no audio it runs off `performance.now()`, which still
fixes the drift and the ignored mid-play FPS change.

### ⬜ 21. Missing standard authoring commands

Duplicate, group/ungroup, align & distribute, rulers, guides, snap-to-object,
onion skinning, per-object lock. Note also that **`bringFront`/`sendBack` exist
in `doAction` but appear in no menu** — they are reachable only from the context
menu, which is an easy win.

### ✅ 22. `prompt()` replaced with real dialogs

**Fixed in 0.5.1, and it was worse than "unstyled":** `window.prompt()` throws
*"prompt() is not supported."* in Electron, so every feature that used it was
**dead in the desktop build while working fine in a browser** — the API key,
Document Settings, the Text tool, renaming a layer, New Symbol, Convert to
Symbol and Import from URL.

All now use one styled modal (`showDialog`) with multiple fields, validation
before it closes, Escape/Enter, and a password field for the API key. Document
Settings is one dialog of four fields instead of three sequential prompts, and
naming a symbol rejects a duplicate instead of silently overwriting it. A spec
disables `prompt()` and drives every one of those paths, so it cannot regress.

🚧 `alert()` and `confirm()` are still used in 17 places. They are not broken
in Electron the way `prompt()` was, but they are **OS-modal windows that block
the main process** until dismissed, they look foreign next to the rest of the
app, and a test cannot drive them without special-casing the dialog event. The
lip-sync paths added in 0.6 use a `showMessage()` helper built on the same
`showDialog`, and the remaining callers should move to it — see item 28.

### ⬜ 28. The remaining `alert()` and `confirm()` calls

**What.** 15 `alert()` calls and 2 `confirm()` calls, mostly on error paths
(failed file open, failed decode, unsupported export) plus the two
"unsaved changes will be lost" confirmations.

**Why.** Each one is an OS-modal window in the desktop build that blocks the
main process while it is up, and it cannot be styled or reliably tested. The
replacement already exists: `showMessage()` for the reports and a two-button
`showDialog` for the confirmations. The confirmations matter most — they guard
document loss, so they are the ones least acceptable as an untestable native
box.

### ⬜ 23. Keyboard handling breaks under modifiers

**What.** The shortcut handler compares `e.key` against lowercase letters, so
**CapsLock or Shift disables every Ctrl shortcut**. `Cmd+Shift+Z` (Mac redo) is
unbound. Any unhandled `Ctrl+<letter>` falls through to the tool-shortcut loop,
so Ctrl+R switches to the Rectangle tool on its way to reloading the page.

**Why.** Use `e.code`, and gate the tool loop on `!ctrl && !alt`.

### ⬜ 24. Zoom has no zoom-to-cursor and no space-pan

Fixed step list only. Standard in every comparable tool.

---

## P3 — Project and release readiness

### ✅ 25. Tests and CI

**What.** `npm test` runs Playwright against the real editor over
`scripts/serve.cjs`. **104 specs** in `tests/` — 101 in Chromium, 3 driving the
real Electron app:

| Spec | n | Covers |
|---|---|---|
| `symbol-roundtrip` | 2 | Reopening a document with an edited symbol; undo inside a symbol |
| `dirty-guard` | 3 | Dirty-state transitions and the unload guard |
| `editing` | 3 | Pointer drawing, pointer cancellation, the Actions panel |
| `export` | 5 | Symbol transforms in the HTML export, frame scripts stopping playback, symbols in SVG and the sprite sheet, re-import |
| `ai-panel` | 5 | `fetch` stubbed: first message role, model, thinking config, streaming, token budget, streamed reply, history, Stop, 401 key clearing |
| `workspace` | 8 | Docking, tab drag, persistence, a corrupt saved layout, close/reopen, splitter resize, presets |
| `audio` | 9 | Import, waveform, scrub, Stream vs Event, the HTML export's audio gate |
| `puppet` | 8 | Graphic / Movie Clip / Button behaviour on the stage and in exports, Swap Symbol |
| `dialogs` | 5 | `prompt()` banned, Document Settings validation, the API key dialog, a 7,200-frame timeline, timeline zoom |
| `frames-symbol` | 12 | Rectangular timeline selection and dragging it, converting frames with position preserved, keyframe clipping and tween repair, replace-vs-keep, sounds staying on the root, refusals, the dialog, the biped template, posing a fresh biped by IK, and a rig surviving conversion into a symbol |
| `ik` | 11 | Reaching a target, out-of-reach behaviour, chain length, planted parts, joint limits, **rotation-only side effects**, drag-to-IK as one undo step, single-part mode, the panel controls, the limits dialog, persistence |
| `character` | 12 | Parenting not moving a part, a parent swinging its child, compounded rotation, a refused cycle, rig draw order, **stage/export parity on a posed limb**, poses saved/applied/round-tripped, mirroring, Animate Poses, the panel tree, drag-to-pose with one undo, and building a character through the menus |
| `lipsync` | 18 | Silence vs speech, each sound mapping to its own shape, min hold, editable output keyframes, the mouth chart, re-running, the no-sound message, shapes drawn on multi-frame keyframes, a symbol with no `layers`, a collapsed chart being reported, placement inherited onto a new layer, a sound surviving a pass on its own layer, and Set Up Mouth Shapes (creating, charting, tightening, legacy symbols, end-to-end, the menu) |
| `desktop.espec` | 3 | The shell boots and installs its bridge; dirty state reaches the title and the main process; the in-app dialogs work where `prompt()` throws |

`.github/workflows/ci.yml` runs all of them, plus a `node --check` parse pass
over every source file, the packaged-file-list guard, and the version guard.

Every spec was confirmed to **fail against the pre-fix code and pass after**,
which is the only thing that makes them worth having. That check caught three of
its own: a lip-sync assertion that passed for the wrong reason (every shape
resolving to frame 1, because `symbolTotalFrames` returned 1 for an unrevived
symbol), a classifier that mapped "ee" and "oo" to the same mouth, and a
mouth-chart default that silently collapsed every shape onto one drawing when
the symbol's shapes were on multi-frame keyframes — found by running the
feature against a real document rather than a fixture, which is the lesson.

Two things deliberately **not** covered, because a test would hang rather than
fail: the native close dialog (OS-modal, it blocks the main process) and frame
scripts during editor playback (they do not run there by design).

**Why.** Every P0 bug was silent. None of them would surface in review, and
several had clearly survived multiple rounds of changes. `scripts/serve.cjs`
replaces `python -m http.server` so a checkout needs nothing but Node.

Also: `.gitignore` ignored all of `.claude/`, so the one existing project skill —
which documents how to drive the app — was invisible to contributors. It is now
tracked (while local settings stay ignored), and rewritten to match reality.

### ✅ 26. Packaged-file-list guard

**What.** `scripts/check-packaged-files.cjs`, run in CI, checks every local
`src`/`href` in `editor.html` and `index.html` against `build.files` in
`package.json`.

**Why.** Because the source files *are* the build output, `build.files` lists
every asset by hand. Add a script to `editor.html` and forget that list, and the
web build works perfectly while the packaged app 404s it — a failure you only
discover after building an installer and running it. The README warned about
this; now it fails the build instead.

### ✅ 27. Version numbers agree, and cannot drift again

`flashy.js` reported `0.1.0` while `package.json` said `0.2.0` and the splash
card said `v0.2` — three numbers, no two the same, because nothing checked.

`scripts/check-version.cjs` now treats `package.json` as the source of truth
and fails CI when `Flashy.version` or the splash card disagrees;
`npm run version:sync` rewrites both from it, so a release is one edit plus the
script. Current version: **0.3.0**.

### ⬜ 28. Code signing, notarization, auto-update

**What.** `build` has no `win.certificateFile` / Azure Trusted Signing, no
`mac.notarize`, no `publish` provider and no `electron-updater`.

**Why.** An unsigned NSIS installer gets a SmartScreen "unrecognized app" wall
and an unnotarized DMG is blocked outright on current macOS — most downloads
will never become installs. And with no update channel, every fix above requires
users to re-download by hand.

**Blocked on credentials**, not on code: this needs a Windows code-signing
certificate and an Apple Developer ID before it can be wired up.

### ⬜ 29. Split `editor-app.js`

**What.** 4,000 lines in one hand-compressed IIFE: one-character helpers
(`CL`, `CKF`, `s2s`), locals re-declared per switch arm (`kf2`…`kf4`,
`l2`…`l6`), and a 300-line `doAction`. Move to ES modules — `<script
type="module">` keeps the no-build-step promise.

**Why.** This is the root cause of how long the P0 list was. The symbol
rehydration bug and the four divergent renderers were both symptoms of code
nobody can hold in their head at once. Consolidating the renderers (✅ 5) was
the first slice of this; the file is now *longer* in lines but has far fewer
distinct code paths, which is the direction to keep going.

### ⬜ 30. `Import from URL` is broken in the packaged app

**What.** It loads a URL into a same-origin iframe and reads `iWin.__stage`
after a fixed 1500 ms sleep.

**Why.** From the `flashy://app` origin, `http://localhost:8000/...` is
cross-origin, so it always lands in the error path on the desktop — where the
menu item is nevertheless present and enabled. Replace the scrape with a
`postMessage` handshake (and drop the sleep), or hide the item on desktop.

### ⬜ 31. Document the trust boundaries

Three places run code the user did not type, and none of them say so:

- **The AI panel injects model-authored JavaScript** into the page as a
  `<script>`, with full access to `localStorage` — where the API key is kept.
  This is the *point* of the feature, but it should be a stated threat model,
  not an accident. Minimum: say so in the README, move the key out of
  `localStorage` reach on desktop (`safeStorage` behind IPC), and show a diff
  before Apply. A thin proxy would remove browser-held keys entirely and let
  `anthropic-dangerous-direct-browser-access` go away.
- **Frame scripts are compiled with `new Function`** in exported files. That is
  what the feature is, and it is the author's own code in the author's own
  export — but opening *someone else's* `.flashy` and exporting it runs their
  script, exactly as Flash did. Worth a line in the docs.
- **No CSP** on `editor.html` or from the `flashy://` protocol handler.

### ⬜ 32. README drift

It lists a Pen tool that does not exist (`TOOLS` has Paint Bucket and no pen).
The GIF and frame-script claims are now accurate.

---

## Suggested order from here

1. **#13 + #14** — selection across layers and real hit-testing. Together they
   remove the most common "this app is broken" reaction.
2. **#11** — raster images. The biggest single expansion of what people can make.
3. **#18 + #19** — undo coalescing and panel-refresh cost, before documents get
   big enough for it to matter.
4. **#28** — signing and auto-update, as soon as the credentials exist. Until
   then, fixes do not reach anyone who already installed.
5. **#29** — split the file, continuously, as each area is touched.
