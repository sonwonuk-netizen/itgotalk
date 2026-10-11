import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { PageTitle } from "@/components/StaffShell";
import { toBoard } from "@/lib/server/posts";
import { PostForm } from "../PostForm";

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  await requireRole("admin");
  const board = toBoard((await searchParams).board);
  return (
    <>
      <PageTitle actions={<Link href={`/admin/posts?board=${board}`} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">← 게시판</Link>}>새 글 쓰기</PageTitle>
      <PostForm board={board} />
    </>
  );
}
