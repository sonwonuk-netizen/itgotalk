import type { Metadata } from "next";
import Link from "next/link";
import { Section, SubHero } from "@/components/site/SubHero";

export const metadata: Metadata = { title: "교육 이야기" };

const POSTS = [
  {
    id: 1,
    title: "1편-\"읽고 말하는 수학\"",
    author: "교육이야기01",
    date: "2025-07-21",
    body: [
      "수학교과는 그 내용과 개념을 읽고 말할 수 있어야 합니다.",
      "읽고 말하는 수학은 아이들이 수학을 읽고 말할 수 있도록 돕습니다.",
      "읽고 말하는 수학은 기초 연산에서 법칙적 사고에 이르는 학습 구조를 낮은 수준의 언어에서 추상적인 언어에 이르는 과정을 언어로 표현하도록 합니다.",
      "읽고 말하는 수학은 초등 과정에서 중학 과정까지 통찰할 수 있도록 돕습니다.",
      "교육에 관한 문의를 환영합니다.",
      "실력 테스트에서 맞춤형 과정 설계까지 친절하게 상담해 드리겠습니다.",
    ],
  },
];

export default function EducationPage() {
  return (
    <>
      <SubHero title="교육 이야기" subtitle="아이들이 수학을 읽고, 말하고, 쓰는 경험" image="/site/banner-c.jpg" />
      <Section>
        <p className="mb-8 text-center text-lg text-gray-700">
          ‘글을 쓰는 아이들’은 아이들이 수학을 직접 말하고, 책으로 써보는 경험을 통해 수학을 더 깊이 이해하고 재미있게 배울 수 있도록 돕습니다.
        </p>
        <ul className="divide-y rounded-2xl ring-1 ring-gray-200">
          {POSTS.map((p) => (
            <li key={p.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 hover:bg-gray-50">
                  <span className="rounded bg-site-teal px-2 py-0.5 text-xs font-bold text-white">공지</span>
                  <span className="flex-1 font-bold">{p.title}</span>
                  <span className="text-sm text-gray-500">{p.author} · {p.date}</span>
                </summary>
                <div className="space-y-2 border-t bg-site-cream/50 px-5 py-5 leading-relaxed text-gray-800">
                  {p.body.map((b) => <p key={b}>{b}</p>)}
                  <Link href="/qa" className="inline-block pt-2 font-bold text-site-teal-dark underline">상담신청 하기</Link>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
