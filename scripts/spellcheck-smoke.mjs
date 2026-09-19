/**
 * Smoke test for spell checking, end to end through the real app.
 *
 *   npx vite                                  (w osobnym terminalu)
 *   npx electron scripts/spellcheck-smoke.mjs
 *
 * Boots the actual main process, types a misspelled word into the editor,
 * right-clicks it and reads what the app's own context menu rendered.
 *
 * This exists because the two bugs that made spell checking useless were both
 * invisible to unit tests and to a glance at the code:
 *   - CodeMirror sets spellcheck="false" on its content element, so Chromium
 *     never marked anything;
 *   - calling preventDefault() on the "contextmenu" event stops Chromium from
 *     reporting the misspelled word and its suggestions to the main process,
 *     so the menu came up empty.
 * Both look perfectly fine in the source. Only running the app shows them.
 */
import { app, BrowserWindow } from "electron";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const WORD = "speling";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await import(new URL("../dist-electron/main/main.js", import.meta.url).href);

function finish(result) {
  const ok = result.suggestions?.length > 0;
  writeFileSync(join(ROOT, "out", "spellcheck-smoke.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  console.log(ok ? "\n✔ Podpowiedzi pisowni działają." : "\n✖ Brak podpowiedzi pisowni.");
  process.exit(ok ? 0 : 1);
}

function typeText(webContents, text) {
  for (const keyCode of text) {
    webContents.sendInputEvent({ type: "keyDown", keyCode });
    webContents.sendInputEvent({ type: "char", keyCode });
    webContents.sendInputEvent({ type: "keyUp", keyCode });
  }
}

app.whenReady().then(async () => {
  await sleep(6000);
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) finish({ error: "Okno się nie pojawiło." });
  const wc = win.webContents;
  win.focus();
  await sleep(2000);

  const editor = await wc.executeJavaScript(`(() => {
    const content = document.querySelector('.cm-content');
    if (!content) return null;
    const box = content.getBoundingClientRect();
    return {
      x: Math.round(box.left + 40),
      y: Math.round(box.top + 12),
      spellcheck: content.getAttribute('spellcheck')
    };
  })()`);
  if (!editor) finish({ error: "Nie znaleziono edytora — czy vite działa na :5173?" });
  if (editor.spellcheck !== "true") finish({ error: "Edytor ma spellcheck != true.", editor });

  wc.sendInputEvent({ type: "mouseDown", x: editor.x, y: editor.y, button: "left", clickCount: 1 });
  wc.sendInputEvent({ type: "mouseUp", x: editor.x, y: editor.y, button: "left", clickCount: 1 });
  await sleep(500);
  typeText(wc, `${WORD} `);
  await sleep(6000); // Chromium may still be fetching the dictionary.

  const box = await wc.executeJavaScript(`(() => {
    const walker = document.createTreeWalker(document.querySelector('.cm-content'), NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const at = node.textContent.indexOf(${JSON.stringify(WORD)});
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + ${WORD.length});
      const rect = range.getBoundingClientRect();
      return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
    }
    return null;
  })()`);
  if (!box) finish({ error: "Wpisane słowo nie trafiło do edytora." });

  wc.sendInputEvent({ type: "mouseDown", x: box.x, y: box.y, button: "right", clickCount: 1 });
  wc.sendInputEvent({ type: "mouseUp", x: box.x, y: box.y, button: "right", clickCount: 1 });
  await sleep(1500);

  const menu = await wc.executeJavaScript(`(() => {
    const menu = document.querySelector('.context-menu');
    if (!menu) return { open: false };
    return {
      open: true,
      word: menu.querySelector('.context-heading span')?.textContent ?? null,
      suggestions: Array.from(menu.querySelectorAll('.context-suggestion'), (b) => b.textContent)
    };
  })()`);

  finish({ typed: WORD, ...menu });
});
