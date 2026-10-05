/**
 * SQLite dialect glue shared by the D1 and node:sqlite drivers.
 *
 * SQLite has no boolean, json or timestamp types, so values are converted by column name:
 * the schema (migrations/0001_schema.sql) and queries follow these naming rules.
 */

/** ISO-8601 UTC "now", the same text format as Date.toISOString(). */
export const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const BOOLEAN_COLUMNS = new Set(["is_active", "is_approved", "report_opt_in", "has_diagnostic", "passed", "last_passed", "timed", "correct"]);
const JSON_COLUMNS = new Set([
  "wrong_items", "lines", "item_order", "set_ids",
  "source", "grading_kinds", "evaluation_template", "stem", "blanks", "choices", "tags",
]);
/** Timestamps: every column (or alias) ending in _at holds an ISO string and is read as a Date. */
const isTimestamp = (col: string) => col.endsWith("_at");

/** $1, $2 … → ?1, ?2 … (SQLite reads "$1" as a named parameter). */
export function toSqlite(sql: string): string {
  return sql.replace(/\$(\d+)/g, "?$1");
}

export function encodeParam(v: unknown): string | number | null {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "object") return JSON.stringify(v);
  return v as string | number;
}

export function decodeRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) out[k] = null;
    else if (BOOLEAN_COLUMNS.has(k)) out[k] = Boolean(v);
    else if (JSON_COLUMNS.has(k) && typeof v === "string") out[k] = JSON.parse(v);
    else if (isTimestamp(k) && typeof v === "string") out[k] = new Date(v);
    else if (typeof v === "bigint") out[k] = Number(v);
    else out[k] = v;
  }
  return out as T;
}
