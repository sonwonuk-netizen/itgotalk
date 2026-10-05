import { describe, expect, it } from "vitest";
import { classifyError, diagnoseAttempt, type WrongAnswer } from "./index";

const skill = { timeRule: "per_set" as const, timeLimitSec: 12 };
const w = (a: number, b: number, given: number | null, blank: WrongAnswer["blank"] = "result"): WrongAnswer => ({
  a, op: "+", b, blank, answer: blank === "result" ? a + b : b, given,
});

describe("classifyError", () => {
  it("off by one: counted one jump too few or too many", () => {
    expect(classifyError(w(3, 2, 4))).toBe("off_by_one");
    expect(classifyError(w(3, 2, 6))).toBe("off_by_one");
  });
  it("copied an operand instead of adding", () => {
    expect(classifyError(w(7, 3, 7))).toBe("copied_operand");
  });
  it("subtracted instead of added", () => {
    expect(classifyError(w(7, 3, 4))).toBe("wrong_operation");
  });
  it("blank and other", () => {
    expect(classifyError(w(3, 2, null))).toBe("blank");
    expect(classifyError(w(3, 2, 9))).toBe("other");
  });
  it("operand2 blank (9 + □ = 10) never counts as copied operand", () => {
    expect(classifyError(w(9, 1, 9, "operand2"))).toBe("other");
    expect(classifyError(w(8, 2, 3, "operand2"))).toBe("off_by_one");
  });
});

describe("diagnoseAttempt", () => {
  it("wrong answers → accuracy, even when also slow (concept before speed)", () => {
    const d = diagnoseAttempt({ itemCount: 5, correctCount: 3, elapsedMs: 20_000, wrongItems: [w(3, 2, 4), w(4, 2, 5)] }, skill);
    expect(d.weakness).toBe("accuracy");
    expect(d.mainError).toBe("off_by_one");
    expect(d.errors).toHaveLength(2);
  });
  it("all correct but over the limit → speed with the overrun", () => {
    const d = diagnoseAttempt({ itemCount: 5, correctCount: 5, elapsedMs: 15_300, wrongItems: [] }, skill);
    expect(d).toMatchObject({ weakness: "speed", limitMs: 12_000, overMs: 3_300, mainError: null });
  });
  it("all correct within the limit → none", () => {
    expect(diagnoseAttempt({ itemCount: 5, correctCount: 5, elapsedMs: 12_000, wrongItems: [] }, skill).weakness).toBe("none");
  });
  it("main error is the most frequent kind", () => {
    const d = diagnoseAttempt({ itemCount: 5, correctCount: 2, elapsedMs: 5_000, wrongItems: [w(3, 2, 9), w(5, 2, 5), w(6, 2, 6)] }, skill);
    expect(d.mainError).toBe("copied_operand");
  });
});

describe("diagnoseAttempt uses the stored judgment", () => {
  it("failed with all correct → speed, even if the limit was raised afterwards", () => {
    const d = diagnoseAttempt({ itemCount: 5, correctCount: 5, elapsedMs: 9_000, wrongItems: [], passed: false }, skill);
    expect(d.weakness).toBe("speed");
    expect(d.overMs).toBe(0);
  });
  it("passed → none, even if the limit was lowered afterwards", () => {
    expect(diagnoseAttempt({ itemCount: 5, correctCount: 5, elapsedMs: 20_000, wrongItems: [], passed: true }, skill).weakness).toBe("none");
  });
});

describe("classifyError for multiplication", () => {
  const m = (a: number, b: number, given: number): WrongAnswer => ({ a, op: "×", b, blank: "result", answer: a * b, given });
  it("one group too few or too many", () => {
    expect(classifyError(m(3, 4, 9))).toBe("off_by_group");
    expect(classifyError(m(3, 4, 15))).toBe("off_by_group");
    expect(classifyError(m(3, 4, 16))).toBe("off_by_group"); // 4 more = one more group of 4 (4 × 4)
  });
  it("added instead of multiplied", () => {
    expect(classifyError(m(3, 4, 7))).toBe("wrong_operation");
  });
  it("copied operand and other", () => {
    expect(classifyError(m(6, 7, 6))).toBe("copied_operand");
    expect(classifyError(m(6, 7, 40))).toBe("other");
  });
});
