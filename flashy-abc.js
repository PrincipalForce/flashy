/* flashy-abc.js — ActionScript 3 bytecode, read back into something legible
 *
 * A SWF published after about 2007 keeps its code in `DoABC` tags: AVM2
 * bytecode, a different machine from the AVM1 that `flashy-avm1.js` handles,
 * with its own constant pool, class model and instruction set. Without this
 * file such a movie imports its artwork and reports, truthfully but
 * unhelpfully, that it had code which was not read.
 *
 * WHAT THIS DOES
 *   - Parses the ABC container: constant pool, methods, classes, instances,
 *     scripts and method bodies
 *   - Produces an **outline** — every class, what it extends, and its
 *     methods and variables — which is usually what you actually want to
 *     know about an imported movie's code
 *   - Finds **frame scripts**. An AS3 timeline compiles `stop();` on frame 1
 *     into a method registered from the constructor with
 *     `addFrameScript(0, frame1)`. That call is recognised, so frame scripts
 *     come back attached to the frames they belong to.
 *   - Decompiles method bodies far enough to read: calls, property reads and
 *     writes, `new`, literals, operators, returns. Control flow is NOT
 *     reconstructed — a branch becomes a comment naming its target.
 *
 * WHAT THIS IS NOT: a full AS3 decompiler. A class with real logic comes
 * back as an outline plus a readable-but-flat listing, which is the honest
 * result for a few hundred lines of compiled code. The point is that an
 * imported movie says what its code was, instead of pretending there was
 * none.
 *
 * Pure: bytes in, text out. No DOM, so it runs in Node and in a test.
 */
(function (global) {
  'use strict';

  // -------------------- reader --------------------
  function Reader(bytes, start, end) {
    this.b = bytes;
    this.pos = start || 0;
    this.end = end == null ? bytes.length : end;
  }
  Reader.prototype.u8 = function () { return this.b[this.pos++]; };
  Reader.prototype.u16 = function () {
    var v = this.b[this.pos] | (this.b[this.pos + 1] << 8);
    this.pos += 2;
    return v;
  };
  Reader.prototype.s24 = function () {
    var v = this.b[this.pos] | (this.b[this.pos + 1] << 8) | (this.b[this.pos + 2] << 16);
    this.pos += 3;
    return v & 0x800000 ? v - 0x1000000 : v;
  };
  /* ABC's variable-length integer: seven bits per byte, low first, at most
     five bytes. Everything in the format is counted in these. */
  Reader.prototype.u30 = function () {
    var result = 0;
    for (var i = 0; i < 5; i++) {
      var byte = this.b[this.pos++];
      result |= (byte & 0x7f) << (7 * i);
      if (!(byte & 0x80)) break;
    }
    return result >>> 0;
  };
  Reader.prototype.s32 = function () { return this.u30() | 0; };
  Reader.prototype.d64 = function () {
    var dv = new DataView(new ArrayBuffer(8));
    for (var i = 0; i < 8; i++) dv.setUint8(i, this.b[this.pos + i]);
    this.pos += 8;
    return dv.getFloat64(0, true);
  };
  Reader.prototype.string = function () {
    var len = this.u30();
    var sub = this.b.subarray(this.pos, this.pos + len);
    this.pos += len;
    try { return new TextDecoder('utf-8').decode(sub); }
    catch (e) {
      var s = '';
      for (var i = 0; i < sub.length; i++) s += String.fromCharCode(sub[i]);
      return s;
    }
  };

  // -------------------- constant pool --------------------
  var NS_KIND = {
    0x05: 'private', 0x08: 'namespace', 0x16: 'package', 0x17: 'internal',
    0x18: 'protected', 0x19: 'explicit', 0x1a: 'staticprotected'
  };

  function parseConstantPool(r) {
    var cp = {
      ints: [0], uints: [0], doubles: [NaN], strings: [''],
      namespaces: [null], nsSets: [null], multinames: [null]
    };
    var n, i;

    n = r.u30(); for (i = 1; i < n; i++) cp.ints.push(r.s32());
    n = r.u30(); for (i = 1; i < n; i++) cp.uints.push(r.u30());
    n = r.u30(); for (i = 1; i < n; i++) cp.doubles.push(r.d64());
    n = r.u30(); for (i = 1; i < n; i++) cp.strings.push(r.string());

    n = r.u30();
    for (i = 1; i < n; i++) {
      var kind = r.u8();
      cp.namespaces.push({ kind: NS_KIND[kind] || 'namespace', name: cp.strings[r.u30()] || '' });
    }

    n = r.u30();
    for (i = 1; i < n; i++) {
      var count = r.u30();
      var set = [];
      for (var j = 0; j < count; j++) set.push(cp.namespaces[r.u30()]);
      cp.nsSets.push(set);
    }

    n = r.u30();
    for (i = 1; i < n; i++) {
      var k = r.u8();
      var mn = { kind: k };
      switch (k) {
      case 0x07: case 0x0d:                       // QName / QNameA
        mn.ns = cp.namespaces[r.u30()];
        mn.name = cp.strings[r.u30()] || '';
        break;
      case 0x0f: case 0x10:                       // RTQName / RTQNameA
        mn.name = cp.strings[r.u30()] || '';
        break;
      case 0x11: case 0x12:                       // RTQNameL / RTQNameLA
        break;
      case 0x09: case 0x0e:                       // Multiname / MultinameA
        mn.name = cp.strings[r.u30()] || '';
        mn.nsSet = cp.nsSets[r.u30()];
        break;
      case 0x1b: case 0x1c:                       // MultinameL / MultinameLA
        mn.nsSet = cp.nsSets[r.u30()];
        break;
      case 0x1d: {                                // TypeName — Vector.<T>
        mn.base = r.u30();
        var pc = r.u30();
        mn.params = [];
        for (var p = 0; p < pc; p++) mn.params.push(r.u30());
        break;
      }
      default:
        /* An unknown multiname kind means nothing after it can be trusted,
           so stop rather than produce confident nonsense. */
        mn.name = '';
        mn.broken = true;
        break;
      }
      cp.multinames.push(mn);
      if (mn.broken) break;
    }
    return cp;
  }

  // -------------------- names --------------------
  function multinameText(cp, index) {
    var mn = cp.multinames[index];
    if (!mn) return index === 0 ? '*' : '?';
    if (mn.kind === 0x1d) {
      var base = multinameText(cp, mn.base);
      var params = (mn.params || []).map(function (p) { return multinameText(cp, p); });
      return base + '.<' + params.join(', ') + '>';
    }
    var name = mn.name || '*';
    if (mn.ns && mn.ns.name && mn.ns.kind === 'package') return mn.ns.name + '.' + name;
    return name;
  }

  /** Just the member name, without its package — what source would say. */
  function shortName(cp, index) {
    var mn = cp.multinames[index];
    return (mn && mn.name) || (index === 0 ? '*' : '');
  }

  // -------------------- traits --------------------
  var TRAIT_KIND = ['slot', 'method', 'getter', 'setter', 'class', 'function', 'const'];

  function parseTraits(r, cp, count) {
    var traits = [];
    for (var i = 0; i < count; i++) {
      var nameIndex = r.u30();
      var tag = r.u8();
      var kind = tag & 0x0f;
      var attrs = tag >> 4;
      var t = {
        kind: TRAIT_KIND[kind] || ('kind' + kind),
        name: shortName(cp, nameIndex),
        qname: multinameText(cp, nameIndex)
      };
      if (kind === 0 || kind === 6) {             // slot / const
        t.slotId = r.u30();
        t.type = multinameText(cp, r.u30());
        var vindex = r.u30();
        if (vindex) { t.valueIndex = vindex; t.valueKind = r.u8(); }
      } else if (kind === 1 || kind === 2 || kind === 3) {   // method/getter/setter
        t.dispId = r.u30();
        t.method = r.u30();
      } else if (kind === 4) {                    // class
        t.slotId = r.u30();
        t.classIndex = r.u30();
      } else if (kind === 5) {                    // function
        t.slotId = r.u30();
        t.method = r.u30();
      }
      if (attrs & 0x04) {                         // METADATA
        var mc = r.u30();
        for (var m = 0; m < mc; m++) r.u30();
      }
      traits.push(t);
    }
    return traits;
  }

  // -------------------- the ABC block --------------------
  function parse(bytes, start, end) {
    var r = new Reader(bytes, start || 0, end);
    var abc = { minor: r.u16(), major: r.u16() };
    abc.cp = parseConstantPool(r);
    var cp = abc.cp;
    var i, n;

    n = r.u30();
    abc.methods = [];
    for (i = 0; i < n; i++) {
      var paramCount = r.u30();
      var method = { index: i, returnType: multinameText(cp, r.u30()), params: [] };
      for (var p = 0; p < paramCount; p++) method.params.push(multinameText(cp, r.u30()));
      method.name = cp.strings[r.u30()] || '';
      method.flags = r.u8();
      if (method.flags & 0x08) {                  // HAS_OPTIONAL
        var oc = r.u30();
        for (var o = 0; o < oc; o++) { r.u30(); r.u8(); }
      }
      if (method.flags & 0x80) {                  // HAS_PARAM_NAMES
        method.paramNames = [];
        for (var pn = 0; pn < paramCount; pn++) method.paramNames.push(cp.strings[r.u30()] || '');
      }
      abc.methods.push(method);
    }

    n = r.u30();                                  // metadata, skipped
    for (i = 0; i < n; i++) {
      r.u30();
      var items = r.u30();
      for (var it = 0; it < items; it++) { r.u30(); r.u30(); }
    }

    var classCount = r.u30();
    abc.instances = [];
    for (i = 0; i < classCount; i++) {
      var inst = {
        name: multinameText(cp, r.u30()),
        superName: multinameText(cp, r.u30())
      };
      inst.flags = r.u8();
      if (inst.flags & 0x08) r.u30();             // protected namespace
      var ifaceCount = r.u30();
      inst.interfaces = [];
      for (var f = 0; f < ifaceCount; f++) inst.interfaces.push(multinameText(cp, r.u30()));
      inst.iinit = r.u30();
      inst.traits = parseTraits(r, cp, r.u30());
      abc.instances.push(inst);
    }

    abc.classes = [];
    for (i = 0; i < classCount; i++) {
      var cls = { cinit: r.u30() };
      cls.traits = parseTraits(r, cp, r.u30());
      abc.classes.push(cls);
    }

    n = r.u30();
    abc.scripts = [];
    for (i = 0; i < n; i++) {
      var sc = { init: r.u30() };
      sc.traits = parseTraits(r, cp, r.u30());
      abc.scripts.push(sc);
    }

    n = r.u30();
    abc.bodies = [];
    abc.bodyByMethod = {};
    for (i = 0; i < n; i++) {
      var body = {
        method: r.u30(), maxStack: r.u30(), localCount: r.u30(),
        initScope: r.u30(), maxScope: r.u30()
      };
      var codeLen = r.u30();
      body.code = bytes.subarray(r.pos, r.pos + codeLen);
      r.pos += codeLen;
      var exCount = r.u30();
      for (var e = 0; e < exCount; e++) { r.u30(); r.u30(); r.u30(); r.u30(); r.u30(); }
      body.traits = parseTraits(r, cp, r.u30());
      abc.bodies.push(body);
      abc.bodyByMethod[body.method] = body;
    }
    return abc;
  }

  // -------------------- instructions --------------------
  /* Name, and how many operands of which kind follow. Getting an operand
     width wrong desynchronises everything after it, so the table covers the
     whole opcode space this reader can meet, not only the ones it prints. */
  var OPS = {};
  function op(code, name, operands) { OPS[code] = { name: name, operands: operands || [] }; }
  op(0x01, 'bkpt'); op(0x02, 'nop'); op(0x03, 'throw'); op(0x04, 'getsuper', ['u30']);
  op(0x05, 'setsuper', ['u30']); op(0x06, 'dxns', ['u30']); op(0x07, 'dxnslate');
  op(0x08, 'kill', ['u30']); op(0x09, 'label');
  op(0x0c, 'ifnlt', ['s24']); op(0x0d, 'ifnle', ['s24']); op(0x0e, 'ifngt', ['s24']);
  op(0x0f, 'ifnge', ['s24']); op(0x10, 'jump', ['s24']); op(0x11, 'iftrue', ['s24']);
  op(0x12, 'iffalse', ['s24']); op(0x13, 'ifeq', ['s24']); op(0x14, 'ifne', ['s24']);
  op(0x15, 'iflt', ['s24']); op(0x16, 'ifle', ['s24']); op(0x17, 'ifgt', ['s24']);
  op(0x18, 'ifge', ['s24']); op(0x19, 'ifstricteq', ['s24']); op(0x1a, 'ifstrictne', ['s24']);
  op(0x1b, 'lookupswitch', ['switch']); op(0x1c, 'pushwith'); op(0x1d, 'popscope');
  op(0x1e, 'nextname'); op(0x1f, 'hasnext'); op(0x20, 'pushnull'); op(0x21, 'pushundefined');
  op(0x23, 'nextvalue'); op(0x24, 'pushbyte', ['u8']); op(0x25, 'pushshort', ['u30']);
  op(0x26, 'pushtrue'); op(0x27, 'pushfalse'); op(0x28, 'pushnan'); op(0x29, 'pop');
  op(0x2a, 'dup'); op(0x2b, 'swap'); op(0x2c, 'pushstring', ['u30']); op(0x2d, 'pushint', ['u30']);
  op(0x2e, 'pushuint', ['u30']); op(0x2f, 'pushdouble', ['u30']); op(0x30, 'pushscope');
  op(0x31, 'pushnamespace', ['u30']); op(0x32, 'hasnext2', ['u30', 'u30']);
  op(0x40, 'newfunction', ['u30']); op(0x41, 'call', ['u30']); op(0x42, 'construct', ['u30']);
  op(0x43, 'callmethod', ['u30', 'u30']); op(0x44, 'callstatic', ['u30', 'u30']);
  op(0x45, 'callsuper', ['u30', 'u30']); op(0x46, 'callproperty', ['u30', 'u30']);
  op(0x47, 'returnvoid'); op(0x48, 'returnvalue'); op(0x49, 'constructsuper', ['u30']);
  op(0x4a, 'constructprop', ['u30', 'u30']); op(0x4c, 'callproplex', ['u30', 'u30']);
  op(0x4e, 'callsupervoid', ['u30', 'u30']); op(0x4f, 'callpropvoid', ['u30', 'u30']);
  op(0x53, 'applytype', ['u30']); op(0x55, 'newobject', ['u30']); op(0x56, 'newarray', ['u30']);
  op(0x57, 'newactivation'); op(0x58, 'newclass', ['u30']); op(0x59, 'getdescendants', ['u30']);
  op(0x5a, 'newcatch', ['u30']); op(0x5d, 'findpropstrict', ['u30']);
  op(0x5e, 'findproperty', ['u30']); op(0x5f, 'finddef', ['u30']);
  op(0x60, 'getlex', ['u30']); op(0x61, 'setproperty', ['u30']);
  op(0x62, 'getlocal', ['u30']); op(0x63, 'setlocal', ['u30']); op(0x64, 'getglobalscope');
  op(0x65, 'getscopeobject', ['u8']); op(0x66, 'getproperty', ['u30']);
  op(0x68, 'initproperty', ['u30']); op(0x6a, 'deleteproperty', ['u30']);
  op(0x6c, 'getslot', ['u30']); op(0x6d, 'setslot', ['u30']);
  op(0x6e, 'getglobalslot', ['u30']); op(0x6f, 'setglobalslot', ['u30']);
  op(0x70, 'convert_s'); op(0x71, 'esc_xelem'); op(0x72, 'esc_xattr'); op(0x73, 'convert_i');
  op(0x74, 'convert_u'); op(0x75, 'convert_d'); op(0x76, 'convert_b'); op(0x77, 'convert_o');
  op(0x78, 'checkfilter'); op(0x80, 'coerce', ['u30']); op(0x82, 'coerce_a'); op(0x85, 'coerce_s');
  op(0x86, 'astype', ['u30']); op(0x87, 'astypelate'); op(0x90, 'negate'); op(0x91, 'increment');
  op(0x92, 'inclocal', ['u30']); op(0x93, 'decrement'); op(0x94, 'declocal', ['u30']);
  op(0x95, 'typeof'); op(0x96, 'not'); op(0x97, 'bitnot');
  op(0xa0, 'add'); op(0xa1, 'subtract'); op(0xa2, 'multiply'); op(0xa3, 'divide');
  op(0xa4, 'modulo'); op(0xa5, 'lshift'); op(0xa6, 'rshift'); op(0xa7, 'urshift');
  op(0xa8, 'bitand'); op(0xa9, 'bitor'); op(0xaa, 'bitxor'); op(0xab, 'equals');
  op(0xac, 'strictequals'); op(0xad, 'lessthan'); op(0xae, 'lessequals');
  op(0xaf, 'greaterthan'); op(0xb0, 'greaterequals'); op(0xb1, 'instanceof');
  op(0xb2, 'istype', ['u30']); op(0xb3, 'istypelate'); op(0xb4, 'in');
  op(0xc0, 'increment_i'); op(0xc1, 'decrement_i'); op(0xc2, 'inclocal_i', ['u30']);
  op(0xc3, 'declocal_i', ['u30']); op(0xc4, 'negate_i'); op(0xc5, 'add_i');
  op(0xc6, 'subtract_i'); op(0xc7, 'multiply_i');
  for (var L = 0; L < 4; L++) { op(0xd0 + L, 'getlocal_' + L); op(0xd4 + L, 'setlocal_' + L); }
  op(0xef, 'debug', ['u8', 'u30', 'u8', 'u30']); op(0xf0, 'debugline', ['u30']);
  op(0xf1, 'debugfile', ['u30']); op(0xf2, 'bkptline', ['u30']); op(0xf3, 'timestamp');

  /** Split a method body into instructions. */
  function disassemble(code) {
    var r = new Reader(code, 0, code.length);
    var out = [];
    while (r.pos < r.end) {
      var at = r.pos;
      var byte = r.u8();
      var spec = OPS[byte];
      if (!spec) {
        out.push({ at: at, name: 'op' + byte.toString(16), args: [], unknown: true });
        break;
      }
      var args = [];
      for (var i = 0; i < spec.operands.length; i++) {
        var kind = spec.operands[i];
        if (kind === 'u30') args.push(r.u30());
        else if (kind === 'u8') args.push(r.u8());
        else if (kind === 's24') args.push(r.s24());
        else if (kind === 'switch') {
          args.push(r.s24());
          var caseCount = r.u30();
          for (var c = 0; c <= caseCount; c++) r.s24();
        }
      }
      out.push({ at: at, name: spec.name, args: args, next: r.pos });
    }
    return out;
  }

  // -------------------- method bodies as source --------------------
  function quote(s) {
    return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      .replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
  }

  var BINARY = {
    add: '+', subtract: '-', multiply: '*', divide: '/', modulo: '%',
    lshift: '<<', rshift: '>>', urshift: '>>>', bitand: '&', bitor: '|',
    bitxor: '^', equals: '==', strictequals: '===', lessthan: '<',
    lessequals: '<=', greaterthan: '>', greaterequals: '>=',
    instanceof: 'instanceof', in: 'in', add_i: '+', subtract_i: '-', multiply_i: '*'
  };

  /** `findpropstrict` results read as bare names; everything else as `a.b`. */
  function memberText(obj, name) {
    if (obj && typeof obj === 'object' && obj.scope) return name;
    if (obj === 'this') return 'this.' + name;
    return obj + '.' + name;
  }

  function localName(abc, methodIndex, slot) {
    if (slot === 0) return 'this';
    var m = abc.methods[methodIndex];
    if (m && m.paramNames && m.paramNames[slot - 1]) return m.paramNames[slot - 1];
    if (m && slot <= m.params.length) return 'arg' + slot;
    return 'local' + slot;
  }

  /**
   * Run a method body for its expressions, the way `flashy-avm1.js` does for
   * AVM1 — enough to read calls, assignments and literals. Branches are left
   * as comments: reconstructing AS3 control flow properly is a decompiler,
   * and this is a reader.
   */
  function methodSource(abc, methodIndex, opts) {
    opts = opts || {};
    var body = abc.bodyByMethod[methodIndex];
    if (!body) return '';
    var cp = abc.cp;
    var instrs = disassemble(body.code);
    var stack = [];
    var lines = [];
    var indent = opts.indent || '';

    function push(v) { stack.push(v); }
    function pop() { return stack.length ? stack.pop() : 'undefined'; }
    function popArgs(n) {
      var a = [];
      for (var i = 0; i < n; i++) a.unshift(pop());
      return a;
    }
    function out(text) { lines.push(indent + text); }

    for (var i = 0; i < instrs.length; i++) {
      var ins = instrs[i];
      var a = ins.args;
      switch (ins.name) {
      case 'getlocal_0': push('this'); break;
      case 'getlocal_1': case 'getlocal_2': case 'getlocal_3':
        push(localName(abc, methodIndex, parseInt(ins.name.slice(-1), 10)));
        break;
      case 'getlocal': push(localName(abc, methodIndex, a[0])); break;
      case 'setlocal': case 'setlocal_1': case 'setlocal_2': case 'setlocal_3': {
        var slot = ins.name === 'setlocal' ? a[0] : parseInt(ins.name.slice(-1), 10);
        out(localName(abc, methodIndex, slot) + ' = ' + pop() + ';');
        break;
      }
      case 'pushbyte': case 'pushshort': push(String(a[0])); break;
      case 'pushint': push(String(cp.ints[a[0]])); break;
      case 'pushuint': push(String(cp.uints[a[0]])); break;
      case 'pushdouble': push(String(cp.doubles[a[0]])); break;
      case 'pushstring': push(quote(cp.strings[a[0]] || '')); break;
      case 'pushtrue': push('true'); break;
      case 'pushfalse': push('false'); break;
      case 'pushnull': push('null'); break;
      case 'pushundefined': push('undefined'); break;
      case 'pushnan': push('NaN'); break;
      case 'dup': { var d = pop(); push(d); push(d); break; }
      case 'swap': { var s1 = pop(), s2 = pop(); push(s1); push(s2); break; }
      case 'pop': {
        var top = pop();
        if (typeof top === 'string' && /\)$/.test(top)) out(top + ';');
        break;
      }
      case 'getlex': push(multinameText(cp, a[0])); break;
      case 'findpropstrict': case 'findproperty': case 'finddef':
        /* The scope lookup before a call: its result is the object the call
           lands on, which for timeline code is the timeline itself. */
        push({ scope: multinameText(cp, a[0]) });
        break;
      case 'getproperty': push(memberText(pop(), shortName(cp, a[0]))); break;
      case 'setproperty': case 'initproperty': {
        var value = pop();
        out(memberText(pop(), shortName(cp, a[0])) + ' = ' + value + ';');
        break;
      }
      case 'getslot': push(memberText(pop(), 'slot' + a[0])); break;
      case 'setslot': {
        var sv = pop();
        out(memberText(pop(), 'slot' + a[0]) + ' = ' + sv + ';');
        break;
      }
      case 'callproperty': case 'callproplex': case 'callpropvoid': {
        var args = popArgs(a[1]);
        var call = memberText(pop(), shortName(cp, a[0])) + '(' + args.join(', ') + ')';
        if (ins.name === 'callpropvoid') out(call + ';'); else push(call);
        break;
      }
      case 'callsuper': case 'callsupervoid': {
        var sargs = popArgs(a[1]);
        pop();
        var scall = 'super.' + shortName(cp, a[0]) + '(' + sargs.join(', ') + ')';
        if (ins.name === 'callsupervoid') out(scall + ';'); else push(scall);
        break;
      }
      case 'constructsuper': { popArgs(a[0]); pop(); out('super();'); break; }
      case 'constructprop': {
        var cargs = popArgs(a[1]);
        push('new ' + memberText(pop(), shortName(cp, a[0])) + '(' + cargs.join(', ') + ')');
        break;
      }
      case 'construct': {
        var nargs = popArgs(a[0]);
        push('new ' + pop() + '(' + nargs.join(', ') + ')');
        break;
      }
      case 'call': {
        var fargs = popArgs(a[0]);
        pop();
        push(pop() + '(' + fargs.join(', ') + ')');
        break;
      }
      case 'newarray': push('[' + popArgs(a[0]).join(', ') + ']'); break;
      case 'newobject': {
        var pairs = [];
        for (var np = 0; np < a[0]; np++) {
          var pv = pop(), pk = pop();
          pairs.unshift(pk + ': ' + pv);
        }
        push('{' + pairs.join(', ') + '}');
        break;
      }
      case 'newfunction': push('function () { /* … */ }'); break;
      case 'returnvalue': out('return ' + pop() + ';'); break;
      case 'returnvoid': break;
      case 'throw': out('throw ' + pop() + ';'); break;
      case 'not': push('!' + pop()); break;
      case 'negate': case 'negate_i': push('-' + pop()); break;
      case 'increment': case 'increment_i': push(pop() + ' + 1'); break;
      case 'decrement': case 'decrement_i': push(pop() + ' - 1'); break;
      case 'typeof': push('typeof ' + pop()); break;
      case 'istype': push(pop() + ' is ' + multinameText(cp, a[0])); break;
      case 'istypelate': { var ty = pop(); push(pop() + ' is ' + ty); break; }
      case 'jump': case 'lookupswitch':
        out('// ' + ins.name + ' -> +' + a[0]);
        break;
      case 'iftrue': case 'iffalse': case 'ifeq': case 'ifne': case 'iflt':
      case 'ifle': case 'ifgt': case 'ifge': case 'ifnlt': case 'ifnle':
      case 'ifngt': case 'ifnge': case 'ifstricteq': case 'ifstrictne': {
        /* Honest about the limit: the test is printed, the structure is not
           reconstructed. */
        var cond = pop();
        if (!/^if(true|false)$/.test(ins.name)) cond = pop() + ' ? ' + cond;
        out('// ' + ins.name + ' (' + cond + ') -> +' + a[0]);
        break;
      }
      default: {
        var binop = BINARY[ins.name];
        if (binop) {
          var right = pop(), left = pop();
          push('(' + left + ' ' + binop + ' ' + right + ')');
        }
        break;
      }
      }
    }
    for (var k = 0; k < stack.length; k++) {
      if (typeof stack[k] === 'string' && /\)$/.test(stack[k])) lines.push(indent + stack[k] + ';');
    }
    return lines.join('\n');
  }

  // -------------------- frame scripts --------------------
  /**
   * `addFrameScript(0, frame1)` in a constructor is how an AS3 timeline
   * registers the code on its frames. Finding those calls is what lets a
   * frame script come back attached to its frame, rather than as a method
   * called `frame7` floating in a class.
   */
  function frameScripts(abc, methodIndex) {
    var body = abc.bodyByMethod[methodIndex];
    if (!body) return [];
    var cp = abc.cp;
    var instrs = disassemble(body.code);
    var out = [];
    for (var i = 0; i < instrs.length; i++) {
      var ins = instrs[i];
      if ((ins.name !== 'callpropvoid' && ins.name !== 'callproperty') ||
          shortName(cp, ins.args[0]) !== 'addFrameScript') continue;
      var argc = ins.args[1];
      /* The arguments are (frame index, method) pairs; walk back over the
         instructions that pushed them. */
      var pushes = [];
      for (var j = i - 1; j >= 0 && pushes.length < argc; j--) {
        var p = instrs[j];
        if (p.name === 'pushbyte' || p.name === 'pushshort') pushes.unshift({ frame: p.args[0] });
        else if (p.name === 'pushint') pushes.unshift({ frame: cp.ints[p.args[0]] });
        else if (p.name === 'getlex' || p.name === 'getproperty') {
          pushes.unshift({ method: shortName(cp, p.args[0]) });
        } else if (p.name === 'newfunction') pushes.unshift({ methodIndex: p.args[0] });
        else if (p.name === 'getlocal_0' || p.name === 'findpropstrict') continue;
        else break;
      }
      for (var k = 0; k + 1 < pushes.length; k += 2) {
        if (pushes[k].frame == null) continue;
        out.push({
          frame: pushes[k].frame + 1,             // AS3 counts frames from 0
          method: pushes[k + 1].method || null,
          methodIndex: pushes[k + 1].methodIndex != null ? pushes[k + 1].methodIndex : null
        });
      }
    }
    return out;
  }

  /** A class's method index, by member name. */
  function methodIndexFor(instance, name) {
    for (var i = 0; i < instance.traits.length; i++) {
      var t = instance.traits[i];
      if (t.name === name && t.method != null) return t.method;
    }
    return null;
  }

  // -------------------- outline --------------------
  /**
   * The classes an ABC block defines, as text. For an imported movie this is
   * the useful summary: what the code was about, even where the bodies are
   * beyond this reader.
   */
  function outline(abc, opts) {
    opts = opts || {};
    var limit = opts.limit || 60;
    var lines = [];
    for (var i = 0; i < abc.instances.length && i < limit; i++) {
      var inst = abc.instances[i];
      var head = 'class ' + inst.name;
      if (inst.superName && inst.superName !== '*' && inst.superName !== 'Object') {
        head += ' extends ' + inst.superName;
      }
      if (inst.interfaces && inst.interfaces.length) {
        head += ' implements ' + inst.interfaces.join(', ');
      }
      lines.push(head + ' {');
      var statics = abc.classes[i] ? abc.classes[i].traits : [];
      statics.concat(inst.traits).forEach(function (t) {
        if (t.kind === 'slot' || t.kind === 'const') {
          lines.push('  ' + (t.kind === 'const' ? 'const ' : 'var ') + t.name +
            (t.type && t.type !== '*' ? ':' + t.type : '') + ';');
        } else if (t.kind === 'method' || t.kind === 'getter' || t.kind === 'setter') {
          var m = abc.methods[t.method];
          var params = m ? m.params.map(function (p, pi) {
            return (m.paramNames && m.paramNames[pi] ? m.paramNames[pi] : 'arg' + (pi + 1)) +
              (p && p !== '*' ? ':' + p : '');
          }).join(', ') : '';
          var prefix = t.kind === 'getter' ? 'get ' : t.kind === 'setter' ? 'set ' : '';
          lines.push('  function ' + prefix + t.name + '(' + params + ')' +
            (m && m.returnType && m.returnType !== '*' ? ':' + m.returnType : '') + ';');
        }
      });
      lines.push('}');
    }
    if (abc.instances.length > limit) {
      lines.push('// …and ' + (abc.instances.length - limit) + ' more classes');
    }
    return lines.join('\n');
  }

  /**
   * Everything an importer wants from one DoABC tag: how many classes, an
   * outline of them, and any frame scripts with their source.
   */
  function read(bytes, start, end) {
    var abc = parse(bytes, start, end);
    var result = {
      abc: abc, classes: abc.instances.length,
      frameScripts: {}, outline: outline(abc)
    };
    for (var i = 0; i < abc.instances.length; i++) {
      var inst = abc.instances[i];
      var found = frameScripts(abc, inst.iinit);
      for (var f = 0; f < found.length; f++) {
        var entry = found[f];
        var mi = entry.methodIndex;
        if (mi == null && entry.method) mi = methodIndexFor(inst, entry.method);
        var src = mi != null ? methodSource(abc, mi) : '';
        var text = '/* ' + inst.name + ', frame ' + entry.frame + ' (ActionScript 3) */\n' +
          (src || '// ' + (entry.method || 'frame script') + ' — body not recovered');
        result.frameScripts[entry.frame] = result.frameScripts[entry.frame]
          ? result.frameScripts[entry.frame] + '\n' + text
          : text;
      }
    }
    return result;
  }

  global.FlashyABC = {
    parse: parse,
    read: read,
    outline: outline,
    disassemble: disassemble,
    methodSource: methodSource,
    frameScripts: frameScripts,
    multinameText: multinameText
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.FlashyABC;
})(typeof window !== 'undefined' ? window : globalThis);
