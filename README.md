# Flashy

**The open-source Flash alternative for the modern web.**

Flashy is an HTML5 Canvas vector animation engine and authoring tool that brings back the creative spirit of the Flash era. Draw vector art, build timeline animations with nested MovieClips, create interactive content — and export self-contained HTML that runs in any browser.

No plugins. No installs. Just open a browser and create.

## What's in the box

### flashy.js — The Engine (25KB, zero dependencies)
A complete Flash-style display list and animation runtime:
- **Graphics API** — moveTo, lineTo, curveTo, cubicCurveTo, beginFill, gradients, drawRect, drawCircle, drawStar, drawPolygon
- **Display Objects** — Shape, TextField, MovieClip, DisplayObjectContainer with full transform stack (position, rotation, scale, alpha, blend modes)
- **Timeline & Tweening** — Keyframe-based animation with 14 easing functions (bounceOut, elasticOut, sineInOut, backOut, etc.)
- **Bitmaps** — `Flashy.Bitmap` display object and a `Flashy.Bitmaps` asset cache (decode once, draw scaled, nearest-neighbour or smoothed)
- **Sound** — `Flashy.Sound` (WebAudio asset cache, decode, waveform peaks) and `Flashy.SoundTrack`, which keeps timeline sounds in agreement with the playhead. Stream sync drives the playhead *from the audio clock*, so the animation follows the sound instead of drifting against it
- **Nested MovieClips** — Clips within clips, each with their own independent timeline
- **Frame Scripts** — Attach JavaScript to any frame for interactive behavior.
  Scripts run on entry to their frame in Test Movie and in exported files (with
  `stop()`, `play()`, `gotoAndPlay()`, `gotoAndStop()`, `root`, `stage` in
  scope), not while scrubbing in the editor — the same split Flash had
- **Event System** — enterFrame, click, mouseDown, mouseMove, mouseUp with display-list hit testing
- **Stage** — Fixed-step game loop with configurable FPS and HiDPI support

### flashy-swf.js — SWF Reader
Reads a compiled Flash movie back into a **document model**: characters, a
timeline, exported names, scripts. FWS and CWS headers; DefineShape 1-4 with
edges **stitched into real closed paths** per fill style (which is what a SWF
shape actually is); solid, gradient and bitmap fills; strokes with caps and
joins; sprites; the whole display list (PlaceObject 1/2/3, RemoveObject 1/2)
with matrices, colour transforms and clip handlers; JPEG and lossless
bitmaps; DefineFont 1/2/3 glyph outlines **and code tables**, so static text
comes back as readable strings; edit text; buttons; morph shapes (as their
start shape); and MP3/PCM sound. `Flashy.SWFLoader` builds a live MovieClip
from the same model.

### flashy-as2.js — Object Handlers
Flash let you select a clip and write `onClipEvent(load) { … }` on it; that is
how a decade of eyes-follow-the-mouse was made, and imported movies are full
of it. Those blocks now **run**. Each body is compiled once and executed with
an AS2-shaped scope: `_x`/`_y` are the clip's position *measured from its
registration point* as Flash measured it, `_alpha` is percent, `_rotation` is
degrees, `_xmouse` is the pointer in the clip's own space, `_parent` and
`_root` are other clips, a child is reachable by its instance name, and
anything else you assign to is a variable on the clip. `load`, `enterFrame`,
`mouseMove`/`Down`/`Up` (anywhere, as in Flash), `press`/`release`/`rollOver`/
`rollOut` (hit-tested), and `keyDown`/`keyUp` are wired. A handler that throws
is reported once and switched off, so one bad script cannot take a movie down.

### flashy-abc.js — ActionScript 3 Reader
AS3 is a different virtual machine (AVM2) and lives in `DoABC` tags. This
reads the ABC container — constant pool, classes, methods, bodies — and gives
back an **outline of every class** plus the **frame scripts**, which an AS3
timeline registers from its constructor with `addFrameScript(0, frame1)`.
Method bodies are decompiled far enough to read calls, assignments, literals
and `new`; control flow is reported, not reconstructed. Not a full AS3
decompiler — but an imported movie says what its code was instead of
pretending it had none.

### flashy-avm1.js — ActionScript Decompiler
Turns the AVM1 bytecode a SWF carries back into source. A stack machine run
for its *expressions* rather than its values, so `push "x", 5 · setVariable`
comes back as `x = 5;` — with if/else, while, do-while, `with`, try/catch,
nested functions, and `&&`/`||` recovered from the jumps a compiler emits.
What it cannot structure becomes an honest comment rather than an exception.

### flashy-fla.js — FLA/XFL Reader
Reads CS5+ ZIP-based `.fla` files and unzipped XFL folders into that *same*
model: the library with its symbol types, layers with their names and order,
keyframes, labels, frame scripts, motion tweens (sampled per frame),
gradients, bitmap fills, text runs, groups, and colour effects.

### flashy-import.js — Flash → Flashy document
Back-engineers a parsed movie into an editable document: **depths become
layers**, placements become keyframes, baked per-frame motion is folded back
into **motion tweens**, sprites and reused shapes become **library symbols**,
shapes become `path` objects with their real curves, and the decompiled
ActionScript lands on an **Actions layer** at the frame it ran on, and a
clip's or button's own handlers land **on the object**, where the Actions
panel shows them when it is selected — and where `flashy-as2.js` runs them.
**Depths are packed back into layers** — a publisher cycles through display
depths, so a cartoon arrives as two hundred one-object layers; those that
never share a frame are merged back together, and where that is not enough,
neighbouring layers are combined the way a Flash layer holds several objects
(the test movie goes from 222 layers to 52, pixel for pixel identical).
**Gradients come across as gradients** and **skewed artwork is baked into its
points** (the editor has rotation and scale, not a full matrix, so a skew that
cannot be expressed goes into the geometry instead and lands exactly). What it
cannot keep — masks, filters — it reports rather than dropping silently.

Measured against the engine's own render of the same movie, a 7MB feature-
length Flash game imports with **97% of its pixels within a hair** and 89%
exact; the rest is antialiasing and the handful of things listed above.
`toDocument(model, { textAsOutlines: true })` trades editable text for the
movie's own embedded glyph outlines when preservation matters more than
editing, and `{ layerTarget: n }` sets how tall a timeline may stay before
neighbouring layers are combined.

Most of a movie's code usually lives **inside its symbols** — 1 085 scripts
in the test movie: 212 on the main timeline, 873 inside symbols — so the
import report says where each one went rather than only how many there
were.

### flashy-geom.js — Polygon Geometry
Outlines, boolean operations and polyline cutting — what the eraser is built
on. Pure, like the tracer: loops of numbers in, loops of numbers out. A brush
stroke's swept area is taken as a contour of its distance field rather than by
unioning capsules, which keeps a self-crossing scribble solid at the crossing.

### flashy-trace.js — Bitmap Tracer
Raster → vector, with no DOM and no editor: hand it an `ImageData` and it
returns filled path command streams. Quantises colours, finds connected
regions, absorbs undersized ones into their neighbours, walks each region's
boundary and fits quadratic curves to it. Holes come out as extra loops in the
same path, filled even-odd.

### Flashy Studio — The Editor
A browser-based authoring IDE inspired by Macromedia Flash MX2004:
- **Tools** — Selection, Transform, Text, Line, Rectangle, Oval, Pencil, Brush, Paint Bucket, Eyedropper, Hand, Zoom
- **Timeline** — Multi-layer timeline with keyframes, motion tweens, shape tweens, frame scripts, playhead scrubbing, frame range selection
- **Audio** — Import MP3/WAV/OGG (File ▸ Import Sound, or drop a file on the timeline), see the **waveform drawn across the frames it occupies**, **scrub the playhead to hear it**, and choose Stream or Event sync per keyframe. Audio is embedded in the `.flashy`, plays in the HTML export, and is muxed into video export
- **Zoomable timeline** — from 32px per frame down to a quarter-pixel, so a five-minute dialogue track fits on screen. Ctrl+wheel, the − / + / Fit buttons, and the view follows the playhead during playback
- **Dockable workspace** — Drag any panel's tab to any dock, group panels into tab strips, resize every dock and the timeline, collapse or close panels, and reopen them from the Window menu. The arrangement persists. Three presets (Animation / Drawing / Coding) plus Reset Panels; Flash's own shortcuts (F9 Actions, Shift+F9 Color Mixer, Ctrl+L Library, Ctrl+F3 Properties)
- **Properties Inspector** — Full property editing with color pickers, sliders, dropdowns for fill, stroke, transform, blend mode, text formatting
- **Library** — Reusable symbols, convert-to-symbol, drag to stage, **Swap Symbol**
- **Puppet mechanics** — The three symbol behaviours do what they say. A **Graphic** shows a frame you pick, driven by the parent timeline, so it previews as you scrub — this is what you build a mouth or a hand out of. A **Movie Clip** runs its own timeline (frame 1 while editing, animating in Test Movie and exports). A **Button** uses frames 1–4 as Up / Over / Down / Hit and reacts to the pointer
- **Copy / Cut / Paste Frames** — Select a block of timeline cells and copy it (Ctrl+Alt+C), cut it (Ctrl+Alt+X) or paste it at the playhead (Ctrl+Alt+V), across as many layers as were copied — layers are created if the clipboard is deeper than what is below. Pasting overwrites the destination frames but never the ones around them: clearing the middle of a held keyframe leaves both ends intact. The clipboard is a deep copy, so later edits to the source don't follow it
- **Convert Frames to Symbol** — Drag across the timeline to select a block of cells (any number of layers, any span of frames), then **Modify ▸ Convert Frames to Symbol**. The whole span becomes one symbol and the instance lands exactly where the artwork already was, so nothing moves. Keyframes crossing the edge of the selection are clipped and re-indexed; a tween whose destination fell outside is dropped rather than left pointing at nothing; sounds stay on the main timeline, because the engine builds its soundtrack from the root layers and a sound inside a symbol would never play. Choose whether to replace the frames with the instance or keep them
- **Biped template** — **Character ▸ New Biped** builds a complete 13-part rig — hips, spine, head, two arms, two legs — with the joints at the limb tops, the far arm and leg behind the body, elbow and knee limits already set so IK cannot bend them backwards, and a "Rest" pose saved. Every part is an ordinary symbol you can redraw, re-parent or delete
- **Characters** — Build a character from your symbols and pose it on one stage. The **Character** panel shows the part hierarchy; **Character ▸ Add Part** attaches a library symbol to a parent, with its joint starting at the top-centre where a shoulder or hip sits. The **Pose tool (A)** drags a limb to swing it about its joint and the children follow — Ctrl+drag moves the joint itself, Alt+drag shifts the part, Shift snaps the angle. Joints and bones are drawn over the artwork so a pivot in the wrong place is visible rather than merely wrong. Draw order is the rig's own, so the far arm can sit behind the torso it is attached to
- **IK** — With the Pose tool set to **Drag the chain**, pulling a hand bends the elbow and shoulder to follow it; **Swing one part** is the plain one-joint mode. Reach is adjustable (2 joints for an arm from the wrist, 3 to include the shoulder). Give a joint a **limit** so an elbow cannot bend backwards, or **plant** a part so IK holds it still — a planted joint is drawn red on stage, because "why won't this move" is otherwise a baffling few minutes. The solver writes only rotations, so an IK-made keyframe is indistinguishable from one posed by hand
- **Poses and movement** — Save a pose, apply it, or mirror it left-to-right (which is how the second half of a walk cycle gets made). **Animate Poses** writes a sequence onto the timeline as keyframes with tweens between them, optionally looping back to the first pose so a cycle repeats cleanly. What lands is ordinary keyframes: drag a limb on any of them and the tween follows
- **Set up mouth shapes** — **Modify ▸ Set Up Mouth Shapes…** turns a symbol you already have into one lip sync can drive: it gives the symbol one frame per mouth shape (seeded with a copy of your existing drawing, so you edit rather than start over), points the mouth chart at those frames, and optionally opens the symbol so you can draw them. It can also tighten shapes drawn on long keyframes down to one frame each — the usual reason a synced mouth doesn't move. Existing artwork is never discarded
- **Auto lip sync** — **Modify ▸ Auto Lip Sync…** reads a voice track already on the timeline and writes the mouth keyframes for it. Pick the voice, the mouth symbol and the layer; it detects six shapes (rest, M B P, F V/S, A, E, O/U) frame by frame and lays one keyframe per shape across the range the sound occupies. A per-symbol **Mouth Chart** maps each shape to a frame of your symbol and is saved with it, so the next line reuses it. **Min hold** stops the mouth chattering; **Silence** is a percentage of the loudest moment, so quiet recordings still find their pauses. What lands is ordinary single-frame Graphic keyframes — fix a wrong mouth by selecting it and changing `First`, and re-run to replace the range when a line is re-recorded
- **Object handlers** — Select an object and the Actions panel switches from the keyframe's script to that object's `onClipEvent` / `on` handlers, as in Flash. They run in Test Movie and in exported files (never on the authoring stage, like frame scripts), with Flash's own property names and units — so an imported clip that follows the mouse still follows the mouse
- **Nested Editing** — Double-click a symbol to enter its timeline, breadcrumb navigation, edit at any depth
- **Color Mixer** — Fill/stroke colors with swatch picker and alpha control
- **AI Assistant** — Describe what you want and Claude builds it directly in your project: streamed as it writes, with a Stop button, and nothing applied until you press Apply. Runs on `claude-opus-5` with adaptive thinking. Add your own Anthropic API key under **Edit ▸ Preferences**, or from the button the panel shows when no key is set. Note that it works by running model-authored JavaScript inside the editor page — see [ROADMAP.md](ROADMAP.md) §31
- **Bitmaps** — **File ▸ Import Image**, or drop a PNG/JPEG/GIF/WebP on the stage or the timeline. The image lands in the **Library** alongside your symbols, travels inside the `.flashy` as base64 (so a project stays one file), and comes out of every exporter. **Swap Bitmap** repoints an instance without disturbing its box
- **Trace Bitmap** — **Modify ▸ Trace Bitmap…** converts a raster into editable vector shapes, with Flash's four settings: **Color Threshold** (1–500) for how far apart two colours must be to stay separate, **Minimum Area** (1–1000 px) for the smallest region that keeps its own colour, **Curve Fit** from Pixels to Very Smooth, and **Corner Threshold** for whether sharp corners survive or get rounded into the curve. The dialog **retraces as you type and shows the result beside the original** — nobody has an intuition for what "Minimum Area 8" looks like, and in Flash you guessed, pressed OK, looked, and undid. What lands is ordinary filled paths you can recolour, delete and convert to a symbol; holes stay holes
- **Eraser (E)** — Drag to erase, with a size (the `[` and `]` keys, or the slider under the tools) and a round or square tip. It works on **vector art and bitmaps alike**. A shape is subtracted as real geometry: erase a corner and you get an editable filled path, erase through the middle and you get **two objects you can move apart**, erase the inside and you get a genuine hole. Because it is geometry and not a re-rasterise, an edge the brush never touched stays exactly where it was no matter how many strokes you make. A drawn line is **cut rather than outlined**, so the pieces are still lines you can restyle. A bitmap is **masked, not repainted** — the pixels are kept, so erasing costs nothing in the document and *Restore Erased Areas* in the Properties panel takes it all back. Symbols and text are left alone, the way Flash leaves a group alone
- **Flash import** — **File ▸ Import Flash Movie (.swf/.fla)…**, or drop one on the stage or the timeline. A compiled `.swf` or an authoring `.fla`/XFL folder is taken apart into a document you can *edit*: the stage size, frame rate and background; one **layer per display depth** (or per FLA layer, by name); keyframes where things actually change; **motion tweens recovered** from the per-frame placements a publisher bakes out; sprites, buttons and reused shapes as **library symbols**; artwork as editable paths with their real curves; bitmaps and sounds as assets; and the **ActionScript decompiled** onto an Actions layer. The import dialog says what came across and what did not
- **Import** — Open .flashy projects, import from URL (inspect live Flashy animations)
- **Export** — Self-contained HTML with the full engine embedded inline (no server needed — just open the file), plus SVG, a JS module, an embed snippet, a sprite sheet, and WebM/MP4 video
- **Pointer input** — mouse, pen and touch, so the editor works on a tablet

## Quick Start

```bash
# Clone and serve
git clone https://github.com/PrincipalForce/flashy.git
cd flashy
npm start                 # http://127.0.0.1:8000  (Node only — no install needed)

# Open in your browser:
# Engine demo:  http://127.0.0.1:8000/
# Editor:       http://127.0.0.1:8000/editor.html
# Examples:     http://127.0.0.1:8000/examples/
```

Or just open the files directly — no build step, no bundler, nothing to compile.

## Tests

The app is static, but it is not untested — the bugs worth catching here are the
silent ones (artwork missing from an export, a document that will not reopen).

```bash
npm install
npx playwright install chromium   # once
npm test                          # drives the real editor.html
npm run test:ui                   # pick and watch individual tests
```

Specs live in `tests/` and drive the app through the same seams the desktop
build uses (`window._flashyEditor`, `window._flashyAI`). See
`.claude/skills/verify/SKILL.md` for the conventions.

## Desktop App

The same editor also ships as an installed desktop app (Windows, macOS, Linux)
via Electron. It is the identical static app — no separate codebase, no port —
with a native shell around it.

```bash
nvm use                 # Node 26 (24 is the floor; see .nvmrc / engines)
npm install             # electron + electron-builder, devDependencies only

npm run electron:dev        # run it, with DevTools open
npm run electron:preview    # run it exactly as users will get it
npm run dist:win            # → release/Flashy-<version>-win-x64.exe
npm run dist:mac            # → release/Flashy-<version>-mac-<arch>.dmg
npm run dist:linux          # → release/ AppImage + deb
npm run icons               # re-rasterize icon.svg → build-resources/icon.png
```

What the desktop build adds on top of the web app:

- **`.flashy` file association** — double-click a document to open it. Each
  document gets its own window, since the editor holds one document at a time.
- **Real Save** — `Ctrl/Cmd+S` writes back to the file on disk. Save As is
  `Ctrl/Cmd+Shift+S`, and every File ▸ Export goes through a native Save dialog
  instead of the browser download shelf.
- **Unsaved-changes guard** — the title shows a `•` while the document is
  dirty, and closing a window with unsaved work asks Save / Don't Save /
  Cancel. (The web build uses `beforeunload` for this; in Electron that would
  cancel the close without showing anything, so the dialog lives in the main
  process.)
- **Native menu on macOS** only. Windows and Linux use the editor's own in-app
  menu bar — two stacked File menus would just be confusing.

### How the two builds share one codebase

| File | Role |
| --- | --- |
| `electron/main.cjs` | Main process: windows, menu, dialogs, file handling |
| `electron/preload.cjs` | The only bridge into the page, as `window.flashyDesktop` |
| `desktop.js` | Renderer-side desktop behaviour. A no-op in a browser |

`editor-app.js` is wrapped in an IIFE, so `desktop.js` cannot reach in and swap
functions out. Instead the editor publishes a small seam, `window._flashyEditor`
(`menus`, `installDesktop`, `serializeDoc`, `loadDoc`, `doAction`), and the few
file-system-shaped paths inside it — `dlFile`, and the File menu's Open/Save —
check for an installed desktop host first. With no host installed, which is
always the case in a browser, every one of those paths stays browser-native.

The packaged app is served over a custom `flashy://` scheme rather than
`file://`, so the renderer gets a real, stable origin and `localStorage` (the AI
API key) persists the way it does on the web.

Because the app is static, the source files **are** the build output: there is
no bundler step, and `build.files` in `package.json` lists them individually. A
new top-level asset the editor loads at runtime must be added to that list, or
it will 404 inside the packaged app.

## Use the Engine

```html
<canvas id="stage"></canvas>
<script src="flashy.js"></script>
<script>
  const stage = new Flashy.Stage(document.getElementById('stage'), {
    width: 800, height: 600, fps: 30
  });

  // Draw a shape
  const circle = new Flashy.Shape();
  circle.graphics
    .beginGradientFill('radial', [0xff6600, 0xff0000], [1, 1], [0, 1], 0, 0, 50, 50)
    .drawCircle(0, 0, 50)
    .endFill();
  circle.x = 400; circle.y = 300;
  stage.root.addChild(circle);

  // Animate it
  const mc = new Flashy.MovieClip();
  mc.addChild(circle);
  mc.timeline.addTween(circle, 'x', 100, 700, 1, 60, 'bounceOut');
  mc.timeline.addTween(circle, 'y', 100, 500, 1, 60, 'elasticOut');
  mc.timeline.setTotalFrames(60);
  stage.root.addChild(mc);

  stage.start();
</script>
```

## Examples

| Example | Description |
|---------|-------------|
| [Solar System](examples/solar-system.html) | Orbiting planets with moons, Saturn rings, comet, parallax stars |
| [Walk Cycle](examples/walk-cycle.html) | Articulated stick figure with jointed limbs, parallax landscape |
| [Fireworks](examples/fireworks.html) | Particle explosions over city skyline |
| [Underwater](examples/underwater.html) | Fish schools, jellyfish, seaweed, bubbles, sea turtle |
| [Clock](examples/clock.html) | Ornate vector clock with real-time hands and rotating gears |
| [Neon City](examples/neon-city.html) | Cyberpunk rain, neon signs, flying car |
| [Space Shooter](examples/retro-game.html) | Playable arcade game with enemies and particles |
| [Shadow Blade](examples/ninja-game.html) | Playable ninja action platformer |

## The Vision

Flash wasn't just a plugin — it was a creative movement. Millions of artists, animators, and developers used it to build an interactive web that was playful, experimental, and alive. When Flash died, that creative ecosystem went with it.

Flashy exists to bring it back:

- **For creators** — A free, open tool to make vector animations, games, and interactive art, right in the browser
- **For preservation** — SWF and FLA importers to rescue legacy Flash content
- **For the web** — Lightweight engine that runs everywhere, exports self-contained HTML, no plugins needed
- **For the community** — Open source so it can never be taken away again

## Architecture

```
flashy.js          Core engine (Graphics, DisplayObject, MovieClip, Timeline, Stage)
flashy-swf.js      SWF binary reader -> Flash document model (+ MovieClip builder)
flashy-fla.js      FLA/XFL (ZIP + XML) reader -> the same document model
flashy-avm1.js     AVM1 (ActionScript 1/2) bytecode -> readable source
flashy-abc.js      AVM2 (ActionScript 3) ABC -> class outline + frame scripts
flashy-as2.js      onClipEvent/on handlers, run with an AS2-shaped scope
flashy-import.js   Flash document model -> an editable Flashy document
flashy-trace.js    Raster -> vector tracer (pure: ImageData in, paths out)
flashy-geom.js     Polygon geometry for the eraser: outlines, booleans, cutting
editor.html        Editor shell (layout)
editor.css         Macromedia Flash MX2004-style dark chrome theme
editor-app.js      Editor application (tools, timeline, properties, library, AI)
workspace.js       Dockable panel layout: docks, tab groups, splitters, persistence
splash.js          Loading card (tip + fade-out); markup lives in editor.html
desktop.js         Electron integration; inert in a browser
electron/          Desktop shell — main process and preload bridge
feedback.js        In-app bug report / feature request dialog
scripts/           Dev server, packaging helpers, CI guards
tests/             Playwright specs driving the real editor
icon.svg           App mark — favicon on the web, rasterized for the installer
index.html         Engine showcase demo
examples/          Example animations and games
ROADMAP.md         Engineering ledger — defects, fixes, technical debt
VISION.md          Product roadmap from an animator's perspective
```

### One renderer, four outputs

Worth knowing before you touch rendering: an EditorObject is drawn by exactly
two functions, and everything else calls one of them.

| | |
| --- | --- |
| `paintObj` | draws onto any 2D context — the stage (with authoring chrome) and the raster exporters (without) |
| `exportRuntime` | builds a Flashy display list — the HTML export and the JS-module export, serialised with `Function.prototype.toString()` |
| `interpObj` / `frameObjects` | the only tween interpolator, and the only answer to "what is visible on this frame" |

There used to be four hand-maintained copies of this logic, and they had drifted
apart in four separate ways — symbols missing from exports, transforms pivoting
around different origins, tweens off by a frame. If you add an object type or a
property, add it in these and the SVG exporter, and nowhere else.

## Contributing

Flashy is in early development. Two documents set the direction:
[ROADMAP.md](ROADMAP.md) is the engineering ledger — what's broken, what's
fixed, and why. [VISION.md](VISION.md) is the product roadmap written from an
animator's chair: what it would take to make a five-minute voice-acted cartoon
here, organised as Source → Edit → Re-edit → Produce → Save.

Audio landed in 0.4 and puppet mechanics in 0.5, so the next big lever is
auto lip sync. Major areas that need work:

- **Auto lip sync** — phoneme track from a dialogue layer; now unblocked by audio + puppet mechanics, and the biggest remaining time sink in 2D animation
- **Onion skinning** and pressure-sensitive brushes
- **Better tracing** — the tracer is a classic auto-trace, so it produces flat regions. Tapered ink lines from a scanned pencil test is the harder, more valuable problem (see [VISION.md](VISION.md) §Source)
- **Bitmaps on import from URL** — `walkDisplayObject` skips them; recovering the bytes from a live `Bitmap` needs a same-origin canvas
- **Authoring the engine's own features** — gradients, stars, polygons and rounded rects all exist in `flashy.js` with no editor UI to reach them
- **Shape tweening** — interpolating between different vector shapes
- **Filters** — blur, drop shadow, glow (canvas filter API)
- **Masks** — clipping masks using display objects
- **Hit testing** — selection is bbox-only and single-layer; text is not clickable
- **Masks on import** — clip depths are read out of a SWF/FLA in full and then dropped, because the editor's document has no mask layer. The layer is named `… (mask)` so it can be found. Closing this is an editor feature, not a parser one
- **Gradient authoring** — imported gradients draw on the stage and in every export, but there is no stop editor yet: the inspector can turn one into a flat colour, not the other way round
- **AS3 method bodies** — classes, members and frame scripts come across (`flashy-abc.js`); a method with real control flow comes back as readable statements plus comments where its branches were, rather than as reconstructed `if`/`for`
- **LZMA-compressed SWF (ZWS)** — browsers have no LZMA decoder
- **Editor polish** — onion skinning, snap to objects, rulers, align & distribute
- **Flashy Hub** — community sharing platform

Please run `npm test` before opening a PR; CI runs it plus a parse check over
every source file.

## License

MIT. Free forever. Create anything.
