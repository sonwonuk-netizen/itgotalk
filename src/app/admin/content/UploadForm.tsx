"use client";

import { useActionState } from "react";
import { uploadContentAction } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, ErrorText, inputClass } from "@/components/ui";

export function UploadForm() {
  const [state, action] = useActionState(uploadContentAction, undefined);
  return (
    <Card className="mb-4">
      <h2 className="mb-1 font-bold">CSV 업로드</h2>
      <p className="mb-3 text-sm text-gray-600">
        <code>skills.csv</code>, <code>items_*.csv</code>, <code>explanations.csv</code> 형식. 모든 문항의 정답을 다시 계산해서, 하나라도 다르면 전체를 거부합니다.
      </p>
      <form action={action} className="flex flex-wrap gap-2">
        <select name="kind" aria-label="파일 종류" className={`${inputClass} w-40`}>
          <option value="items">문항 (items)</option>
          <option value="skills">스킬 (skills)</option>
          <option value="explanations">진단 설명 (explanations)</option>
        </select>
        <input type="file" name="file" accept=".csv,text/csv" aria-label="CSV 파일" className={`${inputClass} flex-1 py-2`} required />
        <SubmitButton>검증 후 반영</SubmitButton>
      </form>
      <div className="mt-3 space-y-2">
        <ErrorText>{state?.error}</ErrorText>
        {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
        {state?.errors && (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <b>업로드 거부 — {state.errors.length}건의 오류</b>
            <ul className="mt-1 max-h-60 list-disc overflow-auto pl-5">
              {state.errors.map((e, i) => <li key={i}><b>{e.line}행</b>: {e.message}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
