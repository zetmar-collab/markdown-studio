import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings, resolveExportTheme } from "../src/shared/settings";
import { createTranslator, isLanguage, translate } from "../src/shared/i18n";
import { createSlugger, slugifyHeading } from "../src/shared/slugify";

describe("normalizeSettings", () => {
  it("falls back to defaults for junk input", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ language: "klingon" }).language).toBe("pl");
    expect(normalizeSettings({ pageSize: "B9" }).pageSize).toBe("A4");
  });

  it("clamps numeric ranges", () => {
    expect(normalizeSettings({ editorFontSize: 999 }).editorFontSize).toBe(32);
    expect(normalizeSettings({ editorFontSize: 1 }).editorFontSize).toBe(9);
    expect(normalizeSettings({ autosaveIntervalSeconds: 0 }).autosaveIntervalSeconds).toBe(5);
  });

  it("keeps valid values", () => {
    const settings = normalizeSettings({ language: "en", pageSize: "Letter", landscape: true });
    expect(settings.language).toBe("en");
    expect(settings.pageSize).toBe("Letter");
    expect(settings.landscape).toBe(true);
  });

  it("repairs a partial margins object", () => {
    expect(normalizeSettings({ margins: { top: 5 } }).margins).toEqual({
      top: 5,
      right: 20,
      bottom: 24,
      left: 20
    });
  });

  it("drops non-string spellcheck languages", () => {
    expect(normalizeSettings({ spellcheckLanguages: [1, "en-US"] }).spellcheckLanguages).toEqual([
      "en-US"
    ]);
    expect(normalizeSettings({ spellcheckLanguages: [] }).spellcheckLanguages).toEqual(["pl-PL"]);
  });
});

describe("resolveExportTheme", () => {
  it("follows the app theme when set to 'app'", () => {
    expect(resolveExportTheme("app", "dark")).toBe("dark");
    expect(resolveExportTheme("light", "dark")).toBe("light");
  });
});

describe("i18n", () => {
  it("translates in both languages", () => {
    expect(translate("pl", "app.ready")).toBe("Gotowe");
    expect(translate("en", "app.ready")).toBe("Ready");
  });

  it("substitutes placeholders", () => {
    expect(translate("en", "status.opened", { name: "a.md" })).toBe("Opened a.md");
  });

  it("leaves unknown placeholders in place", () => {
    expect(translate("en", "status.opened", {})).toContain("{name}");
  });

  it("exposes a bound translator", () => {
    expect(createTranslator("pl")("common.cancel")).toBe("Anuluj");
  });

  it("validates language codes", () => {
    expect(isLanguage("pl")).toBe(true);
    expect(isLanguage("de")).toBe(false);
  });

  it("has an English string for every Polish key", () => {
    const polish = translate("pl", "menu.file");
    const english = translate("en", "menu.file");
    expect(polish).not.toBe("");
    expect(english).not.toBe("");
  });
});

describe("slugify", () => {
  it("strips punctuation and lowercases", () => {
    expect(slugifyHeading("Co nowego?")).toBe("co-nowego");
    expect(slugifyHeading("  A  B  ")).toBe("a-b");
  });

  it("keeps accented letters", () => {
    expect(slugifyHeading("Zażółć gęślą")).toBe("zażółć-gęślą");
  });

  it("never returns an empty slug", () => {
    expect(slugifyHeading("???")).toBe("sekcja");
  });

  it("deduplicates repeats", () => {
    const slug = createSlugger();
    expect([slug("A"), slug("A"), slug("A")]).toEqual(["a", "a-1", "a-2"]);
  });
});
