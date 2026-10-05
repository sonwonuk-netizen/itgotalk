import { beforeAll, describe, expect, it } from "vitest";
import { asService, getDb } from "@/lib/db/client";
import { createUser } from "@/lib/db/seed";
import {
  AssessmentError,
  loadAssessmentIntro,
  loadAttemptForPlay,
  loadAttemptResult,
  loadAttemptReview,
  saveAnswers,
  startAssessment,
  submitAssessment,
} from "@/lib/server/assessment";

/** 진단 평가 server flow against the real schema + RLS (in-memory Postgres). */

const ids: Record<string, string> = {};

beforeAll(async () => {
  const db = await getDb();
  const org = (await db.query<{ id: string }>("select id from organizations where invite_code = 'ITGO2026'")).rows[0]!.id;
  const other = (await db.query<{ id: string }>("select id from organizations where invite_code = 'SUNNY001'")).rows[0]!.id;
  const mk = (loginId: string, role: "student" | "teacher", organizationId: string) =>
    asService((tx) => createUser(tx, { loginId, password: "x", role, initial: "ㅇ", organizationId, approved: true }));
  ids.s = await mk("as_student", "student", org);
  ids.s2 = await mk("as_student2", "student", org);
  ids.t = await mk("as_teacher", "teacher", org);
  ids.tOther = await mk("as_teacher_other", "teacher", other);
});

describe("진단 평가 flow", () => {
  it("intro lists the test; questions never include answers", async () => {
    const intro = await loadAssessmentIntro(ids.s!);
    expect(intro?.questionCount).toBeGreaterThan(100);
    const id = await startAssessment(ids.s!);
    const play = (await loadAttemptForPlay(ids.s!, id))!;
    expect(play.questions[0]!.label).toBe("①");
    expect(JSON.stringify(play.questions)).not.toContain('"answer"');
    // the comparison heading becomes context of the items below it, not a question of its own
    expect(play.questions.some((q) => q.contextHtml?.includes("비교"))).toBe(true);
    // 연산 테스트 덧셈: one box per digit of the answer (count only — the answer itself is not sent)
    const blankOf = (sec: number, label: string, part = 1) =>
      play.questions.filter((q) => q.sectionNo === sec && q.label === label)[part - 1]!.stem.find((g) => g.t === "blank")!;
    expect(blankOf(1, "①")).toMatchObject({ kind: "int", digits: 2 }); // 15 + 4 = 19
    expect(blankOf(2, "⑨")).toMatchObject({ digits: 3 }); // 78 + 24 = 102
    expect(blankOf(1, "①", 2)).not.toHaveProperty("digits"); // 4 + ( ) = 11 → single input
    // starting again resumes the same open attempt
    expect(await startAssessment(ids.s!)).toBe(id);
  });

  it("answers are saved as you go and restored on reload", async () => {
    const id = await startAssessment(ids.s!);
    const play = (await loadAttemptForPlay(ids.s!, id))!;
    const q1 = play.questions[0]!; // 15 + 4 = □
    await saveAnswers(ids.s!, id, q1.id, { b1: "19" }, 4);
    await saveAnswers(ids.s!, id, q1.id, { b1: "19" }, 3);
    const again = (await loadAttemptForPlay(ids.s!, id))!;
    expect(again.answers[q1.id]).toEqual({ b1: "19" });
    expect(again.seconds[q1.id]).toBe(7);
  });

  it("another student cannot save into or read someone else's attempt", async () => {
    const id = await startAssessment(ids.s!);
    const q1 = (await loadAttemptForPlay(ids.s!, id))!.questions[0]!;
    await expect(saveAnswers(ids.s2!, id, q1.id, { b1: "1" }, 1)).rejects.toThrow(AssessmentError);
    expect(await loadAttemptForPlay(ids.s2!, id)).toBeNull();
  });

  it("submit grades on the server; results by section; teachers of the org can review", async () => {
    const id = await startAssessment(ids.s!);
    const play = (await loadAttemptForPlay(ids.s!, id))!;
    const byLabel = (section: number, label: string) => play.questions.find((q) => q.sectionNo === section && q.label === label)!;
    await saveAnswers(ids.s!, id, byLabel(1, "②").id, { b1: "30" }, 2); // 22 + 7 = 29 → wrong
    await saveAnswers(ids.s!, id, byLabel(5, "②").id, { b1: "1 1/2" }, 5); // 2¼ − ¾ = 3/2 → correct (mixed)
    const multiples = play.questions.find((q) => q.sectionNo === 4 && q.label === "1.")!;
    await saveAnswers(ids.s!, id, multiples.id, { sel: "201,8040,10101" }, 5); // any order
    const explain = play.questions.find((q) => q.sectionNo === 7 && q.type === "free")!;
    await saveAnswers(ids.s!, id, explain.id, { ex: "0에서 떨어진 거리" }, 9);

    const summary = await submitAssessment(ids.s!, id);
    expect(summary.autoCorrect).toBe(3); // 15+4, 2¼−¾, multiples of 3
    expect(summary.manualPending).toBeGreaterThan(0);
    await expect(submitAssessment(ids.s!, id)).rejects.toThrow("이미 제출");
    await expect(saveAnswers(ids.s!, id, byLabel(1, "③").id, { b1: "68" }, 1)).rejects.toThrow("이미 제출");

    const result = (await loadAttemptResult(ids.s!, id))!;
    const status = (section: number, label: string) => result.items.find((i) => i.sectionNo === section && i.label === label)!.status;
    expect(status(1, "①")).toBe("correct");
    expect(status(1, "②")).toBe("wrong");
    expect(status(1, "③")).toBe("blank");
    expect(status(5, "②")).toBe("correct");
    expect(result.items.find((i) => i.id === explain.id)!.status).toBe("pending");
    expect(result.sections[0]).toMatchObject({ no: 1, total: 20, correct: 1 });

    const review = (await loadAttemptReview(ids.t!, id))!;
    const reviewed = review.items.find((i) => i.sectionNo === 1 && i.label === "②")!;
    expect(reviewed.blanks[0]).toMatchObject({ answer: "29", given: "30", correct: false });
    expect(await loadAttemptReview(ids.tOther!, id)).toBeNull(); // other organization: no rows
    expect(await loadAttemptResult(ids.s2!, id)).toBeNull(); // another student
  });
});
