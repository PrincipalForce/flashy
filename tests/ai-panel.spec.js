// The AI assistant's request shape and streaming.
//
// The headline bug: the opening greeting was stored as an assistant turn and
// the whole of `aiMessages` was sent as `messages`, so every request began with
// an assistant turn — which the Messages API rejects with a 400 ("first message
// must use the user role"). The panel could not complete a single call.
//
// `fetch` is stubbed, so these tests need no API key and make no network calls.
import { test, expect } from "@playwright/test";
import { openEditor } from "./helpers.js";

/**
 * Replace window.fetch with a stub that records request bodies and replays a
 * scripted SSE stream back to the panel.
 */
async function stubAnthropic(page, { textChunks = ["Done."], stopReason = "end_turn", status = 200, body = "" } = {}) {
  await page.evaluate(({ textChunks, stopReason, status, body }) => {
    window.__aiRequests = [];
    const sse = (obj) => `event: ${obj.type}\ndata: ${JSON.stringify(obj)}\n\n`;
    window.fetch = (url, init) => {
      window.__aiRequests.push({ url: String(url), init, parsed: JSON.parse(init.body) });
      if (status !== 200) {
        return Promise.resolve({ ok: false, status, text: () => Promise.resolve(body) });
      }
      const frames = [
        sse({ type: "message_start", message: { id: "msg_1" } }),
        sse({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }),
        ...textChunks.map((t) => sse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } })),
        sse({ type: "content_block_stop", index: 0 }),
        sse({ type: "message_delta", delta: { stop_reason: stopReason } }),
        sse({ type: "message_stop" }),
      ];
      const enc = new TextEncoder();
      let i = 0;
      return Promise.resolve({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve(
                i < frames.length ? { done: false, value: enc.encode(frames[i++]) } : { done: true },
              ),
          }),
        },
      });
    };
  }, { textChunks, stopReason, status, body });
}

/**
 * Send a message through the panel.
 *
 * The key is read from localStorage once at load, so seeding it afterwards is
 * too late. Pressing Send with no key opens the API-key dialog; filling it in
 * saves the key and re-sends, which is the path a new user actually takes.
 * (It used to be a window.prompt(), which throws in Electron — see the
 * dialogs spec.)
 */
async function send(page, text) {
  await page.locator('.dock-tab[data-panel="ai"]').click();
  await page.locator("#ai-input").fill(text);
  await page.locator("#ai-send").click();
  const dialog = page.locator("#fy-dialog");
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.locator(".fy-dialog-input").fill("sk-ant-test-key-0123456789");
    await dialog.getByText("Save key").click();
  }
}

test("the first message sent to the API uses the user role", async ({ page }) => {
  await openEditor(page);
  await stubAnthropic(page);
  await send(page, "Draw a red square");

  await page.waitForFunction(() => window.__aiRequests.length > 0);
  const req = await page.evaluate(() => window.__aiRequests[0]);

  // The bug: messages[0].role was "assistant" (the greeting), a hard 400.
  expect(req.parsed.messages.length).toBeGreaterThan(0);
  expect(req.parsed.messages[0].role).toBe("user");
  // And no assistant turn may ever lead the array.
  expect(req.parsed.messages.map((m) => m.role)[0]).toBe("user");
  expect(req.url).toBe("https://api.anthropic.com/v1/messages");
  expect(req.init.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
});

test("the request uses a current model, adaptive thinking, and streaming", async ({ page }) => {
  await openEditor(page);
  await stubAnthropic(page);
  await send(page, "Draw a circle");

  await page.waitForFunction(() => window.__aiRequests.length > 0);
  const sent = await page.evaluate(() => window.__aiRequests[0].parsed);

  expect(sent.model).toBe("claude-opus-5");
  expect(sent.thinking).toEqual({ type: "adaptive" });
  expect(sent.stream).toBe(true);
  // max_tokens caps thinking + reply together, so it has to cover both.
  expect(sent.max_tokens).toBeGreaterThanOrEqual(32000);
  expect(sent.system).toContain("window._flashyAI");
});

test("the reply streams in, and history keeps the code the model wrote", async ({ page }) => {
  await openEditor(page);
  // A realistic reply: prose, then a fenced code block.
  await stubAnthropic(page, {
    textChunks: [
      "A red square.\n\n",
      "```flashy-code\nvar F = window._flashyAI;\nF.pushUndo();\n",
      "var r = new F.EditorObject('rect');\nF.fullRefresh();\n```",
    ],
  });
  await send(page, "Draw a red square");

  // The Apply button only appears once the code block has been extracted.
  await page.locator(".ai-apply-btn").waitFor();

  const state = await page.evaluate(() => {
    const msgs = Array.from(document.querySelectorAll(".ai-msg.assistant"));
    const last = msgs[msgs.length - 1];
    return {
      shown: last.textContent,
      // window._flashyAI exposes nothing about the chat, so read the panel's
      // own history through a send: the next request must carry the code.
      historyRoles: null,
    };
  });

  // Displayed text has the code block stripped…
  expect(state.shown).toContain("A red square.");
  expect(state.shown).not.toContain("F.pushUndo");

  // …but the next request must still carry it, or a follow-up like "make it
  // bigger" asks the model to revise code it cannot see.
  await stubAnthropic(page, { textChunks: ["Bigger."] });
  await send(page, "make it bigger");
  await page.waitForFunction(() => window.__aiRequests.length > 0);

  const followup = await page.evaluate(() => window.__aiRequests[0].parsed.messages);
  expect(followup[0].role).toBe("user");
  const assistantTurn = followup.find((m) => m.role === "assistant");
  expect(assistantTurn, "the assistant's turn is remembered").toBeTruthy();
  expect(assistantTurn.content).toContain("F.pushUndo");
});

test("an in-flight request can be stopped", async ({ page }) => {
  await openEditor(page);
  // A stream that never completes, so the request stays in flight.
  await page.evaluate(() => {
    window.__aiRequests = [];
    window.fetch = (url, init) => {
      window.__aiRequests.push({ parsed: JSON.parse(init.body) });
      return Promise.resolve({
        ok: true,
        status: 200,
        body: { getReader: () => ({ read: () => new Promise(() => {}) }) },
      });
    };
  });
  await send(page, "Draw something enormous");

  const btn = page.locator("#ai-send");
  await expect(btn).toHaveText("Stop");
  await btn.click();

  await expect(btn).toHaveText("Send");
  await expect(page.locator(".ai-msg.system").last()).toContainText("Stopped");
});

test("a rejected API key is cleared so the next send re-prompts", async ({ page }) => {
  await openEditor(page);
  await stubAnthropic(page, { status: 401, body: "unauthorized" });
  await send(page, "hello");

  await expect(page.locator(".ai-msg.system").last()).toContainText("API key rejected");
  expect(await page.evaluate(() => localStorage.getItem("flashy_ai_key"))).toBeNull();
  await expect(page.locator("#ai-send")).toHaveText("Send");
});
