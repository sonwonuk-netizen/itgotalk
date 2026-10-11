import "server-only";
import { asUser } from "@/lib/db/client";
import { groupStages, type StageSummary } from "@/lib/content/stages";
import { canStartTest } from "@/lib/engine";
import { loadProgress, loadSkills, loadTracks, setNumber, type ProgressRow, type SkillInfo, type TrackInfo } from "./content";

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
  /** 1단계~8단계, for tracks that have stages (덧셈과 뺄셈). */
  stages: StageSummary<SkillInfo>[] | null;
}

/** Everything the student home needs, per track, read under the student's own RLS scope. */
export async function loadStudentHome(studentId: string) {
  return asUser(studentId, async (tx) => {
    // Independent reads in parallel: on Cloudflare each one is a round trip to D1.
    const [tracks, skills, progressRows, orgRows, reviewRows] = await Promise.all([
      loadTracks(tx),
      loadSkills(tx),
      loadProgress(tx, studentId),
      tx.query<{ name: string }>(
        "select o.name from organizations o join profiles p on p.organization_id = o.id where p.id = $1",
        [studentId],
      ),
      tx.query<{ set_id: string; skill_id: string }>(
        "select set_id, skill_id from review_assignments where student_id = $1 and completed_at is null order by created_at desc",
        [studentId],
      ),
    ]);
    const progress = new Map(progressRows.map((p) => [p.skillId, p]));
    const orgName = orgRows.rows[0]?.name ?? null;
    const reviews = reviewRows.rows;

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
        stages: groupStages(track.id, trackSkills, (id) => progress.get(id)?.status),
      };
    });

    return { orgName, tracks: perTrack };
  });
}

export interface StageSkillRow {
  skill: SkillInfo;
  progress: ProgressRow | null;
  /** The set to practice: the current set while in progress, the first set once passed. */
  playSetId: string | null;
  testOpen: boolean;
}

/** One stage of a track (e.g. 덧셈과 뺄셈 1단계) with each of its skills' progress. Null if the stage does not exist. */
export async function loadStudentStage(studentId: string, trackId: string, stageNo: number) {
  return asUser(studentId, async (tx) => {
    const track = (await loadTracks(tx)).find((t) => t.id === trackId);
    if (!track) return null;
    const skills = await loadSkills(tx, trackId);
    const progress = new Map((await loadProgress(tx, studentId)).map((p) => [p.skillId, p]));
    const stages = groupStages(trackId, skills, (id) => progress.get(id)?.status);
    const stage = stages?.find((s) => s.no === stageNo);
    if (!stages || !stage) return null;
    const rows: StageSkillRow[] = stage.skills.map((skill) => {
      const p = progress.get(skill.id) ?? null;
      const playSetId =
        p?.status === "in_progress" ? p.currentSetId
        : p?.status === "passed" ? (skill.setIds[0] ?? null)
        : null;
      return { skill, progress: p, playSetId, testOpen: p?.status === "in_progress" && canStartTest(p, skill) };
    });
    return { track, stage, stageCount: stages.length, started: progress.size > 0 && skills.some((s) => progress.has(s.id)), rows };
  });
}
