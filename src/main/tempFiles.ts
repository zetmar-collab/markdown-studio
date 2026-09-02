import { app } from "electron";
import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Temp HTML files used as render targets for PDF export and print preview.
 *
 * The print preview used to write a file per invocation and never delete it,
 * leaving the user's TEMP directory to grow forever. Every file created here is
 * tracked and removed when its window closes or, at the latest, on quit.
 */
const tracked = new Set<string>();
let counter = 0;

export async function writeTempHtml(prefix: string, html: string): Promise<string> {
  counter += 1;
  const path = join(app.getPath("temp"), `${prefix}-${process.pid}-${counter}.html`);
  await writeFile(path, html, "utf8");
  tracked.add(path);
  return path;
}

export async function removeTempFile(path: string): Promise<void> {
  tracked.delete(path);
  try {
    await unlink(path);
  } catch {
    /* already gone */
  }
}

export async function cleanupTempFiles(): Promise<void> {
  await Promise.all([...tracked].map((path) => removeTempFile(path)));
}
