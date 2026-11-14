/**
 * Local version history.
 *
 * An editor that autosaves is an editor that can overwrite good text with bad
 * text without anybody noticing, and undo does not survive closing the tab. So
 * every save keeps a copy: `userData/history/<klucz>/<znacznik czasu>.md`,
 * where the key is a hash of the document's path, with its real path recorded
 * in `meta.json` next to the copies.
 *
 * Deliberately local and deliberately bounded. It is a safety net for an
 * accident, not a version control system: identical saves are not duplicated,
 * and old copies fall off the end.
 */
import { app } from "electron";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface HistoryEntry {
  /** Milliseconds since the epoch, and the file name of the copy. */
  id: number;
  savedAt: number;
  bytes: number;
}

const VERSION_SUFFIX = ".md";
const META_FILE = "meta.json";

function historyRoot(): string {
  return join(app.getPath("userData"), "history");
}

/** Paths differ only by case on Windows, so the key has to ignore it there. */
function keyFor(filePath: string): string {
  const normalized = process.platform === "win32" ? filePath.toLowerCase() : filePath;
  return createHash("sha1").update(normalized).digest("hex").slice(0, 16);
}

function folderFor(filePath: string): string {
  return join(historyRoot(), keyFor(filePath));
}

async function readEntries(folder: string): Promise<HistoryEntry[]> {
  let names: string[];
  try {
    names = await readdir(folder);
  } catch {
    return [];
  }
  const entries: HistoryEntry[] = [];
  for (const name of names) {
    if (!name.endsWith(VERSION_SUFFIX)) continue;
    const id = Number(name.slice(0, -VERSION_SUFFIX.length));
    if (!Number.isFinite(id)) continue;
    try {
      const info = await stat(join(folder, name));
      entries.push({ id, savedAt: id, bytes: info.size });
    } catch {
      /* vanished between readdir and stat */
    }
  }
  return entries.sort((a, b) => b.savedAt - a.savedAt);
}

/** Newest first. */
export async function listVersions(filePath: string): Promise<HistoryEntry[]> {
  if (!filePath) return [];
  return readEntries(folderFor(filePath));
}

export async function readVersion(filePath: string, id: number): Promise<string | null> {
  if (!filePath || !Number.isFinite(id)) return null;
  try {
    return await readFile(join(folderFor(filePath), `${id}${VERSION_SUFFIX}`), "utf8");
  } catch {
    return null;
  }
}

export async function clearHistory(filePath: string): Promise<void> {
  if (!filePath) return;
  try {
    await rm(folderFor(filePath), { recursive: true, force: true });
  } catch {
    /* nothing to remove */
  }
}

/**
 * Keep a copy of what was just written.
 *
 * Returns the entry that was created, or null when nothing was kept — because
 * history is off, or because this save is identical to the newest copy, which
 * is the common case with a five-second autosave on an idle document.
 */
export async function recordVersion(
  filePath: string,
  content: string,
  limit: number
): Promise<HistoryEntry | null> {
  if (!filePath || limit <= 0) return null;
  const folder = folderFor(filePath);

  const existing = await readEntries(folder);
  if (existing.length > 0) {
    const newest = await readVersion(filePath, existing[0].id);
    if (newest === content) return null;
  }

  const id = Date.now();
  try {
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, `${id}${VERSION_SUFFIX}`), content, "utf8");
    await writeFile(
      join(folder, META_FILE),
      JSON.stringify({ filePath, updatedAt: id }, null, 2),
      "utf8"
    );
  } catch {
    // History is a convenience; failing to keep a copy must never fail a save.
    return null;
  }

  await prune(folder, existing, limit);
  return { id, savedAt: id, bytes: Buffer.byteLength(content, "utf8") };
}

/** Drop the oldest copies beyond the limit, counting the one just written. */
async function prune(folder: string, before: HistoryEntry[], limit: number): Promise<void> {
  const total = before.length + 1;
  if (total <= limit) return;
  const doomed = before.slice(limit - 1);
  for (const entry of doomed) {
    try {
      await rm(join(folder, `${entry.id}${VERSION_SUFFIX}`), { force: true });
    } catch {
      /* already gone */
    }
  }
}
