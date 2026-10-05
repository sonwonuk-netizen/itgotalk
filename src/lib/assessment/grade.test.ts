import { describe, expect, it } from "vitest";
import { gradeBlank, normalizeExpr, parseNumber, summarize, type BlankSpec } from "./grade";

const b = (kind: BlankSpec["kind"], answer: string, accept?: string[]): BlankSpec => ({ id: "b1", kind, answer, accept });

describe("parseNumber", () => {
  it("reads integers, decimals, fractions and mixed numbers exactly", () => {
    expect(parseNumber("1,533")).toEqual({ n: 1533, d: 1 });
    expect(parseNumber("0.75")).toEqual({ n: 3, d: 4 });
    expect(parseNumber("6/4")).toEqual({ n: 3, d: 2 });
    expect(parseNumber("1 1/2")).toEqual({ n: 3, d: 2 });
    expect(parseNumber("-3/5")).toEqual({ n: -3, d: 5 });
    expect(parseNumber("−14")).toEqual({ n: -14, d: 1 });
    expect(parseNumber("abc")).toBeNull();
  });
});

describe("gradeBlank", () => {
  it("int", () => {
    expect(gradeBlank(b("int", "19"), " 19 ", "auto")).toBe(true);
    expect(gradeBlank(b("int", "1533"), "1,533", "auto")).toBe(true);
    expect(gradeBlank(b("int", "19"), "18", "auto")).toBe(false);
    expect(gradeBlank(b("int", "19"), "", "auto")).toBe(false);
  });

  it("rational accepts any equal value (unreduced, mixed, decimal)", () => {
    const s = b("rational", "3/2", ["1 1/2"]);
    for (const g of ["3/2", "6/4", "1 1/2", "1.5"]) expect(gradeBlank(s, g, "auto")).toBe(true);
    expect(gradeBlank(s, "2/3", "auto")).toBe(false);
    expect(gradeBlank(b("rational", "231/5"), "46.2", "auto")).toBe(true);
  });

  it("decimal compares values", () => {
    expect(gradeBlank(b("decimal", "25.31"), "25.310", "auto")).toBe(true);
    expect(gradeBlank(b("decimal", "0.01"), "0.1", "auto")).toBe(false);
  });

  it("set ignores order and spaces", () => {
    expect(gradeBlank(b("set", "10101,8040,201"), "201, 10101,8040", "auto")).toBe(true);
    expect(gradeBlank(b("set", "10101,8040,201"), "201,8040", "auto")).toBe(false);
  });

  it("ox and compare", () => {
    expect(gradeBlank(b("ox", "O"), "○", "auto")).toBe(true);
    expect(gradeBlank(b("ox", "X"), "x", "auto")).toBe(true);
    expect(gradeBlank(b("compare", "<"), "<", "auto")).toBe(true);
    expect(gradeBlank(b("compare", "<"), ">", "auto")).toBe(false);
  });

  it("expr normalizes spacing and symbols", () => {
    expect(normalizeExpr("a² + 2ab + b²")).toBe("a^2+2ab+b^2");
    expect(gradeBlank(b("expr", "a^2+2ab+b^2"), "a² + 2ab + b²", "auto")).toBe(true);
    expect(gradeBlank(b("expr", "6a", ["6*a"]), "6 × a", "auto")).toBe(true);
    expect(gradeBlank(b("expr", "10π", ["31.4"]), "31.4", "mixed")).toBe(true);
    expect(gradeBlank(b("expr", "-y"), "y", "auto")).toBe(false);
  });

  it("free text and manual items are left for the teacher", () => {
    expect(gradeBlank(b("text", ""), "분자끼리 곱해요", "mixed")).toBeNull();
    expect(gradeBlank(b("text", "30×(1-2/3)"), "30×(1-2/3)", "mixed")).toBeNull();
    expect(gradeBlank(b("int", "4"), "4", "manual")).toBeNull();
    // auto text item (reading a decimal) is compared without spaces
    expect(gradeBlank(b("text", "삼십사 점 일일영칠"), "삼십사점일일영칠", "auto")).toBe(true);
  });

  it("summarize", () => {
    expect(summarize([true, false, null, true])).toEqual({ autoCorrect: 2, autoTotal: 3, manualPending: 1 });
  });
});
