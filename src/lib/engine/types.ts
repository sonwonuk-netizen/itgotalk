export type TimeRule = "per_set" | "per_item";
export type AttemptMode = "practice" | "test" | "diagnostic" | "race_ai";
export type SkillStatus = "locked" | "in_progress" | "passed";

/** The parts of a `skills` row the engine needs. Limits always come from data, never constants. */
export interface SkillRule {
  id: string;
  ord: number;
  name: string;
  timeRule: TimeRule;
  timeLimitSec: number;
  practiceRequired: number;
}

/** Mirrors one `skill_progress` row. */
export interface SkillState {
  status: SkillStatus;
  currentSetId: string | null;
  practiceCount: number;
  consecutiveFail: number;
}

export type Effect =
  | { type: "open_set"; setId: string }
  | { type: "skill_passed"; skillId: string }
  | { type: "start_skill"; skillId: string; setId: string }
  | { type: "assign_review"; skillId: string; setId: string }
  | { type: "notify_teacher"; skillId: string; reason: "consecutive_fail_3" };
