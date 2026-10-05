import { beforeAll, describe, expect, it } from "vitest";
import { asService, getDb } from "@/lib/db/client";
import { createUser } from "@/lib/db/seed";
import { finishPlay, PlayError, startPlay, type PlayStart } from "@/lib/server/learning";

/** Server-side training loop against the real schema (in-memory Postgres). */

let orgId: string;

beforeAll(async () => {
  const db = await getDb();
  orgId = (await db.query<{ id: string }>("select id from organizations where invite_code = 'ITGO2026'")).rows[0]!.id;
});

let seq = 0;
async function newStudent(): Promise<{ id: string }> {
  const id = await asService((tx) =>
    createUser(tx, { loginId: `t${++seq}`, password: "x", role: "student", initial: "ㅌ", organizationId: orgId, approved: true }),
  );
  return { id };
}

async function answersFor(play: PlayStart, correct: boolean) {
  const db = await getDb();
  const { rows } = await db.query<{ id: string; answer: number }>("select id, answer from items where set_id = $1", [play.setId]);
  const key = new Map(rows.map((r) => [r.id, r.answer]));
  return play.items.map((i) => ({ itemId: i.id, given: correct ? key.get(i.id)! : key.get(i.id)! + 1 }));
}

async function run(student: { id: string }, setId: string, mode: PlayStart["mode"], correct = true, clientElapsedMs = 1000) {
  const play = await startPlay(student, setId, mode);
  return finishPlay(student, { sessionId: play.sessionId, answers: await answersFor(play, correct), clientElapsedMs });
}

async function progress(studentId: string, skillId: string) {
  const db = await getDb();
  return (await db.query<{ status: string; current_set_id: string | null; practice_count: number; consecutive_fail: number }>(
    "select status, current_set_id, practice_count, consecutive_fail from skill_progress where student_id = $1 and skill_id = $2",
    [studentId, skillId],
  )).rows[0];
}

describe("diagnostic placement (ST-10)", () => {
  it("passes skills until the first failure, which becomes the start skill", async () => {
    const s = await newStudent();
    await expect(startPlay(s, "SA-P01", "practice")).rejects.toThrow(PlayError); // diagnostic first
    expect((await run(s, "SA-P01", "diagnostic", true)).diagnostic?.done).toBe(false);
    expect((await run(s, "SA-P03", "diagnostic", true)).diagnostic?.done).toBe(false);
    expect((await run(s, "SA-P05", "diagnostic", false)).diagnostic?.done).toBe(true);
    expect(await progress(s.id, "ADD_P1_INTU")).toMatchObject({ status: "passed" });
    expect(await progress(s.id, "ADD_P1_COMM")).toMatchObject({ status: "passed" });
    expect(await progress(s.id, "ADD_P2_INTRO")).toMatchObject({ status: "in_progress", current_set_id: "SA-P05" });
    expect(await progress(s.id, "ADD_P2_INTU")).toMatchObject({ status: "locked" });
    // Diagnostic is over: cannot be taken again.
    await expect(startPlay(s, "SA-P07", "diagnostic")).rejects.toThrow(PlayError);
  });
});

describe("training loop on the server (ST-11)", () => {
  async function placedAt(setIdOfSecondSkill: boolean) {
    const s = await newStudent();
    await run(s, "SA-P01", "diagnostic", true);
    if (setIdOfSecondSkill) await run(s, "SA-P03", "diagnostic", false);
    else await run(s, "SA-P03", "diagnostic", true).then(() => run(s, "SA-P05", "diagnostic", false));
    return s;
  }

  it("test is refused before 3 practices (T5) and the answers never reach the client in test mode", async () => {
    const s = await placedAt(true);
    await expect(startPlay(s, "SA-P03", "test")).rejects.toThrow("연습을 3번");
    await run(s, "SA-P03", "practice");
    await run(s, "SA-P03", "practice");
    await expect(startPlay(s, "SA-P03", "test")).rejects.toThrow(PlayError);
    await run(s, "SA-P03", "practice");
    const play = await startPlay(s, "SA-P03", "test");
    expect(play.items.every((i) => i.answer === undefined)).toBe(true);
  });

  it("3 failed tests → review of previous skill + teacher alert (T6); pass → next set (T7)", async () => {
    const s = await placedAt(true); // working on ADD_P1_COMM (SA-P03), previous skill ADD_P1_INTU
    for (let round = 1; round <= 3; round++) {
      for (let p = 0; p < 3; p++) await run(s, "SA-P03", "practice");
      const r = await run(s, "SA-P03", "test", false);
      expect(r.passed).toBe(false);
    }
    const db = await getDb();
    const reviews = (await db.query("select set_id from review_assignments where student_id = $1 and completed_at is null", [s.id])).rows;
    expect(reviews).toEqual([{ set_id: "SA-P02" }]);
    const alerts = (await db.query("select skill_id, reason from teacher_alerts where student_id = $1", [s.id])).rows;
    expect(alerts).toEqual([{ skill_id: "ADD_P1_COMM", reason: "consecutive_fail_3" }]);
    expect(await progress(s.id, "ADD_P1_COMM")).toMatchObject({ consecutive_fail: 0, practice_count: 0 });

    // Review set is playable as practice and completes the assignment.
    await run(s, "SA-P02", "practice");
    expect((await db.query("select 1 from review_assignments where student_id = $1 and completed_at is null", [s.id])).rows).toHaveLength(0);

    for (let p = 0; p < 3; p++) await run(s, "SA-P03", "practice");
    expect((await run(s, "SA-P03", "test", true)).passed).toBe(true);
    expect(await progress(s.id, "ADD_P1_COMM")).toMatchObject({ status: "in_progress", current_set_id: "SA-P04", consecutive_fail: 0 });
  });

  it("passing the last set passes the skill and starts the next (T8); race_ai does not count", async () => {
    const s = await placedAt(true);
    for (const set of ["SA-P03", "SA-P04"]) {
      for (let p = 0; p < 3; p++) await run(s, set, "practice");
      await run(s, set, "race_ai", true);
      expect((await run(s, set, "test", true)).passed).toBe(true);
    }
    expect(await progress(s.id, "ADD_P1_COMM")).toMatchObject({ status: "passed" });
    expect(await progress(s.id, "ADD_P2_INTRO")).toMatchObject({ status: "in_progress", current_set_id: "SA-P05", practice_count: 0 });
  });

  it("a client claiming a faster time than the server measured is judged on server time (T9)", async () => {
    const s = await placedAt(true);
    for (let p = 0; p < 3; p++) await run(s, "SA-P03", "practice");
    const play = await startPlay(s, "SA-P03", "test");
    await new Promise((r) => setTimeout(r, 1500));
    const res = await finishPlay(s, { sessionId: play.sessionId, answers: await answersFor(play, true), clientElapsedMs: 100 });
    const db = await getDb();
    const a = (await db.query<{ elapsed_ms: number; client_elapsed_ms: number }>("select elapsed_ms, client_elapsed_ms from attempts where id = $1", [res.attemptId])).rows[0]!;
    expect(a.client_elapsed_ms).toBe(100);
    expect(a.elapsed_ms).toBeGreaterThanOrEqual(1500);
  });

  it("time limit comes from the skills table, not code (rule 2)", async () => {
    const s = await placedAt(true);
    const db = await getDb();
    await db.query("update skills set time_limit_sec = 0.5 where id = 'ADD_P1_COMM'");
    try {
      for (let p = 0; p < 3; p++) await run(s, "SA-P03", "practice");
      expect((await run(s, "SA-P03", "test", true, 900)).passed).toBe(false);
    } finally {
      await db.query("update skills set time_limit_sec = 12 where id = 'ADD_P1_COMM'");
    }
  });

  it("a session can be submitted only once, by its owner, with the exact item order", async () => {
    const s = await placedAt(true);
    const other = await placedAt(true);
    const play = await startPlay(s, "SA-P03", "practice");
    const answers = await answersFor(play, true);
    await expect(finishPlay(other, { sessionId: play.sessionId, answers, clientElapsedMs: 1000 })).rejects.toThrow(PlayError);
    await expect(finishPlay(s, { sessionId: play.sessionId, answers: answers.slice(1), clientElapsedMs: 1000 })).rejects.toThrow(PlayError);
    await finishPlay(s, { sessionId: play.sessionId, answers, clientElapsedMs: 1000 });
    await expect(finishPlay(s, { sessionId: play.sessionId, answers, clientElapsedMs: 1000 })).rejects.toThrow("이미 제출");
  });
});

describe("explanation after the diagnostic depends on the weakness", () => {
  it("wrong answers → accuracy explanation with each mistake classified", async () => {
    const { explanationForDiagnostic } = await import("@/lib/server/explain");
    const s = await newStudent();
    await run(s, "SA-P01", "diagnostic", true);
    await run(s, "SA-P03", "diagnostic", false); // every answer is (correct + 1)
    const db = await getDb();
    const view = await explanationForDiagnostic(db, s.id, "add");
    expect(view?.skill.id).toBe("ADD_P1_COMM");
    expect(view?.diagnosis?.weakness).toBe("accuracy");
    expect(view?.diagnosis?.mainError).toBe("off_by_one");
    expect(view?.explanation?.title).toContain("5 + 1");
    expect(view?.example).toMatchObject({ op: "+" });
  });

  it("all correct but too slow → speed explanation", async () => {
    const { explanationForDiagnostic } = await import("@/lib/server/explain");
    const db = await getDb();
    const s = await newStudent();
    await db.query("update skills set time_limit_sec = 0.01 where id = 'ADD_P1_INTU'");
    try {
      const play = await startPlay(s, "SA-P01", "diagnostic");
      await new Promise((r) => setTimeout(r, 50));
      await finishPlay(s, { sessionId: play.sessionId, answers: await answersFor(play, true), clientElapsedMs: 5_000 });
    } finally {
      await db.query("update skills set time_limit_sec = 12 where id = 'ADD_P1_INTU'");
    }
    const view = await explanationForDiagnostic(db, s.id, "add");
    expect(view?.diagnosis?.weakness).toBe("speed");
    expect(view?.diagnosis?.errors).toEqual([]);
    expect(view?.explanation?.title).toBe("다음 수를 바로 떠올려요");
  });

  it("every skill has both an accuracy and a speed explanation", async () => {
    const db = await getDb();
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from skills k cross join (values ('accuracy'), ('speed')) w(weakness)
       where not exists (select 1 from skill_explanations e where e.skill_id = k.id and e.weakness = w.weakness)`,
    );
    expect(rows[0]!.n).toBe(0);
  });
});

describe("tracks are independent", () => {
  it("구구단 has its own diagnostic and progress; addition progress is untouched", async () => {
    const s = await newStudent();
    await run(s, "SA-P01", "diagnostic", false); // addition: start at +1 직관
    await expect(startPlay(s, "GG-P01", "practice")).rejects.toThrow("먼저 이 과정을 시작해요");
    expect((await run(s, "GG-P01", "diagnostic", true)).diagnostic?.done).toBe(false); // 2단 ok → next 5단
    expect((await run(s, "GG-P03", "diagnostic", false)).diagnostic?.done).toBe(true);
    expect(await progress(s.id, "TIMES_2")).toMatchObject({ status: "passed" });
    expect(await progress(s.id, "TIMES_5")).toMatchObject({ status: "in_progress", current_set_id: "GG-P03" });
    expect(await progress(s.id, "ADD_P1_INTU")).toMatchObject({ status: "in_progress", current_set_id: "SA-P01" });

    // Passing the last set of 5단 moves to 3단, within the times track only.
    for (const set of ["GG-P03", "GG-P04"]) {
      for (let p = 0; p < 3; p++) await run(s, set, "practice");
      expect((await run(s, set, "test", true)).passed).toBe(true);
    }
    expect(await progress(s.id, "TIMES_3")).toMatchObject({ status: "in_progress", current_set_id: "GG-P05" });
    expect(await progress(s.id, "ADD_P1_INTU")).toMatchObject({ status: "in_progress" });
  });

  it("3 failed 구구단 tests assign a review from the previous 단, not from addition", async () => {
    const s = await newStudent();
    await run(s, "GG-P01", "diagnostic", true);
    await run(s, "GG-P03", "diagnostic", false); // working on 5단
    for (let round = 0; round < 3; round++) {
      for (let p = 0; p < 3; p++) await run(s, "GG-P03", "practice");
      await run(s, "GG-P03", "test", false);
    }
    const db = await getDb();
    const r = await db.query("select set_id from review_assignments where student_id = $1", [s.id]);
    expect(r.rows).toEqual([{ set_id: "GG-P02" }]);
  });

  it("1~9 빨리 누르기 starts without a diagnostic and is always shuffled", async () => {
    const { startTrack } = await import("@/lib/server/learning");
    const s = await newStudent();
    await expect(startTrack(s, "add")).rejects.toThrow("진단 테스트부터");
    await startTrack(s, "tap");
    expect(await progress(s.id, "TAP_L1")).toMatchObject({ status: "in_progress", current_set_id: "TAP-P01" });
    expect(await progress(s.id, "TAP_L2")).toMatchObject({ status: "locked" });

    const orders = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const play = await startPlay(s, "TAP-P01", "practice");
      expect(play.pattern).toBe("tap_sequence");
      expect(play.items.map((x) => x.a).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      orders.add(play.items.map((x) => x.a).join(""));
      await finishPlay(s, { sessionId: play.sessionId, answers: await answersFor(play, true), clientElapsedMs: 1000 });
    }
    expect(orders.size).toBeGreaterThan(1);
    // A tap mistake fails the test even when fast.
    const play = await startPlay(s, "TAP-P01", "test");
    const answers = await answersFor(play, true);
    answers[0] = { ...answers[0]!, given: answers[0]!.given! === 9 ? 8 : answers[0]!.given! + 1 };
    expect((await finishPlay(s, { sessionId: play.sessionId, answers, clientElapsedMs: 1000 })).passed).toBe(false);
  });
});
