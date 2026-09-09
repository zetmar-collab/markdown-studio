/**
 * Application settings shared by main and renderer.
 *
 * Everything here used to be hard-coded in the source (autosave interval, page
 * size, fonts), so the user had no way to change any of it.
 */

import type { DocumentTheme } from "./documentTheme.js";
import { isLanguage, type Language } from "./i18n.js";

export type PageSize = "A4" | "A3" | "A5" | "Letter" | "Legal" | "Tabloid";

export const PAGE_SIZES: readonly PageSize[] = [
  "A4",
  "A3",
  "A5",
  "Letter",
  "Legal",
  "Tabloid"
] as const;

export type ExportThemePreference = "app" | DocumentTheme;

export interface PdfMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface AppSettings {
  language: Language;
  editorFontSize: number;
  previewFontSize: number;
  autosaveEnabled: boolean;
  autosaveIntervalSeconds: number;
  spellcheckEnabled: boolean;
  spellcheckLanguages: string[];
  exportTheme: ExportThemePreference;
  pageSize: PageSize;
  landscape: boolean;
  /** Millimetres. */
  margins: PdfMargins;
  pageNumbers: boolean;
  headerText: string;
  footerText: string;
  mermaidEnabled: boolean;
  mathEnabled: boolean;
  autoUpdateEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "pl",
  editorFontSize: 14,
  previewFontSize: 16,
  autosaveEnabled: true,
  autosaveIntervalSeconds: 30,
  spellcheckEnabled: true,
  spellcheckLanguages: ["pl", "en-US"],
  exportTheme: "app",
  pageSize: "A4",
  landscape: false,
  margins: { top: 24, right: 20, bottom: 24, left: 20 },
  pageNumbers: false,
  headerText: "",
  footerText: "",
  mermaidEnabled: true,
  mathEnabled: true,
  autoUpdateEnabled: true
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asMargins(value: unknown): PdfMargins {
  const raw = (value ?? {}) as Partial<PdfMargins>;
  const d = DEFAULT_SETTINGS.margins;
  return {
    top: clampNumber(raw.top, 0, 100, d.top),
    right: clampNumber(raw.right, 0, 100, d.right),
    bottom: clampNumber(raw.bottom, 0, 100, d.bottom),
    left: clampNumber(raw.left, 0, 100, d.left)
  };
}

/**
 * Coerce anything read from disk / IPC into a valid settings object. Settings
 * cross a process boundary, so they are treated as untrusted input.
 */
export function normalizeSettings(input: unknown): AppSettings {
  const raw = (input ?? {}) as Partial<AppSettings>;
  const pageSize = PAGE_SIZES.includes(raw.pageSize as PageSize)
    ? (raw.pageSize as PageSize)
    : DEFAULT_SETTINGS.pageSize;
  const exportTheme: ExportThemePreference =
    raw.exportTheme === "light" || raw.exportTheme === "dark" || raw.exportTheme === "app"
      ? raw.exportTheme
      : DEFAULT_SETTINGS.exportTheme;
  const spellcheckLanguages = Array.isArray(raw.spellcheckLanguages)
    ? raw.spellcheckLanguages.filter((l): l is string => typeof l === "string" && l.length > 0)
    : DEFAULT_SETTINGS.spellcheckLanguages;

  return {
    language: isLanguage(raw.language) ? raw.language : DEFAULT_SETTINGS.language,
    editorFontSize: clampNumber(raw.editorFontSize, 9, 32, DEFAULT_SETTINGS.editorFontSize),
    previewFontSize: clampNumber(raw.previewFontSize, 10, 36, DEFAULT_SETTINGS.previewFontSize),
    autosaveEnabled: asBoolean(raw.autosaveEnabled, DEFAULT_SETTINGS.autosaveEnabled),
    autosaveIntervalSeconds: clampNumber(
      raw.autosaveIntervalSeconds,
      5,
      3600,
      DEFAULT_SETTINGS.autosaveIntervalSeconds
    ),
    spellcheckEnabled: asBoolean(raw.spellcheckEnabled, DEFAULT_SETTINGS.spellcheckEnabled),
    spellcheckLanguages: spellcheckLanguages.length
      ? spellcheckLanguages
      : DEFAULT_SETTINGS.spellcheckLanguages,
    exportTheme,
    pageSize,
    landscape: asBoolean(raw.landscape, DEFAULT_SETTINGS.landscape),
    margins: asMargins(raw.margins),
    pageNumbers: asBoolean(raw.pageNumbers, DEFAULT_SETTINGS.pageNumbers),
    headerText: asString(raw.headerText, DEFAULT_SETTINGS.headerText),
    footerText: asString(raw.footerText, DEFAULT_SETTINGS.footerText),
    mermaidEnabled: asBoolean(raw.mermaidEnabled, DEFAULT_SETTINGS.mermaidEnabled),
    mathEnabled: asBoolean(raw.mathEnabled, DEFAULT_SETTINGS.mathEnabled),
    autoUpdateEnabled: asBoolean(raw.autoUpdateEnabled, DEFAULT_SETTINGS.autoUpdateEnabled)
  };
}

/** Resolve the "app" placeholder against the currently active UI theme. */
export function resolveExportTheme(
  preference: ExportThemePreference,
  appTheme: DocumentTheme
): DocumentTheme {
  return preference === "app" ? appTheme : preference;
}
