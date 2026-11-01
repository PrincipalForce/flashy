// The debugger: breakpoints, real stepping, a watch list and a variable
// inspector.
//
// JavaScript cannot be suspended mid-statement, which is the usual reason a
// tool like this gets written off. But a GENERATOR can be — so a script being
// debugged is recompiled as a generator with a `yield` before each statement,
// and the debugger drives it one `next()` at a time. Stepping is therefore
// real rather than a simulation.
//
// The variable inspector works the same way round: the generator hands out an
// `eval` closure from inside its own body, which is the only way to read a
// local at all without writing a parser.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc } from "./helpers.js";

const kf = (script, over = {}) => ({
  index: 1, duration: 1, tweenType: "none", easing: "linear",
  script, objects: [], ...over,
});

function scriptDoc(script, frames = 1) {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF",
    totalFrames: frames,
    layers: [{ name: "L", visible: true, locked: false,
               keyframes: [kf(script, { duration: frames })] }],
    library: {},
  };
}

/** Start a session on a literal script, outside the Actions panel. */
const start = (page, src, opts = {}) =>
  page.evaluate(({ src, opts }) => window._flashyAI.dbgStart(src, opts),
                { src, opts });

/* ------------------------------------------------------------------ *
 * Finding the statement boundaries
 * ------------------------------------------------------------------ */

test("statement lines are found, and non-statements are not", async ({ page }) => {
  await openEditor(page);
  const lines = await page.evaluate(() => window._flashyAI.dbgStatementLines(
    [
      "var a = 1;",                 // 1  statement
      "",                           // 2  blank
      "// a comment",               // 3  comment
      "/* block",                   // 4  block comment opens
      "   still inside */",         // 5  still inside it
      "var b = {",                  // 6  statement, opens a brace
      "  x: 1,",                    // 7  INSIDE the literal
      "  y: 2",                     // 8  inside
      "};",                         // 9  closes it
      "if (a) {",                   // 10 statement
      "  b.x = 3;",                 // 11 statement
      "}",                          // 12 bare close
      'var s = "a { b";',           // 13 a brace inside a string
    ].join("\n")));

  /* 7 and 8 are the test that matters: a `yield` in the middle of an object
     literal is a syntax error, so the boundary check has to see that the
     brace on line 6 is still open. And line 13's brace is in a string, so it
     must not unbalance the count for anything after it. */
  expect(lines).toEqual([1, 6, 10, 11, 13]);
});

test("a case label is a boundary but never gets a yield", async ({ page }) => {
  await openEditor(page);
  const built = await page.evaluate(() => {
    const F = window._flashyAI;
    const src = [
      "var out = 0;",
      "switch (1) {",
      "  case 1:",
      "    out = 10;",
      "    break;",
      "  default:",
      "    out = 20;",
      "}",
    ].join("\n");
    const lines = F.dbgStatementLines(src);
    // The real proof is that it still compiles: a yield before `case` would
    // land outside the switch body.
    const r = F.dbgCompile(src);
    return { lines, compiled: !!r.fn, error: r.error || null };
  });
  expect(built.compiled).toBe(true);
  expect(built.error).toBeNull();
  // The labels themselves are not yield sites; the statements under them are.
  expect(built.lines).not.toContain(3);
  expect(built.lines).not.toContain(6);
  expect(built.lines).toContain(4);
  expect(built.lines).toContain(7);
});

test("a broken script reports a syntax error, not an instrumentation one", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    const bad = F.dbgCompile("var a = ;");
    return { error: !!bad.error, syntax: !!bad.syntax,
             instrumentation: !!bad.instrumentation };
  });
  /* The two are different problems with different fixes, so they get
     different messages rather than one shrug. */
  expect(out.error).toBe(true);
  expect(out.syntax).toBe(true);
  expect(out.instrumentation).toBe(false);
});

/* ------------------------------------------------------------------ *
 * Stepping
 * ------------------------------------------------------------------ */

test("stepping stops on each statement in order", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, scriptDoc(""));

  const walk = await page.evaluate(() => {
    const F = window._flashyAI;
    const src = ["var a = 1;", "var b = a + 1;", "var c = b * 2;"].join("\n");
    const seen = [F.dbgStart(src, {}).line];
    for (let i = 0; i < 4; i++) {
      const r = F.dbgStep();
      seen.push(r.done ? "done" : r.line);
      if (r.done) break;
    }
    F.dbgStop();
    return seen;
  });
  // Paused BEFORE each line, then finished.
  expect(walk).toEqual([1, 2, 3, "done"]);
});

test("a value can be read at the moment the script is paused", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, scriptDoc(""));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.dbgStart(["var a = 1;", "a = a + 41;", "var b = a;"].join("\n"), {});
    const beforeFirst = F.dbgEval("typeof a");
    F.dbgStep();                      // now paused before line 2: a is 1
    const afterOne = F.dbgEval("a");
    F.dbgStep();                      // paused before line 3: a is 42
    const afterTwo = F.dbgEval("a");
    F.dbgStop();
    return { beforeFirst: beforeFirst.value, afterOne: afterOne.value,
             afterTwo: afterTwo.value };
  });
  /* `a` is hoisted but unassigned before line 1 runs, 1 after it, and 42
     after line 2 -- which is exactly the question a debugger exists to
     answer. */
  expect(out.beforeFirst).toBe("undefined");
  expect(out.afterOne).toBe(1);
  expect(out.afterTwo).toBe(42);
});

test("a local can be WRITTEN from the debugger, not only read", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, scriptDoc(""));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.dbgStart(["var a = 1;", "var b = a * 10;", "var c = b;"].join("\n"), {});
    F.dbgStep();                      // before line 2
    F.dbgEval("a = 5");               // change it
    F.dbgStep();                      // line 2 runs with a = 5
    const b = F.dbgEval("b").value;
    F.dbgStop();
    return b;
  });
  // Which is what the eval closure buys: it is the script's own scope, so
  // assigning into it is a real change.
  expect(out).toBe(50);
});

/* ------------------------------------------------------------------ *
 * Breakpoints
 * ------------------------------------------------------------------ */

test("Continue runs to the next breakpoint and no further", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, scriptDoc(""));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.clearBreakpoints();
    F.toggleBreakpoint(4, "test");
    const src = ["var a = 1;", "var b = 2;", "var c = 3;", "var d = 4;",
                 "var e = 5;"].join("\n");
    // runToBreak: do not stop on the first statement.
    const begun = F.dbgStart(src, { key: "test", runToBreak: true });
    const atBreak = { line: begun.line, breakpoint: !!begun.breakpoint,
                      c: F.dbgEval("c").value, d: F.dbgEval("d").value };
    const rest = F.dbgContinue();
    F.dbgStop();
    F.clearBreakpoints();
    return { atBreak, done: !!rest.done };
  });
  // Paused on line 4, so c has run and d has not.
  expect(out.atBreak.line).toBe(4);
  expect(out.atBreak.breakpoint).toBe(true);
  expect(out.atBreak.c).toBe(3);
  expect(out.atBreak.d).toBeUndefined();
  // Nothing after it, so Continue finishes.
  expect(out.done).toBe(true);
});

test("a breakpoint belongs to one script, not to a line number", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.clearBreakpoints();
    F.toggleBreakpoint(2, "frame:a");
    const all = F.allBreakpoints();
    // Running the OTHER script must not stop: a frame script and a clip
    // handler can both have a line 2.
    const other = F.dbgStart("var a = 1;\nvar b = 2;\n",
                             { key: "frame:b", runToBreak: true });
    F.dbgStop();
    F.clearBreakpoints();
    return { all, otherDone: !!other.done };
  });
  expect(out.all).toEqual([{ key: "frame:a", line: 2 }]);
  expect(out.otherDone).toBe(true);
});

test("a breakpoint toggles off, and clearing removes the lot", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.clearBreakpoints();
    const on = F.toggleBreakpoint(3, "k");
    const off = F.toggleBreakpoint(3, "k");
    F.toggleBreakpoint(5, "k");
    const before = F.allBreakpoints().length;
    F.clearBreakpoints();
    return { on, off, before, after: F.allBreakpoints().length };
  });
  expect(out).toEqual({ on: true, off: false, before: 1, after: 0 });
});

test("clicking a line number in the gutter sets a breakpoint", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, scriptDoc("var a = 1;\nvar b = 2;\nstop();"));

  await page.evaluate(() => {
    const F = window._flashyAI;
    F.clearBreakpoints();
    F.setCurFrame(1);
    F.setSelection([]);
    F.fullRefresh();
  });

  const gutter = page.locator("#code-gutter .gutter-line");
  await expect(gutter).toHaveCount(3);
  await gutter.nth(1).click();
  // Marked, and really registered.
  await expect(gutter.nth(1)).toHaveClass(/bp/);
  const bps = await page.evaluate(() => window._flashyAI.allBreakpoints());
  expect(bps).toHaveLength(1);
  expect(bps[0].line).toBe(2);

  await gutter.nth(1).click();
  await expect(gutter.nth(1)).not.toHaveClass(/bp/);
  await page.evaluate(() => window._flashyAI.clearBreakpoints());
});

/* ------------------------------------------------------------------ *
 * The variable inspector and watches
 * ------------------------------------------------------------------ */

test("the inspector lists the script's own declarations", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, scriptDoc(""));

  const vars = await page.evaluate(() => {
    const F = window._flashyAI;
    F.dbgStart([
      "var speed = 4;",
      "let name = 'ball';",
      "const limit = 10;",
      "function helper() { return 1; }",
      "speed = speed + 1;",
    ].join("\n"), {});
    for (let i = 0; i < 5; i++) F.dbgStep();
    const out = F.dbgVariables().map((v) => [v.name, v.value]);
    F.dbgStop();
    return out;
  });
  const map = Object.fromEntries(vars);
  /* There is no way to enumerate a function's locals in JavaScript, so the
     list comes from the source and each name is then evaluated through the
     closure -- which is why a name that does not resolve is simply left out
     rather than shown as undefined. */
  expect(map.speed).toBe("5");
  expect(map.name).toBe('"ball"');
  expect(map.limit).toBe("10");
  expect(map.helper).toContain("function");
});

test("a watch is evaluated where the script is paused", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, scriptDoc(""));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.addWatch("a * 2");
    F.addWatch("notDefinedAnywhere");
    F.dbgStart(["var a = 3;", "a = 7;", "var b = a;"].join("\n"), {});
    F.dbgStep();                       // a is 3
    const first = F.watchValues();
    F.dbgStep();                       // a is 7
    const second = F.watchValues();
    F.dbgStop();
    F.removeWatch("a * 2");
    F.removeWatch("notDefinedAnywhere");
    return { first, second, left: F.watchValues().length };
  });
  expect(out.first[0]).toMatchObject({ expr: "a * 2", ok: true, value: "6" });
  expect(out.second[0].value).toBe("14");
  // A watch that does not resolve says why rather than vanishing.
  expect(out.first[1].ok).toBe(false);
  expect(out.first[1].value).toBeTruthy();
  expect(out.left).toBe(0);
});

test("a duplicate watch is not added twice", async ({ page }) => {
  await openEditor(page);
  const n = await page.evaluate(() => {
    const F = window._flashyAI;
    F.addWatch("x");
    F.addWatch("x");
    F.addWatch("  ");
    const count = F.watchValues().length;
    F.removeWatch("x");
    return count;
  });
  expect(n).toBe(1);
});

test("values are shown short enough to read", async ({ page }) => {
  await openEditor(page);
  const shown = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      undef: F.dbgShow(undefined),
      nul: F.dbgShow(null),
      num: F.dbgShow(1.5),
      str: F.dbgShow("hi"),
      long: F.dbgShow("x".repeat(200)).length,
      arr: F.dbgShow([1, 2, 3]),
      obj: F.dbgShow({ a: 1, b: 2, c: 3, d: 4, e: 5 }),
      fn: F.dbgShow(function named() {}),
    };
  });
  expect(shown).toMatchObject({
    undef: "undefined", nul: "null", num: "1.5", str: '"hi"',
    arr: "[3 items]",
  });
  // Truncated: a 200-character string in a 150px panel tells you nothing.
  expect(shown.long).toBeLessThan(80);
  expect(shown.obj).toBe("{a, b, c, d, …}");
  expect(shown.fn).toContain("named");
});

/* ------------------------------------------------------------------ *
 * The script runs for real
 * ------------------------------------------------------------------ */

test("the timeline verbs really work while stepping", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, scriptDoc("", 10));

  const frame = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setCurFrame(1);
    F.dbgStart("gotoAndStop(4);\nvar done = true;", {});
    F.dbgStep();                      // run the goto
    const at = F.curFrame();
    F.dbgStop();
    return at;
  });
  /* A debugger that runs the script against a fake timeline is testing the
     fake, so this is the editor's own playhead. */
  expect(frame).toBe(4);
});

test("an error in the script is reported with its line", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, scriptDoc(""));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    const r = F.dbgStart("var a = 1;\nnope.boom();\nvar b = 2;", {});
    const stepped = F.dbgStep();      // runs line 1
    const failed = F.dbgStep();       // line 2 throws
    const session = F.dbgSession();
    F.dbgStop();
    return { first: r.line, stepped: stepped.line,
             done: !!failed.done, error: failed.error,
             lineAtError: failed.line, sessionError: session && session.error };
  });
  expect(out.first).toBe(1);
  expect(out.done).toBe(true);
  expect(out.error).toBeTruthy();
  // The line it died on, not the one after it.
  expect(out.lineAtError).toBe(2);
});

test("a script that never finishes is stopped rather than hanging the editor", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, scriptDoc(""));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.clearBreakpoints();
    // No breakpoint, so Continue has to run the whole thing.
    const r = F.dbgStart("var i = 0;\nwhile (true) { i = i + 1; }\n",
                         { runToBreak: true });
    F.dbgStop();
    return { done: !!r.done, error: r.error || "" };
  });
  expect(out.done).toBe(true);
  expect(out.error).toContain("does not finish");
});

test("Debug Frame Script runs what the Actions panel is showing", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, scriptDoc("var greeting = 'hi';\nstop();", 5));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setCurFrame(1);
    F.setSelection([]);
    const r = F.debugCurrentScript({});
    const v = F.dbgEval("typeof greeting");
    F.dbgStop();
    return { ok: r.ok, line: r.line, before: v.value };
  });
  expect(out.ok).toBe(true);
  expect(out.line).toBe(1);
  expect(out.before).toBe("undefined");
});

test("an empty frame and an ActionScript one both say why they cannot be debugged", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, scriptDoc(""));

  const empty = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([]);
    return F.debugCurrentScript({});
  });
  expect(empty.ok).toBe(false);
  expect(empty.why).toContain("no script");

  await loadDoc(page, Object.assign(scriptDoc("stop();"), { scriptDialect: "as2" }));
  const as2 = await page.evaluate(() => {
    const F = window._flashyAI;
    F.setSelection([]);
    return F.debugCurrentScript({});
  });
  /* Stepping ActionScript would mean stepping a different compiler's output,
     so it is declined plainly rather than producing confident nonsense. */
  expect(as2.ok).toBe(false);
  expect(as2.why).toContain("ActionScript");
});

/* ------------------------------------------------------------------ *
 * The panel
 * ------------------------------------------------------------------ */

test("the panel shows the paused line, the variables and the breakpoints", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, scriptDoc("var total = 0;\ntotal = total + 7;\nstop();"));

  await page.evaluate(() => window._flashyEditor.doAction("winDebugger"));
  await expect(page.locator("#debuggerPanel")).toContainText("Not running");

  await page.evaluate(() => {
    const F = window._flashyAI;
    F.clearBreakpoints();
    F.setCurFrame(1);
    F.setSelection([]);
    F.toggleBreakpoint(3, F.scriptKey());
    F.debugCurrentScript({});
    F.dbgStep();
    F.updateDebuggerPanel();
  });

  const panel = page.locator("#debuggerPanel");
  await expect(panel).toContainText("Paused at line 2");
  await expect(panel.locator(".dbg-row", { hasText: "total" })).toHaveCount(1);
  await expect(panel).toContainText("line 3");

  await page.evaluate(() => {
    window._flashyAI.dbgStop();
    window._flashyAI.clearBreakpoints();
  });
});

/* ------------------------------------------------------------------ *
 * Loops
 *
 * A loop you cannot stop inside is a loop you cannot debug, and a one-line
 * `while (true) { … }` has no body line to put a yield on. So a loop header's
 * brace gets a yield right after it, which makes every loop both steppable
 * and interruptible.
 * ------------------------------------------------------------------ */

test("a loop body yields, so it can be stepped round", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, scriptDoc(""));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    const built = F.dbgCompile("var n = 0;\nwhile (n < 3) { n = n + 1; }\n");
    F.dbgStart("var n = 0;\nwhile (n < 3) { n = n + 1; }\n", {});
    // Step round the loop, reading n each time it pauses inside the body.
    const seen = [];
    for (let i = 0; i < 10; i++) {
      const r = F.dbgStep();
      if (r.done) break;
      seen.push(F.dbgEval("n").value);
    }
    F.dbgStop();
    return { loops: built.loops, seen };
  });
  expect(out.loops).toBe(1);
  /* The body really is visited three times, with n rising -- which is the
     whole point: a loop that only yielded at its header would be one step. */
  expect(out.seen.length).toBeGreaterThanOrEqual(4);
  expect(out.seen).toContain(0);
  expect(out.seen).toContain(1);
  expect(out.seen).toContain(2);
});

test("a for loop over a multi-line body yields in both places", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    const src = [
      "var total = 0;",
      "for (var i = 0; i < 2; i++) {",
      "  total = total + i;",
      "}",
      "var done = total;",
    ].join("\n");
    const built = F.dbgCompile(src);
    F.dbgStart(src, {});
    let steps = 0;
    for (;;) {
      const r = F.dbgStep();
      steps++;
      if (r.done || steps > 20) break;
    }
    F.dbgStop();
    return { lines: built.lines, loops: built.loops, steps };
  });
  expect(out.lines).toEqual([1, 2, 3, 5]);
  expect(out.loops).toBe(1);
  // Two passes through a two-yield body, plus the surrounding statements.
  expect(out.steps).toBeGreaterThan(5);
  expect(out.steps).toBeLessThan(20);
});

test("a do-while loop is instrumented too", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    const src = ["var n = 0;", "do {", "  n = n + 1;", "} while (n < 2);"].join("\n");
    const built = F.dbgCompile(src);
    return { compiled: !!built.fn, error: built.error || null, loops: built.loops };
  });
  expect(out.compiled).toBe(true);
  expect(out.error).toBeNull();
  expect(out.loops).toBe(1);
});

test("a nested function body gets no yield, and compiles correctly", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    const shapes = {
      expression: "var f = function (x) {\n  var y = x + 1;\n  return y;\n};\nvar z = f(1);",
      named: "function helper(a) {\n  var b = a * 2;\n  return b;\n}\nvar r = helper(3);",
      arrow: "var g = (x) => {\n  return x + 1;\n};\nvar h = g(1);",
      literal: "var o = {\n  a: 1,\n  b: 2\n};\nvar k = o.a;",
    };
    const res = {};
    Object.keys(shapes).forEach((k) => { res[k] = F.dbgCompile(shapes[k]).lines; });
    // And run one, to prove the generator really only stops outside.
    F.dbgStart(shapes.named, {});
    const seen = [];
    for (;;) { const r = F.dbgStep(); if (r.done) break; seen.push(r.line); }
    F.dbgStop();
    res.ran = seen;
    return res;
  });

  /* Outside a generator, `yield` is an ordinary identifier -- so a yield
     inside a nested function does NOT fail to compile, it parses as indexing
     a variable called `yield` and misbehaves at run time. Which makes this
     the one instrumentation mistake a syntax check would never catch. */
  expect(out.expression).toEqual([1, 5]);
  expect(out.named).toEqual([1, 5]);
  expect(out.arrow).toEqual([1, 4]);
  expect(out.literal).toEqual([1, 5]);
  expect(out.ran).toEqual([5]);
});

test("else, try and catch bodies are blocks, so their statements stop", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      els: F.dbgCompile("var a = 1;\nif (a) {\n  a = 2;\n} else {\n  a = 3;\n}").lines,
      tryc: F.dbgCompile("try {\n  var a = 1;\n} catch (e) {\n  var b = 2;\n}").lines,
    };
  });
  // `else {` and `try {` open blocks; reading them as values lost every
  // breakpoint inside, which is most of what you want to break on.
  expect(out.els).toEqual([1, 2, 3, 4, 5]);
  expect(out.tryc).toEqual([1, 2, 3, 4]);
});
