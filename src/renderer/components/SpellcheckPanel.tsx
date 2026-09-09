import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Search, Trash2 } from "lucide-react";
import type { Language, Translator } from "../../shared/i18n";
import {
  languageDisplayName,
  matchesLanguageQuery,
  sortByDisplayName
} from "../../shared/spellcheck";

interface SpellcheckPanelProps {
  enabled: boolean;
  selected: string[];
  uiLanguage: Language;
  onChange: (languages: string[]) => void;
  t: Translator;
}

/**
 * Language picker and personal dictionary, the way a desktop word processor
 * offers them: several languages active at once, the full list of dictionaries
 * Chromium can fetch, and the words the user taught it.
 */
export function SpellcheckPanel({
  enabled,
  selected,
  uiLanguage,
  onChange,
  t
}: SpellcheckPanelProps) {
  const [available, setAvailable] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [words, setWords] = useState<string[]>([]);

  useEffect(() => {
    void window.markdownStudio.getSpellLanguages().then(setAvailable);
  }, []);

  const refreshWords = useCallback(() => {
    void window.markdownStudio.listDictionaryWords().then(setWords);
  }, []);

  useEffect(refreshWords, [refreshWords]);

  // Selected languages float to the top so the active set is never hidden
  // behind 50-odd other entries.
  const ordered = useMemo(() => {
    const rest = sortByDisplayName(
      available.filter((code) => !selected.includes(code)),
      uiLanguage
    );
    return [...selected.filter((code) => available.includes(code)), ...rest];
  }, [available, selected, uiLanguage]);

  const visible = useMemo(
    () => ordered.filter((code) => matchesLanguageQuery(code, query, uiLanguage)),
    [ordered, query, uiLanguage]
  );

  function toggle(code: string) {
    onChange(
      selected.includes(code) ? selected.filter((entry) => entry !== code) : [...selected, code]
    );
  }

  async function forget(word: string) {
    await window.markdownStudio.removeWordFromDictionary(word);
    refreshWords();
  }

  return (
    <div className="spellcheck-panel" aria-disabled={!enabled}>
      <div className="spellcheck-search">
        <Search size={14} />
        <input
          value={query}
          disabled={!enabled}
          placeholder={t("settings.spellcheckSearch")}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t("settings.spellcheckSearch")}
        />
        <span className="spellcheck-count">
          {t("settings.spellcheckSelected", { count: selected.length })}
        </span>
      </div>

      <div className="spellcheck-list" role="listbox" aria-multiselectable="true">
        {visible.length === 0 && <p className="side-empty">{t("settings.spellcheckNoMatch")}</p>}
        {visible.map((code) => {
          const active = selected.includes(code);
          return (
            <button
              key={code}
              type="button"
              role="option"
              aria-selected={active}
              disabled={!enabled}
              className={`spellcheck-item${active ? " active" : ""}`}
              onClick={() => toggle(code)}
            >
              <span className="spellcheck-tick">{active && <Check size={13} />}</span>
              <span className="spellcheck-name">{languageDisplayName(code, uiLanguage)}</span>
              <span className="spellcheck-code">{code}</span>
            </button>
          );
        })}
      </div>

      <p className="spellcheck-hint">{t("settings.spellcheckDownloadHint")}</p>

      <div className="spellcheck-words">
        <span className="spellcheck-words-title">
          {t("settings.customDictionary", { count: words.length })}
        </span>
        {words.length === 0 ? (
          <p className="side-empty">{t("settings.customDictionaryEmpty")}</p>
        ) : (
          <div className="spellcheck-word-list">
            {words.map((word) => (
              <span key={word} className="spellcheck-word">
                {word}
                <button
                  type="button"
                  title={t("settings.customDictionaryRemove")}
                  aria-label={`${t("settings.customDictionaryRemove")}: ${word}`}
                  onClick={() => void forget(word)}
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
