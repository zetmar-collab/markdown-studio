import { useCallback, useEffect, useRef, useState } from "react";
import {
  charactersAdded,
  currentStreak,
  dayKey,
  EMPTY_STATS,
  recordEdit,
  statsForDay,
  type WritingStats
} from "../../shared/writingStats";

const FLUSH_INTERVAL_MS = 20_000;

/**
 * Counts what gets written, without making every keystroke a disk write.
 *
 * Totals live in memory and are flushed on a timer and when the window goes
 * away. Nothing here follows the document's content anywhere — only the size
 * of the change is kept.
 */
export function useWritingStats(content: string, enabled: boolean) {
  const [stats, setStats] = useState<WritingStats>(EMPTY_STATS);
  const statsRef = useRef<WritingStats>(EMPTY_STATS);
  const previousContent = useRef<string | null>(null);
  const lastMinute = useRef<string | null>(null);
  const dirty = useRef(false);
  const loaded = useRef(false);

  useEffect(() => {
    void window.markdownStudio.readWritingStats().then((stored) => {
      statsRef.current = stored;
      setStats(stored);
      loaded.current = true;
    });
  }, []);

  const flush = useCallback(() => {
    if (!dirty.current || !loaded.current) return;
    dirty.current = false;
    void window.markdownStudio.writeWritingStats(statsRef.current);
  }, []);

  // Count the growth between renders of the active document.
  useEffect(() => {
    if (!enabled || !loaded.current) {
      previousContent.current = content;
      return;
    }
    const before = previousContent.current;
    previousContent.current = content;
    // The first value seen is the document being opened, not something typed.
    if (before === null || before === content) return;

    const added = charactersAdded(before, content);
    const result = recordEdit(statsRef.current, added, new Date(), lastMinute.current);
    lastMinute.current = result.minute;
    if (result.stats === statsRef.current) return;
    statsRef.current = result.stats;
    dirty.current = true;
    setStats(result.stats);
  }, [content, enabled]);

  // Switching documents must not count the whole new document as typed.
  useEffect(() => {
    previousContent.current = null;
  }, [enabled]);

  useEffect(() => {
    const id = window.setInterval(flush, FLUSH_INTERVAL_MS);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [flush]);

  const setDailyGoal = useCallback(
    (dailyGoal: number) => {
      const next = { ...statsRef.current, dailyGoal: Math.max(0, Math.floor(dailyGoal)) };
      statsRef.current = next;
      setStats(next);
      dirty.current = true;
      flush();
    },
    [flush]
  );

  const today = statsForDay(stats, dayKey());
  return { stats, today, streak: currentStreak(stats), setDailyGoal, flush };
}
