export type CsvRecord = { row: number; values: Record<string, string> };

export class CsvImportError extends Error {}

export function parseCsv(input: string, options: { maxRows?: number } = {}): { headers: string[]; records: CsvRecord[] } {
  const maxRows = options.maxRows ?? 100;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }
    cell += character;
  }
  if (quoted) throw new CsvImportError("CSV contains an unclosed quoted field");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new CsvImportError("CSV needs a header and at least one data row");

  const headers = rows[0]!.map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim());
  if (headers.some((header) => !header)) throw new CsvImportError("CSV header contains an empty column");
  if (new Set(headers).size !== headers.length) throw new CsvImportError("CSV header contains duplicate columns");
  if (rows.length - 1 > maxRows) throw new CsvImportError(`CSV can contain at most ${maxRows} data rows`);

  const records = rows.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) throw new CsvImportError(`Row ${rowIndex + 2} has ${values.length} columns; expected ${headers.length}`);
    return { row: rowIndex + 2, values: Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])) };
  });
  return { headers, records };
}
