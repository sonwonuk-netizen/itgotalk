"use client";

import { useActionState, useState } from "react";
import { signupStudentAction } from "../../auth-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ErrorText, Field, inputClass } from "@/components/ui";

interface Props {
  regions: { id: string; name: string }[];
  schools: { id: string; name: string; region_id: string }[];
}

export function StudentSignupForm({ regions, schools }: Props) {
  const [state, action] = useActionState(signupStudentAction, undefined);
  const [regionId, setRegionId] = useState("");
  const regionSchools = schools.filter((s) => s.region_id === regionId);

  return (
    <form action={action} className="space-y-5">
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-lg font-bold">1. 학교</legend>
        <Field label="지역">
          <select aria-label="지역" className={inputClass} value={regionId} onChange={(e) => setRegionId(e.target.value)} required>
            <option value="">선택</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="학교">
          <select name="schoolId" aria-label="학교" className={inputClass} required disabled={!regionId} key={regionId}>
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

      <fieldset className="space-y-4">
        <legend className="mb-2 text-lg font-bold">2. 학원 · 공부방</legend>
        <Field label="초대 코드" hint="선생님께 받은 코드를 입력하세요.">
          <input name="inviteCode" className={`${inputClass} uppercase`} autoCapitalize="characters" required />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-lg font-bold">3. 내 계정</legend>
        <Field label="이니셜" hint="이름 대신 화면에 보여요. 예) ㄱㅁ">
          <input name="initial" maxLength={3} className={inputClass} required />
        </Field>
        <Field label="아이디" hint="영어 소문자·숫자 4~20자">
          <input name="loginId" autoCapitalize="none" autoComplete="username" className={inputClass} required />
        </Field>
        <Field label="비밀번호" hint="4자 이상">
          <input name="password" type="password" autoComplete="new-password" className={inputClass} required />
        </Field>
      </fieldset>

      <fieldset className="space-y-3 rounded-2xl bg-sun-100 p-4">
        <legend className="text-lg font-bold">4. 학부모님 확인</legend>
        <Field label="학부모 휴대폰 번호" hint="2주마다 학습 리포트 링크를 보내 드려요.">
          <input name="guardianPhone" type="tel" inputMode="tel" placeholder="010-1234-5678" className={inputClass} required />
        </Field>
        <label className="flex min-h-12 items-start gap-3 text-sm">
          <input type="checkbox" name="consent" className="mt-1 h-6 w-6 shrink-0" required />
          <span>
            <b>[필수] 법정대리인 동의</b> — 저는 이 학생의 법정대리인으로서, 학습 기록 제공을 위해 학년·학교·이니셜·학부모 연락처를
            수집·이용하는 데 동의합니다. 실명은 수집하지 않습니다.
          </span>
        </label>
      </fieldset>

      <ErrorText>{state?.error}</ErrorText>
      <SubmitButton className="w-full" size="lg">가입하고 시작하기</SubmitButton>
    </form>
  );
}
