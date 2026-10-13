// Preload — the only bridge between the Electron main process and the Flashy
// renderer. Nothing Node-ish is exposed to page code beyond these functions.
//
// Exposed as `window.flashyDesktop`, NOT `window.flashy`: the animation engine
// (flashy.js) owns the latter, and clobbering it would break playback.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flashyDesktop", {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,

  /** Native menu commands — action names match doAction() in editor-app.js. */
  onMenu(handler) {
    const listener = (_e, action) => handler(action);
    ipcRenderer.on("flashy:menu", listener);
    return () => ipcRenderer.off("flashy:menu", listener);
  },

  /**
   * A document the user opened via the native dialog, the CLI, or Finder.
   * Payload is {name, path, text} — .flashy files are JSON text, so they cross
   * the contextBridge as a string (see payloadForPath in main.cjs).
   */
  onOpenFile(handler) {
    const listener = (_e, payload) => handler(payload);
    ipcRenderer.on("flashy:open-file", listener);
    return () => ipcRenderer.off("flashy:open-file", listener);
  },

  openDialog: () => ipcRenderer.invoke("flashy:open-dialog"),

  /** Open an additional, independent editor window. */
  newWindow: () => ipcRenderer.invoke("flashy:new-window"),

  /**
   * Announce that the renderer is subscribed, and collect any files queued
   * before it was — a cold start from a file association lands here, not on
   * the "flashy:open-file" push.
   */
  takePendingFiles: () => ipcRenderer.invoke("flashy:take-pending-files"),

  /** Write base64-encoded bytes to disk behind a native Save As dialog. */
  saveFile: (name, base64, filters) =>
    ipcRenderer.invoke("flashy:save-file", { name, base64, filters }),

  /** Overwrite a path the document already came from — plain Save, no dialog. */
  writeFile: (path, base64) => ipcRenderer.invoke("flashy:write-file", { path, base64 }),

  /**
   * Tell the shell whether this window holds unsaved changes. The main process
   * needs it on the main side (not just in the page) because `close` has to be
   * vetoed synchronously, before the renderer could be asked anything.
   */
  setDirty: (isDirty) => ipcRenderer.invoke("flashy:set-dirty", !!isDirty),

  /**
   * The user picked "Save" in the close-confirmation dialog. The handler must
   * save and then call confirmClose(), which closes the window for real.
   */
  onSaveThenClose(handler) {
    const listener = () => handler();
    ipcRenderer.on("flashy:save-then-close", listener);
    return () => ipcRenderer.off("flashy:save-then-close", listener);
  },

  /** Close this window without asking again — the save already happened. */
  confirmClose: () => ipcRenderer.invoke("flashy:confirm-close"),

  /** Native text-editing actions for when focus is in an input. */
  edit: (action) => ipcRenderer.invoke("flashy:edit", action),

  showItemInFolder: (path) => ipcRenderer.invoke("flashy:show-item-in-folder", path),
});
