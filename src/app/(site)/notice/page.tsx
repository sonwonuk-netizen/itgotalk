import type { Metadata } from "next";
import Link from "next/link";
import { BoardShell, EmptyPosts, formatDate } from "@/components/site/BoardShell";
import { listPosts } from "@/lib/server/posts";

export const metadata: Metadata = { title: "공지사항" };
export const dynamic = "force-dynamic";

export default async function NoticePage() {
  const posts = await listPosts("notice");
  return (
    <BoardShell title="공지사항" board="notice">
      {posts.length === 0 ? (
        <EmptyPosts />
      ) : (
        <ul className="divide-y divide-gray-200 border-y border-gray-300" data-testid="notice-list">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/notice/${p.id}`} className="flex items-center gap-3 px-2 py-4 hover:bg-gray-50">
                {p.pinned && <span className="shrink-0 rounded-full bg-site-purple px-2.5 py-0.5 text-xs font-bold text-white">공지</span>}
                <span className="flex-1 font-semibold">{p.title}</span>
                <span className="shrink-0 text-sm text-gray-500">{formatDate(p.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BoardShell>
  );
}
