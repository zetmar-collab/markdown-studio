import React, { useCallback, useEffect, useState } from "react";
import { FileDown, FolderOpen } from "lucide-react";
import type { Translator } from "../../shared/i18n";
import { fileNameOf } from "../../shared/saveFailure";

interface BatchExportDialogProps {
  folderPath: string | null;
  onPickFolder: () => Promise<string | null>;
  onExport: (filePaths: string[]) => Promise<void>;
  onClose: () => void;
  t: Translator;
}

/**
 * Several documents into one PDF.
 *
 * Chapter by chapter is how a longer text is actually written, and exporting
 * it one file at a time leaves the reader stitching PDFs together. Order is
 * the folder's own alphabetical order, which is why people number chapters.
 */
export function BatchExportDialog({
  folderPath,
  onPickFolder,
  onExport,
  onClose,
  t
}: BatchExportDialogProps) {
  const [folder, setFolder] = useState(folderPath);
  const [files, setFiles] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (target: string | null) => {
    if (!target) {
      setFiles([]);
      return;
    }
    const found = await window.markdownStudio.listMarkdownFiles(target);
    setFiles(found);
    setSelected(new Set(found));
  }, []);

  useEffect(() => {
    void load(folder);
  }, [folder, load]);

  function toggle(path: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const ordered = (files ?? []).filter((path) => selected.has(path));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-label={t("batch.title")}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>
          <FileDown size={18} /> {t("batch.title")}
        </h2>

        <div className="batch-folder">
          <span className="batch-folder-path" title={folder ?? ""}>
            {folder ?? t("batch.noFolder")}
          </span>
          <button
            type="button"
            onClick={() => {
              void onPickFolder().then((picked) => {
                if (picked) setFolder(picked);
              });
            }}
          >
            <FolderOpen size={14} /> {t("batch.pickFolder")}
          </button>
        </div>

        {files === null ? (
          <p className="side-empty">{t("common.loading")}</p>
        ) : files.length === 0 ? (
          <p className="side-empty">{t("batch.empty")}</p>
        ) : (
          <>
            <div className="batch-list" role="group" aria-label={t("batch.files")}>
              {files.map((path) => (
                <label key={path} className="batch-item">
                  <input
                    type="checkbox"
                    checked={selected.has(path)}
                    onChange={() => toggle(path)}
                  />
                  <span className="batch-name">{fileNameOf(path)}</span>
                  <span className="batch-path" title={path}>
                    {path}
                  </span>
                </label>
              ))}
            </div>
            <p className="batch-count">{t("batch.selected", { count: ordered.length })}</p>
          </>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy || ordered.length === 0}
            onClick={() => {
              setBusy(true);
              void onExport(ordered).finally(() => setBusy(false));
            }}
          >
            <FileDown size={15} /> {busy ? t("batch.working") : t("batch.export")}
          </button>
        </div>
      </div>
    </div>
  );
}
