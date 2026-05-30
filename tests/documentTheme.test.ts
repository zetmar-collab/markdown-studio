import { describe, expect, it } from "vitest";
import { getDocumentColors, buildDocumentCss } from "../src/shared/documentTheme";

describe("documentTheme", () => {
  it("uses same preview bg in dark theme", () => {
    expect(getDocumentColors("dark").bg).toBe("#141720");
  });

  it("builds export css with task list rules", () => {
    expect(buildDocumentCss("light", true)).toContain("contains-task-list");
  });
});
