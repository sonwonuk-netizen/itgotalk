import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { loadAssessmentIntro } from "@/lib/server/assessment";
import { startAssessmentAction } from "./actions";
import { StudentHeader } from "@/components/StudentHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDateTime } from "@/components/ui";

export const dynamic = "force-dynamic";

/** 진단 평가 시작 화면 (학습자료실 "① 진단 테스트"에서 들어옴). */
export default async function AssessmentIntroPage() {
  const user = await requireRole("student");
  const intro = await loadAssessmentIntro(user.id);

  if (!intro) {
    return (
      <main className="kid">
        <StudentHeader initial={user.initial} />
        <p className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center text-gray-600">진단 평가가 아직 준비되지 않았어요.</p>
      </main>
    );
  }

  const open = intro.attempts.find((a) => !a.finished_at);
  const done = intro.attempts.filter((a) => a.finished_at);

  return (
    <main className="kid">
      <StudentHeader initial={user.initial} />
      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-12 sm:px-6">
        <section className="rounded-3xl bg-white p-6 shadow-md sm:p-8">
          <div className="text-sm font-semibold text-brand-600">{intro.assessment.title}</div>
          <h1 className="mt-1 text-3xl font-black">진단 테스트</h1>
          <p className="mt-2 text-lg text-gray-700">{intro.assessment.subtitle} · 문제 {intro.questionCount}개를 한 문제씩 풀어요.</p>
          <ul className="mt-4 space-y-1 text-gray-600">
            <li>• 모르는 문제는 비워 두고 다음으로 넘어가도 괜찮아요.</li>
            <li>• 쓴 답은 바로 저장돼요. 중간에 나가도 이어서 풀 수 있어요.</li>
            <li>• 마지막에 <b>제출하기</b>를 누르면 채점돼요. 설명을 쓰는 문제는 선생님이 확인해요.</li>
          </ul>
          <form action={startAssessmentAction} className="mt-6">
            <SubmitButton size="lg" className="w-full sm:w-auto">{open ? "이어서 풀기" : "진단 테스트 시작"}</SubmitButton>
          </form>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-bold">이런 내용이 나와요</h2>
          <ol className="grid gap-2 sm:grid-cols-2">
            {intro.sections.map(([no, title]) => (
              <li key={no} className="rounded-xl bg-gray-50 px-3 py-2"><b className="text-brand-600">{no}.</b> {title}</li>
            ))}
          </ol>
        </section>

        {done.length > 0 && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-bold">지난 결과</h2>
            <ul className="divide-y">
              {done.map((a) => (
                <li key={a.id}>
                  <Link href={`/s/assessment/${a.id}/result`} className="flex items-center justify-between py-3 hover:text-brand-700">
                    <span>{formatDateTime(a.finished_at!)}</span>
                    <span className="font-bold">{a.auto_correct} / {a.auto_total}{a.manual_pending ? ` · 선생님 확인 ${a.manual_pending}` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
