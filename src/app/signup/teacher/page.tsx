"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupTeacherAction } from "../../auth-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { HomeLogo } from "@/components/HomeLogo";
import { ErrorText, Field, inputClass } from "@/components/ui";

export default function TeacherSignupPage() {
  const [state, action] = useActionState(signupTeacherAction, undefined);
  return (
    <main className="flex min-h-dvh justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-4 py-10">
        <HomeLogo />
        <h1 className="text-2xl font-bold">선생님 가입</h1>
        <p className="text-sm text-gray-600">기관 코드로 가입하면 원장님 승인 후 학생 정보를 볼 수 있어요.</p>
        <form action={action} className="space-y-4 rounded-2xl bg-white p-6 shadow">
          <Field label="기관 코드"><input name="inviteCode" className={`${inputClass} uppercase`} required /></Field>
          <Field label="이름"><input name="fullName" className={inputClass} required /></Field>
          <Field label="아이디" hint="영어 소문자·숫자 4~20자"><input name="loginId" autoCapitalize="none" className={inputClass} required /></Field>
          <Field label="비밀번호" hint="8자 이상"><input name="password" type="password" className={inputClass} required /></Field>
          <ErrorText>{state?.error}</ErrorText>
          <SubmitButton className="w-full">가입 신청</SubmitButton>
        </form>
        <Link href="/login" className="block text-center text-sm text-gray-500 hover:underline">로그인으로 돌아가기</Link>
      </div>
    </main>
  );
}
