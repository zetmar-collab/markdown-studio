import React from "react";
import { Clipboard, ClipboardPaste, FileDown, PanelLeftClose, Save } from "lucide-react";

interface ContextMenuProps {
  x: number;
  y: number;
  onSave: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onExportPdf: () => void;
  onExportDocx: () => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, onSave, onCopy, onPaste, onExportPdf, onExportDocx, onClose }: ContextMenuProps) {
  return (
    <div
      className="context-menu"
      style={{ left: x, top: y }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      <button role="menuitem" onClick={onSave}>
        <Save size={16} /><span>Zapisz</span>
      </button>
      <button role="menuitem" onClick={onCopy}>
        <Clipboard size={16} /><span>Kopiuj</span>
      </button>
      <button role="menuitem" onClick={onPaste}>
        <ClipboardPaste size={16} /><span>Wklej</span>
      </button>
      <div className="context-separator" />
      <button role="menuitem" onClick={onExportPdf}>
        <FileDown size={16} /><span>Eksportuj do PDF</span>
      </button>
      <button role="menuitem" onClick={onExportDocx}>
        <FileDown size={16} /><span>Eksportuj do HTML</span>
      </button>
      <div className="context-separator" />
      <button role="menuitem" onClick={onClose}>
        <PanelLeftClose size={16} /><span>Zamknij</span>
      </button>
    </div>
  );
}
