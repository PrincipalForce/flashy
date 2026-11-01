// The drawing half of Flash parity: tools that can correct a drawing, and the
// Modify ▸ Shape and Combine Objects commands.
//
// Before this, a drawing was final. You could move a stroke, scale it and
// erase bits out of it; you could not reshape it, clean it up, combine it with
// another one, or draw a precise curve in the first place.
//
// Everything here is built on flashy-geom.js and flashy-trace.js, both of
// which were already in the project and already tested as pure geometry. These
// specs are about the editor commands on top of them — in particular that a
// command leaves a real, editable, exportable object behind rather than
// something that only looks right on the stage.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction } from "./helpers.js";

/** A document whose single layer holds whatever objects are passed in. */
function docWith(objs) {
  return {
    width: 400, height: 300, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 10,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 10, tweenType: "none", easing: "linear", script: "",
        objects: objs,
      }],
    }],
    library: {},
  };
}

const rect = (over = {}) => ({
  type: "rect", x: 0, y: 0, width: 100, height: 100,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#CC3344", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

const pencil = (points, over = {}) => ({
  type: "pencil", x: 0, y: 0,
  width: Math.max(...points.filter((_, i) => i % 2 === 0)) || 1,
  height: Math.max(...points.filter((_, i) => i % 2 === 1)) || 1,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  points,
  fillColor: "#000000", fillAlpha: 1, fillType: "none",
  strokeColor: "#223344", strokeAlpha: 1, strokeWidth: 2, strokeStyle: "solid",
  ...over,
});

const objects = (page) =>
  page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    return kf.objects.map((o) => ({
      type: o.type, x: o.x, y: o.y, width: o.width, height: o.height,
      fillColor: o.fillColor, fillType: o.fillType,
      strokeColor: o.strokeColor, strokeWidth: o.strokeWidth, strokeStyle: o.strokeStyle,
      fillAlpha: o.fillAlpha,
      nodes: o.path ? o.path.length : (o.points ? o.points.length : 0),
      pathW: o.pathW, pathH: o.pathH,
    }));
  });

const selectAll = (page) =>
  page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    F.setSelection(kf.objects.slice());
  });

const selectByIndex = (page, idxs) =>
  page.evaluate((idxs) => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(F.curFrame());
    F.setSelection(idxs.map((i) => kf.objects[i]));
  }, idxs);

/* ------------------------------------------------------------------ *
 * Combine Objects
 * ------------------------------------------------------------------ */

test("Union merges overlapping shapes into one", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([
    rect({ x: 0, y: 0 }),
    rect({ x: 50, y: 0, fillColor: "#3344CC" }),
  ]));
  await selectAll(page);
  await page.evaluate(() => window._flashyEditor.doAction("combineUnion"));

  const objs = await objects(page);
  expect(objs).toHaveLength(1);
  // The result is a path — a union of two rectangles is not a rectangle.
  expect(objs[0].type).toBe("path");
  // It spans both: 0 → 150 wide, 100 tall.
  expect(objs[0].width).toBeCloseTo(150, 0);
  expect(objs[0].height).toBeCloseTo(100, 0);
  // And it takes the TOPMOST shape's style, which is the colour you were
  // looking at when you ran the command.
  expect(objs[0].fillColor).toBe("#3344CC");
  expect(errors).toEqual([]);
});

test("Intersect keeps only the shared area", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    rect({ x: 0, y: 0 }),
    rect({ x: 60, y: 20, fillColor: "#3344CC" }),
  ]));
  await selectAll(page);
  await page.evaluate(() => window._flashyEditor.doAction("combineIntersect"));

  const objs = await objects(page);
  expect(objs).toHaveLength(1);
  // The overlap is x 60..100, y 20..100.
  expect(objs[0].x).toBeCloseTo(60, 0);
  expect(objs[0].y).toBeCloseTo(20, 0);
  expect(objs[0].width).toBeCloseTo(40, 0);
  expect(objs[0].height).toBeCloseTo(80, 0);
});

test("Punch uses the topmost shape as a cookie cutter and discards it", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    rect({ x: 0, y: 0, width: 200, height: 200 }),
    // Fully inside the first: punching it leaves a hole, not a notch.
    rect({ x: 50, y: 50, width: 100, height: 100, fillColor: "#3344CC" }),
  ]));
  await selectAll(page);
  await page.evaluate(() => window._flashyEditor.doAction("combinePunch"));

  const objs = await objects(page);
  // The cutter is gone; the shape below survives with its own colour.
  expect(objs).toHaveLength(1);
  expect(objs[0].fillColor).toBe("#CC3344");
  expect(objs[0].width).toBeCloseTo(200, 0);
  // A hole is extra loops in the same path, so the command stream grew.
  expect(objs[0].nodes).toBeGreaterThan(12);

  // The hole is real: the engine's own renderer must leave the middle empty.
  const middle = await page.evaluate(() => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 400, 300);
    const d = cv.getContext("2d").getImageData(100, 100, 1, 1).data;
    return [d[0], d[1], d[2]];
  });
  // White stage showing through the hole, not the shape's red.
  expect(middle[1]).toBeGreaterThan(200);
  expect(middle[2]).toBeGreaterThan(200);
});

test("Crop clips the shapes below to the topmost one and discards it", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    rect({ x: 0, y: 0, width: 200, height: 200 }),
    rect({ x: 100, y: 100, width: 200, height: 200, fillColor: "#3344CC" }),
  ]));
  await selectAll(page);
  await page.evaluate(() => window._flashyEditor.doAction("combineCrop"));

  const objs = await objects(page);
  expect(objs).toHaveLength(1);
  expect(objs[0].fillColor).toBe("#CC3344");
  // Cropped to the overlap: 100..200 both ways.
  expect(objs[0].x).toBeCloseTo(100, 0);
  expect(objs[0].y).toBeCloseTo(100, 0);
  expect(objs[0].width).toBeCloseTo(100, 0);
  expect(objs[0].height).toBeCloseTo(100, 0);
});

test("Combine explains itself rather than failing silently", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));
  await selectByIndex(page, [0]);
  await page.evaluate(() => window._flashyEditor.doAction("combineUnion"));
  await expect(page.locator(".fy-dialog")).toContainText("two or more");
  await page.locator(".fy-dialog-foot button").first().click();

  // Two shapes that do not overlap cannot be intersected, and that is a
  // different message from "pick two things".
  await loadDoc(page, docWith([rect({ x: 0 }), rect({ x: 250 })]));
  await selectAll(page);
  await page.evaluate(() => window._flashyEditor.doAction("combineIntersect"));
  await expect(page.locator(".fy-dialog")).toContainText("do not overlap");
});

test("Combine is one undo step", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect({ x: 0 }), rect({ x: 50 })]));
  await selectAll(page);
  await page.evaluate(() => window._flashyEditor.doAction("combineUnion"));
  expect(await objects(page)).toHaveLength(1);
  await page.evaluate(() => window._flashyEditor.doAction("undo"));
  const back = await objects(page);
  expect(back).toHaveLength(2);
  expect(back.every((o) => o.type === "rect")).toBe(true);
});

/* ------------------------------------------------------------------ *
 * Shape cleanup
 * ------------------------------------------------------------------ */

test("Straighten drops points from a jittery stroke and keeps its shape", async ({ page }) => {
  await openEditor(page);
  // A straight run with noise on it: Douglas–Peucker should collapse it.
  const pts = [];
  for (let i = 0; i <= 40; i++) pts.push(i * 5, 50 + (i % 2 ? 0.8 : -0.8));
  await loadDoc(page, docWith([pencil(pts)]));
  await selectAll(page);

  const before = (await objects(page))[0].nodes;
  await page.evaluate(() => window._flashyEditor.doAction("shapeStraighten"));
  const after = await objects(page);
  expect(after[0].nodes).toBeLessThan(before / 2);
  // Still a stroke, still spanning the same run.
  expect(after[0].type).toBe("pencil");
  expect(after[0].x + after[0].width).toBeCloseTo(200, 0);
});

test("Smooth rounds a stroke out without moving its ends", async ({ page }) => {
  await openEditor(page);
  // A sharp zigzag. Smoothing pulls the middle points towards their
  // neighbours' midpoints, so the total path length drops.
  const pts = [0, 0, 20, 60, 40, 0, 60, 60, 80, 0, 100, 60];
  await loadDoc(page, docWith([pencil(pts)]));
  await selectAll(page);

  const len = () =>
    page.evaluate(() => {
      const F = window._flashyAI;
      const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
      let d = 0;
      for (let i = 2; i < o.points.length; i += 2) {
        d += Math.hypot(o.points[i] - o.points[i - 2], o.points[i + 1] - o.points[i - 1]);
      }
      return { d, first: [o.points[0], o.points[1]], x: o.x, y: o.y };
    });

  const b = await len();
  await page.evaluate(() => window._flashyEditor.doAction("shapeSmooth"));
  const a = await len();
  expect(a.d).toBeLessThan(b.d * 0.9);
  // Endpoints are pinned: smoothing a line's ends shortens it, and a shortened
  // line no longer meets whatever it met.
  expect(a.x + a.first[0]).toBeCloseTo(b.x + b.first[0], 3);
  expect(a.y + a.first[1]).toBeCloseTo(b.y + b.first[1], 3);
});

test("Smooth on a traced path re-emits it as curves, not more corners", async ({ page }) => {
  await openEditor(page);
  // A path object with a polygonal loop: smoothing must produce quadratics.
  const made = await page.evaluate(() => {
    const F = window._flashyAI;
    const G = window.FlashyGeom;
    const loop = G.ellipseLoop(50, 50, 50, 50, 24);
    const o = new F.EditorObject("path");
    o.path = G.loopsToPath([loop]);
    o.pathW = 100; o.pathH = 100;
    o.x = 10; o.y = 10; o.width = 100; o.height = 100;
    o.fillColor = "#CC3344"; o.fillType = "solid"; o.strokeStyle = "none"; o.strokeWidth = 0;
    F.currentLayers()[0].getKeyframeAt(1).objects.push(o);
    F.setSelection([o]);
    F.fullRefresh();
    // CMD.QUAD is 2 in the shared encoding.
    return o.path.filter((v, i) => i === 0 || false).length;
  });
  void made;

  const quadsBefore = await page.evaluate(() => {
    const T = window.FlashyTrace;
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    let n = 0;
    T.eachCommand(o.path, (cmd) => { if (cmd === T.CMD.QUAD) n++; });
    return n;
  });
  expect(quadsBefore).toBe(0);

  await page.evaluate(() => window._flashyEditor.doAction("shapeSmooth"));

  const quadsAfter = await page.evaluate(() => {
    const T = window.FlashyTrace;
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    let n = 0;
    T.eachCommand(o.path, (cmd) => { if (cmd === T.CMD.QUAD) n++; });
    return n;
  });
  expect(quadsAfter).toBeGreaterThan(10);
});

test("Optimize asks for a tolerance and honours it", async ({ page }) => {
  await openEditor(page);
  const pts = [];
  for (let i = 0; i <= 60; i++) pts.push(i * 3, 50 + Math.sin(i / 3) * 6);
  await loadDoc(page, docWith([pencil(pts)]));
  await selectAll(page);

  const before = (await objects(page))[0].nodes;
  await page.evaluate(() => window._flashyEditor.doAction("shapeOptimize"));
  await expect(page.locator(".fy-dialog")).toContainText("Optimize Curves");
  await page.locator('.fy-dialog input[type="number"]').fill("20");
  // The OK button is the last in the footer.
  await page.locator(".fy-dialog-foot button").last().click();

  const after = (await objects(page))[0].nodes;
  expect(after).toBeLessThan(before / 3);
});

test("a shape command on the wrong kind of object says which kinds it works on", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect()]));
  await selectAll(page);
  await page.evaluate(() => window._flashyEditor.doAction("shapeSmooth"));
  await expect(page.locator(".fy-dialog")).toContainText("broken apart");
});

test("Convert Lines to Fills turns a stroke into the area it covered", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([pencil([0, 0, 100, 0], { strokeWidth: 10 })]));
  await selectAll(page);
  await page.evaluate(() => window._flashyEditor.doAction("linesToFills"));

  const objs = await objects(page);
  expect(objs).toHaveLength(1);
  expect(objs[0].type).toBe("path");
  // A fill, not a stroke — that is the whole point.
  expect(objs[0].fillType).toBe("solid");
  expect(objs[0].strokeStyle).toBe("none");
  // It takes the line's colour, which lived in strokeColor.
  expect(objs[0].fillColor).toBe("#223344");
  // And it is as thick as the line was: 10px wide, round caps either end.
  expect(objs[0].height).toBeGreaterThan(8);
  expect(objs[0].height).toBeLessThan(13);
  expect(errors).toEqual([]);
});

test("Expand Fill grows a shape and Inset shrinks it", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect({ x: 100, y: 100, width: 100, height: 100 })]));
  await selectAll(page);

  await page.evaluate(() => window._flashyAI.expandFill(10));
  let o = (await objects(page))[0];
  expect(o.width).toBeGreaterThan(110);
  expect(o.x).toBeLessThan(95);

  await loadDoc(page, docWith([rect({ x: 100, y: 100, width: 100, height: 100 })]));
  await selectAll(page);
  await page.evaluate(() => window._flashyAI.expandFill(-15));
  o = (await objects(page))[0];
  expect(o.width).toBeLessThan(90);
  expect(o.x).toBeGreaterThan(105);
});

test("Soften Fill Edges builds a fading vector halo", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect({ x: 100, y: 100, width: 100, height: 100 })]));
  await selectAll(page);
  await page.evaluate(() => window._flashyAI.softenFillEdges(12, 4, false));

  const objs = await objects(page);
  // One core plus four rings.
  expect(objs.length).toBeGreaterThanOrEqual(4);
  const alphas = objs.map((o) => o.fillAlpha).sort((a, b) => a - b);
  // Strictly increasing opacity from the outside in, and still all vectors.
  expect(alphas[0]).toBeLessThan(0.5);
  expect(alphas[alphas.length - 1]).toBeCloseTo(1, 2);
  expect(objs.every((o) => o.type === "path")).toBe(true);

  // It survives an SVG export as paths, not as a raster blur.
  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).not.toContain("<image");
  expect((svg.match(/<path/g) || []).length).toBeGreaterThanOrEqual(4);
});

/* ------------------------------------------------------------------ *
 * PolyStar
 * ------------------------------------------------------------------ */

test("the PolyStar tool draws polygons and stars with the sides you asked for", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setTool("polystar");
    F.toolOptions({ polyStar: { shape: "polygon", sides: 6 } });
  });

  // Drawn through the real geometry the drag commits.
  const hexNodes = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.makePolyStar(0, 0, 100, 100);
    let n = 0;
    window.FlashyTrace.eachCommand(o.path, () => { n++; });
    return n;
  });
  // Six vertices: a move, five lines and a close.
  expect(hexNodes).toBe(7);

  const starNodes = await page.evaluate(() => {
    const F = window._flashyAI;
    F.toolOptions({ polyStar: { shape: "star", sides: 5, point: 0.4 } });
    const o = F.makePolyStar(0, 0, 100, 100);
    let n = 0;
    window.FlashyTrace.eachCommand(o.path, () => { n++; });
    return n;
  });
  // A five-pointed star has ten vertices.
  expect(starNodes).toBe(11);

  // The tool options strip offers the controls while the tool is active.
  await expect(page.locator("#tool-options")).toBeVisible();
  await expect(page.locator('.tool-opt-btn[data-shape="star"]')).toHaveClass(/active/);
  expect(errors).toEqual([]);
});

test("a drawn star is a path, so it exports and erases like any other shape", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.toolOptions({ polyStar: { shape: "star", sides: 5, point: 0.45 } });
    const o = F.makePolyStar(100, 50, 220, 170);
    F.currentLayers()[0].getKeyframeAt(1).objects.push(o);
    F.fullRefresh();
  });

  const objs = await objects(page);
  expect(objs[0].type).toBe("path");
  expect(objs[0].pathW).toBeCloseTo(120, 0);

  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).toContain("<path");

  // Rasterises too, which is what the sprite-sheet and video exports record.
  const inked = await page.evaluate(() => {
    const cv = window._flashyAI.renderFrameToCanvas(1, 400, 300);
    const d = cv.getContext("2d").getImageData(0, 0, 400, 300).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 1] < 200) n++;
    return n;
  });
  expect(inked).toBeGreaterThan(500);
});

/* ------------------------------------------------------------------ *
 * Subselection
 * ------------------------------------------------------------------ */

test("Subselection exposes a stroke's points and moving one reshapes it", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([pencil([0, 0, 50, 0, 100, 0])]));
  await selectAll(page);

  const nodes = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    return F.objectNodes(o);
  });
  expect(nodes).toHaveLength(3);
  expect(nodes.every((n) => n.kind === "anchor")).toBe(true);
  expect(nodes[1].x).toBeCloseTo(50, 3);

  // Drag the middle point down 40.
  const moved = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const n = F.objectNodes(o)[1];
    F.setObjectNode(o, n, n.x, n.y + 40);
    F.fullRefresh();
    return F.objectNodes(o)[1];
  });
  expect(moved.y).toBeCloseTo(40, 3);
});

test("a node lands under the pointer even on a rotated, scaled object", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    pencil([0, 0, 50, 0, 100, 0], { x: 120, y: 90, rotation: 37, scaleX: 1.8, scaleY: 0.6 }),
  ]));
  await selectAll(page);

  // Ask for a node to be placed at an arbitrary stage point, then read it
  // back: the write goes through the inverse of the painter's own matrix, so
  // the round trip has to be exact whatever the transform.
  const round = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const n = F.objectNodes(o)[1];
    F.setObjectNode(o, n, 275.5, 133.25);
    return F.objectNodes(o)[1];
  });
  expect(round.x).toBeCloseTo(275.5, 3);
  expect(round.y).toBeCloseTo(133.25, 3);
});

test("Subselection exposes a path's anchors and its curve handles separately", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  const kinds = await page.evaluate(() => {
    const F = window._flashyAI;
    const T = window.FlashyTrace;
    const o = new F.EditorObject("path");
    // move, quad, line, close — one control point and three anchors.
    o.path = [T.CMD.MOVE, 0, 0, T.CMD.QUAD, 50, 50, 100, 0, T.CMD.LINE, 100, 80, T.CMD.CLOSE];
    o.pathW = 100; o.pathH = 80;
    o.x = 0; o.y = 0; o.width = 100; o.height = 80;
    F.currentLayers()[0].getKeyframeAt(1).objects.push(o);
    F.setSelection([o]);
    return F.objectNodes(o).map((n) => n.kind);
  });
  expect(kinds).toEqual(["anchor", "control", "anchor", "anchor"]);
});

test("reshaping a node is one undo step and keeps the object's identity", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([pencil([0, 0, 50, 0, 100, 0])]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setTool("subselect");
    F.setSelection([F.currentLayers()[0].getKeyframeAt(1).objects[0]]);
  });

  const box = await page.locator("#stageCanvas").boundingBox();
  // The stroke sits at stage (50,0); centerStage puts the origin at
  // ((canvasW - docWidth)/2, (canvasH - docHeight)/2) at zoom 1.
  const at = async (type, sx, sy) =>
    page.evaluate(({ type, sx, sy, box }) => {
      const canvas = document.getElementById("stageCanvas");
      const ox = (canvas.clientWidth - window._flashyAI.doc.width) / 2;
      const oy = (canvas.clientHeight - window._flashyAI.doc.height) / 2;
      canvas.dispatchEvent(new PointerEvent(type, {
        pointerId: 1, isPrimary: true, button: 0, buttons: 1,
        clientX: box.x + ox + sx, clientY: box.y + oy + sy, bubbles: true,
      }));
    }, { type, sx, sy, box });

  await at("pointerdown", 50, 0);
  await at("pointermove", 50, 60);
  await at("pointerup", 50, 60);

  const after = await objects(page);
  // Still one pencil object, not a new one: reshaping must not replace the
  // thing you are reshaping, or it loses its place in the z-order.
  expect(after).toHaveLength(1);
  expect(after[0].type).toBe("pencil");
  expect(after[0].height).toBeGreaterThan(50);

  await page.evaluate(() => window._flashyEditor.doAction("undo"));
  const back = await objects(page);
  expect(back[0].height).toBeLessThan(5);
});

/* ------------------------------------------------------------------ *
 * Pen
 * ------------------------------------------------------------------ */

test("the Pen draws a closed shape from clicks and an open curve from drags", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, docWith([]));

  // Three clicks and a close: a filled triangle.
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setTool("pen");
    const pen = F.pen();
    pen.start(0, 0); pen.start(100, 0); pen.start(50, 80);
    pen.commit(true);
    F.fullRefresh();
  });
  let objs = await objects(page);
  expect(objs).toHaveLength(1);
  expect(objs[0].type).toBe("path");
  // Closed means a shape, so it is filled.
  expect(objs[0].fillType).toBe("solid");

  // A drag between points makes a quadratic, and finishing open leaves a line.
  await loadDoc(page, docWith([]));
  const quads = await page.evaluate(() => {
    const F = window._flashyAI;
    const T = window.FlashyTrace;
    const pen = F.pen();
    pen.start(0, 0);
    pen.start(100, 0);
    pen.dragTo(50, 60);          // shapes the handle of the point just placed
    pen.commit(false);
    F.fullRefresh();
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    let n = 0;
    T.eachCommand(o.path, (cmd) => { if (cmd === T.CMD.QUAD) n++; });
    return { n, fillType: o.fillType, strokeWidth: o.strokeWidth };
  });
  expect(quads.n).toBe(1);
  // An open path is a line, so it must NOT be filled — getting this the wrong
  // way round makes every drawn curve look like a filled blob.
  expect(quads.fillType).toBe("none");
  expect(quads.strokeWidth).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("Escape abandons an unfinished pen path and switching tools commits it", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));

  await page.evaluate(() => {
    const F = window._flashyAI;
    F.setTool("pen");
    const pen = F.pen();
    pen.start(10, 10); pen.start(90, 10);
  });
  await page.keyboard.press("Escape");
  expect(await objects(page)).toHaveLength(0);

  // Leaving the tool mid-path keeps the work rather than throwing it away.
  await page.evaluate(() => {
    const pen = window._flashyAI.pen();
    pen.start(10, 10); pen.start(90, 10);
    window._flashyAI.setTool("select");
    window._flashyAI.fullRefresh();
  });
  expect(await objects(page)).toHaveLength(1);
});

/* ------------------------------------------------------------------ *
 * Lasso and Ink Bottle
 * ------------------------------------------------------------------ */

test("the lasso selects by what its outline encloses", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    rect({ x: 0, y: 0, width: 40, height: 40 }),
    rect({ x: 200, y: 200, width: 40, height: 40, fillColor: "#3344CC" }),
  ]));

  const n = await page.evaluate(() =>
    // A loop around the top-left shape only.
    window._flashyAI.lassoSelect([-10, -10, 80, -10, 80, 80, -10, 80]));
  expect(n).toBe(1);
  const picked = await page.evaluate(() => window._flashyAI.selection()[0].fillColor);
  expect(picked).toBe("#CC3344");
});

test("the magic wand selects everything the same colour", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    rect({ x: 0, y: 0, width: 40, height: 40 }),
    rect({ x: 60, y: 0, width: 40, height: 40, fillColor: "#3344CC" }),
    rect({ x: 120, y: 0, width: 40, height: 40 }),
  ]));
  const n = await page.evaluate(() => window._flashyAI.magicWandSelect(20, 20));
  expect(n).toBe(2);
});

test("the Ink Bottle restyles a stroke without touching the fill", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect({ strokeWidth: 1, strokeStyle: "solid", strokeColor: "#000000" })]));
  await page.evaluate(() => {
    const F = window._flashyAI;
    // The colour panel's current stroke settings are what the bottle pours.
    F.setStrokeStyle({ color: "#00AA55", width: 6 });
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.inkBottleApply(o);
    F.fullRefresh();
  });
  const o = (await objects(page))[0];
  expect(o.strokeColor).toBe("#00AA55");
  expect(o.strokeWidth).toBe(6);
  // The fill is untouched — that is the paint bucket's job.
  expect(o.fillColor).toBe("#CC3344");
});

/* ------------------------------------------------------------------ *
 * Gradient Transform
 * ------------------------------------------------------------------ */

test("the Gradient Transform tool drags a gradient's handles", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect({
    x: 100, y: 100, width: 100, height: 100,
    fillType: "linear", fillStops: [0, 0xff0000, 1, 1, 0x0000ff, 1], fillGrad: [0, 0, 1, 0],
  })]));
  await selectAll(page);

  const handles = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    return F.gradientHandles(o);
  });
  // fillGrad is in bounding-box fractions, so [0,0] → [1,0] is the box's top
  // edge: (100,100) to (200,100).
  expect(handles[0].x).toBeCloseTo(100, 3);
  expect(handles[1].x).toBeCloseTo(200, 3);

  const after = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.setGradientHandle(o, 1, 100, 200);   // swing the end to the bottom-left
    F.fullRefresh();
    return o.fillGrad.slice();
  });
  expect(after[2]).toBeCloseTo(0, 3);
  expect(after[3]).toBeCloseTo(1, 3);

  // The new angle reaches the SVG export, not just the stage.
  const svg = await downloadFromAction(page, "exportSVG");
  expect(svg).toContain("linearGradient");
  expect(svg).toContain('y2="1"');
});

test("the Gradient Transform tool says why it does nothing on a solid fill", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([rect({ x: 100, y: 100 })]));
  await page.evaluate(() => window._flashyAI.setTool("gradient"));

  const box = await page.locator("#stageCanvas").boundingBox();
  await page.evaluate(({ box }) => {
    const canvas = document.getElementById("stageCanvas");
    const ox = (canvas.clientWidth - 400) / 2;
    const oy = (canvas.clientHeight - 300) / 2;
    canvas.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 1, isPrimary: true, button: 0, buttons: 1,
      clientX: box.x + ox + 150, clientY: box.y + oy + 150, bubbles: true,
    }));
  }, { box });

  await expect(page.locator(".fy-dialog")).toContainText("solid fill");
});

/* ------------------------------------------------------------------ *
 * Tool options and shortcuts
 * ------------------------------------------------------------------ */

test("each tool brings its own options, and the strip hides when there are none", async ({ page }) => {
  await openEditor(page);
  // Selection has no options.
  await expect(page.locator("#tool-options")).toBeHidden();

  await page.locator('button[title*="Brush"]').click();
  await expect(page.locator("#tool-options")).toBeVisible();
  await expect(page.locator("#tool-options")).toContainText("px");
  // The brush gets the bracket keys too.
  const before = await page.evaluate(() => window._flashyAI.toolOptions().brushSize);
  await page.keyboard.press("]");
  expect(await page.evaluate(() => window._flashyAI.toolOptions().brushSize))
    .toBeGreaterThan(before);

  await page.locator('button[title*="Pencil"]').click();
  await expect(page.locator('.tool-opt-btn[data-shape="smooth"]')).toHaveClass(/active/);
  await page.locator('.tool-opt-btn[data-shape="ink"]').click();
  expect(await page.evaluate(() => window._flashyAI.toolOptions().pencilMode)).toBe("ink");

  await page.locator('button[title*="Selection Tool"]').click();
  await expect(page.locator("#tool-options")).toBeHidden();
});

test("the new tools are on Flash's keys, and Pose has moved off A", async ({ page }) => {
  await openEditor(page);
  const tool = () => page.evaluate(() => window._flashyAI.curTool());

  await page.keyboard.press("a");
  expect(await tool()).toBe("subselect");
  await page.keyboard.press("p");
  expect(await tool()).toBe("pen");
  await page.keyboard.press("l");
  expect(await tool()).toBe("lasso");
  await page.keyboard.press("s");
  expect(await tool()).toBe("inkbottle");
  await page.keyboard.press("f");
  expect(await tool()).toBe("gradient");
  // Pose kept its tool, on W: a Flashy invention gives way to a tool every
  // Flash author's hands already know.
  await page.keyboard.press("w");
  expect(await tool()).toBe("pose");
});

test("the pencil's mode is applied when the stroke is released", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([]));
  await page.evaluate(() => {
    window._flashyAI.setTool("pencil");
    window._flashyAI.toolOptions({ pencilMode: "straighten" });
  });

  const box = await page.locator("#stageCanvas").boundingBox();
  // A jittery drag: Straighten should reduce it to very few points.
  await page.evaluate(({ box }) => {
    const canvas = document.getElementById("stageCanvas");
    const ox = (canvas.clientWidth - 400) / 2;
    const oy = (canvas.clientHeight - 300) / 2;
    const at = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, isPrimary: true, button: 0, buttons: 1,
      clientX: box.x + ox + x, clientY: box.y + oy + y, bubbles: true,
    }));
    at("pointerdown", 20, 100);
    for (let i = 1; i <= 30; i++) at("pointermove", 20 + i * 5, 100 + (i % 2 ? 1 : -1));
    at("pointerup", 170, 100);
  }, { box });

  const straightened = await objects(page);
  expect(straightened).toHaveLength(1);
  expect(straightened[0].nodes).toBeLessThan(14);

  // Ink mode leaves every sample exactly as drawn.
  await loadDoc(page, docWith([]));
  await page.evaluate(() => window._flashyAI.toolOptions({ pencilMode: "ink" }));
  await page.evaluate(({ box }) => {
    const canvas = document.getElementById("stageCanvas");
    const ox = (canvas.clientWidth - 400) / 2;
    const oy = (canvas.clientHeight - 300) / 2;
    const at = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, isPrimary: true, button: 0, buttons: 1,
      clientX: box.x + ox + x, clientY: box.y + oy + y, bubbles: true,
    }));
    at("pointerdown", 20, 100);
    for (let i = 1; i <= 30; i++) at("pointermove", 20 + i * 5, 100 + (i % 2 ? 1 : -1));
    at("pointerup", 170, 100);
  }, { box });
  const inked = await objects(page);
  expect(inked[0].nodes).toBeGreaterThan(50);
});

/* ------------------------------------------------------------------ *
 * Anchor editing
 *
 * The Pen's other three jobs. A path you cannot repair is a path you have to
 * redraw, so these are not a refinement of Bézier drawing — they are what
 * makes it usable.
 * ------------------------------------------------------------------ */

/** A path object, sized to whatever box the caller gives it. */
const pathObj = (cmds, over = {}) => ({
  type: "path", x: 0, y: 0, width: 100, height: 100,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  path: cmds, pathW: 100, pathH: 100,
  fillColor: "#CC3344", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 1, strokeStyle: "solid",
  ...over,
});

// 0 moveTo x y · 1 lineTo x y · 2 quadTo cx cy x y · 3 closePath
const SQUARE = [0, 0, 0, 1, 100, 0, 1, 100, 100, 1, 0, 100, 3];

/** Every anchor of the first object, in stage coordinates. */
const anchors = (page) =>
  page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    return F.objectNodes(o)
      .filter((n) => n.kind === "anchor")
      .map((n) => ({ x: n.x, y: n.y, i: n.i }));
  });

/** How many segments of the first object are quadratics. */
const quadCount = (page) =>
  page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    return F.pathSegments(o.path).filter((g) => g.cx != null).length;
  });

test("adding an anchor on a straight segment leaves the shape where it was", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([pathObj(SQUARE.slice())]));

  const before = await anchors(page);
  const added = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setTool("pen");
    // The middle of the top edge.
    return F.penEditAt(50, 0, false);
  });
  expect(added.action).toBe("add");

  const after = await anchors(page);
  expect(after).toHaveLength(before.length + 1);
  // The new point sits ON the edge it split, so the outline is unchanged.
  expect(after.some((n) => Math.abs(n.x - 50) < 2 && Math.abs(n.y) < 2)).toBe(true);
});

test("splitting a curve puts the new anchor on the curve", async ({ page }) => {
  await openEditor(page);
  // One quadratic arching from the left edge to the right.
  await loadDoc(page, docWith([pathObj([0, 0, 50, 2, 50, -40, 100, 50])]));

  const split = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const seg = F.pathSegments(o.path).find((g) => g.cx != null);
    // Where the original curve passes at t = 0.5.
    const was = [0.25 * seg.x0 + 0.5 * seg.cx + 0.25 * seg.x1,
                 0.25 * seg.y0 + 0.5 * seg.cy + 0.25 * seg.y1];
    F.pathInsertAnchor(o, seg.at, 0.5);
    const segs = F.pathSegments(o.path).filter((g) => g.cx != null);
    // The first half now ENDS at the split point.
    return { was, at: [segs[0].x1, segs[0].y1], n: segs.length };
  });

  // One quadratic became two...
  expect(split.n).toBe(2);
  /* ...and they meet exactly on the old curve. A de Casteljau split traces
     the same curve by construction; anything cheaper nudges the outline,
     which is the one thing adding a point must not do. */
  expect(split.at[0]).toBeCloseTo(split.was[0], 6);
  expect(split.at[1]).toBeCloseTo(split.was[1], 6);
});

test("deleting an anchor joins its neighbours", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([pathObj(SQUARE.slice())]));

  const before = await anchors(page);
  const gone = await page.evaluate((i) => {
    const F = window._flashyAI;
    F.setTool("pen");
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    return F.pathDeleteAnchor(o, i);
  }, before[2].i);
  expect(gone.ok).toBe(true);

  const after = await anchors(page);
  expect(after).toHaveLength(before.length - 1);
  // The point that was there is not any more.
  expect(after.some((n) => Math.abs(n.x - before[2].x) < 0.5 &&
                           Math.abs(n.y - before[2].y) < 0.5)).toBe(false);
});

test("deleting the first point of a loop promotes the next one", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([pathObj(SQUARE.slice())]));

  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const nodes = F.objectNodes(o).filter((n) => n.kind === "anchor");
    const ok = F.pathDeleteAnchor(o, nodes[0].i);
    // The stream must still START with a move, or nothing downstream can read it.
    return { ok: ok.ok, firstOp: o.path[0], start: [o.path[1], o.path[2]] };
  });
  expect(r.ok).toBe(true);
  expect(r.firstOp).toBe(0);
  // The old second point, 100,0, is the loop's start now.
  expect(r.start).toEqual([100, 0]);
});

test("a path refuses to be deleted down to nothing", async ({ page }) => {
  await openEditor(page);
  // Two anchors: a line. One more deletion would leave an object that cannot
  // be seen or clicked, which is worse than refusing.
  await loadDoc(page, docWith([pathObj([0, 0, 0, 1, 100, 100])]));

  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const nodes = F.objectNodes(o).filter((n) => n.kind === "anchor");
    return F.pathDeleteAnchor(o, nodes[1].i);
  });
  expect(r.ok).toBe(false);
  expect(r.why).toContain("two points");
});

test("converting an anchor turns a corner into a curve and back", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([pathObj(SQUARE.slice())]));

  expect(await quadCount(page)).toBe(0);

  const smoothed = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const nodes = F.objectNodes(o).filter((n) => n.kind === "anchor");
    // The second anchor: it has a neighbour on each side to curve between.
    return F.pathConvertAnchor(o, nodes[1].i);
  });
  expect(smoothed).toMatchObject({ ok: true, kind: "curve" });
  // Both segments meeting at that anchor became quadratics.
  expect(await quadCount(page)).toBe(2);

  const straightened = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const nodes = F.objectNodes(o).filter((n) => n.kind === "anchor");
    return F.pathConvertAnchor(o, nodes[1].i);
  });
  expect(straightened).toMatchObject({ ok: true, kind: "corner" });
  expect(await quadCount(page)).toBe(0);
});

test("a smoothed anchor gets its handles on opposite sides", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([pathObj(SQUARE.slice())]));

  const sides = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const nodes = F.objectNodes(o).filter((n) => n.kind === "anchor");
    F.pathConvertAnchor(o, nodes[1].i);
    const segs = F.pathSegments(o.path).filter((g) => g.cx != null);
    const a = segs[0];                         // arrives at the anchor
    const b = segs[1];                         // leaves it
    /* Smooth means the two handles and the anchor are collinear, and the
       handles are on OPPOSITE sides — a handle on the same side as its
       partner is a cusp, not a smooth join. */
    const ax = a.cx - a.x1, ay = a.cy - a.y1;
    const bx = b.cx - a.x1, by = b.cy - a.y1;
    return { dot: ax * bx + ay * by, cross: ax * by - ay * bx };
  });
  expect(sides.dot).toBeLessThan(0);
  expect(Math.abs(sides.cross)).toBeLessThan(1e-6);
});

test("the Pen says why an anchor cannot be converted", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([pathObj([0, 0, 0, 1, 100, 0, 1, 100, 100])]));

  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    const nodes = F.objectNodes(o).filter((n) => n.kind === "anchor");
    // The last anchor of an OPEN path: there is nothing on its far side.
    return F.pathConvertAnchor(o, nodes[nodes.length - 1].i);
  });
  expect(r.ok).toBe(false);
  expect(r.why).toContain("one side");
});

test("a Pen click away from any path starts a new one instead of editing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([pathObj(SQUARE.slice())]));

  const edit = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setTool("pen");
    // Far from the square, so there is nothing to edit.
    return F.penEditAt(320, 240, false);
  });
  expect(edit).toBeNull();
});

test("the segment hit test finds the nearest edge and where along it", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([pathObj(SQUARE.slice())]));

  const hit = await page.evaluate(() => {
    const h = window._flashyAI.pathSegHit(100, 25);
    return h ? { t: h.t, x: h.x, y: h.y } : null;
  });
  // A quarter of the way down the right-hand edge.
  expect(hit.x).toBeCloseTo(100, 1);
  expect(hit.y).toBeCloseTo(25, 1);
  expect(hit.t).toBeCloseTo(0.25, 1);
});

test("an edited path keeps its own transform", async ({ page }) => {
  await openEditor(page);
  /* Moved and scaled: the click arrives in stage space and has to be mapped
     back through the object's own matrix before the stream is touched. */
  await loadDoc(page, docWith([pathObj(SQUARE.slice(),
    { x: 150, y: 80, width: 200, height: 200 })]));

  const added = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setTool("pen");
    // The middle of the top edge, in stage coordinates.
    return F.penEditAt(250, 80, false);
  });
  expect(added.action).toBe("add");

  const after = await anchors(page);
  expect(after.some((n) => Math.abs(n.x - 250) < 3 && Math.abs(n.y - 80) < 3)).toBe(true);
});

test("an anchor edit is one undo step", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([pathObj(SQUARE.slice())]));

  const before = (await anchors(page)).length;
  await page.evaluate(() => {
    window._flashyAI.setTool("pen");
    window._flashyAI.penEditAt(50, 0, false);
    window._flashyAI.fullRefresh();
  });
  expect((await anchors(page)).length).toBe(before + 1);

  await page.keyboard.press("Control+z");
  expect((await anchors(page)).length).toBe(before);
});
