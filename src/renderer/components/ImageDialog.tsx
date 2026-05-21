import React, { useEffect, useState } from "react";

interface ImageDialogProps {
  onInsert: (markdown: string) => void;
  onClose: () => void;
  onPickFile: () => Promise<string | null>;
}

/** Converts an absolute filesystem path to a file:// URL usable in <img src>. */
function toFileUrl(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`;
}

export function ImageDialog({ onInsert, onClose, onPickFile }: ImageDialogProps) {
  const [alt, setAlt] = useState("");
  const [src, setSrc] = useState("");
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handlePickFile() {
    const path = await onPickFile();
    if (path) { setSrc(toFileUrl(path)); setImgError(false); }
  }

  function handleInsert() {
    if (!src.trim()) return;
    onInsert(`![${alt}](${src.trim()})`);
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Wstaw grafikę">
        <h2>Wstaw grafikę</h2>

        <div className="modal-field">
          <label>Tekst alternatywny (alt)</label>
          <input
            autoFocus
            placeholder="Opis obrazka"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
          />
        </div>

        <div className="modal-field">
          <label>Adres URL lub ścieżka</label>
          <div className="modal-row">
            <input
              placeholder="https://… lub wybierz plik lokalny"
              value={src}
              onChange={(e) => { setSrc(e.target.value); setImgError(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleInsert()}
            />
            <button onClick={() => void handlePickFile()}>Plik…</button>
          </div>
        </div>

        {src.trim() && !imgError && (
          <div className="modal-img-preview">
            <img
              src={src.trim()}
              alt={alt || "podgląd"}
              onError={() => setImgError(true)}
            />
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>Anuluj</button>
          <button className="primary" onClick={handleInsert} disabled={!src.trim()}>
            Wstaw
          </button>
        </div>
      </div>
    </div>
  );
}
