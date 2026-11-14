import React, { useEffect, useMemo, useState } from "react";
import { GitCompare } from "lucide-react";
import type { Translator } from "../../shared/i18n";
import type { Tab } from "../renderer-types";
import { DiffView } from "./DiffView";

interface CompareDialogProps {
  tabs: readonly Tab[];
  activeId: string;
  onClose: () => void;
  t: Translator;
}

/**
 * Compare two open documents.
 *
 * Deliberately limited to what is already open: picking files from disk would
 * mean reading arbitrary paths for a feature whose point is "what changed
 * between these two things I am working on".
 */
export function CompareDialog({ tabs, activeId, onClose, t }: CompareDialogProps) {
  const [leftId, setLeftId] = useState(() => tabs.find((tab) => tab.id !== activeId)?.id ?? "");
  const [rightId, setRightId] = useState(activeId);

  // A tab closed underneath the dialog must not leave it pointing at nothing.
  useEffect(() => {
    if (!tabs.some((tab) => tab.id === leftId)) setLeftId(tabs[0]?.id ?? "");
    if (!tabs.some((tab) => tab.id === rightId)) setRightId(tabs[0]?.id ?? "");
  }, [tabs, leftId, rightId]);

  const left = useMemo(() => tabs.find((tab) => tab.id === leftId), [tabs, leftId]);
  const right = useMemo(() => tabs.find((tab) => tab.id === rightId), [tabs, rightId]);

  const picker = (
    value: string,
    onChange: (id: string) => void,
    label: string,
    side: "left" | "right"
  ) => (
    <label className="compare-picker">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        data-side={side}
      >
        {tabs.map((tab) => (
          <option key={tab.id} value={tab.id}>
            {tab.fileName}
            {tab.dirty ? " •" : ""}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-label={t("compare.title")}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>
          <GitCompare size={18} /> {t("compare.title")}
        </h2>

        {tabs.length < 2 ? (
          <p className="side-empty">{t("compare.needsTwo")}</p>
        ) : (
          <>
            <div className="compare-pickers">
              {picker(leftId, setLeftId, t("compare.left"), "left")}
              {picker(rightId, setRightId, t("compare.right"), "right")}
            </div>
            <div className="history-diff compare-diff">
              {left && right ? (
                <DiffView before={left.content} after={right.content} t={t} />
              ) : (
                <p className="side-empty">{t("compare.needsTwo")}</p>
              )}
            </div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
