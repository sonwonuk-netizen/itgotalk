import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { asUser } from "@/lib/db/client";
import { displayParts, type Blank, type Op } from "@/lib/content/items";
import { loadProgress } from "@/lib/server/content";
import { StudentHeader } from "@/components/StudentHeader";
import { Confetti } from "@/components/Confetti";
import { LinkButton, formatSec } from "@/components/ui";

export const dynamic = "force-dynamic";

interface WrongItem { a: number; op: Op; b: number; blank: Blank; answer: number; given: number | null }

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireRole("student");
  const { attemptId } = await params;
  const data = await asUser(user.id, async (tx) => {
    const { rows } = await tx.query<{
      id: string; set_id: string; mode: string; item_count: number; correct_count: number; elapsed_ms: number;
      passed: boolean | null; wrong_items: WrongItem[]; skill_id: string; skill_name: string; set_no: number;
      practice_required: number; time_rule: string; time_limit_sec: string; ai_target_ms: number | null; pattern: string;
    }>(
      `select a.id, a.set_id, a.mode, a.item_count, a.correct_count, a.elapsed_ms, a.passed, a.wrong_items,
              k.id as skill_id, k.name as skill_name, s.ord as set_no, k.practice_required, k.time_rule, k.time_limit_sec, k.pattern,
              ps.ai_target_ms
       from attempts a join item_sets s on s.id = a.set_id join skills k on k.id = s.skill_id
       left join play_sessions ps on ps.attempt_id = a.id
       where a.id = $1 and a.student_id = $2`,
      [attemptId, user.id],
    );
    const attempt = rows[0];
    if (!attempt) return null;
    const progress = (await loadProgress(tx, user.id)).find((p) => p.skillId === attempt.skill_id);
    return { attempt, progress };
  });
  if (!data) notFound();
  const { attempt: a, progress } = data;
  const allCorrect = a.correct_count === a.item_count;

  let emoji = "👍";
  let headline = "잘했어요!";
  let sub = "";
  if (a.mode === "test") {
    if (a.passed) {
      emoji = "🎉";
      headline = "통과!";
      sub = progress?.status === "passed" ? `${a.skill_name} 단계를 모두 마쳤어요. 다음 단계가 열렸어요!` : "다음 세트가 열렸어요!";
    } else {
      emoji = "💪";
      headline = "한 번 더!";
      sub = !allCorrect
        ? `틀린 문제를 다시 연습하고 도전해요. (연습 ${a.practice_required}번)`
        : `다 맞혔어요! 조금만 더 빠르게 해 봐요. (기준 ${a.time_rule === "per_set" ? `${Number(a.time_limit_sec)}초` : `문항당 ${Number(a.time_limit_sec)}초`})`;
    }
  } else if (a.mode === "practice") {
    const n = progress?.practiceCount ?? 0;
    headline = "연습 완료!";
    sub = progress?.status === "in_progress" && progress.currentSetId === a.set_id
      ? n >= a.practice_required ? "테스트가 열렸어요!" : `연습 ${n} / ${a.practice_required}`
      : "";
  } else if (a.mode === "race_ai" && a.ai_target_ms) {
    const won = allCorrect && a.elapsed_ms <= a.ai_target_ms;
    emoji = won ? "🏁" : "🤖";
    headline = won ? "AI를 이겼어요!" : "아깝다!";
    sub = `AI 기록 ${formatSec(a.ai_target_ms)}${allCorrect ? "" : " · 다 맞혀야 이길 수 있어요"}`;
  }

  return (
    <main className="kid">
      <StudentHeader initial={user.initial} />
      {a.passed && <Confetti />}
      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-10 text-center sm:px-6">
        <div className="animate-pop text-8xl">{emoji}</div>
        <h1 className="text-5xl font-black" data-testid="result-headline">{headline}</h1>
        {sub && <p className="text-xl text-gray-700">{sub}</p>}

        <div className="mx-auto grid max-w-lg grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-gray-500">맞힌 문제</div>
            <div className="text-4xl font-black">{a.correct_count} / {a.item_count}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-gray-500">기록</div>
            <div className="text-4xl font-black">{formatSec(a.elapsed_ms)}</div>
          </div>
        </div>

        {a.wrong_items.length > 0 && a.mode !== "practice" && (
          <div className="mx-auto max-w-lg rounded-2xl bg-white p-5 text-left shadow-sm">
            <div className="mb-2 font-semibold">다시 볼 문제</div>
            <ul className="space-y-1 text-2xl">
              {a.wrong_items.map((w, i) => {
                if (a.pattern === "tap_sequence") {
                  return <li key={i}><b className="text-emerald-600">{w.answer}</b> 차례에 <span className="text-red-500">{w.given ?? "-"}</span>을(를) 눌렀어요</li>;
                }
                const p = displayParts(w);
                return (
                  <li key={i}>
                    {p.before} <b className="text-emerald-600">{w.answer}</b> {p.after}
                    <span className="ml-3 text-base text-red-500">내 답 {w.given ?? "-"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <LinkButton href="/s/home" size="lg">{a.passed ? "다음 단계로" : "학습 화면으로"}</LinkButton>
          {a.mode === "test" && !a.passed && <LinkButton href={`/s/learn/${a.skill_id}?attempt=${a.id}`} size="lg" tone="warn">💡 왜 어려웠는지 보기</LinkButton>}
          {!a.passed && <LinkButton href={`/s/play/${a.set_id}?mode=practice`} size="lg" tone="secondary">연습하기</LinkButton>}
          {a.mode === "race_ai" && <LinkButton href={`/s/play/${a.set_id}?mode=race_ai`} size="lg" tone="warn">다시 시합</LinkButton>}
        </div>
      </div>
    </main>
  );
}
