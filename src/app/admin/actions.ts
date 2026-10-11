"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeEmail, normalizePhone } from "@/lib/auth/contact";
import { hashPassword, loginIdToEmail } from "@/lib/auth/password";
import { requireRole, type Role } from "@/lib/auth/session";
import { validateExplanationsCsv, validateItemsCsv, validateSkillsCsv, type RowError } from "@/lib/content/validate";
import { asService } from "@/lib/db/client";
import { createUser, upsertExplanations, upsertItems, upsertSkills } from "@/lib/db/seed";
import { BOARD_PATH, toBoard } from "@/lib/server/posts";
import { generateReports } from "@/lib/server/reports";
import { baseUrl } from "@/lib/server/url";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ST-03 regions & schools. requireRole("admin") is the permission check for every write here.
export async function addRegionAction(fd: FormData) {
  await requireRole("admin");
  const name = s(fd, "name");
  if (!name) return;
  await asService((tx) => tx.query("insert into regions (name) values ($1) on conflict (name) do nothing", [name]));
  revalidatePath("/admin/regions");
}

export async function addSchoolAction(fd: FormData) {
  await requireRole("admin");
  const name = s(fd, "name");
  const regionId = s(fd, "regionId");
  const level = s(fd, "level") || "elementary";
  if (!name || !regionId) return;
  await asService((tx) =>
    tx.query("insert into schools (region_id, name, level) values ($1,$2,$3) on conflict (region_id, name) do nothing", [regionId, name, level]),
  );
  revalidatePath("/admin/regions");
}

export async function renameAction(fd: FormData) {
  await requireRole("admin");
  const table = s(fd, "table") === "schools" ? "schools" : "regions";
  const name = s(fd, "name");
  if (!name) return;
  await asService((tx) => tx.query(`update ${table} set name = $2 where id = $1`, [s(fd, "id"), name]));
  revalidatePath("/admin/regions");
}

export async function toggleActiveAction(fd: FormData) {
  await requireRole("admin");
  const table = s(fd, "table") === "schools" ? "schools" : "regions";
  await asService((tx) => tx.query(`update ${table} set is_active = not is_active where id = $1`, [s(fd, "id")]));
  revalidatePath("/admin/regions");
}

export type OrgFormState = { error?: string; ok?: string } | undefined;

/** Creates an organization and its director (org_admin) account. */
export async function createOrgAction(_: OrgFormState, fd: FormData): Promise<OrgFormState> {
  await requireRole("admin");
  const name = s(fd, "name");
  const kind = s(fd, "kind") === "study_room" ? "study_room" : "academy";
  const schoolId = s(fd, "schoolId");
  const directorName = s(fd, "directorName");
  const loginId = s(fd, "loginId").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!name || !directorName) return { error: "기관 이름과 원장 이름을 입력하세요." };
  if (!schoolId) return { error: "지역과 학교를 고르세요. 그 학교를 고른 학생이 이 기관으로 가입합니다." };
  if (!/^[a-z0-9_]{4,20}$/.test(loginId)) return { error: "원장 아이디는 영어 소문자·숫자 4~20자입니다." };
  if (password.length < 8) return { error: "비밀번호는 8자 이상입니다." };
  const code = randomBytes(6).toString("hex").slice(0, 8).toUpperCase();
  return asService(async (tx) => {
    if ((await tx.query("select 1 from user_credentials where email = $1", [loginIdToEmail(loginId)])).rows.length) {
      return { error: "이미 쓰고 있는 아이디입니다." };
    }
    if ((await tx.query("select 1 from schools where id = $1", [schoolId])).rows.length === 0) return { error: "학교를 찾을 수 없습니다." };
    const org = (await tx.query<{ id: string }>(
      "insert into organizations (name, kind, invite_code, school_id) values ($1,$2,$3,$4) returning id",
      [name, kind, code, schoolId],
    )).rows[0]!;
    await createUser(tx, { loginId, password, role: "org_admin", initial: directorName.slice(0, 1), fullName: directorName, organizationId: org.id, approved: true });
    revalidatePath("/admin/orgs");
    return { ok: `${name} 생성 완료 · 선생님 가입용 기관 코드 ${code}` };
  });
}

/** Links an existing organization to the school its students attend (empty = unlink). */
export async function setOrgSchoolAction(fd: FormData) {
  await requireRole("admin");
  const schoolId = s(fd, "schoolId") || null;
  await asService(async (tx) => {
    if (schoolId && (await tx.query("select 1 from schools where id = $1", [schoolId])).rows.length === 0) return;
    await tx.query("update organizations set school_id = $2 where id = $1", [s(fd, "id"), schoolId]);
  });
  revalidatePath("/admin/orgs");
}

export type UploadState = { kind?: "skills" | "items" | "explanations"; errors?: RowError[]; ok?: string; error?: string } | undefined;

/** ST-40: same validators as `pnpm db:seed`; any wrong answer rejects the whole file with line numbers. */
export async function uploadContentAction(_: UploadState, fd: FormData): Promise<UploadState> {
  await requireRole("admin");
  const file = fd.get("file");
  const rawKind = s(fd, "kind");
  const kind = rawKind === "skills" || rawKind === "explanations" ? rawKind : "items";
  if (!(file instanceof File) || file.size === 0) return { error: "CSV 파일을 선택하세요." };
  if (file.size > 2_000_000) return { error: "파일이 너무 큽니다 (2MB 이하)." };
  const text = await file.text();

  if (kind === "skills") {
    const tracks = await asService(async (tx) => new Set((await tx.query<{ id: string }>("select id from tracks")).rows.map((x) => x.id)));
    const r = validateSkillsCsv(text, tracks);
    if (!r.ok) return { kind, errors: r.errors };
    await asService((tx) => upsertSkills(tx, r.rows));
    revalidatePath("/admin/content");
    return { kind, ok: `스킬 ${r.rows.length}개를 반영했습니다.` };
  }

  if (kind === "explanations") {
    const known = await asService(async (tx) => new Set((await tx.query<{ id: string }>("select id from skills")).rows.map((x) => x.id)));
    const r = validateExplanationsCsv(text, known);
    if (!r.ok) return { kind, errors: r.errors };
    await asService((tx) => upsertExplanations(tx, r.rows));
    revalidatePath("/admin/content");
    return { kind, ok: `설명 ${r.rows.length}개를 반영했습니다.` };
  }

  const known = await asService(async (tx) => new Set((await tx.query<{ id: string }>("select id from skills")).rows.map((x) => x.id)));
  const r = validateItemsCsv(text, known);
  if (!r.ok) return { kind, errors: r.errors };
  const res = await asService((tx) => upsertItems(tx, r.rows));
  revalidatePath("/admin/content");
  return { kind, ok: `세트 ${res.sets}개, 문항 ${res.items}개를 반영했습니다.` };
}

export async function generateAllReportsAction() {
  await requireRole("admin");
  await generateReports({ baseUrl: await baseUrl() });
  revalidatePath("/admin/reports");
}

export async function markInquiryHandledAction(fd: FormData) {
  await requireRole("admin");
  await asService((tx) => tx.query("update inquiries set handled_at = $2 where id = $1 and handled_at is null", [s(fd, "id"), new Date()]));
  revalidatePath("/admin/inquiries");
}

export type MemberFormState = { error?: string; ok?: string; values?: Record<string, string>; seq: number };

/**
 * 회원 정보 수정 (본사 관리자). Login id and role stay fixed; a new password is set only when typed.
 * Students' phone is the guardian's (guardians.phone); staff keep theirs in profiles.contact_phone.
 */
export async function updateMemberAction(prev: MemberFormState, fd: FormData): Promise<MemberFormState> {
  await requireRole("admin");
  // Echoed back on error so the form keeps what was typed (React resets forms after an action); never the password.
  const values = Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === "string" && k !== "newPassword" && !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
  const seq = prev.seq + 1;
  const fail = (error: string): MemberFormState => ({ error, values, seq });

  const id = s(fd, "id");
  const fullName = s(fd, "fullName");
  const initial = s(fd, "initial");
  const email = normalizeEmail(s(fd, "email"));
  const phoneRaw = s(fd, "phone");
  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
  const newPassword = String(fd.get("newPassword") ?? "");

  return asService(async (tx) => {
    const member = (await tx.query<{ role: Role }>("select role from profiles where id = $1", [id])).rows[0];
    if (!member) return fail("회원을 찾을 수 없습니다.");
    const student = member.role === "student";

    if (fullName.length > 30 || (!student && !fullName)) return fail("이름을 1~30자로 입력하세요.");
    if (initial.length < 1 || initial.length > 6) return fail("이니셜은 1~6글자입니다.");
    if (email === null) return fail("이메일 주소를 확인하세요. 예) name@example.com");
    if (phone === null || (student && !phone)) return fail(`${student ? "학부모 " : ""}휴대폰 번호를 확인하세요. 예) 010-1234-5678`);
    if (newPassword && newPassword.length < (student ? 4 : 8)) return fail(`새 비밀번호는 ${student ? 4 : 8}자 이상입니다.`);

    let organizationId: string | null = null;
    if (member.role !== "admin") {
      organizationId = s(fd, "organizationId") || null;
      // Students may have no organization yet (their school is not linked to one); staff must have one.
      if (!organizationId && !student) return fail("소속 기관을 고르세요.");
      if (organizationId && (await tx.query("select 1 from organizations where id = $1", [organizationId])).rows.length === 0) return fail("기관을 찾을 수 없습니다.");
    }

    if (student) {
      const schoolId = s(fd, "schoolId");
      const grade = Number(s(fd, "grade"));
      if ((await tx.query("select 1 from schools where id = $1", [schoolId])).rows.length === 0) return fail("학교를 고르세요.");
      if (!(grade >= 1 && grade <= 6)) return fail("학년을 고르세요.");
      await tx.query(
        `update profiles set full_name = $2, display_initial = $3, contact_email = $4, organization_id = $5, school_id = $6, grade = $7
         where id = $1`,
        [id, fullName || null, initial, email || null, organizationId, schoolId, grade],
      );
      const updated = await tx.query("update guardians set phone = $2 where student_id = $1 returning id", [id, phone]);
      if (updated.rows.length === 0) {
        await tx.query("insert into guardians (student_id, phone, consent_at) values ($1, $2, $3)", [id, phone, new Date()]);
      }
    } else {
      await tx.query(
        `update profiles set full_name = $2, display_initial = $3, contact_email = $4, contact_phone = $5, organization_id = $6,
           is_approved = case when role = 'teacher' then $7 else is_approved end
         where id = $1`,
        [id, fullName, initial, email || null, phone || null, organizationId, fd.get("approved") === "on"],
      );
    }
    if (newPassword) {
      await tx.query("update user_credentials set encrypted_password = $2 where id = $1", [id, await hashPassword(newPassword)]);
    }
    revalidatePath("/admin/members");
    revalidatePath(`/admin/members/${id}`);
    return { ok: newPassword ? "저장했습니다. 비밀번호도 바꿨습니다." : "저장했습니다.", seq };
  });
}

export type DeleteMemberState = { error?: string } | undefined;

/**
 * 회원 삭제 (본사 관리자). The admin must type the member's login id to confirm.
 * Removes the member and everything recorded for them; D1 has no transactions, so children go first
 * and a retry after a partial failure finishes the job.
 */
export async function deleteMemberAction(_: DeleteMemberState, fd: FormData): Promise<DeleteMemberState> {
  const admin = await requireRole("admin");
  const id = s(fd, "id");
  const confirmText = s(fd, "confirmLoginId").toLowerCase();

  const result = await asService(async (tx): Promise<{ error: string } | { loginId: string }> => {
    const m = (await tx.query<{ role: Role; login_id: string }>(
      "select p.role, substr(u.email, 1, instr(u.email, '@') - 1) as login_id from profiles p join user_credentials u on u.id = p.id where p.id = $1",
      [id],
    )).rows[0];
    if (!m) return { error: "회원을 찾을 수 없습니다." };
    if (confirmText !== m.login_id) return { error: `확인을 위해 아이디 "${m.login_id}"를 정확히 입력하세요.` };
    if (id === admin.id) return { error: "지금 로그인한 본사 관리자 계정은 삭제할 수 없습니다." };
    if (m.role === "admin" && (await tx.query<{ n: number }>("select count(*) as n from profiles where role = 'admin'")).rows[0]!.n <= 1) {
      return { error: "마지막 본사 관리자 계정은 삭제할 수 없습니다." };
    }

    const attempts = "(select id from attempts where student_id = $1)";
    const reports = "(select id from reports where student_id = $1)";
    for (const sql of [
      "delete from assessment_responses where attempt_id in (select id from assessment_attempts where student_id = $1)",
      "delete from assessment_attempts where student_id = $1",
      `delete from comments where author_id = $1 or attempt_id in ${attempts} or report_id in ${reports}`,
      `delete from report_deliveries where report_id in ${reports}`,
      "delete from reports where student_id = $1",
      "delete from play_sessions where student_id = $1",
      "delete from teacher_alerts where student_id = $1",
      "delete from review_assignments where student_id = $1",
      "delete from skill_progress where student_id = $1",
      "delete from attempts where student_id = $1",
      "delete from guardians where student_id = $1",
      "delete from profiles where id = $1",
      "delete from user_credentials where id = $1",
    ]) {
      await tx.query(sql, [id]);
    }
    return { loginId: m.login_id };
  });
  if ("error" in result) return result;
  revalidatePath("/admin/members");
  redirect(`/admin/members?deleted=${encodeURIComponent(result.loginId)}`);
}

export type PostFormState = { error?: string; values?: Record<string, string>; seq: number };

/** 공지사항 / 자주하는 질문 / 교육이야기: create (no id) or update. Plain text only. */
export async function savePostAction(prev: PostFormState, fd: FormData): Promise<PostFormState> {
  const admin = await requireRole("admin");
  const id = s(fd, "id");
  const board = toBoard(s(fd, "board"));
  const title = s(fd, "title");
  const body = String(fd.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  const pinned = fd.get("pinned") === "on";
  const fail = (error: string): PostFormState => ({ error, values: { title, body, board, pinned: pinned ? "on" : "" }, seq: prev.seq + 1 });
  if (!title || title.length > 200) return fail("제목을 1~200자로 입력하세요.");
  if (!body || body.length > 20000) return fail("내용을 1~20,000자로 입력하세요.");

  const savedId = await asService(async (tx) => {
    if (id) {
      const r = await tx.query("update posts set board = $2, title = $3, body = $4, pinned = $5, updated_at = $6 where id = $1 returning id", [
        id, board, title, body, pinned, new Date(),
      ]);
      return r.rows.length ? id : null;
    }
    return (await tx.query<{ id: string }>(
      "insert into posts (board, title, body, pinned, author_id) values ($1,$2,$3,$4,$5) returning id",
      [board, title, body, pinned, admin.id],
    )).rows[0]!.id;
  });
  if (!savedId) return fail("글을 찾을 수 없습니다.");
  revalidatePath("/admin/posts");
  revalidatePath(BOARD_PATH[board]);
  redirect(`/admin/posts?board=${board}&saved=1`);
}

export async function deletePostAction(fd: FormData) {
  await requireRole("admin");
  const board = toBoard(s(fd, "board"));
  await asService((tx) => tx.query("delete from posts where id = $1", [s(fd, "id")]));
  revalidatePath("/admin/posts");
  revalidatePath(BOARD_PATH[board]);
  redirect(`/admin/posts?board=${board}&deleted=1`);
}

export type DeleteOrgState = { error?: string } | undefined;

/**
 * 기관 삭제 (본사 관리자). Confirmed by typing the organization name. Students are kept and become
 * "소속 없음" (their records stay; link them to another academy later); the organization's 원장 and
 * 선생님 accounts cannot work without it and are deleted with their comments.
 */
export async function deleteOrgAction(_: DeleteOrgState, fd: FormData): Promise<DeleteOrgState> {
  await requireRole("admin");
  const id = s(fd, "id");
  const confirmName = s(fd, "confirmName");
  const result = await asService(async (tx): Promise<{ error: string } | { name: string; staff: number; students: number }> => {
    const org = (await tx.query<{ name: string }>("select name from organizations where id = $1", [id])).rows[0];
    if (!org) return { error: "기관을 찾을 수 없습니다." };
    if (confirmName !== org.name) return { error: `확인을 위해 기관 이름 "${org.name}"을(를) 정확히 입력하세요.` };
    const staff = (await tx.query<{ id: string }>("select id from profiles where organization_id = $1 and role in ('teacher','org_admin')", [id])).rows;
    for (const m of staff) {
      await tx.query("delete from comments where author_id = $1", [m.id]);
      await tx.query("delete from profiles where id = $1", [m.id]);
      await tx.query("delete from user_credentials where id = $1", [m.id]);
    }
    const students = await tx.query("update profiles set organization_id = null where organization_id = $1 returning id", [id]);
    await tx.query("delete from organizations where id = $1", [id]);
    return { name: org.name, staff: staff.length, students: students.rows.length };
  });
  if ("error" in result) return result;
  revalidatePath("/admin/orgs");
  revalidatePath("/admin/members");
  // The row (and this form) disappears with the organization, so report on the page itself.
  redirect(`/admin/orgs?${new URLSearchParams({ deleted: result.name, staff: String(result.staff), students: String(result.students) })}`);
}
