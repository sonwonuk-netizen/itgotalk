import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { migrate } from "./migrate";
import { nodeSqliteDb } from "./node-sqlite";
import { seedContentFromFiles, seedDemoData, seedExplanationsFromFile } from "./seed";
import type { Db } from "./types";

export type { Tx } from "./types";

export interface OpenOptions {
  /** Directory for the itgotalk.sqlite file; omit for in-memory (tests). */
  dataDir?: string;
  reset?: boolean;
  seedDemo?: boolean;
}

/** Local SQLite: migrations, then content (and demo accounts) on an empty database. */
export async function openDatabase({ dataDir, reset, seedDemo }: OpenOptions): Promise<Db> {
  let file = ":memory:";
  if (dataDir) {
    file = path.join(dataDir, "itgotalk.sqlite");
    if (reset) for (const f of [file, `${file}-wal`, `${file}-shm`]) rmSync(f, { force: true });
    mkdirSync(dataDir, { recursive: true });
  }
  const db = nodeSqliteDb(file);
  await migrate(db);
  const { rows } = await db.query<{ n: number }>("select count(*) as n from skills");
  if (rows[0]!.n === 0) {
    await db.exec("begin");
    try {
      await seedContentFromFiles(db);
      if (seedDemo) await seedDemoData(db);
      await db.exec("commit");
    } catch (e) {
      await db.exec("rollback");
      throw e;
    }
  } else {
    // Databases created before explanations existed get them on next start.
    const ex = await db.query<{ n: number }>("select count(*) as n from skill_explanations");
    if (ex.rows[0]!.n === 0) await seedExplanationsFromFile(db);
  }
  return db;
}
