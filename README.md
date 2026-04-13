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
- **Nested MovieClips** — Clips within clips, each with their own independent timeline
- **Frame Scripts** — Attach JavaScript to any frame for interactive behavior
- **Event System** — enterFrame, click, mouseDown, mouseMove, mouseUp with display-list hit testing
- **Stage** — Fixed-step game loop with configurable FPS and HiDPI support

### flashy-swf.js — SWF Importer
Load legacy .swf files directly. Parses headers, DefineShape 1-3, DefineSprite, PlaceObject2, SetBackgroundColor. Bring old Flash content back to life.

### flashy-fla.js — FLA/XFL Importer  
Open Flash authoring files. Reads CS5+ ZIP-based .fla files and unzipped XFL directories. Parses DOMDocument.xml, edge strings, fill/stroke styles, and symbol libraries.

### Flashy Studio — The Editor
A browser-based authoring IDE inspired by Macromedia Flash MX2004:
- **Tools** — Selection, Transform, Pen, Text, Line, Rectangle, Oval, Pencil, Brush, Eyedropper, Hand, Zoom
- **Timeline** — Multi-layer timeline with keyframes, motion tweens, shape tweens, frame scripts, playhead scrubbing, frame range selection
- **Properties Inspector** — Full property editing with color pickers, sliders, dropdowns for fill, stroke, transform, blend mode, text formatting
- **Library** — Reusable symbols (MovieClip, Graphic, Button), convert-to-symbol, drag to stage
- **Nested Editing** — Double-click a symbol to enter its timeline, breadcrumb navigation, edit at any depth
- **Color Mixer** — Fill/stroke colors with swatch picker and alpha control
- **AI Assistant** — Describe what you want and an AI agent creates it directly in your project (requires Anthropic API key)
- **Import** — Open .flashy projects, import from URL (inspect live Flashy animations), load .swf and .fla files
- **Export** — Self-contained HTML with the full engine embedded inline. No server needed — just open the file.

## Quick Start

```bash
# Clone and serve
git clone https://github.com/PrincipalForce/flashy.git
cd flashy
python -m http.server 8000

# Open in your browser:
# Engine demo:  http://localhost:8000/
# Editor:       http://localhost:8000/editor.html
# Examples:     http://localhost:8000/examples/
```

Or just open the files directly — no build step, no bundler, no npm install.

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
flashy-swf.js      SWF binary parser and importer
flashy-fla.js      FLA/XFL (ZIP + XML) parser and importer
editor.html        Editor shell (layout)
editor.css         Macromedia Flash MX2004-style dark chrome theme
editor-app.js      Editor application (tools, timeline, properties, library, AI)
index.html         Engine showcase demo
examples/          Example animations and games
```

## Contributing

Flashy is in early development. Major areas that need work:

- **Shape tweening** — interpolating between different vector shapes
- **Sound support** — audio playback synced to timeline
- **Filters** — blur, drop shadow, glow (canvas filter API)
- **Masks** — clipping masks using display objects
- **More SWF tags** — DefineShape4, DefineMorphShape, DefineText, ActionScript bytecode
- **Better FLA parsing** — gradient fills, bitmap fills, tweens from XFL
- **Editor polish** — symbol editing UX, onion skinning, snap to objects, rulers
- **Flashy Hub** — community sharing platform

## License

MIT. Free forever. Create anything.
