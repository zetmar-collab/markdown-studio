import { describe, expect, it } from "vitest";
import { buildRecentMenuEntries, escapeMenuLabel } from "../src/main/recentMenu";

describe("escapeMenuLabel", () => {
  it("doubles ampersands so they are not read as mnemonics", () => {
    expect(escapeMenuLabel("A & B.md")).toBe("A && B.md");
    expect(escapeMenuLabel("plain.md")).toBe("plain.md");
  });
});

describe("buildRecentMenuEntries", () => {
  it("numbers the entries from one", () => {
    const entries = buildRecentMenuEntries(["/a/one.md", "/a/two.md"]);
    expect(entries.map((entry) => entry.label)).toEqual(["1  one.md", "2  two.md"]);
  });

  it("keeps the original path alongside each label", () => {
    const entries = buildRecentMenuEntries(["/a/one.md"]);
    expect(entries[0].filePath).toBe("/a/one.md");
  });

  it("appends the folder only for names that repeat", () => {
    const entries = buildRecentMenuEntries([
      "/docs/notes.md",
      "/archive/notes.md",
      "/docs/todo.md"
    ]);
    expect(entries[0].label).toBe("1  notes.md  —  docs");
    expect(entries[1].label).toBe("2  notes.md  —  archive");
    expect(entries[2].label).toBe("3  todo.md");
  });

  it("escapes ampersands in file names", () => {
    expect(buildRecentMenuEntries(["/a/R & D.md"])[0].label).toBe("1  R && D.md");
  });

  it("returns an empty list for no paths", () => {
    expect(buildRecentMenuEntries([])).toEqual([]);
  });
});
