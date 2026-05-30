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

export interface SearchHit {
  filePath: string;
  fileName: string;
  line: number;
  column: number;
  snippet: string;
}

export interface SearchResult {
  hits: SearchHit[];
  scannedFiles: number;
  truncated: boolean;
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
  writeClipboardRich: (payload: { html: string; text: string }) => void;
  embedImagesInHtml: (html: string, filePath: string | null) => Promise<string>;
  exportPdf: (payload: ExportPayload) => Promise<ExportResult | null>;
  exportHtml: (payload: ExportPayload) => Promise<ExportResult | null>;
  exportDocx: (payload: ExportPayload) => Promise<ExportResult | null>;
  openPrintPreview: (payload: ExportPayload) => Promise<boolean>;
  onWillClose: (callback: () => void) => () => void;
  forceClose: () => Promise<void>;
  setTitle: (title: string) => Promise<void>;
  openFilePath: (filePath: string) => Promise<MarkdownFile | null>;
  pickImageFile: () => Promise<string | null>;
  setWatchedFile: (filePath: string | null) => Promise<void>;
  onExternalFileChange: (callback: (filePath: string) => void) => () => void;
  onMenuAction: (callback: (action: string) => void) => () => void;
  pickSearchFolder: () => Promise<string | null>;
  searchInFolder: (folderPath: string, query: string) => Promise<SearchResult>;
  registerDefaultMdEditor: () => Promise<{ ok: boolean; message: string }>;
}

declare global {
  interface Window {
    markdownStudio: ElectronApi;
  }
}

export {};
