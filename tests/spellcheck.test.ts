import { describe, expect, it } from "vitest";
import {
  languageDisplayName,
  matchesLanguageQuery,
  normalizeSpellcheckLanguages,
  resolveLanguage,
  sortByDisplayName
} from "../src/shared/spellcheck";

/** A trimmed copy of what Chromium actually reports. */
const AVAILABLE = ["cs", "de", "de-DE", "en", "en-GB", "en-US", "es", "fr", "pl", "pt-BR"];

describe("resolveLanguage", () => {
  it("keeps a code Chromium offers", () => {
    expect(resolveLanguage("en-US", AVAILABLE)).toBe("en-US");
  });

  it("maps a legacy code stored by earlier versions", () => {
    // Chromium has no "pl-PL" — only "pl" — so the old default must be mapped.
    expect(resolveLanguage("pl-PL", AVAILABLE)).toBe("pl");
  });

  it("falls back to the base language when the region is unavailable", () => {
    expect(resolveLanguage("de-AT", AVAILABLE)).toBe("de");
    expect(resolveLanguage("fr-CA", AVAILABLE)).toBe("fr");
  });

  it("returns null for a language with no dictionary", () => {
    expect(resolveLanguage("klingon", AVAILABLE)).toBeNull();
    expect(resolveLanguage("ja", AVAILABLE)).toBeNull();
  });
});

describe("normalizeSpellcheckLanguages", () => {
  it("keeps several languages at once, in the given order", () => {
    expect(normalizeSpellcheckLanguages(["pl", "en-US"], AVAILABLE)).toEqual(["pl", "en-US"]);
  });

  it("drops codes with no dictionary", () => {
    expect(normalizeSpellcheckLanguages(["pl", "ja", "en-US"], AVAILABLE)).toEqual(["pl", "en-US"]);
  });

  it("collapses duplicates created by aliasing", () => {
    expect(normalizeSpellcheckLanguages(["pl-PL", "pl"], AVAILABLE)).toEqual(["pl"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(normalizeSpellcheckLanguages(["ja", "zh"], AVAILABLE)).toEqual([]);
  });
});

describe("languageDisplayName", () => {
  it("names a language in the interface language", () => {
    expect(languageDisplayName("pl", "pl")).toMatch(/polski/i);
    expect(languageDisplayName("de", "en")).toMatch(/german/i);
  });

  it("returns the code instead of throwing on a malformed tag", () => {
    // Intl.DisplayNames raises RangeError for a structurally invalid tag; the
    // picker must survive that rather than blank the whole settings dialog.
    expect(languageDisplayName("not a tag", "en")).toBe("not a tag");
  });

  it("still produces something for an unknown but well-formed tag", () => {
    expect(languageDisplayName("qqq-ZZ", "en")).toBeTruthy();
  });
});

describe("sortByDisplayName", () => {
  it("orders by the displayed name, not the code", () => {
    // In English "German" precedes "Polish" even though "pl" < "de" is false.
    expect(sortByDisplayName(["pl", "de"], "en")).toEqual(["de", "pl"]);
  });

  it("does not mutate the input", () => {
    const input = ["pl", "de"];
    sortByDisplayName(input, "en");
    expect(input).toEqual(["pl", "de"]);
  });
});

describe("matchesLanguageQuery", () => {
  it("matches on the code", () => {
    expect(matchesLanguageQuery("en-GB", "gb", "pl")).toBe(true);
  });

  it("matches on the displayed name", () => {
    expect(matchesLanguageQuery("de", "niemiec", "pl")).toBe(true);
  });

  it("accepts everything for an empty query", () => {
    expect(matchesLanguageQuery("pl", "   ", "pl")).toBe(true);
  });

  it("rejects a non-match", () => {
    expect(matchesLanguageQuery("pl", "zzz", "pl")).toBe(false);
  });
});
