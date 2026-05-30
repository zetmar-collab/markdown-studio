import { useEffect, useState } from "react";
import { renderMarkdownBody } from "../utils/markdownRenderer";

export function useMarkdownPreview(content: string, filePath: string | null) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;
    const rendered = renderMarkdownBody(content);
    void window.markdownStudio.embedImagesInHtml(rendered, filePath).then((embedded) => {
      if (!cancelled) setHtml(embedded);
    });
    return () => {
      cancelled = true;
    };
  }, [content, filePath]);

  return html;
}
