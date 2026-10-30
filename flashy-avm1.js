/* flashy-avm1.js — ActionScript 1/2 bytecode back to source
 *
 * Every SWF that does anything carries its scripting as AVM1 bytecode: a
 * stack machine, one byte per opcode, with the names of things in a constant
 * pool. `stop();` compiles to a single 0x07 byte; `gotoAndPlay(10)` to a
 * GotoFrame and a Play. Nothing about that is readable, and dropping it on
 * import means a timeline that imports with its artwork but without the one
 * line that stopped it looping.
 *
 * So this file turns the bytes back into source. It is a decompiler, not a
 * disassembler: it runs the stack the way the player would, building
 * *expressions* rather than executing them, and emits a statement whenever
 * one completes. `push "x", 5 · setVariable` comes back as `x = 5;` rather
 * than as three lines of stack noise.
 *
 * WHAT IT RECOVERS
 *   - The whole linear opcode set: arithmetic, comparison, string and bit
 *     operators as infix expressions, with parentheses only where precedence
 *     needs them
 *   - Timeline calls (play/stop/gotoAndPlay/gotoAndStop/nextFrame/…),
 *     getURL, trace, startDrag, duplicateMovieClip, …
 *   - Variables, members, array/object literals, properties (`_x`, `_alpha`)
 *   - Function calls, method calls, `new`, and nested function definitions
 *     (both DefineFunction and DefineFunction2, including its register
 *     preloading, so `this` and `_root` read as themselves)
 *   - Control flow, structured: if / else, while, do-while, with, try-catch-
 *     finally. The bytecode only has conditional and unconditional jumps, so
 *     these are recovered by matching the shapes a compiler emits.
 *
 * WHEN IT CANNOT STRUCTURE SOMETHING it says so in a comment and keeps
 * going — a jump it cannot place becomes `/* jump -> 0x1f4 *\/` rather than a
 * thrown error. A frame script that is 90% readable with one honest comment
 * in it is worth more on import than an exception.
 *
 * AS3 (DoABC) is a different machine entirely and is NOT decompiled; the SWF
 * loader records that a script was present and what class it belonged to.
 *
 * Pure: bytes in, text out. No DOM, so it runs in Node and in a test.
 */
(function (global) {
  'use strict';

  // -------------------- action codes --------------------
  var A = {
    End: 0x00,
    NextFrame: 0x04, PreviousFrame: 0x05, Play: 0x06, Stop: 0x07,
    ToggleQuality: 0x08, StopSounds: 0x09,
    Add: 0x0a, Subtract: 0x0b, Multiply: 0x0c, Divide: 0x0d,
    Equals: 0x0e, Less: 0x0f, And: 0x10, Or: 0x11, Not: 0x12,
    StringEquals: 0x13, StringLength: 0x14, StringExtract: 0x15,
    Pop: 0x17, ToInteger: 0x18,
    GetVariable: 0x1c, SetVariable: 0x1d,
    SetTarget2: 0x20, StringAdd: 0x21, GetProperty: 0x22, SetProperty: 0x23,
    CloneSprite: 0x24, RemoveSprite: 0x25, Trace: 0x26,
    StartDrag: 0x27, EndDrag: 0x28, StringLess: 0x29,
    Throw: 0x2a, CastOp: 0x2b, ImplementsOp: 0x2c,
    RandomNumber: 0x30, MBStringLength: 0x31, CharToAscii: 0x32,
    AsciiToChar: 0x33, GetTime: 0x34, MBStringExtract: 0x35,
    MBCharToAscii: 0x36, MBAsciiToChar: 0x37,
    Delete: 0x3a, Delete2: 0x3b, DefineLocal: 0x3c, CallFunction: 0x3d,
    Return: 0x3e, Modulo: 0x3f,
    NewObject: 0x40, DefineLocal2: 0x41, InitArray: 0x42, InitObject: 0x43,
    TypeOf: 0x44, TargetPath: 0x45, Enumerate: 0x46, Add2: 0x47,
    Less2: 0x48, Equals2: 0x49, ToNumber: 0x4a, ToString: 0x4b,
    PushDuplicate: 0x4c, StackSwap: 0x4d, GetMember: 0x4e, SetMember: 0x4f,
    Increment: 0x50, Decrement: 0x51, CallMethod: 0x52, NewMethod: 0x53,
    InstanceOf: 0x54, Enumerate2: 0x55,
    BitAnd: 0x60, BitOr: 0x61, BitXor: 0x62, BitLShift: 0x63,
    BitRShift: 0x64, BitURShift: 0x65, StrictEquals: 0x66, Greater: 0x67,
    StringGreater: 0x68, Extends: 0x69,
    GotoFrame: 0x81, GetURL: 0x83, StoreRegister: 0x87, ConstantPool: 0x88,
    WaitForFrame: 0x8a, SetTarget: 0x8b, GoToLabel: 0x8c, WaitForFrame2: 0x8d,
    DefineFunction2: 0x8e, Try: 0x8f,
    With: 0x94, Push: 0x96, Jump: 0x99, GetURL2: 0x9a, DefineFunction: 0x9b,
    If: 0x9d, Call: 0x9e, GotoFrame2: 0x9f
  };

  /* SetProperty/GetProperty address properties by index, not by name. */
  var PROPS = [
    '_x', '_y', '_xscale', '_yscale', '_currentframe', '_totalframes',
    '_alpha', '_visible', '_width', '_height', '_rotation', '_target',
    '_framesloaded', '_name', '_droptarget', '_url', '_highquality',
    '_focusrect', '_soundbuftime', '_quality', '_xmouse', '_ymouse'
  ];

  /* DefineFunction2 preloads registers with these, in this order, and the
     flags say which. Without the table a decompiled body is full of `r:1`. */
  var PRELOAD = [
    [0x01, 'this'], [0x04, 'arguments'], [0x10, 'super'],
    [0x40, '_root'], [0x80, '_parent'], [0x100, '_global']
  ];

  // -------------------- byte reader --------------------
  function Reader(bytes, start, end) {
    this.b = bytes;
    this.pos = start || 0;
    this.end = end == null ? bytes.length : end;
  }
  Reader.prototype.u8 = function () { return this.b[this.pos++]; };
  Reader.prototype.s8 = function () { var v = this.b[this.pos++]; return v > 127 ? v - 256 : v; };
  Reader.prototype.u16 = function () { var v = this.b[this.pos] | (this.b[this.pos + 1] << 8); this.pos += 2; return v; };
  Reader.prototype.s16 = function () { var v = this.u16(); return v > 32767 ? v - 65536 : v; };
  Reader.prototype.s32 = function () {
    var v = (this.b[this.pos] | (this.b[this.pos + 1] << 8) |
             (this.b[this.pos + 2] << 16) | (this.b[this.pos + 3] << 24));
    this.pos += 4; return v | 0;
  };
  Reader.prototype.f32 = function () {
    var dv = new DataView(new ArrayBuffer(4));
    for (var i = 0; i < 4; i++) dv.setUint8(i, this.b[this.pos + i]);
    this.pos += 4; return dv.getFloat32(0, true);
  };
  /* AVM1 doubles are stored as two little-endian words, high word FIRST.
     Reading them as a plain little-endian f64 gives garbage that still looks
     like a number, which is the worst kind of wrong. */
  Reader.prototype.f64 = function () {
    var dv = new DataView(new ArrayBuffer(8));
    for (var i = 0; i < 4; i++) dv.setUint8(i + 4, this.b[this.pos + i]);
    for (var j = 0; j < 4; j++) dv.setUint8(j, this.b[this.pos + 4 + j]);
    this.pos += 8; return dv.getFloat64(0, true);
  };
  Reader.prototype.string = function () {
    var s = this.pos;
    while (this.pos < this.end && this.b[this.pos] !== 0) this.pos++;
    var out = decodeUTF8(this.b, s, this.pos);
    this.pos++;                       // the terminator
    return out;
  };

  function decodeUTF8(bytes, from, to) {
    var sub = bytes.subarray ? bytes.subarray(from, to) : bytes.slice(from, to);
    if (typeof TextDecoder !== 'undefined') {
      try { return new TextDecoder('utf-8').decode(sub); } catch (e) { /* fall through */ }
    }
    var s = '';
    for (var i = 0; i < sub.length; i++) s += String.fromCharCode(sub[i]);
    return s;
  }

  // -------------------- pass 1: opcodes --------------------
  /**
   * Split an action block into records. Each is
   * `{ at, code, len, next, ... }` where `at` is the offset of the opcode and
   * `next` the offset after it — jumps are relative to `next`, so both are
   * needed to resolve a target.
   */
  function parseActions(bytes, start, end) {
    var r = new Reader(bytes, start || 0, end);
    var out = [];
    while (r.pos < r.end) {
      var at = r.pos;
      var code = r.u8();
      var len = 0;
      if (code >= 0x80) {
        if (r.pos + 2 > r.end) break;
        len = r.u16();
      }
      var body = r.pos;
      var next = body + len;
      if (next > r.end) next = r.end;
      var rec = { at: at, code: code, len: len, next: next };
      var sub = new Reader(bytes, body, next);
      try {
        readOperands(rec, sub, bytes);
      } catch (e) {
        rec.error = e.message;
      }
      out.push(rec);
      r.pos = next;
      if (code === A.End) break;
    }
    return out;
  }

  function readOperands(rec, r, bytes) {
    switch (rec.code) {
    case A.GotoFrame:   rec.frame = r.u16(); break;
    case A.GetURL:      rec.url = r.string(); rec.target = r.string(); break;
    case A.StoreRegister: rec.reg = r.u8(); break;
    case A.ConstantPool: {
      var n = r.u16(); var pool = [];
      for (var i = 0; i < n; i++) pool.push(r.string());
      rec.pool = pool;
      break;
    }
    case A.WaitForFrame: rec.frame = r.u16(); rec.skip = r.u8(); break;
    case A.SetTarget:   rec.target = r.string(); break;
    case A.GoToLabel:   rec.label = r.string(); break;
    case A.WaitForFrame2: rec.skip = r.u8(); break;
    case A.With:        rec.size = r.u16(); rec.bodyStart = rec.next; rec.bodyEnd = rec.next + rec.size; break;
    case A.Jump:        rec.offset = r.s16(); break;
    case A.If:          rec.offset = r.s16(); break;
    case A.GetURL2:     rec.method = r.u8(); break;
    case A.GotoFrame2: {
      var flags = r.u8();
      rec.play = !!(flags & 1);
      if (flags & 2) rec.bias = r.u16();
      break;
    }
    case A.Push:        rec.values = readPushValues(r); break;
    case A.DefineFunction: {
      rec.name = r.string();
      var np = r.u16(); var params = [];
      for (var p = 0; p < np; p++) params.push(r.string());
      rec.params = params;
      rec.size = r.u16();
      rec.bodyStart = rec.next;
      rec.bodyEnd = rec.next + rec.size;
      break;
    }
    case A.DefineFunction2: {
      rec.name = r.string();
      var np2 = r.u16();
      rec.registerCount = r.u8();
      var flags2 = r.u16();
      rec.flags = flags2;
      var params2 = [], regs = {};
      for (var q = 0; q < np2; q++) {
        var reg = r.u8(); var pname = r.string();
        params2.push(pname);
        if (reg) regs[reg] = pname;
      }
      rec.params = params2;
      /* Preloaded registers are assigned in flag order starting at r:1, and
         only the ones whose flag is set take a slot. */
      var slot = 1;
      for (var k = 0; k < PRELOAD.length; k++) {
        if (flags2 & PRELOAD[k][0]) { regs[slot] = PRELOAD[k][1]; slot++; }
      }
      /* Named parameters bound to registers sit after the preloads. */
      rec.registers = regs;
      rec.size = r.u16();
      rec.bodyStart = rec.next;
      rec.bodyEnd = rec.next + rec.size;
      break;
    }
    case A.Try: {
      var tf = r.u8();
      rec.catches = !!(tf & 1);
      rec.finallys = !!(tf & 2);
      rec.catchInRegister = !!(tf & 4);
      var trySize = r.u16(), catchSize = r.u16(), finallySize = r.u16();
      if (rec.catchInRegister) rec.catchRegister = r.u8();
      else rec.catchName = r.string();
      rec.tryStart = r.pos;
      rec.tryEnd = rec.tryStart + trySize;
      rec.catchStart = rec.tryEnd;
      rec.catchEnd = rec.catchStart + catchSize;
      rec.finallyStart = rec.catchEnd;
      rec.finallyEnd = rec.finallyStart + finallySize;
      rec.bodyEnd = rec.finallyEnd;
      break;
    }
    default: break;
    }
    if (bytes) { /* reader is bounded already */ }
  }

  function readPushValues(r) {
    var vals = [];
    while (r.pos < r.end) {
      var t = r.u8();
      switch (t) {
      case 0: vals.push({ k: 'string', v: r.string() }); break;
      case 1: vals.push({ k: 'number', v: r.f32() }); break;
      case 2: vals.push({ k: 'null' }); break;
      case 3: vals.push({ k: 'undefined' }); break;
      case 4: vals.push({ k: 'register', v: r.u8() }); break;
      case 5: vals.push({ k: 'boolean', v: !!r.u8() }); break;
      case 6: vals.push({ k: 'number', v: r.f64() }); break;
      case 7: vals.push({ k: 'number', v: r.s32() }); break;
      case 8: vals.push({ k: 'constant', v: r.u8() }); break;
      case 9: vals.push({ k: 'constant', v: r.u16() }); break;
      default: return vals;            // unknown type — stop rather than drift
      }
    }
    return vals;
  }

  // -------------------- expressions --------------------
  /* Precedence only has to be good enough to parenthesise correctly; these
     are JavaScript's, which ActionScript 1 shares. */
  var P = {
    primary: 20, member: 18, call: 17, unary: 15, mul: 14, add: 13,
    shift: 12, rel: 11, eq: 10, bitand: 9, bitxor: 8, bitor: 7,
    and: 6, or: 5, assign: 3, comma: 1, lowest: 0
  };

  function Expr(text, prec, kind) {
    this.text = text;
    this.prec = prec == null ? P.primary : prec;
    this.kind = kind || '';
  }
  Expr.prototype.toString = function () { return this.text; };
  function wrap(e, min) { return e.prec < min ? '(' + e.text + ')' : e.text; }

  function quote(s) {
    return '"' + String(s)
      .replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      .replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
  }

  function numText(n) {
    if (!isFinite(n)) return String(n);
    if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    return String(Math.round(n * 1e6) / 1e6);
  }

  var IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

  /** `obj` + a member name → `obj.name` when the name is a plain identifier. */
  function member(obj, name) {
    if (name.kind === 'stringLiteral' && IDENT.test(name.raw)) {
      return new Expr(wrap(obj, P.member) + '.' + name.raw, P.member);
    }
    return new Expr(wrap(obj, P.member) + '[' + name.text + ']', P.member);
  }

  /** Negate a condition without stacking `!!`. */
  function negate(e) {
    var t = e.text;
    var flips = { '==': '!=', '!=': '==', '===': '!==', '!==': '===' };
    if (e.kind === 'cmp' && flips[e.op]) {
      var inv = new Expr(e.left + ' ' + flips[e.op] + ' ' + e.right, P.eq, 'cmp');
      inv.op = flips[e.op]; inv.left = e.left; inv.right = e.right;
      return inv;
    }
    if (e.kind === 'not') return e.inner;
    var n = new Expr('!' + wrap(e, P.unary), P.unary, 'not');
    n.inner = e;
    if (t === 'true') return new Expr('false', P.primary);
    if (t === 'false') return new Expr('true', P.primary);
    return n;
  }

  function binary(op, a, b, prec, kind) {
    var e = new Expr(wrap(a, prec) + ' ' + op + ' ' + wrap(b, prec + 1), prec, kind || 'bin');
    e.op = op; e.left = wrap(a, prec); e.right = wrap(b, prec + 1);
    return e;
  }

  // -------------------- pass 2: structure --------------------
  /**
   * Decompile one action block to source text.
   *
   * `opts.indent` is the leading indent for every emitted line, `opts.pool`
   * seeds the constant pool (a DefineFunction body inherits its parent's),
   * `opts.registers` names preloaded registers.
   */
  function decompileActions(bytes, start, end, opts) {
    opts = opts || {};
    var list = parseActions(bytes, start, end);
    var ctx = {
      bytes: bytes,
      pool: opts.pool || [],
      registers: opts.registers || {},
      warnings: opts.warnings || [],
      depth: opts.depth || 0
    };
    var lines = [];
    emitRange(list, 0, list.length, ctx, lines, opts.indent || '');
    return { lines: lines, source: lines.join('\n'), pool: ctx.pool, warnings: ctx.warnings };
  }

  /** Index of the record at byte offset `off`, or -1. */
  function indexAt(list, off) {
    for (var i = 0; i < list.length; i++) if (list[i].at === off) return i;
    return -1;
  }

  /**
   * As indexAt, but a jump to the first byte past the end of this range
   * resolves to the end of the range rather than to nothing.
   *
   * A compiler ends an `if` whose body runs to the end of a function by
   * jumping to where the function stops — an offset no record starts at. Left
   * unresolved, the whole body degrades to a comment, which is where most of
   * the unreadable output came from.
   */
  function indexAtOrEnd(list, off, from, to) {
    var hit = indexAt(list, off);
    if (hit >= 0) return hit;
    var lastEnd = to > from ? list[to - 1].next : -1;
    return off >= lastEnd && lastEnd >= 0 ? to : -1;
  }

  function emitRange(list, from, to, ctx, lines, indent) {
    var st = [];                        // the value stack, of Expr
    var i = from;
    var pendingPool = null;             // deferred: see ConstantPool below
    /* Where each record's output starts, so a loop discovered at its closing
       jump can take back the lines of its own body and re-emit them indented
       inside a `do { … } while`. */
    var marks = {};

    function push(e) { st.push(e); }
    function pop() {
      if (!st.length) return new Expr('undefined', P.primary);
      return st.pop();
    }
    function popArgs(n) {
      var a = [];
      for (var k = 0; k < n; k++) a.unshift(pop().text);
      return a;
    }
    /** Pop a count off the stack and then that many arguments. */
    function popCountedArgs() {
      var cnt = pop();
      var n = parseInt(cnt.text, 10);
      if (!isFinite(n) || n < 0 || n > 512) n = 0;
      return popArgs(n);
    }
    function out(text) { lines.push(indent + text); }
    /** A call expression that nothing consumes is a statement. */
    function flushCall(e) {
      if (e && e.kind === 'call') { out(e.text + ';'); return true; }
      return false;
    }

    while (i < to) {
      var a = list[i];
      var code = a.code;
      marks[i] = lines.length;

      // ---- control flow, handled before the stack machine ----
      if (code === A.If) {
        var tIdx = indexAtOrEnd(list, a.next + a.offset, from, to);
        var cond = pop();
        if (tIdx > i && tIdx <= to) {
          /* `while (c) { … }` with the test at the TOP: the body ends with an
             unconditional jump back to the test, and this conditional jump is
             the way out. Without this the loop reads as an `if` with a
             dangling "loops back" comment at the end of it. */
          var tail = list[tIdx - 1];
          if (tail && tail.code === A.Jump && tail.offset < 0) {
            var backIdx = indexAt(list, tail.next + tail.offset);
            if (backIdx >= from && backIdx <= i) {
              out('while (' + negate(cond).text + ') {');
              emitRange(list, i + 1, tIdx - 1, ctx, lines, indent + '  ');
              out('}');
              i = tIdx;
              continue;
            }
          }
          /* `if (c) { … }` compiles to the *negated* test jumping over the
             body, so the source condition is the negation of what we hold. */
          var bodyEnd = tIdx;
          var elseEnd = -1;
          var last = list[bodyEnd - 1];
          if (last && last.code === A.Jump && last.offset > 0) {
            var eIdx = indexAtOrEnd(list, last.next + last.offset, from, to);
            if (eIdx > bodyEnd && eIdx <= to) { elseEnd = eIdx; bodyEnd = bodyEnd - 1; }
          }
          out('if (' + negate(cond).text + ') {');
          emitRange(list, i + 1, bodyEnd, ctx, lines, indent + '  ');
          if (elseEnd > 0) {
            out('} else {');
            emitRange(list, tIdx, elseEnd, ctx, lines, indent + '  ');
            out('}');
            i = elseEnd;
          } else {
            out('}');
            i = tIdx;
          }
          continue;
        }
        if (tIdx >= from && tIdx <= i && marks[tIdx] != null) {
          /* A backward conditional jump is the bottom of a do-while. The
             body has already been emitted, so take those lines back and
             re-emit them inside the loop — which is the difference between
             source you can read and a comment saying where a jump went. */
          var body = lines.splice(marks[tIdx]);
          out('do {');
          for (var bi = 0; bi < body.length; bi++) lines.push('  ' + body[bi]);
          out('} while (' + cond.text + ');');
          i++;
          continue;
        }
        if (tIdx >= from && tIdx <= i) {
          out('// loop: repeats from here while (' + cond.text + ')');
          i++;
          continue;
        }
        out('/* if (' + cond.text + ') jump -> 0x' + (a.next + a.offset).toString(16) + ' */');
        i++;
        continue;
      }

      if (code === A.Jump) {
        var jIdx = indexAt(list, a.next + a.offset);
        if (a.offset > 0 && jIdx > i && jIdx <= to) {
          /* `while (c) { … }` compiles to: jump to the test · body · test ·
             conditional jump back to the body. So the target of this jump is
             where the test starts, the records up to the If are the test,
             and the body is everything in between. Anything else forward is
             a break out of a construct we did not recognise. */
          var k = jIdx;
          while (k < to && VALUE_ONLY[list[k].code]) k++;
          var test = list[k];
          if (test && test.code === A.If &&
              indexAt(list, test.next + test.offset) === i + 1) {
            out('while (' + conditionOf(list, jIdx, k, ctx) + ') {');
            emitRange(list, i + 1, jIdx, ctx, lines, indent + '  ');
            out('}');
            i = k + 1;
            continue;
          }
          if (jIdx === to) { i = to; continue; }   // jump to the end: just stop
          out('/* jump -> 0x' + (a.next + a.offset).toString(16) + ' */');
          i++;
          continue;
        }
        if (a.offset <= 0) {
          out('// loops back to 0x' + (a.next + a.offset).toString(16));
          i++;
          continue;
        }
        i++;
        continue;
      }

      if (code === A.With) {
        var obj = pop();
        out('with (' + obj.text + ') {');
        var sub = decompileActions(ctx.bytes, a.bodyStart, a.bodyEnd,
          { indent: indent + '  ', pool: ctx.pool, registers: ctx.registers, warnings: ctx.warnings, depth: ctx.depth + 1 });
        for (var wl = 0; wl < sub.lines.length; wl++) lines.push(sub.lines[wl]);
        out('}');
        /* The `with` body is bytes, not records in this list, so skip any
           records that fell inside it. */
        i++;
        while (i < to && list[i].at < a.bodyEnd) i++;
        continue;
      }

      if (code === A.Try) {
        out('try {');
        emitSub(a.tryStart, a.tryEnd);
        if (a.catches) {
          var cname = a.catchInRegister ? regName(ctx, a.catchRegister) : a.catchName;
          out('} catch (' + (cname || 'e') + ') {');
          emitSub(a.catchStart, a.catchEnd);
        }
        if (a.finallys) {
          out('} finally {');
          emitSub(a.finallyStart, a.finallyEnd);
        }
        out('}');
        i++;
        while (i < to && list[i].at < a.bodyEnd) i++;
        continue;
      }

      /* `a && b` and `a || b` compile to a duplicate, a test that jumps
         over the right-hand side, and a pop — not to an operator. Without
         this they come out as an unplaceable jump and a stray value. */
      if (code === A.PushDuplicate) {
        var k2 = i + 1;
        var negated = false;
        if (list[k2] && list[k2].code === A.Not) { negated = true; k2++; }
        var test2 = list[k2];
        if (test2 && test2.code === A.If && list[k2 + 1] && list[k2 + 1].code === A.Pop) {
          var join = indexAt(list, test2.next + test2.offset);
          if (join > k2 + 1 && join <= to) {
            var left = pop();
            var right = conditionOf(list, k2 + 2, join, ctx) || 'undefined';
            var op = negated ? '&&' : '||';
            var prec = negated ? P.and : P.or;
            push(new Expr(wrap(left, prec) + ' ' + op + ' ' + right, prec, 'bin'));
            i = join;
            continue;
          }
        }
      }

      // ---- the stack machine ----
      switch (code) {
      case A.End: i = to; continue;

      /* Sentinel used by runForValue(): emit whatever is on top of the stack
         as a statement, so a `while` header can be read back out of it. */
      case -1: out(pop().text + ';'); break;

      case A.ConstantPool:
        ctx.pool = a.pool;
        pendingPool = a.pool;
        break;

      case A.Push:
        for (var v = 0; v < a.values.length; v++) push(pushValue(a.values[v], ctx));
        break;

      case A.Pop: {
        var top = pop();
        if (!flushCall(top) && top.kind === 'incdec') out(top.text + ';');
        break;
      }

      case A.PushDuplicate: { var d = pop(); push(d); push(d); break; }
      case A.StackSwap: { var s1 = pop(), s2 = pop(); push(s1); push(s2); break; }
      case A.StoreRegister: {
        var val = st.length ? st[st.length - 1] : new Expr('undefined', P.primary);
        ctx.registers[a.reg] = ctx.registers[a.reg] || ('r' + a.reg);
        out(ctx.registers[a.reg] + ' = ' + val.text + ';');
        break;
      }

      case A.Play: out('play();'); break;
      case A.Stop: out('stop();'); break;
      case A.NextFrame: out('nextFrame();'); break;
      case A.PreviousFrame: out('prevFrame();'); break;
      case A.StopSounds: out('stopAllSounds();'); break;
      case A.ToggleQuality: out('toggleHighQuality();'); break;

      case A.GotoFrame: {
        /* GotoFrame is 0-based and leaves the play state alone; the compiler
           emits a Play after it for gotoAndPlay. Fold the pair back. */
        var nxt = list[i + 1];
        if (nxt && nxt.code === A.Play) { out('gotoAndPlay(' + (a.frame + 1) + ');'); i += 2; continue; }
        if (nxt && nxt.code === A.Stop) { out('gotoAndStop(' + (a.frame + 1) + ');'); i += 2; continue; }
        out('gotoAndStop(' + (a.frame + 1) + ');');
        break;
      }
      case A.GoToLabel: {
        var nxt2 = list[i + 1];
        if (nxt2 && nxt2.code === A.Play) { out('gotoAndPlay(' + quote(a.label) + ');'); i += 2; continue; }
        out('gotoAndStop(' + quote(a.label) + ');');
        break;
      }
      case A.GotoFrame2: {
        var f = pop();
        var fTxt = /^[0-9]+$/.test(f.text) ? String(parseInt(f.text, 10) + (a.bias || 0)) : f.text;
        out((a.play ? 'gotoAndPlay(' : 'gotoAndStop(') + fTxt + ');');
        break;
      }
      case A.WaitForFrame:
        out('ifFrameLoaded(' + (a.frame + 1) + ') { /* ' + a.skip + ' actions */ }');
        break;
      case A.WaitForFrame2:
        out('ifFrameLoaded(' + pop().text + ') { /* ' + a.skip + ' actions */ }');
        break;

      case A.Trace: out('trace(' + pop().text + ');'); break;

      case A.GetURL: out('getURL(' + quote(a.url) + ', ' + quote(a.target) + ');'); break;
      case A.GetURL2: {
        var tgt = pop(), url = pop();
        var verb = (a.method & 0x40) ? 'loadVariables' : (a.method & 0x80) ? 'loadMovie' : 'getURL';
        var how = (a.method & 0x03) === 1 ? ', "GET"' : (a.method & 0x03) === 2 ? ', "POST"' : '';
        out(verb + '(' + url.text + ', ' + tgt.text + how + ');');
        break;
      }

      case A.SetTarget: out('setTarget(' + quote(a.target) + ');'); break;
      case A.SetTarget2: out('setTarget(' + pop().text + ');'); break;

      case A.GetVariable: {
        var nameE = pop();
        if (nameE.kind === 'stringLiteral' && /^[A-Za-z_$][A-Za-z0-9_$.:/]*$/.test(nameE.raw)) {
          push(new Expr(nameE.raw, P.primary, 'var'));
        } else {
          push(new Expr('eval(' + nameE.text + ')', P.call));
        }
        break;
      }
      case A.SetVariable: {
        var sv = pop(), sn = pop();
        var lhs = (sn.kind === 'stringLiteral') ? sn.raw : 'eval(' + sn.text + ')';
        out(lhs + ' = ' + sv.text + ';');
        break;
      }
      case A.DefineLocal: { var dv = pop(), dn = pop(); out('var ' + nameText(dn) + ' = ' + dv.text + ';'); break; }
      case A.DefineLocal2: { out('var ' + nameText(pop()) + ';'); break; }

      case A.GetMember: { var mn = pop(), mo = pop(); push(member(mo, mn)); break; }
      case A.SetMember: {
        var mv = pop(), mmn = pop(), mmo = pop();
        out(member(mmo, mmn).text + ' = ' + mv.text + ';');
        break;
      }
      case A.Delete: { var dmn = pop(), dmo = pop(); out('delete ' + member(dmo, dmn).text + ';'); break; }
      case A.Delete2: { out('delete ' + nameText(pop()) + ';'); break; }

      case A.GetProperty: {
        var pi = pop(), pt = pop();
        push(new Expr(propAccess(pt, pi), P.member));
        break;
      }
      case A.SetProperty: {
        var pv = pop(), ppi = pop(), ppt = pop();
        out(propAccess(ppt, ppi) + ' = ' + pv.text + ';');
        break;
      }

      case A.CallFunction: {
        var fn = pop();
        var args = popCountedArgs();
        var fname = (fn.kind === 'stringLiteral') ? fn.raw : fn.text;
        push(new Expr(fname + '(' + args.join(', ') + ')', P.call, 'call'));
        break;
      }
      case A.CallMethod: {
        var mName = pop(), mObj = pop();
        var margs = popCountedArgs();
        var callee;
        if (mName.kind === 'stringLiteral' && mName.raw === '') callee = wrap(mObj, P.member);
        else if (mName.kind === 'undefined') callee = wrap(mObj, P.member);
        else callee = member(mObj, mName).text;
        push(new Expr(callee + '(' + margs.join(', ') + ')', P.call, 'call'));
        break;
      }
      case A.NewObject: {
        var ctor = pop();
        var cargs = popCountedArgs();
        var cname2 = (ctor.kind === 'stringLiteral') ? ctor.raw : ctor.text;
        push(new Expr('new ' + cname2 + '(' + cargs.join(', ') + ')', P.call));
        break;
      }
      case A.NewMethod: {
        var nmName = pop(), nmObj = pop();
        var nargs = popCountedArgs();
        var target = (nmName.kind === 'stringLiteral' && nmName.raw === '')
          ? wrap(nmObj, P.member) : member(nmObj, nmName).text;
        push(new Expr('new ' + target + '(' + nargs.join(', ') + ')', P.call));
        break;
      }
      case A.Call: out('call(' + pop().text + ');'); break;

      case A.InitArray: {
        var iargs = popCountedArgs();
        push(new Expr('[' + iargs.join(', ') + ']', P.primary));
        break;
      }
      case A.InitObject: {
        var cntE = pop();
        var cnt2 = parseInt(cntE.text, 10); if (!isFinite(cnt2) || cnt2 < 0 || cnt2 > 512) cnt2 = 0;
        var pairs = [];
        for (var pz = 0; pz < cnt2; pz++) {
          var pval = pop(), pkey = pop();
          pairs.unshift((pkey.kind === 'stringLiteral' && IDENT.test(pkey.raw) ? pkey.raw : pkey.text) + ': ' + pval.text);
        }
        push(new Expr('{' + pairs.join(', ') + '}', P.primary));
        break;
      }

      case A.Return: out('return ' + pop().text + ';'); break;
      case A.Throw: out('throw ' + pop().text + ';'); break;

      case A.DefineFunction:
      case A.DefineFunction2: {
        var body = decompileActions(ctx.bytes, a.bodyStart, a.bodyEnd, {
          indent: indent + '  ',
          pool: ctx.pool,
          registers: code === A.DefineFunction2 ? shallow(a.registers) : {},
          warnings: ctx.warnings,
          depth: ctx.depth + 1
        });
        var head = 'function ' + (a.name || '') + '(' + a.params.join(', ') + ') {';
        if (a.name) {
          out(head);
          for (var bl = 0; bl < body.lines.length; bl++) lines.push(body.lines[bl]);
          out('}');
        } else {
          /* An anonymous function is a value: keep it on the stack so the
             assignment that consumes it reads as one statement. */
          var txt = 'function (' + a.params.join(', ') + ') {\n' +
                    body.lines.join('\n') + '\n' + indent + '}';
          push(new Expr(txt, P.primary, 'function'));
        }
        /* Skip records that live inside the function body. */
        i++;
        while (i < to && list[i].at < a.bodyEnd) i++;
        continue;
      }

      case A.Enumerate:
      case A.Enumerate2: {
        var src = pop();
        out('// for (var k in ' + src.text + ') — enumeration follows');
        push(new Expr('null', P.primary));
        break;
      }

      case A.Extends: { var sup = pop(), sub2 = pop(); out(sub2.text + '.prototype = new ' + sup.text + '();'); break; }
      case A.ImplementsOp: { var iface = popCountedArgs(); out('// implements ' + iface.join(', ')); break; }
      case A.CastOp: { var cObj = pop(), cCls = pop(); push(new Expr(cCls.text + '(' + cObj.text + ')', P.call)); break; }
      case A.InstanceOf: { var ioB = pop(), ioA = pop(); push(binary('instanceof', ioA, ioB, P.rel)); break; }
      case A.TypeOf: push(new Expr('typeof ' + wrap(pop(), P.unary), P.unary)); break;
      case A.TargetPath: push(new Expr('targetPath(' + pop().text + ')', P.call)); break;

      case A.CloneSprite: {
        var cDepth = pop(), cNew = pop(), cSrc = pop();
        out('duplicateMovieClip(' + cSrc.text + ', ' + cNew.text + ', ' + cDepth.text + ');');
        break;
      }
      case A.RemoveSprite: out('removeMovieClip(' + pop().text + ');'); break;
      case A.StartDrag: {
        var lock = pop(), constrain = pop();
        var bounds = [];
        if (/^(1|true)$/.test(constrain.text)) { var y2 = pop(), x2 = pop(), y1 = pop(), x1 = pop(); bounds = [x1.text, y1.text, x2.text, y2.text]; }
        var dTarget = pop();
        out('startDrag(' + [dTarget.text, lock.text].concat(bounds).join(', ') + ');');
        break;
      }
      case A.EndDrag: out('stopDrag();'); break;

      case A.RandomNumber: push(new Expr('random(' + pop().text + ')', P.call)); break;
      case A.GetTime: push(new Expr('getTimer()', P.call)); break;
      case A.StringLength: push(new Expr('length(' + pop().text + ')', P.call)); break;
      case A.MBStringLength: push(new Expr('mblength(' + pop().text + ')', P.call)); break;
      case A.CharToAscii: push(new Expr('ord(' + pop().text + ')', P.call)); break;
      case A.AsciiToChar: push(new Expr('chr(' + pop().text + ')', P.call)); break;
      case A.MBCharToAscii: push(new Expr('mbord(' + pop().text + ')', P.call)); break;
      case A.MBAsciiToChar: push(new Expr('mbchr(' + pop().text + ')', P.call)); break;
      case A.StringExtract: case A.MBStringExtract: {
        var sCount = pop(), sIdx = pop(), sStr = pop();
        push(new Expr('substring(' + sStr.text + ', ' + sIdx.text + ', ' + sCount.text + ')', P.call));
        break;
      }
      case A.ToNumber: push(new Expr('Number(' + pop().text + ')', P.call)); break;
      case A.ToString: push(new Expr('String(' + pop().text + ')', P.call)); break;
      case A.ToInteger: push(new Expr('int(' + pop().text + ')', P.call)); break;

      case A.Increment: { var iv = pop(); push(binary('+', iv, new Expr('1', P.primary), P.add)); break; }
      case A.Decrement: { var dv2 = pop(); push(binary('-', dv2, new Expr('1', P.primary), P.add)); break; }

      case A.Not: push(negate(pop())); break;

      default: {
        var bin = binaryFor(code);
        if (bin) {
          var rb = pop(), lb = pop();
          push(binary(bin[0], lb, rb, bin[1], bin[2]));
        } else if (code !== A.End) {
          out('// unhandled action 0x' + code.toString(16));
          ctx.warnings.push('unhandled action 0x' + code.toString(16) + ' at 0x' + a.at.toString(16));
        }
        break;
      }
      }
      i++;
    }

    /* Anything left on the stack was a value nothing consumed — usually a
       call whose result was discarded by an End we folded away. */
    for (var leftover = 0; leftover < st.length; leftover++) {
      if (st[leftover].kind === 'call') lines.push(indent + st[leftover].text + ';');
    }
    void pendingPool;
    return lines;

    function emitSub(s, e) {
      var r2 = decompileActions(ctx.bytes, s, e, {
        indent: indent + '  ', pool: ctx.pool, registers: ctx.registers,
        warnings: ctx.warnings, depth: ctx.depth + 1
      });
      for (var z = 0; z < r2.lines.length; z++) lines.push(r2.lines[z]);
    }

    function nameText(e) { return e.kind === 'stringLiteral' ? e.raw : e.text; }

    function propAccess(target, index) {
      var idx = parseInt(index.text, 10);
      var pname = (isFinite(idx) && PROPS[idx]) ? PROPS[idx] : null;
      var base = (target.kind === 'stringLiteral')
        ? (target.raw === '' ? '' : target.raw)
        : target.text;
      if (!pname) return (base ? base + '[' : 'this[') + index.text + ']';
      return base ? base + '.' + pname : pname;
    }
  }

  /**
   * Re-read the expression a conditional jump tests, for a `while` header.
   *
   * The records between the previous branch and the `If` are exactly the
   * pushes and operators that build the condition, so replaying them with a
   * sentinel on the end hands the finished expression back as text. The test
   * jumps back into the body when it passes, so the source condition is the
   * test as written — unlike the `if` case, which is negated.
   */
  function conditionOf(list, from, to, ctx) {
    return runForValue(list.slice(from, to), ctx) || 'true';
  }

  /* Opcodes that only produce a value — never a statement. Walking back over
     a run of these from a conditional jump recovers the test it is reading,
     and so also tells a loop where its body stopped. */
  var VALUE_ONLY = {};
  (function () {
    var codes = [A.Push, A.GetVariable, A.GetMember, A.GetProperty, A.Not,
      A.PushDuplicate, A.StackSwap, A.ToNumber, A.ToString, A.ToInteger,
      A.Increment, A.Decrement, A.TypeOf, A.RandomNumber, A.GetTime,
      A.StringLength, A.MBStringLength, A.CharToAscii, A.AsciiToChar,
      A.Add, A.Add2, A.Subtract, A.Multiply, A.Divide, A.Modulo, A.StringAdd,
      A.Equals, A.Equals2, A.StrictEquals, A.StringEquals, A.Less, A.Less2,
      A.StringLess, A.Greater, A.StringGreater, A.And, A.Or, A.BitAnd,
      A.BitOr, A.BitXor, A.BitLShift, A.BitRShift, A.BitURShift,
      A.CallFunction, A.CallMethod, A.InstanceOf];
    for (var i = 0; i < codes.length; i++) VALUE_ONLY[codes[i]] = true;
  })();


  /** Replay a straight-line record list and return its final expression. */
  function runForValue(records, ctx) {
    var fake = records.slice();
    fake.push({ at: -1, code: -1, len: 0, next: -1 });
    var collected = [];
    emitRange(fake, 0, fake.length, {
      bytes: ctx.bytes, pool: ctx.pool, registers: ctx.registers,
      warnings: ctx.warnings || [], depth: ctx.depth || 0
    }, collected, '');
    for (var i = collected.length - 1; i >= 0; i--) {
      var t = collected[i].trim();
      if (t && t.charAt(t.length - 1) === ';') return t.slice(0, -1);
    }
    return null;
  }

  function shallow(o) { var c = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = o[k]; return c; }

  function regName(ctx, n) { return ctx.registers[n] || ('r' + n); }

  function pushValue(v, ctx) {
    switch (v.k) {
    case 'string': { var e = new Expr(quote(v.v), P.primary, 'stringLiteral'); e.raw = v.v; return e; }
    case 'number': return new Expr(numText(v.v), P.primary);
    case 'null': return new Expr('null', P.primary);
    case 'undefined': return new Expr('undefined', P.primary, 'undefined');
    case 'boolean': return new Expr(v.v ? 'true' : 'false', P.primary);
    case 'register': return new Expr(regName(ctx, v.v), P.primary, 'register');
    case 'constant': {
      var s = ctx.pool[v.v];
      if (s == null) return new Expr('undefined', P.primary);
      var ce = new Expr(quote(s), P.primary, 'stringLiteral');
      ce.raw = s;
      return ce;
    }
    default: return new Expr('undefined', P.primary);
    }
  }

  /* op code → [source operator, precedence, kind]. `cmp` kinds can be
     inverted cleanly by negate(). */
  function binaryFor(code) {
    switch (code) {
    case A.Add: case A.Add2: return ['+', P.add];
    case A.Subtract: return ['-', P.add];
    case A.Multiply: return ['*', P.mul];
    case A.Divide: return ['/', P.mul];
    case A.Modulo: return ['%', P.mul];
    case A.StringAdd: return ['+', P.add];
    case A.Equals: case A.Equals2: return ['==', P.eq, 'cmp'];
    case A.StrictEquals: return ['===', P.eq, 'cmp'];
    case A.StringEquals: return ['==', P.eq, 'cmp'];
    case A.Less: case A.Less2: case A.StringLess: return ['<', P.rel, 'cmp'];
    case A.Greater: case A.StringGreater: return ['>', P.rel, 'cmp'];
    case A.And: return ['&&', P.and];
    case A.Or: return ['||', P.or];
    case A.BitAnd: return ['&', P.bitand];
    case A.BitOr: return ['|', P.bitor];
    case A.BitXor: return ['^', P.bitxor];
    case A.BitLShift: return ['<<', P.shift];
    case A.BitRShift: return ['>>', P.shift];
    case A.BitURShift: return ['>>>', P.shift];
    default: return null;
    }
  }

  // -------------------- clip / button event names --------------------
  /* PlaceObject2 clip actions and DefineButton2 conditions are bit fields.
     Naming them is what turns a blob of handlers into `onClipEvent(load)`. */
  var CLIP_EVENTS = [
    [0x00000001, 'load'], [0x00000002, 'enterFrame'], [0x00000004, 'unload'],
    [0x00000008, 'mouseMove'], [0x00000010, 'mouseDown'], [0x00000020, 'mouseUp'],
    [0x00000040, 'keyDown'], [0x00000080, 'keyUp'], [0x00000100, 'data'],
    [0x00000200, 'initialize'], [0x00000400, 'press'], [0x00000800, 'release'],
    [0x00001000, 'releaseOutside'], [0x00002000, 'rollOver'], [0x00004000, 'rollOut'],
    [0x00008000, 'dragOver'], [0x00010000, 'dragOut'], [0x00020000, 'keyPress'],
    [0x00040000, 'construct']
  ];

  function clipEventNames(flags) {
    var names = [];
    for (var i = 0; i < CLIP_EVENTS.length; i++) {
      if (flags & CLIP_EVENTS[i][0]) names.push(CLIP_EVENTS[i][1]);
    }
    return names;
  }

  var BUTTON_CONDITIONS = [
    [0x0001, 'idleToOverUp'], [0x0002, 'overUpToIdle'], [0x0004, 'overUpToOverDown'],
    [0x0008, 'overDownToOverUp'], [0x0010, 'overDownToOutDown'], [0x0020, 'outDownToOverDown'],
    [0x0040, 'outDownToIdle'], [0x0080, 'idleToOverDown'], [0x0100, 'overDownToIdle']
  ];

  function buttonConditionNames(flags) {
    var names = [];
    for (var i = 0; i < BUTTON_CONDITIONS.length; i++) {
      if (flags & BUTTON_CONDITIONS[i][0]) names.push(BUTTON_CONDITIONS[i][1]);
    }
    var key = (flags >> 9) & 0x7f;
    if (key) names.push('keyPress ' + key);
    return names;
  }

  /**
   * Decompile a whole action block to source.
   * `bytes` is a Uint8Array, `start`/`end` bound the block.
   */
  function decompile(bytes, start, end, opts) {
    try {
      var r = decompileActions(bytes, start || 0, end == null ? bytes.length : end, opts || {});
      return r.source;
    } catch (e) {
      return '// ActionScript could not be decompiled: ' + e.message;
    }
  }

  /** Wrap a decompiled body in its clip-event header, Flash-style. */
  function clipHandlerSource(flags, body) {
    var names = clipEventNames(flags);
    var head = 'onClipEvent(' + (names.join(', ') || 'unknown') + ') {';
    return head + '\n' + indentBlock(body) + '\n}';
  }

  function buttonHandlerSource(flags, body) {
    var names = buttonConditionNames(flags);
    return 'on(' + (names.join(', ') || 'unknown') + ') {\n' + indentBlock(body) + '\n}';
  }

  function indentBlock(src) {
    if (!src) return '';
    return src.split('\n').map(function (l) { return l ? '  ' + l : l; }).join('\n');
  }

  global.FlashyAVM1 = {
    ACTIONS: A,
    parseActions: parseActions,
    decompile: decompile,
    decompileActions: decompileActions,
    clipEventNames: clipEventNames,
    buttonConditionNames: buttonConditionNames,
    clipHandlerSource: clipHandlerSource,
    buttonHandlerSource: buttonHandlerSource
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.FlashyAVM1;
})(typeof window !== 'undefined' ? window : globalThis);
