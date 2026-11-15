import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import {
  AlignLeft,
  Bold,
  Clipboard,
  ClipboardPaste,
  Code2,
  Download,
  Eye,
  FileDown,
  FolderOpen,
  FolderSearch,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Printer,
  Quote,
  Save,
  Strikethrough,
  Table2
} from "lucide-react";
import type {} from "../types/electron-api";
import type { SpellContextPayload, UpdateStatus } from "../types/electron-api";
import "highlight.js/styles/github-dark.css";
import "./styles.css";
import { Toolbar } from "./components/Toolbar";
import { FormatBar, type FindSettings } from "./components/FormatBar";
import { StatusBar } from "./components/StatusBar";
import { ContextMenu } from "./components/ContextMenu";
import { ImageDialog } from "./components/ImageDialog";
import { TableDialog } from "./components/TableDialog";
import { HistoryDialog } from "./components/HistoryDialog";
import { CompareDialog } from "./components/CompareDialog";
import { NamePromptDialog } from "./components/NamePromptDialog";
import { StatsDialog } from "./components/StatsDialog";
import { PresentationView } from "./components/PresentationView";
import { splitSlides } from "../shared/slides";
import { renderMarkdownBody } from "./utils/markdownRenderer";
import { useWritingStats } from "./hooks/useWritingStats";
import { SettingsDialog } from "./components/SettingsDialog";
import { WorkspaceSearch } from "./components/WorkspaceSearch";
import { Outline } from "./components/Outline";
import { FileTree } from "./components/FileTree";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { applyDocumentThemeToRoot } from "./utils/documentStyles";
import type { Theme, ViewMode, ToolbarAction, OutlineItem } from "./renderer-types";
import { TabBar } from "./components/TabBar";
import { useTabManager } from "./hooks/useTabManager";
import { useMarkdownPreview } from "./hooks/useMarkdownPreview";
import { useScrollSync } from "./hooks/useScrollSync";
import { useEditorActions } from "./hooks/useEditorActions";
import { useExport } from "./hooks/useExport";
import { useSettings } from "./hooks/useSettings";
import { buildPreviewClipboardPayload, getPreviewCopySelection } from "./utils/previewClipboard";
import { writeClipboardRich, writeClipboardText } from "./utils/clipboard";
import { extractOutline, getDocStats } from "./utils/markdownRenderer";
import { renderMermaidDiagrams } from "./utils/mermaid";
import { dirnameOf } from "./utils/assetUrls";
import { MARKDOWN_EXTENSIONS } from "./constants";

type ContextTarget = "editor" | "preview";

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  } catch {
    return fallback;
  }
}

function storeValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A full or disabled localStorage must never break the editor.
  }
}

function App() {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const previewRef = useRef<HTMLElement>(null);

  const {
    settings,
    update: updateSettings,
    reset: resetSettings,
    t,
    loaded,
    platform
  } = useSettings();

  const [status, setStatus] = useState("…");
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || "dark"
  );
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem("viewMode") as ViewMode) || "split"
  );
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [findSettings, setFindSettings] = useState<FindSettings>({
    regex: false,
    caseSensitive: false
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [spelling, setSpelling] = useState<{ word: string; suggestions: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showTemplateName, setShowTemplateName] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [contextTarget, setContextTarget] = useState<ContextTarget>("editor");
  const [workspaceSearchOpen, setWorkspaceSearchOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(() => readStoredBoolean("outlineOpen", false));
  const [fileTreeOpen, setFileTreeOpen] = useState(() => readStoredBoolean("fileTreeOpen", false));
  const [focusMode, setFocusMode] = useState(false);
  const [treeRoot, setTreeRoot] = useState<string | null>(null);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  const fm = useTabManager(setStatus, t, settings, loaded);
  const { content, setContent, filePath, fileName, dirty, setDirty, recentFiles } = fm;

  const previewOptions = useMemo(
    () => ({ math: settings.mathEnabled, mermaid: settings.mermaidEnabled }),
    [settings.mathEnabled, settings.mermaidEnabled]
  );
  const html = useMarkdownPreview(content, filePath, previewOptions);
  const stats = useMemo(() => getDocStats(content), [content]);
  const outline = useMemo(() => extractOutline(content), [content]);

  const editor = useEditorActions(editorRef, content, setContent, setDirty, setStatus, t, filePath);

  /**
   * Export the live preview DOM, not the raw render: Mermaid diagrams only
   * exist as SVG after the client-side pass.
   */
  const getExportHtml = useCallback(() => previewRef.current?.innerHTML ?? html, [html]);
  const { exportPdf, exportSlidesPdf, exportHtml, exportDocx, openPrintPreview } = useExport(
    filePath,
    getExportHtml,
    fileName,
    theme,
    setStatus,
    t
  );

  useScrollSync(editorRef, previewRef, viewMode, html);

  // Counts only how much the document grew; the text itself goes nowhere.
  const writing = useWritingStats(content, loaded);

  useEffect(() => {
    if (loaded) setStatus((current) => (current === "…" ? t("app.ready") : current));
  }, [loaded, t]);

  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      // CodeMirror turns spellcheck off on its content element by default, so
      // Chromium never underlines anything until we turn it back on.
      EditorView.contentAttributes.of({
        spellcheck: settings.spellcheckEnabled ? "true" : "false"
      }),
      EditorView.theme({
        "&": { height: "100%" },
        ".cm-scroller": {
          fontFamily: '"Cascadia Code", Consolas, monospace',
          fontSize: `${settings.editorFontSize}px`
        },
        ".cm-content": { padding: "18px" },
        ".cm-line": { lineHeight: "1.65" }
      }),
      ...editor.clipboardExtension
    ],
    [editor.clipboardExtension, settings.editorFontSize, settings.spellcheckEnabled]
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    applyDocumentThemeToRoot(document.documentElement, theme);
    storeValue("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--preview-font-size",
      `${settings.previewFontSize}px`
    );
  }, [settings.previewFontSize]);

  useEffect(() => storeValue("viewMode", viewMode), [viewMode]);
  useEffect(() => storeValue("outlineOpen", String(outlineOpen)), [outlineOpen]);
  useEffect(() => storeValue("fileTreeOpen", String(fileTreeOpen)), [fileTreeOpen]);

  /** Render Mermaid diagrams whenever the preview HTML or theme changes. */
  useEffect(() => {
    if (!settings.mermaidEnabled) return;
    void renderMermaidDiagrams(previewRef.current, theme);
  }, [html, theme, settings.mermaidEnabled]);

  const startupLoaded = useRef(false);
  useEffect(() => {
    if (!loaded || startupLoaded.current) return;
    startupLoaded.current = true;
    void fm.loadStartupFile();
  }, [loaded, fm]);

  useEffect(() => {
    return window.markdownStudio.onStartupFileChanged(() => {
      void fm.loadStartupFile();
    });
  }, [fm]);

  useEffect(() => {
    return window.markdownStudio.onOpenRecentPath((path) => {
      void fm.openRecentFile(path);
    });
  }, [fm]);

  useEffect(() => {
    return window.markdownStudio.onUpdateStatus((update: UpdateStatus) => {
      switch (update.kind) {
        case "available":
          setStatus(t("status.updateAvailable", { version: update.version }));
          break;
        case "downloaded":
          setStatus(t("status.updateDownloaded"));
          break;
        case "none":
          setStatus(t("status.updateNone"));
          break;
        case "error":
          setStatus(t("status.updateError", { message: update.message }));
          break;
        default:
          break;
      }
    });
  }, [t]);

  /** Spelling suggestions for the word the user right-clicked. */
  useEffect(() => {
    return window.markdownStudio.onSpellContext((payload: SpellContextPayload) => {
      setSpelling(
        payload.misspelledWord
          ? { word: payload.misspelledWord, suggestions: payload.suggestions ?? [] }
          : null
      );
    });
  }, []);

  useEffect(() => {
    const dismiss = () => {
      setContextMenu(null);
      setSpelling(null);
    };
    window.addEventListener("click", dismiss);
    window.addEventListener("keydown", dismiss);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("click", dismiss);
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("resize", dismiss);
    };
  }, []);

  const menuHandlerRef = useRef<(action: string) => void>(() => {});

  async function pickTreeFolder() {
    const folder = await window.markdownStudio.pickFolder();
    if (folder) {
      setTreeRoot(folder);
      setFileTreeOpen(true);
    }
  }

  const handleMenuAction = (action: string) => {
    if (action.startsWith("templateUser:")) {
      const fileName = action.slice("templateUser:".length);
      void window.markdownStudio.readTemplate(fileName).then((templateContent) => {
        if (templateContent === null) {
          setStatus(t("template.missing", { name: fileName }));
          return;
        }
        fm.newDocumentFromContent(templateContent, fileName.replace(/\.md$/i, ""));
      });
      return;
    }
    switch (action) {
      case "new":
        fm.newDocument();
        break;
      case "open":
        void fm.open();
        break;
      case "openFolder":
        void pickTreeFolder();
        break;
      case "save":
        void fm.save();
        break;
      case "saveAs":
        void fm.saveAs();
        break;
      case "exportPdf":
        void exportPdf();
        break;
      case "exportHtml":
        void exportHtml();
        break;
      case "exportDocx":
        void exportDocx();
        break;
      case "history":
        setShowHistory(true);
        break;
      case "compare":
        setShowCompare(true);
        break;
      case "templateSaveCurrent":
        setShowTemplateName(true);
        break;
      case "stats":
        setShowStats(true);
        break;
      case "presentation": {
        const { slides } = splitSlides(content);
        setPresenting(true);
        setStatus(t("presentation.started", { count: slides.length }));
        break;
      }
      case "presentationPdf": {
        const { slides } = splitSlides(content);
        void exportSlidesPdf(
          slides.map((slide) =>
            renderMarkdownBody(slide, {
              math: settings.mathEnabled,
              mermaid: settings.mermaidEnabled
            })
          )
        );
        break;
      }
      case "printPreview":
        void openPrintPreview();
        break;
      case "workspaceSearch":
        setWorkspaceSearchOpen(true);
        break;
      case "settings":
        setShowSettings(true);
        break;
      case "closeTab":
        void fm.closeTab(fm.activeId);
        break;
      case "viewSplit":
        setViewMode("split");
        break;
      case "viewEditor":
        setViewMode("editor");
        break;
      case "viewPreview":
        setViewMode("preview");
        break;
      case "toggleOutline":
        setOutlineOpen((value) => !value);
        break;
      case "toggleFileTree":
        setFileTreeOpen((value) => !value);
        break;
      case "toggleFocusMode":
        setFocusMode((value) => !value);
        break;
      case "themeLight":
        setTheme("light");
        break;
      case "themeDark":
        setTheme("dark");
        break;
      case "templateBlank":
        fm.newDocument();
        break;
      case "templateMeeting":
        fm.newDocumentFromTemplate("meeting");
        break;
      case "templateArticle":
        fm.newDocumentFromTemplate("article");
        break;
      case "templateProject":
        fm.newDocumentFromTemplate("project");
        break;
      default:
        break;
    }
  };

  menuHandlerRef.current = handleMenuAction;

  useEffect(() => {
    return window.markdownStudio.onMenuAction((action) => menuHandlerRef.current(action));
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && focusMode) {
        setFocusMode(false);
        return;
      }
      if (!event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === "s" && event.shiftKey) {
        event.preventDefault();
        void fm.saveAs();
      } else if (key === "s") {
        event.preventDefault();
        void fm.save();
      } else if (key === "o") {
        event.preventDefault();
        void fm.open();
      } else if (key === "n" || key === "t") {
        event.preventDefault();
        fm.newDocument();
      } else if (key === "w") {
        event.preventDefault();
        void fm.closeTab(fm.activeId);
      } else if (key === "f" && event.shiftKey) {
        event.preventDefault();
        setWorkspaceSearchOpen(true);
      } else if (key === "p" && event.shiftKey) {
        event.preventDefault();
        void openPrintPreview();
      } else if (key === "p") {
        event.preventDefault();
        void exportPdf();
      } else if (key === "e" && event.shiftKey) {
        event.preventDefault();
        void exportDocx();
      } else if (key === "e") {
        event.preventDefault();
        void exportHtml();
      } else if (key === "b") {
        event.preventDefault();
        editor.wrapSelection("**", "**", t("format.placeholderBold"));
      } else if (key === "i") {
        event.preventDefault();
        editor.wrapSelection("*", "*", t("format.placeholderItalic"));
      } else if (key === ",") {
        event.preventDefault();
        setShowSettings(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fm, editor, exportPdf, exportHtml, exportDocx, openPrintPreview, focusMode, t]);

  async function openSearchHit(path: string, line: number) {
    await fm.openRecentFile(path);
    window.setTimeout(() => editor.jumpToLine(line), 80);
  }

  /** Drag & drop of .md files onto the window. */
  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setDragOver(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget == null) setDragOver(false);
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer?.files[0];
      if (!file) return;
      // `File.path` was removed in Electron 32; webUtils is the replacement.
      const path = window.markdownStudio.getPathForFile(file);
      if (!path) return;
      const extension = path.split(".").pop()?.toLowerCase() ?? "";
      if (!MARKDOWN_EXTENSIONS.includes(extension as (typeof MARKDOWN_EXTENSIONS)[number])) return;
      void fm.openRecentFile(path);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [fm]);

  async function copyPreviewSelection() {
    const part = getPreviewCopySelection(previewRef.current);
    if (!part.ok) {
      if (part.reason === "empty") setStatus(t("status.previewEmpty"));
      return false;
    }

    try {
      const payload = await buildPreviewClipboardPayload(previewRef.current, theme, filePath);
      if (payload.ok && payload.html) {
        const ok = await writeClipboardRich({ html: payload.html, text: payload.text! });
        if (ok) {
          setStatus(
            payload.scope === "selection"
              ? t("status.copiedPreviewSelectionRich")
              : t("status.copiedPreviewRich")
          );
          return true;
        }
      }
    } catch {
      /* fall back to plain text */
    }

    const ok = await writeClipboardText(part.text!);
    if (!ok) {
      setStatus(t("status.copyFailed"));
      return false;
    }
    setStatus(
      part.scope === "selection"
        ? t("status.copiedPreviewSelectionText")
        : t("status.copiedPreviewText")
    );
    return true;
  }

  function selectionIsInPreview() {
    const selection = window.getSelection();
    return Boolean(
      selection &&
      !selection.isCollapsed &&
      selection.rangeCount > 0 &&
      previewRef.current?.contains(selection.anchorNode)
    );
  }

  async function copyFromContext() {
    if (contextTarget === "preview" || selectionIsInPreview()) await copyPreviewSelection();
    else await editor.copySelection();
  }

  async function pasteFromContext() {
    if (contextTarget === "preview" || selectionIsInPreview()) {
      setStatus(t("status.pasteInEditor"));
      return;
    }
    await editor.pasteFromClipboard();
  }

  /** Clicking a rendered block jumps the editor to its source line. */
  function handlePreviewClick(event: React.MouseEvent<HTMLElement>) {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-line]");
    if (!target) return;
    const line = Number(target.dataset.line);
    if (!Number.isFinite(line)) return;
    editor.jumpToLine(line, true);
  }

  function selectOutlineItem(item: OutlineItem) {
    setActiveHeadingId(item.id);
    editor.jumpToLine(item.line);
    const heading = previewRef.current?.querySelector<HTMLElement>(`[id="${CSS.escape(item.id)}"]`);
    heading?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  const fileActions: ToolbarAction[] = [
    { label: t("toolbar.open"), icon: <FolderOpen size={17} />, run: fm.open },
    {
      label: t("toolbar.search"),
      icon: <FolderSearch size={17} />,
      run: () => setWorkspaceSearchOpen(true)
    },
    { label: t("toolbar.save"), icon: <Save size={17} />, run: fm.save },
    { label: t("toolbar.saveAs"), icon: <Download size={17} />, run: fm.saveAs },
    { label: t("toolbar.pdf"), icon: <FileDown size={17} />, run: exportPdf },
    { label: t("toolbar.html"), icon: <FileDown size={17} />, run: exportHtml },
    { label: t("toolbar.docx"), icon: <FileDown size={17} />, run: exportDocx },
    { label: t("toolbar.print"), icon: <Printer size={17} />, run: openPrintPreview }
  ];

  const formatActions: ToolbarAction[] = [
    { label: t("format.h1"), icon: <Heading1 size={17} />, run: () => editor.prefixLine("# ") },
    { label: t("format.h2"), icon: <Heading2 size={17} />, run: () => editor.prefixLine("## ") },
    {
      label: t("format.bold"),
      icon: <Bold size={17} />,
      run: () => editor.wrapSelection("**", "**", t("format.placeholderText"))
    },
    {
      label: t("format.italic"),
      icon: <Italic size={17} />,
      run: () => editor.wrapSelection("*", "*", t("format.placeholderText"))
    },
    {
      label: t("format.strike"),
      icon: <Strikethrough size={17} />,
      run: () => editor.wrapSelection("~~", "~~", t("format.placeholderText"))
    },
    { label: t("format.quote"), icon: <Quote size={17} />, run: () => editor.prefixLine("> ") },
    { label: t("format.list"), icon: <List size={17} />, run: () => editor.prefixLine("- ") },
    {
      label: t("format.orderedList"),
      icon: <ListOrdered size={17} />,
      run: () => editor.prefixLine("1. ")
    },
    {
      label: t("format.task"),
      icon: <ListChecks size={17} />,
      run: () => editor.prefixLine("- [ ] ")
    },
    {
      label: t("format.code"),
      icon: <Code2 size={17} />,
      run: () => editor.wrapSelection("`", "`", t("format.placeholderCode"))
    },
    {
      label: t("format.link"),
      icon: <Link size={17} />,
      run: () => editor.wrapSelection("[", "](https://)", t("format.placeholderLink"))
    },
    { label: t("format.copy"), icon: <Clipboard size={17} />, run: () => void copyFromContext() },
    {
      label: t("format.paste"),
      icon: <ClipboardPaste size={17} />,
      run: () => void editor.pasteFromClipboard()
    },
    {
      label: t("format.image"),
      icon: <ImagePlus size={17} />,
      run: () => setShowImageDialog(true)
    },
    { label: t("format.table"), icon: <Table2 size={17} />, run: () => setShowTableDialog(true) }
  ];

  const shellClasses = [
    "app-shell",
    dragOver ? "drag-over" : "",
    workspaceSearchOpen ? "with-search" : "",
    outlineOpen ? "with-outline" : "",
    fileTreeOpen ? "with-filetree" : "",
    focusMode ? "focus-mode" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={shellClasses}
      onContextMenu={(event) => {
        // Deliberately no preventDefault(): Chromium only reports the
        // misspelled word and its suggestions to the main process when the
        // page lets the event through, and Electron shows no menu of its own,
        // so there is nothing to suppress. Clear the previous word first — the
        // fresh payload arrives from the main process a tick later.
        setSpelling(null);
        const inPreview = previewRef.current?.contains(event.target as Node) ?? false;
        setContextTarget(inPreview ? "preview" : "editor");
        setContextMenu({
          x: Math.min(event.clientX, window.innerWidth - 228),
          y: Math.min(event.clientY, window.innerHeight - 320)
        });
      }}
    >
      <Toolbar
        fileName={fileName}
        filePath={filePath}
        dirty={dirty}
        viewMode={viewMode}
        theme={theme}
        recentFiles={recentFiles}
        fileActions={fileActions}
        outlineOpen={outlineOpen}
        fileTreeOpen={fileTreeOpen}
        focusMode={focusMode}
        onViewModeChange={setViewMode}
        onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
        onOpenRecentFile={(path) => void fm.openRecentFile(path)}
        onToggleOutline={() => setOutlineOpen((value) => !value)}
        onToggleFileTree={() => setFileTreeOpen((value) => !value)}
        onToggleFocusMode={() => setFocusMode((value) => !value)}
        onOpenSettings={() => setShowSettings(true)}
        t={t}
      />
      <TabBar
        tabs={fm.tabs}
        activeId={fm.activeId}
        onSwitch={fm.switchTab}
        onClose={(id) => void fm.closeTab(id)}
        onNew={fm.newDocument}
        onNewTemplate={fm.newDocumentFromTemplate}
        t={t}
      />
      <WorkspaceSearch
        open={workspaceSearchOpen}
        initialFolder={dirnameOf(filePath ?? "") || null}
        onClose={() => setWorkspaceSearchOpen(false)}
        onOpenHit={(path, line) => void openSearchHit(path, line)}
        onStatus={setStatus}
        t={t}
      />
      <FormatBar
        formatActions={formatActions}
        query={query}
        replacement={replacement}
        findSettings={findSettings}
        onFindSettingsChange={setFindSettings}
        onQueryChange={setQuery}
        onReplacementChange={setReplacement}
        onFindNext={() => editor.findNext(query, findSettings)}
        onReplaceOne={() => editor.replaceOne(query, replacement, findSettings)}
        onReplaceAll={() => editor.replaceAll(query, replacement, findSettings)}
        t={t}
      />

      <main className={`workspace ${viewMode}`}>
        {fileTreeOpen && (
          <FileTree
            rootPath={treeRoot}
            activeFilePath={filePath}
            onPickFolder={() => void pickTreeFolder()}
            onOpenFile={(path) => void fm.openRecentFile(path)}
            t={t}
          />
        )}

        <section className="editor-pane" aria-label={t("pane.editor")}>
          <div className="pane-title">
            <AlignLeft size={15} />
            <span>{t("pane.editor")}</span>
          </div>
          <CodeMirror
            ref={editorRef}
            value={content}
            height="100%"
            theme={theme === "dark" ? oneDark : "light"}
            extensions={extensions}
            onChange={(value) => {
              setContent(value);
              setDirty(true);
            }}
            basicSetup={{
              foldGutter: true,
              highlightActiveLine: true,
              highlightSelectionMatches: true,
              lineNumbers: true,
              searchKeymap: true,
              defaultKeymap: false
            }}
          />
        </section>

        <section className="preview-pane" aria-label={t("pane.preview")}>
          <div className="pane-title pane-title-actions">
            <span className="pane-title-label">
              <Eye size={15} />
              <span>{t("pane.preview")}</span>
            </span>
            <button
              type="button"
              className="pane-action"
              title={t("pane.copyPreview")}
              onClick={() => void copyPreviewSelection()}
            >
              <Clipboard size={14} />
              <span>{t("format.copy")}</span>
            </button>
          </div>
          <article
            ref={previewRef}
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: html }}
            tabIndex={0}
            onClick={handlePreviewClick}
          />
        </section>

        {outlineOpen && (
          <Outline items={outline} activeId={activeHeadingId} onSelect={selectOutlineItem} t={t} />
        )}
      </main>

      <StatusBar status={status} stats={stats} t={t} />

      {showHistory && (
        <HistoryDialog
          filePath={filePath}
          currentContent={content}
          language={settings.language}
          onRestore={(restored) => {
            // The restored text becomes an unsaved change, so the user can
            // still look at it and walk away without touching the file.
            setContent(restored);
            setDirty(true);
            setShowHistory(false);
            setStatus(
              t("history.restored", {
                moment: new Date().toLocaleString(settings.language === "pl" ? "pl-PL" : "en-US")
              })
            );
          }}
          onClose={() => setShowHistory(false)}
          t={t}
        />
      )}

      {presenting && (
        <PresentationView
          content={content}
          filePath={filePath}
          theme={theme}
          math={settings.mathEnabled}
          mermaid={settings.mermaidEnabled}
          onClose={() => setPresenting(false)}
          t={t}
        />
      )}

      {showStats && (
        <StatsDialog
          stats={writing.stats}
          today={writing.today}
          streak={writing.streak}
          language={settings.language}
          onSetGoal={writing.setDailyGoal}
          onClose={() => setShowStats(false)}
          t={t}
        />
      )}

      {showTemplateName && (
        <NamePromptDialog
          title={t("template.saveTitle")}
          label={t("template.nameLabel")}
          initialValue={fileName.replace(/\.md$/i, "")}
          confirmLabel={t("menu.save")}
          onConfirm={(name) => {
            setShowTemplateName(false);
            void window.markdownStudio.saveTemplate(name, content).then((saved) => {
              setStatus(
                saved ? t("template.saved", { name: saved.name }) : t("template.saveFailed")
              );
            });
          }}
          onClose={() => setShowTemplateName(false)}
          t={t}
        />
      )}

      {showCompare && (
        <CompareDialog
          tabs={fm.tabs}
          activeId={fm.activeId}
          onClose={() => setShowCompare(false)}
          t={t}
        />
      )}

      {showImageDialog && (
        <ImageDialog
          onInsert={(markdownText) => {
            editor.insertAtSelection(markdownText);
            setShowImageDialog(false);
          }}
          onClose={() => setShowImageDialog(false)}
          onPickFile={() => window.markdownStudio.pickImageFile()}
          t={t}
        />
      )}

      {showTableDialog && (
        <TableDialog
          onInsert={(markdownText) => {
            editor.insertAtSelection(markdownText);
            setShowTableDialog(false);
          }}
          onClose={() => setShowTableDialog(false)}
          language={settings.language}
          t={t}
        />
      )}

      {showSettings && (
        <SettingsDialog
          settings={settings}
          onChange={(patch) => void updateSettings(patch)}
          onReset={() => void resetSettings()}
          onClose={() => setShowSettings(false)}
          isStoreBuild={platform.isStoreBuild}
          t={t}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          spelling={contextTarget === "editor" ? spelling : null}
          onApplySuggestion={(suggestion) => {
            setContextMenu(null);
            setSpelling(null);
            editor.replaceWordAtCursor(suggestion);
          }}
          onAddToDictionary={(word) => {
            setContextMenu(null);
            setSpelling(null);
            void window.markdownStudio.addWordToDictionary(word).then((added) => {
              if (added) setStatus(t("status.wordAdded", { word }));
            });
          }}
          onSave={() => {
            setContextMenu(null);
            void fm.save();
          }}
          onCopy={() => {
            setContextMenu(null);
            void copyFromContext();
          }}
          onPaste={() => {
            setContextMenu(null);
            void pasteFromContext();
          }}
          onExportPdf={() => {
            setContextMenu(null);
            void exportPdf();
          }}
          onExportHtml={() => {
            setContextMenu(null);
            void exportHtml();
          }}
          onExportDocx={() => {
            setContextMenu(null);
            void exportDocx();
          }}
          onPrint={() => {
            setContextMenu(null);
            void openPrintPreview();
          }}
          onClose={() => {
            setContextMenu(null);
            void window.markdownStudio.closeWindow();
          }}
          t={t}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
