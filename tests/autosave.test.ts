import { describe, expect, it } from "vitest";
import { savedContentIsCurrent, tabsNeedingAutosave } from "../src/shared/autosave";

const tab = (over: Partial<{ id: string; dirty: boolean; filePath: string | null }> = {}) => ({
  id: "1",
  dirty: true,
  filePath: "C:/a.md",
  ...over
});

describe("tabsNeedingAutosave", () => {
  it("takes only changed tabs that have a file", () => {
    const tabs = [
      tab({ id: "zmieniona" }),
      tab({ id: "czysta", dirty: false }),
      tab({ id: "bez-pliku", filePath: null })
    ];
    expect(tabsNeedingAutosave(tabs).map((entry) => entry.id)).toEqual(["zmieniona"]);
  });

  it("returns an empty list rather than throwing on no tabs", () => {
    expect(tabsNeedingAutosave([])).toEqual([]);
  });
});

describe("savedContentIsCurrent", () => {
  it("allows clearing the marker when nothing changed during the write", () => {
    expect(savedContentIsCurrent("tekst", "tekst")).toBe(true);
  });

  it("refuses when the user typed while the write was in flight", () => {
    // The whole point: those characters never reached the disk, so the tab has
    // to stay dirty or the next pass skips it and the edits are lost.
    expect(savedContentIsCurrent("tekst", "tekst i jeszcze coś")).toBe(false);
  });

  it("refuses when the tab is gone", () => {
    expect(savedContentIsCurrent("tekst", undefined)).toBe(false);
  });

  it("treats an emptied document as a real change", () => {
    expect(savedContentIsCurrent("tekst", "")).toBe(false);
    expect(savedContentIsCurrent("", "")).toBe(true);
  });
});
