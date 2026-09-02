import React from "react";
import { ListTree } from "lucide-react";
import type { Translator } from "../../shared/i18n";
import type { OutlineItem } from "../renderer-types";

interface OutlineProps {
  items: OutlineItem[];
  activeId: string | null;
  onSelect: (item: OutlineItem) => void;
  t: Translator;
}

export function Outline({ items, activeId, onSelect, t }: OutlineProps) {
  return (
    <aside className="outline-pane" aria-label={t("pane.outline")}>
      <div className="pane-title">
        <ListTree size={15} />
        <span>{t("pane.outline")}</span>
      </div>
      {items.length === 0 ? (
        <p className="side-empty">{t("pane.outlineEmpty")}</p>
      ) : (
        <nav className="outline-list">
          {items.map((item) => (
            <button
              key={`${item.id}-${item.line}`}
              type="button"
              className={`outline-item level-${item.level}${item.id === activeId ? " active" : ""}`}
              title={item.text}
              onClick={() => onSelect(item)}
            >
              {item.text || "—"}
            </button>
          ))}
        </nav>
      )}
    </aside>
  );
}
