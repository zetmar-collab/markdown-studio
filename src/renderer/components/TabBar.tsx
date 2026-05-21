import React from "react";
import { Plus, X } from "lucide-react";
import type { Tab } from "../renderer-types";

interface TabBarProps {
  tabs:       Tab[];
  activeId:   string;
  onSwitch:   (id: string) => void;
  onClose:    (id: string) => void;
  onNew:      () => void;
}

export function TabBar({ tabs, activeId, onSwitch, onClose, onNew }: TabBarProps) {
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
      <button
        className="tab-new"
        onClick={onNew}
        title="Nowa zakładka (Ctrl+T)"
        aria-label="Nowa zakładka"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
