import {
  app,
  BrowserWindow,
  Menu,
  clipboard,
  dialog,
  ipcMain,
  net,
  protocol,
  shell,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions
} from "electron";
import { existsSync } from "node:fs";
import { dirname, basename, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import HTMLtoDOCX from "html-to-docx";
import {
  buildExportHtmlShell,
  buildPdfFooterTemplate,
  buildPdfHeaderTemplate,
  getDocumentColors,
  PRINT_PREVIEW_TOOLBAR_CSS,
  PRINT_PREVIEW_TOOLBAR_HTML,
  type DocumentTheme,
  type ExportPageOptions
} from "../shared/documentTheme.js";
import { createTranslator, type Language, type TranslationKey } from "../shared/i18n.js";
import { resolveExportTheme, type AppSettings } from "../shared/settings.js";
import { normalizeSpellcheckLanguages } from "../shared/spellcheck.js";
import { searchMarkdownInFolder, type SearchOptions } from "./searchMarkdown.js";
import { applyWindowIcon, getAppIcon } from "./appIcon.js";
import {
  indexHtmlPath,
  openDefaultAppSettings,
  registerMarkdownHandlers
} from "./fileAssociations.js";
import { embedLocalImages } from "./imageEmbed.js";
import {
  getSettings,
  loadSettings,
  onSettingsChanged,
  resetSettings,
  updateSettings
} from "./settingsStore.js";
import { readRecentFiles, readSession, writeRecentFiles, writeSession } from "./sessionStore.js";
import { forgetOwnWrite, noteOwnWrite, watchFile, type WatchHandle } from "./fileWatchers.js";
import { cleanupTempFiles, removeTempFile, writeTempHtml } from "./tempFiles.js";
import { listFolder } from "./fileTree.js";
import { buildRecentMenuEntries } from "./recentMenu.js";
import {
  checkForUpdates,
  checkForUpdatesInBackground,
  onUpdateStatus,
  type UpdateStatus
} from "./updater.js";
import { ASSET_SCHEME, fromAssetUrl } from "../shared/assetProtocol.js";
import { isWindowsStoreBuild, type PlatformInfo } from "./runtimeTarget.js";

type AppTheme = DocumentTheme;

interface SavePayload {
  filePath?: string | null;
  content: string;
}

interface ExportPayload {
  filePath?: string | null;
  html: string;
  title: string;
  theme: AppTheme;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

/**
 * Per-window state. A single module-level `mainWindow` meant "New window"
 * orphaned the previous one: menu actions, title updates and the close
 * confirmation all went to the newest window only, so closing an older window
 * hung forever on its own `preventDefault()`.
 */
interface WindowState {
  window: BrowserWindow;
  closeConfirmed: boolean;
  watch: WatchHandle | null;
  watchedPath: string | null;
  startupFilePath: string | null;
}

const windows = new Map<number, WindowState>();

/**
 * The renderer owns the recent-files list, but the native File menu has to
 * render it too, so the main process keeps a copy and rebuilds the menu
 * whenever the list changes.
 */
let recentFilesCache: string[] = [];

function t(key: TranslationKey, params?: Record<string, string | number>): string {
  return createTranslator(getSettings().language)(key, params);
}

function stateOf(win: BrowserWindow | null): WindowState | null {
  return win ? (windows.get(win.id) ?? null) : null;
}

function stateFromEvent(event: IpcMainInvokeEvent): WindowState | null {
  return stateOf(BrowserWindow.fromWebContents(event.sender));
}

function windowFromEvent(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

function focusedState(): WindowState | null {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && windows.has(focused.id)) return windows.get(focused.id)!;
  const first = windows.values().next();
  return first.done ? null : first.value;
}

function sendMenuAction(action: string) {
  focusedState()?.window.webContents.send("app:menu", action);
}

function broadcast(channel: string, ...args: unknown[]) {
  for (const state of windows.values()) {
    if (!state.window.isDestroyed()) state.window.webContents.send(channel, ...args);
  }
}

function showAboutDialog() {
  const icon = getAppIcon();
  const target = focusedState()?.window;
  const options = {
    type: "info" as const,
    title: t("app.name"),
    icon: icon.isEmpty() ? undefined : icon,
    message: t("app.name"),
    detail:
      getSettings().language === "pl"
        ? `Wersja ${app.getVersion()}\n\nEdytor i podgląd Markdown dla Windows.\nEksport: PDF, HTML, DOCX.`
        : `Version ${app.getVersion()}\n\nMarkdown editor and preview for Windows.\nExport: PDF, HTML, DOCX.`
  };
  if (target) void dialog.showMessageBox(target, options);
  else void dialog.showMessageBox(options);
}

function findMarkdownArgument(argv: string[]) {
  return (
    argv.find((argument) => {
      const extension = extname(argument).toLowerCase();
      return [".md", ".markdown", ".mdown", ".mkd"].includes(extension);
    }) ?? null
  );
}

async function readMarkdownFile(filePath: string) {
  const resolvedPath = resolve(filePath);
  const content = await readFile(resolvedPath, "utf8");
  return { filePath: resolvedPath, fileName: basename(resolvedPath), content };
}

/** Never let a missing or locked file reject across IPC; the renderer shows a status instead. */
async function readMarkdownFileSafe(filePath: string) {
  try {
    return await readMarkdownFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Must be declared before `app.whenReady()`. Serves local images to the preview
 * so the renderer no longer needs a base64 copy of every picture on every edit.
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: ASSET_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
]);

function registerAssetProtocol() {
  protocol.handle(ASSET_SCHEME, async (request) => {
    const filePath = fromAssetUrl(request.url);
    if (!filePath) return new Response("Not found", { status: 404 });
    try {
      return await net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const filePath = findMarkdownArgument(argv);
    const state = focusedState();
    if (filePath && state) {
      state.startupFilePath = filePath;
      state.window.webContents.send("file:startupChanged");
    }
    if (state) {
      if (state.window.isMinimized()) state.window.restore();
      state.window.focus();
    }
  });
}

function resolvePreloadPath(): string {
  const primary = join(__dirname, "preload.js");
  if (existsSync(primary)) return primary;
  const fallback = join(app.getAppPath(), "dist-electron", "main", "preload.js");
  if (existsSync(fallback)) return fallback;
  return primary;
}

function applySpellChecker(win: BrowserWindow, settings: AppSettings) {
  try {
    const session = win.webContents.session;
    session.setSpellCheckerEnabled(settings.spellcheckEnabled);
    if (!settings.spellcheckEnabled) return;

    // Chromium ignores codes outside its own list without complaining, so a
    // stale setting would look applied while silently checking nothing.
    const languages = normalizeSpellcheckLanguages(
      settings.spellcheckLanguages,
      session.availableSpellCheckerLanguages
    );
    if (languages.length) session.setSpellCheckerLanguages(languages);
  } catch {
    // A bad language code must not take the window down.
  }
}

/** The session every window shares; spell-check state lives on it. */
function spellSession() {
  const state = focusedState();
  return (state?.window ?? BrowserWindow.getAllWindows()[0])?.webContents.session ?? null;
}

function createWindow(startupFilePath: string | null = null) {
  const icon = getAppIcon();
  const settings = getSettings();
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 700,
    title: t("app.name"),
    icon: icon.isEmpty() ? undefined : icon,
    backgroundColor: "#101114",
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true
    }
  });

  const state: WindowState = {
    window: win,
    closeConfirmed: false,
    watch: null,
    watchedPath: null,
    startupFilePath
  };
  windows.set(win.id, state);

  applySpellChecker(win, settings);

  win.on("close", (event) => {
    if (!state.closeConfirmed) {
      event.preventDefault();
      win.webContents.send("app:willClose");
    }
  });

  win.on("closed", () => {
    state.watch?.close();
    state.watch = null;
    windows.delete(win.id);
  });

  // Spell-check suggestions are pushed to the renderer, which renders them in
  // its own styled context menu.
  win.webContents.on("context-menu", (_event, params) => {
    if (win.isDestroyed()) return;
    win.webContents.send("spell:context", {
      misspelledWord: params.misspelledWord,
      suggestions: params.dictionarySuggestions ?? [],
      x: params.x,
      y: params.y
    });
  });

  if (isDev && process.env.ELECTRON_DEVTOOLS === "1") win.webContents.openDevTools();

  win.webContents.on("did-fail-load", (_event, code, description, url) => {
    if (isDev) return;
    dialog.showErrorBox(
      `${t("app.name")} — ${t("common.error")}`,
      `Nie można wczytać interfejsu (${code}): ${description}\n${url}\n\nOczekiwany plik:\n${indexHtmlPath()}`
    );
  });

  if (isDev) {
    void win.loadURL("http://localhost:5173");
  } else {
    void win.loadFile(indexHtmlPath());
  }

  return win;
}

function markdownFilters() {
  return [
    { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] },
    { name: getSettings().language === "pl" ? "Wszystkie pliki" : "All files", extensions: ["*"] }
  ];
}

type ExportExtension = "pdf" | "html" | "docx";

function defaultExportName(payload: ExportPayload, extension: ExportExtension) {
  const rawSource = payload.filePath ? basename(payload.filePath) : payload.title || "dokument";
  const source =
    rawSource
      .replace(/\.[^.]+$/, "")
      // eslint-disable-next-line no-control-regex -- characters Windows forbids in file names
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .trim() || "dokument";
  return `${source}.${extension}`;
}

function ensureExtension(filePath: string, extension: ExportExtension) {
  return extname(filePath).toLowerCase() === `.${extension}`
    ? filePath
    : `${filePath}.${extension}`;
}

function pageOptions(settings: AppSettings): ExportPageOptions {
  return {
    margins: settings.margins,
    pageSize: settings.pageSize,
    landscape: settings.landscape
  };
}

function exportTheme(payload: ExportPayload, settings: AppSettings): DocumentTheme {
  return resolveExportTheme(settings.exportTheme, payload.theme);
}

async function prepareExportHtml(payload: ExportPayload, settings: AppSettings) {
  const htmlWithImages = await embedLocalImages(payload.html, payload.filePath);
  return buildExportHtmlShell(
    htmlWithImages,
    payload.title,
    exportTheme(payload, settings),
    pageOptions(settings)
  );
}

/**
 * Wait for fonts and images, but never longer than `timeoutMs`. A single
 * unreachable https image used to block the export forever.
 */
async function waitForDocumentReady(win: BrowserWindow, timeoutMs = 5000) {
  const ready = win.webContents.executeJavaScript(`
    Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      Promise.all(Array.from(document.images).map(img =>
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
      ))
    ]).then(() => true)
  `);
  const timeout = new Promise<boolean>((res) => setTimeout(() => res(false), timeoutMs));
  try {
    await Promise.race([ready, timeout]);
  } catch {
    /* the page went away; print what we have */
  }
}

async function writeExportFile(filePath: string, data: Buffer | Uint8Array) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
}

function menuTemplate(): MenuItemConstructorOptions[] {
  const settings = getSettings();
  const storeBuild = isWindowsStoreBuild();
  return [
    {
      label: t("menu.file"),
      submenu: [
        { label: t("menu.new"), accelerator: "CmdOrCtrl+N", click: () => sendMenuAction("new") },
        { label: t("menu.open"), accelerator: "CmdOrCtrl+O", click: () => sendMenuAction("open") },
        { label: t("menu.openFolder"), click: () => sendMenuAction("openFolder") },
        { label: t("menu.recentFiles"), submenu: recentFilesSubmenu() },
        { type: "separator" },
        { label: t("menu.save"), accelerator: "CmdOrCtrl+S", click: () => sendMenuAction("save") },
        {
          label: t("menu.saveAs"),
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendMenuAction("saveAs")
        },
        { type: "separator" },
        {
          label: t("menu.exportPdf"),
          accelerator: "CmdOrCtrl+P",
          click: () => sendMenuAction("exportPdf")
        },
        {
          label: t("menu.exportHtml"),
          accelerator: "CmdOrCtrl+E",
          click: () => sendMenuAction("exportHtml")
        },
        {
          label: t("menu.exportDocx"),
          accelerator: "CmdOrCtrl+Shift+E",
          click: () => sendMenuAction("exportDocx")
        },
        {
          label: t("menu.printPreview"),
          accelerator: "CmdOrCtrl+Shift+P",
          click: () => sendMenuAction("printPreview")
        },
        { type: "separator" },
        {
          label: t("menu.workspaceSearch"),
          accelerator: "CmdOrCtrl+Shift+F",
          click: () => sendMenuAction("workspaceSearch")
        },
        { type: "separator" },
        storeBuild
          ? {
              // In the Store build the package manifest owns the associations;
              // all the app may do is send the user to Windows settings.
              label: t("menu.defaultApps"),
              click: () => void openDefaultAppSettings()
            }
          : {
              label: t("menu.setDefaultEditor"),
              click: () => {
                void (async () => {
                  const result = await registerMarkdownHandlers();
                  const target = focusedState()?.window;
                  if (target) {
                    void dialog.showMessageBox(target, {
                      type: result.ok ? "info" : "error",
                      title: "Pliki Markdown",
                      message: result.ok ? "Rejestracja zakończona" : "Rejestracja nieudana",
                      detail: result.message
                    });
                  }
                  if (result.ok) await openDefaultAppSettings();
                })();
              }
            },
        { type: "separator" },
        {
          label: t("menu.settings"),
          accelerator: "CmdOrCtrl+,",
          click: () => sendMenuAction("settings")
        },
        { type: "separator" },
        {
          label: t("menu.closeTab"),
          accelerator: "CmdOrCtrl+W",
          click: () => sendMenuAction("closeTab")
        },
        { label: t("menu.quit"), role: "quit" }
      ]
    },
    {
      label: t("menu.edit"),
      submenu: [
        { label: t("menu.undo"), role: "undo" },
        { label: t("menu.redo"), role: "redo" },
        { type: "separator" },
        { label: t("menu.cut"), role: "cut" },
        { label: t("menu.copy"), role: "copy" },
        { label: t("menu.paste"), role: "paste" },
        { type: "separator" },
        { label: t("menu.selectAll"), role: "selectAll" }
      ]
    },
    {
      label: t("menu.view"),
      submenu: [
        { label: t("menu.viewSplit"), click: () => sendMenuAction("viewSplit") },
        { label: t("menu.viewEditor"), click: () => sendMenuAction("viewEditor") },
        { label: t("menu.viewPreview"), click: () => sendMenuAction("viewPreview") },
        { type: "separator" },
        { label: t("menu.outline"), click: () => sendMenuAction("toggleOutline") },
        { label: t("menu.fileTree"), click: () => sendMenuAction("toggleFileTree") },
        {
          label: t("menu.focusMode"),
          accelerator: "F11",
          click: () => sendMenuAction("toggleFocusMode")
        },
        { type: "separator" },
        { label: t("menu.themeLight"), click: () => sendMenuAction("themeLight") },
        { label: t("menu.themeDark"), click: () => sendMenuAction("themeDark") },
        { type: "separator" },
        { label: t("menu.zoomIn"), role: "zoomIn" },
        { label: t("menu.zoomOut"), role: "zoomOut" },
        { label: t("menu.zoomReset"), role: "resetZoom" }
      ]
    },
    {
      label: t("menu.template"),
      submenu: [
        { label: t("template.blank"), click: () => sendMenuAction("templateBlank") },
        { label: t("template.meeting"), click: () => sendMenuAction("templateMeeting") },
        { label: t("template.article"), click: () => sendMenuAction("templateArticle") },
        { label: t("template.project"), click: () => sendMenuAction("templateProject") }
      ]
    },
    {
      label: t("menu.language"),
      submenu: [
        {
          label: "Polski",
          type: "radio",
          checked: settings.language === "pl",
          click: () => void applyLanguage("pl")
        },
        {
          label: "English",
          type: "radio",
          checked: settings.language === "en",
          click: () => void applyLanguage("en")
        }
      ]
    },
    {
      label: t("menu.help"),
      submenu: [
        // The Store services updates itself; offering our own check would
        // violate the "no third-party installers" policy.
        ...(storeBuild
          ? []
          : ([
              { label: t("menu.checkUpdates"), click: () => void checkForUpdates() },
              { type: "separator" }
            ] as MenuItemConstructorOptions[])),
        { label: t("menu.about"), click: () => showAboutDialog() }
      ]
    }
  ];
}

function recentFilesSubmenu(): MenuItemConstructorOptions[] {
  if (!recentFilesCache.length) {
    return [{ label: t("menu.recentEmpty"), enabled: false }];
  }
  return [
    ...buildRecentMenuEntries(recentFilesCache).map(({ label, filePath }) => ({
      label,
      toolTip: filePath,
      click: () => {
        focusedState()?.window.webContents.send("file:openRecent", filePath);
      }
    })),
    { type: "separator" as const },
    {
      label: t("menu.clearRecent"),
      click: () => {
        void (async () => {
          recentFilesCache = await writeRecentFiles([]);
          setupApplicationMenu();
          broadcast("recent:changed", recentFilesCache);
        })();
      }
    }
  ];
}

function setupApplicationMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate()));
}

async function applyLanguage(language: Language) {
  const settings = await updateSettings({ language });
  broadcast("settings:changed", settings);
}

async function pickSavePath(
  win: BrowserWindow | null,
  defaultPath: string,
  filters: Electron.FileFilter[]
) {
  const options = { defaultPath, filters };
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options);
  return result.canceled || !result.filePath ? null : result.filePath;
}

/** Remember a document in the Windows jump list / recent documents. */
function rememberRecentDocument(filePath: string) {
  try {
    app.addRecentDocument(filePath);
  } catch {
    /* not supported on this platform */
  }
}

function setupJumpList() {
  if (process.platform !== "win32") return;
  try {
    app.setJumpList([
      {
        type: "tasks",
        items: [
          {
            type: "task",
            title: t("menu.new"),
            program: process.execPath,
            args: "",
            description: t("menu.new"),
            iconPath: process.execPath,
            iconIndex: 0
          }
        ]
      },
      { type: "recent" }
    ]);
  } catch {
    /* jump list is a nicety, never fatal */
  }
}

/* ------------------------------------------------------------------ *
 * IPC: files
 * ------------------------------------------------------------------ */

ipcMain.handle("file:open", async (event) => {
  const win = windowFromEvent(event);
  const options: Electron.OpenDialogOptions = {
    properties: ["openFile"],
    filters: markdownFilters()
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return null;
  const file = await readMarkdownFileSafe(result.filePaths[0]);
  if (file) rememberRecentDocument(file.filePath);
  return file;
});

ipcMain.handle("file:getStartup", async (event) => {
  const state = stateFromEvent(event);
  if (!state?.startupFilePath) return null;
  const filePath = state.startupFilePath;
  state.startupFilePath = null;
  return readMarkdownFileSafe(filePath);
});

async function saveToPath(filePath: string, content: string) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  // Tell the watcher this mtime is ours so it does not prompt a reload.
  await noteOwnWrite(filePath);
  rememberRecentDocument(filePath);
  return { filePath, fileName: basename(filePath), content };
}

ipcMain.handle("file:save", async (event, payload: SavePayload) => {
  const win = windowFromEvent(event);
  const filePath =
    payload.filePath ?? (await pickSavePath(win, t("app.untitled"), markdownFilters()));
  if (!filePath) return null;
  try {
    return await saveToPath(filePath, payload.content);
  } catch {
    return null;
  }
});

ipcMain.handle("file:saveAs", async (event, payload: SavePayload) => {
  const win = windowFromEvent(event);
  const filePath = await pickSavePath(
    win,
    payload.filePath ? basename(payload.filePath) : t("app.untitled"),
    markdownFilters()
  );
  if (!filePath) return null;
  try {
    return await saveToPath(filePath, payload.content);
  } catch {
    return null;
  }
});

ipcMain.handle("file:openPath", async (_event, filePath: string) => {
  const file = await readMarkdownFileSafe(filePath);
  if (file) rememberRecentDocument(file.filePath);
  return file;
});

ipcMain.handle("file:setWatched", async (event, filePath: string | null) => {
  const state = stateFromEvent(event);
  if (!state) return;
  if (state.watchedPath === filePath) return;
  state.watch?.close();
  state.watch = null;
  state.watchedPath = filePath;
  if (!filePath) return;
  forgetOwnWrite(filePath);
  await noteOwnWrite(filePath);
  state.watch = watchFile(filePath, () => {
    if (!state.window.isDestroyed()) {
      state.window.webContents.send("file:externalChange", filePath);
    }
  });
});

ipcMain.handle("folder:pick", async (event) => {
  const win = windowFromEvent(event);
  const options: Electron.OpenDialogOptions = { properties: ["openDirectory"] };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  return result.canceled || !result.filePaths.length ? null : result.filePaths[0];
});

ipcMain.handle("folder:list", async (_event, folderPath: string) => listFolder(folderPath));

/* ------------------------------------------------------------------ *
 * IPC: window + app
 * ------------------------------------------------------------------ */

ipcMain.handle("app:newWindow", async () => {
  createWindow();
});

ipcMain.handle("app:closeWindow", async (event) => {
  windowFromEvent(event)?.close();
});

ipcMain.handle("app:forceClose", (event) => {
  const state = stateFromEvent(event);
  if (!state) return;
  state.closeConfirmed = true;
  state.window.close();
});

ipcMain.handle("app:setTitle", (event, title: string) => {
  windowFromEvent(event)?.setTitle(typeof title === "string" ? title : t("app.name"));
});

ipcMain.handle("app:getVersion", () => app.getVersion());

ipcMain.handle("app:getPlatformInfo", (): PlatformInfo => ({
  version: app.getVersion(),
  isStoreBuild: isWindowsStoreBuild(),
  platform: process.platform
}));

ipcMain.handle("app:registerDefaultMdEditor", async () => {
  if (isWindowsStoreBuild()) {
    // The MSIX manifest already declares the file types. Writing to the
    // registry here would be both ineffective and against Store policy.
    await openDefaultAppSettings();
    return {
      ok: true,
      message:
        "Skojarzenia plików pochodzą z pakietu Microsoft Store. Wybierz Studio Markdown w ustawieniach Windows."
    };
  }
  const result = await registerMarkdownHandlers();
  if (result.ok) await openDefaultAppSettings();
  return result;
});

/** Native replacement for `window.confirm`, which blocks the renderer. */
ipcMain.handle("dialog:confirm", async (event, message: string) => {
  const win = windowFromEvent(event);
  const options: Electron.MessageBoxOptions = {
    type: "question",
    buttons: [t("dialog.yes"), t("dialog.no")],
    defaultId: 0,
    cancelId: 1,
    title: t("dialog.confirmTitle"),
    message: typeof message === "string" ? message : ""
  };
  const result = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options);
  return result.response === 0;
});

/* ------------------------------------------------------------------ *
 * IPC: settings + session
 * ------------------------------------------------------------------ */

ipcMain.handle("settings:get", async () => loadSettings());

ipcMain.handle("settings:update", async (_event, patch: unknown) => {
  const settings = await updateSettings(patch);
  setupApplicationMenu();
  for (const state of windows.values()) applySpellChecker(state.window, settings);
  broadcast("settings:changed", settings);
  return settings;
});

ipcMain.handle("settings:reset", async () => {
  const settings = await resetSettings();
  setupApplicationMenu();
  for (const state of windows.values()) applySpellChecker(state.window, settings);
  broadcast("settings:changed", settings);
  return settings;
});

ipcMain.handle("session:read", async () => readSession());
ipcMain.handle("session:write", async (_event, session: unknown) => writeSession(session));
ipcMain.handle("recent:read", async () => readRecentFiles());
ipcMain.handle("recent:write", async (_event, paths: unknown) => {
  recentFilesCache = await writeRecentFiles(paths);
  setupApplicationMenu();
  return recentFilesCache;
});

/* ------------------------------------------------------------------ *
 * IPC: clipboard
 * ------------------------------------------------------------------ */

function readClipboardPlainText(): string {
  const text = clipboard.readText();
  if (text.trim()) return text;
  const html = clipboard.readHTML();
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ")
    .trim();
}

ipcMain.handle("clipboard:readText", () => readClipboardPlainText());
ipcMain.handle("clipboard:readHtml", () => clipboard.readHTML());

ipcMain.handle("clipboard:writeText", (_event, text: string) => {
  clipboard.writeText(typeof text === "string" ? text : "");
});

ipcMain.handle("clipboard:writeRich", (_event, payload: { html?: string; text?: string }) => {
  const text = typeof payload?.text === "string" ? payload.text : "";
  const html = typeof payload?.html === "string" ? payload.html : "";
  if (html) clipboard.write({ text, html });
  else clipboard.writeText(text);
});

function timestampSlug(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * Saves an image sitting in the clipboard next to the document, in `assets/`,
 * and returns the relative path to reference from Markdown.
 */
ipcMain.handle("clipboard:saveImage", async (_event, docFilePath: string | null) => {
  const image = clipboard.readImage();
  if (image.isEmpty()) return null;
  if (!docFilePath) return { needsSavedFile: true as const };

  const assetsDir = join(dirname(docFilePath), "assets");
  const fileName = `paste-${timestampSlug()}.png`;
  try {
    await mkdir(assetsDir, { recursive: true });
    await writeFile(join(assetsDir, fileName), image.toPNG());
  } catch {
    return null;
  }
  return { relativePath: `assets/${fileName}`, fileName };
});

ipcMain.handle(
  "html:embedImages",
  async (_event, payload: { html: string; filePath?: string | null }) => {
    return embedLocalImages(payload.html, payload.filePath ?? null);
  }
);

ipcMain.handle("image:pickFile", async (event) => {
  const win = windowFromEvent(event);
  const options: Electron.OpenDialogOptions = {
    properties: ["openFile"],
    filters: [
      {
        name: "Grafiki",
        extensions: ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico", "avif"]
      },
      { name: getSettings().language === "pl" ? "Wszystkie pliki" : "All files", extensions: ["*"] }
    ]
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

/* ------------------------------------------------------------------ *
 * IPC: export
 * ------------------------------------------------------------------ */

function mmToInches(mm: number): number {
  return mm / 25.4;
}

ipcMain.handle("export:pdf", async (event, payload: ExportPayload) => {
  const win = windowFromEvent(event);
  const settings = getSettings();
  const selectedPath = await pickSavePath(win, defaultExportName(payload, "pdf"), [
    { name: "PDF", extensions: ["pdf"] }
  ]);
  if (!selectedPath) return null;
  const filePath = ensureExtension(selectedPath, "pdf");

  const htmlContent = await prepareExportHtml(payload, settings);
  // A real file (not a data: URL) so https:// images can still load.
  const tmpPath = await writeTempHtml("md-export", htmlContent);

  const appIcon = getAppIcon();
  const exportWindow = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    icon: appIcon.isEmpty() ? undefined : appIcon,
    backgroundColor: getDocumentColors(exportTheme(payload, settings)).bg,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // No preload here, so the render target can run fully sandboxed.
      sandbox: true
    }
  });
  applyWindowIcon(exportWindow);

  try {
    await exportWindow.loadFile(tmpPath);
    await waitForDocumentReady(exportWindow);
    const displayHeaderFooter = Boolean(
      settings.pageNumbers || settings.headerText || settings.footerText
    );
    const pdf = await exportWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: settings.pageSize,
      landscape: settings.landscape,
      margins: {
        top: mmToInches(settings.margins.top),
        right: mmToInches(settings.margins.right),
        bottom: mmToInches(settings.margins.bottom),
        left: mmToInches(settings.margins.left)
      },
      displayHeaderFooter,
      ...(displayHeaderFooter
        ? {
            headerTemplate: buildPdfHeaderTemplate(settings.headerText),
            footerTemplate: buildPdfFooterTemplate(settings.footerText, settings.pageNumbers)
          }
        : {})
    });
    await writeExportFile(filePath, pdf);
  } finally {
    if (!exportWindow.isDestroyed()) exportWindow.close();
    await removeTempFile(tmpPath);
  }

  void shell.showItemInFolder(filePath);
  return { filePath };
});

ipcMain.handle("export:html", async (event, payload: ExportPayload) => {
  const win = windowFromEvent(event);
  const settings = getSettings();
  const selectedPath = await pickSavePath(win, defaultExportName(payload, "html"), [
    { name: "HTML", extensions: ["html", "htm"] },
    { name: getSettings().language === "pl" ? "Wszystkie pliki" : "All files", extensions: ["*"] }
  ]);
  if (!selectedPath) return null;
  const filePath = ensureExtension(selectedPath, "html");

  const htmlContent = await prepareExportHtml(payload, settings);
  await writeExportFile(filePath, Buffer.from(htmlContent, "utf8"));
  void shell.showItemInFolder(filePath);
  return { filePath };
});

ipcMain.handle("export:printPreview", async (_event, payload: ExportPayload) => {
  const settings = getSettings();
  const htmlContent = await prepareExportHtml(payload, settings);
  const tmpPath = await writeTempHtml("md-print", htmlContent);

  const appIcon = getAppIcon();
  const printWindow = new BrowserWindow({
    show: true,
    width: 920,
    height: 1100,
    title: `${t("menu.printPreview")} — ${payload.title}`,
    icon: appIcon.isEmpty() ? undefined : appIcon,
    backgroundColor: getDocumentColors(exportTheme(payload, settings)).bg,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  applyWindowIcon(printWindow);

  // The temp file outlives loadFile only until the window goes away.
  printWindow.on("closed", () => {
    void removeTempFile(tmpPath);
  });

  await printWindow.loadFile(tmpPath);
  await waitForDocumentReady(printWindow);
  await printWindow.webContents.insertCSS(PRINT_PREVIEW_TOOLBAR_CSS);
  await printWindow.webContents.executeJavaScript(
    `document.body.insertAdjacentHTML('afterbegin', ${JSON.stringify(PRINT_PREVIEW_TOOLBAR_HTML)});`
  );
  return true;
});

ipcMain.handle("export:docx", async (event, payload: ExportPayload) => {
  const win = windowFromEvent(event);
  const settings = getSettings();
  const selectedPath = await pickSavePath(win, defaultExportName(payload, "docx"), [
    { name: "Word", extensions: ["docx"] }
  ]);
  if (!selectedPath) return null;
  const filePath = ensureExtension(selectedPath, "docx");

  const htmlWithImages = await embedLocalImages(payload.html, payload.filePath);
  const body = `<div style="font-family: Segoe UI, Arial, sans-serif;">${htmlWithImages}</div>`;
  const raw = await HTMLtoDOCX(body, null, {
    orientation: settings.landscape ? "landscape" : "portrait",
    margins: {
      top: Math.round(settings.margins.top * 56.7),
      right: Math.round(settings.margins.right * 56.7),
      bottom: Math.round(settings.margins.bottom * 56.7),
      left: Math.round(settings.margins.left * 56.7)
    },
    table: { row: { cantSplit: true } },
    footer: Boolean(settings.footerText) || settings.pageNumbers,
    pageNumber: settings.pageNumbers
  });
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
  await writeExportFile(filePath, buffer);
  void shell.showItemInFolder(filePath);
  return { filePath };
});

/* ------------------------------------------------------------------ *
 * IPC: search + updates
 * ------------------------------------------------------------------ */

ipcMain.handle("search:pickFolder", async (event) => {
  const win = windowFromEvent(event);
  const options: Electron.OpenDialogOptions = { properties: ["openDirectory"] };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  return result.canceled || !result.filePaths.length ? null : result.filePaths[0];
});

ipcMain.handle(
  "search:inFolder",
  async (_event, payload: { folderPath: string; query: string; options?: SearchOptions }) => {
    return searchMarkdownInFolder(payload.folderPath, payload.query, payload.options);
  }
);

ipcMain.handle(
  "spell:availableLanguages",
  () => spellSession()?.availableSpellCheckerLanguages ?? []
);

ipcMain.handle("spell:addWord", (_event, word: string) => {
  if (typeof word !== "string" || !word.trim()) return false;
  try {
    return spellSession()?.addWordToSpellCheckerDictionary(word.trim()) ?? false;
  } catch {
    return false;
  }
});

ipcMain.handle("spell:removeWord", (_event, word: string) => {
  if (typeof word !== "string" || !word.trim()) return false;
  try {
    return spellSession()?.removeWordFromSpellCheckerDictionary(word.trim()) ?? false;
  } catch {
    return false;
  }
});

ipcMain.handle("spell:listWords", async () => {
  try {
    return (await spellSession()?.listWordsInSpellCheckerDictionary()) ?? [];
  } catch {
    return [];
  }
});

ipcMain.handle("update:check", async () => {
  if (isWindowsStoreBuild()) return { kind: "unsupported" as const };
  return checkForUpdates();
});

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

onUpdateStatus((status: UpdateStatus) => broadcast("update:status", status));

onSettingsChanged(() => setupJumpList());

app.whenReady().then(async () => {
  // In an MSIX package Windows assigns the AppUserModelID (<PFN>!<AppId>);
  // overriding it there breaks taskbar pinning, jump lists and toasts.
  if (process.platform === "win32" && !isWindowsStoreBuild()) {
    app.setAppUserModelId("pl.marek.markdownstudio");
  }
  await loadSettings();
  recentFilesCache = await readRecentFiles();
  registerAssetProtocol();
  setupApplicationMenu();
  setupJumpList();

  createWindow(findMarkdownArgument(process.argv));

  // Never in the Store build: the Store is the only allowed update channel.
  if (!isWindowsStoreBuild() && getSettings().autoUpdateEnabled) {
    checkForUpdatesInBackground();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  void cleanupTempFiles();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
