import React from "react";
import { CaseSensitive, Regex, Replace, Search } from "lucide-react";
import type { Translator } from "../../shared/i18n";
import type { ToolbarAction } from "../renderer-types";

export interface FindSettings {
  regex: boolean;
  caseSensitive: boolean;
}

interface FormatBarProps {
  formatActions: ToolbarAction[];
  query: string;
  replacement: string;
  findSettings: FindSettings;
  onFindSettingsChange: (settings: FindSettings) => void;
  onQueryChange: (query: string) => void;
  onReplacementChange: (replacement: string) => void;
  onFindNext: () => void;
  onReplaceOne: () => void;
  onReplaceAll: () => void;
  t: Translator;
}

export function FormatBar({
  formatActions,
  query,
  replacement,
  findSettings,
  onFindSettingsChange,
  onQueryChange,
  onReplacementChange,
  onFindNext,
  onReplaceOne,
  onReplaceAll,
  t
}: FormatBarProps) {
  return (
    <section className="formatbar" aria-label={t("format.bold")}>
      {formatActions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => void action.run()}
          title={action.label}
          aria-label={action.label}
        >
          {action.icon}
        </button>
      ))}
      <div className="findbar">
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && onFindNext()}
          placeholder={t("find.search")}
          aria-label={t("find.search")}
        />
        <button
          type="button"
          className={`find-toggle${findSettings.regex ? " active" : ""}`}
          title={t("find.regex")}
          aria-pressed={findSettings.regex}
          onClick={() => onFindSettingsChange({ ...findSettings, regex: !findSettings.regex })}
        >
          <Regex size={15} />
        </button>
        <button
          type="button"
          className={`find-toggle${findSettings.caseSensitive ? " active" : ""}`}
          title={t("find.caseSensitive")}
          aria-pressed={findSettings.caseSensitive}
          onClick={() =>
            onFindSettingsChange({ ...findSettings, caseSensitive: !findSettings.caseSensitive })
          }
        >
          <CaseSensitive size={15} />
        </button>
        <Replace size={15} />
        <input
          value={replacement}
          onChange={(event) => onReplacementChange(event.target.value)}
          placeholder={t("find.replaceWith")}
          aria-label={t("find.replaceWith")}
        />
        <button type="button" onClick={onReplaceOne}>
          {t("find.once")}
        </button>
        <button type="button" onClick={onReplaceAll}>
          {t("find.all")}
        </button>
      </div>
    </section>
  );
}
