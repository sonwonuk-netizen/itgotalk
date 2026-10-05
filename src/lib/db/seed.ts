import { readFileSync } from "node:fs";
import path from "node:path";
import { hashPassword, loginIdToEmail } from "../auth/password";
import {
  validateExplanationsCsv,
  validateItemsCsv,
  validateSkillsCsv,
  validateTracksCsv,
  type ExplanationRow,
  type ItemRow,
  type RowError,
  type SkillRow,
  type TrackRow,
} from "../content/validate";
import type { Tx } from "./types";

export class ContentError extends Error {
  constructor(
    public file: string,
    public errors: RowError[],
  ) {
    super(`${file}: ${errors.map((e) => `${e.line}행 ${e.message}`).join("; ")}`);
  }
}

export async function upsertSkills(tx: Tx, skills: SkillRow[]): Promise<void> {
  // Park existing ords out of the way so reordering does not trip the unique constraint.
  await tx.query("update skills set ord = -ord - 100000 where id in (select value from json_each($1))", [skills.map((s) => s.id)]);
  for (const s of skills) {
    await tx.query(
      `insert into skills (id, ord, book, week, name, pattern, operand, hint, time_rule, time_limit_sec, practice_required, track_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (id) do update set ord = excluded.ord, book = excluded.book, week = excluded.week, track_id = excluded.track_id,
         name = excluded.name, pattern = excluded.pattern, operand = excluded.operand, hint = excluded.hint,
         time_rule = excluded.time_rule, time_limit_sec = excluded.time_limit_sec,
         practice_required = excluded.practice_required`,
      [s.id, s.ord, s.book, s.week, s.name, s.pattern, s.operand, s.hint, s.timeRule, s.timeLimitSec, s.practiceRequired, s.trackId],
    );
  }
}

/**
 * Upserts item sets and items. Item ids stay stable for unchanged (set, order) pairs;
 * items dropped from a set in the file are removed.
 */
export async function upsertItems(tx: Tx, items: ItemRow[]): Promise<{ sets: number; items: number }> {
  const sets = new Map<string, { skillId: string; page: number; rows: ItemRow[] }>();
  for (const it of items) {
    const s = sets.get(it.setId) ?? { skillId: it.skillId, page: it.page, rows: [] };
    s.rows.push(it);
    sets.set(it.setId, s);
  }
  for (const [setId, s] of sets) {
    await tx.query(
      `insert into item_sets (id, skill_id, page, ord) values ($1,$2,$3,0)
       on conflict (id) do update set skill_id = excluded.skill_id, page = excluded.page`,
      [setId, s.skillId, s.page],
    );
    for (const it of s.rows) {
      await tx.query(
        `insert into items (set_id, ord, a, op, b, blank, answer) values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (set_id, ord) do update set a = excluded.a, op = excluded.op, b = excluded.b,
           blank = excluded.blank, answer = excluded.answer`,
        [setId, it.ord, it.a, it.op, it.b, it.blank, it.answer],
      );
    }
    await tx.query("delete from items where set_id = $1 and ord not in (select value from json_each($2))", [setId, s.rows.map((r) => r.ord)]);
  }
  // Order sets inside each skill by page.
  await tx.query(`
    update item_sets as s set ord = r.rn
    from (select id, row_number() over (partition by skill_id order by page) as rn from item_sets) as r
    where r.id = s.id`);
  return { sets: sets.size, items: items.length };
}

function readContent(file: string): string {
  return readFileSync(path.join(process.cwd(), "content", file), "utf8");
}

/** Content files per track, loaded in this order. Add a pair here to add a track's problems. */
export const CONTENT_FILES: { skills: string; items: string }[] = [
  { skills: "skills.csv", items: "items_addition_sum10.csv" },
  { skills: "skills_times.csv", items: "items_times.csv" },
  { skills: "skills_tap.csv", items: "items_tap.csv" },
];

export function loadContentFiles(): { tracks: TrackRow[]; skills: SkillRow[]; items: ItemRow[] } {
  const tracks = validateTracksCsv(readContent("tracks.csv"));
  if (!tracks.ok) throw new ContentError("tracks.csv", tracks.errors);
  const trackIds = new Set(tracks.rows.map((t) => t.id));
  const allSkills: SkillRow[] = [];
  const allItems: ItemRow[] = [];
  for (const file of CONTENT_FILES) {
    const skills = validateSkillsCsv(readContent(file.skills), trackIds);
    if (!skills.ok) throw new ContentError(file.skills, skills.errors);
    const items = validateItemsCsv(readContent(file.items), new Set(skills.rows.map((s) => s.id)));
    if (!items.ok) throw new ContentError(file.items, items.errors);

    // skills.set_pages must agree with the pages present in the item file.
    const pagesBySkill = new Map<string, Set<number>>();
    for (const it of items.rows) pagesBySkill.set(it.skillId, (pagesBySkill.get(it.skillId) ?? new Set()).add(it.page));
    const errors: RowError[] = [];
    skills.rows.forEach((s, i) => {
      const have = [...(pagesBySkill.get(s.id) ?? [])].sort((a, b) => a - b).join("|");
      if (have !== s.setPages.join("|")) {
        errors.push({ line: i + 2, message: `${s.id} set_pages(${s.setPages.join("|")})와 문항 파일 페이지(${have || "없음"})가 다릅니다` });
      }
    });
    if (errors.length) throw new ContentError(file.skills, errors);
    allSkills.push(...skills.rows);
    allItems.push(...items.rows);
  }
  const dupOrd = allSkills.find((s, i) => allSkills.findIndex((o) => o.ord === s.ord) !== i);
  if (dupOrd) throw new ContentError("skills", [{ line: 0, message: `order ${dupOrd.ord}가 여러 파일에서 겹칩니다` }]);
  return { tracks: tracks.rows, skills: allSkills, items: allItems };
}

export async function upsertTracks(tx: Tx, tracks: TrackRow[]): Promise<void> {
  await tx.query("update tracks set ord = -ord - 100000 where id in (select value from json_each($1))", [tracks.map((t) => t.id)]);
  for (const t of tracks) {
    await tx.query(
      `insert into tracks (id, ord, name, description, icon, has_diagnostic) values ($1,$2,$3,$4,$5,$6)
       on conflict (id) do update set ord = excluded.ord, name = excluded.name, description = excluded.description,
         icon = excluded.icon, has_diagnostic = excluded.has_diagnostic`,
      [t.id, t.ord, t.name, t.description || null, t.icon || null, t.hasDiagnostic],
    );
  }
}

export async function seedContentFromFiles(tx: Tx): Promise<{ skills: number; sets: number; items: number; explanations: number }> {
  const { tracks, skills, items } = loadContentFiles();
  await upsertTracks(tx, tracks);
  await upsertSkills(tx, skills);
  const r = await upsertItems(tx, items);
  const explanations = await seedExplanationsFromFile(tx);
  return { skills: skills.length, ...r, explanations };
}

export async function upsertExplanations(tx: Tx, rows: ExplanationRow[]): Promise<void> {
  for (const e of rows) {
    await tx.query(
      `insert into skill_explanations (skill_id, weakness, title, body, tip) values ($1,$2,$3,$4,$5)
       on conflict (skill_id, weakness) do update set title = excluded.title, body = excluded.body, tip = excluded.tip`,
      [e.skillId, e.weakness, e.title, e.body, e.tip || null],
    );
  }
}

export async function seedExplanationsFromFile(tx: Tx): Promise<number> {
  const known = new Set((await tx.query<{ id: string }>("select id from skills")).rows.map((r) => r.id));
  const r = validateExplanationsCsv(readContent("explanations.csv"), known);
  if (!r.ok) throw new ContentError("explanations.csv", r.errors);
  await upsertExplanations(tx, r.rows);
  return r.rows.length;
}

export async function createUser(
  tx: Tx,
  u: {
    loginId: string;
    password: string;
    role: "student" | "teacher" | "org_admin" | "admin";
    initial: string;
    fullName?: string | null;
    grade?: number | null;
    schoolId?: string | null;
    organizationId?: string | null;
    approved: boolean;
  },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    "insert into user_credentials (email, encrypted_password) values ($1, $2) returning id",
    [loginIdToEmail(u.loginId), await hashPassword(u.password)],
  );
  const id = rows[0]!.id;
  await tx.query(
    `insert into profiles (id, role, display_initial, full_name, grade, school_id, organization_id, is_approved)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, u.role, u.initial, u.fullName ?? null, u.grade ?? null, u.schoolId ?? null, u.organizationId ?? null, u.approved],
  );
  return id;
}

/** Demo accounts for local development. Logins are listed on the /login page in dev. */
export const DEMO_ACCOUNTS = [
  { loginId: "admin", password: "admin1234", label: "본사 관리자" },
  { loginId: "director", password: "teach1234", label: "원장 (잇고 수학학원)" },
  { loginId: "teacher", password: "teach1234", label: "선생님 (잇고 수학학원)" },
  { loginId: "student1", password: "1234", label: "학생 · 진단 전" },
  { loginId: "student2", password: "1234", label: "학생 · 학습 기록 있음" },
] as const;

export async function seedDemoData(tx: Tx): Promise<void> {
  const one = async (sql: string, params: unknown[] = []) => (await tx.query<{ id: string }>(sql, params)).rows[0]!.id;

  const yp = await one("insert into regions (name) values ('경기 양평군') returning id");
  const gn = await one("insert into regions (name) values ('서울 강남구') returning id");
  const ypSchool = await one("insert into schools (region_id, name, level) values ($1, '양평초등학교', 'elementary') returning id", [yp]);
  await tx.query("insert into schools (region_id, name, level) values ($1, '용문초등학교', 'elementary')", [yp]);
  await tx.query("insert into schools (region_id, name, level) values ($1, '대치초등학교', 'elementary')", [gn]);

  const org = await one("insert into organizations (name, kind, invite_code) values ('잇고 수학학원', 'academy', 'ITGO2026') returning id");
  await one("insert into organizations (name, kind, invite_code) values ('햇살 공부방', 'study_room', 'SUNNY001') returning id");

  await createUser(tx, { loginId: "admin", password: "admin1234", role: "admin", initial: "관리", fullName: "본사 관리자", approved: true });
  await createUser(tx, { loginId: "director", password: "teach1234", role: "org_admin", initial: "김", fullName: "김원장", organizationId: org, approved: true });
  await createUser(tx, { loginId: "teacher", password: "teach1234", role: "teacher", initial: "이", fullName: "이선생", organizationId: org, approved: true });

  const studentBase = { password: "1234", role: "student" as const, schoolId: ypSchool, organizationId: org, approved: true };
  const s1 = await createUser(tx, { ...studentBase, loginId: "student1", initial: "ㄱㅁ", grade: 1 });
  const s2 = await createUser(tx, { ...studentBase, loginId: "student2", initial: "ㅂㅈ", grade: 2 });
  for (const sid of [s1, s2]) {
    await tx.query("insert into guardians (student_id, phone, consent_at) values ($1, '010-0000-0000', $2)", [sid, new Date()]);
  }
  await seedDemoHistory(tx, s2);
}

/** Gives student2 two weeks of believable attempts so teacher and report screens have data. */
async function seedDemoHistory(tx: Tx, studentId: string): Promise<void> {
  const { rows: sets } = await tx.query<{ id: string; skill_id: string; n: number }>(
    `select s.id, s.skill_id, count(i.id) as n from item_sets s join items i on i.set_id = s.id
     join skills k on k.id = s.skill_id group by s.id, s.skill_id, k.ord, s.ord order by k.ord, s.ord`,
  );
  const { rows: skills } = await tx.query<{ id: string }>("select id from skills where track_id = 'add' order by ord");
  const day = (daysAgo: number, minute: number) => new Date(Date.now() - daysAgo * 86_400_000 + minute * 60_000);
  const add = async (setId: string, mode: string, n: number, correct: number, ms: number, passed: boolean | null, at: Date) => {
    await tx.query(
      `insert into attempts (student_id, set_id, mode, item_count, correct_count, client_elapsed_ms,
         server_started_at, server_finished_at, elapsed_ms, passed, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$6,$9,$8)`,
      [studentId, setId, mode, n, correct, ms, new Date(at.getTime() - ms), at, passed],
    );
  };

  // Skills 1–2 (sets p1–p4) passed over the last 13 days, now working on skill 3 set p5.
  const passedSets = sets.filter((s) => s.skill_id === skills[0]!.id || s.skill_id === skills[1]!.id);
  let d = 13;
  for (const s of passedSets) {
    for (let p = 0; p < 3; p++) await add(s.id, "practice", s.n, s.n - (p === 0 ? 1 : 0), 16_000 - p * 1500, null, day(d, p * 3));
    await add(s.id, "test", s.n, s.n, 15_200, false, day(d, 12));
    for (let p = 0; p < 3; p++) await add(s.id, "practice", s.n, s.n, 12_500 - p * 400, null, day(d - 1, p * 3));
    await add(s.id, "test", s.n, s.n, 10_600, true, day(d - 1, 12));
    d -= 3;
  }
  const current = sets.find((s) => s.skill_id === skills[2]!.id)!;
  await add(current.id, "practice", current.n, current.n - 1, 17_000, null, day(0, -30));

  await tx.query(
    `insert into skill_progress (student_id, skill_id, status, current_set_id, practice_count, consecutive_fail, best_elapsed_ms, passed_at)
     select $1, k.id,
       case when k.ord <= 2 then 'passed' when k.ord = 3 then 'in_progress' else 'locked' end,
       case when k.ord = 3 then $2 end,
       case when k.ord = 3 then 1 else 0 end, 0,
       case when k.ord <= 2 then 10600 end,
       case when k.ord <= 2 then strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 days') end
     from skills k where k.track_id = 'add'`,
    [studentId, current.id],
  );
}
