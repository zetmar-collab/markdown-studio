/**
 * Smoke test for the navigation guard, end to end through the real app.
 *
 *   npx vite                                   (w osobnym terminalu)
 *   npx electron scripts/navigation-smoke.mjs
 *
 * Opens a document containing an external link, clicks that link in the
 * preview, and checks that the window did not leave the application.
 *
 * This exists because the hole it guards was invisible to every other check:
 * types, lint and 157 unit tests all passed while a single click on a link in
 * any opened document moved the window to an arbitrary web page with the IPC
 * bridge still attached, so that page could read and write the user's files.
 */
import { app, BrowserWindow } from "electron";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const LINK = "https://example.com/";
const result = {};

function finish() {
  const ok = result.stayedInApp === true && result.bridgeReachableFromOutside !== true;
  console.log(JSON.stringify(result, null, 2));
  console.log(ok ? "\n✔ Okno zostało w aplikacji." : "\n✖ Okno opuściło aplikację.");
  process.exit(ok ? 0 : 1);
}
setTimeout(() => {
  result.error = "Przekroczono czas oczekiwania.";
  finish();
}, 90000);

const document = join(mkdtempSync(join(tmpdir(), "studio-markdown-smoke-")), "linki.md");
writeFileSync(document, `# Test nawigacji\n\n[Link zewnętrzny](${LINK})\n`, "utf8");
process.argv.push(document);

await import(new URL("../dist-electron/main/main.js", import.meta.url).href);

app.whenReady().then(async () => {
  await sleep(7000);
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) {
    result.error = "Okno się nie pojawiło.";
    finish();
  }
  const wc = win.webContents;
  result.urlBefore = wc.getURL();

  const anchor = await wc.executeJavaScript(`(() => {
    const a = document.querySelector('.markdown-preview a[href^="https://"]');
    if (!a) return null;
    a.click();
    return a.href;
  })()`);
  if (!anchor) {
    result.error = "W podglądzie nie ma linku — czy dokument się otworzył?";
    finish();
  }
  result.clicked = anchor;

  await sleep(6000);
  result.urlAfter = wc.getURL();
  result.stayedInApp = result.urlAfter === result.urlBefore;
  if (!result.stayedInApp) {
    result.bridgeReachableFromOutside = await wc
      .executeJavaScript("typeof window.markdownStudio === 'object'")
      .catch(() => "nie udało się sprawdzić");
  }
  finish();
});
