import "katex/dist/katex.min.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { loadAttemptReview } from "@/lib/server/assessment";
import { PageTitle } from "@/components/StaffShell";
import { Badge, Card, formatDateTime } from "@/components/ui";

/** Teacher review of one 진단 평가 attempt: student answer vs answer key, per question. */
export default async function AssessmentReviewPage({ params }: { params: Promise<{ id: string; attemptId: string }> }) {
  const user = await requireStaff();
  const { id, attemptId } = await params;
  const r = await loadAttemptReview(user.id, attemptId);
  if (!r || r.attempt.student_id !== id) notFound();

  return (
    <>
      <PageTitle actions={<Link href={`/t/students/${id}`} className="text-sm text-brand-600 hover:underline">← 학생 상세</Link>}>
        진단 평가 답안
        <span className="ml-3 text-base font-normal text-gray-500">
          {r.attempt.finished_at ? `${formatDateTime(r.attempt.finished_at)} 제출 · 자동 채점 ${r.attempt.auto_correct} / ${r.attempt.auto_total}` : "푸는 중"}
        </span>
      </PageTitle>
      <div className="space-y-2">
        {r.items.map((q, idx) => {
          const firstOfSection = idx === 0 || r.items[idx - 1]!.sectionNo !== q.sectionNo;
          const header = firstOfSection ? <h2 className="pt-4 text-lg font-bold">{q.sectionNo}. {q.sectionTitle}</h2> : null;
          return (
            <div key={q.id}>
              {header}
              <Card className="!p-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg">
                  <span className="text-sm text-gray-400">{q.no}</span>
                  <b className="text-brand-600">{q.label}</b>
                  {q.stem.map((g, i) => g.t === "br" ? <span key={i} className="h-0 basis-full" /> : g.t === "html"
                    ? <span key={i} dangerouslySetInnerHTML={{ __html: g.html }} />
                    : <span key={i} className="rounded bg-gray-100 px-2 text-base text-gray-500">□</span>)}
                </div>
                <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                  {q.blanks.map((b) => (
                    <li key={b.id} className="rounded-lg bg-gray-50 px-3 py-1">
                      학생 <b>{b.given?.trim() ? b.given : "(빈칸)"}</b>
                      {b.answer && <> · 정답 <b className="text-emerald-700">{b.answer}</b></>}
                      {" "}
                      {b.correct === true ? <Badge tone="green">맞음</Badge> : b.correct === false ? <Badge tone="red">틀림</Badge> : <Badge tone="amber">교사 확인</Badge>}
                    </li>
                  ))}
                </ul>
                {q.modelAnswer && <p className="mt-2 text-sm text-gray-600">모범답안: {q.modelAnswer}</p>}
              </Card>
            </div>
          );
        })}
      </div>
    </>
  );
}
