import type { SkillRule } from "./types";

/** A client time this much shorter than the server's measurement is treated as tampered. */
export const CLIENT_TIME_TOLERANCE_MS = 1000;

export interface ElapsedInput {
  clientElapsedMs: number;
  serverStartedAt: Date;
  serverFinishedAt: Date;
}

/** learning-engine §4: use the client value unless it is ≥1s shorter than the server record. */
export function resolveElapsedMs({ clientElapsedMs, serverStartedAt, serverFinishedAt }: ElapsedInput): number {
  const serverMs = Math.max(0, serverFinishedAt.getTime() - serverStartedAt.getTime());
  if (!Number.isFinite(clientElapsedMs) || clientElapsedMs < 0) return serverMs;
  if (serverMs - clientElapsedMs >= CLIENT_TIME_TOLERANCE_MS) return serverMs;
  return Math.round(clientElapsedMs);
}

export function timeLimitMs(skill: Pick<SkillRule, "timeRule" | "timeLimitSec">, itemCount: number): number {
  const base = skill.timeLimitSec * 1000;
  return skill.timeRule === "per_item" ? base * itemCount : base;
}

export interface GradedAttempt {
  itemCount: number;
  correctCount: number;
  elapsedMs: number;
}

/** Pass = every item correct AND elapsed ≤ limit (boundary inclusive). */
export function isPass(attempt: GradedAttempt, skill: Pick<SkillRule, "timeRule" | "timeLimitSec">): boolean {
  if (attempt.itemCount <= 0) return false;
  const allCorrect = attempt.correctCount === attempt.itemCount;
  const inTime = attempt.elapsedMs <= timeLimitMs(skill, attempt.itemCount);
  return allCorrect && inTime;
}
