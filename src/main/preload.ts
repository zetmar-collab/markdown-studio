import { clipboard, contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("markdownStudio", {
  newWindow: () => ipcRenderer.invoke("app:newWindow"),
  closeWindow: () => ipcRenderer.invoke("app:closeWindow"),
  getStartupFile: () => ipcRenderer.invoke("file:getStartup"),
  onStartupFileChanged: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("file:startupChanged", listener);
    return () => ipcRenderer.removeListener("file:startupChanged", listener);
  },
  openFile: () => ipcRenderer.invoke("file:open"),
  saveFile: (payload: unknown) => ipcRenderer.invoke("file:save", payload),
  saveFileAs: (payload: unknown) => ipcRenderer.invoke("file:saveAs", payload),
  readClipboardText: () => clipboard.readText(),
  writeClipboardText: (text: string) => clipboard.writeText(text),
  writeClipboardRich: (payload: { html: string; text: string }) => {
    clipboard.write({ text: payload.text, html: payload.html });
  },
  embedImagesInHtml: (html: string, filePath: string | null) =>
    ipcRenderer.invoke("html:embedImages", { html, filePath }),
  exportPdf: (payload: unknown) => ipcRenderer.invoke("export:pdf", payload),
  exportHtml: (payload: unknown) => ipcRenderer.invoke("export:html", payload),
  exportDocx: (payload: unknown) => ipcRenderer.invoke("export:docx", payload),
  openPrintPreview: (payload: unknown) => ipcRenderer.invoke("export:printPreview", payload),
  onWillClose: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("app:willClose", listener);
    return () => ipcRenderer.removeListener("app:willClose", listener);
  },
  forceClose: () => ipcRenderer.invoke("app:forceClose"),
  setTitle: (title: string) => ipcRenderer.invoke("app:setTitle", title),
  openFilePath: (filePath: string) => ipcRenderer.invoke("file:openPath", filePath),
  pickImageFile: () => ipcRenderer.invoke("image:pickFile"),
  setWatchedFile: (filePath: string | null) => ipcRenderer.invoke("file:setWatched", filePath),
  onExternalFileChange: (callback: (filePath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on("file:externalChange", listener);
    return () => ipcRenderer.removeListener("file:externalChange", listener);
  },
  onMenuAction: (callback: (action: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: string) => callback(action);
    ipcRenderer.on("app:menu", listener);
    return () => ipcRenderer.removeListener("app:menu", listener);
  },
  pickSearchFolder: () => ipcRenderer.invoke("search:pickFolder"),
  searchInFolder: (folderPath: string, query: string) =>
    ipcRenderer.invoke("search:inFolder", { folderPath, query }),
  registerDefaultMdEditor: () => ipcRenderer.invoke("app:registerDefaultMdEditor")
});
