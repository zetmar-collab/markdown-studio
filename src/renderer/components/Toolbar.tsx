import React, { useEffect, useRef, useState } from "react";
import {
  Eye,
  Folder,
  History,
  ListTree,
  Minimize2,
  Moon,
  PanelRightClose,
  Settings,
  SplitSquareHorizontal,
  Sun
} from "lucide-react";
import type { Translator } from "../../shared/i18n";
import type { Theme, ToolbarAction, ViewMode } from "../renderer-types";

function fileBasename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

interface RecentMenuProps {
  files: string[];
  label: string;
  onOpen: (path: string) => void;
}

function RecentMenu({ files, label, onOpen }: RecentMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="recent-menu" ref={containerRef}>
      <button type="button" onClick={() => setOpen((value) => !value)} title={label}>
        <History size={17} />
        <span>{label}</span>
      </button>
      {open && (
        <div className="recent-dropdown" role="menu">
          {files.map((path) => (
            <button
              key={path}
              role="menuitem"
              title={path}
              onClick={() => {
                setOpen(false);
                onOpen(path);
              }}
            >
              {fileBasename(path)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ToolbarProps {
  fileName: string;
  filePath: string | null;
  dirty: boolean;
  viewMode: ViewMode;
  theme: Theme;
  recentFiles: string[];
  fileActions: ToolbarAction[];
  outlineOpen: boolean;
  fileTreeOpen: boolean;
  focusMode: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onThemeToggle: () => void;
  onOpenRecentFile: (path: string) => void;
  onToggleOutline: () => void;
  onToggleFileTree: () => void;
  onToggleFocusMode: () => void;
  onOpenSettings: () => void;
  t: Translator;
}

export function Toolbar({
  fileName,
  filePath,
  dirty,
  viewMode,
  theme,
  recentFiles,
  fileActions,
  outlineOpen,
  fileTreeOpen,
  focusMode,
  onViewModeChange,
  onThemeToggle,
  onOpenRecentFile,
  onToggleOutline,
  onToggleFileTree,
  onToggleFocusMode,
  onOpenSettings,
  t
}: ToolbarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <img src="./app-icon.png" alt="" className="brand-mark-img" width={38} height={38} />
        <div>
          <h1>{t("app.name")}</h1>
          <span title={filePath ?? undefined}>
            {fileName}
            {dirty ? " •" : ""}
          </span>
        </div>
      </div>

      <nav className="toolbar" aria-label={t("menu.file")}>
        {fileActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => void action.run()}
            title={action.label}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
        {recentFiles.length > 0 && (
          <RecentMenu files={recentFiles} label={t("toolbar.recent")} onOpen={onOpenRecentFile} />
        )}
      </nav>

      <div className="right-tools">
        <div className="segmented" aria-label={t("menu.view")}>
          <button
            type="button"
            className={fileTreeOpen ? "active" : ""}
            onClick={onToggleFileTree}
            title={t("toolbar.files")}
            aria-pressed={fileTreeOpen}
          >
            <Folder size={16} />
          </button>
          <button
            type="button"
            className={outlineOpen ? "active" : ""}
            onClick={onToggleOutline}
            title={t("toolbar.outline")}
            aria-pressed={outlineOpen}
          >
            <ListTree size={16} />
          </button>
        </div>

        <div className="segmented" aria-label={t("menu.view")}>
          <button
            type="button"
            className={viewMode === "editor" ? "active" : ""}
            onClick={() => onViewModeChange("editor")}
            title={t("menu.viewEditor")}
          >
            <PanelRightClose size={16} />
          </button>
          <button
            type="button"
            className={viewMode === "split" ? "active" : ""}
            onClick={() => onViewModeChange("split")}
            title={t("menu.viewSplit")}
          >
            <SplitSquareHorizontal size={16} />
          </button>
          <button
            type="button"
            className={viewMode === "preview" ? "active" : ""}
            onClick={() => onViewModeChange("preview")}
            title={t("menu.viewPreview")}
          >
            <Eye size={16} />
          </button>
        </div>

        <button
          type="button"
          className={`icon-button${focusMode ? " active" : ""}`}
          onClick={onToggleFocusMode}
          title={t("toolbar.focus")}
          aria-pressed={focusMode}
        >
          <Minimize2 size={17} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onThemeToggle}
          title={t("toolbar.toggleTheme")}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onOpenSettings}
          title={t("toolbar.settings")}
        >
          <Settings size={17} />
        </button>
      </div>
    </header>
  );
}
