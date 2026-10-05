import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { asUser } from "@/lib/db/client";
import { explanationForAttempt, explanationForSkill } from "@/lib/server/explain";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { StudentHeader } from "@/components/StudentHeader";
import { LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Explanation of a skill; with ?attempt= it explains that attempt's mistakes (RLS: own attempts only). */
export default async function LearnPage({ params, searchParams }: { params: Promise<{ skillId: string }>; searchParams: Promise<{ attempt?: string }> }) {
  const user = await requireRole("student");
  const { skillId } = await params;
  const { attempt } = await searchParams;
  const data = await asUser(user.id, async (tx) => {
    const view = attempt ? await explanationForAttempt(tx, attempt) : await explanationForSkill(tx, skillId);
    const current = (await tx.query<{ current_set_id: string | null }>(
      "select current_set_id from skill_progress where student_id = $1 and skill_id = $2 and status = 'in_progress'",
      [user.id, skillId],
    )).rows[0];
    return { view, currentSetId: current?.current_set_id ?? null };
  });
  if (!data.view || data.view.skill.id !== skillId) notFound();

  return (
    <main className="kid">
      <StudentHeader initial={user.initial} />
      <div className="mx-auto max-w-4xl space-y-6 px-4 pb-12 sm:px-6">
        <h1 className="text-3xl font-black">💡 {data.view.skill.name} 알아보기</h1>
        <ExplanationPanel view={data.view} />
        <div className="flex flex-wrap justify-center gap-3">
          {data.currentSetId && <LinkButton href={`/s/play/${data.currentSetId}?mode=practice`} size="lg">연습하러 가기</LinkButton>}
          <LinkButton href="/s/home" size="lg" tone="secondary">학습 화면으로</LinkButton>
        </div>
      </div>
    </main>
  );
}
