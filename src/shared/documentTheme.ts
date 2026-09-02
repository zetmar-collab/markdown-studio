/** Single source of truth for preview, export, clipboard, and print. */

export type DocumentTheme = "light" | "dark";

export interface DocumentColors {
  bg: string;
  text: string;
  muted: string;
  border: string;
  codeBg: string;
  codeBorder: string;
  thBg: string;
  preBg: string;
  preText: string;
  link: string;
}

export function getDocumentColors(theme: DocumentTheme): DocumentColors {
  return theme === "dark"
    ? {
        bg: "#141720",
        text: "#e8ecf4",
        muted: "#8892a4",
        border: "#2d3340",
        codeBg: "#1b1f2b",
        codeBorder: "#2d3340",
        thBg: "#1e2330",
        preBg: "#0e1118",
        preText: "#dde3ef",
        link: "#6ea8fe"
      }
    : {
        bg: "#ffffff",
        text: "#1f2632",
        muted: "#606b7a",
        border: "#d9dee7",
        codeBg: "#eef2f7",
        codeBorder: "#dfe5ee",
        thBg: "#f1f4f8",
        preBg: "#10141d",
        preText: "#eef3f8",
        link: "#276ef1"
      };
}

const HLJS_CLIPBOARD_CSS = `
.hljs { color: #e8ecf4; }
.hljs-keyword, .hljs-selector-tag { color: #ff7b72; }
.hljs-string, .hljs-regexp { color: #a5d6ff; }
.hljs-title, .hljs-section, .hljs-name { color: #d2a8ff; }
.hljs-comment { color: #8b949e; }
.hljs-number, .hljs-literal { color: #79c0ff; }
.hljs-built_in, .hljs-type { color: #ffa657; }
`;

/**
 * Extras rendered by the markdown pipeline that need styling everywhere the
 * document is shown: footnotes, admonition containers, Mermaid diagrams and
 * MathML formulas.
 */
const EXTENSIONS_CSS = `
.footnotes { font-size: .9em; }
.footnotes hr { border: 0; border-top: 1px solid currentColor; opacity: .25; margin: 2em 0 1em; }
.footnote-backref { text-decoration: none; }
.md-admonition { border-left: 4px solid currentColor; border-radius: 6px; padding: 12px 16px; margin: 0 0 1em; }
.md-admonition-title { font-weight: 600; margin: 0 0 .4em; }
.md-admonition-note { border-left-color: #2f86e7; }
.md-admonition-tip { border-left-color: #29a745; }
.md-admonition-warning { border-left-color: #e3a008; }
.md-admonition-danger { border-left-color: #e5534b; }
.mermaid-diagram { margin: 0 0 1em; text-align: center; }
.mermaid-diagram svg { max-width: 100%; height: auto; }
.mermaid-error { border: 1px solid #e5534b; border-radius: 6px; padding: 10px 12px; margin: 0 0 1em; font-size: .9em; }
math { font-size: 1.05em; }
dl dt { font-weight: 600; margin-top: .8em; }
dl dd { margin: 0 0 .4em 1.4em; }
`;

export function buildDocumentCss(
  theme: DocumentTheme,
  compact = false,
  baseFontSize?: number
): string {
  const c = getDocumentColors(theme);
  const base = baseFontSize ? `${baseFontSize}px` : compact ? "11pt" : "16px";
  return `
    body { margin: 0; padding: ${compact ? "0" : "12px 16px"}; background: ${c.bg}; color: ${c.text};
      font-family: "Segoe UI", Arial, sans-serif; font-size: ${base}; line-height: 1.7; }
    h1, h2, h3, h4, h5, h6 { line-height: 1.22; color: ${c.text}; margin: 1.5em 0 .55em; }
    h1 { margin-top: 0; padding-bottom: .25em; border-bottom: 1px solid ${c.border}; font-size: ${compact ? "28pt" : "38px"}; }
    h2 { padding-bottom: .2em; border-bottom: 1px solid ${c.border}; font-size: ${compact ? "20pt" : "27px"}; }
    h3 { font-size: ${compact ? "15pt" : "21px"}; }
    p, ul, ol, pre, table, blockquote { margin: 0 0 1em; }
    ul.contains-task-list { list-style: none; padding-left: 0; }
    li.task-list-item { list-style: none; }
    input[type="checkbox"] { margin-right: 6px; }
    del { color: ${c.muted}; }
    a { color: ${c.link}; }
    blockquote { border-left: 4px solid ${c.border}; color: ${c.muted}; padding-left: 16px; }
    code { font-family: "Cascadia Code", Consolas, monospace; background: ${c.codeBg};
      border: 1px solid ${c.codeBorder}; border-radius: 5px; padding: 1px 5px; }
    pre { background: ${c.preBg}; color: ${c.preText}; border-radius: 8px; padding: 16px; overflow: auto; }
    pre code { padding: 0; border: 0; background: transparent; color: inherit; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid ${c.border}; padding: 8px 10px; }
    th { background: ${c.thBg}; }
    img { max-width: 100%; }
    ${EXTENSIONS_CSS}
    ${HLJS_CLIPBOARD_CSS}
  `
    .replace(/\s+/g, " ")
    .trim();
}

/** Minimal surface for setting CSS variables (works in renderer + electron build). */
export interface ThemeStyleRoot {
  style: { setProperty(name: string, value: string): void };
}

/** Sync preview pane CSS variables with export/clipboard colors. */
export function applyDocumentThemeToRoot(root: ThemeStyleRoot, theme: DocumentTheme) {
  const c = getDocumentColors(theme);
  root.style.setProperty("--preview-bg", c.bg);
  root.style.setProperty("--preview-text", c.text);
  root.style.setProperty("--preview-border", c.border);
  root.style.setProperty("--preview-muted", c.muted);
  root.style.setProperty("--preview-code-bg", c.codeBg);
  root.style.setProperty("--preview-code-border", c.codeBorder);
  root.style.setProperty("--preview-th-bg", c.thBg);
  root.style.setProperty("--preview-pre-bg", c.preBg);
  root.style.setProperty("--preview-pre-text", c.preText);
  root.style.setProperty("--preview-link", c.link);
}

export function wrapHtmlDocument(innerHtml: string, theme: DocumentTheme, compact = false): string {
  const styles = buildDocumentCss(theme, compact);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${styles}</style></head><body><!--StartFragment-->${innerHtml}<!--EndFragment--></body></html>`;
}

export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ExportPageOptions {
  /** Millimetres. */
  margins: { top: number; right: number; bottom: number; left: number };
  pageSize: string;
  landscape: boolean;
}

export const DEFAULT_PAGE_OPTIONS: ExportPageOptions = {
  margins: { top: 24, right: 20, bottom: 24, left: 20 },
  pageSize: "A4",
  landscape: false
};

/**
 * Standalone HTML document used for the HTML export, the PDF render target and
 * the print preview window.
 */
export function buildExportHtmlShell(
  innerHtml: string,
  title: string,
  theme: DocumentTheme,
  page: ExportPageOptions = DEFAULT_PAGE_OPTIONS
): string {
  const m = page.margins;
  const size = page.landscape ? `${page.pageSize} landscape` : page.pageSize;
  const styles = `
    @page { size: ${size}; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm; }
    * { box-sizing: border-box; }
    ${buildDocumentCss(theme, true)}
    main { max-width: 780px; margin: 0 auto; padding: 24px 20px; }
    @media print { main { max-width: none; padding: 0; } }
  `.replace(/\s+/g, " ");

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<title>${escapeHtmlText(title)}</title>
<style>${styles}</style>
</head>
<body><main>${innerHtml}</main></body>
</html>`;
}

/**
 * Header/footer templates for Electron's printToPDF. Chromium requires inline
 * styles and only understands its own `pageNumber`/`totalPages`/`title` spans.
 */
export function buildPdfHeaderTemplate(headerText: string): string {
  const text = escapeHtmlText(headerText);
  return `<div style="font-size:8px;width:100%;padding:0 12mm;color:#666;font-family:Segoe UI,Arial,sans-serif;">${text}</div>`;
}

export function buildPdfFooterTemplate(footerText: string, pageNumbers: boolean): string {
  const text = escapeHtmlText(footerText);
  const numbers = pageNumbers
    ? `<span style="float:right;"><span class="pageNumber"></span> / <span class="totalPages"></span></span>`
    : "";
  return `<div style="font-size:8px;width:100%;padding:0 12mm;color:#666;font-family:Segoe UI,Arial,sans-serif;"><span>${text}</span>${numbers}</div>`;
}

export const PRINT_PREVIEW_TOOLBAR_CSS = `
#ms-print-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  display: flex; gap: 10px; padding: 10px 16px;
  background: #1e2330; border-bottom: 1px solid #2d3340;
  font-family: "Segoe UI", Arial, sans-serif;
}
#ms-print-bar button {
  padding: 8px 16px; border-radius: 6px; border: 1px solid #3d4556;
  background: #2a3142; color: #e8ecf4; cursor: pointer; font-size: 13px;
}
#ms-print-bar button.primary { background: #2f86e7; border-color: #2f86e7; }
body { padding-top: 56px !important; }
@media print { #ms-print-bar { display: none !important; } body { padding-top: 0 !important; } }
`;

export const PRINT_PREVIEW_TOOLBAR_HTML = `
<div id="ms-print-bar">
  <button type="button" class="primary" onclick="window.print()">Drukuj / Print</button>
  <button type="button" onclick="window.close()">Zamknij / Close</button>
</div>
`;
