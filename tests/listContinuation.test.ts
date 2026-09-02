import { describe, expect, it } from "vitest";
import {
  getListContinuation,
  parseListLine,
  renumberOrderedBlockAt,
  renumberOrderedLists
} from "../src/renderer/utils/listContinuation";

describe("parseListLine", () => {
  it("recognises bullets, ordered items, tasks and quotes", () => {
    expect(parseListLine("- item")).toMatchObject({ ordered: false, marker: "-", content: "item" });
    expect(parseListLine("3. item")).toMatchObject({ ordered: true, number: 3, delimiter: "." });
    expect(parseListLine("- [ ] todo")).toMatchObject({ task: true, content: "todo" });
    expect(parseListLine("> quote")).toMatchObject({ quote: true, content: "quote" });
  });

  it("returns null for ordinary text", () => {
    expect(parseListLine("just text")).toBeNull();
    expect(parseListLine("")).toBeNull();
  });
});

describe("getListContinuation", () => {
  it("continues a bullet list", () => {
    expect(getListContinuation("- item")).toEqual({ kind: "insert", text: "\n- " });
  });

  it("preserves indentation", () => {
    expect(getListContinuation("    - item")).toEqual({ kind: "insert", text: "\n    - " });
  });

  it("increments ordered items and keeps the delimiter", () => {
    expect(getListContinuation("3) item")).toEqual({ kind: "insert", text: "\n4) " });
  });

  it("continues task lists with an unchecked box", () => {
    expect(getListContinuation("- [x] done")).toEqual({ kind: "insert", text: "\n- [ ] " });
  });

  it("continues blockquotes", () => {
    expect(getListContinuation("> text")).toEqual({ kind: "insert", text: "\n> " });
  });

  it("ends the list when the item is empty", () => {
    expect(getListContinuation("- ")).toEqual({ kind: "clear", replacement: "" });
    expect(getListContinuation("2. ")).toEqual({ kind: "clear", replacement: "" });
  });

  it("does nothing for plain paragraphs", () => {
    expect(getListContinuation("plain text")).toBeNull();
  });
});

describe("renumberOrderedLists", () => {
  it("fixes a duplicated sequence", () => {
    expect(renumberOrderedLists("1. a\n2. b\n2. c\n")).toBe("1. a\n2. b\n3. c\n");
  });

  it("restarts after a paragraph", () => {
    const input = "1. a\n5. b\n\ntext\n\n7. c\n";
    expect(renumberOrderedLists(input)).toBe("1. a\n2. b\n\ntext\n\n1. c\n");
  });

  it("leaves bullet lists untouched", () => {
    expect(renumberOrderedLists("- a\n- b\n")).toBe("- a\n- b\n");
  });

  it("numbers nested levels independently", () => {
    const input = "1. a\n    1. x\n    3. y\n9. b\n";
    expect(renumberOrderedLists(input)).toBe("1. a\n    1. x\n    2. y\n2. b\n");
  });
});

describe("renumberOrderedBlockAt", () => {
  it("renumbers only the run containing the cursor", () => {
    const lines = ["1. a", "2. b", "2. c", "", "1. x", "1. y"];
    const block = renumberOrderedBlockAt(lines, 1);
    expect(block).toMatchObject({ startLine: 0, endLine: 2 });
    expect(block?.text).toBe("1. a\n2. b\n3. c");
  });

  it("returns null when the numbering is already correct", () => {
    expect(renumberOrderedBlockAt(["1. a", "2. b"], 0)).toBeNull();
  });

  it("returns null outside an ordered list", () => {
    expect(renumberOrderedBlockAt(["- a", "text"], 1)).toBeNull();
  });
});
