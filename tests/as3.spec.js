// ActionScript 3, compiled to JavaScript.
//
// The last gap in the audit, and the one it had written off as "needs a
// compiler and an AVM2". Half of that is true: an AVM2 — a bytecode
// interpreter for compiled ABC — genuinely is out of scope, and this does not
// run a .swf's compiled ActionScript. The other half was wrong. AS3 SOURCE is
// a class language that is very nearly a subset of modern JavaScript once the
// type annotations come off, and the standard library it reaches for — Sprite,
// MovieClip, TextField, Event, Point, Timer — maps onto what the engine
// already is. So AS3 source compiles to JavaScript and runs on the real
// engine, which is what mattered to an author: you wrote a document class, it
// was instantiated with the stage, and addChild put things on screen.
//
// The single most important thing the compiler does is AS3's implicit `this`:
// inside a class, `x += vx` and `addChild(ball)` and `graphics.beginFill()`
// all mean `this.`. Without it every AS3 class fails on its first line, and
// with a wrong version of it the failures are silent.
import { test, expect } from "@playwright/test";
import { openEditor, downloadFromAction, runExportedHTML } from "./helpers.js";

/** Compile and run a snippet, returning what the page saw. */
const runAS3 = (page, src, probe) =>
  page.evaluate(({ src, probe }) => {
    const r = window.FlashyAS3.run(src, {}, null, {});
    if (!r.ok) return { ok: false, error: r.error, line: r.line,
                        generated: r.generated };
    const out = { ok: true, classes: Object.keys(r.defined),
                  mainClass: r.mainClass };
    if (probe) {
      // eslint-disable-next-line no-new-func
      out.probe = new Function("classes", "AS3", probe)(r.defined, r.AS3);
    }
    return out;
  }, { src, probe });

const AS3 = (lines) => lines.join("\n");

/* ------------------------------------------------------------------ *
 * The language
 * ------------------------------------------------------------------ */

test("a class compiles, extends the engine, and keeps its statics", async ({ page }) => {
  await openEditor(page);
  const r = await runAS3(page, AS3([
    "package com.example {",
    "  import flash.display.MovieClip;",
    "  public class Ball extends MovieClip {",
    "    public static const NAME:String = 'ball';",
    "    private var vx:Number = 3;",
    "    private var _tag:String;",
    "    public function Ball(tag:String = 'b') {",
    "      _tag = tag;",
    "      graphics.beginFill(0xFF0000);",
    "      graphics.drawCircle(0, 0, 10);",
    "      graphics.endFill();",
    "    }",
    "    public function get tag():String { return _tag; }",
    "    public function set tag(v:String):void { _tag = v; }",
    "    public function step():void { x += vx; if (x > 100) vx = -vx; }",
    "  }",
    "}",
  ]), `
    const b = new classes.Ball("hi");
    b.step(); b.step();
    b.tag = "re";
    return { tag: b.tag, x: b.x, name: classes.Ball.NAME,
             isClip: b instanceof window.Flashy.MovieClip,
             hasGraphics: !!b.graphics };
  `);
  expect(r.ok).toBe(true);
  expect(r.classes).toEqual(["Ball"]);
  /* It really is a MovieClip: a script that adds a child to this is adding a
     child to the real display list, and the real painter draws it. */
  expect(r.probe.isClip).toBe(true);
  expect(r.probe.hasGraphics).toBe(true);
  expect(r.probe.x).toBe(6);
  expect(r.probe.tag).toBe("re");
  expect(r.probe.name).toBe("ball");
});

test("a bare name resolves to a member, and a local shadows it", async ({ page }) => {
  await openEditor(page);
  const r = await runAS3(page, AS3([
    "package {",
    "  import flash.display.Sprite;",
    "  public class T extends Sprite {",
    "    private var n:int = 1;",
    "    public var hits:Array = [];",
    "    public function bump():void { n += 1; hits.push(n); }",
    "    public function setX(x:Number):void { this.x = x; }",
    "    public function shadow(n:int):int { return n * 10; }",
    "    public function local():int { var n:int = 99; return n; }",
    "    public function keyed():Object { return { n: 5, x: 6 }; }",
    "    public function inherited():Boolean { return visible && alpha == 1; }",
    "  }",
    "}",
  ]), `
    const t = new classes.T();
    t.bump(); t.bump();
    t.setX(42);
    return { hits: t.hits, n: t.n, x: t.x,
             shadowed: t.shadow(3), local: t.local(),
             keys: t.keyed(), inherited: t.inherited() };
  `);
  expect(r.ok).toBe(true);
  // A field read and written without `this.`, which is how AS3 is written.
  expect(r.probe.hits).toEqual([2, 3]);
  expect(r.probe.n).toBe(3);
  // A parameter shadows a member, as it does in AS3.
  expect(r.probe.x).toBe(42);
  expect(r.probe.shadowed).toBe(30);
  expect(r.probe.local).toBe(99);
  // An object-literal KEY is not a member reference.
  expect(r.probe.keys).toEqual({ n: 5, x: 6 });
  // ...and inherited display properties resolve too.
  expect(r.probe.inherited).toBe(true);
});

test("rotation is degrees, as AS3 has it", async ({ page }) => {
  await openEditor(page);
  const r = await runAS3(page, AS3([
    "package {",
    "  import flash.display.Sprite;",
    "  public class T extends Sprite {",
    "    public function spin():Number { rotation = 90; return rotation; }",
    "  }",
    "}",
  ]), `
    const t = new classes.T();
    const deg = t.spin();
    return { deg: deg, radians: +t.rotation.toFixed(6) };
  `);
  expect(r.ok).toBe(true);
  /* AS3's rotation is in degrees and the engine's is in radians. Leaving the
     name alone would make every rotation in every compiled script wrong by a
     factor of 57. */
  expect(r.probe.deg).toBe(90);
  expect(r.probe.radians).toBeCloseTo(Math.PI / 2, 5);
});

test("is and as behave as AS3's, including on the primitive classes", async ({ page }) => {
  await openEditor(page);
  const r = await runAS3(page, AS3([
    "package {",
    "  import flash.display.Sprite;",
    "  import flash.geom.Point;",
    "  public class T extends Sprite {",
    "    public function kind(v:*):String {",
    "      if (v is Number) return 'num';",
    "      if (v is String) return 'str';",
    "      if (v is Array) return 'arr';",
    "      if (v is flash.geom.Point) return 'point';",
    "      return 'other';",
    "    }",
    "    public function cast(v:*):Point { return v as Point; }",
    "    public function both(a:*, b:*):Boolean {",
    "      return (a is Number) && (b as Point) != null;",
    "    }",
    "    public function nested(v:*):String {",
    "      return String(Math.round(1.4)) + (v is Number ? '!' : '?');",
    "    }",
    "  }",
    "}",
  ]), `
    const t = new classes.T();
    const P = AS3.runtime.Point;
    return {
      kinds: [1, "a", [1], new P(1, 2), {}].map((v) => t.kind(v)),
      hit: t.cast(new P(3, 4)) instanceof P,
      miss: t.cast("no"),
      both: [t.both(1, new P(0, 0)), t.both("x", new P(0, 0)), t.both(1, "x")],
      nested: [t.nested(1), t.nested("a")],
    };
  `);
  expect(r.ok).toBe(true);
  /* `x is Number` is a typeof test, not an instanceof one, so no infix
     rewrite can say both — which is why it goes through a helper. */
  expect(r.probe.kinds).toEqual(["num", "str", "arr", "point", "other"]);
  // `as` yields null on a miss, which is the entire reason to use it.
  expect(r.probe.hit).toBe(true);
  expect(r.probe.miss).toBe(null);
  expect(r.probe.both).toEqual([true, false, false]);
  // And the left operand is found correctly inside a larger expression.
  expect(r.probe.nested).toEqual(["1!", "1?"]);
});

test("for each, for in, try/catch/finally, switch and Vector", async ({ page }) => {
  await openEditor(page);
  const r = await runAS3(page, AS3([
    "package {",
    "  public class T {",
    "    public function each():String {",
    "      var out:String = '';",
    "      for each (var s:String in ['a','b','c']) { out += s; }",
    "      var m:Object = { x: 1, y: 2 };",
    "      for each (var n:int in m) { out += String(n); }",
    "      return out;",
    "    }",
    "    public function keys():String {",
    "      var out:String = '';",
    "      var m:Object = { p: 1, q: 2 };",
    "      for (var k:String in m) { out += k; }",
    "      return out;",
    "    }",
    "    public function guarded():int {",
    "      var total:int = 0;",
    "      try { throw new Error('boom'); }",
    "      catch (e:Error) { total += 1; }",
    "      finally { total += 10; }",
    "      switch (total) { case 11: return 100; default: return total; }",
    "    }",
    "    public function vec():int {",
    "      var v:Vector.<int> = new Vector.<int>();",
    "      v.push(1); v.push(2);",
    "      return v.length;",
    "    }",
    "  }",
    "}",
  ]), `
    const t = new classes.T();
    return { each: t.each(), keys: t.keys(), guarded: t.guarded(), vec: t.vec() };
  `);
  expect(r.ok).toBe(true);
  // `for each` iterates VALUES, over an array or a plain object.
  expect(r.probe.each).toBe("abc12");
  expect(r.probe.keys).toBe("pq");
  expect(r.probe.guarded).toBe(100);
  // Vector.<T> is the only generic AS3 had, and it is an Array.
  expect(r.probe.vec).toBe(2);
});

test("a class with no constructor still initialises its fields", async ({ page }) => {
  await openEditor(page);
  const r = await runAS3(page, AS3([
    "package {",
    "  import flash.display.Sprite;",
    "  public class T extends Sprite {",
    "    public var a:int = 5;",
    "    public function total():int { return a + late; }",
    "    // Declared AFTER the method that uses it, which AS3 allows.",
    "    public var late:int = 7;",
    "  }",
    "}",
  ]), `
    const t = new classes.T();
    return { a: t.a, late: t.late, total: t.total(),
             isSprite: t instanceof window.Flashy.MovieClip };
  `);
  expect(r.ok).toBe(true);
  expect(r.probe.a).toBe(5);
  /* A field declared after the constructor — or with no constructor at all —
     still has to be initialised, and the method above it still has to see it:
     the member table is scanned before anything is emitted. */
  expect(r.probe.late).toBe(7);
  expect(r.probe.total).toBe(12);
  expect(r.probe.isSprite).toBe(true);
});

test("one of the author's classes can extend another", async ({ page }) => {
  await openEditor(page);
  const r = await runAS3(page, AS3([
    "package {",
    "  import flash.display.Sprite;",
    "  public class Base extends Sprite {",
    "    protected var label:String = 'base';",
    "    public function describe():String { return label; }",
    "  }",
    "}",
    "package {",
    "  public class Derived extends Base {",
    "    public function Derived() {",
    "      super();",
    "      label = 'derived';",
    "    }",
    "    override public function describe():String {",
    "      return 'I am ' + super.describe();",
    "    }",
    "  }",
    "}",
  ]), `
    const d = new classes.Derived();
    return { described: d.describe(),
             isBase: d instanceof classes.Base,
             isClip: d instanceof window.Flashy.MovieClip };
  `);
  expect(r.ok).toBe(true);
  /* The base class is resolved at RUN time rather than at compile time,
     because which it is — the author's own or the engine's — is not knowable
     until both have been declared, and the declaration order in one file is
     not something the author should have to think about. */
  expect(r.probe.described).toBe("I am derived");
  expect(r.probe.isBase).toBe(true);
  expect(r.probe.isClip).toBe(true);
});

test("the runtime's events, geometry and timer are the ones AS3 names", async ({ page }) => {
  await openEditor(page);
  const r = await runAS3(page, AS3([
    "package {",
    "  import flash.display.Sprite;",
    "  import flash.events.Event;",
    "  import flash.events.MouseEvent;",
    "  import flash.geom.Point;",
    "  import flash.geom.Rectangle;",
    "  import flash.utils.Timer;",
    "  public class T extends Sprite {",
    "    public var fired:Array = [];",
    "    public function wire():void {",
    "      addEventListener(Event.ENTER_FRAME, onFrame);",
    "      addEventListener(MouseEvent.CLICK, onFrame);",
    "    }",
    "    private function onFrame(e:Event):void { fired.push(e.type); }",
    "    public function geom():Array {",
    "      var p:Point = new Point(3, 4);",
    "      var r:Rectangle = new Rectangle(0, 0, 10, 20);",
    "      return [p.length, r.right, r.bottom, r.contains(5, 5)];",
    "    }",
    "    public function timing():Array {",
    "      var t:Timer = new Timer(50, 2);",
    "      return [t.delay, t.repeatCount, t.running];",
    "    }",
    "  }",
    "}",
  ]), `
    const t = new classes.T();
    t.wire();
    t.dispatchEvent("enterFrame", { type: "enterFrame" });
    t.dispatchEvent("click", { type: "click" });
    return { fired: t.fired, geom: t.geom(), timing: t.timing(),
             constants: [AS3.runtime.Event.ENTER_FRAME,
                         AS3.runtime.MouseEvent.CLICK] };
  `);
  expect(r.ok).toBe(true);
  /* The constants map onto the engine's own event names, so a listener added
     through either spelling works — AS3 code says Event.ENTER_FRAME far more
     often than it says "enterFrame". */
  expect(r.probe.constants).toEqual(["enterFrame", "click"]);
  expect(r.probe.fired).toEqual(["enterFrame", "click"]);
  expect(r.probe.geom).toEqual([5, 10, 20, true]);
  expect(r.probe.timing).toEqual([50, 2, false]);
});

test("trace goes where every other trace in Flashy goes", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const seen = [];
    /* `write` is the Output's entry point -- `trace` is what the LANGUAGE
       calls it, and the two are deliberately different names. */
    const real = window.Flashy.Output.write;
    window.Flashy.Output.write = function () {
      seen.push([].slice.call(arguments).join(" "));
    };
    const res = window.FlashyAS3.run([
      "package {",
      "  public class T {",
      "    public function go():void { trace('hello', 42); }",
      "  }",
      "}",
    ].join("\n"), {}, null, {});
    if (res.ok) new res.defined.T().go();
    window.Flashy.Output.write = real;
    return { ok: res.ok, seen };
  });
  expect(r.ok).toBe(true);
  expect(r.seen).toEqual(["hello 42"]);
});

/* ------------------------------------------------------------------ *
 * What is refused
 * ------------------------------------------------------------------ */

test("E4X and namespaces are refused with a line number, not mistranslated", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const cases = {
      descendants: "package {\n public class T {\n  public function f():* {\n   return a..b;\n  }\n }\n}",
      attribute: "package {\n public class T {\n  public function f():* { return a.@href; }\n }\n}",
      xml: "package {\n public class T {\n  public var x:XML;\n }\n}",
      namespaceOp: "package {\n public class T {\n  public function f():* { return ns::thing; }\n }\n}",
      useNamespace: "use namespace mx_internal;\npackage { public class T {} }",
    };
    const out = {};
    Object.keys(cases).forEach((k) => {
      try { window.FlashyAS3.compile(cases[k]); out[k] = null; }
      catch (e) { out[k] = { message: e.message, line: e.line }; }
    });
    out.listed = window.FlashyAS3.UNSUPPORTED;
    return out;
  });
  /* A compiler that quietly drops what it does not understand is worse than
     one that refuses: each of these is a real AS3 feature, and compiling it
     into something else would be silently wrong. */
  expect(r.descendants).not.toBe(null);
  expect(r.descendants.line).toBe(4);
  expect(r.attribute).not.toBe(null);
  expect(r.xml).not.toBe(null);
  expect(r.xml.message).toContain("E4X");
  expect(r.namespaceOp).not.toBe(null);
  expect(r.useNamespace).not.toBe(null);
  // And the list is published, so the dialog can show it.
  expect(r.listed.length).toBeGreaterThan(2);
});

test("a syntax error reports the line it is on", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const src = [
      "package {",
      "  public class T {",
      "    public function f():void {",
      "      var a:int = 1;",
      "    }",
      "    public var 9bad:int;",
      "  }",
      "}",
    ].join("\n");
    try { window.FlashyAS3.compile(src); return { threw: false }; }
    catch (e) { return { threw: true, line: e.line, message: e.message }; }
  });
  expect(r.threw).toBe(true);
  // The line is the author's own, which is what the gutter needs.
  expect(r.line).toBe(6);
});

test("a missing class says what the build does provide", async ({ page }) => {
  await openEditor(page);
  const r = await runAS3(page, AS3([
    "package {",
    "  public class T extends NetConnection {",
    "    public function T() { super(); }",
    "  }",
    "}",
  ]));
  expect(r.ok).toBe(false);
  expect(r.error).toContain("NetConnection");
  /* The list of what IS available turns a dead end into a decision. */
  expect(r.error).toContain("Sprite");
  expect(r.error).toContain("TextField");
});

/* ------------------------------------------------------------------ *
 * The editor
 * ------------------------------------------------------------------ */

test("the dialect is a document setting, and survives a save", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const before = F.scriptDialect();
    F.setScriptDialect("as3");
    F.setDocumentClass("Main", F.DEFAULT_AS3_DOCUMENT);
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    return {
      before,
      dialect: F.scriptDialect(),
      cls: F.documentClass(),
      hasScript: F.documentScript().indexOf("class Main") >= 0,
      saved: /"documentClass":"Main"/.test(json),
      // A nonsense dialect falls back to JavaScript rather than being stored.
      bogus: (F.setScriptDialect("perl"), F.scriptDialect()),
    };
  });
  expect(r.before).toBe("js");
  expect(r.dialect).toBe("as3");
  expect(r.cls).toBe("Main");
  expect(r.hasScript).toBe(true);
  expect(r.saved).toBe(true);
  expect(r.bogus).toBe("js");
});

test("the Actions panel checks AS3 with its own compiler", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      // Valid AS3 that is NOT valid JavaScript, so the dialect has to decide.
      as3ok: F.checkScript("var n:int = 1; trace(n);", "as3"),
      asJs: F.checkScript("var n:int = 1; trace(n);", "js").ok,
      as3bad: F.checkScript("package { public class 9 {} }", "as3"),
      // AS2 is compiled elsewhere, so it is not checked here at all.
      as2: F.checkScript("_root.gotoAndPlay(2);", "as2"),
    };
  });
  expect(r.as3ok.ok).toBe(true);
  /* The same source read as JavaScript is a syntax error, which is exactly
     why reporting it against the wrong dialect would be both wrong and
     alarming. */
  expect(r.asJs).toBe(false);
  expect(r.as3bad.ok).toBe(false);
  expect(r.as3bad.line).toBeGreaterThan(0);
  expect(r.as2.skipped).toBe(true);
});

test("the document class dialog compiles as you type", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => window._flashyEditor.doAction("as3Document"));
  const r = await page.evaluate(() => {
    const ta = document.getElementById("as3-document");
    const status = document.getElementById("as3-status");
    const read = () => status.textContent;
    const empty = read();
    ta.value = "package { public class Main extends Sprite { } }";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    const good = read();
    ta.value = "package { public class Main extends Sprite { var 9 } }";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    const bad = read();
    const badClass = status.className;
    // And applying it sets the dialect, because a class that is compiled and
    // never run is a class that does nothing.
    ta.value = window._flashyAI.DEFAULT_AS3_DOCUMENT;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    [...document.querySelectorAll("#fy-dialog button")]
      .find((b) => b.textContent === "Apply").click();
    return { empty, good, bad, badClass,
             dialect: window._flashyAI.scriptDialect(),
             cls: window._flashyAI.documentClass() };
  });
  expect(r.empty).toContain("Empty");
  expect(r.good).toContain("Compiles");
  expect(r.good).toContain("Main");
  expect(r.bad).toContain("Line");
  expect(r.badClass).toContain("error");
  expect(r.dialect).toBe("as3");
  expect(r.cls).toBe("Main");
});

test("the debugger says plainly that it cannot step AS3", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setScriptDialect("as3");
    F.currentLayers()[0].keyframes[0].script = "trace('x');";
    F.selectKeyframe(0, 1);
    return F.debugCurrentScript({});
  });
  expect(r.ok).toBe(false);
  /* Said plainly rather than producing confident nonsense: stepping compiled
     output would point at lines nobody wrote. */
  expect(r.why).toContain("ActionScript 3");
});

/* ------------------------------------------------------------------ *
 * The exported player
 * ------------------------------------------------------------------ */

test("the export ships the compiler only when the document needs it", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const plain = F.docNeedsAS3({ scriptDialect: "js", layers: [] });
    const as3NoCode = F.docNeedsAS3({ scriptDialect: "as3", layers: [] });
    const as3Doc = F.docNeedsAS3({ scriptDialect: "as3",
      documentScript: "package {}", layers: [] });
    const as3Frame = F.docNeedsAS3({ scriptDialect: "as3", layers: [
      { keyframes: [{ script: "trace('x');" }] }] });
    return { plain, as3NoCode, as3Doc, as3Frame };
  });
  // An exported movie has to be one file that works offline, so the compiler
  // travels with it — but only when there is something for it to compile.
  expect(r.plain).toBe(false);
  expect(r.as3NoCode).toBe(false);
  expect(r.as3Doc).toBe(true);
  expect(r.as3Frame).toBe(true);
});

test("the exported player instantiates the document class and draws it", async ({ page, context }) => {
  await openEditor(page);
  await page.evaluate(() => {
    const F = window._flashyAI;
    window._flashyEditor.loadDoc({
      width: 200, height: 150, fps: 12, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {},
      scriptDialect: "as3",
      documentClass: "Main",
      documentScript: [
        "package {",
        "  import flash.display.Sprite;",
        "  public class Main extends Sprite {",
        "    public function Main() {",
        "      var box:Sprite = new Sprite();",
        "      box.graphics.beginFill(0x1166AA);",
        "      box.graphics.drawRect(0, 0, 60, 40);",
        "      box.graphics.endFill();",
        "      box.x = 40;",
        "      box.y = 50;",
        "      addChild(box);",
        "      trace('Main ran');",
        "    }",
        "  }",
        "}",
      ].join("\n"),
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [] }] }],
    });
    void F;
  });
  const html = await downloadFromAction(page, "export");
  // The compiler travels with the movie.
  expect(html).toContain("FlashyAS3");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForTimeout(300);
  const run = await out.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const sx = c.width / 200, sy = c.height / 150;
    const at = (x, y) => {
      const d = g.getImageData(Math.round(x * sx), Math.round(y * sy), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    return {
      inside: at(70, 70), outside: at(10, 10),
      hasMain: !!(window.__stage && window.__stage.documentClass),
      traced: (window.Flashy.Output.lines || []).join(" "),
      // The child is on the ROOT, which is the container; the Stage is not one.
      kids: window.__stage && window.__stage.root
        ? window.__stage.root.children.length : -1,
    };
  });
  await out.close();
  expect(errors).toEqual([]);
  /* A box drawn by a compiled AS3 constructor, added to the real display
     list, painted by the real painter. That is the whole claim. */
  expect(run.inside[2]).toBeGreaterThan(run.inside[0]);
  expect(run.inside[2]).toBeGreaterThan(100);
  expect(run.outside).toEqual([255, 255, 255]);
  expect(run.hasMain).toBe(true);
  expect(run.kids).toBe(1);
  expect(run.traced).toContain("Main ran");
});

test("a document class that fails to compile does not stop the movie", async ({ page, context }) => {
  await openEditor(page);
  await page.evaluate(() => {
    window._flashyEditor.loadDoc({
      width: 200, height: 150, fps: 12, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {},
      scriptDialect: "as3",
      documentClass: "Main",
      // A real AS3 feature this build refuses, so the compile fails.
      documentScript: "package { public class Main { public var x:XML; } }",
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{ type: "rect", x: 20, y: 20, width: 60, height: 40,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          fillColor: "#AA1111", fillAlpha: 1, fillType: "solid",
          strokeStyle: "none", strokeWidth: 0 }] }] }],
    });
  });
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForTimeout(250);
  const run = await out.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const sx = c.width / 200, sy = c.height / 150;
    const d = g.getImageData(Math.round(50 * sx), Math.round(40 * sy), 1, 1).data;
    return { ink: [d[0], d[1], d[2]],
             traced: (window.Flashy.Output.lines || []).join(" ") };
  });
  await out.close();
  expect(errors).toEqual([]);
  /* The animation still plays. A movie whose document class failed should not
     be a blank page — that tells the viewer nothing. The reason goes to the
     Output, where a trace goes. */
  expect(run.ink[0]).toBeGreaterThan(run.ink[2]);
  expect(run.traced).toContain("ActionScript 3");
});

test("an AS3 frame script runs in the exported player", async ({ page, context }) => {
  await openEditor(page);
  await page.evaluate(() => {
    window._flashyEditor.loadDoc({
      width: 160, height: 120, fps: 12, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {},
      scriptDialect: "as3",
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear",
        script: "var n:int = 20; trace('frame says ' + n);",
        objects: [] }] }],
    });
  });
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  await out.waitForTimeout(300);
  const traced = await out.evaluate(() =>
    (window.Flashy.Output.lines || []).join(" "));
  await out.close();
  expect(errors).toEqual([]);
  // `var n:int` is not JavaScript, so this only runs if it was compiled.
  expect(traced).toContain("frame says 20");
});

test("the menus offer the dialect and the document class", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const text = JSON.stringify(window._flashyEditor.menus || []);
    return { action: text.indexOf("as3Document") >= 0,
             label: text.indexOf("ActionScript 3 Document Class") >= 0 };
  });
  expect(r.action).toBe(true);
  expect(r.label).toBe(true);
});
