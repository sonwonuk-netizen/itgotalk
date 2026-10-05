/**
 * The database API the app uses. Two implementations share the SQLite dialect:
 * Cloudflare D1 in production (src/lib/db/d1.ts) and node:sqlite for local dev and tests
 * (src/lib/db/node-sqlite.ts).
 *
 * Queries use $1, $2 … placeholders; params may be Date, boolean, arrays/objects (stored as JSON).
 */
export interface Tx {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers pass the row type
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** Runs one or more statements without parameters (migrations). */
  exec(sql: string): Promise<unknown>;
}

export interface Db extends Tx {
  /**
   * Runs `fn` with this database. D1 has no interactive transactions, so this does not make
   * `fn` atomic: write code so each statement is safe on its own (see finishPlay's claim step).
   */
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
