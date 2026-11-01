// HTML templates and alignment, printing and matching the stage to paper, and
// per-sound export settings.
//
// All three are about the movie leaving the editor. A template matters because
// an exported cartoon usually has to land inside somebody else's page;
// printing matters because a storyboard gets handed round a room; per-sound
// settings matter because one music bed and twenty blips want completely
// different treatment and a document-wide quality is wrong for both.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction } from "./helpers.js";

const kf = (objects, over = {}) => ({
  index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
  objects, ...over,
});

const box = (over = {}) => ({
  type: "rect", x: 20, y: 20, width: 100, height: 80,
  rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
  fillColor: "#CC3344", fillAlpha: 1, fillType: "solid",
  strokeColor: "#000000", strokeAlpha: 1, strokeWidth: 0, strokeStyle: "none",
  ...over,
});

function docWith(objs, frames = 1) {
  return {
    width: 300, height: 200, fps: 24, backgroundColor: "#FFFFFF",
    totalFrames: frames,
    layers: [{ name: "L", visible: true, locked: false,
               keyframes: [kf(objs, { duration: frames })] }],
    library: {},
  };
}

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

test("the placeholders are Flash's own, and every one is documented", async ({ page }) => {
  await openEditor(page);
  const ph = await page.evaluate(() => window._flashyAI.HTML_PLACEHOLDERS);
  const names = ph.map((p) => p[0]);
  /* `$XX$` is Flash's convention, so a template written for Flash reads the
     same way here. */
  expect(names).toContain("$MOVIE$");
  expect(names).toContain("$TITLE$");
  expect(names).toContain("$WIDTH$");
  expect(names).toContain("$ALIGN$");
  // Every one carries an explanation: a placeholder language is unusable
  // without the list in front of you.
  expect(ph.every((p) => typeof p[1] === "string" && p[1].length > 5)).toBe(true);
});

test("filling a template substitutes every placeholder and leaves the rest", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      filled: F.fillHTMLTemplate(
        "<h1>$TITLE$</h1><p>$WIDTH$x$HEIGHT$</p>$MOVIE$",
        { TITLE: "Hi", WIDTH: 10, HEIGHT: 20, MOVIE: "<canvas>" }),
      // A placeholder nobody knows is left alone rather than deleted: it is
      // probably meant for whatever consumes the page next.
      unknown: F.fillHTMLTemplate("$NOPE$ $TITLE$", { TITLE: "x" }),
      // A replacement containing $& or $1 must survive intact, which a regex
      // replace would mangle -- and $MOVIE$ is a whole script.
      dollars: F.fillHTMLTemplate("$MOVIE$", { MOVIE: "a $& b $1 c" }),
      missing: F.fillHTMLTemplate("[$TITLE$]", {}),
    };
  });
  expect(out.filled).toBe("<h1>Hi</h1><p>10x20</p><canvas>");
  expect(out.unknown).toBe("$NOPE$ x");
  expect(out.dollars).toBe("a $& b $1 c");
  expect(out.missing).toBe("[]");
});

test("alignment becomes CSS that places the canvas without scaling it", async ({ page }) => {
  await openEditor(page);
  const css = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      centre: F.alignCSS("center", "middle"),
      topLeft: F.alignCSS("left", "top"),
      bottomRight: F.alignCSS("right", "bottom"),
      nonsense: F.alignCSS("sideways", "diagonally"),
    };
  });
  expect(css.centre).toContain("justify-content:center");
  expect(css.topLeft).toContain("justify-content:flex-start");
  expect(css.topLeft).toContain("align-items:flex-start");
  expect(css.bottomRight).toContain("flex-end");
  // An unknown value centres rather than producing invalid CSS.
  expect(css.nonsense).toContain("center");
  /* No width or height: scaling the canvas is a separate setting, and
     conflating the two was Flash's own mistake. */
  expect(css.centre).not.toContain("width");
});

test("the export uses the template when there is one", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box()]));
  await page.evaluate(() => {
    const p = window._flashyAI.docPublish();
    p.title = "My Cartoon";
    p.template = "<!DOCTYPE html><html><head><title>$TITLE$</title>" +
                 "<style>$STYLE$ $ALIGN$</style></head>" +
                 "<body class=\"mine\" data-size=\"$WIDTH$x$HEIGHT$\">$MOVIE$</body></html>";
  });

  const html = await downloadFromAction(page, "export");
  expect(html).toContain('class="mine"');
  expect(html).toContain('data-size="300x200"');
  expect(html).toContain("<title>My Cartoon</title>");
  // The movie really is in there, all of it.
  expect(html).toContain('id="stage"');
  expect(html).toContain("__run");
  expect(html).toContain("Flashy");
});

test("the alignment reaches the default page too", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box()]));
  await page.evaluate(() => {
    const p = window._flashyAI.docPublish();
    p.template = null;
    p.hAlign = "left";
    p.vAlign = "top";
  });
  const html = await downloadFromAction(page, "export");
  expect(html).toContain("justify-content:flex-start");
  expect(html).toContain("align-items:flex-start");
});

test("the publish settings remember the template and the alignment", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box()]));
  const back = await page.evaluate(() => {
    const p = window._flashyAI.docPublish();
    p.template = "$MOVIE$";
    p.hAlign = "right";
    p.vAlign = "bottom";
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const q = window._flashyAI.docPublish();
    return { template: q.template, h: q.hAlign, v: q.vAlign };
  });
  expect(back).toEqual({ template: "$MOVIE$", h: "right", v: "bottom" });
});

test("a template with no $MOVIE$ is refused, because the page would have none", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box()]));
  await page.evaluate(() => window._flashyEditor.doAction("htmlTemplate"));

  await page.locator("#fy-dialog textarea").fill("<html><body>nothing here</body></html>");
  await page.locator("#fy-dialog .fy-dialog-btn.primary").click();
  // Still open, with the reason.
  await expect(page.locator("#fy-dialog")).toContainText("no $MOVIE$");

  const stored = await page.evaluate(() => window._flashyAI.docPublish().template);
  expect(stored).toBeNull();
});

/* ------------------------------------------------------------------ *
 * Printing
 * ------------------------------------------------------------------ */

test("the stage can be sized to paper, and the artwork does not move", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box({ x: 10, y: 10 })]));

  const r = await page.evaluate(() => window._flashyAI.matchStageToPaper("a4", false));
  // A4 at 72 points to the inch, less a half-inch margin each side.
  expect(r).toMatchObject({ ok: true, width: 523, height: 770 });

  const at = await page.evaluate(() => {
    const o = window._flashyAI.currentLayers()[0].getKeyframeAt(1).objects[0];
    return [o.x, o.y];
  });
  /* Deliberately not moved: the point of this command is to find out what
     fits, and shifting everything would hide the answer. */
  expect(at).toEqual([10, 10]);

  const land = await page.evaluate(() => window._flashyAI.matchStageToPaper("a4", true));
  expect(land.width).toBe(770);
  expect(land.height).toBe(523);

  const bad = await page.evaluate(() => window._flashyAI.matchStageToPaper("foolscap"));
  expect(bad.ok).toBe(false);
});

test("a print page holds one frame per sheet, or a contact sheet", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box()], 6));

  const one = await page.evaluate(() =>
    window._flashyAI.buildPrintHTML({ from: 1, to: 3, perPage: 1, paper: "a4" }));
  expect(one.ok).toBe(true);
  expect(one.frames).toBe(3);
  // A real page break between frames, so each gets its own sheet.
  expect(one.html).toContain("page-break-after:always");
  expect(one.html).toContain("Frame 1");
  expect(one.html).toContain("Frame 3");
  // The frames are rasterised, not described.
  expect(one.html).toContain("data:image/png");

  const sheet = await page.evaluate(() =>
    window._flashyAI.buildPrintHTML({ from: 1, to: 4, perPage: 4, paper: "a4" }));
  // Four to a page lays out as a grid and does not break between them.
  expect(sheet.html).toContain("repeat(2,1fr)");
  expect(sheet.html).not.toContain("page-break-after:always");
});

test("landscape swaps the page, and the range is clamped to the movie", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box()], 4));

  const land = await page.evaluate(() =>
    window._flashyAI.buildPrintHTML({ from: 1, to: 1, paper: "a5", landscape: true }));
  expect(land.pageW).toBe(595);
  expect(land.pageH).toBe(420);
  expect(land.html).toContain("size:landscape");

  const over = await page.evaluate(() =>
    window._flashyAI.buildPrintHTML({ from: 1, to: 99, perPage: 4 }));
  // Four frames in the movie, so four sheets -- not 99.
  expect(over.frames).toBe(4);
});

test("every paper size is a real size at 72dpi", async ({ page }) => {
  await openEditor(page);
  const sizes = await page.evaluate(() => window._flashyAI.PAPER_SIZES);
  expect(Object.keys(sizes).sort()).toEqual(["a3", "a4", "a5", "legal", "letter"]);
  // A4 is 210x297mm, which is 595x842 points.
  expect(sizes.a4).toMatchObject({ w: 595, h: 842 });
  expect(sizes.letter).toMatchObject({ w: 612, h: 792 });
  // A5 is half of A4 the long way.
  expect(sizes.a5.h).toBe(sizes.a4.w);
});

/* ------------------------------------------------------------------ *
 * Per-sound export settings
 * ------------------------------------------------------------------ */

test("a WAV is written with a correct header", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    // A short ramp, one channel.
    const n = 100;
    const ch = new Float32Array(n);
    for (let i = 0; i < n; i++) ch[i] = (i / n) * 2 - 1;
    const url = F.samplesToWAV([ch], 11025);
    const bin = atob(url.split(",")[1]);
    const byte = (i) => bin.charCodeAt(i);
    const u32 = (i) => byte(i) | (byte(i + 1) << 8) | (byte(i + 2) << 16) | (byte(i + 3) << 24);
    const u16 = (i) => byte(i) | (byte(i + 1) << 8);
    return {
      riff: bin.slice(0, 4), wave: bin.slice(8, 12),
      channels: u16(22), rate: u32(24), bits: u16(34),
      dataBytes: u32(40), total: bin.length,
    };
  });
  expect(out.riff).toBe("RIFF");
  expect(out.wave).toBe("WAVE");
  expect(out.channels).toBe(1);
  expect(out.rate).toBe(11025);
  // 16-bit PCM, which is the only format writable here without an encoder.
  expect(out.bits).toBe(16);
  expect(out.dataBytes).toBe(200);
  expect(out.total).toBe(244);
});

test("settings default to leaving the sound alone", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    ...docWith([box()]),
    sounds: { blip: { name: "blip", mediaType: "audio/wav",
                      data: "data:audio/wav;base64,UklGRg==", duration: 0.1 } },
  });
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    return { set: F.soundSettings("blip"),
             // Nothing to do, so nothing is done -- and the original bytes
             // are almost always smaller than anything this can produce.
             recoded: F.recodeSound("blip"),
             missing: F.soundSettings("nope") };
  });
  expect(out.set).toEqual({ rate: "original", mono: false, trim: false });
  expect(out.recoded).toBeNull();
  expect(out.missing).toBeNull();
});

test("a sound with no decoded buffer is left exactly as it was", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    ...docWith([box()]),
    sounds: { music: { name: "music", mediaType: "audio/mpeg",
                       data: "data:audio/mpeg;base64," + "A".repeat(40),
                       duration: 1 } },
  });

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    F.soundSettings("music").rate = "11025";
    const sounds = { music: { name: "music", mediaType: "audio/mpeg",
                              data: F.doc.sounds.music.data, duration: 1 } };
    const report = F.recodeAllSounds(sounds);
    return { report, type: sounds.music.mediaType, data: sounds.music.data };
  });
  /* There is nothing to resample without the decoded samples, so the original
     bytes ship untouched. Producing a silent or truncated file because a
     setting was ticked would be far worse than ignoring the setting. */
  expect(out.report).toEqual([]);
  expect(out.type).toBe("audio/mpeg");
  expect(out.data).toContain("audio/mpeg");
});

test("a recode that would grow the file is reported and skipped", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box()]));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    /* A decoded buffer standing in for a real one, so the skip branch can be
       reached: 1000 samples at 44.1kHz become a ~2KB WAV, which is far bigger
       than the 30-byte "compressed" original. */
    const n = 1000;
    const data = new Float32Array(n);
    for (let i = 0; i < n; i++) data[i] = Math.sin(i / 10);
    window.Flashy.Sound._buffers.tiny = {
      sampleRate: 44100, numberOfChannels: 1, length: n,
      getChannelData: () => data,
    };
    F.doc.sounds = F.doc.sounds || {};
    F.doc.sounds.tiny = { name: "tiny", mediaType: "audio/mpeg",
                          data: "data:audio/mpeg;base64," + "A".repeat(40),
                          duration: 0.02 };
    F.soundSettings("tiny").rate = "11025";
    const sounds = { tiny: { name: "tiny", mediaType: "audio/mpeg",
                             data: F.doc.sounds.tiny.data, duration: 0.02 } };
    const report = F.recodeAllSounds(sounds);
    delete window.Flashy.Sound._buffers.tiny;
    return { report, type: sounds.tiny.mediaType };
  });
  /* Resampling an already-compressed file into WAV usually makes it bigger,
     and shipping a bigger file because a setting said to is the opposite of
     what the setting is for. It is reported rather than silently ignored. */
  expect(out.report).toHaveLength(1);
  expect(out.report[0].skipped).toBe(true);
  expect(out.report[0].after).toBe(out.report[0].before);
  expect(out.type).toBe("audio/mpeg");
});

test("a recode that genuinely helps is applied", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box()]));

  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    // A long stereo buffer: mono at 11kHz really is a quarter of the bytes.
    const n = 44100;
    const left = new Float32Array(n), right = new Float32Array(n);
    for (let i = 0; i < n; i++) { left[i] = Math.sin(i / 40); right[i] = left[i]; }
    window.Flashy.Sound._buffers.song = {
      sampleRate: 44100, numberOfChannels: 2, length: n,
      getChannelData: (c) => (c === 0 ? left : right),
    };
    F.doc.sounds = F.doc.sounds || {};
    // A big "original" so the recode is the smaller of the two.
    F.doc.sounds.song = { name: "song", mediaType: "audio/wav",
                          data: "data:audio/wav;base64," + "A".repeat(400000),
                          duration: 1 };
    F.soundSettings("song").rate = "11025";
    F.soundSettings("song").mono = true;
    const sounds = { song: { name: "song", mediaType: "audio/wav",
                             data: F.doc.sounds.song.data, duration: 1 } };
    const report = F.recodeAllSounds(sounds);
    delete window.Flashy.Sound._buffers.song;
    return { report, type: sounds.song.mediaType,
             duration: sounds.song.duration };
  });
  expect(out.report).toHaveLength(1);
  expect(out.report[0].skipped).toBeUndefined();
  expect(out.report[0].rate).toBe(11025);
  expect(out.report[0].channels).toBe(1);
  // Mono at 11kHz from stereo at 44.1kHz: an eighth of the samples.
  expect(out.report[0].after).toBeLessThan(out.report[0].before);
  expect(out.type).toBe("audio/wav");
  expect(out.duration).toBeCloseTo(1, 1);
});

test("the byte count reads a data URL without decoding it", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      // 4 base64 characters carry 3 bytes.
      four: F.soundBytes("data:audio/wav;base64,AAAA"),
      eight: F.soundBytes("data:audio/wav;base64,AAAAAAAA"),
      none: F.soundBytes(""),
      raw: F.soundBytes("notadataurl"),
    };
  });
  expect(out.four).toBe(3);
  expect(out.eight).toBe(6);
  expect(out.none).toBe(0);
  expect(out.raw).toBe(11);
});

test("the settings survive a save and reopen", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    ...docWith([box()]),
    sounds: { blip: { name: "blip", mediaType: "audio/wav",
                      data: "data:audio/wav;base64,UklGRg==", duration: 0.1 } },
  });
  const back = await page.evaluate(() => {
    const F = window._flashyAI;
    const s = F.soundSettings("blip");
    s.rate = "11025"; s.mono = true; s.trim = true;
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    return F.soundSettings("blip");
  });
  expect(back).toEqual({ rate: "11025", mono: true, trim: true });
});

test("the Sound Settings dialog lists every sound", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    ...docWith([box()]),
    sounds: {
      blip: { name: "blip", mediaType: "audio/wav",
              data: "data:audio/wav;base64,UklGRg==", duration: 0.1 },
      music: { name: "music", mediaType: "audio/mpeg",
               data: "data:audio/mpeg;base64,AAAA", duration: 10 },
    },
  });

  await page.evaluate(() => window._flashyEditor.doAction("soundSettings"));
  await expect(page.locator("#fy-dialog .dbg-row")).toHaveCount(2);
  await expect(page.locator("#fy-dialog .dbg-row", { hasText: "blip" }))
    .toContainText("unchanged");
  // And it says plainly what it does instead of pretending to re-encode.
  await expect(page.locator("#fy-dialog")).toContainText("no MP3 encoder");
});

test("Sound Settings says so when there are no sounds", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, docWith([box()]));
  await page.evaluate(() => window._flashyEditor.doAction("soundSettings"));
  await expect(page.locator("#fy-dialog .fy-dialog-msg")).toContainText("no sounds");
});
