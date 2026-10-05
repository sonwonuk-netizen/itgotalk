/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { Section, SubHero } from "@/components/site/SubHero";

export const metadata: Metadata = { title: "책을 쓰는 아이들" };

const STORY = [
  "약 30년 전 아들에게 컴퓨터를 사주고 일기를 쓰도록 했습니다.",
  "컴퓨터 하고 싶은 마음인지 아들은 매일 매일 컴퓨터를 사용해서 어린이 훈민정음이라는 워드 프로세서로 일기를 썼습니다.",
  "지금은 손녀와 같이 글 쓰기 놀이를 합니다.",
  "손녀가 쓴 글과 그린 그림으로 스캔해서 한 페이지를 만드는 과정을 손녀에게 보여 줬습니다.",
  "과정을 보고 난 손녀는 저에게 이렇게 묻습니다.",
  "\"할아버지 저도 책꽂이에 있는 책과 같은 책을 쓸 수 있을까요?\"",
  "저는 아주 긍정적으로 답을 했죠 \"물론이지!\"",
  "손녀는 환하게 웃으며 \"그럼 다음에 더 정성을 다해 써야겠어요.\"라고 말합니다.",
  "그리고 3년째 열심히 책 쓰기 연습을 합니다.",
  "모든 아이들이 책을 쓸 수 있는 것은 아닙니다.",
  "그러나 쉬지 않고 꾸준히 연습 한다면 책을 쓰지 못했어도 아이들에게 좋은 경험이 될 거라 믿습니다.",
  "이 과정을 통해 아이들이 책을 좋아 하는 아이로 성장하기를 기대합니다.",
  "책을 쓰는 아이들은 수학 교과를 주제로 추상화 과정의 어휘를 중심으로 이야기 나누고 익히며 책 쓰기 연습을 합니다.",
];

export default function IntroducePage() {
  return (
    <>
      <SubHero title="책을 쓰는 아이들" subtitle="아이들이 수학을 읽고, 말하고, 쓰는 경험" image="/site/banner-a.jpg" />
      <Section>
        <p className="mx-auto max-w-3xl text-center text-xl leading-relaxed text-gray-800">
          ‘글을 쓰는 아이들’은 아이들이 수학을 직접 말하고, 책으로 써보는 경험을 통해 수학을 더 깊이 이해하고 재미있게 배울 수 있도록 설립된 교육회사입니다.
        </p>
        <div className="mt-12 grid items-start gap-10 md:grid-cols-[1fr_320px]">
          <div className="space-y-3 text-lg leading-relaxed text-gray-700">
            {STORY.map((s) => <p key={s}>{s}</p>)}
            <p className="pt-2 font-bold text-gray-900">- 책을 쓰는 아이들 대표 -</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
            <img src="/site/note-1.jpg" alt="아이가 쓴 수학 노트" className="rounded-2xl shadow" />
            <img src="/site/note-2.jpg" alt="아이가 쓴 수학 노트" className="rounded-2xl shadow" />
          </div>
        </div>
      </Section>
      <section className="grid grid-cols-2 gap-1 md:grid-cols-4">
        {["photo-girl", "photo-pair", "photo-boy", "photo-board"].map((p) => (
          <img key={p} src={`/site/${p}.jpg`} alt="" className="aspect-[4/3] w-full object-cover" />
        ))}
      </section>
    </>
  );
}
