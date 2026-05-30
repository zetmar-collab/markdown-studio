/** Schowek: preload (electron.clipboard) → ukryte textarea → navigator (dev). */

function api() {
  return window.markdownStudio;
}

export function readClipboardText(): string {
  try {
    return api().readClipboardText() || "";
  } catch {
    return "";
  }
}

export function writeClipboardText(text: string): boolean {
  try {
    api().writeClipboardText(text);
    return true;
  } catch {
    /* fallback */
  }

  try {
    void navigator.clipboard.writeText(text);
    return true;
  } catch {
    return writeTextLegacy(text);
  }
}

export async function writeClipboardRich(payload: { html: string; text: string }): Promise<boolean> {
  try {
    await api().writeClipboardRich(payload);
    return true;
  } catch {
    /* fallback */
  }
  return writeClipboardText(payload.text);
}

function writeTextLegacy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } finally {
    document.body.removeChild(area);
  }
  return ok;
}

/** Tekst zaznaczenia w CodeMirror + zapis do schowka (menu / przyciski). */
export function copyEditorText(
  view: { state: { selection: { main: { empty: boolean; from: number; to: number } }; doc: { toString(): string; sliceString(a: number, b: number): string } } },
  onStatus: (msg: string) => void
): boolean {
  const sel = view.state.selection.main;
  const text = sel.empty ? view.state.doc.toString() : view.state.doc.sliceString(sel.from, sel.to);
  if (!text) {
    onStatus("Nic do skopiowania");
    return false;
  }
  const ok = writeClipboardText(text);
  onStatus(ok ? (sel.empty ? "Skopiowano cały dokument" : "Skopiowano") : "Nie udało się skopiować");
  return ok;
}

export function pasteEditorText(
  view: {
    state: { selection: { main: { from: number; to: number } } };
    dispatch: (spec: { changes: { from: number; to: number; insert: string }; selection: { anchor: number } }) => void;
    focus: () => void;
  },
  onStatus: (msg: string) => void,
  onDirty: () => void
): boolean {
  const text = readClipboardText();
  if (!text) {
    onStatus("Schowek jest pusty lub niedostępny");
    return false;
  }
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length }
  });
  onDirty();
  view.focus();
  onStatus("Wklejono ze schowka");
  return true;
}
