import React, { useEffect, useMemo, useState } from "react";
import { generateTable, type TableAlign } from "../utils/tableMarkdown";

interface TableDialogProps {
  onInsert: (markdown: string) => void;
  onClose: () => void;
}

export function TableDialog({ onInsert, onClose }: TableDialogProps) {
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(3);
  const [align, setAlign] = useState<TableAlign>("left");

  const preview = useMemo(() => generateTable(cols, rows, align).trim(), [cols, rows, align]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Wstaw tabelę">
        <h2>Wstaw tabelę</h2>

        <div className="modal-grid-2">
          <div className="modal-field">
            <label>Kolumny (2–8)</label>
            <input
              type="number"
              min={2}
              max={8}
              value={cols}
              onChange={(e) => setCols(clamp(+e.target.value, 2, 8))}
            />
          </div>
          <div className="modal-field">
            <label>Wiersze danych (1–10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={rows}
              onChange={(e) => setRows(clamp(+e.target.value, 1, 10))}
            />
          </div>
        </div>

        <div className="modal-field">
          <label>Wyrównanie kolumn</label>
          <div className="modal-align-group">
            {(["left", "center", "right"] as TableAlign[]).map((a) => (
              <button
                key={a}
                className={align === a ? "active" : ""}
                onClick={() => setAlign(a)}
              >
                {a === "left" ? "Do lewej" : a === "center" ? "Środek" : "Do prawej"}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-field">
          <label>Podgląd</label>
          <pre className="modal-preview">{preview}</pre>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Anuluj</button>
          <button className="primary" onClick={() => onInsert(generateTable(cols, rows, align))}>
            Wstaw
          </button>
        </div>
      </div>
    </div>
  );
}
