/**
 * 진단 평가 grading — pure functions (no DB, no React).
 * Each blank has a `kind`; this decides how a student's text is compared to the answer.
 */

export type BlankKind = "int" | "rational" | "decimal" | "set" | "ox" | "compare" | "expr" | "text";

export interface BlankSpec {
  id: string;
  kind: BlankKind;
  answer: string;
  accept?: string[];
}

/** Exact rational number. Values in this content are small, so plain numbers are safe. */
interface Q {
  n: number;
  d: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function q(n: number, d: number): Q | null {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

/** "3", "-3", "1,533", "0.75", "3/4", "-3/5", "1 5/6", "-1 1/2" → exact value. */
export function parseNumber(raw: string): Q | null {
  const s = raw.trim().replace(/,/g, "").replace(/−/g, "-").replace(/\s+/g, " ");
  let m = /^(-?)(\d+) (\d+)\/(\d+)$/.exec(s); // mixed number
  if (m) {
    const sign = m[1] ? -1 : 1;
    const w = Number(m[2]);
    const n = Number(m[3]);
    const d = Number(m[4]);
    return q(sign * (w * d + n), d);
  }
  m = /^(-?\d+)\/(-?\d+)$/.exec(s);
  if (m) return q(Number(m[1]), Number(m[2]));
  m = /^(-?)(\d*)\.(\d+)$/.exec(s);
  if (m) {
    const d = 10 ** m[3]!.length;
    const n = Number((m[2] || "0") + m[3]);
    return q(m[1] ? -n : n, d);
  }
  if (/^-?\d+$/.test(s)) return q(Number(s), 1);
  return null;
}

const sameQ = (a: Q | null, b: Q | null) => !!a && !!b && a.n === b.n && a.d === b.d;

/** Formula text: lowercase, no spaces, unified symbols (², ×, ·, unicode minus). */
export function normalizeExpr(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/²/g, "^2")
    .replace(/[×·*]/g, "")
    .replace(/[−–]/g, "-")
    .replace(/\^\((\d+)\)/g, "^$1");
}

function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

function normalizeOX(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (["O", "○", "◯", "0"].includes(s)) return "O";
  if (["X", "×", "✕"].includes(s)) return "X";
  return s;
}

function normalizeSet(raw: string): string {
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .sort()
    .join(",");
}

/**
 * true/false for auto-gradable blanks; null when a teacher must grade
 * (free-text kinds, items marked manual, or an empty answer key).
 */
export function gradeBlank(spec: BlankSpec, given: string | null | undefined, itemGrading: "auto" | "manual" | "mixed"): boolean | null {
  if (itemGrading === "manual") return null;
  if (spec.kind === "text" && (itemGrading !== "auto" || !spec.answer)) return null;
  if (!spec.answer) return null;
  const g = (given ?? "").trim();
  if (!g) return false;
  const answers = [spec.answer, ...(spec.accept ?? [])];

  switch (spec.kind) {
    case "int":
    case "rational":
    case "decimal": {
      const v = parseNumber(g);
      return answers.some((a) => sameQ(v, parseNumber(a)));
    }
    case "set":
      return normalizeSet(g) === normalizeSet(spec.answer);
    case "ox":
      return normalizeOX(g) === normalizeOX(spec.answer);
    case "compare":
      return g.replace(/\s/g, "") === spec.answer;
    case "expr": {
      const n = normalizeExpr(g);
      const asNumber = parseNumber(g);
      return answers.some((a) => normalizeExpr(a) === n || (asNumber !== null && sameQ(asNumber, parseNumber(a))));
    }
    case "text":
      return answers.some((a) => normalizeText(a) === normalizeText(g));
  }
}

export interface GradedSummary {
  autoCorrect: number;
  autoTotal: number;
  manualPending: number;
}

export function summarize(results: (boolean | null)[]): GradedSummary {
  return {
    autoCorrect: results.filter((r) => r === true).length,
    autoTotal: results.filter((r) => r !== null).length,
    manualPending: results.filter((r) => r === null).length,
  };
}
