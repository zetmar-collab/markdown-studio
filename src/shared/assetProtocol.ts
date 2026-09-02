/**
 * Custom scheme used to show local images in the live preview.
 *
 * The preview used to base64-inline every local image on every keystroke, which
 * meant a disk read plus a multi-megabyte IPC payload per edit. Images are now
 * streamed from a privileged scheme instead, and base64 embedding is reserved
 * for export, where a self-contained file is actually required.
 */

export const ASSET_SCHEME = "md-asset";
export const ASSET_HOST = "local";

const PREFIX = `${ASSET_SCHEME}://${ASSET_HOST}/`;

export function toAssetUrl(absolutePath: string): string {
  return `${PREFIX}${encodeURIComponent(absolutePath)}`;
}

/** Absolute filesystem path behind an asset URL, or null if this is not one. */
export function fromAssetUrl(url: string): string | null {
  if (!url.startsWith(PREFIX)) return null;
  const encoded = url.slice(PREFIX.length).split(/[?#]/)[0];
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

export function isAssetUrl(url: string): boolean {
  return url.startsWith(PREFIX);
}
