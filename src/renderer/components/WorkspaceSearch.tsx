import React, { useEffect, useState } from "react";
import { FolderSearch, Search, X } from "lucide-react";
import type { SearchHit } from "../../types/electron-api";

interface WorkspaceSearchProps {
  open: boolean;
  initialFolder?: string | null;
  onClose: () => void;
  onOpenHit: (filePath: string, line: number) => void;
  onStatus: (msg: string) => void;
}

export function WorkspaceSearch({ open, initialFolder, onClose, onOpenHit, onStatus }: WorkspaceSearchProps) {
  const [folderPath, setFolderPath] = useState(initialFolder ?? "");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [meta, setMeta] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && initialFolder) setFolderPath(initialFolder);
  }, [open, initialFolder]);

  if (!open) return null;

  async function pickFolder() {
    const path = await window.markdownStudio.pickSearchFolder();
    if (path) setFolderPath(path);
  }

  async function runSearch() {
    if (!folderPath.trim()) {
      onStatus("Wybierz folder do przeszukania");
      return;
    }
    if (!query.trim()) {
      onStatus("Wpisz frazę do wyszukania");
      return;
    }
    setBusy(true);
    try {
      const result = await window.markdownStudio.searchInFolder(folderPath, query);
      setHits(result.hits);
      const trunc = result.truncated ? " (limit plików)" : "";
      setMeta(`Przeszukano ${result.scannedFiles} plików · wyników: ${result.hits.length}${trunc}`);
      onStatus(`Znaleziono ${result.hits.length} trafień`);
    } catch (error) {
      onStatus(`Błąd wyszukiwania: ${error instanceof Error ? error.message : "nieznany"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace-search" aria-label="Szukaj w folderze">
      <div className="workspace-search-head">
        <FolderSearch size={16} />
        <span>Szukaj w plikach Markdown</span>
        <button type="button" className="workspace-search-close" onClick={onClose} title="Zamknij">
          <X size={16} />
        </button>
      </div>
      <div className="workspace-search-row">
        <input
          value={folderPath}
          onChange={(e) => setFolderPath(e.target.value)}
          placeholder="Ścieżka folderu"
          title="Folder z plikami .md"
        />
        <button type="button" onClick={() => void pickFolder()}>
          Wybierz…
        </button>
      </div>
      <div className="workspace-search-row">
        <Search size={15} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runSearch()}
          placeholder="Fraza w treści plików"
        />
        <button type="button" className="primary" disabled={busy} onClick={() => void runSearch()}>
          {busy ? "Szukam…" : "Szukaj"}
        </button>
      </div>
      {meta && <p className="workspace-search-meta">{meta}</p>}
      <ul className="workspace-search-results" role="list">
        {hits.map((hit, i) => (
          <li key={`${hit.filePath}-${hit.line}-${i}`}>
            <button
              type="button"
              onClick={() => {
                onOpenHit(hit.filePath, hit.line);
                onClose();
              }}
            >
              <strong>{hit.fileName}</strong>
              <span>
                linia {hit.line}:{hit.column}
              </span>
              <em>{hit.snippet}</em>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
