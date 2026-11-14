/**
 * Line diff shared by the version history and the file comparison.
 *
 * Two documents that differ in one paragraph usually share a long identical
 * head and tail, so those are trimmed first and the real work happens on what
 * is left. For the remainder this is an ordinary LCS table, which is quadratic
 * — fine for the few hundred changed lines a Markdown document produces, and
 * guarded by `MAX_LCS_LINES` so a pathological pair degrades into "this block
 * was replaced" instead of freezing the window.
 */

export type DiffKind = "equal" | "added" | "removed";

export interface DiffRow {
  kind: DiffKind;
  text: string;
  /** 1-based line number in the old document, null for an added line. */
  oldLine: number | null;
  /** 1-based line number in the new document, null for a removed line. */
  newLine: number | null;
}

export interface DiffSummary {
  added: number;
  removed: number;
  /** True when the documents are identical line for line. */
  identical: boolean;
  /** True when the pair was too large to align precisely. */
  approximate: boolean;
}

export interface DiffResult {
  rows: DiffRow[];
  summary: DiffSummary;
}

/** Beyond this the LCS table costs more memory than the answer is worth. */
const MAX_LCS_LINES = 1500;

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.replace(/\r\n/g, "\n").split("\n");
}

export function diffLines(oldText: string, newText: string): DiffResult {
  const before = splitLines(oldText);
  const after = splitLines(newText);

  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head += 1;

  let tail = 0;
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail += 1;
  }

  const middleBefore = before.slice(head, before.length - tail);
  const middleAfter = after.slice(head, after.length - tail);

  const rows: DiffRow[] = [];
  for (let i = 0; i < head; i += 1) {
    rows.push({ kind: "equal", text: before[i], oldLine: i + 1, newLine: i + 1 });
  }

  const approximate = middleBefore.length > MAX_LCS_LINES || middleAfter.length > MAX_LCS_LINES;
  const middleRows = approximate
    ? replaceWholeBlock(middleBefore, middleAfter, head)
    : alignByLcs(middleBefore, middleAfter, head);
  rows.push(...middleRows);

  for (let i = 0; i < tail; i += 1) {
    const oldIndex = before.length - tail + i;
    const newIndex = after.length - tail + i;
    rows.push({
      kind: "equal",
      text: before[oldIndex],
      oldLine: oldIndex + 1,
      newLine: newIndex + 1
    });
  }

  const added = rows.filter((row) => row.kind === "added").length;
  const removed = rows.filter((row) => row.kind === "removed").length;
  return {
    rows,
    summary: { added, removed, identical: added === 0 && removed === 0, approximate }
  };
}

/** Everything in the middle is reported as replaced; used only past the cap. */
function replaceWholeBlock(before: string[], after: string[], offset: number): DiffRow[] {
  const rows: DiffRow[] = [];
  before.forEach((text, i) => {
    rows.push({ kind: "removed", text, oldLine: offset + i + 1, newLine: null });
  });
  after.forEach((text, i) => {
    rows.push({ kind: "added", text, oldLine: null, newLine: offset + i + 1 });
  });
  return rows;
}

function alignByLcs(before: string[], after: string[], offset: number): DiffRow[] {
  const rowsCount = before.length;
  const columnsCount = after.length;
  // table[i][j] = length of the longest common subsequence of the suffixes.
  const table: number[][] = Array.from({ length: rowsCount + 1 }, () =>
    new Array<number>(columnsCount + 1).fill(0)
  );
  for (let i = rowsCount - 1; i >= 0; i -= 1) {
    for (let j = columnsCount - 1; j >= 0; j -= 1) {
      table[i][j] =
        before[i] === after[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < rowsCount && j < columnsCount) {
    if (before[i] === after[j]) {
      rows.push({
        kind: "equal",
        text: before[i],
        oldLine: offset + i + 1,
        newLine: offset + j + 1
      });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      rows.push({ kind: "removed", text: before[i], oldLine: offset + i + 1, newLine: null });
      i += 1;
    } else {
      rows.push({ kind: "added", text: after[j], oldLine: null, newLine: offset + j + 1 });
      j += 1;
    }
  }
  while (i < rowsCount) {
    rows.push({ kind: "removed", text: before[i], oldLine: offset + i + 1, newLine: null });
    i += 1;
  }
  while (j < columnsCount) {
    rows.push({ kind: "added", text: after[j], oldLine: null, newLine: offset + j + 1 });
    j += 1;
  }
  return rows;
}

/**
 * Collapse long stretches of unchanged lines, keeping `context` of them on each
 * side of a change — the usual way a diff stays readable.
 */
export function collapseUnchanged(rows: readonly DiffRow[], context = 3): (DiffRow | "gap")[] {
  const keep = new Array<boolean>(rows.length).fill(false);
  rows.forEach((row, index) => {
    if (row.kind === "equal") return;
    for (
      let i = Math.max(0, index - context);
      i <= Math.min(rows.length - 1, index + context);
      i += 1
    ) {
      keep[i] = true;
    }
  });

  const result: (DiffRow | "gap")[] = [];
  let gapOpen = false;
  rows.forEach((row, index) => {
    if (keep[index]) {
      result.push(row);
      gapOpen = false;
    } else if (!gapOpen) {
      result.push("gap");
      gapOpen = true;
    }
  });
  return result;
}
