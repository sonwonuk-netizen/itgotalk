import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { asUser } from "@/lib/db/client";
import type { AttemptMode } from "@/lib/engine";
import { Player } from "@/components/Player";

export const dynamic = "force-dynamic";

const PLAYABLE: AttemptMode[] = ["practice", "test", "race_ai"];

export default async function PlayPage({ params, searchParams }: { params: Promise<{ setId: string }>; searchParams: Promise<{ mode?: string }> }) {
  const user = await requireRole("student");
  const { setId } = await params;
  const mode = ((await searchParams).mode ?? "practice") as AttemptMode;
  if (!PLAYABLE.includes(mode)) notFound();

  const info = await asUser(user.id, async (tx) =>
    (await tx.query<{ name: string; set_no: number }>(
      "select k.name, s.ord as set_no from item_sets s join skills k on k.id = s.skill_id where s.id = $1",
      [setId],
    )).rows[0],
  );
  if (!info) notFound();

  return (
    <main className="kid">
      <Player key={`${setId}-${mode}`} setId={setId} mode={mode} initial={user.initial} title={`${info.name} · 세트 ${info.set_no}`} />
    </main>
  );
}
