import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { loadAttemptForPlay } from "@/lib/server/assessment";
import { AssessmentPlayer } from "@/components/assessment/AssessmentPlayer";

export const dynamic = "force-dynamic";

export default async function AssessmentPlayPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireRole("student");
  const { attemptId } = await params;
  const data = await loadAttemptForPlay(user.id, attemptId);
  if (!data) notFound();
  if (data.finished) redirect(`/s/assessment/${attemptId}/result`);
  return (
    <div className="kid">
      <AssessmentPlayer attemptId={attemptId} title={data.title} questions={data.questions} initialAnswers={data.answers} />
    </div>
  );
}
