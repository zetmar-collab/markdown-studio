/**
 * Export to PDF, HTML and DOCX, plus the print preview.
 *
 * All four start from the same place: the HTML the preview is already showing,
 * with local images inlined so the result is a file that works on its own. PDF
 * and the print preview then render it in a throwaway window that has no
 * preload and runs sandboxed — the document being exported is untrusted input
 * and has no business reaching the rest of the application.
 */
import { BrowserWindow, ipcMain, shell } from "electron";
import { basename, dirname, extname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
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
import { resolveExportTheme, type AppSettings } from "../shared/settings.js";
import type { TranslationKey } from "../shared/i18n.js";
import { applyWindowIcon, getAppIcon } from "./appIcon.js";
import { embedLocalImages } from "./imageEmbed.js";
import { removeTempFile, writeTempHtml } from "./tempFiles.js";

export interface ExportPayload {
  filePath?: string | null;
  html: string;
  title: string;
  theme: DocumentTheme;
}

/** What the export handlers need from the rest of the main process. */
export interface ExportDeps {
  getSettings: () => AppSettings;
  translate: (key: TranslationKey, params?: Record<string, string | number>) => string;
  windowFromEvent: (event: Electron.IpcMainInvokeEvent) => BrowserWindow | null;
  pickSavePath: (
    win: BrowserWindow | null,
    defaultPath: string,
    filters: Electron.FileFilter[]
  ) => Promise<string | null>;
}

function mmToInches(mm: number): number {
  return mm / 25.4;
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

export function registerExportHandlers(deps: ExportDeps): void {
  const { getSettings, translate: t, windowFromEvent, pickSavePath } = deps;

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
}
