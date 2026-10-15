/* flashy-geom.js — polygon geometry: outlines, boolean ops, clipping
 *
 * What the eraser needs, and nothing more.
 *
 * Erasing vector art is a boolean subtraction: the shape minus the region the
 * brush swept. Doing that by rasterising the shape and re-tracing it would be
 * far less code — the tracer is right there — but it degrades the whole shape
 * every stroke, including the edges you never touched, and it ties the result
 * to the zoom you happened to be at. So the subtraction here is real geometry,
 * and an edge the eraser never came near comes out bit-for-bit unchanged.
 *
 * Everything is flat arrays of numbers: a *loop* is `[x0,y0,x1,y1,…]`, closed
 * implicitly, and a *region* is an array of loops. Orientation carries the
 * meaning, under the nonzero rule: an outer boundary runs clockwise on screen
 * (positive signed area, y pointing down), a hole runs counter-clockwise.
 * `normalize()` enforces that for input from anywhere else.
 *
 * No DOM, no canvas, no editor — numbers in, numbers out, so it is testable on
 * its own and in plain Node.
 */
(function (global) {
  'use strict';

  /* Coordinates are stage pixels, so a micron is far below anything that can
     matter and far above float noise. Used to match endpoints when chaining. */
  var EPS = 1e-9;
  var KEY_SCALE = 1e6;

  var OP_DIFFERENCE = 'difference';
  var OP_UNION = 'union';
  var OP_INTERSECTION = 'intersection';

  // ------------------------------------------------------------ primitives

  /** Twice the signed area. Positive is clockwise on screen (y down). */
  function signedArea2(loop) {
    var n = loop.length / 2, s = 0;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      s += loop[i * 2] * loop[j * 2 + 1] - loop[j * 2] * loop[i * 2 + 1];
    }
    return s;
  }

  function reverseLoop(loop) {
    var out = [];
    for (var i = loop.length / 2 - 1; i >= 0; i--) out.push(loop[i * 2], loop[i * 2 + 1]);
    return out;
  }

  function loopBounds(loop) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < loop.length; i += 2) {
      if (loop[i] < minX) minX = loop[i];
      if (loop[i] > maxX) maxX = loop[i];
      if (loop[i + 1] < minY) minY = loop[i + 1];
      if (loop[i + 1] > maxY) maxY = loop[i + 1];
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY,
             minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function bounds(region) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < region.length; i++) {
      var b = loopBounds(region[i]);
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    }
    if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY,
             minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function boxesOverlap(a, b, pad) {
    pad = pad || 0;
    return a.minX - pad <= b.maxX && b.minX - pad <= a.maxX &&
           a.minY - pad <= b.maxY && b.minY - pad <= a.maxY;
  }

  /**
   * Winding number of `region` about a point. Nonzero means inside.
   *
   * Nonzero rather than even-odd because the eraser's swept area is built as a
   * union of overlapping capsules: under even-odd each overlap would cancel
   * and the erased stroke would come out striped.
   */
  function windingNumber(region, x, y) {
    var w = 0;
    for (var l = 0; l < region.length; l++) {
      var loop = region[l], n = loop.length / 2;
      for (var i = 0; i < n; i++) {
        var j = (i + 1) % n;
        var x1 = loop[i * 2], y1 = loop[i * 2 + 1];
        var x2 = loop[j * 2], y2 = loop[j * 2 + 1];
        if (y1 <= y) {
          if (y2 > y && (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) > 0) w++;
        } else if (y2 <= y) {
          if ((x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) < 0) w--;
        }
      }
    }
    return w;
  }

  function contains(region, x, y) { return windingNumber(region, x, y) !== 0; }

  /**
   * Re-orient a region so outer boundaries are clockwise and holes are
   * counter-clockwise, by nesting depth.
   *
   * Input from the tracer already satisfies this, but a `path` object can have
   * come from anywhere — an older document, the assistant, a hand-written
   * fixture — and the boolean below reads orientation as meaning.
   */
  function normalize(region) {
    var out = [];
    for (var i = 0; i < region.length; i++) {
      if (region[i].length < 6) continue;
      // Nesting depth: how many OTHER loops contain this one. A point on this
      // loop would sit exactly on its own boundary, so test its centroid-ish
      // first vertex against each other loop individually.
      var px = region[i][0], py = region[i][1];
      var depth = 0;
      for (var j = 0; j < region.length; j++) {
        if (j === i || region[j].length < 6) continue;
        if (contains([region[j]], px, py)) depth++;
      }
      var wantPositive = (depth % 2) === 0;
      var a = signedArea2(region[i]);
      if (Math.abs(a) < EPS) continue; // degenerate sliver, no area to keep
      out.push((a > 0) === wantPositive ? region[i].slice() : reverseLoop(region[i]));
    }
    return out;
  }

  /** Drop vertices that lie on the straight line between their neighbours. */
  function cleanLoop(loop, tol) {
    tol = tol || 1e-7;
    var pts = loop.slice();
    // First collapse coincident points, which boolean seams produce in pairs.
    var dedup = [];
    for (var i = 0; i < pts.length; i += 2) {
      var m = dedup.length;
      if (m >= 2 && Math.abs(dedup[m - 2] - pts[i]) < tol && Math.abs(dedup[m - 1] - pts[i + 1]) < tol) continue;
      dedup.push(pts[i], pts[i + 1]);
    }
    if (dedup.length >= 4) {
      var k = dedup.length;
      if (Math.abs(dedup[0] - dedup[k - 2]) < tol && Math.abs(dedup[1] - dedup[k - 1]) < tol) dedup.length = k - 2;
    }
    var n = dedup.length / 2;
    if (n < 3) return null;
    var out = [];
    for (var a = 0; a < n; a++) {
      var p = (a - 1 + n) % n, q = (a + 1) % n;
      var cross = (dedup[a * 2] - dedup[p * 2]) * (dedup[q * 2 + 1] - dedup[a * 2 + 1]) -
                  (dedup[a * 2 + 1] - dedup[p * 2 + 1]) * (dedup[q * 2] - dedup[a * 2]);
      if (Math.abs(cross) > tol) out.push(dedup[a * 2], dedup[a * 2 + 1]);
    }
    return out.length >= 6 ? out : null;
  }

  /* Loops thinner than this are seam artefacts, not shapes: a tenth of a pixel
     square. Has to sit well above the jitter below (which can turn a shared
     edge into a lens of width JITTER and the length of the edge) and well
     below anything a person could see. */
  var MIN_AREA = 0.01;

  function clean(region, tol) {
    var out = [];
    for (var i = 0; i < region.length; i++) {
      var l = cleanLoop(region[i], tol);
      if (l && Math.abs(signedArea2(l)) > MIN_AREA * 2) out.push(l);
    }
    return out;
  }

  /* Ten nanometres on a stage measured in pixels: far below anything visible,
     far above the 1e-9 at which endpoints are matched. */
  var JITTER = 1e-5;

  /**
   * Nudge every vertex by a deterministic sub-visible amount.
   *
   * Boolean ops go wrong on exact degeneracies — an edge lying exactly along
   * another edge, a vertex landing exactly on an edge — because a segment's
   * midpoint then sits *on* the other boundary, where "inside" has no answer.
   * Perturbing one operand makes those cases crossings like any other.
   * Deterministic, so the same edit always gives the same result.
   */
  function jitter(region) {
    return region.map(function (loop) {
      var out = new Array(loop.length);
      for (var i = 0; i < loop.length; i += 2) {
        // Cheap integer hash of the coordinates, so a vertex is perturbed the
        // same way wherever it turns up.
        var h = (Math.round(loop[i] * 8192) * 73856093) ^ (Math.round(loop[i + 1] * 8192) * 19349663);
        h = (h ^ (h >>> 13)) >>> 0;
        out[i] = loop[i] + ((h & 2047) / 2047 - 0.5) * JITTER;
        out[i + 1] = loop[i + 1] + (((h >>> 11) & 2047) / 2047 - 0.5) * JITTER;
      }
      return out;
    });
  }

  // --------------------------------------------------------------- shapes

  function rectLoop(x, y, w, h) {
    // Clockwise on screen, matching the orientation convention above.
    return [x, y, x + w, y, x + w, y + h, x, y + h];
  }

  function ellipseLoop(cx, cy, rx, ry, steps) {
    steps = steps || circleSteps(Math.max(Math.abs(rx), Math.abs(ry)));
    var out = [];
    for (var i = 0; i < steps; i++) {
      var a = (i / steps) * Math.PI * 2;
      out.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    return out;
  }

  /** Segment count for a circle of radius r, kept under ~0.1px of sagitta. */
  function circleSteps(r) {
    return Math.max(8, Math.min(64, Math.ceil(Math.PI / Math.acos(Math.max(-1, Math.min(1, 1 - 0.1 / Math.max(r, 0.5))))) ));
  }

  /** One brush dab: a circle, or a square, centred on a point. */
  function dabLoop(x, y, radius, square) {
    if (square) return rectLoop(x - radius, y - radius, radius * 2, radius * 2);
    return ellipseLoop(x, y, radius, radius);
  }

  /**
   * A capsule: the area swept by a round brush moving from a to b. Built as
   * the rectangle between the two offset sides plus a semicircle at each end.
   */
  function capsuleLoop(ax, ay, bx, by, radius) {
    var dx = bx - ax, dy = by - ay;
    var len = Math.hypot(dx, dy);
    if (len < EPS) return ellipseLoop(ax, ay, radius, radius);
    var nx = -dy / len * radius, ny = dx / len * radius;
    var steps = Math.max(4, Math.floor(circleSteps(radius) / 2));
    var out = [];
    var baseA = Math.atan2(ny, nx);
    // Down one side, round the far cap, back up the other, round the near cap.
    out.push(ax + nx, ay + ny, bx + nx, by + ny);
    for (var i = 1; i < steps; i++) {
      var t = baseA - (i / steps) * Math.PI;
      out.push(bx + Math.cos(t) * radius, by + Math.sin(t) * radius);
    }
    out.push(bx - nx, by - ny, ax - nx, ay - ny);
    for (var j = 1; j < steps; j++) {
      var u = baseA + Math.PI - (j / steps) * Math.PI;
      out.push(ax + Math.cos(u) * radius, ay + Math.sin(u) * radius);
    }
    var loop = cleanLoop(out, 1e-7) || out;
    return signedArea2(loop) > 0 ? loop : reverseLoop(loop);
  }

  /** Distance from a point to a segment, Euclidean or Chebyshev (square brush). */
  function distToSegment(px, py, ax, ay, bx, by, square) {
    var dx = bx - ax, dy = by - ay;
    var len2 = dx * dx + dy * dy;
    var t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var qx = px - (ax + dx * t), qy = py - (ay + dy * t);
    // A square brush is a square at every point along the stroke, so its
    // footprint is the Chebyshev ball — but the nearest point on the segment
    // under Chebyshev is not the Euclidean one, so sample the square's own
    // metric from the Euclidean foot and from both endpoints.
    if (!square) return Math.hypot(qx, qy);
    var cheb = Math.max(Math.abs(qx), Math.abs(qy));
    var ea = Math.max(Math.abs(px - ax), Math.abs(py - ay));
    var eb = Math.max(Math.abs(px - bx), Math.abs(py - by));
    return Math.min(cheb, ea, eb);
  }

  /**
   * The region swept by a brush of `radius` dragged along `points`
   * (`[x0,y0,x1,y1,…]`), as a normalised region.
   *
   * Taken as a contour of the stroke's distance field rather than by unioning
   * one capsule per step. Two reasons, and the second is the important one:
   *
   *   * A stroke that crosses itself or turns tighter than its own width — a
   *     scribble, which is exactly how people erase — makes the union
   *     degenerate, and the offset-the-polyline shortcut self-intersects.
   *
   *   * Capsules of equal radius laid end to end share *exactly* collinear
   *     edges and land vertices exactly on each other's boundaries. Those are
   *     precisely the cases a boolean op gets wrong, and a horizontal drag
   *     produces them every time. A distance contour has no such structure:
   *     its vertices come out of interpolating the field, so they do not
   *     coincide with anything by construction.
   */
  function strokeRegion(points, radius, square) {
    radius = Math.max(0.01, radius);
    var pts = resample(points, Math.max(0.25, radius * 0.5));
    var n = pts.length / 2;
    if (n === 0) return [];

    // Fine enough that the contour is smooth, coarse enough to stay quick.
    var cell = Math.max(0.2, radius / 5);
    var b = loopBounds(pts);
    var pad = radius + cell * 2;
    var x0 = b.minX - pad, y0 = b.minY - pad;
    var nx = Math.ceil((b.maxX + pad - x0) / cell) + 1;
    var ny = Math.ceil((b.maxY + pad - y0) / cell) + 1;
    // A pathological stroke must degrade rather than hang.
    var MAX = 900;
    if (nx > MAX) { cell *= nx / MAX; nx = MAX; ny = Math.ceil((b.maxY + pad - y0) / cell) + 1; }
    if (ny > MAX) { cell *= ny / MAX; ny = MAX; nx = Math.ceil((b.maxX + pad - x0) / cell) + 1; }

    var field = new Float64Array(nx * ny);
    var segCount = Math.max(1, n - 1);
    for (var j = 0; j < ny; j++) {
      var py = y0 + j * cell;
      for (var i = 0; i < nx; i++) {
        var px = x0 + i * cell;
        var best = Infinity;
        for (var s = 0; s < segCount; s++) {
          var ax = pts[s * 2], ay = pts[s * 2 + 1];
          var bx2 = n === 1 ? ax : pts[s * 2 + 2], by2 = n === 1 ? ay : pts[s * 2 + 3];
          // Cheap reject before the square root.
          if (Math.min(ay, by2) - radius > py || Math.max(ay, by2) + radius < py) continue;
          if (Math.min(ax, bx2) - radius > px || Math.max(ax, bx2) + radius < px) continue;
          var d = distToSegment(px, py, ax, ay, bx2, by2, square);
          if (d < best) best = d;
        }
        // Positive inside. `best` stays Infinity far from the stroke.
        field[j * nx + i] = best === Infinity ? -radius : radius - best;
      }
    }
    return normalize(clean(marchingSquares(field, nx, ny, x0, y0, cell)));
  }

  /**
   * Trace the zero contour of a scalar field into closed loops.
   *
   * Crossings are placed by linear interpolation between corner values, so a
   * neighbouring cell computing the same edge gets a bit-identical point and
   * the loops chain by exact match rather than by tolerance.
   */
  function marchingSquares(field, nx, ny, x0, y0, cell) {
    var segs = [];
    var at = function (i, j) { return field[j * nx + i]; };
    var lerp = function (va, vb, a, b) {
      var t = va / (va - vb);
      if (!isFinite(t)) t = 0.5;
      return a + (b - a) * t;
    };
    for (var j = 0; j < ny - 1; j++) {
      for (var i = 0; i < nx - 1; i++) {
        var va = at(i, j), vb = at(i + 1, j), vc = at(i + 1, j + 1), vd = at(i, j + 1);
        var code = (va >= 0 ? 8 : 0) | (vb >= 0 ? 4 : 0) | (vc >= 0 ? 2 : 0) | (vd >= 0 ? 1 : 0);
        if (code === 0 || code === 15) continue;
        var px = x0 + i * cell, py = y0 + j * cell;
        var T = [lerp(va, vb, px, px + cell), py];
        var R = [px + cell, lerp(vb, vc, py, py + cell)];
        var B = [lerp(vd, vc, px, px + cell), py + cell];
        var L = [px, lerp(va, vd, py, py + cell)];
        var add = function (p, q) { segs.push([p[0], p[1], q[0], q[1]]); };
        switch (code) {
          case 1: add(L, B); break;
          case 2: add(B, R); break;
          case 3: add(L, R); break;
          case 4: add(R, T); break;
          case 6: add(B, T); break;
          case 7: add(L, T); break;
          case 8: add(T, L); break;
          case 9: add(T, B); break;
          case 11: add(T, R); break;
          case 12: add(R, L); break;
          case 13: add(R, B); break;
          case 14: add(B, L); break;
          // Saddles: the centre decides whether the two inside corners are one
          // region pinched at this cell or two that merely touch here.
          case 5:
            if ((va + vb + vc + vd) / 4 >= 0) { add(L, T); add(R, B); }
            else { add(L, B); add(R, T); }
            break;
          case 10:
            if ((va + vb + vc + vd) / 4 >= 0) { add(T, R); add(B, L); }
            else { add(T, L); add(B, R); }
            break;
        }
      }
    }
    return chain(segs);
  }

  /** Drop points closer together than `spacing`, keeping the last one. */
  function resample(points, spacing) {
    var out = [];
    for (var i = 0; i < points.length; i += 2) {
      var m = out.length;
      if (m === 0 || Math.hypot(points[i] - out[m - 2], points[i + 1] - out[m - 1]) >= spacing) {
        out.push(points[i], points[i + 1]);
      }
    }
    // Always keep the final sample, or a quick flick erases short of where it
    // was released.
    var k = points.length;
    if (k >= 2) {
      var o = out.length;
      if (o === 0 || out[o - 2] !== points[k - 2] || out[o - 1] !== points[k - 1]) {
        out.push(points[k - 2], points[k - 1]);
      }
    }
    return out;
  }

  // -------------------------------------------------------------- boolean

  function edgesOf(region) {
    var edges = [];
    for (var l = 0; l < region.length; l++) {
      var loop = region[l], n = loop.length / 2;
      for (var i = 0; i < n; i++) {
        var j = (i + 1) % n;
        edges.push({
          x1: loop[i * 2], y1: loop[i * 2 + 1],
          x2: loop[j * 2], y2: loop[j * 2 + 1],
          cuts: null
        });
      }
    }
    return edges;
  }

  /**
   * Split every edge of both regions at their mutual intersections.
   *
   * The intersection point is computed once and pushed into BOTH edges, so the
   * two sides get bit-identical coordinates. That is what lets the chaining
   * below match endpoints by value instead of by tolerance, which is where
   * hand-rolled boolean ops usually come apart.
   */
  function crossCut(ea, eb) {
    for (var i = 0; i < ea.length; i++) {
      var a = ea[i];
      var aminx = Math.min(a.x1, a.x2), amaxx = Math.max(a.x1, a.x2);
      var aminy = Math.min(a.y1, a.y2), amaxy = Math.max(a.y1, a.y2);
      for (var j = 0; j < eb.length; j++) {
        var b = eb[j];
        if (Math.min(b.x1, b.x2) > amaxx || Math.max(b.x1, b.x2) < aminx) continue;
        if (Math.min(b.y1, b.y2) > amaxy || Math.max(b.y1, b.y2) < aminy) continue;
        var rx = a.x2 - a.x1, ry = a.y2 - a.y1;
        var sx = b.x2 - b.x1, sy = b.y2 - b.y1;
        var den = rx * sy - ry * sx;
        // Parallel, including collinear overlaps. Left alone: the midpoint
        // classification below still places such edges correctly, and trying
        // to split along a shared edge is what produces zero-length garbage.
        if (Math.abs(den) < 1e-12) continue;
        var qpx = b.x1 - a.x1, qpy = b.y1 - a.y1;
        var t = (qpx * sy - qpy * sx) / den;
        var u = (qpx * ry - qpy * rx) / den;
        if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) continue;
        var px = a.x1 + rx * t, py = a.y1 + ry * t;
        (a.cuts || (a.cuts = [])).push({ t: t, x: px, y: py });
        (b.cuts || (b.cuts = [])).push({ t: u, x: px, y: py });
      }
    }
  }

  function splitEdges(edges) {
    var segs = [];
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      if (!e.cuts) {
        segs.push([e.x1, e.y1, e.x2, e.y2]);
        continue;
      }
      e.cuts.sort(function (p, q) { return p.t - q.t; });
      var cx = e.x1, cy = e.y1;
      for (var k = 0; k < e.cuts.length; k++) {
        var c = e.cuts[k];
        if (Math.abs(c.x - cx) > EPS || Math.abs(c.y - cy) > EPS) segs.push([cx, cy, c.x, c.y]);
        cx = c.x; cy = c.y;
      }
      if (Math.abs(e.x2 - cx) > EPS || Math.abs(e.y2 - cy) > EPS) segs.push([cx, cy, e.x2, e.y2]);
    }
    return segs;
  }

  function key(x, y) {
    return Math.round(x * KEY_SCALE) + ',' + Math.round(y * KEY_SCALE);
  }

  /** Chain directed segments into closed loops. */
  function chain(segs) {
    var byStart = new Map();
    var used = new Uint8Array(segs.length);
    for (var i = 0; i < segs.length; i++) {
      var k = key(segs[i][0], segs[i][1]);
      var arr = byStart.get(k);
      if (!arr) { arr = []; byStart.set(k, arr); }
      arr.push(i);
    }
    var loops = [];
    for (var s = 0; s < segs.length; s++) {
      if (used[s]) continue;
      var loop = [];
      var cur = s;
      var startKey = key(segs[s][0], segs[s][1]);
      var guard = segs.length + 1;
      while (guard-- > 0) {
        used[cur] = 1;
        loop.push(segs[cur][0], segs[cur][1]);
        var endKey = key(segs[cur][2], segs[cur][3]);
        if (endKey === startKey) break;
        var cands = byStart.get(endKey);
        var next = -1;
        if (cands) {
          // Where several segments leave the same point — the boolean's own
          // crossings — take the sharpest left turn. That keeps each loop
          // hugging its own region instead of hopping into the neighbouring
          // one through the junction.
          var dx = segs[cur][2] - segs[cur][0], dy = segs[cur][3] - segs[cur][1];
          var bestAngle = Infinity;
          for (var c = 0; c < cands.length; c++) {
            var e = cands[c];
            if (used[e]) continue;
            var ex = segs[e][2] - segs[e][0], ey = segs[e][3] - segs[e][1];
            // Turn angle in [0, 2pi): 0 is doubling back, pi is straight on.
            var ang = Math.atan2(dx * ey - dy * ex, dx * ex + dy * ey);
            if (ang < 0) ang += Math.PI * 2;
            if (ang < bestAngle) { bestAngle = ang; next = e; }
          }
        }
        if (next < 0) break;
        cur = next;
      }
      if (loop.length >= 6) loops.push(loop);
    }
    return loops;
  }

  /**
   * Boolean op between two regions.
   *
   * Edges are split at every crossing and then each piece is classified by
   * testing its own midpoint against the other region. Classifying by a direct
   * point test, rather than propagating in/out labels around the loops, is
   * what makes this tractable to get right: there is no state to get out of
   * step, and a misread vertex costs one segment instead of corrupting
   * everything downstream of it.
   *
   * Containment falls out with no special case — if B is entirely inside A,
   * every B edge classifies as inside and comes back reversed, which is a
   * hole.
   */
  function boolOp(a, b, mode) {
    if (!a.length) return mode === OP_UNION ? b.map(function (l) { return l.slice(); }) : [];
    if (!b.length) return mode === OP_INTERSECTION ? [] : a.map(function (l) { return l.slice(); });

    // Disjoint boxes: nothing can cross, so skip straight to the answer.
    var ba = bounds(a), bb = bounds(b);
    if (!boxesOverlap(ba, bb)) {
      if (mode === OP_DIFFERENCE) return a.map(function (l) { return l.slice(); });
      if (mode === OP_INTERSECTION) return [];
      return a.concat(b).map(function (l) { return l.slice(); });
    }

    // Only B is perturbed. A keeps its exact coordinates, so an edge the
    // other operand never reaches comes back bit-for-bit unchanged — which is
    // what lets a shape be erased twenty times without its far side drifting.
    var ea = edgesOf(a), eb = edgesOf(jitter(b));
    crossCut(ea, eb);
    var segA = splitEdges(ea), segB = splitEdges(eb);

    var keep = [];
    var i, s, mx, my, inside;
    for (i = 0; i < segA.length; i++) {
      s = segA[i];
      mx = (s[0] + s[2]) / 2; my = (s[1] + s[3]) / 2;
      inside = contains(b, mx, my);
      if (mode === OP_INTERSECTION ? inside : !inside) keep.push(s);
    }
    for (i = 0; i < segB.length; i++) {
      s = segB[i];
      mx = (s[0] + s[2]) / 2; my = (s[1] + s[3]) / 2;
      inside = contains(a, mx, my);
      if (mode === OP_UNION) {
        if (!inside) keep.push(s);
      } else if (mode === OP_INTERSECTION) {
        if (inside) keep.push(s);
      } else if (inside) {
        // Difference: B's boundary becomes the new edge, running the other
        // way so it reads as a hole under the nonzero rule.
        keep.push([s[2], s[3], s[0], s[1]]);
      }
    }
    return normalize(clean(chain(keep)));
  }

  function difference(a, b) { return boolOp(normalize(a), normalize(b), OP_DIFFERENCE); }
  function union(a, b) { return boolOp(normalize(a), normalize(b), OP_UNION); }
  function intersection(a, b) { return boolOp(normalize(a), normalize(b), OP_INTERSECTION); }

  // ------------------------------------------------------ polyline cutting

  /**
   * Cut an open polyline against a region, keeping the parts outside it.
   *
   * This is how a drawn LINE survives the eraser as a line. Subtracting from
   * its outline would work too, but it would turn a stroke you can still
   * restyle into a filled shape you cannot — and the whole point of erasing
   * part of a pencil line is that the rest is still a pencil line.
   */
  function cutPolyline(points, region) {
    var out = [], cur = [];
    var n = points.length / 2;
    if (n < 2) return [];
    var flush = function () { if (cur.length >= 4) out.push(cur); cur = []; };

    for (var i = 0; i < n - 1; i++) {
      var ax = points[i * 2], ay = points[i * 2 + 1];
      var bx = points[i * 2 + 2], by = points[i * 2 + 3];
      // Every crossing of this segment with the region's boundary, in order.
      var ts = [0, 1];
      for (var l = 0; l < region.length; l++) {
        var loop = region[l], m = loop.length / 2;
        for (var j = 0; j < m; j++) {
          var k = (j + 1) % m;
          var t = segmentT(ax, ay, bx, by, loop[j * 2], loop[j * 2 + 1], loop[k * 2], loop[k * 2 + 1]);
          if (t != null) ts.push(t);
        }
      }
      ts.sort(function (p, q) { return p - q; });
      for (var s = 0; s < ts.length - 1; s++) {
        var t0 = ts[s], t1 = ts[s + 1];
        if (t1 - t0 < 1e-9) continue;
        var tm = (t0 + t1) / 2;
        var insideHere = contains(region, ax + (bx - ax) * tm, ay + (by - ay) * tm);
        var p0x = ax + (bx - ax) * t0, p0y = ay + (by - ay) * t0;
        var p1x = ax + (bx - ax) * t1, p1y = ay + (by - ay) * t1;
        if (insideHere) {
          flush();
        } else {
          var c = cur.length;
          if (c === 0 || Math.abs(cur[c - 2] - p0x) > EPS || Math.abs(cur[c - 1] - p0y) > EPS) cur.push(p0x, p0y);
          cur.push(p1x, p1y);
        }
      }
    }
    flush();
    return out;
  }

  /** `t` along ab where it crosses cd, or null. */
  function segmentT(ax, ay, bx, by, cx, cy, dx, dy) {
    var rx = bx - ax, ry = by - ay;
    var sx = dx - cx, sy = dy - cy;
    var den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-12) return null;
    var qpx = cx - ax, qpy = cy - ay;
    var t = (qpx * sy - qpy * sx) / den;
    var u = (qpx * ry - qpy * rx) / den;
    if (t <= 0 || t >= 1 || u < 0 || u > 1) return null;
    return t;
  }

  // ------------------------------------------------- path <-> loop bridge

  /**
   * Flatten a FlashyTrace command stream into polygon loops.
   * `tol` is the greatest distance a chord may sit from the curve it replaces.
   */
  function pathToLoops(path, tol) {
    tol = tol || 0.2;
    var loops = [], cur = null, cx = 0, cy = 0, sx = 0, sy = 0;
    var push = function (x, y) {
      var n = cur.length;
      if (n < 2 || Math.abs(cur[n - 2] - x) > EPS || Math.abs(cur[n - 1] - y) > EPS) cur.push(x, y);
    };
    var end = function () {
      if (cur && cur.length >= 6) loops.push(cur);
      cur = null;
    };
    for (var i = 0; i < path.length;) {
      var op = path[i];
      if (op === 0) {
        end();
        cur = []; cx = sx = path[i + 1]; cy = sy = path[i + 2];
        cur.push(cx, cy); i += 3;
      } else if (op === 1) {
        if (!cur) { cur = [path[i + 1], path[i + 2]]; sx = cx = path[i + 1]; sy = cy = path[i + 2]; }
        else { push(path[i + 1], path[i + 2]); cx = path[i + 1]; cy = path[i + 2]; }
        i += 3;
      } else if (op === 2) {
        if (!cur) cur = [cx, cy];
        flattenQuad(cur, cx, cy, path[i + 1], path[i + 2], path[i + 3], path[i + 4], tol, push);
        cx = path[i + 3]; cy = path[i + 4];
        i += 5;
      } else if (op === 3) {
        if (cur) { cx = sx; cy = sy; end(); }
        i += 1;
      } else break;
    }
    end();
    return loops;
  }

  /** Subdivide a quadratic until its chord is within `tol`, then emit points. */
  function flattenQuad(out, x0, y0, cx1, cy1, x1, y1, tol, push) {
    // Distance of the control point from the chord bounds the curve's own
    // deviation, so one up-front step count beats recursive subdivision here.
    var d = Math.hypot(cx1 - (x0 + x1) / 2, cy1 - (y0 + y1) / 2);
    var steps = Math.max(1, Math.min(64, Math.ceil(Math.sqrt(d / Math.max(tol, 1e-4)) * 2)));
    for (var s = 1; s <= steps; s++) {
      var t = s / steps, mt = 1 - t;
      push(mt * mt * x0 + 2 * mt * t * cx1 + t * t * x1,
           mt * mt * y0 + 2 * mt * t * cy1 + t * t * y1);
    }
  }

  /** Loops back to a command stream of straight segments. */
  function loopsToPath(loops) {
    var path = [];
    for (var i = 0; i < loops.length; i++) {
      var l = loops[i];
      if (l.length < 6) continue;
      path.push(0, l[0], l[1]);
      for (var j = 2; j < l.length; j += 2) path.push(1, l[j], l[j + 1]);
      path.push(3);
    }
    return path;
  }

  function translateLoops(loops, dx, dy) {
    return loops.map(function (l) {
      var o = new Array(l.length);
      for (var i = 0; i < l.length; i += 2) { o[i] = l[i] + dx; o[i + 1] = l[i + 1] + dy; }
      return o;
    });
  }

  function scaleLoops(loops, sx, sy) {
    return loops.map(function (l) {
      var o = new Array(l.length);
      for (var i = 0; i < l.length; i += 2) { o[i] = l[i] * sx; o[i + 1] = l[i + 1] * sy; }
      return o;
    });
  }

  /** Total unsigned area — how much of a shape is left after a subtraction. */
  function area(region) {
    var a = 0;
    for (var i = 0; i < region.length; i++) a += signedArea2(region[i]);
    return Math.abs(a) / 2;
  }

  /** Split a region into one region per connected outer boundary, each with
      the holes that belong to it. An erase that cuts a shape in two should
      produce two objects you can move apart, not one object in two pieces. */
  function separate(region) {
    var outers = [], holes = [];
    for (var i = 0; i < region.length; i++) {
      (signedArea2(region[i]) > 0 ? outers : holes).push(region[i]);
    }
    if (outers.length <= 1) return outers.length ? [outers.concat(holes)] : [];
    var groups = outers.map(function (o) { return [o]; });
    for (var h = 0; h < holes.length; h++) {
      var hx = holes[h][0], hy = holes[h][1];
      // Smallest containing outer wins, so a hole inside a hole-filling island
      // attaches to the island rather than to everything around it.
      var best = -1, bestArea = Infinity;
      for (var o = 0; o < outers.length; o++) {
        if (!contains([outers[o]], hx, hy)) continue;
        var ar = Math.abs(signedArea2(outers[o]));
        if (ar < bestArea) { bestArea = ar; best = o; }
      }
      if (best >= 0) groups[best].push(holes[h]);
    }
    return groups;
  }

  var FlashyGeom = {
    EPS: EPS,
    OP: { DIFFERENCE: OP_DIFFERENCE, UNION: OP_UNION, INTERSECTION: OP_INTERSECTION },
    signedArea2: signedArea2,
    reverseLoop: reverseLoop,
    normalize: normalize,
    clean: clean,
    contains: contains,
    windingNumber: windingNumber,
    bounds: bounds,
    loopBounds: loopBounds,
    rectLoop: rectLoop,
    ellipseLoop: ellipseLoop,
    dabLoop: dabLoop,
    capsuleLoop: capsuleLoop,
    strokeRegion: strokeRegion,
    resample: resample,
    boolOp: boolOp,
    difference: difference,
    union: union,
    intersection: intersection,
    cutPolyline: cutPolyline,
    pathToLoops: pathToLoops,
    loopsToPath: loopsToPath,
    translateLoops: translateLoops,
    scaleLoops: scaleLoops,
    area: area,
    separate: separate
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FlashyGeom;
  global.FlashyGeom = FlashyGeom;
})(typeof window !== 'undefined' ? window : this);
