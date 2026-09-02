import { readdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const MD_EXT = new Set([".md", ".markdown", ".mdown", ".mkd"]);
const MAX_FILES = 500;
const MAX_RESULTS = 150;

export interface SearchHit {
  filePath: string;
  fileName: string;
  line: number;
  column: number;
  snippet: string;
}

export interface SearchOptions {
  regex?: boolean;
  caseSensitive?: boolean;
}

export interface SearchResult {
  hits: SearchHit[];
  scannedFiles: number;
  truncated: boolean;
  error?: string;
}

async function walkMarkdownFiles(dir: string, files: string[], depth: number): Promise<void> {
  if (files.length >= MAX_FILES || depth > 12) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (files.length >= MAX_FILES) break;
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", "dist-electron", "release", "out", ".git"].includes(entry.name))
        continue;
      await walkMarkdownFiles(full, files, depth + 1);
    } else if (entry.isFile() && MD_EXT.has(extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build the matcher for one query. Returns null when the user typed an invalid
 * regular expression, so the caller can report it instead of throwing across IPC.
 */
export function buildSearchPattern(query: string, options: SearchOptions = {}): RegExp | null {
  const flags = options.caseSensitive ? "g" : "gi";
  const source = options.regex ? query : escapeRegExp(query);
  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

/** First match of `pattern` in `line`, as a zero-based column, or -1. */
export function matchColumn(pattern: RegExp, line: string): number {
  pattern.lastIndex = 0;
  const match = pattern.exec(line);
  // A zero-width regex would otherwise report a hit on every line.
  if (!match || match[0].length === 0) return -1;
  return match.index;
}

export async function searchMarkdownInFolder(
  folderPath: string,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const q = query.trim();
  if (!q) return { hits: [], scannedFiles: 0, truncated: false };

  const pattern = buildSearchPattern(q, options);
  if (!pattern) return { hits: [], scannedFiles: 0, truncated: false, error: "invalid-regex" };

  const root = resolve(folderPath);
  const files: string[] = [];
  await walkMarkdownFiles(root, files, 0);
  const truncated = files.length >= MAX_FILES;

  const hits: SearchHit[] = [];

  for (const filePath of files) {
    if (hits.length >= MAX_RESULTS) break;
    let text: string;
    try {
      text = await readFile(filePath, "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (hits.length >= MAX_RESULTS) break;
      const line = lines[i];
      const col = matchColumn(pattern, line);
      if (col < 0) continue;
      const start = Math.max(0, col - 40);
      const snippet = line.slice(start, start + 120).trim();
      hits.push({
        filePath,
        fileName: filePath.split(/[\\/]/).pop() ?? filePath,
        line: i + 1,
        column: col + 1,
        snippet
      });
    }
  }

  return { hits, scannedFiles: files.length, truncated };
}
