import "server-only";
import type { Tx } from "@/lib/db/client";
import type { Blank, Op } from "@/lib/content/items";
import type { SkillRule, SkillState, SkillStatus, TimeRule } from "@/lib/engine";

export type SkillPattern = "intro" | "intuition" | "commutative" | "complement10" | "times_table" | "times_mixed" | "tap_sequence";

export interface SkillInfo extends SkillRule {
  trackId: string;
  pattern: SkillPattern;
  hint: string;
  setIds: string[];
}

export interface TrackInfo {
  id: string;
  ord: number;
  name: string;
  description: string;
  icon: string | null;
  hasDiagnostic: boolean;
}

export async function loadTracks(tx: Tx): Promise<TrackInfo[]> {
  const { rows } = await tx.query<{ id: string; ord: number; name: string; description: string | null; icon: string | null; has_diagnostic: boolean }>(
    "select id, ord, name, description, icon, has_diagnostic from tracks order by ord",
  );
  return rows.map((r) => ({ id: r.id, ord: r.ord, name: r.name, description: r.description ?? "", icon: r.icon, hasDiagnostic: r.has_diagnostic }));
}

export interface DbItem {
  id: string;
  set_id: string;
  ord: number;
  a: number;
  op: Op;
  b: number;
  blank: Blank;
  answer: number;
}

/** Skills in order; pass a track id to get only that track's progression. */
export async function loadSkills(tx: Tx, trackId?: string): Promise<SkillInfo[]> {
  const { rows } = await tx.query<{
    id: string; ord: number; name: string; hint: string | null; time_rule: TimeRule; track_id: string; pattern: SkillPattern;
    time_limit_sec: string | number; practice_required: number; set_ids: string[] | null;
  }>(
    `select k.id, k.ord, k.name, k.hint, k.time_rule, k.time_limit_sec, k.practice_required, k.track_id, k.pattern,
            (select json_group_array(s.id) from (select id from item_sets where skill_id = k.id order by ord) s) as set_ids
     from skills k
     where ($1 is null or k.track_id = $1)
     order by k.ord`,
    [trackId ?? null],
  );
  return rows.map((r) => ({
    id: r.id,
    ord: r.ord,
    name: r.name,
    trackId: r.track_id,
    pattern: r.pattern,
    hint: r.hint ?? "",
    timeRule: r.time_rule,
    timeLimitSec: Number(r.time_limit_sec),
    practiceRequired: r.practice_required,
    setIds: r.set_ids ?? [],
  }));
}

export interface ProgressRow extends SkillState {
  skillId: string;
  bestElapsedMs: number | null;
  passedAt: Date | null;
}

export async function loadProgress(tx: Tx, studentId: string): Promise<ProgressRow[]> {
  const { rows } = await tx.query<{
    skill_id: string; status: SkillStatus; current_set_id: string | null; practice_count: number;
    consecutive_fail: number; best_elapsed_ms: number | null; passed_at: Date | null;
  }>(
    `select p.skill_id, p.status, p.current_set_id, p.practice_count, p.consecutive_fail, p.best_elapsed_ms, p.passed_at
     from skill_progress p join skills k on k.id = p.skill_id where p.student_id = $1 order by k.ord`,
    [studentId],
  );
  return rows.map((r) => ({
    skillId: r.skill_id,
    status: r.status,
    currentSetId: r.current_set_id,
    practiceCount: r.practice_count,
    consecutiveFail: r.consecutive_fail,
    bestElapsedMs: r.best_elapsed_ms,
    passedAt: r.passed_at,
  }));
}

export async function loadSetItems(tx: Tx, setId: string): Promise<DbItem[]> {
  const { rows } = await tx.query<DbItem>("select id, set_id, ord, a, op, b, blank, answer from items where set_id = $1 order by ord", [setId]);
  return rows;
}

/** "세트 3" style label: position of the set inside its skill (1-based). */
export function setNumber(skill: SkillInfo, setId: string): number {
  return skill.setIds.indexOf(setId) + 1;
}
