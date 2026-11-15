import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Translator } from "../../shared/i18n";
import type { AppTheme } from "../../types/electron-api";
import { splitSlides } from "../../shared/slides";
import { renderMarkdownBody } from "../utils/markdownRenderer";
import { rewriteAssetUrls } from "../utils/assetUrls";
import { renderMermaidDiagrams } from "../utils/mermaid";

interface PresentationViewProps {
  content: string;
  filePath: string | null;
  theme: AppTheme;
  math: boolean;
  mermaid: boolean;
  onClose: () => void;
  t: Translator;
}

/**
 * Full-screen slides from the document, split on horizontal rules.
 *
 * Rendered with the same pipeline as the preview, so a diagram or a formula
 * looks the same on a slide as it does while writing.
 */
export function PresentationView({
  content,
  filePath,
  theme,
  math,
  mermaid,
  onClose,
  t
}: PresentationViewProps) {
  const slides = useMemo(() => splitSlides(content).slides, [content]);
  const [index, setIndex] = useState(0);
  const slideRef = React.useRef<HTMLDivElement>(null);

  const current = Math.min(index, slides.length - 1);

  const html = useMemo(
    () => rewriteAssetUrls(renderMarkdownBody(slides[current] ?? "", { math, mermaid }), filePath),
    [slides, current, filePath, math, mermaid]
  );

  const go = useCallback(
    (delta: number) => {
      setIndex((value) => Math.max(0, Math.min(slides.length - 1, value + delta)));
    },
    [slides.length]
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowRight":
        case "PageDown":
        case " ":
          event.preventDefault();
          go(1);
          break;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          go(-1);
          break;
        case "Home":
          setIndex(0);
          break;
        case "End":
          setIndex(slides.length - 1);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go, onClose, slides.length]);

  useEffect(() => {
    if (mermaid) void renderMermaidDiagrams(slideRef.current, theme);
  }, [html, theme, mermaid]);

  return (
    <div className="presentation" data-theme={theme}>
      <div className="presentation-stage">
        {/*
          Same pipeline as the preview: markdown-it runs with html: false, so
          raw HTML in the document is escaped rather than parsed, and the page
          carries a CSP that forbids inline and remote scripts.
        */}
        <div
          ref={slideRef}
          className="presentation-slide markdown-preview"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      <div className="presentation-bar">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={current === 0}
          aria-label={t("presentation.previous")}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="presentation-counter">
          {current + 1} / {slides.length}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={current === slides.length - 1}
          aria-label={t("presentation.next")}
        >
          <ChevronRight size={18} />
        </button>
        <button type="button" onClick={onClose} aria-label={t("presentation.exit")}>
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
