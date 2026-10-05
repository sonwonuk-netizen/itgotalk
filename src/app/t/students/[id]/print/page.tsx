import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { loadStudentDetail } from "@/lib/server/teacher";
import { MODE_LABEL, formatDateTime, formatSec, inputClass } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

/** Printable record: diagnostic results, or test attempts in a date range. Browser print → PDF. */
export default async function PrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string; kind?: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const d = await loadStudentDetail(user.id, id);
  if (!d) notFound();

  const kind = sp.kind === "diagnostic" ? "diagnostic" : "period";
  const range = defaultRange();
  const to = sp.to ?? range.to;
  const from = sp.from ?? range.from;
  const inRange = (t: Date) => {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(t));
    return day >= from && day <= to;
  };
  const rows = d.attempts
    .filter((a) => (kind === "diagnostic" ? a.mode === "diagnostic" : a.mode !== "practice" && a.mode !== "diagnostic" && inRange(a.created_at)))
    .reverse();
  const progress = new Map(d.progress.map((p) => [p.skillId, p]));
  const startSkill = d.skills.find((s) => progress.get(s.id)?.status === "in_progress");

  return (
    <div className="space-y-4">
      <form className="no-print flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 shadow-sm">
        <select name="kind" defaultValue={kind} className={`${inputClass} w-40`} aria-label="출력 종류">
          <option value="period">기간 기록</option>
          <option value="diagnostic">진단 결과</option>
        </select>
        <input type="date" name="from" defaultValue={from} className={`${inputClass} w-44`} aria-label="시작일" />
        <input type="date" name="to" defaultValue={to} className={`${inputClass} w-44`} aria-label="종료일" />
        <button className="min-h-12 rounded-xl bg-gray-100 px-4 font-semibold">적용</button>
        <PrintButton />
      </form>

      <article className="rounded-xl bg-white p-8 shadow-sm print:shadow-none">
        <header className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold">{kind === "diagnostic" ? "입회 진단 결과" : "연산 학습 기록"}</h1>
          <p className="text-gray-600">
            {d.student.org} · 학생 {d.student.display_initial} · {d.student.grade ? `${d.student.grade}학년` : ""} {d.student.school ?? ""}
            {kind === "period" && ` · ${from} ~ ${to}`}
          </p>
          {kind === "diagnostic" && <p className="mt-1 font-semibold">시작 단계: {startSkill?.name ?? "모두 통과"}</p>}
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left"><th className="py-2">일시</th><th>단계</th><th>모드</th><th>정답</th><th>기록</th><th>판정</th></tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="py-1.5">{formatDateTime(a.created_at)}</td>
                <td>{a.skill_name} · 세트 {a.set_no}</td>
                <td>{MODE_LABEL[a.mode]}</td>
                <td>{a.correct_count}/{a.item_count}</td>
                <td>{formatSec(a.elapsed_ms)}</td>
                <td>{a.passed === true ? "통과" : a.passed === false ? "미통과" : "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-gray-500">기록이 없습니다.</td></tr>}
          </tbody>
        </table>
        {d.comments.length > 0 && (
          <section className="mt-6">
            <h2 className="font-bold">선생님 코멘트</h2>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {d.comments.map((c) => <li key={c.id}>{c.body} <span className="text-gray-500">({c.author}, {formatDateTime(c.created_at)})</span></li>)}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
}

/** Last 14 days in Korea time, as YYYY-MM-DD. */
function defaultRange(): { from: string; to: string } {
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
  const now = new Date();
  return { from: day(new Date(now.getTime() - 14 * 86_400_000)), to: day(now) };
}
