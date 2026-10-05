/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { Section, SubHero } from "@/components/site/SubHero";

export const metadata: Metadata = { title: "교육원" };

const FOR_WHOM = [
  "교육에 뜻이 있는 분",
  "우리 동네 아이들을 위한 특별한 수학 교육을 꿈꾸는 분",
  "아이들의 말하기·쓰기 중심 수학 교육에 공감하시는 분",
  "초등 수학교육 전문가로 성장하고 싶은 분",
];

export default function InstitutePage() {
  return (
    <>
      <SubHero
        title="교육원"
        subtitle="책을 쓰는 아이들의 교육원에서는 아이들이 수학을 쉽고 재미있게 배우며 성장 합니다."
        image="/site/banner-a.jpg"
      />
      <Section>
        <p className="mx-auto max-w-3xl text-center text-lg text-gray-700">
          아이들의 성장! 부모님의 보람! 선생님의 자부심을 위해 초등수학교육 전문가 양성과정을 운영하고 있습니다.
        </p>
        <div className="mt-12 grid items-center gap-10 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-3xl font-black">함께 성장하는 교육</h2>
            <p className="text-xl font-bold text-site-teal-dark">지금 &quot;책을 쓰는 아이들의 교육원&quot;과 함께 하세요!</p>
            <p className="leading-relaxed text-gray-700">
              아이들이 수학을 쉽고 재미있게 배우고, 직접 자신만의 수학책을 써가는 특별한 교육 경험! 그 가치를 지역사회와 함께 나누고 싶으신가요?
              책을 쓰는 아이들의 교육원에서는 아이의 성장, 부모님의 만족, 선생님의 자부심을 모두 담은 교육을 함께 실현할 교육 파트너를 찾고 있습니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {["photo-class", "photo-teacher", "photo-group", "photo-classroom"].map((p) => (
              <img key={p} src={`/site/${p}.jpg`} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover" />
            ))}
          </div>
        </div>
        <div className="mt-12 rounded-3xl bg-site-cream p-6 sm:p-8">
          <h2 className="text-2xl font-black">이런분께 추천합니다.</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {FOR_WHOM.map((f) => <li key={f} className="rounded-xl bg-white px-4 py-3 font-semibold">· {f}</li>)}
          </ul>
          <h3 className="mt-8 text-xl font-black">지금 시작해 보세요!</h3>
          <p className="mt-2 text-gray-700">
            &quot;책을 쓰는 아이들 교육원&quot;으로 아이들의 성장을 돕는 일로 사회에 참여하고, 그 속에서 보람을 느끼고 싶은 분의 참여를 환영합니다.
          </p>
          <Link href="/qa" className="mt-5 inline-flex min-h-12 items-center rounded-full bg-site-teal-dark px-6 font-bold text-white">문의하기 →</Link>
        </div>
      </Section>
    </>
  );
}
