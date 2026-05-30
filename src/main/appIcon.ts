import { app, nativeImage, type BrowserWindow } from "electron";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));

let cached: Electron.NativeImage | undefined;

function iconCandidates(): string[] {
  const roots = new Set<string>([
    join(moduleDir, "../.."),
    app.getAppPath(),
    join(app.getAppPath(), ".."),
    process.resourcesPath
  ]);

  const paths: string[] = [];
  for (const root of roots) {
    paths.push(join(root, "build", "icon.ico"));
    paths.push(join(root, "build", "icon.png"));
  }
  return paths;
}

/** Custom Markdown Studio icon (build/icon.ico or .png). */
export function getAppIcon(): Electron.NativeImage {
  if (cached && !cached.isEmpty()) return cached;

  for (const path of iconCandidates()) {
    if (!existsSync(path)) continue;
    const image = nativeImage.createFromPath(path);
    if (!image.isEmpty()) {
      cached = image;
      return image;
    }
  }

  cached = nativeImage.createEmpty();
  return cached;
}

export function applyWindowIcon(win: BrowserWindow) {
  const icon = getAppIcon();
  if (!icon.isEmpty()) win.setIcon(icon);
}
