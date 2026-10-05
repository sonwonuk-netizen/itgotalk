import { parseCsv } from "./csv";
import { BLANKS, OPS, expectedAnswer, type Blank, type Op } from "./items";

export interface RowError {
  /** 1-based line number in the file (header is line 1). */
  line: number;
  message: string;
}

export interface SkillRow {
  ord: number;
  id: string;
  book: string;
  week: number | null;
  name: string;
  /** Learning track (덧셈, 구구단, 빨리 누르기…). Optional column, defaults to "add". */
  trackId: string;
  pattern: (typeof PATTERNS)[number];
  operand: number | null;
  hint: string;
  timeRule: "per_set" | "per_item";
  timeLimitSec: number;
  practiceRequired: number;
  setPages: number[];
}

export interface ItemRow {
  setId: string;
  skillId: string;
  page: number;
  ord: number;
  a: number;
  op: Op;
  b: number;
  blank: Blank;
  answer: number;
}

export type Validated<T> = { ok: true; rows: T[] } | { ok: false; errors: RowError[] };

const SKILL_COLUMNS = ["order", "skill_id", "book", "week", "name", "pattern", "operand", "hint", "time_rule", "time_limit_sec", "practice_required", "set_pages"];
const ITEM_COLUMNS = ["set_id", "skill_id", "page", "order", "a", "op", "b", "blank", "answer"];
export const PATTERNS = ["intro", "intuition", "commutative", "complement10", "times_table", "times_mixed", "tap_sequence"] as const;

function int(v: string | undefined): number | null {
  if (v === undefined || !/^-?\d+$/.test(v)) return null;
  return Number(v);
}

function missingColumns(header: string[], required: string[]): RowError[] {
  const missing = required.filter((c) => !header.includes(c));
  return missing.length ? [{ line: 1, message: `필수 컬럼 없음: ${missing.join(", ")}` }] : [];
}

/** @param knownTrackIds when given, the track column must name one of these. */
export function validateSkillsCsv(text: string, knownTrackIds?: Set<string>): Validated<SkillRow> {
  const { header, rows } = parseCsv(text);
  const errors = missingColumns(header, SKILL_COLUMNS);
  if (errors.length) return { ok: false, errors };

  const out: SkillRow[] = [];
  const ids = new Set<string>();
  const ords = new Set<number>();
  rows.forEach((r, i) => {
    const line = i + 2;
    const err = (message: string) => errors.push({ line, message });
    const ord = int(r.order);
    const operand = r.operand ? int(r.operand) : null;
    const timeLimit = Number(r.time_limit_sec);
    const practice = int(r.practice_required);
    const pages = (r.set_pages ?? "").split("|").map((p) => int(p.trim()));
    const id = r.skill_id ?? "";

    if (!/^[A-Z0-9_]+$/.test(id)) err(`skill_id 형식 오류: "${id}"`);
    if (ids.has(id)) err(`skill_id 중복: ${id}`);
    if (ord === null) err("order는 정수여야 합니다");
    else if (ords.has(ord)) err(`order 중복: ${ord}`);
    if (!r.name) err("name이 비어 있습니다");
    if (r.track && !/^[a-z0-9_]+$/.test(r.track)) err(`track 형식 오류: "${r.track}"`);
    if (knownTrackIds && !knownTrackIds.has(r.track || "add")) err(`알 수 없는 track: ${r.track}`);
    if (!PATTERNS.includes(r.pattern as SkillRow["pattern"])) err(`pattern 값 오류: "${r.pattern}"`);
    if (r.operand && operand === null) err("operand는 정수여야 합니다");
    if (r.time_rule !== "per_set" && r.time_rule !== "per_item") err(`time_rule 값 오류: "${r.time_rule}"`);
    if (!(timeLimit > 0)) err("time_limit_sec는 0보다 커야 합니다");
    if (practice === null || practice < 0) err("practice_required는 0 이상의 정수여야 합니다");
    if (pages.length === 0 || pages.some((p) => p === null)) err(`set_pages 형식 오류: "${r.set_pages}"`);

    ids.add(id);
    if (ord !== null) ords.add(ord);
    out.push({
      ord: ord ?? 0,
      id,
      trackId: r.track || "add",
      book: r.book ?? "",
      week: int(r.week),
      name: r.name ?? "",
      pattern: r.pattern as SkillRow["pattern"],
      operand,
      hint: r.hint ?? "",
      timeRule: r.time_rule as SkillRow["timeRule"],
      timeLimitSec: timeLimit,
      practiceRequired: practice ?? 0,
      setPages: pages.filter((p): p is number => p !== null),
    });
  });
  return errors.length ? { ok: false, errors } : { ok: true, rows: out.sort((x, y) => x.ord - y.ord) };
}

/**
 * Validates an items_*.csv. Every answer is recomputed from a, op, b, blank;
 * a mismatch rejects the file with the offending line number (PRD ST-40).
 * @param knownSkillIds when given, skill_id must be one of these.
 */
export function validateItemsCsv(text: string, knownSkillIds?: Set<string>): Validated<ItemRow> {
  const { header, rows } = parseCsv(text);
  const errors = missingColumns(header, ITEM_COLUMNS);
  if (errors.length) return { ok: false, errors };

  const out: ItemRow[] = [];
  const seen = new Set<string>();
  const setSkill = new Map<string, string>();
  rows.forEach((r, i) => {
    const line = i + 2;
    const err = (message: string) => errors.push({ line, message });
    const [page, ord, a, b, answer] = [int(r.page), int(r.order), int(r.a), int(r.b), int(r.answer)];
    const setId = r.set_id ?? "";
    const skillId = r.skill_id ?? "";
    const op = r.op as Op;
    const blank = r.blank as Blank;

    if (!setId) err("set_id가 비어 있습니다");
    if (knownSkillIds && !knownSkillIds.has(skillId)) err(`알 수 없는 skill_id: ${skillId}`);
    const prevSkill = setSkill.get(setId);
    if (prevSkill && prevSkill !== skillId) err(`세트 ${setId}의 skill_id가 일관되지 않습니다 (${prevSkill} / ${skillId})`);
    if (page === null || ord === null) err("page, order는 정수여야 합니다");
    if (a === null || b === null || answer === null) err("a, b, answer는 정수여야 합니다");
    if (!OPS.includes(op)) err(`op 값 오류: "${r.op}"`);
    if (!BLANKS.includes(blank)) err(`blank 값 오류: "${r.blank}"`);
    const dupKey = `${setId}#${ord}`;
    if (seen.has(dupKey)) err(`같은 세트에 order 중복: ${setId} ${ord}`);

    if (a !== null && b !== null && answer !== null && OPS.includes(op) && BLANKS.includes(blank)) {
      const expected = expectedAnswer(a, op, b, blank);
      if (expected === null) err(`계산할 수 없는 문항: ${a} ${op} ${b}`);
      else if (expected !== answer) err(`정답 불일치: ${a} ${op} ${b} (${blank}) → 정답 ${expected}, 파일 값 ${answer}`);
    }

    seen.add(dupKey);
    setSkill.set(setId, skillId);
    out.push({ setId, skillId, page: page ?? 0, ord: ord ?? 0, a: a ?? 0, op, b: b ?? 0, blank, answer: answer ?? 0 });
  });
  return errors.length ? { ok: false, errors } : { ok: true, rows: out };
}

export interface ExplanationRow {
  skillId: string;
  weakness: "accuracy" | "speed";
  title: string;
  body: string;
  tip: string;
}

/** explanations.csv: one row per (skill_id, weakness). Shown after a diagnostic or failed test. */
export function validateExplanationsCsv(text: string, knownSkillIds?: Set<string>): Validated<ExplanationRow> {
  const { header, rows } = parseCsv(text);
  const errors = missingColumns(header, ["skill_id", "weakness", "title", "body"]);
  if (errors.length) return { ok: false, errors };
  const out: ExplanationRow[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const line = i + 2;
    const err = (message: string) => errors.push({ line, message });
    const skillId = r.skill_id ?? "";
    const weakness = r.weakness as ExplanationRow["weakness"];
    if (knownSkillIds && !knownSkillIds.has(skillId)) err(`알 수 없는 skill_id: ${skillId}`);
    if (weakness !== "accuracy" && weakness !== "speed") err(`weakness는 accuracy 또는 speed: "${r.weakness}"`);
    if (!r.title) err("title이 비어 있습니다");
    if (!r.body) err("body가 비어 있습니다");
    const key = `${skillId}#${weakness}`;
    if (seen.has(key)) err(`중복: ${skillId} ${weakness}`);
    seen.add(key);
    out.push({ skillId, weakness, title: r.title ?? "", body: r.body ?? "", tip: r.tip ?? "" });
  });
  return errors.length ? { ok: false, errors } : { ok: true, rows: out };
}

export interface TrackRow {
  id: string;
  ord: number;
  name: string;
  description: string;
  icon: string;
  hasDiagnostic: boolean;
}

/** tracks.csv: the learning tracks shown in 학습자료실. */
export function validateTracksCsv(text: string): Validated<TrackRow> {
  const { header, rows } = parseCsv(text);
  const errors = missingColumns(header, ["track_id", "order", "name", "has_diagnostic"]);
  if (errors.length) return { ok: false, errors };
  const out: TrackRow[] = [];
  const ids = new Set<string>();
  rows.forEach((r, i) => {
    const line = i + 2;
    const err = (message: string) => errors.push({ line, message });
    const id = r.track_id ?? "";
    const ord = int(r.order);
    if (!/^[a-z0-9_]+$/.test(id)) err(`track_id 형식 오류: "${id}"`);
    if (ids.has(id)) err(`track_id 중복: ${id}`);
    if (ord === null) err("order는 정수여야 합니다");
    if (!r.name) err("name이 비어 있습니다");
    if (r.has_diagnostic !== "true" && r.has_diagnostic !== "false") err("has_diagnostic은 true 또는 false");
    ids.add(id);
    out.push({ id, ord: ord ?? 0, name: r.name ?? "", description: r.description ?? "", icon: r.icon ?? "", hasDiagnostic: r.has_diagnostic === "true" });
  });
  return errors.length ? { ok: false, errors } : { ok: true, rows: out.sort((a, b) => a.ord - b.ord) };
}
