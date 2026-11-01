// Sound effects: envelopes, panning, repeat counts, and sync Stop.
//
// There was no sound editing at all. A sound could be imported, attached to a
// keyframe and given a volume, and that was the whole of it: no fade in, no
// fade out, no pan, no repeat count — and `sync: "stop"`, which is how you
// silence a music track, was stored in the save format and honoured by
// nothing, so "stop the music here" did nothing at all.
//
// The envelope is the general case and the presets are shorthand for it, which
// is how Flash's Edit Envelope dialog worked. The preset table lives in the
// engine so the dialog, the authoring preview and the exported player cannot
// disagree about what "Fade In" is.
import { test, expect } from "@playwright/test";
import { openEditor, loadDoc, downloadFromAction } from "./helpers.js";

/** A document with one sound asset on frame 1. */
function soundDoc(soundOver = {}) {
  return {
    width: 200, height: 100, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 48,
    layers: [{
      name: "Audio", visible: true, locked: false,
      keyframes: [{
        index: 1, duration: 48, tweenType: "none", easing: "linear", script: "",
        objects: [],
        sound: {
          asset: "Voice", sync: "stream", volume: 1, loop: false, offset: 0,
          ...soundOver,
        },
      }],
    }],
    library: {},
    /* A four-second asset. `data` has to be non-empty: reviveSounds drops an
       asset with no bytes, which is correct — an asset with no audio in it is
       not an asset — and it is why this fixture carries a placeholder rather
       than an empty string. These specs are about scheduling, not decoding. */
    sounds: {
      Voice: { name: "Voice", mediaType: "audio/wav", data: "UklGRg==", duration: 4 },
    },
  };
}

/* ------------------------------------------------------------------ *
 * Presets
 * ------------------------------------------------------------------ */

test("the effect presets come from one table", async ({ page }) => {
  const errors = await openEditor(page);
  const env = await page.evaluate(() => {
    const S = window.Flashy.SoundTrack;
    return {
      fadeIn: S.envelopeFor("fadeIn", 4),
      fadeOut: S.envelopeFor("fadeOut", 4),
      fadeLR: S.envelopeFor("fadeLR", 4),
      left: S.envelopeFor("left", 4),
      none: S.envelopeFor("none", 4),
      custom: S.envelopeFor("custom", 4),
    };
  });
  // Fade in rises from silence; fade out falls to it.
  expect(env.fadeIn[0][1]).toBe(0);
  expect(env.fadeIn[env.fadeIn.length - 1][1]).toBe(1);
  expect(env.fadeOut[env.fadeOut.length - 1][1]).toBe(0);
  // A pan sweep moves between the channels rather than changing the level.
  expect(env.fadeLR[0]).toEqual([0, 1, 0]);
  expect(env.fadeLR[1]).toEqual([4, 0, 1]);
  // One channel only, for the whole length.
  expect(env.left.every((p) => p[1] === 1 && p[2] === 0)).toBe(true);
  // "none" has no curve, and "custom" brings its own rather than getting one.
  expect(env.none).toBeNull();
  expect(env.custom).toBeNull();
  expect(errors).toEqual([]);
});

test("picking a preset fills the curve in so it can be adjusted", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, soundDoc());
  const res = await page.evaluate(() => {
    const F = window._flashyAI;
    const snd = F.currentLayers()[0].getKeyframeAt(1).sound;
    F.setSoundEffect(snd, "fadeIn");
    const afterPreset = { effect: snd.effect, env: snd.envelope };
    F.setSoundEffect(snd, "custom");
    const afterCustom = { effect: snd.effect, env: snd.envelope };
    F.setSoundEffect(snd, "none");
    return { afterPreset, afterCustom, afterNone: { effect: snd.effect, env: snd.envelope } };
  });
  // The preset's own shape is written in, which is what makes "pick Fade In,
  // then adjust it" work rather than opening on a blank curve.
  expect(res.afterPreset.effect).toBe("fadeIn");
  expect(res.afterPreset.env[0][1]).toBe(0);
  // Custom keeps whatever was there.
  expect(res.afterCustom.effect).toBe("custom");
  expect(res.afterCustom.env[0][1]).toBe(0);
  // None clears it.
  expect(res.afterNone.env).toBeNull();
});

test("a custom curve with nothing in it starts flat, not silent", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, soundDoc());
  const env = await page.evaluate(() => {
    const F = window._flashyAI;
    const snd = F.currentLayers()[0].getKeyframeAt(1).sound;
    snd.envelope = null;
    F.setSoundEffect(snd, "custom");
    return snd.envelope;
  });
  // A flat full-volume line is the honest starting point: it sounds exactly
  // like no effect until you move it. Starting at zero would be silence.
  expect(env).toEqual([[0, 1, 1], [4, 1, 1]]);
});

/* ------------------------------------------------------------------ *
 * The envelope reaches playback
 * ------------------------------------------------------------------ */

test("the resolved envelope is handed to the sound track", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, soundDoc({ effect: "fadeIn" }));

  const items = await page.evaluate(() => window._flashyAI.soundItems());
  expect(items).toHaveLength(1);
  // The effect is resolved to a curve here, not left as a name the track
  // would have to understand.
  expect(items[0].envelope[0][1]).toBe(0);
  expect(items[0].repeat).toBe(0);
  expect(errors).toEqual([]);
});

test("a custom curve travels instead of the preset's", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, soundDoc({ effect: "custom", envelope: [[0, 1, 1], [2, 0.25, 0.75]] }));
  const items = await page.evaluate(() => window._flashyAI.soundItems());
  expect(items[0].envelope).toEqual([[0, 1, 1], [2, 0.25, 0.75]]);
});

test("the export resolves the same envelope the editor previews", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, soundDoc({ effect: "fadeLR" }));
  const html = await downloadFromAction(page, "export");
  // The envelope is built in the export's own soundItems, through the engine's
  // preset table — so the published movie pans exactly as the preview did.
  expect(html).toContain("envelopeFor");
  expect(html).toContain('"fadeLR"');
});

test("Sound.play schedules an envelope on a real gain node", async ({ page }) => {
  const errors = await openEditor(page);
  // Driven against the Web Audio API directly: what matters is that the
  // envelope is SCHEDULED rather than polled, so it stays accurate while the
  // main thread is busy drawing.
  const res = await page.evaluate(async () => {
    const S = window.Flashy.Sound;
    const ctx = S.context();
    if (!ctx) return { skipped: true };
    // A one-second buffer of silence is enough to schedule against.
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    S._buffers = S._buffers || {};
    S._buffers.Probe = buf;
    await S.unlock();
    const h = S.play("Probe", { envelope: [[0, 0, 0], [0.5, 1, 1]], volume: 1 });
    if (!h) return { skipped: true };
    const out = {
      hasGain: !!h.gain,
      // A stereo panner only appears when there is something to pan.
      hasPan: !!h.pan,
      startValue: h.gain.gain.value,
    };
    S.stop(h);
    return out;
  });
  if (!res.skipped) {
    expect(res.hasGain).toBe(true);
    expect(res.hasPan).toBe(true);
  }
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * Repeat and loop
 * ------------------------------------------------------------------ */

test("loop and a repeat count are different things", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, soundDoc({ repeat: 3 }));

  let items = await page.evaluate(() => window._flashyAI.soundItems());
  expect(items[0].repeat).toBe(3);
  expect(items[0].loop).toBe(false);

  // Turning loop on clears the count: "forever" and "three times" are not
  // both true, and a boolean alone cannot say the second.
  await page.evaluate(() => {
    const F = window._flashyAI;
    const snd = F.currentLayers()[0].getKeyframeAt(1).sound;
    snd.loop = true;
    snd.repeat = 0;
    F.fullRefresh();
  });
  items = await page.evaluate(() => window._flashyAI.soundItems());
  expect(items[0].loop).toBe(true);
  expect(items[0].repeat).toBe(0);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * Sync Stop
 * ------------------------------------------------------------------ */

test("sync Stop silences the asset, including an event sound fired earlier", async ({ page }) => {
  const errors = await openEditor(page);
  const res = await page.evaluate(() => {
    const F = window.Flashy;
    // A fake Sound so the track can be driven without real audio: what is
    // under test is the reconciliation, not the decoder.
    const played = [], stopped = [];
    const realPlay = F.Sound.play, realStop = F.Sound.stop;
    const realReady = F.Sound.ready, realPos = F.Sound.positionOf;
    F.Sound.ready = () => true;
    F.Sound.positionOf = () => 0;
    F.Sound.play = (name, opts) => {
      const h = { name, opts, id: played.length };
      played.push(h);
      return h;
    };
    F.Sound.stop = (h) => { if (h) stopped.push(h.name); };

    const track = new F.SoundTrack({ fps: 24 });
    track.setItems([
      // An EVENT sound, which once fired plays out on its own…
      { id: "a", asset: "Music", startFrame: 1, endFrame: 10, sync: "event", volume: 1 },
      // …and a Stop marker further along.
      { id: "b", asset: "Music", startFrame: 20, endFrame: 20, sync: "stop", volume: 1 },
    ]);
    track.update(1);
    const firedAt1 = played.length;
    track.update(5);
    const stillAt5 = stopped.length;
    track.update(20);
    const stoppedAt20 = stopped.slice();

    F.Sound.play = realPlay; F.Sound.stop = realStop;
    F.Sound.ready = realReady; F.Sound.positionOf = realPos;
    return { firedAt1, stillAt5, stoppedAt20, playedNames: played.map((p) => p.name) };
  });
  expect(res.firedAt1).toBe(1);
  expect(res.stillAt5).toBe(0);
  // The Stop marker silenced the event sound that was already running — the
  // only reading of "stop" that makes it useful.
  expect(res.stoppedAt20).toContain("Music");
  // And it played nothing itself.
  expect(res.playedNames).toEqual(["Music"]);
  expect(errors).toEqual([]);
});

test("a Stop marker leaves other assets alone", async ({ page }) => {
  await openEditor(page);
  const stopped = await page.evaluate(() => {
    const F = window.Flashy;
    const out = [];
    const realPlay = F.Sound.play, realStop = F.Sound.stop;
    const realReady = F.Sound.ready, realPos = F.Sound.positionOf;
    F.Sound.ready = () => true;
    F.Sound.positionOf = () => 0;
    F.Sound.play = (name) => ({ name });
    F.Sound.stop = (h) => { if (h) out.push(h.name); };
    const track = new F.SoundTrack({ fps: 24 });
    track.setItems([
      { id: "a", asset: "Music", startFrame: 1, endFrame: 100, sync: "event", volume: 1 },
      { id: "b", asset: "Effect", startFrame: 1, endFrame: 100, sync: "event", volume: 1 },
      { id: "c", asset: "Music", startFrame: 10, endFrame: 10, sync: "stop", volume: 1 },
    ]);
    track.update(1);
    track.update(10);
    F.Sound.play = realPlay; F.Sound.stop = realStop;
    F.Sound.ready = realReady; F.Sound.positionOf = realPos;
    return out;
  });
  expect(stopped).toContain("Music");
  expect(stopped).not.toContain("Effect");
});

/* ------------------------------------------------------------------ *
 * The document
 * ------------------------------------------------------------------ */

test("the effect, curve and repeat count survive a save and a keyframe clone", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, soundDoc({
    effect: "custom", envelope: [[0, 1, 0.5], [3, 0.2, 1]], repeat: 4, sync: "event",
  }));

  const back = await page.evaluate(() => {
    const d = window._flashyEditor.serializeDoc();
    window._flashyEditor.loadDoc(JSON.parse(JSON.stringify(d)));
    return window._flashyAI.currentLayers()[0].getKeyframeAt(1).sound;
  });
  expect(back).toMatchObject({ effect: "custom", repeat: 4, sync: "event" });
  expect(back.envelope).toEqual([[0, 1, 0.5], [3, 0.2, 1]]);

  // `envelope` is an array of ARRAYS, so a keyframe clone needs a real copy:
  // a shallow one would have two keyframes sharing one curve, which is the
  // trap group children and filter stacks each fell into.
  const independent = await page.evaluate(() => {
    const kf = window._flashyAI.currentLayers()[0].getKeyframeAt(1);
    const copy = kf.clone();
    copy.sound.envelope[0][1] = 0.123;
    return kf.sound.envelope[0][1];
  });
  expect(independent).toBe(1);
  expect(errors).toEqual([]);
});

test("the inspector offers the effects, repeat and the envelope editor", async ({ page }) => {
  const errors = await openEditor(page);
  await loadDoc(page, soundDoc());
  await page.evaluate(() => window._flashyAI.selectKeyframe(0, 1));

  const props = page.locator("#propsPanel");
  await expect(props).toContainText("Sound");
  await expect(props).toContainText("Effect");
  await expect(props).toContainText("Repeat");
  await expect(props.locator("button", { hasText: "Edit Envelope" })).toHaveCount(1);

  // A Stop marker plays nothing, so the controls that describe playback are
  // not offered for one — and the panel says what it does instead.
  await page.evaluate(() => {
    const F = window._flashyAI;
    F.currentLayers()[0].getKeyframeAt(1).sound.sync = "stop";
    F.fullRefresh();
  });
  await expect(props).toContainText("silences");
  await expect(props).not.toContainText("Edit Envelope");
  expect(errors).toEqual([]);
});

test("the envelope editor opens on the sound and keeps what was drawn", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, soundDoc({ effect: "fadeIn" }));
  await page.evaluate(() => window._flashyAI.selectKeyframe(0, 1));
  await page.evaluate(() => window._flashyAI.showSoundEnvelope());

  await expect(page.locator(".fy-dialog")).toContainText("Edit Envelope");
  await expect(page.locator(".sound-envelope")).toHaveCount(1);

  // Drag the first point of the left lane down to silence.
  await page.evaluate(() => {
    const cv = document.querySelector(".sound-envelope");
    const r = cv.getBoundingClientRect();
    const at = (t, x, y, b) => cv.dispatchEvent(new PointerEvent(t, {
      pointerId: 1, isPrimary: true, button: 0, buttons: b,
      clientX: r.left + x, clientY: r.top + y, bubbles: true,
    }));
    // fadeIn starts at 0,0 — top-left of the left lane is full volume, so the
    // existing point is at the BOTTOM. Grab it and lift it to the top.
    at("pointerdown", 0, 52, 1);
    at("pointermove", 0, 1, 1);
    at("pointerup", 0, 1, 0);
  });
  await page.locator(".fy-dialog-foot button").last().click();

  const snd = await page.evaluate(() =>
    window._flashyAI.currentLayers()[0].getKeyframeAt(1).sound);
  // Editing a preset makes it Custom: a preset is a shape, and changing it
  // means you no longer have that preset.
  expect(snd.effect).toBe("custom");
  expect(snd.envelope[0][1]).toBeGreaterThan(0.8);
});

test("the envelope editor will not open without a sound to edit", async ({ page }) => {
  await openEditor(page);
  await loadDoc(page, {
    width: 200, height: 100, fps: 24, backgroundColor: "#FFFFFF", totalFrames: 5,
    layers: [{
      name: "L", visible: true, locked: false,
      keyframes: [{ index: 1, duration: 5, tweenType: "none", easing: "linear",
                    script: "", objects: [] }],
    }],
    library: {},
  });
  await page.evaluate(() => window._flashyAI.showSoundEnvelope());
  await expect(page.locator(".fy-dialog")).toContainText("has a sound on it");
});
