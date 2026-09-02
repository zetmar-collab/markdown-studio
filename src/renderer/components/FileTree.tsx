import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import type { Translator } from "../../shared/i18n";
import type { FileTreeEntry } from "../../types/electron-api";

interface FileTreeProps {
  rootPath: string | null;
  activeFilePath: string | null;
  onPickFolder: () => void;
  onOpenFile: (path: string) => void;
  t: Translator;
}

interface NodeProps {
  entry: FileTreeEntry;
  depth: number;
  activeFilePath: string | null;
  onOpenFile: (path: string) => void;
}

function TreeNode({ entry, depth, activeFilePath, onOpenFile }: NodeProps) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<FileTreeEntry[] | null>(null);

  useEffect(() => {
    if (!open || children) return;
    let cancelled = false;
    void window.markdownStudio.listFolder(entry.path).then((list) => {
      if (!cancelled) setChildren(list);
    });
    return () => {
      cancelled = true;
    };
  }, [open, children, entry.path]);

  if (!entry.isDirectory) {
    return (
      <button
        type="button"
        className={`tree-item${entry.path === activeFilePath ? " active" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        title={entry.path}
        onClick={() => onOpenFile(entry.path)}
      >
        <FileText size={14} />
        <span>{entry.name}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="tree-item tree-folder"
        style={{ paddingLeft: 8 + depth * 14 }}
        title={entry.path}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {open ? <FolderOpen size={14} /> : <Folder size={14} />}
        <span>{entry.name}</span>
      </button>
      {open &&
        children?.map((child) => (
          <TreeNode
            key={child.path}
            entry={child}
            depth={depth + 1}
            activeFilePath={activeFilePath}
            onOpenFile={onOpenFile}
          />
        ))}
    </>
  );
}

export function FileTree({ rootPath, activeFilePath, onPickFolder, onOpenFile, t }: FileTreeProps) {
  const [entries, setEntries] = useState<FileTreeEntry[]>([]);

  const reload = useCallback(async () => {
    if (!rootPath) {
      setEntries([]);
      return;
    }
    setEntries(await window.markdownStudio.listFolder(rootPath));
  }, [rootPath]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <aside className="filetree-pane" aria-label={t("pane.files")}>
      <div className="pane-title pane-title-actions">
        <span className="pane-title-label">
          <Folder size={15} />
          <span>{t("pane.files")}</span>
        </span>
        <button type="button" className="pane-action" onClick={onPickFolder}>
          {t("pane.chooseFolder")}
        </button>
      </div>
      {!rootPath ? (
        <p className="side-empty">{t("pane.filesEmpty")}</p>
      ) : (
        <div className="tree-list">
          {entries.map((entry) => (
            <TreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              activeFilePath={activeFilePath}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
