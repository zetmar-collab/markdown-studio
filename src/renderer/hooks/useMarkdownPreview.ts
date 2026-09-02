import { useEffect, useState } from "react";
import { renderMarkdownBody } from "../utils/markdownRenderer";
import { rewriteAssetUrls } from "../utils/assetUrls";
import { PREVIEW_DEBOUNCE_MS } from "../constants";

export interface PreviewOptions {
  math: boolean;
  mermaid: boolean;
}

/**
 * Rendered preview HTML.
 *
 * Debounced, and images are pointed at the asset protocol instead of being
 * base64-inlined over IPC: the old version did a disk read plus a full base64
 * transfer of every local image on every keystroke.
 */
export function useMarkdownPreview(
  content: string,
  filePath: string | null,
  options: PreviewOptions
): string {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const rendered = renderMarkdownBody(content, options);
      setHtml(rewriteAssetUrls(rendered, filePath));
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [content, filePath, options.math, options.mermaid]); // eslint-disable-line react-hooks/exhaustive-deps

  return html;
}
