// Flashy has no build step — the source files are the app — so the test setup
// is just "serve the repo root and drive the real editor.html".
//
// Node's own http server is used rather than `python -m http.server` (what
// `npm start` uses) so CI needs nothing but Node.
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.FLASHY_TEST_PORT || 8123);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    // The editor refuses to lay out below this; see minWidth/minHeight in
    // electron/main.cjs.
    viewport: { width: 1400, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      testIgnore: "**/*.espec.js",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Electron specs drive the real desktop shell, so they bring their own
      // app rather than a page from the dev server.
      name: "electron",
      testMatch: "**/*.espec.js",
    },
  ],
  webServer: {
    command: `node scripts/serve.cjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/editor.html`,
    // Always start our own. Reusing whatever happens to hold the port bites
    // hard here: a leftover `python -m http.server` on a common port gets
    // adopted silently, and because http.server is single-threaded it starts
    // refusing connections the moment the suite runs more than one page — a
    // pile of ERR_CONNECTION_REFUSED failures with no obvious cause.
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
