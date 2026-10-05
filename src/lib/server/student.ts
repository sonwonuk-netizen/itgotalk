import "server-only";
import { asUser } from "@/lib/db/client";
import { canStartTest } from "@/lib/engine";
import { loadProgress, loadSkills, loadTracks, setNumber, type SkillInfo, type TrackInfo } from "./content";

export interface TrackHome {
  track: TrackInfo;
  started: boolean;
  passedCount: number;
  totalSkills: number;
  current: {
    skill: SkillInfo;
    setId: string;
    setNo: number;
    setCount: number;
    practiceCount: number;
    consecutiveFail: number;
    testOpen: boolean;
  } | null;
  review: { setId: string; skill: SkillInfo; setNo: number } | null;
}

/** Everything the student home needs, per track, read under the student's own RLS scope. */
export async function loadStudentHome(studentId: string) {
  return asUser(studentId, async (tx) => {
    const tracks = await loadTracks(tx);
    const skills = await loadSkills(tx);
    const progress = new Map((await loadProgress(tx, studentId)).map((p) => [p.skillId, p]));
    const orgName = (await tx.query<{ name: string }>("select o.name from organizations o where o.id = public.my_org()")).rows[0]?.name ?? null;
    const { rows: reviews } = await tx.query<{ set_id: string; skill_id: string }>(
      "select set_id, skill_id from review_assignments where student_id = $1 and completed_at is null order by created_at desc",
      [studentId],
    );

    const perTrack: TrackHome[] = tracks.map((track) => {
      const trackSkills = skills.filter((s) => s.trackId === track.id);
      const rows = trackSkills.map((s) => progress.get(s.id)).filter((p) => p !== undefined);
      const currentRow = rows.find((p) => p.status === "in_progress");
      const currentSkill = currentRow ? trackSkills.find((s) => s.id === currentRow.skillId) : undefined;
      const reviewRow = reviews.find((r) => trackSkills.some((s) => s.id === r.skill_id));
      const reviewSkill = reviewRow ? trackSkills.find((s) => s.id === reviewRow.skill_id)! : null;
      return {
        track,
        started: rows.length > 0,
        passedCount: rows.filter((p) => p.status === "passed").length,
        totalSkills: trackSkills.length,
        current:
          currentRow && currentSkill && currentRow.currentSetId
            ? {
                skill: currentSkill,
                setId: currentRow.currentSetId,
                setNo: setNumber(currentSkill, currentRow.currentSetId),
                setCount: currentSkill.setIds.length,
                practiceCount: currentRow.practiceCount,
                consecutiveFail: currentRow.consecutiveFail,
                testOpen: canStartTest(currentRow, currentSkill),
              }
            : null,
        review: reviewRow && reviewSkill ? { setId: reviewRow.set_id, skill: reviewSkill, setNo: setNumber(reviewSkill, reviewRow.set_id) } : null,
      };
    });

    return { orgName, tracks: perTrack };
  });
}
