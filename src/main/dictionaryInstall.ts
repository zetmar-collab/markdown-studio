/**
 * Installing Hunspell dictionaries for the spell checker.
 *
 * On Windows, Chromium checks most languages with the spell checker built into
 * the system and only downloads its own dictionary for languages Windows has
 * no support for. For Polish it therefore never fetches `pl-PL-3-0.bdic`, and
 * what the user gets depends on the state of their Windows language features —
 * which is how the app could underline a Polish word and then suggest
 * "Keynesian" for "ksiazka". With the Hunspell file present at startup the
 * answer is the right one, every time and offline: "książka", "książką",
 * "książki".
 *
 * So this module puts the file there itself. It does not touch the live spell
 * checker afterwards: re-applying the language list mid-session was measured to
 * leave Chromium checking English only, so the file is picked up on the next
 * start instead.
 */
import { app, net } from "electron";
import { mkdir, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dictionaryFileCandidates, isDictionaryFor } from "../shared/dictionaryNames.js";

/** Where Chromium itself fetches dictionaries from. */
const DOWNLOAD_BASE = "https://redirector.gvt1.com/edgedl/chrome/dict/";

/** Every Hunspell dictionary starts with this magic. */
const BDIC_MAGIC = "BDic";

/** Smaller than this and the response is an error page, not a dictionary. */
const MIN_DICTIONARY_BYTES = 1024;

export type InstallResult =
  | { status: "installed"; file: string }
  | { status: "already"; file: string }
  | { status: "unavailable" }
  | { status: "failed"; error: string };

/** Resolutions are stable for a given Chromium; remember them. */
const resolved = new Map<string, string>();

export function dictionariesDir(): string {
  return join(app.getPath("userData"), "Dictionaries");
}

/** Which `<locale>-<version>.bdic` does this language actually have? */
async function resolveFileName(code: string): Promise<string | null> {
  const cached = resolved.get(code);
  if (cached) return cached;

  for (const file of dictionaryFileCandidates(code)) {
    try {
      const response = await net.fetch(DOWNLOAD_BASE + file, { method: "HEAD" });
      if (response.ok) {
        resolved.set(code, file);
        return file;
      }
    } catch {
      // A hiccup on one candidate must not abort the search.
    }
  }
  return null;
}

/** The dictionary file already on disk for this language, if any. */
export async function installedDictionary(code: string): Promise<string | null> {
  try {
    const entries = await readdir(dictionariesDir());
    return entries.find((name) => isDictionaryFor(code, name)) ?? null;
  } catch {
    return null;
  }
}

export async function installedDictionaries(codes: readonly string[]): Promise<string[]> {
  const found: string[] = [];
  for (const code of codes) {
    if (await installedDictionary(code)) found.push(code);
  }
  return found;
}

/**
 * Download the dictionary for `code` unless it is already there.
 *
 * Writes under a temporary name first: a half-written .bdic is worse than none,
 * because Chromium would load it and then check nothing.
 */
export async function installDictionary(code: string): Promise<InstallResult> {
  const existing = await installedDictionary(code);
  if (existing) return { status: "already", file: existing };

  const file = await resolveFileName(code);
  if (!file) return { status: "unavailable" };

  const directory = dictionariesDir();
  const target = join(directory, file);
  const temporary = `${target}.download`;

  try {
    const response = await net.fetch(DOWNLOAD_BASE + file);
    if (!response.ok) return { status: "failed", error: `HTTP ${response.status}` };

    const bytes = Buffer.from(await response.arrayBuffer());
    if (
      bytes.length < MIN_DICTIONARY_BYTES ||
      bytes.subarray(0, 4).toString("latin1") !== BDIC_MAGIC
    ) {
      return { status: "failed", error: "Pobrany plik nie jest słownikiem." };
    }

    await mkdir(directory, { recursive: true });
    await writeFile(temporary, bytes);
    await rename(temporary, target);
    return { status: "installed", file };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}
