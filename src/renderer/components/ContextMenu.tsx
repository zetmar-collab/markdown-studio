import React from "react";
import {
  Clipboard,
  ClipboardPaste,
  FileDown,
  PanelLeftClose,
  Save,
  SpellCheck
} from "lucide-react";
import type { Translator } from "../../shared/i18n";

interface ContextMenuProps {
  x: number;
  y: number;
  /** Spelling suggestions pushed by the main process for the word under the cursor. */
  spelling: { word: string; suggestions: string[] } | null;
  onApplySuggestion: (suggestion: string) => void;
  onSave: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onExportPdf: () => void;
  onExportHtml: () => void;
  onExportDocx: () => void;
  onPrint: () => void;
  onClose: () => void;
  t: Translator;
}

export function ContextMenu({
  x,
  y,
  spelling,
  onApplySuggestion,
  onSave,
  onCopy,
  onPaste,
  onExportPdf,
  onExportHtml,
  onExportDocx,
  onPrint,
  onClose,
  t
}: ContextMenuProps) {
  return (
    <div
      className="context-menu"
      style={{ left: x, top: y }}
      role="menu"
      onContextMenu={(event) => event.preventDefault()}
    >
      {spelling && spelling.suggestions.length > 0 && (
        <>
          <div className="context-heading">
            <SpellCheck size={14} />
            <span>{spelling.word}</span>
          </div>
          {spelling.suggestions.slice(0, 5).map((suggestion) => (
            <button
              key={suggestion}
              role="menuitem"
              className="context-suggestion"
              onClick={() => onApplySuggestion(suggestion)}
            >
              <span>{suggestion}</span>
            </button>
          ))}
          <div className="context-separator" />
        </>
      )}
      <button role="menuitem" onClick={onSave}>
        <Save size={16} />
        <span>{t("menu.save")}</span>
      </button>
      <button role="menuitem" onClick={onCopy}>
        <Clipboard size={16} />
        <span>{t("menu.copy")}</span>
      </button>
      <button role="menuitem" onClick={onPaste}>
        <ClipboardPaste size={16} />
        <span>{t("menu.paste")}</span>
      </button>
      <div className="context-separator" />
      <button role="menuitem" onClick={onExportPdf}>
        <FileDown size={16} />
        <span>{t("menu.exportPdf")}</span>
      </button>
      <button role="menuitem" onClick={onExportHtml}>
        <FileDown size={16} />
        <span>{t("menu.exportHtml")}</span>
      </button>
      <button role="menuitem" onClick={onExportDocx}>
        <FileDown size={16} />
        <span>{t("menu.exportDocx")}</span>
      </button>
      <button role="menuitem" onClick={onPrint}>
        <FileDown size={16} />
        <span>{t("menu.printPreview")}</span>
      </button>
      <div className="context-separator" />
      <button role="menuitem" onClick={onClose}>
        <PanelLeftClose size={16} />
        <span>{t("common.close")}</span>
      </button>
    </div>
  );
}
