import { requireRole } from "@/lib/auth/session";
import { asUser } from "@/lib/db/client";
import { notFound } from "next/navigation";
import { loadProgress, loadSkills, loadTracks } from "@/lib/server/content";
import { explanationForDiagnostic } from "@/lib/server/explain";
import { nextDiagnosticSet } from "@/lib/server/learning";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { StudentHeader } from "@/components/StudentHeader";
import { LinkButton } from "@/components/ui";
import { DiagnosticRunner } from "./DiagnosticRunner";

export const dynamic = "force-dynamic";

export default async function DiagnosticPage({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const user = await requireRole("student");
  const trackId = (await searchParams).track ?? "add";
  const state = await asUser(user.id, async (tx) => {
    const track = (await loadTracks(tx)).find((t) => t.id === trackId && t.hasDiagnostic);
    if (!track) return null;
    const d = await nextDiagnosticSet(tx, user.id, trackId);
    if (!d.done) return { ...d, trackName: track.name };
    const skills = await loadSkills(tx, trackId);
    const ids = new Set(skills.map((s) => s.id));
    const progress = (await loadProgress(tx, user.id)).filter((p) => ids.has(p.skillId));
    const start = progress.find((p) => p.status === "in_progress");
    return {
      done: true as const,
      start: start ? skills.find((s) => s.id === start.skillId) ?? null : null,
      startSetId: start?.currentSetId ?? null,
      passedNames: skills.filter((s) => progress.find((p) => p.skillId === s.id)?.status === "passed").map((s) => s.name),
      total: skills.length,
      explanation: await explanationForDiagnostic(tx, user.id, trackId),
      trackName: track.name,
    };
  });
  if (!state) notFound();

  if (state.done) {
    return (
      <main className="kid">
        <StudentHeader initial={user.initial} />
        <div className="mx-auto max-w-4xl space-y-6 px-4 pb-12 sm:px-6">
          <div className="space-y-3 text-center">
            <div className="animate-pop text-7xl">🧭</div>
            <h1 className="text-4xl font-black">진단 결과</h1>
            <p className="font-semibold text-gray-500">{state.trackName}</p>
            <p className="text-xl text-gray-700">
              {state.start ? (
                <><b className="text-brand-700">{state.start.name}</b> 단계부터 시작해요.</>
              ) : "모든 단계를 이미 통과했어요!"}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-2 text-sm font-semibold text-gray-500">이미 할 수 있는 단계 {state.passedNames.length} / {state.total}</div>
            <div className="flex flex-wrap gap-2">
              {state.passedNames.map((n) => <span key={n} className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">⭐ {n}</span>)}
              {state.start && <span className="rounded-full bg-brand-100 px-3 py-1 font-semibold text-brand-700">▶️ {state.start.name}</span>}
            </div>
          </div>

          {state.explanation && (
            <>
              <h2 className="text-2xl font-bold">어디가 어려웠는지 같이 볼까요?</h2>
              <ExplanationPanel view={state.explanation} />
            </>
          )}

          <div className="flex flex-wrap justify-center gap-3">
            {state.startSetId && <LinkButton href={`/s/play/${state.startSetId}?mode=practice`} size="lg">바로 연습하기</LinkButton>}
            <LinkButton href="/s/home" size="lg" tone="secondary">학습 화면으로</LinkButton>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="kid">
      <div className="px-6 pt-4">
        <div className="mb-1 flex justify-between text-sm text-gray-600">
          <span>{state.trackName} 진단 테스트 — 할 수 있는 데까지 풀어 봐요</span>
          <span>{state.tested + 1} / {state.total}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white ring-1 ring-gray-200" role="progressbar" aria-valuenow={state.tested} aria-valuemax={state.total}>
          <div className="h-full bg-brand-500" style={{ width: `${(state.tested / state.total) * 100}%` }} />
        </div>
      </div>
      {state.next && <DiagnosticRunner key={state.next.setId} setId={state.next.setId} initial={user.initial} title={state.next.name} />}
    </main>
  );
}
