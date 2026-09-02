import React, { useEffect, useState } from "react";
import { CaseSensitive, FolderSearch, Regex, Search, X } from "lucide-react";
import type { Translator } from "../../shared/i18n";
import type { SearchHit } from "../../types/electron-api";

interface WorkspaceSearchProps {
  open: boolean;
  initialFolder?: string | null;
  onClose: () => void;
  onOpenHit: (filePath: string, line: number) => void;
  onStatus: (msg: string) => void;
  t: Translator;
}

export function WorkspaceSearch({
  open,
  initialFolder,
  onClose,
  onOpenHit,
  onStatus,
  t
}: WorkspaceSearchProps) {
  const [folderPath, setFolderPath] = useState(initialFolder ?? "");
  const [query, setQuery] = useState("");
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [meta, setMeta] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && initialFolder) setFolderPath(initialFolder);
  }, [open, initialFolder]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  async function pickFolder() {
    const path = await window.markdownStudio.pickSearchFolder();
    if (path) setFolderPath(path);
  }

  async function runSearch() {
    if (!folderPath.trim()) {
      onStatus(t("status.pickSearchFolder"));
      return;
    }
    if (!query.trim()) {
      onStatus(t("status.enterSearchQuery"));
      return;
    }
    setBusy(true);
    try {
      const result = await window.markdownStudio.searchInFolder(folderPath, query, {
        regex,
        caseSensitive
      });
      if (result.error === "invalid-regex") {
        setHits([]);
        setMeta("");
        onStatus(t("find.badRegex"));
        return;
      }
      setHits(result.hits);
      const truncated = result.truncated ? " (limit)" : "";
      setMeta(`${result.scannedFiles} · ${result.hits.length}${truncated}`);
      onStatus(t("status.searchHits", { count: result.hits.length }));
    } catch (error) {
      onStatus(
        t("status.searchError", {
          message: error instanceof Error ? error.message : "unknown"
        })
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace-search" aria-label={t("menu.workspaceSearch")}>
      <div className="workspace-search-head">
        <FolderSearch size={16} />
        <span>{t("menu.workspaceSearch")}</span>
        <button
          type="button"
          className="workspace-search-close"
          onClick={onClose}
          title={t("common.close")}
        >
          <X size={16} />
        </button>
      </div>
      <div className="workspace-search-row">
        <input
          value={folderPath}
          onChange={(event) => setFolderPath(event.target.value)}
          placeholder={t("pane.chooseFolder")}
        />
        <button type="button" onClick={() => void pickFolder()}>
          {t("pane.chooseFolder")}
        </button>
      </div>
      <div className="workspace-search-row">
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void runSearch()}
          placeholder={t("find.search")}
        />
        <button
          type="button"
          className={`find-toggle${regex ? " active" : ""}`}
          title={t("find.regex")}
          aria-pressed={regex}
          onClick={() => setRegex((value) => !value)}
        >
          <Regex size={15} />
        </button>
        <button
          type="button"
          className={`find-toggle${caseSensitive ? " active" : ""}`}
          title={t("find.caseSensitive")}
          aria-pressed={caseSensitive}
          onClick={() => setCaseSensitive((value) => !value)}
        >
          <CaseSensitive size={15} />
        </button>
        <button type="button" className="primary" disabled={busy} onClick={() => void runSearch()}>
          {busy ? "…" : t("find.search")}
        </button>
      </div>
      {meta && <p className="workspace-search-meta">{meta}</p>}
      <ul className="workspace-search-results" role="list">
        {hits.map((hit, index) => (
          <li key={`${hit.filePath}-${hit.line}-${index}`}>
            <button
              type="button"
              onClick={() => {
                onOpenHit(hit.filePath, hit.line);
                onClose();
              }}
            >
              <strong>{hit.fileName}</strong>
              <span>
                {hit.line}:{hit.column}
              </span>
              <em>{hit.snippet}</em>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
