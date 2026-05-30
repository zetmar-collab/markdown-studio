import { useCallback } from "react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { findHeadingOffset } from "../utils/markdownRenderer";

export function useEditorActions(
  editorRef: React.RefObject<ReactCodeMirrorRef | null>,
  content: string,
  setContent: (value: string) => void,
  setDirty: (dirty: boolean) => void,
  setStatus: (msg: string) => void
) {
  const editorView = useCallback(() => editorRef.current?.view ?? null, [editorRef]);

  const insertAtSelection = useCallback(
    (text: string) => {
      const view = editorView();
      if (!view) return;
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
      view.focus();
    },
    [editorView]
  );

  const copySelection = useCallback(() => {
    const view = editorView();
    if (!view) return;
    const sel = view.state.selection.main;
    const text = sel.empty ? view.state.doc.toString() : view.state.doc.sliceString(sel.from, sel.to);
    window.markdownStudio.writeClipboardText(text);
    setStatus(sel.empty ? "Skopiowano cały dokument (Markdown)" : "Skopiowano zaznaczenie (Markdown)");
    view.focus();
  }, [editorView, setStatus]);

  const pasteFromClipboard = useCallback(() => {
    const text = window.markdownStudio.readClipboardText();
    if (!text) {
      setStatus("Schowek jest pusty");
      return;
    }
    insertAtSelection(text);
    setStatus("Wklejono tekst ze schowka");
  }, [insertAtSelection, setStatus]);

  const wrapSelection = useCallback(
    (prefix: string, suffix: string, placeholder: string) => {
      const view = editorView();
      if (!view) return;
      const sel = view.state.selection.main;
      const selected = view.state.doc.sliceString(sel.from, sel.to) || placeholder;
      const insert = `${prefix}${selected}${suffix}`;
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert },
        selection: { anchor: sel.from + prefix.length, head: sel.from + prefix.length + selected.length }
      });
      view.focus();
    },
    [editorView]
  );

  const prefixLine = useCallback(
    (prefix: string) => {
      const view = editorView();
      if (!view) return;
      const line = view.state.doc.lineAt(view.state.selection.main.from);
      view.dispatch({ changes: { from: line.from, insert: prefix } });
      view.focus();
    },
    [editorView]
  );

  const findNext = useCallback(
    (query: string) => {
      if (!query) return;
      const view = editorView();
      const from = Math.max(0, view?.state.selection.main.to ?? 0);
      const idx = content.toLowerCase().indexOf(query.toLowerCase(), from);
      const found = idx >= 0 ? idx : content.toLowerCase().indexOf(query.toLowerCase());
      if (!view || found < 0) {
        setStatus("Nie znaleziono tekstu");
        return;
      }
      view.dispatch({ selection: { anchor: found, head: found + query.length }, scrollIntoView: true });
      view.focus();
      setStatus(`Znaleziono: ${query}`);
    },
    [content, editorView, setStatus]
  );

  const replaceOne = useCallback(
    (query: string, replacement: string) => {
      const view = editorView();
      const sel = view?.state.selection.main;
      if (!view || !sel || sel.empty) {
        findNext(query);
        return;
      }
      if (view.state.doc.sliceString(sel.from, sel.to).toLowerCase() !== query.toLowerCase()) {
        findNext(query);
        return;
      }
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: replacement },
        selection: { anchor: sel.from + replacement.length }
      });
      setStatus("Zamieniono jedno wystąpienie");
    },
    [editorView, findNext, setStatus]
  );

  const replaceAll = useCallback(
    (query: string, replacement: string) => {
      if (!query) return;
      const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const count = (content.match(pattern) ?? []).length;
      setContent(content.replace(pattern, replacement));
      setDirty(true);
      setStatus(`Zamieniono wystąpień: ${count}`);
    },
    [content, setContent, setDirty, setStatus]
  );

  const jumpToPreviewHeading = useCallback(
    (headingId: string, headingText: string) => {
      const view = editorView();
      if (!view) return;
      let offset = findHeadingOffset(content, headingId);
      if (offset == null && headingText) {
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const m = lines[i].match(/^#{1,6}\s+(.+)$/);
          if (m && m[1].trim() === headingText.trim()) {
            offset = 0;
            for (let j = 0; j < i; j++) offset += lines[j].length + 1;
            break;
          }
        }
      }
      if (offset == null) return;
      view.dispatch({ selection: { anchor: offset }, scrollIntoView: true });
      view.focus();
      setStatus("Przejście do nagłówka w edytorze");
    },
    [content, editorView, setStatus]
  );

  return {
    insertAtSelection,
    copySelection,
    pasteFromClipboard,
    wrapSelection,
    prefixLine,
    findNext,
    replaceOne,
    replaceAll,
    jumpToPreviewHeading
  };
}
