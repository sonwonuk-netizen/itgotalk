import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { seedContentFromFiles, seedDemoData, seedExplanationsFromFile } from "./seed";

export type Tx = Transaction | PGlite;

const ROOT = process.cwd();

/** Local stub first, then the Supabase migrations in filename order. */
export function migrationFiles(): string[] {
  const local = path.join(ROOT, "db/local");
  const supa = path.join(ROOT, "supabase/migrations");
  const list = (dir: string) =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => path.join(dir, f));
  return [...list(local), ...list(supa)];
}

export async function migrate(db: PGlite): Promise<string[]> {
  await db.exec("create table if not exists public._migrations (name text primary key, applied_at timestamptz default now())");
  const done = new Set((await db.query<{ name: string }>("select name from public._migrations")).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const file of migrationFiles()) {
    const name = path.relative(ROOT, file).replaceAll("\\", "/");
    if (done.has(name)) continue;
    const sql = readFileSync(file, "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into public._migrations (name) values ($1)", [name]);
    });
    applied.push(name);
  }
  return applied;
}

export interface OpenOptions {
  /** Directory for persistent storage; omit for in-memory (tests). */
  dataDir?: string;
  reset?: boolean;
  seedDemo?: boolean;
}

export async function openDatabase({ dataDir, reset, seedDemo }: OpenOptions): Promise<PGlite> {
  if (dataDir && reset) rmSync(dataDir, { recursive: true, force: true });
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const db = await PGlite.create({ dataDir, extensions: { pgcrypto } });
  await migrate(db);
  const { rows } = await db.query<{ n: number }>("select count(*)::int as n from skills");
  if (rows[0]!.n === 0) {
    await seedContentFromFiles(db);
    if (seedDemo) await seedDemoData(db);
  } else {
    // Databases created before explanations existed get them on next start.
    const ex = await db.query<{ n: number }>("select count(*)::int as n from skill_explanations");
    if (ex.rows[0]!.n === 0) await seedExplanationsFromFile(db);
  }
  return db;
}
