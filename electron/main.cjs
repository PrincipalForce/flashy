// Flashy desktop — Electron main process.
//
// The renderer is the exact same static app the web build ships (editor.html +
// editor-app.js + flashy.js, no bundler involved); this file only adds the
// shell around it: windows, a native menu (macOS only — see buildMenu), native
// open/save dialogs, argv / Finder file handling, and navigation hardening.
//
// Window model: ONE DOCUMENT PER WINDOW. The editor holds a single `doc`
// global, so a second .flashy file delivered into an existing window would
// replace whatever is already open — losing unsaved work. Every file opened
// from outside the app (double-click, `flashy scene.flashy`, Finder) therefore
// gets its own window.
//
// CommonJS (.cjs) on purpose, so this keeps working if package.json ever gains
// "type": "module".
const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

// Dev mode is opt-in via `electron . --dev` (what `npm run electron:dev`
// runs), not derived from isPackaged — that way `npm run electron:preview`
// genuinely exercises the production path. There is no dev server to wait on:
// the app is static, so --dev serves the same files off disk and just opens
// DevTools; Ctrl+R picks up edits.
const isDev = !app.isPackaged && process.argv.includes("--dev");
const isMac = process.platform === "darwin";

// Served from the repo root (packaged: the app.asar root), since the static app
// lives at the top level rather than in a dist/ directory.
const APP_ROOT = path.join(__dirname, "..");

// The app is served over `flashy://` rather than `file://`. A custom standard
// scheme gives the renderer a real, stable origin — so localStorage (the AI
// API key, panel state) persists the way it does on the web — and avoids
// file:// CORS quirks, including the `fetch("flashy.js")` the HTML export path
// relies on to inline the engine.
const APP_URL = "flashy://app/editor.html";
protocol.registerSchemesAsPrivileged([
  {
    scheme: "flashy",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".cjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".flashy": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".map": "application/json",
};

function registerAppProtocol() {
  protocol.handle("flashy", async (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname === "/" ? "/editor.html" : pathname);
    // path.join normalises away any `..` and fixes separators on Windows.
    const filePath = path.join(APP_ROOT, rel);

    // Never serve anything outside the app root. path.relative is the portable
    // check — a plain startsWith() trips over Windows drive-letter casing.
    const outside = path.relative(APP_ROOT, filePath);
    if (outside.startsWith("..") || path.isAbsolute(outside)) {
      return new Response("Forbidden", { status: 403 });
    }

    // Read through fs rather than net.fetch(file://…): inside the packaged app
    // these paths live in app.asar, and fs is reliably asar-aware.
    try {
      const body = await fs.promises.readFile(filePath);
      return new Response(body, {
        headers: {
          "content-type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        },
      });
    } catch {
      // A real 404, with no index.html fallback. Flashy is a multi-page static
      // site, not an SPA, and the editor probes `fetch("/api/config")` for a
      // dev-server-supplied API key — handing that probe an HTML page instead
      // of a 404 would make it fail in a far more confusing way.
      return new Response(`Not found: ${rel}`, { status: 404 });
    }
  });
}

/** Document extensions the app can open. */
const OPENABLE = ["flashy", "json"];

/**
 * Per-window state. Each window owns its own queue of files to hand to its
 * renderer, and its own "has the renderer subscribed yet" flag.
 *
 * `ready` matters: did-finish-load fires when the page load event completes,
 * but the renderer registers its IPC listener from a script at the end of the
 * body, which can run later. A message pushed before that is dropped silently
 * — which is why startup files are PULLED by the renderer
 * (flashy:take-pending-files) rather than pushed by us.
 */
const winState = new WeakMap();
const stateOf = (win) => winState.get(win);

/**
 * Per-window close bookkeeping for the unsaved-changes guard.
 *
 * `dirty` is pushed up from the renderer (flashy:set-dirty) rather than pulled
 * on demand, because `close` can only be vetoed synchronously — there is no
 * opportunity to ask the page anything once the event has fired.
 *
 * `allowClose` is how the second pass through `close` gets let through, after
 * the user has answered the dialog.
 */
function closeStateOf(win) {
  const st = stateOf(win);
  return st || { dirty: false, allowClose: false };
}

/** Files that arrived before any window existed (macOS open-file at launch). */
const earlyFiles = [];

/* ------------------------------------------------------------------ *
 * Window state (size + position) persisted in userData.
 * ------------------------------------------------------------------ */

const stateFile = () => path.join(app.getPath("userData"), "window-state.json");

function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    if (typeof s.width === "number" && typeof s.height === "number") return s;
  } catch {
    /* first run, or the file got corrupted — fall through to defaults */
  }
  return { width: 1440, height: 900 };
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  const bounds = win.isMaximized() || win.isFullScreen() ? win.getNormalBounds() : win.getBounds();
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ ...bounds, maximized: win.isMaximized() }));
  } catch {
    /* non-fatal */
  }
}

/* ------------------------------------------------------------------ *
 * File helpers — main reads bytes, the renderer parses the document.
 * ------------------------------------------------------------------ */

// The payload crosses contextBridge on its way into the page, and that boundary
// deep-clones. Binary (Buffer / Uint8Array) does not survive it reliably, so
// everything travels as a string: .flashy documents are JSON text, and exports
// come back from the renderer base64-encoded.
function payloadForPath(filePath) {
  return {
    name: path.basename(filePath),
    path: filePath,
    text: fs.readFileSync(filePath, "utf8"),
  };
}

/** Pull document paths out of a process argv vector (`flashy scene.flashy`). */
function docPathsFromArgv(argv) {
  return argv
    .slice(1)
    .filter((a) => !a.startsWith("-"))
    .filter((a) => OPENABLE.includes(path.extname(a).slice(1).toLowerCase()))
    .filter((a) => fs.existsSync(a));
}

/**
 * One window per file — the whole point of the multi-window model. Returns the
 * windows created so callers can focus the last one.
 */
function openPathsInNewWindows(filePaths) {
  if (!filePaths || !filePaths.length) return [];
  return filePaths.map((p) => createWindow([p]));
}

async function promptOpen(parentWin) {
  const res = await dialog.showOpenDialog(parentWin ?? undefined, {
    title: "Open document",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Flashy documents", extensions: OPENABLE },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (res.canceled || !res.filePaths.length) return;
  // Same rule as double-click: a separate document gets a separate window.
  const created = openPathsInNewWindows(res.filePaths);
  created[created.length - 1]?.focus();
}

/* ------------------------------------------------------------------ *
 * Menu
 *
 * On Windows/Linux there is NO native menu: the editor renders its own menu bar
 * inside the window (buildMenuBar in editor-app.js), and two stacked File menus
 * is just confusing. The renderer already owns every shortcut there.
 *
 * macOS always shows a menu bar in the system bar — you cannot remove it, and
 * an app without one looks broken — so there we keep a native menu. It does not
 * visually duplicate the in-app bar, since it lives outside the window.
 * ------------------------------------------------------------------ */

/** Fire an editor action at whichever window has focus. */
const send = (action) => () => {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  win?.webContents.send("flashy:menu", action);
};
// Labels and action names mirror the in-app menu so both bars stay in step.
const cmd = (label, accelerator, action) => ({ label, accelerator, click: send(action) });

function buildMenu() {
  if (!isMac) {
    Menu.setApplicationMenu(null);
    return;
  }

  const template = [
    {
      label: "Flashy",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        cmd("New", "Cmd+N", "new"),
        {
          label: "New Window",
          accelerator: "Shift+Cmd+N",
          click: () => createWindow().focus(),
        },
        {
          label: "Open…",
          accelerator: "Cmd+O",
          click: () => void promptOpen(BrowserWindow.getFocusedWindow()),
        },
        { type: "separator" },
        cmd("Save", "Cmd+S", "save"),
        cmd("Save As…", "Shift+Cmd+S", "saveAs"),
        { type: "separator" },
        cmd("Export as HTML…", "Shift+Cmd+E", "export"),
        cmd("Export as Sprite Sheet…", null, "exportGIF"),
        cmd("Export as Video (WebM/MP4)…", null, "exportMP4"),
        cmd("Export as SVG…", null, "exportSVG"),
        { type: "separator" },
        cmd("Document Settings…", null, "docSettings"),
        { type: "separator" },
        { role: "close" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        cmd("Undo", "Cmd+Z", "undo"),
        cmd("Redo", "Shift+Cmd+Z", "redo"),
        { type: "separator" },
        cmd("Cut", "Cmd+X", "cut"),
        cmd("Copy", "Cmd+C", "copy"),
        cmd("Paste", "Cmd+V", "paste"),
        { type: "separator" },
        cmd("Select All", "Cmd+A", "selectAll"),
      ],
    },
    {
      label: "Insert",
      submenu: [
        cmd("New Symbol…", "Cmd+F8", "newSymbol"),
        { type: "separator" },
        cmd("Keyframe", "F6", "insKF"),
        cmd("Blank Keyframe", "F7", "insBlankKF"),
        cmd("Frame", "F5", "insFrame"),
        { type: "separator" },
        cmd("Layer", null, "addLayer"),
        cmd("Delete Layer", null, "delLayer"),
      ],
    },
    {
      label: "Modify",
      submenu: [
        cmd("Convert to Symbol…", "F8", "convertSym"),
        { type: "separator" },
        cmd("Create Motion Tween", null, "motionTween"),
        cmd("Create Shape Tween", null, "shapeTween"),
        cmd("Remove Tween", null, "removeTween"),
      ],
    },
    {
      label: "Control",
      submenu: [
        cmd("Play", null, "play"),
        cmd("Stop", null, "stop"),
        { type: "separator" },
        cmd("Test Movie", "Cmd+Return", "test"),
      ],
    },
    {
      label: "View",
      submenu: [
        cmd("Zoom In", "Cmd+Plus", "zoomIn"),
        cmd("Zoom Out", "Cmd+-", "zoomOut"),
        cmd("100%", "Cmd+1", "zoom100"),
        cmd("Fit in Window", "Cmd+2", "zoomFit"),
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "reload" },
        { role: "toggleDevTools" },
      ],
    },
    {
      role: "window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------------------------------------------ *
 * Window
 * ------------------------------------------------------------------ */

/** Offset each additional window so they don't land exactly on top of another. */
function cascadeFrom(state) {
  const open = BrowserWindow.getAllWindows().length;
  if (!open) return { x: state.x, y: state.y };
  const step = 28 * open;
  const base = BrowserWindow.getFocusedWindow()?.getBounds() ?? state;
  return { x: (base.x ?? 60) + step, y: (base.y ?? 60) + step };
}

function createWindow(files = []) {
  const state = loadWindowState();
  const { x, y } = cascadeFrom(state);

  const win = new BrowserWindow({
    x,
    y,
    width: state.width,
    height: state.height,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    // Matches the editor chrome, so the first paint doesn't flash white.
    backgroundColor: "#2b2b2b",
    title: "Flashy Studio",
    // No native menu bar on Windows/Linux — the editor draws its own.
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  winState.set(win, { ready: false, pending: [...files], dirty: false, allowClose: false });

  // Only the first window restores "maximized"; stacking maximized windows
  // would hide the fact that a second one opened at all.
  if (state.maximized && BrowserWindow.getAllWindows().length === 1) win.maximize();
  win.once("ready-to-show", () => {
    win.show();
    if (isDev) win.webContents.openDevTools({ mode: "detach" });
  });

  win.loadURL(APP_URL);

  // A reload tears down the renderer's listeners; it must re-announce itself.
  win.webContents.on("did-start-navigation", (_e, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) {
      const st = stateOf(win);
      if (st) st.ready = false;
    }
  });

  // External links go to the user's browser, never into the app window.
  // The one exception is blob: — "Test Movie" generates the standalone HTML
  // export in memory and window.open()s it, so denying blob: would break it.
  // The payload is the renderer's own output, not remote content.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("blob:")) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 900,
          height: 700,
          title: "Test Movie",
          autoHideMenuBar: true,
          webPreferences: { contextIsolation: true, nodeIntegration: false },
        },
      };
    }
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url !== win.webContents.getURL()) {
      e.preventDefault();
      if (/^https?:/.test(url)) void shell.openExternal(url);
    }
  });

  ["resize", "move"].forEach((ev) => win.on(ev, () => saveWindowState(win)));

  // Unsaved-changes guard. The web build uses beforeunload for this, but in
  // Electron returning a value from beforeunload cancels the close WITHOUT
  // showing anything — the window would just silently refuse to close. So the
  // confirmation lives here, as a real native three-way dialog.
  win.on("close", (e) => {
    saveWindowState(win);
    const st = closeStateOf(win);
    if (!st.dirty || st.allowClose) return;

    e.preventDefault();
    const choice = dialog.showMessageBoxSync(win, {
      type: "warning",
      buttons: ["Save", "Don't Save", "Cancel"],
      defaultId: 0,
      cancelId: 2,
      title: "Unsaved changes",
      message: "Save changes to this document before closing?",
      detail: "If you don't save, your changes will be lost.",
    });

    if (choice === 2) return; // Cancel — keep the window open
    if (choice === 1) {
      // Don't Save — close for real on the next pass.
      st.allowClose = true;
      win.close();
      return;
    }
    // Save — the renderer owns the save (it knows the path and the document),
    // and calls back through flashy:confirm-close when the bytes have landed.
    win.webContents.send("flashy:save-then-close");
  });

  return win;
}

/* ------------------------------------------------------------------ *
 * IPC — renderer-initiated. Every handler acts on the CALLING window.
 * ------------------------------------------------------------------ */

const callerOf = (event) => BrowserWindow.fromWebContents(event.sender);

ipcMain.handle("flashy:open-dialog", (event) => promptOpen(callerOf(event)));

ipcMain.handle("flashy:new-window", () => {
  createWindow().focus();
});

// The renderer calls this once it has subscribed. It both marks that window's
// renderer ready and drains the files queued for it — which is how a cold start
// (double-click a .flashy file in Explorer) actually delivers.
ipcMain.handle("flashy:take-pending-files", (event) => {
  const win = callerOf(event);
  const st = win && stateOf(win);
  if (!st) return [];
  st.ready = true;
  const payloads = [];
  for (const p of st.pending.splice(0, st.pending.length)) {
    try {
      payloads.push(payloadForPath(p));
    } catch (err) {
      dialog.showErrorBox("Couldn't open file", `${p}\n\n${err.message}`);
    }
  }
  return payloads;
});

// Save content the renderer produced (document or export) straight to disk with
// a native Save As dialog, instead of routing it through a browser download.
// `base64` rather than raw bytes, for the same contextBridge reason as above.
ipcMain.handle("flashy:save-file", async (event, { name, base64, filters }) => {
  const res = await dialog.showSaveDialog(callerOf(event) ?? undefined, {
    title: "Save",
    defaultPath: name,
    filters: filters?.length ? filters : undefined,
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  const buf = Buffer.from(base64, "base64");
  if (!buf.length) throw new Error("Refusing to write an empty file");
  await fs.promises.writeFile(res.filePath, buf);
  return { canceled: false, path: res.filePath };
});

// Overwrite an already-chosen path — plain Ctrl+S on a document that came from
// disk, with no dialog. The path must be one this window already knows about,
// so there is nothing to validate beyond "we have bytes to write".
ipcMain.handle("flashy:write-file", async (_event, { path: filePath, base64 }) => {
  const buf = Buffer.from(base64, "base64");
  if (!buf.length) throw new Error("Refusing to write an empty file");
  await fs.promises.writeFile(filePath, buf);
  return { canceled: false, path: filePath };
});

// Native edit actions, used when focus sits in a text field — there the menu's
// Cut/Copy/Paste must behave like ordinary text editing, not stage editing.
ipcMain.handle("flashy:edit", (event, action) => {
  const wc = event.sender;
  if (action === "cut") wc.cut();
  else if (action === "copy") wc.copy();
  else if (action === "paste") wc.paste();
  else if (action === "selectAll") wc.selectAll();
});

ipcMain.handle("flashy:set-dirty", (event, isDirty) => {
  const st = stateOf(callerOf(event));
  if (st) st.dirty = !!isDirty;
});

// The renderer finished the save it was asked to do before closing.
ipcMain.handle("flashy:confirm-close", (event) => {
  const win = callerOf(event);
  const st = win && stateOf(win);
  if (!win || !st) return;
  st.allowClose = true;
  win.close();
});

ipcMain.handle("flashy:show-item-in-folder", (_e, p) => shell.showItemInFolder(p));

/* ------------------------------------------------------------------ *
 * App lifecycle
 * ------------------------------------------------------------------ */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // A second launch (double-clicking another file) is routed here instead of
  // starting a second process. Each file still gets its own window, so the
  // documents stay separate — we just avoid paying for a whole second process.
  app.on("second-instance", (_e, argv) => {
    const paths = docPathsFromArgv(argv);
    if (paths.length) {
      const created = openPathsInNewWindows(paths);
      created[created.length - 1]?.focus();
      return;
    }
    // Launched with no file — surface an existing window.
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    } else {
      createWindow().focus();
    }
  });

  // macOS: double-clicking a file in Finder, or dropping one on the dock icon.
  app.on("open-file", (e, filePath) => {
    e.preventDefault();
    if (!app.isReady()) earlyFiles.push(filePath);
    else openPathsInNewWindows([filePath])[0]?.focus();
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    buildMenu();

    const startupFiles = [...earlyFiles.splice(0), ...docPathsFromArgv(process.argv)];
    if (startupFiles.length) openPathsInNewWindows(startupFiles);
    else createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (!isMac) app.quit();
  });
}
