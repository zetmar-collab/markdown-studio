/**
 * Templates the user keeps.
 *
 * The four built-in templates cover a meeting note and an article; everybody
 * else writes something else. A user template is just a Markdown file in
 * `userData/templates`, so it can be edited, copied between machines or put in
 * a synced folder without this app being involved.
 */
import { app, shell } from "electron";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface UserTemplate {
  /** File name on disk, used as the identifier. */
  fileName: string;
  /** What the menu shows. */
  name: string;
}

const EXTENSION = ".md";
const MAX_NAME = 60;
const MAX_TEMPLATES = 50;

export function templatesDir(): string {
  return join(app.getPath("userData"), "templates");
}

/**
 * A file name Windows will accept, derived from what the user typed.
 *
 * Reserved device names are the trap here: a template called "con" would
 * produce a path Windows refuses to create, and the save would fail with an
 * error nobody could explain.
 */
export function templateFileName(name: string): string | null {
  const cleaned = name
    .trim()
    // eslint-disable-next-line no-control-regex -- characters Windows forbids in file names
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    // A run of dots is what a traversal attempt looks like once the separators
    // are gone; collapsing it keeps the name readable by resolveInsideTemplates.
    .replace(/\.{2,}/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-. ]+/, "")
    .replace(/[-. ]+$/, "")
    .slice(0, MAX_NAME);
  if (!cleaned) return null;
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(cleaned)) return `${cleaned}-szablon${EXTENSION}`;
  return `${cleaned}${EXTENSION}`;
}

export async function listTemplates(): Promise<UserTemplate[]> {
  let names: string[];
  try {
    names = await readdir(templatesDir());
  } catch {
    return [];
  }
  return names
    .filter((name) => name.toLowerCase().endsWith(EXTENSION))
    .slice(0, MAX_TEMPLATES)
    .map((fileName) => ({ fileName, name: fileName.slice(0, -EXTENSION.length) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Never let a crafted name read outside the templates folder. */
function resolveInsideTemplates(fileName: string): string | null {
  if (!fileName || fileName.includes("/") || fileName.includes("\\")) return null;
  if (!fileName.toLowerCase().endsWith(EXTENSION)) return null;
  if (fileName.includes("..")) return null;
  return join(templatesDir(), fileName);
}

export async function readTemplate(fileName: string): Promise<string | null> {
  const path = resolveInsideTemplates(fileName);
  if (!path) return null;
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

export async function saveTemplate(name: string, content: string): Promise<UserTemplate | null> {
  const fileName = templateFileName(name);
  if (!fileName) return null;
  const path = resolveInsideTemplates(fileName);
  if (!path) return null;
  try {
    await mkdir(templatesDir(), { recursive: true });
    await writeFile(path, content, "utf8");
    return { fileName, name: fileName.slice(0, -EXTENSION.length) };
  } catch {
    return null;
  }
}

export async function deleteTemplate(fileName: string): Promise<boolean> {
  const path = resolveInsideTemplates(fileName);
  if (!path) return false;
  try {
    await rm(path, { force: true });
    return true;
  } catch {
    return false;
  }
}

/** Show the folder so templates can be edited or copied like any other files. */
export async function openTemplatesFolder(): Promise<void> {
  const dir = templatesDir();
  try {
    await mkdir(dir, { recursive: true });
    await shell.openPath(dir);
  } catch {
    /* nothing to show */
  }
}
