"use server";

import { redirect } from "next/navigation";
import { loginIdToEmail, verifyPassword } from "@/lib/auth/password";
import { endSession, homeFor, startSession, type Role } from "@/lib/auth/session";
import { asService } from "@/lib/db/client";
import { createUser } from "@/lib/db/seed";

export type FormState = { error?: string } | undefined;

const LOGIN_ID = /^[a-z0-9_]{4,20}$/;
const PHONE = /^01[016789]-?\d{3,4}-?\d{4}$/;

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const loginId = str(fd, "loginId").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const user = await asService(async (tx) => {
    const { rows } = await tx.query<{ id: string; encrypted_password: string; role: Role }>(
      "select u.id, u.encrypted_password, p.role from user_credentials u join profiles p on p.id = u.id where u.email = $1",
      [loginIdToEmail(loginId)],
    );
    return rows[0];
  });
  if (!user || !(await verifyPassword(password, user.encrypted_password))) {
    return { error: "아이디 또는 비밀번호가 맞지 않아요." };
  }
  await startSession(user.id);
  redirect(homeFor(user.role));
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

async function loginIdTaken(loginId: string): Promise<boolean> {
  return asService(async (tx) => (await tx.query("select 1 from user_credentials where email = $1", [loginIdToEmail(loginId)])).rows.length > 0);
}

/** ST-01: region → school → grade → invite code → guardian phone + consent. */
export async function signupStudentAction(_: FormState, fd: FormData): Promise<FormState> {
  const schoolId = str(fd, "schoolId");
  const grade = Number(str(fd, "grade"));
  const inviteCode = str(fd, "inviteCode").toUpperCase();
  const phone = str(fd, "guardianPhone");
  const consent = fd.get("consent") === "on";
  const initial = str(fd, "initial");
  const loginId = str(fd, "loginId").toLowerCase();
  const password = String(fd.get("password") ?? "");

  if (!schoolId) return { error: "지역과 학교를 골라 주세요." };
  if (!(grade >= 1 && grade <= 6)) return { error: "학년을 골라 주세요." };
  if (!inviteCode) return { error: "학원(공부방) 초대 코드를 입력해 주세요." };
  if (!PHONE.test(phone)) return { error: "학부모 휴대폰 번호를 확인해 주세요. 예) 010-1234-5678" };
  if (!consent) return { error: "만 14세 미만은 법정대리인(학부모) 동의가 필요해요." };
  if (initial.length < 1 || initial.length > 3) return { error: "이니셜은 1~3글자로 입력해 주세요. 예) ㄱㅁ" };
  if (!LOGIN_ID.test(loginId)) return { error: "아이디는 영어 소문자·숫자 4~20자로 만들어 주세요." };
  if (password.length < 4) return { error: "비밀번호는 4자 이상이어야 해요." };

  const result = await asService(async (tx) => {
    const school = await tx.query("select 1 from schools s join regions r on r.id = s.region_id where s.id = $1 and s.is_active and r.is_active", [schoolId]);
    if (school.rows.length === 0) return { error: "선택한 학교를 찾을 수 없어요." };
    const org = await tx.query<{ id: string }>("select id from organizations where invite_code = $1", [inviteCode]);
    if (org.rows.length === 0) return { error: "초대 코드가 맞지 않아요. 선생님께 다시 확인해 주세요." };
    if ((await tx.query("select 1 from user_credentials where email = $1", [loginIdToEmail(loginId)])).rows.length) {
      return { error: "이미 쓰고 있는 아이디예요." };
    }
    const id = await createUser(tx, {
      loginId, password, role: "student", initial, grade, schoolId, organizationId: org.rows[0]!.id, approved: true,
    });
    await tx.query("insert into guardians (student_id, phone, consent_at) values ($1, $2, $3)", [id, phone.replaceAll("-", ""), new Date()]);
    return { id };
  });
  if ("error" in result) return result;
  await startSession(result.id);
  redirect("/s/diagnostic");
}

/** ST-02: teacher joins with the organization code and waits for the director's approval. */
export async function signupTeacherAction(_: FormState, fd: FormData): Promise<FormState> {
  const inviteCode = str(fd, "inviteCode").toUpperCase();
  const fullName = str(fd, "fullName");
  const loginId = str(fd, "loginId").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!fullName) return { error: "이름을 입력해 주세요." };
  if (!LOGIN_ID.test(loginId)) return { error: "아이디는 영어 소문자·숫자 4~20자로 만들어 주세요." };
  if (password.length < 8) return { error: "교사 비밀번호는 8자 이상이어야 해요." };
  if (await loginIdTaken(loginId)) return { error: "이미 쓰고 있는 아이디예요." };

  const result = await asService(async (tx) => {
    const org = await tx.query<{ id: string }>("select id from organizations where invite_code = $1", [inviteCode]);
    if (org.rows.length === 0) return { error: "기관 코드가 맞지 않아요." };
    const id = await createUser(tx, {
      loginId, password, role: "teacher", initial: fullName.slice(0, 1), fullName, organizationId: org.rows[0]!.id, approved: false,
    });
    return { id };
  });
  if ("error" in result) return result;
  await startSession(result.id);
  redirect("/pending");
}
