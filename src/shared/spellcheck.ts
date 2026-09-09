/**
 * Spell-checker language handling shared by the main process and the settings UI.
 *
 * Chromium exposes its own list of dictionary codes (57 of them) and silently
 * ignores anything outside it, so a stale or hand-written code would look
 * accepted while doing nothing. Everything is filtered against the real list.
 */

/** Codes that earlier versions stored but Chromium does not actually offer. */
const LEGACY_ALIASES: Record<string, string> = {
  "pl-PL": "pl",
  "cs-CZ": "cs",
  "nl-NL": "nl",
  "ru-RU": "ru",
  "sv-SE": "sv",
  "uk-UA": "uk",
  "tr-TR": "tr"
};

/**
 * Map a stored code onto one Chromium accepts.
 *
 * Falls back to the bare language subtag ("de-AT" -> "de") when the exact
 * region is unavailable, which is how a user picking a regional variant still
 * ends up with a working dictionary.
 */
export function resolveLanguage(code: string, available: readonly string[]): string | null {
  if (available.includes(code)) return code;

  const alias = LEGACY_ALIASES[code];
  if (alias && available.includes(alias)) return alias;

  const base = code.split("-")[0];
  if (base && available.includes(base)) return base;

  return null;
}

/**
 * Filter a requested list down to codes Chromium can actually load, keeping the
 * user's order and dropping duplicates introduced by aliasing.
 */
export function normalizeSpellcheckLanguages(
  requested: readonly string[],
  available: readonly string[]
): string[] {
  const result: string[] = [];
  for (const code of requested) {
    const resolved = resolveLanguage(code, available);
    if (resolved && !result.includes(resolved)) result.push(resolved);
  }
  return result;
}

/**
 * Human-readable language name in the interface language, e.g. "polski",
 * "angielski (Stany Zjednoczone)". Falls back to the raw code where the
 * platform has no name for it.
 */
export function languageDisplayName(code: string, uiLanguage: string): string {
  try {
    const names = new Intl.DisplayNames([uiLanguage], { type: "language" });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Sort codes by their displayed name so the picker reads alphabetically. */
export function sortByDisplayName(codes: readonly string[], uiLanguage: string): string[] {
  return [...codes].sort((a, b) =>
    languageDisplayName(a, uiLanguage).localeCompare(languageDisplayName(b, uiLanguage), uiLanguage)
  );
}

/** Does `code` match a free-text filter, by code or by displayed name? */
export function matchesLanguageQuery(code: string, query: string, uiLanguage: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    code.toLowerCase().includes(needle) ||
    languageDisplayName(code, uiLanguage).toLowerCase().includes(needle)
  );
}
