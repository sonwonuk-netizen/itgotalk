import "server-only";
import type { Tx } from "@/lib/db/client";
import type { Blank, Op } from "@/lib/content/items";
import { diagnoseAttempt, type Diagnosis, type TimeRule, type WrongAnswer } from "@/lib/engine";

export type { SkillPattern } from "./content";
import type { SkillPattern } from "./content";

export interface ExampleProblem {
  a: number;
  op: Op;
  b: number;
  blank: Blank;
  answer: number;
}

export interface ExplanationView {
  skill: { id: string; name: string; pattern: SkillPattern; hint: string; practiceRequired: number };
  /** null when opened without an attempt (general explanation). */
  diagnosis: Diagnosis | null;
  explanation: { title: string; body: string; tip: string | null } | null;
  /** Problem used for the picture: first wrong one, else first item of the set. */
  example: ExampleProblem | null;
}

interface AttemptRow {
  id: string;
  set_id: string;
  skill_id: string;
  item_count: number;
  correct_count: number;
  elapsed_ms: number;
  passed: boolean | null;
  wrong_items: WrongAnswer[];
}

/**
 * Builds the explanation for one attempt (diagnostic or test). Runs inside the caller's
 * RLS-scoped transaction, so students only ever see their own attempts.
 */
export async function explanationForAttempt(tx: Tx, attemptId: string): Promise<ExplanationView | null> {
  const { rows } = await tx.query<AttemptRow>(
    `select a.id, a.set_id, s.skill_id, a.item_count, a.correct_count, a.elapsed_ms, a.passed, a.wrong_items
     from attempts a join item_sets s on s.id = a.set_id where a.id = $1`,
    [attemptId],
  );
  const attempt = rows[0];
  return attempt ? build(tx, attempt.skill_id, attempt) : null;
}

/** Explanation for the skill where the diagnostic placed the student (its last diagnostic attempt). */
export async function explanationForDiagnostic(tx: Tx, studentId: string, trackId: string): Promise<ExplanationView | null> {
  const { rows } = await tx.query<AttemptRow>(
    `select a.id, a.set_id, s.skill_id, a.item_count, a.correct_count, a.elapsed_ms, a.passed, a.wrong_items
     from skill_progress p
     join skills k on k.id = p.skill_id
     join item_sets s on s.skill_id = p.skill_id
     join attempts a on a.set_id = s.id and a.student_id = p.student_id and a.mode = 'diagnostic'
     where p.student_id = $1 and p.status = 'in_progress' and k.track_id = $2
     order by a.created_at desc limit 1`,
    [studentId, trackId],
  );
  const attempt = rows[0];
  return attempt ? build(tx, attempt.skill_id, attempt) : null;
}

/** General explanation of a skill (no attempt): concept text and an example from its first set. */
export async function explanationForSkill(tx: Tx, skillId: string): Promise<ExplanationView | null> {
  return build(tx, skillId, null);
}

async function build(tx: Tx, skillId: string, attempt: AttemptRow | null): Promise<ExplanationView | null> {
  const { rows: sk } = await tx.query<{
    id: string; name: string; pattern: SkillPattern; hint: string | null; time_rule: TimeRule; time_limit_sec: string; practice_required: number;
  }>("select id, name, pattern, hint, time_rule, time_limit_sec, practice_required from skills where id = $1", [skillId]);
  const skill = sk[0];
  if (!skill) return null;

  const diagnosis = attempt
    ? diagnoseAttempt(
        { itemCount: attempt.item_count, correctCount: attempt.correct_count, elapsedMs: attempt.elapsed_ms, wrongItems: attempt.wrong_items, passed: attempt.passed },
        { timeRule: skill.time_rule, timeLimitSec: Number(skill.time_limit_sec) },
      )
    : null;
  // Without an attempt, or when nothing was wrong, explain the concept (accuracy text).
  const weakness = diagnosis?.weakness === "speed" ? "speed" : "accuracy";
  const { rows: ex } = await tx.query<{ title: string; body: string; tip: string | null }>(
    "select title, body, tip from skill_explanations where skill_id = $1 and weakness = $2",
    [skillId, weakness],
  );

  let example: ExampleProblem | null = null;
  const firstWrong = diagnosis?.errors[0];
  if (firstWrong) {
    example = { a: firstWrong.a, op: firstWrong.op as Op, b: firstWrong.b, blank: firstWrong.blank, answer: firstWrong.answer };
  } else {
    const { rows: items } = await tx.query<ExampleProblem>(
      `select i.a, i.op, i.b, i.blank, i.answer from items i join item_sets s on s.id = i.set_id
       where s.skill_id = $1 and ($2::text is null or s.id = $2) order by s.ord, i.ord limit 1`,
      [skillId, attempt?.set_id ?? null],
    );
    example = items[0] ?? null;
  }

  return {
    skill: { id: skill.id, name: skill.name, pattern: skill.pattern, hint: skill.hint ?? "", practiceRequired: skill.practice_required },
    diagnosis,
    explanation: ex[0] ?? null,
    example,
  };
}
