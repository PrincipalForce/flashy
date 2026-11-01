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
| Subselection (anchor/Bézier editing) | A | ⬜ | **No way to edit a drawn path after the fact.** Every pencil/brush/traced stroke is final: you can move and scale it, never reshape it. The largest single drawing gap. |
| Free Transform | Q | ✅ | — |
| Gradient / Fill Transform | F | ⬜ | Gradients exist (`fillType`, `fillStops`) but their angle, centre, scale and focal point cannot be dragged. A radial gradient is stuck dead-centre. |
| Lasso (+ polygon mode, magic wand) | L | ⬜ | Only rubber-band marquee selection. Cannot select around overlapping artwork. |
| Pen / Add / Delete / Convert anchor | P | ⬜ | No Bézier drawing at all — Flash's primary precision tool. |
| Text | T | ◐ | Static only — see §6. |
| Line | N | ✅ | — |
| Rectangle (+ primitive, corner radius) | R | ◐ | No corner radius, no primitive re-editing. |
| Oval (+ primitive, start/end angle, inner radius) | O | ◐ | No arc, pie or donut. |
| PolyStar (polygon / star, sides, point size) | — | ⬜ | Missing entirely. |
| Pencil (Straighten / Smooth / Ink modes) | Y | ◐ | No drawing modes. |
| Brush (size, shape, Paint Normal/Fills/Behind/Selection/Inside) | B | ◐ | Fixed round brush, no paint modes. |
| Eraser (+ modes, Faucet) | E | ◐ | Size and round/square shape only; no erase modes, no Faucet. |
| Paint Bucket (+ gap size, Lock Fill) | K | ◐ | No gap closing, no lock fill. |
| Ink Bottle (apply stroke style to a shape) | S | ⬜ | Cannot restyle an existing stroke by clicking it. |
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
| Shape ▸ Smooth / Straighten / Optimize | ⬜ | A traced bitmap or a shaky pencil stroke cannot be cleaned up. `flashy-trace.js` already produces path command streams, so the data is there. |
| Shape ▸ Convert Lines to Fills | ⬜ | Missing. |
| Shape ▸ Expand Fill / Soften Fill Edges | ⬜ | Missing. |
| Shape ▸ Add / Remove Shape Hint | ⬜ | Shape tweens exist but are uncontrollable — no hints means no reliable morph. |
| Combine Objects ▸ Union / Intersect / Punch / Crop | ⬜ | `flashy-geom.js` already implements polygon boolean subtraction for the eraser. The capability exists; it is not exposed. |
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
| Shape tween | ◐ | Interpolates, but no shape hints (above). |
| Easing (named presets) | ◐ | Preset list only — no custom easing curve editor. |
| Tween ▸ Rotate CW/CCW × n | ⬜ | A tween cannot be told to spin; it always takes the short path. |
| Tween ▸ Orient to Path, Snap, Sync, Scale | ⬜ | Missing. |
| **Onion skinning** (+ outlines, marker modes) | ✅ | `drawOnionSkin`, with frame counts either side, ghost and outline modes, and controls in the timeline header. Edit Multiple Frames is still missing. |
| Frame labels | ◐ | `kf.label` is stored and serialized; no UI to set it, no anchor/comment label types. |
| Reverse Frames | ⬜ | Missing. |
| Copy Motion / Paste Motion | ⬜ | Missing. |
| Edit Multiple Frames | ⬜ | Missing. |
| Layer folders | ⬜ | A rig with twenty parts is a flat twenty-row list. |
| Guide layers | ⬜ | No way to keep a reference drawing out of the output. |
| Mask / Masked layers | ✅ | `maskGroups`, `applyMaskClip`. |
| Motion guide layer (tween along a drawn path) | ⬜ | Missing. |
| Layer height / tint / outline view, per layer | ⬜ | Missing. |
| **Scenes** (Insert ▸ Scene, Scene panel, play in order) | ⬜ | The breadcrumb reads "Scene 1" but there is only ever one. |
| Timeline Effects | ⬜ | Missing (low value — Adobe deprecated them too). |

## 4. Symbols and Library

| Feature | Flashy | Gap |
| --- | --- | --- |
| Movie Clip / Graphic / Button behaviours | ✅ | `symbolBehaviorOf`, `BUTTON_STATES`. |
| Button Up/Over/Down/Hit authoring | ◐ | The frames are interpreted, but there is no state-labelled editing view and no interactive preview. |
| Convert to Symbol, Convert Frames to Symbol | ✅ | — |
| Duplicate Symbol | ⬜ | Missing. |
| Swap Symbol (instance → another symbol) | ⬜ | Swap Bitmap exists; the symbol equivalent does not. |
| Library folders, sort, search/filter | ⬜ | Flat list. |
| Unused items / Select Unused | ⬜ | Missing. |
| Symbol linkage (export for ActionScript / class name) | ⬜ | Missing. |
| Shared libraries, runtime sharing | ⬜ | Missing (low value). |
| 9-slice scaling | ⬜ | A scaled button symbol distorts its corners. |
| Edit in Place / Edit in New Window | ◐ | `enterSymbol`/`exitSymbol` is Edit in Place; no new-window edit. |
| Registration / transformation point editing | ⬜ | Missing. |

## 5. Filters and colour effects

| Feature | Flashy | Gap |
| --- | --- | --- |
| Blend modes | ✅ | `blendMode`. |
| Colour effect ▸ Brightness | ⬜ | Missing. |
| Colour effect ▸ Tint | ⬜ | Missing. |
| Colour effect ▸ Alpha | ✅ | `alpha`. |
| Colour effect ▸ Advanced (per-channel multiply + offset) | ⬜ | Missing — the real Flash colour transform. |
| Filters ▸ Drop Shadow | ⬜ | Missing. |
| Filters ▸ Blur | ⬜ | Missing. |
| Filters ▸ Glow | ⬜ | Missing. |
| Filters ▸ Bevel | ⬜ | Missing. |
| Filters ▸ Gradient Glow / Gradient Bevel | ⬜ | Missing. |
| Filters ▸ Adjust Color | ⬜ | Missing. |
| Filter presets, per-filter enable/disable | ⬜ | Missing. |

Flash 8's filter stack is what made late-era Flash look like late-era Flash.
Nothing in Flashy produces a soft shadow or a glow.

## 6. Text

| Feature | Flashy | Gap |
| --- | --- | --- |
| Static text, font, size, bold/italic/underline, align, line height | ✅ | — |
| Dynamic text (bound to a variable, readable by script) | ⬜ | Missing. |
| Input text (user-editable at runtime) | ⬜ | Missing. |
| Instance name / variable name on a text field | ⬜ | Missing. |
| Selectable, Render as HTML, Border/Background | ⬜ | Missing. |
| Line type: single / multiline / multiline-no-wrap / password | ⬜ | Missing. |
| Letter spacing, kerning, baseline shift, super/subscript | ⬜ | Missing. |
| Device fonts vs embedded outlines, character embedding ranges | ⬜ | Missing. |
| Break Apart text → letters → shapes | ⬜ | Missing. |
| Anti-alias mode (device / bitmap / animation / readability) | ⬜ | Missing. |
| Spell check | ⬜ | Missing (low value). |

Without dynamic and input text there is no score display, no form, no typed-in
name — an entire class of Flash content is unreachable.

## 7. ActionScript, debugging and interactivity

| Feature | Flashy | Gap |
| --- | --- | --- |
| Frame scripts (run on frame entry in export) | ✅ | `exportRuntime`. |
| Object handlers (`on` / `onClipEvent`) | ✅ | `flashy-as2.js`, `clipScript`. |
| Actions panel | ◐ | A bare `<textarea>`: no syntax highlighting, no line numbers, no code hints, no Script Assist, no error marking. |
| `trace()` + **Output panel** | ⬜ | `trace()` goes nowhere a user can see. The primary debugging affordance of Flash. |
| Movie Explorer | ⬜ | No structural view — no way to find every instance of a symbol, every script, every text block. |
| Debugger (breakpoints, watch, variable inspector) | ⬜ | Missing. |
| Behaviors panel (scriptless interactivity) | ⬜ | Missing. |
| Components (Button, CheckBox, ComboBox, …) | ⬜ | Missing. |
| Code snippets library | ⬜ | Missing. |
| Button event wiring without code | ⬜ | Missing. |

## 8. Panels

| Panel | Flashy | Gap |
| --- | --- | --- |
| Properties / Property inspector | ✅ | — |
| Color Mixer | ✅ | — |
| Library | ✅ | — |
| Actions | ◐ | §7. |
| **Align** | ✅ | — |
| **Info** (x/y/w/h readout, cursor position) | ✅ | Selection box, pointer position, whether the pointer is on the stage. Colour under cursor is still missing. |
| **Transform** (numeric scale/rotate/skew) | ✅ | Applies to a whole selection, which Properties does not. Copy-and-apply is still missing. |
| **History** (+ replay steps, save as command) | ⬜ | A 50-deep undo stack exists but is invisible. |
| **Output** | ⬜ | §7. |
| **Scene** | ⬜ | §3. |
| Color Swatches (+ load/save palettes, web-safe) | ⬜ | Missing. |
| Movie Explorer | ⬜ | §7. |
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

### Wave 2 — drawing that can be corrected
8. **Subselection tool** — anchor editing on paths and polylines.
9. **Pen tool** — Bézier drawing, add/delete/convert anchors.
10. **PolyStar**, **Lasso** (+ polygon, magic wand), **Ink Bottle**, **Gradient Transform**.
11. **Shape ▸ Smooth / Straighten / Optimize / Convert Lines to Fills / Expand Fill / Soften Edges**.
12. **Combine Objects** — Union, Intersect, Punch, Crop (on `flashy-geom.js`).
13. Rectangle corner radius; oval start/end angle and inner radius; pencil and brush modes.

### Wave 3 — the Flash look
14. **Filters** — drop shadow, blur, glow, bevel, gradient glow/bevel, adjust colour; per-filter enable; honoured in every export path.
15. **Colour effect** — brightness, tint, advanced per-channel transform.
16. **9-slice scaling**.

### Wave 4 — timeline depth
17. **Layer folders**, **guide layers**, layer tint/outline view, layer height.
18. **Scenes** + Scene panel.
19. **Motion guide layers** and **orient to path**.
20. **Custom easing editor**, tween rotate CW/CCW × n, sync/snap/scale.
21. **Shape hints**.
22. **Reverse Frames**, **Edit Multiple Frames**, **Copy/Paste Motion**, frame label types.

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
