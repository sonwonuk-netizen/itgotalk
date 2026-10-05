import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Tx } from "@/lib/db/open";
import { createUser } from "@/lib/db/seed";

let db: PGlite;
const ids: Record<string, string> = {};

async function as<T>(userId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    if (userId) {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    } else {
      await tx.exec("set local role anon");
    }
    return fn(tx);
  });
}

const count = async (userId: string | null, sql: string, params: unknown[] = []) =>
  as(userId, async (tx) => (await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)).rows[0]!.n);

beforeAll(async () => {
  db = await openDatabase({ seedDemo: true }); // in-memory
  const { rows } = await db.query<{ id: string; login: string }>(
    "select p.id, split_part(u.email, '@', 1) as login from profiles p join auth.users u on u.id = p.id",
  );
  for (const r of rows) ids[r.login] = r.id;
  const other = (await db.query<{ id: string }>("select id from organizations where invite_code = 'SUNNY001'")).rows[0]!.id;
  ids.otherTeacher = await createUser(db, { loginId: "other", password: "x", role: "teacher", initial: "박", organizationId: other, approved: true });
  const own = (await db.query<{ id: string }>("select id from organizations where invite_code = 'ITGO2026'")).rows[0]!.id;
  ids.pending = await createUser(db, { loginId: "pending", password: "x", role: "teacher", initial: "최", organizationId: own, approved: false });
});

afterAll(async () => {
  await db.close();
});

describe("RLS: teachers see only their own organization (rule 5, ST-20)", () => {
  it("teacher of the same academy sees its students and their attempts", async () => {
    expect(await count(ids.teacher!, "select id from profiles where role = 'student'")).toBe(2);
    expect(await count(ids.teacher!, "select id from attempts where student_id = $1", [ids.student2])).toBeGreaterThan(0);
  });

  it("teacher of another organization sees none of them", async () => {
    expect(await count(ids.otherTeacher!, "select id from profiles where role = 'student'")).toBe(0);
    expect(await count(ids.otherTeacher!, "select id from attempts")).toBe(0);
    expect(await count(ids.otherTeacher!, "select student_id from skill_progress")).toBe(0);
    expect(await count(ids.otherTeacher!, "select id from guardians")).toBe(0);
  });

  it("unapproved teacher sees no students (ST-02)", async () => {
    expect(await count(ids.pending!, "select id from profiles where role = 'student'")).toBe(0);
    expect(await count(ids.pending!, "select id from attempts")).toBe(0);
  });

  it("org admin sees own teachers (for approval) but not other orgs' teachers", async () => {
    expect(await count(ids.director!, "select id from profiles where id = $1", [ids.pending])).toBe(1);
    expect(await count(ids.director!, "select id from profiles where id = $1", [ids.otherTeacher])).toBe(0);
  });
});

describe("RLS: students", () => {
  it("see only their own attempts and progress", async () => {
    expect(await count(ids.student1!, "select id from attempts")).toBe(0);
    expect(await count(ids.student2!, "select id from attempts")).toBeGreaterThan(0);
    expect(await count(ids.student1!, "select id from profiles")).toBe(1);
  });

  it("cannot insert an attempt for someone else", async () => {
    await expect(
      as(ids.student1!, (tx) =>
        tx.query(
          `insert into attempts (student_id, set_id, mode, item_count, correct_count, client_elapsed_ms,
             server_started_at, server_finished_at, elapsed_ms) values ($1, 'SA-P01', 'test', 5, 5, 1, now(), now(), 1)`,
          [ids.student2],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot read reports or write content", async () => {
    expect(await count(ids.student2!, "select id from reports")).toBe(0);
    await expect(as(ids.student2!, (tx) => tx.query("update skills set time_limit_sec = 999"))).resolves.toMatchObject({ affectedRows: 0 });
  });
});

describe("RLS: content and anonymous access", () => {
  it("signed-in users read content; anon reads regions/schools only", async () => {
    const total = (await db.query<{ n: number }>("select count(*)::int as n from items")).rows[0]!.n;
    expect(total).toBeGreaterThanOrEqual(174);
    expect(await count(ids.student1!, "select id from items")).toBe(total);
    expect(await count(null, "select id from regions")).toBeGreaterThan(0);
    await expect(count(null, "select id from items")).rejects.toThrow(/permission denied/);
    await expect(count(null, "select id from profiles")).rejects.toThrow(/permission denied/);
  });

  it("parent report is reachable only through the token function, and expires", async () => {
    await db.query(
      `insert into reports (student_id, period_start, period_end, lines, share_token, expires_at)
       values ($1, current_date - 14, current_date, '["x"]', 'tok-live', now() + interval '30 days'),
              ($1, current_date - 28, current_date - 14, '["y"]', 'tok-old', now() - interval '1 day')`,
      [ids.student2],
    );
    expect(await count(null, "select * from get_report_by_token('tok-live')")).toBe(1);
    expect(await count(null, "select * from get_report_by_token('tok-old')")).toBe(0);
    await expect(count(null, "select id from reports")).rejects.toThrow(/permission denied/);
    expect(await count(ids.otherTeacher!, "select id from reports")).toBe(0);
    expect(await count(ids.teacher!, "select id from reports")).toBe(2);
  });
});

describe("RLS: 진단 평가 (assessment) content", () => {
  it("anonymous users cannot read anything", async () => {
    await expect(count(null, "select id from assessment_items_student")).rejects.toThrow(/permission denied/);
    await expect(count(null, "select id from assessments")).rejects.toThrow(/permission denied/);
  });

  it("students see problems but never answers or teacher notes", async () => {
    expect(await count(ids.student1!, "select id from assessment_items_student")).toBe(129);
    const blanks = await as(ids.student1!, async (tx) =>
      (await tx.query<{ blanks: unknown }>("select blanks from assessment_items_student where id like '%s05-p2-02'")).rows[0]!.blanks,
    );
    expect(blanks).toEqual([{ id: "b1", kind: "rational" }]);
    await expect(count(ids.student1!, "select blanks from assessment_items")).rejects.toThrow(/permission denied/);
    await expect(count(ids.student1!, "select model_answer from assessment_items")).rejects.toThrow(/permission denied/);
    await expect(count(ids.student1!, "select teacher_note from assessment_sections")).rejects.toThrow(/permission denied/);
    expect(await count(ids.student1!, "select id from assessment_items_staff")).toBe(0);
    expect(await count(ids.student1!, "select id from assessment_sections_staff")).toBe(0);
  });

  it("approved staff and admins see answers; unapproved teachers do not", async () => {
    expect(await count(ids.teacher!, "select id from assessment_items_staff where blanks <> '[]'")).toBeGreaterThan(100);
    expect(await count(ids.admin!, "select id from assessment_items_staff")).toBe(129);
    expect(await count(ids.pending!, "select id from assessment_items_staff")).toBe(0);
  });

  it("only admins can change content", async () => {
    await expect(as(ids.student1!, (tx) => tx.query("update assessment_items set label = 'x'"))).resolves.toMatchObject({ affectedRows: 0 });
    await expect(as(ids.teacher!, (tx) => tx.query("update assessment_items set label = 'x'"))).resolves.toMatchObject({ affectedRows: 0 });
    const r = await as(ids.admin!, (tx) => tx.query("update assessment_items set label = label where id like '%s01-p1-01'"));
    expect(r.affectedRows).toBe(1);
  });
});
