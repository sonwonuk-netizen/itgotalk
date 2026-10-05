import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, getDb, type Db, type Tx } from "@/lib/db/client";
import { createUser } from "@/lib/db/seed";
import { loadReportByToken } from "@/lib/server/reports";

/** Row access rules (src/lib/db/scope.ts) — the guarantees Postgres RLS gave on Supabase. */

let db: Db;
const ids: Record<string, string> = {};

const as = <T>(userId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> => (userId ? asUser(userId, fn) : asAnon(fn));

const count = async (userId: string | null, sql: string, params: unknown[] = []) =>
  as(userId, async (tx) => (await tx.query<{ n: number }>(`select count(*) as n from (${sql}) q`, params)).rows[0]!.n);

beforeAll(async () => {
  db = await getDb(); // in-memory (ITGO_DATA_DIR=memory)
  const { rows } = await db.query<{ id: string; login: string }>(
    "select p.id, substr(u.email, 1, instr(u.email, '@') - 1) as login from profiles p join user_credentials u on u.id = p.id",
  );
  for (const r of rows) ids[r.login] = r.id;
  const other = (await db.query<{ id: string }>("select id from organizations where invite_code = 'SUNNY001'")).rows[0]!.id;
  ids.otherTeacher = await createUser(db, { loginId: "other", password: "x", role: "teacher", initial: "박", organizationId: other, approved: true });
  const own = (await db.query<{ id: string }>("select id from organizations where invite_code = 'ITGO2026'")).rows[0]!.id;
  ids.pending = await createUser(db, { loginId: "pending", password: "x", role: "teacher", initial: "최", organizationId: own, approved: false });
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

  it("cannot write through a scoped query (writes go through server checks)", async () => {
    await expect(
      as(ids.student1!, (tx) =>
        tx.query(
          `insert into attempts (student_id, set_id, mode, item_count, correct_count, client_elapsed_ms,
             server_started_at, server_finished_at, elapsed_ms) values ($1, 'SA-P01', 'test', 5, 5, 1, 'x', 'x', 1)`,
          [ids.student2],
        ),
      ),
    ).rejects.toThrow(/read-only/);
  });

  it("cannot read reports or write content", async () => {
    expect(await count(ids.student2!, "select id from reports")).toBe(0);
    await expect(as(ids.student2!, (tx) => tx.query("update skills set time_limit_sec = 999"))).rejects.toThrow(/read-only/);
  });
});

describe("RLS: content and anonymous access", () => {
  it("signed-in users read content; anon reads regions/schools only", async () => {
    const total = (await db.query<{ n: number }>("select count(*) as n from items")).rows[0]!.n;
    expect(total).toBeGreaterThanOrEqual(174);
    expect(await count(ids.student1!, "select id from items")).toBe(total);
    expect(await count(null, "select id from regions")).toBeGreaterThan(0);
    await expect(count(null, "select id from items")).rejects.toThrow(/permission denied/);
    await expect(count(null, "select id from profiles")).rejects.toThrow(/permission denied/);
  });

  it("parent report is reachable only through the token function, and expires", async () => {
    await db.query(
      `insert into reports (student_id, period_start, period_end, lines, share_token, expires_at)
       values ($1, '2026-09-21', '2026-10-05', '["x"]', 'tok-live', $2),
              ($1, '2026-09-07', '2026-09-21', '["y"]', 'tok-old', $3)`,
      [ids.student2, new Date(Date.now() + 30 * 86_400_000), new Date(Date.now() - 86_400_000)],
    );
    expect(await loadReportByToken("tok-live")).toMatchObject({ r: { lines: ["x"] } });
    expect(await loadReportByToken("tok-old")).toBeNull();
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
    await expect(count(ids.student1!, "select blanks from assessment_items")).rejects.toThrow(/no such column/);
    await expect(count(ids.student1!, "select model_answer from assessment_items")).rejects.toThrow(/no such column/);
    await expect(count(ids.student1!, "select teacher_note from assessment_sections")).rejects.toThrow(/no such column/);
    expect(await count(ids.student1!, "select id from assessment_items_staff")).toBe(0);
    expect(await count(ids.student1!, "select id from assessment_sections_staff")).toBe(0);
  });

  it("approved staff and admins see answers; unapproved teachers do not", async () => {
    expect(await count(ids.teacher!, "select id from assessment_items_staff where blanks <> '[]'")).toBeGreaterThan(100);
    expect(await count(ids.admin!, "select id from assessment_items_staff")).toBe(129);
    expect(await count(ids.pending!, "select id from assessment_items_staff")).toBe(0);
  });

  it("content cannot be changed through a scoped query, even by an admin", async () => {
    for (const who of [ids.student1!, ids.teacher!, ids.admin!]) {
      await expect(as(who, (tx) => tx.query("update assessment_items set label = 'x'"))).rejects.toThrow(/read-only/);
    }
  });
});

describe("scoped queries: rule plumbing", () => {
  it("applies rules inside a query's own WITH clause and subqueries", async () => {
    const sql = "with x as (select id from profiles where role = 'student') select id from x where id in (select student_id from guardians)";
    expect(await count(ids.teacher!, sql)).toBe(2);
    expect(await count(ids.otherTeacher!, sql)).toBe(0);
  });

  it("cannot reach real tables through main.<table> or read credentials", async () => {
    await expect(count(ids.otherTeacher!, "select id from main.profiles")).rejects.toThrow(/permission denied/);
    await expect(count(ids.admin!, "select id from user_credentials")).rejects.toThrow(/permission denied/);
  });

  it("teacher screens only return the teacher's own organization", async () => {
    const { listStudents, loadStudentDetail } = await import("@/lib/server/teacher");
    expect((await listStudents(ids.teacher!)).map((s) => s.id).sort()).toEqual([ids.student1, ids.student2].sort());
    expect(await listStudents(ids.otherTeacher!)).toEqual([]);
    expect(await loadStudentDetail(ids.otherTeacher!, ids.student2!)).toBeNull();
    expect((await loadStudentDetail(ids.teacher!, ids.student2!))?.attempts.length).toBeGreaterThan(0);
  });
});
