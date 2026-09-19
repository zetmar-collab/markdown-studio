/**
 * Naming of Chromium's Hunspell dictionary files.
 *
 * The files are named by locale and version — the dictionary for the language
 * code "pl" is `pl-PL-3-0.bdic` — and Chromium keeps that mapping to itself.
 * Rather than copy a table that would quietly rot, the installer tries the
 * candidates below against the download server and uses whichever exists.
 */

/**
 * Locales that are not simply the language code in upper case. A hint that
 * saves a request or two; anything missing is still found by probing.
 */
const LOCALE_HINTS: Record<string, string> = {
  bn: "bn-IN",
  cs: "cs-CZ",
  cy: "cy-GB",
  da: "da-DK",
  el: "el-GR",
  et: "et-EE",
  fa: "fa-IR",
  he: "he-IL",
  hi: "hi-IN",
  hy: "hy",
  ko: "ko",
  nb: "nb-NO",
  sh: "sh",
  sq: "sq-AL",
  sr: "sr",
  sv: "sv-SE",
  ta: "ta-IN",
  te: "te-IN",
  uk: "uk-UA",
  vi: "vi-VN"
};

/**
 * Dictionary versions bump per language. Most are "3-0"; the others are found
 * by trying, so the order here is "most likely first", not chronological.
 */
export const DICTIONARY_VERSIONS = [
  "3-0",
  "4-0",
  "5-0",
  "2-0",
  "1-0",
  "10-1",
  "10-0",
  "9-0",
  "8-0",
  "7-0",
  "6-0",
  "11-0",
  "3-1",
  "4-1"
] as const;

/** Locale names to try for a language code, best guess first. */
export function localeCandidates(code: string): string[] {
  const candidates = new Set<string>();
  const hint = LOCALE_HINTS[code];
  if (hint) candidates.add(hint);
  if (code.includes("-")) candidates.add(code);
  else candidates.add(`${code}-${code.toUpperCase()}`);
  candidates.add(code);
  // A regional variant such as "de-AT" has no dictionary of its own; the base
  // language does.
  const base = code.split("-")[0];
  if (base && base !== code) {
    candidates.add(`${base}-${base.toUpperCase()}`);
    candidates.add(base);
  }
  return [...candidates];
}

/** Every `<locale>-<version>.bdic` worth trying for a language code. */
export function dictionaryFileCandidates(code: string): string[] {
  const files: string[] = [];
  for (const locale of localeCandidates(code)) {
    for (const version of DICTIONARY_VERSIONS) files.push(`${locale}-${version}.bdic`);
  }
  return files;
}

/**
 * Does `fileName` look like a dictionary belonging to this language code?
 *
 * The locale has to be followed by the version, not by another subtag — a bare
 * "en" prefix would otherwise claim `en-US-10-1.bdic` as the dictionary for
 * "en-GB", which is a different dictionary.
 */
export function isDictionaryFor(code: string, fileName: string): boolean {
  const locale = localeOfDictionaryFile(fileName);
  return locale !== null && localeCandidates(code).includes(locale);
}

/** "pl-PL-3-0.bdic" -> "pl-PL"; anything else -> null. */
function localeOfDictionaryFile(fileName: string): string | null {
  if (!fileName.endsWith(".bdic")) return null;
  const parts = fileName.slice(0, -".bdic".length).split("-");
  if (parts.length < 3) return null;
  const version = parts.slice(-2);
  if (!version.every((part) => part.length > 0 && /^\d+$/.test(part))) return null;
  return parts.slice(0, -2).join("-");
}
