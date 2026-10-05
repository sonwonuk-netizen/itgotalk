import type { AttemptMode } from "./types";

export const REPORT_TIME_ZONE = "Asia/Seoul";

export interface ReportAttempt {
  skillId: string;
  mode: AttemptMode;
  createdAt: Date;
  itemCount: number;
  elapsedMs: number;
  passed: boolean | null;
}

const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: REPORT_TIME_ZONE, month: "numeric", day: "numeric" });

/** 18000 → "18", 13400 → "13.4" */
export function formatSeconds(ms: number): string {
  return String(Math.round(ms / 100) / 10);
}

function describe(a: ReportAttempt): string {
  return `${monthDay.format(a.createdAt)} ${a.itemCount}문항 ${formatSeconds(a.elapsedMs)}초`;
}

/**
 * learning-engine §8. For each skill with test attempts in the period, compare the
 * first and last test attempt. Lines are ordered by skill order.
 */
export function buildReportLines(
  skills: Record<string, { name: string; ord: number }>,
  attempts: ReportAttempt[],
): string[] {
  const bySkill = new Map<string, ReportAttempt[]>();
  for (const a of attempts) {
    if (a.mode !== "test" || !skills[a.skillId]) continue;
    const list = bySkill.get(a.skillId) ?? [];
    list.push(a);
    bySkill.set(a.skillId, list);
  }
  return [...bySkill.entries()]
    .sort(([x], [y]) => skills[x]!.ord - skills[y]!.ord)
    .map(([skillId, list]) => {
      list.sort((p, q) => p.createdAt.getTime() - q.createdAt.getTime());
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const result = last.passed ? "다음 단계 진행" : "추가 연습 진행";
      const body = list.length === 1 ? describe(first) : `${describe(first)} → ${describe(last)}`;
      return `${skills[skillId]!.name}: ${body}, ${result}`;
    });
}
