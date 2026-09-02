/**
 * Validation for the persisted tab session.
 *
 * Kept free of Electron imports so it can be unit tested, and applied on both
 * read and write: a corrupted session file must never be able to crash startup.
 */

export interface SavedTab {
  filePath: string | null;
  fileName: string;
  content?: string;
}

export interface SavedSession {
  activeIndex: number;
  tabs: SavedTab[];
}

/** Cap on the inline content of unsaved tabs, across the whole session. */
export const MAX_INLINE_CONTENT = 2 * 1024 * 1024;

export const EMPTY_SESSION: SavedSession = { activeIndex: 0, tabs: [] };

export function sanitizeSession(input: unknown): SavedSession {
  const raw = (input ?? {}) as Partial<SavedSession>;
  if (!Array.isArray(raw.tabs)) return EMPTY_SESSION;

  let budget = MAX_INLINE_CONTENT;
  const tabs: SavedTab[] = [];
  for (const entry of raw.tabs) {
    if (!entry || typeof entry !== "object") continue;
    const tab = entry as Partial<SavedTab>;
    const filePath = typeof tab.filePath === "string" && tab.filePath ? tab.filePath : null;
    const fileName =
      typeof tab.fileName === "string" && tab.fileName ? tab.fileName : "bez-nazwy.md";

    if (filePath) {
      tabs.push({ filePath, fileName });
      continue;
    }

    // Unsaved tab: keep its text only while there is budget left, so one huge
    // document cannot make the session file unbounded.
    const content = typeof tab.content === "string" ? tab.content : "";
    if (content.length <= budget) {
      budget -= content.length;
      tabs.push({ filePath: null, fileName, content });
    } else {
      tabs.push({ filePath: null, fileName, content: "" });
    }
  }

  const activeIndex =
    typeof raw.activeIndex === "number" && Number.isFinite(raw.activeIndex)
      ? Math.min(Math.max(0, Math.trunc(raw.activeIndex)), Math.max(0, tabs.length - 1))
      : 0;

  return { activeIndex, tabs };
}

export const MAX_RECENT_FILES = 10;

export function sanitizeRecentFiles(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    .slice(0, MAX_RECENT_FILES);
}
