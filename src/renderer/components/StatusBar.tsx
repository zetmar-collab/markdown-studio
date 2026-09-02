import React from "react";
import type { Translator } from "../../shared/i18n";
import type { DocStats } from "../renderer-types";
import { APP_VERSION } from "../constants";

interface StatusBarProps {
  status: string;
  stats: DocStats;
  t: Translator;
}

export function StatusBar({ status, stats, t }: StatusBarProps) {
  return (
    <footer className="statusbar">
      <span className="statusbar-message" title={status}>
        {status}
      </span>
      <span className="statusbar-version">v{APP_VERSION}</span>
      <span>{t("status.words", { count: stats.words })}</span>
      <span>{t("status.characters", { count: stats.characters })}</span>
      <span>{t("status.lines", { count: stats.lines })}</span>
      <span>{t("status.readingTime", { count: stats.readingMinutes })}</span>
    </footer>
  );
}
