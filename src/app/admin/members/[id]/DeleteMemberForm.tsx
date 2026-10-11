"use client";

import { useActionState } from "react";
import { deleteMemberAction } from "../../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ErrorText, inputClass } from "@/components/ui";

/** Irreversible: the admin types the member's login id to enable the button. */
export function DeleteMemberForm({ id, loginId, isStudent, isSelf }: { id: string; loginId: string; isStudent: boolean; isSelf: boolean }) {
  const [state, action] = useActionState(deleteMemberAction, undefined);
  return (
    <section className="mt-8 max-w-3xl rounded-2xl border border-red-200 bg-red-50/50 p-6">
      <h2 className="text-lg font-bold text-red-700">회원 삭제</h2>
      {isSelf ? (
        <p className="mt-1 text-sm text-gray-700">지금 로그인한 본사 관리자 계정은 삭제할 수 없습니다.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-700">
            삭제하면 되돌릴 수 없습니다.{" "}
            {isStudent
              ? "학습 기록, 진도, 진단 평가, 리포트와 학부모 연락처도 함께 지워집니다."
              : "이 회원이 남긴 첨삭 코멘트도 함께 지워집니다. 기관은 그대로 남습니다."}
          </p>
          <form action={action} className="mt-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={id} />
            <label className="text-sm">
              <span className="mb-1 block text-gray-700">확인을 위해 아이디 <b className="font-mono">{loginId}</b> 를 입력하세요</span>
              <input name="confirmLoginId" autoComplete="off" autoCapitalize="none" className={`${inputClass} max-w-xs`} />
            </label>
            <SubmitButton tone="danger" pendingText="삭제 중…">회원 삭제</SubmitButton>
          </form>
          <div className="mt-2"><ErrorText>{state?.error}</ErrorText></div>
        </>
      )}
    </section>
  );
}
