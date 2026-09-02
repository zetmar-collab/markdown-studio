import { DEFAULT_SETTINGS, normalizeSettings, type AppSettings } from "../shared/settings.js";
import { readJsonFile, writeJsonFile } from "./jsonStore.js";

const FILE = "settings.json";

let current: AppSettings = DEFAULT_SETTINGS;
let loaded = false;

const listeners = new Set<(settings: AppSettings) => void>();

export async function loadSettings(): Promise<AppSettings> {
  if (loaded) return current;
  current = normalizeSettings(await readJsonFile<unknown>(FILE, DEFAULT_SETTINGS));
  loaded = true;
  return current;
}

/** Synchronous accessor for code paths that run after `loadSettings()`. */
export function getSettings(): AppSettings {
  return current;
}

export async function updateSettings(patch: unknown): Promise<AppSettings> {
  const merged = normalizeSettings({ ...current, ...(patch as Partial<AppSettings>) });
  current = merged;
  loaded = true;
  await writeJsonFile(FILE, merged);
  for (const listener of listeners) listener(merged);
  return merged;
}

export async function resetSettings(): Promise<AppSettings> {
  return updateSettings(DEFAULT_SETTINGS);
}

export function onSettingsChanged(listener: (settings: AppSettings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
