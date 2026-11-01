# Flash Parity Audit

What a Flash author (MX 2004 → CS6 muscle memory) reaches for, measured against
what Flashy actually has today. Written from the authoring seat, not the
maintainer's: each gap says what you *cannot do*, because that is what decides
whether it is worth building.

**Status key:** ✅ present · ◐ partial · ⬜ missing

Audited at `0.7.6`. Verified by reading `editor-app.js` (`menus`, `TOOLS`,
`doAction`, `paintObj`, `render`, `updateProps`), not by assumption.

---

## 1. Drawing tools

| Flash tool | Key | Flashy | Gap |
| --- | --- | --- | --- |
| Selection | V | ✅ | — |
| Subselection (anchor/Bézier editing) | A | ✅ | `objectNodes` / `setObjectNode`. Square anchors for a stroke's points and a path's on-curve endpoints, round handles for quadratic controls; a node is written back through the inverse of the painter's own matrix, so it lands under the pointer at any zoom, rotation, skew or scale. |
| Free Transform | Q | ✅ | — |
| Gradient / Fill Transform | F | ✅ | Drags the two points `fillGrad` already stored in bounding-box fractions — which the canvas painter, the SVG exporter and the runtime all read. Focal point is still missing. |
| Lasso (+ polygon mode, magic wand) | L | ✅ | Freeform, corner-to-corner polygon, and a magic wand that selects everything sharing the clicked shape's fill. |
| Pen / Add / Delete / Convert anchor | P | ◐ | Click for a corner, drag for a curve, click the first point to close, double-click or Enter to finish open, Escape to abandon. The command stream carries quadratics, so one drag sets one control point. Add/Delete/Convert anchor are still missing. |
| Text | T | ✅ | All three kinds — see §6. |
| Line | N | ✅ | — |
| Rectangle (+ primitive, corner radius) | R | ◐ | No corner radius, no primitive re-editing. |
| Oval (+ primitive, start/end angle, inner radius) | O | ◐ | No arc, pie or donut. |
| PolyStar (polygon / star, sides, point size) | — | ✅ | Emitted as a `path` object, so it inherits gradients, resizing, the eraser's geometry and all four export paths rather than needing a fifth primitive branch in each. |
| Pencil (Straighten / Smooth / Ink modes) | Y | ✅ | Applied on release, as in Flash. |
| Brush (size, shape, Paint Normal/Fills/Behind/Selection/Inside) | B | ◐ | Size is now its own control, on the bracket keys. Brush shape and the five paint modes are still missing. |
| Eraser (+ modes, Faucet) | E | ◐ | Size and round/square shape only; no erase modes, no Faucet. |
| Paint Bucket (+ gap size, Lock Fill) | K | ◐ | No gap closing, no lock fill. |
| Ink Bottle (apply stroke style to a shape) | S | ✅ | The paint bucket's other half. |
| Eyedropper | I | ✅ | — |
| Hand | H | ✅ | — |
| Zoom | Z | ✅ | — |

## 2. Shape and object editing (Modify menu)

| Command | Flashy | Gap |
| --- | --- | --- |
| Group / Ungroup (Ctrl+G / Ctrl+Shift+G) | ✅ | `groupSelection` / `ungroupSelection`. A group is an object of type `group` carrying `children` plus `groupW`/`groupH`, drawn by all four render paths. |
| Break Apart (Ctrl+B) | ✅ | `breakApartSelection` — group, symbol instance, and text to one object per character. A bitmap is declined with a pointer to Trace Bitmap. |
| Arrange ▸ Bring to Front / Forward / Backward / Send to Back | ✅ | `arrangeSelection`, on Flash's Ctrl+Up / Ctrl+Shift+Up accelerators. |
| Transform ▸ Flip Horizontal / Vertical | ✅ | `transformSelection`. A flip is a negative scale about the object's own centre, so it mirrors in place. |
| Transform ▸ Rotate 90° CW / CCW | ✅ | — |
| Transform ▸ Scale and Rotate… (numeric) | ✅ | Ctrl+Alt+S, plus the Transform panel. |
| Transform ▸ Remove Transform | ✅ | Ctrl+Shift+Z. |
| Shape ▸ Smooth / Straighten / Optimize | ✅ | `shapeCleanup`, over both artwork representations. Smooth re-emits a path with curve fitting rather than adding corners; Straighten and Optimize run the tracer's own Douglas–Peucker, now exported so there is one implementation. |
| Shape ▸ Convert Lines to Fills | ✅ | The stroke becomes the area it swept, so it scales without changing width and the bucket and eraser can reach it. |
| Shape ▸ Expand Fill / Soften Fill Edges | ✅ | `offsetRegion` grows or shrinks a region by banding its outline; Soften does it in fading steps, and the halo stays a vector. |
| Shape ▸ Add / Remove Shape Hint | ✅ | Lettered markers, draggable on the stage, driving the morph's parameter map: one hint offsets the correspondence, several reparameterise it piecewise. |
| Combine Objects ▸ Union / Intersect / Punch / Crop | ✅ | `combineSelection`. Punch and Crop use the topmost shape as the tool and discard it; the shapes below keep their own styles. |
| Align ▸ (left/centre/right, top/middle/bottom, distribute, match size, space evenly, to stage) | ✅ | The Align panel, with To Stage. Distribute spreads centres, Space evenly spreads gaps — both, because they differ whenever the objects do. |
| Distribute to Layers | ✅ | `distributeToLayers`, naming each layer after what it holds. |
| Snap ▸ to Objects / to Pixels / to Guides | ✅ | `snapBox` snaps the selection's bounding box to other objects' edges and centres, the stage, and the guides, with an alignment line drawn for whatever it matched. Alt suspends it. |
| Rulers, Guides, Edit Guides | ✅ | Rulers drawn on the stage canvas (one coordinate system, so the ticks cannot drift from the zoom); drag one out to create a guide, drag a guide off the stage to delete it. Guides save with the document and never export. |
| Find and Replace | ⬜ | Missing. |

## 3. Timeline and animation

| Feature | Flashy | Gap |
| --- | --- | --- |
| Keyframes, blank keyframes, frames, spans | ✅ | — |
| Motion tween | ✅ | — |
| Shape tween | ✅ | A real outline morph (`Flashy.Morph`). It used to interpolate the two objects' boxes and transforms — a rectangle tweened to an oval stayed a rectangle the whole way and then snapped. |
| Easing (named presets + custom curve) | ✅ | Fourteen presets plus a draggable cubic-Bézier curve. One resolver (`Flashy.Easing.resolve`) shared with the exported player, so a custom curve cannot ease one way while authoring and another way in the movie. |
| Tween ▸ Rotate CW/CCW × n | ✅ | `rotateTimes` is how many times it goes round, counting a partial turn as part of the first — so 0°→350° clockwise once is 350°, and 0°→0° twice is 720°. |
| Tween ▸ Orient to Path, Scale | ✅ | Orient to Path turns the object to face along its motion guide. Snap and Sync are still missing. |
| **Onion skinning** (+ outlines, marker modes) | ✅ | `drawOnionSkin`, with frame counts either side, ghost and outline modes, and controls in the timeline header. Edit Multiple Frames is still missing. |
| Frame labels (+ name / comment / anchor) | ✅ | It was stored, serialized and read by the exporter, and there was no way to set one — so `gotoAndPlay("menu")` was unreachable from the authoring side. Labels now draw on the timeline as flags, and a COMMENT is deliberately not exported: making `gotoAndPlay("fix this bit")` work would be wrong. |
| Reverse Frames | ✅ | Reverses the spans, not merely the list, and shifts each tween back one — a tween belongs to the pair of keyframes it spans and is stored on the earlier one, so reversing without the shift leaves the last keyframe tweening into nothing. |
| Copy Motion / Paste Motion | ✅ | Samples the transform track frame by frame through the real interpolator, so a pasted motion reproduces the easing as well as the positions. The artwork is not copied — that is Paste Frames. |
| Edit Multiple Frames | ✅ | Every keyframe in the onion range becomes live and selectable at once, sharing the onion markers as Flash's did. It works because selection is a list of object references and a drag writes straight to `o.x`/`o.y`. |
| Layer folders | ✅ | The same flat-list-with-a-run idiom mask layers already use: a layer of type `folder`, and the layers beneath it at a greater `indent` are its contents. No tree to keep consistent, and reordering cannot orphan anything. Collapsing hides rows, never artwork. |
| Guide layers | ✅ | Marked, shown on the stage and in onion skin, and stripped from every output — including out of the published file, not merely skipped by the player. |
| Mask / Masked layers | ✅ | `maskGroups`, `applyMaskClip`. |
| Motion guide layer (tween along a drawn path) | ✅ | `Flashy.MotionGuide` samples the path by ARC LENGTH, not by vertex index — indexing makes an object crawl through the bends and bolt down the straights. The guide layer is drawn as dashed chrome and never exported, but stays in the output layer list so the player can still read the path. |
| Layer height / outline view, per layer | ✅ | Both were already stored, serialized and read by nothing — the inspector offered Short/Normal/Tall and an outline colour, and the layer list drew every row at a fixed 20px with no outline mode anywhere. The timeline no longer assumes `index * 20`. Per-layer tint is still missing. |
| **Scenes** (Insert ▸ Scene, Scene panel, play in order) | ✅ | `doc.scenes`, with `doc.layers` a live alias of the current scene rather than a copy — the whole editor reaches `doc.layers` directly, and an alias cannot drift out of sync with a copy that does not exist. An export lays them end to end on one timeline with each name as a frame label, so `gotoAndPlay("Scene 2")` works. |
| Timeline Effects | ⬜ | Missing (low value — Adobe deprecated them too). |

## 4. Symbols and Library

| Feature | Flashy | Gap |
| --- | --- | --- |
| Movie Clip / Graphic / Button behaviours | ✅ | `symbolBehaviorOf`, `BUTTON_STATES`. |
| Button Up/Over/Down/Hit authoring | ◐ | The frames are interpreted, but there is no state-labelled editing view and no interactive preview. |
| Convert to Symbol, Convert Frames to Symbol | ✅ | — |
| Duplicate Symbol | ✅ | A deep copy through the serializer — anything shallower leaves the duplicate sharing structure with the original, which is the bug group children and filter stacks both had. |
| Swap Symbol (instance → another symbol) | ✅ | The instance keeps its position, size and transform: swapping is replacing what is drawn, not where it is. |
| Library folders, sort, search/filter | ✅ | A folder is a path on the item rather than a tree beside it, so it cannot get out of step with what it describes and needs no migration. Sort by name, kind, use or folder; a search flattens the grouping. |
| Unused items / Select Unused | ✅ | Every row shows its use count; the dialog lists what nothing refers to and deletes it in one undo step. Items used only INSIDE another symbol count as used. |
| Symbol linkage (export for ActionScript / class name) | ✅ | And it does something: the exported player registers linked symbols and `attachMovie(name, instance, depth)` — until now a stub that logged a warning — builds one. A clip a script attached survives the root's display-list rebuild. |
| Shared libraries, runtime sharing | ⬜ | Missing (low value). |
| 9-slice scaling | ✅ | `Flashy.Slice9` — the cell maths once, shared by the stage, the SVG export and the `NineSlice` container the exported player uses. Guides are set in Symbol Properties. |
| Edit in Place / Edit in New Window | ◐ | `enterSymbol`/`exitSymbol` is Edit in Place; no new-window edit. |
| Registration / transformation point editing | ⬜ | Missing. |

## 5. Filters and colour effects

| Feature | Flashy | Gap |
| --- | --- | --- |
| Blend modes | ✅ | `blendMode`. |
| Colour effect ▸ Brightness | ✅ | A multiply AND an offset, as Flash defined it — CSS `brightness()` is a plain multiply and leaves black black. |
| Colour effect ▸ Tint | ✅ | Interpolates the artwork towards a colour by an amount. |
| Colour effect ▸ Alpha | ✅ | `alpha`. |
| Colour effect ▸ Advanced (per-channel multiply + offset) | ✅ | All three modes reduce to one channel transform, run as a real pixel pass. |
| Filters ▸ Drop Shadow | ✅ | — |
| Filters ▸ Blur | ✅ | Isotropic on canvas (the `filter` property has no anisotropic blur, so the two radii are averaged); exact in the SVG export, which can express both. |
| Filters ▸ Glow | ✅ | `strength` is how many times the glow is laid over itself, as in Flash. |
| Filters ▸ Bevel | ✅ | A highlight and a shadow on opposite sides. |
| Filters ▸ Gradient Glow / Gradient Bevel | ⬜ | Still missing — the only two of the seven not covered. |
| Filters ▸ Adjust Color | ✅ | Brightness, contrast, saturation, hue. |
| Filter presets, per-filter enable/disable | ◐ | Enable, disable, reorder and remove per filter. Saved presets are still missing. |

**Two mechanisms, deliberately.** Filters are geometric — a blur has to see the
shape's neighbourhood — so they go through the canvas `filter` property applied
to a whole composite, never per drawing operation (a stroked shape would
otherwise get two drop shadows, one printed over the fill). Colour transforms
are per-pixel and exact, because CSS filter functions cannot express a
per-channel multiply plus offset at all. `Flashy.Filters` is the one
implementation of both, shared by the authoring stage, the raster exports and
the exported player.

## 6. Text

| Feature | Flashy | Gap |
| --- | --- | --- |
| Static text, font, size, bold/italic/underline, align, line height | ✅ | — |
| Dynamic text (bound to a variable, readable by script) | ✅ | The clip's `text` proxies the field, and a named instance is published on the root, so `root.score.text = "10"` works in a frame script. |
| Input text (user-editable at runtime) | ✅ | Click to focus, type, caret, Backspace/Delete/arrows/Home/End, `maxChars`. The Stage's hit test learned about text fields — it only matched nodes with `graphics`, so a field could never be clicked into. |
| Instance name / variable name on a text field | ✅ | Both; a variable-bound field also publishes its value on the root. |
| Selectable, Border/Background | ◐ | Selectable, border and background, with their own colours, honoured on the stage and in the SVG export. Render as HTML is still missing. |
| Line type: single / multiline / multiline-no-wrap / password | ✅ | Multiline wraps at the box width; single collapses newlines rather than silently overflowing; password masks. |
| Letter spacing | ◐ | Letter spacing, applied by walking the string rather than relying on the canvas `letterSpacing` property an export cannot count on. Kerning, baseline shift and super/subscript remain. |
| Device fonts vs embedded outlines, character embedding ranges | ⬜ | Missing. |
| Break Apart text → letters → shapes | ✅ | `textToCharacters` — one object per glyph, measured with the painter's own metrics so each piece lands where its letter was. Letters to shapes needs the pen outlines the browser does not expose. |
| Anti-alias mode (device / bitmap / animation / readability) | ◐ | Recorded on the field and said to be a record — the canvas has one text rasteriser and no way to pick another, so claiming it changes the pixels would be a lie. |
| Spell check | ⬜ | Missing (low value). |

Without dynamic and input text there is no score display, no form, no typed-in
name — an entire class of Flash content is unreachable.

## 7. ActionScript, debugging and interactivity

| Feature | Flashy | Gap |
| --- | --- | --- |
| Frame scripts (run on frame entry in export) | ✅ | `exportRuntime`. |
| Object handlers (`on` / `onClipEvent`) | ✅ | `flashy-as2.js`, `clipScript`. |
| Actions panel | ✅ | Line numbers, syntax highlighting, a live syntax check through the same `new Function` the player compiles with, the broken line marked in the gutter, API chips (Flash's Script Assist), and Tab that indents instead of leaving the field. The textarea still holds the text, so the caret, selection, undo and IME behaviour stay the browser's own. |
| `trace()` + **Output panel** | ✅ | `Flashy.Output` is the sink; the panel lists it, clears and copies. `trace()` is now in scope for a JavaScript frame script too — it was in scope for an imported movie's ActionScript and not for a script written here, which was backwards. Test Movie runs in its own window and forwards its lines back. |
| Movie Explorer | ✅ | Every scene, layer, frame, object and library item, with Flash's five filters and a search. Click a row to go to it. Reaches parked scenes, not just the open one. |
| Debugger (breakpoints, watch, variable inspector) | ⬜ | Missing. |
| Behaviors panel (scriptless interactivity) | ✅ | Eleven behaviours across six events, written as Flash's own `on(release) { … }` handlers — which flashy-as2.js already runs. They stack rather than replacing each other, and stay editable as code in the Actions panel. |
| Components (Button, CheckBox, ComboBox, …) | ⬜ | Missing. |
| Code snippets library | ◐ | The API chips insert working calls at the caret. A saved, user-editable snippet library is still missing. |
| Button event wiring without code | ✅ | The Behaviors panel. |

## 8. Panels

| Panel | Flashy | Gap |
| --- | --- | --- |
| Properties / Property inspector | ✅ | — |
| Color Mixer | ✅ | — |
| Library | ✅ | — |
| Actions | ✅ | §7. |
| **Align** | ✅ | — |
| **Info** (x/y/w/h readout, cursor position) | ✅ | Selection box, pointer position, whether the pointer is on the stage. Colour under cursor is still missing. |
| **Transform** (numeric scale/rotate/skew) | ✅ | Applies to a whole selection, which Properties does not. Copy-and-apply is still missing. |
| **History** (+ replay steps, save as command) | ◐ | The stack is listed, named after the command that made each step, and clicking one steps back to it. Replay and save-as-command are still missing. |
| **Output** | ✅ | §7. |
| **Scene** | ✅ | §3. |
| Color Swatches (+ load/save palettes, web-safe) | ⬜ | Missing. |
| Movie Explorer | ✅ | §7. |
| Accessibility | ⬜ | Missing (low value). |
| Strings / localisation | ⬜ | Missing (low value). |
| Dockable workspace, saved layouts | ✅ | `workspace.js`. |

## 9. Sound

| Feature | Flashy | Gap |
| --- | --- | --- |
| Import, attach to keyframe, waveform in timeline | ✅ | `drawWaveform`. |
| Sync: Event / Start / Stop / Stream | ◐ | `sound.sync` is stored; Stop is not honoured. |
| Loop / repeat count | ◐ | Boolean loop, no repeat count. |
| **Edit Envelope** (fade in/out, custom volume envelope, pan, L/R) | ⬜ | No sound editing at all. |
| Effect presets (Fade In, Fade Out, Fade L→R, Custom) | ⬜ | Missing. |
| Per-sound compression / export settings | ⬜ | Missing. |
| Auto lip sync | ✅ | Beyond Flash — a genuine Flashy advantage. |

## 10. Publishing

| Feature | Flashy | Gap |
| --- | --- | --- |
| Export HTML, sprite sheet, video, SVG, JS module, embed snippet | ✅ | — |
| **Publish Settings** (one dialog, multiple targets, remembered per document) | ⬜ | Six separate menu items, no persisted settings. |
| HTML template, dimensions, playback, quality, scale, alignment | ⬜ | Missing. |
| **Bandwidth Profiler / Size Report** | ⬜ | No way to see what is making a movie heavy. |
| Protect from import, omit trace actions | ⬜ | Missing. |
| SWF export | ⬜ | Flashy *reads* `.swf` and `.fla` but cannot write either. |

## 11. Document and workflow

| Feature | Flashy | Gap |
| --- | --- | --- |
| Document Settings (size, fps, background) | ✅ | — |
| Match stage size to contents / printer | ⬜ | Missing. |
| Templates / New from Template | ⬜ | Missing. |
| Recent files | ◐ | Desktop shell only. |
| Save As / Save a Copy / Revert | ◐ | Save As exists; no Revert. |
| Preferences | ✅ | — |
| Keyboard shortcut customisation | ⬜ | Missing. |
| Multiple documents / tabs in one window | ◐ | Desktop opens one document per window. |
| AI Assistant | ✅ | Beyond Flash. |
| SWF/FLA/XFL import, AVM1 + ABC decompilation | ✅ | Well beyond Flash. |

---

## Build order

Ordered by what it costs an animator to live without, not by effort.

### ✅ Wave 1 — you cannot animate without these (shipped)
1. ✅ **Onion skinning** — previous/next frames ghosted, outline mode, adjustable range.
2. ✅ **Align panel** — align, distribute, match size, space evenly, relative to stage.
3. ✅ **Group / Ungroup** and **Break Apart**.
4. ✅ **Arrange** — forward/backward single steps, on Flash's shortcuts.
5. ✅ **Transform** — flip H/V, rotate 90° CW/CCW, numeric scale-and-rotate, remove transform.
6. ✅ **Info** and **Transform** panels.
7. ✅ **Snap to objects**, **rulers**, **guides**.

Found and fixed on the way: `skewX`/`skewY` had been on every object since the
beginning, were serialized, and were honoured by the engine — and were applied
by no render path and set by no UI. The Transform panel is the first thing that
writes them, so the stage, the SVG export, the runtime export, the tween
interpolator and the eraser's matrix all learned to read them.

Covered by `tests/object-editing.spec.js` (21 specs).

### ✅ Wave 2 — drawing that can be corrected (shipped)
8. ✅ **Subselection tool** — anchor editing on paths and polylines.
9. ◐ **Pen tool** — Bézier drawing. Add/Delete/Convert anchor still to do.
10. ✅ **PolyStar**, **Lasso** (+ polygon, magic wand), **Ink Bottle**, **Gradient Transform**.
11. ✅ **Shape ▸ Smooth / Straighten / Optimize / Convert Lines to Fills / Expand Fill / Soften Edges**.
12. ✅ **Combine Objects** — Union, Intersect, Punch, Crop (on `flashy-geom.js`).
13. ◐ Pencil modes and brush size shipped; rectangle corner radius and oval
    start/end angle and inner radius still to do.

The tool-options strip under the toolbox is now declarative, one spec per tool.
It had the eraser's two controls hard-coded into `buildToolbox`, which is why
no tool added since had anywhere to put its own.

Tool keys are Flash's: A Subselection, P Pen, L Lasso, S Ink Bottle,
F Gradient Transform. The Pose tool held A and has moved to **W** — Pose is a
Flashy invention, Subselection is a tool every Flash author's hands already
know, and when the two collide the migrating hands win.

Covered by `tests/shape-tools.spec.js` (30 specs).

### ✅ Wave 3 — the Flash look (shipped)
14. ✅ **Filters** — drop shadow, blur, glow, bevel, adjust colour; per-filter
    enable, reorder and remove; honoured on the stage, in the raster exports,
    in the SVG export and in the exported player. Gradient glow and gradient
    bevel remain.
15. ✅ **Colour effect** — brightness, tint, advanced per-channel transform.
16. ✅ **9-slice scaling** — `Flashy.Slice9`, with the guides in a new Symbol
    Properties dialog.

Filters and the colour effect tween between keyframes, which is how a glow
pulses and a tint fades. Only when the two keyframes agree about the shape of
the stack, because there is no sensible interpolation between "blur" and "drop
shadow" and guessing one gives a frame that is neither.

Found on the way: `filters` is an array of OBJECTS, which is the same trap
group children fell into in Wave 1 — `clone()` copies arrays with a shallow
slice, so two copies of an object would have shared their filter specs.

Covered by `tests/filters.spec.js` (17 specs) and `tests/nine-slice.spec.js`
(12 specs).

### ✅ Wave 4 — timeline depth (shipped)
17. ✅ **Layer folders**, **guide layers**, outline view, layer height. (Per-layer tint remains.)
18. ✅ **Scenes** + Scene panel.
19. ✅ **Motion guide layers** and **orient to path**.
20. ✅ **Custom easing editor**, tween rotate CW/CCW × n, scale. (Snap and sync remain.)
21. ✅ **Shape hints** — and the shape tween they steer, which did not morph at all before.
22. ✅ **Reverse Frames**, **Edit Multiple Frames**, **Copy/Paste Motion**, frame label types.

Four things in this wave were features that existed in the UI and the save
format and did nothing: `layerHeight`, `outlineColor`, a layer marked `guide`
(which was published anyway), and `kf.label` (which no UI could set, so
`gotoAndPlay("menu")` was unreachable from the authoring side). A fifth, the
shape tween, did something — just not the thing it is named after.

Covered by `tests/layers-scenes.spec.js` (16), `tests/tween-frames.spec.js`
(15) and `tests/morph-guide.spec.js` (13).

### Wave 5 — text and interactivity
23. **Dynamic and input text**, instance/variable names, selectable, HTML, border, line type, letter spacing, anti-alias mode, break apart text.
24. **Output panel** and a `trace()` that reaches it.
25. **Actions panel upgrade** — line numbers, syntax highlighting, error marking, code hints.
26. **Behaviors panel** and a **component set**.

### Wave 6 — library, sound, publishing
27. **Library folders**, search, duplicate symbol, swap symbol, unused items, linkage names.
28. **Sound Edit Envelope** + effect presets, sync Stop, repeat count.
29. **Publish Settings** — one dialog, persisted per document.
30. **Bandwidth Profiler / Size Report**.
31. **Movie Explorer**, **History panel**, **Color Swatches**.
32. **SWF export** — close the loop on the importer.
