import type { AttemptMode, Effect, SkillRule, SkillState } from "./types";

/** Consecutive test failures that trigger a review assignment and a teacher alert. */
export const FAIL_STREAK_FOR_REVIEW = 3;

export interface ProgressContext {
  skill: Pick<SkillRule, "id" | "practiceRequired">;
  /** Sets of this skill in order. */
  setIds: string[];
  previousSkill?: { id: string; reviewSetId: string };
  nextSkill?: { id: string; firstSetId: string };
}

export function canStartTest(state: SkillState, skill: Pick<SkillRule, "practiceRequired">): boolean {
  return state.status === "in_progress" && state.practiceCount >= skill.practiceRequired;
}

/**
 * learning-engine §3/§5. Applies one finished attempt on the student's current set
 * and returns the new state plus side effects for the caller to persist.
 * race_ai and diagnostic attempts never change progress.
 */
export function applyAttempt(
  state: SkillState,
  attempt: { mode: AttemptMode; passed: boolean | null },
  ctx: ProgressContext,
): { state: SkillState; effects: Effect[] } {
  if (attempt.mode === "practice") {
    return { state: { ...state, practiceCount: state.practiceCount + 1 }, effects: [] };
  }
  if (attempt.mode !== "test") return { state, effects: [] };

  if (attempt.passed) {
    const idx = state.currentSetId ? ctx.setIds.indexOf(state.currentSetId) : -1;
    const nextSetId = idx >= 0 ? ctx.setIds[idx + 1] : undefined;
    if (nextSetId) {
      return {
        state: { ...state, currentSetId: nextSetId, practiceCount: 0, consecutiveFail: 0 },
        effects: [{ type: "open_set", setId: nextSetId }],
      };
    }
    const effects: Effect[] = [{ type: "skill_passed", skillId: ctx.skill.id }];
    if (ctx.nextSkill) {
      effects.push({ type: "start_skill", skillId: ctx.nextSkill.id, setId: ctx.nextSkill.firstSetId });
    }
    return { state: { ...state, status: "passed", practiceCount: 0, consecutiveFail: 0 }, effects };
  }

  const fails = state.consecutiveFail + 1;
  if (fails < FAIL_STREAK_FOR_REVIEW) {
    return { state: { ...state, practiceCount: 0, consecutiveFail: fails }, effects: [] };
  }
  const effects: Effect[] = [];
  if (ctx.previousSkill) {
    effects.push({ type: "assign_review", skillId: ctx.previousSkill.id, setId: ctx.previousSkill.reviewSetId });
  }
  effects.push({ type: "notify_teacher", skillId: ctx.skill.id, reason: "consecutive_fail_3" });
  return { state: { ...state, practiceCount: 0, consecutiveFail: 0 }, effects };
}
