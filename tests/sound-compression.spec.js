// Real lossy compression for sounds.
//
// The audit said: "There is no MP3 encoder here and writing one would be a
// project of its own." Both halves of that are true, and the conclusion drawn
// from them was wrong in the same way the video row's "needs a demuxer" was.
//
// A browser already contains an audio ENCODER. MediaRecorder takes a
// MediaStream and hands back compressed bytes, and every browser offers Opus
// in WebM — which beats MP3 at the same bitrate and decodes everywhere. So
// per-sound compression is a real encode at a real bitrate, not "resample and
// hope".
//
// MP3 specifically is still not offered, and that is now a statement about
// MP3 rather than about this editor: no browser will encode it.
//
// The cost, stated rather than hidden: MediaRecorder reads a LIVE stream, so
// a clip takes about its own duration to encode. Every fixture here is
// therefore short.
import { test, expect } from "@playwright/test";
import { openEditor } from "./helpers.js";

/**
 * Put a real decoded sound in the document.
 *
 * A tone rather than noise: noise is incompressible by construction, so a
 * fixture made of it would prove the opposite of what this tests. The
 * "original" is 16-bit WAV, which is what an uncompressed import looks like.
 */
async function withTone(page, seconds = 0.6, opts = {}) {
  return page.evaluate(async ({ seconds, opts }) => {
    const rate = 44100;
    const n = Math.floor(rate * seconds);
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx({ sampleRate: rate });
    const buf = ctx.createBuffer(opts.stereo ? 2 : 1, n, rate);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        // A 440Hz tone with a little harmonic content, at half amplitude.
        const t = i / rate;
        d[i] = 0.5 * Math.sin(2 * Math.PI * 440 * t) +
               0.15 * Math.sin(2 * Math.PI * 880 * t);
      }
    }
    // 16-bit WAV, the shape an uncompressed import arrives in.
    const chans = [];
    for (let ch = 0; ch < buf.numberOfChannels; ch++) chans.push(buf.getChannelData(ch));
    const wav = window._flashyAI.samplesToWAV(chans, rate);
    const b64 = wav.slice(wav.indexOf(",") + 1);

    window._flashyEditor.loadDoc({
      width: 100, height: 100, fps: 12, backgroundColor: "#FFF", totalFrames: 1,
      sounds: { Tone: { name: "Tone", mediaType: "audio/wav", data: b64,
                        duration: seconds } },
      library: {},
      layers: [{ name: "L", visible: true, locked: false, keyframes: [{
        index: 1, duration: 1, tweenType: "none", easing: "linear",
        script: "", objects: [] }] }],
    });
    // The compressor works from the DECODED buffer, so the engine must have it.
    window.Flashy.Sound._buffers = window.Flashy.Sound._buffers || {};
    window.Flashy.Sound._buffers.Tone = buf;
    try { ctx.close(); } catch (e) { /* fine */ }
    return { bytes: Math.round(b64.length * 3 / 4), rate, channels: buf.numberOfChannels };
  }, { seconds, opts });
}

/* ------------------------------------------------------------------ *
 * The encoder the browser already has
 * ------------------------------------------------------------------ */

test("the browser offers an encoder, and it is Opus", async ({ page }) => {
  await openEditor(page);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    return {
      picked: F.soundCodec(null),
      // Asking for one by name puts it first if it is supported.
      asked: F.soundCodec("audio/ogg;codecs=opus"),
      nonsense: F.soundCodec("audio/made-up"),
      codecs: F.SOUND_CODECS.map((c) => c[0]),
      bitrates: F.SOUND_BITRATES.map((b) => b[0]),
      mp3: F.SOUND_CODECS.some((c) => /mpeg|mp3/.test(c[0])),
    };
  });
  /* This is the whole premise: the encoder is already here. If this ever
     fails, the feature's justification has gone with it. */
  expect(r.picked).not.toBe(null);
  expect(r.picked.mime).toContain("opus");
  // An unsupported request falls back rather than returning nothing.
  expect(r.nonsense).not.toBe(null);
  expect(r.asked).not.toBe(null);
  expect(r.bitrates).toEqual([24000, 48000, 96000, 128000, 192000]);
  /* MP3 is absent on purpose, and that is a fact about MP3: no browser will
     encode it. Offering it would mean shipping an encoder for a format worse
     than the one already present. */
  expect(r.mp3).toBe(false);
});

test("encoding an AudioBuffer returns real compressed bytes", async ({ page }) => {
  await openEditor(page);
  await withTone(page, 0.5);
  const r = await page.evaluate(async () => {
    const F = window._flashyAI;
    const buf = window.Flashy.Sound._buffers.Tone;
    const raw = buf.length * buf.numberOfChannels * 2;   // 16-bit PCM
    const enc = await F.encodeAudioBuffer(buf, { bitrate: 48000 });
    return { raw, enc, hasData: !!(enc && enc.data && enc.data.length > 32) };
  });
  expect(r.enc).not.toBe(null);
  expect(r.hasData).toBe(true);
  expect(r.enc.mediaType).toMatch(/audio\/(webm|ogg|mp4)/);
  expect(r.enc.codec).toContain("Opus");
  /* A tone at 48 kbps against 16-bit PCM: the saving is not marginal. If this
     were within a factor of two, the encode would not be worth its wall
     clock. */
  expect(r.enc.bytes).toBeLessThan(r.raw / 3);
  expect(r.enc.bytes).toBeGreaterThan(100);
});

test("a higher bitrate makes a bigger file", async ({ page }) => {
  await openEditor(page);
  await withTone(page, 0.5);
  const r = await page.evaluate(async () => {
    const F = window._flashyAI;
    const buf = window.Flashy.Sound._buffers.Tone;
    const low = await F.encodeAudioBuffer(buf, { bitrate: 24000 });
    const high = await F.encodeAudioBuffer(buf, { bitrate: 192000 });
    return { low: low && low.bytes, high: high && high.bytes };
  });
  // The bitrate is a real control, not a label on a fixed encode.
  expect(r.low).toBeGreaterThan(0);
  expect(r.high).toBeGreaterThan(r.low);
});

/* ------------------------------------------------------------------ *
 * The pipeline before the encoder
 * ------------------------------------------------------------------ */

test("mono, rate and trim shape the buffer the encoder is handed", async ({ page }) => {
  await openEditor(page);
  const made = await withTone(page, 0.6, { stereo: true });
  expect(made.channels).toBe(2);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const buf = window.Flashy.Sound._buffers.Tone;
    const asIs = F.prepareSoundBuffer("Tone", buf,
      { rate: "original", mono: false, trim: false });
    const mono = F.prepareSoundBuffer("Tone", buf,
      { rate: "original", mono: true, trim: false });
    const slow = F.prepareSoundBuffer("Tone", buf,
      { rate: "11025", mono: true, trim: false });
    return {
      /* The source rate is read back rather than assumed: loadDoc kicks off
         its own async decode of the asset, and decodeAudioData resamples to
         whatever rate the hardware runs at. Which rate that is belongs to
         the browser; what belongs to prepareSoundBuffer is whether it keeps
         it and whether it honours a request to change it. */
      sourceRate: buf.sampleRate,
      asIs: [asIs.numberOfChannels, asIs.sampleRate],
      mono: [mono.numberOfChannels, mono.sampleRate],
      slow: [slow.numberOfChannels, slow.sampleRate],
      // Resampling to a quarter of the rate keeps the duration.
      slowDuration: +slow.duration.toFixed(2),
      asIsDuration: +asIs.duration.toFixed(2),
    };
  });
  // "original" keeps the rate it was given, whatever that is.
  expect(r.asIs).toEqual([2, r.sourceRate]);
  expect(r.mono).toEqual([1, r.sourceRate]);
  // ...and a requested rate is honoured exactly.
  expect(r.slow).toEqual([1, 11025]);
  /* These shrink the INPUT to the encoder as well as the output, which is why
     they run first: mono at 11 kHz encoded at 48 kbps beats stereo at 44.1
     encoded at 48 kbps for the audio that wants those settings. */
  expect(r.slowDuration).toBeCloseTo(r.asIsDuration, 1);
});

test("trimming removes silence at the ends and not in the middle", async ({ page }) => {
  await openEditor(page);
  await withTone(page, 0.4);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const rate = 8000;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx({ sampleRate: rate });
    // silence | tone | silence | tone | silence
    const buf = ctx.createBuffer(1, rate, rate);
    const d = buf.getChannelData(0);
    const tone = (from, to) => {
      for (let i = from; i < to; i++) d[i] = 0.5 * Math.sin(i / 4);
    };
    tone(2000, 3000);
    tone(5000, 6000);
    const trimmed = F.prepareSoundBuffer("Tone", buf,
      { rate: "original", mono: false, trim: true });
    try { ctx.close(); } catch (e) { /* fine */ }
    // The gap in the middle has to survive, or everything cued against the
    // sound moves.
    const t = trimmed.getChannelData(0);
    let quietRun = 0, worst = 0;
    for (let i = 0; i < t.length; i++) {
      if (Math.abs(t[i]) < 0.002) { quietRun++; worst = Math.max(worst, quietRun); }
      else quietRun = 0;
    }
    return { original: buf.length, trimmed: trimmed.length, middleGap: worst };
  });
  // 2000 samples of lead-in and 2000 of tail removed, give or take a sample.
  expect(r.trimmed).toBeLessThan(r.original - 3500);
  expect(r.trimmed).toBeGreaterThan(3500);
  /* The ~2000-sample gap between the two tones is still there: trimming the
     middle would change the timing of everything the sound is cued against. */
  expect(r.middleGap).toBeGreaterThan(1500);
});

/* ------------------------------------------------------------------ *
 * Compressing an asset
 * ------------------------------------------------------------------ */

test("compressing an asset replaces its bytes and reports the saving", async ({ page }) => {
  await openEditor(page);
  const made = await withTone(page, 0.6);
  const r = await page.evaluate(async () => {
    const F = window._flashyAI;
    const set = F.soundSettings("Tone");
    // Off by default: encoding is real time, so switching it on for every
    // sound the first time the dialog opens would be a surprise in minutes.
    const defaultOff = set.compress;
    const refused = await F.compressSound("Tone");

    set.compress = true;
    set.bitrate = 48000;
    const res = await F.compressSound("Tone");
    const a = F.doc.sounds.Tone;
    return { defaultOff, refused, res,
             mediaType: a.mediaType,
             bytes: Math.round(a.data.length * 3 / 4),
             recorded: F.soundSettings("Tone").compressedWith,
             missing: await F.compressSound("Nope") };
  });
  expect(r.defaultOff).toBe(false);
  expect(r.refused.ok).toBe(false);
  expect(r.refused.why).toContain("off");
  expect(r.res.ok).toBe(true);
  expect(r.res.before).toBeCloseTo(made.bytes, -3);
  expect(r.res.after).toBeLessThan(r.res.before / 3);
  expect(r.res.saved).toBeGreaterThan(60);
  // The asset now IS the compressed form, with the right media type on it.
  expect(r.mediaType).toMatch(/audio\/(webm|ogg|mp4)/);
  /* Within a byte: `after` is the blob's real size and `bytes` is derived
     from the base64 length, which padding makes approximate. Everything in
     this editor that reports an asset size does the same arithmetic. */
  expect(Math.abs(r.bytes - r.res.after)).toBeLessThanOrEqual(2);
  expect(r.recorded).toContain("Opus");
  expect(r.missing.ok).toBe(false);
});

test("a compressed asset still decodes, which is the point of Opus", async ({ page }) => {
  await openEditor(page);
  await withTone(page, 0.5);
  const r = await page.evaluate(async () => {
    const F = window._flashyAI;
    F.soundSettings("Tone").compress = true;
    F.soundSettings("Tone").bitrate = 48000;
    const res = await F.compressSound("Tone");
    if (!res.ok) return { res };
    // Decode the bytes the asset now holds, the way the engine would.
    const a = F.doc.sounds.Tone;
    const bin = atob(a.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    let decoded = null, error = null;
    try { decoded = await ctx.decodeAudioData(bytes.buffer); }
    catch (e) { error = String(e && e.message || e); }
    try { ctx.close(); } catch (e) { /* fine */ }
    return { res, error,
             duration: decoded ? +decoded.duration.toFixed(2) : null,
             channels: decoded ? decoded.numberOfChannels : null };
  });
  expect(r.res.ok).toBe(true);
  /* The whole reason Opus and not something exotic: decodeAudioData takes it,
     so the engine loads a compressed asset with no new code at all. */
  expect(r.error).toBe(null);
  expect(r.duration).toBeGreaterThan(0.3);
  expect(r.channels).toBeGreaterThanOrEqual(1);
});

test("an encode that comes out bigger is discarded, not applied", async ({ page }) => {
  await openEditor(page);
  await withTone(page, 0.5);
  const r = await page.evaluate(async () => {
    const F = window._flashyAI;
    const a = F.doc.sounds.Tone;
    // Pretend the original is already tiny — an already-compressed import.
    const realData = a.data;
    a.data = realData.slice(0, 200);
    const before = Math.round(a.data.length * 3 / 4);
    F.soundSettings("Tone").compress = true;
    F.soundSettings("Tone").bitrate = 192000;
    const res = await F.compressSound("Tone");
    return { res, before, unchanged: a.data.length === 200 };
  });
  /* An already-compressed original usually beats anything a second pass can
     produce, so the second pass is measured and thrown away rather than
     trusted. */
  expect(r.res.ok).toBe(false);
  expect(r.res.skipped).toBe(true);
  expect(r.res.after).toBeGreaterThan(r.res.before);
  expect(r.res.why).toContain("larger than the original");
  expect(r.unchanged).toBe(true);
});

test("compressing them all does one at a time and reports each", async ({ page }) => {
  await openEditor(page);
  await withTone(page, 0.35);
  const r = await page.evaluate(async () => {
    const F = window._flashyAI;
    // A second and third asset sharing the one decoded buffer.
    F.doc.sounds.Blip = Object.assign({}, F.doc.sounds.Tone, { name: "Blip" });
    F.doc.sounds.Quiet = Object.assign({}, F.doc.sounds.Tone, { name: "Quiet" });
    window.Flashy.Sound._buffers.Blip = window.Flashy.Sound._buffers.Tone;
    window.Flashy.Sound._buffers.Quiet = window.Flashy.Sound._buffers.Tone;

    const none = await F.compressAllSounds();
    F.soundSettings("Tone").compress = true;
    F.soundSettings("Blip").compress = true;
    // Quiet is left alone, so it must not be touched.
    const quietBefore = F.doc.sounds.Quiet.data.length;
    const res = await F.compressAllSounds();
    return { none, res,
             names: res.results.map((x) => x.name).sort(),
             quietUntouched: F.doc.sounds.Quiet.data.length === quietBefore };
  });
  // Nothing ticked, nothing done — and no error about it.
  expect(r.none.done).toBe(0);
  expect(r.res.done).toBe(2);
  expect(r.names).toEqual(["Blip", "Tone"]);
  expect(r.res.results.every((x) => x.ok)).toBe(true);
  expect(r.quietUntouched).toBe(true);
});

/* ------------------------------------------------------------------ *
 * The dialog and the document
 * ------------------------------------------------------------------ */

test("the settings survive a save", async ({ page }) => {
  await openEditor(page);
  await withTone(page, 0.3);
  const r = await page.evaluate(() => {
    const F = window._flashyAI;
    const set = F.soundSettings("Tone");
    set.compress = true;
    set.bitrate = 128000;
    set.mono = true;
    set.rate = "22050";
    const json = JSON.stringify(window._flashyEditor.serializeDoc());
    window._flashyEditor.loadDoc(JSON.parse(json));
    return { saved: /"compress":true/.test(json), back: F.soundSettings("Tone") };
  });
  expect(r.saved).toBe(true);
  expect(r.back.compress).toBe(true);
  expect(r.back.bitrate).toBe(128000);
  expect(r.back.mono).toBe(true);
  expect(r.back.rate).toBe("22050");
});

test("the dialog offers Compress, a bitrate, and says what it costs", async ({ page }) => {
  await openEditor(page);
  await withTone(page, 0.3);
  const r = await page.evaluate(() => {
    window._flashyEditor.doAction("soundSettings");
    const d = document.getElementById("fy-dialog");
    const labels = [...d.querySelectorAll("label")].map((l) => l.textContent);
    const before = { text: d.textContent, selects: d.querySelectorAll("select").length };
    // Tick Compress; the bitrate control appears with it.
    const box = [...d.querySelectorAll("label")]
      .find((l) => l.textContent.indexOf("Compress") >= 0)
      .querySelector("input");
    box.click();
    const after = { selects: d.querySelectorAll("select").length,
                    text: d.textContent };
    return { labels, before, after,
             buttons: [...d.querySelectorAll("button")].map((b) => b.textContent) };
  });
  expect(r.labels.some((l) => l.includes("Compress"))).toBe(true);
  /* The bitrate is a live control only once compression is on: one that does
     nothing is worse than none. */
  expect(r.after.selects).toBeGreaterThan(r.before.selects);
  expect(r.after.text).toMatch(/kbps/);
  // The trade is stated rather than discovered.
  expect(r.before.text).toContain("about its own length");
  expect(r.before.text).toContain("no browser will encode it");
  expect(r.buttons).toContain("Compress now");
});

test("Compress now says so when nothing is ticked", async ({ page }) => {
  await openEditor(page);
  await withTone(page, 0.3);
  const text = await page.evaluate(() => {
    window._flashyEditor.doAction("soundSettings");
    const d = document.getElementById("fy-dialog");
    [...d.querySelectorAll("button")]
      .find((b) => b.textContent === "Compress now").click();
    return document.getElementById("fy-dialog").textContent;
  });
  expect(text).toContain("Tick Compress on at least one sound");
});
