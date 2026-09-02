import { readdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

const MD_EXT = new Set([".md", ".markdown", ".mdown", ".mkd"]);
const IGNORED_DIRS = new Set(["node_modules", "dist", "dist-electron", "release", "out", ".git"]);
const MAX_ENTRIES = 400;

export interface FileTreeEntry {
  path: string;
  name: string;
  isDirectory: boolean;
}

/**
 * One directory level at a time — the sidebar expands lazily, so there is no
 * reason to walk a whole tree (and no risk of hanging on a huge folder).
 */
export async function listFolder(folderPath: string): Promise<FileTreeEntry[]> {
  const root = resolve(folderPath);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const result: FileTreeEntry[] = [];
  for (const entry of entries) {
    if (result.length >= MAX_ENTRIES) break;
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      result.push({ path: join(root, entry.name), name: entry.name, isDirectory: true });
    } else if (entry.isFile() && MD_EXT.has(extname(entry.name).toLowerCase())) {
      result.push({ path: join(root, entry.name), name: basename(entry.name), isDirectory: false });
    }
  }

  result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return result;
}
