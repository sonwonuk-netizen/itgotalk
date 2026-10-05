import Link from "next/link";
import { COMPANY } from "@/lib/site";
import { Section, SubHero } from "./SubHero";

/** Board page with no posts yet (same as the live site). */
export function EmptyBoard({ title }: { title: string }) {
  return (
    <>
      <SubHero title={title} subtitle="고객센터" image="/site/banner-b.jpg" />
      <Section>
        <p className="rounded-2xl py-16 text-center text-gray-500 ring-1 ring-gray-200">게시물이 없습니다.</p>
        <p className="mt-8 text-center text-gray-600">
          궁금하신 점은 <a href={`tel:${COMPANY.tel}`} className="font-bold text-site-teal-dark">{COMPANY.tel}</a> 또는{" "}
          <Link href="/qa" className="font-bold text-site-teal-dark underline">상담신청</Link>으로 문의해 주세요.
        </p>
      </Section>
    </>
  );
}
