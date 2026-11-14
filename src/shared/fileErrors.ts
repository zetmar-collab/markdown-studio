/**
 * Turning a failed file operation into something a person can act on.
 *
 * Node reports "EACCES: permission denied, open 'C:\\...'" — true, but it does
 * not tell the user that the file is read-only and that saving elsewhere will
 * work. The main process passes the code along and the renderer, which owns the
 * translations, turns it into a sentence.
 */

/** Codes we have a written explanation for. */
export const KNOWN_FILE_ERRORS = [
  "EACCES",
  "EPERM",
  "EROFS",
  "EBUSY",
  "ENOSPC",
  "ENOENT",
  "EISDIR",
  "ENAMETOOLONG"
] as const;

export type FileErrorCode = (typeof KNOWN_FILE_ERRORS)[number];

export function fileErrorCode(error: unknown): FileErrorCode | null {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return KNOWN_FILE_ERRORS.includes(code as FileErrorCode) ? (code as FileErrorCode) : null;
}

export function fileErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
