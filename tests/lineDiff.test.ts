import { describe, expect, it } from "vitest";
import { collapseUnchanged, diffLines, type DiffRow } from "../src/shared/lineDiff";

const shape = (rows: readonly DiffRow[]) => rows.map((row) => `${row.kind[0]}:${row.text}`);

describe("diffLines", () => {
  it("reports identical documents as identical", () => {
    const result = diffLines("a\nb\nc", "a\nb\nc");
    expect(result.summary).toEqual({ added: 0, removed: 0, identical: true, approximate: false });
    expect(result.rows.every((row) => row.kind === "equal")).toBe(true);
  });

  it("finds a single changed line between a shared head and tail", () => {
    const result = diffLines("a\nb\nc", "a\nB\nc");
    expect(shape(result.rows)).toEqual(["e:a", "r:b", "a:B", "e:c"]);
    expect(result.summary.added).toBe(1);
    expect(result.summary.removed).toBe(1);
  });

  it("handles a pure insertion", () => {
    const result = diffLines("a\nc", "a\nb\nc");
    expect(shape(result.rows)).toEqual(["e:a", "a:b", "e:c"]);
    expect(result.summary).toMatchObject({ added: 1, removed: 0, identical: false });
  });

  it("handles a pure deletion", () => {
    const result = diffLines("a\nb\nc", "a\nc");
    expect(shape(result.rows)).toEqual(["e:a", "r:b", "e:c"]);
  });

  it("numbers lines on the side each row belongs to", () => {
    const result = diffLines("a\nb\nc", "a\nB\nc");
    const removed = result.rows.find((row) => row.kind === "removed")!;
    const added = result.rows.find((row) => row.kind === "added")!;
    expect(removed).toMatchObject({ oldLine: 2, newLine: null });
    expect(added).toMatchObject({ oldLine: null, newLine: 2 });
    expect(result.rows.at(-1)).toMatchObject({ oldLine: 3, newLine: 3 });
  });

  it("treats an empty document on either side", () => {
    expect(diffLines("", "a\nb").summary).toMatchObject({ added: 2, removed: 0 });
    expect(diffLines("a\nb", "").summary).toMatchObject({ added: 0, removed: 2 });
    expect(diffLines("", "").summary.identical).toBe(true);
  });

  it("does not care about line ending style", () => {
    expect(diffLines("a\r\nb", "a\nb").summary.identical).toBe(true);
  });

  it("recognises a moved block as a removal plus an insertion", () => {
    const result = diffLines("a\nb\nc", "c\na\nb");
    expect(result.summary.identical).toBe(false);
    expect(result.summary.added + result.summary.removed).toBeGreaterThan(0);
  });

  it("falls back to a coarse answer instead of stalling on a huge pair", () => {
    // Past the cap it must still return something usable and say that it is
    // approximate rather than build a 2000x2000 table.
    const before = Array.from({ length: 2000 }, (_, i) => `stare ${i}`).join("\n");
    const after = Array.from({ length: 2000 }, (_, i) => `nowe ${i}`).join("\n");
    const result = diffLines(before, after);
    expect(result.summary.approximate).toBe(true);
    expect(result.summary.added).toBe(2000);
    expect(result.summary.removed).toBe(2000);
  });

  it("stays precise for a big pair that only differs in one line", () => {
    // The shared head and tail are trimmed first, so size alone is not a
    // reason to give up.
    const lines = Array.from({ length: 5000 }, (_, i) => `linia ${i}`);
    const before = lines.join("\n");
    const changed = [...lines];
    changed[2500] = "zmieniona";
    const result = diffLines(before, changed.join("\n"));
    expect(result.summary).toMatchObject({ added: 1, removed: 1, approximate: false });
  });
});

describe("collapseUnchanged", () => {
  it("keeps context around a change and marks the rest as a gap", () => {
    const rows = diffLines(
      Array.from({ length: 30 }, (_, i) => `l${i}`).join("\n"),
      Array.from({ length: 30 }, (_, i) => (i === 15 ? "zmiana" : `l${i}`)).join("\n")
    ).rows;
    const collapsed = collapseUnchanged(rows, 2);
    expect(collapsed.filter((entry) => entry === "gap").length).toBe(2);
    const kept = collapsed.filter((entry): entry is DiffRow => entry !== "gap");
    expect(kept.length).toBeLessThan(rows.length);
    expect(kept.some((row) => row.text === "zmiana")).toBe(true);
  });

  it("returns a single gap for an unchanged document", () => {
    const rows = diffLines("a\nb\nc", "a\nb\nc").rows;
    expect(collapseUnchanged(rows)).toEqual(["gap"]);
  });
});
