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
| Pen / Add / Delete / Convert anchor | P | ✅ | Click for a corner, drag for a curve, click the first point to close, double-click or Enter to finish open, Escape to abandon. The command stream carries quadratics, so one drag sets one control point. With nothing in progress a click adds an anchor on a segment or removes one on an anchor, and Alt-click converts between corner and curve; adding on a curve splits by de Casteljau, so the outline does not move. |
| Text | T | ✅ | All three kinds — see §6. |
| Line | N | ✅ | — |
| Rectangle (+ primitive, corner radius) | R | ✅ | Corner radius is a property, re-editable forever, resolved through `Flashy.Primitives` by all six consumers. |
| Oval (+ primitive, start/end angle, inner radius) | O | ✅ | Arc, pie and donut, 0° at 12 o'clock, inner radius as a percentage. |
| PolyStar (polygon / star, sides, point size) | — | ✅ | Emitted as a `path` object, so it inherits gradients, resizing, the eraser's geometry and all four export paths rather than needing a fifth primitive branch in each. |
| Pencil (Straighten / Smooth / Ink modes) | Y | ✅ | Applied on release, as in Flash. |
| Brush (size, shape, Paint Normal/Fills/Behind/Selection/Inside) | B | ✅ | Size on the bracket keys, nine tips as nine distance metrics, and all five paint modes. A shaped tip or a non-Normal mode commits a filled `path` — which is what Flash’s brush always produced. |
| Eraser (+ modes, Faucet) | E | ✅ | Size, round/square shape, all five erase modes, and the Faucet. The modes are a filter in front of one unchanged erase: only which objects are offered to it changes. |
| Paint Bucket (+ gap size, Lock Fill) | K | ✅ | Gap closing as a pixel count, and Lock Fill. An empty click floods: the frame is rasterised, the ink dilated by the gap, flooded, dilated back to meet the lines, and traced through the same marching-squares contour tracer a brush stroke uses. |
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
| Find and Replace | ✅ | Text, font, colour and symbol, across nested groups, every scene and every library symbol — one walker, so the hiding places cannot be forgotten per kind. Match case, whole word and regex on text; a live results list that navigates to each hit. |

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
| Timeline Effects | ✅ | Eight effects — Blur, Expand, Explode, Transform, Transition, Drop Shadow, Copy to Grid, Distributed Duplicate — generated as ORDINARY keyframes with the spec kept on the first one, so they are editable, re-runnable and removable. Adobe dropped them because the generated frames were opaque; these are not. |

## 4. Symbols and Library

| Feature | Flashy | Gap |
| --- | --- | --- |
| Movie Clip / Graphic / Button behaviours | ✅ | `symbolBehaviorOf`, `BUTTON_STATES`. |
| Button Up/Over/Down/Hit authoring | ✅ | The timeline names frames 1–4 Up/Over/Down/Hit while a Button symbol is open, and Control ▸ Enable Simple Buttons makes buttons respond to the pointer on the stage. The Hit frame is never drawn — it says where the button can be clicked. |
| Convert to Symbol, Convert Frames to Symbol | ✅ | — |
| Duplicate Symbol | ✅ | A deep copy through the serializer — anything shallower leaves the duplicate sharing structure with the original, which is the bug group children and filter stacks both had. |
| Swap Symbol (instance → another symbol) | ✅ | The instance keeps its position, size and transform: swapping is replacing what is drawn, not where it is. |
| Library folders, sort, search/filter | ✅ | A folder is a path on the item rather than a tree beside it, so it cannot get out of step with what it describes and needs no migration. Sort by name, kind, use or folder; a search flattens the grouping. |
| Unused items / Select Unused | ✅ | Every row shows its use count; the dialog lists what nothing refers to and deletes it in one undo step. Items used only INSIDE another symbol count as used. |
| Symbol linkage (export for ActionScript / class name) | ✅ | And it does something: the exported player registers linked symbols and `attachMovie(name, instance, depth)` — until now a stub that logged a warning — builds one. A clip a script attached survives the root's display-list rebuild. |
| Shared libraries, runtime sharing | ◐ | Author-time sharing: import symbols (and the bitmaps and sounds they use) out of another .flashy, with `sharedFrom` recording the origin so Update can fetch a newer version in place. Runtime sharing is deliberately not done — it needs a second file that has to still be there, which is most of why Flash content rotted. |
| 9-slice scaling | ✅ | `Flashy.Slice9` — the cell maths once, shared by the stage, the SVG export and the `NineSlice` container the exported player uses. Guides are set in Symbol Properties. |
| Edit in Place / Edit in New Window | ✅ | `enterSymbol`/`exitSymbol` is Edit in Place. Edit in New Window sends the symbol to a second editor window AS A DOCUMENT — a .flashy in both directions — so the other window is just the editor and needs to know nothing. Save there sends it back; the symbol’s contents are replaced and the entry kept, so its instances are never orphaned. |
| Registration / transformation point editing | ✅ | A registration point as a fraction of the object’s box — so it survives a resize — editable in the inspector and draggable on the stage as a crosshair. Defaults to the centre, so no existing document moves. It drives a guided tween’s Snap. |

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
| Filters ▸ Gradient Glow / Gradient Bevel | ✅ | The blurred alpha silhouette looked up in a ramp, which is how Flash built them. One ramp in `Flashy.Filters` feeds the canvas pass, the SVG export (blur `SourceAlpha`, alpha into RGB, one `feComponentTransfer` table per channel), the exported player and the tween. |
| Filters ▸ Adjust Color | ✅ | Brightness, contrast, saturation, hue. |
| Filter presets, per-filter enable/disable | ✅ | Enable, disable, reorder, remove, and named presets in localStorage — applied as a deep copy per object, so editing one instance’s blur cannot change another’s. |

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
| Selectable, Border/Background | ✅ | Selectable, border and background with their own colours, and Render as HTML — one markup parser (`Flashy.RichText`) feeding the stage, the raster exports, the player and the SVG’s tspan runs. |
| Line type: single / multiline / multiline-no-wrap / password | ✅ | Multiline wraps at the box width; single collapses newlines rather than silently overflowing; password masks. |
| Letter spacing | ✅ | Letter spacing by walking the string, auto-kern (which really is a choice between the whole-string and per-character draw paths), baseline shift, and super/subscript as a shift plus a smaller face. |
| Device fonts vs embedded outlines, character embedding ranges | ✅ | `_sans`, `_serif` and `_typewriter` map onto the generic families every browser has. Embedding traces each glyph with the project’s own tracer — no font parser needed — into a 0..1 em path table, with five character ranges and a per-field switch. Only the faces a field asks for are exported. |
| Break Apart text → letters → shapes | ✅ | `textToCharacters` — one object per glyph, measured with the painter's own metrics so each piece lands where its letter was. Letters to shapes needs the pen outlines the browser does not expose. |
| Anti-alias mode (device / bitmap / animation / readability) | ✅ | It changes the pixels now. Bitmap thresholds the field’s own alpha to on-or-off, readability snaps glyphs onto the pixel grid, device substitutes the player’s family, and animation stays smooth so sub-pixel motion does not shimmer. |
| Spell check | ◐ | A proofreader rather than a dictionary: doubled words, a table of known misspellings, unmatched quotes and brackets, double spaces, mixed quote styles, with one-click fixes and a personal dictionary. No general English word list — one big enough to avoid false positives would be larger than the editor, and a check that flags every proper noun gets switched off. |

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
| Debugger (breakpoints, watch, variable inspector) | ✅ | Breakpoints in the Actions gutter, real stepping, a watch list and a variable inspector. The script is recompiled as a GENERATOR with a `yield` before each statement, so it genuinely pauses; the generator hands out an `eval` closure so its own locals can be read and written. JavaScript frame scripts only — ActionScript is compiled by the AS2 runtime. |
| Behaviors panel (scriptless interactivity) | ✅ | Eleven behaviours across six events, written as Flash's own `on(release) { … }` handlers — which flashy-as2.js already runs. They stack rather than replacing each other, and stay editable as code in the Actions panel. |
| Components (Button, CheckBox, RadioButton, TextInput, Slider, ProgressBar, ComboBox) | ✅ | Built as ordinary library symbols with handlers, the way Flash’s own were — so a component is editable, exports through the existing paths and needs no new runtime. The ComboBox’s dropdown is its second frame, which is where Flash put one too. |
| Code snippets library | ✅ | The API chips insert working calls at the caret, and a saved snippet library sits beside them: the selection (or the whole script) saved under a name in localStorage, inserted at the caret, shift-click to delete. |
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
| **History** (+ replay steps, save as command) | ✅ | The stack is listed, named after the command that made each step, and clicking one steps back to it. Replay re-runs the COMMANDS behind recent steps against the document as it is now, and a run can be saved as a named command. |
| **Output** | ✅ | §7. |
| **Scene** | ✅ | §3. |
| Color Swatches (+ load/save palettes, web-safe) | ✅ | Three palettes: the colours this document already uses (most-used first, gathered from fills, strokes, gradient stops, filters and every symbol), the web-safe 216, and your own. Click for fill, Shift-click for stroke — and a selected object is recoloured too. |
| Movie Explorer | ✅ | §7. |
| Accessibility | ✅ | A name and description per document and per object, plus a per-object switch. The export writes a real text alternative — ARIA on the canvas and a hidden list of the named objects — because a canvas is one opaque rectangle to a screen reader and one `alt` string cannot carry a sequence. |
| Strings / localisation | ✅ | A per-document table keyed by string ID and language, CSV in and out for translators, auto-assigned IDs seeded from the authored text, and a fallback chain so a missing translation shows the original rather than going blank. One exported file serves every language: `stage.setLanguage()` switches at runtime. |
| Dockable workspace, saved layouts | ✅ | `workspace.js`. |

## 9. Sound

| Feature | Flashy | Gap |
| --- | --- | --- |
| Import, attach to keyframe, waveform in timeline | ✅ | `drawWaveform`. |
| Sync: Event / Start / Stop / Stream | ✅ | Stop now silences the asset — including an event sound fired long ago, which is the only reading that makes it useful. It was in the save format and honoured by nothing. |
| Loop / repeat count | ✅ | Both, and they are different things: loop is forever, repeat 3 is three times and then silence. A BufferSource has no loop count, so a repeat is a loop with a scheduled stop. |
| **Edit Envelope** (fade in/out, custom volume envelope, pan, L/R) | ✅ | Two draggable lanes over the sound's own waveform — an envelope is drawn against what you can hear. Scheduled on a real GainNode and StereoPannerNode rather than polled, so it stays accurate while the main thread is busy drawing. |
| Effect presets (Fade In, Fade Out, Fade L→R, Fade R→L, Left, Right, Custom) | ✅ | `Flashy.SoundTrack.envelopeFor` is the one table, so the dialog, the authoring preview and the published movie cannot disagree about what "Fade In" is. Picking a preset fills the curve in, so you can start from one and adjust it. |
| Per-sound compression / export settings | ◐ | Per-asset rate, mono and trim-silence, with the before and after size shown. No MP3 encoder: the decoded samples are made mono, resampled and trimmed and written back as WAV. A setting that would make a file BIGGER is reported and skipped. |
| Auto lip sync | ✅ | Beyond Flash — a genuine Flashy advantage. |

## 10. Publishing

| Feature | Flashy | Gap |
| --- | --- | --- |
| Export HTML, sprite sheet, video, SVG, JS module, embed snippet | ✅ | — |
| **Publish Settings** (one dialog, multiple targets, remembered per document) | ✅ | One dialog, saved with the document, and a Publish command (Ctrl+F12) that produces every ticked target in sequence — sequentially because five downloads fired at one instant is how a browser decides to block four of them. |
| HTML template, dimensions, playback, scale | ✅ | Page title, background, loop, four scale modes, nine-way alignment, and a user template using Flash’s own `$XX$` placeholders — `$MOVIE$` is the whole movie, so a template cannot accidentally ship half of it. |
| **Bandwidth Profiler / Size Report** | ✅ | Weight by kind and by asset, heaviest first, with a share bar per line; the busiest frame; and download times at 3G, 4G and broadband. Measured from the EXPORT document, so guides and scene structure are not counted — they are not published either. |
| Protect from import, omit trace actions | ✅ | Both in Publish Settings. Omit Trace Actions strips `trace()` statements out of the exported copy, conservatively — only a balanced statement on its own line goes, because a regex loose enough to catch every shape of trace can cut a line in half. Protect from Import is a marker, which is all it ever was. |
| SWF export | ✅ | Shapes, symbols, frames, labels, transforms, alpha — and text (DefineFont2 from traced glyph outlines + DefineText2), bitmaps (DefineBitsJPEG2 byte-for-byte, or DefineBitsLossless2 via a stored-block zlib writer), sound (DefineSound as raw PCM + StartSound), filters (PlaceObject3), and frame scripts (a five-verb AS2 assembler). Anything it cannot write is named, including the script line that stopped it. The project's own parser is the oracle. |

## 11. Document and workflow

| Feature | Flashy | Gap |
| --- | --- | --- |
| Document Settings (size, fps, background) | ✅ | — |
| Match stage size to contents / printer | ✅ | Match Stage Size to Contents measures every frame through each object’s own matrix. Match Stage to Paper sizes it to A3–A5, Letter or Legal at 72dpi less a half-inch margin, and does NOT move the artwork — the point is to see what fits. Print rasterises a frame range as sheets or a contact sheet. |
| Templates / New from Template | ✅ | Three built-ins — banner, slideshow, looping sprite — each a real document loaded through the ordinary path, not a list of settings. |
| Recent files | ✅ | Desktop shell by path; the browser keeps the documents themselves in localStorage, newest first, deduplicated and bounded. A document too big to keep a copy of is listed by NAME with the reason, rather than quietly evicting the others. |
| Save As / Save a Copy / Revert | ✅ | Save As, Save a Copy (which deliberately does NOT mark the document saved) and Revert, which keeps a copy of the saved document rather than relying on undo history. |
| Preferences | ✅ | — |
| Keyboard shortcut customisation | ✅ | Any menu command bindable to a chord, stored in localStorage. Overrides are consulted BEFORE the built-in chain rather than replacing it, so the defaults keep their careful ordering. |
| Multiple documents / tabs in one window | ✅ | A tab bar, hidden while only one document is open. A tab is a serialised document plus a name, so switching is parking one and loading another through the paths that already exist — including its playhead and its unsaved state. The last document cannot be closed. |
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
9. ✅ **Pen tool** — Bézier drawing, plus add, delete and convert anchor (see Wave 7).
10. ✅ **PolyStar**, **Lasso** (+ polygon, magic wand), **Ink Bottle**, **Gradient Transform**.
11. ✅ **Shape ▸ Smooth / Straighten / Optimize / Convert Lines to Fills / Expand Fill / Soften Edges**.
12. ✅ **Combine Objects** — Union, Intersect, Punch, Crop (on `flashy-geom.js`).
13. ✅ Pencil modes, brush size, rectangle corner radius, and oval start/end
    angle and inner radius (see Wave 7).

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
17. ✅ **Layer folders**, **guide layers**, outline view, layer height, per-layer tint (see Wave 7).
18. ✅ **Scenes** + Scene panel.
19. ✅ **Motion guide layers** and **orient to path**.
20. ✅ **Custom easing editor**, tween rotate CW/CCW × n, scale, Snap and Sync (see Wave 7).
21. ✅ **Shape hints** — and the shape tween they steer, which did not morph at all before.
22. ✅ **Reverse Frames**, **Edit Multiple Frames**, **Copy/Paste Motion**, frame label types.

Four things in this wave were features that existed in the UI and the save
format and did nothing: `layerHeight`, `outlineColor`, a layer marked `guide`
(which was published anyway), and `kf.label` (which no UI could set, so
`gotoAndPlay("menu")` was unreachable from the authoring side). A fifth, the
shape tween, did something — just not the thing it is named after.

Covered by `tests/layers-scenes.spec.js` (16), `tests/tween-frames.spec.js`
(15) and `tests/morph-guide.spec.js` (13).

### ✅ Wave 5 — text and interactivity (shipped)
23. ✅ **Dynamic and input text**, instance/variable names, selectable, border,
    line type, letter spacing, anti-alias mode, break apart text, Render as
    HTML (see Wave 7).
24. ✅ **Output panel** and a `trace()` that reaches it.
25. ✅ **Actions panel upgrade** — line numbers, syntax highlighting, error marking, code hints.
26. ✅ **Behaviors panel** and a **component set**.

Also in this wave: the **Movie Explorer**, the **History panel** and **Color
Swatches**.

### Wave 6 — library, sound, publishing
27. ✅ **Library folders**, search, duplicate symbol, swap symbol, unused items,
    linkage names — and `attachMovie`, which was a stub.
28. ✅ **Sound Edit Envelope** + effect presets, sync Stop, repeat count.
29. ✅ **Publish Settings** — one dialog, persisted per document.
30. ✅ **Bandwidth Profiler / Size Report**.
31. ✅ **Movie Explorer**, **History panel**, **Color Swatches**.
32. ✅ **SWF export** — shapes, symbols, frames, labels, transforms and alpha,
    with everything it cannot express reported rather than dropped. Text,
    bitmaps, sound, filters and scripts followed in Wave 13.

### Wave 7 — the leftovers

33. ✅ **Primitive shapes** — a rectangle's corner radius and an oval's start
    angle, end angle and inner radius. The point of Flash 8's primitive tools
    was that the shape stayed *parameterised*: you could re-round a corner or
    sweep a pie open a week later, rather than having committed to an outline.

    The geometry lives once, in `Flashy.Primitives`, because **six** things
    need it and have to agree: the canvas painter, the SVG exporter, the
    exported player, the SWF writer, `Morph.loops`, and the eraser's region
    maths. A rounded corner that is one shape on the stage and another in the
    export is worse than no rounded corner — which is the same reason PolyStar
    emits a `path` rather than a sixth primitive branch in each renderer.

    Three of the six get the outline by handing a synthetic `path` object back
    through their own path branch, with `pathW`/`pathH` set to the box so the
    scale factors stay at 1. One loop walker, not four.

    `active()` is deliberately strict: a radius of 0, or an oval from 0° to
    360° with no hole, is **not** a primitive. Every existing document keeps
    the cheap `rect`/`oval` renderer it has always had, and nothing allocates
    a command stream to draw a plain box.

    The parameters tween, in both interpolators — a wedge sweeps open, a
    corner rounds off, a hole widens. The authoring stage and the exported
    player each have their own copy of the keyframe interpolator, and teaching
    only one of them is the exact divergence class this file keeps finding.

    Authoring: sliders in the Properties panel, sticky settings in the tool
    options strip (set a radius once and every rectangle comes out rounded),
    and a drag preview that shows the real outline — a pie wedge is as
    impossible to place by eye from a bounding box as a star is.

    Covered by `tests/primitives.spec.js` (18 specs), which mostly cross-checks
    the render paths against each other rather than against numbers I chose.

Still open from the enumeration: Pen add/delete/convert anchor; gradient glow
and gradient bevel filters; Find and Replace; Revert; Match stage size to
contents; per-layer tint; keyboard-shortcut customisation; tween snap and
sync; brush shape and the five paint modes; eraser modes and the Faucet;
bucket gap-closing and Lock Fill; the button Up/Over/Down/Hit authoring view;
registration-point editing; templates; text kerning, baseline shift and
super/subscript; Render as HTML; filter presets; the ComboBox component;
History replay and save-as-command.

34. ✅ **Pen: add, delete and convert anchor.** The Pen drew paths and then
    abandoned them — a drawn curve could only be fixed by deleting it and
    drawing again, which is the opposite of what a Bézier tool is for.

    With nothing in progress, a Pen click on an existing path now edits it: on
    a segment it adds an anchor, on an anchor it removes one, and Alt-click
    converts a corner to a smooth curve and back. The overlay shows the
    anchors and marks what the click under the pointer would do — a green plus
    or a red ring — because add-an-anchor is otherwise a click into the dark.

    Adding on a curve splits it by de Casteljau, so the outline does not move:
    the point of adding an anchor is to get somewhere to pull from, not to
    nudge the shape while you do it. Smoothing places the two quadratic
    handles collinear with the anchor and on opposite sides, which is the
    difference between a smooth join and a cusp. Deleting refuses below two
    anchors, and deleting a loop's first point promotes the next one to the
    MOVE rather than leaving a stream nothing downstream can read.

    Covered by 12 specs in `tests/shape-tools.spec.js`.

35. ✅ **Gradient Glow and Gradient Bevel.** The two filters whose colour is a
    ramp, and the two CSS cannot express at all — `drop-shadow()` takes one
    colour, and no amount of stacking turns that into a gradient.

    Built the way Flash built them: blur the object's own alpha silhouette,
    then look the blurred alpha up in the ramp. Because the lookup is by
    alpha, the artwork's colours cannot leak into the halo, and the ramp's far
    end lands where the silhouette is solid.

    `Flashy.Filters.ramp()` resolves stops to 256 RGBA entries and is the
    single source for four consumers: the canvas pass, the SVG export, the
    exported player (which runs this very code), and the keyframe tween. The
    SVG route is the interesting one — no filter primitive maps alpha to a
    colour, but three in a row do: blur `SourceAlpha`, copy the blurred alpha
    into R, G and B with an `feColorMatrix`, then run each channel through its
    own `feComponentTransfer` table taken from `rampTable()`. Same ramp, not
    an approximation of it.

    A bevel is the same halo offset both ways along the light angle: the
    corners along the axis get both copies and land at the ramp's highlight
    end, the corners across it get a thin fringe and land at the shadow end.

    Authoring: a preview strip drawn from the real ramp over a checkerboard,
    one row per stop (position, colour, opacity), and an Add Stop that lands in
    the widest gap taking the colour already there — so adding a stop does not
    change the glow, it just gives you somewhere to grab. Ramps tween stop by
    stop when the keyframes agree about how many stops there are.

    Covered by 11 specs in `tests/filters.spec.js`.

### Wave 7b — the document-wide commands

36. ✅ **Find and Replace.** Text, font, colour or symbol, across the whole
    document or just the current scene. The four kinds differ only in which
    field they read, so they share one walker — and the places artwork hides
    (nested groups, library symbols, other scenes) are exactly the places a
    hand-rolled per-kind search would forget.

    Text honours match case, whole word and a regular expression; a half-typed
    pattern finds nothing rather than throwing. Font, colour and symbol match
    a whole FIELD, not a substring: "Arial" must not match "Arial Black". A
    colour is normalised first, so `cc3344`, `#CC3344` and `#0F0` all mean
    what the user meant. A symbol swap to a name not in the Library is
    refused, because an instance pointing at nothing draws nothing and gives
    no clue why.

    The dialog keeps a live results list — each row says what and where, and
    clicking it switches scene, layer and frame and selects the object. A hit
    inside a library symbol has no stage position, so the row says to open the
    symbol rather than appearing to ignore the click. Replace All is one undo
    step and covers every hit, including the ones past the list’s 200-row cap,
    which says what it dropped.

37. ✅ **Match Stage Size to Contents.** Measures every frame of the scene, not
    the one on screen — a stage sized to frame 1 clips the rest of the
    animation, which is the opposite of what the command is for. Guide and
    motion-guide layers are furniture and are excluded.

    This needed a bounding box that did not exist: `getBounds` reads
    x/y/width/height straight off an object, which is right for a selection
    marquee and wrong for anything rotated — a 100px square turned 45 degrees
    needs 141px each way. `objectBounds` walks the four corners through the
    object’s own matrix instead. The artwork then MOVES: a stage is always 0,0
    to width,height, so fitting content that starts at -40 means shifting
    everything rather than inventing a negative stage. Guides move with it.

38. ✅ **Revert.** Keeps a copy of the serialised document from the last save
    or open, not a flag — undo history is bounded and a session can easily
    make more changes than it holds. Confirms first, then clears the undo
    stacks, because they describe a document that no longer exists.

39. ✅ **Keyboard shortcut customisation.** Any menu command bindable to a
    chord, in a searchable list, stored in localStorage.

    The implementation is deliberately additive. Flashy’s shortcuts are a long
    and carefully ORDERED chain of conditionals — several differ only by a
    modifier, and the order is what keeps Ctrl+Shift+Z from being swallowed by
    Ctrl+Z. So a user binding is an override table consulted BEFORE that chain,
    not a rewrite of it: a binding wins outright and stops there, and
    everything unbound falls through to the defaults unchanged.

    `keyChord` upper-cases single letters, because the browser reports the
    SHIFTED character — binding `Ctrl+Shift+k` while the user presses
    `Ctrl+Shift+K` is a shortcut that never fires. One chord holds one command:
    rebinding a taken chord takes it and says so, rather than leaving two
    commands quietly fighting over a key.

    Also in this wave: Ctrl+F reaches Find and Replace, and `showDialog` now
    returns a reader for its own fields — a dialog whose body reacts to its
    own inputs was otherwise reaching into the DOM by input order, which would
    break the moment a field was added.

    Covered by `tests/document-commands.spec.js` (21 specs).

### Wave 7c — what a stroke is allowed to touch

40. ✅ **Brush tips and the five paint modes.** The modes are the half that
    matters: Paint Behind lets you put a background in without masking
    anything, and Paint Inside lets you colour a shape without going over the
    lines. Without them the brush is a thick pencil.

    Flash’s merge-drawing model made a tip and a mode one thing; an
    object-based editor makes them two, and both already had a home:

    * a TIP is a distance metric, and `FlashyGeom.strokeRegion` was already
      parameterised by one (it took a `square` boolean for the eraser). That
      generalised to `tipMetric` — Chebyshev or Euclidean, measured in a
      rotated and squashed frame — and Flash’s nine tips are all one of those
      four parameters apart. The short axis is capped at the long one and a
      tall tip is a wide one at 90°, which keeps the footprint inside
      `radius` in every direction: the scratch grid’s padding depends on it.
    * a MODE is either a z-order choice or a clip. Normal is the top of the
      display list, Behind is the bottom (which IS Paint Behind), and Fills is
      just under the lowest line-like object. Selection and Inside intersect
      the stroke with artwork that is already there — Inside against whatever
      the stroke STARTED on, so starting on empty stage paints nothing, as in
      Flash.

    A shaped tip or a non-Normal mode commits a filled `path` rather than a
    polyline, which is what Flash’s brush always produced anyway — so the
    stroke inherits the eraser, the four render paths and every export for
    free. A round tip painting normally keeps the cheap polyline, so the common
    case and every existing document are untouched.

    Lock Fill rides along: keep the colour the first stroke used, which still
    matters the moment the swatch changes under you mid-drawing.

41. ✅ **Eraser modes and the Faucet.** Five modes as a filter in front of one
    unchanged erase — nothing about the geometry changes, only which objects
    are offered to it. Spared objects are deliberately not counted as
    `skipped`, because that counter drives the "nothing was erased" message
    and a mode doing its job is not a confusion to explain.

    The Faucet is a click, not a drag: dragging a 24px eraser across a large
    fill to get rid of it is an absurd amount of work for an obvious request.

42. ✅ **Paint Bucket gap closing and Lock Fill.** The bucket only ever
    recoloured an object it hit, so clicking inside a pencil circle did
    nothing at all — there was no fill object there to recolour and no way to
    tell from the stage why.

    Now an empty click floods. The frame is rasterised on a TRANSPARENT ground
    (not through `renderFrameToCanvas`, which paints the background first and
    would leave the flood unable to tell artwork from empty stage), the ink
    dilated by the gap setting — which is what closes the gaps — flooded from
    the click, dilated back out to meet the real lines, and traced into a path
    through `FlashyGeom.marchingSquares`, now exported because a stroke and a
    flood produce the same thing: a boolean grid that has to become loops.

    A flood that reaches the edge of the stage is REFUSED, with the gap setting
    named in the message. Silently filling the whole background because the
    outline had a break in it would be far worse than refusing. And the fill
    lands behind the lines, because a fill painted on top of the outline it was
    poured into hides exactly the thing that defined it.

    One behaviour change fell out of this: a click on a shape with no fill, or
    on a line, no longer recolours it. `hitTest` claims a bounding box, so an
    unfilled rectangle was swallowing every click inside it and the flood would
    never have run.

    Covered by `tests/paint-modes.spec.js` (23 specs).

### Wave 7d — the flags that were already in the file

43. ✅ **Render as HTML.** `renderAsHtml` has been on every text object since
    text fields were added, and was read by **nothing**: a field could be
    marked as markup and would still draw its tags. This is the fourth time
    this audit has found that exact shape — after `skewX`, `layerHeight` and
    `kf.label` — and the fix is the same one: make it do the thing it is named
    after.

    `Flashy.RichText` parses Flash’s own subset — b, i, u, br, p align, font
    with color/size/face, a href — into paragraphs of styled runs. It lives in
    the engine beside `TextField`, which means the authoring stage, the raster
    exports and the exported player all get it from one implementation; the
    SVG export emits one `tspan` per run from the same parser.

    Markup gets its own layout pass rather than a flag threaded through the
    plain one, because runs with their own fonts have to be measured and
    wrapped together and a line’s height is its tallest run. The parser is
    deliberately forgiving: a field’s value is usually assembled by a script,
    so an unclosed tag, a stray closing tag and a tag it has never heard of
    all still draw. An unknown tag is dropped rather than shown — printing a
    tag the user did not write is worse than ignoring one.

44. ✅ **Auto-kern, baseline shift, superscript and subscript.** Auto-kern is
    not a recorded preference here but a real choice between two draw paths:
    canvas applies a font’s kerning pairs when it draws a whole string and
    cannot when it draws one character at a time. `measure()` had to learn the
    same split, or a centred unkerned line lands in the wrong place.

    Super and subscript are a baseline shift plus a smaller face, which is all
    they ever were, so they sit next to the shift that drives them.

45. ✅ **Per-layer tint.** A tint IS a Colour Effect in Tint mode, so there is
    no second implementation of it: `Flashy.Filters.composeColor` applies the
    object’s own effect and then the layer’s, which is what the two mean —
    the layer washes whatever the object already looked like.

    It is applied in `frameObjects`, as a prototype view like `withTiming`’s:
    the document object is never touched, so a tint can be switched off and
    nothing has been lost. Three of the four render paths come through that
    function, so they cannot disagree. The exported player builds its own
    display list and therefore composes its own — a tint taught only to
    `frameObjects` would show on the stage and vanish in the export, which is
    the divergence class this file keeps rediscovering.

46. ✅ **Tween Snap and Sync, and the registration point.** Both options needed
    something else to exist first.

    Snap is about WHICH POINT of the object rides a motion guide. Off, the
    centre follows, which is what Flashy always did; on, the registration
    point does — a car’s wheels on the road rather than its middle. So the
    registration point had to become editable, as a fraction of the object’s
    own box, defaulting to the centre so no existing document moves.

    Sync stretches a graphic symbol’s own animation across the keyframe’s
    span instead of advancing a frame per frame: a 12-frame walk cycle on a
    24-frame tween plays once at half speed rather than looping twice, which
    is the whole reason the option existed.

47. ✅ **Filter presets.** A filter stack is plain data, so a preset is a deep
    copy under a name in localStorage — it belongs to the person, not the
    document, exactly like Flash’s. Applying one deep-copies per object:
    sharing the array would make editing one instance’s blur change every
    other instance’s.

    Covered by `tests/rich-text-tint.spec.js` (24 specs).

### Wave 7e — the ones that needed something else first

48. ✅ **Button authoring.** A Button symbol’s frames 1–4 are Up, Over, Down
    and Hit, and the runtime has always known that. The authoring side did
    not: inside a button you saw four bare numbers, and on the stage a button
    sat inert showing its Up frame.

    The timeline now names the four states while a button is open, and
    Control ▸ Enable Simple Buttons makes buttons react to the pointer. Off by
    default, because a button that reacts cannot be selected or dragged —
    which is exactly why Flash made it a toggle rather than the default.

    The Hit frame is never drawn in any state. It says where the button can be
    clicked, which is precisely why drawing it would be wrong. And none of
    this reaches an export: a hover state is authoring chrome, so a sprite
    sheet recorded mid-hover would be a bug.

    One real bug surfaced here. The hovered instance was first tracked by
    object reference, and `frameObjects` hands out a fresh `Object.create`
    view per call — so the object the hit test found was never the reference
    the next render inspected, and the hover never showed. It is tracked by
    the object’s `id` instead, which is also the right granularity: two
    instances of one symbol are two buttons.

49. ✅ **New from Template.** Three built-ins, each a real document loaded
    through the ordinary path. A template that is a list of settings teaches
    nothing; the point is to open something that already works and take it
    apart — so the banner ships with a motion tween and a `stop()` on its last
    frame rather than a note saying it should have one.

50. ✅ **ComboBox.** The last component, and last for a reason: a dropdown
    needs somewhere to BE. A second frame is that somewhere, and it is how
    Flash’s own components did it — the closed box is frame 1, the open list
    is frame 2 with one named row per item, and the clip simply goes to the
    other frame. No new runtime, no overlay layer, and it exports through the
    paths that already exist.

51. ✅ **History replay, and Save as Command.** These needed each undo step to
    record the ACTION that caused it, not only a label. A snapshot is a
    *state*, and replaying a state against a different document means nothing;
    replaying the command that produced it means exactly what the user
    expects — apply the same three commands to the next shape.

    So `doAction` now stamps its id onto the step it causes, Replay re-runs a
    chosen tail of those ids, and a run can be saved under a name in
    localStorage. A step with no command behind it — a stroke, a slider drag —
    is a state change rather than an instruction and is counted out of the
    replay rather than silently dropped. The stored list is re-validated on
    read, so a hand-edited store cannot make the editor run something it does
    not recognise.

52. ✅ **Save a Copy**, which deliberately does not mark the document saved or
    move Revert’s target: the point is to put a copy aside and carry on in
    the original.

53. ✅ **Omit Trace Actions and Protect from Import.** The strip is
    deliberately conservative — only a `trace( … )` that is a balanced
    statement on its own line goes, with quotes respected — because a regex
    loose enough to catch every shape of trace is also loose enough to cut a
    line in half, and a released movie with broken scripts is far worse than
    one that logs. It runs on the exported COPY, so the document keeps its
    traces. Protect from Import is a marker, which is all Flash’s was.

    Covered by `tests/buttons-commands.spec.js` (19 specs).

### Wave 8 — the ones I had written off

Three of these were marked "low value" in the audit and one was marked
deprecated. That was a judgement about effort, not about the feature, and it
was not mine to make — so they are built.

54. ✅ **Timeline Effects.** Eight of them: Blur, Expand, Explode, Transform,
    Transition, Drop Shadow, Copy to Grid, Distributed Duplicate.

    Adobe deprecated these, and the reason usually given is that the generated
    frames were opaque — you could not open one and nudge it, only delete the
    effect and start again. So every effect here writes ORDINARY keyframes,
    with the spec and the original objects kept on the first one. The frames
    edit like any others, the effect re-runs with new settings from the
    originals rather than compounding, and Remove Effect puts the object back
    exactly where it was. That is the feature without the part that killed it.

    Each effect is a function from (object, params) to a list of frames, so
    adding one is adding a generator and nothing else. An effect applied to
    three shapes animates all three — the generators run per object and the
    results merge frame by frame.

55. ✅ **Strings and localisation.** A table keyed by string ID and language,
    on the document, with CSV in and out because what a translator wants is a
    spreadsheet and not the editor.

    Assign IDs does the tedious half: forty fields each need a stable key, and
    typing forty keys is how two of them end up the same. The IDs come from
    the text and are made unique, and the authored text is seeded as the first
    language so the panel opens showing the movie rather than empty rows.

    A missing translation falls back along the language list and then to the
    object’s own text, because a field that went blank looks like the field
    broke rather than like the translation is missing. A field with no ID is
    untouched, so adding a language to an existing document changes nothing
    until an ID is handed out. The table travels into the export and
    `stage.setLanguage()` switches at runtime — one file for every language,
    not one build per locale.

56. ✅ **Accessibility.** A name and description per document and per object,
    and a per-object switch.

    The export writes a real text alternative rather than an `alt` attribute:
    ARIA on the canvas for the movie’s name, and a visually-hidden list of the
    named objects. A cartoon is a sequence of named things and one string
    cannot carry that. A text object needs no accessibility name because it
    has text — making the author type it twice would guarantee the two drift
    apart. Turning the whole thing off marks the canvas `aria-hidden`, which
    is the right answer for pure decoration: announced decoration is worse
    than ignored decoration.

57. ◐ **Shared libraries.** Author-time sharing: pull symbols out of another
    .flashy, with the bitmaps and sounds they use, or the symbol arrives as an
    empty box with no clue why. A name clash renames the incoming one rather
    than overwriting — the local symbol might be the one the movie is built
    on. `sharedFrom` records the origin so Update can fetch a newer version,
    and Update replaces the symbol’s CONTENTS rather than the entry, because
    every instance on the stage points at the name.

    Runtime sharing is deliberately not built. It needs a loader protocol and
    a second file that has to still be there, which is a large part of why
    Flash content rotted; author-time sharing puts the symbol in this document
    where every export path already handles it.

    Covered by `tests/timeline-effects.spec.js` (16) and
    `tests/strings-access.spec.js` (20).

### What is left

What is left is one item, and it is left on purpose:

* **Runtime** shared libraries — loading a symbol from another file while the
  movie plays. It needs a loader protocol and a second file that has to still
  be there, which is a large part of why Flash content rotted. Author-time
  sharing does the same job and puts the symbol in the document, where every
  export path already handles it.
* **A user-supplied HTML template** and publish **alignment**.

Both of the small leftovers above are now done as well: the registration point
has an on-stage crosshair you can drag, and the Actions panel keeps a snippet
library beside its API chips — the selection (or the whole script) saved under
a name, inserted at the caret.

### Wave 9 — the debugger

58. ✅ **Breakpoints, stepping, watches and a variable inspector.**

    The usual reason this gets written off is that JavaScript cannot be
    suspended mid-statement. But a **generator** can be: a script being
    debugged is recompiled as a generator with a `yield` before each
    statement, and the debugger drives it one `next()` at a time. Stepping is
    therefore real, not a simulation of it — the script is genuinely halted
    between statements and the editor is responsive while it is.

    The variable inspector works the same way round. There is no way to
    enumerate a function’s locals in JavaScript, so the generator hands out an
    `eval` closure from inside its own body. That closure sees the script’s
    own scope, which means a local can be read *and written* — change `a` at a
    breakpoint and the next statement uses the new value. The names come from
    the source; a name that does not resolve is left out rather than shown as
    undefined.

    The timeline verbs are the editor’s real ones, so `gotoAndStop(4)` while
    stepping moves the stage. A debugger that runs the script against a fake
    timeline is testing the fake.

    **Deciding where a `yield` can go** is the whole of the difficulty, and it
    took four corrections:

    * A `{` that opens a BLOCK is not the same as one that opens an object
      literal. Statements inside a block are fine; a yield inside a literal is
      a syntax error. They are told apart by the token before the brace.
    * A nested function or arrow body must get none. This is the dangerous
      one: outside a generator `yield` is an ordinary identifier, so
      `yield [1, f];` parses as *indexing a variable called `yield`*. The
      script compiles and then misbehaves at run time — the one instrumentation
      mistake a syntax check can never catch.
    * `do`, `else`, `try` and `finally` are always followed by a block.
      Reading them as values silently lost every breakpoint inside, which is
      most of what anyone wants to break on.
    * A line entirely inside a block comment is not the preceding code for the
      next line’s boundary test.

    And a loop needs a yield **inside its body**, inserted right after the
    header’s brace: a one-line `while (true) { … }` has no body line to put
    one on, and a loop you cannot stop inside is a loop you cannot debug. With
    that, a runaway script is caught by a statement budget instead of hanging
    the editor.

    A script the instrumentation cannot handle is reported as such, and told
    apart from a script that simply does not compile — two different problems
    with two different fixes. ActionScript is declined plainly, because
    stepping it would mean stepping a different compiler’s output.

    Covered by `tests/debugger.spec.js` (25 specs).

### Wave 10 — text that really is what it says

59. ✅ **Anti-alias modes that change the pixels.** This row read "recorded on
    the field and said to be a record — the canvas has one text rasteriser and
    no way to pick another". The first half was true and the conclusion was
    not:

    * **Bitmap text** is a one-bit rasteriser, and a one-bit rasteriser is
      what you get by thresholding alpha at the midpoint. The field is drawn
      into a scratch canvas of its own and hardened there, then blitted back —
      hardening the live canvas in place would need the field’s box in device
      pixels, and by then the painter has rotated and scaled, so that box is
      not a rectangle any more.
    * **Readability** snaps glyph positions onto the pixel grid, which is
      where most of the blur in small text comes from. Real hinting needs the
      font’s own instructions, which a browser will not hand over — so the
      claim is no bigger than the snapping.
    * **Device fonts** substitute the player’s own family. Flash’s `_sans`,
      `_serif` and `_typewriter` map onto the generic families every browser
      has, which is the same promise.
    * **Animation** stays smooth, because sub-pixel motion should not shimmer.

60. ✅ **Font embedding, with character ranges.** A cartoon set in anything but
    Arial renders in a fallback on most machines, which is the single most
    visible way Flash content aged.

    The reason this was written off — "needs font parsing" — was wrong.
    Flashy already has a tracer that turns a rendered image into outlines, and
    a glyph is a very simple image: so a face is built by drawing each
    character at 128px and tracing it, normalised into a 0..1 em path table.
    No font parser, and the outlines go down the same four render paths every
    other path object does.

    Five character ranges, defaulting to the narrowest that works — only what
    this document uses — because an embedded face is usually the heaviest
    thing in a small movie. An embedded face measures from its OWN advances,
    because the system font may not be installed and asking the canvas would
    lay the line out for a fallback. A string the face cannot cover falls back
    to the system font whole rather than dropping glyphs: a missing glyph is
    far more visible than a substituted one. And only the faces a field
    actually asks for are exported.

61. ◐ **Spelling and proofing.** Deliberately a proofreader, not a dictionary.
    An English word list big enough to avoid false positives would be larger
    than the whole editor, and a spell check that flags every proper noun gets
    switched off within a minute — at which point it has made things worse.

    So it checks what is wrong regardless of language: a doubled word, a table
    of misspellings common enough to be worth shipping, unmatched quotes and
    brackets, a double space, straight and curly quotes mixed in one caption.
    Every one is a real error in a caption and none needs to know the
    language. Fixes are applied at the recorded position rather than globally,
    keeping a leading capital, because the same word can be deliberate
    elsewhere in the same string.

    Covered by `tests/fonts-spelling.spec.js` (21 specs).

### Wave 11 — getting the movie out

62. ✅ **A user HTML template, and alignment.** An exported cartoon usually
    has to land inside somebody else’s page, and the only option was the page
    Flashy writes.

    Flash’s `$XX$` placeholder convention is kept exactly, so a template
    written for Flash reads the same way here. This needed `genHTML` rebuilt
    rather than patched: a template needs the stylesheet and the markup as
    separate pieces, and the old version assembled them straight into one
    string. `$MOVIE$` is the whole movie — canvas, engine and player — handed
    over as one placeholder, so a template cannot accidentally ship half of
    it. A template with no `$MOVIE$` in it is refused, because the page would
    contain no movie: the one mistake worth stopping rather than publishing.

    Alignment is where the movie sits when the window is bigger than it,
    expressed as flexbox so the canvas keeps its own pixel size. Scaling it to
    fit is a separate setting — conflating the two was Flash’s own mistake.

63. ✅ **Printing, and Match Stage to Paper.** A storyboard gets handed round
    a room. Frames are rasterised through `renderFrameToCanvas`, the same path
    the sprite sheet and the video use, so what prints is what those produce
    rather than a fourth interpretation of the document. One frame to a page,
    or a contact sheet of up to sixteen.

    Match Stage to Paper sizes the stage to A3–A5, Letter or Legal at 72
    points to the inch less a half-inch margin — and deliberately does not
    move the artwork, because the point is to find out what fits and shifting
    everything would hide the answer.

    Ctrl+P is intercepted: the browser’s own print would print the editor’s
    panels, which is never what was meant. A blocked pop-up falls back to
    downloading the pages, which still print.

64. ◐ **Per-sound export settings.** One music bed and twenty blips want
    completely different settings, which is why Flash made these per sound.

    There is no MP3 encoder here and writing one would be a project of its
    own. What there IS: the decoded samples, which can be mixed to mono,
    resampled and trimmed of silence, then written back as 16-bit WAV. That is
    real compression — mono at 11 kHz is an eighth of the bytes of stereo at
    44.1, and for a blip nobody can tell — and it is honest about what it
    does, which pretending to re-encode would not be.

    A recode that would make a file BIGGER is reported and skipped: an
    already-compressed original usually beats anything this can produce, and
    shipping a bigger file because a setting was ticked is the opposite of
    what the setting is for. A sound with no decoded buffer ships untouched
    rather than silent or truncated.

    Covered by `tests/output-print.spec.js` (20 specs).

### Wave 12 — more than one document

65. ✅ **Document tabs.** Flashy opened one document and that was that: New
    threw away what you had, and comparing two cartoons meant two browser
    windows with no way to move anything between them.

    A tab is a serialised document plus a name, so switching is parking one
    and loading another through the paths that already exist. There is no
    second kind of document and no second loader — which is what keeps this
    from becoming a second editor.

    Two details matter. A tab remembers its PLAYHEAD as well as its artwork,
    because landing back on frame 1 every time is maddening in a long movie.
    And it remembers its unsaved state: `loadDocFromObject` marks a document
    clean, which is right for a file off disk and wrong for a tab you are
    coming back to. The bar is hidden while only one document is open, and the
    last one cannot be closed — an editor with no document is a state with no
    way out of it.

    Open now adds a tab rather than replacing what is there, which is why it
    used to have to ask first. Ctrl+W is intercepted, because closing the
    browser tab when several documents are open in it is exactly the wrong
    thing.

66. ✅ **Recent files in the browser.** The desktop shell has had these
    because it has real file paths. A browser has none, so "recent" has to
    mean the document itself — which is also a crash net: close the tab by
    accident and the work is still there.

    Bounded hard, because localStorage is a few megabytes for the whole origin
    and one photograph can be most of that. A document too big to keep is
    recorded by NAME with the reason given, rather than quietly evicting the
    other five; and if the write fails anyway, the payloads are dropped
    oldest-first and the names kept, because a list of what you were working
    on is still worth more than nothing.

67. ✅ **Edit in New Window.** This is how you work on a walk cycle while
    watching it in the scene.

    The symbol is sent to a second editor window AS A DOCUMENT — its layers
    are already the right shape — and comes back the same way. Nothing new is
    invented for the wire: it is a .flashy in both directions, which means the
    other window is just the editor and needs to know nothing about any of
    this. The library and the assets travel too, or a symbol containing
    another symbol opens empty.

    The child window ASKS for its content when it is ready rather than being
    told after a guessed delay — a slow machine would otherwise get the symbol
    before the editor existed to receive it. Save in a symbol window sends the
    content back instead of writing a file, because a .flashy of one symbol is
    not what anyone wanted. Coming back, the symbol’s contents are replaced
    and the entry kept: every instance on the stage points at that name.

    Covered by `tests/documents.spec.js` (18 specs).

### Wave 13 — the rest of the .swf

68. ✅ **Text, bitmaps, sound, filters and frame scripts in the SWF.**

    Each of these had been written off for a different reason, and all five
    reasons turned out to be wrong — the capability was already in the project,
    one step sideways from where it was needed.

    * **Bitmaps needed zlib.** Deflate has a STORED block type, literally "the
      next N bytes, uncompressed", and a stream of stored blocks wrapped in a
      zlib header and an Adler-32 is a zlib stream every inflater accepts. It
      compresses nothing, which is the honest trade: a bitmap comes out the
      size of its pixels. A file that cannot be opened at all would be worse
      than a big one. A JPEG skips all of this and goes in byte for byte — it
      is already compressed, and re-encoding would only lose quality.

      One trap: SWF’s ARGB is PREMULTIPLIED and canvas’s is not. Skipping that
      makes every semi-transparent pixel too bright. And a bitmap character
      cannot be placed at a size on its own, so it becomes a clipped-bitmap
      FILL on a rectangle — which is how Flash did it too.

    * **Sound needed an MP3 encoder.** It did not: SWF has allowed raw PCM
      since version 1, and the decoded buffer is already there for the stage
      to play. SWF’s four sample rates are an ENUM rather than a number, so
      anything else is resampled to the nearest.

    * **Text needed a font parser.** It needed glyph outlines, which Wave 10
      already produces by tracing. So DefineFont2 is a unit conversion — em
      fractions into SWF’s 1024-per-em grid — and the test that matters is
      that the reader turns the DefineText back into the right STRING, which
      only happens if the offset table, the code table and the glyph order all
      agree.

    * **Filters needed PlaceObject3**, which the reader already parsed. The
      four filters Flashy shares with Flash map onto SWF’s own four. The
      gradient pair do not — their ramp is a different record — so they are
      reported rather than approximated by a plain glow that would look wrong.

    * **Scripts needed a compiler.** A real AS2 compiler is a parser, a scope
      model and a bytecode generator, so instead five verbs are assembled —
      stop, play, gotoAndStop, gotoAndPlay, trace, by number or by label — and
      anything else stops with the LINE named in the report. Knowing which
      line is the difference between fixing it and guessing.

    The report now says what was WRITTEN as well as what was left out. The old
    one could only report failures, which made a movie with no sound in it
    indistinguishable from one whose sound had been dropped.

    Covered by `tests/swf-assets.spec.js` (19 specs), every one round-tripping
    through `flashy-swf.js` — the project’s own parser, which is the only
    check worth having on a format where one misplaced bit makes everything
    after it unreadable.

---

## Second pass — what the first eleven tables never asked about

The audit above reached "zero missing", and that was only true of its own
enumeration. Those eleven tables were written from one reading of a Flash
authoring environment, and a reading has blind spots. Going back to the tool
and asking what ELSE is on its menus and in its hands turns up thirteen things
the first pass never had a row for.

| Area | What is missing | Status |
|---|---|---|
| **Gradient fills** | No stop editor at all — more than two stops could exist in the save format and could not be authored. No overflow mode, no radial focal point, no gradient on a stroke. | ✅ Wave 14 |
| **Drawing model** | Flash had two: Object Drawing, and the MERGE model where a new shape cuts and unions the ones it lands on. Flashy is object-only. | ✅ Wave 15 |
| **Free Transform** | Scale, rotate and skew. No Distort (drag one corner freely) and no Envelope (Bézier warp). | ✅ Wave 16 |
| **Stroke styles** | Solid, dashed and dotted. No hairline, ragged, stipple or hatched, and no stroke-scaling mode. **And the engine's `lineStyle` took no dash argument, so every dashed stroke published SOLID.** | ✅ Wave 17 |
| **Animated GIF** | "Export as Sprite Sheet" produces a PNG sheet. There is no animated GIF — the format the web still actually uses for a short loop. | ✅ Wave 18 |
| **Per-bitmap export settings** | Sounds got per-asset settings in Wave 11; bitmaps did not. | ✅ Wave 19 |
| **Document units** | Everything is pixels. No inches, centimetres, millimetres or points for the rulers, the grid or the Info panel. | ✅ Wave 19 |
| **Grid settings** | Show/hide and snap only — no spacing, colour or snap accuracy. | ✅ Wave 19 |
| **Motion Editor** | A custom easing curve per TWEEN exists; a curve per PROPERTY (CS4's Motion Editor) does not. | ✅ Wave 20 |
| **Deco / Spray brush** | Absent. | ✅ Wave 21 |
| **Bone tool / IK** | Character rigs with poses exist; an IK chain with constrained joints does not. **Half wrong — the rigs already had limits and a solver. What was missing is bones INSIDE a shape.** | ✅ Wave 22 |
| **Cache as bitmap** | Absent. | ✅ Wave 21 |
| **Video** | Import, a video object, cue points. Absent — ~~needs a demuxer~~ **the browser IS the demuxer.** | ✅ Wave 23 |
| **ActionScript 3** | Absent — needs a compiler and an AVM2. **Half right: the AVM2 is out of scope, the compiler was not.** | ✅ Wave 24 |

### Wave 14 — the gradient editor

69. ✅ **Gradient stops, overflow, focal point, and gradients on strokes.**

    `fillStops` had been in the save format and in the painter since gradients
    arrived, and nothing could author it. The Properties panel said so in a
    comment — *"there is no stop editor yet, so switching away from one is a
    one-way trip"* — which made a gradient something a document could only
    acquire by being imported from a `.swf`. That is the same shape as
    `renderAsHtml`, `skewX`, `layerHeight` and `kf.label`: a field the format
    carried and nothing honoured. It is the fifth.

    Three things were missing beside it, and all three are visible:

    * **Overflow** — Extend, Reflect, Repeat. The only way to get a stripe
      pattern or a soft-edged sphere out of two stops.
    * **Focal point** — a radial gradient whose highlight is off-centre, which
      is what makes a sphere look lit rather than flat.
    * **A gradient on a STROKE.** Flash allowed it; the data model here only
      ever had one gradient, on the fill.

    The spec caught a real bug in the first attempt, and it is worth writing
    down because it very nearly passed: **tiling the stop list is only half of
    an overflow mode.** Repeating the ramp inside the gradient’s own span
    still pads outside it — so a reflected gradient came out looking like a
    squashed one rather than a repeating one. The GEOMETRY has to extend too:
    the span is laid out seven tiles wide with the original in the middle, and
    a tiled radial grows its outer radius instead, because there is no "before
    the centre" to extend into.

    That is why the builder ended up in `Flashy.Gradient` rather than in the
    painter. Four things draw gradients, three of them go through the engine,
    and two copies of "extend the geometry and tile the stops" would drift
    exactly the way the four renderers once did. The SVG export is the
    exception and deliberately so: it has `spreadMethod` and `fx` natively, so
    it says what it means instead of faking it.

    Adding a stop takes the colour the gradient already has there, so it
    changes nothing — it just gives you something to grab. Flattening takes
    the MIDDLE of the ramp, not the first stop: a fade to transparent would
    otherwise flatten to something invisible, and losing the artwork is worse
    than losing the gradient.

    Covered by `tests/gradients.spec.js` (16 specs).

### Wave 15 — merge drawing, and a boolean bug four layers deep

70. ✅ **Merge drawing.** Flash had two drawing models and a button to switch
    between them. Object Drawing is what Flashy has always done — every shape
    is its own thing and they stack. MERGE drawing is the one Flash started
    with: a shape drawn in the same colour JOINS what it lands on, and one in
    a different colour CUTS it.

    It is how you draw a mouth on a face without making a mask, how you take a
    bite out of a circle, and how most Flash artwork was actually made. The
    only route before was the Combine Objects menu and three clicks per
    operation.

    Object Drawing stays the default, which is the opposite of Flash — every
    document here was drawn under it, and changing the default would change
    what an existing file does when you draw on it. The mode applies on DROP
    as well as on draw, because Flash merged where a shape landed; a mode that
    only worked while drawing would be half a feature and the confusing half.
    Symbols, text and bitmaps are left alone, as Flash left them.

71. ✅ **The coincident-edge bug in `FlashyGeom`.** Building the above turned
    up a real fault underneath Combine Objects, the eraser, the paint bucket
    and the shaped brush: the booleans were wrong whenever two shapes shared
    an edge **exactly**.

        union(rect(50,50,100,100), rect(100,50,100,100))

    — two squares overlapping by half, sharing their top and bottom edges —
    came back as the second square alone. Two rectangles drawn aligned is not
    an edge case in any useful sense, and `combineUnion` on the Modify menu
    was losing one of them.

    It was four faults stacked, each hiding the next, and each one looked like
    the whole problem until it was fixed:

    1. **`crossCut` skipped parallel edges on purpose**, with a comment saying
       the midpoint classifier would place them correctly. It cannot: the
       midpoint of a shared edge lies on the other region’s boundary, where
       the winding test is a coin toss. T-junctions were skipped too, so the
       two operands’ segment lists never even lined up.
    2. **Collinearity cannot be read from the cross product here.** B is
       jittered by 1e-5 to break ties, which leaves two nominally parallel
       edges with a `den` of about 1e-3 — a thousand times the parallel
       threshold. The first fix therefore changed absolutely nothing, which is
       a useful kind of failure: it proved the branch was dead rather than
       wrong.
    3. **The bounding-box pre-reject is exact.** An axis-aligned edge has a
       box of zero height, so a jittered horizontal edge sat a few millionths
       outside it and was rejected before any of the new work could look.
    4. **Chaining matches endpoints at a millionth of a pixel**, and a shared
       run’s ends are a vertex of one operand and a point on the other — so
       the seam broke the loop, which then failed to close and was discarded.
       Fixed by welding B onto A before splitting, **vertices before edges**:
       snapping a near-coincident corner to the nearest point on an EDGE put
       it a fraction along that edge instead of at its end, which unioned two
       identical squares into a triangle.

    A shared edge is now settled by a rule rather than a probe, and the rule
    turns on whether the two regions lie on the same side of it: same
    direction means the edge is on the boundary of a union and interior to a
    difference; opposite means they face each other across it, so it is
    interior to a union and is exactly what a difference cuts along.

    `tests/geom-booleans.spec.js` (16 specs) pins the booleans at the level
    their callers depend on, and was written FIRST — ten failing, six passing,
    which is what separated the broken cases from the ones that always worked.
    All 801 existing tests still pass.

### Wave 16 — Free Transform: Distort and Envelope

The tool existed, had a keyboard shortcut, and did nothing: its mousedown
selected a shape and stopped. Scale, rotate and skew are matrices and the
Transform panel has always driven those; Flash's other two modifiers are not
matrices.

*   **`Flashy.Warp`** (in the engine, because four render paths have to agree
    about it). `distortFor`/`envelopeFor` start AS the object's box, so arming
    a modifier changes nothing until a handle moves. `point(warp,u,v)` is
    bilinear for a distort and a **Coons patch** over four cubic edges for an
    envelope — the subtraction of the bilinear corner patch is what keeps the
    interior following the sides instead of puffing out near the corners.
*   **`Warp.path`** flattens as it warps. A warped quadratic is not a
    quadratic, and keeping the curve opcode would draw a different shape from
    the one the handles describe. A straight line is subdivided too, under an
    envelope: skipping that left a rectangle's sides obstinately straight
    while its corners moved.
*   **`Warp.outline`** is the one place `rect`, `oval`, `path` and a
    parameterised primitive become one command stream. It returns null for a
    symbol, a group, a text field, a bitmap and a pencil stroke — which is
    also the list Flash refused, and for the same reason: contents, not an
    outline.
*   Routed through **all four consumers**: `paintObjRaw` (which already had a
    command-stream branch for primitives, in box coordinates — exactly what a
    warped outline is), `_objToSVGRaw`, `exportRuntime`'s shape builder, and
    `objectRegion`, so the eraser cuts round the distorted shape rather than
    the box it started in.
*   The tool: a three-way mode option (Standard / Distort / Envelope), a cage
    drawn inside the stage transform with square corners and round tangents,
    handle picking that prefers corners on a tie, and a Reset button. Dragging
    comes back through `objMatrix`, so a corner of a rotated, scaled shape
    follows the pointer rather than a sheared version of it. **A corner
    carries its two tangents with it**, as Flash's did — without that,
    adjusting any corner straightens the two curves beside it and an envelope
    is unusable. A distort promoted to an envelope regrows its tangents at the
    thirds of the ALREADY-DISTORTED sides, so the promotion is the identity.
*   `tests/free-transform.spec.js` (19 specs), including a pixel probe at a
    stage coordinate 80px outside the shape's own box.

### Wave 17 — line styles: all seven, and the Scale menu

Flash's Stroke panel had seven styles and a Scale menu. Flashy had three — and
two of those were wrong outside the stage, because the engine's `lineStyle`
took no dash argument at all. **Every dashed and dotted stroke published
solid.** That is the fifth feature found whole in the UI and the save format
and absent from the output, after `skewX`/`skewY`, `layerHeight`, `kf.label`
and `fillStops`.

*   **`Flashy.Stroke`**. `dash(style,width)` is proportional to the width, so
    a 1px dashed line and a 10px one share a rhythm rather than a gap, which
    is what Flash's did. `width(style,w,scale,sx,sy)` returns the number to
    HAND the context — "normal" passes the authored width through, everything
    else expresses a screen width and divides the context's own scale back
    out. That is what makes a **hairline** one pixel at every zoom and under
    every scale, and what makes Scale: None mean it.
*   **Ragged, stipple and hatched are not a pen.** Flash drew them
    procedurally and turned them into filled shapes on export, which is also
    the only way a canvas, an SVG and a SWF can show the same scatter. So
    `decorate` returns closed loops and all four paths fill the same ones:
    ragged is one ribbon per polyline (so it fills under the same even-odd
    rule as everything else), stipple a scatter of octagons, hatched a row of
    leaning ticks. Everything is driven off **arc length**, so the texture
    does not bunch where the path curves.
*   The scatter is a **deterministic integer hash** of position along the
    line, not `Math.random`. A stippled line that re-scatters between the
    stage and the export is a different drawing, not the same one twice.
*   **`Stroke.spine`** gives the line a stroke follows for every stroked kind
    — including a warped shape's warped outline, so the texture follows the
    shape you can see.
*   Along the way: **a `line` object and a `pencil` stroke both drew their pen
    unconditionally**, ignoring `strokeOn` entirely. A line is nothing but its
    stroke, so a hatched line came out hatched on top of solid.
*   The style and the scaling mode are sticky across draws, the way Flash's
    Stroke panel was, and the ink bottle applies the style it is showing — it
    used to keep whatever the shape already had, so there was no way to make
    an existing line hatched at all.
*   `tests/stroke-styles.spec.js` (16 specs), two of which run the exported
    player and count ink along the line.

### Wave 18 — export an animated GIF, as a GIF

"Export as Sprite Sheet" wrote a PNG grid inside a generated HTML player.
Useful, and not a GIF. A GIF plays in an `<img>`, a chat window, a forum post
and a text message; nothing else in the export list does, and it is how most
Flash animation actually left Flash.

*   **`flashy-gif.js`**, a real GIF89a encoder, browser-free (everything takes
    ImageData-shaped objects and returns bytes).
*   **Median-cut global palette** over every frame at once, because a
    per-frame palette makes the colours shift as the animation plays. The
    split is at the **pixel-count** median, not the entry-count median, so one
    colour covering half the picture does not share a box with the long tail.
    Fewer distinct colours than the palette size come back **exactly** — flat
    cartoon colour is what GIF is best at, and requantising twelve colours
    into twelve would be a way to make all twelve slightly wrong.
*   **Ordered (8x8 Bayer) and diffusion (Floyd-Steinberg) dithering**, Flash's
    two. Ordered is the default recommendation for animation because diffusion
    error travels differently in each frame and the texture crawls.
*   **GIF-variant LZW**, growing the code width one entry LATE as the format
    requires. Early is the classic encoder bug: every decoder then reads the
    rest of the stream shifted by a bit, and only after the first table reset.
*   **The NETSCAPE2.0 block**, without which a GIF plays once.
*   **Frame differencing**: each frame cropped to what changed, the rest left
    transparent over the frame before, disposal 1. On a still background with
    a moving character that is most of the file, and a spec measures it (more
    than 2x smaller on a 10-frame fixture).
*   Delays round against a **running total**: 24fps is 4.1667 hundredths, and
    rounding each frame to 4 would run every second of the animation 4% slow.
*   `tests/gif-export.spec.js` (12 specs). The decisive one hands the bytes to
    **the browser's own decoder**, for every option that changes the stream —
    palette size, each dither, differencing on and off, transparency. A GIF
    this encoder likes and a decoder rejects is not a GIF.

### Wave 19 — ruler units, the grid, and per-bitmap export settings

*   **Ruler units.** Flash's Document Properties had a units menu and every
    number the editor showed went through it. A movie printed to paper or laid
    out against a print design is authored in inches or millimetres, and
    converting in your head on every measurement is how you get a banner that
    is nearly the right size. Everything INSIDE Flashy stays in pixels — the
    document, the objects, the save format, the exports — so units are a
    display conversion at the edge and cannot introduce rounding into the
    artwork. 72 pixels to the inch, as Flash's ruler was, which also makes a
    point exactly a pixel.
    *   The rulers pick their tick step **in the document's units** and convert
        back, so an inch ruler is marked at halves and quarters rather than at
        36 and 72 pixels. A ruler whose ticks miss round numbers of its own
        unit is worse than no ruler.
    *   Document Settings takes the stage size in those units, and reads the
        fields **before** changing the unit — the other order would
        reinterpret the numbers you just typed in a unit you had just left.
*   **The grid.** Separate spacings on the two axes (a grid matched to a tile
    sheet, a comic panel layout or a line of text is rarely square), its own
    colour (a hard-coded grey is invisible over grey artwork, which is most of
    a greyscale drawing), and **Flash's four snap accuracies**. The snap used
    to round unconditionally, which is Always Snap and nothing else — so
    "nudge it deliberately off the grid" was impossible. A grid finer than two
    screen pixels is skipped: at that point it is a flat wash hiding the
    artwork, and drawing thousands of lines to produce it is the slow way
    there. Units and grid are saved with the document, like the guides.
*   **Per-bitmap export settings.** Sounds got these in Wave 11; bitmaps had
    the same dialog in Flash and got nothing, so an imported photograph went
    into every export as the PNG it arrived as. Compression is auto / photo
    (JPEG) / lossless, plus a quality and Allow Smoothing. **Auto looks at the
    image**: distinct colours in a subsample separate flat artwork from a
    photograph, and the threshold is deliberately generous because JPEG on
    flat art rings visibly round every edge while PNG on a photograph is only
    a large file — the cheap error is the one to prefer. **Transparency
    settles it outright**: JPEG has no alpha channel, so an image with one
    stays lossless however photographic it looks. A re-encode that comes out
    BIGGER is discarded, or "optimise" would be a pessimisation on small flat
    images. Applied in `exportDocData`, so every export path gets it from one
    place while the document keeps the lossless original. `serializeBitmaps`
    was dropping every field it did not know about, which would have lost the
    settings on each save — a setting that does not survive the file is not a
    setting.
*   `tests/units-grid-bitmaps.spec.js` (18 specs).

### Wave 22 — the Bone tool, on shapes

The second-pass row said "character rigs with poses exist; an IK chain with
constrained joints does not", and that was half wrong: the rigs already had
rotation limits, planted joints and a CCD solver. What was genuinely absent is
the OTHER half of Flash's Bone tool. Applied to symbols it built a skeleton of
parent/child instances — which is Flashy's rigs. Applied to a **shape** it put
bones INSIDE the artwork and the outline deformed to follow them, and that is
the famous one: a drawn arm bends at the elbow as a *drawing* rather than as
two pieces, and a tail curves along its whole length.

*   **`Flashy.Armature`** — linear blend skinning. Every outline point is bound
    to the nearby bones by weight and each bone contributes the transform it
    has moved through since the bind pose. It is a pure function of (outline,
    pose), which is exactly why it can live in the engine and be computed
    identically by the stage, the SVG export, the player and the eraser.
*   Routed through **the seam `Flashy.Warp` already owns**. `Warp.active` is
    now "this object's outline needs replacing", and `outlineOf` applies the
    armature and then the warp — bones pose the drawing, a Free Transform
    distorts the posed drawing. That seam being wired into four render paths
    already is the whole reason to put it there.
*   **Angles are relative to the parent.** That is what the matrix chain
    composes, and it is the only way a joint limit can mean anything: an elbow
    that may bend 0 to 140 degrees means that with respect to the upper arm.
    Getting this wrong first time produced a chain whose tip was 69 units from
    its root when it should have been 80, which is how it was caught.
*   **Weights are distance to the bone's rest SEGMENT**, not to its head.
    Weighting by the head makes the far end of every bone go slack, which is a
    limb that detaches at the elbow. A point lying ON a bone is bound to it
    alone, with a floor on the distance so it is not a division by zero at
    exactly the places the artist drew the bone through.
*   The bind pose is the drawing as it stands — `rest` and `angle` start equal
    — so adding a bone deforms nothing. **Bind here** makes the current pose
    the new rest, because a bind pose set slightly wrong is otherwise
    something to fight for ever.
*   The solver is CCD, damped per joint by Flash's **Joint Speed**, with a
    **pin** that freezes a bone and shortens the chain above it. The hard part
    was one-sided limits: a two-link reach has TWO poses, and plain CCD only
    ever walks towards the nearer one — so with limits of 0..140 and the
    nearer pose at −83 degrees it gets stuck perfectly straight, which is the
    single most visible failure a constrained solver has. Fixed by seeding
    from the middle of every limited joint's range and descending **root-first**
    on the retry, then keeping whichever answer came out better. Leaf-first
    descent snaps the dragged bone straight at the target on its first move
    and erases the seed before the joints above have aimed at all.
*   `tests/bone-tool.spec.js` (21 specs), including the eraser, the SVG and a
    pixel probe 50px below a bar 20px tall in the exported player.

### Wave 23 — video

The second-pass row said "needs a demuxer". That was simply wrong: a browser
demuxes and decodes MP4 and WebM already. A `<video>` element IS the decoder
and `drawImage` of it is the frame. Flash's File ▸ Import ▸ Video is how every
tutorial, every banner with a product shot and every Flash video player on the
web was built.

*   **`Flashy.Videos`** caches decoded elements by name, like `Flashy.Bitmaps`.
    `loadBase64` makes a **blob URL, not a data: URL**, and that is not a
    detail: a `<video>` on a data: URL cannot serve byte ranges, so seeking it
    either takes seconds or never completes — the element sits at readyState 1
    for ever and draws nothing. An embedded clip is seeked on every frame of a
    scrub. `muted` and `playsInline` are likewise not preferences; without
    them a browser refuses to start the element without a gesture at all.
*   **`Flashy.Video`** holds the timing. `timeFor` divides by the MOVIE's rate
    rather than the video's, because Flash's embedded video ran one video
    frame per timeline frame — a 30fps clip on a 12fps timeline plays at
    two-fifths speed, and that is what made animating over footage possible.
    `sync` skips a seek inside a 40ms tolerance, because a seek per repaint
    makes a browser drop every frame it was about to show, which looks exactly
    like a video that will not play.
*   **Two modes, Flash's own.** Embedded: the playhead drives the clip, so
    scrubbing the timeline scrubs the footage. Stream: it runs on its own
    clock, as a NetStream did, and the playhead must not touch it.
*   **Cue points** are named times on the ASSET — marks in the footage, not in
    one placement of it, which is where Flash put them. `cuesBetween` compares
    against the PREVIOUS time rather than testing proximity: a cue tested by
    "is the playhead near it" fires several times on a slow frame and not at
    all on a fast one. Looping wraps, so a cue near the end fires on every
    pass. An EVENT cue dispatches `cuePoint` on the stage in the exported
    player; a NAVIGATION cue is a seek target and fires nothing, which is the
    line Flash drew too.
*   A clip that has not decoded draws a dark panel with a play triangle rather
    than a hole: an empty rectangle with no explanation is the worst of the
    three possible outcomes.
*   The SVG export emits the frame the video is SHOWING, as a raster. The SVG
    export is deliberately a still of the current frame, so that is the honest
    answer — a `foreignObject` with a `<video>` in it would be a different
    document that happened to have the same extension.
*   Video travels inside the document, as the sounds and bitmaps do, capped at
    24MB of source bytes. Flash capped embedded video for the same reason: a
    50MB file base64'd into a document is a document nobody can open.
*   `tests/video.spec.js` (14 specs). The fixture is a clip **recorded in the
    browser with MediaRecorder**, so the decoder under test is the one that
    will actually play it. One limitation is documented in the spec rather
    than worked around: MediaRecorder's WebM carries no Cues index and so is
    not reliably seekable, which is the fixture's problem and not the
    editor's — so the scrub is tested at the level of what the editor controls
    (the element is asked for the right time) and the pixels are tested at
    frame 1, where no seek is involved.

### Wave 24 — ActionScript 3

The last row in the table, and the one the audit had written off as "needs a
compiler and an AVM2". Half of that was true and half was not, and the
distinction is the whole feature.

An **AVM2** — a bytecode interpreter for compiled ABC — genuinely is out of
scope, and nothing here pretends otherwise: this does not run a `.swf`'s
compiled ActionScript. What it does is the other, and far more useful, half.
**AS3 source** is a class-based language that is very nearly a subset of modern
JavaScript once the type annotations come off, and the standard library it
reaches for — Sprite, MovieClip, TextField, Event, Point, Rectangle, Timer —
maps onto what Flashy's engine already *is*. So AS3 source compiles to
JavaScript and runs on the real engine. That is also what Flash itself did at
the level that mattered to an author: you wrote a document class, it was
instantiated with the stage, and `addChild` put things on screen.

*   **`flashy-as3.js`** — a tokenizer and a translator. Deliberately NOT an AST
    round trip: AS3's statements and expressions already *are* JavaScript's, so
    what is needed is a token rewriter that understands the places they differ.
    The output is readable JavaScript padded to the SOURCE's own line numbers,
    so a runtime error reports a line the author can find in their own file. An
    AST pass loses that unless it carries a source map, and a source map is a
    great deal of machinery for a feature whose point is that the script runs.
*   **AS3's implicit `this` is the single most important thing it does.**
    Inside a class, `x += vx`, `addChild(ball)` and `graphics.beginFill()` all
    mean `this.`. JavaScript does not, and `with (this)` is both illegal in
    strict mode and wrong about assignment. So the class body is scanned for
    its declared members BEFORE anything is emitted, and a bare name that is
    one of them — or one of the inherited display-object members, or a member
    of another of the author's classes up the chain — is prefixed. Four things
    are deliberately left alone: a property access after a dot, a declared
    local or parameter (which shadows a member, as in AS3), an object-literal
    key, and a name the compiler knows nothing about. Without this every AS3
    class fails on its first line; with a wrong version of it the failures are
    silent.
*   **`rotation` is rewritten to the engine's `rotationDeg`.** AS3's rotation
    is in degrees and the engine's is in radians. Leaving the name alone would
    make every rotation in every compiled script wrong by a factor of 57.
*   **`is` and `as` go through a helper**, because `x is Number` is a `typeof`
    test and `x is Sprite` is an `instanceof` one and no infix rewrite can say
    both. The left operand is already emitted when the operator is reached, so
    the emitted output is scanned back to where the operand began — `+`, `-`,
    `*`, `/` and `.` bind tighter than `is` and so are part of it, while
    everything of lower or equal precedence stops the scan. These two are the
    only places AS3 needs an expression parser, and writing one for them alone
    would be the wrong trade.
*   **Each class registers itself where it is declared**, not in a block at the
    end. A JavaScript `extends` clause is evaluated where the class statement
    is, so a second class extending the first would resolve the base before it
    existed — and that is the one thing an author is most likely to write. The
    base is resolved at RUN time, because whether it is the author's own class
    or the engine's is not knowable until both are declared.
*   `for each (… in …)` iterates values over an array or a plain object,
    `Vector.<T>` becomes Array, typed catch parameters and rest parameters
    work, and `trace()` goes where every other trace in Flashy goes.
*   **What is NOT supported is refused with a line number** rather than
    mistranslated: E4X (XML literals and the `..` and `.@` operators),
    namespaces and `::`, `use namespace`. Each is a real AS3 feature, and a
    compiler that quietly drops what it does not understand is worse than one
    that refuses. A class the build does not have reports the list of the ones
    it does, which turns a dead end into a decision.
*   **The editor**: `scriptDialect` is now one of three, picked in Document
    Settings; Modify ▸ ActionScript 3 Document Class opens a one-file class
    editor that compiles as you type and names the line of any mistake;
    the Actions panel's syntax check routes AS3 to its own compiler, because
    `var n:int = 1` is a syntax error read as JavaScript and reporting it that
    way would be both wrong and alarming; and the debugger says plainly that
    it steps source rather than compiled output.
*   **The export** ships `flashy-as3.js` only when the document has AS3 to
    compile, instantiates the document class with the root, and marks it
    `__attached` — the root rebuilds its display list from the timeline every
    frame, and a child that is not in the document cannot be put back by that
    rebuild, so without the mark the document class would vanish on frame two.
    A document class that fails to compile is reported to the Output and the
    animation still plays: a blank page tells the viewer nothing.
*   Found along the way: ten calls in `editor-app.js` to a `Flashy.Output.trace`
    that does not exist. The Output's entry point is `write` — `trace` is what
    the *language* calls it — and every one of those calls was guarded by
    `if (Flashy.Output.trace)`, so they had been silently doing nothing.
*   `tests/as3.spec.js` (21 specs), ending with an exported movie whose box is
    drawn by a compiled AS3 constructor, added to the real display list and
    painted by the real painter.

---

## Where the second pass ended

All fourteen rows are closed. Three ◐ rows remain from the first eleven
tables, and they are scope decisions rather than omissions: runtime shared
libraries (a second SWF loaded at run time), spell check (a proofreader, not a
dictionary), and per-sound MP3 compression (no MP3 encoder). Each is written
up where it stands.

Two of the second pass's own rows turned out to be wrong about what was
missing, and saying so is part of the audit:

*   **Bone tool / IK** — "an IK chain with constrained joints does not exist"
    was half wrong. The character rigs already had rotation limits, planted
    joints and a CCD solver. What was genuinely absent was the Bone tool's
    other half: bones INSIDE a shape, deforming the drawing.
*   **Video** — "needs a demuxer" was simply wrong. A browser demuxes and
    decodes MP4 and WebM already; a `<video>` element is the decoder.

And **ActionScript 3** — "needs a compiler and an AVM2" — was half right. The
AVM2 is out of scope and the compiler was not.
