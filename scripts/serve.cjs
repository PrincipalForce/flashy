#!/usr/bin/env node
// Static file server for the repo root.
//
// `npm start` uses `python -m http.server`, which is fine on a workstation but
// makes Python a CI dependency for a project that otherwise only needs Node.
// This serves the same tree with the same semantics the packaged app's
// flashy:// handler uses (see electron/main.cjs): real 404s, no SPA fallback,
// and nothing outside the repo root.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

/* Which port to listen on.
 *
 * An explicit argument wins, because the test harness passes one and needs
 * exactly that port. Otherwise $PORT, because that is how every managed
 * container tells an app where to listen -- and listening anywhere else there
 * means the platform's health check never succeeds and the deploy is reported
 * as failed with the app running perfectly inside.
 *
 * `npm start` deliberately passes NO argument so $PORT is honoured; `npm run
 * dev` passes 8000, which is the workstation case.
 */
const PORT = Number(process.argv[2] || process.env.PORT || 8000);

/* Which interface to bind.
 *
 * Loopback on a workstation: this serves the repo ROOT, and a laptop on an
 * untrusted network has no business offering that to the network. A managed
 * container is the opposite case -- the platform's proxy runs outside the
 * container's network namespace, so a loopback bind is unreachable from it
 * and nothing is served at all.
 *
 * The platform announces itself by setting $PORT, which is the same signal it
 * uses to say which port to use, so that is what switches the bind. HOST
 * overrides both, for the cases neither guess fits.
 */
const HOST = process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".flashy": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

const server = http.createServer((req, res) => {
  req.on("error", () => { /* client aborted; the response guard below handles it */ });
  const url = new URL(req.url, "http://localhost");
  const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.join(ROOT, rel);

  // path.relative is the portable containment check — startsWith() trips over
  // Windows drive-letter casing.
  const outside = path.relative(ROOT, filePath);
  if (outside.startsWith("..") || path.isAbsolute(outside)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, body) => {
    // A browser that navigated away, or a page the test runner closed, leaves
    // a dead response behind. Writing to it throws, and an uncaught throw in
    // this callback would take the whole server down mid-suite.
    if (res.destroyed || res.writableEnded) return;
    try {
      if (err) {
        res.writeHead(404, { "content-type": "text/plain" }).end(`Not found: ${rel}`);
        return;
      }
      res.writeHead(200, {
        "content-type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(body);
    } catch {
      /* client vanished mid-write — nothing to report and nothing to do */
    }
  });
});

// Aborted requests and malformed preambles both arrive as events, not throws,
// and both are fatal if unhandled.
server.on("clientError", (_err, socket) => {
  if (!socket.destroyed) socket.destroy();
});
server.on("error", (err) => {
  console.error(`Flashy dev server: ${err.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const shown = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`Flashy served on ${HOST}:${PORT} \u2014 http://${shown}:${PORT}/ (editor: /editor.html)`);
});
