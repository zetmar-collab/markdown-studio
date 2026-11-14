import React, { useMemo } from "react";
import type { Translator } from "../../shared/i18n";
import { collapseUnchanged, diffLines } from "../../shared/lineDiff";

interface DiffViewProps {
  before: string;
  after: string;
  t: Translator;
  /** Unchanged lines kept on each side of a change. */
  context?: number;
}

/**
 * A unified diff of two documents, shared by the version history and the
 * comparison of two tabs. Long stretches of unchanged text collapse to a single
 * marker so a one-line change in a long document stays one screen.
 */
export function DiffView({ before, after, t, context = 3 }: DiffViewProps) {
  const { rows, summary } = useMemo(() => diffLines(before, after), [before, after]);
  const visible = useMemo(() => collapseUnchanged(rows, context), [rows, context]);

  if (summary.identical) {
    return <p className="diff-identical">{t("diff.identical")}</p>;
  }

  return (
    <div className="diff-view">
      <p className="diff-summary">
        <span className="diff-count added">+{summary.added}</span>
        <span className="diff-count removed">−{summary.removed}</span>
        {summary.approximate && <span className="diff-approximate">{t("diff.approximate")}</span>}
      </p>
      <div className="diff-rows" role="table">
        {visible.map((entry, index) =>
          entry === "gap" ? (
            <div key={`gap-${index}`} className="diff-gap" role="row">
              ⋯
            </div>
          ) : (
            <div key={`${entry.kind}-${index}`} className={`diff-row ${entry.kind}`} role="row">
              <span className="diff-line-number">{entry.oldLine ?? ""}</span>
              <span className="diff-line-number">{entry.newLine ?? ""}</span>
              <span className="diff-sign">
                {entry.kind === "added" ? "+" : entry.kind === "removed" ? "−" : " "}
              </span>
              <span className="diff-text">{entry.text || " "}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
