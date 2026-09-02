/**
 * How this copy of the app was delivered.
 *
 * The Microsoft Store build has to behave differently from the NSIS/portable
 * builds in two ways that the Store policies require:
 *
 *  - it must not download or install anything from outside the Store, so the
 *    electron-updater path is switched off entirely;
 *  - it must not register file associations by writing to the registry; the
 *    package manifest declares them instead, and Windows owns them.
 *
 * Electron sets `process.windowsStore` to true when the app runs from an MSIX
 * container, which is exactly the condition we need.
 */
export function isWindowsStoreBuild(): boolean {
  return process.platform === "win32" && process.windowsStore === true;
}

export interface PlatformInfo {
  version: string;
  isStoreBuild: boolean;
  platform: NodeJS.Platform;
}
