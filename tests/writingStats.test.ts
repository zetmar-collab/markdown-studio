import { describe, expect, it } from "vitest";
import {
  charactersAdded,
  currentStreak,
  dayKey,
  EMPTY_STATS,
  MAX_DAYS,
  normalizeStats,
  recentDays,
  recordEdit,
  statsForDay,
  type WritingStats
} from "../src/shared/writingStats";

const at = (iso: string) => new Date(iso);

describe("charactersAdded", () => {
  it("counts growth", () => {
    expect(charactersAdded("abc", "abcdef")).toBe(3);
  });

  it("treats deletion as zero, not as negative writing", () => {
    // A day's total that drops while tidying up would tell the user nothing.
    expect(charactersAdded("abcdef", "abc")).toBe(0);
    expect(charactersAdded("abc", "")).toBe(0);
  });

  it("counts a paste like anything else", () => {
    expect(charactersAdded("", "x".repeat(5000))).toBe(5000);
  });
});

describe("recordEdit", () => {
  it("opens a day on the first edit", () => {
    const { stats } = recordEdit(EMPTY_STATS, 10, at("2026-11-15T09:30:00"), null);
    expect(statsForDay(stats, "2026-11-15")).toEqual({
      day: "2026-11-15",
      charactersAdded: 10,
      activeMinutes: 1
    });
  });

  it("adds within the same day", () => {
    const first = recordEdit(EMPTY_STATS, 10, at("2026-11-15T09:30:00"), null);
    const second = recordEdit(first.stats, 5, at("2026-11-15T09:31:00"), first.minute);
    expect(statsForDay(second.stats, "2026-11-15").charactersAdded).toBe(15);
  });

  it("counts a minute once however many edits it holds", () => {
    const first = recordEdit(EMPTY_STATS, 2, at("2026-11-15T09:30:00"), null);
    const second = recordEdit(first.stats, 2, at("2026-11-15T09:30:40"), first.minute);
    const third = recordEdit(second.stats, 2, at("2026-11-15T09:31:10"), second.minute);
    expect(statsForDay(third.stats, "2026-11-15").activeMinutes).toBe(2);
  });

  it("keeps days apart", () => {
    const first = recordEdit(EMPTY_STATS, 10, at("2026-11-14T23:59:00"), null);
    const second = recordEdit(first.stats, 7, at("2026-11-15T00:01:00"), first.minute);
    expect(statsForDay(second.stats, "2026-11-14").charactersAdded).toBe(10);
    expect(statsForDay(second.stats, "2026-11-15").charactersAdded).toBe(7);
  });

  it("does nothing for a deletion inside a minute already counted", () => {
    const first = recordEdit(EMPTY_STATS, 10, at("2026-11-15T09:30:00"), null);
    const second = recordEdit(first.stats, 0, at("2026-11-15T09:30:30"), first.minute);
    expect(second.stats).toBe(first.stats);
  });

  it("does not grow past the retention limit", () => {
    let stats: WritingStats = EMPTY_STATS;
    let minute: string | null = null;
    for (let i = 0; i < MAX_DAYS + 20; i += 1) {
      const date = new Date("2026-01-01T10:00:00");
      date.setDate(date.getDate() + i);
      const result = recordEdit(stats, 1, date, minute);
      stats = result.stats;
      minute = result.minute;
    }
    expect(stats.days.length).toBe(MAX_DAYS);
  });
});

describe("recentDays", () => {
  it("fills in days with nothing written", () => {
    const { stats } = recordEdit(EMPTY_STATS, 10, at("2026-11-15T09:00:00"), null);
    const week = recentDays(stats, 7, at("2026-11-15T20:00:00"));
    expect(week).toHaveLength(7);
    expect(week.at(-1)!.charactersAdded).toBe(10);
    expect(week[0].charactersAdded).toBe(0);
  });

  it("ends on today", () => {
    const week = recentDays(EMPTY_STATS, 3, at("2026-11-15T20:00:00"));
    expect(week.at(-1)!.day).toBe("2026-11-15");
    expect(week[0].day).toBe("2026-11-13");
  });
});

describe("currentStreak", () => {
  it("counts consecutive days up to today", () => {
    let stats: WritingStats = EMPTY_STATS;
    let minute: string | null = null;
    for (const iso of ["2026-11-13T10:00:00", "2026-11-14T10:00:00", "2026-11-15T10:00:00"]) {
      const result = recordEdit(stats, 5, at(iso), minute);
      stats = result.stats;
      minute = result.minute;
    }
    expect(currentStreak(stats, at("2026-11-15T22:00:00"))).toBe(3);
  });

  it("is zero when nothing was written today", () => {
    const { stats } = recordEdit(EMPTY_STATS, 5, at("2026-11-14T10:00:00"), null);
    expect(currentStreak(stats, at("2026-11-15T10:00:00"))).toBe(0);
  });

  it("stops at a gap", () => {
    let stats: WritingStats = EMPTY_STATS;
    let minute: string | null = null;
    for (const iso of ["2026-11-11T10:00:00", "2026-11-14T10:00:00", "2026-11-15T10:00:00"]) {
      const result = recordEdit(stats, 5, at(iso), minute);
      stats = result.stats;
      minute = result.minute;
    }
    expect(currentStreak(stats, at("2026-11-15T22:00:00"))).toBe(2);
  });
});

describe("normalizeStats", () => {
  it("accepts what it wrote itself", () => {
    const { stats } = recordEdit(EMPTY_STATS, 10, at("2026-11-15T09:00:00"), null);
    expect(normalizeStats(stats)).toEqual(stats);
  });

  it("drops junk rather than throwing", () => {
    expect(normalizeStats(null)).toEqual(EMPTY_STATS);
    expect(normalizeStats("x")).toEqual(EMPTY_STATS);
    expect(normalizeStats({ days: "nie lista" })).toEqual(EMPTY_STATS);
    expect(normalizeStats({ days: [null, 7, { day: "wczoraj" }] }).days).toEqual([]);
  });

  it("repairs impossible counts", () => {
    const repaired = normalizeStats({
      days: [{ day: "2026-11-15", charactersAdded: -5, activeMinutes: Number.NaN }],
      dailyGoal: -10
    });
    expect(repaired.days[0]).toEqual({ day: "2026-11-15", charactersAdded: 0, activeMinutes: 0 });
    expect(repaired.dailyGoal).toBe(0);
  });
});

describe("dayKey", () => {
  it("pads the month and the day", () => {
    expect(dayKey(at("2026-01-05T10:00:00"))).toBe("2026-01-05");
  });

  it("follows the local calendar, not UTC", () => {
    // Late in the evening in a positive offset the UTC date is already
    // tomorrow; the user's day is what counts here.
    const local = at("2026-11-15T23:30:00");
    expect(dayKey(local)).toBe("2026-11-15");
  });
});
