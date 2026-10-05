import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { asUser } from "@/lib/db/client";
import { loadProgress, loadSkills, loadTracks } from "@/lib/server/content";
import { StudentHeader } from "@/components/StudentHeader";
import { MODE_LABEL, formatDateTime, formatSec } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const user = await requireRole("student");
  const { tracks, skills, progress, recent } = await asUser(user.id, async (tx) => ({
    tracks: await loadTracks(tx),
    skills: await loadSkills(tx),
    progress: await loadProgress(tx, user.id),
    recent: (await tx.query<{ id: string; mode: string; name: string; correct_count: number; item_count: number; elapsed_ms: number; passed: boolean | null; created_at: Date }>(
      `select a.id, a.mode, k.name, a.correct_count, a.item_count, a.elapsed_ms, a.passed, a.created_at
       from attempts a join item_sets s on s.id = a.set_id join skills k on k.id = s.skill_id
       where a.student_id = $1 order by a.created_at desc limit 10`,
      [user.id],
    )).rows,
  }));
  const bySkill = new Map(progress.map((p) => [p.skillId, p]));
  const startedTracks = tracks.filter((t) => skills.some((s) => s.trackId === t.id && bySkill.has(s.id)));

  return (
    <main className="kid">
      <StudentHeader initial={user.initial} />
      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-10 sm:px-6">
        <h1 className="text-2xl font-bold">스킬 지도</h1>
        {startedTracks.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-gray-600">
            아직 시작한 공부가 없어요. <Link href="/s/home" className="font-bold text-brand-600 underline">학습 화면</Link>에서 시작해요.
          </p>
        )}
        {startedTracks.map((t) => (
          <section key={t.id} className="space-y-2">
            <h2 className="text-lg font-bold text-gray-700">{t.name}</h2>
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {skills.filter((s) => s.trackId === t.id).map((s) => {
                const p = bySkill.get(s.id);
                const status = p?.status ?? "locked";
                const style =
                  status === "passed" ? "bg-emerald-50 ring-emerald-300" : status === "in_progress" ? "bg-brand-50 ring-brand-500 ring-2" : "bg-gray-100 ring-gray-200 opacity-70";
                return (
                  <li key={s.id} className={`rounded-2xl p-4 ring-1 ${style}`}>
                    <div className="text-2xl">{status === "passed" ? "⭐" : status === "in_progress" ? "▶️" : "🔒"}</div>
                    <div className="mt-1 text-lg font-bold">{s.name}</div>
                    <div className="text-sm text-gray-600">
                      {status === "passed" ? `최고 ${formatSec(p?.bestElapsedMs)}` : status === "in_progress" ? "지금 하는 중" : "잠김"}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}

        <h2 className="text-xl font-bold">최근 기록</h2>
        <ul className="divide-y rounded-2xl bg-white shadow-sm">
          {recent.map((r) => (
            <li key={r.id}>
              <Link href={`/s/result/${r.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-brand-50">
                <span className="w-24 text-sm text-gray-500">{formatDateTime(r.created_at)}</span>
                <span className="flex-1 font-semibold">{r.name} · {MODE_LABEL[r.mode]}</span>
                <span>{r.correct_count}/{r.item_count}</span>
                <span className="w-20 text-right tabular-nums">{formatSec(r.elapsed_ms)}</span>
                <span className="w-12 text-right">{r.passed === true ? "⭐" : r.passed === false ? "💪" : ""}</span>
              </Link>
            </li>
          ))}
          {recent.length === 0 && <li className="px-5 py-6 text-center text-gray-500">아직 기록이 없어요.</li>}
        </ul>
      </div>
    </main>
  );
}
