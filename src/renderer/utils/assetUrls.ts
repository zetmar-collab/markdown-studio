import { toAssetUrl } from "../../shared/assetProtocol";

/** Directory part of a Windows or POSIX path. */
export function dirnameOf(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return index > 0 ? filePath.slice(0, index) : "";
}

/**
 * Resolve `relative` against `baseDir` without pulling node:path into the
 * renderer. Handles `.`/`..` segments and mixed separators.
 */
export function resolveRelativePath(baseDir: string, relative: string): string {
  const windows = baseDir.includes("\\") || /^[a-zA-Z]:/.test(baseDir);
  const separator = windows ? "\\" : "/";
  const baseParts = baseDir.split(/[\\/]/).filter(Boolean);
  const relativeParts = relative.split(/[\\/]/);

  const parts = [...baseParts];
  for (const part of relativeParts) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }

  const joined = parts.join(separator);
  if (windows) return joined;
  return baseDir.startsWith("/") ? `/${joined}` : joined;
}

function isAbsolutePath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\\\");
}

const IMG_SRC_RE = /(<img\b[^>]*?\bsrc=")([^"]+)(")/gi;

/**
 * Point every local `<img src>` at the asset scheme so the preview can load it.
 * Remote, data: and already-rewritten URLs are left alone.
 */
export function rewriteAssetUrls(html: string, docFilePath: string | null): string {
  return html.replace(IMG_SRC_RE, (whole, prefix: string, src: string, suffix: string) => {
    if (
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("data:") ||
      src.startsWith("blob:") ||
      src.startsWith("md-asset://")
    ) {
      return whole;
    }

    let absolute: string | null = null;
    if (src.startsWith("file:///")) {
      absolute = safeDecode(src.slice(8));
    } else if (src.startsWith("file://")) {
      absolute = safeDecode(src.slice(7));
    } else if (isAbsolutePath(src)) {
      absolute = src;
    } else if (docFilePath) {
      absolute = resolveRelativePath(dirnameOf(docFilePath), safeDecode(src));
    }

    if (!absolute) return whole;
    return `${prefix}${toAssetUrl(absolute)}${suffix}`;
  });
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
