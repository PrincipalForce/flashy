// An ActionScript 3 movie, assembled by hand.
//
// A real AS3 SWF is the output of a compiler, so there is no small file to
// borrow: this writes a valid ABC block — constant pool, one class, its
// constructor and one frame-script method — the way `mxmlc` would, and wraps
// it in a `DoABC` tag. The constructor registers the frame script with
// `addFrameScript(0, frame1)`, which is the idiom the reader looks for, and
// `frame1` is `stop();`.
//
// Hand-assembling it is the point: a fixture nobody can read says nothing
// when it breaks.

/** ABC's variable-length integer: seven bits per byte, low byte first. */
function u30(value) {
  const out = [];
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v) byte |= 0x80;
    out.push(byte);
  } while (v);
  return out;
}

function abcString(s) {
  const bytes = Buffer.from(s, "utf8");
  return u30(bytes.length).concat(Array.from(bytes));
}

const u16 = (v) => [v & 0xff, (v >> 8) & 0xff];

/**
 * Build the ABC block.
 *
 * The pools are 1-based — index 0 means "none" everywhere — so each array
 * below starts at 1 and the indices in the code refer to those positions.
 */
function makeABC() {
  // --- strings (index 1..n) ---
  const strings = [
    "",                  // 1  the empty namespace's name
    "Main",              // 2  class name
    "MovieClip",         // 3  superclass
    "flash.display",     // 4  its package
    "addFrameScript",    // 5
    "frame1",            // 6
    "stop",              // 7
  ];
  const S = (name) => strings.indexOf(name) + 1;

  // --- namespaces (1..n) ---
  // 1: the empty package; 2: flash.display
  const namespaces = [
    { kind: 0x16, name: S("") },
    { kind: 0x16, name: S("flash.display") },
  ];

  // --- multinames (1..n), all QName ---
  const multinames = [
    { ns: 1, name: S("Main") },            // 1  Main
    { ns: 2, name: S("MovieClip") },       // 2  flash.display.MovieClip
    { ns: 1, name: S("addFrameScript") },  // 3
    { ns: 1, name: S("frame1") },          // 4
    { ns: 1, name: S("stop") },            // 5
  ];
  const M = { Main: 1, MovieClip: 2, addFrameScript: 3, frame1: 4, stop: 5 };

  const bytes = [];
  const push = (arr) => { for (const b of arr) bytes.push(b); };

  push(u16(16)); push(u16(46));            // ABC 46.16

  push(u30(1));                            // ints: just the zero slot
  push(u30(1));                            // uints
  push(u30(1));                            // doubles
  push(u30(strings.length + 1));
  for (const s of strings) push(abcString(s));
  push(u30(namespaces.length + 1));
  for (const ns of namespaces) { bytes.push(ns.kind); push(u30(ns.name)); }
  push(u30(1));                            // namespace sets
  push(u30(multinames.length + 1));
  for (const mn of multinames) { bytes.push(0x07); push(u30(mn.ns)); push(u30(mn.name)); }

  // --- methods: 0 = the constructor, 1 = frame1 ---
  push(u30(2));
  push(u30(0)); push(u30(0)); push(u30(0)); bytes.push(0);   // ctor: ():*
  push(u30(0)); push(u30(0)); push(u30(0)); bytes.push(0);   // frame1: ():*

  push(u30(0));                            // metadata

  // --- one class ---
  push(u30(1));
  push(u30(M.Main));                       // name
  push(u30(M.MovieClip));                  // super
  bytes.push(0x00);                        // flags
  push(u30(0));                            // interfaces
  push(u30(0));                            // iinit = method 0
  push(u30(1));                            // one trait: frame1()
  push(u30(M.frame1));
  bytes.push(0x01);                        // kind: method
  push(u30(0));                            // disp id
  push(u30(1));                            // method 1

  push(u30(0));                            // class init (cinit = method 0 again)
  push(u30(0));                            // no static traits

  push(u30(1));                            // one script
  push(u30(0));                            // its init
  push(u30(0));                            // no traits

  // --- method bodies ---
  //   constructor: this.addFrameScript(0, this.frame1)
  const ctorCode = [
    0xd0,                                  // getlocal_0   (this)
    0x30,                                  // pushscope
    0xd0,                                  // getlocal_0
    0x24, 0x00,                            // pushbyte 0   (frame 1, 0-based)
    0xd0,                                  // getlocal_0
    0x66, ...u30(M.frame1),                // getproperty frame1
    0x4f, ...u30(M.addFrameScript), ...u30(2),  // callpropvoid addFrameScript(2)
    0x47,                                  // returnvoid
  ];
  //   frame1: stop()
  const frameCode = [
    0xd0,                                  // getlocal_0
    0x30,                                  // pushscope
    0x5d, ...u30(M.stop),                  // findpropstrict stop
    0x4f, ...u30(M.stop), ...u30(0),       // callpropvoid stop(0)
    0x47,                                  // returnvoid
  ];

  push(u30(2));
  for (const [method, code] of [[0, ctorCode], [1, frameCode]]) {
    push(u30(method));
    push(u30(4));                          // max stack
    push(u30(1));                          // local count
    push(u30(1));                          // init scope depth
    push(u30(2));                          // max scope depth
    push(u30(code.length));
    push(code);
    push(u30(0));                          // exceptions
    push(u30(0));                          // traits
  }

  return Buffer.from(bytes);
}

export { makeABC, u30 };
