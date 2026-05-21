import type { ReactNode } from "react";

export type Theme = "light" | "dark";
export type ViewMode = "split" | "editor" | "preview";

export interface ToolbarAction {
  label: string;
  icon: ReactNode;
  run: () => void | Promise<void>;
}

export interface DocStats {
  words: number;
  characters: number;
  lines: number;
}

export interface Tab {
  id:       string;
  content:  string;
  filePath: string | null;
  fileName: string;
  dirty:    boolean;
}
