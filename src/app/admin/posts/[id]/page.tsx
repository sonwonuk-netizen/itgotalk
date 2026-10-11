import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getPost } from "@/lib/server/posts";
import { PageTitle } from "@/components/StaffShell";
import { PostForm } from "../PostForm";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const post = await getPost((await params).id);
  if (!post) notFound();
  return (
    <>
      <PageTitle actions={<Link href={`/admin/posts?board=${post.board}`} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">← 게시판</Link>}>글 수정</PageTitle>
      <PostForm post={post} board={post.board} />
    </>
  );
}
