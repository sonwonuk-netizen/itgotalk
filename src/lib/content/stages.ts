/**
 * The 8 stages (1단계~8단계) of a track, one per textbook (교재 SA~SH, see content/curriculum.csv).
 * A skill belongs to the stage whose book matches its `skills.book`. A stage with no skills yet
 * shows as "준비 중" until its items are uploaded.
 */
export interface StageDef {
  no: number;
  book: string;
  name: string;
}

export const TRACK_STAGES: Record<string, StageDef[]> = {
  add: [
    { no: 1, book: "SA", name: "덧셈·뺄셈 기초" },
    { no: 2, book: "SB", name: "세로 덧셈·뺄셈" },
    { no: 3, book: "SC", name: "곱셈과 나눗셈" },
    { no: 4, book: "SD", name: "배수와 약수" },
    { no: 5, book: "SE", name: "분수" },
    { no: 6, book: "SF", name: "소수" },
    { no: 7, book: "SG", name: "정수" },
    { no: 8, book: "SH", name: "문자와 식" },
  ],
};

/** done: every skill passed · current: holds the skill in progress · open: some passed · locked: none reached · soon: no skills yet */
export type StageStatus = "done" | "current" | "open" | "locked" | "soon";

export interface StageSkill {
  id: string;
  book: string;
}

export interface StageSummary<S extends StageSkill = StageSkill> extends StageDef {
  status: StageStatus;
  skills: S[];
  passedCount: number;
}

/** Groups a track's skills (in order) into its stages, with each stage's status from the student's progress. */
export function groupStages<S extends StageSkill>(
  trackId: string,
  skills: S[],
  statusOf: (skillId: string) => "locked" | "in_progress" | "passed" | undefined,
): StageSummary<S>[] | null {
  const defs = TRACK_STAGES[trackId];
  if (!defs) return null;
  return defs.map((def) => {
    const stageSkills = skills.filter((s) => s.book === def.book);
    const statuses = stageSkills.map((s) => statusOf(s.id));
    const passedCount = statuses.filter((s) => s === "passed").length;
    const status: StageStatus =
      stageSkills.length === 0 ? "soon"
      : passedCount === stageSkills.length ? "done"
      : statuses.includes("in_progress") ? "current"
      : passedCount > 0 ? "open"
      : "locked";
    return { ...def, status, skills: stageSkills, passedCount };
  });
}
