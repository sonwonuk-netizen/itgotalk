import { asAnon } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/** Parent report: no login, token link, expires after 30 days (ST-30). Reads only via security-definer functions. */
export default async function ParentReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await asAnon(async (tx) => {
    const r = (await tx.query<{ student_initial: string; organization_name: string | null; period_start: string; period_end: string; lines: string[]; expires_at: Date }>(
      "select student_initial, organization_name, period_start::text, period_end::text, lines, expires_at from get_report_by_token($1)",
      [token],
    )).rows[0];
    if (!r) return null;
    const comments = (await tx.query<{ body: string; author_name: string | null; created_at: Date }>(
      "select body, author_name, created_at from get_report_comments_by_token($1)",
      [token],
    )).rows;
    return { r, comments };
  });

  if (!data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-gray-50 p-6 text-center">
        <div>
          <div className="text-4xl">🔗</div>
          <h1 className="mt-2 text-xl font-bold">리포트 링크가 만료되었거나 올바르지 않아요</h1>
          <p className="mt-1 text-gray-600">리포트 링크는 30일 동안 열 수 있어요. 학원에 새 링크를 요청해 주세요.</p>
        </div>
      </main>
    );
  }

  const { r, comments } = data;
  return (
    <main className="min-h-dvh bg-gradient-to-b from-brand-50 to-white p-4">
      <article className="mx-auto max-w-xl space-y-5 py-6">
        <header>
          <div className="text-sm font-semibold text-brand-600">{r.organization_name} · 잇고톡 2주 리포트</div>
          <h1 className="mt-1 text-2xl font-bold">{r.student_initial} 학생의 연산 학습</h1>
          <p className="text-gray-600">{r.period_start} ~ {r.period_end}</p>
        </header>
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 font-bold">단계별 변화</h2>
          <ul className="space-y-2">
            {r.lines.map((l, i) => (
              <li key={i} className="rounded-lg bg-gray-50 px-3 py-2">{l}</li>
            ))}
          </ul>
        </section>
        {comments.length > 0 && (
          <section className="rounded-2xl bg-sun-100 p-5">
            <h2 className="mb-2 font-bold">선생님 한마디</h2>
            <ul className="space-y-2">
              {comments.map((c, i) => <li key={i}>{c.body} <span className="text-sm text-gray-500">— {c.author_name}</span></li>)}
            </ul>
          </section>
        )}
        <p className="text-center text-xs text-gray-400">이 링크는 {new Date(r.expires_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}까지 열 수 있어요.</p>
      </article>
    </main>
  );
}
