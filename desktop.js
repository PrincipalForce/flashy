// Desktop (Electron) integration for the Flashy editor.
//
// Loaded by editor.html AFTER editor-app.js, and a complete no-op in a browser:
// everything below is inside `if (window.flashyDesktop)`, and that global only
// exists because electron/preload.cjs creates it. The web app is unchanged.
//
// What it adds, when running inside the Electron shell:
//   * Ctrl/Cmd+S saves in place once a document has a path on disk, instead of
//     producing a fresh download every time.
//   * Save As… and New Window entries in the editor's own File menu.
//   * Every export (HTML, SVG, sprite sheet, JS module, MP4) goes through a
//     native Save dialog rather than the browser download shelf.
//   * Documents opened from Explorer/Finder, the Open dialog, or the command
//     line land in the editor.
//   * The native macOS menu (electron/main.cjs) drives the same doAction()
//     verbs the in-app menu uses.
//
// editor-app.js is wrapped in an IIFE, so none of its internals are reachable
// from here. It publishes a deliberate seam instead — window._flashyEditor —
// and this file installs itself through _flashyEditor.installDesktop().
(function () {
  "use strict";

  var bridge = window.flashyDesktop;
  var editor = window._flashyEditor;
  if (!bridge || !editor) return;

  /* ---------------------------------------------------------------- *
   * Current document identity
   * ---------------------------------------------------------------- */

  // Absolute path this document was opened from / last saved to, or null for a
  // document that has never touched the disk (so Save must ask where).
  var docPath = null;
  var docName = "Untitled.flashy";

  function refreshTitle() {
    // BrowserWindow has no explicit title set after load, so Electron follows
    // document.title — this is what puts the filename in the window chrome.
    // The bullet is the conventional unsaved-changes marker.
    var mark = editor.isDirty && editor.isDirty() ? "• " : "";
    document.title = mark + docName + " — Flashy Studio";
  }

  function setDocIdentity(path, name) {
    docPath = path || null;
    docName = name || docName;
    refreshTitle();
  }

  setDocIdentity(null, docName);

  /* ---------------------------------------------------------------- *
   * Unsaved-changes state
   *
   * The shell has to know this on the main-process side: `close` can only be
   * vetoed synchronously, so it cannot stop to ask the page. The editor fires
   * flashy:dirtychange whenever the answer changes, and we forward it.
   * ---------------------------------------------------------------- */
  function publishDirty() {
    refreshTitle();
    if (bridge.setDirty) {
      bridge.setDirty(!!(editor.isDirty && editor.isDirty()))["catch"](function () {
        /* the window may already be going away — nothing to do */
      });
    }
  }
  window.addEventListener("flashy:dirtychange", publishDirty);

  /* ---------------------------------------------------------------- *
   * Bytes across the bridge
   *
   * The contextBridge deep-clones, and binary (Buffer / Uint8Array) does not
   * survive that reliably — it can land as a plain {0:…,1:…} object, and
   * `new Uint8Array(thatObject)` is silently EMPTY, i.e. a zero-byte file.
   * Strings clone losslessly, so everything travels as base64.
   * ---------------------------------------------------------------- */

  /** Chunked: String.fromCharCode.apply blows its argument limit on big files. */
  function bytesToBase64(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  /** UTF-8 safe — btoa() alone throws on any character above U+00FF. */
  function stringToBase64(str) {
    return bytesToBase64(new TextEncoder().encode(str));
  }

  /** Accepts the string and Blob forms dlFile() is called with. */
  function toBase64(content) {
    if (typeof content === "string") return Promise.resolve(stringToBase64(content));
    if (content instanceof Blob) {
      return content.arrayBuffer().then(function (buf) {
        return bytesToBase64(new Uint8Array(buf));
      });
    }
    return Promise.resolve(stringToBase64(String(content)));
  }

  /* ---------------------------------------------------------------- *
   * Save dialog filters, derived from the suggested filename
   * ---------------------------------------------------------------- */

  var FILTER_NAMES = {
    flashy: "Flashy document",
    html: "HTML page",
    svg: "SVG image",
    js: "JavaScript module",
    json: "JSON",
    gif: "GIF image",
    webm: "WebM video",
    mp4: "MP4 video",
  };

  function filtersFor(name) {
    var ext = (name.split(".").pop() || "").toLowerCase();
    if (!FILTER_NAMES[ext]) return [{ name: "All files", extensions: ["*"] }];
    return [
      { name: FILTER_NAMES[ext], extensions: [ext] },
      { name: "All files", extensions: ["*"] },
    ];
  }

  function reportFailure(what, err) {
    // alert() is what the rest of the editor uses for user-facing errors; a
    // silent catch here would look like a successful save.
    window.alert("Could not " + what + ":\n\n" + ((err && err.message) || err));
  }

  /* ---------------------------------------------------------------- *
   * Save / Save As / Open
   * ---------------------------------------------------------------- */

  /** Native Save As. Resolves to the chosen path, or null if cancelled. */
  function saveAsTo(content, suggestedName) {
    return toBase64(content)
      .then(function (base64) {
        return bridge.saveFile(suggestedName, base64, filtersFor(suggestedName));
      })
      .then(function (res) {
        return res && !res.canceled ? res.path : null;
      });
  }

  function docJSON() {
    return JSON.stringify(editor.serializeDoc(), null, 2);
  }

  /** Mark the document clean — only ever after bytes have reached the disk. */
  function noteSaved() {
    if (editor.markSaved) editor.markSaved();
    refreshTitle();
  }

  /**
   * Ctrl+S — overwrite in place once we know where the document lives.
   * Resolves to true only if something was actually written, so the
   * save-then-close path can tell a real save from a cancelled dialog.
   */
  function saveDoc() {
    if (!docPath) return saveDocAs();
    return toBase64(docJSON())
      .then(function (base64) {
        return bridge.writeFile(docPath, base64);
      })
      .then(function () {
        noteSaved();
        return true;
      })
      .catch(function (err) {
        reportFailure("save " + docName, err);
        return false;
      });
  }

  function saveDocAs() {
    return saveAsTo(docJSON(), docName)
      .then(function (path) {
        if (!path) return false; // user cancelled the dialog
        setDocIdentity(path, path.split(/[\\/]/).pop());
        noteSaved();
        return true;
      })
      .catch(function (err) {
        reportFailure("save " + docName, err);
        return false;
      });
  }

  /**
   * Load a document payload ({name, path, text}) into this window.
   *
   * One document per window is the shell's rule (see electron/main.cjs), so
   * this only ever runs on a window that was created for this very file.
   */
  function applyDoc(payload) {
    if (!payload || typeof payload.text !== "string") return;
    try {
      editor.loadDoc(JSON.parse(payload.text));
    } catch (e) {
      window.alert("Failed to open " + payload.name + ": " + e.message);
      return;
    }
    setDocIdentity(payload.path, payload.name);
  }

  /* ---------------------------------------------------------------- *
   * Install into the editor
   * ---------------------------------------------------------------- */

  editor.installDesktop({
    // `mime` is unused on desktop — the dialog filters come from the extension
    // and the bytes are written verbatim — but the signature matches dlFile()
    // so the editor's call sites need no knowledge of which build they are in.
    saveFile: function (content, name, mime) {
      void mime;
      saveAsTo(content, name).catch(function (err) {
        reportFailure("save " + name, err);
      });
    },
    openDialog: function () {
      bridge.openDialog();
    },
    saveDoc: saveDoc,
    saveDocAs: saveDocAs,
    newWindow: function () {
      bridge.newWindow();
    },
  });

  /* ---------------------------------------------------------------- *
   * In-app menu additions
   *
   * `editor.menus` is the live array buildMenuBar() reads, and that runs from
   * init() on DOMContentLoaded — i.e. after this file executes — so mutating it
   * here is enough; no rebuild needed.
   * ---------------------------------------------------------------- */

  (function extendFileMenu() {
    var menus = editor.menus;
    if (!Array.isArray(menus)) return;
    var file = menus.filter(function (m) {
      return m.label === "File";
    })[0];
    if (!file) return;

    var indexOfAction = function (action) {
      for (var i = 0; i < file.items.length; i++) {
        if (file.items[i].action === action) return i;
      }
      return -1;
    };

    // Ctrl+Shift+S was the label on Export as HTML, and Save As has the stronger
    // claim on it; the export moves to Ctrl+Shift+E, matching the macOS menu.
    var exportAt = indexOfAction("export");
    if (exportAt >= 0) file.items[exportAt].shortcut = "Ctrl+Shift+E";

    var saveAt = indexOfAction("save");
    if (saveAt >= 0) {
      file.items.splice(saveAt + 1, 0, {
        label: "Save As...",
        action: "saveAs",
        shortcut: "Ctrl+Shift+S",
      });
    }

    var newAt = indexOfAction("new");
    if (newAt >= 0) {
      file.items.splice(newAt + 1, 0, {
        label: "New Window",
        action: "newWindow",
        shortcut: "Ctrl+Shift+N",
      });
    }
  })();

  /* ---------------------------------------------------------------- *
   * Keyboard — the shortcuts the editor itself does not bind
   *
   * Capture phase, because editor-app.js's handler treats Ctrl+S without
   * checking Shift and would otherwise swallow Ctrl+Shift+S as a plain Save.
   * ---------------------------------------------------------------- */

  var SHIFT_CHORDS = { s: "saveAs", n: "newWindow", e: "export" };

  document.addEventListener(
    "keydown",
    function (e) {
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      var action = SHIFT_CHORDS[e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      editor.doAction(action);
    },
    true
  );

  /* ---------------------------------------------------------------- *
   * Shell wiring
   * ---------------------------------------------------------------- */

  function ready() {
    // Native menu (macOS) commands are the same verbs as the in-app menu.
    bridge.onMenu(function (action) {
      editor.doAction(action);
    });

    // A document pushed into an already-running window.
    bridge.onOpenFile(applyDoc);

    // The user chose "Save" in the close-confirmation dialog. Only close once
    // the write has genuinely succeeded — a cancelled Save As or a failed
    // write leaves the window open rather than discarding the document.
    if (bridge.onSaveThenClose) {
      bridge.onSaveThenClose(function () {
        saveDoc().then(function (saved) {
          if (saved) bridge.confirmClose();
        });
      });
    }

    // Publish the initial (clean) state so the shell starts in step with us.
    publishDirty();

    // Cold start: a file association or CLI argument queued a document before
    // this listener existed, so pull rather than wait for a push.
    bridge
      .takePendingFiles()
      .then(function (payloads) {
        (payloads || []).forEach(applyDoc);
      })
      .catch(function (err) {
        reportFailure("open the requested file", err);
      });
  }

  // init() in editor-app.js is registered on DOMContentLoaded first, so this
  // listener runs after the editor has built itself.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
})();
