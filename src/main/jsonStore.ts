import { app } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Small atomic JSON file store in userData.
 *
 * Settings and the tab session used to live in the renderer's localStorage,
 * where a large document could blow the quota and take the whole render down,
 * and where the main process could not read them at startup.
 */
export function storePath(fileName: string): string {
  return join(app.getPath("userData"), fileName);
}

export async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(storePath(fileName), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Write via a temp file + rename so a crash mid-write cannot leave a truncated
 * settings/session file behind.
 */
export async function writeJsonFile(fileName: string, value: unknown): Promise<boolean> {
  const target = storePath(fileName);
  const temp = `${target}.tmp`;
  try {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(temp, JSON.stringify(value, null, 2), "utf8");
    await rename(temp, target);
    return true;
  } catch {
    return false;
  }
}
