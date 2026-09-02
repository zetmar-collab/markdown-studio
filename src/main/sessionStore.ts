import {
  EMPTY_SESSION,
  sanitizeRecentFiles,
  sanitizeSession,
  type SavedSession
} from "../shared/sessionSchema.js";
import { readJsonFile, writeJsonFile } from "./jsonStore.js";

export type { SavedSession, SavedTab } from "../shared/sessionSchema.js";

const FILE = "session.json";
const RECENT_FILE = "recent.json";

export async function readSession(): Promise<SavedSession> {
  return sanitizeSession(await readJsonFile<unknown>(FILE, EMPTY_SESSION));
}

export async function writeSession(session: unknown): Promise<boolean> {
  return writeJsonFile(FILE, sanitizeSession(session));
}

export async function readRecentFiles(): Promise<string[]> {
  return sanitizeRecentFiles(await readJsonFile<unknown>(RECENT_FILE, []));
}

export async function writeRecentFiles(paths: unknown): Promise<string[]> {
  const list = sanitizeRecentFiles(paths);
  await writeJsonFile(RECENT_FILE, list);
  return list;
}
