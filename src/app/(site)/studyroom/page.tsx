/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser, homeFor } from "@/lib/auth/session";
import { asAnon } from "@/lib/db/client";
import { loadTracks } from "@/lib/server/content";
import { loadStudentHome, type TrackHome } from "@/lib/server/student";
import { Section, SubHero } from "@/components/site/SubHero";

export const metadata: Metadata = { title: "학습자료실" };

const STEPS = [
  { n: 1, title: "진단 테스트", body: "쉬운 단계부터 풀어 보며 지금 내 단계를 찾아요." },
  { n: 2, title: "그림 설명", body: "어려웠던 부분을 수직선·묶음·10칸 상자 그림으로 다시 봐요." },
  { n: 3, title: "연습 3번", body: "같은 세트를 세 번 연습하면 테스트가 열려요." },
  { n: 4, title: "테스트 통과", body: "다 맞히고 기준 시간 안에 풀면 다음 단계로!" },
];

/** 책을쓰는 아이들 학습자료실 — the site's entry point into the learning tracks. */
export default async function StudyRoomPage() {
  const user = await getSessionUser();
  const home = user?.role === "student" ? await loadStudentHome(user.id) : null;
  const tracks = home?.tracks ?? (await asAnon(loadTracks)).map((track) => ({ track }) as Pick<TrackHome, "track"> & Partial<TrackHome>);

  const trackHref = (t: Pick<TrackHome, "track"> & Partial<TrackHome>) => {
    if (!user) return "/login";
    if (user.role !== "student") return homeFor(user.role);
    if (!t.started && t.track.hasDiagnostic) return `/s/diagnostic?track=${t.track.id}`;
    return `/s/home#${t.track.id}`;
  };

  return (
    <>
      <SubHero title="학습자료실" subtitle="일반 적인 학습지와는 차별화된 내용으로 아이들이 쉽고 빠르게 학습합니다." image="/site/banner-c.jpg" />

      <Section>
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-site-cream p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex-1">
            {!user && (
              <>
                <h2 className="text-2xl font-black">책을쓰는 아이들 연산 훈련</h2>
                <p className="mt-1 text-gray-700">학원·공부방에서 받은 초대 코드로 가입하고 시작해요.</p>
              </>
            )}
            {user?.role === "student" && (
              <>
                <h2 className="text-2xl font-black">{user.initial} 학생, 반가워요!</h2>
                <p className="mt-1 text-gray-700">아래에서 하고 싶은 공부를 골라요.</p>
              </>
            )}
            {user && user.role !== "student" && (
              <>
                <h2 className="text-2xl font-black">{user.fullName ?? ""} 선생님</h2>
                <p className="mt-1 text-gray-700">학생 기록과 리포트는 관리 화면에서 볼 수 있어요.</p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={!user ? "/login" : homeFor(user.role)}
              className="inline-flex min-h-14 items-center rounded-2xl bg-site-purple px-7 text-lg font-black text-white shadow hover:bg-site-purple-dark"
            >
              {!user ? "로그인하고 시작하기" : user.role !== "student" ? "관리 화면으로" : "내 학습 화면"}
            </Link>
            {!user && (
              <Link href="/signup/student" className="inline-flex min-h-14 items-center rounded-2xl bg-white px-6 text-lg font-bold text-site-purple ring-2 ring-site-purple">
                처음이에요 (가입)
              </Link>
            )}
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((t) => (
            <Link
              key={t.track.id}
              href={trackHref(t)}
              data-track={t.track.id}
              className="group flex flex-col rounded-3xl bg-white p-6 text-center ring-1 ring-gray-200 transition hover:-translate-y-1 hover:shadow-lg"
            >
              {t.track.icon && <img src={t.track.icon} alt="" className="mx-auto h-28 w-28" />}
              <h3 className="mt-4 text-xl font-black">{t.track.name}</h3>
              <p className="mt-1 flex-1 text-gray-600">
                {t.current ? `지금: ${t.current.skill.name}` : t.started ? "모든 단계 통과! 🏆" : t.track.description}
              </p>
              {t.started && <p className="mt-1 text-sm text-gray-500">통과 {t.passedCount} / {t.totalSkills}</p>}
              <span className="mt-3 inline-block font-bold text-site-purple group-hover:underline">
                {t.started ? "이어서 하기 →" : t.track.hasDiagnostic ? "진단 테스트로 시작 →" : "시작하기 →"}
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <section className="bg-site-purple/10">
        <Section>
          <h2 className="text-center text-2xl font-black sm:text-3xl">이렇게 공부해요</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-2xl bg-white p-5 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-site-purple text-lg font-black text-white">{s.n}</span>
                <h3 className="mt-3 text-lg font-black">{s.title}</h3>
                <p className="mt-1 text-gray-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </Section>
      </section>
    </>
  );
}
