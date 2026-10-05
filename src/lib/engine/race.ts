import { timeLimitMs } from "./pass";
import type { SkillRule } from "./types";

/** The AI opponent finishes this much faster than the student's reference time. */
export const AI_SPEEDUP = 0.9;

/**
 * PRD ST-13: AI finishes ~10% faster than the student's most recent test.
 * Without any test record, it uses 90% of the skill's time limit.
 * @param recentTestElapsedMs oldest first, newest last
 */
export function aiTargetElapsedMs(
  recentTestElapsedMs: number[],
  skill: Pick<SkillRule, "timeRule" | "timeLimitSec">,
  itemCount: number,
): number {
  const latest = recentTestElapsedMs[recentTestElapsedMs.length - 1];
  const reference = latest ?? timeLimitMs(skill, itemCount);
  return Math.round(reference * AI_SPEEDUP);
}
