import React, { useEffect, useRef, useState } from "react";
import { Eye, History, Moon, PanelRightClose, SplitSquareHorizontal, Sun } from "lucide-react";
import type { Theme, ToolbarAction, ViewMode } from "../renderer-types";

function fileBasename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

interface RecentMenuProps {
  files: string[];
  onOpen: (path: string) => void;
}

function RecentMenu({ files, onOpen }: RecentMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="recent-menu" ref={containerRef}>
      <button onClick={() => setOpen((o) => !o)} title="Ostatnio otwarte pliki">
        <History size={17} />
        <span>Ostatnie</span>
      </button>
      {open && (
        <div className="recent-dropdown" role="menu">
          {files.map((path) => (
            <button
              key={path}
              role="menuitem"
              title={path}
              onClick={() => { setOpen(false); onOpen(path); }}
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
  onViewModeChange: (mode: ViewMode) => void;
  onThemeToggle: () => void;
  onOpenRecentFile: (path: string) => void;
}

export function Toolbar({
  fileName,
  filePath,
  dirty,
  viewMode,
  theme,
  recentFiles,
  fileActions,
  onViewModeChange,
  onThemeToggle,
  onOpenRecentFile
}: ToolbarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">M</div>
        <div>
          <h1>Markdown Studio</h1>
          <span title={filePath ?? undefined}>{fileName}{dirty ? " • niezapisane" : ""}</span>
        </div>
      </div>

      <nav className="toolbar" aria-label="Pliki">
        {fileActions.map((action) => (
          <button key={action.label} onClick={() => void action.run()} title={action.label}>
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
        {recentFiles.length > 0 && (
          <RecentMenu files={recentFiles} onOpen={onOpenRecentFile} />
        )}
      </nav>

      <div className="right-tools">
        <div className="segmented" aria-label="Tryb widoku">
          <button
            className={viewMode === "editor" ? "active" : ""}
            onClick={() => onViewModeChange("editor")}
            title="Tylko edytor"
          >
            <PanelRightClose size={16} />
          </button>
          <button
            className={viewMode === "split" ? "active" : ""}
            onClick={() => onViewModeChange("split")}
            title="Edytor i podgląd"
          >
            <SplitSquareHorizontal size={16} />
          </button>
          <button
            className={viewMode === "preview" ? "active" : ""}
            onClick={() => onViewModeChange("preview")}
            title="Tylko podgląd"
          >
            <Eye size={16} />
          </button>
        </div>
        <button className="icon-button" onClick={onThemeToggle} title="Przełącz motyw">
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  );
}
