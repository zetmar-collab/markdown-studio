import { useCallback } from "react";
import type { Translator } from "../../shared/i18n";
import type { Theme } from "../renderer-types";

/**
 * `getHtml` returns what the user is actually looking at (the live preview DOM),
 * falling back to the rendered string. This matters for Mermaid diagrams and
 * anything else the renderer produces after the markdown pass: exporting the
 * raw string would ship the un-rendered source instead.
 */
export function useExport(
  filePath: string | null,
  getHtml: () => string,
  fileName: string,
  theme: Theme,
  setStatus: (msg: string) => void,
  t: Translator
) {
  const payload = useCallback(
    () => ({ filePath, html: getHtml(), title: fileName, theme }),
    [filePath, fileName, getHtml, theme]
  );

  const exportPdf = useCallback(async () => {
    setStatus(t("status.exportingPdf"));
    try {
      const result = await window.markdownStudio.exportPdf(payload());
      setStatus(
        result ? t("status.exportedPdf", { path: result.filePath }) : t("status.cancelledPdf")
      );
    } catch (error) {
      setStatus(t("status.errorPdf", { message: messageOf(error) }));
    }
  }, [payload, setStatus, t]);

  const exportHtml = useCallback(async () => {
    setStatus(t("status.exportingHtml"));
    try {
      const result = await window.markdownStudio.exportHtml(payload());
      setStatus(
        result ? t("status.exportedHtml", { path: result.filePath }) : t("status.cancelledHtml")
      );
    } catch (error) {
      setStatus(t("status.errorHtml", { message: messageOf(error) }));
    }
  }, [payload, setStatus, t]);

  const exportDocx = useCallback(async () => {
    setStatus(t("status.exportingDocx"));
    try {
      const result = await window.markdownStudio.exportDocx(payload());
      setStatus(
        result ? t("status.exportedDocx", { path: result.filePath }) : t("status.cancelledDocx")
      );
    } catch (error) {
      setStatus(t("status.errorDocx", { message: messageOf(error) }));
    }
  }, [payload, setStatus, t]);

  const openPrintPreview = useCallback(async () => {
    setStatus(t("status.openingPrint"));
    try {
      const ok = await window.markdownStudio.openPrintPreview(payload());
      setStatus(ok ? t("status.printReady") : t("status.printCancelled"));
    } catch (error) {
      setStatus(t("status.errorPrint", { message: messageOf(error) }));
    }
  }, [payload, setStatus, t]);

  return { exportPdf, exportHtml, exportDocx, openPrintPreview };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}
