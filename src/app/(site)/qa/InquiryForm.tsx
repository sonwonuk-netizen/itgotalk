"use client";

import { useActionState } from "react";
import { submitInquiryAction } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ErrorText, Field, inputClass } from "@/components/ui";

export function InquiryForm() {
  const [state, action] = useActionState(submitInquiryAction, undefined);
  if (state?.ok) {
    return (
      <div className="rounded-3xl bg-site-cream p-10 text-center">
        <div className="text-5xl">📮</div>
        <h2 className="mt-3 text-2xl font-black">상담 신청이 접수되었어요</h2>
        <p className="mt-2 text-gray-700">확인 후 남겨 주신 연락처로 답변드리겠습니다.</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="이름"><input name="name" className={inputClass} required maxLength={30} /></Field>
        <Field label="연락처"><input name="phone" type="tel" inputMode="tel" placeholder="010-1234-5678" className={inputClass} required /></Field>
      </div>
      <Field label="문의 종류">
        <select name="topic" className={inputClass} required defaultValue="">
          <option value="" disabled>선택</option>
          <option>학습 상담</option>
          <option>교육원 가맹</option>
          <option>도서 구매</option>
          <option>기타</option>
        </select>
      </Field>
      <Field label="문의 내용"><textarea name="message" rows={6} className={`${inputClass} py-3`} required maxLength={2000} /></Field>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-3 text-sm text-gray-700">
        <input type="checkbox" name="consent" className="mt-0.5 h-5 w-5" required />
        <span>[필수] 상담 답변을 위해 이름·연락처를 수집·이용하는 데 동의합니다. 상담 완료 후 지체 없이 파기합니다.</span>
      </label>
      <ErrorText>{state?.error}</ErrorText>
      <SubmitButton className="w-full !bg-site-teal-dark">상담 신청하기</SubmitButton>
    </form>
  );
}
