import type { Theme } from "../renderer-types";
import { wrapHtmlDocument } from "./documentStyles";

export type PreviewCopyResult =
  | { ok: true; scope: "selection" | "document" }
  | { ok: false; reason: "no-preview" | "empty" };

export function getPreviewCopySelection(
  previewEl: HTMLElement | null
): PreviewCopyResult & { innerHtml?: string; text?: string; scope?: "selection" | "document" } {
  if (!previewEl) return { ok: false, reason: "no-preview" };

  const selection = window.getSelection();
  const hasSelection =
    selection &&
    !selection.isCollapsed &&
    selection.rangeCount > 0 &&
    previewEl.contains(selection.anchorNode);

  let innerHtml: string;
  let plainText: string;
  let scope: "selection" | "document";

  if (hasSelection && selection) {
    const range = selection.getRangeAt(0);
    const wrapper = document.createElement("div");
    wrapper.appendChild(range.cloneContents());
    innerHtml = wrapper.innerHTML;
    plainText = selection.toString();
    scope = "selection";
  } else {
    if (!previewEl.innerText.trim()) return { ok: false, reason: "empty" };
    innerHtml = previewEl.innerHTML;
    plainText = previewEl.innerText;
    scope = "document";
  }

  return { ok: true, scope, innerHtml, text: plainText };
}

export async function buildPreviewClipboardPayload(
  previewEl: HTMLElement | null,
  theme: Theme,
  filePath: string | null
): Promise<PreviewCopyResult & { html?: string; text?: string }> {
  const part = getPreviewCopySelection(previewEl);
  if (!part.ok) return part;

  const embedded = await window.markdownStudio.embedImagesInHtml(part.innerHtml!, filePath);
  return {
    ok: true,
    scope: part.scope!,
    text: part.text!,
    html: wrapHtmlDocument(embedded, theme, false)
  };
}
