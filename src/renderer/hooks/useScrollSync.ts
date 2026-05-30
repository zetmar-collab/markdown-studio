import { useEffect, useRef } from "react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import type { ViewMode } from "../renderer-types";

export function useScrollSync(
  editorRef: React.RefObject<ReactCodeMirrorRef | null>,
  previewRef: React.RefObject<HTMLElement | null>,
  viewMode: ViewMode
) {
  const syncing = useRef(false);

  useEffect(() => {
    if (viewMode !== "split") return;

    const view = editorRef.current?.view;
    const preview = previewRef.current;
    if (!view || !preview) return;

    const editorScroller = view.scrollDOM;

    const syncEditorToPreview = () => {
      if (syncing.current) return;
      syncing.current = true;
      const maxEditor = editorScroller.scrollHeight - editorScroller.clientHeight;
      const maxPreview = preview.scrollHeight - preview.clientHeight;
      const ratio = maxEditor > 0 ? editorScroller.scrollTop / maxEditor : 0;
      preview.scrollTop = ratio * maxPreview;
      syncing.current = false;
    };

    const syncPreviewToEditor = () => {
      if (syncing.current) return;
      syncing.current = true;
      const maxEditor = editorScroller.scrollHeight - editorScroller.clientHeight;
      const maxPreview = preview.scrollHeight - preview.clientHeight;
      const ratio = maxPreview > 0 ? preview.scrollTop / maxPreview : 0;
      editorScroller.scrollTop = ratio * maxEditor;
      syncing.current = false;
    };

    editorScroller.addEventListener("scroll", syncEditorToPreview, { passive: true });
    preview.addEventListener("scroll", syncPreviewToEditor, { passive: true });
    return () => {
      editorScroller.removeEventListener("scroll", syncEditorToPreview);
      preview.removeEventListener("scroll", syncPreviewToEditor);
    };
  }, [editorRef, previewRef, viewMode]);
}
