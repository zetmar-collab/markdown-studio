import React, { useEffect, useState } from "react";
import type { Translator } from "../../shared/i18n";
import { toAssetUrl } from "../../shared/assetProtocol";

interface ImageDialogProps {
  onInsert: (markdown: string) => void;
  onClose: () => void;
  onPickFile: () => Promise<string | null>;
  t: Translator;
}

/** Converts an absolute filesystem path to a file:// URL usable in Markdown. */
function toFileUrl(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`;
}

/** The dialog preview goes through the asset scheme, like the main preview. */
function toPreviewSrc(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(https?:|data:|blob:|md-asset:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("file:///")) return toAssetUrl(decodeURIComponent(trimmed.slice(8)));
  if (trimmed.startsWith("file://")) return toAssetUrl(decodeURIComponent(trimmed.slice(7)));
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith("/")) return toAssetUrl(trimmed);
  return "";
}

export function ImageDialog({ onInsert, onClose, onPickFile, t }: ImageDialogProps) {
  const [alt, setAlt] = useState("");
  const [src, setSrc] = useState("");
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handlePickFile() {
    const path = await onPickFile();
    if (path) {
      setSrc(toFileUrl(path));
      setImgError(false);
    }
  }

  function handleInsert() {
    if (!src.trim()) return;
    onInsert(`![${alt}](${src.trim()})`);
  }

  const previewSrc = toPreviewSrc(src);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={t("image.title")}>
        <h2>{t("image.title")}</h2>

        <label className="modal-field">
          <span>{t("image.alt")}</span>
          <input
            autoFocus
            placeholder={t("image.altPlaceholder")}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
          />
        </label>

        <div className="modal-field">
          <span>{t("image.src")}</span>
          <div className="modal-row">
            <input
              placeholder={t("image.srcPlaceholder")}
              value={src}
              onChange={(event) => {
                setSrc(event.target.value);
                setImgError(false);
              }}
              onKeyDown={(event) => event.key === "Enter" && handleInsert()}
            />
            <button type="button" onClick={() => void handlePickFile()}>
              {t("image.pick")}
            </button>
          </div>
        </div>

        {previewSrc && !imgError && (
          <div className="modal-img-preview">
            <img
              src={previewSrc}
              alt={alt || t("image.preview")}
              onError={() => setImgError(true)}
            />
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="button" className="primary" onClick={handleInsert} disabled={!src.trim()}>
            {t("common.insert")}
          </button>
        </div>
      </div>
    </div>
  );
}
