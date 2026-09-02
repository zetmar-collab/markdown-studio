import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, FilePlus } from "lucide-react";
import type { Translator } from "../../shared/i18n";
import { DOCUMENT_TEMPLATES, type DocumentTemplateId } from "../constants";

interface TemplateMenuProps {
  onNewBlank: () => void;
  onNewTemplate: (id: DocumentTemplateId) => void;
  t: Translator;
}

export function TemplateMenu({ onNewBlank, onNewTemplate, t }: TemplateMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const templates = Object.keys(DOCUMENT_TEMPLATES) as DocumentTemplateId[];

  return (
    <div className="template-menu" ref={ref}>
      <button
        type="button"
        className="template-menu-trigger"
        title={t("menu.new")}
        onClick={() => setOpen((value) => !value)}
      >
        <FilePlus size={14} />
        <span>{t("menu.new")}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="template-dropdown" role="menu">
          {templates.map((id) => (
            <button
              key={id}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                if (id === "blank") onNewBlank();
                else onNewTemplate(id);
              }}
            >
              {t(DOCUMENT_TEMPLATES[id].labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
