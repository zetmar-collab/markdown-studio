import { describe, expect, it } from "vitest";
import {
  compilePattern,
  findNextMatch,
  matchesExactly,
  replaceAllMatches
} from "../src/renderer/utils/findReplace";

describe("compilePattern", () => {
  it("escapes the query in literal mode", () => {
    const pattern = compilePattern("a.b");
    expect(pattern?.test("axb")).toBe(false);
    expect(compilePattern("a.b")?.test("a.b")).toBe(true);
  });

  it("returns null for an invalid regex instead of throwing", () => {
    expect(compilePattern("(unclosed", { regex: true })).toBeNull();
  });
});

describe("findNextMatch", () => {
  it("finds the next match after the cursor", () => {
    expect(findNextMatch("abc abc", "abc", 1)).toMatchObject({ from: 4, to: 7 });
  });

  it("wraps around to the start", () => {
    expect(findNextMatch("abc def", "abc", 5)).toMatchObject({ from: 0, to: 3 });
  });

  it("is case insensitive by default and exact when asked", () => {
    expect(findNextMatch("Alpha", "alpha", 0)).not.toBeNull();
    expect(findNextMatch("Alpha", "alpha", 0, { caseSensitive: true })).toBeNull();
  });

  it("supports regular expressions", () => {
    expect(findNextMatch("id: 42", "\\d+", 0, { regex: true })).toMatchObject({ text: "42" });
  });

  it("does not hang on a zero-width pattern", () => {
    expect(findNextMatch("abc", "x*", 0, { regex: true })).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(findNextMatch("abc", "zzz", 0)).toBeNull();
  });
});

describe("replaceAllMatches", () => {
  it("replaces every occurrence and counts them", () => {
    expect(replaceAllMatches("a a a", "a", "b")).toEqual({ text: "b b b", count: 3 });
  });

  it("treats $ in the replacement literally outside regex mode", () => {
    expect(replaceAllMatches("x", "x", "$1")).toEqual({ text: "$1", count: 1 });
  });

  it("honours capture groups in regex mode", () => {
    expect(replaceAllMatches("John Smith", "(\\w+) (\\w+)", "$2 $1", { regex: true })).toEqual({
      text: "Smith John",
      count: 1
    });
  });

  it("reports an invalid regex as null", () => {
    expect(replaceAllMatches("x", "(", "y", { regex: true })).toBeNull();
  });
});

describe("matchesExactly", () => {
  it("accepts a full match only", () => {
    expect(matchesExactly("abc", "abc")).toBe(true);
    expect(matchesExactly("abcd", "abc")).toBe(false);
  });

  it("works with regex queries", () => {
    expect(matchesExactly("42", "\\d+", { regex: true })).toBe(true);
  });
});
