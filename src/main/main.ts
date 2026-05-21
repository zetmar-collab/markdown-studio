import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from "electron";
import { dirname, basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
type AppTheme = "light" | "dark";

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
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 700,
    title: "Markdown Studio",
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

  if (isDev) mainWindow.webContents.openDevTools();

  Menu.setApplicationMenu(null);

  if (isDev) {
    void mainWindow.loadURL("http://localhost:5173");
  } else {
    void mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

function markdownFilters() {
  return [
    { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] },
    { name: "Wszystkie pliki", extensions: ["*"] }
  ];
}

function defaultExportName(payload: ExportPayload, extension: "pdf" | "html") {
  const rawSource = payload.filePath ? basename(payload.filePath) : payload.title || "dokument";
  const source = rawSource
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .trim() || "dokument";
  return `${source}.${extension}`;
}

function ensureExtension(filePath: string, extension: "pdf" | "html") {
  return extname(filePath).toLowerCase() === `.${extension}` ? filePath : `${filePath}.${extension}`;
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


function exportHtmlDocument(payload: ExportPayload) {
  const dark = payload.theme === "dark";
  const colors = dark
    ? { bg: "#111318", text: "#f3f5f7", muted: "#b8bec8", border: "#343943", code: "#1b1f27" }
    : { bg: "#ffffff", text: "#1c2027", muted: "#5d6675", border: "#d9dee7", code: "#f4f6f9" };

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(payload.title)}</title>
<style>
  @page { margin: 24mm 20mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: ${colors.bg};
    color: ${colors.text};
    font-family: "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.62;
  }
  main { max-width: 780px; margin: 0 auto; }
  h1, h2, h3, h4 { line-height: 1.2; margin: 1.5em 0 .55em; color: ${colors.text}; }
  h1 { font-size: 28pt; border-bottom: 1px solid ${colors.border}; padding-bottom: .2em; }
  h2 { font-size: 20pt; border-bottom: 1px solid ${colors.border}; padding-bottom: .15em; }
  h3 { font-size: 15pt; }
  p, ul, ol, blockquote, pre, table { margin: 0 0 1em; }
  a { color: #276ef1; }
  blockquote { border-left: 4px solid ${colors.border}; padding-left: 14px; color: ${colors.muted}; }
  code { background: ${colors.code}; border: 1px solid ${colors.border}; border-radius: 4px; padding: 1px 4px; font-family: Consolas, monospace; }
  pre { background: ${colors.code}; border: 1px solid ${colors.border}; border-radius: 8px; padding: 14px; overflow: hidden; }
  pre code { border: 0; padding: 0; background: transparent; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid ${colors.border}; padding: 8px 10px; text-align: left; }
  th { background: ${colors.code}; }
  img { max-width: 100%; }
</style>
</head>
<body><main>${payload.html}</main></body>
</html>`;
}


function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const htmlWithImages = await embedLocalImages(payload.html, payload.filePath);
  const pdfPayload = { ...payload, html: htmlWithImages };
  const htmlContent = exportHtmlDocument(pdfPayload);

  // Write to a temp file so that https:// images can also load in the export window
  const tmpPath = join(app.getPath("temp"), `md-export-${Date.now()}.html`);
  await writeFile(tmpPath, htmlContent, "utf8");

  const exportWindow = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    backgroundColor: payload.theme === "dark" ? "#111318" : "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  try {
    await exportWindow.loadFile(tmpPath);
    // Wait for fonts AND all images before printing
    await exportWindow.webContents.executeJavaScript(`
      Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        Promise.all(Array.from(document.images).map(img =>
          img.complete
            ? Promise.resolve()
            : new Promise(r => { img.onload = r; img.onerror = r; })
        ))
      ])
    `);
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
  const htmlWithImages = await embedLocalImages(payload.html, payload.filePath);
  const htmlPayload = { ...payload, html: htmlWithImages };
  const htmlContent = exportHtmlDocument(htmlPayload);

  await writeExportFile(filePath, Buffer.from(htmlContent, "utf8"));
  void shell.showItemInFolder(filePath);
  return { filePath };
});

app.whenReady().then(() => {
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
