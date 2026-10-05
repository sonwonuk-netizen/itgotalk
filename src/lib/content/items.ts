export type Op = "+" | "-" | "×" | "÷";
export type Blank = "result" | "operand2";

export interface Item {
  a: number;
  op: Op;
  b: number;
  blank: Blank;
  answer: number;
}

export const OPS: readonly Op[] = ["+", "-", "×", "÷"];
export const BLANKS: readonly Blank[] = ["result", "operand2"];

export function evaluate(a: number, op: Op, b: number): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b !== 0 && a % b === 0 ? a / b : null;
  }
}

/** The value that goes in the □. result: a op b, operand2: b. */
export function expectedAnswer(a: number, op: Op, b: number, blank: Blank): number | null {
  const value = evaluate(a, op, b);
  if (value === null) return null;
  return blank === "result" ? value : b;
}

/** data-model.md display rule. Returns the parts left/right of the box. */
export function displayParts(item: Pick<Item, "a" | "op" | "b" | "blank">): { before: string; after: string } {
  if (item.blank === "result") return { before: `${item.a} ${item.op} ${item.b} =`, after: "" };
  return { before: `${item.a} ${item.op}`, after: `= ${evaluate(item.a, item.op, item.b)}` };
}

/** Identity used to keep the same problem from appearing twice in a row. */
export function itemKey(item: Pick<Item, "a" | "op" | "b" | "blank">): string {
  return `${item.a}${item.op}${item.b}${item.blank}`;
}
