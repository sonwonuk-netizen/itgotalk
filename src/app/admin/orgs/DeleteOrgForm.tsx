"use client";

import { useActionState } from "react";
import { deleteOrgAction } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ErrorText } from "@/components/ui";

/** Collapsed "삭제" control; deleting needs the organization name typed in. */
export function DeleteOrgForm({ id, name, students, staff }: { id: string; name: string; students: number; staff: number }) {
  const [state, action] = useActionState(deleteOrgAction, undefined);
  return (
    <details className="group">
      <summary className="cursor-pointer list-none whitespace-nowrap rounded-lg px-2 py-1 text-sm font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">
        삭제
      </summary>
      <form action={action} className="mt-2 w-64 space-y-2 rounded-xl bg-red-50 p-3 text-xs text-gray-700 ring-1 ring-red-200">
        <input type="hidden" name="id" value={id} />
        <p>
          되돌릴 수 없습니다. 원장·선생님 계정 {staff}개는 함께 삭제되고, 학생 {students}명은 학습 기록을 유지한 채 &ldquo;소속 없음&rdquo;이 됩니다.
        </p>
        <label className="block">
          확인: 기관 이름 <b>{name}</b> 입력
          <input name="confirmName" autoComplete="off" className="mt-1 min-h-10 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm" />
        </label>
        <SubmitButton size="sm" tone="danger" pendingText="삭제 중…">기관 삭제</SubmitButton>
        <ErrorText>{state?.error}</ErrorText>
      </form>
    </details>
  );
}
