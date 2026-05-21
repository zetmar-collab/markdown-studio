import { useCallback, useEffect, useRef, useState } from "react";
import type {} from "../../types/electron-api";
import type { Tab } from "../renderer-types";
import { SAMPLE_DOCUMENT } from "./useFileManager";

// ── constants ──────────────────────────────────────────────────────────────

const AUTOSAVE_INTERVAL = 30_000;
const MAX_RECENT_FILES  = 10;
const RECENT_FILES_KEY  = "recentFiles";

// ── helpers ────────────────────────────────────────────────────────────────

let _tabSeq = 0;
function newId() { return `tab-${++_tabSeq}`; }

function emptyTab(): Tab {
  return { id: newId(), content: SAMPLE_DOCUMENT, filePath: null, fileName: "bez-nazwy.md", dirty: false };
}

function loadRecentFiles(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_FILES_KEY) ?? "[]") as string[]; }
  catch { return []; }
}

type OpenedFile = Awaited<ReturnType<typeof window.markdownStudio.openFile>>;

// ── hook ───────────────────────────────────────────────────────────────────

export function useTabManager(setStatus: (msg: string) => void) {
  const initial           = emptyTab();
  const [tabs,       setTabs]       = useState<Tab[]>([initial]);
  const [activeId,   setActiveId]   = useState<string>(initial.id);
  const [recentFiles, setRecentFiles] = useState<string[]>(loadRecentFiles);

  /** Always-current tabs array – used by autosave and onWillClose. */
  const tabsRef = useRef<Tab[]>(tabs);
  tabsRef.current = tabs;

  // Derived active tab (always defined)
  const active = tabs.find(t => t.id === activeId) ?? tabs[0];

  /** Always-current active-tab snapshot – used by drag-drop effect in App. */
  const snap = useRef({ content: active.content, filePath: active.filePath, dirty: active.dirty });
  snap.current = { content: active.content, filePath: active.filePath, dirty: active.dirty };

  // ── patch helpers ─────────────────────────────────────────────────────────

  const patchTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const patchActive = useCallback((patch: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === activeId ? { ...t, ...patch } : t));
  }, [activeId]);

  // ── recent files ──────────────────────────────────────────────────────────

  const addToRecent = useCallback((path: string) => {
    setRecentFiles(prev => {
      const next = [path, ...prev.filter(p => p !== path)].slice(0, MAX_RECENT_FILES);
      localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // ── autosave ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = window.setInterval(async () => {
      const dirty = tabsRef.current.filter(t => t.dirty && t.filePath);
      for (const tab of dirty) {
        const file = await window.markdownStudio.saveFile({ filePath: tab.filePath!, content: tab.content });
        if (file) {
          patchTab(tab.id, { dirty: false });
          setStatus(`Autosave: ${file.fileName}`);
        }
      }
    }, AUTOSAVE_INTERVAL);
    return () => window.clearInterval(id);
  }, [patchTab, setStatus]);

  // ── close-button protection (handles all dirty tabs) ─────────────────────

  useEffect(() => {
    return window.markdownStudio.onWillClose(() => {
      const dirty = tabsRef.current.filter(t => t.dirty);
      if (!dirty.length) { void window.markdownStudio.forceClose(); return; }
      const msg = dirty.length === 1
        ? `Masz niezapisane zmiany w „${dirty[0].fileName}". Czy na pewno chcesz zamknąć?`
        : `Masz ${dirty.length} zakładki z niezapisanymi zmianami. Czy na pewno chcesz zamknąć?`;
      if (window.confirm(msg)) void window.markdownStudio.forceClose();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── apply opened file to active tab ──────────────────────────────────────

  const applyFile = useCallback((file: OpenedFile) => {
    if (!file) return;
    patchActive({ content: file.content, filePath: file.filePath, fileName: file.fileName, dirty: false });
    addToRecent(file.filePath);
    setStatus(`Otworzono ${file.fileName}`);
    void window.markdownStudio.setTitle(`${file.fileName} — Markdown Studio`);
  }, [patchActive, addToRecent, setStatus]);

  // ── file operations ───────────────────────────────────────────────────────

  const loadStartupFile = useCallback(async () => {
    applyFile(await window.markdownStudio.getStartupFile());
  }, [applyFile]);

  /** Creates a NEW empty tab rather than clearing the current one. */
  const newDocument = useCallback(() => {
    const tab = emptyTab();
    setTabs(prev => [...prev, tab]);
    setActiveId(tab.id);
    void window.markdownStudio.setTitle("bez-nazwy.md — Markdown Studio");
  }, []);

  const open = useCallback(async () => {
    if (snap.current.dirty && !window.confirm("Masz niezapisane zmiany. Czy na pewno chcesz otworzyć inny plik?")) return;
    applyFile(await window.markdownStudio.openFile());
  }, [applyFile]);

  const openRecentFile = useCallback(async (path: string) => {
    if (snap.current.dirty && !window.confirm("Masz niezapisane zmiany. Czy na pewno chcesz otworzyć inny plik?")) return;
    applyFile(await window.markdownStudio.openFilePath(path));
  }, [applyFile]);

  const save = useCallback(async () => {
    const file = await window.markdownStudio.saveFile({ filePath: snap.current.filePath, content: snap.current.content });
    if (!file) return;
    patchActive({ filePath: file.filePath, fileName: file.fileName, dirty: false });
    setStatus(`Zapisano ${file.fileName}`);
    void window.markdownStudio.setTitle(`${file.fileName} — Markdown Studio`);
  }, [patchActive, setStatus]);

  const saveAs = useCallback(async () => {
    const file = await window.markdownStudio.saveFileAs({ filePath: snap.current.filePath, content: snap.current.content });
    if (!file) return;
    patchActive({ filePath: file.filePath, fileName: file.fileName, dirty: false });
    setStatus(`Zapisano jako ${file.fileName}`);
    void window.markdownStudio.setTitle(`${file.fileName} — Markdown Studio`);
  }, [patchActive, setStatus]);

  // ── tab management ────────────────────────────────────────────────────────

  const switchTab = useCallback((id: string) => {
    setActiveId(id);
    const tab = tabsRef.current.find(t => t.id === id);
    if (tab) {
      const title = `${tab.fileName}${tab.dirty ? " •" : ""} — Markdown Studio`;
      void window.markdownStudio.setTitle(title);
    }
  }, []);

  const closeTab = useCallback((id: string) => {
    const tab = tabsRef.current.find(t => t.id === id);
    if (!tab) return;
    if (tab.dirty && !window.confirm(`Zamknąć „${tab.fileName}" z niezapisanymi zmianami?`)) return;

    setTabs(prev => {
      if (prev.length === 1) {
        // Last tab – replace with a fresh empty tab
        const fresh = emptyTab();
        setActiveId(fresh.id);
        return [fresh];
      }
      const next = prev.filter(t => t.id !== id);
      // If we closed the active tab, activate the adjacent one
      setActiveId(cur => {
        if (cur !== id) return cur;
        const idx = prev.findIndex(t => t.id === id);
        return next[Math.min(idx, next.length - 1)].id;
      });
      return next;
    });
  }, []);

  // ── active-tab convenience setters (used by App.tsx CodeMirror onChange) ──

  const setContent = useCallback((value: string) => {
    patchActive({ content: value });
  }, [patchActive]);

  const setDirty = useCallback((dirty: boolean) => {
    patchActive({ dirty });
  }, [patchActive]);

  // ── public API ────────────────────────────────────────────────────────────

  return {
    // active tab reactive state
    content:    active.content,
    setContent,
    filePath:   active.filePath,
    fileName:   active.fileName,
    dirty:      active.dirty,
    setDirty,
    recentFiles,
    snap,
    // file operations
    loadStartupFile,
    newDocument,
    open,
    openRecentFile,
    save,
    saveAs,
    // tab management
    tabs,
    activeId,
    tabsRef,
    switchTab,
    closeTab,
  } as const;
}
