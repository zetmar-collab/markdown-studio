import { useCallback, useEffect, useRef, useState } from "react";
import type {} from "../../types/electron-api";
import type { Tab } from "../renderer-types";
import {
  AUTOSAVE_INTERVAL_MS,
  DOCUMENT_TEMPLATES,
  MAX_RECENT_FILES,
  RECENT_FILES_KEY,
  SESSION_STORAGE_KEY,
  type DocumentTemplateId
} from "../constants";

let _tabSeq = 0;
function newId() {
  return `tab-${++_tabSeq}`;
}

function emptyTab(): Tab {
  return { id: newId(), content: "", filePath: null, fileName: "bez-nazwy.md", dirty: false };
}

function loadRecentFiles(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_FILES_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

interface SavedTab {
  filePath: string | null;
  fileName: string;
  content?: string;
}

interface SavedSession {
  activeIndex: number;
  tabs: SavedTab[];
}

type OpenedFile = Awaited<ReturnType<typeof window.markdownStudio.openFile>>;

export function useTabManager(setStatus: (msg: string) => void) {
  const initial = emptyTab();
  const [tabs, setTabs] = useState<Tab[]>([initial]);
  const [activeId, setActiveId] = useState<string>(initial.id);
  const [recentFiles, setRecentFiles] = useState<string[]>(loadRecentFiles);
  const sessionReady = useRef(false);

  const tabsRef = useRef<Tab[]>(tabs);
  tabsRef.current = tabs;

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const snap = useRef({ content: active.content, filePath: active.filePath, dirty: active.dirty });
  snap.current = { content: active.content, filePath: active.filePath, dirty: active.dirty };

  const patchTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const patchActive = useCallback(
    (patch: Partial<Tab>) => {
      setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, ...patch } : t)));
    },
    [activeId]
  );

  const addToRecent = useCallback((path: string) => {
    setRecentFiles((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, MAX_RECENT_FILES);
      localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateWindowTitle = useCallback((tab: Tab) => {
    const title = `${tab.fileName}${tab.dirty ? " •" : ""} — Markdown Studio`;
    void window.markdownStudio.setTitle(title);
  }, []);

  const confirmDiscardActive = useCallback(() => {
    const cur = tabsRef.current.find((t) => t.id === activeId);
    if (!cur?.dirty) return true;
    return window.confirm(`Masz niezapisane zmiany w „${cur.fileName}". Kontynuować?`);
  }, [activeId]);

  const openFileInTab = useCallback(
    (file: OpenedFile) => {
      if (!file) return;

      const existing = tabsRef.current.find((t) => t.filePath === file.filePath);
      if (existing) {
        setActiveId(existing.id);
        updateWindowTitle(existing);
        setStatus(`Przełączono na ${file.fileName}`);
        return;
      }

      if (!confirmDiscardActive()) return;

      const activeTab = tabsRef.current.find((t) => t.id === activeId)!;
      const reuse =
        !activeTab.filePath && !activeTab.dirty && activeTab.content.trim() === "" && activeTab.fileName === "bez-nazwy.md";

      if (reuse) {
        patchActive({
          content: file.content,
          filePath: file.filePath,
          fileName: file.fileName,
          dirty: false
        });
      } else {
        const tab: Tab = {
          id: newId(),
          content: file.content,
          filePath: file.filePath,
          fileName: file.fileName,
          dirty: false
        };
        setTabs((prev) => [...prev, tab]);
        setActiveId(tab.id);
        updateWindowTitle(tab);
      }

      addToRecent(file.filePath);
      setStatus(`Otworzono ${file.fileName}`);
      void window.markdownStudio.setTitle(`${file.fileName} — Markdown Studio`);
    },
    [activeId, addToRecent, confirmDiscardActive, patchActive, setStatus, updateWindowTitle]
  );

  const persistSession = useCallback(() => {
    if (!sessionReady.current) return;
    const list = tabsRef.current;
    const payload: SavedSession = {
      activeIndex: Math.max(0, list.findIndex((t) => t.id === activeId)),
      tabs: list.map((t) => ({
        filePath: t.filePath,
        fileName: t.fileName,
        ...(t.filePath ? {} : { content: t.content })
      }))
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  }, [activeId]);

  useEffect(() => {
    persistSession();
  }, [tabs, activeId, persistSession]);

  useEffect(() => {
    void window.markdownStudio.setWatchedFile(active.filePath);
  }, [active.filePath]);

  useEffect(() => {
    return window.markdownStudio.onExternalFileChange((changedPath) => {
      const tab = tabsRef.current.find((t) => t.filePath === changedPath);
      if (!tab) return;
      if (!window.confirm(`Plik „${tab.fileName}" zmienił się na dysku. Przeładować?`)) return;
      void window.markdownStudio.openFilePath(changedPath).then((file) => {
        if (file) patchTab(tab.id, { content: file.content, dirty: false });
      });
    });
  }, [patchTab]);

  useEffect(() => {
    const id = window.setInterval(async () => {
      const dirtyTabs = tabsRef.current.filter((t) => t.dirty && t.filePath);
      for (const tab of dirtyTabs) {
        const file = await window.markdownStudio.saveFile({ filePath: tab.filePath!, content: tab.content });
        if (file) {
          patchTab(tab.id, { dirty: false });
          setStatus(`Autosave: ${file.fileName}`);
        }
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [patchTab, setStatus]);

  useEffect(() => {
    return window.markdownStudio.onWillClose(() => {
      const dirty = tabsRef.current.filter((t) => t.dirty);
      if (!dirty.length) {
        void window.markdownStudio.forceClose();
        return;
      }
      const msg =
        dirty.length === 1
          ? `Masz niezapisane zmiany w „${dirty[0].fileName}". Czy na pewno chcesz zamknąć?`
          : `Masz ${dirty.length} zakładki z niezapisanymi zmianami. Czy na pewno chcesz zamknąć?`;
      if (window.confirm(msg)) void window.markdownStudio.forceClose();
    });
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return false;
      const session = JSON.parse(raw) as SavedSession;
      if (!session.tabs?.length) return false;

      const restored: Tab[] = [];
      for (const saved of session.tabs) {
        if (saved.filePath) {
          const file = await window.markdownStudio.openFilePath(saved.filePath);
          if (file) {
            restored.push({
              id: newId(),
              content: file.content,
              filePath: file.filePath,
              fileName: file.fileName,
              dirty: false
            });
          }
        } else {
          restored.push({
            id: newId(),
            content: saved.content ?? "",
            filePath: null,
            fileName: saved.fileName || "bez-nazwy.md",
            dirty: false
          });
        }
      }
      if (!restored.length) return false;

      const idx = Math.min(Math.max(0, session.activeIndex), restored.length - 1);
      setTabs(restored);
      setActiveId(restored[idx].id);
      updateWindowTitle(restored[idx]);
      setStatus("Przywrócono poprzednią sesję");
      return true;
    } catch {
      return false;
    }
  }, [setStatus, updateWindowTitle]);

  const loadStartupFile = useCallback(async () => {
    const startup = await window.markdownStudio.getStartupFile();
    if (startup) {
      openFileInTab(startup);
      sessionReady.current = true;
      return;
    }
    const restored = await restoreSession();
    sessionReady.current = true;
    if (!restored) setStatus("Gotowe");
  }, [openFileInTab, restoreSession, setStatus]);

  const addTab = useCallback(
    (partial: Partial<Tab> & Pick<Tab, "content">) => {
      const tab: Tab = {
        id: newId(),
        filePath: null,
        fileName: "bez-nazwy.md",
        dirty: false,
        ...partial
      };
      setTabs((prev) => [...prev, tab]);
      setActiveId(tab.id);
      updateWindowTitle(tab);
      return tab;
    },
    [updateWindowTitle]
  );

  const newDocument = useCallback(() => {
    addTab({ content: "" });
    setStatus("Utworzono nowy dokument");
    void window.markdownStudio.setTitle("bez-nazwy.md — Markdown Studio");
  }, [addTab, setStatus]);

  const newDocumentFromTemplate = useCallback(
    (templateId: DocumentTemplateId) => {
      const template = DOCUMENT_TEMPLATES[templateId];
      addTab({ content: template.content, fileName: "bez-nazwy.md" });
      setStatus(`Utworzono: ${template.label}`);
    },
    [addTab, setStatus]
  );

  const open = useCallback(async () => {
    openFileInTab(await window.markdownStudio.openFile());
  }, [openFileInTab]);

  const openRecentFile = useCallback(
    async (path: string) => {
      openFileInTab(await window.markdownStudio.openFilePath(path));
    },
    [openFileInTab]
  );

  const save = useCallback(async () => {
    const file = await window.markdownStudio.saveFile({
      filePath: snap.current.filePath,
      content: snap.current.content
    });
    if (!file) return;
    patchActive({ filePath: file.filePath, fileName: file.fileName, dirty: false });
    setStatus(`Zapisano ${file.fileName}`);
    void window.markdownStudio.setTitle(`${file.fileName} — Markdown Studio`);
  }, [patchActive, setStatus]);

  const saveAs = useCallback(async () => {
    const file = await window.markdownStudio.saveFileAs({
      filePath: snap.current.filePath,
      content: snap.current.content
    });
    if (!file) return;
    patchActive({ filePath: file.filePath, fileName: file.fileName, dirty: false });
    setStatus(`Zapisano jako ${file.fileName}`);
    void window.markdownStudio.setTitle(`${file.fileName} — Markdown Studio`);
  }, [patchActive, setStatus]);

  const switchTab = useCallback(
    (id: string) => {
      setActiveId(id);
      const tab = tabsRef.current.find((t) => t.id === id);
      if (tab) updateWindowTitle(tab);
    },
    [updateWindowTitle]
  );

  const closeTab = useCallback((id: string) => {
    const tab = tabsRef.current.find((t) => t.id === id);
    if (!tab) return;
    if (tab.dirty && !window.confirm(`Zamknąć „${tab.fileName}" z niezapisanymi zmianami?`)) return;

    setTabs((prev) => {
      if (prev.length === 1) {
        const fresh = emptyTab();
        setActiveId(fresh.id);
        return [fresh];
      }
      const next = prev.filter((t) => t.id !== id);
      setActiveId((cur) => {
        if (cur !== id) return cur;
        const idx = prev.findIndex((t) => t.id === id);
        return next[Math.min(idx, next.length - 1)].id;
      });
      return next;
    });
  }, []);

  const setContent = useCallback(
    (value: string) => {
      patchActive({ content: value });
    },
    [patchActive]
  );

  const setDirty = useCallback(
    (dirty: boolean) => {
      patchActive({ dirty });
    },
    [patchActive]
  );

  return {
    content: active.content,
    setContent,
    filePath: active.filePath,
    fileName: active.fileName,
    dirty: active.dirty,
    setDirty,
    recentFiles,
    snap,
    loadStartupFile,
    newDocument,
    newDocumentFromTemplate,
    open,
    openRecentFile,
    save,
    saveAs,
    tabs,
    activeId,
    tabsRef,
    switchTab,
    closeTab
  } as const;
}
