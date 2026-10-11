"use client";

import { useActionState, useState } from "react";
import { createOrgAction } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, ErrorText, Field, inputClass } from "@/components/ui";

interface Props {
  regions: { id: string; name: string }[];
  schools: { id: string; name: string; region_id: string }[];
}

export function CreateOrgForm({ regions, schools }: Props) {
  const [state, action] = useActionState(createOrgAction, undefined);
  const [regionId, setRegionId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  return (
    <Card className="mb-4">
      <h2 className="mb-3 font-bold">새 기관 + 원장 계정</h2>
      <form action={action} className="grid gap-3 sm:grid-cols-3">
        <Field label="기관 이름"><input name="name" className={inputClass} required /></Field>
        <Field label="종류">
          <select name="kind" className={inputClass}><option value="academy">학원</option><option value="study_room">공부방</option></select>
        </Field>
        <div className="hidden sm:block" />
        <Field label="지역">
          <select aria-label="지역" className={inputClass} value={regionId} onChange={(e) => { setRegionId(e.target.value); setSchoolId(""); }} required>
            <option value="">선택</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="학교" hint="이 학교를 고른 학생이 이 기관으로 가입해요.">
          <select name="schoolId" aria-label="학교" className={inputClass} value={schoolId} onChange={(e) => setSchoolId(e.target.value)} disabled={!regionId} required>
            <option value="">선택</option>
            {schools.filter((s) => s.region_id === regionId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="hidden sm:block" />
        <Field label="원장 이름"><input name="directorName" className={inputClass} required /></Field>
        <Field label="원장 아이디"><input name="loginId" className={inputClass} required /></Field>
        <Field label="임시 비밀번호" hint="8자 이상"><input name="password" type="password" className={inputClass} required /></Field>
        <div className="flex items-end sm:col-start-3"><SubmitButton className="w-full">기관 만들기</SubmitButton></div>
      </form>
      {regions.length === 0 && <p className="mt-3 text-sm text-amber-700">먼저 지역·학교 메뉴에서 지역과 학교를 등록하세요.</p>}
      <div className="mt-3">
        <ErrorText>{state?.error}</ErrorText>
        {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      </div>
    </Card>
  );
}
