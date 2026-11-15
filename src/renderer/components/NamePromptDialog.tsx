import React, { useEffect, useRef, useState } from "react";
import type { Translator } from "../../shared/i18n";

interface NamePromptDialogProps {
  title: string;
  label: string;
  initialValue?: string;
  maxLength?: number;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
  t: Translator;
}

/** A one-field dialog, because the web `prompt()` does not exist in Electron. */
export function NamePromptDialog({
  title,
  label,
  initialValue = "",
  maxLength = 60,
  confirmLabel,
  onConfirm,
  onClose,
  t
}: NamePromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function confirm() {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        <label className="modal-field">
          <span>{label}</span>
          <input
            ref={inputRef}
            value={value}
            maxLength={maxLength}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirm();
              }
            }}
          />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="button" className="primary" disabled={!value.trim()} onClick={confirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
