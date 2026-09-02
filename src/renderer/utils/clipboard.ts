/**
 * Clipboard access.
 *
 * Everything goes through IPC now: the preload script no longer touches
 * Electron's `clipboard` module directly, which keeps the bridge surface to
 * plain serialisable calls.
 */

function api() {
  return window.markdownStudio;
}

export async function readClipboardText(): Promise<string> {
  try {
    return (await api().readClipboardText()) || "";
  } catch {
    return "";
  }
}

export async function readClipboardHtml(): Promise<string> {
  try {
    return (await api().readClipboardHtml()) || "";
  } catch {
    return "";
  }
}

export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await api().writeClipboardText(text);
    return true;
  } catch {
    /* fall through to the browser APIs */
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return writeTextLegacy(text);
  }
}

export async function writeClipboardRich(payload: {
  html: string;
  text: string;
}): Promise<boolean> {
  try {
    await api().writeClipboardRich(payload);
    return true;
  } catch {
    /* fall through */
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
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}
