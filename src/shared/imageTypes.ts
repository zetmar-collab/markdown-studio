/** Image formats the preview and the exports know how to handle. */
export const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif"
};

export function imageMimeFor(filePath: string): string | null {
  const extension = filePath.slice(filePath.lastIndexOf(".") + 1).toLowerCase();
  return IMAGE_MIME[extension] ?? null;
}

export function isImagePath(filePath: string): boolean {
  return imageMimeFor(filePath) !== null;
}
