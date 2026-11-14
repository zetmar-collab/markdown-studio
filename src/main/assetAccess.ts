/**
 * What the `md-asset://` scheme is allowed to serve.
 *
 * The scheme exists so the preview can show images next to the document
 * without base64-inlining them on every keystroke. Its handler used to decode
 * whatever path the URL carried and stream it back, which made every file on
 * the machine readable through an `<img src>`. With Markdown rendered with
 * `html: false` that was hard to exploit on its own, but it was one layer away
 * from being the exfiltration half of a bigger problem.
 *
 * Two limits now: the file has to be an image, and it has to live under a
 * folder the user actually opened a document from.
 */
import { resolve, sep } from "node:path";
import { isImagePath } from "../shared/imageTypes.js";

/** Folders of documents opened or saved this session. */
const roots = new Set<string>();

/** Windows paths differ only by case; compare them that way. */
function normalize(path: string): string {
  const resolved = resolve(path);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** Let the preview of a document reach images stored beside it. */
export function allowAssetFolder(folderPath: string): void {
  if (!folderPath) return;
  roots.add(normalize(folderPath));
}

export function clearAssetFolders(): void {
  roots.clear();
}

function isUnderAllowedRoot(path: string): boolean {
  const target = normalize(path);
  for (const root of roots) {
    if (target === root) return true;
    if (target.startsWith(root.endsWith(sep) ? root : root + sep)) return true;
  }
  return false;
}

/**
 * May this path be streamed to the preview?
 *
 * `resolve` collapses `..` before the comparison, so a path that climbs out of
 * an allowed folder is judged by where it actually lands.
 */
export function isAllowedAssetPath(path: string): boolean {
  if (!path) return false;
  if (!isImagePath(path)) return false;
  return isUnderAllowedRoot(path);
}
