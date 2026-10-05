/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { Section, SubHero } from "@/components/site/SubHero";

export const metadata: Metadata = { title: "대표 프로그램" };

export default function ProgramPage() {
  return (
    <>
      <SubHero title="대표 프로그램" subtitle="아이들이 수학을 읽고, 말하고, 쓰는 경험" image="/site/banner-b.jpg" />
      <Section>
        <p className="mx-auto max-w-3xl text-center text-xl leading-relaxed text-gray-800">
          ‘글을 쓰는 아이들’은 아이들이 수학을 직접 말하고, 책으로 써보는 경험을 통해 수학을 더 깊이 이해하고 재미있게 배울 수 있도록 설립된 교육회사입니다.
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <article className="overflow-hidden rounded-3xl bg-site-cream">
            <img src="/site/photo-classroom.jpg" alt="" className="h-56 w-full object-cover" />
            <div className="space-y-3 p-6">
              <h2 className="text-2xl font-black">수학을 읽고 말하기</h2>
              <p className="font-semibold text-site-teal-dark">&quot;분수의 곱셈은 왜 분자끼리, 분모끼리 곱할까?&quot;<br />&quot;달까지의 거리는 어떻게 측정한 걸까?&quot;</p>
              <p className="text-gray-700">이런 수학과 관련한 이야기를 통해 수학을 흥미롭게 배웁니다.</p>
              <p className="text-gray-700"><b>&quot;읽고 말하는 수학&quot;</b> 아이들에게 알아가는 재미를 느끼도록 안내합니다.</p>
            </div>
          </article>
          <article className="overflow-hidden rounded-3xl bg-site-purple/10">
            <img src="/site/photo-board.jpg" alt="" className="h-56 w-full object-cover" />
            <div className="space-y-3 p-6">
              <h2 className="text-2xl font-black">과정수학</h2>
              <p className="text-gray-700">기초 연산이 부족한 아이들을 위한 연산 중심 보완 프로그램</p>
              <p className="text-gray-700">계산의 기본기를 다지고 수학 학습의 자신감을 키워줍니다.</p>
              <Link href="/studyroom" className="inline-flex min-h-11 items-center rounded-full bg-site-purple px-5 font-bold text-white hover:bg-site-purple-dark">
                학습자료실에서 연산 훈련하기 →
              </Link>
            </div>
          </article>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border-2 border-site-teal p-6">
            <h2 className="text-xl font-black text-site-teal-dark">교육 철학</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-700">
              <li>수학은 하나의 기호 언어, 읽고 말하고 쓰며 익히는 것이 진짜 수학이라 믿습니다.</li>
              <li>아이들이 수학을 통해 이해하는 즐거움을 느끼고 학습하고 싶은 마음이 스스로 생겨나도록 합니다.</li>
            </ul>
          </div>
          <div className="rounded-3xl border-2 border-site-purple p-6">
            <h2 className="text-xl font-black text-site-purple-dark">교육의 목적</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-700">
              <li>단순 암기가 아닌, 개념의 이해와 표현력 향상</li>
              <li>구체에서 추상으로 사고가 확장되는 수학적 사고력 성장</li>
              <li>자신만의 언어로 수학을 설명하는 힘 키우기</li>
            </ul>
          </div>
        </div>
      </Section>
    </>
  );
}
