/**
 * What the `md-asset://` scheme and the exports are allowed to read.
 *
 * The scheme exists so the preview can show images next to the document
 * without base64-inlining them on every keystroke. Its handler used to decode
 * whatever path the URL carried and stream it back, which made every file on
 * the machine readable through an `<img src>`, and the export path did the
 * same thing while turning the file into base64 inside the produced PDF.
 *
 * Three limits now: the file has to be an image, it has to live under a folder
 * the user actually opened a document from, and it is judged by where it
 * really is — a symbolic link that leaves the folder leaves the permission
 * behind too. A repository of Markdown files can carry symlinks, so a lexical
 * check alone would be a hole with a plausible way in.
 */
import { realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { isImagePath } from "../shared/imageTypes.js";

/** Real paths of folders documents were opened or saved from. */
const roots = new Set<string>();

/** Windows paths differ only by case; compare them that way. */
function normalize(path: string): string {
  const resolved = resolve(path);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/**
 * The path with every link followed.
 *
 * Falls back to the lexical form when the target does not exist — nothing can
 * be read from it anyway, and the caller still gets a definite answer.
 */
async function realOrLexical(path: string): Promise<string> {
  try {
    return normalize(await realpath(path));
  } catch {
    return normalize(path);
  }
}

/** Let the preview and the exports reach images stored beside a document. */
export async function allowAssetFolder(folderPath: string): Promise<void> {
  if (!folderPath) return;
  // Both spellings are kept. The lexical form is what a document's own paths
  // look like and is what the cheap first check compares against; the real
  // form is what the second check sees once links are followed. A folder
  // reached through a junction, a `subst` drive or a Windows 8.3 short name
  // (`RUNNER~1`) has two different spellings, and registering only one of them
  // rejected the document's own images at the first check — which is how CI
  // caught it.
  roots.add(normalize(folderPath));
  roots.add(await realOrLexical(folderPath));
}

export function clearAssetFolders(): void {
  roots.clear();
}

function isUnderAllowedRoot(realPath: string): boolean {
  for (const root of roots) {
    if (realPath === root) return true;
    if (realPath.startsWith(root.endsWith(sep) ? root : root + sep)) return true;
  }
  return false;
}

/**
 * May this path be read on behalf of a document?
 *
 * The order of the two checks is the point. Resolving links first would mean
 * touching the filesystem for a path the document chose and we have not
 * approved — and on Windows `\\serwer\udzial\x.png` is a path the operating
 * system reaches over the network, handing an SMB host an authentication
 * attempt. So the cheap lexical judgement comes first and an unapproved path
 * never reaches `realpath`; only then are links resolved, to catch a symlink
 * that leaves the folder, and the result is judged again.
 */
export async function isAllowedAssetPath(path: string): Promise<boolean> {
  if (!path) return false;
  if (!isImagePath(path)) return false;
  if (!isUnderAllowedRoot(normalize(path))) return false;
  return isUnderAllowedRoot(await realOrLexical(path));
}
