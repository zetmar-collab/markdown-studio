/**
 * How much was written, per day.
 *
 * The status bar already counts words in the current document, which says
 * nothing about whether today went well. This counts characters actually added
 * across all documents and keeps a short history, so the question "did I write
 * anything this week" has an answer.
 *
 * Only growth is counted. Deleting a paragraph is editing, not negative
 * writing, and a day's total that goes down as you tidy up would be useless.
 */

export interface DayStat {
  /** Local calendar day, "YYYY-MM-DD". */
  day: string;
  charactersAdded: number;
  /** Minutes in which at least one change was made. */
  activeMinutes: number;
}

export interface WritingStats {
  days: DayStat[];
  /** Goal in characters per day; 0 means no goal. */
  dailyGoal: number;
}

export const MAX_DAYS = 120;
export const EMPTY_STATS: WritingStats = { days: [], dailyGoal: 0 };

export function dayKey(at: Date = new Date()): string {
  const year = at.getFullYear();
  const month = String(at.getMonth() + 1).padStart(2, "0");
  const day = String(at.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** A change big enough to be a paste rather than typing still counts once. */
export function charactersAdded(before: string, after: string): number {
  const growth = after.length - before.length;
  return growth > 0 ? growth : 0;
}

/**
 * Fold one edit into the running totals.
 *
 * `minuteStamp` is the minute the edit happened in; a minute is counted as
 * active the first time something lands in it, which makes "active minutes" a
 * measure of time spent rather than of keystrokes.
 */
export function recordEdit(
  stats: WritingStats,
  added: number,
  at: Date,
  lastMinute: string | null
): { stats: WritingStats; minute: string } {
  const day = dayKey(at);
  const minute = `${day}T${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  const isNewMinute = minute !== lastMinute;

  if (added <= 0 && !isNewMinute) return { stats, minute };

  const days = [...stats.days];
  const index = days.findIndex((entry) => entry.day === day);
  const current: DayStat = index >= 0 ? days[index] : { day, charactersAdded: 0, activeMinutes: 0 };
  const updated: DayStat = {
    day,
    charactersAdded: current.charactersAdded + Math.max(0, added),
    activeMinutes: current.activeMinutes + (isNewMinute ? 1 : 0)
  };

  if (index >= 0) days[index] = updated;
  else days.push(updated);

  days.sort((a, b) => a.day.localeCompare(b.day));
  return { stats: { ...stats, days: days.slice(-MAX_DAYS) }, minute };
}

export function statsForDay(stats: WritingStats, day: string): DayStat {
  return (
    stats.days.find((entry) => entry.day === day) ?? { day, charactersAdded: 0, activeMinutes: 0 }
  );
}

/** The last `count` days ending today, including days with nothing written. */
export function recentDays(stats: WritingStats, count: number, today = new Date()): DayStat[] {
  const result: DayStat[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    result.push(statsForDay(stats, dayKey(date)));
  }
  return result;
}

/** Consecutive days up to today with any writing at all. */
export function currentStreak(stats: WritingStats, today = new Date()): number {
  let streak = 0;
  for (let offset = 0; offset < MAX_DAYS; offset += 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    if (statsForDay(stats, dayKey(date)).charactersAdded > 0) streak += 1;
    else break;
  }
  return streak;
}

/** Drop anything that is not a well-formed stats record. */
export function normalizeStats(raw: unknown): WritingStats {
  if (!raw || typeof raw !== "object") return EMPTY_STATS;
  const candidate = raw as Partial<WritingStats>;
  const days = Array.isArray(candidate.days)
    ? candidate.days
        .filter(
          (entry): entry is DayStat =>
            Boolean(entry) &&
            typeof entry === "object" &&
            typeof (entry as DayStat).day === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test((entry as DayStat).day)
        )
        .map((entry) => ({
          day: entry.day,
          charactersAdded: clampCount(entry.charactersAdded),
          activeMinutes: clampCount(entry.activeMinutes)
        }))
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(-MAX_DAYS)
    : [];
  const dailyGoal = clampCount(candidate.dailyGoal);
  return { days, dailyGoal };
}

function clampCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(Math.min(value, 10_000_000));
}
