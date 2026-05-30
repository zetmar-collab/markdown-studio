import { useCallback, useMemo } from "react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { Prec, type Extension } from "@codemirror/state";
import { findHeadingOffset } from "../utils/markdownRenderer";
import {
  copyEditorText,
  pasteEditorText,
  readClipboardText,
  writeClipboardText
} from "../utils/clipboard";

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
      setDirty(true);
      view.focus();
    },
    [editorView, setDirty]
  );

  const copySelection = useCallback(() => {
    const view = editorView();
    if (!view) return false;
    view.focus();
    return copyEditorText(view, setStatus);
  }, [editorView, setStatus]);

  const pasteFromClipboard = useCallback(() => {
    const view = editorView();
    if (!view) return false;
    view.focus();
    return pasteEditorText(view, setStatus, () => setDirty(true));
  }, [editorView, setDirty, setStatus]);

  const cutSelection = useCallback(() => {
    const view = editorView();
    if (!view) return false;
    view.focus();
    const sel = view.state.selection.main;
    if (sel.empty) return copySelection();
    const text = view.state.doc.sliceString(sel.from, sel.to);
    if (!writeClipboardText(text)) {
      setStatus("Nie udało się wyciąć");
      return false;
    }
    view.dispatch({ changes: { from: sel.from, to: sel.to, insert: "" }, selection: { anchor: sel.from } });
    setDirty(true);
    setStatus("Wycięto");
    return true;
  }, [copySelection, editorView, setDirty, setStatus]);

  const clipboardExtension: Extension = useMemo(() => {
    const domHandlers = EditorView.domEventHandlers({
        copy(event, view) {
          const sel = view.state.selection.main;
          const text = sel.empty ? view.state.doc.toString() : view.state.sliceDoc(sel.from, sel.to);
          if (!text) return false;
          event.clipboardData?.setData("text/plain", text);
          event.preventDefault();
          writeClipboardText(text);
          setStatus(sel.empty ? "Skopiowano cały dokument" : "Skopiowano");
          return true;
        },
        paste(event, view) {
          let text = event.clipboardData?.getData("text/plain") ?? "";
          if (!text) text = readClipboardText();
          if (!text) return false;
          const { from, to } = view.state.selection.main;
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length }
          });
          event.preventDefault();
          setDirty(true);
          setStatus("Wklejono");
          return true;
        },
        cut(event, view) {
          const sel = view.state.selection.main;
          if (sel.empty) return false;
          const text = view.state.sliceDoc(sel.from, sel.to);
          event.clipboardData?.setData("text/plain", text);
          event.preventDefault();
          writeClipboardText(text);
          view.dispatch({ changes: { from: sel.from, to: sel.to, insert: "" }, selection: { anchor: sel.from } });
          setDirty(true);
          setStatus("Wycięto");
          return true;
        }
      });

    const shortcuts = Prec.highest(
      keymap.of([
        {
          key: "Mod-c",
          run: (view) => {
            copyEditorText(view, setStatus);
            return true;
          }
        },
        {
          key: "Mod-v",
          run: (view) => {
            pasteEditorText(view, setStatus, () => setDirty(true));
            return true;
          }
        },
        {
          key: "Mod-x",
          run: (view) => {
            const sel = view.state.selection.main;
            if (sel.empty) {
              copyEditorText(view, setStatus);
              return true;
            }
            const text = view.state.sliceDoc(sel.from, sel.to);
            writeClipboardText(text);
            view.dispatch({ changes: { from: sel.from, to: sel.to, insert: "" }, selection: { anchor: sel.from } });
            setDirty(true);
            setStatus("Wycięto");
            return true;
          }
        }
      ])
    );

    return [domHandlers, shortcuts];
  }, [setDirty, setStatus]);

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
      setDirty(true);
      view.focus();
    },
    [editorView, setDirty]
  );

  const prefixLine = useCallback(
    (prefix: string) => {
      const view = editorView();
      if (!view) return;
      const line = view.state.doc.lineAt(view.state.selection.main.from);
      view.dispatch({ changes: { from: line.from, insert: prefix } });
      setDirty(true);
      view.focus();
    },
    [editorView, setDirty]
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
      setDirty(true);
      setStatus("Zamieniono jedno wystąpienie");
    },
    [editorView, findNext, setDirty, setStatus]
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
    clipboardExtension,
    insertAtSelection,
    copySelection,
    cutSelection,
    pasteFromClipboard,
    wrapSelection,
    prefixLine,
    findNext,
    replaceOne,
    replaceAll,
    jumpToPreviewHeading
  };
}
