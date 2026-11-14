/**
 * What to tell the user when a save fails.
 *
 * The renderer owns the translations, so the main process only passes the errno
 * along and the sentence is chosen here. An unrecognised code still produces a
 * message — silence is the thing we are fixing.
 */
import type { TranslationKey } from "./i18n.js";

const BY_CODE: Record<string, TranslationKey> = {
  EACCES: "status.saveFailedAccess",
  EPERM: "status.saveFailedAccess",
  EROFS: "status.saveFailedReadOnly",
  EBUSY: "status.saveFailedBusy",
  ENOSPC: "status.saveFailedNoSpace",
  ENOENT: "status.saveFailedMissingFolder",
  EISDIR: "status.saveFailedIsFolder",
  ENAMETOOLONG: "status.saveFailedNameTooLong"
};

export function describeSaveFailure(code: string | null): TranslationKey {
  if (!code) return "status.saveFailed";
  return BY_CODE[code] ?? "status.saveFailed";
}

/** Last path segment, for messages. The renderer has no `node:path`. */
export function fileNameOf(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? filePath;
}
