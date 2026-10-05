import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { loadAttemptResult, type ItemStatus } from "@/lib/server/assessment";
import { StudentHeader } from "@/components/StudentHeader";
import { LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS: Record<ItemStatus, { mark: string; cls: string; label: string }> = {
  correct: { mark: "○", cls: "bg-emerald-100 text-emerald-800", label: "맞았어요" },
  wrong: { mark: "✕", cls: "bg-red-100 text-red-700", label: "틀렸어요" },
  pending: { mark: "✎", cls: "bg-sun-100 text-amber-800", label: "선생님 확인" },
  blank: { mark: "–", cls: "bg-gray-100 text-gray-500", label: "안 풀었어요" },
};

export default async function AssessmentResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireRole("student");
  const { attemptId } = await params;
  const r = await loadAttemptResult(user.id, attemptId);
  if (!r || r.attempt.student_id !== user.id) notFound();
  if (!r.attempt.finished_at) redirect(`/s/assessment/${attemptId}`);
  const minutes = Math.max(1, Math.round((new Date(r.attempt.finished_at).getTime() - new Date(r.attempt.started_at).getTime()) / 60000));

  return (
    <main className="kid">
      <StudentHeader initial={user.initial} />
      <div className="mx-auto max-w-4xl space-y-6 px-4 pb-12 sm:px-6">
        <section className="rounded-3xl bg-white p-8 text-center shadow-md">
          <div className="text-6xl">📝</div>
          <h1 className="mt-2 text-3xl font-black">진단 테스트 결과</h1>
          <p className="mt-3 text-2xl">
            자동 채점 <b className="text-brand-700" data-testid="assessment-score">{r.attempt.auto_correct} / {r.attempt.auto_total}</b>
          </p>
          <p className="mt-1 text-gray-600">
            걸린 시간 약 {minutes}분{r.attempt.manual_pending > 0 && ` · 설명·식 쓰기 ${r.attempt.manual_pending}칸은 선생님이 확인해요`}
          </p>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-bold">단원별</h2>
          <table className="w-full text-left">
            <thead className="text-sm text-gray-500"><tr><th className="py-2">단원</th><th>맞힌 문제</th><th className="hidden sm:table-cell">걸린 시간</th></tr></thead>
            <tbody className="divide-y">
              {r.sections.map((s) => (
                <tr key={s.no}>
                  <td className="py-2"><b className="text-brand-600">{s.no}.</b> {s.title}</td>
                  <td>
                    <span className="font-bold">{s.correct}</span> / {s.total - s.pending}
                    {s.pending > 0 && <span className="ml-2 text-sm text-amber-700">(확인 {s.pending})</span>}
                  </td>
                  <td className="hidden text-gray-500 sm:table-cell">{Math.round(s.seconds / 6) / 10}분</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-bold">문제별</h2>
          <div className="mb-3 flex flex-wrap gap-3 text-sm">
            {Object.values(STATUS).map((s) => <span key={s.label} className={`rounded-full px-2 py-0.5 ${s.cls}`}>{s.mark} {s.label}</span>)}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {r.items.map((i) => (
              <span key={i.id} title={`${i.no}번 (${i.sectionNo}단원 ${i.label}) ${STATUS[i.status].label}`}
                className={`flex h-10 w-10 flex-col items-center justify-center rounded-lg text-xs font-bold leading-none ${STATUS[i.status].cls}`}>
                <span>{i.no}</span><span>{STATUS[i.status].mark}</span>
              </span>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap justify-center gap-3">
          <LinkButton href="/studyroom" size="lg">학습자료실로</LinkButton>
          <LinkButton href="/s/home" size="lg" tone="secondary">연산 훈련 하러 가기</LinkButton>
        </div>
      </div>
    </main>
  );
}
