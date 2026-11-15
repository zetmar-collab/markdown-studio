import MarkdownIt from "markdown-it";
import markdownItTaskLists from "markdown-it-task-lists";
import markdownItFootnote from "markdown-it-footnote";
import markdownItDeflist from "markdown-it-deflist";
import markdownItContainer from "markdown-it-container";
import markdownItKatex from "@vscode/markdown-it-katex";
// `highlight.js` pulls in ~190 language grammars; the "common" bundle covers
// the ~40 languages people actually write in Markdown and is a fraction of
// the size. Unknown languages already fall back to escaped plain text.
import hljs from "highlight.js/lib/common";
import { stripFrontMatter } from "./frontMatter";
import { createSlugger } from "../../shared/slugify";
import { READING_WORDS_PER_MINUTE } from "../constants";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface RenderOptions {
  math?: boolean;
  mermaid?: boolean;
}

const ADMONITIONS = ["note", "tip", "warning", "danger"] as const;

function createRenderer(options: RenderOptions): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    highlight(code: string, language: string): string {
      const validLanguage = language && hljs.getLanguage(language);
      if (validLanguage) {
        return `<pre><code class="hljs language-${escapeHtml(language)}">${
          hljs.highlight(code, { language }).value
        }</code></pre>`;
      }
      return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`;
    }
  });

  md.use(markdownItTaskLists, { enabled: true, label: true })
    .use(markdownItFootnote)
    .use(markdownItDeflist);

  for (const kind of ADMONITIONS) {
    md.use(markdownItContainer, kind, {
      render(tokens: { nesting: number; info: string }[], idx: number) {
        const token = tokens[idx];
        if (token.nesting !== 1) return "</div>\n";
        const title = token.info.trim().slice(kind.length).trim();
        const heading = title
          ? `<p class="md-admonition-title">${escapeHtml(title)}</p>`
          : `<p class="md-admonition-title">${kind.toUpperCase()}</p>`;
        return `<div class="md-admonition md-admonition-${kind}">${heading}\n`;
      }
    });
  }

  if (options.math) {
    // MathML output needs no stylesheet, so formulas survive export, the
    // clipboard and DOCX identically to what the preview shows.
    md.use(markdownItKatex, { output: "mathml", throwOnError: false });
  }

  /**
   * Mermaid fences become placeholders that the renderer turns into SVG.
   * This has to be a fence rule, not a `highlight` hook: markdown-it wraps
   * highlight output in `<pre><code>` unless it already starts with `<pre`.
   */
  const defaultFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    if (options.mermaid && token.info.trim().toLowerCase() === "mermaid") {
      const line = token.map ? ` data-line="${token.map[0] + 1}"` : "";
      return `<div class="mermaid-diagram"${line} data-mermaid-source="${encodeURIComponent(
        token.content
      )}"></div>`;
    }
    return defaultFence
      ? defaultFence(tokens, idx, opts, env, self)
      : self.renderToken(tokens, idx, opts);
  };

  /**
   * markdown-it's default link validation blocks `javascript:`, `vbscript:` and
   * `data:` documents while still allowing data-URI images. Extend it rather
   * than replacing it - the previous override re-enabled `data:text/html`.
   */
  const baseValidateLink = md.validateLink.bind(md);
  md.validateLink = (url: string) =>
    baseValidateLink(url) && !/^\s*(javascript|vbscript):/i.test(url);

  /**
   * Tag every block-level token with its source line. Scroll sync and
   * jump-to-heading read this instead of trying to re-derive positions by
   * matching text, which broke on duplicates and punctuation.
   */
  const defaultRenderToken = md.renderer.renderToken.bind(md.renderer);
  md.renderer.renderToken = (tokens, idx, opts) => {
    const token = tokens[idx];
    if (token.block && token.nesting !== -1 && token.map) {
      token.attrSet("data-line", String(token.map[0] + 1));
    }
    return defaultRenderToken(tokens, idx, opts);
  };

  return md;
}

let cached: { key: string; md: MarkdownIt } | null = null;

function rendererFor(options: RenderOptions): MarkdownIt {
  const key = `${options.math ? 1 : 0}-${options.mermaid ? 1 : 0}`;
  if (cached?.key === key) return cached.md;
  cached = { key, md: createRenderer(options) };
  return cached.md;
}

/** Render markdown body (without front matter) to HTML. */
export function renderMarkdownBody(content: string, options: RenderOptions = {}): string {
  const md = rendererFor({ math: options.math !== false, mermaid: options.mermaid !== false });
  const slugger = createSlugger();
  const env: Record<string, unknown> = {};
  const body = stripFrontMatter(content);

  // Apply unique slugs per render pass; markdown-it-anchor receives the final
  // text through our `slugify`, so uniqueness is handled here.
  const tokens = md.parse(body, env);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== "heading_open") continue;
    const inline = tokens[i + 1];
    const text = inline?.type === "inline" ? (inline.content ?? "") : "";
    token.attrSet("id", slugger(text));
  }
  return md.renderer.render(tokens, md.options, env);
}

export interface DocStats {
  words: number;
  characters: number;
  lines: number;
  readingMinutes: number;
}

export function getDocStats(value: string): DocStats {
  const body = stripFrontMatter(value);
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  return {
    words,
    characters: value.length,
    lines: value.split(/\r\n|\r|\n/).length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / READING_WORDS_PER_MINUTE))
  };
}

export interface OutlineItem {
  level: number;
  text: string;
  id: string;
  line: number;
}

/**
 * Headings for the outline panel, taken from the parsed token stream so fenced
 * code blocks containing `#` are never mistaken for headings.
 */
export function extractOutline(content: string): OutlineItem[] {
  const md = rendererFor({ math: false, mermaid: false });
  const body = stripFrontMatter(content);
  const offset = content.slice(0, content.length - body.length).split(/\r\n|\r|\n/).length - 1;
  const tokens = md.parse(body, {});
  const slugger = createSlugger();
  const items: OutlineItem[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== "heading_open" || !token.map) continue;
    const inline = tokens[i + 1];
    const text = (inline?.type === "inline" ? inline.content : "") ?? "";
    items.push({
      level: Number(token.tag.slice(1)) || 1,
      text: text.replace(/[*_`~]/g, "").trim(),
      id: slugger(text),
      line: token.map[0] + 1 + offset
    });
  }
  return items;
}
