import React from "react";
import { Replace, Search } from "lucide-react";
import type { ToolbarAction } from "../renderer-types";

interface FormatBarProps {
  formatActions: ToolbarAction[];
  query: string;
  replacement: string;
  onQueryChange: (q: string) => void;
  onReplacementChange: (r: string) => void;
  onFindNext: () => void;
  onReplaceOne: () => void;
  onReplaceAll: () => void;
}

export function FormatBar({
  formatActions,
  query,
  replacement,
  onQueryChange,
  onReplacementChange,
  onFindNext,
  onReplaceOne,
  onReplaceAll
}: FormatBarProps) {
  return (
    <section className="formatbar" aria-label="Formatowanie">
      {formatActions.map((action) => (
        <button key={action.label} onClick={() => void action.run()} title={action.label}>
          {action.icon}
        </button>
      ))}
      <div className="findbar">
        <Search size={15} />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onFindNext()}
          placeholder="Szukaj"
        />
        <Replace size={15} />
        <input
          value={replacement}
          onChange={(e) => onReplacementChange(e.target.value)}
          placeholder="Zamień na"
        />
        <button onClick={onReplaceOne}>Raz</button>
        <button onClick={onReplaceAll}>Wszystko</button>
      </div>
    </section>
  );
}
