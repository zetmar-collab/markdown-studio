/**
 * Saved page setups.
 *
 * Margins, page size, orientation, header, footer and page numbers are set
 * once per kind of document and then re-entered by hand every time the kind
 * changes — a report wants different margins from a handout. A profile is just
 * those fields under a name.
 */
import type { AppSettings, PageSize, PdfMargins } from "./settings.js";

/** The settings a profile carries. Everything else stays as the user has it. */
export const PROFILE_FIELDS = [
  "pageSize",
  "landscape",
  "margins",
  "pageNumbers",
  "headerText",
  "footerText",
  "exportTheme"
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];

export type ExportProfileSettings = Pick<AppSettings, ProfileField>;

export interface ExportProfile extends ExportProfileSettings {
  id: string;
  name: string;
}

export const MAX_PROFILES = 20;
export const MAX_PROFILE_NAME = 40;

/** The page setup currently in force, ready to be stored under a name. */
export function extractProfileSettings(settings: AppSettings): ExportProfileSettings {
  return {
    pageSize: settings.pageSize,
    landscape: settings.landscape,
    margins: { ...settings.margins },
    pageNumbers: settings.pageNumbers,
    headerText: settings.headerText,
    footerText: settings.footerText,
    exportTheme: settings.exportTheme
  };
}

/** The patch that puts a profile into force. */
export function profilePatch(profile: ExportProfile): ExportProfileSettings {
  return extractProfileSettings(profile as unknown as AppSettings);
}

/** Does the page setup in force match this profile? */
export function profileMatchesSettings(profile: ExportProfile, settings: AppSettings): boolean {
  const current = extractProfileSettings(settings);
  return (
    current.pageSize === profile.pageSize &&
    current.landscape === profile.landscape &&
    current.pageNumbers === profile.pageNumbers &&
    current.headerText === profile.headerText &&
    current.footerText === profile.footerText &&
    current.exportTheme === profile.exportTheme &&
    marginsEqual(current.margins, profile.margins)
  );
}

function marginsEqual(a: PdfMargins, b: PdfMargins): boolean {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}

/** Trim a name the user typed; empty names are rejected by the caller. */
export function cleanProfileName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, MAX_PROFILE_NAME);
}

export function makeProfileId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Add or replace a profile.
 *
 * A name that is already taken replaces that profile instead of creating a
 * second one with the same label, which is what the user means by saving over
 * it. The oldest falls off once the list is full.
 */
export function upsertProfile(
  profiles: readonly ExportProfile[],
  name: string,
  settings: AppSettings
): ExportProfile[] {
  const cleaned = cleanProfileName(name);
  if (!cleaned) return [...profiles];

  const existing = profiles.find((profile) => profile.name.toLowerCase() === cleaned.toLowerCase());
  const entry: ExportProfile = {
    id: existing?.id ?? makeProfileId(),
    name: cleaned,
    ...extractProfileSettings(settings)
  };

  const without = profiles.filter((profile) => profile.id !== entry.id);
  const next = [...without, entry];
  return next.slice(Math.max(0, next.length - MAX_PROFILES));
}

export function removeProfile(profiles: readonly ExportProfile[], id: string): ExportProfile[] {
  return profiles.filter((profile) => profile.id !== id);
}

/** Keep only entries that are shaped like a profile; junk is dropped silently. */
export function normalizeProfiles(raw: unknown, fallbackFor: AppSettings): ExportProfile[] {
  if (!Array.isArray(raw)) return [];
  const defaults = extractProfileSettings(fallbackFor);
  const seen = new Set<string>();
  const result: ExportProfile[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<ExportProfile>;
    const name = typeof candidate.name === "string" ? cleanProfileName(candidate.name) : "";
    if (!name) continue;
    const id = typeof candidate.id === "string" && candidate.id ? candidate.id : makeProfileId();
    if (seen.has(id)) continue;
    seen.add(id);

    result.push({
      id,
      name,
      pageSize: isPageSize(candidate.pageSize) ? candidate.pageSize : defaults.pageSize,
      landscape:
        typeof candidate.landscape === "boolean" ? candidate.landscape : defaults.landscape,
      margins: normalizeMargins(candidate.margins, defaults.margins),
      pageNumbers:
        typeof candidate.pageNumbers === "boolean" ? candidate.pageNumbers : defaults.pageNumbers,
      headerText: typeof candidate.headerText === "string" ? candidate.headerText : "",
      footerText: typeof candidate.footerText === "string" ? candidate.footerText : "",
      exportTheme: isExportTheme(candidate.exportTheme)
        ? candidate.exportTheme
        : defaults.exportTheme
    });
    if (result.length >= MAX_PROFILES) break;
  }
  return result;
}

const PAGE_SIZES: readonly PageSize[] = ["A4", "A3", "A5", "Letter", "Legal", "Tabloid"];

function isPageSize(value: unknown): value is PageSize {
  return PAGE_SIZES.includes(value as PageSize);
}

function isExportTheme(value: unknown): value is AppSettings["exportTheme"] {
  return value === "app" || value === "light" || value === "dark";
}

function normalizeMargins(raw: unknown, fallback: PdfMargins): PdfMargins {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const candidate = raw as Partial<PdfMargins>;
  const pick = (value: unknown, backup: number) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
      ? value
      : backup;
  return {
    top: pick(candidate.top, fallback.top),
    right: pick(candidate.right, fallback.right),
    bottom: pick(candidate.bottom, fallback.bottom),
    left: pick(candidate.left, fallback.left)
  };
}
