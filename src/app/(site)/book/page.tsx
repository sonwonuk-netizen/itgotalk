/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { Section, SubHero } from "@/components/site/SubHero";

export const metadata: Metadata = { title: "출판도서" };

const BOOKS = [
  { title: "읽고 말하는 수학(3)", image: "/site/book-3.jpg" },
  { title: "읽고 말하는 수학(2)", image: "/site/book-2.jpg" },
  { title: "읽고 말하는 수학(1)", image: "/site/book-1.jpg" },
];

export default function BookPage() {
  return (
    <>
      <SubHero title="출판도서" subtitle="읽고 말하며 알아가는 재미를 느끼는 수학" image="/site/banner-c.jpg" />
      <Section>
        <div className="grid gap-8 sm:grid-cols-3">
          {BOOKS.map((b) => (
            <article key={b.title} className="text-center">
              <img src={b.image} alt={b.title} className="mx-auto aspect-square w-full rounded-2xl bg-gray-50 object-contain shadow-sm ring-1 ring-gray-100" />
              <h2 className="mt-4 text-lg font-bold">{b.title}</h2>
              <p className="text-sm text-gray-500">읽고 말하며 알아가는 재미를 느끼는 수학</p>
              <p className="mt-1 text-xl font-black">11,000원</p>
            </article>
          ))}
        </div>
        <p className="mt-10 text-center text-gray-600">
          구매 문의는 <a href="tel:02-2202-4095" className="font-bold text-site-teal-dark">02-2202-4095</a> 또는{" "}
          <Link href="/qa" className="font-bold text-site-teal-dark underline">상담신청</Link>으로 남겨 주세요.
        </p>
      </Section>
    </>
  );
}
