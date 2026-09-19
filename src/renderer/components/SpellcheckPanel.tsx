import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, ExternalLink, Search, Trash2 } from "lucide-react";
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

/** Per-language state of the "install dictionary" button. */
type InstallState = "idle" | "working" | "installed" | "unavailable" | "failed";

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
  const [installed, setInstalled] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, InstallState>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void window.markdownStudio.getSpellLanguages().then(setAvailable);
  }, []);

  const refreshWords = useCallback(() => {
    void window.markdownStudio.listDictionaryWords().then(setWords);
  }, []);

  useEffect(refreshWords, [refreshWords]);

  // Which of the chosen languages already have a dictionary file on disk.
  useEffect(() => {
    if (selected.length === 0) {
      setInstalled([]);
      return;
    }
    void window.markdownStudio.installedDictionaries(selected).then(setInstalled);
  }, [selected]);

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

  async function install(code: string) {
    setStates((current) => ({ ...current, [code]: "working" }));
    setMessage(null);
    const result = await window.markdownStudio.installDictionary(code);
    const name = languageDisplayName(code, uiLanguage);
    if (result.status === "installed" || result.status === "already") {
      setStates((current) => ({ ...current, [code]: "installed" }));
      setInstalled((current) => (current.includes(code) ? current : [...current, code]));
      setMessage(t("settings.dictionaryInstalledFor", { language: name }));
    } else if (result.status === "unavailable") {
      setStates((current) => ({ ...current, [code]: "unavailable" }));
      setMessage(t("settings.dictionaryUnavailable"));
    } else {
      setStates((current) => ({ ...current, [code]: "failed" }));
      setMessage(t("settings.dictionaryFailed", { error: result.error }));
    }
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
          const state = states[code] ?? (installed.includes(code) ? "installed" : "idle");
          return (
            <div key={code} className={`spellcheck-row${active ? " active" : ""}`}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                disabled={!enabled}
                className="spellcheck-item"
                onClick={() => toggle(code)}
              >
                <span className="spellcheck-tick">{active && <Check size={13} />}</span>
                <span className="spellcheck-name">{languageDisplayName(code, uiLanguage)}</span>
                <span className="spellcheck-code">{code}</span>
              </button>
              {active &&
                (state === "installed" ? (
                  <span className="spellcheck-installed" title={t("settings.dictionaryInstalled")}>
                    <Check size={12} />
                    {t("settings.dictionaryInstalled")}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="spellcheck-install"
                    disabled={!enabled || state === "working"}
                    onClick={() => void install(code)}
                  >
                    <Download size={12} />
                    {state === "working"
                      ? t("settings.dictionaryInstalling")
                      : t("settings.dictionaryInstall")}
                  </button>
                ))}
            </div>
          );
        })}
      </div>

      <p className="spellcheck-hint">{t("settings.spellcheckDownloadHint")}</p>
      <p className="spellcheck-hint">{t("settings.spellcheckWindowsHint")}</p>
      <button
        type="button"
        className="spellcheck-windows-link"
        onClick={() => void window.markdownStudio.openLanguageSettings()}
      >
        <ExternalLink size={12} />
        {t("settings.openWindowsLanguages")}
      </button>
      {message && <p className="spellcheck-message">{message}</p>}

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
