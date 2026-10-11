import type { Metadata } from "next";
import Link from "next/link";
import { BoardShell, EmptyPosts, formatDate } from "@/components/site/BoardShell";
import { listPosts } from "@/lib/server/posts";

export const metadata: Metadata = { title: "교육 이야기" };
export const dynamic = "force-dynamic";

/** 교육이야기: stories written by 본사 관리자 (관리자 → 게시판 → 교육이야기). */
export default async function EducationPage() {
  const posts = await listPosts("education");
  return (
    <BoardShell
      title="교육 이야기"
      board="education"
      subtitle="아이들이 수학을 읽고, 말하고, 쓰는 경험"
      image="/site/banner-c.webp"
      intro={
        <p className="mb-8 text-center text-lg text-gray-700">
          ‘글을 쓰는 아이들’은 아이들이 수학을 직접 말하고, 책으로 써보는 경험을 통해 수학을 더 깊이 이해하고 재미있게 배울 수 있도록 돕습니다.
        </p>
      }
    >
      {posts.length === 0 ? (
        <EmptyPosts />
      ) : (
        <ul className="divide-y rounded-2xl ring-1 ring-gray-200" data-testid="education-list">
          {posts.map((p) => (
            <li key={p.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 hover:bg-gray-50">
                  {p.pinned && <span className="rounded bg-site-teal px-2 py-0.5 text-xs font-bold text-white">공지</span>}
                  <span className="flex-1 font-bold">{p.title}</span>
                  <span className="text-sm text-gray-500">{formatDate(p.created_at)}</span>
                </summary>
                <div className="space-y-2 border-t bg-site-cream/50 px-5 py-5 leading-relaxed text-gray-800">
                  {/* Plain text: React escapes it; line breaks are kept. */}
                  <div className="whitespace-pre-line break-words">{p.body}</div>
                  <Link href="/qa" className="inline-block pt-2 font-bold text-site-teal-dark underline">상담신청 하기</Link>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </BoardShell>
  );
}
