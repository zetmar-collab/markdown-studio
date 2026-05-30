import { describe, expect, it } from "vitest";
import { generateTable } from "../src/renderer/utils/tableMarkdown";

describe("generateTable", () => {
  it("builds markdown table with header and rows", () => {
    const table = generateTable(2, 1, "left");
    expect(table).toContain("Kolumna 1");
    expect(table).toContain("Kolumna 2");
    expect(table.trim().split("\n").length).toBeGreaterThanOrEqual(3);
  });
});
