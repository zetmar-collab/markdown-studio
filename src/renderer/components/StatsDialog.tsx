import React, { useMemo, useState } from "react";
import { Flame, LineChart } from "lucide-react";
import type { Language, Translator } from "../../shared/i18n";
import { recentDays, type DayStat, type WritingStats } from "../../shared/writingStats";

interface StatsDialogProps {
  stats: WritingStats;
  today: DayStat;
  streak: number;
  language: Language;
  onSetGoal: (goal: number) => void;
  onClose: () => void;
  t: Translator;
}

const DAYS_SHOWN = 14;

function weekdayLabel(day: string, language: Language): string {
  const date = new Date(`${day}T12:00:00`);
  return date.toLocaleDateString(language === "pl" ? "pl-PL" : "en-US", { weekday: "narrow" });
}

/** Characters written per day, which is the only number that answers "did I write today". */
export function StatsDialog({
  stats,
  today,
  streak,
  language,
  onSetGoal,
  onClose,
  t
}: StatsDialogProps) {
  const [goal, setGoal] = useState(String(stats.dailyGoal || ""));
  const days = useMemo(() => recentDays(stats, DAYS_SHOWN), [stats]);
  const peak = useMemo(() => Math.max(1, ...days.map((day) => day.charactersAdded)), [days]);
  const total = useMemo(() => days.reduce((sum, day) => sum + day.charactersAdded, 0), [days]);

  const goalReached = stats.dailyGoal > 0 && today.charactersAdded >= stats.dailyGoal;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-label={t("stats.title")}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>
          <LineChart size={18} /> {t("stats.title")}
        </h2>

        <div className="stats-cards">
          <div className="stats-card">
            <span className="stats-value">{today.charactersAdded.toLocaleString()}</span>
            <span className="stats-label">{t("stats.today")}</span>
          </div>
          <div className="stats-card">
            <span className="stats-value">{today.activeMinutes}</span>
            <span className="stats-label">{t("stats.activeMinutes")}</span>
          </div>
          <div className="stats-card">
            <span className="stats-value">
              <Flame size={16} /> {streak}
            </span>
            <span className="stats-label">{t("stats.streak")}</span>
          </div>
          <div className="stats-card">
            <span className="stats-value">{total.toLocaleString()}</span>
            <span className="stats-label">{t("stats.fortnight")}</span>
          </div>
        </div>

        <div className="stats-chart" role="img" aria-label={t("stats.chartLabel")}>
          {days.map((day) => (
            <div
              key={day.day}
              className="stats-bar-column"
              title={`${day.day}: ${day.charactersAdded}`}
            >
              <div className="stats-bar-track">
                <div
                  className={`stats-bar${stats.dailyGoal > 0 && day.charactersAdded >= stats.dailyGoal ? " reached" : ""}`}
                  style={{ height: `${Math.round((day.charactersAdded / peak) * 100)}%` }}
                />
              </div>
              <span className="stats-bar-label">{weekdayLabel(day.day, language)}</span>
            </div>
          ))}
        </div>

        <label className="modal-field">
          <span>{t("stats.goal")}</span>
          <div className="stats-goal-row">
            <input
              type="number"
              min={0}
              step={100}
              value={goal}
              placeholder="0"
              onChange={(event) => setGoal(event.target.value)}
              onBlur={() => onSetGoal(Number(goal) || 0)}
            />
            {goalReached && <span className="stats-goal-met">{t("stats.goalMet")}</span>}
          </div>
        </label>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
