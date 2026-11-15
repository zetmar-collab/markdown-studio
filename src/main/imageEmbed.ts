import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fromAssetUrl } from "../shared/assetProtocol.js";
import { imageMimeFor } from "../shared/imageTypes.js";
import { isAllowedAssetPath } from "./assetAccess.js";

interface CacheEntry {
  mtimeMs: number;
  size: number;
  dataUrl: string;
}

/**
 * Base64 encoding an image is expensive and the same images are re-embedded on
 * every export and every clipboard copy. Cache by path, invalidated on mtime or
 * size change.
 */
const cache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 64;
/** Skip caching very large images so the cache cannot pin hundreds of MB. */
const MAX_CACHED_BYTES = 8 * 1024 * 1024;

export function clearImageCache(): void {
  cache.clear();
}

function rememberInCache(key: string, entry: CacheEntry) {
  if (entry.size > MAX_CACHED_BYTES) return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, entry);
}

async function toDataUrl(localPath: string): Promise<string | null> {
  let info;
  try {
    info = await stat(localPath);
  } catch {
    return null;
  }
  if (!info.isFile()) return null;

  const cached = cache.get(localPath);
  if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
    return cached.dataUrl;
  }

  try {
    const mime = imageMimeFor(localPath);
    // Falling back to image/png for an unknown extension meant any file at all
    // was read and base64-inlined into the export.
    if (!mime) return null;
    const data = await readFile(localPath);
    const dataUrl = `data:${mime};base64,${data.toString("base64")}`;
    rememberInCache(localPath, { mtimeMs: info.mtimeMs, size: info.size, dataUrl });
    return dataUrl;
  } catch {
    return null;
  }
}

/** Resolve an `<img src>` value to a local filesystem path, or null. */
export function resolveLocalImagePath(src: string, docFilePath?: string | null): string | null {
  // The live preview serves local images through the asset scheme; exports have
  // to turn those back into real paths before inlining them.
  const asset = fromAssetUrl(src);
  if (asset) return asset;

  if (src.startsWith("file:///")) {
    // Windows: file:///C:/path -> C:/path
    return decodeURIComponent(src.slice(8));
  }
  if (src.startsWith("file://")) {
    return decodeURIComponent(src.slice(7));
  }
  if (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:") ||
    src.startsWith("blob:")
  ) {
    return null;
  }
  if (!docFilePath) return null;
  return resolve(dirname(docFilePath), src);
}

const IMG_SRC_RE = /(<img\b[^>]*?\bsrc=")([^"]+)(")/gi;

/**
 * Replaces file:// URLs and relative image src attributes with base64 data URIs
 * so they work inside data: URLs (PDF) and in html-to-docx (DOCX).
 */
export async function embedLocalImages(html: string, docFilePath?: string | null): Promise<string> {
  const matches = [...html.matchAll(IMG_SRC_RE)];
  if (!matches.length) return html;

  // Resolve every distinct path once, in parallel.
  const wanted = new Map<string, string>();
  for (const match of matches) {
    const localPath = resolveLocalImagePath(match[2], docFilePath);
    // The same gate the preview's asset scheme applies. Without it an untrusted
    // document could name any path on the machine and have its contents
    // embedded in the exported file.
    if (localPath && isAllowedAssetPath(localPath)) wanted.set(match[2], localPath);
  }
  const resolved = new Map<string, string>();
  await Promise.all(
    [...wanted].map(async ([src, localPath]) => {
      const dataUrl = await toDataUrl(localPath);
      if (dataUrl) resolved.set(src, dataUrl);
    })
  );
  if (!resolved.size) return html;

  // Rebuild in one pass; string slicing per match was O(n^2) on image-heavy docs.
  IMG_SRC_RE.lastIndex = 0;
  return html.replace(IMG_SRC_RE, (whole, prefix: string, src: string, suffix: string) => {
    const dataUrl = resolved.get(src);
    return dataUrl ? `${prefix}${dataUrl}${suffix}` : whole;
  });
}
