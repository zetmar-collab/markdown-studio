import { describe, expect, it } from "vitest";
import { hasFrontMatter, stripFrontMatter } from "../src/renderer/utils/frontMatter";

describe("frontMatter", () => {
  it("strips YAML block", () => {
    const input = "---\ntitle: Test\n---\n\n# Hello";
    expect(stripFrontMatter(input)).toBe("\n# Hello");
    expect(hasFrontMatter(input)).toBe(true);
  });

  it("leaves content without front matter", () => {
    expect(stripFrontMatter("# Hi")).toBe("# Hi");
    expect(hasFrontMatter("# Hi")).toBe(false);
  });
});
