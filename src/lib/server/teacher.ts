import "server-only";
import { asUser } from "@/lib/db/client";
import type { Blank, Op } from "@/lib/content/items";
import { loadProgress, loadSkills, loadTracks } from "./content";

/** Every query here runs under the teacher's RLS scope: other organizations' rows never come back. */

export async function unreadAlertCount(userId: string): Promise<number> {
  return asUser(userId, async (tx) => (await tx.query<{ n: number }>("select count(*)::int as n from teacher_alerts where read_at is null")).rows[0]!.n);
}

export async function listStudents(userId: string) {
  return asUser(userId, async (tx) => {
    const { rows } = await tx.query<{
      id: string; display_initial: string; grade: number | null; school: string | null; current_skills: string | null;
      last_at: Date | null; last_mode: string | null; last_elapsed: number | null; last_passed: boolean | null;
      consecutive_fail: number | null; open_alerts: number;
    }>(
      `select p.id, p.display_initial, p.grade, sc.name as school,
              cur.current_skills, cur.consecutive_fail,
              la.created_at as last_at, la.mode as last_mode, la.elapsed_ms as last_elapsed, la.passed as last_passed,
              (select count(*)::int from teacher_alerts t where t.student_id = p.id and t.read_at is null) as open_alerts
       from profiles p
       left join schools sc on sc.id = p.school_id
       left join lateral (
         -- one current skill per track
         select string_agg(k.name || ' · 세트 ' || s.ord, ', ' order by k.ord) as current_skills,
                max(sp.consecutive_fail) as consecutive_fail
         from skill_progress sp join skills k on k.id = sp.skill_id
         left join item_sets s on s.id = sp.current_set_id
         where sp.student_id = p.id and sp.status = 'in_progress'
       ) cur on true
       left join lateral (select created_at, mode, elapsed_ms, passed from attempts a where a.student_id = p.id order by created_at desc limit 1) la on true
       where p.role = 'student'
       order by p.display_initial`,
    );
    return rows;
  });
}

export interface WrongItem { a: number; op: Op; b: number; blank: Blank; answer: number; given: number | null }

export async function loadStudentDetail(userId: string, studentId: string) {
  return asUser(userId, async (tx) => {
    const { rows: prof } = await tx.query<{ id: string; display_initial: string; grade: number | null; school: string | null; org: string | null; phone: string | null; created_at: Date }>(
      `select p.id, p.display_initial, p.grade, sc.name as school, o.name as org, g.phone, p.created_at
       from profiles p left join schools sc on sc.id = p.school_id
       left join organizations o on o.id = p.organization_id
       left join guardians g on g.student_id = p.id
       where p.id = $1 and p.role = 'student'`,
      [studentId],
    );
    const student = prof[0];
    if (!student) return null;
    const tracks = await loadTracks(tx);
    const skills = await loadSkills(tx);
    const progress = await loadProgress(tx, studentId);
    const { rows: attempts } = await tx.query<{
      id: string; set_id: string; set_no: number; skill_name: string; mode: string; item_count: number; correct_count: number;
      elapsed_ms: number; client_elapsed_ms: number; passed: boolean | null; wrong_items: WrongItem[]; created_at: Date;
    }>(
      `select a.id, a.set_id, s.ord as set_no, k.name as skill_name, a.mode, a.item_count, a.correct_count,
              a.elapsed_ms, a.client_elapsed_ms, a.passed, a.wrong_items, a.created_at
       from attempts a join item_sets s on s.id = a.set_id join skills k on k.id = s.skill_id
       where a.student_id = $1 order by a.created_at desc limit 100`,
      [studentId],
    );
    const { rows: comments } = await tx.query<{ id: string; attempt_id: string | null; report_id: string | null; body: string; author: string | null; created_at: Date }>(
      `select c.id, c.attempt_id, c.report_id, c.body, au.full_name as author, c.created_at
       from comments c join profiles au on au.id = c.author_id
       left join attempts a on a.id = c.attempt_id left join reports r on r.id = c.report_id
       where coalesce(a.student_id, r.student_id) = $1 order by c.created_at`,
      [studentId],
    );
    const { rows: reports } = await tx.query<{ id: string; period_start: string; period_end: string; lines: string[]; share_token: string; expires_at: Date; sent_at: Date | null }>(
      "select id, period_start::text, period_end::text, lines, share_token, expires_at, sent_at from reports where student_id = $1 order by created_at desc",
      [studentId],
    );
    const { rows: assessments } = await tx.query<{ id: string; started_at: Date; finished_at: Date | null; auto_correct: number | null; auto_total: number | null; manual_pending: number | null }>(
      "select id, started_at, finished_at, auto_correct, auto_total, manual_pending from assessment_attempts where student_id = $1 order by started_at desc",
      [studentId],
    );
    return { student, tracks, skills, progress, attempts, comments, reports, assessments };
  });
}
