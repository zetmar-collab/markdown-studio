export type TableAlign = "left" | "center" | "right";

export interface TableOptions {
  /** Header cell label, numbered from 1. Defaults to Polish "Kolumna". */
  columnLabel?: string;
}

export function generateTable(
  cols: number,
  rows: number,
  align: TableAlign,
  options: TableOptions = {}
): string {
  const label = options.columnLabel ?? "Kolumna";
  const sepMap: Record<TableAlign, string> = { left: " --- ", center: " :---: ", right: " ---: " };
  const sep = sepMap[align];
  const header =
    "|" + Array.from({ length: cols }, (_, i) => ` ${label} ${i + 1} `).join("|") + "|";
  const divider = "|" + Array(cols).fill(sep).join("|") + "|";
  const dataRow = "|" + Array(cols).fill("   ").join("|") + "|";
  return "\n" + [header, divider, ...Array(rows).fill(dataRow)].join("\n") + "\n";
}
