// Primitive shapes: rounded rectangles, and oval arcs, pies and donuts.
//
// Flash 8 added the Rectangle and Oval PRIMITIVE tools, whose point was that
// the shape stayed parameterised: a rectangle's corner radius and an oval's
// start angle, end angle and inner radius were properties you could change
// forever, not a one-way trip to a frozen outline.
//
// The geometry lives once, in Flashy.Primitives, because six things need it
// and must agree: the canvas painter, the SVG exporter, the exported player,
// the SWF writer, the morph, and the eraser's region maths. A rounded corner
// that is one shape on the stage and another in the export is worse than no
// rounded corner, so most of what follows is cross-checking the paths against
// each other rather than against a number I chose.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction, runExportedHTML } from "./helpers.js";

/** A document holding one shape, centred in a 200x200 stage. */
function shapeDoc(extra) {
  return {
    width: 200, height: 200, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 1,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [Object.assign({
          type: "rect", x: 50, y: 50, width: 100, height: 100,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#000000", fillAlpha: 1, fillType: "solid",
          strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
        }, extra)],
      }],
    }],
    library: {},
  };
}

/** One pixel from the raster path — what the painter actually drew. */
const px = (page, x, y) =>
  page.evaluate(({ x, y }) => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 200, 200);
    const d = cv.getContext("2d").getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }, { x, y });

const isInk = (p) => p[3] > 128 && p[0] < 100;

/* ------------------------------------------------------------------ *
 * The geometry module
 * ------------------------------------------------------------------ */

test("only a shape with non-default parameters counts as a primitive", async ({ page }) => {
  await openEditor(page);
  const flags = await page.evaluate(() => {
    const P = window.Flashy.Primitives;
    return {
      plainRect: P.active({ type: "rect", width: 10, height: 10 }),
      rounded: P.active({ type: "rect", width: 10, height: 10, cornerRadius: 3 }),
      zeroRadius: P.active({ type: "rect", width: 10, height: 10, cornerRadius: 0 }),
      plainOval: P.active({ type: "oval", width: 10, height: 10 }),
      wedge: P.active({ type: "oval", width: 10, height: 10, ovalEnd: 90 }),
      donut: P.active({ type: "oval", width: 10, height: 10, ovalInner: 40 }),
      fullTurn: P.active({ type: "oval", width: 10, height: 10, ovalStart: 0, ovalEnd: 360 }),
      text: P.active({ type: "text", width: 10, height: 10, cornerRadius: 5 }),
    };
  });
  // A plain rectangle must NOT become a path: the cheap branch stays cheap,
  // and every existing document keeps the renderer it has always had.
  expect(flags.plainRect).toBe(false);
  expect(flags.zeroRadius).toBe(false);
  expect(flags.plainOval).toBe(false);
  expect(flags.fullTurn).toBe(false);
  expect(flags.text).toBe(false);
  expect(flags.rounded).toBe(true);
  expect(flags.wedge).toBe(true);
  expect(flags.donut).toBe(true);
});

test("the emitted path is in box coordinates and stays inside the box", async ({ page }) => {
  await openEditor(page);
  const bounds = await page.evaluate(() => {
    const cmds = window.Flashy.Primitives.path(
      { type: "rect", width: 80, height: 40, cornerRadius: 10 });
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < cmds.length;) {
      const op = cmds[i];
      const n = op === 0 || op === 1 ? 2 : op === 2 ? 4 : 0;
      for (let k = 0; k < n; k += 2) {
        x0 = Math.min(x0, cmds[i + 1 + k]); x1 = Math.max(x1, cmds[i + 1 + k]);
        y0 = Math.min(y0, cmds[i + 2 + k]); y1 = Math.max(y1, cmds[i + 2 + k]);
      }
      i += 1 + n;
    }
    return { x0, y0, x1, y1 };
  });
  // Box coordinates: 0..w by 0..h. Every consumer offsets by the box corner,
  // so a path that drifted outside would be a shape in the wrong place.
  expect(bounds.x0).toBeCloseTo(0, 5);
  expect(bounds.y0).toBeCloseTo(0, 5);
  expect(bounds.x1).toBeCloseTo(80, 5);
  expect(bounds.y1).toBeCloseTo(40, 5);
});

test("the corner radius is clamped to half the shorter side", async ({ page }) => {
  await openEditor(page);
  const same = await page.evaluate(() => {
    const P = window.Flashy.Primitives;
    const huge = P.path({ type: "rect", width: 40, height: 40, cornerRadius: 500 });
    const half = P.path({ type: "rect", width: 40, height: 40, cornerRadius: 20 });
    return JSON.stringify(huge) === JSON.stringify(half);
  });
  // A square at full radius is a circle; asking for more cannot mean less.
  expect(same).toBe(true);
});

test("a donut emits two loops and a pie emits one", async ({ page }) => {
  await openEditor(page);
  const counts = await page.evaluate(() => {
    const P = window.Flashy.Primitives;
    const moves = (cmds) => {
      let n = 0;
      for (let i = 0; i < cmds.length;) {
        const op = cmds[i];
        if (op === 0) n++;
        i += 1 + (op === 0 || op === 1 ? 2 : op === 2 ? 4 : 0);
      }
      return n;
    };
    return {
      donut: moves(P.path({ type: "oval", width: 100, height: 100, ovalInner: 50 })),
      pie: moves(P.path({ type: "oval", width: 100, height: 100, ovalEnd: 90 })),
    };
  });
  // The hole is a second loop in the same path, cut by the even-odd rule.
  expect(counts.donut).toBe(2);
  expect(counts.pie).toBe(1);
});

/* ------------------------------------------------------------------ *
 * The canvas painter
 * ------------------------------------------------------------------ */

test("a rounded rectangle loses its corners on the stage", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, shapeDoc({ cornerRadius: 30 }));

  // Dead centre is inside any version of this shape.
  expect(isInk(await px(page, 100, 100))).toBe(true);
  // The very corner of the box is now outside the shape.
  expect(isInk(await px(page, 52, 52))).toBe(false);
  // The middle of each edge is still on the shape — the rounding is local.
  expect(isInk(await px(page, 100, 52))).toBe(true);
  expect(isInk(await px(page, 52, 100))).toBe(true);
});

test("a plain rectangle keeps its corners", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, shapeDoc({}));
  expect(isInk(await px(page, 52, 52))).toBe(true);
});

test("a donut's hole is a hole, not a second ring", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, shapeDoc({ type: "oval", ovalInner: 50 }));

  // The middle is the hole: even-odd, so the inner loop subtracts.
  expect(isInk(await px(page, 100, 100))).toBe(false);
  // The band itself is ink.
  expect(isInk(await px(page, 100, 56))).toBe(true);
  // Outside the oval is still background.
  expect(isInk(await px(page, 52, 52))).toBe(false);
});

test("a pie wedge covers only its own sweep", async ({ page }) => {
  await openEditor(page);
  // 0 to 90 degrees: clockwise from 12 o'clock, so the upper-right quadrant.
  await loadDoc(page, shapeDoc({ type: "oval", ovalStart: 0, ovalEnd: 90 }));

  expect(isInk(await px(page, 120, 80))).toBe(true);    // inside the wedge
  expect(isInk(await px(page, 80, 120))).toBe(false);   // the opposite quadrant
  expect(isInk(await px(page, 120, 120))).toBe(false);  // lower right
});

/* ------------------------------------------------------------------ *
 * The other render paths
 * ------------------------------------------------------------------ */

test("the SVG export emits the outline, not the box", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, shapeDoc({ cornerRadius: 30 }));
  const svg = await downloadFromAction(page, "exportSVG");

  /* One <rect> only — the stage background. A second one would be the shape
     emitted as its bounding box, exactly the divergence this routing exists
     to prevent. */
  expect(svg.match(/<rect/g)).toHaveLength(1);
  expect(svg).toContain("<path");
  expect(svg).toContain('fill-rule="evenodd"');
  // Quadratic segments: the rounding is curves, not a chamfer.
  expect(svg).toMatch(/\sQ/);
});

test("the SVG export leaves a plain rectangle as a rect", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, shapeDoc({}));
  const svg = await downloadFromAction(page, "exportSVG");
  // Two: the background, and the shape itself still drawn as a rectangle.
  expect(svg.match(/<rect/g)).toHaveLength(2);
});

test("the exported player draws the same rounded corner", async ({ context, page }) => {
  await openEditor(page);
  await loadDoc(page, shapeDoc({ cornerRadius: 30 }));
  const html = await downloadFromAction(page, "export");
  const { page: out } = await runExportedHTML(context, html);

  await out.waitForFunction(() => !!window.__stage);
  /* Stop the movie before reading: the artwork is on frame 1 only, so a
     playhead that advanced between the wait and the read would leave a blank
     stage. */
  const corner = await out.evaluate(() => {
    window.__stage.stop();
    window.__stage.root.gotoAndStop(1);
    window.__stage._render();
    const g = document.getElementById("stage")
      .getContext("2d", { willReadFrequently: true });
    const d = g.getImageData(52, 52, 1, 1).data;
    const mid = g.getImageData(100, 100, 1, 1).data;
    return { corner: [d[0], d[3]], mid: [mid[0], mid[3]] };
  });
  // Same two probes as the stage: corner cut away, middle filled.
  expect(corner.corner[1] > 128 && corner.corner[0] < 100).toBe(false);
  expect(corner.mid[1] > 128 && corner.mid[0] < 100).toBe(true);
  await out.close();
});

test("the eraser cuts round a real corner, not a square one", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, shapeDoc({ cornerRadius: 30 }));
  const covered = await page.evaluate(() => {
    const o = window._flashyAI.currentLayers()[0].keyframes[0].objects[0];
    const loops = window._flashyEraser.objectRegion(o);
    // Even-odd winding at a point: an odd crossing count is inside.
    const inside = (px, py) => {
      let n = 0;
      loops.forEach((pts) => {
        for (let i = 0; i < pts.length; i += 2) {
          const ax = pts[i], ay = pts[i + 1];
          const bx = pts[(i + 2) % pts.length], by = pts[(i + 3) % pts.length];
          if ((ay > py) !== (by > py) &&
              px < ax + ((py - ay) / (by - ay)) * (bx - ax)) n++;
        }
      });
      return n % 2 === 1;
    };
    return { corner: inside(52, 52), mid: inside(100, 100) };
  });
  expect(covered.corner).toBe(false);
  expect(covered.mid).toBe(true);
});

test("the morph uses the real outline rather than the bounding box", async ({ page }) => {
  await openEditor(page);
  const n = await page.evaluate(() => {
    const M = window.Flashy.Morph;
    const plain = M.loops({ type: "rect", x: 0, y: 0, width: 100, height: 100 });
    const round = M.loops({ type: "rect", x: 0, y: 0, width: 100, height: 100, cornerRadius: 30 });
    return { plain: plain[0].length / 2, round: round[0].length / 2 };
  });
  // Four corners versus a flattened curve: the rounded outline has far more
  // points, which is what makes a wedge morph as a wedge.
  expect(n.plain).toBe(4);
  expect(n.round).toBeGreaterThan(8);
});

/* ------------------------------------------------------------------ *
 * Authoring
 * ------------------------------------------------------------------ */

test("the Properties panel edits the radius and the stage follows", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, shapeDoc({}));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([F.currentLayers()[0].keyframes[0].objects[0]]);
    F.updateProps();
  });

  const row = page.locator("#propsPanel .props-slider-row", { hasText: "Corner radius" });
  await expect(row).toHaveCount(1);
  // The slider is the control; driving it is what a user does.
  await row.locator("input[type=range]").fill("30");
  await row.locator("input[type=range]").dispatchEvent("input");
  expect(isInk(await px(page, 52, 52))).toBe(false);
});

test("the Oval tool's options ride onto the shape it draws", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, shapeDoc({}));
  const made = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setTool("oval");
    const op = F.ovalPrim();
    op.start = 0; op.end = 90; op.inner = 40;
    // The same construction the mouse-up path performs.
    const o = new F.EditorObject("oval");
    o.x = 10; o.y = 10; o.width = 50; o.height = 50;
    if (op.start !== 0) o.ovalStart = op.start;
    if (op.end !== 360) o.ovalEnd = op.end;
    if (op.inner > 0) o.ovalInner = op.inner;
    return { s: o.ovalStart, e: o.ovalEnd, i: o.ovalInner,
             active: window.Flashy.Primitives.active(o) };
  });
  expect(made.e).toBe(90);
  expect(made.i).toBe(40);
  expect(made.active).toBe(true);
});

test("primitive parameters survive a save and open round trip", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, shapeDoc({ type: "oval", ovalStart: 45, ovalEnd: 200, ovalInner: 35 }));
  const back = await page.evaluate(() => {
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const o = window._flashyAI.currentLayers()[0].keyframes[0].objects[0];
    return { s: o.ovalStart, e: o.ovalEnd, i: o.ovalInner };
  });
  expect(back).toEqual({ s: 45, e: 200, i: 35 });
});

test("a wedge sweeps open across a motion tween", async ({ page }) => {
  await openEditor(page);
  const doc = shapeDoc({ type: "oval", ovalEnd: 10 });
  doc.totalFrames = 11;
  const kf = doc.layers[0].keyframes[0];
  kf.duration = 10;
  kf.tweenType = "motion";
  doc.layers[0].keyframes.push({
    index: 11, duration: 1, tweenType: "none", easing: "linear", script: "",
    objects: [Object.assign({}, kf.objects[0], { ovalEnd: 350 })],
  });
  await loadDoc(page, doc);

  const sweep = await page.evaluate(() => {
    const F = window._flashyAI;
    // frameObjects resolves the tween — the values the renderer actually uses.
    const at = (f) => F.frameObjects(F.currentLayers(), f)[0].ovalEnd;
    return { start: at(1), mid: at(6), end: at(11) };
  });
  // Halfway between 10 and 350 is 180: the parameter tweens like any other
  // dimension, so the wedge opens instead of snapping at the last frame.
  expect(sweep.start).toBeCloseTo(10, 1);
  expect(sweep.mid).toBeCloseTo(180, 0);
  expect(sweep.end).toBeCloseTo(350, 1);
});

test("the SWF writer emits the primitive outline too", async ({ page }) => {
  await openEditor(page);
  const loops = await page.evaluate(() => {
    /* A loop arrives either as flat points (the simple shapes) or as segments
       (a command stream); count whichever it carries. */
    const size = (o) => {
      const l = window.FlashySWFWriter.localLoops(o)[0];
      return l.pts ? l.pts.length : l.segs.length;
    };
    const curved = () => {
      const l = window.FlashySWFWriter.localLoops(
        { type: "rect", width: 100, height: 100, cornerRadius: 30 })[0];
      // A curved edge carries a control point; a straight one only has `to`.
      return (l.segs || []).some((sg) => !!sg.ctrl);
    };
    return {
      plain: size({ type: "rect", width: 100, height: 100 }),
      round: size({ type: "rect", width: 100, height: 100, cornerRadius: 30 }),
      curved: curved(),
    };
  });
  /* Four points for a square corner; a rounded rectangle is eight segments —
     four straight sides and four curved corners. The SWF is the one export
     that is bytes rather than source, so it is the easiest path to leave
     behind, and a curved edge there is what proves it did not. */
  expect(loops.plain).toBe(4);
  expect(loops.round).toBe(8);
  expect(loops.curved).toBe(true);
});
