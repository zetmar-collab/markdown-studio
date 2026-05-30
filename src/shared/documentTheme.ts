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
}

export function buildDocumentCss(theme: DocumentTheme, compact = false): string {
  const c = getDocumentColors(theme);
  const base = compact ? "11pt" : "16px";
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
    ${HLJS_CLIPBOARD_CSS}
  `.replace(/\s+/g, " ").trim();
}

export function wrapHtmlDocument(innerHtml: string, theme: DocumentTheme, compact = false): string {
  const styles = buildDocumentCss(theme, compact);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${styles}</style></head><body><!--StartFragment-->${innerHtml}<!--EndFragment--></body></html>`;
}

export function buildExportHtmlShell(innerHtml: string, title: string, theme: DocumentTheme): string {
  const styles = `
    @page { margin: 24mm 20mm; }
    * { box-sizing: border-box; }
    ${buildDocumentCss(theme, true)}
    main { max-width: 780px; margin: 0 auto; padding: 24px 20px; }
  `.replace(/\s+/g, " ");

  const safeTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<title>${safeTitle}</title>
<style>${styles}</style>
</head>
<body><main>${innerHtml}</main></body>
</html>`;
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
`;

export const PRINT_PREVIEW_TOOLBAR_HTML = `
<div id="ms-print-bar">
  <button type="button" class="primary" onclick="window.print()">Drukuj</button>
  <button type="button" onclick="window.close()">Zamknij</button>
</div>
`;
