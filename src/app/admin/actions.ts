"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { loginIdToEmail } from "@/lib/auth/password";
import { requireRole } from "@/lib/auth/session";
import { validateExplanationsCsv, validateItemsCsv, validateSkillsCsv, type RowError } from "@/lib/content/validate";
import { asService } from "@/lib/db/client";
import { createUser, upsertExplanations, upsertItems, upsertSkills } from "@/lib/db/seed";
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
  const directorName = s(fd, "directorName");
  const loginId = s(fd, "loginId").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!name || !directorName) return { error: "기관 이름과 원장 이름을 입력하세요." };
  if (!/^[a-z0-9_]{4,20}$/.test(loginId)) return { error: "원장 아이디는 영어 소문자·숫자 4~20자입니다." };
  if (password.length < 8) return { error: "비밀번호는 8자 이상입니다." };
  const code = randomBytes(6).toString("hex").slice(0, 8).toUpperCase();
  return asService(async (tx) => {
    if ((await tx.query("select 1 from user_credentials where email = $1", [loginIdToEmail(loginId)])).rows.length) {
      return { error: "이미 쓰고 있는 아이디입니다." };
    }
    const org = (await tx.query<{ id: string }>("insert into organizations (name, kind, invite_code) values ($1,$2,$3) returning id", [name, kind, code])).rows[0]!;
    await createUser(tx, { loginId, password, role: "org_admin", initial: directorName.slice(0, 1), fullName: directorName, organizationId: org.id, approved: true });
    revalidatePath("/admin/orgs");
    return { ok: `${name} 생성 완료 · 초대 코드 ${code}` };
  });
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
