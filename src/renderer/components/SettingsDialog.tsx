import React, { useEffect } from "react";
import type { Translator } from "../../shared/i18n";
import { LANGUAGES } from "../../shared/i18n";
import { PAGE_SIZES, type AppSettings } from "../../shared/settings";
import { SpellcheckPanel } from "./SpellcheckPanel";
import { ExportProfilesRow } from "./ExportProfilesRow";

interface SettingsDialogProps {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  onReset: () => void;
  onClose: () => void;
  /** Store packages update through the Store, so that toggle is hidden. */
  isStoreBuild: boolean;
  t: Translator;
}

const LANGUAGE_LABELS: Record<string, string> = { pl: "Polski", en: "English" };

export function SettingsDialog({
  settings,
  onChange,
  onReset,
  onClose,
  isStoreBuild,
  t
}: SettingsDialogProps) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
      >
        <h2>{t("settings.title")}</h2>

        <div className="settings-grid">
          <label className="modal-field">
            <span>{t("settings.language")}</span>
            <select
              value={settings.language}
              onChange={(event) =>
                onChange({ language: event.target.value as AppSettings["language"] })
              }
            >
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {LANGUAGE_LABELS[language] ?? language}
                </option>
              ))}
            </select>
          </label>

          <label className="modal-field">
            <span>{t("settings.editorFontSize")}</span>
            <input
              type="number"
              min={9}
              max={32}
              value={settings.editorFontSize}
              onChange={(event) => onChange({ editorFontSize: Number(event.target.value) })}
            />
          </label>

          <label className="modal-field">
            <span>{t("settings.previewFontSize")}</span>
            <input
              type="number"
              min={10}
              max={36}
              value={settings.previewFontSize}
              onChange={(event) => onChange({ previewFontSize: Number(event.target.value) })}
            />
          </label>

          <label className="modal-field modal-check">
            <input
              type="checkbox"
              checked={settings.autosaveEnabled}
              onChange={(event) => onChange({ autosaveEnabled: event.target.checked })}
            />
            <span>{t("settings.autosave")}</span>
          </label>

          <label className="modal-field">
            <span>{t("settings.autosaveInterval")}</span>
            <input
              type="number"
              min={5}
              max={3600}
              disabled={!settings.autosaveEnabled}
              value={settings.autosaveIntervalSeconds}
              onChange={(event) =>
                onChange({ autosaveIntervalSeconds: Number(event.target.value) })
              }
            />
          </label>

          <label className="modal-field modal-check">
            <input
              type="checkbox"
              checked={settings.spellcheckEnabled}
              onChange={(event) => onChange({ spellcheckEnabled: event.target.checked })}
            />
            <span>{t("settings.spellcheck")}</span>
          </label>

          <div className="modal-field modal-field-wide">
            <span>{t("settings.spellcheckLanguage")}</span>
            <SpellcheckPanel
              enabled={settings.spellcheckEnabled}
              selected={settings.spellcheckLanguages}
              uiLanguage={settings.language}
              onChange={(spellcheckLanguages) => onChange({ spellcheckLanguages })}
              t={t}
            />
          </div>

          <ExportProfilesRow settings={settings} onChange={onChange} t={t} />

          <label className="modal-field">
            <span>{t("settings.exportTheme")}</span>
            <select
              value={settings.exportTheme}
              onChange={(event) =>
                onChange({ exportTheme: event.target.value as AppSettings["exportTheme"] })
              }
            >
              <option value="app">{t("settings.exportThemeApp")}</option>
              <option value="light">{t("menu.themeLight")}</option>
              <option value="dark">{t("menu.themeDark")}</option>
            </select>
          </label>

          <label className="modal-field">
            <span>{t("settings.pageSize")}</span>
            <select
              value={settings.pageSize}
              onChange={(event) =>
                onChange({ pageSize: event.target.value as AppSettings["pageSize"] })
              }
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <label className="modal-field modal-check">
            <input
              type="checkbox"
              checked={settings.landscape}
              onChange={(event) => onChange({ landscape: event.target.checked })}
            />
            <span>{t("settings.landscape")}</span>
          </label>

          <div className="modal-field modal-field-wide">
            <span>{t("settings.margins")}</span>
            <div className="margin-inputs">
              {(["top", "right", "bottom", "left"] as const).map((side) => (
                <input
                  key={side}
                  type="number"
                  min={0}
                  max={100}
                  aria-label={side}
                  title={side}
                  value={settings.margins[side]}
                  onChange={(event) =>
                    onChange({
                      margins: { ...settings.margins, [side]: Number(event.target.value) }
                    })
                  }
                />
              ))}
            </div>
          </div>

          <label className="modal-field modal-check">
            <input
              type="checkbox"
              checked={settings.pageNumbers}
              onChange={(event) => onChange({ pageNumbers: event.target.checked })}
            />
            <span>{t("settings.pageNumbers")}</span>
          </label>

          <label className="modal-field">
            <span>{t("settings.headerText")}</span>
            <input
              value={settings.headerText}
              onChange={(event) => onChange({ headerText: event.target.value })}
            />
          </label>

          <label className="modal-field">
            <span>{t("settings.footerText")}</span>
            <input
              value={settings.footerText}
              onChange={(event) => onChange({ footerText: event.target.value })}
            />
          </label>

          <label className="modal-field modal-check">
            <input
              type="checkbox"
              checked={settings.mermaidEnabled}
              onChange={(event) => onChange({ mermaidEnabled: event.target.checked })}
            />
            <span>{t("settings.mermaid")}</span>
          </label>

          <label className="modal-field modal-check">
            <input
              type="checkbox"
              checked={settings.mathEnabled}
              onChange={(event) => onChange({ mathEnabled: event.target.checked })}
            />
            <span>{t("settings.math")}</span>
          </label>

          {!isStoreBuild && (
            <label className="modal-field modal-check">
              <input
                type="checkbox"
                checked={settings.autoUpdateEnabled}
                onChange={(event) => onChange({ autoUpdateEnabled: event.target.checked })}
              />
              <span>{t("settings.autoUpdate")}</span>
            </label>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onReset}>
            {t("settings.restoreDefaults")}
          </button>
          <button type="button" className="primary" onClick={onClose}>
            {t("settings.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
