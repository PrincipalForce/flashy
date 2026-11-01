// Writing text, bitmaps, sounds, filters and scripts into a .swf.
//
// These were the five things the writer reported as missing rather than
// silently dropping, and each one was written off for a different reason. All
// five turned out to be reachable from what the project already had:
//
//   bitmaps  needed zlib, and deflate's STORED block type is valid deflate.
//   sound    needed MP3, and SWF has allowed raw PCM since version 1.
//   text     needed a font parser, and the tracer already makes outlines.
//   filters  needed PlaceObject3, which the reader already parses.
//   scripts  needed a compiler, so five verbs are assembled and the rest is
//            reported with the line that stopped it.
//
// Every spec round-trips through the project's own parser, which is the point:
// the writer is built to match what the reader reads, so the reader is its
// oracle. SWF is a format where one misplaced bit makes everything after it
// unreadable, and two independent interpretations of the spec would have no
// such check.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc } from "./helpers.js";

const obj = (type, over = {}) => ({
  type, x: 0, y: 0, width: 60, height: 40,
  rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, alpha: 1,
  fillColor: "#FF0000", fillAlpha: 1, fillType: "solid",
  strokeColor: "#0000FF", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

function docWith(objs, extra = {}) {
  return {
    width: 300, height: 200, fps: 12, backgroundColor: "#102030", totalFrames: 1,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: objs,
      }],
    }],
    library: {},
    ...extra,
  };
}

/** Write and read back, keeping everything these specs look at. */
const roundTrip = (page) =>
  page.evaluate(async () => {
    const r = window._flashyAI.exportSWF();
    if (!r.ok) return { ok: false, reason: r.reason };
    const parsed = await window.Flashy.SWF.parse(r.bytes.buffer);
    const chars = {};
    Object.keys(parsed.characters || {}).forEach((id) => {
      const c = parsed.characters[id];
      chars[id] = {
        kind: c.kind,
        text: c.text != null ? c.text : null,
        glyphCount: c.glyphs ? Object.keys(c.glyphs).length : null,
        width: c.width != null ? c.width : null,
        height: c.height != null ? c.height : null,
        rgbaLength: c.rgba ? c.rgba.length : null,
        rate: c.rate != null ? c.rate : null,
        sampleCount: c.sampleCount != null ? c.sampleCount : null,
        stereo: c.stereo != null ? c.stereo : null,
        format: c.format != null ? c.format : null,
        itemCount: (c.items || []).length,
        fillKind: (c.items || [])[0] && (c.items || [])[0].fill
          ? (c.items || [])[0].fill.type : null,
      };
    });
    const frames = (parsed.timeline.frames || []).map((f) => ({
      label: f.label,
      actions: (f.actions || []).length,
      commands: f.commands.map((c) => ({
        type: c.type, id: c.id, depth: c.depth,
        filters: (c.filters || []).map((x) => x.type),
      })),
      sounds: (f.sounds || []).map((s) => ({ id: s.id })),
    }));
    /* Fonts are their OWN table in the parse result, not characters: a font
       is not placeable, and the reader keeps it aside so a DefineText can
       look its glyph indices up. */
    const fonts = Object.keys(parsed.fonts || {}).map((id) => ({
      id, name: parsed.fonts[id].name,
      glyphCount: Object.keys(parsed.fonts[id].glyphs || {}).length,
      emSize: parsed.fonts[id].emSize,
    }));
    return { ok: true, bytes: r.bytes.length, report: r.report,
             missing: r.missing, warnings: parsed.warnings,
             chars, fonts, frames };
  });

const text = (over = {}) => ({
  type: "text", x: 20, y: 20, width: 200, height: 40,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  text: "AB", font: "Georgia", fontSize: 32, textAlign: "left", lineHeight: 1.2,
  textType: "static", embedFont: true,
  fillColor: "#00AA00", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

/* ------------------------------------------------------------------ *
 * zlib by the stored route
 * ------------------------------------------------------------------ */

test("a stored deflate stream is a valid zlib stream", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(async () => {
    const W = window.FlashySWFWriter;
    const payload = new Uint8Array(1000);
    for (let i = 0; i < payload.length; i++) payload[i] = (i * 7) & 0xff;
    const z = new Uint8Array(W.zlibStore(payload));
    /* The browser's own inflater is the check. If DecompressionStream is not
       available the header is still checkable, which is the part most likely
       to be wrong. */
    let back = null;
    if (typeof DecompressionStream !== "undefined") {
      const ds = new DecompressionStream("deflate");
      const stream = new Blob([z]).stream().pipeThrough(ds);
      back = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    return {
      header: [z[0], z[1]],
      // CMF/FLG must be a multiple of 31, which the spec requires.
      checksum: (z[0] * 256 + z[1]) % 31,
      roundTripped: back ? Array.from(back).every((v, i) => v === payload[i]) : null,
      sameLength: back ? back.length === payload.length : null,
      adler: W.adler32(payload) >>> 0,
    };
  });
  expect(out.header).toEqual([0x78, 0x01]);
  expect(out.checksum).toBe(0);
  if (out.roundTripped !== null) {
    /* Round-tripped through a real inflater. It compresses nothing, which is
       the honest trade -- but a file that cannot be opened would be worse
       than a big one. */
    expect(out.roundTripped).toBe(true);
    expect(out.sameLength).toBe(true);
  }
  expect(out.adler).toBeGreaterThan(0);
});

test("a payload bigger than one stored block is split correctly", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(async () => {
    const W = window.FlashySWFWriter;
    // Two and a bit blocks: 65535 is the largest a stored block can be.
    const payload = new Uint8Array(140000);
    for (let i = 0; i < payload.length; i++) payload[i] = i & 0xff;
    const z = new Uint8Array(W.zlibStore(payload));
    if (typeof DecompressionStream === "undefined") return { skipped: true };
    const ds = new DecompressionStream("deflate");
    const stream = new Blob([z]).stream().pipeThrough(ds);
    const back = new Uint8Array(await new Response(stream).arrayBuffer());
    return { len: back.length, first: back[0], last: back[back.length - 1],
             matches: Array.from(back).every((v, i) => v === payload[i]) };
  });
  if (!out.skipped) {
    expect(out.len).toBe(140000);
    expect(out.matches).toBe(true);
  }
});

/* ------------------------------------------------------------------ *
 * Bitmaps
 * ------------------------------------------------------------------ */

test("a bitmap becomes a lossless character, and a shape that places it", async ({ page }) => {
  await openEditor(page);
  // A 2x2 PNG: red, green, blue and a half-transparent white.
  await loadDoc(page, docWith([
    { ...obj("bitmap"), bitmapAsset: "tile", width: 80, height: 80,
      smoothing: true },
  ], {
    bitmaps: { tile: { name: "tile", mediaType: "image/png", width: 2, height: 2,
      data: "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP4z8" +
            "DwnwEKmGAMGAcAVfkFBwR8WgcAAAAASUVORK5CYII=", folder: "" } },
  }));

  // The image has to be decoded before the writer can read its pixels.
  await page.waitForFunction(() =>
    !!(window.Flashy.Bitmaps && window.Flashy.Bitmaps.get("tile")), null,
    { timeout: 8000 });

  const r = await roundTrip(page);
  expect(r.ok).toBe(true);
  expect(r.warnings).toEqual([]);

  const ids = Object.keys(r.chars);
  const bmp = ids.map((i) => r.chars[i]).find((c) => c.rgbaLength);
  expect(bmp).toBeTruthy();
  // 2x2 pixels, read back as RGBA by the project's own parser.
  expect(bmp.width).toBe(2);
  expect(bmp.height).toBe(2);
  expect(bmp.rgbaLength).toBe(16);

  /* And a shape that uses it as a clipped-bitmap FILL, because a bitmap
     character cannot be placed at a size on its own -- which is how Flash
     did it too. */
  const shape = ids.map((i) => r.chars[i]).find((c) => c.fillKind === "bitmap");
  expect(shape).toBeTruthy();
  expect(r.report.bitmaps).toBe(1);
  expect(r.report.skipped.bitmap).toBe(0);
  expect(r.missing).not.toContain("bitmap");
});

test("a bitmap whose pixels cannot be read is reported, not dropped silently", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    { ...obj("bitmap"), bitmapAsset: "ghost", width: 40, height: 40 },
  ], {
    // An asset the editor never decoded: there are no pixels to write.
    bitmaps: { ghost: { name: "ghost", mediaType: "image/png", width: 0,
                        height: 0, data: "", folder: "" } },
  }));

  const r = await roundTrip(page);
  expect(r.ok).toBe(true);
  expect(r.report.bitmaps).toBe(0);
  expect(r.report.skipped.bitmap).toBe(1);
  expect(r.missing).toContain("bitmap");
});

/* ------------------------------------------------------------------ *
 * Sound
 * ------------------------------------------------------------------ */

test("a sound becomes DefineSound with real samples, and StartSound on its frame", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    ...docWith([obj("rect")]),
    totalFrames: 3,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [{
      index: 1, duration: 3, tweenType: "none", easing: "linear", script: "",
      objects: [obj("rect")],
      sound: { asset: "blip", sync: "event", volume: 1, loop: false, repeat: 0 },
    }] }],
    /* Real base64: an asset with no data is dropped by the serialiser, which
       is right -- there would be nothing to play -- so an empty one would
       test the wrong thing. */
    sounds: { blip: { name: "blip", mediaType: "audio/wav", duration: 0.1,
                      data: "UklGRgAAAABXQVZF" } },
  });

  const r = await page.evaluate(async () => {
    /* A decoded buffer standing in for a real one: the writer is handed
       already-decoded audio because a decode is asynchronous and `write` is
       not. */
    const n = 2205;                       // 50ms at 44.1kHz
    const data = new Float32Array(n);
    for (let i = 0; i < n; i++) data[i] = Math.sin(i / 20) * 0.8;
    window.Flashy.Sound._buffers.blip = {
      sampleRate: 44100, numberOfChannels: 1, length: n,
      getChannelData: () => data,
    };
    const out = window._flashyAI.exportSWF();
    const parsed = await window.Flashy.SWF.parse(out.bytes.buffer);
    delete window.Flashy.Sound._buffers.blip;
    const chars = Object.keys(parsed.characters).map((k) => parsed.characters[k]);
    const snd = chars.find((c) => c.kind === "sound");
    return {
      report: out.report, missing: out.missing, warnings: parsed.warnings,
      sound: snd ? { rate: snd.rate, count: snd.sampleCount,
                     stereo: snd.stereo, format: snd.format,
                     bits: snd.bits, mime: snd.mime } : null,
      started: (parsed.timeline.frames[0].sounds || []).length,
    };
  });

  expect(r.warnings).toEqual([]);
  expect(r.report.sounds).toBe(1);
  expect(r.sound).toBeTruthy();
  /* SWF has four sample rates and they are an enum, not a number, so 44100 is
     kept as-is -- it is one of them. */
  expect(r.sound.rate).toBe(44100);
  expect(r.sound.count).toBe(2205);
  expect(r.sound.stereo).toBe(false);
  // Format 0: uncompressed PCM, which is why no MP3 encoder is needed.
  expect(r.sound.format).toBe(0);
  expect(r.sound.bits).toBe(16);
  // The reader turns raw PCM back into a playable WAV, so the samples really
  // are there and really are readable.
  expect(r.sound.mime).toBe("audio/wav");
  expect(r.started).toBe(1);
  expect(r.missing).not.toContain("sound");
});

test("a rate SWF does not have is resampled to the nearest it does", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    ...docWith([obj("rect")]),
    layers: [{ name: "L", visible: true, locked: false, keyframes: [{
      index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
      objects: [obj("rect")],
      sound: { asset: "odd", sync: "event", volume: 1 },
    }] }],
    sounds: { odd: { name: "odd", mediaType: "audio/wav", duration: 1,
                     data: "UklGRgAAAABXQVZF" } },
  });

  const r = await page.evaluate(async () => {
    const n = 16000;                      // one second at 16kHz
    const data = new Float32Array(n);
    window.Flashy.Sound._buffers.odd = {
      sampleRate: 16000, numberOfChannels: 2, length: n,
      getChannelData: () => data,
    };
    const out = window._flashyAI.exportSWF();
    const parsed = await window.Flashy.SWF.parse(out.bytes.buffer);
    delete window.Flashy.Sound._buffers.odd;
    const snd = Object.keys(parsed.characters)
      .map((k) => parsed.characters[k]).find((c) => c.kind === "sound");
    return { rate: snd && snd.rate, count: snd && snd.sampleCount,
             stereo: snd && snd.stereo, warnings: parsed.warnings };
  });
  // 16000 is nearer 11025 than 22050, and the samples are stretched to match.
  expect(r.rate).toBe(11025);
  expect(r.count).toBeCloseTo(11025, -2);
  expect(r.stereo).toBe(true);
  expect(r.warnings).toEqual([]);
});

test("a sound with no decoded buffer is reported", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    ...docWith([obj("rect")]),
    layers: [{ name: "L", visible: true, locked: false, keyframes: [{
      index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
      objects: [obj("rect")],
      sound: { asset: "nope", sync: "event", volume: 1 },
    }] }],
    sounds: { nope: { name: "nope", mediaType: "audio/mpeg", duration: 1,
                      data: "SUQzAwAAAAAA" } },
  });
  const r = await roundTrip(page);
  expect(r.report.sounds).toBe(0);
  expect(r.report.skipped.sound).toBe(1);
  expect(r.missing).toContain("sound");
});

/* ------------------------------------------------------------------ *
 * Fonts and text
 * ------------------------------------------------------------------ */

test("an embedded face becomes a font, and the text becomes readable glyphs", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text()]));
  await page.evaluate(() =>
    window._flashyAI.embedFontFace("Georgia", { chars: "AB" }));

  const r = await roundTrip(page);
  expect(r.ok).toBe(true);
  expect(r.warnings).toEqual([]);

  const chars = Object.keys(r.chars).map((k) => r.chars[k]);
  expect(r.fonts).toHaveLength(1);
  expect(r.fonts[0].glyphCount).toBe(2);
  // The em square the outlines were written into.
  expect(r.fonts[0].emSize).toBe(1024);

  /* The reader turns a DefineText back into a STRING by looking its glyph
     indices up in the font's code table. So this is the real check that the
     offset table, the code table and the glyph order all agree -- get any one
     wrong and the text comes back as other letters. */
  const txt = chars.find((c) => c.text != null);
  expect(txt).toBeTruthy();
  expect(txt.text).toBe("AB");

  expect(r.report.fonts).toBe(1);
  expect(r.report.texts).toBe(1);
  expect(r.report.skipped.text).toBe(0);
  expect(r.missing).not.toContain("text");
});

test("a glyph's outline really is written, curves and all", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const W = window.FlashySWFWriter;
    // A triangle and a curve, in em units.
    const straight = W.glyphShape([0, 0, 0, 1, 0.5, 0, 1, 0.5, 0.5, 3]);
    const curved = W.glyphShape([0, 0, 0, 2, 0.25, 0.5, 0.5, 0, 3]);
    return { straight: straight.bytes.length, curved: curved.bytes.length,
             firstByte: straight.bytes[0] };
  });
  // Both produce real records; the first byte is the two style counts, zero.
  expect(out.straight).toBeGreaterThan(4);
  expect(out.curved).toBeGreaterThan(4);
  expect(out.firstByte).toBe(0);
});

test("a face that was never embedded is reported with the text it could not write", async ({ page }) => {
  await openEditor(page);
  // embedFont is on but nothing has been traced, so there are no glyphs.
  await loadDoc(page, docWith([text({ font: "Helvetica" })]));

  const r = await roundTrip(page);
  expect(r.report.texts).toBe(0);
  expect(r.report.fonts).toBe(0);
  expect(r.report.skipped.text).toBe(1);
  /* The glyphs ARE the text in a DefineText, so a face that was never
     embedded leaves nothing to write. Saying so beats shipping a movie with
     the words missing. */
  expect(r.missing).toContain("text block");
});

test("a character the face has no glyph for is counted, not guessed at", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([text({ text: "AB?" })]));
  await page.evaluate(() =>
    window._flashyAI.embedFontFace("Georgia", { chars: "AB" }));

  const r = await roundTrip(page);
  const txt = Object.keys(r.chars).map((k) => r.chars[k]).find((c) => c.text != null);
  expect(txt.text).toBe("AB");
  // The "?" had no glyph, and the report says one went.
  expect(r.report.glyphsDropped).toBe(1);
});

/* ------------------------------------------------------------------ *
 * Filters
 * ------------------------------------------------------------------ */

test("the four filters SWF shares with Flashy are written into PlaceObject3", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    obj("rect", { filters: [
      { type: "blur", enabled: true, blurX: 8, blurY: 8, quality: 2 },
      { type: "glow", enabled: true, blur: 6, color: 0xFF3366, alpha: 1, strength: 2 },
      { type: "dropShadow", enabled: true, distance: 5, angle: 45, blur: 5,
        color: 0, alpha: 0.5, strength: 1 },
      { type: "bevel", enabled: true, distance: 4, angle: 45, blur: 4,
        highlightColor: 0xFFFFFF, shadowColor: 0, strength: 1 },
    ] }),
  ]));

  const r = await roundTrip(page);
  expect(r.ok).toBe(true);
  expect(r.warnings).toEqual([]);

  const place = r.frames[0].commands.find((c) => c.filters.length);
  expect(place).toBeTruthy();
  /* Read back by the project's own parser, which already understood
     PlaceObject3's filter list -- so the list is really there and really
     parses, rather than being bytes that happen not to crash. */
  expect(place.filters.sort()).toEqual(["bevel", "blur", "dropShadow", "glow"].sort());
  expect(r.report.filters).toBe(4);
  expect(r.report.skipped.filter).toBe(0);
});

test("a gradient filter is reported rather than approximated", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    obj("rect", { filters: [
      { type: "blur", enabled: true, blurX: 4, blurY: 4 },
      { type: "gradientGlow", enabled: true, blur: 10, strength: 1,
        stops: [{ ratio: 0, color: 0xFFFFFF, alpha: 0 },
                { ratio: 255, color: 0xFF3366, alpha: 1 }] },
    ] }),
  ]));

  const r = await roundTrip(page);
  const place = r.frames[0].commands.find((c) => c.filters.length);
  // The blur goes; the gradient glow does not, and is counted.
  expect(place.filters).toEqual(["blur"]);
  expect(r.report.filters).toBe(1);
  expect(r.report.skipped.filter).toBe(1);
  /* A ramp is a different record with its own stop list, so writing a plain
     glow in its place would look wrong -- which is worse than saying it went. */
  expect(r.missing).toContain("filtered object");
});

test("an object with no filters still uses the cheaper tag", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([obj("rect")]));
  const r = await roundTrip(page);
  const place = r.frames[0].commands.find((c) => c.type === "place");
  expect(place).toBeTruthy();
  // No filter list, and the report agrees.
  expect(place.filters).toEqual([]);
  expect(r.report.filters).toBe(0);
});

/* ------------------------------------------------------------------ *
 * Scripts
 * ------------------------------------------------------------------ */

test("the five verbs assemble, and anything else names the line", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const A = window.FlashySWFWriter.assembleActions;
    return {
      stop: A("stop();"),
      play: A("play();"),
      gotoStop: A("gotoAndStop(5);"),
      gotoPlay: A("gotoAndPlay(2);"),
      gotoLabel: A('gotoAndStop("menu");'),
      trace: A('trace("hello");'),
      comments: A("// a note\n/* and\n   another */\nstop();"),
      all: A("trace('go');\ngotoAndPlay(3);"),
      // Anything the assembler does not know stops it, with the line named.
      unknown: A("var x = compute();"),
    };
  });

  // Stop is one opcode plus the end marker.
  expect(out.stop.bytes).toEqual([0x07, 0x00]);
  expect(out.play.bytes).toEqual([0x06, 0x00]);
  // GotoFrame is zero-based, so frame 5 is 4.
  expect(out.gotoStop.bytes).toEqual([0x81, 0x02, 0x00, 0x04, 0x00, 0x00]);
  // gotoAndPlay is the same jump followed by Play.
  expect(out.gotoPlay.bytes).toEqual([0x81, 0x02, 0x00, 0x01, 0x00, 0x06, 0x00]);
  // A label goes through GotoLabel with its string.
  expect(out.gotoLabel.bytes[0]).toBe(0x8C);
  expect(out.trace.bytes[0]).toBe(0x96);
  // Comments and blank lines are skipped, so this is just a stop.
  expect(out.comments.bytes).toEqual([0x07, 0x00]);
  expect(out.all.bytes.length).toBeGreaterThan(8);
  /* Named rather than shrugged at: a real AS2 compiler is a parser, a scope
     model and a bytecode generator, and a .swf carrying half-compiled scripts
     would be worse than one that says which it left out. */
  expect(out.unknown.bytes).toBeUndefined();
  expect(out.unknown.unsupported).toBe("var x = compute();");
});

test("a frame script becomes DoAction and comes back out", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    ...docWith([obj("rect")]),
    totalFrames: 2,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [
      { index: 1, duration: 1, tweenType: "none", easing: "linear",
        script: 'trace("frame one");', objects: [obj("rect")] },
      { index: 2, duration: 1, tweenType: "none", easing: "linear",
        script: "stop();", objects: [obj("rect")] },
    ] }],
  });

  const r = await roundTrip(page);
  expect(r.ok).toBe(true);
  expect(r.warnings).toEqual([]);
  expect(r.report.scripts).toBe(2);
  expect(r.report.skipped.script).toBe(0);
  // The reader parses DoAction, so both frames come back carrying actions.
  expect(r.frames[0].actions).toBeGreaterThan(0);
  expect(r.frames[1].actions).toBeGreaterThan(0);
  expect(r.missing).not.toContain("frame script");
});

test("a script the assembler cannot write names the line in the report", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    ...docWith([obj("rect")]),
    layers: [{ name: "L", visible: true, locked: false, keyframes: [{
      index: 1, duration: 1, tweenType: "none", easing: "linear",
      script: "stop();\nvar counter = 0;", objects: [obj("rect")],
    }] }],
  });

  const r = await roundTrip(page);
  expect(r.report.scripts).toBe(0);
  expect(r.report.skipped.script).toBe(1);
  /* The LINE, not just a count: knowing which line is the difference between
     fixing it and guessing. */
  expect(r.report.unsupportedScript).toBe("var counter = 0;");
  expect(r.missing).toContain("var counter = 0;");
});

/* ------------------------------------------------------------------ *
 * The report
 * ------------------------------------------------------------------ */

test("the report says what was written, not only what was left out", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([
    obj("rect"),
    text(),
    obj("oval", { filters: [{ type: "blur", enabled: true, blurX: 4, blurY: 4 }] }),
  ]));
  await page.evaluate(() =>
    window._flashyAI.embedFontFace("Georgia", { chars: "AB" }));

  const out = await page.evaluate(() => {
    const r = window._flashyAI.exportSWF();
    return { report: r.report,
             wrote: window.FlashySWFWriter.wroteText(r.report),
             missing: r.missing };
  });
  /* The old report could only say what it had failed at, which made a movie
     with no sound indistinguishable from one whose sound had been dropped. */
  expect(out.wrote).toContain("shape");
  expect(out.wrote).toContain("text block");
  expect(out.wrote).toContain("embedded font");
  expect(out.wrote).toContain("filter");
  expect(out.missing).toBe("");
});

test("a movie with all five kinds in it parses without a warning", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    ...docWith([]),
    totalFrames: 2,
    layers: [{ name: "L", visible: true, locked: false, keyframes: [
      { index: 1, duration: 1, tweenType: "none", easing: "linear",
        script: "stop();",
        objects: [
          obj("rect"),
          text(),
          obj("oval", { x: 100,
            filters: [{ type: "glow", enabled: true, blur: 6, color: 0xFF0000,
                        alpha: 1, strength: 1 }] }),
        ],
        sound: { asset: "blip", sync: "event", volume: 1 } },
      { index: 2, duration: 1, tweenType: "none", easing: "linear",
        script: "", objects: [obj("rect")], label: "second" },
    ] }],
    sounds: { blip: { name: "blip", mediaType: "audio/wav", duration: 0.05,
                      data: "UklGRgAAAABXQVZF" } },
  });
  await page.evaluate(() =>
    window._flashyAI.embedFontFace("Georgia", { chars: "AB" }));

  const r = await page.evaluate(async () => {
    const n = 1000;
    const data = new Float32Array(n);
    window.Flashy.Sound._buffers.blip = {
      sampleRate: 22050, numberOfChannels: 1, length: n,
      getChannelData: () => data,
    };
    const out = window._flashyAI.exportSWF();
    const parsed = await window.Flashy.SWF.parse(out.bytes.buffer);
    delete window.Flashy.Sound._buffers.blip;
    return { warnings: parsed.warnings, report: out.report,
             frames: parsed.timeline.frames.length,
             labels: parsed.timeline.frames.map((f) => f.label || null) };
  });
  /* The whole point of using the project's own reader as the oracle: one
     misplaced bit makes everything after it unreadable, so a clean parse of a
     movie carrying all five kinds is the strongest check available. */
  expect(r.warnings).toEqual([]);
  expect(r.report.texts).toBe(1);
  expect(r.report.fonts).toBe(1);
  expect(r.report.sounds).toBe(1);
  expect(r.report.filters).toBe(1);
  expect(r.report.scripts).toBe(1);
  expect(r.frames).toBe(2);
  expect(r.labels[1]).toBe("second");
});
