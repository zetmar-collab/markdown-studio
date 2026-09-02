import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildSearchPattern,
  escapeRegExp,
  matchColumn,
  searchMarkdownInFolder
} from "../src/main/searchMarkdown";

describe("buildSearchPattern", () => {
  it("escapes literal queries", () => {
    expect(escapeRegExp("a.b")).toBe("a\\.b");
    expect(buildSearchPattern("a.b")?.test("axb")).toBe(false);
  });

  it("returns null for a broken regex", () => {
    expect(buildSearchPattern("(", { regex: true })).toBeNull();
  });

  it("respects case sensitivity", () => {
    expect(buildSearchPattern("abc", { caseSensitive: true })?.flags).toBe("g");
    expect(buildSearchPattern("abc")?.flags).toBe("gi");
  });
});

describe("matchColumn", () => {
  it("finds the first match column", () => {
    expect(matchColumn(/b/g, "abc")).toBe(1);
  });

  it("ignores zero-width matches", () => {
    expect(matchColumn(/x*/g, "abc")).toBe(-1);
  });
});

describe("searchMarkdownInFolder", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "ms-search-"));
    await writeFile(join(root, "a.md"), "Hello world\nsecond line\n", "utf8");
    await mkdir(join(root, "nested"));
    await writeFile(join(root, "nested", "b.markdown"), "hello again\n", "utf8");
    await mkdir(join(root, "node_modules"));
    await writeFile(join(root, "node_modules", "c.md"), "hello from deps\n", "utf8");
    await writeFile(join(root, "d.txt"), "hello txt\n", "utf8");
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("finds matches across nested markdown files", async () => {
    const result = await searchMarkdownInFolder(root, "hello");
    expect(result.hits).toHaveLength(2);
    expect(result.hits.map((hit) => hit.fileName).sort()).toEqual(["a.md", "b.markdown"]);
  });

  it("skips node_modules and non-markdown files", async () => {
    const result = await searchMarkdownInFolder(root, "deps");
    expect(result.hits).toHaveLength(0);
    const txt = await searchMarkdownInFolder(root, "hello txt");
    expect(txt.hits).toHaveLength(0);
  });

  it("honours case sensitivity", async () => {
    const result = await searchMarkdownInFolder(root, "Hello", { caseSensitive: true });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].fileName).toBe("a.md");
  });

  it("supports regular expressions", async () => {
    const result = await searchMarkdownInFolder(root, "^second", { regex: true });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].line).toBe(2);
  });

  it("reports an invalid regex rather than throwing", async () => {
    const result = await searchMarkdownInFolder(root, "(", { regex: true });
    expect(result.error).toBe("invalid-regex");
  });

  it("returns nothing for an empty query or missing folder", async () => {
    expect((await searchMarkdownInFolder(root, "   ")).hits).toHaveLength(0);
    expect((await searchMarkdownInFolder(join(root, "nope"), "hello")).hits).toHaveLength(0);
  });
});
