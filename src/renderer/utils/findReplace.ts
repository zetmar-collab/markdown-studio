/**
 * Find & replace primitives.
 *
 * The editor previously only did case-insensitive substring search and escaped
 * the query before every replace, so regular expressions were impossible.
 */

export interface FindOptions {
  regex?: boolean;
  caseSensitive?: boolean;
}

export interface FindMatch {
  from: number;
  to: number;
  text: string;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Compile the query, or return null when the user's regex does not parse. */
export function compilePattern(query: string, options: FindOptions = {}): RegExp | null {
  if (!query) return null;
  const flags = options.caseSensitive ? "gm" : "gim";
  try {
    return new RegExp(options.regex ? query : escapeRegExp(query), flags);
  } catch {
    return null;
  }
}

/**
 * First match at or after `from`, wrapping to the start of the document.
 * Zero-width matches are skipped so a pattern like `a*` cannot loop forever.
 */
export function findNextMatch(
  text: string,
  query: string,
  from: number,
  options: FindOptions = {}
): FindMatch | null {
  const pattern = compilePattern(query, options);
  if (!pattern) return null;

  const search = (start: number, limit: number): FindMatch | null => {
    pattern.lastIndex = Math.max(0, start);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index >= limit) return null;
      if (match[0].length === 0) {
        pattern.lastIndex += 1;
        continue;
      }
      return { from: match.index, to: match.index + match[0].length, text: match[0] };
    }
    return null;
  };

  return search(from, text.length) ?? search(0, from);
}

export interface ReplaceAllResult {
  text: string;
  count: number;
}

/** Replace every match. `$1`-style references work when `regex` is enabled. */
export function replaceAllMatches(
  text: string,
  query: string,
  replacement: string,
  options: FindOptions = {}
): ReplaceAllResult | null {
  const pattern = compilePattern(query, options);
  if (!pattern) return null;

  let count = 0;
  // A function replacer is used, so `$` in the replacement is always literal.
  // Capture-group references are expanded by hand, and only in regex mode.
  const result = text.replace(pattern, (...args) => {
    const match = args[0] as string;
    if (match.length === 0) return match;
    count += 1;
    if (!options.regex) return replacement;
    return replacement.replace(/\$(\d+)/g, (whole, group: string) => {
      const value = args[Number(group)];
      return typeof value === "string" ? value : whole;
    });
  });

  return { text: result, count };
}

/** Does `candidate` match `query` exactly (used before replacing a selection)? */
export function matchesExactly(
  candidate: string,
  query: string,
  options: FindOptions = {}
): boolean {
  const pattern = compilePattern(query, options);
  if (!pattern) return false;
  pattern.lastIndex = 0;
  const match = pattern.exec(candidate);
  return Boolean(match && match.index === 0 && match[0].length === candidate.length);
}
