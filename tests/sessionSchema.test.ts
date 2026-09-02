import { describe, expect, it } from "vitest";
import {
  MAX_INLINE_CONTENT,
  sanitizeRecentFiles,
  sanitizeSession
} from "../src/shared/sessionSchema";
import { htmlToMarkdown, looksLikeRichHtml } from "../src/renderer/utils/htmlToMarkdown";

describe("sanitizeSession", () => {
  it("returns an empty session for junk", () => {
    expect(sanitizeSession(null).tabs).toHaveLength(0);
    expect(sanitizeSession({ tabs: "nope" }).tabs).toHaveLength(0);
  });

  it("keeps saved tabs without their content", () => {
    const session = sanitizeSession({
      activeIndex: 0,
      tabs: [{ filePath: "C:\\a.md", fileName: "a.md", content: "big" }]
    });
    expect(session.tabs[0]).toEqual({ filePath: "C:\\a.md", fileName: "a.md" });
  });

  it("keeps the text of unsaved tabs", () => {
    const session = sanitizeSession({
      activeIndex: 0,
      tabs: [{ filePath: null, fileName: "x.md", content: "draft" }]
    });
    expect(session.tabs[0].content).toBe("draft");
  });

  it("drops unsaved content that exceeds the budget", () => {
    const huge = "x".repeat(MAX_INLINE_CONTENT + 1);
    const session = sanitizeSession({
      activeIndex: 0,
      tabs: [{ filePath: null, fileName: "x.md", content: huge }]
    });
    expect(session.tabs[0].content).toBe("");
  });

  it("clamps activeIndex into range", () => {
    const tabs = [{ filePath: null, fileName: "a", content: "" }];
    expect(sanitizeSession({ activeIndex: 99, tabs }).activeIndex).toBe(0);
    expect(sanitizeSession({ activeIndex: -5, tabs }).activeIndex).toBe(0);
    expect(sanitizeSession({ activeIndex: "x", tabs }).activeIndex).toBe(0);
  });

  it("skips malformed entries", () => {
    const session = sanitizeSession({ activeIndex: 0, tabs: [null, 5, { fileName: "ok.md" }] });
    expect(session.tabs).toHaveLength(1);
    expect(session.tabs[0].fileName).toBe("ok.md");
  });
});

describe("sanitizeRecentFiles", () => {
  it("keeps only non-empty strings and caps the list", () => {
    expect(sanitizeRecentFiles(["a", "", 3, null, "b"])).toEqual(["a", "b"]);
    expect(sanitizeRecentFiles(Array.from({ length: 30 }, (_, i) => `f${i}`))).toHaveLength(10);
  });

  it("returns an empty list for junk", () => {
    expect(sanitizeRecentFiles("nope")).toEqual([]);
  });
});

describe("htmlToMarkdown", () => {
  it("converts headings, emphasis and links", () => {
    const markdown = htmlToMarkdown(
      '<h1>Hi</h1><p><b>bold</b> <a href="https://e.com">link</a></p>'
    );
    expect(markdown).toContain("# Hi");
    expect(markdown).toContain("**bold**");
    expect(markdown).toContain("[link](https://e.com)");
  });

  it("converts lists", () => {
    expect(htmlToMarkdown("<ul><li>a</li><li>b</li></ul>")).toBe("-   a\n-   b");
  });

  it("converts a table to GFM", () => {
    const markdown = htmlToMarkdown(
      "<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>"
    );
    expect(markdown).toContain("| A | B |");
    expect(markdown).toContain("| --- | --- |");
    expect(markdown).toContain("| 1 | 2 |");
  });

  it("strips scripts", () => {
    expect(htmlToMarkdown("<p>a</p><script>alert(1)</script>")).not.toContain("alert");
  });

  it("returns an empty string for empty input", () => {
    expect(htmlToMarkdown("   ")).toBe("");
  });
});

describe("looksLikeRichHtml", () => {
  it("detects markup worth converting", () => {
    expect(looksLikeRichHtml("<p>x</p>")).toBe(false);
    expect(looksLikeRichHtml("<h1>x</h1>")).toBe(true);
    expect(looksLikeRichHtml('<a href="#">x</a>')).toBe(true);
    expect(looksLikeRichHtml("")).toBe(false);
  });
});
