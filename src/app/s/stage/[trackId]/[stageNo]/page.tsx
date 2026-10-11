import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { loadStudentStage, type StageSkillRow } from "@/lib/server/student";
import { StudentHeader } from "@/components/StudentHeader";
import { Badge, LinkButton, formatSec } from "@/components/ui";

export const dynamic = "force-dynamic";

/** One stage (e.g. 덧셈과 뺄셈 3단계): its skills in order, each opened as the student reaches it. */
export default async function StagePage({ params }: { params: Promise<{ trackId: string; stageNo: string }> }) {
  const user = await requireRole("student");
  const { trackId, stageNo } = await params;
  const data = await loadStudentStage(user.id, trackId, Number(stageNo));
  if (!data) notFound();
  const { track, stage, stageCount, started, rows } = data;

  return (
    <main className="kid">
      <StudentHeader initial={user.initial} />
      <div className="mx-auto max-w-4xl space-y-6 px-4 pb-12 sm:px-6">
        <div>
          <div className="text-sm font-semibold text-gray-500">{track.name}</div>
          <h1 className="text-3xl font-black">{stage.no}단계 · {stage.name}</h1>
          {rows.length > 0 && <p className="mt-1 text-gray-600">통과 {stage.passedCount} / {rows.length}</p>}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-md">
            <div className="text-5xl">🛠️</div>
            <p className="mt-3 text-xl font-bold">{stage.no}단계 문제는 준비 중이에요.</p>
            <p className="mt-1 text-gray-600">조금만 기다려 주세요!</p>
          </div>
        ) : (
          <>
            {!started && (
              <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-sun-100 p-5 ring-2 ring-sun-400">
                <p className="flex-1 text-lg">먼저 진단 테스트로 내 단계를 찾아요.</p>
                <LinkButton href={track.hasDiagnostic ? `/s/diagnostic?track=${track.id}` : `/s/home#${track.id}`}>
                  {track.hasDiagnostic ? "진단 테스트로 시작" : "시작하러 가기"}
                </LinkButton>
              </div>
            )}
            <ol className="space-y-3">
              {rows.map((r, i) => <SkillRow key={r.skill.id} n={i + 1} row={r} />)}
            </ol>
          </>
        )}

        <nav className="flex flex-wrap items-center justify-between gap-3">
          {stage.no > 1 ? <LinkButton tone="ghost" href={`/s/stage/${track.id}/${stage.no - 1}`}>← {stage.no - 1}단계</LinkButton> : <span />}
          <LinkButton tone="ghost" href={`/s/home#${track.id}`}>학습 화면으로</LinkButton>
          {stage.no < stageCount ? <LinkButton tone="ghost" href={`/s/stage/${track.id}/${stage.no + 1}`}>{stage.no + 1}단계 →</LinkButton> : <span />}
        </nav>
      </div>
    </main>
  );
}

function SkillRow({ n, row }: { n: number; row: StageSkillRow }) {
  const { skill, progress, playSetId, testOpen } = row;
  const status = progress?.status;
  return (
    <li data-skill={skill.id} className={`flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-2 ${status === "in_progress" ? "ring-brand-500" : "ring-transparent"}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-black text-brand-700">{n}</span>
      <div className="min-w-40 flex-1">
        <div className="text-xl font-bold">{skill.name}</div>
        <div className="text-sm text-gray-500">
          {status === "passed" ? <Badge tone="green">통과 · 최고 {formatSec(progress?.bestElapsedMs)}</Badge>
            : status === "in_progress" ? <Badge tone="blue">지금 공부할 단계</Badge>
            : <Badge>🔒 앞 단계를 통과하면 열려요</Badge>}
        </div>
      </div>
      {playSetId && (
        <div className="flex flex-wrap gap-2">
          {skill.pattern !== "tap_sequence" && <LinkButton tone="ghost" size="sm" href={`/s/learn/${skill.id}`}>그림 설명</LinkButton>}
          <LinkButton size="sm" href={`/s/play/${playSetId}?mode=practice`}>{status === "passed" ? "다시 연습" : "연습하기"}</LinkButton>
          {testOpen && <LinkButton tone="success" size="sm" href={`/s/play/${playSetId}?mode=test`}>테스트</LinkButton>}
        </div>
      )}
    </li>
  );
}
