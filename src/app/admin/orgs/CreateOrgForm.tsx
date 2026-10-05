"use client";

import { useActionState } from "react";
import { createOrgAction } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, ErrorText, Field, inputClass } from "@/components/ui";

export function CreateOrgForm() {
  const [state, action] = useActionState(createOrgAction, undefined);
  return (
    <Card className="mb-4">
      <h2 className="mb-3 font-bold">새 기관 + 원장 계정</h2>
      <form action={action} className="grid gap-3 sm:grid-cols-3">
        <Field label="기관 이름"><input name="name" className={inputClass} required /></Field>
        <Field label="종류">
          <select name="kind" className={inputClass}><option value="academy">학원</option><option value="study_room">공부방</option></select>
        </Field>
        <Field label="원장 이름"><input name="directorName" className={inputClass} required /></Field>
        <Field label="원장 아이디"><input name="loginId" className={inputClass} required /></Field>
        <Field label="임시 비밀번호" hint="8자 이상"><input name="password" type="password" className={inputClass} required /></Field>
        <div className="flex items-end"><SubmitButton className="w-full">기관 만들기</SubmitButton></div>
      </form>
      <div className="mt-3">
        <ErrorText>{state?.error}</ErrorText>
        {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      </div>
    </Card>
  );
}
