import { app, shell } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

const PROG_ID = "MarkdownStudio.md";
const MARKDOWN_EXTS = [".md", ".markdown", ".mdown", ".mkd"];

function regArgs(...parts: string[]) {
  return ["reg", "add", ...parts, "/f"];
}

/** Registers Markdown Studio as a handler for .md (current user, HKCU). */
export async function registerMarkdownHandlers(): Promise<{ ok: boolean; message: string }> {
  if (process.platform !== "win32") {
    return { ok: false, message: "Obsługiwane tylko na Windows." };
  }

  const exe = process.execPath;
  if (!existsSync(exe)) {
    return { ok: false, message: "Nie znaleziono pliku programu." };
  }

  const exeQuoted = `"${exe}"`;
  const iconRef = `"${exe}",0`;

  try {
    await execFileAsync("reg", regArgs(`HKCU\\Software\\Classes\\${PROG_ID}`, "/ve", "/d", "Markdown Studio"));
    await execFileAsync(
      "reg",
      regArgs(`HKCU\\Software\\Classes\\${PROG_ID}\\DefaultIcon`, "/ve", "/d", iconRef)
    );
    await execFileAsync(
      "reg",
      regArgs(
        `HKCU\\Software\\Classes\\${PROG_ID}\\shell\\open\\command`,
        "/ve",
        "/d",
        `${exeQuoted} "%1"`
      )
    );

    for (const ext of MARKDOWN_EXTS) {
      const key = ext.startsWith(".") ? ext.slice(1) : ext;
      await execFileAsync("reg", regArgs(`HKCU\\Software\\Classes\\.${key}`, "/ve", "/d", PROG_ID));
    }

    return {
      ok: true,
      message:
        "Zarejestrowano obsługę plików Markdown. Ustaw domyślną aplikację w oknie, które za chwilę się otworzy."
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "nieznany błąd";
    return { ok: false, message: `Rejestracja nie powiodła się: ${msg}` };
  }
}

/** Opens Windows settings to pick default app for .md */
export async function openDefaultAppSettings(): Promise<void> {
  const urls = [
    "ms-settings:defaultapps-fileextension?extension=.md",
    "ms-settings:defaultapps"
  ];
  for (const url of urls) {
    try {
      await shell.openExternal(url);
      return;
    } catch {
      /* try next */
    }
  }
}

export function indexHtmlPath(): string {
  const candidates = [
    join(app.getAppPath(), "dist", "index.html"),
    join(app.getAppPath(), "..", "dist", "index.html")
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return join(app.getAppPath(), "dist", "index.html");
}
