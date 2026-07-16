/**
 * CSV builder — pure in-process, no file system.
 * Returns a CSV string from an array of objects.
 * Keys of the first row become headers.
 */

function escapeCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  // Quote if contains comma, newline, or double-quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';

  // noUncheckedIndexedAccess: rows[0] is `T | undefined`; we've guarded above
  const firstRow = rows[0];
  if (firstRow === undefined) return '';

  const headers = Object.keys(firstRow);
  const headerLine = headers.map(escapeCell).join(',');

  const dataLines = rows.map((row) =>
    headers.map((h) => {
      // noUncheckedIndexedAccess: h is a known key from Object.keys so access is safe
      const val: unknown = (row as Record<string, unknown>)[h];
      return escapeCell(val);
    }).join(',')
  );

  return [headerLine, ...dataLines].join('\n');
}
