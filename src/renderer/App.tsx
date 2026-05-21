import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import {
  AlignLeft,
  Bold,
  Clipboard,
  ClipboardPaste,
  Code2,
  Download,
  Eye,
  FileDown,
  FilePlus,
  FolderOpen,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Save,
  Table2
} from "lucide-react";
import type {} from "../types/electron-api";
import "highlight.js/styles/github-dark.css";
import "./styles.css";
import { Toolbar }     from "./components/Toolbar";
import { FormatBar }   from "./components/FormatBar";
import { StatusBar }   from "./components/StatusBar";
import { ContextMenu } from "./components/ContextMenu";
import { ImageDialog } from "./components/ImageDialog";
import { TableDialog } from "./components/TableDialog";
import type { Theme, ViewMode, ToolbarAction } from "./renderer-types";
import { TabBar } from "./components/TabBar";
import { useTabManager } from "./hooks/useTabManager";

// ── markdown renderer ──────────────────────────────────────────────────────

const MARKDOWN_EXTENSIONS = ["md", "markdown", "mdown", "mkd"];

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(code: string, language: string): string {
    const validLanguage = language && hljs.getLanguage(language);
    if (validLanguage) {
      return `<pre><code class="hljs language-${language}">${hljs.highlight(code, { language }).value}</code></pre>`;
    }
    return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`;
  }
});

// Allow file:// and data: image URLs (blocked by markdown-it's default sanitizer)
md.validateLink = (url: string) => !/^(javascript:|vbscript:)/i.test(url.trim());

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getStats(value: string) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return { words, characters: value.length, lines: value.split(/\r\n|\r|\n/).length };
}

// ── App ────────────────────────────────────────────────────────────────────

function App() {
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const [status,          setStatus]          = useState("Gotowe");
  const [theme,           setTheme]           = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "dark");
  const [viewMode,        setViewMode]        = useState<ViewMode>("split");
  const [query,           setQuery]           = useState("");
  const [replacement,     setReplacement]     = useState("");
  const [contextMenu,     setContextMenu]     = useState<{ x: number; y: number } | null>(null);
  const [dragOver,        setDragOver]        = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);

  const fm = useTabManager(setStatus);
  const { content, setContent, filePath, fileName, dirty, setDirty, recentFiles, snap } = fm;

  const html  = useMemo(() => md.render(content), [content]);
  const stats = useMemo(() => getStats(content), [content]);

  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      EditorView.theme({
        "&":          { height: "100%" },
        ".cm-scroller": { fontFamily: "\"Cascadia Code\", Consolas, monospace" },
        ".cm-content":  { padding: "18px" },
        ".cm-line":     { lineHeight: "1.65" }
      })
    ],
    []
  );

  // ── effects ───────────────────────────────────────────────────────────────

  // Theme persistence
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Startup file
  useEffect(() => {
    void fm.loadStartupFile();
    return window.markdownStudio.onStartupFileChanged(() => { void fm.loadStartupFile(); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // onWillClose is handled inside useTabManager (covers all tabs at once)

  // Dismiss context menu on outside click / key / resize
  useEffect(() => {
    const dismiss = () => setContextMenu(null);
    window.addEventListener("click",   dismiss);
    window.addEventListener("keydown", dismiss);
    window.addEventListener("resize",  dismiss);
    return () => {
      window.removeEventListener("click",   dismiss);
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("resize",  dismiss);
    };
  }, []);

  // Keyboard shortcuts (fm actions are stable useCallback refs)
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if      (key === "s" && event.shiftKey) { event.preventDefault(); void fm.saveAs(); }
      else if (key === "s") { event.preventDefault(); void fm.save(); }
      else if (key === "o") { event.preventDefault(); void fm.open(); }
      else if (key === "n" || key === "t")    { event.preventDefault(); fm.newDocument(); }
      else if (key === "w") { event.preventDefault(); fm.closeTab(fm.activeId); }
      else if (key === "b") { event.preventDefault(); wrapSelection("**", "**", "pogrubiony tekst"); }
      else if (key === "i") { event.preventDefault(); wrapSelection("*", "*", "kursywa"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fm.save, fm.saveAs, fm.open, fm.newDocument, fm.closeTab, fm.activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag & drop
  useEffect(() => {
    const onDragOver  = (e: DragEvent) => { e.preventDefault(); e.dataTransfer!.dropEffect = "copy"; setDragOver(true); };
    const onDragLeave = (e: DragEvent) => { if (e.relatedTarget == null) setDragOver(false); };
    const onDrop      = async (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      const path = (file as File & { path: string }).path;
      if (!path) return;
      const ext = path.split(".").pop()?.toLowerCase() ?? "";
      if (!MARKDOWN_EXTENSIONS.includes(ext)) return;
      if (snap.current.dirty && !window.confirm("Masz niezapisane zmiany. Czy na pewno chcesz otworzyć inny plik?")) return;
      fm.openRecentFile(path);
    };
    window.addEventListener("dragover",  onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop",      onDrop);
    return () => {
      window.removeEventListener("dragover",  onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop",      onDrop);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── editor helpers ────────────────────────────────────────────────────────

  function editorView() { return editorRef.current?.view ?? null; }

  function insertAtSelection(text: string) {
    const view = editorView();
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    view.focus();
  }

  function copySelection() {
    const view = editorView();
    if (!view) return;
    const sel  = view.state.selection.main;
    const text = sel.empty ? view.state.doc.toString() : view.state.doc.sliceString(sel.from, sel.to);
    window.markdownStudio.writeClipboardText(text);
    setStatus(sel.empty ? "Skopiowano cały dokument" : "Skopiowano zaznaczenie");
    view.focus();
  }

  function pasteFromClipboard() {
    const text = window.markdownStudio.readClipboardText();
    if (!text) { setStatus("Schowek jest pusty"); return; }
    insertAtSelection(text);
    setStatus("Wklejono tekst ze schowka");
  }

  function wrapSelection(prefix: string, suffix: string, placeholder: string) {
    const view = editorView();
    if (!view) return;
    const sel      = view.state.selection.main;
    const selected = view.state.doc.sliceString(sel.from, sel.to) || placeholder;
    const insert   = `${prefix}${selected}${suffix}`;
    view.dispatch({
      changes:   { from: sel.from, to: sel.to, insert },
      selection: { anchor: sel.from + prefix.length, head: sel.from + prefix.length + selected.length }
    });
    view.focus();
  }

  function prefixLine(prefix: string) {
    const view = editorView();
    if (!view) return;
    const line = view.state.doc.lineAt(view.state.selection.main.from);
    view.dispatch({ changes: { from: line.from, insert: prefix } });
    view.focus();
  }

  function findNext() {
    if (!query) return;
    const view = editorView();
    const from  = Math.max(0, view?.state.selection.main.to ?? 0);
    const idx   = content.toLowerCase().indexOf(query.toLowerCase(), from);
    const found = idx >= 0 ? idx : content.toLowerCase().indexOf(query.toLowerCase());
    if (!view || found < 0) { setStatus("Nie znaleziono tekstu"); return; }
    view.dispatch({ selection: { anchor: found, head: found + query.length }, scrollIntoView: true });
    view.focus();
    setStatus(`Znaleziono: ${query}`);
  }

  function replaceOne() {
    const view = editorView();
    const sel  = view?.state.selection.main;
    if (!view || !sel || sel.empty) { findNext(); return; }
    if (view.state.doc.sliceString(sel.from, sel.to).toLowerCase() !== query.toLowerCase()) { findNext(); return; }
    view.dispatch({
      changes:   { from: sel.from, to: sel.to, insert: replacement },
      selection: { anchor: sel.from + replacement.length }
    });
    setStatus("Zamieniono jedno wystąpienie");
  }

  function replaceAll() {
    if (!query) return;
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const count   = (content.match(pattern) ?? []).length;
    setContent(content.replace(pattern, replacement));
    setDirty(true);
    setStatus(`Zamieniono wystąpień: ${count}`);
  }

  // ── export ────────────────────────────────────────────────────────────────

  async function exportPdf() {
    setStatus("Eksport PDF...");
    try {
      const result = await window.markdownStudio.exportPdf({ filePath, html, title: fileName, theme });
      setStatus(result ? `Wyeksportowano PDF: ${result.filePath}` : "Anulowano eksport PDF");
    } catch (error) {
      setStatus(`Błąd eksportu PDF: ${error instanceof Error ? error.message : "nieznany błąd"}`);
    }
  }

  async function exportHtml() {
    setStatus("Eksport HTML...");
    try {
      const result = await window.markdownStudio.exportHtml({ filePath, html, title: fileName, theme });
      setStatus(result ? `Wyeksportowano HTML: ${result.filePath}` : "Anulowano eksport HTML");
    } catch (error) {
      setStatus(`Błąd eksportu HTML: ${error instanceof Error ? error.message : "nieznany błąd"}`);
    }
  }

  // ── action arrays ─────────────────────────────────────────────────────────

  const fileActions: ToolbarAction[] = [
    { label: "Nowy",        icon: <FilePlus   size={17} />, run: fm.newDocument },
    { label: "Otwórz",      icon: <FolderOpen size={17} />, run: fm.open },
    { label: "Zapisz",      icon: <Save       size={17} />, run: fm.save },
    { label: "Zapisz jako", icon: <Download   size={17} />, run: fm.saveAs },
    { label: "PDF",         icon: <FileDown   size={17} />, run: exportPdf },
    { label: "HTML",        icon: <FileDown   size={17} />, run: exportHtml }
  ];

  const formatActions: ToolbarAction[] = [
    { label: "H1",               icon: <Heading1     size={17} />, run: () => prefixLine("# ") },
    { label: "H2",               icon: <Heading2     size={17} />, run: () => prefixLine("## ") },
    { label: "Pogrubienie",      icon: <Bold         size={17} />, run: () => wrapSelection("**", "**", "tekst") },
    { label: "Kursywa",          icon: <Italic       size={17} />, run: () => wrapSelection("*", "*", "tekst") },
    { label: "Cytat",            icon: <Quote        size={17} />, run: () => prefixLine("> ") },
    { label: "Lista",            icon: <List         size={17} />, run: () => prefixLine("- ") },
    { label: "Lista numerowana", icon: <ListOrdered  size={17} />, run: () => prefixLine("1. ") },
    { label: "Kod",              icon: <Code2        size={17} />, run: () => wrapSelection("`", "`", "kod") },
    { label: "Link",             icon: <Link         size={17} />, run: () => wrapSelection("[", "](https://)", "opis") },
    { label: "Kopiuj",           icon: <Clipboard    size={17} />, run: copySelection },
    { label: "Wklej",            icon: <ClipboardPaste size={17} />, run: pasteFromClipboard },
    { label: "Grafika",          icon: <ImagePlus    size={17} />, run: () => setShowImageDialog(true) },
    { label: "Tabela",           icon: <Table2       size={17} />, run: () => setShowTableDialog(true) }
  ];

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`app-shell${dragOver ? " drag-over" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({
          x: Math.min(e.clientX, window.innerWidth  - 228),
          y: Math.min(e.clientY, window.innerHeight - 252)
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
      />
      <FormatBar
        formatActions={formatActions}
        query={query}
        replacement={replacement}
        onQueryChange={setQuery}
        onReplacementChange={setReplacement}
        onFindNext={findNext}
        onReplaceOne={replaceOne}
        onReplaceAll={replaceAll}
      />

      <main className={`workspace ${viewMode}`}>
        <section className="editor-pane" aria-label="Edytor Markdown">
          <div className="pane-title">
            <AlignLeft size={15} /><span>Edytor</span>
          </div>
          <CodeMirror
            ref={editorRef}
            value={content}
            height="100%"
            theme={theme === "dark" ? oneDark : "light"}
            extensions={extensions}
            onChange={(value) => { setContent(value); setDirty(true); }}
            basicSetup={{
              foldGutter:                true,
              highlightActiveLine:       true,
              highlightSelectionMatches: true,
              lineNumbers:               true,
              searchKeymap:              true
            }}
          />
        </section>

        <section className="preview-pane" aria-label="Podgląd dokumentu">
          <div className="pane-title">
            <Eye size={15} /><span>Podgląd</span>
          </div>
          <article
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </section>
      </main>

      <StatusBar status={status} stats={stats} />

      {showImageDialog && (
        <ImageDialog
          onInsert={(mdText) => { insertAtSelection(mdText); setShowImageDialog(false); }}
          onClose={() => setShowImageDialog(false)}
          onPickFile={() => window.markdownStudio.pickImageFile()}
        />
      )}

      {showTableDialog && (
        <TableDialog
          onInsert={(mdText) => { insertAtSelection(mdText); setShowTableDialog(false); }}
          onClose={() => setShowTableDialog(false)}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onSave={()        => { setContextMenu(null); void fm.save(); }}
          onCopy={()        => { setContextMenu(null); copySelection(); }}
          onPaste={()       => { setContextMenu(null); pasteFromClipboard(); }}
          onExportPdf={()   => { setContextMenu(null); void exportPdf(); }}
          onExportDocx={()  => { setContextMenu(null); void exportHtml(); }}
          onClose={()       => { setContextMenu(null); void window.markdownStudio.closeWindow(); }}
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
