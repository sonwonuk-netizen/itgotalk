import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoardShell, formatDate } from "@/components/site/BoardShell";
import { getPost } from "@/lib/server/posts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const post = await getPost((await params).id);
  return { title: post?.board === "notice" ? post.title : "공지사항" };
}

export default async function NoticeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const post = await getPost((await params).id);
  if (!post || post.board !== "notice") notFound();
  return (
    <BoardShell title="공지사항" board="notice">
      <article className="border-y border-gray-300">
        <header className="border-b border-gray-200 px-2 py-4">
          <h2 className="text-xl font-bold">{post.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{formatDate(post.created_at)}</p>
        </header>
        {/* Plain text: React escapes it; line breaks are kept. */}
        <div className="whitespace-pre-line break-words px-2 py-6 leading-relaxed">{post.body}</div>
      </article>
      <div className="mt-4 text-center">
        <Link href="/notice" className="inline-block rounded-full px-5 py-2 font-semibold ring-1 ring-gray-300 hover:bg-gray-50">목록</Link>
      </div>
    </BoardShell>
  );
}
