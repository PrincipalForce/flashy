// Renders icon.svg to build-resources/icon.png (1024×1024) so electron-builder
// has a raster app icon to work from.
//
//   npm run icons
//
// The source lives at the repo root rather than here because the web build
// serves the same file as its favicon — one mark, one file, both targets.
//
// This uses resvg (a real SVG rasterizer, prebuilt native binary — no Python or
// C++ toolchain needed) rather than screenshotting an Electron window. A
// screenshot depends on window sizing and display DPI scaling, and when the
// content area comes up a fraction smaller than the capture rect you get a
// strip of background along the right and bottom edges. Rasterizing directly is
// deterministic and headless.
//
// build-resources/icon.png is committed to the repo, so packaging works without
// ever running this script. You only need it after editing icon.svg.
let Resvg;
try {
  ({ Resvg } = require("@resvg/resvg-js"));
} catch (err) {
  console.error(
    "\nCould not load @resvg/resvg-js.\n\n" +
      `  ${err.message}\n\n` +
      "It is a devDependency added for this script. Run:\n\n" +
      "  npm install\n\n" +
      "This is not required to package the app — build-resources/icon.png is\n" +
      "checked in. You only need it to regenerate the icon from the SVG.\n"
  );
  process.exit(1);
}

const fs = require("node:fs");
const path = require("node:path");

const SIZE = 1024;
const SRC = path.join(__dirname, "..", "icon.svg");
const OUT_DIR = path.join(__dirname, "..", "build-resources");
const OUT = path.join(OUT_DIR, "icon.png");

const svg = fs.readFileSync(SRC, "utf8");
const image = new Resvg(svg, { fitTo: { mode: "width", value: SIZE } }).render();

if (image.width !== SIZE || image.height !== SIZE) {
  console.error(`Expected ${SIZE}×${SIZE}, got ${image.width}×${image.height}`);
  process.exit(1);
}

// Guard against a seam along the icon edge: the outermost row and column must
// be real ink. The rounded corners are legitimately transparent, so we sample
// edge midpoints, not corners.
const px = image.pixels;
const alphaAt = (x, y) => px[(y * SIZE + x) * 4 + 3];
const edges = {
  top: alphaAt(SIZE >> 1, 0),
  bottom: alphaAt(SIZE >> 1, SIZE - 1),
  left: alphaAt(0, SIZE >> 1),
  right: alphaAt(SIZE - 1, SIZE >> 1),
};
const bad = Object.entries(edges).filter(([, a]) => a !== 255);
if (bad.length) {
  console.error(
    `Transparent pixels on ${bad.map(([e]) => e).join(", ")} edge(s) — icon would show a seam.`
  );
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, image.asPng());
console.log(`wrote ${OUT} (${SIZE}×${SIZE}, edges clean)`);
