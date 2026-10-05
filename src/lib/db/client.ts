import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { d1Db, type D1Like } from "./d1";
import { scopeSql, type ScopeUser } from "./scope";
import type { Db, Tx } from "./types";

export type { Db, Tx } from "./types";

const g = globalThis as unknown as { __itgoDb?: Promise<Db> };

/** The D1 binding when running on Cloudflare (wrangler.jsonc "DB"), otherwise undefined. */
function d1Binding(): D1Like | undefined {
  try {
    return (getCloudflareContext().env as { DB?: D1Like }).DB;
  } catch {
    return undefined; // next dev / tests / scripts: not inside a Worker
  }
}

/**
 * Cloudflare → D1 (binding "DB"; schema via `wrangler d1 migrations apply`).
 * Otherwise a local SQLite file per server process (survives dev hot reloads), created and
 * seeded with content + demo accounts on first use.
 */
export function getDb(): Promise<Db> {
  const d1 = d1Binding();
  if (d1) return Promise.resolve(d1Db(d1));
  g.__itgoDb ??= import("./open").then((m) =>
    m.openDatabase({
      // "memory" keeps everything in RAM (integration tests).
      dataDir: process.env.ITGO_DATA_DIR === "memory" ? undefined : (process.env.ITGO_DATA_DIR ?? ".data"),
      reset: process.env.ITGO_RESET_DB === "1",
      seedDemo: true,
    }),
  );
  return g.__itgoDb;
}

function scoped(db: Db, user: ScopeUser | null): Tx {
  return {
    query: (sql, params) => db.query(scopeSql(sql, user), params),
    exec: () => Promise.reject(new Error("exec is not available in a scoped transaction")),
  };
}

/**
 * Runs `fn` with reads limited to what the given user may see (src/lib/db/scope.ts) — the
 * same rules RLS enforced on Postgres. Read-only: write with asService after a permission check.
 */
export async function asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  const p = (await db.query<{ role: ScopeUser["role"]; organization_id: string | null; is_approved: boolean }>(
    "select role, organization_id, is_approved from profiles where id = $1",
    [userId],
  )).rows[0];
  const user: ScopeUser = p
    ? { id: userId, role: p.role, organizationId: p.organization_id, approved: p.is_approved }
    : { id: userId, role: "student", organizationId: null, approved: false };
  return fn(scoped(db, user));
}

/** Read-only access as a signed-out visitor (signup lists, track list). */
export async function asAnon<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return fn(scoped(await getDb(), null));
}

/**
 * Unrestricted access. Only for server-verified work such as engine results, signup and admin
 * actions — the caller must check authorization first.
 */
export async function asService<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(fn);
}
