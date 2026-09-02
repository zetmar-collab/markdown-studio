import { app } from "electron";
import { isWindowsStoreBuild } from "./runtimeTarget.js";

export type UpdateStatus =
  | { kind: "checking" }
  | { kind: "available"; version: string }
  | { kind: "none" }
  | { kind: "downloaded"; version: string }
  | { kind: "error"; message: string }
  | { kind: "unsupported" };

type StatusListener = (status: UpdateStatus) => void;

let listener: StatusListener = () => {};
let wired = false;

export function onUpdateStatus(callback: StatusListener) {
  listener = callback;
}

/**
 * electron-updater is loaded lazily: it is useless in dev and in the portable
 * build, and importing it eagerly would pull the whole module (and its network
 * stack) into every startup.
 */
async function getAutoUpdater() {
  if (!app.isPackaged) return null;
  // The Microsoft Store owns updates for MSIX packages, and shipping our own
  // downloader there would break the "no external installers" policy.
  if (isWindowsStoreBuild()) return null;
  // Portable builds have no install path to replace.
  if (process.env.PORTABLE_EXECUTABLE_DIR) return null;
  try {
    const { autoUpdater } = await import("electron-updater");
    if (!wired) {
      wired = true;
      autoUpdater.autoDownload = true;
      autoUpdater.on("update-available", (info: { version: string }) =>
        listener({ kind: "available", version: info.version })
      );
      autoUpdater.on("update-not-available", () => listener({ kind: "none" }));
      autoUpdater.on("update-downloaded", (info: { version: string }) =>
        listener({ kind: "downloaded", version: info.version })
      );
      autoUpdater.on("error", (error: Error) =>
        listener({ kind: "error", message: error?.message ?? "unknown" })
      );
    }
    return autoUpdater;
  } catch (error) {
    listener({ kind: "error", message: error instanceof Error ? error.message : "unknown" });
    return null;
  }
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  const updater = await getAutoUpdater();
  if (!updater) return { kind: "unsupported" };
  listener({ kind: "checking" });
  try {
    await updater.checkForUpdates();
    return { kind: "checking" };
  } catch (error) {
    const status: UpdateStatus = {
      kind: "error",
      message: error instanceof Error ? error.message : "unknown"
    };
    listener(status);
    return status;
  }
}

/** Fire-and-forget check used at startup when the user has updates enabled. */
export function checkForUpdatesInBackground(): void {
  void checkForUpdates().catch(() => {
    /* never surface startup update noise */
  });
}
