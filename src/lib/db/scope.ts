/**
 * Row-level access rules for reads made on behalf of a user (the job Postgres RLS did on Supabase).
 *
 * D1 has no RLS, so every query run through asUser/asAnon is rewritten: each protected table it
 * mentions is shadowed by a CTE of the same name that keeps only the rows the caller may see.
 * In SQLite a CTE name hides the table of the same name for the whole statement (subqueries
 * included), and `main.<table>` still reaches the real table inside the rules themselves.
 *
 * Scoped queries are read-only. Writes go through asService after an explicit check.
 */

export interface ScopeUser {
  id: string;
  role: "student" | "teacher" | "org_admin" | "admin";
  organizationId: string | null;
  approved: boolean;
}

export class PermissionError extends Error {}

const lit = (v: string | null) => (v === null ? "null" : `'${v.replaceAll("'", "''")}'`);

/** Tables anyone may read in full (content and signup lists). */
const PUBLIC_FOR_USERS = new Set([
  "regions", "schools", "tracks", "skills", "item_sets", "items", "skill_explanations",
  "assessments", "assessment_parts",
]);
const PUBLIC_FOR_ANON = new Set(["regions", "schools", "tracks"]);

/** Never readable through a scoped query. */
const DENIED = new Set(["user_credentials", "_migrations", "d1_migrations"]);

function userRules(u: ScopeUser): Record<string, string> {
  const U = lit(u.id);
  const admin = u.role === "admin";
  const staffOrg = (u.role === "teacher" || u.role === "org_admin") && u.approved ? u.organizationId : null;
  const adminOrg = u.role === "org_admin" && u.approved ? u.organizationId : null;
  const ADMIN = admin ? "1" : "0";

  // Student is the caller, or the caller is approved staff of the student's organization, or admin.
  const canView = (col: string) =>
    admin
      ? "1"
      : `(${col} = ${U} or ${col} in (select s.id from main.profiles s where s.role = 'student' and s.organization_id = ${lit(staffOrg)}))`;
  const isStaffOf = (col: string) => (admin ? "1" : `(${col} <> ${U} and ${canView(col)})`);
  const staffOrAdmin = admin || staffOrg !== null ? "1" : "0";

  const where = (table: string, cond: string) => `select * from main.${table} where ${cond}`;
  return {
    organizations: where("organizations", `id = ${lit(u.organizationId)} or ${ADMIN}`),
    profiles: where(
      "profiles",
      `id = ${U} or ${ADMIN} or (role = 'student' and organization_id = ${lit(staffOrg)}) or organization_id = ${lit(adminOrg)}`,
    ),
    guardians: where("guardians", canView("student_id")),
    attempts: where("attempts", canView("student_id")),
    skill_progress: where("skill_progress", canView("student_id")),
    play_sessions: where("play_sessions", canView("student_id")),
    review_assignments: where("review_assignments", canView("student_id")),
    assessment_attempts: where("assessment_attempts", canView("student_id")),
    assessment_responses: `select r.* from main.assessment_responses r
      where exists (select 1 from main.assessment_attempts a where a.id = r.attempt_id and ${canView("a.student_id")})`,
    comments: `select c.* from main.comments c where
      exists (select 1 from main.attempts a where a.id = c.attempt_id and ${canView("a.student_id")})
      or exists (select 1 from main.reports r where r.id = c.report_id and ${isStaffOf("r.student_id")})`,
    reports: where("reports", isStaffOf("student_id")),
    teacher_alerts: where("teacher_alerts", isStaffOf("student_id")),
    report_deliveries: where("report_deliveries", ADMIN),
    inquiries: where("inquiries", ADMIN),

    // 진단 평가: problems for everyone signed in; answers and teacher notes for staff/admin only.
    assessment_sections: "select id, assessment_id, ord, title, pdf_title, pdf_page from main.assessment_sections",
    assessment_items: "select id, part_id, ord, label, type, grading, stem, choices, figure, tags from main.assessment_items",
    assessment_items_student: `select i.id, i.part_id, i.ord, i.label, i.type, i.grading, i.stem, i.choices, i.figure, i.tags,
      -- blank ids, kinds and digit-box counts only (never answers); json_patch drops null members
      (select json_group_array(json_patch('{}', json_object(
         'id', json_extract(b.value, '$.id'), 'kind', json_extract(b.value, '$.kind'), 'digits', json_extract(b.value, '$.digits'))))
       from json_each(i.blanks) b) as blanks
      from main.assessment_items i`,
    assessment_items_staff: where("assessment_items", staffOrAdmin),
    assessment_sections_staff: where("assessment_sections", staffOrAdmin),
  };
}

const VIRTUAL = new Set(["assessment_items_student", "assessment_items_staff", "assessment_sections_staff"]);
const PROTECTED_TABLES = [
  "organizations", "profiles", "guardians", "attempts", "skill_progress", "play_sessions", "review_assignments",
  "comments", "reports", "teacher_alerts", "report_deliveries", "inquiries", "assessment_attempts", "assessment_responses",
  "assessment_sections", "assessment_items", ...VIRTUAL,
];

const mentions = (sql: string, name: string) => new RegExp(`\\b${name}\\b`, "i").test(sql);

function assertReadOnly(sql: string) {
  const s = sql.replace(/'(?:[^']|'')*'/g, "''");
  if (!/^\s*(select|with)\b/i.test(s) || /\b(insert\s+into|update\s+\w+\s+set|delete\s+from|replace\s+into|pragma|attach)\b/i.test(s)) {
    throw new PermissionError("Scoped queries are read-only. Write with asService after an explicit permission check.");
  }
}

/** Rewrites `sql` so it only sees rows `user` may read (`null` = signed out). */
export function scopeSql(sql: string, user: ScopeUser | null): string {
  assertReadOnly(sql);
  for (const t of DENIED) if (mentions(sql, t)) throw new PermissionError(`permission denied for table ${t}`);
  if (/\bmain\s*\./i.test(sql)) throw new PermissionError("permission denied: scoped queries cannot name main.<table>");

  const rules = user ? userRules(user) : {};
  const ctes: string[] = [];
  for (const t of PROTECTED_TABLES) {
    if (!mentions(sql, t)) continue;
    const rule = rules[t];
    if (rule) ctes.push(`${t} as (${rule})`);
    else throw new PermissionError(`permission denied for table ${t}`);
  }
  if (!user) {
    for (const t of PUBLIC_FOR_USERS) {
      if (!PUBLIC_FOR_ANON.has(t) && mentions(sql, t)) throw new PermissionError(`permission denied for table ${t}`);
    }
  }
  if (ctes.length === 0) return sql;

  const m = /^\s*with(\s+recursive)?\s+/i.exec(sql);
  if (m) return `with${m[1] ?? ""} ${ctes.join(", ")}, ${sql.slice(m[0].length)}`;
  return `with ${ctes.join(", ")} ${sql}`;
}
