import { useEffect, useRef } from "react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import type { ViewMode } from "../renderer-types";

/**
 * Map preview elements carrying `data-line` to their offset inside the preview
 * scroller, sorted by source line.
 */
function collectAnchors(preview: HTMLElement): { line: number; top: number }[] {
  const nodes = preview.querySelectorAll<HTMLElement>("[data-line]");
  const previewTop = preview.getBoundingClientRect().top - preview.scrollTop;
  const anchors: { line: number; top: number }[] = [];
  for (const node of nodes) {
    const line = Number(node.dataset.line);
    if (!Number.isFinite(line)) continue;
    anchors.push({ line, top: node.getBoundingClientRect().top - previewTop });
  }
  anchors.sort((a, b) => a.line - b.line);
  return anchors;
}

/** Linear interpolation between the two anchors surrounding `value`. */
function interpolate(
  anchors: { line: number; top: number }[],
  value: number,
  key: "line" | "top",
  target: "line" | "top"
): number | null {
  if (anchors.length === 0) return null;
  if (anchors.length === 1) return anchors[0][target];

  let low = 0;
  let high = anchors.length - 1;
  if (value <= anchors[low][key]) return anchors[low][target];
  if (value >= anchors[high][key]) return anchors[high][target];

  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (anchors[mid][key] <= value) low = mid;
    else high = mid;
  }

  const span = anchors[high][key] - anchors[low][key];
  const ratio = span > 0 ? (value - anchors[low][key]) / span : 0;
  return anchors[low][target] + ratio * (anchors[high][target] - anchors[low][target]);
}

/**
 * Two-way scroll sync anchored on source lines.
 *
 * The previous version matched scroll percentages, so a tall image or a long
 * code block pushed the two panes out of step.
 */
export function useScrollSync(
  editorRef: React.RefObject<ReactCodeMirrorRef | null>,
  previewRef: React.RefObject<HTMLElement | null>,
  viewMode: ViewMode,
  html: string
) {
  const syncing = useRef(false);

  useEffect(() => {
    if (viewMode !== "split") return;

    const view = editorRef.current?.view;
    const preview = previewRef.current;
    if (!view || !preview) return;

    const editorScroller = view.scrollDOM;
    let anchors = collectAnchors(preview);

    const refresh = () => {
      anchors = collectAnchors(preview);
    };
    // Images and Mermaid diagrams change layout after the first paint.
    const observer = new ResizeObserver(refresh);
    observer.observe(preview);

    const withGuard = (fn: () => void) => {
      if (syncing.current) return;
      syncing.current = true;
      try {
        fn();
      } finally {
        window.requestAnimationFrame(() => {
          syncing.current = false;
        });
      }
    };

    const ratioFallback = (fromEditor: boolean) => {
      const maxEditor = editorScroller.scrollHeight - editorScroller.clientHeight;
      const maxPreview = preview.scrollHeight - preview.clientHeight;
      if (fromEditor) {
        const ratio = maxEditor > 0 ? editorScroller.scrollTop / maxEditor : 0;
        preview.scrollTop = ratio * maxPreview;
      } else {
        const ratio = maxPreview > 0 ? preview.scrollTop / maxPreview : 0;
        editorScroller.scrollTop = ratio * maxEditor;
      }
    };

    const syncEditorToPreview = () =>
      withGuard(() => {
        if (!anchors.length) return ratioFallback(true);
        const topLine = view.state.doc.lineAt(
          view.lineBlockAtHeight(editorScroller.scrollTop).from
        ).number;
        const top = interpolate(anchors, topLine, "line", "top");
        if (top == null) return ratioFallback(true);
        preview.scrollTop = top;
      });

    const syncPreviewToEditor = () =>
      withGuard(() => {
        if (!anchors.length) return ratioFallback(false);
        const line = interpolate(anchors, preview.scrollTop, "top", "line");
        if (line == null) return ratioFallback(false);
        const clamped = Math.min(Math.max(1, Math.round(line)), view.state.doc.lines);
        const block = view.lineBlockAt(view.state.doc.line(clamped).from);
        editorScroller.scrollTop = block.top;
      });

    editorScroller.addEventListener("scroll", syncEditorToPreview, { passive: true });
    preview.addEventListener("scroll", syncPreviewToEditor, { passive: true });
    return () => {
      observer.disconnect();
      editorScroller.removeEventListener("scroll", syncEditorToPreview);
      preview.removeEventListener("scroll", syncPreviewToEditor);
    };
  }, [editorRef, previewRef, viewMode, html]);
}
