import { contextBridge, ipcRenderer, webUtils } from "electron";

function subscribe<T extends unknown[]>(
  channel: string,
  callback: (...args: T) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
    callback(...(args as T));
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("markdownStudio", {
  /* window + app */
  newWindow: () => ipcRenderer.invoke("app:newWindow"),
  closeWindow: () => ipcRenderer.invoke("app:closeWindow"),
  forceClose: () => ipcRenderer.invoke("app:forceClose"),
  setTitle: (title: string) => ipcRenderer.invoke("app:setTitle", title),
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  getPlatformInfo: () => ipcRenderer.invoke("app:getPlatformInfo"),
  registerDefaultMdEditor: () => ipcRenderer.invoke("app:registerDefaultMdEditor"),
  confirm: (message: string) => ipcRenderer.invoke("dialog:confirm", message),

  /* files */
  getStartupFile: () => ipcRenderer.invoke("file:getStartup"),
  onStartupFileChanged: (callback: () => void) => subscribe("file:startupChanged", callback),
  openFile: () => ipcRenderer.invoke("file:open"),
  openFilePath: (filePath: string) => ipcRenderer.invoke("file:openPath", filePath),
  saveFile: (payload: unknown) => ipcRenderer.invoke("file:save", payload),
  saveFileAs: (payload: unknown) => ipcRenderer.invoke("file:saveAs", payload),
  setWatchedFile: (filePath: string | null) => ipcRenderer.invoke("file:setWatched", filePath),
  onExternalFileChange: (callback: (filePath: string) => void) =>
    subscribe<[string]>("file:externalChange", callback),

  /**
   * Electron 32 removed `File.path`, which silently broke drag & drop: every
   * dropped file resolved to `undefined` and was discarded. `webUtils` is the
   * supported replacement and only works from a preload script.
   */
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file) || null;
    } catch {
      return null;
    }
  },

  /* folders */
  pickFolder: () => ipcRenderer.invoke("folder:pick"),
  listFolder: (folderPath: string) => ipcRenderer.invoke("folder:list", folderPath),

  /* settings + session */
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (patch: unknown) => ipcRenderer.invoke("settings:update", patch),
  resetSettings: () => ipcRenderer.invoke("settings:reset"),
  onSettingsChanged: (callback: (settings: unknown) => void) =>
    subscribe<[unknown]>("settings:changed", callback),
  readSession: () => ipcRenderer.invoke("session:read"),
  writeSession: (session: unknown) => ipcRenderer.invoke("session:write", session),
  readRecentFiles: () => ipcRenderer.invoke("recent:read"),
  writeRecentFiles: (paths: unknown) => ipcRenderer.invoke("recent:write", paths),

  /* clipboard */
  readClipboardText: () => ipcRenderer.invoke("clipboard:readText"),
  readClipboardHtml: () => ipcRenderer.invoke("clipboard:readHtml"),
  writeClipboardText: (text: string) => ipcRenderer.invoke("clipboard:writeText", text),
  writeClipboardRich: (payload: { html: string; text: string }) =>
    ipcRenderer.invoke("clipboard:writeRich", payload),
  saveClipboardImage: (docFilePath: string | null) =>
    ipcRenderer.invoke("clipboard:saveImage", docFilePath),

  /* rendering + export */
  embedImagesInHtml: (html: string, filePath: string | null) =>
    ipcRenderer.invoke("html:embedImages", { html, filePath }),
  pickImageFile: () => ipcRenderer.invoke("image:pickFile"),
  exportPdf: (payload: unknown) => ipcRenderer.invoke("export:pdf", payload),
  exportHtml: (payload: unknown) => ipcRenderer.invoke("export:html", payload),
  exportDocx: (payload: unknown) => ipcRenderer.invoke("export:docx", payload),
  openPrintPreview: (payload: unknown) => ipcRenderer.invoke("export:printPreview", payload),

  /* search */
  pickSearchFolder: () => ipcRenderer.invoke("search:pickFolder"),
  searchInFolder: (folderPath: string, query: string, options?: unknown) =>
    ipcRenderer.invoke("search:inFolder", { folderPath, query, options }),

  /* menus, spelling, updates */
  onMenuAction: (callback: (action: string) => void) => subscribe<[string]>("app:menu", callback),
  onWillClose: (callback: () => void) => subscribe("app:willClose", callback),
  onSpellContext: (callback: (payload: unknown) => void) =>
    subscribe<[unknown]>("spell:context", callback),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  onUpdateStatus: (callback: (status: unknown) => void) =>
    subscribe<[unknown]>("update:status", callback)
});
