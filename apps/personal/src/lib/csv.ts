/** RFC 4180 CSV with a BOM so Excel opens UTF-8 correctly. */
export function toCsv(rows: object[], columns: string[]): string {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Neutralise spreadsheet formulas.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [
    columns.join(","),
    ...rows.map((r) => columns.map((c) => cell((r as Record<string, unknown>)[c])).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
