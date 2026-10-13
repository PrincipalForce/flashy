// Audio: import, waveform, sync, scrub, round-trip and export.
//
// Before this existed there was not a single line of audio code in the engine
// or the editor — which is the one gap that stops Flashy being usable for the
// kind of work it is modelled on. Newgrounds cartoons were audio-led: you
// record the voices first and time every drawing to a syllable.
//
// The fixture is a WAV generated in the page, so these specs need no binary
// asset and decode through the browser's real decoder.
import { test, expect } from "@playwright/test";
import { openEditor, downloadFromAction } from "./helpers.js";

/**
 * Build a mono 16-bit PCM WAV as a data URL: `seconds` long, a sine tone that
 * is silent for the first half so the waveform has a visible shape to assert
 * on.
 */
const WAV_HELPER = `
window.__makeWav = function (seconds, rate) {
  rate = rate || 8000;
  const n = Math.floor(seconds * rate);
  const bytes = 44 + n * 2;
  const buf = new ArrayBuffer(bytes);
  const v = new DataView(buf);
  const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, bytes - 8, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    // Silent first half, loud second half.
    const amp = i < n / 2 ? 0 : 0.8;
    v.setInt16(44 + i * 2, Math.round(Math.sin(i / 8) * amp * 32767), true);
  }
  return new File([buf], "tone.wav", { type: "audio/wav" });
};`;

/** Import a generated WAV through the editor's own import path. */
async function importTone(page, seconds = 2) {
  await page.evaluate(WAV_HELPER);
  return page.evaluate(async (seconds) => {
    const file = window.__makeWav(seconds);
    // importSoundFile is reached from File ▸ Import Sound and from a drop on
    // the timeline; drive it through the AI/test seam.
    return window._flashyAudio.importSoundFile(file);
  }, seconds);
}

test("importing audio adds an asset, attaches it, and extends the layer", async ({ page }) => {
  const errors = await openEditor(page);
  const name = await importTone(page, 2);
  expect(name).toBeTruthy();

  const state = await page.evaluate(() => {
    const F = window._flashyAI;
    const kf = F.currentLayers()[F.curLayer()].getKeyframeAt(1);
    const asset = F.doc.sounds[Object.keys(F.doc.sounds)[0]];
    return {
      assetCount: Object.keys(F.doc.sounds).length,
      mediaType: asset.mediaType,
      duration: asset.duration,
      hasData: asset.data.length > 100,
      sound: kf.sound,
      // 2s at 24fps needs 48 frames of room, or the clip is inaudible past
      // the end of the layer.
      span: kf.duration,
      totalFrames: F.doc.totalFrames,
    };
  });

  expect(state.assetCount).toBe(1);
  expect(state.mediaType).toBe("audio/wav");
  expect(state.duration).toBeCloseTo(2, 1);
  expect(state.hasData).toBe(true);
  expect(state.sound).toMatchObject({ sync: "stream", volume: 1, loop: false });
  expect(state.span).toBeGreaterThanOrEqual(48);
  expect(state.totalFrames).toBeGreaterThanOrEqual(48);
  expect(errors).toEqual([]);
});

test("the waveform is computed from the decoded audio", async ({ page }) => {
  await openEditor(page);
  const name = await importTone(page, 2);

  const peaks = await page.evaluate((name) => {
    const p = window.Flashy.Sound.peaks(name, 48);
    if (!p) return null;
    // First half of the fixture is silent, second half is loud.
    const quiet = Array.from(p.slice(0, 20)).reduce((a, b) => a + b, 0) / 20;
    const loud = Array.from(p.slice(28)).reduce((a, b) => a + b, 0) / (p.length - 28);
    return { length: p.length, quiet, loud };
  }, name);

  expect(peaks).not.toBeNull();
  expect(peaks.length).toBe(48);
  // The waveform has to actually follow the audio, not draw a generic shape.
  expect(peaks.quiet).toBeLessThan(0.05);
  expect(peaks.loud).toBeGreaterThan(0.5);
});

test("sounds survive a save/reopen round trip", async ({ page }) => {
  await openEditor(page);
  await importTone(page, 1.5);

  const after = await page.evaluate(() => {
    const text = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(text));
    const F = window._flashyAI;
    const kf = F.doc.layers[0].getKeyframeAt(1);
    const names = Object.keys(F.doc.sounds);
    return {
      bytes: text.length,
      names,
      duration: F.doc.sounds[names[0]].duration,
      sound: kf.sound,
    };
  });

  expect(after.names.length).toBe(1);
  expect(after.duration).toBeCloseTo(1.5, 1);
  expect(after.sound.asset).toBe(after.names[0]);
  // The audio really is inside the document — a .flashy stays one file.
  expect(after.bytes).toBeGreaterThan(10000);
});

test("stream and event sounds produce the right timeline items", async ({ page }) => {
  await openEditor(page);
  const name = await importTone(page, 2);

  const items = await page.evaluate((name) => {
    const F = window._flashyAI;
    const layer = F.doc.layers[0];
    const kf = layer.getKeyframeAt(1);
    const streamItems = window._flashyAudio.soundItems();

    // Same sound as a one-shot: an event sound is not bounded by the playhead.
    kf.sound.sync = "event";
    const eventItems = window._flashyAudio.soundItems();
    return { streamItems, eventItems, name };
  }, name);

  expect(items.streamItems).toHaveLength(1);
  expect(items.streamItems[0]).toMatchObject({
    asset: items.name, sync: "stream", startFrame: 1, volume: 1, loop: false,
  });
  // 2s at 24fps = 48 frames, so the sound ends on frame 48.
  expect(items.streamItems[0].endFrame).toBe(48);
  expect(items.eventItems[0].sync).toBe("event");
});

test("scrubbing the timeline plays a slice without throwing", async ({ page }) => {
  const errors = await openEditor(page);
  await importTone(page, 2);

  // Audio cannot start without a gesture; a real click on the timeline is one.
  const box = await page.locator("#tlCanvas").boundingBox();
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  for (let x = 40; x < 200; x += 20) {
    await page.mouse.move(box.x + x, box.y + 30);
  }
  await page.mouse.up();

  const frame = await page.evaluate(() => window._flashyAI.curFrame());
  expect(frame).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test("playback follows the audio clock when a stream sound is playing", async ({ page }) => {
  await openEditor(page);
  await importTone(page, 3);

  // Unlock audio with a real gesture, then play.
  await page.locator("#tlCanvas").click({ position: { x: 20, y: 30 } });
  await page.evaluate(() => {
    window._flashyAI.setCurFrame(1);
    window._flashyEditor.doAction("play");
  });
  await page.waitForTimeout(700);

  const state = await page.evaluate(() => ({
    frame: window._flashyAI.curFrame(),
    audioRunning: window.Flashy.Sound.ready(),
    // The track should be driving a live handle for the stream sound.
    trackFrame: window._flashyAudio.track() && window._flashyAudio.track().frameFromAudio(window._flashyAI.curFrame()),
  }));
  await page.evaluate(() => window._flashyEditor.doAction("stop"));

  // ~0.7s at 24fps is roughly frame 17; allow generous slack for CI.
  expect(state.frame).toBeGreaterThan(5);
  expect(state.frame).toBeLessThan(40);
  if (state.audioRunning) {
    // When audio is genuinely running the playhead comes from the audio clock.
    expect(state.trackFrame).not.toBeNull();
  }
});

test("the HTML export carries the audio and gates playback behind a click", async ({ page, context }) => {
  await openEditor(page);
  await importTone(page, 1);

  const html = await downloadFromAction(page, "export");

  // The asset itself is embedded — the export stays one self-contained file.
  expect(html).toContain('"sounds"');
  expect(html).toContain("audio/wav");
  expect(html).toContain("SoundTrack");
  // Autoplay is blocked without a gesture, so an export with sound opens
  // behind a play button rather than starting silently.
  expect(html).toContain('id="flashy-start"');
  expect(html).toContain("{autoplay:false}");

  const out = await context.newPage();
  const outErrors = [];
  out.on("pageerror", (e) => outErrors.push(e.message));
  await out.setContent(html);
  await out.waitForFunction(() => !!window.__stage);

  // Held on frame 1 until the viewer presses play — the gate has to actually
  // gate, not just be drawn on top of a running movie.
  await out.waitForTimeout(400);
  expect(await out.evaluate(() => window.__stage.root.currentFrame)).toBe(1);

  await out.locator("#flashy-start button").click();
  await out.waitForFunction(() => !document.getElementById("flashy-start"));
  // …and the movie runs once it is dismissed.
  await out.waitForFunction(() => window.__stage.root.currentFrame > 1, null, { timeout: 4000 });
  expect(await out.evaluate(() => !!window.__stage.soundtrack)).toBe(true);

  expect(outErrors).toEqual([]);
  await out.close();
});

test("a silent export still starts on its own", async ({ page, context }) => {
  await openEditor(page);
  const html = await downloadFromAction(page, "export");

  expect(html).not.toContain('id="flashy-start"');
  const out = await context.newPage();
  await out.setContent(html);
  await out.waitForFunction(() => !!window.__stage);
  expect(await out.evaluate(() => window.__stage.root.playing)).toBe(true);
  await out.close();
});

test("deleting an asset detaches every reference to it", async ({ page }) => {
  await openEditor(page);
  const name = await importTone(page, 1);

  const after = await page.evaluate((name) => {
    window._flashyAudio.deleteSoundAsset(name);
    const F = window._flashyAI;
    return {
      assets: Object.keys(F.doc.sounds).length,
      sound: F.doc.layers[0].getKeyframeAt(1).sound,
    };
  }, name);

  expect(after.assets).toBe(0);
  expect(after.sound).toBeNull();
});
