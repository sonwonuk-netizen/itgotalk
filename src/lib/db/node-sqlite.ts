import { DatabaseSync } from "node:sqlite";
import { decodeRow, encodeParam, toSqlite } from "./sqlite";
import type { Db, Tx } from "./types";

/** Local SQLite file (dev) or ":memory:" (tests) with the same dialect as D1. */
export function nodeSqliteDb(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec("pragma foreign_keys = on");
  if (path !== ":memory:") db.exec("pragma journal_mode = wal");

  const tx: Tx = {
    query: async (sql, params = []) => {
      const rows = db.prepare(toSqlite(sql)).all(...params.map(encodeParam)) as Record<string, unknown>[];
      return { rows: rows.map((r) => decodeRow(r)) };
    },
    exec: async (sql) => db.exec(sql),
  };
  // Like D1: no interactive transactions (concurrent requests share this one connection).
  return { ...tx, transaction: (fn) => fn(tx), close: async () => db.close() };
}
