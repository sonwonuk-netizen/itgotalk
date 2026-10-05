import { decodeRow, encodeParam, toSqlite } from "./sqlite";
import type { Db, Tx } from "./types";

/** The parts of the Workers D1 binding used here (avoids depending on workers-types). */
export interface D1Like {
  prepare(sql: string): { bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> } };
  exec(sql: string): Promise<unknown>;
}

export function d1Db(d1: D1Like): Db {
  const tx: Tx = {
    query: async (sql, params = []) => {
      const { results } = await d1.prepare(toSqlite(sql)).bind(...params.map(encodeParam)).all<Record<string, unknown>>();
      return { rows: results.map((r) => decodeRow(r)) };
    },
    // D1's exec() takes one statement per line; run statement by statement instead.
    exec: async (sql) => {
      for (const statement of splitStatements(sql)) await d1.prepare(statement).bind().all();
    },
  };
  return { ...tx, transaction: (fn) => fn(tx), close: async () => {} };
}

/** Splits a script on semicolons outside quotes and comments. */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]!;
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
    } else if (c === "'" || c === '"') {
      quote = c;
      cur += c;
    } else if (c === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      cur += "\n";
    } else if (c === ";") {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
