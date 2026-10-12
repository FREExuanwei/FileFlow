import Papa from 'papaparse';

export function convertData(id: string, text: string): string {
  text = text.replace(/^\ufeff/, '');
  if (!text.trim()) throw new Error('This data file is empty.');
  if (id === 'csv-to-json') {
    const parsed = Papa.parse<string[]>(text, { header: false, delimiter: ',', skipEmptyLines: 'greedy' });
    if (parsed.errors.length) throw new Error(`Invalid CSV: ${parsed.errors[0]?.message ?? 'parse error'}.`);
    const [headers, ...rows] = parsed.data;
    if (!headers?.length || headers.some(h => !h.trim()) || new Set(headers).size !== headers.length) throw new Error('Invalid CSV: headers must be nonempty and unique.');
    if (rows.some(row => row.length !== headers.length)) throw new Error('Invalid CSV: a row has a different number of fields from the header.');
    if (rows.length > 100000) throw new Error('CSV exceeds the 100,000-row safety limit.');
    if (headers.length > 1000 || rows.length * headers.length > 1000000 || rows.length * (headers.reduce((sum, key) => sum + key.length * 6 + 12, 0) + 6) + text.length * 6 > 32 * 1024 ** 2) throw new Error('CSV output exceeds the browser memory safety limit (1 million cells / 32 MB estimated output).');
    return JSON.stringify(rows.map(row => Object.fromEntries(headers.map((header, i) => [header, row[i] ?? '']))), null, 2);
  }
  if (id !== 'json-to-csv') throw new Error('Unsupported data conversion.');
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('Invalid JSON. Check quotes, commas and brackets.'); }
  if (!Array.isArray(data) || data.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('JSON → CSV requires an array of flat objects.');
  if (!data.length) throw new Error('The JSON array is empty; there are no columns to export.');
  if (data.length > 100000) throw new Error('JSON exceeds the 100,000-row safety limit.');
  const rows = data as Record<string, unknown>[];
  if (rows.some(row => Object.values(row).some(value => value !== null && typeof value === 'object'))) throw new Error('Complex nested JSON → CSV is not supported in this version. Use flat objects with scalar values.');
  const fields = [...new Set(rows.flatMap(row => Object.keys(row)))];
  if (!fields.length || fields.some(field => !field.trim())) throw new Error('JSON objects must have nonempty column names.');
  if (fields.length > 1000) throw new Error('JSON exceeds the 1,000-column safety limit.');
  if (rows.length * fields.length > 1000000 || rows.length * fields.length * 4 + text.length * 6 > 32 * 1024 ** 2) throw new Error('CSV output exceeds the browser memory safety limit (1 million cells / 32 MB estimated output).');
  // Array input makes Papa Parse protect header cells as well as data cells.
  return Papa.unparse([fields, ...rows.map(row => fields.map(field => Object.hasOwn(row, field) ? row[field] : null))], { escapeFormulae: /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/ });
}
