/* eslint-disable @next/next/no-img-element */
import { requireRole } from "@/lib/auth/session";
import { loadStudentHome, type TrackHome } from "@/lib/server/student";
import { startTrackAction } from "../actions";
import { StudentHeader } from "@/components/StudentHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { LinkButton, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function StudentHome() {
  const user = await requireRole("student");
  const home = await loadStudentHome(user.id);

  return (
    <main className="kid">
      <StudentHeader initial={user.initial} orgName={home.orgName} />
      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-10 sm:px-6">
        <h1 className="text-2xl font-bold">오늘도 한 단계!</h1>
        {home.tracks.map((t) => <TrackCard key={t.track.id} t={t} />)}
      </div>
    </main>
  );
}

function TrackCard({ t }: { t: TrackHome }) {
  const c = t.current;
  return (
    <section id={t.track.id} data-track={t.track.id} className="rounded-3xl bg-white p-6 shadow-md" aria-label={t.track.name}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {t.track.icon && <img src={t.track.icon} alt="" className="h-12 w-12" />}
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-500">{t.track.name}</div>
          {t.started && <div className="text-sm text-gray-500">통과한 단계 {t.passedCount} / {t.totalSkills}</div>}
        </div>
      </div>

      {t.review && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl bg-sun-100 p-4 ring-2 ring-sun-400">
          <div className="flex-1">
            <div className="text-sm font-semibold text-amber-800">복습 세트가 도착했어요</div>
            <div className="text-xl font-bold">{t.review.skill.name} · 세트 {t.review.setNo}</div>
          </div>
          <LinkButton tone="warn" href={`/s/play/${t.review.setId}?mode=practice`}>복습하기</LinkButton>
        </div>
      )}

      {!t.started ? (
        <div className="flex flex-wrap items-center gap-4">
          <p className="flex-1 text-lg text-gray-700">{t.track.description}</p>
          {t.track.hasDiagnostic ? (
            <LinkButton href={`/s/diagnostic?track=${t.track.id}`} size="lg">진단 테스트로 시작</LinkButton>
          ) : (
            <form action={startTrackAction}>
              <input type="hidden" name="trackId" value={t.track.id} />
              <SubmitButton size="lg">시작하기</SubmitButton>
            </form>
          )}
        </div>
      ) : c ? (
        <>
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-4xl font-black text-brand-700">{c.skill.name}</h2>
            {c.setCount > 1 && <span className="text-lg text-gray-500">세트 {c.setNo} / {c.setCount}</span>}
          </div>
          {c.skill.hint && <p className="mt-2 text-lg text-gray-700">💡 {c.skill.hint}</p>}
          {c.skill.pattern !== "tap_sequence" && (
            <a href={`/s/learn/${c.skill.id}`} className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand-600 hover:underline">그림으로 설명 보기 →</a>
          )}
          {c.consecutiveFail > 0 && (
            <p className="mt-3 rounded-xl bg-brand-50 px-4 py-2 text-brand-700">한 번 더! 연습 {c.skill.practiceRequired}번 하고 다시 도전해요.</p>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <a href={`/s/play/${c.setId}?mode=practice`} className={`${buttonClass("primary", "lg")} min-h-28 flex-col`}>
              <span>연습하기</span>
              <span className="text-base font-medium opacity-90" data-testid="practice-count">
                {Math.min(c.practiceCount, c.skill.practiceRequired)} / {c.skill.practiceRequired}
              </span>
            </a>
            {c.testOpen ? (
              <a href={`/s/play/${c.setId}?mode=test`} className={`${buttonClass("success", "lg")} min-h-28 flex-col`}>
                <span>테스트</span>
                <span className="text-base font-medium opacity-90">
                  {c.skill.timeRule === "per_set" ? `${c.skill.timeLimitSec}초 안에 다 맞히기` : `문항당 ${c.skill.timeLimitSec}초`}
                </span>
              </a>
            ) : (
              <button disabled aria-disabled className={`${buttonClass("success", "lg")} min-h-28 flex-col`}>
                <span>🔒 테스트</span>
                <span className="text-base font-medium">연습 {c.skill.practiceRequired}번 하면 열려요</span>
              </button>
            )}
            <a href={`/s/play/${c.setId}?mode=race_ai`} className={`${buttonClass("warn", "lg")} min-h-28 flex-col`}>
              <span>🤖 AI랑 시합</span>
              <span className="text-base font-medium opacity-80">혼자 놀기</span>
            </a>
          </div>
        </>
      ) : (
        <div className="py-4 text-center">
          <div className="text-5xl">🏆</div>
          <h2 className="mt-2 text-2xl font-black">{t.track.name} 모든 단계를 통과했어요!</h2>
        </div>
      )}
    </section>
  );
}
