/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { STUDY_ROOM_CARDS } from "@/components/site/studyroom";

export default function SiteHome() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-site-purple">
        <img src="/site/hero-bg.jpg" alt="" className="absolute inset-0 hidden h-full w-full object-cover object-right md:block" />
        <img src="/site/hero-mobile.png" alt="" className="absolute inset-x-0 bottom-0 mx-auto w-[70%] max-w-sm md:hidden" />
        <div className="relative mx-auto flex min-h-[420px] max-w-7xl flex-col justify-center px-4 pb-48 pt-10 sm:px-6 md:min-h-[560px] md:pb-10">
          <img src="/site/hero-title.png" alt="수학" className="w-44 sm:w-64 md:w-80" />
          <p className="mt-6 text-lg font-bold text-white sm:text-2xl">읽고 말하는 재미있는</p>
          <p className="mt-1 max-w-md text-white/90 sm:text-lg">
            &quot;글을 쓰는 아이들&quot;은 아이들이 수학교육을 통해 자신만의 수학책을 작성할 수 있습니다.
          </p>
          <Link href="/studyroom" className="mt-6 inline-flex min-h-12 w-fit items-center rounded-full bg-site-yellow px-6 text-lg font-black text-gray-900 shadow hover:brightness-95">
            학습자료실 바로가기 →
          </Link>
        </div>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="absolute bottom-0 h-10 w-full text-white sm:h-16" aria-hidden>
          <path d="M0,40 C240,90 480,0 720,30 C960,60 1200,10 1440,40 L1440,80 L0,80 Z" fill="currentColor" />
        </svg>
      </section>

      {/* 학습자료실 (entry point to the math app) */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-3xl font-black text-gray-900 sm:text-4xl">
          책을쓰는 아이들 <span className="text-site-purple">학습자료실</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-gray-600">
          일반 적인 학습지와는 차별화된 내용으로 아이들이 쉽고 빠르게 학습합니다.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {STUDY_ROOM_CARDS.map((c) => (
            <Link key={c.title} href="/studyroom" className="group rounded-3xl bg-site-cream p-6 transition hover:-translate-y-1 hover:shadow-lg">
              <img src={c.icon} alt="" className="mx-auto h-28 w-28 transition group-hover:scale-105" />
              <h3 className="mt-4 text-xl font-black">{c.title}</h3>
              <p className="mt-1 text-gray-600">{c.short}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 교육이야기 · 교육원 */}
      <section className="relative bg-site-teal py-16">
        <img src="/site/teal-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="relative mx-auto max-w-6xl space-y-8 px-4 sm:px-6">
          <div className="text-center text-white">
            <h2 className="text-3xl font-black sm:text-4xl">책을 쓰는 아이들의 교육이야기와 교육원</h2>
            <p className="mt-2 text-lg">&quot;알아가는 재미에 대한 이야기를 나누는 공간입니다.&quot;</p>
          </div>
          <FeatureCard
            image="/site/card-education.png"
            title="교육이야기"
            lead="“알아가는 재미에 대한 이야기를 나누는 공간입니다.”"
            body={[
              "분수의 곱셈은 왜 분자끼리 곱하고 분모끼리 곱하는지? 음수 × 음수는 왜 양수가 되는지?",
              "책을 쓰는 아이들의 교육 이야기는 알아가는 재미에 대한 이야기를 나누는 공간입니다. 많은 참여 바랍니다.",
              "채택된 내용에 대해서는 소정의 문화 상품권을 드립니다.",
            ]}
            href="/education"
          />
          <FeatureCard
            image="/site/card-institute.png"
            title="교육원"
            lead="책을 쓰는 아이들의 교육원에서는 아이들이 수학을 쉽고 재미있게 배우며 성장합니다."
            body={[
              "아이들의 성장! 부모님의 보람! 선생님의 자부심을 위해 초등수학 교육 전문가 과정을 운영하고 있습니다.",
              "우리 동네 초등학생을 위한 교육원의 참여를 환영합니다.",
            ]}
            href="/institute"
          />
        </div>
      </section>

      {/* 문의 */}
      <section className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
        <h2 className="text-2xl font-black">문의하기</h2>
        <p className="mt-2 text-gray-600">궁금하신 사항을 문의 주시면 확인후 답변드리겠습니다.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a href="tel:02-2202-4095" className="inline-flex min-h-12 items-center rounded-full bg-site-teal-dark px-6 font-bold text-white">☎ 02-2202-4095</a>
          <Link href="/qa" className="inline-flex min-h-12 items-center rounded-full bg-white px-6 font-bold text-site-teal-dark ring-2 ring-site-teal-dark">상담신청</Link>
        </div>
      </section>
    </>
  );
}

function FeatureCard({ image, title, lead, body, href }: { image: string; title: string; lead: string; body: string[]; href: string }) {
  return (
    <article className="grid overflow-hidden rounded-[2rem] border-4 border-site-teal-dark bg-site-cream md:grid-cols-2">
      <img src={image} alt="" className="h-56 w-full object-cover md:h-full" />
      <div className="space-y-3 p-6 sm:p-8">
        <h3 className="text-3xl font-black">{title}</h3>
        <p className="text-lg font-bold text-site-teal">{lead}</p>
        {body.map((b) => <p key={b} className="text-gray-700">{b}</p>)}
        <Link href={href} className="inline-flex min-h-11 items-center rounded-full bg-site-teal-dark px-5 font-bold text-white hover:brightness-110">바로가기 →</Link>
      </div>
    </article>
  );
}
