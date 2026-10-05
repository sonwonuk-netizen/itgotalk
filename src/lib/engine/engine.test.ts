import { describe, expect, it } from "vitest";
import {
  aiTargetElapsedMs,
  applyAttempt,
  buildReportLines,
  canStartTest,
  diagnosticPlacement,
  initialProgress,
  isPass,
  nextDiagnosticSkill,
  resolveElapsedMs,
  shuffleItems,
  type SkillRule,
  type SkillState,
} from "./index";

const perSet12: SkillRule = {
  id: "ADD_P2_COMM",
  ord: 5,
  name: "+2 교환법칙",
  timeRule: "per_set",
  timeLimitSec: 12,
  practiceRequired: 3,
};
const perItem2: SkillRule = { ...perSet12, timeRule: "per_item", timeLimitSec: 2 };

const fresh = (over: Partial<SkillState> = {}): SkillState => ({
  status: "in_progress",
  currentSetId: "SA-P09",
  practiceCount: 0,
  consecutiveFail: 0,
  ...over,
});

const ctx = {
  skill: perSet12,
  setIds: ["SA-P09", "SA-P10"],
  previousSkill: { id: "ADD_P2_INTU", reviewSetId: "SA-P08" },
  nextSkill: { id: "ADD_P3_INTRO", firstSetId: "SA-P11" },
};

describe("isPass (learning-engine §4)", () => {
  it("T1: 5/5 correct in 11.9s, per_set 12s → pass", () => {
    expect(isPass({ itemCount: 5, correctCount: 5, elapsedMs: 11_900 }, perSet12)).toBe(true);
  });
  it("T2: 5/5 correct in exactly 12.0s → pass (boundary inclusive)", () => {
    expect(isPass({ itemCount: 5, correctCount: 5, elapsedMs: 12_000 }, perSet12)).toBe(true);
  });
  it("T3: 5/5 correct in 12.1s → fail", () => {
    expect(isPass({ itemCount: 5, correctCount: 5, elapsedMs: 12_100 }, perSet12)).toBe(false);
  });
  it("T4: 4/5 correct in 8s → fail", () => {
    expect(isPass({ itemCount: 5, correctCount: 4, elapsedMs: 8_000 }, perSet12)).toBe(false);
  });
  it("T10: per_item 2s × 7 items, 13.5s → pass", () => {
    expect(isPass({ itemCount: 7, correctCount: 7, elapsedMs: 13_500 }, perItem2)).toBe(true);
  });
  it("per_item 2s × 7 items, 14.1s → fail", () => {
    expect(isPass({ itemCount: 7, correctCount: 7, elapsedMs: 14_100 }, perItem2)).toBe(false);
  });
  it("empty attempt never passes", () => {
    expect(isPass({ itemCount: 0, correctCount: 0, elapsedMs: 1 }, perSet12)).toBe(false);
  });
});

describe("resolveElapsedMs (anti-tamper)", () => {
  const start = new Date("2026-10-05T01:00:00.000Z");
  const at = (ms: number) => new Date(start.getTime() + ms);

  it("T9: client 6s, server 10s → server value 10s", () => {
    expect(resolveElapsedMs({ clientElapsedMs: 6_000, serverStartedAt: start, serverFinishedAt: at(10_000) })).toBe(10_000);
  });
  it("client within 1s of server → client value", () => {
    expect(resolveElapsedMs({ clientElapsedMs: 9_200, serverStartedAt: start, serverFinishedAt: at(10_000) })).toBe(9_200);
  });
  it("client exactly 1s shorter → server value", () => {
    expect(resolveElapsedMs({ clientElapsedMs: 9_000, serverStartedAt: start, serverFinishedAt: at(10_000) })).toBe(10_000);
  });
  it("invalid client value → server value", () => {
    expect(resolveElapsedMs({ clientElapsedMs: Number.NaN, serverStartedAt: start, serverFinishedAt: at(4_000) })).toBe(4_000);
    expect(resolveElapsedMs({ clientElapsedMs: -5, serverStartedAt: start, serverFinishedAt: at(4_000) })).toBe(4_000);
  });
});

describe("test gating & progression (learning-engine §3, §5)", () => {
  it("T5: test requested after only 2 practices → rejected", () => {
    expect(canStartTest(fresh({ practiceCount: 2 }), perSet12)).toBe(false);
    expect(canStartTest(fresh({ practiceCount: 3 }), perSet12)).toBe(true);
  });
  it("practice requirement comes from the skill, not a constant", () => {
    expect(canStartTest(fresh({ practiceCount: 1 }), { ...perSet12, practiceRequired: 1 })).toBe(true);
  });
  it("cannot test a locked or already passed skill", () => {
    expect(canStartTest(fresh({ status: "locked", practiceCount: 5 }), perSet12)).toBe(false);
    expect(canStartTest(fresh({ status: "passed", practiceCount: 5 }), perSet12)).toBe(false);
  });

  it("practice increments practice_count", () => {
    const r = applyAttempt(fresh({ practiceCount: 1 }), { mode: "practice", passed: null }, ctx);
    expect(r.state.practiceCount).toBe(2);
    expect(r.effects).toEqual([]);
  });

  it("failed test resets practice_count and increments consecutive_fail", () => {
    const r = applyAttempt(fresh({ practiceCount: 3 }), { mode: "test", passed: false }, ctx);
    expect(r.state).toMatchObject({ practiceCount: 0, consecutiveFail: 1, status: "in_progress" });
  });

  it("T6: 3rd consecutive failure → review previous skill + notify teacher, counter back to 0", () => {
    const r = applyAttempt(fresh({ practiceCount: 3, consecutiveFail: 2 }), { mode: "test", passed: false }, ctx);
    expect(r.state.consecutiveFail).toBe(0);
    expect(r.state.practiceCount).toBe(0);
    expect(r.effects).toEqual([
      { type: "assign_review", skillId: "ADD_P2_INTU", setId: "SA-P08" },
      { type: "notify_teacher", skillId: "ADD_P2_COMM", reason: "consecutive_fail_3" },
    ]);
  });

  it("T6 (first skill): no previous skill → only teacher notification", () => {
    const r = applyAttempt(fresh({ consecutiveFail: 2 }), { mode: "test", passed: false }, { ...ctx, previousSkill: undefined });
    expect(r.effects).toEqual([{ type: "notify_teacher", skillId: "ADD_P2_COMM", reason: "consecutive_fail_3" }]);
  });

  it("T7: pass after 2 failures → consecutive_fail 0 and next set opens", () => {
    const r = applyAttempt(fresh({ practiceCount: 3, consecutiveFail: 2 }), { mode: "test", passed: true }, ctx);
    expect(r.state).toMatchObject({ consecutiveFail: 0, practiceCount: 0, currentSetId: "SA-P10", status: "in_progress" });
    expect(r.effects).toEqual([{ type: "open_set", setId: "SA-P10" }]);
  });

  it("T8: passing the skill's last set → skill passed, next skill in_progress", () => {
    const r = applyAttempt(fresh({ currentSetId: "SA-P10", practiceCount: 3 }), { mode: "test", passed: true }, ctx);
    expect(r.state.status).toBe("passed");
    expect(r.effects).toEqual([
      { type: "skill_passed", skillId: "ADD_P2_COMM" },
      { type: "start_skill", skillId: "ADD_P3_INTRO", setId: "SA-P11" },
    ]);
  });

  it("last skill passed → no start_skill effect", () => {
    const r = applyAttempt(fresh({ currentSetId: "SA-P10" }), { mode: "test", passed: true }, { ...ctx, nextSkill: undefined });
    expect(r.effects).toEqual([{ type: "skill_passed", skillId: "ADD_P2_COMM" }]);
  });

  it("race_ai and diagnostic attempts never change progress", () => {
    const s = fresh({ practiceCount: 2, consecutiveFail: 1 });
    expect(applyAttempt(s, { mode: "race_ai", passed: null }, ctx)).toEqual({ state: s, effects: [] });
    expect(applyAttempt(s, { mode: "diagnostic", passed: true }, ctx)).toEqual({ state: s, effects: [] });
  });
});

describe("shuffleItems (learning-engine §6)", () => {
  const items = Array.from({ length: 8 }, (_, i) => ({ a: i + 1, op: "+", b: 2 }));
  const key = (x: { a: number; op: string; b: number }) => `${x.a}${x.op}${x.b}`;

  it("T11: same seed twice → identical order", () => {
    expect(shuffleItems(items, 42, key)).toEqual(shuffleItems(items, 42, key));
  });
  it("is a permutation and does not mutate input", () => {
    const copy = [...items];
    const out = shuffleItems(items, 7, key);
    expect(out).toHaveLength(items.length);
    expect([...out].sort((p, q) => p.a - q.a)).toEqual(items);
    expect(items).toEqual(copy);
  });
  it("different seeds usually give different orders", () => {
    const orders = new Set([1, 2, 3, 4, 5].map((s) => shuffleItems(items, s, key).map(key).join()));
    expect(orders.size).toBeGreaterThan(1);
  });
  it("never puts the same problem twice in a row (2+3 and 3+2 are different)", () => {
    const dupes = [
      { a: 2, op: "+", b: 3 }, { a: 2, op: "+", b: 3 }, { a: 2, op: "+", b: 3 },
      { a: 3, op: "+", b: 2 }, { a: 4, op: "+", b: 1 }, { a: 1, op: "+", b: 4 },
    ];
    for (let seed = 0; seed < 200; seed++) {
      const out = shuffleItems(dupes, seed, key);
      for (let i = 1; i < out.length; i++) expect(key(out[i]!)).not.toBe(key(out[i - 1]!));
    }
  });
});

describe("diagnostic placement (learning-engine §7)", () => {
  const order = ["S1", "S2", "S3", "S4"];
  it("next skill to test is the first without a result; stops after first failure", () => {
    expect(nextDiagnosticSkill(order, {})).toBe("S1");
    expect(nextDiagnosticSkill(order, { S1: true })).toBe("S2");
    expect(nextDiagnosticSkill(order, { S1: true, S2: false })).toBeNull();
    expect(nextDiagnosticSkill(order, { S1: true, S2: true, S3: true, S4: true })).toBeNull();
  });
  it("first failed skill becomes the start skill; earlier ones are passed", () => {
    expect(diagnosticPlacement(order, { S1: true, S2: true, S3: false })).toEqual({
      startSkillId: "S3",
      passedSkillIds: ["S1", "S2"],
    });
  });
  it("all passed → no start skill (everything passed)", () => {
    expect(diagnosticPlacement(order, { S1: true, S2: true, S3: true, S4: true })).toEqual({
      startSkillId: null,
      passedSkillIds: order,
    });
  });
  it("initialProgress builds rows from placement", () => {
    const skills = [
      { id: "S1", setIds: ["a", "b"] },
      { id: "S2", setIds: ["c"] },
      { id: "S3", setIds: ["d", "e"] },
    ];
    expect(initialProgress(skills, { startSkillId: "S2", passedSkillIds: ["S1"] })).toEqual([
      { skillId: "S1", status: "passed", currentSetId: null },
      { skillId: "S2", status: "in_progress", currentSetId: "c" },
      { skillId: "S3", status: "locked", currentSetId: null },
    ]);
  });
});

describe("report lines (learning-engine §8)", () => {
  const skillNames = { ADD_P3_COMM: { name: "+3 교환법칙", ord: 8 }, ADD_P1_INTU: { name: "+1 직관", ord: 1 } };
  // 09:00 KST
  const kst = (md: string) => new Date(`2026-${md}T00:00:00.000Z`);

  it("T12: 9/27 18s fail → 10/4 11s pass", () => {
    const lines = buildReportLines(skillNames, [
      { skillId: "ADD_P3_COMM", mode: "test", createdAt: kst("09-27"), itemCount: 10, elapsedMs: 18_000, passed: false },
      { skillId: "ADD_P3_COMM", mode: "test", createdAt: kst("10-04"), itemCount: 10, elapsedMs: 11_000, passed: true },
    ]);
    expect(lines).toEqual(["+3 교환법칙: 9/27 10문항 18초 → 10/4 10문항 11초, 다음 단계 진행"]);
  });

  it("single attempt → short form; failure → 추가 연습 진행", () => {
    const lines = buildReportLines(skillNames, [
      { skillId: "ADD_P1_INTU", mode: "test", createdAt: kst("10-01"), itemCount: 5, elapsedMs: 13_400, passed: false },
    ]);
    expect(lines).toEqual(["+1 직관: 10/1 5문항 13.4초, 추가 연습 진행"]);
  });

  it("ignores non-test attempts, orders by skill order, compares first vs last", () => {
    const lines = buildReportLines(skillNames, [
      { skillId: "ADD_P3_COMM", mode: "practice", createdAt: kst("09-20"), itemCount: 10, elapsedMs: 30_000, passed: null },
      { skillId: "ADD_P3_COMM", mode: "test", createdAt: kst("10-04"), itemCount: 10, elapsedMs: 11_000, passed: true },
      { skillId: "ADD_P3_COMM", mode: "test", createdAt: kst("09-27"), itemCount: 10, elapsedMs: 18_000, passed: false },
      { skillId: "ADD_P3_COMM", mode: "race_ai", createdAt: kst("10-05"), itemCount: 10, elapsedMs: 9_000, passed: null },
      { skillId: "ADD_P1_INTU", mode: "test", createdAt: kst("09-22"), itemCount: 5, elapsedMs: 9_000, passed: true },
    ]);
    expect(lines).toEqual([
      "+1 직관: 9/22 5문항 9초, 다음 단계 진행",
      "+3 교환법칙: 9/27 10문항 18초 → 10/4 10문항 11초, 다음 단계 진행",
    ]);
  });

  it("uses Korea time for the date (late-night UTC is next day in KST)", () => {
    const lines = buildReportLines(skillNames, [
      { skillId: "ADD_P1_INTU", mode: "test", createdAt: new Date("2026-09-30T16:00:00.000Z"), itemCount: 5, elapsedMs: 9_000, passed: true },
    ]);
    expect(lines[0]).toContain("10/1");
  });
});

describe("AI race pace (PRD ST-13)", () => {
  it("about 10% faster than the student's most recent test", () => {
    expect(aiTargetElapsedMs([20_000, 15_000], perSet12, 5)).toBe(13_500);
  });
  it("no test record → 90% of the skill's time limit", () => {
    expect(aiTargetElapsedMs([], perSet12, 5)).toBe(10_800);
    expect(aiTargetElapsedMs([], perItem2, 7)).toBe(12_600);
  });
});
