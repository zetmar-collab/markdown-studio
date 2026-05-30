import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import markdownItTaskLists from "markdown-it-task-lists";
import hljs from "highlight.js";
import { stripFrontMatter } from "./frontMatter";

/** GFM ~~strikethrough~~ (bez zewnętrznego pakietu — kompatybilny z Vite). */
function markdownItStrikethrough(md: MarkdownIt) {
  md.inline.ruler.before("emphasis", "strikethrough", (state, silent) => {
    const max = state.posMax;
    let pos = state.pos;
    if (state.src.charCodeAt(pos) !== 0x7e /* ~ */) return false;
    if (pos + 2 >= max || state.src.charCodeAt(pos + 1) !== 0x7e) return false;

    const start = pos + 2;
    let matchEnd = start;
    let found = false;
    while (matchEnd < max) {
      if (state.src.charCodeAt(matchEnd) === 0x7e) {
        if (matchEnd + 1 < max && state.src.charCodeAt(matchEnd + 1) === 0x7e) {
          if (matchEnd !== start) found = true;
          break;
        }
      }
      matchEnd++;
    }
    if (!found) return false;
    if (silent) return false;

    const content = state.src.slice(start, matchEnd);
    const tokenO = state.push("s_open", "del", 1);
    tokenO.markup = "~~";
    const tokenT = state.push("text", "", 0);
    tokenT.content = content;
    const tokenC = state.push("s_close", "del", -1);
    tokenC.markup = "~~";
    state.pos = matchEnd + 2;
    return true;
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(code: string, language: string): string {
    const validLanguage = language && hljs.getLanguage(language);
    if (validLanguage) {
      return `<pre><code class="hljs language-${language}">${hljs.highlight(code, { language }).value}</code></pre>`;
    }
    return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`;
  }
})
  .use(markdownItStrikethrough)
  .use(markdownItTaskLists, { enabled: true, label: true })
  .use(markdownItAnchor, { permalink: false, tabIndex: false });

md.validateLink = (url: string) => !/^(javascript:|vbscript:)/i.test(url.trim());

/** Render markdown body (without front matter) to HTML. */
export function renderMarkdownBody(content: string): string {
  return md.render(stripFrontMatter(content));
}

export function getDocStats(value: string) {
  const body = stripFrontMatter(value);
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  return { words, characters: value.length, lines: value.split(/\r\n|\r|\n/).length };
}

/** Find editor offset for a heading element id from markdown-it-anchor. */
export function findHeadingOffset(content: string, headingId: string): number | null {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (!m) continue;
    const slug = slugifyHeading(m[2].trim());
    if (slug === headingId) {
      let offset = 0;
      for (let j = 0; j < i; j++) offset += lines[j].length + 1;
      return offset;
    }
  }
  return null;
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}
