import { describe, expect, it } from "vitest";
import { countSlides, splitSlides } from "../src/shared/slides";

describe("splitSlides", () => {
  it("splits on a horizontal rule", () => {
    const { slides } = splitSlides("# Jeden\n\n---\n\n# Dwa\n\n---\n\n# Trzy");
    expect(slides).toEqual(["# Jeden", "# Dwa", "# Trzy"]);
  });

  it("returns one slide for a document without rules", () => {
    expect(splitSlides("# Sam tytuł\n\nTreść").slides).toHaveLength(1);
  });

  it("never returns nothing", () => {
    // An empty document is one empty slide, not a crash in the viewer.
    expect(splitSlides("").slides).toEqual([""]);
    expect(splitSlides("\n\n\n").slides).toEqual([""]);
  });

  it("ignores a rule inside a fenced code block", () => {
    const markdown = ["# Kod", "", "```", "---", "nie slajd", "```", "", "---", "", "# Drugi"].join(
      "\n"
    );
    const { slides } = splitSlides(markdown);
    expect(slides).toHaveLength(2);
    expect(slides[0]).toContain("nie slajd");
  });

  it("handles tilde fences and longer fences", () => {
    const markdown = ["~~~~", "---", "~~~~", "---", "# Drugi"].join("\n");
    expect(splitSlides(markdown).slides).toHaveLength(2);
  });

  it("takes front matter off the top instead of showing it", () => {
    const markdown = ["---", "title: Prezentacja", "---", "", "# Pierwszy", "", "---", "", "# Drugi"].join(
      "\n"
    );
    const result = splitSlides(markdown);
    expect(result.frontMatter).toBe("title: Prezentacja");
    expect(result.slides).toEqual(["# Pierwszy", "# Drugi"]);
  });

  it("does not mistake an opening rule for front matter when nothing closes it", () => {
    const { slides, frontMatter } = splitSlides("---\n\n# Pierwszy");
    expect(frontMatter).toBeNull();
    expect(slides).toEqual(["# Pierwszy"]);
  });

  it("accepts the other rule characters", () => {
    expect(splitSlides("a\n\n***\n\nb\n\n___\n\nc").slides).toEqual(["a", "b", "c"]);
  });

  it("drops empty slides produced by doubled rules", () => {
    expect(splitSlides("a\n\n---\n\n---\n\nb").slides).toEqual(["a", "b"]);
  });

  it("does not care about line ending style", () => {
    expect(splitSlides("a\r\n\r\n---\r\n\r\nb").slides).toEqual(["a", "b"]);
  });
});

describe("countSlides", () => {
  it("counts what the viewer would show", () => {
    expect(countSlides("a\n\n---\n\nb\n\n---\n\nc")).toBe(3);
    expect(countSlides("")).toBe(1);
  });
});
