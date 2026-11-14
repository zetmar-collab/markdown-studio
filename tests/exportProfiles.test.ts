import { describe, expect, it } from "vitest";
import {
  cleanProfileName,
  extractProfileSettings,
  MAX_PROFILES,
  normalizeProfiles,
  profileMatchesSettings,
  removeProfile,
  upsertProfile,
  type ExportProfile
} from "../src/shared/exportProfiles";
import { DEFAULT_SETTINGS, normalizeSettings, type AppSettings } from "../src/shared/settings";

const settings = (over: Partial<AppSettings> = {}): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...over
});

describe("extractProfileSettings", () => {
  it("takes the page setup and nothing else", () => {
    const taken = extractProfileSettings(settings({ editorFontSize: 22, pageSize: "A5" }));
    expect(taken.pageSize).toBe("A5");
    expect(taken).not.toHaveProperty("editorFontSize");
  });

  it("copies the margins instead of sharing them", () => {
    const source = settings();
    const taken = extractProfileSettings(source);
    taken.margins.top = 99;
    expect(source.margins.top).not.toBe(99);
  });
});

describe("upsertProfile", () => {
  it("stores the current page setup under a name", () => {
    const list = upsertProfile([], "Raport", settings({ pageSize: "Letter", landscape: true }));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Raport", pageSize: "Letter", landscape: true });
  });

  it("saving over an existing name replaces it rather than duplicating", () => {
    const first = upsertProfile([], "Raport", settings({ pageSize: "A4" }));
    const second = upsertProfile(first, "raport", settings({ pageSize: "A3" }));
    expect(second).toHaveLength(1);
    expect(second[0].pageSize).toBe("A3");
    expect(second[0].id).toBe(first[0].id);
  });

  it("refuses a name that is only whitespace", () => {
    expect(upsertProfile([], "   ", settings())).toEqual([]);
  });

  it("drops the oldest once the list is full", () => {
    let list: ExportProfile[] = [];
    for (let i = 0; i < MAX_PROFILES + 3; i += 1) {
      list = upsertProfile(list, `Profil ${i}`, settings());
    }
    expect(list).toHaveLength(MAX_PROFILES);
    expect(list[0].name).toBe("Profil 3");
  });
});

describe("removeProfile", () => {
  it("removes exactly the one asked for", () => {
    const list = upsertProfile(upsertProfile([], "A", settings()), "B", settings());
    const left = removeProfile(list, list[0].id);
    expect(left.map((entry) => entry.name)).toEqual(["B"]);
  });

  it("is a no-op for an id that is not there", () => {
    const list = upsertProfile([], "A", settings());
    expect(removeProfile(list, "nie-ma")).toHaveLength(1);
  });
});

describe("profileMatchesSettings", () => {
  it("recognises the setup that is currently in force", () => {
    const current = settings({ pageSize: "A5", landscape: true });
    const [profile] = upsertProfile([], "Ulotka", current);
    expect(profileMatchesSettings(profile, current)).toBe(true);
  });

  it("notices a margin that was nudged", () => {
    const current = settings();
    const [profile] = upsertProfile([], "Ulotka", current);
    expect(
      profileMatchesSettings(profile, settings({ margins: { ...current.margins, top: 30 } }))
    ).toBe(false);
  });
});

describe("cleanProfileName", () => {
  it("collapses whitespace and trims", () => {
    expect(cleanProfileName("  Raport   roczny ")).toBe("Raport roczny");
  });

  it("cuts a name that would not fit the picker", () => {
    expect(cleanProfileName("x".repeat(80))).toHaveLength(40);
  });
});

describe("normalizeProfiles", () => {
  it("keeps a well-formed profile", () => {
    const stored = [{ id: "p1", name: "Raport", pageSize: "A3", landscape: true }];
    const [profile] = normalizeProfiles(stored, DEFAULT_SETTINGS);
    expect(profile).toMatchObject({ id: "p1", name: "Raport", pageSize: "A3", landscape: true });
    expect(profile.margins).toEqual(DEFAULT_SETTINGS.margins);
  });

  it("drops junk instead of throwing", () => {
    expect(normalizeProfiles("nie lista", DEFAULT_SETTINGS)).toEqual([]);
    expect(normalizeProfiles([null, 7, {}, { name: "  " }], DEFAULT_SETTINGS)).toEqual([]);
  });

  it("repairs an impossible page size or margin", () => {
    const [profile] = normalizeProfiles(
      [{ id: "p1", name: "Dziwny", pageSize: "B9", margins: { top: -5, right: 999 } }],
      DEFAULT_SETTINGS
    );
    expect(profile.pageSize).toBe(DEFAULT_SETTINGS.pageSize);
    expect(profile.margins.top).toBe(DEFAULT_SETTINGS.margins.top);
    expect(profile.margins.right).toBe(DEFAULT_SETTINGS.margins.right);
  });

  it("travels through settings normalisation", () => {
    const restored = normalizeSettings({
      exportProfiles: [{ id: "p1", name: "Raport", pageSize: "Legal" }]
    });
    expect(restored.exportProfiles).toHaveLength(1);
    expect(restored.exportProfiles[0].pageSize).toBe("Legal");
  });

  it("gives junk in the stored settings an empty list, not a crash", () => {
    expect(normalizeSettings({ exportProfiles: { a: 1 } }).exportProfiles).toEqual([]);
  });
});
