import React from "react";
import type { DocStats } from "../renderer-types";
import { APP_VERSION } from "../constants";

interface StatusBarProps {
  status: string;
  stats: DocStats;
}

export function StatusBar({ status, stats }: StatusBarProps) {
  return (
    <footer className="statusbar">
      <span>{status}</span>
      <span className="statusbar-version">v{APP_VERSION}</span>
      <span>{stats.words} słów</span>
      <span>{stats.characters} znaków</span>
      <span>{stats.lines} linii</span>
    </footer>
  );
}
