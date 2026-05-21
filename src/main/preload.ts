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
  exportPdf: (payload: unknown) => ipcRenderer.invoke("export:pdf", payload),
  exportHtml: (payload: unknown) => ipcRenderer.invoke("export:html", payload),
  onWillClose: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("app:willClose", listener);
    return () => ipcRenderer.removeListener("app:willClose", listener);
  },
  forceClose: () => ipcRenderer.invoke("app:forceClose"),
  setTitle: (title: string) => ipcRenderer.invoke("app:setTitle", title),
  openFilePath: (filePath: string) => ipcRenderer.invoke("file:openPath", filePath),
  pickImageFile: () => ipcRenderer.invoke("image:pickFile")
});
