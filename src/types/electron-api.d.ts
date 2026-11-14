import type { AppSettings } from "../shared/settings";

export type AppTheme = "light" | "dark";

/** One saved copy of a document kept by the local version history. */
export interface HistoryEntry {
  id: number;
  savedAt: number;
  bytes: number;
}

/**
 * Outcome of a save.
 *
 * "cancelled" and "failed" used to be the same `null`, so a write that failed
 * on a read-only file or a disconnected drive was indistinguishable from the
 * user closing the dialog — and the app said nothing at all.
 */
export type SaveResult =
  | { status: "saved"; file: MarkdownFile }
  | { status: "cancelled" }
  | { status: "failed"; code: string | null; error: string; filePath: string };

/** Outcome of installing a Hunspell dictionary for one spell-check language. */
export type DictionaryInstallResult =
  | { status: "installed"; file: string }
  | { status: "already"; file: string }
  | { status: "unavailable" }
  | { status: "failed"; code: string | null; error: string; filePath: string };

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

export interface SearchOptions {
  regex?: boolean;
  caseSensitive?: boolean;
}

export interface SearchResult {
  hits: SearchHit[];
  scannedFiles: number;
  truncated: boolean;
  error?: string;
}

export interface FileTreeEntry {
  path: string;
  name: string;
  isDirectory: boolean;
}

export interface SavedTab {
  filePath: string | null;
  fileName: string;
  content?: string;
}

export interface SavedSession {
  activeIndex: number;
  tabs: SavedTab[];
}

export interface SpellContextPayload {
  misspelledWord: string;
  suggestions: string[];
  x: number;
  y: number;
}

export type ClipboardImageResult =
  { relativePath: string; fileName: string } | { needsSavedFile: true } | null;

export interface PlatformInfo {
  version: string;
  /** True when the app runs from an MSIX package (Microsoft Store build). */
  isStoreBuild: boolean;
  platform: string;
}

export type UpdateStatus =
  | { kind: "checking" }
  | { kind: "available"; version: string }
  | { kind: "none" }
  | { kind: "downloaded"; version: string }
  | { kind: "error"; message: string }
  | { kind: "unsupported" };

export interface ElectronApi {
  /* window + app */
  newWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  forceClose: () => Promise<void>;
  setTitle: (title: string) => Promise<void>;
  getVersion: () => Promise<string>;
  getPlatformInfo: () => Promise<PlatformInfo>;
  registerDefaultMdEditor: () => Promise<{ ok: boolean; message: string }>;
  confirm: (message: string) => Promise<boolean>;

  /* files */
  getStartupFile: () => Promise<MarkdownFile | null>;
  onStartupFileChanged: (callback: () => void) => () => void;
  openFile: () => Promise<MarkdownFile | null>;
  openFilePath: (filePath: string) => Promise<MarkdownFile | null>;
  saveFile: (payload: SavePayload) => Promise<SaveResult>;
  saveFileAs: (payload: SavePayload) => Promise<SaveResult>;
  showError: (title: string, detail: string) => Promise<void>;
  setWatchedFile: (filePath: string | null) => Promise<void>;
  onExternalFileChange: (callback: (filePath: string) => void) => () => void;
  onOpenRecentPath: (callback: (filePath: string) => void) => () => void;
  getPathForFile: (file: File) => string | null;

  /* folders */
  pickFolder: () => Promise<string | null>;
  listFolder: (folderPath: string) => Promise<FileTreeEntry[]>;
  listVersions: (filePath: string) => Promise<HistoryEntry[]>;
  readVersion: (filePath: string, id: number) => Promise<string | null>;
  clearHistory: (filePath: string) => Promise<void>;

  /* settings + session */
  getSettings: () => Promise<AppSettings>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  resetSettings: () => Promise<AppSettings>;
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
  readSession: () => Promise<SavedSession>;
  writeSession: (session: SavedSession) => Promise<boolean>;
  readRecentFiles: () => Promise<string[]>;
  writeRecentFiles: (paths: string[]) => Promise<string[]>;
  onRecentFilesChanged: (callback: (paths: string[]) => void) => () => void;

  /* clipboard */
  readClipboardText: () => Promise<string>;
  readClipboardHtml: () => Promise<string>;
  writeClipboardText: (text: string) => Promise<void>;
  writeClipboardRich: (payload: { html: string; text: string }) => Promise<void>;
  saveClipboardImage: (docFilePath: string | null) => Promise<ClipboardImageResult>;

  /* rendering + export */
  embedImagesInHtml: (html: string, filePath: string | null) => Promise<string>;
  pickImageFile: () => Promise<string | null>;
  exportPdf: (payload: ExportPayload) => Promise<ExportResult | null>;
  exportHtml: (payload: ExportPayload) => Promise<ExportResult | null>;
  exportDocx: (payload: ExportPayload) => Promise<ExportResult | null>;
  openPrintPreview: (payload: ExportPayload) => Promise<boolean>;

  /* search */
  pickSearchFolder: () => Promise<string | null>;
  searchInFolder: (
    folderPath: string,
    query: string,
    options?: SearchOptions
  ) => Promise<SearchResult>;

  /* menus, spelling, updates */
  onMenuAction: (callback: (action: string) => void) => () => void;
  onWillClose: (callback: () => void) => () => void;
  onSpellContext: (callback: (payload: SpellContextPayload) => void) => () => void;
  /** Every dictionary Chromium can download (57 at the time of writing). */
  getSpellLanguages: () => Promise<string[]>;
  addWordToDictionary: (word: string) => Promise<boolean>;
  removeWordFromDictionary: (word: string) => Promise<boolean>;
  listDictionaryWords: () => Promise<string[]>;
  installedDictionaries: (codes: string[]) => Promise<string[]>;
  installDictionary: (code: string) => Promise<DictionaryInstallResult>;
  openLanguageSettings: () => Promise<void>;
  checkForUpdates: () => Promise<UpdateStatus>;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
}

declare global {
  interface Window {
    markdownStudio: ElectronApi;
  }

  /** Injected by Vite from package.json — single source of truth for the version. */
  const __APP_VERSION__: string;
}

export {};
