import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { BOARDS, BOARD_LABEL, BOARD_PATH, listPosts, toBoard } from "@/lib/server/posts";
import { PageTitle, Table, td } from "@/components/StaffShell";
import { Badge, LinkButton, formatDateTime } from "@/components/ui";

export default async function AdminPostsPage({ searchParams }: { searchParams: Promise<{ board?: string; saved?: string; deleted?: string }> }) {
  await requireRole("admin");
  const sp = await searchParams;
  const board = toBoard(sp.board);
  const posts = await listPosts(board);
  return (
    <>
      <PageTitle actions={<LinkButton href={`/admin/posts/new?board=${board}`} size="sm">새 글 쓰기</LinkButton>}>게시판</PageTitle>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {BOARDS.map((b) => (
          <Link
            key={b}
            href={`/admin/posts?board=${b}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${b === board ? "bg-brand-600 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"}`}
          >
            {BOARD_LABEL[b]}
          </Link>
        ))}
        <Link href={BOARD_PATH[board]} className="ml-auto text-sm text-gray-500 hover:underline">사이트에서 보기 →</Link>
      </div>
      {sp.saved && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">저장했습니다.</p>}
      {sp.deleted && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">삭제했습니다.</p>}
      <Table head={[board === "faq" ? "질문" : "제목", "작성일", "수정일", ""]}>
        {posts.map((p) => (
          <tr key={p.id}>
            <td className={`${td} font-semibold`}>
              {p.pinned && <Badge tone="amber">고정</Badge>} <Link href={`/admin/posts/${p.id}`} className="hover:underline">{p.title}</Link>
            </td>
            <td className={`${td} whitespace-nowrap`}>{formatDateTime(p.created_at)}</td>
            <td className={`${td} whitespace-nowrap`}>{formatDateTime(p.updated_at)}</td>
            <td className={td}><Link href={`/admin/posts/${p.id}`} className="font-semibold text-brand-700 hover:underline">수정</Link></td>
          </tr>
        ))}
        {posts.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">아직 글이 없습니다. &ldquo;새 글 쓰기&rdquo;로 첫 글을 올려 보세요.</td></tr>}
      </Table>
    </>
  );
}
