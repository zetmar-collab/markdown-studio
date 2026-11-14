/**
 * Keeping the application window inside the application.
 *
 * A Markdown document is untrusted input: it may come from a repository, an
 * e-mail attachment or a shared drive. Its links render as ordinary anchors in
 * the preview, and without a guard a single click loads that address in the
 * app's own `webContents` — with the preload, and therefore the whole IPC
 * bridge, still attached. A remote page could then read and write any file the
 * user can. Measured, not theorised: before this guard existed, clicking a link
 * to example.com in the preview left the window on example.com with
 * `window.markdownStudio` intact and `openFilePath` returning file contents.
 *
 * So nothing may navigate this window anywhere, and anything the user clicks
 * goes to the system browser instead — but only if its scheme is one of a few
 * that cannot start a program.
 */
import { shell, type BrowserWindow } from "electron";
import { isSafeExternalUrl } from "../shared/externalLinks.js";

/** Open a link the user clicked, if it is one we are willing to hand over. */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!isSafeExternalUrl(url)) return false;
  try {
    await shell.openExternal(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Block every navigation and every new window for `win`, sending safe links to
 * the system browser instead.
 *
 * `isInterfaceUrl` tells the app's own interface (the dev server or the bundled
 * index.html) from everything else; a reload or an in-app hash change has to
 * keep working.
 */
export function guardWindowNavigation(
  win: BrowserWindow,
  isInterfaceUrl: (url: string) => boolean
): void {
  win.webContents.on("will-navigate", (event, url) => {
    if (isInterfaceUrl(url)) return;
    event.preventDefault();
    void openExternalUrl(url);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrl(url);
    return { action: "deny" };
  });

  // A redirect chain can start at an allowed address and end anywhere.
  win.webContents.on("will-redirect", (event, url) => {
    if (isInterfaceUrl(url)) return;
    event.preventDefault();
  });
}
