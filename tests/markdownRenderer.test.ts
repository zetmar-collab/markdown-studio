import { describe, expect, it } from "vitest";
import {
  extractOutline,
  getDocStats,
  renderMarkdownBody
} from "../src/renderer/utils/markdownRenderer";

describe("renderMarkdownBody", () => {
  it("renders GFM strikethrough without a custom plugin", () => {
    expect(renderMarkdownBody("a ~~b~~ c")).toContain("<s>b</s>");
  });

  it("tags block elements with their source line", () => {
    const html = renderMarkdownBody("# One\n\nText\n\n## Two");
    expect(html).toContain('data-line="1"');
    expect(html).toContain('data-line="5"');
  });

  it("gives duplicate headings distinct ids", () => {
    const html = renderMarkdownBody("# Sekcja\n\n# Sekcja\n");
    expect(html).toContain('id="sekcja"');
    expect(html).toContain('id="sekcja-1"');
  });

  it("keeps punctuation out of heading ids", () => {
    expect(renderMarkdownBody("## Co nowego?")).toContain('id="co-nowego"');
  });

  it("refuses to build an anchor for javascript: links", () => {
    // The URL survives as escaped text; what matters is that it is not linkable.
    const html = renderMarkdownBody("[x](javascript:alert(1))");
    expect(html).not.toContain("<a ");
  });

  it("refuses data:text/html links but keeps data image sources", () => {
    const link = renderMarkdownBody("[x](data:text/html,<script>)");
    expect(link).not.toContain("<a ");
    expect(link).not.toContain("<script>");

    const image = renderMarkdownBody("![a](data:image/png;base64,AAAA)");
    expect(image).toContain("data:image/png;base64,AAAA");
  });

  it("still links ordinary URLs", () => {
    expect(renderMarkdownBody("[x](https://example.com)")).toContain(
      '<a href="https://example.com"'
    );
  });

  it("renders mermaid fences as placeholders, not code blocks", () => {
    const html = renderMarkdownBody("```mermaid\ngraph TD;\nA-->B;\n```", { mermaid: true });
    expect(html).toContain('class="mermaid-diagram"');
    expect(html).toContain("data-mermaid-source=");
    expect(html).not.toContain("<pre>");
  });

  it("leaves mermaid fences as code when the feature is off", () => {
    const html = renderMarkdownBody("```mermaid\ngraph TD;\n```", { mermaid: false });
    expect(html).toContain("<pre>");
    expect(html).not.toContain("mermaid-diagram");
  });

  it("renders footnotes", () => {
    const html = renderMarkdownBody("Text[^1]\n\n[^1]: Note\n");
    expect(html).toContain("footnotes");
  });

  it("renders admonition containers", () => {
    const html = renderMarkdownBody("::: warning Uwaga\ntreść\n:::\n");
    expect(html).toContain("md-admonition-warning");
    expect(html).toContain("Uwaga");
  });

  it("renders math as MathML so no stylesheet is needed", () => {
    const html = renderMarkdownBody("$a^2$", { math: true });
    expect(html).toContain("<math");
  });

  it("escapes an unknown code language instead of injecting it", () => {
    const html = renderMarkdownBody("```<img src=x onerror=1>\ncode\n```");
    expect(html).not.toContain("<img src=x");
  });
});

describe("getDocStats", () => {
  it("counts words, characters, lines and reading time", () => {
    const stats = getDocStats("one two three\nfour");
    expect(stats.words).toBe(4);
    expect(stats.lines).toBe(2);
    expect(stats.readingMinutes).toBe(1);
  });

  it("reports zero reading time for an empty document", () => {
    expect(getDocStats("").readingMinutes).toBe(0);
  });

  it("ignores front matter when counting words", () => {
    expect(getDocStats("---\ntitle: A B C D\n---\n\nword").words).toBe(1);
  });
});

describe("extractOutline", () => {
  it("returns headings with source lines", () => {
    const outline = extractOutline("# A\n\ntext\n\n## B\n");
    expect(outline).toHaveLength(2);
    expect(outline[0]).toMatchObject({ level: 1, text: "A", line: 1 });
    expect(outline[1]).toMatchObject({ level: 2, text: "B", line: 5 });
  });

  it("does not treat comments inside fenced code as headings", () => {
    const outline = extractOutline("# Real\n\n```bash\n# not a heading\n```\n");
    expect(outline.map((item) => item.text)).toEqual(["Real"]);
  });

  it("offsets line numbers past front matter", () => {
    const outline = extractOutline("---\ntitle: t\n---\n\n# Head\n");
    expect(outline[0].line).toBe(5);
  });

  it("deduplicates ids the same way the renderer does", () => {
    const outline = extractOutline("# Sekcja\n\n# Sekcja\n");
    expect(outline.map((item) => item.id)).toEqual(["sekcja", "sekcja-1"]);
  });
});
