import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Db } from "./types";

const DIR = path.join(process.cwd(), "migrations");

/** migrations/*.sql in filename order — the same files `wrangler d1 migrations apply` uses. */
export function migrationFiles(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(DIR, f));
}

/** Local databases only; D1 tracks its own migrations in d1_migrations. */
export async function migrate(db: Db): Promise<string[]> {
  await db.exec(`create table if not exists _migrations (name text primary key, applied_at text default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))`);
  const done = new Set((await db.query<{ name: string }>("select name from _migrations")).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const file of migrationFiles()) {
    const name = path.basename(file);
    if (done.has(name)) continue;
    await db.exec(`begin; ${readFileSync(file, "utf8")}\n; insert into _migrations (name) values ('${name}'); commit;`);
    applied.push(name);
  }
  return applied;
}
