import { describe, expect, it } from "vitest";
import {
  DICTIONARY_VERSIONS,
  dictionaryFileCandidates,
  isDictionaryFor,
  localeCandidates
} from "../src/shared/dictionaryNames";

describe("localeCandidates", () => {
  it("puts the real locale first for a bare language code", () => {
    // The dictionary for "pl" is pl-PL-3-0.bdic, not pl-3-0.bdic.
    expect(localeCandidates("pl")[0]).toBe("pl-PL");
  });

  it("uses the hint where the region is not the language in upper case", () => {
    expect(localeCandidates("cs")[0]).toBe("cs-CZ");
    expect(localeCandidates("sv")[0]).toBe("sv-SE");
    expect(localeCandidates("uk")[0]).toBe("uk-UA");
  });

  it("keeps a code that already carries a region", () => {
    expect(localeCandidates("en-US")).toContain("en-US");
    expect(localeCandidates("pt-BR")[0]).toBe("pt-BR");
  });

  it("falls back to the base language for a regional variant", () => {
    // "de-AT" has no dictionary of its own; de-DE is the one that exists.
    expect(localeCandidates("de-AT")).toContain("de-DE");
  });

  it("never repeats a candidate", () => {
    const candidates = localeCandidates("en-US");
    expect(new Set(candidates).size).toBe(candidates.length);
  });
});

describe("dictionaryFileCandidates", () => {
  it("starts with the file that actually exists for Polish", () => {
    expect(dictionaryFileCandidates("pl")[0]).toBe("pl-PL-3-0.bdic");
  });

  it("offers every version for every locale", () => {
    const files = dictionaryFileCandidates("pl");
    expect(files.length).toBe(localeCandidates("pl").length * DICTIONARY_VERSIONS.length);
    expect(files).toContain("pl-PL-10-1.bdic");
  });
});

describe("isDictionaryFor", () => {
  it("recognises the file Chromium downloads", () => {
    expect(isDictionaryFor("pl", "pl-PL-3-0.bdic")).toBe(true);
    expect(isDictionaryFor("en-US", "en-US-10-1.bdic")).toBe(true);
  });

  it("does not mistake another language for this one", () => {
    expect(isDictionaryFor("pl", "en-US-10-1.bdic")).toBe(false);
    // "pt" must not match "pt-BR" only by accident of a shared prefix.
    expect(isDictionaryFor("en-GB", "en-US-10-1.bdic")).toBe(false);
  });

  it("ignores anything that is not a dictionary", () => {
    expect(isDictionaryFor("pl", "pl-PL-3-0.bdic.download")).toBe(false);
    expect(isDictionaryFor("pl", "readme.txt")).toBe(false);
  });
});
