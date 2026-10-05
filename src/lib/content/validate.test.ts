import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { displayParts, expectedAnswer } from "./items";
import { validateItemsCsv, validateSkillsCsv } from "./validate";

const read = (f: string) => readFileSync(path.join(import.meta.dirname, "../../../content", f), "utf8");

describe("parseCsv", () => {
  it("handles BOM, quoted commas, escaped quotes and CRLF", () => {
    const { header, rows } = parseCsv('﻿a,b\r\n1,"x, ""y"""\r\n\r\n');
    expect(header).toEqual(["a", "b"]);
    expect(rows).toEqual([{ a: "1", b: 'x, "y"' }]);
  });
});

describe("item display / answers", () => {
  it("result blank", () => {
    expect(expectedAnswer(3, "+", 2, "result")).toBe(5);
    expect(displayParts({ a: 3, op: "+", b: 2, blank: "result" })).toEqual({ before: "3 + 2 =", after: "" });
  });
  it("operand2 blank shows the total and asks for b", () => {
    expect(expectedAnswer(9, "+", 1, "operand2")).toBe(1);
    expect(displayParts({ a: 9, op: "+", b: 1, blank: "operand2" })).toEqual({ before: "9 +", after: "= 10" });
  });
});

describe("shipped content", () => {
  it("skills.csv is valid with 15 skills in order", () => {
    const r = validateSkillsCsv(read("skills.csv"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows).toHaveLength(15);
      expect(r.rows[0]!.id).toBe("ADD_P1_INTU");
    }
  });
  it("items_addition_sum10.csv is valid: 174 items, all answers recomputed", () => {
    const skills = validateSkillsCsv(read("skills.csv"));
    const ids = new Set(skills.ok ? skills.rows.map((s) => s.id) : []);
    const r = validateItemsCsv(read("items_addition_sum10.csv"), ids);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows).toHaveLength(174);
  });
});

describe("rejections report line numbers", () => {
  const header = "set_id,skill_id,page,order,a,op,b,blank,answer\n";
  it("wrong answer", () => {
    const r = validateItemsCsv(header + "S1,K,1,1,2,+,3,result,5\nS1,K,1,2,2,+,4,result,7\n");
    expect(r).toEqual({ ok: false, errors: [{ line: 3, message: expect.stringContaining("정답 불일치") }] });
  });
  it("unknown skill and bad op", () => {
    const r = validateItemsCsv(header + "S1,NOPE,1,1,2,^,3,result,5\n", new Set(["K"]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.line)).toEqual([2, 2]);
  });
  it("missing columns", () => {
    const r = validateSkillsCsv("order,skill_id\n1,A\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.line).toBe(1);
  });
});
