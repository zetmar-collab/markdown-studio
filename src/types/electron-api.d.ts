export type AppTheme = "light" | "dark";

export interface MarkdownFile {
  filePath: string;
  fileName: string;
  content: string;
}

export interface SavePayload {
  filePath?: string | null;
  content: string;
}

export interface ExportPayload {
  filePath?: string | null;
  html: string;
  title: string;
  theme: AppTheme;
}

export interface ExportResult {
  filePath: string;
}

export interface ElectronApi {
  newWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  getStartupFile: () => Promise<MarkdownFile | null>;
  onStartupFileChanged: (callback: () => void) => () => void;
  openFile: () => Promise<MarkdownFile | null>;
  saveFile: (payload: SavePayload) => Promise<MarkdownFile | null>;
  saveFileAs: (payload: SavePayload) => Promise<MarkdownFile | null>;
  readClipboardText: () => string;
  writeClipboardText: (text: string) => void;
  exportPdf: (payload: ExportPayload) => Promise<ExportResult | null>;
  exportHtml: (payload: ExportPayload) => Promise<ExportResult | null>;
  onWillClose: (callback: () => void) => () => void;
  forceClose: () => Promise<void>;
  setTitle: (title: string) => Promise<void>;
  openFilePath: (filePath: string) => Promise<MarkdownFile | null>;
  pickImageFile: () => Promise<string | null>;
}

declare global {
  interface Window {
    markdownStudio: ElectronApi;
  }
}

export {};
