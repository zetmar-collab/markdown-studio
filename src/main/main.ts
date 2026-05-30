import { app, BrowserWindow, Menu, dialog, ipcMain, shell, type MenuItemConstructorOptions } from "electron";
import { existsSync, readFileSync, watch, type FSWatcher } from "node:fs";
import { dirname, basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import HTMLtoDOCX from "html-to-docx";
import {
  buildExportHtmlShell,
  getDocumentColors,
  PRINT_PREVIEW_TOOLBAR_CSS,
  PRINT_PREVIEW_TOOLBAR_HTML,
  type DocumentTheme
} from "../shared/documentTheme.js";
import { searchMarkdownInFolder } from "./searchMarkdown.js";
import { applyWindowIcon, getAppIcon } from "./appIcon.js";
import { indexHtmlPath, openDefaultAppSettings, registerMarkdownHandlers } from "./fileAssociations.js";

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

let mainWindow: BrowserWindow | null = null;
let startupFilePath: string | null = null;
let closeConfirmed = false;
let fileWatcher: FSWatcher | null = null;

function sendMenuAction(action: string) {
  mainWindow?.webContents.send("app:menu", action);
}

function readAppVersion(): string {
  const candidates = [
    join(app.getAppPath(), "package.json"),
    join(app.getAppPath(), "..", "package.json")
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const version = JSON.parse(readFileSync(path, "utf8")) as { version?: string };
      if (version.version) return version.version;
    } catch {
      /* ignore */
    }
  }
  return "0.2.0";
}

function showAboutDialog() {
  const icon = getAppIcon();
  const options = {
    type: "info" as const,
    title: "Markdown Studio",
    icon: icon.isEmpty() ? undefined : icon,
    message: "Markdown Studio",
    detail: `Wersja ${readAppVersion()}\n\nEdytor i podgląd Markdown dla Windows.\nEksport: PDF, HTML, DOCX.`
  };
  if (mainWindow) void dialog.showMessageBox(mainWindow, options);
  else void dialog.showMessageBox(options);
}

function findMarkdownArgument(argv: string[]) {
  return argv.find((argument) => {
    const extension = extname(argument).toLowerCase();
    return [".md", ".markdown", ".mdown", ".mkd"].includes(extension);
  }) ?? null;
}

async function readMarkdownFile(filePath: string) {
  const resolvedPath = resolve(filePath);
  const content = await readFile(resolvedPath, "utf8");
  return { filePath: resolvedPath, fileName: basename(resolvedPath), content };
}

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  startupFilePath = findMarkdownArgument(process.argv);

  app.on("second-instance", (_event, argv) => {
    const filePath = findMarkdownArgument(argv);
    if (filePath) {
      startupFilePath = filePath;
      mainWindow?.webContents.send("file:startupChanged");
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

function createWindow() {
  closeConfirmed = false;
  const icon = getAppIcon();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 700,
    title: "Markdown Studio",
    icon: icon.isEmpty() ? undefined : icon,
    backgroundColor: "#101114",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.on("close", (event) => {
    if (!closeConfirmed) {
      event.preventDefault();
      mainWindow?.webContents.send("app:willClose");
    }
  });

  if (isDev && process.env.ELECTRON_DEVTOOLS === "1") mainWindow.webContents.openDevTools();

  setupApplicationMenu();

  mainWindow.webContents.on("did-fail-load", (_event, code, description, url) => {
    if (isDev) return;
    void dialog.showErrorBox(
      "Markdown Studio — błąd ładowania",
      `Nie można wczytać interfejsu (${code}): ${description}\n${url}\n\nOczekiwany plik:\n${indexHtmlPath()}`
    );
  });

  if (isDev) {
    void mainWindow.loadURL("http://localhost:5173");
  } else {
    void mainWindow.loadFile(indexHtmlPath());
  }
}

function markdownFilters() {
  return [
    { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] },
    { name: "Wszystkie pliki", extensions: ["*"] }
  ];
}

type ExportExtension = "pdf" | "html" | "docx";

function defaultExportName(payload: ExportPayload, extension: ExportExtension) {
  const rawSource = payload.filePath ? basename(payload.filePath) : payload.title || "dokument";
  const source = rawSource
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .trim() || "dokument";
  return `${source}.${extension}`;
}

function ensureExtension(filePath: string, extension: ExportExtension) {
  return extname(filePath).toLowerCase() === `.${extension}` ? filePath : `${filePath}.${extension}`;
}

async function prepareExportHtml(payload: ExportPayload) {
  const htmlWithImages = await embedLocalImages(payload.html, payload.filePath);
  return buildExportHtmlShell(htmlWithImages, payload.title, payload.theme);
}

async function waitForDocumentReady(win: BrowserWindow) {
  await win.webContents.executeJavaScript(`
    Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      Promise.all(Array.from(document.images).map(img =>
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
      ))
    ])
  `);
}

async function writeExportFile(filePath: string, data: Buffer | Uint8Array) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
}

const IMAGE_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", svg: "image/svg+xml", webp: "image/webp",
  bmp: "image/bmp", ico: "image/x-icon", avif: "image/avif"
};

/**
 * Replaces file:// URLs and relative image src attributes with base64 data URIs
 * so they work inside data: URLs (PDF) and in html-to-docx (DOCX).
 */
async function embedLocalImages(html: string, docFilePath?: string | null): Promise<string> {
  const imgRegex = /(<img\b[^>]*?\bsrc=")([^"]+)(")/gi;
  const matches = [...html.matchAll(imgRegex)];
  if (!matches.length) return html;

  let result = html;
  // Iterate in reverse so string indices stay valid after replacements
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const src = match[2];
    let localPath: string | null = null;

    if (src.startsWith("file:///")) {
      // Windows: file:///C:/path  → C:/path
      localPath = decodeURIComponent(src.slice(8));
    } else if (src.startsWith("file://")) {
      // Unix / edge case
      localPath = decodeURIComponent(src.slice(7));
    } else if (
      !src.startsWith("http://") &&
      !src.startsWith("https://") &&
      !src.startsWith("data:") &&
      docFilePath
    ) {
      // Relative path – resolve against the saved document's directory
      localPath = resolve(dirname(docFilePath), src);
    }

    if (!localPath) continue;

    try {
      const data = await readFile(localPath);
      const ext = extname(localPath).replace(".", "").toLowerCase();
      const mime = IMAGE_MIME[ext] ?? "image/png";
      const dataUrl = `data:${mime};base64,${data.toString("base64")}`;
      const start = match.index!;
      const end = start + match[0].length;
      result = result.slice(0, start) + match[1] + dataUrl + match[3] + result.slice(end);
    } catch {
      // File unreadable – keep the original src
    }
  }
  return result;
}


function setupApplicationMenu() {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "Plik",
      submenu: [
        { label: "Nowy", accelerator: "CmdOrCtrl+N", click: () => sendMenuAction("new") },
        { label: "Otwórz…", accelerator: "CmdOrCtrl+O", click: () => sendMenuAction("open") },
        { type: "separator" },
        { label: "Zapisz", accelerator: "CmdOrCtrl+S", click: () => sendMenuAction("save") },
        { label: "Zapisz jako…", accelerator: "CmdOrCtrl+Shift+S", click: () => sendMenuAction("saveAs") },
        { type: "separator" },
        { label: "Eksport PDF…", accelerator: "CmdOrCtrl+P", click: () => sendMenuAction("exportPdf") },
        { label: "Eksport HTML…", accelerator: "CmdOrCtrl+E", click: () => sendMenuAction("exportHtml") },
        { label: "Eksport DOCX…", accelerator: "CmdOrCtrl+Shift+E", click: () => sendMenuAction("exportDocx") },
        { label: "Podgląd wydruku…", accelerator: "CmdOrCtrl+Shift+P", click: () => sendMenuAction("printPreview") },
        { type: "separator" },
        { label: "Szukaj w folderze…", accelerator: "CmdOrCtrl+Shift+F", click: () => sendMenuAction("workspaceSearch") },
        { type: "separator" },
        {
          label: "Ustaw jako domyślny edytor .md…",
          click: () => {
            void (async () => {
              const result = await registerMarkdownHandlers();
              if (mainWindow) {
                void dialog.showMessageBox(mainWindow, {
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
        { label: "Zamknij", accelerator: "CmdOrCtrl+W", click: () => sendMenuAction("closeTab") },
        { label: "Zakończ", role: "quit" }
      ]
    },
    {
      label: "Edycja",
      submenu: [
        { label: "Kopiuj", accelerator: "CmdOrCtrl+C", click: () => sendMenuAction("copy") },
        { label: "Wklej", accelerator: "CmdOrCtrl+V", click: () => sendMenuAction("paste") }
      ]
    },
    {
      label: "Widok",
      submenu: [
        { label: "Edytor i podgląd", click: () => sendMenuAction("viewSplit") },
        { label: "Tylko edytor", click: () => sendMenuAction("viewEditor") },
        { label: "Tylko podgląd", click: () => sendMenuAction("viewPreview") },
        { type: "separator" },
        { label: "Jasny motyw", click: () => sendMenuAction("themeLight") },
        { label: "Ciemny motyw", click: () => sendMenuAction("themeDark") }
      ]
    },
    {
      label: "Szablon",
      submenu: [
        { label: "Pusty dokument", click: () => sendMenuAction("templateBlank") },
        { label: "Notatka ze spotkania", click: () => sendMenuAction("templateMeeting") },
        { label: "Artykuł / wpis", click: () => sendMenuAction("templateArticle") },
        { label: "Dokumentacja projektu", click: () => sendMenuAction("templateProject") }
      ]
    },
    {
      label: "Pomoc",
      submenu: [{ label: "O programie Markdown Studio", click: () => showAboutDialog() }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function pickSavePath(defaultPath: string, filters: Electron.FileFilter[]) {
  const options = {
    defaultPath,
    filters
  };
  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);
  return result.canceled || !result.filePath ? null : result.filePath;
}

ipcMain.handle("file:open", async () => {
  const options: Electron.OpenDialogOptions = {
    properties: ["openFile"],
    filters: markdownFilters()
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return readMarkdownFile(result.filePaths[0]);
});

ipcMain.handle("file:getStartup", async () => {
  if (!startupFilePath) {
    return null;
  }

  const filePath = startupFilePath;
  startupFilePath = null;
  return readMarkdownFile(filePath);
});

ipcMain.handle("file:save", async (_event, payload: SavePayload) => {
  const filePath =
    payload.filePath ??
    (await pickSavePath("bez-nazwy.md", markdownFilters()));

  if (!filePath) {
    return null;
  }

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, payload.content, "utf8");
  return { filePath, fileName: basename(filePath), content: payload.content };
});

ipcMain.handle("file:saveAs", async (_event, payload: SavePayload) => {
  const filePath = await pickSavePath(payload.filePath ? basename(payload.filePath) : "bez-nazwy.md", markdownFilters());
  if (!filePath) {
    return null;
  }

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, payload.content, "utf8");
  return { filePath, fileName: basename(filePath), content: payload.content };
});

ipcMain.handle("app:newWindow", async () => {
  createWindow();
});

ipcMain.handle("app:closeWindow", async () => {
  mainWindow?.close();
});

ipcMain.handle("app:registerDefaultMdEditor", async () => {
  const result = await registerMarkdownHandlers();
  if (result.ok) await openDefaultAppSettings();
  return result;
});

ipcMain.handle("app:forceClose", () => {
  closeConfirmed = true;
  mainWindow?.close();
});

ipcMain.handle("app:setTitle", (_event, title: string) => {
  mainWindow?.setTitle(title);
});

ipcMain.handle("file:openPath", (_event, filePath: string) => {
  return readMarkdownFile(filePath);
});

ipcMain.handle("file:setWatched", (_event, filePath: string | null) => {
  fileWatcher?.close();
  fileWatcher = null;
  if (!filePath) return;
  try {
    fileWatcher = watch(filePath, () => {
      mainWindow?.webContents.send("file:externalChange", filePath);
    });
  } catch {
    /* unreadable or missing */
  }
});

ipcMain.handle("html:embedImages", async (_event, payload: { html: string; filePath?: string | null }) => {
  return embedLocalImages(payload.html, payload.filePath ?? null);
});

ipcMain.handle("image:pickFile", async () => {
  const options: Electron.OpenDialogOptions = {
    properties: ["openFile"],
    filters: [
      { name: "Grafiki", extensions: ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico", "avif"] },
      { name: "Wszystkie pliki", extensions: ["*"] }
    ]
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

ipcMain.handle("export:pdf", async (_event, payload: ExportPayload) => {
  const selectedPath = await pickSavePath(defaultExportName(payload, "pdf"), [
    { name: "PDF", extensions: ["pdf"] }
  ]);
  if (!selectedPath) {
    return null;
  }
  const filePath = ensureExtension(selectedPath, "pdf");

  // Embed local file:// and relative images as base64 so they appear in the PDF
  const htmlContent = await prepareExportHtml(payload);

  // Write to a temp file so that https:// images can also load in the export window
  const tmpPath = join(app.getPath("temp"), `md-export-${Date.now()}.html`);
  await writeFile(tmpPath, htmlContent, "utf8");

  const appIcon = getAppIcon();
  const exportWindow = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    icon: appIcon.isEmpty() ? undefined : appIcon,
    backgroundColor: getDocumentColors(payload.theme).bg,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  applyWindowIcon(exportWindow);

  try {
    await exportWindow.loadFile(tmpPath);
    // Wait for fonts AND all images before printing
    await waitForDocumentReady(exportWindow);
    const pdf = await exportWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4"
    });
    await writeExportFile(filePath, pdf);
  } finally {
    if (!exportWindow.isDestroyed()) exportWindow.close();
    try { await unlink(tmpPath); } catch { /* ignore cleanup errors */ }
  }

  void shell.showItemInFolder(filePath);
  return { filePath };
});

ipcMain.handle("export:html", async (_event, payload: ExportPayload) => {
  const selectedPath = await pickSavePath(defaultExportName(payload, "html"), [
    { name: "HTML", extensions: ["html", "htm"] },
    { name: "Wszystkie pliki", extensions: ["*"] }
  ]);
  if (!selectedPath) {
    return null;
  }
  const filePath = ensureExtension(selectedPath, "html");

  // Embed local images as base64 so the HTML file is fully self-contained
  const htmlContent = await prepareExportHtml(payload);
  await writeExportFile(filePath, Buffer.from(htmlContent, "utf8"));
  void shell.showItemInFolder(filePath);
  return { filePath };
});

ipcMain.handle("export:printPreview", async (_event, payload: ExportPayload) => {
  const htmlContent = await prepareExportHtml(payload);
  const tmpPath = join(app.getPath("temp"), `md-print-${Date.now()}.html`);
  await writeFile(tmpPath, htmlContent, "utf8");

  const appIcon = getAppIcon();
  const printWindow = new BrowserWindow({
    show: true,
    width: 920,
    height: 1100,
    title: `Podgląd wydruku — ${payload.title}`,
    icon: appIcon.isEmpty() ? undefined : appIcon,
    backgroundColor: getDocumentColors(payload.theme).bg,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  applyWindowIcon(printWindow);

  await printWindow.loadFile(tmpPath);
  await waitForDocumentReady(printWindow);
  await printWindow.webContents.insertCSS(PRINT_PREVIEW_TOOLBAR_CSS);
  await printWindow.webContents.executeJavaScript(
    `document.body.insertAdjacentHTML('afterbegin', ${JSON.stringify(PRINT_PREVIEW_TOOLBAR_HTML)});`
  );
  return true;
});

ipcMain.handle("export:docx", async (_event, payload: ExportPayload) => {
  const selectedPath = await pickSavePath(defaultExportName(payload, "docx"), [
    { name: "Word", extensions: ["docx"] }
  ]);
  if (!selectedPath) return null;
  const filePath = ensureExtension(selectedPath, "docx");

  const htmlWithImages = await embedLocalImages(payload.html, payload.filePath);
  const body = `<div style="font-family: Segoe UI, Arial, sans-serif;">${htmlWithImages}</div>`;
  const raw = await HTMLtoDOCX(body, null, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false
  });
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
  await writeExportFile(filePath, buffer);
  void shell.showItemInFolder(filePath);
  return { filePath };
});

ipcMain.handle("search:pickFolder", async () => {
  const options: Electron.OpenDialogOptions = {
    properties: ["openDirectory"]
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  return result.canceled || !result.filePaths.length ? null : result.filePaths[0];
});

ipcMain.handle("search:inFolder", async (_event, payload: { folderPath: string; query: string }) => {
  return searchMarkdownInFolder(payload.folderPath, payload.query);
});

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("pl.marek.markdownstudio");
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
