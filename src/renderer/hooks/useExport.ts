import { useCallback } from "react";
import type { Theme } from "../renderer-types";

export function useExport(
  filePath: string | null,
  html: string,
  fileName: string,
  theme: Theme,
  setStatus: (msg: string) => void
) {
  const exportPdf = useCallback(async () => {
    setStatus("Eksport PDF...");
    try {
      const result = await window.markdownStudio.exportPdf({ filePath, html, title: fileName, theme });
      setStatus(result ? `Wyeksportowano PDF: ${result.filePath}` : "Anulowano eksport PDF");
    } catch (error) {
      setStatus(`Błąd eksportu PDF: ${error instanceof Error ? error.message : "nieznany błąd"}`);
    }
  }, [filePath, html, fileName, theme, setStatus]);

  const exportHtml = useCallback(async () => {
    setStatus("Eksport HTML...");
    try {
      const result = await window.markdownStudio.exportHtml({ filePath, html, title: fileName, theme });
      setStatus(result ? `Wyeksportowano HTML: ${result.filePath}` : "Anulowano eksport HTML");
    } catch (error) {
      setStatus(`Błąd eksportu HTML: ${error instanceof Error ? error.message : "nieznany błąd"}`);
    }
  }, [filePath, html, fileName, theme, setStatus]);

  const exportDocx = useCallback(async () => {
    setStatus("Eksport DOCX...");
    try {
      const result = await window.markdownStudio.exportDocx({ filePath, html, title: fileName, theme });
      setStatus(result ? `Wyeksportowano DOCX: ${result.filePath}` : "Anulowano eksport DOCX");
    } catch (error) {
      setStatus(`Błąd eksportu DOCX: ${error instanceof Error ? error.message : "nieznany błąd"}`);
    }
  }, [filePath, html, fileName, theme, setStatus]);

  const openPrintPreview = useCallback(async () => {
    setStatus("Otwieranie podglądu wydruku...");
    try {
      const ok = await window.markdownStudio.openPrintPreview({ filePath, html, title: fileName, theme });
      setStatus(ok ? "Podgląd wydruku — użyj przycisku Drukuj w oknie" : "Anulowano podgląd wydruku");
    } catch (error) {
      setStatus(`Błąd podglądu wydruku: ${error instanceof Error ? error.message : "nieznany błąd"}`);
    }
  }, [filePath, html, fileName, theme, setStatus]);

  return { exportPdf, exportHtml, exportDocx, openPrintPreview };
}
