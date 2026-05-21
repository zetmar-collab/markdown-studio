import { useCallback, useEffect, useRef, useState } from "react";
import type {} from "../../types/electron-api";

// ── constants ──────────────────────────────────────────────────────────────

const AUTOSAVE_INTERVAL = 30_000;
const MAX_RECENT_FILES  = 10;
const RECENT_FILES_KEY  = "recentFiles";

export const SAMPLE_DOCUMENT = `# Nowy dokument Markdown

Zacznij pisać po lewej stronie. Podgląd po prawej aktualizuje się na żywo.

## Co możesz robić

- otwierać i zapisywać pliki \`.md\`,
- formatować tekst z paska narzędzi,
- wyszukiwać i zamieniać treść,
- eksportować dokument do PDF albo HTML,
- przełączać jasny i ciemny motyw.

> To jest zwykły plik Markdown, więc możesz go edytować też w innych narzędziach.

\`\`\`ts
const app = "Markdown Studio";
console.log(\`\${app} jest gotowe do pracy\`);
\`\`\`
`;

// ── helpers ────────────────────────────────────────────────────────────────

function loadRecentFiles(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_FILES_KEY) ?? "[]") as string[]; }
  catch { return []; }
}

// ── types ──────────────────────────────────────────────────────────────────

type OpenedFile = Awaited<ReturnType<typeof window.markdownStudio.openFile>>;

/** Mutable snapshot of the three values needed by autosave and drag-drop. */
export interface FileSnap {
  content:  string;
  filePath: string | null;
  dirty:    boolean;
}

// ── hook ───────────────────────────────────────────────────────────────────

/**
 * Manages all file-related state and operations.
 * Accepts a `setStatus` callback so it can report messages without owning
 * the status bar state (which is shared with editor/export operations).
 */
export function useFileManager(setStatus: (msg: string) => void) {
  const [content,     setContent]     = useState(SAMPLE_DOCUMENT);
  const [filePath,    setFilePath]     = useState<string | null>(null);
  const [fileName,    setFileName]     = useState("bez-nazwy.md");
  const [dirty,       setDirty]        = useState(false);
  const [recentFiles, setRecentFiles]  = useState<string[]>(loadRecentFiles);

  /**
   * Always-current snapshot exposed for effects that must NOT re-subscribe
   * every time state changes (autosave interval, drag-drop listener).
   */
  const snap = useRef<FileSnap>({ content, filePath, dirty });
  snap.current = { content, filePath, dirty };

  // ── autosave ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = window.setInterval(async () => {
      const { filePath: fp, dirty: d, content: c } = snap.current;
      if (!fp || !d) return;
      const file = await window.markdownStudio.saveFile({ filePath: fp, content: c });
      if (file) {
        setFilePath(file.filePath);
        setFileName(file.fileName);
        setDirty(false);
        setStatus(`Autosave: ${file.fileName}`);
      }
    }, AUTOSAVE_INTERVAL);
    return () => window.clearInterval(id);
  }, [setStatus]);

  // ── internal helpers ──────────────────────────────────────────────────────

  const addToRecent = useCallback((path: string) => {
    setRecentFiles(prev => {
      const updated = [path, ...prev.filter(p => p !== path)].slice(0, MAX_RECENT_FILES);
      localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const applyFile = useCallback((file: OpenedFile) => {
    if (!file) return;
    setContent(file.content);
    setFilePath(file.filePath);
    setFileName(file.fileName);
    setDirty(false);
    setStatus(`Otworzono ${file.fileName}`);
    addToRecent(file.filePath);
    void window.markdownStudio.setTitle(`${file.fileName} — Markdown Studio`);
  }, [addToRecent, setStatus]);

  // ── public actions ────────────────────────────────────────────────────────

  const loadStartupFile = useCallback(async () => {
    applyFile(await window.markdownStudio.getStartupFile());
  }, [applyFile]);

  const newDocument = useCallback(() => {
    if (snap.current.dirty && !window.confirm("Masz niezapisane zmiany. Czy na pewno chcesz utworzyć nowy dokument?")) return;
    setContent("");
    setFilePath(null);
    setFileName("bez-nazwy.md");
    setDirty(false);
    setStatus("Utworzono nowy dokument");
    void window.markdownStudio.setTitle("bez-nazwy.md — Markdown Studio");
  }, [setStatus]);

  const open = useCallback(async () => {
    if (snap.current.dirty && !window.confirm("Masz niezapisane zmiany. Czy na pewno chcesz otworzyć inny plik?")) return;
    applyFile(await window.markdownStudio.openFile());
  }, [applyFile]);

  const openRecentFile = useCallback(async (recentPath: string) => {
    if (snap.current.dirty && !window.confirm("Masz niezapisane zmiany. Czy na pewno chcesz otworzyć inny plik?")) return;
    applyFile(await window.markdownStudio.openFilePath(recentPath));
  }, [applyFile]);

  const save = useCallback(async () => {
    const file = await window.markdownStudio.saveFile({
      filePath: snap.current.filePath,
      content:  snap.current.content,
    });
    if (!file) return;
    setFilePath(file.filePath);
    setFileName(file.fileName);
    setDirty(false);
    setStatus(`Zapisano ${file.fileName}`);
    void window.markdownStudio.setTitle(`${file.fileName} — Markdown Studio`);
  }, [setStatus]);

  const saveAs = useCallback(async () => {
    const file = await window.markdownStudio.saveFileAs({
      filePath: snap.current.filePath,
      content:  snap.current.content,
    });
    if (!file) return;
    setFilePath(file.filePath);
    setFileName(file.fileName);
    setDirty(false);
    setStatus(`Zapisano jako ${file.fileName}`);
    void window.markdownStudio.setTitle(`${file.fileName} — Markdown Studio`);
  }, [setStatus]);

  // ── public API ────────────────────────────────────────────────────────────

  return {
    // reactive state
    content,
    setContent,
    filePath,
    fileName,
    dirty,
    setDirty,
    recentFiles,
    /** Always-current ref — use in effects/intervals to avoid stale closures */
    snap,
    // actions
    loadStartupFile,
    newDocument,
    open,
    openRecentFile,
    save,
    saveAs,
  } as const;
}
