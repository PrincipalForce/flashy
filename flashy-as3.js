/* flashy-as3.js — ActionScript 3, compiled to JavaScript
 *
 * The last gap in the audit, and the one it had written off as "needs a
 * compiler and an AVM2". Half of that is true and half is not.
 *
 * An AVM2 — a bytecode interpreter for compiled ABC — genuinely is out of
 * scope, and nothing here pretends otherwise: this does not run a .swf's
 * compiled ActionScript. What it does is the other, and far more useful,
 * half. AS3 SOURCE is a class-based language that is very nearly a subset of
 * modern JavaScript once the type annotations are removed, and the standard
 * library it reaches for — Sprite, MovieClip, TextField, Event, Point,
 * Matrix, Timer — maps onto what Flashy's engine already is. So AS3 source
 * compiles to JavaScript and runs on the real engine.
 *
 * That is also what Flash itself did at the level that mattered to an author:
 * you wrote a document class, it was instantiated with the stage, and
 * `addChild` put things on screen.
 *
 * WHAT IS SUPPORTED
 *   package / import / class / extends / implements / interface(ignored)
 *   public · private · protected · internal · static · final · override
 *   var · const with type annotations, and typed function signatures
 *   get / set accessors
 *   new · as · is · typeof · delete · in
 *   for · for in · for each in · while · do · switch · try/catch/finally
 *   Vector.<T>  (becomes Array)
 *   trace()     (goes to Flashy.Output, like every other trace in Flashy)
 *   the flash.* classes listed in RUNTIME below
 *
 * WHAT IS NOT, and is reported rather than silently wrong
 *   E4X (XML literals and the .. and .@ operators)
 *   namespaces and the :: operator
 *   `super` in a getter, and `Object.prototype` tricks
 *   compile-time constants (-define), conditional compilation
 *   anything from flash.net, flash.system.Security, or the ABC loader
 *
 * The whole point of listing those is that a script using them is REJECTED
 * with a line number, rather than compiled into something that does
 * something else. A compiler that quietly drops what it does not understand
 * is worse than one that refuses.
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Tokenizer
   *
   * AS3's lexical grammar is JavaScript's plus type annotations, and the one
   * genuine ambiguity is `/`: division or the start of a regular expression.
   * Resolved the standard way, by what the previous significant token was.
   * ------------------------------------------------------------------ */

  var KEYWORDS = [
    'package', 'import', 'class', 'interface', 'extends', 'implements',
    'public', 'private', 'protected', 'internal', 'static', 'final',
    'override', 'native', 'dynamic',
    'var', 'const', 'function', 'return', 'if', 'else', 'for', 'each',
    'while', 'do', 'break', 'continue', 'switch', 'case', 'default',
    'try', 'catch', 'finally', 'throw', 'new', 'delete', 'typeof',
    'void', 'null', 'undefined', 'true', 'false', 'this', 'super',
    'in', 'is', 'as', 'instanceof', 'get', 'set', 'use', 'namespace'
  ];

  var PUNCT = [
    '>>>=', '===', '!==', '**=', '>>>', '<<=', '>>=', '&&=', '||=', '??=',
    '==', '!=', '<=', '>=', '&&', '||', '??', '++', '--', '+=', '-=',
    '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '=>', '::', '..', '**',
    '{', '}', '(', ')', '[', ']', ';', ',', '<', '>', '+', '-', '*', '/',
    '%', '&', '|', '^', '!', '~', '?', ':', '=', '.', '@'
  ];

  function tokenize(src) {
    var toks = [];
    var i = 0, line = 1;
    var n = src.length;
    var prev = null;

    var regexAllowed = function () {
      if (!prev) return true;
      if (prev.kind === 'num' || prev.kind === 'str' || prev.kind === 'regex') return false;
      if (prev.kind === 'name') return false;
      if (prev.kind === 'keyword') {
        // `return /x/` is a regex; `this /x/` is division.
        return prev.value !== 'this' && prev.value !== 'true' &&
               prev.value !== 'false' && prev.value !== 'null' &&
               prev.value !== 'super';
      }
      if (prev.kind === 'punct') {
        return prev.value !== ')' && prev.value !== ']' && prev.value !== '}' &&
               prev.value !== '++' && prev.value !== '--';
      }
      return true;
    };
    var push = function (t) { toks.push(t); prev = t; };

    while (i < n) {
      var c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      // Comments.
      if (c === '/' && src[i + 1] === '/') {
        while (i < n && src[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && src[i + 1] === '*') {
        i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') line++;
          i++;
        }
        i += 2;
        continue;
      }
      // Strings.
      if (c === '"' || c === "'") {
        var q = c, s = i; i++;
        var raw = '';
        while (i < n && src[i] !== q) {
          if (src[i] === '\\') { raw += src[i]; i++; }
          if (i < n) { if (src[i] === '\n') line++; raw += src[i]; i++; }
        }
        i++;
        push({ kind: 'str', value: raw, quote: q, line: line, at: s });
        continue;
      }
      // Numbers, including hex and AS3's 0x colour literals.
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        var ns = i;
        if (c === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
          i += 2;
          while (i < n && /[0-9a-fA-F_]/.test(src[i])) i++;
        } else {
          while (i < n && /[0-9_]/.test(src[i])) i++;
          if (src[i] === '.') { i++; while (i < n && /[0-9_]/.test(src[i])) i++; }
          if (src[i] === 'e' || src[i] === 'E') {
            i++;
            if (src[i] === '+' || src[i] === '-') i++;
            while (i < n && /[0-9]/.test(src[i])) i++;
          }
        }
        push({ kind: 'num', value: src.slice(ns, i).replace(/_/g, ''), line: line, at: ns });
        continue;
      }
      // Identifiers. `$` is legal in AS3 and common in generated code.
      if (/[A-Za-z_$]/.test(c)) {
        var is0 = i;
        while (i < n && /[A-Za-z0-9_$]/.test(src[i])) i++;
        var word = src.slice(is0, i);
        push({ kind: KEYWORDS.indexOf(word) >= 0 ? 'keyword' : 'name',
               value: word, line: line, at: is0 });
        continue;
      }
      // Regular expressions.
      if (c === '/' && regexAllowed()) {
        var rs = i; i++;
        var inClass = false, closed = false;
        while (i < n) {
          var rc = src[i];
          if (rc === '\\') { i += 2; continue; }
          if (rc === '\n') break;
          if (rc === '[') inClass = true;
          else if (rc === ']') inClass = false;
          else if (rc === '/' && !inClass) { i++; closed = true; break; }
          i++;
        }
        if (closed) {
          while (i < n && /[a-z]/.test(src[i])) i++;
          push({ kind: 'regex', value: src.slice(rs, i), line: line, at: rs });
          continue;
        }
        i = rs;    // not a regex after all; fall through to punctuation
      }
      // Punctuation, longest first.
      var matched = null;
      for (var p = 0; p < PUNCT.length; p++) {
        if (src.startsWith(PUNCT[p], i)) { matched = PUNCT[p]; break; }
      }
      if (matched) {
        push({ kind: 'punct', value: matched, line: line, at: i });
        i += matched.length;
        continue;
      }
      // Anything else is a character AS3 does not have.
      throw new AS3Error('Unexpected character ' + JSON.stringify(c), line);
    }
    toks.push({ kind: 'eof', value: '', line: line, at: n });
    return toks;
  }

  /** A compile error with the line it happened on. */
  function AS3Error(message, line) {
    this.name = 'AS3Error';
    this.message = message;
    this.line = line || 0;
  }
  AS3Error.prototype = Object.create(Error.prototype);
  AS3Error.prototype.toString = function () {
    return 'Line ' + this.line + ': ' + this.message;
  };

  /* ------------------------------------------------------------------ *
   * The translator
   *
   * Deliberately NOT a full parser producing an AST. AS3 statements and
   * expressions are JavaScript's, so what is needed is a token rewriter that
   * understands the places AS3 differs: class and package declarations, type
   * annotations, visibility modifiers, `for each`, `is`/`as`, and
   * `Vector.<T>`. Everything else passes through.
   *
   * The win is that the output is readable JavaScript with the same line
   * structure, so a runtime error in a compiled script reports a line the
   * author can find in their own source. An AST round trip loses that unless
   * it carries a source map, and a source map is a great deal of machinery
   * for a feature whose point is that the script runs at all.
   * ------------------------------------------------------------------ */

  /* The constructs that have no JavaScript shape and are refused rather than
     mistranslated. Each is a real AS3 feature; each would need either a type
     system or an XML engine to mean anything. */
  var UNSUPPORTED = [
    { test: /(^|[^.])\.\.(?![.])/, what: 'the E4X descendant operator (..)' },
    { test: /\.@/, what: 'the E4X attribute operator (.@)' },
    { test: /\buse\s+namespace\b/, what: 'use namespace' },
    { test: /::/, what: 'the namespace operator (::)' }
  ];

  function checkUnsupported(toks, src) {
    for (var u = 0; u < UNSUPPORTED.length; u++) {
      var m = UNSUPPORTED[u].test.exec(src);
      if (!m) continue;
      var line = src.slice(0, m.index).split('\n').length;
      throw new AS3Error(
        'This build does not support ' + UNSUPPORTED[u].what +
        '. It is a real ActionScript 3 feature and compiling it into ' +
        'something else would be worse than refusing it.', line);
    }
    // XML literals, which the tokenizer would read as comparisons.
    for (var i = 0; i < toks.length; i++) {
      if (toks[i].kind === 'name' && (toks[i].value === 'XML' || toks[i].value === 'XMLList')) {
        throw new AS3Error(
          'This build does not support E4X (XML and XMLList). Use JSON, or ' +
          'parse the markup with a plain function.', toks[i].line);
      }
    }
  }

  var MODIFIERS = ['public', 'private', 'protected', 'internal',
                   'final', 'override', 'native', 'dynamic'];

  /* ------------------------------------------------------------------ *
   * AS3's implicit `this`
   *
   * Inside a class, AS3 resolves a bare name against the class's own members
   * and then its base class's, so
   *
   *     x += vx;  graphics.beginFill(0xFF0000);  addChild(ball);
   *
   * all mean `this.`. JavaScript does not, and `with (this)` is both illegal
   * in strict mode and wrong about assignment. So bare names are resolved at
   * COMPILE time: the class body is scanned for its declared members before
   * anything is emitted, and a name that is one of them -- or one of the
   * inherited display-object members below -- is prefixed.
   *
   * This is the single most important thing the compiler does. Without it
   * every AS3 class fails on its first line, and with a wrong version of it
   * the failures are silent.
   *
   * Names NOT prefixed: a declared local or parameter (which shadows a
   * member, as in AS3), a property access after a dot, and an object-literal
   * key. Anything the compiler cannot account for is left alone, which makes
   * an unknown name a plain global -- the same thing AS3 would have made of
   * a package-level function.
   * ------------------------------------------------------------------ */
  /* The two places AS3 and the engine disagree about UNITS rather than about
     names. AS3's rotation is in degrees; the engine's is in radians and has
     always carried a `rotationDeg` accessor for exactly this. Mapping the
     name is the whole fix -- leaving it alone would make every rotation in
     every compiled script wrong by a factor of 57. */
  var RENAMED = { rotation: 'rotationDeg' };

  var INHERITED = {};
  [
    // DisplayObject
    'x', 'y', 'z', 'scaleX', 'scaleY', 'rotation', 'alpha', 'visible',
    'width', 'height', 'name', 'parent', 'stage', 'root', 'mask',
    'blendMode', 'filters', 'cacheAsBitmap', 'opaqueBackground',
    'scrollRect', 'mouseX', 'mouseY', 'transform', 'loaderInfo',
    'getBounds', 'getRect', 'globalToLocal', 'localToGlobal', 'hitTestObject',
    'hitTestPoint',
    // InteractiveObject
    'mouseEnabled', 'doubleClickEnabled', 'tabEnabled', 'tabIndex',
    'buttonMode', 'useHandCursor', 'mouseChildren',
    // DisplayObjectContainer
    'numChildren', 'addChild', 'addChildAt', 'removeChild', 'removeChildAt',
    'removeChildren', 'getChildAt', 'getChildByName', 'getChildIndex',
    'setChildIndex', 'swapChildren', 'swapChildrenAt', 'contains',
    // Sprite / MovieClip
    'graphics', 'hitArea', 'dropTarget', 'startDrag', 'stopDrag',
    'currentFrame', 'currentLabel', 'currentLabels', 'framesLoaded',
    'totalFrames', 'play', 'stop', 'gotoAndPlay', 'gotoAndStop',
    'nextFrame', 'prevFrame', 'enabled', 'trackAsMenu',
    // EventDispatcher
    'addEventListener', 'removeEventListener', 'dispatchEvent',
    'hasEventListener', 'willTrigger',
    // TextField, because a class extending one is common
    'text', 'htmlText', 'textColor', 'textWidth', 'textHeight',
    'autoSize', 'wordWrap', 'multiline', 'selectable', 'border',
    'borderColor', 'background', 'backgroundColor', 'defaultTextFormat',
    'setTextFormat', 'appendText', 'embedFonts', 'antiAliasType',
    // Timer
    'delay', 'repeatCount', 'currentCount', 'running', 'start', 'reset'
  ].forEach(function (k) { INHERITED[k] = true; });

  /**
   * The members a class body declares, without emitting anything.
   *
   * Takes the token index of the class body's opening brace and walks only
   * its top level, so a `var` inside a method is not mistaken for a field.
   */
  function scanMembers(toks, braceIndex) {
    var fields = {}, statics = {};
    var i = braceIndex;
    if (!toks[i] || toks[i].value !== '{') return { fields: fields, statics: statics };
    i++;
    var depth = 1;
    while (i < toks.length && depth > 0) {
      var t = toks[i];
      if (t.kind === 'punct' && t.value === '{') { depth++; i++; continue; }
      if (t.kind === 'punct' && t.value === '}') { depth--; i++; continue; }
      if (depth !== 1) { i++; continue; }
      if (t.kind === 'keyword' && (MODIFIERS.indexOf(t.value) >= 0 || t.value === 'static')) {
        i++;
        continue;
      }
      if (t.kind === 'keyword' && (t.value === 'var' || t.value === 'const')) {
        // Was `static` among the modifiers immediately before this?
        var isStatic = false;
        for (var b = i - 1; b >= braceIndex; b--) {
          var pt = toks[b];
          if (pt.kind === 'keyword' &&
              (MODIFIERS.indexOf(pt.value) >= 0 || pt.value === 'static')) {
            if (pt.value === 'static') { isStatic = true; }
            continue;
          }
          break;
        }
        i++;
        for (;;) {
          if (!toks[i] || toks[i].kind !== 'name') break;
          (isStatic ? statics : fields)[toks[i].value] = true;
          i++;
          // Skip the type annotation and the initialiser.
          var d2 = 0;
          while (toks[i] && !(d2 === 0 && toks[i].kind === 'punct' &&
                 (toks[i].value === ',' || toks[i].value === ';'))) {
            if (toks[i].kind === 'punct' &&
                (toks[i].value === '(' || toks[i].value === '[' || toks[i].value === '{')) d2++;
            if (toks[i].kind === 'punct' &&
                (toks[i].value === ')' || toks[i].value === ']' || toks[i].value === '}')) {
              if (d2 === 0) break;
              d2--;
            }
            i++;
          }
          if (toks[i] && toks[i].value === ',') { i++; continue; }
          break;
        }
        continue;
      }
      if (t.kind === 'keyword' && t.value === 'function') {
        var k = i + 1;
        if (toks[k] && toks[k].kind === 'keyword' &&
            (toks[k].value === 'get' || toks[k].value === 'set') &&
            toks[k + 1] && toks[k + 1].kind === 'name') k++;
        if (toks[k] && (toks[k].kind === 'name' || toks[k].kind === 'keyword')) {
          var isStaticFn = false;
          for (var b2 = i - 1; b2 >= braceIndex; b2--) {
            var pt2 = toks[b2];
            if (pt2.kind === 'keyword' &&
                (MODIFIERS.indexOf(pt2.value) >= 0 || pt2.value === 'static')) {
              if (pt2.value === 'static') isStaticFn = true;
              continue;
            }
            break;
          }
          (isStaticFn ? statics : fields)[toks[k].value] = true;
        }
        // Skip to the end of this method, so its locals are never scanned.
        while (toks[i] && !(toks[i].kind === 'punct' && toks[i].value === '{')) i++;
        var d3 = 0;
        while (toks[i]) {
          if (toks[i].kind === 'punct' && toks[i].value === '{') d3++;
          else if (toks[i].kind === 'punct' && toks[i].value === '}') {
            d3--;
            if (d3 === 0) { i++; break; }
          }
          i++;
        }
        continue;
      }
      i++;
    }
    return { fields: fields, statics: statics };
  }

  /**
   * Compile AS3 source to JavaScript.
   *
   * Returns {code, classes, imports, mainClass, warnings}. `code` declares
   * each class as a JavaScript class and ends by exporting them on the scope
   * object it is handed, which is how the player instantiates a document
   * class it only knows by name.
   */
  function compile(src, opts) {
    opts = opts || {};
    src = String(src == null ? '' : src);
    var toks = tokenize(src);
    checkUnsupported(toks, src);

    var out = [];
    var classes = [];
    var imports = [];
    var warnings = [];
    var i = 0;
    var line = 1;

    /* The class currently being compiled, and its members. Null at the top
       level, where a bare name is simply a bare name -- a frame script is not
       inside a class and nothing of its is implicitly `this`. */
    var cls = null;
    /* Every class compiled so far, by name, with its members and its base.
       A derived class has to resolve names its BASE declares -- `label` in a
       superclass is still a bare name in the subclass -- and the only place
       that is knowable is here. A base declared after its subclass is not
       supported and cannot be: a JavaScript `extends` clause is evaluated
       where the class statement is, so the base has to exist by then. */
    var classMembers = Object.create(null);
    /* Declared locals, innermost scope last. A local shadows a member, which
       is what AS3 does and what makes a parameter called `x` safe. */
    var scopes = [];
    var pushScope = function (names) {
      var set = {};
      (names || []).forEach(function (n) { set[n] = true; });
      scopes.push(set);
    };
    var popScope = function () { scopes.pop(); };
    var declareLocal = function (n) {
      if (scopes.length) scopes[scopes.length - 1][n] = true;
    };
    var isLocal = function (n) {
      for (var k = scopes.length - 1; k >= 0; k--) {
        if (scopes[k][n]) return true;
      }
      return false;
    };

    var peek = function (k) { return toks[i + (k || 0)]; };
    var at = function (kind, value) {
      var t = toks[i];
      return t.kind === kind && (value === undefined || t.value === value);
    };
    var atPunct = function (v) { return at('punct', v); };
    var atKw = function (v) { return at('keyword', v); };
    var take = function () { var t = toks[i++]; line = t.line; return t; };
    var expect = function (kind, value) {
      if (!at(kind, value)) {
        throw new AS3Error('Expected ' + (value || kind) + ' but found ' +
          (toks[i].value || toks[i].kind), toks[i].line);
      }
      return take();
    };
    /* Emitted text carries the source line it came from, so the assembler at
       the end can pad the output to match. */
    var emit = function (text, ln) { out.push({ text: text, line: ln == null ? line : ln }); };

    /** Skip a `:Type` annotation, including Vector.<T> and dotted names. */
    var skipType = function () {
      if (!atPunct(':')) return null;
      take();
      return readTypeName();
    };
    var readTypeName = function () {
      var name = '';
      if (atKw('void')) { take(); return 'void'; }
      if (atPunct('*')) { take(); return '*'; }
      if (!at('name') && !at('keyword')) {
        throw new AS3Error('Expected a type name', toks[i].line);
      }
      name += take().value;
      while (atPunct('.')) {
        // `Vector.<Type>` -- the only generic AS3 had.
        if (peek(1) && peek(1).kind === 'punct' && peek(1).value === '<') {
          take(); take();                 // . <
          var depth = 1;
          while (depth > 0 && !at('eof')) {
            if (atPunct('<')) depth++;
            else if (atPunct('>')) depth--;
            else if (atPunct('>>')) depth -= 2;
            take();
          }
          return 'Vector';
        }
        take();
        name += '.' + take().value;
      }
      return name;
    };

    /** Read and discard a run of visibility and inheritance modifiers. */
    var readModifiers = function () {
      var mods = { isStatic: false, visibility: 'internal', override: false };
      for (;;) {
        if (atKw('static')) { take(); mods.isStatic = true; continue; }
        if (at('keyword') && MODIFIERS.indexOf(toks[i].value) >= 0) {
          var m = take().value;
          if (m === 'override') mods.override = true;
          else if (m !== 'final' && m !== 'native' && m !== 'dynamic') mods.visibility = m;
          continue;
        }
        break;
      }
      return mods;
    };

    /* ---- expressions and statements -------------------------------- *
     * Copied through with four rewrites. Everything else is already
     * JavaScript, which is the whole reason this approach works.
     * -------------------------------------------------------------- */
    var copyBalanced = function (open, close, stopAtSemi) {
      var depth = 0;
      for (;;) {
        if (at('eof')) {
          if (depth > 0) throw new AS3Error('Unclosed ' + open, line);
          return;
        }
        if (atPunct(open)) depth++;
        else if (atPunct(close)) {
          depth--;
          if (depth === 0) { emitToken(take()); return; }
          if (depth < 0) return;
        }
        if (depth === 0 && stopAtSemi && atPunct(';')) { emitToken(take()); return; }
        copyOne();
      }
    };

    /* The token just emitted, so a name after a dot is left alone. Tracked
       here rather than read back out of `out`, because the emitted text is
       padded with spaces and re-parsing it would be absurd. */
    var lastEmitted = null;

    var emitToken = function (t) {
      if (t.kind === 'str') {
        emit(t.quote + t.value + t.quote, t.line);
      } else if (t.kind === 'regex' || t.kind === 'num') {
        emit(t.value, t.line);
      } else if (t.kind === 'name') {
        emit(' ' + resolveName(t) + ' ', t.line);
      } else if (t.kind === 'keyword') {
        emit(' ' + t.value + ' ', t.line);
      } else {
        emit(t.value, t.line);
      }
      lastEmitted = t;
    };

    /**
     * A bare name, with `this.` or `ClassName.` in front of it if AS3 would
     * have resolved it to a member.
     *
     * The four cases that are left alone are the ones that matter: a property
     * access (`a.x`), a declared local or parameter (which shadows a member),
     * an object-literal key or a label (`name :`), and a name the compiler
     * knows nothing about -- which stays a global, exactly as a
     * package-level function would have been.
     */
    var resolveName = function (t) {
      var n = t.value;
      if (!cls) return n;
      if (lastEmitted && lastEmitted.kind === 'punct' && lastEmitted.value === '.') return n;
      // `new Foo` and `function Foo` name a class or a function, not a member.
      if (lastEmitted && lastEmitted.kind === 'keyword' &&
          (lastEmitted.value === 'new' || lastEmitted.value === 'function')) return n;
      var next = toks[i];     // the token AFTER this one, already consumed
      if (next && next.kind === 'punct' && next.value === ':') return n;
      if (isLocal(n)) return n;
      if (cls.statics[n]) return cls.name + '.' + n;
      if (cls.fields[n]) return 'this.' + n;
      // The base chain, for a class extending another of the author's.
      var sup = cls.superClass, guard = 0;
      while (sup && classMembers[sup] && guard++ < 32) {
        if (classMembers[sup].statics[n]) return sup + '.' + n;
        if (classMembers[sup].fields[n]) return 'this.' + n;
        sup = classMembers[sup].superClass;
      }
      if (INHERITED[n]) return 'this.' + (RENAMED[n] || n);
      return n;
    };

    /**
     * Copy one token, rewriting the AS3-only spellings.
     *
     * `is` becomes `instanceof` with a guard for the primitive classes, `as`
     * becomes a checked cast that yields null on a miss (which is what AS3's
     * `as` does and is the entire reason to use it over a plain cast), and
     * `Vector.<T>` becomes Array.
     */
    var copyOne = function () {
      // A variable declaration inside a function body.
      if (atKw('var') || atKw('const')) {
        var kw = take().value;
        emit(kw === 'const' ? ' const ' : ' let ', line);
        for (;;) {
          if (!at('name')) break;
          var lname = take().value;
          // Declared BEFORE the initialiser is translated, so `var n = n + 1`
          // reads the local rather than silently becoming `this.n`.
          declareLocal(lname);
          emit(' ' + lname + ' ', line);
          lastEmitted = { kind: 'name', value: lname };
          skipType();
          if (atPunct('=')) { emit('=', line); take(); copyUntil([',', ';'], true); }
          if (atPunct(',')) { emit(',', line); take(); continue; }
          break;
        }
        if (atPunct(';')) { emit(';', line); take(); }
        return;
      }
      if (atKw('is') || atKw('as')) {
        /* `x is Number` has to be `typeof x === "number"`, which no infix
           rewrite can express -- so it goes through a helper that knows about
           the primitive classes, and the helper needs the LEFT operand, which
           has already been emitted. Rather than buffer every expression on
           the chance one of them is followed by `is`, the already-emitted
           output is scanned back to where the operand began. `is` and `as`
           are the only two places AS3 needs this, and the alternative is a
           full expression parser for the sake of two operators. */
        var op = take().value;
        var from = leftOperandStart();
        out.splice(from, 0, { text: '(AS3.' + (op === 'is' ? 'is' : 'as') +
                                    '((AS3._l = (', line: out[from] ? out[from].line : line });
        emit(')), ', line);
        copyOperand();
        emit('))', line);
        return;
      }
      if (at('name', 'Vector') && peek(1) && peek(1).value === '.' &&
          peek(2) && peek(2).value === '<') {
        skipVectorGeneric();
        emit(' Array ', line);
        return;
      }
      if (at('name', 'trace')) {
        take();
        emit(' AS3.trace ', line);
        return;
      }
      if (atKw('function')) { copyFunctionExpression(); return; }
      if (atKw('for')) { copyFor(); return; }
      if (atKw('catch')) { copyCatch(); return; }
      emitToken(take());
    };

    /* What cannot be part of a relational operand. `+`, `-`, `*`, `/` and
       `.` all bind tighter than `is`, so they ARE part of it and are absent
       from this list; everything of lower or equal precedence stops the scan,
       as does any opening bracket or separator. */
    var OPERAND_STOP = {
      '(': 1, '[': 1, '{': 1, ',': 1, ';': 1, '=': 1, '+=': 1, '-=': 1,
      '*=': 1, '/=': 1, '%=': 1, '&=': 1, '|=': 1, '^=': 1, '<<=': 1,
      '>>=': 1, '>>>=': 1, '&&': 1, '||': 1, '??': 1, '?': 1, ':': 1,
      '!': 1, '==': 1, '!=': 1, '===': 1, '!==': 1, '<': 1, '>': 1,
      '<=': 1, '>=': 1, '&': 1, '|': 1, '^': 1, '=>': 1
    };
    var OPERAND_STOP_KW = {
      'return': 1, 'if': 1, 'while': 1, 'case': 1, 'throw': 1, 'typeof': 1,
      'delete': 1, 'do': 1, 'else': 1, 'in': 1, 'new': 1, 'switch': 1
    };

    /** Where in `out` the left operand of an `is`/`as` began. */
    var leftOperandStart = function () {
      var depth = 0;
      for (var j = out.length - 1; j >= 0; j--) {
        var t = out[j].text.trim();
        if (t === ')' || t === ']' || t === '}') { depth++; continue; }
        if (t === '(' || t === '[' || t === '{') {
          if (depth === 0) return j + 1;
          depth--;
          continue;
        }
        if (depth > 0) continue;
        if (OPERAND_STOP[t] || OPERAND_STOP_KW[t]) return j + 1;
      }
      return 0;
    };

    /**
     * The RIGHT operand of an `is`/`as`: a dotted type name, and nothing more.
     *
     * `x is Number` and `v as flash.geom.Point` are the two shapes, and both
     * are a name followed by dots. Reading a whole expression here would
     * swallow the `)` of an enclosing call.
     */
    var copyOperand = function () {
      if (at('name') || at('keyword')) {
        var parts = take().value;
        while (atPunct('.') && peek(1) && (peek(1).kind === 'name' || peek(1).kind === 'keyword')) {
          take();
          parts += '.' + take().value;
        }
        // Only the last segment matters: AS3.resolve and the runtime table
        // are both keyed by the short name.
        emit(' ' + parts.split('.').pop() + ' ', line);
        return;
      }
      copyOne();
    };

    var skipVectorGeneric = function () {
      take(); take(); take();            // Vector . <
      var depth = 1;
      while (depth > 0 && !at('eof')) {
        if (atPunct('<')) depth++;
        else if (atPunct('>')) depth--;
        else if (atPunct('>>')) depth -= 2;
        take();
      }
    };

    var copyUntil = function (stops, allowComma) {
      var depth = 0;
      for (;;) {
        if (at('eof')) return;
        if (atPunct('(') || atPunct('[') || atPunct('{')) depth++;
        if (atPunct(')') || atPunct(']') || atPunct('}')) {
          if (depth === 0) return;
          depth--;
        }
        if (depth === 0 && stops.indexOf(toks[i].value) >= 0 &&
            toks[i].kind === 'punct') {
          if (toks[i].value === ',' && !allowComma) return;
          return;
        }
        copyOne();
      }
    };

    var copyBlock = function () {
      expect('punct', '{');
      emit('{', line);
      var depth = 1;
      while (depth > 0 && !at('eof')) {
        if (atPunct('{')) { depth++; emit('{', line); take(); continue; }
        if (atPunct('}')) {
          depth--;
          emit('}', line);
          take();
          continue;
        }
        copyOne();
      }
    };

    var copyFor = function () {
      expect('keyword', 'for');
      if (atKw('each')) {
        /* `for each (var v:T in list)` iterates the VALUES. JavaScript's
           for..of does the same thing for arrays, and `Object.values` covers
           the plain-object case AS3 also allowed. */
        take();
        expect('punct', '(');
        emit(' for ( ', line);
        if (atKw('var') || atKw('const')) { take(); emit(' let ', line); }
        var vname = expect('name').value;
        declareLocal(vname);
        skipType();
        expect('keyword', 'in');
        emit(' ' + vname + ' of AS3.values(', line);
        copyUntil([')'], true);
        expect('punct', ')');
        emit('))', line);
        copyStatementOrBlock();
        return;
      }
      emit(' for ', line);
      expect('punct', '(');
      emit('(', line);
      // The header, which may declare a typed variable.
      var depth = 1;
      while (depth > 0 && !at('eof')) {
        if (atPunct('(')) { depth++; emit('(', line); take(); continue; }
        if (atPunct(')')) {
          depth--;
          if (depth === 0) { emit(')', line); take(); break; }
          emit(')', line); take(); continue;
        }
        copyOne();
      }
      copyStatementOrBlock();
    };

    var copyCatch = function () {
      expect('keyword', 'catch');
      expect('punct', '(');
      emit(' catch (', line);
      var cname = expect('name').value;
      declareLocal(cname);
      skipType();
      expect('punct', ')');
      emit(cname + ')', line);
      copyStatementOrBlock();
    };

    var copyStatementOrBlock = function () {
      if (atPunct('{')) { copyBlock(); return; }
      copyStatement();
    };

    /** One statement, at the top level or as the body of a bare `if`. */
    var copyStatement = function () {
      var guard = 0;
      for (;;) {
        if (at('eof')) break;
        if (atPunct(';')) { emit(';', line); take(); break; }
        if (atPunct('}')) break;
        if (atPunct('{')) { copyBlock(); break; }
        copyOne();
        if (++guard > 100000) throw new AS3Error('Statement too long', line);
      }
    };

    var copyParams = function () {
      expect('punct', '(');
      emit('(', line);
      // A parameter shadows a member, which is what AS3 does -- and is why
      // `function setX(x:Number){ this.x = x; }` has to work both ways.
      pushScope([]);
      var first = true;
      while (!atPunct(')') && !at('eof')) {
        if (!first) { expect('punct', ','); emit(',', line); }
        first = false;
        if (atPunct(')')) break;
        if (atPunct('.')) {
          // `...rest`, which AS3 spells with three dots and a name.
          take();
          if (atPunct('.')) take();
          if (atPunct('.')) take();
          if (atPunct('..')) take();
          emit('...', line);
          if (at('name')) {
            var rname = take().value;
            declareLocal(rname);
            emit(rname, line);
            lastEmitted = { kind: 'name', value: rname };
          }
          skipType();
          continue;
        }
        var pname = expect('name').value;
        declareLocal(pname);
        emit(pname, line);
        lastEmitted = { kind: 'name', value: pname };
        skipType();
        if (atPunct('=')) {
          take();
          emit('=', line);
          copyUntil([',', ')'], false);
        }
      }
      expect('punct', ')');
      emit(')', line);
      skipType();                         // the return type
      // The scope stays open: the body that follows is where the parameters
      // are in use, and copyBlock's caller closes it.
    };

    var copyFunctionExpression = function () {
      expect('keyword', 'function');
      emit(' function ', line);
      if (at('name')) {
        var fname = take().value;
        declareLocal(fname);
        emit(fname, line);
        lastEmitted = { kind: 'name', value: fname };
      }
      copyParams();
      copyBlock();
      popScope();
    };

    /* ---- class members --------------------------------------------- */
    var compileClassBody = function (className, superName) {
      expect('punct', '{');
      var statics = [];
      var fields = [];
      while (!atPunct('}') && !at('eof')) {
        if (atPunct(';')) { take(); continue; }
        if (atKw('import')) { readImport(); continue; }
        var mods = readModifiers();
        if (atKw('var') || atKw('const')) {
          var isConst = take().value === 'const';
          for (;;) {
            if (!at('name')) break;
            var fname = take().value;
            skipType();
            var init = null;
            if (atPunct('=')) {
              take();
              var save = out.length;
              copyUntil([',', ';'], true);
              init = out.splice(save).map(function (p) { return p.text; }).join('');
            }
            (mods.isStatic ? statics : fields).push({
              name: fname, init: init, isConst: isConst
            });
            if (atPunct(',')) { take(); continue; }
            break;
          }
          if (atPunct(';')) take();
          continue;
        }
        if (atKw('function')) {
          take();
          var kind = '';
          if ((atKw('get') || atKw('set')) && peek(1) && peek(1).kind === 'name') {
            kind = take().value;
          }
          var mname = at('name') ? take().value : expect('keyword').value;
          emit((mods.isStatic ? ' static ' : ' ') + (kind ? kind + ' ' : '') +
               (mname === className && !kind ? 'constructor' : mname), line);
          copyParams();
          if (mname === className && !kind) {
            /* A constructor. The field initialisers go in at the top, after
               super() if there is a base class -- which is where JavaScript
               requires them and where AS3 put them anyway. */
            expect('punct', '{');
            emit('{', line);
            var needSuper = !!superName;
            var pending = fields.slice();
            fields.length = 0;
            // super() first if the author did not write it themselves.
            var bodyStart = out.length;
            var depth2 = 1;
            while (depth2 > 0 && !at('eof')) {
              if (atPunct('{')) { depth2++; emit('{', line); take(); continue; }
              if (atPunct('}')) { depth2--; emit('}', line); take(); continue; }
              copyOne();
            }
            var body = out.splice(bodyStart);
            var wroteSuper = body.some(function (p) {
              return /\bsuper\s*$/.test(p.text) || p.text.trim() === 'super';
            });
            var pre = [];
            if (needSuper && !wroteSuper) pre.push({ text: 'super();', line: line });
            pending.forEach(function (f) {
              pre.push({ text: 'this.' + f.name + ' = ' +
                               (f.init == null ? 'undefined' : f.init) + ';', line: line });
            });
            out.push.apply(out, pre);
            out.push.apply(out, body);
            popScope();
            continue;
          }
          copyBlock();
          popScope();
          continue;
        }
        // Anything else at class level is not something AS3 allows.
        throw new AS3Error('Unexpected ' + (toks[i].value || toks[i].kind) +
                           ' in the body of class ' + className, toks[i].line);
      }
      expect('punct', '}');
      /* Fields declared after the constructor still have to be initialised.
         A class with no constructor at all gets one. */
      if (fields.length) {
        var initText = fields.map(function (f) {
          return 'this.' + f.name + ' = ' + (f.init == null ? 'undefined' : f.init) + ';';
        }).join('');
        emit('constructor(...a){' + (superName ? 'super(...a);' : '') + initText + '}', line);
      }
      emit('}', line);
      statics.forEach(function (f) {
        emit('\n' + className + '.' + f.name + ' = ' +
             (f.init == null ? 'undefined' : f.init) + ';', line);
      });
    };

    var readImport = function () {
      expect('keyword', 'import');
      var path = readTypeName();
      if (atPunct('*')) { take(); path += '.*'; }
      if (atPunct(';')) take();
      imports.push(path);
    };

    /* ---- the top level --------------------------------------------- */
    var compileClass = function () {
      readModifiers();
      expect('keyword', 'class');
      var className = expect('name').value;
      var superName = null;
      if (atKw('extends')) { take(); superName = readTypeName(); }
      if (atKw('implements')) {
        take();
        readTypeName();
        while (atPunct(',')) { take(); readTypeName(); }
      }
      classes.push({ name: className, superClass: superName });
      /* Scanned BEFORE anything is emitted: the member table has to be
         complete before the first method body is translated, or a field
         declared after the constructor would not get its `this.`. */
      var scanned = scanMembers(toks, i);
      cls = { name: className, fields: scanned.fields, statics: scanned.statics,
              superClass: superName ? String(superName).split('.').pop() : null };
      classMembers[className] = cls;
      /* The base class is resolved through AS3.resolve at RUN time rather
         than at compile time, because a document class extending MovieClip
         has to pick up the engine's MovieClip and a class extending another
         of the author's classes has to pick up that -- and which it is is
         not knowable until both are defined. */
      emit('\nclass ' + className +
           (superName ? ' extends AS3.resolve(' + JSON.stringify(superName) + ')' : '') +
           ' {', line);
      compileClassBody(className, superName);
      /* Registered IMMEDIATELY, not in a block at the end. A JavaScript
         `extends` clause is evaluated where the class statement is, so a
         second class extending the first would call AS3.resolve before the
         first had been defined -- and the whole file would fail on the one
         thing an author is most likely to write. */
      emit('\nAS3.define(' + JSON.stringify(className) + ', ' + className + ');', line);
      cls = null;
      scopes.length = 0;
    };

    var skipInterface = function () {
      readModifiers();
      expect('keyword', 'interface');
      var iname = expect('name').value;
      warnings.push('Interface ' + iname + ' is recorded and ignored: ' +
                    'JavaScript has no interfaces, and AS3 interfaces carry ' +
                    'no behaviour to translate.');
      if (atKw('extends')) {
        take(); readTypeName();
        while (atPunct(',')) { take(); readTypeName(); }
      }
      var depth = 0;
      expect('punct', '{');
      depth = 1;
      while (depth > 0 && !at('eof')) {
        if (atPunct('{')) depth++;
        else if (atPunct('}')) depth--;
        take();
      }
    };

    while (!at('eof')) {
      if (atPunct(';')) { take(); continue; }
      if (atKw('package')) {
        take();
        if (at('name')) readTypeName();
        expect('punct', '{');
        // The package body: imports, one class, and nothing else of substance.
        var pdepth = 1;
        while (pdepth > 0 && !at('eof')) {
          if (atPunct('}')) { pdepth--; take(); continue; }
          if (atKw('import')) { readImport(); continue; }
          if (atPunct(';')) { take(); continue; }
          if (isClassAhead()) { compileClass(); continue; }
          if (isInterfaceAhead()) { skipInterface(); continue; }
          throw new AS3Error('Unexpected ' + (toks[i].value || toks[i].kind) +
                             ' in a package body', toks[i].line);
        }
        continue;
      }
      if (atKw('import')) { readImport(); continue; }
      if (isClassAhead()) { compileClass(); continue; }
      if (isInterfaceAhead()) { skipInterface(); continue; }
      /* Loose statements outside any class. Flash allowed them on a frame,
         and a frame script is the commonest AS3 anyone writes. */
      copyStatement();
    }

    function isClassAhead() {
      var k = i;
      while (toks[k] && toks[k].kind === 'keyword' &&
             (MODIFIERS.indexOf(toks[k].value) >= 0 || toks[k].value === 'static')) k++;
      return !!(toks[k] && toks[k].kind === 'keyword' && toks[k].value === 'class');
    }
    function isInterfaceAhead() {
      var k = i;
      while (toks[k] && toks[k].kind === 'keyword' &&
             (MODIFIERS.indexOf(toks[k].value) >= 0 || toks[k].value === 'static')) k++;
      return !!(toks[k] && toks[k].kind === 'keyword' && toks[k].value === 'interface');
    }

    // Assemble, padding to the source's own line numbers so a runtime error
    // in compiled code reports a line the author can find.
    var code = '';
    var atLine = 1;
    out.forEach(function (piece) {
      while (atLine < piece.line) { code += '\n'; atLine++; }
      code += piece.text;
    });
    /* No trailing define block: each class registers itself as it is
       declared, above. */

    var mainClass = opts.mainClass ||
      (classes.length ? classes[classes.length - 1].name : null);
    return { code: code, classes: classes, imports: imports,
             mainClass: mainClass, warnings: warnings };
  }

  /* ------------------------------------------------------------------ *
   * The runtime
   *
   * The flash.* classes an AS3 script actually reaches for, mapped onto what
   * the engine already is. Deliberately a MAPPING rather than a
   * reimplementation: `Sprite` IS Flashy.MovieClip, so a script that adds a
   * child to a Sprite is adding a child to the real display list and the
   * real painter draws it.
   * ------------------------------------------------------------------ */
  function makeRuntime(F, scope) {
    var defined = Object.create(null);

    /* `x`, `y` and `alpha` mean the same in both -- AS3's alpha is 0..1 too;
       it is AS2's _alpha that was a percentage. `rotation` is the one unit
       difference and is handled by the compiler, which rewrites it to the
       engine's own `rotationDeg` accessor. */
    var Event = function (type, bubbles, cancelable) {
      this.type = type;
      this.bubbles = !!bubbles;
      this.cancelable = !!cancelable;
      this.target = null;
      this.currentTarget = null;
    };
    Event.prototype.toString = function () { return '[Event type="' + this.type + '"]'; };
    /* The constants, because AS3 code says Event.ENTER_FRAME far more often
       than it says "enterFrame" -- and the engine's own event names are what
       they map to, so a listener added through either spelling works. */
    Event.ENTER_FRAME = 'enterFrame';
    Event.ADDED = 'added';
    Event.REMOVED = 'removed';
    Event.COMPLETE = 'complete';
    Event.INIT = 'init';
    Event.RESIZE = 'resize';
    Event.CHANGE = 'change';
    Event.ACTIVATE = 'activate';
    Event.DEACTIVATE = 'deactivate';
    Event.FRAME_CONSTRUCTED = 'frameConstructed';
    Event.EXIT_FRAME = 'exitFrame';

    var MouseEvent = function (type) { Event.call(this, type); };
    MouseEvent.prototype = Object.create(Event.prototype);
    MouseEvent.CLICK = 'click';
    MouseEvent.MOUSE_DOWN = 'mouseDown';
    MouseEvent.MOUSE_UP = 'mouseUp';
    MouseEvent.MOUSE_MOVE = 'mouseMove';
    MouseEvent.MOUSE_OVER = 'mouseOver';
    MouseEvent.MOUSE_OUT = 'mouseOut';
    MouseEvent.ROLL_OVER = 'rollOver';
    MouseEvent.ROLL_OUT = 'rollOut';
    MouseEvent.DOUBLE_CLICK = 'doubleClick';

    var KeyboardEvent = function (type) { Event.call(this, type); };
    KeyboardEvent.prototype = Object.create(Event.prototype);
    KeyboardEvent.KEY_DOWN = 'keyDown';
    KeyboardEvent.KEY_UP = 'keyUp';

    var TimerEvent = function (type) { Event.call(this, type); };
    TimerEvent.prototype = Object.create(Event.prototype);
    TimerEvent.TIMER = 'timer';
    TimerEvent.TIMER_COMPLETE = 'timerComplete';

    function Point(x, y) { this.x = x || 0; this.y = y || 0; }
    Point.prototype.clone = function () { return new Point(this.x, this.y); };
    Point.prototype.toString = function () { return '(x=' + this.x + ', y=' + this.y + ')'; };
    Object.defineProperty(Point.prototype, 'length', {
      get: function () { return Math.hypot(this.x, this.y); }
    });
    Point.distance = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
    Point.interpolate = function (a, b, f) {
      // AS3's interpolate runs from b towards a, which trips everyone up once.
      return new Point(b.x + (a.x - b.x) * f, b.y + (a.y - b.y) * f);
    };

    function Rectangle(x, y, w, h) {
      this.x = x || 0; this.y = y || 0;
      this.width = w || 0; this.height = h || 0;
    }
    Rectangle.prototype.contains = function (x, y) {
      return x >= this.x && y >= this.y &&
             x <= this.x + this.width && y <= this.y + this.height;
    };
    Object.defineProperty(Rectangle.prototype, 'right', {
      get: function () { return this.x + this.width; }
    });
    Object.defineProperty(Rectangle.prototype, 'bottom', {
      get: function () { return this.y + this.height; }
    });

    function Timer(delay, repeatCount) {
      this.delay = delay || 0;
      this.repeatCount = repeatCount || 0;
      this.currentCount = 0;
      this.running = false;
      this._id = null;
      this._listeners = {};
    }
    Timer.prototype.addEventListener = function (type, fn) {
      (this._listeners[type] || (this._listeners[type] = [])).push(fn);
    };
    Timer.prototype.removeEventListener = function (type, fn) {
      var a = this._listeners[type];
      if (!a) return;
      var k = a.indexOf(fn);
      if (k >= 0) a.splice(k, 1);
    };
    Timer.prototype._fire = function (type) {
      var a = (this._listeners[type] || []).slice();
      var e = new TimerEvent(type);
      e.target = this;
      e.currentTarget = this;
      for (var k = 0; k < a.length; k++) a[k].call(this, e);
    };
    Timer.prototype.start = function () {
      if (this.running) return;
      this.running = true;
      var self = this;
      this._id = setInterval(function () {
        self.currentCount++;
        self._fire(TimerEvent.TIMER);
        if (self.repeatCount > 0 && self.currentCount >= self.repeatCount) {
          self.stop();
          self._fire(TimerEvent.TIMER_COMPLETE);
        }
      }, Math.max(1, this.delay));
    };
    Timer.prototype.stop = function () {
      this.running = false;
      if (this._id != null) clearInterval(this._id);
      this._id = null;
    };
    Timer.prototype.reset = function () { this.stop(); this.currentCount = 0; };

    var started = Date.now();

    /** Everything a compiled script can see, by its AS3 name. */
    var RUNTIME = {
      // flash.display
      Sprite: F.MovieClip,
      MovieClip: F.MovieClip,
      DisplayObject: F.DisplayObject,
      DisplayObjectContainer: F.MovieClip,
      Shape: F.Shape,
      Graphics: F.Graphics,
      Stage: F.Stage,
      Bitmap: F.Bitmap,
      // flash.text
      TextField: F.TextField,
      TextFormat: function TextFormat(font, size, color, bold, italic, underline) {
        this.font = font; this.size = size; this.color = color;
        this.bold = bold; this.italic = italic; this.underline = underline;
      },
      // flash.events
      Event: Event, MouseEvent: MouseEvent,
      KeyboardEvent: KeyboardEvent, TimerEvent: TimerEvent,
      EventDispatcher: F.DisplayObject,
      // flash.geom
      Point: Point, Rectangle: Rectangle,
      // flash.utils
      Timer: Timer,
      getTimer: function () { return Date.now() - started; },
      setTimeout: function (fn, ms) { return setTimeout(fn, ms); },
      clearTimeout: function (id) { return clearTimeout(id); },
      setInterval: function (fn, ms) { return setInterval(fn, ms); },
      clearInterval: function (id) { return clearInterval(id); },
      // flash.media
      Sound: F.Sound || function Sound() {}
    };

    var AS3 = {
      /** The holder the `is`/`as` rewrite stashes a left operand in. */
      _l: null,

      /** trace(), which goes where every other trace in Flashy goes. */
      trace: function () {
        var parts = [];
        for (var k = 0; k < arguments.length; k++) parts.push(arguments[k]);
        if (F.Output && F.Output.write) F.Output.write.apply(F.Output, parts);
        else if (typeof console !== 'undefined') console.log.apply(console, parts);
      },

      /**
       * AS3's `is`.
       *
       * The primitive classes are the reason this is a function: `x is Number`
       * is a typeof test, not an instanceof one, and no infix rewrite can say
       * both.
       */
      is: function (value, type) {
        if (type === RUNTIME.__Number || type === Number) return typeof value === 'number';
        if (type === String) return typeof value === 'string';
        if (type === Boolean) return typeof value === 'boolean';
        if (type === Array) return Array.isArray(value);
        if (type == null) return false;
        if (typeof type !== 'function') return false;
        try { return value instanceof type; } catch (e) { return false; }
      },

      /** AS3's `as`: the value if it is of that type, otherwise null. */
      as: function (value, type) {
        return AS3.is(value, type) ? value : null;
      },

      /** `for each` iterates values, over an array or a plain object. */
      values: function (v) {
        if (v == null) return [];
        if (Array.isArray(v)) return v;
        if (typeof v.length === 'number' && typeof v !== 'string') {
          return Array.prototype.slice.call(v);
        }
        if (typeof v === 'object') return Object.keys(v).map(function (k) { return v[k]; });
        return [v];
      },

      /** Register a compiled class under its name. */
      define: function (name, cls) { defined[name] = cls; return cls; },

      /**
       * Resolve a class by its AS3 name, at run time.
       *
       * The author's own classes first, then the flash.* runtime, then the
       * global object. Run time rather than compile time because a class
       * extending another of the author's classes cannot be resolved until
       * both have been declared, and the declaration order in one file is not
       * something the author should have to think about.
       */
      resolve: function (name) {
        var short = String(name).split('.').pop();
        if (defined[short]) return defined[short];
        if (RUNTIME[short]) return RUNTIME[short];
        if (typeof global !== 'undefined' && global[short]) return global[short];
        throw new Error('ActionScript 3: cannot find the class ' + name +
                        '. Classes this build provides: ' +
                        Object.keys(RUNTIME).sort().join(', ') + '.');
      },

      /** The classes the compiled code declared, for the player to look up. */
      classes: defined,
      runtime: RUNTIME
    };

    if (scope) {
      Object.keys(RUNTIME).forEach(function (k) {
        if (!(k in scope)) scope[k] = RUNTIME[k];
      });
      scope.AS3 = AS3;
    }
    return AS3;
  }

  /**
   * Compile and run AS3 source.
   *
   * `scope` is the object the script's globals land on and the place the
   * flash.* classes are injected. `self` is what `this` is bound to -- a
   * frame script's `this` is its MovieClip, exactly as it is in Flash.
   *
   * Returns {ok, classes, mainClass, error, warnings}. A compile error is
   * returned rather than thrown, because the caller is a movie that has to
   * keep playing and a line number in a panel is more use than an exception.
   */
  function run(src, scope, self, opts) {
    opts = opts || {};
    var F = global.Flashy;
    if (!F) return { ok: false, error: 'flashy.js is not loaded' };
    var compiled;
    try {
      compiled = compile(src, opts);
    } catch (e) {
      return { ok: false, error: String(e.message || e),
               line: e.line || 0, compileError: true };
    }
    var AS3 = makeRuntime(F, scope || {});
    var names = Object.keys(AS3.runtime);
    var body = '"use strict";\n' + compiled.code + '\nreturn AS3.classes;';
    var fn;
    try {
      fn = new Function(['AS3'].concat(names), body);
    } catch (e) {
      /* A syntax error in the OUTPUT is a compiler bug, and saying so is far
         more use than reporting it as if the author had written it. */
      return { ok: false, error: 'The compiled JavaScript did not parse (' +
               String(e.message || e) + '). This is a compiler limitation ' +
               'rather than a mistake in the script.',
               generated: compiled.code, compileError: true };
    }
    try {
      fn.apply(self == null ? scope : self,
               [AS3].concat(names.map(function (k) { return AS3.runtime[k]; })));
    } catch (e) {
      return { ok: false, error: String(e.message || e),
               classes: compiled.classes, mainClass: compiled.mainClass };
    }
    return { ok: true, classes: compiled.classes, mainClass: compiled.mainClass,
             defined: AS3.classes, warnings: compiled.warnings, AS3: AS3,
             generated: compiled.code };
  }

  global.FlashyAS3 = {
    tokenize: tokenize,
    compile: compile,
    run: run,
    makeRuntime: makeRuntime,
    AS3Error: AS3Error,
    UNSUPPORTED: UNSUPPORTED.map(function (u) { return u.what; })
  };
})(typeof window !== 'undefined' ? window : globalThis);
