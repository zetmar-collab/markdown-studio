import { basename, dirname } from "node:path";

/**
 * Labels for the File > Recent files submenu.
 *
 * Kept apart from the menu template so the fiddly parts — numbering, duplicate
 * names and Electron's mnemonic escaping — can be tested without Electron.
 */
export interface RecentMenuEntry {
  label: string;
  filePath: string;
}

/**
 * "&" marks a mnemonic in a native menu label, so a file called "A & B.md"
 * would render as "A  B.md" with an accidental keyboard shortcut.
 */
export function escapeMenuLabel(value: string): string {
  return value.replace(/&/g, "&&");
}

/**
 * Number the entries and, when two files share a name, append the folder that
 * tells them apart — otherwise the menu shows the same text twice.
 */
export function buildRecentMenuEntries(paths: string[]): RecentMenuEntry[] {
  const names = paths.map((filePath) => basename(filePath));
  const ambiguous = new Set(names.filter((name, index) => names.indexOf(name) !== index));

  return paths.map((filePath, index) => {
    const name = names[index];
    const folder = ambiguous.has(name) ? `  —  ${basename(dirname(filePath))}` : "";
    return {
      label: `${index + 1}  ${escapeMenuLabel(name + folder)}`,
      filePath
    };
  });
}
