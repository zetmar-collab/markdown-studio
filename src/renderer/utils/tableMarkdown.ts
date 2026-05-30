export type TableAlign = "left" | "center" | "right";

export function generateTable(cols: number, rows: number, align: TableAlign): string {
  const sepMap: Record<TableAlign, string> = { left: " --- ", center: " :---: ", right: " ---: " };
  const sep = sepMap[align];
  const header = "|" + Array.from({ length: cols }, (_, i) => ` Kolumna ${i + 1} `).join("|") + "|";
  const divider = "|" + Array(cols).fill(sep).join("|") + "|";
  const dataRow = "|" + Array(cols).fill("   ").join("|") + "|";
  return "\n" + [header, divider, ...Array(rows).fill(dataRow)].join("\n") + "\n";
}
