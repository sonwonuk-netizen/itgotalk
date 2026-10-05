import { timeLimitMs } from "./pass";
import type { SkillRule } from "./types";

/**
 * Why a set was not passed, so the right explanation can be shown.
 * - accuracy: at least one wrong answer (concept first — speed comes after)
 * - speed: all correct but over the time limit
 */
export type Weakness = "accuracy" | "speed" | "none";

/** How a single wrong answer went wrong. */
export type ErrorKind =
  | "blank" // no answer
  | "off_by_one" // counted one step too few/many
  | "off_by_group" // ×: one group too few/many (2 × 4 → 6 or 10)
  | "copied_operand" // wrote one of the numbers instead of combining them
  | "wrong_operation" // e.g. subtracted instead of added
  | "other";

export interface WrongAnswer {
  a: number;
  op: string;
  b: number;
  blank: "result" | "operand2";
  answer: number;
  given: number | null;
}

export interface Diagnosis {
  weakness: Weakness;
  itemCount: number;
  correctCount: number;
  elapsedMs: number;
  limitMs: number;
  /** elapsed − limit, only when slow. */
  overMs: number;
  errors: (WrongAnswer & { kind: ErrorKind })[];
  /** Most frequent error kind (ties → first seen), null without errors. */
  mainError: ErrorKind | null;
}

export function classifyError(w: WrongAnswer): ErrorKind {
  if (w.given === null || Number.isNaN(w.given)) return "blank";
  if (w.op === "×" && w.blank === "result") {
    if (w.given === w.a + w.b) return "wrong_operation";
    const diff = Math.abs(w.given - w.answer);
    if (diff !== 0 && (diff === w.a || diff === w.b)) return "off_by_group";
  }
  if (Math.abs(w.given - w.answer) === 1) return "off_by_one";
  if (w.blank === "result" && (w.given === w.a || w.given === w.b)) return "copied_operand";
  if (w.blank === "result" && w.op === "+" && w.given === Math.abs(w.a - w.b)) return "wrong_operation";
  if (w.blank === "result" && w.op === "-" && w.given === w.a + w.b) return "wrong_operation";
  return "other";
}

export function diagnoseAttempt(
  /** `passed`: the judgment stored on the attempt; wins over re-checking time if limits changed since. */
  attempt: { itemCount: number; correctCount: number; elapsedMs: number; wrongItems: WrongAnswer[]; passed?: boolean | null },
  skill: Pick<SkillRule, "timeRule" | "timeLimitSec">,
): Diagnosis {
  const limitMs = timeLimitMs(skill, attempt.itemCount);
  const errors = attempt.wrongItems.map((w) => ({ ...w, kind: classifyError(w) }));
  const counts = new Map<ErrorKind, number>();
  for (const e of errors) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  let mainError: ErrorKind | null = null;
  for (const [k, n] of counts) if (mainError === null || n > counts.get(mainError)!) mainError = k;

  const wrong = attempt.correctCount < attempt.itemCount;
  const slow = attempt.passed === false ? !wrong : attempt.passed === true ? false : attempt.elapsedMs > limitMs;
  return {
    weakness: wrong ? "accuracy" : slow ? "speed" : "none",
    itemCount: attempt.itemCount,
    correctCount: attempt.correctCount,
    elapsedMs: attempt.elapsedMs,
    limitMs,
    overMs: slow ? Math.max(0, attempt.elapsedMs - limitMs) : 0,
    errors,
    mainError,
  };
}
