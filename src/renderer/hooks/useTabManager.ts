import { useCallback, useEffect, useRef, useState } from "react";
import type { MarkdownFile, SavedSession } from "../../types/electron-api";
import type { Translator } from "../../shared/i18n";
import type { AppSettings } from "../../shared/settings";
import type { Tab } from "../renderer-types";
import {
  DOCUMENT_TEMPLATES,
  MAX_RECENT_FILES,
  templateContent,
  type DocumentTemplateId
} from "../constants";

let _tabSeq = 0;
function newId() {
  return `tab-${++_tabSeq}`;
}

function emptyTab(untitled: string): Tab {
  return { id: newId(), content: "", filePath: null, fileName: untitled, dirty: false };
}

export function useTabManager(
  setStatus: (msg: string) => void,
  t: Translator,
  settings: AppSettings,
  settingsLoaded: boolean
) {
  const untitled = t("app.untitled");
  const [tabs, setTabs] = useState<Tab[]>(() => [emptyTab("bez-nazwy.md")]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0].id);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const sessionReady = useRef(false);

  const tabsRef = useRef<Tab[]>(tabs);
  tabsRef.current = tabs;

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  const snap = useRef({ content: active.content, filePath: active.filePath, dirty: active.dirty });
  snap.current = { content: active.content, filePath: active.filePath, dirty: active.dirty };

  const patchTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)));
  }, []);

  const patchActive = useCallback(
    (patch: Partial<Tab>) => {
      setTabs((prev) => prev.map((tab) => (tab.id === activeId ? { ...tab, ...patch } : tab)));
    },
    [activeId]
  );

  useEffect(() => {
    void window.markdownStudio.readRecentFiles().then(setRecentFiles);
  }, []);

  const addToRecent = useCallback((path: string) => {
    setRecentFiles((prev) => {
      const next = [path, ...prev.filter((entry) => entry !== path)].slice(0, MAX_RECENT_FILES);
      void window.markdownStudio.writeRecentFiles(next);
      return next;
    });
  }, []);

  /** A recent entry that no longer opens is dropped instead of silently failing. */
  const forgetRecent = useCallback((path: string) => {
    setRecentFiles((prev) => {
      const next = prev.filter((entry) => entry !== path);
      void window.markdownStudio.writeRecentFiles(next);
      return next;
    });
  }, []);

  /** Window title is built from the dictionary so the product name lives in one place. */
  const appName = t("app.name");

  const titleFor = useCallback(
    (fileName: string, dirty = false) => `${fileName}${dirty ? " •" : ""} — ${appName}`,
    [appName]
  );

  const updateWindowTitle = useCallback(
    (tab: Tab) => {
      void window.markdownStudio.setTitle(titleFor(tab.fileName, tab.dirty));
    },
    [titleFor]
  );

  const confirmDiscardActive = useCallback(async () => {
    const current = tabsRef.current.find((tab) => tab.id === activeId);
    if (!current?.dirty) return true;
    return window.markdownStudio.confirm(t("dialog.discardActive", { name: current.fileName }));
  }, [activeId, t]);

  const openFileInTab = useCallback(
    async (file: MarkdownFile | null) => {
      if (!file) return;

      const existing = tabsRef.current.find((tab) => tab.filePath === file.filePath);
      if (existing) {
        setActiveId(existing.id);
        updateWindowTitle(existing);
        setStatus(t("status.switched", { name: file.fileName }));
        return;
      }

      if (!(await confirmDiscardActive())) return;

      const activeTab = tabsRef.current.find((tab) => tab.id === activeId);
      const reuse =
        activeTab && !activeTab.filePath && !activeTab.dirty && activeTab.content.trim() === "";

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
      }

      addToRecent(file.filePath);
      setStatus(t("status.opened", { name: file.fileName }));
      void window.markdownStudio.setTitle(titleFor(file.fileName));
    },
    [
      activeId,
      addToRecent,
      confirmDiscardActive,
      patchActive,
      setStatus,
      t,
      titleFor,
      updateWindowTitle
    ]
  );

  /* ---------------- session persistence ---------------- */

  const persistSession = useCallback(() => {
    if (!sessionReady.current) return;
    const list = tabsRef.current;
    const payload: SavedSession = {
      activeIndex: Math.max(
        0,
        list.findIndex((tab) => tab.id === activeId)
      ),
      tabs: list.map((tab) => ({
        filePath: tab.filePath,
        fileName: tab.fileName,
        ...(tab.filePath ? {} : { content: tab.content })
      }))
    };
    void window.markdownStudio.writeSession(payload);
  }, [activeId]);

  useEffect(() => {
    persistSession();
  }, [tabs, activeId, persistSession]);

  useEffect(() => {
    void window.markdownStudio.setWatchedFile(active.filePath);
  }, [active.filePath]);

  useEffect(() => {
    return window.markdownStudio.onExternalFileChange((changedPath) => {
      const tab = tabsRef.current.find((entry) => entry.filePath === changedPath);
      if (!tab) return;
      void (async () => {
        const reload = await window.markdownStudio.confirm(
          t("dialog.externalChange", { name: tab.fileName })
        );
        if (!reload) return;
        const file = await window.markdownStudio.openFilePath(changedPath);
        if (file) patchTab(tab.id, { content: file.content, dirty: false });
      })();
    });
  }, [patchTab, t]);

  /* ---------------- autosave ---------------- */

  useEffect(() => {
    if (!settingsLoaded || !settings.autosaveEnabled) return;
    const intervalMs = Math.max(5, settings.autosaveIntervalSeconds) * 1000;
    const id = window.setInterval(() => {
      void (async () => {
        const dirtyTabs = tabsRef.current.filter((tab) => tab.dirty && tab.filePath);
        for (const tab of dirtyTabs) {
          const file = await window.markdownStudio.saveFile({
            filePath: tab.filePath!,
            content: tab.content
          });
          if (file) {
            patchTab(tab.id, { dirty: false });
            setStatus(t("status.autosave", { name: file.fileName }));
          }
        }
      })();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [
    patchTab,
    setStatus,
    settings.autosaveEnabled,
    settings.autosaveIntervalSeconds,
    settingsLoaded,
    t
  ]);

  useEffect(() => {
    return window.markdownStudio.onWillClose(() => {
      void (async () => {
        const dirty = tabsRef.current.filter((tab) => tab.dirty);
        if (!dirty.length) {
          await window.markdownStudio.forceClose();
          return;
        }
        const message =
          dirty.length === 1
            ? t("dialog.unsavedOne", { name: dirty[0].fileName })
            : t("dialog.unsavedMany", { count: dirty.length });
        if (await window.markdownStudio.confirm(message)) {
          await window.markdownStudio.forceClose();
        }
      })();
    });
  }, [t]);

  const restoreSession = useCallback(async () => {
    const session = await window.markdownStudio.readSession();
    if (!session?.tabs?.length) return false;

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
        // A file that vanished between sessions is simply skipped.
      } else {
        restored.push({
          id: newId(),
          content: saved.content ?? "",
          filePath: null,
          fileName: saved.fileName || untitled,
          dirty: false
        });
      }
    }
    if (!restored.length) return false;

    const index = Math.min(Math.max(0, session.activeIndex), restored.length - 1);
    setTabs(restored);
    setActiveId(restored[index].id);
    updateWindowTitle(restored[index]);
    setStatus(t("status.sessionRestored"));
    return true;
  }, [setStatus, t, untitled, updateWindowTitle]);

  const loadStartupFile = useCallback(async () => {
    const startup = await window.markdownStudio.getStartupFile();
    if (startup) {
      await openFileInTab(startup);
      sessionReady.current = true;
      return;
    }
    const restored = await restoreSession();
    sessionReady.current = true;
    if (!restored) setStatus(t("app.ready"));
  }, [openFileInTab, restoreSession, setStatus, t]);

  /* ---------------- tab operations ---------------- */

  const addTab = useCallback(
    (partial: Partial<Tab> & Pick<Tab, "content">) => {
      const tab: Tab = {
        id: newId(),
        filePath: null,
        fileName: untitled,
        dirty: false,
        ...partial
      };
      setTabs((prev) => [...prev, tab]);
      setActiveId(tab.id);
      updateWindowTitle(tab);
      return tab;
    },
    [untitled, updateWindowTitle]
  );

  const newDocument = useCallback(() => {
    addTab({ content: "" });
    setStatus(t("status.newDocument"));
    void window.markdownStudio.setTitle(titleFor(untitled));
  }, [addTab, setStatus, t, titleFor, untitled]);

  const newDocumentFromTemplate = useCallback(
    (templateId: DocumentTemplateId) => {
      addTab({ content: templateContent(templateId, settings.language) });
      setStatus(t("status.createdFrom", { name: t(DOCUMENT_TEMPLATES[templateId].labelKey) }));
    },
    [addTab, setStatus, settings.language, t]
  );

  const open = useCallback(async () => {
    await openFileInTab(await window.markdownStudio.openFile());
  }, [openFileInTab]);

  const openRecentFile = useCallback(
    async (path: string) => {
      const file = await window.markdownStudio.openFilePath(path);
      if (!file) {
        // The old code let this reject unhandled, so nothing happened at all.
        setStatus(t("status.fileMissing", { path }));
        forgetRecent(path);
        return;
      }
      await openFileInTab(file);
    },
    [forgetRecent, openFileInTab, setStatus, t]
  );

  const save = useCallback(async () => {
    const file = await window.markdownStudio.saveFile({
      filePath: snap.current.filePath,
      content: snap.current.content
    });
    if (!file) return;
    patchActive({ filePath: file.filePath, fileName: file.fileName, dirty: false });
    addToRecent(file.filePath);
    setStatus(t("status.saved", { name: file.fileName }));
    void window.markdownStudio.setTitle(titleFor(file.fileName));
  }, [addToRecent, patchActive, setStatus, t, titleFor]);

  const saveAs = useCallback(async () => {
    const file = await window.markdownStudio.saveFileAs({
      filePath: snap.current.filePath,
      content: snap.current.content
    });
    if (!file) return;
    patchActive({ filePath: file.filePath, fileName: file.fileName, dirty: false });
    addToRecent(file.filePath);
    setStatus(t("status.savedAs", { name: file.fileName }));
    void window.markdownStudio.setTitle(titleFor(file.fileName));
  }, [addToRecent, patchActive, setStatus, t, titleFor]);

  const switchTab = useCallback(
    (id: string) => {
      setActiveId(id);
      const tab = tabsRef.current.find((entry) => entry.id === id);
      if (tab) updateWindowTitle(tab);
    },
    [updateWindowTitle]
  );

  /**
   * State updaters must stay pure: the previous version called `setActiveId`
   * from inside the `setTabs` updater, which React re-runs in StrictMode and
   * could leave the wrong tab selected.
   */
  const closeTab = useCallback(
    async (id: string) => {
      const list = tabsRef.current;
      const tab = list.find((entry) => entry.id === id);
      if (!tab) return;
      if (
        tab.dirty &&
        !(await window.markdownStudio.confirm(t("dialog.closeDirtyTab", { name: tab.fileName })))
      ) {
        return;
      }

      if (list.length === 1) {
        const fresh = emptyTab(untitled);
        setTabs([fresh]);
        setActiveId(fresh.id);
        updateWindowTitle(fresh);
        return;
      }

      const index = list.findIndex((entry) => entry.id === id);
      const next = list.filter((entry) => entry.id !== id);
      const nextActive = activeId === id ? next[Math.min(index, next.length - 1)] : null;

      setTabs(next);
      if (nextActive) {
        setActiveId(nextActive.id);
        updateWindowTitle(nextActive);
      }
    },
    [activeId, t, untitled, updateWindowTitle]
  );

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
