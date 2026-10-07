/**
 * Simple CSV parser that handles quoted fields (with commas and newlines inside quotes).
 * Returns an array of objects keyed by header names.
 */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        currentRow.push(currentField.trim());
        if (currentRow.length > 1 || currentRow[0] !== '') {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        if (ch === '\r') i++; // skip \n after \r
      } else {
        currentField += ch;
      }
    }
  }

  // last field/row
  currentRow.push(currentField.trim());
  if (currentRow.length > 1 || currentRow[0] !== '') {
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? '';
    });
    return obj;
  });
}

/** Fetch a CSV file from public/data/ and parse it */
export async function fetchCSV(filename: string): Promise<Record<string, string>[]> {
  const res = await fetch(`/data/${filename}`);
  if (!res.ok) throw new Error(`Failed to fetch /data/${filename}: ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}
