import TurndownService from "turndown";

/**
 * Converts rich HTML from the clipboard into Markdown.
 *
 * Pasting from a browser or Word used to drop all structure, because the
 * clipboard fallback stripped every tag with a regex.
 */
let service: TurndownService | null = null;

function getService(): TurndownService {
  if (service) return service;
  const turndown = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined"
  });

  turndown.addRule("strikethrough", {
    filter: ["del", "s"],
    replacement: (content) => `~~${content}~~`
  });

  // GitHub-flavoured tables; Turndown drops them by default.
  turndown.addRule("tableCell", {
    filter: ["th", "td"],
    replacement: (content) => ` ${content.replace(/\n+/g, " ").trim()} |`
  });
  turndown.addRule("tableRow", {
    filter: "tr",
    replacement: (content, node) => {
      const row = node as HTMLTableRowElement;
      const isHeader =
        row.parentNode?.nodeName === "THEAD" ||
        Array.from(row.children).every((cell) => cell.nodeName === "TH");
      const line = `|${content}`;
      if (!isHeader) return `${line}\n`;
      const separator = Array.from(row.children)
        .map(() => " --- |")
        .join("");
      return `${line}\n|${separator}\n`;
    }
  });
  turndown.addRule("table", {
    filter: "table",
    replacement: (content) => `\n\n${content.trim()}\n\n`
  });

  // Scripts and styles must never survive a paste.
  turndown.remove(["script", "style", "noscript"]);

  service = turndown;
  return turndown;
}

export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return "";
  try {
    return getService().turndown(html).trim();
  } catch {
    return "";
  }
}

/** Heuristic: is this clipboard HTML worth converting, or just wrapped text? */
export function looksLikeRichHtml(html: string): boolean {
  if (!html.trim()) return false;
  return /<(a|h[1-6]|ul|ol|li|table|pre|code|blockquote|strong|b|em|i|img)\b/i.test(html);
}
