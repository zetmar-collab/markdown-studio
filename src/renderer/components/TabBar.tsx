import React from "react";
import { X } from "lucide-react";
import type { Translator } from "../../shared/i18n";
import type { Tab } from "../renderer-types";
import { TemplateMenu } from "./TemplateMenu";
import type { DocumentTemplateId } from "../constants";

interface TabBarProps {
  tabs: Tab[];
  activeId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onNewTemplate: (id: DocumentTemplateId) => void;
  t: Translator;
}

export function TabBar({
  tabs,
  activeId,
  onSwitch,
  onClose,
  onNew,
  onNewTemplate,
  t
}: TabBarProps) {
  return (
    <div className="tabbar" role="tablist">
      <div className="tab-list">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeId}
            className={`tab${tab.id === activeId ? " active" : ""}`}
            onClick={() => onSwitch(tab.id)}
            onMouseDown={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                onClose(tab.id);
              }
            }}
            title={tab.filePath ?? tab.fileName}
          >
            <span className="tab-name">{tab.fileName}</span>
            {tab.dirty && (
              <span className="tab-dot" aria-hidden>
                •
              </span>
            )}
            <button
              type="button"
              className="tab-close"
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.id);
              }}
              title={`${t("common.close")} ${tab.fileName}`}
              aria-label={`${t("common.close")} ${tab.fileName}`}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <TemplateMenu onNewBlank={onNew} onNewTemplate={onNewTemplate} t={t} />
    </div>
  );
}
