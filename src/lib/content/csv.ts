/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF, BOM). Returns header-keyed rows. */
export function parseCsv(text: string): { header: string[]; rows: Record<string, string>[] } {
  const src = text.replace(/^﻿/, "");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      record.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((r) => r.some((f) => f.trim() !== ""));
  const header = (nonEmpty[0] ?? []).map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { header, rows };
}
