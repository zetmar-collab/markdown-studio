import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
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
  ListOrdered,
  Printer,
  Quote,
  Save,
  Table2
} from "lucide-react";
import type {} from "../types/electron-api";
import "highlight.js/styles/github-dark.css";
import "./styles.css";
import { Toolbar } from "./components/Toolbar";
import { FormatBar } from "./components/FormatBar";
import { StatusBar } from "./components/StatusBar";
import { ContextMenu } from "./components/ContextMenu";
import { ImageDialog } from "./components/ImageDialog";
import { TableDialog } from "./components/TableDialog";
import { WorkspaceSearch } from "./components/WorkspaceSearch";
import { applyDocumentThemeToRoot } from "./utils/documentStyles";
import type { Theme, ViewMode, ToolbarAction } from "./renderer-types";
import { TabBar } from "./components/TabBar";
import { useTabManager } from "./hooks/useTabManager";
import { useMarkdownPreview } from "./hooks/useMarkdownPreview";
import { useScrollSync } from "./hooks/useScrollSync";
import { useEditorActions } from "./hooks/useEditorActions";
import { useExport } from "./hooks/useExport";
import { buildPreviewClipboardPayload, getPreviewCopySelection } from "./utils/previewClipboard";
import { writeClipboardRich, writeClipboardText } from "./utils/clipboard";
import { getDocStats } from "./utils/markdownRenderer";
import { MARKDOWN_EXTENSIONS } from "./constants";
type ContextTarget = "editor" | "preview";

function searchFolderFromFilePath(filePath: string | null): string | null {
  if (!filePath) return null;
  const i = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return i > 0 ? filePath.slice(0, i) : null;
}

function App() {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const previewRef = useRef<HTMLElement>(null);

  const [status, setStatus] = useState("Gotowe");
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "dark");
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("viewMode") as ViewMode) || "split");
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [contextTarget, setContextTarget] = useState<ContextTarget>("editor");
  const [workspaceSearchOpen, setWorkspaceSearchOpen] = useState(false);

  const fm = useTabManager(setStatus);
  const { content, setContent, filePath, fileName, dirty, setDirty, recentFiles } = fm;

  const html = useMarkdownPreview(content, filePath);
  const stats = useMemo(() => getDocStats(content), [content]);
  const editor = useEditorActions(editorRef, content, setContent, setDirty, setStatus);
  const { exportPdf, exportHtml, exportDocx, openPrintPreview } = useExport(
    filePath,
    html,
    fileName,
    theme,
    setStatus
  );

  useScrollSync(editorRef, previewRef, viewMode);

  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      EditorView.theme({
        "&": { height: "100%" },
        ".cm-scroller": { fontFamily: "\"Cascadia Code\", Consolas, monospace" },
        ".cm-content": { padding: "18px" },
        ".cm-line": { lineHeight: "1.65" }
      }),
      ...editor.clipboardExtension
    ],
    [editor.clipboardExtension]
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    applyDocumentThemeToRoot(document.documentElement, theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("viewMode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    void fm.loadStartupFile();
    return window.markdownStudio.onStartupFileChanged(() => {
      void fm.loadStartupFile();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const dismiss = () => setContextMenu(null);
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

  const handleMenuAction = (action: string) => {
    switch (action) {
      case "new":
        fm.newDocument();
        break;
      case "open":
        void fm.open();
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
      case "printPreview":
        void openPrintPreview();
        break;
      case "workspaceSearch":
        setWorkspaceSearchOpen(true);
        break;
      case "closeTab":
        fm.closeTab(fm.activeId);
        break;
      case "copy":
        void copyFromContext();
        break;
      case "paste":
        void pasteFromContext();
        break;
      case "cut":
        void editor.cutSelection();
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
        fm.closeTab(fm.activeId);
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
        editor.wrapSelection("**", "**", "pogrubiony tekst");
      } else if (key === "i") {
        event.preventDefault();
        editor.wrapSelection("*", "*", "kursywa");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fm, editor, exportPdf, exportHtml, exportDocx, openPrintPreview]);

  function jumpToLine(line: number) {
    const view = editorRef.current?.view;
    if (!view) return;
    const n = Math.min(Math.max(1, line), view.state.doc.lines);
    const docLine = view.state.doc.line(n);
    view.dispatch({ selection: { anchor: docLine.from }, scrollIntoView: true });
    view.focus();
  }

  async function openSearchHit(path: string, line: number) {
    await fm.openRecentFile(path);
    window.setTimeout(() => jumpToLine(line), 80);
  }

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "copy";
      setDragOver(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget == null) setDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      const path = (file as File & { path: string }).path;
      if (!path) return;
      const ext = path.split(".").pop()?.toLowerCase() ?? "";
      if (!MARKDOWN_EXTENSIONS.includes(ext as (typeof MARKDOWN_EXTENSIONS)[number])) return;
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
      if (part.reason === "empty") setStatus("Podgląd jest pusty — nic do skopiowania");
      return false;
    }

    try {
      const payload = await buildPreviewClipboardPayload(previewRef.current, theme, filePath);
      if (payload.ok && payload.html) {
        const ok = await writeClipboardRich({ html: payload.html, text: payload.text! });
        if (ok) {
          setStatus(
            payload.scope === "selection"
              ? "Skopiowano zaznaczenie z podglądu (z formatowaniem)"
              : "Skopiowano cały podgląd (z formatowaniem)"
          );
          return true;
        }
      }
    } catch {
      /* fallback do zwykłego tekstu */
    }

    const ok = writeClipboardText(part.text!);
    if (!ok) {
      setStatus("Nie udało się skopiować podglądu do schowka");
      return false;
    }
    setStatus(
      part.scope === "selection"
        ? "Skopiowano zaznaczenie z podglądu (tekst)"
        : "Skopiowano cały podgląd (tekst)"
    );
    return true;
  }

  function selectionIsInPreview() {
    const sel = window.getSelection();
    return Boolean(
      sel && !sel.isCollapsed && sel.rangeCount > 0 && previewRef.current?.contains(sel.anchorNode)
    );
  }

  async function copyFromContext() {
    if (contextTarget === "preview" || selectionIsInPreview()) {
      await copyPreviewSelection();
    } else {
      editor.copySelection();
    }
  }

  async function pasteFromContext() {
    if (contextTarget === "preview" || selectionIsInPreview()) {
      setStatus("Wklejanie działa w edytorze — kliknij w panel Edytor");
      return;
    }
    await editor.pasteFromClipboard();
  }

  function handlePreviewClick(e: React.MouseEvent<HTMLElement>) {
    const heading = (e.target as HTMLElement).closest("h1, h2, h3, h4, h5, h6");
    if (!heading) return;
    const id = heading.id;
    const text = heading.textContent ?? "";
    if (id) editor.jumpToPreviewHeading(id, text);
  }

  const fileActions: ToolbarAction[] = [
    { label: "Otwórz", icon: <FolderOpen size={17} />, run: fm.open },
    { label: "Szukaj", icon: <FolderSearch size={17} />, run: () => setWorkspaceSearchOpen(true) },
    { label: "Zapisz", icon: <Save size={17} />, run: fm.save },
    { label: "Zapisz jako", icon: <Download size={17} />, run: fm.saveAs },
    { label: "PDF", icon: <FileDown size={17} />, run: exportPdf },
    { label: "HTML", icon: <FileDown size={17} />, run: exportHtml },
    { label: "DOCX", icon: <FileDown size={17} />, run: exportDocx },
    { label: "Wydruk", icon: <Printer size={17} />, run: openPrintPreview }
  ];

  const formatActions: ToolbarAction[] = [
    { label: "H1", icon: <Heading1 size={17} />, run: () => editor.prefixLine("# ") },
    { label: "H2", icon: <Heading2 size={17} />, run: () => editor.prefixLine("## ") },
    { label: "Pogrubienie", icon: <Bold size={17} />, run: () => editor.wrapSelection("**", "**", "tekst") },
    { label: "Kursywa", icon: <Italic size={17} />, run: () => editor.wrapSelection("*", "*", "tekst") },
    { label: "Cytat", icon: <Quote size={17} />, run: () => editor.prefixLine("> ") },
    { label: "Lista", icon: <List size={17} />, run: () => editor.prefixLine("- ") },
    { label: "Lista numerowana", icon: <ListOrdered size={17} />, run: () => editor.prefixLine("1. ") },
    { label: "Kod", icon: <Code2 size={17} />, run: () => editor.wrapSelection("`", "`", "kod") },
    { label: "Link", icon: <Link size={17} />, run: () => editor.wrapSelection("[", "](https://)", "opis") },
    { label: "Kopiuj", icon: <Clipboard size={17} />, run: () => void copyFromContext() },
    { label: "Wklej", icon: <ClipboardPaste size={17} />, run: () => void editor.pasteFromClipboard() },
    { label: "Grafika", icon: <ImagePlus size={17} />, run: () => setShowImageDialog(true) },
    { label: "Tabela", icon: <Table2 size={17} />, run: () => setShowTableDialog(true) }
  ];

  return (
    <div
      className={`app-shell${dragOver ? " drag-over" : ""}${workspaceSearchOpen ? " with-search" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        const inPreview = previewRef.current?.contains(e.target as Node) ?? false;
        setContextTarget(inPreview ? "preview" : "editor");
        setContextMenu({
          x: Math.min(e.clientX, window.innerWidth - 228),
          y: Math.min(e.clientY, window.innerHeight - 280)
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
        onViewModeChange={setViewMode}
        onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
        onOpenRecentFile={fm.openRecentFile}
      />
      <TabBar
        tabs={fm.tabs}
        activeId={fm.activeId}
        onSwitch={fm.switchTab}
        onClose={fm.closeTab}
        onNew={fm.newDocument}
        onNewTemplate={fm.newDocumentFromTemplate}
      />
      <WorkspaceSearch
        open={workspaceSearchOpen}
        initialFolder={searchFolderFromFilePath(filePath)}
        onClose={() => setWorkspaceSearchOpen(false)}
        onOpenHit={(path, line) => void openSearchHit(path, line)}
        onStatus={setStatus}
      />
      <FormatBar
        formatActions={formatActions}
        query={query}
        replacement={replacement}
        onQueryChange={setQuery}
        onReplacementChange={setReplacement}
        onFindNext={() => editor.findNext(query)}
        onReplaceOne={() => editor.replaceOne(query, replacement)}
        onReplaceAll={() => editor.replaceAll(query, replacement)}
      />

      <main className={`workspace ${viewMode}`}>
        <section className="editor-pane" aria-label="Edytor Markdown">
          <div className="pane-title">
            <AlignLeft size={15} />
            <span>Edytor</span>
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

        <section className="preview-pane" aria-label="Podgląd dokumentu">
          <div className="pane-title pane-title-actions">
            <span className="pane-title-label">
              <Eye size={15} />
              <span>Podgląd</span>
            </span>
            <button
              type="button"
              className="pane-action"
              title="Kopiuj podgląd z formatowaniem"
              onClick={() => void copyPreviewSelection()}
            >
              <Clipboard size={14} />
              <span>Kopiuj</span>
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
      </main>

      <StatusBar status={status} stats={stats} />

      {showImageDialog && (
        <ImageDialog
          onInsert={(mdText) => {
            editor.insertAtSelection(mdText);
            setShowImageDialog(false);
          }}
          onClose={() => setShowImageDialog(false)}
          onPickFile={() => window.markdownStudio.pickImageFile()}
        />
      )}

      {showTableDialog && (
        <TableDialog
          onInsert={(mdText) => {
            editor.insertAtSelection(mdText);
            setShowTableDialog(false);
          }}
          onClose={() => setShowTableDialog(false)}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
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
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
