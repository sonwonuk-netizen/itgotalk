import type { Metadata } from "next";
import { BoardShell, EmptyPosts } from "@/components/site/BoardShell";
import { listPosts } from "@/lib/server/posts";

export const metadata: Metadata = { title: "자주하는 질문" };
export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const posts = await listPosts("faq");
  return (
    <BoardShell title="자주하는 질문" board="faq">
      {posts.length === 0 ? (
        <EmptyPosts />
      ) : (
        <div className="divide-y divide-gray-200 border-y border-gray-300" data-testid="faq-list">
          {posts.map((p) => (
            <details key={p.id} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-2 py-4 font-semibold hover:bg-gray-50">
                <span className="text-site-purple">Q</span>
                <span className="flex-1">{p.title}</span>
                <span className="text-gray-400 transition group-open:rotate-180">▾</span>
              </summary>
              <div className="flex gap-3 bg-gray-50 px-2 py-4">
                <span className="font-semibold text-site-teal-dark">A</span>
                <div className="flex-1 whitespace-pre-line break-words leading-relaxed">{p.body}</div>
              </div>
            </details>
          ))}
        </div>
      )}
    </BoardShell>
  );
}
