import React from "react";
import { X } from "lucide-react";
import type { Tab } from "../renderer-types";
import { TemplateMenu } from "./TemplateMenu";
import type { DocumentTemplateId } from "../constants";

interface TabBarProps {
  tabs:       Tab[];
  activeId:   string;
  onSwitch:   (id: string) => void;
  onClose:    (id: string) => void;
  onNew:      () => void;
  onNewTemplate: (id: DocumentTemplateId) => void;
}

export function TabBar({ tabs, activeId, onSwitch, onClose, onNew, onNewTemplate }: TabBarProps) {
  return (
    <div className="tabbar" role="tablist">
      <div className="tab-list">
        {tabs.map(tab => (
          <div
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeId}
            className={`tab${tab.id === activeId ? " active" : ""}`}
            onClick={() => onSwitch(tab.id)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                onClose(tab.id);
              }
            }}
            title={tab.filePath ?? tab.fileName}
          >
            <span className="tab-name">{tab.fileName}</span>
            {tab.dirty && <span className="tab-dot" aria-hidden>•</span>}
            <button
              className="tab-close"
              onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              title={`Zamknij ${tab.fileName}`}
              aria-label={`Zamknij ${tab.fileName}`}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <TemplateMenu onNewBlank={onNew} onNewTemplate={onNewTemplate} />
    </div>
  );
}
