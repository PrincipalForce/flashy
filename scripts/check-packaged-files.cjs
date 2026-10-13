#!/usr/bin/env node
// Guard for the one footgun in packaging a bundler-less app.
//
// Because the source files ARE the build output, electron-builder's
// `build.files` in package.json lists every asset by hand. Add a new script to
// editor.html and forget that list, and the web build works perfectly while
// the packaged desktop app 404s it — a failure you only see after building an
// installer and running it.
//
// This turns that into a CI failure instead. It is deliberately dumb: it reads
// the top-level HTML pages, pulls out every local src/href, and checks each one
// is covered by a `build.files` entry.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PAGES = ["editor.html", "index.html"];

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const patterns = (pkg.build && pkg.build.files) || [];

// `build.files` entries are globs. Only the shapes this project actually uses
// need handling: a bare filename, and a "dir/**" prefix.
const includes = patterns.filter((p) => typeof p === "string" && !p.startsWith("!"));
function covered(asset) {
  return includes.some((pattern) => {
    if (pattern === asset) return true;
    const starStar = pattern.indexOf("/**");
    if (starStar > 0) return asset.startsWith(pattern.slice(0, starStar + 1));
    return false;
  });
}

const problems = [];
for (const page of PAGES) {
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const ref = m[1];
    // Skip anchors, absolute URLs, protocol-relative and directory links.
    if (/^(#|[a-z]+:|\/\/)/i.test(ref)) continue;
    if (ref.endsWith("/")) continue;
    refs.add(ref);
  }
  for (const ref of refs) {
    if (!fs.existsSync(path.join(ROOT, ref))) {
      problems.push(`${page} references ${ref}, which does not exist`);
      continue;
    }
    if (!covered(ref)) {
      problems.push(
        `${page} loads ${ref}, but no build.files entry in package.json covers it — ` +
          `it will 404 inside the packaged app`
      );
    }
  }
}

if (problems.length) {
  console.error("Packaged file list is incomplete:\n");
  for (const p of problems) console.error("  - " + p);
  console.error("\nAdd the missing file(s) to build.files in package.json.");
  process.exit(1);
}
console.log(`OK — every asset referenced by ${PAGES.join(", ")} is in build.files.`);
