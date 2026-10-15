# Flashy for Animators — The Producer's Cut

A product roadmap written from the chair of someone who shipped cartoons on
Newgrounds: five-minute shorts, voice acted, music driven, drawn in a Flash
timeline at 2am the night before a deadline.

[ROADMAP.md](ROADMAP.md) is the engineering ledger — what's broken, what's
missing structurally. **This is the other half: what makes a working animator
choose Flashy on purpose.** The two are ordered differently, because an
animator does not care that `editor-app.js` is 4,000 lines; they care that lip
syncing one minute of dialogue takes four hours.

Everything here is organised around the five things an animator actually does:

> **Source → Edit → Re-edit → Produce → Save**

and the frame around all five: **the workspace**.

---

## Where Flashy stands today

Verified against the code, not the README.

**Genuinely good:** a clean vector engine with a real display list and nested
MovieClips, a timeline with layers and keyframed motion tweens, library symbols
with nested editing, frame scripts that execute, self-contained HTML export,
SWF/FLA importers, a dockable workspace, and — uniquely — an AI collaborator
that builds directly into the document. The MX2004 chrome is right.

**Missing, in the order an animator hits it:**

| Gap | State in code |
| --- | --- |
| Onion skinning | Does not exist. |
| Masks | Layer-type dropdown offers "Mask"; nothing implements it. |
| Filters (blur/glow/shadow) | Engine has a bare `shadowBlur`; no filter UI. |
| Frame labels | **Engine supports them** (`Timeline.addLabel`, `resolveFrame("intro")`) — the editor never exposes them. |
| Gradients, stars, polygons, rounded rects | **Engine supports all four** (`beginGradientFill`, `drawStar`, `drawPolygon`, `drawRoundRect`) — the editor can only author solid-filled rects, ovals, lines and strokes. |
| Shape tween | Menu item sets a flag; no interpolation, no hints. |
| Tablet pressure | Pointer Events are wired, so `e.pressure` already arrives — and is discarded. |
| Camera, Scenes, library folders, align/guides/rulers, bitmaps | None. |
| Paint bucket | Recolors a whole object. Not a fill tool — no regions, no gap closing. |

Audio landed in 0.4 and puppet mechanics in 0.5 — between them, the two gaps
that made the tool unusable for this kind of work. What is left is mostly
tedium removal, effects, and production scale.

---

## ✅ 0. The workspace — shipped

**What landed.** Every panel — Properties, Color Mixer, Library, Actions, AI
Assistant — is now dockable. Drag a tab to any dock to move it; drop it on
another tab strip to group them; drag splitters to resize the right dock, the
bottom dock, the timeline, and individual stacked panels; collapse a dock to
its tab strip; close a panel and reopen it from the new **Window** menu. The
arrangement persists across reloads. Three presets ship — **Animation**,
**Drawing**, **Coding** — plus **Reset Panels**. Shortcuts are Flash's own:
`F9` Actions, `Shift+F9` Color Mixer, `Ctrl+L` Library, `Ctrl+F3` Properties.

**Why this comes before the feature list.** A panel layout is personal and
task-dependent. Drawing wants a big stage and the Color Mixer to hand; lip
syncing wants a tall timeline and nothing else; scripting wants the Actions
panel filling half the screen. A fixed layout means fighting the tool during
whichever of those you are not doing — and Flashy's layout was fixed, with the
script editor pinned to a 60px strip at the bottom. Now it can fill the right
column.

**Two things this also fixed.** The bottom bar had a "Properties" tab that
rendered an **empty box** — the real Properties panel only ever existed in the
right column. There is now one Properties panel and it goes where you put it.
And the timeline was a fixed 200px; it is now draggable, which matters the
moment you have more than four layers.

**What makes it robust rather than merely present:** a saved layout is
untrusted input — it can come from an older build, a newer one, or a corrupted
value. The restore pass validates against the panel registry: unknown ids
dropped, registered panels missing from the layout appended to their home dock
(so a panel added in a later release appears for existing users), sizes
clamped, empty groups pruned, and any unrecoverable parse falls back to the
default arrangement instead of throwing. A stale layout can never leave the
editor unusable. Panel *content* is moved between docks, never rebuilt, so a
half-typed frame script or a long AI conversation survives being re-docked.
Eight specs cover all of that, including the corrupt-layout case.

**Still to come here:** floating/tear-off panels into their own window, a left
dock, saving named custom workspaces, and per-panel minimum sizes.

---

## SOURCE — getting material in

### ✅ 1. Audio — shipped in 0.4

**What landed.** Import MP3/WAV/OGG via File ▸ Import Sound or by dropping a
file straight onto the timeline (where you drop chooses the frame and layer).
The **waveform draws across the frames the sound occupies**, one amplitude
bucket per frame column. **Dragging the playhead scrubs the audio** — a short
slice per frame step, which is how you find the frame where "b" becomes "p".
Per keyframe: asset, **Stream or Event sync**, volume, loop, and a Preview
button. Audio is embedded in the `.flashy`, so a project is still one file; it
plays in the HTML export and is muxed into the video export.

**The part that matters most:** with a stream sound playing, the playhead is
derived from the **audio clock**, not a timer. That is what Stream sync means —
the animation follows the sound and drops frames if it must, rather than
drifting away from it. (This also replaced the old `setInterval` playback,
which drifted and ignored an FPS change made mid-play.)

**Design notes.** Sounds attach to *keyframes*, Flash's model, so any layer can
carry audio rather than needing a special layer type. Documents store only the
encoded bytes and a duration; waveform peaks are recomputed from the decoded
buffer on load, which keeps files far smaller than caching a waveform would —
the timeline draws a flat bar until the decode lands, then redraws itself.
Dropping a 12-second track onto a 1-frame layer extends the layer to fit,
because hearing nothing would otherwise be the obvious trap. Browsers block
audio until a user gesture, so the HTML export opens behind a play button when
it has a soundtrack, and starts immediately when it does not.

Nine specs cover it, generating a WAV in the page rather than shipping a binary
fixture.

**Still open here:** volume/pan envelopes over time, trimming the in/out points
of a clip, per-layer mute/solo, and a deterministic (non-real-time) video
export — live audio capture needs a real-time clock, so frame-stepping plus
sound would need WebCodecs and a muxer.

### 2. Bitmap import ✅ (0.7.4)

Backgrounds, textures, photo gags, scanned pencil tests — File ▸ Import Image,
or drop one on the stage. **Swap Bitmap** repoints an instance without
disturbing its box, and **Trace Bitmap** turns a raster into editable filled
paths with Flash's four settings and a live preview. Images ride inside the
`.flashy` and come out of every exporter.

What is still missing is the *good* tracing described in §"Source" below:
this is a classic auto-trace, so it gives you flat regions, not tapered
ink lines.

### 3. Import from another project ⬜

Open another `.flashy` as an external library and drag symbols out of it. This
is how a character rig gets reused in episode 2 instead of being copy-pasted,
and how a collab assembles.

### 4. A pose / asset shelf ⬜

Cross-project storage for rigs, mouth charts, SFX, backgrounds. Flash animators
kept a "parts.fla" and raided it forever.

---

## EDIT — the drawing and animating itself

### ✅ 4b. Character rigging — shipped in 0.6

A character used to mean a pile of nested symbols, and posing one meant diving
into a symbol per limb to turn it, with no way to see the whole figure while
you worked. That is the single biggest reason Flash character animation was
slow.

A **character** in Flashy is a flat set of parts in one keyframe, each carrying
its parent and its pivot. Transforms compose as
`translate(pivot) · rotate · scale · translate(-pivot)` for every ancestor and
then the part itself, all in one shared space. Two things follow, and both
matter more than they sound:

- **Parenting never moves anything.** Parts keep the coordinates you drew them
  at, so building a rig cannot disturb the artwork.
- **You pose the whole character on one stage.** Rotating the shoulder swings
  the arm because the child inherits the ancestor transforms — no nesting, no
  diving in and out of symbols.

Draw order is a separate `rigZ`, because the far arm has to sit *behind* the
torso it hangs off, which a nested hierarchy cannot express at all.

The same formula maps onto two nested engine containers per part, so the HTML
export composes identically rather than baking an approximate matrix — a spec
asserts the stage and the export agree on a posed limb to sub-pixel precision.

**Poses** are per-part transforms, never artwork, so a pose still applies to a
character you have since redrawn. **Mirror** swaps left/right parts (inferred
from their names) and reverses the swing, which is how the back half of a walk
gets built. **Animate Poses** writes a sequence as keyframes with tweens and an
optional loop back to the first pose. What lands is ordinary keyframes — drag a
limb on any of them and the tween follows.

**IK shipped in 0.7.1.** Dragging a limb bends the joints above it to follow —
Cyclic Coordinate Descent rather than a closed-form two-bone solve, because a
character wants three joints (shoulder/elbow/wrist, hip/knee/ankle) and
sometimes a spine, and CCD handles any length while honouring per-joint limits
and planted parts for free. The point worth repeating: **the solver writes
nothing but `rotation`**, so IK is an authoring aid and poses, keyframes,
tweens and the export are completely untouched by it. A keyframe made by
dragging a hand is indistinguishable from one posed joint by joint.

Joints take optional limits (an elbow that only bends one way) and parts can be
planted so a drag cannot shift them — without limits the solver happily finds
the anatomically wrong answer, because it has no idea which way a knee goes.
Out of reach, the limb straightens toward the target and stops, which is what
it should do.

**The biped template shipped in 0.7.2.** A complete 13-part rig in one step,
with the things a first-time rigger gets wrong already right: joints at the top
of each limb, the far arm and leg behind the body, elbow and knee limits so IK
stays anatomically honest, and a saved "Rest" pose so Animate Poses is usable
immediately. The parts are ordinary symbols, so it is a starting point rather
than a fixed skeleton.

### ✅ 5. Puppet mechanics — shipped in 0.5

**What landed.** `symbolBehavior` now means something, and the three
behaviours differ exactly as they do in Flash:

- **Graphic** — shows a frame chosen *relative to the parent timeline*, with
  **Loop / Play Once / Single Frame** and a **First frame** picker (plus
  ◀ Prev / Next ▶ buttons, because stepping frames is the inner loop of lip
  sync). It previews as you scrub, which is the whole reason this is the
  behaviour you build a mouth or a hand out of.
- **Movie Clip** — a real nested clip with its own timeline in exports; frame
  1 on the authoring stage, same as Flash, so you Test Movie to see it run.
- **Button** — frames 1–4 are Up / Over / Down / Hit, wired to the pointer in
  exports, with Up shown while editing and a fallback to Up for any state the
  symbol doesn't have.

Plus **Swap Symbol**: repoint an instance at a different library symbol and
keep its position, transform, behaviour and frame settings. Re-posing a puppet
used to mean deleting the instance and reapplying every property by hand.

**Why it mattered.** This is the mechanical basis of *all* puppet animation —
a mouth with ten phoneme frames, eyes with open/half/closed, a hand with six
poses. You animate by picking frames, not by redrawing. Every symbol instance
previously rendered frame 1 forever, so the most common Flash technique was
simply unavailable.

**The interesting part of the implementation.** The export runtime rebuilds its
display list every frame, which is fine for shapes and fatal for anything with
state: a MovieClip rebuilt each frame would reset to frame 1 forever, and a
Button would lose its hover the instant the mouse moved. Stateful instances are
therefore **built once and cached by their position in the document**, keyed by
layer:keyframe:index. Graphics stay immediate-mode, because being rebuilt from
the parent playhead is precisely what they are for.

Also tidied in passing: a symbol instance no longer shows dead Fill and Stroke
controls (the artwork inside the symbol carries its own), and the Symbol
Instance section moved to the *top* of the Properties panel — the frame picker
is the control you touch constantly, and it was below four sections of noise.

Eight specs, including pixel-level checks that a Graphic really shows the frame
you picked and wraps or clamps correctly, and an export check that a nested
clip keeps its own playhead across frames rather than being rebuilt.

### 6. The drawing tools that are missing ⬜

The current set (select, transform, text, line, rect, oval, pencil, brush,
bucket, eyedropper, hand, zoom) is about half of what the work needs:

| Tool | Why |
| --- | --- |
| **Subselection** (edit points/handles) | Right now a stroke can only be redrawn, never adjusted. This is the single most-missed editing capability. |
| **Pen / bezier** | Clean curves. The README has claimed a Pen tool that does not exist. |
| ~~**Eraser**~~ ✅ (0.7.5) | Erases vector shapes and bitmaps alike. A shape is subtracted as real geometry — erase through the middle and you get two objects you can move apart; erase the inside and you get a hole. A line is cut rather than outlined, so the pieces are still lines. A bitmap is masked, so it is reversible. Still missing Flash's Erase Fills / Erase Lines / Erase Inside modes and the faucet. |
| **Lasso / magic wand** | Select part of a drawing, not whole objects. |
| **Free Transform with handles** | Rotate/scale/skew on the stage with a visible transform point, not numeric fields. The transform point is also the rotation pivot for tweens. |
| **Gradient fills + gradient transform** | **The engine already has `beginGradientFill`** (linear and radial) and the editor cannot author one. Skies, shading, glows — all gradient work. Cheap, high-visibility win. |
| **Star / polygon / rounded-rect tools** | **Engine already has `drawStar`, `drawPolygon`, `drawRoundRect`.** Same story: capability present, no way to reach it. |
| **A real paint bucket + ink bottle** | Fill an enclosed region with gap tolerance; restyle a stroke without reselecting. Today's bucket just recolors an entire object. |
| **Width / taper tool** | Variable-width strokes — the Flash "line quality" look. |
| **Pressure-sensitive brush + smoothing slider** | `e.pressure` is already arriving at the handler and being thrown away. The Brackenwood/Oney line quality comes from here. |
| **Snap to object / align / distribute / rulers / guides** | The daily grind of placing things accurately. |

### 7. Onion skinning and Edit Multiple Frames ⬜

Ghost the previous/next N frames behind the current one, with adjustable range.
Edit Multiple Frames to move artwork across a whole range at once. You cannot
draw frame-by-frame without seeing where the limb was. *Touches `render()`
only — draw neighbouring frames through the existing `frameObjects()` at
reduced alpha.*

### 8. A camera ⬜

A camera layer with its own keyframes: pan, zoom, rotate, plus a **shake**
preset. Flash animators faked this for a decade by putting the whole cartoon
inside one MovieClip and tweening it. Zooms and shakes are the grammar of
action animation.

### 9. Custom ease curves ⬜

A draggable bezier ease per tween, with the option to ease position separately
from rotation/scale/alpha. Snappy timing — fast-out, slow-in, overshoot — lives
in a hand-drawn curve, not in 14 named presets. *Touches `easeAmount()`, one
function used by every renderer.*

### 10. The look: masks, filters, shape tween, motion guides, blend modes ⬜

| | |
| --- | --- |
| **Masks** | Shading, iris wipes, text reveals, spotlights. The layer-type dropdown already offers "Mask" and does nothing. |
| **Filters** — blur, glow, drop shadow, colour adjust | Muzzle flashes, magic, motion blur, depth. Flash 8's filters changed what the platform looked like overnight. |
| **Shape tween + hints** | Morphing, liquid, squash-and-stretch on drawn shapes. |
| **Motion guides** | Tween along a drawn path. Anything that arcs. |
| **Blend modes in the UI** | The engine already honours `blendMode`; just expose it. Additive glow is a whole genre's look. |

---

## VECTOR AI — the unfair advantage

Every other item in this document is Flashy catching up to a 2007 application.
This section is the one where it can be *better*, and it is specifically about
**vector** AI: output that lands in the document as editable shapes, layers and
symbols — not a flat PNG pasted on top.

That distinction is the whole thing. A raster image generator produces
something an animator cannot animate. What they need is art that arrives with
separable limbs, named layers, sane point counts and a transform point, so the
next hour is spent animating it rather than tracing it.

### The pipeline this plugs into

| Stage | AI tool | Why it earns its place |
| --- | --- | --- |
| **Source** | **Sketch → vector** | Animators draw on paper, in Procreate, on an iPad. Today that scan is unusable. Real AI tracing — clean tapered lines, closed regions, separated layers, not the 4,000-node mush a classic auto-trace produces — turns any drawing surface into a Flashy input. |
| **Source** | **SVG round-trip** | Illustrator/Inkscape/Affinity art in and out. Plain feature, but it is the other half of "bring your own drawing tool". |
| **Edit** | **Rough → clean (auto-ink)** | Draw loose on a rough layer; get a clean inked pass with consistent line weight and taper. After lip sync this is the biggest single time sink in 2D animation, and it is exactly the kind of mechanical-but-not-automatable work a model is good at. |
| **Edit** | **Auto-flatting / colour fill** | Fill enclosed regions of line art with flats, tolerating gaps the artist left. "Flatting" is a paid human job in comics and animation; it should be a button. |
| **Edit** | **Palette extraction & harmonisation** | Pull a palette from a reference image into the Color Mixer; recolour a selection to it. "Make this scene read as night." |
| **Edit** | **Vector cleanup** | Simplify point counts without moving the silhouette, close gaps, merge duplicate shapes. Keeps files editable *and* fast — a hand-drawn stroke can carry hundreds of redundant points. |
| **Edit** | **Natural-language edits on a selection** | "Make these eyes angrier." "Add a rim light on the left." "Thicken the outline, keep the interior lines." Operating on selected shapes, not the whole document. |
| **Re-edit** | **In-betweening** | Two keyframes in, the frames between out — with stroke correspondence, so the interpolation is per-line rather than a crossfade. The holy grail of 2D, and the clearest demonstration that a vector document beats a video timeline. |
| **Re-edit** | **Phoneme set from one mouth** | You draw the "A" mouth; the other nine arrive as frames of the same symbol, consistent in style. Feeds straight into auto lip sync. |
| **Re-edit** | **Rig from a drawing** | Detect the limbs in a character pose, cut them into symbols, set transform points, assemble a puppet with a sane hierarchy. Rigging is an hour of scissors work per character. |
| **Re-edit** | **Turnarounds and alternate angles** | "The same character, three-quarter view." Style-consistent, as editable vectors. |
| **Produce** | **Script / storyboard → scene stubs** | Paste a script: get scenes with frame labels, rough durations, camera moves and placeholder art, ready to animate over. Blocking out a five-minute short is a day of clicking. |

### What makes it actually usable rather than a demo

Four constraints, learned from every AI feature that got switched off after a
week:

- **The output must be editable.** Named layers, grouped symbols, a point count
  a human can select and drag. Art that arrives as one 3,000-node blob is a
  screenshot with extra steps.
- **It must be non-destructive.** Generate into a new layer, preview before
  committing, one undo to remove. Flashy's Apply-button pattern is already
  this; every tool above should use it.
- **It must be iterable.** "Again but looser", "keep the pose, change the
  hands". A tool you cannot steer gets one try and then abandoned.
- **The cheap half should need no API key.** Tracing, flatting, gap closing,
  simplification and palette extraction are geometry and classic CV — they can
  run locally, offline, free. Reserve the API for the genuinely generative
  parts. That split decides whether a teenager with no credit card can use any
  of this, which is exactly who Newgrounds was for.

### Where Flashy already stands

The assistant exists, it streams, it accepts a reference image, and it writes
into the live document through `window._flashyAI` — so the plumbing for
"model produces editable document objects" is built and tested. What is missing
is the vocabulary: today it can only create `rect`, `oval`, `line`, `pencil`
and `text`. Give the document model gradients, bitmaps, bones and real path
objects (all listed above) and the same assistant immediately becomes capable
of most of this table. **The feature gaps and the AI gaps are the same gaps.**

---

## RE-EDIT — the stage Flash was worst at

Nobody finishes a cartoon in one pass. This is where hours quietly disappear,
and where Flashy has the most room to be better rather than equal.

### ✅ 12. Auto lip sync — shipped in 0.6

Lip sync was *the* grind — four to six hours per minute of dialogue, redone
every time a line is re-recorded. People bought **Magpie Pro** as a separate
application purely for this.

**Modify ▸ Auto Lip Sync…** now reads a voice track already on the timeline and
writes the mouth keyframes. Pick the voice, the mouth symbol and the layer to
write onto; it analyses the audio frame by frame and lays down one keyframe per
mouth shape, across the exact frame range the sound occupies.

Six shapes, because six is what the signal actually supports: rest, **M B P**
(lips together), **F V / S**, **A** (open), **E** (wide), **O / U** (round). The
detection is the textbook one rather than a guess — zero-crossing rate finds
fricatives, energy in the first-formant band gives openness, and the ratio of
second formant to first separates "ee" from "oo" (both put most of their energy
low, so a plain loudness or low-band test cannot tell them apart, and the first
cut of this code didn't).

The things that make it usable rather than a demo:

- **Set Up Mouth Shapes** prepares a symbol you already have: one frame per
  shape, seeded from your existing drawing, with the chart pointed at them.
  Knowing the convention used to be a prerequisite; now it is a menu item.
- **A Mouth Chart** maps each shape to a frame of the symbol, once per
  character, and is saved with the symbol — so the next line reuses it.
- **Min hold** sets the shortest a shape may last. Without it the mouth
  chatters one frame at a time and the pass is worthless; the default of 2
  frames matches how it is done by hand.
- **Silence** is a percentage of the loudest moment, not an absolute level, so
  a quiet or noisy recording still finds its own pauses.
- **The chart defaults to where the drawings actually are** — the symbol's
  keyframe start indices, not frames 1..6. Mouth shapes are usually drawn on
  multi-frame keyframes, and a 1..6 chart lands every shape inside the first
  one: the pass reports success and the mouth never moves. If a chart still
  collapses two shapes onto one drawing, the result says so instead of
  looking like the detection failed.
- **What lands is ordinary keyframes.** Single-frame Graphic instances with
  `First` set — nothing special, nothing locked. You fix a wrong mouth by
  selecting its keyframe and changing `First`, the same way you would have
  made it by hand. Re-running replaces the range instead of stacking onto it,
  so iterating on a re-recorded line is one undo-free pass.

It is advertised as a first pass you then fix, which is the honest claim and
also the one animators want — the grind was never the 10% that is wrong.

### 🚧 13. Swap Symbol ✅, Find & Replace ⬜, Edit Multiple Frames ⬜

**Swap Symbol shipped in 0.5** — repoint an instance, keep its transform.
Still missing: changing every instance of a symbol at once, and moving a whole
pose range across frames. Re-editing those still means hunting instance by
instance.

### 14. Scenes, frame labels and timeline comments ⬜

Long cartoons are shot lists; one 7,000-frame timeline is unnavigable. Labels
let you jump to "fight-start" and script `gotoAndPlay("ending")` instead of
hard frame numbers that break the moment you insert six frames.
**The engine already supports labels — this is pure UI.**

### 15. Library folders, search, find-unused ⬜

Character rigs are 50+ symbols each. A flat alphabetical list collapses fast,
and dead symbols bloat every export.

### ✅ 16. Timeline zoom and navigation — shipped in 0.5.1

Fixed 12px frames meant a 7,000-frame cartoon was 84,000 pixels of scrolling —
and worse, a canvas that wide exceeds the browser's limit and silently stops
painting, which is exactly what a five-minute soundtrack produced. The timeline
now renders only the visible columns, zooms from 32px/frame to ¼px (Ctrl+wheel,
− / + / Fit), and follows the playhead during playback.

### 17. An undo history panel ⬜

Jump back ten steps and see where you are. Flash's History panel, plus the
thing it never had: undo that survives a crash.

### 18. Version control, because the document is JSON ⬜ **structurally new**

A `.flashy` file is plain JSON. **Animation gets real version control for the
first time**: diffs, branches, merges, blame, pull requests. Two animators work
on different scenes and merge. A thirty-person collab runs like a software
project instead of an email chain of FLAs — merging two FLAs was famously
impossible. Needs scene-level file splitting, "import scene from project", a
collab template pinning stage size and frame rate, and conflict-aware library
merging.

---

## PRODUCE — getting it out

### ✅ 19. Video export with the audio muxed in — shipped in 0.4

Every sound is scheduled against the AudioContext clock at the moment its start
frame will be recorded, routed to a `MediaStreamDestination`, and that track is
added to the recorded stream. In 2005 you published a SWF to the portal; today
the cartoon goes to YouTube, and a silent export is not a deliverable.

⬜ **Still real time**, because live audio capture needs a real-time clock. A
deterministic frame-stepped export *with* sound needs WebCodecs plus a muxer —
worth doing, but a separate piece of work.

### 20. A real GIF encoder ⬜

"Export as Sprite Sheet" is now honestly named, but reaction GIFs are a
currency and the tool should make them.

### 21. Test Movie that is the real thing ✅ / ⬜

Already exports the true runtime (shared with the HTML export, so what you test
is what ships). Still wants: play from current frame, loop a frame range, and
mute.

### 22. The Hub — a portal again ⬜

Publish from inside the editor. Embed anywhere. Collections, ratings, front
page, author pages, medals and scoreboards for games. What people miss is not
the Flash IDE — it's the *portal*: somewhere a weird four-minute cartoon found
ten thousand people in a day with no gatekeeper. Rebuilding the tool without
rebuilding the audience solves the less interesting half.

### 23. Remix culture, legitimised ⬜

Flash's decompiler scene is how a generation learned to animate. Flashy can
make that a feature: published projects optionally forkable, "view source" on
the timeline, a remix graph, attribution built in.

---

## SAVE — not losing the work

### 24. Dirty-state guard ✅

Shipped. The title shows `•` while unsaved; closing a window asks Save / Don't
Save / Cancel; File ▸ New and Open only interrupt when there is something to
lose. Previously, closing a tab destroyed the document silently.

### 25. Autosave and crash recovery ⬜

Periodic snapshot to IndexedDB, offered back after a crash. Flash lost people's
nights; this is cheap insurance and a visible trust signal.

### 26. Real Save in the browser ⬜

File System Access API, so web Ctrl+S overwrites the file instead of producing
`animation (14).flashy` in Downloads. The desktop build already proves the
model.

### 27. Incremental and named saves ⬜

"Save As increment" (`ep1_v07.flashy`), and a snapshot you can roll back to.
Animators do this by hand, badly, with filenames.

### 28. Signed desktop app with auto-update ⬜

Unsigned installers hit a SmartScreen wall; an unnotarized DMG is blocked
outright. Most downloads never become installs, and anyone who does install
never gets a fix. (ROADMAP §28 — blocked on certificates, not code.)

### 29. It cannot be taken away ✅

MIT, no plugin, no runtime to deprecate, output is plain HTML that opens in a
browser in 2045. Flash died by corporate decision and took a decade of culture
with it. "This can't happen again" is a real feature to the people who lived
through it — and belongs on the front page.

---

## What I'd do next

The dependency graph is unusually clean: audio unlocks the two features that
would most define the tool.

1. ~~**Audio**~~ — ✅ shipped in 0.4, along with video export with sound.
   *Flashy can now make a cartoon.*
2. ~~**Puppet mechanics**~~ — ✅ shipped in 0.5. *Flashy now makes cartoons the
   way Flash people do.*
3. **Auto lip sync** — fully unblocked now that audio and mouth-frame switching
   both exist. The feature they'd tell each other about.
4. **Onion skin + pressure brush** — both small, both felt instantly. Pressure
   is nearly free; the data is already arriving at the handler.
5. **The drawing-tool gap** (parallel) — start with gradients, stars/polygons
   and subselection. The first two are *already in the engine*; they need a UI
   and nothing else.
6. **Vector AI, cheap half first** (parallel) — tracing, flatting, cleanup and
   palette extraction need no API key and no new document types. Then auto-ink
   and in-betweening once paths and pressure exist.

Then effects (masks → filters → blend-mode UI) on one track and production
scale (scenes, labels, library folders, timeline zoom) on the other. Camera and
ease curves wherever they fit — both are one-function changes now that the
renderers are unified.

**Throughout:** every item lands in *one* renderer, *one* interpolator and *one*
export runtime, because the consolidation work means there is no second copy to
forget — and there is a test suite with CI to land it against.

### The pitch, in one paragraph

*Flashy is the Flash timeline you remember, with the three things Flash never
had: a document that is text, so a cartoon can be built like software by a
team; an output that is the open web, so it outlives whoever made it; and a
collaborator inside the tool that does the in-betweens, the phoneme mouths and
the rigging boilerplate while you do the drawing. Bring the audio, keep the
muscle memory, lose the four hours of lip sync.*
