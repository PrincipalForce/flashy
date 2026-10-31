/* flashy-as2.js — object handlers, the way Flash had them
 *
 * In Flash you could select a movie clip, open the Actions panel, and write
 *
 *     onClipEvent(load)      { origin = {x: _x, y: _y}; }
 *     onClipEvent(mouseMove) { _x = origin.x + _parent._xmouse / 8; }
 *
 * and the clip would follow the mouse. That is how a decade of eyes, cursors
 * and cursor-chasing fish were made, and it is what every imported movie is
 * full of. This file runs those handlers.
 *
 * HOW IT WORKS
 *   `onClipEvent(…) { … }` and `on(…) { … }` blocks are split out of the
 *   script, each body is compiled once with `new Function`, and it runs with
 *   `with (scope)` where `scope` is a Proxy over the display object. The
 *   proxy is what makes the AS2 spelling work: `_x` is `node.x`, `_alpha` is
 *   percent rather than a fraction, `_rotation` is degrees rather than
 *   radians, `_xmouse` is the pointer in the clip's own space, `_parent` and
 *   `_root` are other clips' scopes, a child clip is reachable by its
 *   instance name, and anything else assigned to is a variable on the clip —
 *   which is exactly AS2's scope chain.
 *
 * EVENTS
 *   load · enterFrame · unload · data · initialize · construct
 *   mouseMove · mouseDown · mouseUp   (anywhere, as in Flash)
 *   press · release · releaseOutside · rollOver · rollOut · dragOver ·
 *   dragOut                            (on the object, hit-tested)
 *   keyDown · keyUp
 *
 * WHAT IT IS NOT: an AVM1 interpreter. The bodies are JavaScript, which AS2
 * very nearly is — the decompiler in `flashy-avm1.js` emits JavaScript-shaped
 * source on purpose. Things with no JavaScript equivalent (`attachMovie`,
 * `duplicateMovieClip`, `swapDepths`, `tellTarget`) are stubs that report
 * themselves once rather than throwing. A handler that throws is caught,
 * reported once, and switched off, so one bad script cannot take the movie
 * down with it.
 */
(function (global) {
  'use strict';

  var F = global.Flashy;
  if (!F) throw new Error('flashy.js must be loaded before flashy-as2.js');

  // -------------------- parsing the blocks --------------------
  /**
   * Split a script into its handler blocks.
   *
   * Brace counting rather than a regular expression, because a body
   * containing `{x: 1}` — which the eye-tracking idiom always does — ends a
   * regex-matched block in the wrong place.
   */
  function parseHandlers(source) {
    var out = [];
    if (!source) return out;
    var re = /\b(onClipEvent|on)\s*\(([^)]*)\)\s*\{/g;
    var m;
    while ((m = re.exec(source))) {
      var start = re.lastIndex;
      var depth = 1;
      var i = start;
      var inString = null;
      while (i < source.length && depth > 0) {
        var ch = source[i];
        if (inString) {
          if (ch === '\\') i++;
          else if (ch === inString) inString = null;
        } else if (ch === '"' || ch === "'") inString = ch;
        else if (ch === '/' && source[i + 1] === '/') {
          while (i < source.length && source[i] !== '\n') i++;
        } else if (ch === '/' && source[i + 1] === '*') {
          i = source.indexOf('*/', i);
          if (i < 0) break;
          i++;
        } else if (ch === '{') depth++;
        else if (ch === '}') depth--;
        i++;
      }
      if (depth !== 0) break;                 // unbalanced — stop here
      out.push({
        kind: m[1] === 'on' ? 'button' : 'clip',
        events: m[2].split(',').map(function (e) { return e.trim(); }).filter(Boolean),
        body: source.slice(start, i - 1)
      });
      re.lastIndex = i;
    }
    return out;
  }

  /** True if a script has anything this runtime would act on. */
  function hasHandlers(source) { return parseHandlers(source).length > 0; }

  // -------------------- geometry --------------------
  /** The matrix that takes a node's local coordinates to stage coordinates. */
  function worldMatrix(node) {
    var chain = [];
    for (var n = node; n; n = n.parent) chain.unshift(n);
    var m = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    for (var i = 0; i < chain.length; i++) {
      var o = chain[i];
      var cos = Math.cos(o.rotation || 0), sin = Math.sin(o.rotation || 0);
      var sx = o.scaleX == null ? 1 : o.scaleX;
      var sy = o.scaleY == null ? 1 : o.scaleY;
      /* translate · rotate · scale, matching DisplayObject._applyTransform. */
      var a = cos * sx, b = sin * sx, c = -sin * sy, d = cos * sy;
      var tx = o.x || 0, ty = o.y || 0;
      m = {
        a: m.a * a + m.c * b,
        b: m.b * a + m.d * b,
        c: m.a * c + m.c * d,
        d: m.b * c + m.d * d,
        tx: m.a * tx + m.c * ty + m.tx,
        ty: m.b * tx + m.d * ty + m.ty
      };
    }
    return m;
  }

  function globalToLocal(node, x, y) {
    var m = worldMatrix(node);
    var det = m.a * m.d - m.b * m.c;
    if (!det) return { x: 0, y: 0 };
    var dx = x - m.tx, dy = y - m.ty;
    return { x: (dx * m.d - dy * m.c) / det, y: (dy * m.a - dx * m.b) / det };
  }

  /** A node's own extent in its own coordinates, children included. */
  function localBounds(node) {
    var box = null;
    function add(b, ox, oy, sx, sy) {
      if (!b) return;
      var x0 = ox + b.minX * sx, x1 = ox + b.maxX * sx;
      var y0 = oy + b.minY * sy, y1 = oy + b.maxY * sy;
      var r = { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minY: Math.min(y0, y1), maxY: Math.max(y0, y1) };
      if (!box) box = r;
      else {
        box.minX = Math.min(box.minX, r.minX); box.maxX = Math.max(box.maxX, r.maxX);
        box.minY = Math.min(box.minY, r.minY); box.maxY = Math.max(box.maxY, r.maxY);
      }
    }
    if (node.graphics && node.graphics._bounds) add(node.graphics._bounds, 0, 0, 1, 1);
    var kids = node.children || [];
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      var kb = localBounds(k);
      if (kb) add(kb, k.x || 0, k.y || 0, k.scaleX == null ? 1 : k.scaleX, k.scaleY == null ? 1 : k.scaleY);
    }
    return box;
  }

  function sizeOf(node) {
    var b = localBounds(node);
    if (!b) return { width: 0, height: 0 };
    return { width: b.maxX - b.minX, height: b.maxY - b.minY };
  }

  // -------------------- the scope --------------------
  /* Properties AS2 spells with an underscore, and where they live on a
     Flashy display object. The units differ on purpose: Flash counts alpha
     and scale in percent and angles in degrees. */
  /**
   * Where Flash's origin is, relative to the node's own.
   *
   * Flash measures a clip from its registration point; this engine draws an
   * object around the centre of its box. A handler that says
   * `_x = origin.x + 4`, with `origin` baked in at publish time — which is
   * what every eye-follows-the-mouse script does — lands half a bounding box
   * out unless the two agree. The importer records the offset per object;
   * anything else falls back to the box's top-left, which is the X and Y the
   * inspector shows.
   */
  function reg(node) {
    return node.__as2Reg || { x: 0, y: 0, hw: 0, hh: 0 };
  }

  var PROPS = {
    _x: [function (n) { return n.x - reg(n).x; },
      function (n, v) { n.x = (Number(v) || 0) + reg(n).x; }],
    _y: [function (n) { return n.y - reg(n).y; },
      function (n, v) { n.y = (Number(v) || 0) + reg(n).y; }],
    _xscale: [function (n) { return (n.scaleX == null ? 1 : n.scaleX) * 100; },
      function (n, v) { n.scaleX = Number(v) / 100; }],
    _yscale: [function (n) { return (n.scaleY == null ? 1 : n.scaleY) * 100; },
      function (n, v) { n.scaleY = Number(v) / 100; }],
    _rotation: [function (n) { return (n.rotation || 0) * 180 / Math.PI; },
      function (n, v) { n.rotation = Number(v) * Math.PI / 180; }],
    _alpha: [function (n) { return (n.alpha == null ? 1 : n.alpha) * 100; },
      function (n, v) { n.alpha = Math.max(0, Math.min(1, Number(v) / 100)); }],
    _visible: [function (n) { return n.visible !== false; },
      function (n, v) { n.visible = !!v; }],
    _width: [function (n) { return sizeOf(n).width * Math.abs(n.scaleX == null ? 1 : n.scaleX); },
      function (n, v) { var w = sizeOf(n).width; if (w) n.scaleX = Number(v) / w; }],
    _height: [function (n) { return sizeOf(n).height * Math.abs(n.scaleY == null ? 1 : n.scaleY); },
      function (n, v) { var h = sizeOf(n).height; if (h) n.scaleY = Number(v) / h; }],
    _name: [function (n) { return n.name || ''; }, function (n, v) { n.name = String(v); }],
    _currentframe: [function (n) { return timelineOf(n).currentFrame || 1; }],
    _totalframes: [function (n) { var t = timelineOf(n); return (t.timeline && t.timeline.totalFrames) || 1; }],
    _framesloaded: [function (n) { var t = timelineOf(n); return (t.timeline && t.timeline.totalFrames) || 1; }],
    _quality: [function () { return 'HIGH'; }],
    _focusrect: [function () { return false; }],
    _droptarget: [function () { return ''; }],
    _url: [function () { return typeof location !== 'undefined' ? location.href : ''; }]
  };

  /**
   * The node that actually carries a clip's timeline.
   *
   * An imported symbol instance is built as two nodes: a wrapper holding
   * the transform and the instance name, and an inner node holding the
   * symbol's own timeline. AS2 knows them as one clip, so `myClip.play()`
   * arrives at the wrapper — whose timeline is one frame long, making the
   * call do nothing at all.
   */
  function timelineOf(node) {
    var inner = node.__inner;
    if (inner && inner.timeline && inner.timeline.totalFrames > 1) return inner;
    return node;
  }

  var METHODS = {
    /* The document is already in memory, so a preloader's own test —
       "is it all here yet?" — is true from the first frame. Returning
       nothing instead left every imported movie sitting on its preloader
       forever, which looks exactly like a movie that does not play. */
    getBytesLoaded: function () { return 1000; },
    getBytesTotal: function () { return 1000; },
    play: function (n) { var t = timelineOf(n); if (t.play) t.play(); },
    stop: function (n) { var t = timelineOf(n); if (t.stop) t.stop(); },
    gotoAndPlay: function (n, f) { var t = timelineOf(n); if (t.gotoAndPlay) t.gotoAndPlay(f); },
    gotoAndStop: function (n, f) { var t = timelineOf(n); if (t.gotoAndStop) t.gotoAndStop(f); },
    nextFrame: function (n) { var t = timelineOf(n); if (t.nextFrame) t.nextFrame(); },
    prevFrame: function (n) { var t = timelineOf(n); if (t.prevFrame) t.prevFrame(); },
    removeMovieClip: function (n) { if (n.removeFromParent) n.removeFromParent(); }
  };

  /**
   * An object that swallows whatever is done to it.
   *
   * Reading a property gives another one, calling it gives another one,
   * and assigning to it is accepted — so `com.newgrounds.API.connect(key,
   * id, root)` runs to completion and does nothing, instead of throwing on
   * its first dot and stopping everything after it.
   */
  function inertPackage(name) {
    var fn = function () { return inertPackage(name + '()'); };
    return new Proxy(fn, {
      get: function (t, prop) {
        if (prop === 'toString' || prop === Symbol.toPrimitive) return function () { return ''; };
        if (prop === 'valueOf') return function () { return undefined; };
        if (typeof prop === 'symbol') return undefined;
        return inertPackage(name + '.' + String(prop));
      },
      set: function () { return true; },
      apply: function () { return inertPackage(name); }
    });
  }

  /** Things an AS2 script can name that are not on the clip. */
  function globalsFor(ctx) {
    return {
      Math: Math, Number: Number, String: String, Boolean: Boolean,
      Array: Array, Object: Object, Date: Date, JSON: typeof JSON !== 'undefined' ? JSON : undefined,
      parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite,
      NaN: NaN, Infinity: Infinity, undefined: undefined,
      int: function (v) { return Math.trunc(Number(v)) || 0; },
      random: function (n) { return Math.floor(Math.random() * (Number(n) || 0)); },
      getTimer: function () { return Math.round((ctx.now() - ctx.started)); },
      getBytesLoaded: function () { return 1000; },
      getBytesTotal: function () { return 1000; },
      trace: function () {
        if (global.console) global.console.log.apply(global.console, arguments);
      },
      /* Flash redrew immediately when a mouse handler moved something; without
         it the eyes only catch up on the next frame. */
      updateAfterEvent: function () { if (ctx.stage && ctx.stage._render) ctx.stage._render(); },
      getURL: function (url, target) {
        if (typeof global.open === 'function') global.open(url, target || '_blank');
      },
      Mouse: {
        show: function () {}, hide: function () {},
        addListener: function () {}, removeListener: function () { return false; }
      },
      /* The handles the editor's own frame scripts are written against, so
         one scope serves both dialects. */
      stage: ctx.stage, root: ctx.root, Flashy: F,
      /* A published movie calls into whatever it was linked against —
         a sound library, a portal's API, a preloader. Nothing here can run
         them, and a ReferenceError on line one would stop the whole script,
         so the common ones answer as inert objects. */
      /* Nearly every portal SWF calls into an API compiled into it as AS2
         classes — Newgrounds medals, MochiAds, a sponsor's tracking. Those
         classes cannot be reconstructed here, and one
         `com.newgrounds.API.connect(…)` on frame one would otherwise throw
         and take the rest of the frame script with it, game logic included.
         These package names answer as objects that absorb anything. */
      com: inertPackage('com'), org: inertPackage('org'), net: inertPackage('net'),
      mochi: inertPackage('mochi'), MochiAd: inertPackage('MochiAd'),
      _global: inertPackage('_global'),
      SharedObject: {
        getLocal: function () {
          return { data: {}, flush: function () {}, clear: function () {} };
        }
      },
      System: { security: { allowDomain: function () {} } },
      setInterval: function () {
        return typeof global.setInterval === 'function'
          ? global.setInterval.apply(global, arguments) : 0;
      },
      clearInterval: function () {
        if (typeof global.clearInterval === 'function') global.clearInterval.apply(global, arguments);
      },
      setTimeout: function () {
        return typeof global.setTimeout === 'function'
          ? global.setTimeout.apply(global, arguments) : 0;
      },
      Stage: {
        width: ctx.stage ? ctx.stage.width : 0, height: ctx.stage ? ctx.stage.height : 0,
        scaleMode: 'showAll', align: '', showMenu: true,
        addListener: function () {}, removeListener: function () { return false; }
      },
      Key: ctx.key
    };
  }

  /* Calls with no equivalent here. Reported once each, because a clip that
     calls attachMovie every frame would otherwise fill the console. */
  var STUBS = ['attachMovie', 'duplicateMovieClip', 'swapDepths', 'tellTarget',
    'loadMovie', 'loadVariables', 'startDrag', 'stopDrag',
    'createEmptyMovieClip', 'createTextField', 'beginFill',
    'lineTo', 'moveTo', 'endFill'];

  function makeScope(node, ctx) {
    if (ctx.scopes.has(node)) return ctx.scopes.get(node);
    var vars = {};
    var globals = globalsFor(ctx);

    var target = {
      /* `this` inside a handler is the clip — and the clip IS the scope, so
         the proxy stands in for both. */
      __node: node,
      __vars: vars
    };

    var proxy = new Proxy(target, {
      /* `with` consults `has` for every identifier in the body; saying yes to
         everything is what redirects the whole lookup here. */
      has: function () { return true; },
      get: function (t, prop) {
        if (typeof prop === 'symbol') return undefined;
        if (prop === 'this') return proxy;
        if (Object.prototype.hasOwnProperty.call(vars, prop)) return vars[prop];
        var p = PROPS[prop];
        if (p) return p[0](node);
        if (prop === '_parent') return node.parent ? makeScope(node.parent, ctx) : undefined;
        if (prop === '_root') return makeScope(ctx.root, ctx);
        if (prop === '_xmouse') return ctx.mouseIn(node).x;
        if (prop === '_ymouse') return ctx.mouseIn(node).y;
        if (prop === '_target') return pathOf(node);
        if (METHODS[prop]) {
          return function () {
            var args = Array.prototype.slice.call(arguments);
            return METHODS[prop].apply(null, [node].concat(args));
          };
        }
        var child = childNamed(node, prop);
        if (child) return makeScope(child, ctx);
        if (Object.prototype.hasOwnProperty.call(globals, prop)) return globals[prop];
        if (STUBS.indexOf(prop) >= 0) {
          return function () { ctx.unsupported(prop); };
        }
        if (prop in global) return global[prop];
        return undefined;
      },
      set: function (t, prop, value) {
        if (typeof prop === 'symbol') return true;
        var p = PROPS[prop];
        if (p && p[1]) { p[1](node, value); return true; }
        if (EVENT_PROPS[prop]) bindDynamic(node, ctx, prop, value, proxy);
        vars[prop] = value;
        return true;
      }
    });

    ctx.scopes.set(node, proxy);
    return proxy;
  }

  function childNamed(node, name) {
    var kids = node.children || [];
    for (var i = 0; i < kids.length; i++) if (kids[i].name === name) return kids[i];
    return null;
  }

  function pathOf(node) {
    var parts = [];
    for (var n = node; n && n.parent; n = n.parent) parts.unshift(n.name || '');
    return '/' + parts.join('/');
  }

  // -------------------- attaching --------------------
  var CLIP_EVENTS = ['load', 'unload', 'enterFrame', 'mouseMove', 'mouseDown',
    'mouseUp', 'keyDown', 'keyUp', 'data', 'initialize', 'construct'];
  var BUTTON_EVENTS = ['press', 'release', 'releaseOutside', 'rollOver',
    'rollOut', 'dragOver', 'dragOut', 'keyPress'];

  /**
   * Bind one event of one node, returning a disposer.
   *
   * Shared by the `onClipEvent(…)` blocks a movie was authored with and the
   * `clip.onRelease = fn` assignments it makes at runtime — the same events
   * either way, so they go through the same code.
   */
  function wireEvent(node, ctx, event, run, kind) {
    var stage = ctx.stage;
    if (kind === 'button' || BUTTON_EVENTS.indexOf(event) >= 0) {
      return wireButtonEvent(node, ctx, event, run);
    }
    switch (event) {
    case 'enterFrame': {
      /* Only a MovieClip ticks a timeline and dispatches its own
         enterFrame; a Shape never will, so its handler has to ride the
         stage's. Binding to the node regardless is how a handler on a
         piece of artwork silently did nothing. */
      var source = node.timeline ? node : stage;
      source.addEventListener('enterFrame', run);
      return function () { source.removeEventListener('enterFrame', run); };
    }
    case 'mouseMove': case 'mouseDown': case 'mouseUp':
      /* In Flash these fire wherever the pointer is, not only over the
         clip — which is the whole trick behind eyes that follow it. */
      stage.addEventListener(event, run);
      return function () { stage.removeEventListener(event, run); };
    case 'keyDown': case 'keyUp': {
      var type = event === 'keyDown' ? 'keydown' : 'keyup';
      if (typeof global.addEventListener !== 'function') return null;
      global.addEventListener(type, run);
      return function () { global.removeEventListener(type, run); };
    }
    case 'unload':
      return run;
    default:
      ctx.unsupported('onClipEvent(' + event + ')');
      return null;
    }
  }

  function wireButtonEvent(node, ctx, event, run) {
    var stage = ctx.stage;
    var over = false, down = false;
    var onMove = function () {
      var nowOver = isOver(ctx, node);
      if (nowOver === over) return;
      over = nowOver;
      if ((event === 'rollOver' && nowOver) || (event === 'rollOut' && !nowOver)) run();
      if ((event === 'dragOver' && nowOver && down) || (event === 'dragOut' && !nowOver && down)) run();
    };
    var onDown = function () {
      if (!isOver(ctx, node)) return;
      down = true;
      if (event === 'press') run();
    };
    var onUp = function () {
      var hit = isOver(ctx, node);
      if (event === 'release' && hit && down) run();
      if (event === 'releaseOutside' && !hit && down) run();
      down = false;
    };
    if (event === 'rollOver' || event === 'rollOut' || event === 'dragOver' || event === 'dragOut') {
      stage.addEventListener('mouseMove', onMove);
      stage.addEventListener('mouseDown', onDown);
      stage.addEventListener('mouseUp', onUp);
      return function () {
        stage.removeEventListener('mouseMove', onMove);
        stage.removeEventListener('mouseDown', onDown);
        stage.removeEventListener('mouseUp', onUp);
      };
    }
    stage.addEventListener('mouseDown', onDown);
    stage.addEventListener('mouseUp', onUp);
    return function () {
      stage.removeEventListener('mouseDown', onDown);
      stage.removeEventListener('mouseUp', onUp);
    };
  }

  /* `clip.onRelease = function () { … }` is how AS2 code written after about
     2004 attaches behaviour — the `on(release)` block belongs to the Flash
     authoring tool, the property belongs to the language.

     The binding lives on the node, and the runtime rebuilds its display
     list every tick — so a node that gets a handler this way has to be
     kept across rebuilds, or the handler goes with the node it was on. */
  var EVENT_PROPS = {
    onEnterFrame: 'enterFrame', onLoad: 'load', onUnload: 'unload',
    onMouseDown: 'mouseDown', onMouseUp: 'mouseUp', onMouseMove: 'mouseMove',
    onPress: 'press', onRelease: 'release', onReleaseOutside: 'releaseOutside',
    onRollOver: 'rollOver', onRollOut: 'rollOut',
    onDragOver: 'dragOver', onDragOut: 'dragOut',
    onKeyDown: 'keyDown', onKeyUp: 'keyUp'
  };

  function bindDynamic(node, ctx, prop, fn, scope) {
    var slots = node.__as2Dyn || (node.__as2Dyn = {});
    if (slots[prop]) { slots[prop](); delete slots[prop]; }
    if (typeof fn !== 'function') return;
    var event = EVENT_PROPS[prop];
    var dead = false;
    var run = function () {
      if (dead) return;
      /* Same rule as an authored handler: a clip that has left the display
         list stops, and lets its listeners go. */
      if (!node.parent && node !== ctx.stage.root) {
        if (slots[prop]) { slots[prop](); delete slots[prop]; }
        return;
      }
      try { fn.call(scope); }
      catch (e) {
        dead = true;
        if (global.console) global.console.warn('Flashy: ' + prop + ' failed and was switched off: ' + e.message);
      }
    };
    if (event === 'load') { run(); return; }
    var kind = BUTTON_EVENTS.indexOf(event) >= 0 ? 'button' : 'clip';
    var dispose = wireEvent(node, ctx, event, run, kind);
    if (dispose) slots[prop] = dispose;
  }

  function contextFor(stage) {
    if (stage.__as2) return stage.__as2;
    var ctx = {
      stage: stage,
      root: stage.root,
      scopes: new WeakMap(),
      started: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
      now: function () { return typeof performance !== 'undefined' ? performance.now() : Date.now(); },
      said: {},
      /* `Key` is a broadcaster in AS2: code calls `Key.addListener(this)`
         and gets `onKeyDown`/`onKeyUp` called back on the listener. Games
         drive their controls through it, so leaving the methods off stops
         the first script that touches the keyboard. */
      key: {
        code: 0, ascii: 0, down: {}, listeners: [],
        getCode: function () { return this.code; },
        getAscii: function () { return this.ascii; },
        isDown: function (c) { return !!this.down[c]; },
        addListener: function (l) { if (l && this.listeners.indexOf(l) < 0) this.listeners.push(l); },
        removeListener: function (l) {
          var i = this.listeners.indexOf(l);
          if (i >= 0) this.listeners.splice(i, 1);
          return i >= 0;
        }
      },
      mouseIn: function (node) {
        /* Flash reports the pointer in the clip's own space, measured from
           its registration point — which sits at the top-left of the box
           this engine draws around a centre. */
        var p = globalToLocal(node, stage.mouseX || 0, stage.mouseY || 0);
        var r = reg(node);
        return { x: p.x + r.hw, y: p.y + r.hh };
      },
      unsupported: function (name) {
        if (ctx.said[name]) return;
        ctx.said[name] = true;
        if (global.console) global.console.warn('Flashy: ' + name + '() is not supported yet');
      }
    };
    if (typeof global.addEventListener === 'function') {
      var broadcast = function (which) {
        var list = ctx.key.listeners.slice();
        for (var i = 0; i < list.length; i++) {
          var fn = list[i] && list[i][which];
          if (typeof fn === 'function') {
            try { fn.call(list[i]); }
            catch (e) {
              if (global.console) global.console.warn('Flashy: ' + which + ' listener failed: ' + e.message);
            }
          }
        }
      };
      global.addEventListener('keydown', function (e) {
        ctx.key.code = e.keyCode || 0;
        ctx.key.ascii = e.key ? e.key.charCodeAt(0) : 0;
        ctx.key.down[ctx.key.code] = true;
        broadcast('onKeyDown');
      });
      global.addEventListener('keyup', function (e) {
        ctx.key.down[e.keyCode || 0] = false;
        broadcast('onKeyUp');
      });
    }
    stage.__as2 = ctx;
    return ctx;
  }

  /**
   * Is the pointer over this node?
   *
   * Asked of the node itself, not of the display list as a whole. Hit
   * testing from the root returns whatever is on TOP at that point, and a
   * menu is artwork layered over its buttons — so the global answer is the
   * decoration every time, and no button ever reports itself as clicked.
   * Flash tests a button's own hit area and does not care what is drawn
   * above it.
   */
  function isOver(ctx, node) {
    var stage = ctx.stage;
    if (!stage || !stage._hitTest) return false;
    var p = globalToLocal(node, stage.mouseX || 0, stage.mouseY || 0);
    return !!stage._hitTest(node, p.x, p.y);
  }

  /**
   * Compile and wire one object's script.
   *
   * Returns a controller with `detach()`; call it when the object leaves the
   * display list, or its handlers go on firing for a clip nobody can see.
   */
  function attach(node, source, opts) {
    opts = opts || {};
    var stage = opts.stage;
    if (!stage) throw new Error('Flashy.AS2.attach needs the stage');
    var ctx = contextFor(stage);
    var blocks = parseHandlers(source);
    if (!blocks.length) return null;

    /* Where unqualified names resolve. `onClipEvent` code belongs to the
       clip itself, but an `on(release)` block on a BUTTON belongs to the
       timeline the button sits on — `arcadeNav = true` in a menu button is
       setting a variable on the menu, which something else then reads as
       `_root.arcadeNav`. Scoping it to the button instead loses it.
       Resolved when the handler RUNS, not when it is wired: at wiring time
       the object is still being built and has no parent yet. */
    var clipScope = makeScope(node, ctx);
    var scopeFor = function (kind) {
      return kind === 'button' ? makeScope(node.parent || node, ctx) : clipScope;
    };
    var bound = [];
    var disposers = [];
    var controller = null;

    blocks.forEach(function (block) {
      var fn;
      try {
        /* `new Function` bodies are sloppy mode, which is what makes `with`
           legal — and `with` is what gives an AS2 body its scope chain. */
        fn = new Function('with (this) {\n' + block.body + '\n}');
      } catch (e) {
        report(block, e, 'could not be compiled');
        return;
      }
      var dead = false;
      var exec = function () {
        if (dead) return;
        try { fn.call(scopeFor(block.kind)); }
        catch (e) {
          dead = true;                        // one report, then stop
          report(block, e, 'failed and was switched off');
        }
      };
      /* An event-driven run needs the clip to still be in the display list.
         A rebuilt or removed one keeps its stage listeners otherwise, and
         goes on running against a parent it no longer has — which surfaces
         as `_parent` being undefined, from a clip nobody can see. `load` is
         the exception: it fires while the object is still being built, so
         it runs through `exec` directly. */
      var run = function () {
        if (dead) return;
        if (!node.parent && node !== stage.root) {
          if (controller) controller.detach();
          return;
        }
        exec();
      };
      block.events.forEach(function (event) {
        bound.push(event);
        wire(block, event, run, exec);
      });
    });

    function wire(block, event, run, exec) {
      if (event === 'load' || event === 'initialize' || event === 'construct' || event === 'data') {
        exec();
        return;
      }
      var kind = (block.kind === 'button' || BUTTON_EVENTS.indexOf(event) >= 0) ? 'button' : 'clip';
      var dispose = wireEvent(node, ctx, event, run, kind);
      if (dispose) disposers.push(dispose);
    }

    function report(block, error, what) {
      if (!global.console) return;
      global.console.warn('Flashy: ' + (block.kind === 'on' ? 'on' : 'onClipEvent') +
        '(' + block.events.join(', ') + ') ' + what + ': ' + (error && error.message));
    }

    controller = {
      node: node,
      events: bound,
      scope: clipScope,
      detach: function () {
        for (var i = 0; i < disposers.length; i++) {
          try { disposers[i](); } catch (e) { /* a handler that throws on unload is still gone */ }
        }
        disposers.length = 0;
      }
    };
    return controller;
  }

  /**
   * Compile a FRAME script the same way, so an imported timeline script gets
   * the scope it was written against.
   *
   * `stop()` and `gotoAndPlay("menuLabel")` are the easy half. The rest is
   * what a published movie's frame scripts are actually full of: `_root.x`,
   * `_quality`, `Mouse.show()`, `Stage.showMenu`, and calls into whatever
   * API the author linked against. Those resolve to the timeline's own
   * variables or to undefined instead of throwing a ReferenceError that
   * stops the script on its first line.
   */
  function frameScript(node, source, opts) {
    opts = opts || {};
    var stage = opts.stage;
    if (!stage) throw new Error('Flashy.AS2.frameScript needs the stage');
    var ctx = contextFor(stage);
    var scope = makeScope(node, ctx);
    var fn;
    try {
      fn = new Function('with (this) {' + String.fromCharCode(10) + source +
        String.fromCharCode(10) + '}');
    } catch (e) {
      if (global.console) global.console.warn('Flashy: frame script could not be compiled: ' + e.message);
      return null;
    }
    var failed = false;
    return function () {
      if (failed) return;
      try { fn.call(scope); }
      catch (e) {
        /* One report, then stay quiet: a frame script that throws usually
           does it on every pass through the frame. */
        failed = true;
        if (global.console) global.console.warn('Flashy: frame script failed and was switched off: ' + e.message);
      }
    };
  }

  F.AS2 = {
    frameScript: frameScript,
    attach: attach,
    parseHandlers: parseHandlers,
    hasHandlers: hasHandlers,
    globalToLocal: globalToLocal,
    worldMatrix: worldMatrix,
    localBounds: localBounds
  };
})(typeof window !== 'undefined' ? window : this);
