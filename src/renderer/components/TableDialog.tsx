import React, { useEffect, useMemo, useState } from "react";
import type { Language, Translator } from "../../shared/i18n";
import { generateTable, type TableAlign } from "../utils/tableMarkdown";

interface TableDialogProps {
  onInsert: (markdown: string) => void;
  onClose: () => void;
  language: Language;
  t: Translator;
}

const ALIGN_LABELS: Record<Language, Record<TableAlign, string>> = {
  pl: { left: "Do lewej", center: "Środek", right: "Do prawej" },
  en: { left: "Left", center: "Center", right: "Right" }
};

const FIELD_LABELS: Record<
  Language,
  { cols: string; rows: string; align: string; preview: string }
> = {
  pl: {
    cols: "Kolumny (2–8)",
    rows: "Wiersze danych (1–10)",
    align: "Wyrównanie kolumn",
    preview: "Podgląd"
  },
  en: {
    cols: "Columns (2–8)",
    rows: "Data rows (1–10)",
    align: "Column alignment",
    preview: "Preview"
  }
};

export function TableDialog({ onInsert, onClose, language, t }: TableDialogProps) {
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(3);
  const [align, setAlign] = useState<TableAlign>("left");

  const columnLabel = language === "en" ? "Column" : "Kolumna";
  const preview = useMemo(
    () => generateTable(cols, rows, align, { columnLabel }).trim(),
    [cols, rows, align, columnLabel]
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const labels = FIELD_LABELS[language] ?? FIELD_LABELS.pl;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={t("table.title")}>
        <h2>{t("table.title")}</h2>

        <div className="modal-grid-2">
          <label className="modal-field">
            <span>{labels.cols}</span>
            <input
              type="number"
              min={2}
              max={8}
              value={cols}
              onChange={(event) => setCols(clamp(+event.target.value, 2, 8))}
            />
          </label>
          <label className="modal-field">
            <span>{labels.rows}</span>
            <input
              type="number"
              min={1}
              max={10}
              value={rows}
              onChange={(event) => setRows(clamp(+event.target.value, 1, 10))}
            />
          </label>
        </div>

        <div className="modal-field">
          <span>{labels.align}</span>
          <div className="modal-align-group">
            {(["left", "center", "right"] as TableAlign[]).map((value) => (
              <button
                key={value}
                type="button"
                className={align === value ? "active" : ""}
                onClick={() => setAlign(value)}
              >
                {(ALIGN_LABELS[language] ?? ALIGN_LABELS.pl)[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-field">
          <span>{labels.preview}</span>
          <pre className="modal-preview">{preview}</pre>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => onInsert(generateTable(cols, rows, align, { columnLabel }))}
          >
            {t("common.insert")}
          </button>
        </div>
      </div>
    </div>
  );
}
