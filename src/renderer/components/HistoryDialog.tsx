import React, { useCallback, useEffect, useState } from "react";
import { History, RotateCcw, Trash2 } from "lucide-react";
import type { Language, Translator } from "../../shared/i18n";
import type { HistoryEntry } from "../../types/electron-api";
import { DiffView } from "./DiffView";

interface HistoryDialogProps {
  filePath: string | null;
  currentContent: string;
  language: Language;
  onRestore: (content: string) => void;
  onClose: () => void;
  t: Translator;
}

function formatMoment(savedAt: number, language: Language): string {
  return new Date(savedAt).toLocaleString(language === "pl" ? "pl-PL" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} kB`;
}

/**
 * The copies kept on every save, with a diff against what is in the editor now
 * so restoring is a decision rather than a gamble.
 */
export function HistoryDialog({
  filePath,
  currentContent,
  language,
  onRestore,
  onClose,
  t
}: HistoryDialogProps) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [content, setContent] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!filePath) {
      setEntries([]);
      return;
    }
    const list = await window.markdownStudio.listVersions(filePath);
    setEntries(list);
    setSelected((current) => current ?? list[0]?.id ?? null);
  }, [filePath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!filePath || selected === null) {
      setContent(null);
      return;
    }
    let cancelled = false;
    void window.markdownStudio.readVersion(filePath, selected).then((value) => {
      if (!cancelled) setContent(value);
    });
    return () => {
      cancelled = true;
    };
  }, [filePath, selected]);

  async function forgetAll() {
    if (!filePath) return;
    await window.markdownStudio.clearHistory(filePath);
    setSelected(null);
    setContent(null);
    await refresh();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-label={t("history.title")}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>
          <History size={18} /> {t("history.title")}
        </h2>

        {!filePath ? (
          <p className="side-empty">{t("history.needsSavedFile")}</p>
        ) : entries === null ? (
          <p className="side-empty">{t("common.loading")}</p>
        ) : entries.length === 0 ? (
          <p className="side-empty">{t("history.empty")}</p>
        ) : (
          <div className="history-body">
            <ul className="history-list">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`history-item${entry.id === selected ? " active" : ""}`}
                    onClick={() => setSelected(entry.id)}
                  >
                    <span className="history-moment">{formatMoment(entry.savedAt, language)}</span>
                    <span className="history-size">{formatSize(entry.bytes)}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="history-diff">
              {content === null ? (
                <p className="side-empty">{t("common.loading")}</p>
              ) : (
                <DiffView before={content} after={currentContent} t={t} />
              )}
            </div>
          </div>
        )}

        <div className="modal-actions">
          {entries !== null && entries.length > 0 && (
            <>
              <button type="button" className="danger" onClick={() => void forgetAll()}>
                <Trash2 size={15} /> {t("history.clear")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={content === null}
                onClick={() => {
                  if (content !== null) onRestore(content);
                }}
              >
                <RotateCcw size={15} /> {t("history.restore")}
              </button>
            </>
          )}
          <button type="button" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
