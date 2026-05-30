import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, FilePlus } from "lucide-react";
import { DOCUMENT_TEMPLATES, type DocumentTemplateId } from "../constants";

interface TemplateMenuProps {
  onNewBlank: () => void;
  onNewTemplate: (id: DocumentTemplateId) => void;
}

export function TemplateMenu({ onNewBlank, onNewTemplate }: TemplateMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const templates = Object.entries(DOCUMENT_TEMPLATES) as [DocumentTemplateId, (typeof DOCUMENT_TEMPLATES)[DocumentTemplateId]][];

  return (
    <div className="template-menu" ref={ref}>
      <button
        type="button"
        className="template-menu-trigger"
        title="Nowy z szablonu"
        onClick={() => setOpen((o) => !o)}
      >
        <FilePlus size={14} />
        <span>Nowy</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="template-dropdown" role="menu">
          {templates.map(([id, t]) => (
            <button
              key={id}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                if (id === "blank") onNewBlank();
                else onNewTemplate(id);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
