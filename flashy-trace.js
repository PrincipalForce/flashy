/* flashy-trace.js — raster → vector tracing (Flash's "Trace Bitmap")
 *
 * Turns an ImageData into a set of filled vector shapes. The four knobs are
 * Flash's, and they mean here what they meant there:
 *
 *   colorThreshold (1–500)  How far apart two colours have to be before they
 *                           count as different colours. Compared as the sum of
 *                           the per-channel differences, whose range is 0–765,
 *                           so the scale covers everything from "every shade"
 *                           (1) to "a handful of flat colours" (500).
 *
 *   minArea (1–1000 px)     The smallest region that gets to keep its own
 *                           colour. Anything smaller is folded into whichever
 *                           neighbour it shares the most border with, so the
 *                           result is fewer, cleaner shapes instead of a
 *                           confetti of single-pixel islands.
 *
 *   curveFit                How far an outline may stray from the pixel
 *                           staircase. `pixels` keeps the staircase exactly;
 *                           everything else simplifies and then draws curves.
 *
 *   cornerThreshold         How sharp a turn has to be to survive as a corner
 *                           rather than being rounded into the curve.
 *
 * The pipeline is: quantise colours → label every pixel → connected components
 * → absorb undersized components → walk each component's boundary → simplify →
 * fit curves. Each surviving component becomes one shape, and a shape carries
 * every loop it has, so holes come out as holes (the editor fills even-odd)
 * rather than as separate overlapping blobs.
 *
 * Output coordinates are in SOURCE image space: the caller may trace a
 * downscaled copy for speed and pass `scale` to get coordinates back at the
 * original size.
 *
 * No DOM, no canvas, no editor: this file takes an ImageData and returns
 * numbers, which is what makes it testable on its own.
 */
(function (global) {
  'use strict';

  /* Dialog option lists, exported so the editor builds its menus from the one
     source of truth rather than a parallel copy that can drift. */
  var CURVE_FITS = [
    ['pixels', 'Pixels'],
    ['veryTight', 'Very Tight'],
    ['tight', 'Tight'],
    ['normal', 'Normal'],
    ['smooth', 'Smooth'],
    ['verySmooth', 'Very Smooth']
  ];
  /* Douglas–Peucker tolerance, in source pixels. `pixels` also switches curve
     fitting off entirely — it is the "give me the staircase" option.
     Nothing below ~0.5 is useful: a single-pixel step sits half a pixel off
     the chord across it, so a smaller tolerance preserves the whole staircase,
     every vertex then reads as a 90° corner, and the "tight" settings came out
     as pure polygons with no curves in them at all. */
  var CURVE_EPS = {
    pixels: 0, veryTight: 0.6, tight: 1, normal: 1.8, smooth: 3.5, verySmooth: 7
  };
  var CORNER_THRESHOLDS = [
    ['many', 'Many Corners'],
    ['normal', 'Normal'],
    ['few', 'Few Corners']
  ];
  /* Minimum turn, in degrees, for a vertex to stay a hard corner. */
  var CORNER_DEG = { many: 20, normal: 50, few: 100 };

  var DEFAULTS = {
    colorThreshold: 100,
    minArea: 8,
    curveFit: 'normal',
    cornerThreshold: 'normal'
  };

  /* A palette this large only happens at very low thresholds, where the point
     is fidelity; it bounds the clustering pass rather than the output. */
  var MAX_COLORS = 256;

  /* Path command stream. One flat array of numbers, which matters for two
     reasons: EditorObject.clone() copies arrays with a shallow slice (so a
     nested structure would be shared between clones and mutate in both), and a
     flat array of numbers is the most compact thing to put in a .flashy.
     Opcodes: 0 moveTo x y · 1 lineTo x y · 2 quadTo cx cy x y · 3 closePath. */
  var CMD_MOVE = 0, CMD_LINE = 1, CMD_QUAD = 2, CMD_CLOSE = 3;
  var CMD_ARGS = [2, 2, 4, 0];

  // ---------------------------------------------------------------- helpers

  function clampNum(v, lo, hi, dflt) {
    v = parseFloat(v);
    if (!isFinite(v)) return dflt;
    return Math.max(lo, Math.min(hi, v));
  }

  function hex2(n) {
    n = Math.max(0, Math.min(255, Math.round(n)));
    return (n < 16 ? '0' : '') + n.toString(16);
  }

  // ------------------------------------------------------- path utilities

  /** Walk a command stream, calling fn(opcode, argStartIndex, argCount). */
  function eachCommand(path, fn) {
    for (var i = 0; i < path.length;) {
      var op = path[i];
      var argc = CMD_ARGS[op];
      if (argc == null) break;
      fn(op, i + 1, argc);
      i += 1 + argc;
    }
  }

  /** A new command stream with every coordinate scaled then translated. */
  function pathTransform(path, sx, sy, dx, dy) {
    var out = path.slice();
    eachCommand(out, function (op, at, argc) {
      for (var k = 0; k < argc; k += 2) {
        out[at + k] = out[at + k] * sx + dx;
        out[at + k + 1] = out[at + k + 1] * sy + dy;
      }
    });
    return out;
  }

  /**
   * Bounding box of a command stream.
   *
   * Control points are included. For the quadratics this emitter produces that
   * is exact rather than conservative: every control point is one of the
   * simplified polygon's own vertices, and the curve stays inside its hull.
   */
  function pathBounds(path) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    eachCommand(path, function (op, at, argc) {
      for (var k = 0; k < argc; k += 2) {
        var x = path[at + k], y = path[at + k + 1];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    });
    if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  /**
   * Replay a command stream into anything with the 2D-context path methods —
   * a CanvasRenderingContext2D, a Path2D, or Flashy's own Graphics (whose
   * curveTo takes the same quadratic arguments).
   */
  function pathToContext(path, ctx, quadName) {
    var quad = quadName || 'quadraticCurveTo';
    eachCommand(path, function (op, at) {
      if (op === CMD_MOVE) ctx.moveTo(path[at], path[at + 1]);
      else if (op === CMD_LINE) ctx.lineTo(path[at], path[at + 1]);
      else if (op === CMD_QUAD) ctx[quad](path[at], path[at + 1], path[at + 2], path[at + 3]);
      else if (op === CMD_CLOSE) ctx.closePath();
    });
  }

  /** SVG `d` attribute for a command stream. */
  function pathToSVG(path, precision) {
    var p = precision == null ? 2 : precision;
    var num = function (v) {
      var s = v.toFixed(p);
      return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s;
    };
    var out = [];
    eachCommand(path, function (op, at) {
      if (op === CMD_MOVE) out.push('M' + num(path[at]) + ',' + num(path[at + 1]));
      else if (op === CMD_LINE) out.push('L' + num(path[at]) + ',' + num(path[at + 1]));
      else if (op === CMD_QUAD) {
        out.push('Q' + num(path[at]) + ',' + num(path[at + 1]) +
                 ' ' + num(path[at + 2]) + ',' + num(path[at + 3]));
      } else if (op === CMD_CLOSE) out.push('Z');
    });
    return out.join(' ');
  }

  /** How many anchor points a command stream has — the editor shows this. */
  function pathNodeCount(path) {
    var n = 0;
    eachCommand(path, function (op) { if (op !== CMD_CLOSE) n++; });
    return n;
  }

  // ------------------------------------------------------------ quantising

  /**
   * Build a palette and a per-pixel label map.
   *
   * A 5-bit-per-channel histogram first, then one greedy clustering pass over
   * the bins in descending population order. Seeding from the most populous
   * bins is what makes the dominant colours become cluster centres instead of
   * whichever pixel happened to be scanned first.
   *
   * Pixels below half alpha get label -1 and are left out of the trace
   * entirely, so a PNG with a cut-out background traces to the subject rather
   * than to the subject plus a rectangle.
   */
  function quantise(data, n, threshold) {
    var bins = new Map();
    var i, r, g, b, key, e;
    for (i = 0; i < n; i++) {
      if (data[i * 4 + 3] < 128) continue;
      r = data[i * 4]; g = data[i * 4 + 1]; b = data[i * 4 + 2];
      key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      e = bins.get(key);
      if (e) { e[0]++; e[1] += r; e[2] += g; e[3] += b; }
      else bins.set(key, [1, r, g, b]);
    }
    if (!bins.size) return null;

    var order = Array.from(bins.keys());
    order.sort(function (p, q) { return bins.get(q)[0] - bins.get(p)[0]; });

    // Running sums, so a cluster's centroid is the true mean of what it holds.
    var cr = [], cg = [], cb = [], cc = [];
    var binCluster = new Map();
    for (var k = 0; k < order.length; k++) {
      var be = bins.get(order[k]);
      var pr = be[1] / be[0], pg = be[2] / be[0], pb = be[3] / be[0];
      var best = -1, bestD = Infinity;
      for (var c = 0; c < cc.length; c++) {
        var d = Math.abs(pr - cr[c] / cc[c]) +
                Math.abs(pg - cg[c] / cc[c]) +
                Math.abs(pb - cb[c] / cc[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      // Past MAX_COLORS everything folds into its nearest cluster: the palette
      // stops growing rather than the trace failing.
      if (best >= 0 && (bestD <= threshold || cc.length >= MAX_COLORS)) {
        cr[best] += be[1]; cg[best] += be[2]; cb[best] += be[3]; cc[best] += be[0];
        binCluster.set(order[k], best);
      } else {
        binCluster.set(order[k], cc.length);
        cr.push(be[1]); cg.push(be[2]); cb.push(be[3]); cc.push(be[0]);
      }
    }

    var colors = [];
    for (var ci = 0; ci < cc.length; ci++) {
      colors.push('#' + hex2(cr[ci] / cc[ci]) + hex2(cg[ci] / cc[ci]) + hex2(cb[ci] / cc[ci]));
    }

    var label = new Int32Array(n);
    for (i = 0; i < n; i++) {
      if (data[i * 4 + 3] < 128) { label[i] = -1; continue; }
      label[i] = binCluster.get(
        ((data[i * 4] >> 3) << 10) | ((data[i * 4 + 1] >> 3) << 5) | (data[i * 4 + 2] >> 3)
      );
    }
    return { label: label, colors: colors };
  }

  // -------------------------------------------------- connected components

  /** 4-connected components of equal-label pixels. Iterative: a deep recursion
      on a photo-sized region overflows the stack. */
  function components(label, w, h) {
    var n = w * h;
    var comp = new Int32Array(n);
    comp.fill(-1);
    var compLabel = [], compSize = [];
    // Each pixel is marked on push, so it is pushed at most once.
    var stack = new Int32Array(n);
    var id = 0;
    for (var s = 0; s < n; s++) {
      if (comp[s] !== -1 || label[s] < 0) continue;
      var lab = label[s], sp = 0, size = 0;
      comp[s] = id; stack[sp++] = s;
      while (sp > 0) {
        var p = stack[--sp];
        size++;
        var px = p % w, py = (p - px) / w;
        if (px > 0 && comp[p - 1] === -1 && label[p - 1] === lab) { comp[p - 1] = id; stack[sp++] = p - 1; }
        if (px < w - 1 && comp[p + 1] === -1 && label[p + 1] === lab) { comp[p + 1] = id; stack[sp++] = p + 1; }
        if (py > 0 && comp[p - w] === -1 && label[p - w] === lab) { comp[p - w] = id; stack[sp++] = p - w; }
        if (py < h - 1 && comp[p + w] === -1 && label[p + w] === lab) { comp[p + w] = id; stack[sp++] = p + w; }
      }
      compLabel.push(lab); compSize.push(size); id++;
    }
    return { comp: comp, label: compLabel, size: compSize, count: id };
  }

  /**
   * Absorb every component smaller than minArea into a neighbour.
   *
   * "Largest shared border" rather than "nearest colour": a two-pixel sliver
   * along the edge of a big shape belongs to that shape, whatever its colour
   * happens to be, and this is what stops anti-aliasing fringes from
   * surviving as their own outlined shapes.
   *
   * Returns a union-find root per component. Roots are the survivors and their
   * colour is the colour the merged pixels take.
   */
  function absorbSmall(comp, w, h, cmp, minArea) {
    var count = cmp.count;
    var nbr = new Array(count);
    var i, x, y;

    var addAdj = function (a, b) {
      if (a === b) return;
      var m = nbr[a] || (nbr[a] = new Map());
      m.set(b, (m.get(b) || 0) + 1);
    };
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var p = y * w + x, ca = comp[p];
        if (ca < 0) continue;
        if (x < w - 1) { var cb = comp[p + 1]; if (cb >= 0) { addAdj(ca, cb); addAdj(cb, ca); } }
        if (y < h - 1) { var cd = comp[p + w]; if (cd >= 0) { addAdj(ca, cd); addAdj(cd, ca); } }
      }
    }

    var parent = new Int32Array(count);
    for (i = 0; i < count; i++) parent[i] = i;
    var find = function (a) {
      while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
      return a;
    };
    var sizeOf = cmp.size.slice();

    // Smallest first, so a chain of slivers collapses outward into the big
    // shape instead of into each other.
    var order = [];
    for (i = 0; i < count; i++) order.push(i);
    order.sort(function (p, q) { return cmp.size[p] - cmp.size[q]; });

    for (var oi = 0; oi < order.length; oi++) {
      var ci = find(order[oi]);
      if (sizeOf[ci] >= minArea) continue;
      var m = nbr[ci];
      var bestN = -1, bestShared = -1, bestSize = -1;
      if (m) {
        m.forEach(function (shared, other) {
          var ro = find(other);
          if (ro === ci) return;
          // Prefer a neighbour that is itself big enough — merging into
          // another sliver just defers the problem.
          var okNow = sizeOf[ro] >= minArea ? 1 : 0;
          var bestOk = bestN >= 0 && bestSize >= minArea ? 1 : 0;
          if (okNow > bestOk ||
              (okNow === bestOk && (shared > bestShared ||
                (shared === bestShared && sizeOf[ro] > bestSize)))) {
            bestShared = shared; bestN = ro; bestSize = sizeOf[ro];
          }
        });
      }
      if (bestN < 0) continue; // an island with no opaque neighbour: nothing to merge into
      parent[ci] = bestN;
      sizeOf[bestN] += sizeOf[ci];
      // Fold adjacency into the target so later merges see through this one.
      if (m) {
        var mb = nbr[bestN] || (nbr[bestN] = new Map());
        m.forEach(function (sh, other) {
          if (find(other) !== bestN) mb.set(other, (mb.get(other) || 0) + sh);
        });
      }
    }

    var root = new Int32Array(count);
    for (i = 0; i < count; i++) root[i] = find(i);
    return { root: root, sizeOf: sizeOf };
  }

  // ----------------------------------------------------- boundary tracing

  /**
   * Chain directed boundary edges into closed loops.
   *
   * Every edge runs clockwise around its component (in screen coordinates,
   * y down), so a component's outer boundary comes out clockwise and each of
   * its holes counter-clockwise — which is exactly what an even-odd fill
   * wants, with no winding bookkeeping.
   *
   * Where two regions touch only at a corner the vertex has two outgoing
   * edges. Continuing straight, else turning clockwise, keeps the loop hugging
   * its own region instead of hopping across the pinch into the other one.
   */
  function chainLoops(flat, w) {
    var stride = w + 1;
    var m = flat.length / 4;
    var byStart = new Map();
    var used = new Uint8Array(m);
    var i;
    for (i = 0; i < m; i++) {
      var k = flat[i * 4 + 1] * stride + flat[i * 4];
      var a = byStart.get(k);
      if (!a) { a = []; byStart.set(k, a); }
      a.push(i);
    }
    var loops = [];
    for (var s = 0; s < m; s++) {
      if (used[s]) continue;
      var pts = [];
      var cur = s;
      var sx = flat[s * 4], sy = flat[s * 4 + 1];
      var guard = m + 1;
      while (guard-- > 0) {
        used[cur] = 1;
        var ax = flat[cur * 4], ay = flat[cur * 4 + 1];
        var bx = flat[cur * 4 + 2], by = flat[cur * 4 + 3];
        pts.push(ax, ay);
        if (bx === sx && by === sy) break;
        var cands = byStart.get(by * stride + bx);
        var next = -1;
        if (cands) {
          var dx = bx - ax, dy = by - ay, bestScore = -1;
          for (var ci = 0; ci < cands.length; ci++) {
            var e = cands[ci];
            if (used[e]) continue;
            var ex = flat[e * 4 + 2] - bx, ey = flat[e * 4 + 3] - by;
            // z of the 2D cross product; with y down, z > 0 is a clockwise turn.
            var cross = dx * ey - dy * ex, dot = dx * ex + dy * ey;
            var score = (cross === 0 && dot > 0) ? 3 : (cross > 0 ? 2 : (cross < 0 ? 1 : 0));
            if (score > bestScore) { bestScore = score; next = e; }
          }
        }
        if (next < 0) break;
        cur = next;
      }
      if (pts.length >= 6) loops.push(pts);
    }
    return loops;
  }

  // ----------------------------------------------------------- simplifying

  /** Drop vertices that sit exactly on the line between their neighbours. The
      pixel staircase is mostly these, and removing them is lossless. */
  function collapseCollinear(pts) {
    var n = pts.length / 2;
    if (n < 3) return pts;
    var out = [];
    for (var i = 0; i < n; i++) {
      var px = pts[((i - 1 + n) % n) * 2], py = pts[((i - 1 + n) % n) * 2 + 1];
      var cx = pts[i * 2], cy = pts[i * 2 + 1];
      var nx = pts[((i + 1) % n) * 2], ny = pts[((i + 1) % n) * 2 + 1];
      if ((cx - px) * (ny - cy) - (cy - py) * (nx - cx) !== 0) out.push(cx, cy);
    }
    return out.length >= 6 ? out : pts;
  }

  /** Douglas–Peucker over an open polyline. Iterative, for the same
      stack-depth reason as the flood fill. */
  function douglasPeucker(pts, eps) {
    var n = pts.length / 2;
    if (n < 3) return pts.slice();
    var keep = new Uint8Array(n);
    keep[0] = 1; keep[n - 1] = 1;
    var stack = [[0, n - 1]];
    var eps2 = eps * eps;
    while (stack.length) {
      var seg = stack.pop();
      var a = seg[0], b = seg[1];
      if (b - a < 2) continue;
      var ax = pts[a * 2], ay = pts[a * 2 + 1];
      var bx = pts[b * 2], by = pts[b * 2 + 1];
      var vx = bx - ax, vy = by - ay;
      var len2 = vx * vx + vy * vy;
      var far = -1, farD = -1;
      for (var i = a + 1; i < b; i++) {
        var px = pts[i * 2] - ax, py = pts[i * 2 + 1] - ay;
        var d2;
        if (len2 === 0) {
          d2 = px * px + py * py;
        } else {
          var t = (px * vx + py * vy) / len2;
          if (t < 0) t = 0; else if (t > 1) t = 1;
          var qx = px - vx * t, qy = py - vy * t;
          d2 = qx * qx + qy * qy;
        }
        if (d2 > farD) { farD = d2; far = i; }
      }
      if (far > 0 && farD > eps2) {
        keep[far] = 1;
        stack.push([a, far], [far, b]);
      }
    }
    var out = [];
    for (var j = 0; j < n; j++) if (keep[j]) out.push(pts[j * 2], pts[j * 2 + 1]);
    return out;
  }

  function rotateLoop(pts, start) {
    var n = pts.length / 2;
    var out = [];
    for (var i = 0; i < n; i++) {
      var j = (start + i) % n;
      out.push(pts[j * 2], pts[j * 2 + 1]);
    }
    return out;
  }

  function simplifyLoop(pts, eps) {
    pts = collapseCollinear(pts);
    if (eps <= 0 || pts.length <= 8) return pts;
    // Start at the topmost-then-leftmost vertex. It is a genuine extreme of
    // the outline, so Douglas–Peucker never cuts the corner there — and it
    // makes the result independent of where the edge walk happened to begin.
    var n = pts.length / 2, bi = 0;
    for (var i = 1; i < n; i++) {
      if (pts[i * 2 + 1] < pts[bi * 2 + 1] ||
          (pts[i * 2 + 1] === pts[bi * 2 + 1] && pts[i * 2] < pts[bi * 2])) bi = i;
    }
    var rot = rotateLoop(pts, bi);
    // Close the ring into an open polyline so both ends are pinned, then drop
    // the duplicate.
    var open = rot.concat([rot[0], rot[1]]);
    var kept = douglasPeucker(open, eps);
    kept.length -= 2;
    return kept.length >= 6 ? collapseCollinear(kept) : rot;
  }

  // ------------------------------------------------------- curve emission

  /**
   * Emit one loop into the command stream.
   *
   * Corners are kept as hard vertices; every other vertex becomes the control
   * point of a quadratic that runs between the midpoints of its two edges.
   * That is the classic midpoint scheme, and it is tangent-continuous across
   * smooth vertices by construction — which is why a traced outline reads as
   * drawn rather than as a polygon with its corners filed off.
   */
  function emitLoop(path, pts, cornerDeg, curvy) {
    var n = pts.length / 2;
    if (n < 3) return;

    if (!curvy) {
      path.push(CMD_MOVE, pts[0], pts[1]);
      for (var i = 1; i < n; i++) path.push(CMD_LINE, pts[i * 2], pts[i * 2 + 1]);
      path.push(CMD_CLOSE);
      return;
    }

    var at = function (i) { return ((i % n) + n) % n; };
    var corner = new Uint8Array(n);
    for (var j = 0; j < n; j++) {
      var p = at(j - 1), c = j, q = at(j + 1);
      var v1x = pts[c * 2] - pts[p * 2], v1y = pts[c * 2 + 1] - pts[p * 2 + 1];
      var v2x = pts[q * 2] - pts[c * 2], v2y = pts[q * 2 + 1] - pts[c * 2 + 1];
      var dev = Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y)) * 180 / Math.PI;
      corner[j] = dev > cornerDeg ? 1 : 0;
    }

    // Begin at a corner when there is one, so a hard vertex is never the
    // arbitrary seam the loop closes across.
    var start = 0;
    for (var k = 0; k < n; k++) if (corner[k]) { start = k; break; }

    var endOf = function (i) {
      var ii = at(i);
      if (corner[ii]) return [pts[ii * 2], pts[ii * 2 + 1]];
      var jj = at(i + 1);
      return [(pts[ii * 2] + pts[jj * 2]) / 2, (pts[ii * 2 + 1] + pts[jj * 2 + 1]) / 2];
    };

    var st = endOf(start);
    path.push(CMD_MOVE, st[0], st[1]);
    // n steps lands back on `start`, which closes the ring exactly.
    for (var step = 1; step <= n; step++) {
      var idx = at(start + step);
      if (corner[idx]) {
        // The final step lands back on the start point. As a straight segment
        // that is exactly what closePath draws, so emitting it would leave a
        // duplicate node on every corner-to-corner outline — a traced square
        // would report five.
        if (step === n && pts[idx * 2] === st[0] && pts[idx * 2 + 1] === st[1]) break;
        path.push(CMD_LINE, pts[idx * 2], pts[idx * 2 + 1]);
      } else {
        var e = endOf(start + step);
        path.push(CMD_QUAD, pts[idx * 2], pts[idx * 2 + 1], e[0], e[1]);
      }
    }
    path.push(CMD_CLOSE);
  }

  // ------------------------------------------------------------- the trace

  /**
   * Trace `img` (an ImageData) into filled vector shapes.
   *
   * Options: colorThreshold, minArea, curveFit, cornerThreshold, plus `scale`
   * / `offsetX` / `offsetY` to map the result back onto a source image the
   * caller downscaled before handing it over.
   *
   * Returns `{shapes, colors, regions, width, height}`. Each shape is
   * `{color, area, path, bounds}` with `path` a flat command stream in source
   * image space, back to front — largest first, so fine detail traced out of a
   * big flat background lands on top of it.
   */
  function trace(img, opts) {
    opts = opts || {};
    var w = img.width, h = img.height, data = img.data;
    var n = w * h;
    var threshold = clampNum(opts.colorThreshold, 1, 500, DEFAULTS.colorThreshold);
    var minAreaSrc = clampNum(opts.minArea, 1, 1000, DEFAULTS.minArea);
    var fit = CURVE_EPS[opts.curveFit] != null ? opts.curveFit : DEFAULTS.curveFit;
    var cornerKey = CORNER_DEG[opts.cornerThreshold] != null ? opts.cornerThreshold : DEFAULTS.cornerThreshold;
    var scale = opts.scale > 0 ? opts.scale : 1;
    var offX = opts.offsetX || 0, offY = opts.offsetY || 0;

    var empty = { shapes: [], colors: 0, regions: 0, width: w, height: h };
    if (!w || !h) return empty;

    var q = quantise(data, n, threshold);
    if (!q) return empty;

    var cmp = components(q.label, w, h);
    if (!cmp.count) return empty;

    // minArea is quoted in source pixels; when tracing a downscaled copy the
    // same real-world area is fewer pixels here.
    var minArea = Math.max(1, Math.round(minAreaSrc / (scale * scale)));
    var merged = absorbSmall(cmp.comp, w, h, cmp, minArea);
    var root = merged.root, sizeOf = merged.sizeOf;

    var keep = {}, kept = 0, i;
    for (i = 0; i < cmp.count; i++) {
      if (root[i] !== i) continue;
      if (sizeOf[i] >= minArea) { keep[i] = true; kept++; }
    }
    // A minArea larger than anything in the image would otherwise trace to
    // nothing at all, which reads as a broken feature rather than a setting
    // turned up too far.
    if (!kept) {
      for (i = 0; i < cmp.count; i++) if (root[i] === i) keep[i] = true;
    }

    // Boundary edges, bucketed by surviving component. Built in one pass over
    // the image rather than a mask per component, which would be O(regions·n).
    var edges = new Map();
    var push = function (r, x0, y0, x1, y1) {
      var arr = edges.get(r);
      if (!arr) { arr = []; edges.set(r, arr); }
      arr.push(x0, y0, x1, y1);
    };
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var p = y * w + x, c = cmp.comp[p];
        if (c < 0) continue;
        var r = root[c];
        if (!keep[r]) continue;
        var up = y > 0 ? cmp.comp[p - w] : -1;
        var dn = y < h - 1 ? cmp.comp[p + w] : -1;
        var lf = x > 0 ? cmp.comp[p - 1] : -1;
        var rt = x < w - 1 ? cmp.comp[p + 1] : -1;
        if (up < 0 || root[up] !== r) push(r, x, y, x + 1, y);
        if (rt < 0 || root[rt] !== r) push(r, x + 1, y, x + 1, y + 1);
        if (dn < 0 || root[dn] !== r) push(r, x + 1, y + 1, x, y + 1);
        if (lf < 0 || root[lf] !== r) push(r, x, y + 1, x, y);
      }
    }

    var eps = CURVE_EPS[fit];
    var curvy = fit !== 'pixels';
    var cornerDeg = CORNER_DEG[cornerKey];
    var shapes = [];
    edges.forEach(function (flat, r) {
      var loops = chainLoops(flat, w);
      if (!loops.length) return;
      var path = [];
      for (var li = 0; li < loops.length; li++) {
        emitLoop(path, simplifyLoop(loops[li], eps), cornerDeg, curvy);
      }
      if (!path.length) return;
      var abs = pathTransform(path, scale, scale, offX, offY);
      shapes.push({
        color: q.colors[cmp.label[r]] || '#000000',
        area: sizeOf[r] * scale * scale,
        path: abs,
        bounds: pathBounds(abs)
      });
    });

    // Back to front: the big flat areas first, detail on top of them.
    shapes.sort(function (a, b) { return b.area - a.area; });

    return {
      shapes: shapes,
      colors: q.colors.length,
      regions: shapes.length,
      width: w,
      height: h
    };
  }

  var FlashyTrace = {
    trace: trace,
    CURVE_FITS: CURVE_FITS,
    CORNER_THRESHOLDS: CORNER_THRESHOLDS,
    DEFAULTS: DEFAULTS,
    MAX_COLORS: MAX_COLORS,
    // Path command stream helpers, shared with the editor and the exporters so
    // the encoding is described in exactly one place.
    CMD: { MOVE: CMD_MOVE, LINE: CMD_LINE, QUAD: CMD_QUAD, CLOSE: CMD_CLOSE },
    eachCommand: eachCommand,
    pathTransform: pathTransform,
    pathBounds: pathBounds,
    pathToContext: pathToContext,
    pathToSVG: pathToSVG,
    pathNodeCount: pathNodeCount
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FlashyTrace;
  global.FlashyTrace = FlashyTrace;
})(typeof window !== 'undefined' ? window : this);
