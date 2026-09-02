/**
 * Enter-key behaviour for lists, task lists and blockquotes.
 *
 * Pure and line-based so it can be unit tested without CodeMirror.
 */

export interface ListLine {
  indent: string;
  /** "-", "*", "+" for bullets; the digits for ordered lists; ">" for quotes. */
  marker: string;
  ordered: boolean;
  quote: boolean;
  task: boolean;
  /** Delimiter after an ordered marker: "." or ")". */
  delimiter: string;
  /** Text after the marker (and after the task checkbox, if any). */
  content: string;
  number: number | null;
}

const BULLET_RE = /^(\s*)([-*+])\s+(\[[ xX]\]\s+)?(.*)$/;
const ORDERED_RE = /^(\s*)(\d+)([.)])\s+(\[[ xX]\]\s+)?(.*)$/;
const QUOTE_RE = /^(\s*)(>+)\s?(.*)$/;

export function parseListLine(line: string): ListLine | null {
  const ordered = ORDERED_RE.exec(line);
  if (ordered) {
    return {
      indent: ordered[1],
      marker: ordered[2],
      ordered: true,
      quote: false,
      task: Boolean(ordered[4]),
      delimiter: ordered[3],
      content: ordered[5],
      number: Number(ordered[2])
    };
  }

  const bullet = BULLET_RE.exec(line);
  if (bullet) {
    return {
      indent: bullet[1],
      marker: bullet[2],
      ordered: false,
      quote: false,
      task: Boolean(bullet[3]),
      delimiter: "",
      content: bullet[4],
      number: null
    };
  }

  const quote = QUOTE_RE.exec(line);
  if (quote) {
    return {
      indent: quote[1],
      marker: quote[2],
      ordered: false,
      quote: true,
      task: false,
      delimiter: "",
      content: quote[3],
      number: null
    };
  }

  return null;
}

export type ContinuationAction =
  /** Insert this text at the cursor (newline included). */
  | { kind: "insert"; text: string }
  /**
   * The item is empty, so Enter ends the list: replace the whole line with
   * `replacement` (usually "") and put the cursor after it.
   */
  | { kind: "clear"; replacement: string };

/**
 * What pressing Enter at the end of `line` should do.
 * Returns null when the line is not a list/quote and default behaviour applies.
 */
export function getListContinuation(line: string): ContinuationAction | null {
  const parsed = parseListLine(line);
  if (!parsed) return null;

  if (parsed.content.trim() === "") {
    // Second Enter on an empty item: drop the marker instead of nesting forever.
    return { kind: "clear", replacement: "" };
  }

  if (parsed.quote) {
    return { kind: "insert", text: `\n${parsed.indent}${parsed.marker} ` };
  }

  const checkbox = parsed.task ? "[ ] " : "";
  if (parsed.ordered && parsed.number !== null) {
    return {
      kind: "insert",
      text: `\n${parsed.indent}${parsed.number + 1}${parsed.delimiter} ${checkbox}`
    };
  }
  return { kind: "insert", text: `\n${parsed.indent}${parsed.marker} ${checkbox}` };
}

/**
 * Renumber a run of ordered list items so inserting in the middle does not
 * leave "1. 2. 2. 3.". Operates on the whole document text.
 */
export function renumberOrderedLists(text: string): string {
  const lines = text.split("\n");
  // indent -> next expected number for the currently open run
  let counters = new Map<string, number>();
  let previousWasOrdered = false;

  for (let i = 0; i < lines.length; i++) {
    const parsed = parseListLine(lines[i]);
    if (!parsed || !parsed.ordered || parsed.number === null) {
      if (lines[i].trim() === "" && previousWasOrdered) continue; // blank line inside a list
      counters = new Map();
      previousWasOrdered = false;
      continue;
    }
    const next = (counters.get(parsed.indent) ?? 0) + 1;
    counters.set(parsed.indent, next);
    // Deeper levels restart once we come back up.
    for (const key of [...counters.keys()]) {
      if (key.length > parsed.indent.length) counters.delete(key);
    }
    const checkbox = parsed.task ? "[ ] " : "";
    lines[i] = `${parsed.indent}${next}${parsed.delimiter} ${checkbox}${parsed.content}`;
    previousWasOrdered = true;
  }
  return lines.join("\n");
}

export interface OrderedBlock {
  /** Inclusive zero-based line indices of the contiguous ordered-list run. */
  startLine: number;
  endLine: number;
  /** The renumbered lines, joined with "\n". */
  text: string;
}

/**
 * Renumber only the ordered-list run containing `index`.
 *
 * Whole-document renumbering would rewrite lists the user is not editing, so
 * the editor applies this narrower version after inserting a new item.
 */
export function renumberOrderedBlockAt(lines: string[], index: number): OrderedBlock | null {
  const isOrdered = (line: string | undefined) => {
    if (line === undefined) return false;
    const parsed = parseListLine(line);
    return Boolean(parsed?.ordered);
  };

  if (!isOrdered(lines[index])) return null;

  let startLine = index;
  while (startLine > 0 && isOrdered(lines[startLine - 1])) startLine -= 1;

  let endLine = index;
  while (endLine < lines.length - 1 && isOrdered(lines[endLine + 1])) endLine += 1;

  const slice = lines.slice(startLine, endLine + 1).join("\n");
  const renumbered = renumberOrderedLists(slice);
  if (renumbered === slice) return null;

  return { startLine, endLine, text: renumbered };
}
