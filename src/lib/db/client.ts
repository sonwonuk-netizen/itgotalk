import "server-only";
import type { PGlite } from "@electric-sql/pglite";
import { openDatabase } from "./open";

export type { Tx } from "./open";
import type { Tx } from "./open";

const g = globalThis as unknown as { __itgoDb?: Promise<PGlite> };

/** One embedded Postgres per server process (survives dev hot reloads). */
export function getDb(): Promise<PGlite> {
  g.__itgoDb ??= openDatabase({
    // "memory" keeps everything in RAM (integration tests).
    dataDir: process.env.ITGO_DATA_DIR === "memory" ? undefined : (process.env.ITGO_DATA_DIR ?? ".data/pglite"),
    reset: process.env.ITGO_RESET_DB === "1",
    seedDemo: true,
  });
  return g.__itgoDb;
}

/**
 * Runs `fn` as the given user under RLS — the same role/claim Supabase sets from a JWT.
 * Use for every read made on behalf of a user.
 */
export async function asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    return fn(tx);
  });
}

/** Runs `fn` as the anonymous role (parent report links, signup lists). */
export async function asAnon<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.exec("set local role anon");
    return fn(tx);
  });
}

/**
 * Service-role transaction (bypasses RLS). Only for server-verified writes such as
 * engine results, signup and admin seeding — the caller must check authorization first.
 */
export async function asService<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(fn);
}
