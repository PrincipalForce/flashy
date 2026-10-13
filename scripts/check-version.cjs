#!/usr/bin/env node
// The version number lives in three places and used to disagree in all three:
// package.json said 0.2.0, flashy.js reported 0.1.0, and the splash card said
// v0.2. Nothing noticed, because nothing checked.
//
// Run in CI. `--fix` rewrites flashy.js and editor.html from package.json, so
// a release is a one-line edit plus this script.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);

const expected = JSON.parse(read("package.json")).version; // e.g. "0.3.0"
const shortExpected = expected.split(".").slice(0, 2).join("."); // "0.3"

// Each site: the file, a pattern capturing the version, and what it should be.
const sites = [
  {
    file: "flashy.js",
    // `version: '0.3.0',` inside the exported Flashy object
    re: /(version:\s*')([^']+)(')/,
    want: expected,
    label: "Flashy.version",
  },
  {
    file: "editor.html",
    // `<div class="splash-credits">v0.3 · 2026 · …` on the loading card
    re: /(<div class="splash-credits">v)([0-9.]+)( )/,
    want: shortExpected,
    label: "splash card",
  },
];

const problems = [];
let fixed = 0;

for (const site of sites) {
  const src = read(site.file);
  const m = src.match(site.re);
  if (!m) {
    problems.push(`${site.file}: could not find the ${site.label} version string`);
    continue;
  }
  if (m[2] === site.want) continue;

  if (process.argv.includes("--fix")) {
    write(site.file, src.replace(site.re, `$1${site.want}$3`));
    console.log(`fixed ${site.file}: ${site.label} ${m[2]} -> ${site.want}`);
    fixed++;
  } else {
    problems.push(
      `${site.file}: ${site.label} is "${m[2]}", but package.json says "${expected}" ` +
        `(expected "${site.want}")`
    );
  }
}

if (problems.length) {
  console.error("Version strings disagree:\n");
  for (const p of problems) console.error("  - " + p);
  console.error("\nRun `node scripts/check-version.cjs --fix` to sync them to package.json.");
  process.exit(1);
}
console.log(
  fixed ? `OK — synced ${fixed} file(s) to ${expected}.` : `OK — every version string reports ${expected}.`
);
