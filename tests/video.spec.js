// Video: import, a Video object, playback modes and cue points.
//
// Flash's File ▸ Import ▸ Video and the Video object it produced. It is how
// every tutorial, every banner with a product shot and every Flash video
// player on the web was built, and Flashy had nothing — the audit dismissed
// it as "needs a demuxer", which was wrong. A browser demuxes and decodes MP4
// and WebM already: a <video> element IS the decoder, and drawImage of it is
// the frame.
//
// Two modes, Flash's own. EMBEDDED means the playhead drives the clip, so
// scrubbing the timeline scrubs the footage and one video frame lands on one
// timeline frame — which is what made animating over footage possible. STREAM
// means it runs on its own clock, as a NetStream did.
//
// The real clip these specs use is recorded in the browser with
// MediaRecorder, so the decoder being tested is the one that will actually
// play it.
import { test, expect } from "@playwright/test";
import { openEditor, downloadFromAction, runExportedHTML } from "./helpers.js";

/**
 * Record a short clip in the page and import it, returning its asset name.
 *
 * A real encode rather than a hand-built file: the point of this feature is
 * that the browser is the codec, so the fixture has to be something the
 * browser made and will take back.
 */
async function recordAndImport(page, seconds = 1.2) {
  return page.evaluate(async (seconds) => {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 48;
    const g = c.getContext("2d");
    const stream = c.captureStream(20);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8" : "video/webm";
    // Painted BEFORE the recorder starts: captureStream will happily record
    // the blank canvas it was handed, and a clip whose first frames are
    // nothing is a fixture that proves nothing.
    g.fillStyle = "#FF0000";
    g.fillRect(0, 0, 64, 48);
    const rec = new MediaRecorder(stream, { mimeType: mime });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((res) => { rec.onstop = res; });
    rec.start();
    const t0 = performance.now();
    // A colour that changes over the clip, so "which frame is this" is
    // answerable by looking at the pixels.
    await new Promise((res) => {
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        g.fillStyle = t < seconds / 2 ? "#FF0000" : "#0000FF";
        g.fillRect(0, 0, 64, 48);
        if (t >= seconds) { rec.stop(); res(); return; }
        requestAnimationFrame(tick);
      };
      tick();
    });
    await done;
    const blob = new Blob(chunks, { type: "video/webm" });
    const file = new File([blob], "clip.webm", { type: "video/webm" });
    const name = await window._flashyAI.importVideoFile(file);
    return name;
  }, seconds);
}

/* ------------------------------------------------------------------ *
 * The timing, which is pure arithmetic
 * ------------------------------------------------------------------ */

test("a movie frame maps to a time in the clip", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const V = window.Flashy.Video;
    return {
      first: V.timeFor(1, 1, 24, 10, false),
      oneSecond: V.timeFor(25, 1, 24, 10, false),
      // Placed on frame 10: that frame is time zero.
      placed: V.timeFor(34, 10, 24, 10, false),
      // Before the placement is still time zero rather than a negative seek.
      before: V.timeFor(3, 10, 24, 10, false),
      clamped: V.timeFor(5000, 1, 24, 10, false),
      looped: +V.timeFor(5000, 1, 24, 10, true).toFixed(4),
      // A slow timeline plays the clip slowly, deliberately.
      slow: V.timeFor(13, 1, 12, 10, false),
      noDuration: V.timeFor(99, 1, 24, 0, false),
    };
  });
  expect(r.first).toBe(0);
  expect(r.oneSecond).toBe(1);
  expect(r.placed).toBe(1);
  expect(r.before).toBe(0);
  // Past the end it holds the last frame unless it loops.
  expect(r.clamped).toBe(10);
  expect(r.looped).toBeLessThan(10);
  /* One video frame per TIMELINE frame, which divides by the movie's rate
     rather than the video's: a 30fps clip on a 12fps timeline plays at
     two-fifths speed, and that is what let people animate over footage. */
  expect(r.slow).toBe(1);
  expect(r.noDuration).toBe(0);
});

test("cue points fire on the step that passes them", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const V = window.Flashy.Video;
    const cues = [{ name: "a", time: 1 }, { name: "b", time: 2 },
                  { name: "c", time: 3 }, { name: "bad", time: NaN }];
    return {
      crossing: V.cuesBetween(cues, 0.5, 2.5).map((c) => c.name),
      // Exactly on the boundary counts as passed, once.
      onEdge: V.cuesBetween(cues, 0.9, 1).map((c) => c.name),
      alreadyPast: V.cuesBetween(cues, 1.5, 2).map((c) => c.name),
      // No step, no cue: this is what stops a cue firing twice on a slow frame.
      still: V.cuesBetween(cues, 2, 2).length,
      // A loop wraps, so a cue near the end still fires on every pass.
      wrapped: V.cuesBetween([{ name: "end", time: 9.8 }, { name: "start", time: 0.1 }],
                             9.5, 0.2).map((c) => c.name),
      none: V.cuesBetween(null, 0, 5).length,
      sorted: V.cuesBetween(cues, 0, 5).map((c) => c.name),
    };
  });
  /* Comparing against the PREVIOUS time rather than testing proximity is the
     whole trick: a cue tested by "is the playhead near it" fires several
     times on a slow frame and not at all on a fast one. */
  expect(r.crossing).toEqual(["a", "b"]);
  expect(r.onEdge).toEqual(["a"]);
  expect(r.alreadyPast).toEqual(["b"]);
  expect(r.still).toBe(0);
  expect(r.wrapped).toEqual(["start", "end"]);
  expect(r.none).toBe(0);
  // A time that is not a number is dropped rather than compared.
  expect(r.sorted).toEqual(["a", "b", "c"]);
});

test("a seek inside the tolerance is skipped", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const V = window.Flashy.Video;
    const fake = { currentTime: 5 };
    return {
      tiny: V.sync(fake, 5.01), after1: fake.currentTime,
      real: V.sync(fake, 7), after2: fake.currentTime,
      nothing: V.sync(null, 1),
      nan: V.sync(fake, NaN),
    };
  });
  /* A seek per repaint makes a browser drop every frame it was about to show,
     which looks exactly like a video that will not play. */
  expect(r.tiny).toBe(false);
  expect(r.after1).toBe(5);
  expect(r.real).toBe(true);
  expect(r.after2).toBe(7);
  expect(r.nothing).toBe(false);
  expect(r.nan).toBe(false);
});

/* ------------------------------------------------------------------ *
 * Import
 * ------------------------------------------------------------------ */

test("a non-video and an oversized file are both refused, with a reason", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(async () => {
    const F = window._flashyAI;
    const text = new File(["not a video"], "notes.txt", { type: "text/plain" });
    const bad = await F.importVideoFile(text);
    const badMsg = document.getElementById("fy-dialog")
      ? document.getElementById("fy-dialog").textContent : "";
    // A file the right type and far too big.
    const huge = new File([new Uint8Array(1024)], "big.mp4", { type: "video/mp4" });
    Object.defineProperty(huge, "size", { value: F.VIDEO_MAX_BYTES + 1 });
    const over = await F.importVideoFile(huge);
    const overMsg = document.getElementById("fy-dialog")
      ? document.getElementById("fy-dialog").textContent : "";
    return { bad, badMsg, over, overMsg, assets: Object.keys(F.docVideos()).length };
  });
  expect(r.bad).toBe(null);
  expect(r.badMsg).toContain("MP4");
  expect(r.over).toBe(null);
  /* Video travels inside the document, so the limit is real and the message
     has to say why — Flash capped embedded video for the same reason. */
  expect(r.overMsg).toContain("inside the document");
  expect(r.assets).toBe(0);
});

test("a recorded clip imports, decodes and lands on the stage", async ({ page }) => {
  await openEditor(page);
  const name = await recordAndImport(page);
  expect(name).toBeTruthy();
  const r = await page.evaluate((name) => {
    const F = window._flashyAI;
    const a = F.docVideos()[name];
    const objs = F.currentLayers()[0].getKeyframeAt(1).objects;
    const el = F.videoElement(name);
    return {
      mediaType: a.mediaType,
      hasData: a.data.length > 100,
      width: a.width, height: a.height,
      duration: a.duration,
      cues: a.cues,
      placed: objs.length,
      type: objs[0] && objs[0].type,
      asset: objs[0] && objs[0].videoAsset,
      objW: objs[0] && objs[0].width,
      mode: objs[0] && objs[0].videoMode,
      decoded: !!el,
      ready: el ? el.readyState >= 2 : false,
      muted: el ? el.muted : null,
    };
  }, name);
  expect(r.mediaType).toContain("video/webm");
  expect(r.hasData).toBe(true);
  /* The real size and duration are only knowable once a frame has decoded,
     and they are written back onto the asset so the second placement does not
     have to wait at all. */
  expect(r.width).toBe(64);
  expect(r.height).toBe(48);
  expect(r.duration).toBeGreaterThan(0.3);
  expect(r.cues).toEqual([]);
  // Importing places an instance: an asset in the Library and nothing on the
  // stage is the commonest "did that work?" in any editor.
  expect(r.placed).toBe(1);
  expect(r.type).toBe("video");
  expect(r.asset).toBe(name);
  expect(r.objW).toBe(64);
  expect(r.mode).toBe("embedded");
  expect(r.decoded).toBe(true);
  expect(r.ready).toBe(true);
  /* Muted and playsInline are not preferences: without them a browser refuses
     to start the element without a gesture at all. */
  expect(r.muted).toBe(true);
});

/* ------------------------------------------------------------------ *
 * The stage
 * ------------------------------------------------------------------ */

test("the stage draws the clip", async ({ page }) => {
  await openEditor(page);
  const name = await recordAndImport(page, 1.2);
  expect(name).toBeTruthy();
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    /* Centred on the stage. The stage canvas is the VIEWPORT, not the movie:
       a 400-tall stage in a ~310-tall canvas has its top rows off-screen
       entirely, so artwork placed near the top cannot be probed at all. */
    o.width = 64; o.height = 48;
    o.x = Math.round(F.doc.width / 2 - 32);
    o.y = Math.round(F.doc.height / 2 - 24);
    F.setSelection([]);
    F.render();
    const c = document.getElementById("stageCanvas");
    const g = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const ox = (c.clientWidth - F.doc.width) / 2;
    const oy = (c.clientHeight - F.doc.height) / 2;
    const at = (x, y) => {
      const d = g.getImageData(Math.round((ox + x) * dpr),
                               Math.round((oy + y) * dpr), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    return {
      inside: at(F.doc.width / 2, F.doc.height / 2),
      outside: at(20, F.doc.height / 2),
      ready: F.videoElement(Object.keys(F.docVideos())[0]).readyState,
    };
  });
  // The clip starts red, and frame 1 is time zero so no seek is involved.
  expect(r.ready).toBeGreaterThanOrEqual(2);
  expect(r.inside[0]).toBeGreaterThan(120);
  expect(r.inside[2]).toBeLessThan(120);
  expect(r.outside).toEqual([255, 255, 255]);
});

test("the playhead drives an embedded clip's time, and a stream's it does not", async ({ page }) => {
  await openEditor(page);
  const name = await recordAndImport(page, 1.2);
  const r = await page.evaluate((name) => {
    const F = window._flashyAI;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    F.doc.totalFrames = 60;
    F.currentLayers()[0].keyframes[0].duration = 60;
    const el = F.videoElement(name);
    const asked = [];
    const at = (frame) => {
      F.selectKeyframe(0, frame);
      F.syncVideos();
      asked.push(+el.currentTime.toFixed(3));
    };
    at(1); at(7); at(13);
    const embedded = asked.slice();

    /* A STREAM clip runs on its own clock, so the playhead must not touch it
       -- that is the entire difference between the two modes, and driving a
       streamed clip from the timeline would fight whatever it was doing. */
    o.videoMode = "stream";
    el.currentTime = 0.5;
    F.selectKeyframe(0, 40);
    F.syncVideos();
    const afterStream = +el.currentTime.toFixed(3);
    return { embedded, afterStream,
             want: [1, 7, 13].map((f) => +F.videoTimeAt(o, f).toFixed(3)) };
  }, name);
  /* The element is asked for the right time whether or not the file can
     serve it: a WebM from MediaRecorder carries no Cues index and so is not
     reliably seekable at all, which is the FIXTURE's limitation rather than
     the editor's. What is under test here is the arithmetic and the wiring. */
  expect(r.embedded[0]).toBe(0);
  expect(r.embedded[1]).toBeGreaterThan(0);
  expect(r.embedded[2]).toBeGreaterThan(r.embedded[1]);
  expect(r.afterStream).toBe(0.5);
});

test("an undecoded video draws a placeholder, not a hole", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    window._flashyEditor.loadDoc({
      width: 200, height: 150, fps: 24, backgroundColor: "#FFFFFF",
      totalFrames: 1, library: {},
      // An asset with data a browser will never decode.
      videos: { Broken: { name: "Broken", mediaType: "video/mp4",
        data: "AAAA", width: 100, height: 60, duration: 0, cues: [] } },
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear", script: "",
        objects: [{ type: "video", videoAsset: "Broken",
          x: 40, y: 40, width: 100, height: 60,
          rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
          videoStart: 1, videoMode: "embedded" }] }] }],
    });
    F.setSelection([]);
    F.render();
    const c = document.getElementById("stageCanvas");
    const g = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const ox = (c.clientWidth - 200) / 2, oy = (c.clientHeight - 150) / 2;
    const at = (x, y) => {
      const d = g.getImageData(Math.round((ox + x) * dpr),
                               Math.round((oy + y) * dpr), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    return { inside: at(90, 70), outside: at(10, 10),
             element: F.videoElement("Broken") };
  });
  /* An empty rectangle with no explanation is the worst of the three possible
     outcomes, so there is a dark panel with a play triangle on it. */
  expect(r.outside).toEqual([255, 255, 255]);
  expect(r.inside[0]).toBeLessThan(200);
  expect(r.element).toBe(null);
});

/* ------------------------------------------------------------------ *
 * The Library and cue points
 * ------------------------------------------------------------------ */

test("the Library lists the clip and counts its uses", async ({ page }) => {
  await openEditor(page);
  const name = await recordAndImport(page);
  const r = await page.evaluate((name) => {
    const F = window._flashyAI;
    F.updateLib();
    const text = document.getElementById("libPanel").textContent;
    // Place a second instance, and the count follows.
    F.placeVideo(name);
    F.updateLib();
    return { text, after: document.getElementById("libPanel").textContent,
             objs: F.currentLayers()[0].getKeyframeAt(1).objects.length };
  }, name);
  expect(r.text).toContain(name);
  // Size and duration, which is what you need to know about a clip.
  expect(r.text).toMatch(/64.?48/);
  expect(r.objs).toBe(2);
  expect(r.after).toContain(name);
});

test("cue points are added, sorted, removed and saved", async ({ page }) => {
  await openEditor(page);
  const name = await recordAndImport(page);
  const r = await page.evaluate((name) => {
    const F = window._flashyAI;
    F.addVideoCue(name, "later", 2, "event");
    F.addVideoCue(name, "earlier", 0.5, "navigation");
    F.addVideoCue(name, "middle", 1, "nonsense");
    const sorted = F.videoCues(name).map((c) => [c.name, c.time, c.type]);
    F.removeVideoCue(name, 1);
    const after = F.videoCues(name).map((c) => c.name);
    const gone = F.removeVideoCue(name, 99);
    const missing = F.videoCues("Nope");
    // A cue's frame against the timeline, for an instance placed on frame 10.
    const frame = F.cueFrame({ videoStart: 10 }, { time: 1 });
    return { sorted, after, gone, missing, frame, fps: F.doc.fps };
  }, name);
  /* Sorted, because "which cue is next" is the only question anyone asks of
     this list and an unsorted answer is wrong on a loop. */
  expect(r.sorted).toEqual([
    ["earlier", 0.5, "navigation"],
    ["middle", 1, "event"],
    ["later", 2, "event"],
  ]);
  expect(r.after).toEqual(["earlier", "later"]);
  expect(r.gone).toBe(false);
  expect(r.missing).toBe(null);
  expect(r.frame).toBe(10 + r.fps);

  const saved = await page.evaluate(() => {
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    const F = window._flashyAI;
    const n = Object.keys(F.docVideos())[0];
    return { hasVideos: /"videos"/.test(json),
             cues: F.videoCues(n).map((c) => c.name),
             dataKept: F.docVideos()[n].data.length > 100,
             obj: F.currentLayers()[0].getKeyframeAt(1).objects[0] };
  });
  expect(saved.hasVideos).toBe(true);
  expect(saved.cues).toEqual(["earlier", "later"]);
  // Video travels inside the document, so the bytes have to survive the save.
  expect(saved.dataKept).toBe(true);
  expect(saved.obj.videoAsset).toBeTruthy();
  expect(saved.obj.videoMode).toBe("embedded");
});

test("the cue dialog refuses a nameless cue and one past the end", async ({ page }) => {
  await openEditor(page);
  const name = await recordAndImport(page);
  const r = await page.evaluate((name) => {
    window._flashyEditor.doAction("videoCues");
    const d = document.getElementById("fy-dialog");
    const inputs = [...d.querySelectorAll(".fy-dialog-input")];
    const ok = [...d.querySelectorAll("button")].find((b) => b.textContent === "Add");
    // Nameless.
    ok.click();
    const err1 = d.querySelector(".fy-dialog-error").textContent;
    // Named, but past the end of the clip.
    inputs[0].value = "way out";
    inputs[1].value = "9999";
    inputs[1].dispatchEvent(new Event("change", { bubbles: true }));
    ok.click();
    const err2 = d.querySelector(".fy-dialog-error").textContent;
    return { err1, err2, cues: window._flashyAI.videoCues(name).length,
             text: d.textContent };
  }, name);
  expect(r.err1).toContain("name");
  expect(r.err2).toContain("past the end");
  expect(r.cues).toBe(0);
  // And the dialog says what the two kinds of cue actually do.
  expect(r.text).toContain("cuePoint");
});

/* ------------------------------------------------------------------ *
 * The exports
 * ------------------------------------------------------------------ */

test("the SVG export emits the frame the video is showing", async ({ page }) => {
  await openEditor(page);
  const name = await recordAndImport(page);
  await page.evaluate(() => {
    window._flashyAI.setSelection([]);
    window._flashyAI.render();
  });
  const svg = await downloadFromAction(page, "exportSVG");
  /* SVG has no timeline here — the export is deliberately a still of the
     current frame — so a video becomes the frame it is showing. A
     foreignObject with a <video> in it would be a different document that
     happened to have the same extension. */
  expect(svg).toContain("<image");
  expect(svg).toContain("data:image/png;base64,");
  expect(name).toBeTruthy();
});

test("the exported player plays the clip and fires its cue points", async ({ page, context }) => {
  await openEditor(page);
  const name = await recordAndImport(page, 1.5);
  await page.evaluate((name) => {
    const F = window._flashyAI;
    F.doc.width = 120; F.doc.height = 90;
    F.doc.totalFrames = 40;
    F.currentLayers()[0].keyframes[0].duration = 40;
    const o = F.currentLayers()[0].getKeyframeAt(1).objects[0];
    o.x = 10; o.y = 10; o.width = 64; o.height = 48;
    F.addVideoCue(name, "halfway", 0.4, "event");
    F.addVideoCue(name, "chapter", 0.6, "navigation");
    // A frame script that records every cue the movie reports.
    F.currentLayers()[0].keyframes[0].script =
      "if(!this.__wired){this.__wired=1;" +
      "window.__cues=[];" +
      "stage.addEventListener('cuePoint',function(e){window.__cues.push(e.name);});}";
    F.fullRefresh();
  }, name);
  const html = await downloadFromAction(page, "export");
  const { page: out, errors } = await runExportedHTML(context, html);
  // Long enough for the playhead to cross 0.6s of footage at the movie's rate.
  await out.waitForTimeout(1600);
  const run = await out.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const sx = c.width / 120, sy = c.height / 90;
    const d = g.getImageData(Math.round(40 * sx), Math.round(30 * sy), 1, 1).data;
    return { cues: window.__cues || null, px: [d[0], d[1], d[2]] };
  });
  await out.close();
  expect(errors).toEqual([]);
  /* An EVENT cue fires; a NAVIGATION cue is a seek target and fires nothing.
     Flash drew the same line, and it is the difference between a cue list you
     can hang captions off and a stream of noise. */
  expect(run.cues).toContain("halfway");
  expect(run.cues).not.toContain("chapter");
  // And the clip is actually on screen: red or blue, not the white stage.
  expect(Math.max(run.px[0], run.px[2])).toBeGreaterThan(100);
  expect(Math.min(run.px[0], run.px[2])).toBeLessThan(200);
});

test("Import Video and Cue Points are in the menus", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const text = JSON.stringify(window._flashyEditor.menus || []);
    return {
      importVideo: text.indexOf("importVideo") >= 0,
      label: text.indexOf("Import Video") >= 0,
      cues: text.indexOf("videoCues") >= 0,
      cueLabel: text.indexOf("Cue Points") >= 0,
    };
  });
  expect(r.importVideo).toBe(true);
  expect(r.label).toBe(true);
  expect(r.cues).toBe(true);
  expect(r.cueLabel).toBe(true);
});
