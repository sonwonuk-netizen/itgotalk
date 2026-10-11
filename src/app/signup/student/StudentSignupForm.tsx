"use client";

import { useActionState, useState } from "react";
import { signupStudentAction } from "../../auth-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ErrorText, Field, inputClass } from "@/components/ui";

interface Props {
  regions: { id: string; name: string }[];
  schools: { id: string; name: string; region_id: string }[];
  /** Academies/공부방 linked to a school (set by 본사 관리자 in 기관 관리). */
  orgs: { id: string; name: string; school_id: string }[];
}

export function StudentSignupForm({ regions, schools, orgs }: Props) {
  const [state, action] = useActionState(signupStudentAction, undefined);
  const [regionId, setRegionId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const regionSchools = schools.filter((s) => s.region_id === regionId);
  const schoolOrgs = orgs.filter((o) => o.school_id === schoolId);
  // The academy step stays in the form (it still decides the organization) but is shown only when the
  // student must choose between several academies linked to the school.
  const showOrg = schoolOrgs.length > 1;
  const step = (n: number) => (showOrg ? n : n - 1);

  return (
    <form action={action} className="space-y-5">
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-lg font-bold">1. 학교</legend>
        <Field label="지역">
          <select aria-label="지역" className={inputClass} value={regionId} onChange={(e) => { setRegionId(e.target.value); setSchoolId(""); }} required>
            <option value="">선택</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="학교">
          <select name="schoolId" aria-label="학교" className={inputClass} required disabled={!regionId} value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
            <option value="">선택</option>
            {regionSchools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="학년">
          <select name="grade" aria-label="학년" className={inputClass} required defaultValue="">
            <option value="">선택</option>
            {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>{g}학년</option>)}
          </select>
        </Field>
      </fieldset>

      <fieldset className="space-y-2" data-testid="signup-org" hidden={!showOrg}>
        <legend className="mb-2 text-lg font-bold">2. 학원 · 공부방</legend>
        {!schoolId ? (
          <p className="text-gray-500">학교를 고르면 함께 공부할 학원·공부방이 정해져요.</p>
        ) : schoolOrgs.length === 1 ? (
          <>
            <input type="hidden" name="organizationId" value={schoolOrgs[0]!.id} />
            <p className="rounded-xl bg-brand-50 px-4 py-3 font-semibold text-brand-700"><b>{schoolOrgs[0]!.name}</b> 학생으로 가입돼요.</p>
          </>
        ) : schoolOrgs.length > 1 ? (
          <Field label="학원 · 공부방">
            <select name="organizationId" aria-label="학원 · 공부방" className={inputClass} required defaultValue="">
              <option value="">선택</option>
              {schoolOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        ) : (
          <p className="rounded-xl bg-gray-100 px-4 py-3 text-gray-700">이 학교에 연결된 학원·공부방이 아직 없어요. 가입 후 본사에서 연결해 드려요.</p>
        )}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-bold">{step(3)}. 내 계정</legend>
        <Field label="이름" hint="학원 선생님과 본사가 학생 관리에 써요. 학습 화면에는 보이지 않아요.">
          <input name="fullName" autoComplete="name" maxLength={30} className={inputClass} required />
        </Field>
        <Field label="이니셜" hint="이름 대신 화면에 보여요. 6글자까지. 예) ㄱㅁ">
          <input name="initial" maxLength={6} className={inputClass} required />
        </Field>
        <Field label="아이디" hint="영어 소문자·숫자 4~20자">
          <input name="loginId" autoCapitalize="none" autoComplete="username" className={inputClass} required />
        </Field>
        <Field label="비밀번호" hint="4자 이상">
          <input name="password" type="password" autoComplete="new-password" className={inputClass} required />
        </Field>
      </fieldset>

      <fieldset className="space-y-3 rounded-2xl bg-sun-100 p-4">
        <legend className="text-lg font-bold">{step(4)}. 학부모님 확인</legend>
        <Field label="학부모 휴대폰 번호" hint="2주마다 학습 리포트 링크를 보내 드려요.">
          <input name="guardianPhone" type="tel" inputMode="tel" placeholder="010-1234-5678" className={inputClass} required />
        </Field>
        <Field label="학부모 이메일 (선택)" hint="연락이 필요할 때 사용해요.">
          <input name="email" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" placeholder="parent@example.com" maxLength={254} className={inputClass} />
        </Field>
        <label className="flex min-h-12 items-start gap-3 text-sm">
          <input type="checkbox" name="consent" className="mt-1 h-6 w-6 shrink-0" required />
          <span>
            <b>[필수] 법정대리인 동의</b> — 저는 이 학생의 법정대리인으로서, 학습 기록 제공을 위해 학년·학교·이름·이니셜·학부모 연락처(휴대폰, 이메일을 적은 경우 이메일)를
            수집·이용하는 데 동의합니다. 이름은 소속 학원 선생님과 본사의 학생 관리에만 쓰이고, 학습 화면에는 이니셜만 표시됩니다.
          </span>
        </label>
      </fieldset>

      <ErrorText>{state?.error}</ErrorText>
      <SubmitButton className="w-full" size="lg">가입하고 시작하기</SubmitButton>
    </form>
  );
}
