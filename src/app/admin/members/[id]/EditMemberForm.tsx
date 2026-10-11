"use client";

import { useActionState } from "react";
import { updateMemberAction, type MemberFormState } from "../../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ErrorText, Field, inputClass } from "@/components/ui";
import type { Role } from "@/lib/auth/session";

export interface MemberData {
  id: string;
  role: Role;
  fullName: string;
  initial: string;
  email: string;
  phone: string;
  organizationId: string;
  schoolId: string;
  grade: string;
  approved: boolean;
}

const ROLE_LABEL: Record<Role, string> = { student: "학생", teacher: "선생님", org_admin: "원장", admin: "본사 관리자" };

export function EditMemberForm({ member, orgs, schools }: {
  member: MemberData;
  orgs: { id: string; name: string }[];
  schools: { id: string; label: string }[];
}) {
  const [state, action] = useActionState<MemberFormState, FormData>(updateMemberAction, { seq: 0 });
  // After an error the form shows what was typed; after a save, the saved values from the server.
  const v = state.error && state.values ? state.values : null;
  const val = (k: keyof MemberData) => (v ? (v[k] ?? "") : String(member[k] ?? ""));
  const student = member.role === "student";

  return (
    // key: React resets a form after its action, so remount it with the right default values.
    <form key={state.seq} action={action} className="max-w-3xl space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
      <input type="hidden" name="id" value={member.id} />
      <p className="text-sm font-semibold text-gray-600">역할: {ROLE_LABEL[member.role]}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={student ? "이름 (본사 관리용)" : "이름"}>
          <input name="fullName" defaultValue={val("fullName")} maxLength={30} required={!student} className={inputClass} />
        </Field>
        <Field label="이니셜" hint={student ? "학습 화면에 보이는 이름 대신 표시" : undefined}>
          <input name="initial" defaultValue={val("initial")} maxLength={6} required className={inputClass} />
        </Field>
        <Field label={student ? "학부모 휴대폰" : "휴대폰"}>
          <input name="phone" type="tel" defaultValue={val("phone")} placeholder="010-1234-5678" maxLength={13} required={student} className={inputClass} />
        </Field>
        <Field label={student ? "학부모 이메일" : "이메일"}>
          <input name="email" type="email" defaultValue={val("email")} placeholder="name@example.com" maxLength={254} className={inputClass} />
        </Field>
      </div>

      {member.role !== "admin" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={student ? "소속 학원 · 공부방" : "소속 기관"}>
            <select name="organizationId" defaultValue={val("organizationId")} required={!student} className={inputClass}>
              <option value="">{student ? "소속 없음" : "선택"}</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          {member.role === "teacher" && (
            <label className="flex min-h-12 items-center gap-3 self-end text-sm font-semibold">
              <input type="checkbox" name="approved" defaultChecked={v ? v.approved === "on" : member.approved} className="h-5 w-5" />
              원장 승인 완료 (학생 정보 열람 가능)
            </label>
          )}
        </div>
      )}

      {student && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="학교">
            <select name="schoolId" defaultValue={val("schoolId")} required className={inputClass}>
              <option value="">선택</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="학년">
            <select name="grade" defaultValue={val("grade")} required className={inputClass}>
              <option value="">선택</option>
              {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>{g}학년</option>)}
            </select>
          </Field>
        </div>
      )}

      <div className="max-w-sm">
        <Field label="새 비밀번호" hint={`바꿀 때만 입력하세요. ${student ? 4 : 8}자 이상.`}>
          <input name="newPassword" type="password" autoComplete="new-password" className={inputClass} />
        </Field>
      </div>

      <ErrorText>{state.error}</ErrorText>
      {state.ok && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.ok}</p>}
      <SubmitButton>저장</SubmitButton>
    </form>
  );
}
