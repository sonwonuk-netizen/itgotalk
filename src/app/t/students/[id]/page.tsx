import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { displayParts } from "@/lib/content/items";
import { loadStudentDetail } from "@/lib/server/teacher";
import { addCommentAction, createReportAction } from "../../actions";
import { PageTitle, Table, td } from "@/components/StaffShell";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, LinkButton, MODE_LABEL, formatDateTime, formatSec, inputClass } from "@/components/ui";

const STATUS = { passed: ["통과", "green"], in_progress: ["진행 중", "blue"], locked: ["잠김", "gray"] } as const;

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const d = await loadStudentDetail(user.id, id);
  if (!d) notFound();
  const progress = new Map(d.progress.map((p) => [p.skillId, p]));
  const commentsByAttempt = Map.groupBy(d.comments.filter((c) => c.attempt_id), (c) => c.attempt_id!);
  const commentsByReport = Map.groupBy(d.comments.filter((c) => c.report_id), (c) => c.report_id!);
  const wrongAttempts = d.attempts.filter((a) => a.wrong_items.length > 0 && a.mode !== "practice").slice(0, 10);

  return (
    <>
      <PageTitle
        actions={<LinkButton href={`/t/students/${id}/print`} tone="secondary" size="sm">출력 / PDF</LinkButton>}
      >
        {d.student.display_initial}{" "}
        <span className="text-base font-normal text-gray-500">
          {d.student.grade ? `${d.student.grade}학년` : ""} · {d.student.school ?? ""} · 학부모 {maskPhone(d.student.phone)}
        </span>
      </PageTitle>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="mb-3 font-bold">스킬 진행표</h2>
          {d.tracks.map((t) => {
            const trackSkills = d.skills.filter((s) => s.trackId === t.id);
            const started = trackSkills.some((s) => progress.has(s.id));
            return (
          <div key={t.id} className="mb-4">
          <h3 className="mb-1 text-sm font-bold text-gray-600">{t.name}{!started && <span className="ml-2 font-normal text-gray-400">{t.hasDiagnostic ? "진단 전" : "시작 전"}</span>}</h3>
          {started && <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {trackSkills.map((s) => {
              const p = progress.get(s.id);
              const [label, tone] = STATUS[p?.status ?? "locked"];
              return (
                <li key={s.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 odd:bg-gray-50">
                  <span>{s.name}</span>
                  <span className="flex items-center gap-2">
                    {p?.status === "in_progress" && <span className="text-xs text-gray-500">연습 {p.practiceCount} · 실패 {p.consecutiveFail}</span>}
                    {p?.bestElapsedMs && <span className="text-xs text-gray-500">{formatSec(p.bestElapsedMs)}</span>}
                    <Badge tone={tone}>{label}</Badge>
                  </span>
                </li>
              );
            })}
          </ul>}
          </div>
            );
          })}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">최근 오답 문항</h2>
          {wrongAttempts.length === 0 ? <p className="text-sm text-gray-500">테스트 오답이 없어요.</p> : (
            <ul className="space-y-2 text-sm">
              {wrongAttempts.map((a) => (
                <li key={a.id}>
                  <span className="text-gray-500">{formatDateTime(a.created_at)} {a.skill_name} ({MODE_LABEL[a.mode]})</span>
                  <div className="flex flex-wrap gap-3 text-base">
                    {a.wrong_items.map((w, i) => {
                      const p = displayParts(w);
                      return <span key={i}>{p.before} <b className="text-red-600 line-through">{w.given ?? "?"}</b> <b className="text-emerald-700">{w.answer}</b> {p.after}</span>;
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="mb-2 mt-6 text-lg font-bold">학부모 리포트</h2>
      <Card>
        <form action={createReportAction} className="mb-3">
          <input type="hidden" name="studentId" value={id} />
          <SubmitButton size="sm" tone="secondary">지금 리포트 만들고 보내기 (최근 14일)</SubmitButton>
        </form>
        {d.reports.length === 0 && <p className="text-sm text-gray-500">아직 리포트가 없어요. 2주마다 자동으로 만들어져요.</p>}
        <ul className="space-y-4">
          {d.reports.map((r) => (
            <li key={r.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <b>{r.period_start} ~ {r.period_end}</b>
                {r.sent_at ? <Badge tone="green">발송됨</Badge> : <Badge>미발송</Badge>}
                <Link href={`/r/${r.share_token}`} className="text-brand-600 hover:underline" target="_blank">학부모 화면 보기</Link>
              </div>
              <ul className="mt-1 list-disc pl-5">{r.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
              <Comments items={commentsByReport.get(r.id) ?? []} />
              <CommentForm studentId={id} reportId={r.id} />
            </li>
          ))}
        </ul>
      </Card>

      <h2 className="mb-2 mt-6 text-lg font-bold">시도 기록</h2>
      <Table head={["일시", "단계", "모드", "정답", "기록", "판정", "코멘트"]}>
        {d.attempts.map((a) => (
          <tr key={a.id}>
            <td className={`${td} whitespace-nowrap`}>{formatDateTime(a.created_at)}</td>
            <td className={td}>{a.skill_name} · {a.set_no}</td>
            <td className={td}>{MODE_LABEL[a.mode]}</td>
            <td className={td}>{a.correct_count}/{a.item_count}</td>
            <td className={`${td} tabular-nums`} title={`클라이언트 ${formatSec(a.client_elapsed_ms)}`}>{formatSec(a.elapsed_ms)}</td>
            <td className={td}>{a.passed === true ? <Badge tone="green">통과</Badge> : a.passed === false ? <Badge tone="red">미통과</Badge> : "-"}</td>
            <td className={`${td} min-w-64`}>
              <Comments items={commentsByAttempt.get(a.id) ?? []} />
              <CommentForm studentId={id} attemptId={a.id} />
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function maskPhone(p: string | null): string {
  if (!p) return "-";
  const digits = p.replace(/\D/g, "");
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function Comments({ items }: { items: { id: string; body: string; author: string | null; created_at: Date }[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-1 space-y-1">
      {items.map((c) => (
        <li key={c.id} className="rounded bg-sun-100 px-2 py-1 text-xs">
          <b>{c.author}</b> {c.body} <span className="text-gray-500">{formatDateTime(c.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function CommentForm({ studentId, attemptId, reportId }: { studentId: string; attemptId?: string; reportId?: string }) {
  return (
    <form action={addCommentAction} className="mt-1 flex gap-1">
      <input type="hidden" name="studentId" value={studentId} />
      {attemptId && <input type="hidden" name="attemptId" value={attemptId} />}
      {reportId && <input type="hidden" name="reportId" value={reportId} />}
      <input name="body" placeholder="코멘트" aria-label="코멘트" className={`${inputClass} !min-h-9 py-1 text-sm`} required />
      <SubmitButton size="sm" tone="secondary" pendingText="…">남기기</SubmitButton>
    </form>
  );
}
