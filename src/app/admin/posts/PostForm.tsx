"use client";

import { useActionState } from "react";
import { deletePostAction, savePostAction, type PostFormState } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ErrorText, Field, inputClass } from "@/components/ui";

// Mirrors Board in src/lib/server/posts.ts (server-only, so not importable here).
type Board = "notice" | "faq" | "education";

interface Props {
  post?: { id: string; board: Board; title: string; body: string; pinned: boolean };
  board: Board;
}

export function PostForm({ post, board }: Props) {
  const [state, action] = useActionState<PostFormState, FormData>(savePostAction, { seq: 0 });
  const v = state.values;
  const isFaq = (v?.board ?? post?.board ?? board) === "faq";
  return (
    <div className="max-w-3xl space-y-4">
      {/* key: React resets a form after its action; remount with what was typed when saving failed. */}
      <form key={state.seq} action={action} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        {post && <input type="hidden" name="id" value={post.id} />}
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <Field label="게시판">
            <select name="board" defaultValue={v?.board ?? post?.board ?? board} className={inputClass}>
              <option value="notice">공지사항</option>
              <option value="faq">자주하는 질문</option>
              <option value="education">교육이야기</option>
            </select>
          </Field>
          <Field label={isFaq ? "질문" : "제목"}>
            <input name="title" defaultValue={v?.title ?? post?.title ?? ""} maxLength={200} required className={inputClass} />
          </Field>
        </div>
        <Field label={isFaq ? "답변" : "내용"} hint="줄바꿈은 그대로 보입니다. HTML은 쓸 수 없습니다.">
          <textarea name="body" defaultValue={v?.body ?? post?.body ?? ""} rows={14} maxLength={20000} required className={`${inputClass} py-3`} />
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="pinned" defaultChecked={v ? v.pinned === "on" : (post?.pinned ?? false)} className="h-5 w-5" />
          맨 위에 고정
        </label>
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton>{post ? "저장" : "등록"}</SubmitButton>
      </form>
      {post && (
        <form
          action={deletePostAction}
          onSubmit={(e) => {
            if (!window.confirm("이 글을 삭제할까요? 되돌릴 수 없습니다.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={post.id} />
          <input type="hidden" name="board" value={post.board} />
          <SubmitButton tone="danger" size="sm" pendingText="삭제 중…">글 삭제</SubmitButton>
        </form>
      )}
    </div>
  );
}
