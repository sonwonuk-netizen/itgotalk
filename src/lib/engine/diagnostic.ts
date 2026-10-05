import type { SkillStatus } from "./types";

/** Diagnostic results so far, keyed by skill id (true = passed). */
export type DiagnosticResults = Record<string, boolean>;

/** The next skill to test, or null when the diagnostic is over (first failure or all done). */
export function nextDiagnosticSkill(orderedSkillIds: string[], results: DiagnosticResults): string | null {
  for (const id of orderedSkillIds) {
    if (!(id in results)) return id;
    if (!results[id]) return null;
  }
  return null;
}

export interface Placement {
  /** First failed skill; null when every skill passed. */
  startSkillId: string | null;
  passedSkillIds: string[];
}

export function diagnosticPlacement(orderedSkillIds: string[], results: DiagnosticResults): Placement {
  const passedSkillIds: string[] = [];
  for (const id of orderedSkillIds) {
    if (results[id] === true) passedSkillIds.push(id);
    else return { startSkillId: id, passedSkillIds };
  }
  return { startSkillId: null, passedSkillIds };
}

export function initialProgress(
  orderedSkills: { id: string; setIds: string[] }[],
  placement: Placement,
): { skillId: string; status: SkillStatus; currentSetId: string | null }[] {
  const passed = new Set(placement.passedSkillIds);
  return orderedSkills.map((s) => {
    if (passed.has(s.id)) return { skillId: s.id, status: "passed", currentSetId: null };
    if (s.id === placement.startSkillId) {
      return { skillId: s.id, status: "in_progress", currentSetId: s.setIds[0] ?? null };
    }
    return { skillId: s.id, status: "locked", currentSetId: null };
  });
}
