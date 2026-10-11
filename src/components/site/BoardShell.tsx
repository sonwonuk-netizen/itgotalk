import Link from "next/link";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { COMPANY } from "@/lib/site";
import type { Board } from "@/lib/server/posts";
import { Section, SubHero } from "./SubHero";

/** Board page frame (고객센터, 교육이야기); 본사 관리자 also gets a 글쓰기 shortcut. */
export async function BoardShell({ title, board, children, subtitle = "고객센터", image = "/site/banner-b.webp", intro }: {
  title: string;
  board: Board;
  children: ReactNode;
  subtitle?: string;
  image?: string;
  intro?: ReactNode;
}) {
  const user = await getSessionUser();
  return (
    <>
      <SubHero title={title} subtitle={subtitle} image={image} />
      <Section>
        {intro}
        {user?.role === "admin" && (
          <div className="mb-4 flex justify-end">
            <Link href={`/admin/posts/new?board=${board}`} className="rounded-full bg-site-purple px-5 py-2 font-bold text-white hover:bg-site-purple-dark">
              글쓰기
            </Link>
          </div>
        )}
        {children}
        <p className="mt-8 text-center text-gray-600">
          궁금하신 점은 <a href={`tel:${COMPANY.tel}`} className="font-bold text-site-teal-dark">{COMPANY.tel}</a> 또는{" "}
          <Link href="/qa" className="font-bold text-site-teal-dark underline">상담신청</Link>으로 문의해 주세요.
        </p>
      </Section>
    </>
  );
}

export function EmptyPosts() {
  return <p className="rounded-2xl py-16 text-center text-gray-500 ring-1 ring-gray-200">게시물이 없습니다.</p>;
}

const dateFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
export const formatDate = (d: Date) => dateFmt.format(d);
