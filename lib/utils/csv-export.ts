/** Serializes rows of string/number/null values to CSV text, RFC 4180-style quoting. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const escape = (value: string | number | null): string => {
    const s = value === null ? "" : String(value);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  return lines.join("\r\n");
}
