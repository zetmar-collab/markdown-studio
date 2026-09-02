/**
 * Single source of truth for heading slugs.
 *
 * The same function is handed to markdown-it-anchor (so rendered ids match)
 * and used by the outline / editor-jump logic, which previously kept its own
 * divergent implementation and silently failed on punctuation and duplicates.
 */

/** Slug for a single heading text. Mirrors markdown-it-anchor's contract. */
export function slugifyHeading(text: string): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[\u2000-\u206f\u2e00-\u2e7f'"!#$%&()*+,./:;<=>?@[\]^`{|}~]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "sekcja";
}

/**
 * Deduplicating slug factory. markdown-it-anchor appends `-1`, `-2`, … to
 * repeated slugs; anything reproducing ids outside the renderer has to apply
 * the exact same rule or links break on documents with repeated headings.
 */
export function createSlugger() {
  const seen = new Map<string, number>();
  return (text: string): string => {
    const base = slugifyHeading(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}
