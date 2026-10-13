// Remove release/ before packaging.
//
// On Windows, electron-builder extracts Electron to `release\win-unpacked.tmp`
// and renames it onto `release\win-unpacked`. If anything holds a handle on the
// old directory — a leftover tree from a failed run, an open Explorer window, a
// running Flashy.exe, or Defender mid-scan — that rename fails with EPERM.
// Wiping the directory first (with retries, since the same locks can bite here)
// makes the common case go away.
const fs = require("node:fs");
const path = require("node:path");

const target = path.join(__dirname, "..", "release");

try {
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
} catch (err) {
  console.error(
    `\nCould not remove ${target}\n  ${err.message}\n\n` +
      "Something is holding a handle on it. Close any Explorer window or terminal\n" +
      "sitting in that folder, quit a running Flashy.exe, then try again.\n"
  );
  process.exit(1);
}
