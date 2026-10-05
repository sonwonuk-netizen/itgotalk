"use client";

import { useActionState } from "react";
import { loginAction } from "../auth-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ErrorText, Field, inputClass } from "@/components/ui";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="아이디">
        <input name="loginId" autoComplete="username" autoCapitalize="none" required className={inputClass} />
      </Field>
      <Field label="비밀번호">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <ErrorText>{state?.error}</ErrorText>
      <SubmitButton className="w-full" size="lg">로그인</SubmitButton>
    </form>
  );
}
