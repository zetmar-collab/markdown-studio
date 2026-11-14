import React, { useMemo, useState } from "react";
import { Check, Save, Trash2 } from "lucide-react";
import type { Translator } from "../../shared/i18n";
import type { AppSettings } from "../../shared/settings";
import {
  MAX_PROFILE_NAME,
  profileMatchesSettings,
  profilePatch,
  removeProfile,
  upsertProfile
} from "../../shared/exportProfiles";

interface ExportProfilesRowProps {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  t: Translator;
}

/**
 * Page setups saved under a name.
 *
 * Applying one writes its fields into the settings, so the export dialogs and
 * the PDF renderer keep reading exactly one place — there is no second source
 * of truth to drift.
 */
export function ExportProfilesRow({ settings, onChange, t }: ExportProfilesRowProps) {
  const [name, setName] = useState("");
  const profiles = settings.exportProfiles;

  const activeId = useMemo(
    () => profiles.find((profile) => profileMatchesSettings(profile, settings))?.id ?? "",
    [profiles, settings]
  );

  function apply(id: string) {
    const profile = profiles.find((entry) => entry.id === id);
    if (profile) onChange(profilePatch(profile));
  }

  function saveCurrent() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange({ exportProfiles: upsertProfile(profiles, trimmed, settings) });
    setName("");
  }

  return (
    <div className="modal-field export-profiles">
      <span>{t("settings.exportProfiles")}</span>

      {profiles.length === 0 ? (
        <p className="side-empty">{t("settings.exportProfilesEmpty")}</p>
      ) : (
        <div className="profile-list">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`profile-row${profile.id === activeId ? " active" : ""}`}
            >
              <button
                type="button"
                className="profile-apply"
                onClick={() => apply(profile.id)}
                title={t("settings.exportProfileApply")}
              >
                <span className="profile-tick">
                  {profile.id === activeId && <Check size={13} />}
                </span>
                <span className="profile-name">{profile.name}</span>
                <span className="profile-detail">
                  {profile.pageSize}
                  {profile.landscape ? " ↔" : ""}
                </span>
              </button>
              <button
                type="button"
                className="profile-delete"
                title={t("settings.exportProfileDelete")}
                aria-label={`${t("settings.exportProfileDelete")}: ${profile.name}`}
                onClick={() => onChange({ exportProfiles: removeProfile(profiles, profile.id) })}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="profile-save">
        <input
          value={name}
          maxLength={MAX_PROFILE_NAME}
          placeholder={t("settings.exportProfileName")}
          aria-label={t("settings.exportProfileName")}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              saveCurrent();
            }
          }}
        />
        <button type="button" disabled={!name.trim()} onClick={saveCurrent}>
          <Save size={14} /> {t("settings.exportProfileSave")}
        </button>
      </div>
    </div>
  );
}
