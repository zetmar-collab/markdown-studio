import { useCallback, useMemo } from "react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { Prec, type Extension } from "@codemirror/state";
import type { Translator } from "../../shared/i18n";
import { readClipboardHtml, readClipboardText, writeClipboardText } from "../utils/clipboard";
import { htmlToMarkdown, looksLikeRichHtml } from "../utils/htmlToMarkdown";
import { getListContinuation, renumberOrderedBlockAt } from "../utils/listContinuation";
import {
  findNextMatch,
  matchesExactly,
  replaceAllMatches,
  type FindOptions
} from "../utils/findReplace";

export function useEditorActions(
  editorRef: React.RefObject<ReactCodeMirrorRef | null>,
  content: string,
  setContent: (value: string) => void,
  setDirty: (dirty: boolean) => void,
  setStatus: (msg: string) => void,
  t: Translator,
  filePath: string | null
) {
  const editorView = useCallback(() => editorRef.current?.view ?? null, [editorRef]);

  const insertAtSelection = useCallback(
    (text: string) => {
      const view = editorView();
      if (!view) return;
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length }
      });
      setDirty(true);
      view.focus();
    },
    [editorView, setDirty]
  );

  const copySelection = useCallback(async () => {
    const view = editorView();
    if (!view) return false;
    view.focus();
    const sel = view.state.selection.main;
    const text = sel.empty
      ? view.state.doc.toString()
      : view.state.doc.sliceString(sel.from, sel.to);
    if (!text) {
      setStatus(t("status.nothingToCopy"));
      return false;
    }
    const ok = await writeClipboardText(text);
    setStatus(
      ok ? (sel.empty ? t("status.copiedAll") : t("status.copied")) : t("status.copyFailed")
    );
    return ok;
  }, [editorView, setStatus, t]);

  /**
   * Paste, in order of preference:
   *  1. an image on the clipboard -> saved next to the document, linked
   *  2. rich HTML -> converted to Markdown
   *  3. plain text
   */
  const pasteFromClipboard = useCallback(async () => {
    const view = editorView();
    if (!view) return false;
    view.focus();

    const image = await window.markdownStudio.saveClipboardImage(filePath);
    if (image && "needsSavedFile" in image) {
      setStatus(t("status.imageNeedsSavedFile"));
      return false;
    }
    if (image && "relativePath" in image) {
      const markdown = `![](${image.relativePath})`;
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: markdown },
        selection: { anchor: from + markdown.length }
      });
      setDirty(true);
      setStatus(t("status.pastedImage", { name: image.fileName }));
      return true;
    }

    const html = await readClipboardHtml();
    let text = "";
    let converted = false;
    if (looksLikeRichHtml(html)) {
      text = htmlToMarkdown(html);
      converted = Boolean(text);
    }
    if (!text) text = await readClipboardText();
    if (!text) {
      setStatus(t("status.clipboardEmpty"));
      return false;
    }

    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length }
    });
    setDirty(true);
    setStatus(converted ? t("status.pastedAsMarkdown") : t("status.pasted"));
    return true;
  }, [editorView, filePath, setDirty, setStatus, t]);

  const cutSelection = useCallback(async () => {
    const view = editorView();
    if (!view) return false;
    view.focus();
    const sel = view.state.selection.main;
    if (sel.empty) return copySelection();
    const text = view.state.doc.sliceString(sel.from, sel.to);
    if (!(await writeClipboardText(text))) {
      setStatus(t("status.cutFailed"));
      return false;
    }
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: "" },
      selection: { anchor: sel.from }
    });
    setDirty(true);
    setStatus(t("status.cut"));
    return true;
  }, [copySelection, editorView, setDirty, setStatus, t]);

  const clipboardExtension: Extension = useMemo(() => {
    const domHandlers = EditorView.domEventHandlers({
      copy(event, view) {
        const sel = view.state.selection.main;
        const text = sel.empty ? view.state.doc.toString() : view.state.sliceDoc(sel.from, sel.to);
        if (!text) return false;
        event.clipboardData?.setData("text/plain", text);
        event.preventDefault();
        void writeClipboardText(text);
        setStatus(sel.empty ? t("status.copiedAll") : t("status.copied"));
        return true;
      },
      paste(event, view) {
        const data = event.clipboardData;
        if (!data) return false;

        // An image on the clipboard needs the main process (file write).
        if (Array.from(data.items ?? []).some((item) => item.type.startsWith("image/"))) {
          event.preventDefault();
          void pasteFromClipboard();
          return true;
        }

        const html = data.getData("text/html");
        const plain = data.getData("text/plain");
        const markdown = looksLikeRichHtml(html) ? htmlToMarkdown(html) : "";
        const text = markdown || plain;
        if (!text) return false;

        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length }
        });
        event.preventDefault();
        setDirty(true);
        setStatus(markdown ? t("status.pastedAsMarkdown") : t("status.pasted"));
        return true;
      },
      cut(event, view) {
        const sel = view.state.selection.main;
        if (sel.empty) return false;
        const text = view.state.sliceDoc(sel.from, sel.to);
        event.clipboardData?.setData("text/plain", text);
        event.preventDefault();
        void writeClipboardText(text);
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: "" },
          selection: { anchor: sel.from }
        });
        setDirty(true);
        setStatus(t("status.cut"));
        return true;
      }
    });

    const shortcuts = Prec.highest(
      keymap.of([
        {
          key: "Mod-c",
          run: () => {
            void copySelection();
            return true;
          }
        },
        {
          key: "Mod-v",
          run: () => {
            void pasteFromClipboard();
            return true;
          }
        },
        {
          key: "Mod-x",
          run: () => {
            void cutSelection();
            return true;
          }
        },
        {
          // Continue lists, task lists and blockquotes on Enter.
          key: "Enter",
          run: (view) => {
            const sel = view.state.selection.main;
            if (!sel.empty) return false;
            const line = view.state.doc.lineAt(sel.head);
            // Only when the cursor sits at the end of the line.
            if (sel.head !== line.to) return false;

            const action = getListContinuation(line.text);
            if (!action) return false;

            if (action.kind === "clear") {
              view.dispatch({
                changes: { from: line.from, to: line.to, insert: action.replacement },
                selection: { anchor: line.from + action.replacement.length }
              });
              setDirty(true);
              return true;
            }

            view.dispatch({
              changes: { from: sel.head, to: sel.head, insert: action.text },
              selection: { anchor: sel.head + action.text.length }
            });

            // Inserting into the middle of an ordered list would otherwise
            // leave "1. 2. 2. 3."; fix just the run that was edited.
            const caret = view.state.selection.main.head;
            const caretLine = view.state.doc.lineAt(caret);
            const docLines = view.state.doc.toString().split("\n");
            const block = renumberOrderedBlockAt(docLines, caretLine.number - 1);
            if (block) {
              const from = view.state.doc.line(block.startLine + 1).from;
              const to = view.state.doc.line(block.endLine + 1).to;
              view.dispatch({
                changes: { from, to, insert: block.text },
                selection: { anchor: Math.min(caret, from + block.text.length) }
              });
            }

            setDirty(true);
            return true;
          }
        }
      ])
    );

    return [domHandlers, shortcuts];
  }, [copySelection, cutSelection, pasteFromClipboard, setDirty, setStatus, t]);

  const wrapSelection = useCallback(
    (prefix: string, suffix: string, placeholder: string) => {
      const view = editorView();
      if (!view) return;
      const sel = view.state.selection.main;
      const selected = view.state.doc.sliceString(sel.from, sel.to) || placeholder;
      const insert = `${prefix}${selected}${suffix}`;
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert },
        selection: {
          anchor: sel.from + prefix.length,
          head: sel.from + prefix.length + selected.length
        }
      });
      setDirty(true);
      view.focus();
    },
    [editorView, setDirty]
  );

  /** Prefix every line touched by the selection, not just the first one. */
  const prefixLine = useCallback(
    (prefix: string) => {
      const view = editorView();
      if (!view) return;
      const sel = view.state.selection.main;
      const first = view.state.doc.lineAt(sel.from);
      const last = view.state.doc.lineAt(sel.to);
      const changes = [];
      for (let n = first.number; n <= last.number; n++) {
        const line = view.state.doc.line(n);
        changes.push({ from: line.from, insert: prefix });
      }
      view.dispatch({ changes });
      setDirty(true);
      view.focus();
    },
    [editorView, setDirty]
  );

  const findNext = useCallback(
    (query: string, options: FindOptions = {}) => {
      if (!query) return;
      const view = editorView();
      if (!view) return;
      const from = Math.max(0, view.state.selection.main.to);
      const match = findNextMatch(content, query, from, options);
      if (!match) {
        setStatus(options.regex && !query ? t("find.badRegex") : t("find.notFound"));
        return;
      }
      view.dispatch({
        selection: { anchor: match.from, head: match.to },
        scrollIntoView: true
      });
      view.focus();
      setStatus(t("find.found", { value: match.text }));
    },
    [content, editorView, setStatus, t]
  );

  const replaceOne = useCallback(
    (query: string, replacement: string, options: FindOptions = {}) => {
      const view = editorView();
      const sel = view?.state.selection.main;
      if (!view || !sel || sel.empty) {
        findNext(query, options);
        return;
      }
      const selected = view.state.doc.sliceString(sel.from, sel.to);
      if (!matchesExactly(selected, query, options)) {
        findNext(query, options);
        return;
      }
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: replacement },
        selection: { anchor: sel.from + replacement.length }
      });
      setDirty(true);
      setStatus(t("find.replacedOne"));
    },
    [editorView, findNext, setDirty, setStatus, t]
  );

  const replaceAll = useCallback(
    (query: string, replacement: string, options: FindOptions = {}) => {
      if (!query) return;
      const result = replaceAllMatches(content, query, replacement, options);
      if (!result) {
        setStatus(t("find.badRegex"));
        return;
      }
      setContent(result.text);
      setDirty(true);
      setStatus(t("find.replacedMany", { count: result.count }));
    },
    [content, setContent, setDirty, setStatus, t]
  );

  /** Move the caret to a 1-based document line. */
  const jumpToLine = useCallback(
    (line: number, announce = false) => {
      const view = editorView();
      if (!view) return;
      const n = Math.min(Math.max(1, line), view.state.doc.lines);
      const docLine = view.state.doc.line(n);
      view.dispatch({ selection: { anchor: docLine.from }, scrollIntoView: true });
      view.focus();
      if (announce) setStatus(t("status.jumpedToHeading"));
    },
    [editorView, setStatus, t]
  );

  /** Replace the current word (used by the spell-check context menu). */
  const replaceWordAtCursor = useCallback(
    (replacement: string) => {
      const view = editorView();
      if (!view) return;
      const pos = view.state.selection.main.head;
      const line = view.state.doc.lineAt(pos);
      const offset = pos - line.from;
      const before = line.text.slice(0, offset).search(/[\p{L}\p{N}'-]+$/u);
      const afterMatch = /^[\p{L}\p{N}'-]+/u.exec(line.text.slice(offset));
      const from = before >= 0 ? line.from + before : pos;
      const to = pos + (afterMatch ? afterMatch[0].length : 0);
      view.dispatch({
        changes: { from, to, insert: replacement },
        selection: { anchor: from + replacement.length }
      });
      setDirty(true);
      view.focus();
    },
    [editorView, setDirty]
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
    jumpToLine,
    replaceWordAtCursor
  };
}
