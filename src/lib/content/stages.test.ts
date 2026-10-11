import { describe, expect, it } from "vitest";
import { groupStages } from "./stages";

const skills = [
  { id: "A1", book: "SA" },
  { id: "A2", book: "SA" },
  { id: "B1", book: "SB" },
  { id: "C1", book: "SC" },
];

describe("groupStages", () => {
  it("returns null for a track without stages", () => {
    expect(groupStages("tap", skills, () => undefined)).toBeNull();
  });

  it("puts each skill in its book's stage and marks empty stages as coming soon", () => {
    const stages = groupStages("add", skills, () => undefined)!;
    expect(stages).toHaveLength(8);
    expect(stages.map((s) => s.skills.map((k) => k.id))).toEqual([["A1", "A2"], ["B1"], ["C1"], [], [], [], [], []]);
    expect(stages.map((s) => s.status)).toEqual(["locked", "locked", "locked", "soon", "soon", "soon", "soon", "soon"]);
  });

  it("derives each stage's status from progress", () => {
    const progress: Record<string, "locked" | "in_progress" | "passed"> = { A1: "passed", A2: "passed", B1: "in_progress", C1: "locked" };
    const stages = groupStages("add", skills, (id) => progress[id])!;
    expect(stages.slice(0, 3).map((s) => [s.status, s.passedCount])).toEqual([["done", 2], ["current", 0], ["locked", 0]]);
  });

  it("an unfinished stage with a passed skill but nothing in progress is open (e.g. reviewing)", () => {
    const stages = groupStages("add", skills, (id) => (id === "A1" ? "passed" : "locked"))!;
    expect(stages[0]!.status).toBe("open");
  });
});
